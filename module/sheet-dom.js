/** Apply the common read-only DOM state used by Brinkwood sheets. */
export function lockSheetFormControls(html) {
  html.querySelectorAll("input, select").forEach(control => {
    control.disabled = true;
    control.setAttribute("aria-disabled", "true");
  });
  html.querySelectorAll("textarea").forEach(control => {
    control.readOnly = true;
    control.setAttribute("aria-readonly", "true");
  });
}

/** Convert one named form control into a Foundry document update. */
export function formControlUpdate(control) {
  const { name, type } = control ?? {};
  if (!name || control.disabled || (type === "radio" && !control.checked)) return null;
  const value = type === "checkbox"
    ? control.checked
    : control.multiple
      ? Array.from(control.selectedOptions, option => option.value)
      : control.value ?? control.getAttribute?.("value") ?? "";
  return { [name]: value };
}

const failedFormSaves = new WeakMap();

function failedSavesFor(document) {
  let saves = failedFormSaves.get(document);
  if (!saves) failedFormSaves.set(document, saves = new Map());
  return saves;
}

function saveFailureMessage() {
  return globalThis.game?.i18n?.localize?.("BITD.SaveFailed") ?? "Could not save changes.";
}

/** Report a failed direct interaction without leaking a native listener rejection. */
export function reportSheetInteractionFailure(error, messageKey = "BITD.SaveFailed") {
  console.error("Brinkwood sheet interaction failed", { messageKey, error });
  const message = globalThis.game?.i18n?.localize?.(messageKey) ?? "Could not save changes.";
  globalThis.ui?.notifications?.error?.(message);
}

function retryLabel() {
  return globalThis.game?.i18n?.localize?.("BITD.Retry") ?? "Retry";
}

/** Render outstanding form-save failures after each ApplicationV2 render. */
export function bindSheetSaveStatus(sheet, html, listenerOptions) {
  const host = html?.matches?.("form") ? html : html?.querySelector?.("form") ?? html;
  const browserDocument = globalThis.document;
  if (!host?.append || !browserDocument?.createElement) return;
  host.querySelectorAll?.(".sheet-save-status")?.forEach(status => status.remove());
  const saves = failedFormSaves.get(sheet?.document);
  if (!saves?.size) return;

  for (const [path, failed] of saves) {
    if (!failed.failed) continue;
    const status = browserDocument.createElement("div");
    status.className = "sheet-save-status";
    status.setAttribute("role", "alert");
    const message = browserDocument.createElement("span");
    message.textContent = saveFailureMessage();
    const retry = browserDocument.createElement("button");
    retry.type = "button";
    retry.className = "sheet-save-status__retry";
    retry.textContent = retryLabel();
    retry.addEventListener("click", event => {
      event.preventDefault();
      void retryFailedFormSave(sheet, path, failed);
    }, listenerOptions);
    status.append(message, retry);
    host.append(status);
  }
}

async function queueFormSave(sheet, path, update, { render, canPersist, shouldPersist } = {}, expectedFailure) {
  const document = sheet?.document;
  if (!document || !path) return false;
  const saves = failedSavesFor(document);
  const previous = saves.get(path);
  if (expectedFailure && previous !== expectedFailure) return false;
  const token = Symbol(path);
  saves.set(path, { token, pending: true });
  bindSheetSaveStatus(sheet, sheet.element);
  let persistedUpdate = update;

  try {
    const saved = await queueDocumentPathUpdate(document, path, async () => {
      if (!sheet?.isEditable || (canPersist && !canPersist())) return false;
      if (shouldPersist && !shouldPersist()) return false;
      persistedUpdate = typeof update === "function" ? await update() : update;
      if (!persistedUpdate) return false;
      if (render === undefined) await document.update(persistedUpdate);
      else await document.update(persistedUpdate, { render });
      return true;
    });
    if (saves.get(path)?.token === token) {
      saves.delete(path);
      bindSheetSaveStatus(sheet, sheet.element);
    }
    return saved;
  } catch (error) {
    if (saves.get(path)?.token === token) {
      const failed = { token, failed: true, update: persistedUpdate, options: { render, canPersist, shouldPersist } };
      saves.set(path, failed);
      console.error("Brinkwood sheet save failed", { path, error });
      globalThis.ui?.notifications?.error?.(saveFailureMessage());
      bindSheetSaveStatus(sheet, sheet.element);
    }
    return false;
  }
}

