import { bindRichTextPersistence, bindSheetSaveStatus, persistFormControlChange, persistRichTextChange } from "../../module/sheet-dom.js";
import { readItemPickerSelection, renderItemPickerContent } from "../../module/item-picker-dialog.js";
import { captureSheetViewState, restoreSheetViewState } from "../../module/sheet-view-state.js";

const results = document.querySelector("#browser-regression-results");
const editorFixture = document.querySelector("#editor-fixture");
const pickerFixture = document.querySelector("#picker-fixture");
const scrollFixture = document.querySelector("#scroll-fixture");
const editorUpdateCount = document.querySelector("#editor-update-count");
const pickerSelectionCount = document.querySelector("#picker-selection-count");
const pickerNoSelection = document.querySelector("#picker-no-selection");
const scrollPosition = document.querySelector("#scroll-position");
const saveRetryFixture = document.querySelector("#save-retry-fixture");
const saveRetryUpdates = document.querySelector("#save-retry-updates");
const saveRetryNotifications = document.querySelector("#save-retry-notifications");
const state = {
  editor: { updates: [], result: null },
  picker: { selection: [], noSelectionObserved: false },
  scroll: { before: null, after: null },
  saveRetry: { updates: [], notifications: 0, failNext: false, result: null },
  assertions: [],
};

function renderResults() {
  editorUpdateCount.textContent = String(state.editor.updates.length);
  pickerSelectionCount.textContent = String(state.picker.selection.length);
  pickerNoSelection.textContent = String(state.picker.noSelectionObserved);
  scrollPosition.textContent = state.scroll.before === null
    ? "not captured"
    : `${state.scroll.before} / ${state.scroll.after ?? "not restored"}`;
  saveRetryUpdates.textContent = String(state.saveRetry.updates.length);
  saveRetryNotifications.textContent = String(state.saveRetry.notifications);
  results.textContent = JSON.stringify(state, null, 2);
}

function renderScrollRoot() {
  const root = document.querySelector("#scroll-root");
  root.innerHTML = `<div class="sheet-tab-content"><section class="tab active" data-group="primary" data-tab="notes"><div class="scroll-filler">Scroll target</div></section></div>`;
  return root;
}

const notesInput = document.querySelector("#notes-input");
const notesEditor = document.querySelector("#notes-editor");
// `prose-mirror` is only a host-shaped native DOM adapter. In particular, this
// defines the DOM-control property production persistence reads; it does not
// emulate Foundry's custom element, editor transaction model, or ProseMirror.
Object.defineProperty(notesEditor, "name", { value: "system.description", writable: true });
const editorSheet = {
  isEditable: true,
  document: {
    system: { description: "Initial notes" },
    async update(update, options) {
      state.editor.updates.push({ update, options });
      this.system.description = update["system.description"];
    },
  },
  async _persistFormControl(event) {
    state.editor.result = await persistRichTextChange(this, event);
    editorFixture.dataset.status = state.editor.result ? "saved" : "failed";
    renderResults();
  },
};

// The textarea supplies a real user-editable browser control. The host element
// matches the production binding contract, but deliberately does not emulate
// Foundry's ProseMirror implementation.
notesInput.addEventListener("input", () => {
  notesEditor.value = notesInput.value;
});
bindRichTextPersistence(editorSheet, document.querySelector("#editor-fixture"));
document.querySelector("#save-notes").addEventListener("click", () => {
  editorFixture.dataset.status = "saving";
  notesEditor.dispatchEvent(new Event("change", { bubbles: true }));
});

