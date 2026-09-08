import { bladesRoll } from "./blades-roll.js";
import { readRollDialogValues } from "./roll-resolution.js";
import { BladesHelpers } from "./blades-helpers.js";
import {
  characterActorImage,
  clockActorImage,
  maskActorImage,
  npcActorImage,
  rebelionActorImage,
} from "./actor-images.js";
import {
  compendiumSourceMetadata,
  canonicalTraitSourceName,
  traitHasCompendiumProvenance,
} from "./trait-grant-matching.js";
import {
  ACTION_DOT_SOURCE_TYPES,
  actionDotGrantsForSource,
  actionDotReconciliationUpdate,
  withActionDotGrantSnapshot,
} from "./character/action-dot-grants.js";
import {
  alchemicBloodEffectUpdate,
  findAlchemicBloodTrait,
  isAlchemicBloodEffectId,
  isRuinMask,
} from "./mask/alchemic-blood.js";

const TRAIT_SOURCE_TYPES = new Set(["upbringing", "profession", "mask"]);
const isTraitSource = item => TRAIT_SOURCE_TYPES.has(item?.type);

// Trait creation and source deletion both make decisions from the actor's
// embedded documents. Keep that whole lifecycle serial per actor so a source
// cannot disappear between a grant check and its embedded-document create.
const traitLifecycleQueues = new WeakMap();
function serializeTraitLifecycle(actor, operation) {
  const prior = traitLifecycleQueues.get(actor) ?? Promise.resolve();
  const next = prior.catch(() => undefined).then(operation);
  traitLifecycleQueues.set(actor, next);
  return next.finally(() => {
    if (traitLifecycleQueues.get(actor) === next) {
      traitLifecycleQueues.delete(actor);
    }
  });
}

// Action-point hooks read the current actor data before writing a replacement
// value. Serialize those read-modify-write updates independently of the trait
// lifecycle queue, since either a source create or delete can trigger one.
const actionPointQueues = new WeakMap();
function serializeActionPointUpdate(actor, operation) {
  const prior = actionPointQueues.get(actor) ?? Promise.resolve();
  const next = prior.catch(() => undefined).then(operation);
  actionPointQueues.set(actor, next);
  return next.finally(() => {
    if (actionPointQueues.get(actor) === next) actionPointQueues.delete(actor);
  });
}

// Mask configuration is a single actor-level choice. Unlike ordinary item
// creation, competing picker submissions must observe the previous complete
// replacement before deciding which embedded Mask to retain.
const maskConfigurationQueues = new WeakMap();
function serializeMaskConfiguration(actor, operation) {
  const prior = maskConfigurationQueues.get(actor) ?? Promise.resolve();
  const next = prior.catch(() => undefined).then(operation);
  maskConfigurationQueues.set(actor, next);
  return next.finally(() => {
    if (maskConfigurationQueues.get(actor) === next) {
      maskConfigurationQueues.delete(actor);
    }
  });
}

const actionDotSourceQueues = new WeakMap();
function serializeActionDotSource(actor, operation) {
  const prior = actionDotSourceQueues.get(actor) ?? Promise.resolve();
  const next = prior.catch(() => undefined).then(operation);
  actionDotSourceQueues.set(actor, next);
  return next.finally(() => {
    if (actionDotSourceQueues.get(actor) === next) actionDotSourceQueues.delete(actor);
  });
}

function sameMaskChoice(existing, requested) {
  const existingSource = compendiumSourceMetadata(existing);
  const requestedSource = compendiumSourceMetadata(requested);
  return existing.name === requested.name
    && (!existingSource.length || !requestedSource.length
      || existingSource.some(source => requestedSource.includes(source)));
}

function actionPointBonuses(source) {
  const snapshot = actionDotGrantsForSource(source).map(({ path, value }) => [path, value]);
  if (snapshot.length) return snapshot;
  return String(source?.system?.logic ?? "")
    .split("\n")
    .map(line => line.replaceAll(" ", "").split("="))
    .map(([path, value]) => [path, Number.parseInt(value, 10)])
    .filter(([path, value]) => path && Number.isFinite(value));
}

/**
 * Extend the basic Actor
 * @extends {Actor}
 */
export class BladesActor extends foundry.documents.Actor {

