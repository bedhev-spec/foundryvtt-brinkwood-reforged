
import { BladesSheet } from "./blades-sheet.js";
import {
  bindLoadoutControls,
  calculateLoadoutWeight,
  prepareLoadoutCapacity,
  prepareLoadoutCatalogue,
} from "./character/loadout.js";
import { groupLoadoutItems } from "./character/loadout-categories.js";
import { encumbranceLevelForLoadout, hasMuleAbility } from "./encumbrance.js";
import { getItemsByType } from "./item-catalogue.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { clockImagePath, preloadClockImages } from "./clock-utils.js";
import { formatPactTooltipDescription, formatTooltipDescription, renderItemTooltip } from "./item-tooltip.js";
import { prepareActionDescriptionTooltips } from "./action-description-tooltip.js";
import { bindRichTextPersistence, bindSheetSaveStatus, handleActorNameEnter, persistActorNameChange, persistFormControlChange, persistRichTextChange, persistTrackerChange, queueDocumentPathUpdate, reportSheetInteractionFailure } from "./sheet-dom.js";
import { prepareActionDotProjection } from "./character/action-dot-grants.js";
import { renderActionDotSourceTooltip } from "./character/action-dot-tooltip.js";
import { characterActorImage } from "./actor-images.js";

export { prepareLoadoutCapacity } from "./character/loadout.js";

/** Radios, artwork, and the live counter are one projection of the saved clock. */
export function updateCharacterClockDisplay(root, name, value) {
  if (!["system.scars", "system.oath"].includes(name)) return;
  const current = Math.min(4, Math.max(0, Number(value) || 0));
  const controls = root?.querySelectorAll?.(`input[name="${name}"]`) ?? [];
  for (const control of controls) control.checked = Number(control.value) === current;
  const clock = Array.from(controls)[0]?.closest?.(".blades-clock");
  if (!clock) return;
  for (let segment = 0; segment <= 4; segment++) {
    clock.classList.toggle(`clock-4-${segment}`, segment === current);
  }
  clock.style.backgroundImage = `url('${clockImagePath(4, current)}')`;
  const progress = clock.parentElement?.querySelector(".clock-progress");
  if (progress) progress.textContent = `${current}/4`;
}

export function updateCharacterTrackerDisplay(element, value) {
  const group = element.parentElement;
  const tracker = element.closest?.(".character-tracker")
    ?? element.closest?.(".character-xp, .character-stress")
    ?? group;
  const color = tracker?.classList.contains("character-xp") ? "blue" : "red";

  const grantedValue = Number(group?.dataset?.grantedValue);
  if (Number.isFinite(grantedValue)) {
    const baseValue = Math.max(0, Number(value) || 0);
    const totalValue = Math.min(4, grantedValue + baseValue);
    group.querySelectorAll(".dot-value").forEach(dot => {
      const granted = dot.dataset.granted === "true";
      const filled = granted || Number(dot.dataset.baseValue) <= baseValue;
      dot.setAttribute("aria-pressed", filled ? "true" : "false");
      dot.classList.toggle("dot-value--granted", granted);
      dot.classList.toggle("dot-value--filled", filled && !granted);
      dot.classList.toggle("dot-value--empty", !filled);
    });

    const skillLabel = group.querySelector(".attribute-skill-label");
    if (skillLabel) skillLabel.dataset.rollValue = String(totalValue);
    const attribute = group.closest?.(".attribute");
    const attributeLabel = attribute?.querySelector(".attribute-label");
    if (attributeLabel) {
      attributeLabel.dataset.rollValue = String(
        Array.from(attribute.querySelectorAll(".attribute-skill-label"))
          .filter(label => Number(label.dataset.rollValue) > 0).length
      );
    }
    return;
  }

  group?.querySelectorAll(".dot-value").forEach(dot => {
    const filled = Number(dot.dataset.value) <= value;
    const tooth = dot.querySelector("img.big-teeth");
    if (tooth) {
      dot.setAttribute("aria-pressed", filled ? "true" : "false");
      tooth.src = `systems/brinkwood-reforged/styles/assets/teeth/stresstooth-${filled ? color : "halfgrey"}.png`;
      return;
    }

    dot.setAttribute("aria-pressed", filled ? "true" : "false");
    dot.classList.toggle("dot-value--filled", filled);
    dot.classList.toggle("dot-value--empty", !filled);
  });

  const output = tracker?.querySelector?.("output");
  const maxValue = Number(element.dataset.max_value);
  if (output && Number.isFinite(maxValue)) output.textContent = `${value} / ${maxValue}`;

  const skillLabel = group?.querySelector?.(".attribute-skill-label");
  if (!skillLabel) return;
  skillLabel.dataset.rollValue = String(value);

  const attribute = group.closest?.(".attribute");
  const attributeLabel = attribute?.querySelector(".attribute-label");
  if (attributeLabel) {
    attributeLabel.dataset.rollValue = String(
      attribute.querySelectorAll('.attributes-container .dot-value[data-value="1"].dot-value--filled').length
    );
  }
}

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {BladesSheet}
 */
