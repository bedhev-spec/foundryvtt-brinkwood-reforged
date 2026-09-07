const FLAG_SCOPE = "brinkwood-reforged";
const FLAG_KEY = "linkedJournalUuid";
const FLAG_PATH = `flags.${FLAG_SCOPE}.${FLAG_KEY}`;

const localize = (key, fallback) => globalThis.game?.i18n?.localize?.(key) ?? fallback;

function isJournalDocument(document) {
  return ["JournalEntry", "JournalEntryPage"].includes(document?.documentName);
}

function canView(document) {
  if (!document || document.visible === false) return false;
  if (typeof document.testUserPermission !== "function") return true;
  return document.testUserPermission(globalThis.game?.user, "OBSERVER");
}

function notify(level, key, fallback) {
  globalThis.ui?.notifications?.[level]?.(localize(key, fallback));
}

/** Resolve a stored Journal Entry or Journal Entry Page UUID without changing the Actor. */
export async function resolveLinkedJournal(uuid) {
  if (!uuid || typeof globalThis.fromUuid !== "function") return null;
  try {
    const document = await globalThis.fromUuid(uuid);
    return isJournalDocument(document) && canView(document) ? document : null;
  } catch (_error) {
    return null;
  }
}

/** Prepare the shared template projection. A missing, deleted, or inaccessible target is unavailable. */
export async function prepareLinkedJournalContext(document, { editable = false } = {}) {
  const uuid = document?.flags?.[FLAG_SCOPE]?.[FLAG_KEY] ?? "";
  if (!uuid) return { state: "unlinked", uuid: "", available: false, show: Boolean(editable) };

  const journal = await resolveLinkedJournal(uuid);
  return {
    state: journal ? "linked" : "unavailable",
    uuid,
    available: Boolean(journal),
    show: true,
    title: journal?.name ?? journal?.parent?.name ?? "",
  };
}

/** Persist the sole supported link storage path after validating the supplied Journal UUID. */
export async function persistLinkedJournalUuid(sheet, uuid) {
  if (!sheet?.isEditable || typeof sheet.document?.update !== "function") return false;
  const journal = await resolveLinkedJournal(uuid);
  if (!journal) {
    notify("warn", "BITD.LinkedJournalInvalid", "Choose a Journal Entry or Journal Entry Page that you can access.");
    return false;
  }
  await sheet.document.update({ [FLAG_PATH]: journal.uuid ?? uuid });
  return true;
}

/** Remove the link through the same Actor document update boundary. */
export async function unlinkJournal(sheet) {
  if (!sheet?.isEditable || typeof sheet.document?.update !== "function") return false;
  await sheet.document.update({ [`flags.${FLAG_SCOPE}.-=${FLAG_KEY}`]: null });
  return true;
}

/** Open the resolved document's normal Foundry sheet. */
export async function openLinkedJournal(uuid) {
  const journal = await resolveLinkedJournal(uuid);
  if (!journal?.sheet?.render) {
    notify("warn", "BITD.LinkedJournalUnavailable", "Journal unavailable.");
    return false;
  }
  await journal.sheet.render(true);
  return true;
}

function escaped(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (typeof collection.values === "function") return Array.from(collection.values());
  return Array.from(collection);
}

/** Build the accessible Journal Entry/Page choices used by the Foundry-style picker. */
export function prepareLinkedJournalPickerData(currentJournal, journalCollection = globalThis.game?.journal) {
  const entries = collectionValues(journalCollection)
    .filter(entry => entry?.documentName === "JournalEntry" && entry.uuid && canView(entry))
    .map(entry => ({
      uuid: entry.uuid,
      name: entry.name ?? "",
      pages: collectionValues(entry.pages)
        .filter(page => page?.documentName === "JournalEntryPage" && page.uuid && canView(page))
        .map(page => ({ uuid: page.uuid, name: page.name ?? "" })),
    }));
  const selectedEntry = currentJournal?.documentName === "JournalEntryPage"
    ? currentJournal.parent
    : currentJournal;
  return {
    entries,
    selectedEntryUuid: entries.some(entry => entry.uuid === selectedEntry?.uuid) ? selectedEntry.uuid : "",
    selectedPageUuid: currentJournal?.documentName === "JournalEntryPage" ? currentJournal.uuid : "",
  };
}

function journalEntryOptions(entries, selectedUuid) {
  const choose = escaped(localize("BITD.LinkedJournalChooseEntry", "Choose a Journal Entry"));
  return `<option value="">${choose}</option>${entries.map(entry => `<option value="${escaped(entry.uuid)}"${entry.uuid === selectedUuid ? " selected" : ""}>${escaped(entry.name)}</option>`).join("")}`;
}