  /** @override */
  static async create(data, options={}) {

    data.prototypeToken = data.prototypeToken || {};

    if (data.type === "mask") {
      data.img = maskActorImage(data.img);
    }

    if (data.type === "npc") {
      data.img = npcActorImage(data.img);
    }

    if (data.type === "rebelion") {
      data.img = rebelionActorImage(data.img);
    }

    if (data.type === "clock") {
      data.img = clockActorImage(data.img);
      data.prototypeToken.texture = data.prototypeToken.texture || {};
      data.prototypeToken.texture.src = clockActorImage(data.prototypeToken.texture.src);
    }

    // Characters use linked tokens so their token and sheet stay in sync.
    if (data.type === "character") {
      data.img = characterActorImage(data.img);
      data.prototypeToken.actorLink = true;
    }
    return super.create(data, options);
  }

  async _onCreate( data, options, userId ) {
    await super._onCreate(data, options, userId);

    //load basic items for characters
    if ( data.type == "character" ) {
      await this._loadBasicItems();
    }

  }

  /** @override */

  /* -------------------------------------------- */

  rollAttributePopup(attribute_name, attribute_label, attribute_value) {

    let content = `
        <h2>${game.i18n.localize('BITD.Roll')} ${game.i18n.localize(attribute_label)}</h2>
        <form>
          <div class="form-group">
            <label>${game.i18n.localize('BITD.Modifier')}:</label>
            <select id="mod" name="mod">
              ${this.createListOfDiceMods(-3,+3,0)}
            </select>
          </div>`;
    if (BladesHelpers.isAttributeAction(attribute_label)) {
      content += `
            <div class="form-group">
              <label>${game.i18n.localize('BITD.Position')}:</label>
              <select id="pos" name="pos">
                <option value="controlled">${game.i18n.localize('BITD.PositionControlled')}</option>
                <option value="risky" selected>${game.i18n.localize('BITD.PositionRisky')}</option>
                <option value="desperate">${game.i18n.localize('BITD.PositionDesperate')}</option>
              </select>
            </div>
            <div class="form-group">
              <label>${game.i18n.localize('BITD.Effect')}:</label>
              <select id="fx" name="fx">
                <option value="limited">${game.i18n.localize('BITD.EffectLimited')}</option>
                <option value="standard" selected>${game.i18n.localize('BITD.EffectStandard')}</option>
                <option value="great">${game.i18n.localize('BITD.EffectGreat')}</option>
              </select>
            </div>`;
    } else {
        content += `
            <input id="pos" name="pos" type="hidden" value="">
            <input id="fx" name="fx" type="hidden" value="">`;
    }
    content += `
        <div class="form-group">
          <label>${game.i18n.localize('BITD.Notes')}:</label>
          <input id="note" name="note" type="text" value="">
        </div><br/>
        </form>
      `;

    // Replace legacy Dialog with DialogV2
    foundry.applications.api.DialogV2.prompt({
      window: { title: `${game.i18n.localize('BITD.Roll')} ${game.i18n.localize(attribute_label)}` },
      content: content,
      ok: {
        icon: "<i class='fas fa-check'></i>",
        label: game.i18n.localize('BITD.Roll'),
        callback: async (_event, _button, dialog) => {
          const { modifier, position, effect, note } = readRollDialogValues(dialog);
          await this.rollAttribute(attribute_label, modifier, attribute_value, position, effect, note);
        },
      },
      rejectClose: false,
    });

  }

  /* -------------------------------------------- */

  async rollAttribute(attribute_label = "", additional_dice_amount = 0, attribute_value = 0, position, effect, note) {
    let dice_amount = 0;
    if (attribute_label !== "") {
			dice_amount = attribute_value;
    }
    else {
      dice_amount = 1;
    }

    await bladesRoll(dice_amount, attribute_label, position, effect, note, {
      modifiers: [{ label: "BITD.Modifier", value: additional_dice_amount }]
    });
  }

  /* -------------------------------------------- */

  /**
   * Create <options> for available actions
   *  which can be performed.
   */
  createListOfActions() {

    let text, attribute, skill;
    let attributes = this.system.attributes;

    for ( attribute in attributes ) {

      const skills = attributes[attribute].skills;

      text += `<optgroup label="${attribute} Actions">`;
      text += `<option value="${attribute}">${attribute} (Resist)</option>`;

      for ( skill in skills ) {
        text += `<option value="${skill}">${skill}</option>`;
      }

      text += `</optgroup>`;

    }

    return text;

  }

  /* -------------------------------------------- */