export class BladesActorSheet extends BladesSheet {

  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "actor", "pc", "character"],
// A stable ApplicationV2 frame prevents a long tab from resizing and moving
// the window. The Character form is the single vertical scroll owner.
    position: { width: 700, height: 1170 },
    window: { resizable: true },
    form: { submitOnChange: false },
    tabGroups: { primary: "traits" },
  };

  static PARTS = {
    sheet: { template: "systems/brinkwood-reforged/templates/actor-sheet.html", scrollable: [""] },
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.img = characterActorImage(context.img);
    await preloadClockImages(4);

    this._ensureValidPrimaryTab(context);

    // Prepare active effects
    context.effects = await BladesActiveEffect.prepareActiveEffectCategories(this.actor.effects, { owner: this.actor });
    this._prepareEffectTabs(context);

    this.setAttrLabels(context.system.attributes);
    prepareActionDotProjection(context.system.attributes, context.items);
    prepareActionDescriptionTooltips(context.system.attributes, key => game.i18n.localize(key));

    const identityDefinitions = [
      { itemType: "upbringing", label: "BITD.Upbringing", descriptionRoot: "Actor.Upbringings" },
      { itemType: "profession", label: "BITD.Profession", descriptionRoot: "Actor.Professions" },
      { itemType: "class", label: "BITD.Class", descriptionKey: "Actor.Classes.Description" },
      { itemType: "pact", label: "BITD.Pact", descriptionRoot: "Actor.Pacts" },
    ];
    for (const item of context.items) {
      const definition = identityDefinitions.find(({ itemType }) => itemType === item.type);
      if (!definition) continue;
      const descriptionKey = definition.descriptionKey ?? `${definition.descriptionRoot}.${item.name}`;
      const description = game.i18n.localize(descriptionKey);
      const enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        description,
        { async: true, relativeTo: this.document, secrets: this.document.isOwner },
      );
      const tooltipDescription = item.type === "pact"
        ? formatPactTooltipDescription(enrichedDescription)
        : enrichedDescription;
      item.identityTooltipHtml = ["class", "profession"].includes(item.type)
        ? renderActionDotSourceTooltip(item, enrichedDescription, key => game.i18n.localize(key))
        : renderItemTooltip(
          item,
          key => game.i18n.localize(key),
          () => tooltipDescription,
          { includeStats: false },
        );
    }

    // The shared identity-row partial renders descriptors rather than scanning
    // the Actor's entire item collection. Keep all four Character rows present
    // even when their optional embedded Item has not been selected yet.
    context.identityRows = identityDefinitions.map(({ itemType, label }) => ({
      itemType,
      label,
      deleteLabel: "BITD.TitleDeleteItem",
      item: context.items.find(item => item.type === itemType) ?? null,
    }));

    context.traits = this._prepareTraitDisplayOrder(context.items
      .filter(i => i.type === "trait")
      .map(trait => {
        const canDelete = context.isGM && !trait.flags?.["brinkwood-reforged"]?.traitGrant;
        return { ...trait, canDelete };
      }));

    // This is display-only data. Selecting an entry is the only path that
    // creates its embedded item on the actor.
    // A missing or temporarily rejected catalogue must not prevent a Character
    // from opening. Keep owned equipment visible and retry catalogue access on
    // the next context preparation.
    try {
      context.loadoutItems = prepareLoadoutCatalogue(await getItemsByType("item", game), context.items);
      context.loadoutGroups = groupLoadoutItems(context.loadoutItems);
      context.loadoutCatalogueError = false;
    } catch (error) {
      console.warn("Brinkwood loadout catalogue unavailable; will retry on render", error);
      context.loadoutItems = prepareLoadoutCatalogue([], context.items);
      context.loadoutGroups = groupLoadoutItems(context.loadoutItems);
      context.loadoutCatalogueError = true;
    }

    Object.entries(context.system.attributes).forEach(([name, attr]) => {
      context.system.attributes[name].value = Object.values(attr.skills).filter(s => s.value > 0).length;
    });

    // Calculate Load
    const loadout = calculateLoadoutWeight(context.items);
    context.system.loadout = loadout;
    Object.assign(context, prepareLoadoutCapacity(loadout, context.system.selected_load_level));

    context.system.load_level = encumbranceLevelForLoadout(loadout, hasMuleAbility(context.items));
    context.system.load_levels = { "BITD.Light": "BITD.Light", "BITD.Normal": "BITD.Normal", "BITD.Heavy": "BITD.Heavy" };

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.description,
      { async: true, relativeTo: this.document, secrets: this.document.isOwner }
    );

    return context;
  }

  /** Route Class and Profession choices through the actor-owned source command. */
  async _createPickedItems(items, options = {}) {
    const { itemType } = options;
    if (!["class", "profession"].includes(itemType)) {
      return super._createPickedItems(items, options);
    }
    const [source] = items;
    return source ? this.actor.configureActionDotSource(source) : [];
  }

  /** Identity help uses authoritative localized prose and structured grants. */
  _renderItemPickerTooltip(item, enrichedDescription) {
    if (!["class", "profession", "pact"].includes(item?.type)) {
      return super._renderItemPickerTooltip(item, enrichedDescription);
    }
    const descriptionKey = item.type === "class" ? "Actor.Classes.Description" : {
      profession: `Actor.Professions.${item.name}`,
      pact: `Actor.Pacts.${item.name}`,
    }[item.type];
    const localizedDescription = game.i18n.localize(descriptionKey);
    const descriptionHtml = localizedDescription === descriptionKey
      ? enrichedDescription
      : `<p>${localizedDescription}</p>`;
    const localize = key => game.i18n.localize(key);
    const formattedDescription = item.type === "pact"
      ? formatPactTooltipDescription(descriptionHtml)
      : formatTooltipDescription(descriptionHtml);
    return ["class", "profession"].includes(item.type)
      ? renderActionDotSourceTooltip(item, descriptionHtml, localize)
      : renderItemTooltip(
        item,
        localize,
        () => formattedDescription,
        { includeStats: false },
      );
  }

  /** Keep a valid user-selected tab through rerenders; only fall back on no valid state. */
  _ensureValidPrimaryTab(context) {
    const validTabs = ["traits", "loadout", "character-notes", "downtime"];
    if (context.isGM) validTabs.push("effects");
    if (validTabs.includes(this.tabGroups.primary)) return;

    this.tabGroups.primary = "traits";
    context.tabs.primary = "traits";
  }

  /* -------------------------------------------- */

  /** Reset transient navigation when the sheet is genuinely closed. */
  async close(options = {}) {
    this._sheetViewState = undefined;
    this.tabGroups.primary = "traits";
    return super.close(options);
  }

  /* -------------------------------------------- */
  /** @override */
  async _onRender(context, options) {
     await super._onRender(context, options);
     const html = this.element;

     this._characterSheetListenerController?.abort();
     this._characterSheetListenerController = new AbortController();
     const listenerOptions = { signal: this._characterSheetListenerController.signal };
     bindSheetSaveStatus(this, html, listenerOptions);
    this._bindSheetViewState(html, listenerOptions);
    bindLoadoutControls(this, html, listenerOptions);
    for (const name of ["system.scars", "system.oath"]) {
      updateCharacterClockDisplay(html, name, foundry.utils.getProperty(this.document, name));
    }
     html.querySelector('input[name="name"]')?.addEventListener(
       "keydown", handleActorNameEnter, listenerOptions);
     if (!this.isEditable) return;

      bindRichTextPersistence(this, html, listenerOptions);
      html.querySelectorAll('input[name], select[name], textarea[name]').forEach(control => {
        control.addEventListener("change", event => this._persistFormControl(event), listenerOptions);
      });

    // Open Inventory Item sheet
    html.querySelectorAll(".item-body").forEach(el =>
      el.addEventListener("click", ev => {
        const item = this.actor.items.get(ev.currentTarget.closest(".item").dataset.itemId);
        item.sheet.render({ force: true });
      }, listenerOptions)
    );

    html.querySelectorAll('.item-body[role="button"]').forEach(el =>
      el.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.currentTarget.click();
      }, listenerOptions)
    );

    // Delete Inventory Item
    html.querySelectorAll(".item-delete").forEach(el =>
      el.addEventListener("click", async ev => {
        const element = ev.currentTarget.closest(".item");
        if (!element) return;
        const item = this.actor.items.get(element.dataset.itemId);
        if (!item) return;
        if (item.type === "trait" && (!game.user.isGM || item.flags?.["brinkwood-reforged"]?.traitGrant)) return;
        await this.actor.deleteEmbeddedDocuments("Item", [element.dataset.itemId]);
        element.remove();
      }, listenerOptions)
    );

    // Dot rating controls
    html.querySelectorAll(".dot-value").forEach(el =>
      el.addEventListener("click", this._onDotChange.bind(this), listenerOptions)
    );

    html.querySelectorAll('input[name="system.scars"], input[name="system.oath"]').forEach(el =>
      el.addEventListener("click", this._onClockClick.bind(this), listenerOptions)
    );

    // Active effect controls - use data-effect-action to avoid AppV2 action dispatch
    html.querySelectorAll(".effect-control[data-effect-action]").forEach(el =>
      el.addEventListener("click", ev => this._onActorEffectControl(
        ev,
        () => BladesActiveEffect.onManageActiveEffect(ev, this.actor, { gmOnly: true, render: false }),
        { renderAfter: ev.currentTarget.dataset.effectAction !== "edit" },
      ), listenerOptions)
    );
  }

  async _persistFormControl(event) {
    if (!this.isEditable) return;
    const control = event.currentTarget;
    if (control.matches('input[name="name"]')) return persistActorNameChange(this, event);
    if (control.matches("prose-mirror[name]")) return persistRichTextChange(this, event);
    // Clock radios have toggle-to-zero semantics in _onClockClick; a later
    // generic focus/change save would otherwise restore the selected segment.
    if (control.matches('select[name="system.selected_load_level"]')) return;
    if (control.matches('input[name="system.scars"], input[name="system.oath"], [data-path]')) return;
    // Ordinary controls already reflect the committed value in the live DOM.
    // Avoid replacing the focused form and moving its single scroll owner.
    await persistFormControlChange(this, control, { render: false });
  }

  async _onDotChange(event) {
    return persistTrackerChange(this, event, (element, value) => this._updateTrackerDisplay(element, value));
  }

  _updateTrackerDisplay(element, value) {
    updateCharacterTrackerDisplay(element, value);
  }

  async _onClockClick(event) {
    const { name, value } = event.currentTarget;
    const selectedValue = Number(value);
    if (!this.isEditable || !["system.scars", "system.oath"].includes(name) || !Number.isInteger(selectedValue)) return;

    event.preventDefault();
    event.stopPropagation();
    try {
      await queueDocumentPathUpdate(this.document, name, async () => {
        const currentValue = Number(foundry.utils.getProperty(this.document, name));
        const clockValue = selectedValue === 1 && currentValue === 1 ? 0 : selectedValue;
        const nextValue = Math.min(4, Math.max(0, clockValue));
        await this.document.update({ [name]: nextValue }, { render: false });
        updateCharacterClockDisplay(this.element, name, nextValue);
      });
      return true;
    } catch (error) {
      reportSheetInteractionFailure(error, "BITD.ClockUpdateFailed");
      updateCharacterClockDisplay(this.element, name, foundry.utils.getProperty(this.document, name));
      return false;
    }
  }

  /* -------------------------------------------- */

}
