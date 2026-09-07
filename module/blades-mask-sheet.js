
import { BladesSheet } from "./blades-sheet.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { capitalize } from "./blades-helpers.js";
import { encumbranceLevelForLoadout, hasMuleAbility } from "./encumbrance.js";
import { maskDescriptionKey, renderMaskPickerTooltip } from "./mask-picker-tooltip.js";
import { maskActorImage } from "./actor-images.js";
import { prepareActionDescriptionTooltips } from "./action-description-tooltip.js";
import { bindRichTextPersistence, bindSheetSaveStatus, handleActorNameEnter, persistActorNameChange, persistFormControlChange, persistRichTextChange, persistTrackerChange, reportSheetInteractionFailure } from "./sheet-dom.js";
import { canonicalTraitSourceName, traitHasCompendiumProvenance } from "./trait-grant-matching.js";
import {
  findAlchemicBloodTrait,
  isRuinMask,
  prepareAlchemicBloodContext,
} from "./mask/alchemic-blood.js";

export { handleActorNameEnter as handleMaskNameEnter };

export const MASK_SHEET_DEFAULT_WIDTH = 680;
// A Character sheet at its 700px default has a 212px Attribute column:
// (700px - 40px form padding - 24px inter-column gaps) / 3.
// Foundry's ApplicationV2 inner frame also consumes horizontal space, so the
// configured target includes enough clearance for the 200px portrait, identity
// details, the Character-sized Attribute family, and both 20px gaps.
export const MASK_SHEET_ATTRIBUTES_WIDTH = 760;
export const MASK_SHEET_VIEWPORT_GUTTER = 32;
const MASK_SHEET_RESIZING_CLASS = "mask-sheet--attribute-resizing";
const MASK_SHEET_ATTRIBUTES_ENTERING_CLASS = "mask-sheet--attributes-entering";
const MASK_SHEET_RESIZE_DURATION = 180;

const itemId = item => item?.id ?? item?._id;

/** Return only source-tagged traits belonging to the currently selected Mask. */
export function getMaskTraitsForSource(items, maskItem) {
  const sourceItemId = itemId(maskItem);
  if (!sourceItemId) return [];
  return Array.from(items ?? []).filter(item =>
    item.type === "trait"
    && item.flags?.["brinkwood-reforged"]?.traitGrant?.sourceItemType === "mask"
    && item.flags?.["brinkwood-reforged"]?.traitGrant?.sourceItemId === sourceItemId
  );
}

/** Return ungranted compendium Traits that can be linked to the selected Mask. */
export function getEligibleMaskTraits(items, actorItems, maskItem) {
  const sourceItemId = itemId(maskItem);
  if (!sourceItemId) return [];
  const existingTraits = Array.from(actorItems ?? []).filter(item => item.type === "trait");
  const existingTraitSourceIds = new Set(existingTraits
    .map(item => item.flags?.["brinkwood-reforged"]?.traitGrant?.traitSourceId)
    .filter(Boolean));
  return Array.from(items ?? []).filter(item =>
    item.type === "trait"
    && !existingTraitSourceIds.has(itemId(item))
    && !existingTraits.some(existing => traitHasCompendiumProvenance(existing, item))
    && Boolean(item.name?.trim())
    && !existingTraits.some(existing =>
      existing.name === item.name
      && canonicalTraitSourceName(existing.system?.class) === canonicalTraitSourceName(item.system?.class))
  );
}

/**
 * Return the width used when a configured Mask adds its Attribute column.
 * A previously wider manual resize always wins; this helper never shrinks.
 */
export function maskSheetWidthForAttributes(currentWidth, viewportWidth) {
  const current = Number.isFinite(currentWidth) ? currentWidth : MASK_SHEET_DEFAULT_WIDTH;
  const viewportLimit = Number.isFinite(viewportWidth)
    ? Math.max(0, viewportWidth - MASK_SHEET_VIEWPORT_GUTTER)
    : MASK_SHEET_ATTRIBUTES_WIDTH;
  return Math.max(current, Math.min(MASK_SHEET_ATTRIBUTES_WIDTH, viewportLimit));
}