  /**
   * Creates <options> modifiers for dice roll.
   *
   * @param {int} rs
   *  Min die modifier
   * @param {int} re
   *  Max die modifier
   * @param {int} s
   *  Selected die
   */
  createListOfDiceMods(rs, re, s) {

    var text = ``;
    var i = 0;

    if ( s == "" ) {
      s = 0;
    }

    for ( i  = rs; i <= re; i++ ) {
      var plus = "";
      if ( i >= 0 ) { plus = "+" };
      text += `<option value="${i}"`;
      if ( i == s ) {
        text += ` selected`;
      }

      text += `>${plus}${i}d</option>`;
    }

    return text;

  }

  /* -------------------------------------------- */

  /**
   * Create source items, then synchronize their grants. Once Foundry has
   * committed the source, a grant failure is recoverable through
   * repairTraitGrantsForSourceIds and must not make callers recreate it.
   */
  async createEmbeddedDocuments(embeddedName, data, operation={}) {
    const documents = embeddedName === "Item" && Array.isArray(data)
      ? data.map(withActionDotGrantSnapshot)
      : data;
    const created = await super.createEmbeddedDocuments(embeddedName, documents, operation);
    const traitSources = embeddedName === "Item"
      ? Array.from(created ?? []).filter(isTraitSource)
      : [];
    if (!traitSources.length) return created;

    try {
      await this.syncTraitGrantsForSources(traitSources);
    } catch (error) {
      if (operation.brinkwoodStrictTraitSync) throw error;
      const sourceIds = traitSources.map(source => source.id ?? source._id).filter(Boolean);
      console.error("Brinkwood trait grant synchronization failed after source creation", {
        actorId: this.id,
        sourceIds,
        error
      });
      globalThis.ui?.notifications?.warn?.(
        "The selected source was saved, but its traits could not be loaded. Please retry the trait repair."
      );
    }
    return created;
  }

  async deleteEmbeddedDocuments(embeddedName, ids, operation={}) {
    const remove = async () => {
      const removedItems = embeddedName === "Item" && Array.isArray(ids)
        ? ids.map(id => this.items.get?.(id)
          ?? this.items.find?.(entry => (entry.id ?? entry._id) === id)).filter(Boolean)
        : [];
      const sourceKeys = new Set(removedItems
        .filter(isTraitSource)
        .map(item => `${item.type}:${item.id ?? item._id}`));
      const grantIds = embeddedName === "Item"
        ? this.items.filter(item => {
          const grant = item.flags?.["brinkwood-reforged"]?.traitGrant;
          return item.type === "trait"
            && sourceKeys.has(`${grant?.sourceItemType}:${grant?.sourceItemId}`);
        }).map(item => item.id ?? item._id)
        : [];
      const deleteIds = [...new Set([...ids, ...grantIds])];

      // The sheet awaits this public deletion path. Include exact source-tagged
      // grants in the same Foundry database operation instead of starting a
      // second asynchronous deletion from a post-delete lifecycle callback.
      return super.deleteEmbeddedDocuments(embeddedName, deleteIds, operation);
    };

    const removesTraitSource = embeddedName === "Item" && Array.isArray(ids)
      && ids.some(id => isTraitSource(this.items.get?.(id)
        ?? this.items.find?.(entry => (entry.id ?? entry._id) === id)));
    return removesTraitSource ? serializeTraitLifecycle(this, remove) : remove();
  }

  async _modActionPoints(data, remove=false) {
    if (!ACTION_DOT_SOURCE_TYPES.has(data?.type)) return false;
    return serializeActionPointUpdate(this, async () => {
      const max_value = 4;
      const mod = remove ? -1 : 1;
      let system = {};
      actionPointBonuses(data).forEach(([key, bonus_value]) => {
        let value = parseInt(foundry.utils.getProperty(this, key)) + mod*bonus_value;
        value = (value > max_value) ? max_value : value;
        value = (value < 0 ? 0 : value);
        foundry.utils.setProperty(system, key, value);
      });
      if (!Object.keys(system).length) return;
      await this.update(system);
    });
  }

