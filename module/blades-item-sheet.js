/**
 * Extend the basic ItemSheet – uses ItemSheetV2 (ApplicationV2 lifecycle).
 * @extends {ItemSheetV2}
 */
import { BladesActiveEffect } from "./blades-active-effect.js";
import { loadoutCategoryForItem, prepareLoadoutCategoryOptions } from "./character/loadout-categories.js";
import { bindRichTextPersistence, bindSheetSaveStatus, editDocumentImage, lockSheetFormControls, persistFormControlChange, persistIndexedExperienceClue } from "./sheet-dom.js";

/** Brinkwood item fields, including Load, remain GM-authored. */
export function prepareItemSheetPermissions(doc, { isGM = game.user.isGM, sheetEditable = true } = {}) {
  const canEditFields = Boolean(isGM && sheetEditable);

  return {
    canEditFields,
    canEditLoad: canEditFields,
  };
}

export class BladesItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2
) {

  /**
   * Supported item-type → template mapping.
   * Simple types all share the same template.
   */
  static SIMPLE_TYPES = new Set(["profession", "upbringing", "crew_reputation", "associates", "mask", "pact"]);

  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "item"],
    position: { width: 720, height: 700 },
    window: { resizable: false },
    form: { closeOnSubmit: false, submitOnChange: false },
    actions: { editImage: editDocumentImage },
  };

  /**
   * All known PARTS; _configureRenderOptions selects the active one per render.
   */
  static PARTS = {
    simple:        { template: "systems/brinkwood-reforged/templates/items/simple.html", scrollable: [""] },
    item:          { template: "systems/brinkwood-reforged/templates/items/item.html", scrollable: [""] },
    class:         { template: "systems/brinkwood-reforged/templates/items/class.html", scrollable: [""] },
    trait:         { template: "systems/brinkwood-reforged/templates/items/trait.html", scrollable: [""] },
    moot_decision: { template: "systems/brinkwood-reforged/templates/items/moot_decision.html", scrollable: [""] },
  };

  /* -------------------------------------------- */

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    const partId = BladesItemSheet.SIMPLE_TYPES.has(this.document.type)
      ? "simple"
      : this.document.type;
    options.parts = [partId];
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const doc     = this.document;
    const context = doc.toObject();               // _id, name, img, type, system …
    context.item     = doc;
    context.isGM     = game.user.isGM;
    context.owner    = doc.isOwner;
    const permissions = prepareItemSheetPermissions(doc, { sheetEditable: this.isEditable });
    context.editable = permissions.canEditFields;
    context.canEditLoad = permissions.canEditLoad;
    if (doc.type === "item") {
      context.loadoutCategory = loadoutCategoryForItem(doc);
      context.loadoutCategoryOptions = prepareLoadoutCategoryOptions(context.loadoutCategory);
    }
    context.cssClass = permissions.canEditFields ? "editable" : "locked";
    context.effects  = await BladesActiveEffect.prepareActiveEffectCategories(doc.effects, { owner: doc });
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.description,
      { async: true, relativeTo: doc, secrets: doc.isOwner }
    );
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this._itemSheetListenerController?.abort();
    this._itemSheetListenerController = new AbortController();
    const listenerOptions = { signal: this._itemSheetListenerController.signal };
    const html = this.element;
    bindSheetSaveStatus(this, html, listenerOptions);
    if (!context.editable) {
      lockSheetFormControls(html);
      return;
    }

    bindRichTextPersistence(this, html, listenerOptions);
    html.querySelectorAll('input[name], select[name], textarea[name]').forEach(control => {
      control.addEventListener("change", event => this._persistFormControl(event), listenerOptions);
    });

    html.querySelectorAll('[data-action="editImage"][role="button"]').forEach(el =>
      el.addEventListener("keydown", event => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        event.currentTarget.click();
      }, listenerOptions)
    );

    // Active effect controls - use data-effect-action to avoid AppV2 action dispatch.
    // Mutations are serialized per control so a rapid double-click cannot issue
    // duplicate embedded-document requests.
    html.querySelectorAll(".effect-control[data-effect-action]").forEach(el =>
      el.addEventListener("click", ev => this._onItemEffectControl(ev), listenerOptions)
    );
  }

  async _persistFormControl(event) {
    const permissions = prepareItemSheetPermissions(this.document, { sheetEditable: this.isEditable });
    if (!permissions.canEditFields) return;
    const control = event.currentTarget;
    // ArrayFields reject indexed dotted writes. Invalid/stale clue controls do
    // not fall through into the generic persistence path.
    if (String(control?.name ?? "").startsWith("system.experience_clues")) {
      await persistIndexedExperienceClue(this, control, {
        canPersist: () => prepareItemSheetPermissions(this.document, { sheetEditable: this.isEditable }).canEditFields,
      });
      return;
    }
    await persistFormControlChange(this, control, {
      canPersist: () => prepareItemSheetPermissions(this.document, { sheetEditable: this.isEditable }).canEditFields,
    });
  }

  async _onItemEffectControl(ev) {
    const control = ev.currentTarget;
    if (!control || this._pendingItemEffectControls?.has(control)) return;
    this._pendingItemEffectControls ??= new WeakSet();
    this._pendingItemEffectControls.add(control);
    try {
      await BladesActiveEffect.onManageActiveEffect(ev, this.document, { gmOnly: true });
    } catch (error) {
      ui.notifications?.error?.("Unable to update this item effect.");
    } finally {
      this._pendingItemEffectControls.delete(control);
    }
  }

  async _onClose(options) {
    this._itemSheetListenerController?.abort();
    return super._onClose(options);
  }

  /* -------------------------------------------- */

}
