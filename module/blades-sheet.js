/**
 * Base BladesSheet – extends ActorSheetV2 (ApplicationV2 lifecycle).
 * Provides shared context building, common listeners, and shared helpers for
 * all actor sheets in the Brinkwood system.
 */

import { getItemsByType } from "./item-catalogue.js";
import { renderItemTooltip } from "./item-tooltip.js";
import { promptItemPicker } from "./item-picker-dialog.js";
import { prepareItemPickerRows } from "./item-picker-preparation.js";
import { showRollStatistics } from "./roll-statistics.js";
import {
  editDocumentImage,
  lockSheetFormControls,
  queueDocumentPathUpdate,
  reportSheetInteractionFailure,
} from "./sheet-dom.js";
import {
  activateEffectTab,
  bindEffectTabs,
  captureCharacterEffectViewport,
  captureSheetViewState,
  getSheetScrollContainers,
  normalizeEffectTab,
  restoreCharacterEffectViewport,
  restoreSheetViewState,
} from "./sheet-view-state.js";

export { readItemPickerSelection } from "./item-picker-dialog.js";

export class BladesSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2
) {

  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "actor"],
    form: { submitOnChange: true },
    actions: { editImage: editDocumentImage },
  };

  async _onActorEffectControl(event, action, { renderAfter = false } = {}) {
    const control = event.currentTarget;
    if (!control || typeof action !== "function" || this._pendingActorEffectControls?.has(control)) return false;

    this._pendingActorEffectControls ??= new WeakSet();
    this._pendingActorEffectControls.add(control);
    this._captureSheetViewState();
    const effectViewport = captureCharacterEffectViewport(this.element, control);
    // A rendered effect mutation replaces the focused button. Blurring it
    // first prevents the browser from scrolling the replacement into view.
    control.blur?.();

    try {
      await action();
      // Character effect mutations suppress Foundry's deferred automatic
      // render and await one explicit ApplicationV2 replacement. The viewport
      // anchor below must operate on the new root, not the outgoing form.
      if (renderAfter) await this.render({ force: true });
      return true;
    } catch (error) {
      ui.notifications?.error?.("Unable to update this Actor effect.");
      return false;
    } finally {
      this._pendingActorEffectControls.delete(control);
      this._restoreSheetViewState();
      restoreCharacterEffectViewport(this.element, effectViewport);
    }
  }

  /* -------------------------------------------- */

  /**
   * Build the Handlebars context that mirrors the v1 getData() flat structure
   * so existing templates continue to work without modification.
   * @override
   */
  async _prepareContext(options) {
    const doc = this.document;
    const context = doc.toObject();                          // _id, name, img, type, system, …
    context.actor = this.actor;
    context.tabs = { primary: this.tabGroups.primary };
    context.items    = doc.items.map(i => i.toObject());    // plain-object items for templates
    context.isGM     = game.user.isGM;
    context.owner    = doc.isOwner;
    context.editable = this.isEditable;
    context.cssClass = this.isEditable ? "editable" : "locked";
    context.limited  = doc.limited;
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Set up common DOM event listeners after each render.
   * Replaces the v1 activateListeners(html) pattern.
   * @override
   */
  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = this.element;
    if (!this.isEditable) lockSheetFormControls(html);
    this._brinkwoodListenerController?.abort();
    this._brinkwoodListenerController = new AbortController();
    const listenerOptions = { signal: this._brinkwoodListenerController.signal };
    html.querySelectorAll('[role="tab"][data-action="tab"]').forEach(tab =>
      tab.addEventListener("keydown", event => {
        const tabs = Array.from(tab.closest('[role="tablist"]')?.querySelectorAll('[role="tab"]') ?? []);
        if (!tabs.length) return;
        const current = tabs.indexOf(event.currentTarget);
        const key = event.key;
        const target = key === "Home" ? tabs[0]
          : key === "End" ? tabs.at(-1)
          : key === "ArrowRight" || key === "ArrowDown" ? tabs[(current + 1) % tabs.length]
          : key === "ArrowLeft" || key === "ArrowUp" ? tabs[(current - 1 + tabs.length) % tabs.length]
          : null;
        if (!target) return;
        event.preventDefault();
        tabs.forEach(control => { control.tabIndex = control === target ? 0 : -1; });
        target.focus();
        target.click();
      }, listenerOptions)
    );

    html.querySelectorAll('[data-action="editImage"][role="button"]').forEach(image =>
      image.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.currentTarget.click();
      }, listenerOptions)
    );

    if (this.isEditable) {
      html.querySelectorAll(".item-add-popup").forEach(el =>
        el.addEventListener("click", this._onItemAddClick.bind(this), listenerOptions)
      );
      html.querySelectorAll(".trait-card__purchase").forEach(el =>
        el.addEventListener("change", this._onTraitPurchaseChange.bind(this), listenerOptions)
      );
    }
    html.querySelectorAll(".roll-die-attribute").forEach(el =>
      el.addEventListener("click", this._onRollAttributeDieClick.bind(this), listenerOptions)
    );
    html.querySelectorAll(".roll-statistics-control").forEach(el =>
      el.addEventListener("click", () => showRollStatistics(), listenerOptions)
    );
  }

  /** Capture only transient UI state; Foundry remains responsible for tabs. */
  _captureSheetViewState({ primaryTab } = {}) {
    this._sheetViewState = captureSheetViewState(this.element, {
      primaryTab: primaryTab ?? this.tabGroups.primary,
      effectTab: this._activeEffectTab,
    });
  }

  _restoreSheetViewState() {
    restoreSheetViewState(this.element, this._sheetViewState, {
      setPrimaryTab: tab => { this.tabGroups.primary = tab; },
      activateEffectTab: tab => this._activateEffectTab(tab),
    });
  }

  /**
   * Wire the transient state shared by Character and Mask sheets.  Native
   * ApplicationV2 tabs remain authoritative; this only remembers the view
   * before document operations replace the form.
   */
  _bindSheetViewState(html, listenerOptions) {
    this._restoreSheetViewState();
    this._bindEffectTabs(html, listenerOptions);

    getSheetScrollContainers(html).forEach(([, container]) => {
      container.addEventListener("scroll", () => this._captureSheetViewState(), listenerOptions);
    });
    html.addEventListener("click", event => {
      const action = event.target.closest?.(
        '[data-group="primary"][data-action="tab"], [data-effect-tab], .effect-control, .item-add-popup, .item-delete'
      );
      if (!action) return;
      const primaryTab = action.matches('[data-group="primary"][data-action="tab"]')
        ? action.dataset.tab
        : undefined;
      this._captureSheetViewState({ primaryTab });
    }, { ...listenerOptions, capture: true });
    html.addEventListener("change", () => this._captureSheetViewState(), {
      ...listenerOptions,
      capture: true,
    });
  }

  _bindEffectTabs(html, listenerOptions) {
    bindEffectTabs(html, {
      signal: listenerOptions?.signal,
      onActivate: type => this._activateEffectTab(type),
    });
  }

  _prepareEffectTabs(context, fallback = "temporary") {
    this._activeEffectTab = normalizeEffectTab(context.effects, this._activeEffectTab, fallback);
    context.isEffectTabbed = true;
    context.activeEffectTab = this._activeEffectTab;
  }

  _activateEffectTab(type) {
    if (!activateEffectTab(this.element, type)) return false;
    this._activeEffectTab = type;
    return true;
  }

  /* -------------------------------------------- */

  async _onItemAddClick(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    const pickerKey = event.currentTarget.dataset.itemType;
    this._itemPickerRequests ??= new Map();
    const existing = this._itemPickerRequests.get(pickerKey);
    if (existing) {
      existing.dialog?.bringToFront();
      return existing.request;
    }

    const entry = { dialog: null, request: null };
    const request = this._openItemPicker(event.currentTarget, {
      onDialog: dialog => { entry.dialog = dialog; },
    });
    entry.request = request;
    this._itemPickerRequests.set(pickerKey, entry);
    try {
      return await request;
    } finally {
      if (this._itemPickerRequests.get(pickerKey) === entry) {
        this._itemPickerRequests.delete(pickerKey);
      }
    }
  }

  /** Open one picker request; _onItemAddClick serializes access to this path. */
  async _openItemPicker(el, { onDialog } = {}) {
    const item_type = el.dataset.itemType;
    const distinct  = el.dataset.distinct;
    const input_type = distinct !== undefined ? "radio" : "checkbox";

    const items = await this._getItemPickerItems(item_type);

    const pickerRows = await prepareItemPickerRows(items, {
      document: this.document,
      localize: key => game.i18n.localize(key),
      enrichHTML: (content, options) => foundry.applications.ux.TextEditor.implementation.enrichHTML(content, options),
      renderTooltip: (item, enrichedDescription) => this._renderItemPickerTooltip(item, enrichedDescription),
    });

    const selectedIds = await promptItemPicker({
      rows: pickerRows,
      inputType: input_type,
      title: `${game.i18n.localize("Add")} ${this._getItemPickerLabel(item_type)}`,
      addLabel: game.i18n.localize("Add"),
      tooltipLabel: game.i18n.localize("BITD.ItemDetails"),
      onDialog,
    });

    if (!selectedIds?.length) return;
    const selectedItems = items
      .filter(item => selectedIds.includes(item._id));
    const itemsToAdd = selectedItems
      .map(item => {
        const data = foundry.utils.deepClone(item);
        delete data._id;
        return data;
      });
    await this._createPickedItems(itemsToAdd, { itemType: item_type, selectedItems });
  }

  /** Allow sheets to narrow a shared picker without duplicating its DialogV2 UI. */
  async _getItemPickerItems(itemType) {
    return getItemsByType(itemType, game);
  }

  /** Allow sheets to present a domain label while retaining the stored item type. */
  _getItemPickerLabel(itemType) {
    return itemType;
  }

  /** Allow sheets to specialize picker help without duplicating dialog assembly. */
  _renderItemPickerTooltip(item, enrichedDescription) {
    return renderItemTooltip(item, key => game.i18n.localize(key), () => enrichedDescription);
  }

  /** Allow actor-specific sheets to route picker persistence to one command. */
  async _createPickedItems(items, _options = {}) {
    return this.document.createEmbeddedDocuments("Item", items);
  }

  /* -------------------------------------------- */


  async _onTraitPurchaseChange(event) {
    if (!this.isEditable) return false;
    const control = event.currentTarget;
    const item = this.actor.getEmbeddedDocument("Item", control.dataset.itemId);
    if (!item || item.type !== "trait") return false;
    const path = "system.purchased";
    const purchased = Boolean(control.checked);

    try {
      const saved = await queueDocumentPathUpdate(item, path, async () => {
        if (!this.isEditable) return false;
        await item.update({ [path]: purchased }, { render: false });
        return true;
      });
      return Boolean(saved);
    } catch (error) {
      reportSheetInteractionFailure(error);
      control.checked = Boolean(foundry.utils.getProperty(item, path));
      return false;
    }
  }

  /** Keep Trait presentation stable when an embedded update rebuilds the sheet. */
  _prepareTraitDisplayOrder(traits) {
    const items = Array.from(traits ?? []);
    const byId = new Map(items.map(item => [item._id ?? item.id, item]));
    const ordered = [];

    for (const id of this._traitDisplayOrder ?? []) {
      const item = byId.get(id);
      if (!item) continue;
      ordered.push(item);
      byId.delete(id);
    }
    ordered.push(...byId.values());
    this._traitDisplayOrder = ordered.map(item => item._id ?? item.id).filter(Boolean);
    return ordered;
  }

  /* -------------------------------------------- */

  async _onRollAttributeDieClick(event) {
    const target          = event.currentTarget;
    const attribute_name  = target.dataset.rollAttribute;
    const attribute_label = target.dataset.rollAttributeLabel;
    const attribute_value = parseInt(target.dataset.rollValue);
    this.actor.rollAttributePopup(attribute_name, attribute_label, attribute_value);
  }

  /* -------------------------------------------- */


  /* -------------------------------------------- */

  /**
   * Attach localisation label / desc keys to the attributes object in-place.
   * Called by subclasses during _prepareContext.
   */
  setAttrLabels(attrs, type = "Actor") {
    for (const attr in attrs) {
      const attr_name = attr[0].toUpperCase() + attr.slice(1);
      attrs[attr]["label"] = `${type}.Actions.${attr_name}.Name`;
      attrs[attr]["desc"]  = `${type}.Actions.${attr_name}.Description`;
      for (const skill in attrs[attr].skills) {
        const skill_name = skill[0].toUpperCase() + skill.slice(1);
        attrs[attr].skills[skill]["label"] = `${type}.Actions.${skill_name}.Name`;
        attrs[attr].skills[skill]["desc"]  = `${type}.Actions.${skill_name}.Description`;
      }
    }
  }

  /* -------------------------------------------- */

}