  /** Configure the sole Class or Profession through one serialized command. */
  async configureActionDotSource(sourceData) {
    if (!ACTION_DOT_SOURCE_TYPES.has(sourceData?.type)) {
      throw new TypeError("Action Dot configuration requires a Class or Profession Item.");
    }

    const requested = withActionDotGrantSnapshot(sourceData);
    delete requested._id;
    delete requested.id;

    return serializeActionDotSource(this, async () => {
      const existing = this.items.filter(item => item.type === requested.type);
      const retained = existing.find(item => {
        const currentSources = compendiumSourceMetadata(item);
        const requestedSources = compendiumSourceMetadata(requested);
        return item.name === requested.name
          && (!currentSources.length || !requestedSources.length
            || currentSources.some(source => requestedSources.includes(source)));
      });
      if (retained) {
        const update = actionDotReconciliationUpdate(this);
        if (Object.keys(update).length) await this.update(update);
        return retained;
      }

      const [created] = await this.createEmbeddedDocuments("Item", [requested], {
        brinkwoodConfigureActionDotSource: true,
      });
      if (!created) throw new Error("Action Dot source configuration did not create an Item.");

      const obsoleteIds = existing.map(item => item.id ?? item._id).filter(Boolean);
      if (obsoleteIds.length) {
        try {
          await this.deleteEmbeddedDocuments("Item", obsoleteIds);
        } catch (error) {
          const createdId = created.id ?? created._id;
          if (createdId) {
            try {
              await this.deleteEmbeddedDocuments("Item", [createdId]);
            } catch (rollbackError) {
              console.error("Brinkwood Action Dot source rollback failed", {
                actorId: this.id,
                createdId,
                rollbackError,
              });
            }
          }
          throw error;
        }
      }
      // Reconcile only after replacement commits: the temporary old+new set
      // must never displace manual dots. Removal deliberately restores nothing.
      const update = actionDotReconciliationUpdate(this);
      if (Object.keys(update).length) await this.update(update);
      return created;
    });
  }

  async _addTraits(data, compendiumTraits = null, adoptLegacyTraits = false, traitSourceIds = null, requirePersistedSource = false) {
    const traitPack = game.packs.get("brinkwood-reforged.trait");
    if (!traitPack) return;

    const sourceItemId = data.id ?? data._id;
    return serializeTraitLifecycle(this, async () => {
    if (requirePersistedSource && sourceItemId) {
      const currentSource = this.items.get?.(sourceItemId)
        ?? this.items.find?.(item => (item.id ?? item._id) === sourceItemId);
      if (!currentSource || !isTraitSource(currentSource)) return;
    }

    // Compendium queries are indexed-field dependent in v13. Hydrate then
    // filter so every mapped automatic trait source works consistently.
    const requestedTraitSourceIds = traitSourceIds ? new Set(traitSourceIds) : null;
    const traits = (compendiumTraits ?? await traitPack.getDocuments())
      .filter(trait => trait.type === "trait"
        && (requestedTraitSourceIds
          ? requestedTraitSourceIds.has(trait.id ?? trait._id)
          : canonicalTraitSourceName(trait.system.class) === canonicalTraitSourceName(data.name)));
    const alreadyGranted = new Set(this.items
      .filter(item => item.type === "trait" && item.flags?.["brinkwood-reforged"]?.traitGrant?.sourceItemId === sourceItemId)
      .map(item => item.flags["brinkwood-reforged"].traitGrant.traitSourceId));

    // Pre-v13 grants were embedded without our source tag. Only repair a
    // legacy trait when the compendium source proves it, or its exact name and
    // class leave a single possible match. Ambiguous candidates are left alone
    // and suppress creation, so reconciliation can never duplicate a trait.
    const legacyTraits = this.items.filter(item =>
      item.type === "trait" && !item.flags?.["brinkwood-reforged"]?.traitGrant);
    const adoptedTraitIds = new Set();
    const uncertainTraitSourceIds = new Set();
    const traitUpdates = [];
    if (adoptLegacyTraits) {
      for (const trait of traits) {
        const traitSourceId = trait.id ?? trait._id;
        if (alreadyGranted.has(traitSourceId)) continue;
        const provenanceMatches = legacyTraits.filter(item =>
          !adoptedTraitIds.has(item.id ?? item._id)
          && traitHasCompendiumProvenance(item, trait));
        const exactMatches = provenanceMatches.length ? [] : legacyTraits.filter(item =>
          !adoptedTraitIds.has(item.id ?? item._id)
          && item.name === trait.name
          && canonicalTraitSourceName(item.system?.class) === canonicalTraitSourceName(data.name));
        const matches = provenanceMatches.length ? provenanceMatches : exactMatches;
        if (matches.length === 1) {
          const legacyTrait = matches[0];
          const legacyTraitId = legacyTrait.id ?? legacyTrait._id;
          adoptedTraitIds.add(legacyTraitId);
          alreadyGranted.add(traitSourceId);
          traitUpdates.push({
            _id: legacyTraitId,
      "flags.brinkwood-reforged.traitGrant": {
              sourceItemId,
              sourceItemType: data.type,
              traitSourceId
            }
          });
        } else if (matches.length > 1) {
          uncertainTraitSourceIds.add(traitSourceId);
        }
      }
      if (traitUpdates.length) await this.updateEmbeddedDocuments("Item", traitUpdates);
    }
    const createdTraits = traits
      .filter(trait => !alreadyGranted.has(trait.id ?? trait._id)
        && !uncertainTraitSourceIds.has(trait.id ?? trait._id))
      .map(trait => {
        const traitData = trait.toObject();
        const traitSourceId = trait.id ?? trait._id;
        delete traitData._id;
        traitData.flags ??= {};
        traitData.flags["brinkwood-reforged"] ??= {};
        traitData.flags["brinkwood-reforged"].traitGrant = {
          sourceItemId,
          sourceItemType: data.type,
          traitSourceId
        };
        return traitData;
      });

    if (createdTraits.length) {
      await this.createEmbeddedDocuments("Item", createdTraits, { brinkwoodTraitGrant: true });
    }
    });
  }

