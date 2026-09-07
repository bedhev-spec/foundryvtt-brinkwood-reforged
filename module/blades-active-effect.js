/**
 * Extend the base ActiveEffect class to implement system-specific logic.
 * @extends {ActiveEffect}
 */

export class BladesActiveEffect extends foundry.documents.ActiveEffect {
  /**
   * Is this active effect currently suppressed?
   * @type {boolean}
   */
  isSuppressed = false;

  /* --------------------------------------------- */
  /** @inheritdoc */
  apply(actor, change) {
    if ( this.isSuppressed ) return null;
    //this allows for math and actor data references in the change values. Probably not necessary for
    // blades, but it was simple, and you never know what users will do. Probably ruin everything.
    change.value = foundry.dice.Roll.replaceFormulaData(change.value, actor.system);
    try {
      change.value = foundry.dice.Roll.safeEval(change.value).toString();
    } catch (e) {
      // this is a valid case, e.g., if the effect change simply is a string
    }
    let parsed;
    try{
      parsed = JSON.parse(change.value);
    }
    catch(e){
    }
    if(parsed instanceof Array){
      change.value = parsed;
    }

		return super.apply(actor, change);
  }
  /* --------------------------------------------- */

  /**
   * Determine whether this Active Effect is suppressed or not.
   */
  determineSuppression() {
    this.isSuppressed = false;
  }


  /**
   * Manage Active Effect instances through the Actor Sheet via effect control buttons.
   * @param {MouseEvent} event      The left-click event on the effect control
   * @param {Actor|Item} owner      The owning entity which manages this effect
   */
  static onManageActiveEffect(event, owner, { gmOnly = false, render = true } = {}) {
    event.preventDefault();
    if (!owner?.isOwner) return;
    if (gmOnly && !game.user.isGM) return;
    const a = event.currentTarget;
    const effectElement = a.closest("[data-effect-id]");
    const categoryElement = a.closest("[data-effect-type]");
    const effect = effectElement?.dataset.effectId
      ? owner.effects.get(effectElement.dataset.effectId)
      : null;
    // Read data-effect-action (avoids collision with ApplicationV2's data-action dispatch)
    const action = a.dataset.effectAction;
    switch ( action ) {
      case "create":
        return owner.createEmbeddedDocuments("ActiveEffect", [{
          name: "New Effect",
          img: "systems/brinkwood-reforged/styles/assets/icons/Icon.3_13.png",
          origin: owner.uuid,
          "duration.rounds": categoryElement?.dataset.effectType === "temporary" ? 1 : undefined,
          disabled: categoryElement?.dataset.effectType === "inactive",
        }], { render });
      case "edit":
        return effect?.sheet.render({ force: true });
      case "delete":
        return effect.delete({ render });
      case "toggle":
        return effect.update({ disabled: !effect.disabled }, { render });
    }
  }


  /**
   * Prepare the data structure for Active Effects which are currently applied to an Actor or Item.
   * @param {ActiveEffect[]} effects    The array of Active Effect instances to prepare sheet data for
   * @return {object}                   Data for rendering
   */
  static async prepareActiveEffectCategories(effects, { owner } = {}) {

    // Define effect header categories
    const categories = {
      temporary: {
        type: "temporary",
        label: game.i18n.localize("BITD.EffectTemporary"),
        canCreate: true,
        visible: true,
        effects: []
      },
      passive: {
        type: "passive",
        label: game.i18n.localize("BITD.EffectPassive"),
        canCreate: true,
        visible: true,
        effects: []
      },
      inactive: {
        type: "inactive",
        label: game.i18n.localize("BITD.EffectInactive"),
        canCreate: true,
        visible: true,
        effects: []
      },
      suppressed: {
        type: "suppressed",
        label: game.i18n.localize("BITD.EffectSuppressed"),
        canCreate: false,
        visible: false,
        effects: []
      }

    };

    // Iterate over active effects, classifying them into categories
    // Use the synchronous sourceName getter (v13 replaced async _getSourceName())
    for ( const effect of effects ) {
      const displayEffect = await this.prepareActiveEffectDisplay(effect, owner);
      if ( effect.isSuppressed ) categories.suppressed.effects.push(displayEffect);
      else if ( effect.disabled ) categories.inactive.effects.push(displayEffect);
      else if ( this.hasTemporaryDuration(effect) ) categories.temporary.effects.push(displayEffect);
      else categories.passive.effects.push(displayEffect);
    categories.suppressed.visible = categories.suppressed.effects.length > 0;
    }
    return categories;
  }

  /** Statuses describe an effect; only an explicit duration makes it temporary. */
  static hasTemporaryDuration(effect) {
    const durations = [effect?._source?.duration, effect?.duration];
    return durations.some(duration => ["rounds", "turns", "seconds"]
      .some(unit => duration?.[unit] !== null && duration?.[unit] !== undefined));
  }

  static async prepareActiveEffectDisplay(effect, owner) {
    const statusDefinitions = globalThis.CONFIG?.statusEffects ?? [];
    const statuses = Array.from(effect.statuses ?? [], statusId => {
      const definition = statusDefinitions.find(status => status.id === statusId);
      return definition?.name ? game.i18n.localize(definition.name) : statusId;
    });
    const rawDescription = typeof effect.description === "string" ? effect.description.trim() : "";
    const enrichHTML = foundry.applications?.ux?.TextEditor?.implementation?.enrichHTML;
    const enrichedDescription = rawDescription && typeof enrichHTML === "function"
      ? await enrichHTML(rawDescription, {
        async: true,
        relativeTo: effect,
        secrets: owner?.isOwner ?? effect.isOwner
      })
      : "";

    return {
      id: effect.id,
      img: effect.img,
      name: effect.name,
      disabled: effect.disabled,
      sourceName: effect.sourceName,
      duration: effect.duration,
      statuses,
      hasStatuses: statuses.length > 0,
      enrichedDescription,
      hasDescription: enrichedDescription.length > 0,
      hasDetails: statuses.length > 0 || enrichedDescription.length > 0,
      detailsId: `effect-${effect.id}-details`
    };
  }

}

/**
 * Cap numeric "custom" active-effect changes at 4.
 * Replaces the former private _applyCustom override with the public v13 hook.
 * The base ActiveEffect._applyCustom fires this hook; we intercept it here to
 * apply the system-specific cap without subclassing private API.
 */
Hooks.on("applyActiveEffect", (actor, change, current, delta, changes) => {
  if (change.mode !== CONST.ACTIVE_EFFECT_MODES.CUSTOM) return;
  const newValue = (current + delta > 4) ? 4 : current + delta;
  changes[change.key] = newValue;
});

// Portions of this code are copyright 2021 Andrew Clayton
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