globalThis.game = {
  ...(globalThis.game ?? {}),
  i18n: { localize: key => ({ "BITD.SaveFailed": "Could not save changes.", "BITD.Retry": "Retry" })[key] ?? key },
};
globalThis.ui = {
  ...(globalThis.ui ?? {}),
  notifications: {
    error(message) {
      state.saveRetry.notifications += 1;
      saveRetryFixture.dataset.notification = message;
      renderResults();
    },
  },
};
const saveRetryForm = document.querySelector("#save-retry-form");
const saveRetryInput = document.querySelector("#save-retry-input");
const saveRetrySheet = {
  isEditable: true,
  element: saveRetryForm,
  document: {
    async update(update) {
      state.saveRetry.updates.push(update);
      if (state.saveRetry.failNext) {
        state.saveRetry.failNext = false;
        throw new Error("fixture save failure");
      }
      this.system.description = update["system.description"];
      state.saveRetry.result = true;
      saveRetryFixture.dataset.status = "saved";
      renderResults();
    },
    system: { description: "Initial description" },
  },
};
saveRetryInput.addEventListener("change", () => {
  void persistFormControlChange(saveRetrySheet, saveRetryInput).then(result => {
    state.saveRetry.result = result;
    saveRetryFixture.dataset.status = result ? "saved" : "failed";
    renderResults();
  });
});
document.querySelector("#fail-next-save").addEventListener("click", () => {
  state.saveRetry.failNext = true;
  saveRetryFixture.dataset.status = "armed";
  renderResults();
});
document.querySelector("#save-retry-submit").addEventListener("click", () => {
  saveRetryInput.dispatchEvent(new Event("change", { bubbles: true }));
});
bindSheetSaveStatus(saveRetrySheet, saveRetryForm);

const pickerForm = document.querySelector("#picker-form");
pickerForm.innerHTML = renderItemPickerContent([
  { id: "mask-a", name: "Ash Mask", details: "1 load", tooltipHtml: "<p>Ash</p>" },
  { id: "mask-b", name: "Briar Mask", details: "2 load", tooltipHtml: "<p>Briar</p>" },
], { inputType: "radio", tooltipLabel: "Details" });
document.querySelector("#read-picker-selection").addEventListener("click", () => {
  state.picker.selection = readItemPickerSelection({ form: pickerForm });
  if (state.picker.selection.length === 0) {
    state.picker.noSelectionObserved = true;
    pickerFixture.dataset.status = "no-selection";
  } else {
    pickerFixture.dataset.status = state.picker.selection[0] === "mask-b" && state.picker.selection.length === 1
      ? "selected"
      : "unexpected-selection";
  }
  renderResults();
});

renderScrollRoot();
document.querySelector("#replace-scroll-root").addEventListener("click", () => {
  const oldRoot = document.querySelector("#scroll-root");
  const viewState = captureSheetViewState(oldRoot, { primaryTab: "notes" });
  state.scroll.before = viewState.scrollPositions.tab?.scrollTop ?? null;
  const root = renderScrollRoot();
  restoreSheetViewState(root, viewState, { setPrimaryTab: () => {} });
  state.scroll.after = root.querySelector(".tab.active").scrollTop;
  scrollFixture.dataset.status = state.scroll.before > 0 && state.scroll.after === state.scroll.before ? "restored" : "failed";
  renderResults();
});

async function runAssertions() {
  // These assertions intentionally consume prior UI interactions. The fixture
  // never selects, saves, or scrolls on the runner's behalf.
  await Promise.resolve();
  state.assertions = [
    { name: "editor saves one production-bound change", pass: state.editor.result === true && state.editor.updates.length === 1 && state.editor.updates[0]?.update?.["system.description"] === notesInput.value },
    { name: "picker exposes no-selection state", pass: state.picker.noSelectionObserved },
    { name: "picker reads the expected production-rendered radio", pass: state.picker.selection.length === 1 && state.picker.selection[0] === "mask-b" },
    { name: "scroll position survives replacement through production helper", pass: state.scroll.before === state.scroll.after && state.scroll.after > 0 },
    { name: "failed form save shows production Retry and retries its snapshot", pass: state.saveRetry.result === true && state.saveRetry.notifications === 1 && state.saveRetry.updates.length === 2 && state.saveRetry.updates[0]?.["system.description"] === state.saveRetry.updates[1]?.["system.description"] && !saveRetryForm.querySelector(".sheet-save-status") },
  ];
  renderResults();
}

document.querySelector("#run-browser-regressions").addEventListener("click", () => { void runAssertions(); });
renderResults();
