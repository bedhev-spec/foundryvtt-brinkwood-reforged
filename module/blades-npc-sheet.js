
import { BladesSheet } from "./blades-sheet.js";
import { npcActorImage } from "./actor-images.js";
import { bindRichTextPersistence, bindSheetSaveStatus, persistFormControlChange } from "./sheet-dom.js";
import { bindLinkedJournalCta, prepareLinkedJournalContext } from "./linked-journal-cta.js";

/**
 * @extends {BladesSheet}
 */
export class BladesNPCSheet extends BladesSheet {

  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "actor", "npc"],
    position: { width: 640, height: 700 },
    // Named controls below are the sole persistence path. ApplicationV2's
    // native submit-on-change would otherwise race the direct document update.
    form: { closeOnSubmit: false, submitOnChange: false },
    tabGroups: { npcDetails: "description" },
    window: { resizable: true },
  };

  static PARTS = {
    sheet: { template: "systems/brinkwood-reforged/templates/npc-sheet.html", scrollable: [""] },
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this._ensureValidNpcDetailsTab(context);
    context.img = npcActorImage(context.img);
    context.linkedJournal = await prepareLinkedJournalContext(this.document, { editable: this.isEditable });

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.description,
      { async: true, relativeTo: this.document, secrets: this.document.isOwner }
    );
    context.enrichedAbilities = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.abilities,
      { async: true, relativeTo: this.document, secrets: this.document.isOwner }
    );
    context.enrichedSchemes = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.schemes,
      { async: true, relativeTo: this.document, secrets: this.document.isOwner }
    );

    return context;
  }

  _ensureValidNpcDetailsTab(context) {
    const validTabs = ["description", "abilities", "schemes"];
    if (!validTabs.includes(this.tabGroups.npcDetails)) {
      this.tabGroups.npcDetails = "description";
    }

    context.npcDetailsTab = this.tabGroups.npcDetails;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this._npcSheetListenerController?.abort();
    this._npcSheetListenerController = new AbortController();
    const listenerOptions = { signal: this._npcSheetListenerController.signal };
    const html = this.element;
    bindSheetSaveStatus(this, html, listenerOptions);
    bindLinkedJournalCta(this, html, listenerOptions);

    if (!this.isEditable) return;

    bindRichTextPersistence(this, html, listenerOptions);
    html.querySelectorAll('input[name], select[name], textarea[name]').forEach(control => {
      control.addEventListener("change", event => this._persistFormControl(event), listenerOptions);
    });
  }

  async _persistFormControl(event) {
    if (!this.isEditable) return false;
    return persistFormControlChange(this, event.currentTarget, {
      canPersist: () => this.isEditable,
    });
  }

  /** @override */
  async _onClose(options) {
    this._npcSheetListenerController?.abort();
    return super._onClose(options);
  }
}