function journalPageOptions(entry, selectedUuid = "") {
  const wholeEntry = escaped(localize("BITD.LinkedJournalWholeEntry", "Whole Journal Entry"));
  return `<option value="">${wholeEntry}</option>${(entry?.pages ?? []).map(page => `<option value="${escaped(page.uuid)}"${page.uuid === selectedUuid ? " selected" : ""}>${escaped(page.name)}</option>`).join("")}`;
}

async function promptForJournalUuid(currentUuid = "") {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return null;
  const currentJournal = await resolveLinkedJournal(currentUuid);
  const picker = prepareLinkedJournalPickerData(currentJournal);
  if (!picker.entries.length) {
    notify("warn", "BITD.LinkedJournalNoneAvailable", "No accessible Journal Entries are available.");
    return null;
  }

  const entryLabel = escaped(localize("BITD.LinkedJournalEntry", "Journal Entry"));
  const entryHint = escaped(localize("BITD.LinkedJournalEntryHint", "A linked Journal Entry providing notes for this Actor."));
  const pageLabel = escaped(localize("BITD.LinkedJournalPage", "Journal Entry Page"));
  const pageHint = escaped(localize("BITD.LinkedJournalPageHint", "A specific page from the linked Journal Entry."));
  const selectedEntry = picker.entries.find(entry => entry.uuid === picker.selectedEntryUuid);
  const content = `<form class="linked-journal-picker">
    <div class="form-group"><label>${entryLabel}</label><div class="form-fields"><select name="linkedJournalEntry">${journalEntryOptions(picker.entries, picker.selectedEntryUuid)}</select></div><p class="hint">${entryHint}</p></div>
    <div class="form-group"><label>${pageLabel}</label><div class="form-fields"><select name="linkedJournalPage"${selectedEntry ? "" : " disabled"}>${journalPageOptions(selectedEntry, picker.selectedPageUuid)}</select></div><p class="hint">${pageHint}</p></div>
  </form>`;

  class LinkedJournalDialog extends DialogV2 {
    async _onFirstRender(context, options) {
      await super._onFirstRender(context, options);
      const entrySelect = this.element?.querySelector?.('[name="linkedJournalEntry"]');
      const pageSelect = this.element?.querySelector?.('[name="linkedJournalPage"]');
      if (!entrySelect || !pageSelect) return;
      entrySelect.addEventListener("change", () => {
        const entry = picker.entries.find(candidate => candidate.uuid === entrySelect.value);
        pageSelect.innerHTML = journalPageOptions(entry);
        pageSelect.disabled = !entry;
      });
    }
  }

  return LinkedJournalDialog.wait({
    window: { title: localize("BITD.LinkedJournalPickerTitle", "Link Journal") },
    content,
    buttons: [
      {
        action: "link",
        label: localize("BITD.LinkJournal", "Link Journal"),
        default: true,
        callback: (_event, button, dialog) => {
          const form = button.form ?? dialog.element.querySelector("form");
          const entryUuid = form?.elements?.linkedJournalEntry?.value ?? "";
          const pageUuid = form?.elements?.linkedJournalPage?.value ?? "";
          return pageUuid || entryUuid;
        },
      },
      { action: "cancel", label: localize("Cancel", "Cancel") },
    ],
    rejectClose: false,
  });
}

function uuidFromDrop(event) {
  const getData = globalThis.TextEditor?.getDragEventData
    ?? globalThis.foundry?.applications?.ux?.TextEditor?.implementation?.getDragEventData;
  const data = getData?.(event);
  if (data?.uuid) return data.uuid;
  const raw = event.dataTransfer?.getData("text/plain");
  if (!raw) return "";
  try { return JSON.parse(raw)?.uuid ?? ""; } catch (_error) { return raw.trim(); }
}

/** Bind one shared interaction owner for NPC and Rebellion instances. */
export function bindLinkedJournalCta(sheet, html, listenerOptions = {}) {
  const root = html?.querySelector?.("[data-linked-journal-cta]");
  if (!root) return;
  root.addEventListener("click", async event => {
    const control = event.target.closest?.("[data-linked-journal-action]");
    if (!control) return;
    event.preventDefault();
    const action = control.dataset.linkedJournalAction;
    if (action === "open") return void openLinkedJournal(root.dataset.linkedJournalUuid);
    if (action === "unlink") return void unlinkJournal(sheet);
    if (action === "link" || action === "change") {
      const uuid = await promptForJournalUuid(root.dataset.linkedJournalUuid);
      if (uuid) await persistLinkedJournalUuid(sheet, uuid);
    }
  }, listenerOptions);

  if (!sheet?.isEditable) return;
  root.addEventListener("dragover", event => event.preventDefault(), listenerOptions);
  root.addEventListener("drop", async event => {
    event.preventDefault();
    const uuid = uuidFromDrop(event);
    if (uuid) await persistLinkedJournalUuid(sheet, uuid);
  }, listenerOptions);
}