  /** Synchronize traits for newly embedded source choices through the actor. */
  async syncTraitGrantsForSources(sources, adoptLegacyTraits = false, traitSourceIds = null) {
    const traitSources = Array.from(sources ?? []).filter(isTraitSource);
    if (!traitSources.length) return;
    const traitPack = game.packs.get("brinkwood-reforged.trait");
    if (!traitPack) return;
    const compendiumTraits = await traitPack.getDocuments();
    for (const source of traitSources) {
      // Actor-owned synchronization receives persisted source documents. The
      // source check runs inside _addTraits' lifecycle queue so a deletion
      // that was queued first cannot leave an orphaned grant behind.
      await this._addTraits(source, compendiumTraits, adoptLegacyTraits, traitSourceIds, true);
    }
  }

  /** Retry trait synchronization for source documents already saved on this actor. */
  async repairTraitGrantsForSourceIds(sourceIds, adoptLegacyTraits = false, traitSourceIds = null) {
    const requestedIds = new Set(
      (Array.isArray(sourceIds) ? sourceIds : [sourceIds]).filter(Boolean)
    );
    const sources = this.items.filter(item =>
      requestedIds.has(item.id ?? item._id) && isTraitSource(item));
    return this.syncTraitGrantsForSources(sources, adoptLegacyTraits, traitSourceIds);
  }

  /**
   * Backfill grants for choices embedded before the v13 trait sync repair.
   * Tagged traits are deleted with their source by deleteEmbeddedDocuments.
   * Untagged traits are adopted only when their compendium provenance, or a
   * unique exact name/class match, establishes that relationship.
   */
  async reconcileTraitGrants() {
    await (this.syncTraitGrantsForSources
      ?? BladesActor.prototype.syncTraitGrantsForSources).call(this, this.items, true);
  }