/** Snapshot and serialize one ordinary form control save for this Document path. */
export function persistFormControlChange(sheet, control, options = {}) {
  if (!sheet?.isEditable || options.canPersist?.() === false) return Promise.resolve(false);
  const update = formControlUpdate(control);
  if (!update) return Promise.resolve(false);
  const [path] = Object.keys(update);
  return queueFormSave(sheet, path, update, options);
}

/** Persist a portrait selected through Foundry v13's FilePicker. */
export async function editDocumentImage(event, target) {
  event?.preventDefault?.();
  const sheet = this;
  const path = target?.dataset?.edit;
  if (!sheet?.isEditable || !path) return false;

  const FilePicker = foundry.applications.apps.FilePicker.implementation;
  const current = foundry.utils.getProperty(sheet.document, path) ?? "";
  const picker = new FilePicker({
    type: "image",
    current,
    callback: selected => selected ? persistFormControlChange(sheet, {
      name: path,
      type: "text",
      value: selected,
    }, {
      render: true,
      shouldPersist: () => foundry.utils.getProperty(sheet.document, path) !== selected,
    }) : false,
  });
  await picker.browse();
  return true;
}

/** Commit one Character/Mask tracker rank, preserving each sheet's renderer. */
export async function persistTrackerChange(sheet, event, refreshDisplay) {
  event.preventDefault();
  const element = event.currentTarget;
  const { path, baseValue, value, max_value } = element.dataset;
  const selected = Number(baseValue ?? value);
  const maximum = Number(max_value);
  if (!sheet.isEditable || !path?.startsWith("system.") || !Number.isFinite(selected)) return false;
  try {
    await queueDocumentPathUpdate(sheet.document, path, async () => {
      const current = Number(foundry.utils.getProperty(sheet.document, path));
      let next = selected === current && selected === 1 ? 0 : selected;
      if (Number.isFinite(maximum)) next = Math.min(next, maximum);
      await sheet.document.update({ [path]: next }, { render: false });
      refreshDisplay(element, next, maximum);
    });
    return true;
  } catch (error) {
    reportSheetInteractionFailure(error, "BITD.TrackerUpdateFailed");
    const current = Number(foundry.utils.getProperty(sheet.document, path));
    const liveElement = Array.from(sheet.element?.querySelectorAll?.(".dot-value") ?? [])
      .find(dot => dot.dataset.path === path) ?? element;
    if (Number.isFinite(current)) refreshDisplay(liveElement, current, maximum);
    return false;
  }
}

/** Retry exactly the immutable payload that failed, unless a newer edit replaced it. */
export function retryFailedFormSave(sheet, path, expectedFailure) {
  const failed = failedFormSaves.get(sheet?.document)?.get(path);
  if (!failed?.failed || (expectedFailure && failed !== expectedFailure)) return Promise.resolve(false);
  return queueFormSave(sheet, path, failed.update, failed.options, failed);
}

const indexedExperienceCluePath = /^system\.experience_clues\.(0|[1-9]\d*)$/;