export function getMaskTypePresentation(typeName, attributes) {
  const maskAttributes = attributes[typeName];
  const typeLang = `BITD.${capitalize(typeName)}`;
  return {
    attributes: maskAttributes ?? [],
    label: maskAttributes ? `${typeLang}Short` : "BITD.Mask",
    typeLang,
    xpKey: maskAttributes ? `Mask.XP.${capitalize(typeName)}` : null
  };
}

export function updateMaskDotDisplay(element, value, maxValue) {
  const group = element.parentElement;
  const color = element.dataset.path === "system.experience.value" ? "blue" : "red";

  group?.querySelectorAll(".dot-value").forEach(dot => {
    const filled = Number(dot.dataset.value) <= value;
    dot.setAttribute("aria-pressed", filled ? "true" : "false");
    dot.classList?.toggle("dot-value--filled", filled);
    dot.classList?.toggle("dot-value--empty", !filled);
    const tooth = dot.querySelector("img");
    if (tooth) {
      tooth.src = `systems/brinkwood-reforged/styles/assets/teeth/stresstooth-${filled ? color : "halfgrey"}.png`;
    } else {
      dot.textContent = filled ? "●" : "○";
    }
  });

  const tracker = group?.closest?.(".mask-tracker");
  const output = tracker?.querySelector("output");
  if (output) output.textContent = `${value} / ${maxValue}`;

  const skillLabel = group?.closest?.(".mask-skill")?.querySelector(".attribute-skill-label");
  if (skillLabel) skillLabel.dataset.rollValue = String(value);

  const attributeCard = group?.closest?.(".mask-attribute-card");
  const attributeLabel = attributeCard?.querySelector?.(".attribute-label");
  if (attributeLabel) {
    const rating = Array.from(attributeCard.querySelectorAll?.(".attribute-skill-label[data-roll-value]") ?? [])
      .filter(label => Number(label.dataset.rollValue) > 0)
      .length;
    attributeLabel.dataset.rollValue = String(rating);
  }
}

/**
 * Extend the basic BladesSheet for the Mask actor type.
 * @extends {BladesSheet}
 */