  /**
   * Configure this persistent Mask sheet's sole Mask source item.
   *
   * This is deliberately not an in-play Mask switch: actor fields (including
   * XP, Essence, abilities, and notes) are never updated here. Deleting a
   * source uses the public actor deletion path, which removes only traits
   * tagged with that exact source. Foundry has no cross-document transaction,
   * so create and strictly synchronize the replacement before removing any
   * prior source. A later removal failure compensates by removing the new
   * source and its tagged grants where possible.
   */
  async configureMask(maskData) {
    if (maskData?.type !== "mask") {
      throw new TypeError("Mask configuration requires an Item of type 'mask'.");
    }

    const requested = foundry.utils.deepClone(maskData);
    delete requested._id;
    delete requested.id;

    return serializeMaskConfiguration(this, async () => {
      const masks = this.items.filter(item => item.type === "mask");
      const retained = masks.find(item => sameMaskChoice(item, requested));
      const initialMaskIds = new Set(masks.map(item => item.id ?? item._id));

      const deleteObsoleteMasks = async obsoleteIds => {
        if (!obsoleteIds.length) return;
        try {
          await this.deleteEmbeddedDocuments("Item", obsoleteIds);
        } catch (error) {
          const remaining = new Set(this.items
            .filter(item => item.type === "mask")
            .map(item => item.id ?? item._id));
          if (obsoleteIds.some(id => remaining.has(id))) throw error;
          // The embedded deletion is already authoritative. Preserve the
          // replacement; Mask configuration never mutates Action Dots.
        }
      };

      // Selecting the already configured Mask is idempotent, while still
      // repairing a legacy/failed grant and collapsing corrupted duplicates.
      if (retained && masks.length === 1) {
        await this.syncTraitGrantsForSources([retained]);
        return retained;
      }

      if (retained) {
        await this.syncTraitGrantsForSources([retained]);
        const obsoleteIds = masks
          .filter(item => item !== retained)
          .map(item => item.id ?? item._id)
          .filter(Boolean);
        await deleteObsoleteMasks(obsoleteIds);
        return retained;
      }

      let created;
      try {
        [created] = await this.createEmbeddedDocuments("Item", [requested], {
          // BladesItem's legacy distinct-item hook must not remove the old
          // Mask during this create. This command owns replacement ordering.
          brinkwoodConfigureMask: true,
          brinkwoodStrictTraitSync: true,
        });
        if (!created) throw new Error("Mask configuration did not create a Mask item.");

        const createdId = created.id ?? created._id;
        const isPresent = Boolean(this.items.find(item => (item.id ?? item._id) === createdId && item.type === "mask"));
        if (!isPresent) throw new Error("Mask configuration replacement was not persisted.");

        const obsoleteIds = masks
          .map(item => item.id ?? item._id)
          .filter(Boolean);
        await deleteObsoleteMasks(obsoleteIds);
        return created;
      } catch (error) {
        // A strict synchronization rejection occurs after Foundry committed
        // the source but before the awaited assignment receives its result.
        // Recover that source by comparing live Mask IDs with the snapshot.
        created ??= this.items.find(item => item.type === "mask"
          && !initialMaskIds.has(item.id ?? item._id));
        const createdId = created?.id ?? created?._id;
        if (createdId) {
          try {
            await this.deleteEmbeddedDocuments("Item", [createdId]);
          } catch (rollbackError) {
            console.error("Brinkwood Mask configuration rollback failed", { actorId: this.id, createdId, rollbackError });
          }
        }
        console.error("Brinkwood Mask configuration failed", {
          actorId: this.id,
          error
        });
        globalThis.ui?.notifications?.warn?.(
          "The Mask configuration could not be saved. Please retry."
        );
        throw error;
      }
    });
  }

  /** Remove the configured Mask and only traits granted by its source. */
  async clearMaskConfiguration() {
    return serializeMaskConfiguration(this, async () => {
      const ids = this.items
        .filter(item => item.type === "mask")
        .map(item => item.id ?? item._id)
        .filter(Boolean);
      return ids.length ? this.deleteEmbeddedDocuments("Item", ids) : [];
    });
  }

  /** Record an Alchemic Blood choice on Ruin's source-owned trait. */
  async setAlchemicBloodEffect(effectId, selected = true) {
    if (!this.isOwner) throw new Error("You do not have permission to edit this Mask.");
    if (!isAlchemicBloodEffectId(effectId)) throw new TypeError("Invalid Alchemic Blood effect.");

    return serializeTraitLifecycle(this, async () => {
      const maskItem = this.items.find(item => item.type === "mask");
      if (!isRuinMask(maskItem)) throw new Error("Alchemic Blood belongs to the Ruin Mask.");
      const trait = findAlchemicBloodTrait(this.items, maskItem);
      if (!trait) throw new Error("Ruin's Alchemic Blood trait is missing. Repair the Mask traits and retry.");
      const current = trait.system?.alchemicBlood?.effects?.[effectId] === true;
      if (current === selected) return trait;
      const [updated] = await this.updateEmbeddedDocuments(
        "Item",
        [alchemicBloodEffectUpdate(trait, effectId, selected)]
      );
      return updated ?? trait;
    });
  }

  async _loadBasicItems() {
    // Load and create basic items from compendium
    const basicItems = await game.packs.get("brinkwood-reforged.item").getDocuments({'system.class': ""});
    await this.createEmbeddedDocuments("Item", basicItems.map(item => item.toObject()));

    // Load and create custom basic items (convert to plain objects to avoid duplication issues)
    const customBasicItems = game.items.filter(i => i.type == "item" && i.system.class == "");
    await this.createEmbeddedDocuments("Item", customBasicItems.map(item => item.toObject()));
  }
}