/** Persist one Class experience clue through its authoritative ArrayField. */
export function persistIndexedExperienceClue(sheet, control, { canPersist } = {}) {
  const document = sheet?.document ?? sheet;
  if (control?.disabled) return Promise.resolve(false);
  const name = control?.name ?? "";
  const match = indexedExperienceCluePath.exec(name);
  if (!match) return Promise.resolve(false);

  const index = Number(match[1]);
  // Snapshot the DOM value before this document/path queue waits.
  const value = control.value ?? control.getAttribute?.("value") ?? "";
  if (!Number.isSafeInteger(index) || index < 0) return Promise.resolve(false);

  const saveSheet = sheet?.document ? sheet : { document, isEditable: true };
  return queueFormSave(saveSheet, "system.experience_clues", async () => {
    const current = foundry.utils.getProperty(document, "system.experience_clues");
    if (!Array.isArray(current) || index >= current.length) return false;

    const next = current.slice();
    next[index] = value;
    return { "system.experience_clues": next };
  }, { canPersist });
}

/** Character/Mask rich-text commits explicitly refresh the enriched preview. */
export async function persistRichTextChange(sheet, event) {
  if (!sheet?.isEditable) return false;
  const control = event?.currentTarget;
  if (!control?.matches?.("prose-mirror[name]")) return false;
  return persistFormControlChange(sheet, control, { render: true });
}

/** Hydrate all sheet editors and route each change to its sheet-owned save policy. */
export function bindRichTextPersistence(sheet, html, listenerOptions) {
  html.querySelectorAll("prose-mirror[name]").forEach(control => {
    // Foundry may normalize the parser-created custom element after _onRender,
    // clearing its internal raw value while leaving the enriched preview intact.
    // Hydrate from the authoritative Document before ProseMirror opens.
    const hydrateValue = () => {
      const documentValue = control.name
        ?.split(".")
        .reduce((value, key) => value?.[key], sheet.document);
      if (typeof documentValue !== "string" || control.value === documentValue) return;
      const preview = control.querySelector?.(".editor-content");
      const enrichedPreview = preview?.innerHTML;
      // Avoid the public setter's synthetic change event: hydration is not a
      // user edit and must never enter the persistence path.
      if (typeof control._setValue === "function") {
        control._setValue(documentValue);
        control._refresh?.();
      } else control.value = documentValue;
      if (!control.open && preview && enrichedPreview !== undefined) preview.innerHTML = enrichedPreview;
    };

    hydrateValue();
    // Foundry can normalize the parser-created custom element after _onRender.
    // Re-hydrate in capture phase immediately before its pencil handler opens
    // ProseMirror, guaranteeing the raw value used by normal edit mode.
    control.addEventListener("click", hydrateValue, { ...listenerOptions, capture: true });

    control.addEventListener(
      "change",
      event => sheet._persistFormControl(event),
      listenerOptions,
    );
  });
}


/** Prevent native submit; the ensuing blur emits the sheet's one change event. */
export function handleActorNameEnter(event) {
  if (event.key !== "Enter" || event.isComposing) return false;
  event.preventDefault();
  event.currentTarget?.blur();
  return true;
}

/** Persist an Actor's root name once and request a Foundry-visible rerender. */
export async function persistActorNameChange(sheet, event) {
  if (!sheet?.isEditable) return false;

  const input = event?.currentTarget;
  const update = formControlUpdate(input);
  if (!update || !Object.hasOwn(update, "name")) return false;

  const name = update.name ?? "";
  return persistFormControlChange(sheet, input, {
    render: true,
    shouldPersist: () => sheet.document.name !== name,
  });
}


const documentPathQueues = new WeakMap();

/** Serialize read-modify-write interactions for one Document field path. */
export function queueDocumentPathUpdate(document, path, action) {
  if (!document || !path || typeof action !== "function") return Promise.resolve(false);

  let pathQueues = documentPathQueues.get(document);
  if (!pathQueues) {
    pathQueues = new Map();
    documentPathQueues.set(document, pathQueues);
  }

  const previous = pathQueues.get(path) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(action);
  pathQueues.set(path, operation);

  return operation.finally(() => {
    if (pathQueues.get(path) !== operation) return;
    pathQueues.delete(path);
    if (pathQueues.size === 0) documentPathQueues.delete(document);
  });
}