export class BladesMaskSheet extends BladesSheet {

  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "actor", "pc", "mask"],
    // An unconfigured Mask keeps the compact initial sheet. Its selected Mask
    // Type adds Attribute UI and expands the already-open ApplicationV2 frame.
    position: { width: MASK_SHEET_DEFAULT_WIDTH, height: 840 },
    // Explicit change handlers below are the only Mask persistence path.
    form: { submitOnChange: false },
    tabGroups: { primary: "traits" },
  };

  static PARTS = {
    sheet: { template: "systems/brinkwood-reforged/templates/mask-sheet.html" },
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this._ensureValidPrimaryTab(context);

    context.img = maskActorImage(context.img);

    context.system.mask_attributes = context.system.attributes[context.system.type] ?? [];
    context.maskAttributesLabel = "BITD.Mask";

    // Prepare active effects
    context.effects = await BladesActiveEffect.prepareActiveEffectCategories(this.actor.effects, { owner: this.actor });
    this._prepareEffectTabs(context);

    this.setAttrLabels(context.system.attributes, "Mask");
    prepareActionDescriptionTooltips(context.system.attributes, key => game.i18n.localize(key));

    context.system.oath = game.user.character?.system?.oath || 0;

    // Mask Traits are the automatic, source-tagged grants of the selected
    // Mask Type. Other actor traits remain untouched but do not belong here.
    context.maskItem = context.items.find(item => item.type === "mask") ?? null;
    context.maskDescriptionHtml = "";
    if (context.maskItem) {
      const descriptionKey = maskDescriptionKey(context.maskItem.name);
      const description = String(context.maskItem.system?.description ?? "").trim()
        || (descriptionKey ? game.i18n.localize(descriptionKey) : "");
      const enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        description,
        { async: true, relativeTo: this.document, secrets: this.document.isOwner },
      );
      context.maskItem.identityTooltipHtml = renderMaskPickerTooltip(
        context.maskItem,
        enrichedDescription,
      );
      context.maskDescriptionHtml = enrichedDescription;
    }
    context.isRuinMask = isRuinMask(context.maskItem);
    const alchemicBloodTrait = context.isRuinMask
      ? findAlchemicBloodTrait(context.items, context.maskItem)
      : null;
    context.alchemicBloodMissing = context.isRuinMask && !alchemicBloodTrait;
    context.alchemicBlood = context.isRuinMask ? prepareAlchemicBloodContext(alchemicBloodTrait, {
      editable: context.editable,
      isGM: context.isGM,
    }) : null;
    context.traits = this._prepareTraitDisplayOrder(getMaskTraitsForSource(context.items, context.maskItem)
      .filter(trait => trait !== alchemicBloodTrait)
      .map(trait => ({
        ...trait,
        canDelete: context.isGM && !trait.flags?.["brinkwood-reforged"]?.traitGrant,
      })));

    // Calculate Load
    let loadout = 0;
    context.items.forEach(i => {
      loadout += (i.type === "item") ? parseInt(i.system.load) : 0;
    });
    loadout = Math.max(0, Math.min(10, loadout));
    context.system.loadout = loadout;

    // Mask configuration is actor-owned and enforces a single embedded source.
    // Keep a dedicated presentation object so templates never infer it from an
    // arbitrary item loop.
    context.canAddMaskTraits = Boolean(context.maskItem) && context.editable;
    context.maskTypeLabel = context.maskItem?.name ?? "";
    context.identityRows = [{
      itemType: "mask",
      label: "BITD.Mask",
      deleteLabel: "BITD.TitleDeleteItem",
      reselect: true,
      item: context.maskItem?.name?.trim() ? context.maskItem : null,
    }];

    // Determine mask type from configured mask item
    context.system.type = context.maskItem?.name.toLowerCase() ?? "";
    context.system.mask_attributes = [];
    if (context.system.type) {
      const typeName = context.system.type;
      const presentation = getMaskTypePresentation(typeName, context.system.attributes);
      context.system.type_lang       = presentation.typeLang;
      context.maskAttributesLabel    = presentation.label;
      context.system.mask_attributes = presentation.attributes;
      context.system.mask_attributes.value = Object.values(presentation.attributes.skills ?? {})
        .filter(skill => Number(skill.value) > 0).length;
      context.system.xp_tooltip      =
        game.i18n.localize("Mask.XP.Tooltip") +
        (presentation.xpKey ? game.i18n.localize(presentation.xpKey) : "");
    }

    context.system.load_level = encumbranceLevelForLoadout(loadout, hasMuleAbility(context.items));
    context.system.load_levels = { "BITD.Light": "BITD.Light", "BITD.Normal": "BITD.Normal", "BITD.Heavy": "BITD.Heavy" };

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.description,
      { async: true, relativeTo: this.document, secrets: this.document.isOwner }
    );
    context.system.essence = { ...context.system.essence, additionalSlots: [7, 8] };

    return context;
  }

  /** Keep a remembered Mask tab when available; otherwise use its first tab. */
  _ensureValidPrimaryTab(context) {
    if (this.tabGroups.primary === "mask-notes") {
      this.tabGroups.primary = "mask";
      context.tabs.primary = "mask";
    }
    const validTabs = ["traits", "mask"];
    if (context.isGM) validTabs.push("effects");
    if (validTabs.includes(this.tabGroups.primary)) return;
    this.tabGroups.primary = "traits";
    context.tabs.primary = "traits";
  }

  /** Expand after Mask Type configuration; clearing it returns the sheet to its compact width. */
  async _expandForMaskAttributes() {
    const currentWidth = Number(this.position?.width) || MASK_SHEET_DEFAULT_WIDTH;
    const viewportWidth = globalThis.window?.innerWidth ?? globalThis.document?.documentElement?.clientWidth;
    const nextWidth = maskSheetWidthForAttributes(currentWidth, viewportWidth);
    return this._resizeForMaskAttributes(nextWidth, { attributesEntering: true });
  }

  async _shrinkForMaskAttributes() {
    return this._resizeForMaskAttributes(MASK_SHEET_DEFAULT_WIDTH);
  }

  async _resizeForMaskAttributes(nextWidth, { attributesEntering = false } = {}) {
    const currentWidth = Number(this.position?.width) || MASK_SHEET_DEFAULT_WIDTH;
    if (nextWidth === currentWidth || typeof this.setPosition !== "function") return;
    const stopTransition = this._startMaskAttributeResizeTransition({ attributesEntering });
    try {
      return await this.setPosition({ width: nextWidth });
    } catch (error) {
      stopTransition?.();
      throw error;
    }
  }

  _startMaskAttributeResizeTransition({ attributesEntering = false } = {}) {
    if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return null;
    const frame = this.element?.closest?.(".brinkwood.actor.mask") ?? this.element;
    if (!frame?.classList) return null;

    frame.classList.add(MASK_SHEET_RESIZING_CLASS);
    if (attributesEntering) frame.classList.add(MASK_SHEET_ATTRIBUTES_ENTERING_CLASS);
    // Commit the transient class before ApplicationV2 writes its inline width.
    void frame.offsetWidth;

    let timeout;
    const stop = () => {
      globalThis.clearTimeout(timeout);
      frame.removeEventListener?.("transitionend", onTransitionEnd);
      frame.classList.remove(MASK_SHEET_RESIZING_CLASS);
      frame.classList.remove(MASK_SHEET_ATTRIBUTES_ENTERING_CLASS);
    };
    const onTransitionEnd = event => {
      if (event.target === frame && event.propertyName === "width") stop();
    };
    frame.addEventListener?.("transitionend", onTransitionEnd);
    timeout = globalThis.setTimeout(stop, MASK_SHEET_RESIZE_DURATION + 80);
    return stop;
  }

  async _syncMaskAttributeAvailability(hasMaskType) {
    const available = Boolean(hasMaskType);
    const wasAvailable = Boolean(this._maskAttributesAvailable);
    const becameAvailable = available && !this._maskAttributesAvailable;
    this._maskAttributesAvailable = available;
    if (becameAvailable) await this._expandForMaskAttributes();
    else if (!available && wasAvailable) await this._shrinkForMaskAttributes();
  }

  /* -------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    await this._syncMaskAttributeAvailability(Boolean(context.maskItem));
    this._maskSheetListenerController?.abort();
    const html = this.element;
    this._maskSheetListenerController = new AbortController();
    const listenerOptions = { signal: this._maskSheetListenerController.signal };
    bindSheetSaveStatus(this, html, listenerOptions);
    this._bindSheetViewState(html, listenerOptions);
    html.querySelector('input[name="name"]')?.addEventListener(
      "keydown", handleActorNameEnter, listenerOptions);

    // Open inventory item sheet
    html.querySelectorAll(".item-body").forEach(el =>
      el.addEventListener("click", ev => {
        if (ev.currentTarget.classList.contains("item-add-popup")) return;
        const item = this.actor.items.get(ev.currentTarget.closest(".item").dataset.itemId);
        item?.sheet.render({ force: true });
      }, listenerOptions)
    );

    if (!this.isEditable) return;

    bindRichTextPersistence(this, html, listenerOptions);
    html.querySelectorAll('input[name], select[name], textarea[name]').forEach(control =>
      control.addEventListener("change", event => this._persistFormControl(event), listenerOptions)
    );

    // Delete inventory item. The identity Mask is configuration, so removal
    // goes through the actor command that also removes its source-tagged trait.
    html.querySelectorAll(".item-delete").forEach(el =>
      el.addEventListener("click", async ev => {
        const element = ev.currentTarget.closest(".item");
        const item = this.actor.items.get(element.dataset.itemId);
        if (item?.type === "mask") {
          await this.actor.clearMaskConfiguration();
        } else {
          await this.actor.deleteEmbeddedDocuments("Item", [element.dataset.itemId]);
        }
        element.remove();
      }, listenerOptions)
    );

    // Dot rating controls
    html.querySelectorAll(".dot-value").forEach(el =>
      el.addEventListener("click", this._onDotChange.bind(this), listenerOptions)
    );

    html.querySelectorAll("[data-alchemic-blood-effect]").forEach(control =>
      control.addEventListener("click", event => this._onAlchemicBloodEffect(event), listenerOptions)
    );

    // Active effect controls
    html.querySelectorAll(".effect-control[data-effect-action]").forEach(el =>
      el.addEventListener("click", ev => this._onActorEffectControl(
        ev,
        () => BladesActiveEffect.onManageActiveEffect(ev, this.actor, { gmOnly: true }),
      ), listenerOptions)
    );
  }

  async _onAlchemicBloodEffect(event) {
    event.preventDefault();
    const control = event.currentTarget;
    const effectId = control.dataset.alchemicBloodEffect;
    const selected = control.dataset.alchemicBloodSelected !== "false";
    if (!selected) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize("Mask.AlchemicBlood.RemoveTitle") },
        content: `<p>${game.i18n.localize("Mask.AlchemicBlood.RemovePrompt")}</p>`,
      });
      if (!confirmed) return;
    }
    control.disabled = true;
    try {
      await this.actor.setAlchemicBloodEffect(effectId, selected);
      this.element?.querySelector(`[data-alchemic-blood-card="${effectId}"]`)?.focus();
    } catch (error) {
      reportSheetInteractionFailure(error, "Mask.AlchemicBlood.UpdateFailed");
      control.disabled = false;
    }
  }

  /* -------------------------------------------- */

  async _persistFormControl(event) {
    if (!this.isEditable) return;
    const control = event.currentTarget;
    if (control.matches('input[name="name"]')) return persistActorNameChange(this, event);
    if (control.matches("prose-mirror[name]")) return persistRichTextChange(this, event);

    await persistFormControlChange(this, control);
  }

  /* -------------------------------------------- */

  async _onDotChange(event) {
    return persistTrackerChange(this, event, (element, value, maximum) => this._updateDotDisplay(element, value, maximum));
  }

  _updateDotDisplay(element, value, maxValue) {
    updateMaskDotDisplay(element, value, maxValue);
  }

  _renderItemPickerTooltip(item, enrichedDescription) {
    if (item?.type === "mask") return renderMaskPickerTooltip(item, enrichedDescription);
    return super._renderItemPickerTooltip(item, enrichedDescription);
  }

  /** Limit the shared Trait picker to still-missing grants for this Mask Type. */
  async _getItemPickerItems(itemType) {
    const items = await super._getItemPickerItems(itemType);
    if (itemType !== "trait") return items;
    const maskItem = this.actor.items.find(item => item.type === "mask");
    return getEligibleMaskTraits(items, this.actor.items, maskItem);
  }

  _getItemPickerLabel(itemType) {
    if (itemType === "trait") return game.i18n.localize("Mask.Ability");
    return super._getItemPickerLabel(itemType);
  }

  /** Route Mask picker selections through the actor-owned grant commands. */
  async _createPickedItems(items, { itemType, selectedItems = [] } = {}) {
    if (itemType === "trait") {
      const maskItem = this.actor.items.find(item => item.type === "mask");
      const traitSourceIds = selectedItems.map(itemId).filter(Boolean);
      if (!this.isEditable || !maskItem || !traitSourceIds.length) return [];
      return this.actor.repairTraitGrantsForSourceIds([itemId(maskItem)], false, traitSourceIds);
    }
    if (itemType !== "mask") return super._createPickedItems(items, { itemType });
    const [mask] = items;
    return mask ? this.actor.configureMask(mask) : [];
  }

}
