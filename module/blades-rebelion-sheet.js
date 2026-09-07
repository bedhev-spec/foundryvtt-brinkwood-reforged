import { BladesSheet } from "./blades-sheet.js";
import {
  bindSheetSaveStatus,
  persistActorNameChange,
  queueDocumentPathUpdate,
  reportSheetInteractionFailure,
} from "./sheet-dom.js";
import {
  ASPECT_NAMES,
  adjustAspectProgress,
  adjustResupply,
  applyGoingUnderground,
  correctHeat,
  correctSedition,
  eligibleLeastProgressAspects,
  gainHeat,
  gainSedition,
  normalizeAspects,
  normalizeLocation,
  normalizeResupply,
  normalizeTyranny,
  undoAspectRank,
} from "./rebellion/rules.js";
import { getMootDecisionCatalogue } from "./rebellion/moot-catalogue.js";
import { normalizeAlly, projectRebellion } from "./rebellion/presentation.js";
import { buildRollResolution } from "./roll-resolution.js";
import { bindLinkedJournalCta, prepareLinkedJournalContext } from "./linked-journal-cta.js";
import { escapeHTML } from "./html-utils.js";
import { rebelionActorImage } from "./actor-images.js";

const asArray = value => Array.isArray(value) ? value : [];
const clone = value => foundry.utils.deepClone?.(value) ?? structuredClone(value);
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;

function sourceSystem(document) {
  return clone(document?.system?.toObject?.() ?? document?.system ?? {});
}

function stableId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `rebellion-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function serializeAspect(aspect) {
  const { noncontiguous, currentProgress, currentMaximum, value, max, catalogue, ...serialized } = aspect;
  return serialized;
}

function eligibleUndergroundActors() {
  const source = globalThis.game?.actors;
  const actors = Array.isArray(source) ? source : Array.from(source?.values?.() ?? source ?? []);
  return actors.filter(actor => ["character", "mask"].includes(actor?.type)).map(actor => ({
    id: actor.id ?? actor._id,
    name: actor.name ?? "",
    type: actor.type,
    resourceLabel: actor.type === "character" ? "Stress" : "Essence",
    resourceValue: Math.max(0, integer(actor.type === "character" ? actor.system?.stress?.value : actor.system?.essence?.value)),
    document: actor,
  })).filter(actor => actor.id);
}

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection.contents)) return collection.contents;
  if (typeof collection.values === "function") return Array.from(collection.values());
  return Array.from(collection);
}

function canViewActor(actor) {
  if (!actor || actor.documentName !== "Actor" || actor.visible === false) return false;
  if (typeof actor.testUserPermission !== "function") return true;
  return actor.testUserPermission(globalThis.game?.user, "OBSERVER");
}

async function resolveConclaveActor(uuid) {
  if (!uuid) return null;
  try {
    const actor = typeof globalThis.fromUuid === "function" ? await globalThis.fromUuid(uuid) : null;
    return canViewActor(actor) ? actor : null;
  } catch (_error) {
    return null;
  }
}

function actorUuidFromDrop(event) {
  const getData = globalThis.TextEditor?.getDragEventData
    ?? globalThis.foundry?.applications?.ux?.TextEditor?.implementation?.getDragEventData;
  const data = getData?.(event);
  if (data?.uuid) return String(data.uuid);
  const raw = event.dataTransfer?.getData("text/plain");
  if (!raw) return "";
  try { return String(JSON.parse(raw)?.uuid ?? ""); } catch (_error) { return raw.trim(); }
}

async function prepareConclaveAllies(allies) {
  const actorChoices = collectionValues(globalThis.game?.actors)
    .filter(canViewActor)
    .map(actor => ({ uuid: String(actor.uuid ?? `Actor.${actor.id ?? actor._id}`), name: String(actor.name ?? "") }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return Promise.all(allies.map(async ally => {
    const sourceActor = await resolveConclaveActor(ally.sourceUuid);
    return {
      ...ally,
      sourceActor: {
        linked: Boolean(ally.sourceUuid),
        available: Boolean(sourceActor),
        uuid: ally.sourceUuid,
        name: sourceActor?.name ?? "",
        img: sourceActor?.img ?? "",
      },
      sourceOptions: actorChoices.map(actor => ({ ...actor, selected: actor.uuid === ally.sourceUuid })),
    };
  }));
}

/** ApplicationV2 controller for the serialized public actor type `rebelion`. */
export class BladesRebelionSheet extends BladesSheet {
  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "actor", "rebelion"],
    position: { width: 900, height: 760 },
    form: { closeOnSubmit: false, submitOnChange: false },
    window: { resizable: true },
    tabGroups: { primary: "aspects" },
  };

  static PARTS = {
    sheet: { template: "systems/brinkwood-reforged/templates/rebelion-sheet.html" },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.img = rebelionActorImage(context.img);
    this._ensureValidPrimaryTab(context);
    const catalogue = await getMootDecisionCatalogue();
    const editor = foundry.applications?.ux?.TextEditor?.implementation;
    const entries = editor?.enrichHTML
      ? await Promise.all(catalogue.entries.map(async entry => ({
        ...entry,
        description: await editor.enrichHTML(entry.description, {
          async: true,
          relativeTo: this.document,
          secrets: this.document.isOwner,
        }),
      })))
      : catalogue.entries;
    this._mootCatalogue = entries;
    context.rebellion = projectRebellion(context.system, entries);
    this._openAllyEditors ??= new Set();
    context.rebellion.allies = (await prepareConclaveAllies(context.rebellion.allies))
      .map(ally => ({ ...ally, editorOpen: this._openAllyEditors.has(ally.id) }));
    context.rebellion.canGoUnderground = Boolean(globalThis.game?.user?.isGM && this.isEditable);
    context.rebellion.canCorrectRank = Boolean(globalThis.game?.user?.isGM && this.isEditable);
    context.rebellion.canCorrectTerritory = Boolean(globalThis.game?.user?.isGM && this.isEditable);
    const undergroundActors = eligibleUndergroundActors();
    context.rebellion.eligibleActors = undergroundActors;
    const leastProgressAspects = eligibleLeastProgressAspects(context.system?.aspects);
    context.rebellion.underground = {
      actorGroups: [
        { key: "characters", label: "BITD.RebellionCharacterActors", actors: undergroundActors.filter(actor => actor.type === "character") },
        { key: "masks", label: "BITD.RebellionMaskActors", actors: undergroundActors.filter(actor => actor.type === "mask") },
      ],
      criticalAspects: ASPECT_NAMES.map(name => ({ name })),
      leastProgressAspects: leastProgressAspects.map(name => ({ name, selected: leastProgressAspects.length === 1 })),
    };
    context.linkedJournal = await prepareLinkedJournalContext(this.document, { editable: this.isEditable });
    return context;
  }

  /** Keep the dashboard on a valid section when no transient tab state exists. */
  _ensureValidPrimaryTab(context) {
    const validTabs = ["aspects", "territories", "conclave"];
    if (validTabs.includes(this.tabGroups.primary)) return;

    this.tabGroups.primary = "aspects";
    context.tabs.primary = "aspects";
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this._rebelionSheetListenerController?.abort();
    this._rebelionSheetListenerController = new AbortController();
    const listenerOptions = { signal: this._rebelionSheetListenerController.signal };
    const html = this.element;
    bindSheetSaveStatus(this, html, listenerOptions);
    bindLinkedJournalCta(this, html, listenerOptions);
    this._bindSheetViewState(html, listenerOptions);

    const underground = html.querySelector(".rebelion-underground");
    if (underground) {
      if (typeof this._undergroundOpen === "boolean") {
        underground.open = this._undergroundOpen;
      } else {
        this._undergroundOpen = underground.open;
      }
      underground.addEventListener("toggle", () => {
        this._undergroundOpen = underground.open;
      }, listenerOptions);
    }

    if (!this.isEditable) return;

    html.querySelectorAll('input[name="name"]').forEach(control => {
      control.addEventListener("change", event => persistActorNameChange(this, event), listenerOptions);
      control.addEventListener("keydown", event => {
        if (event.key !== "Enter" || event.isComposing) return;
        event.preventDefault();
        event.currentTarget.blur();
      }, listenerOptions);
    });
    html.querySelectorAll("[data-rebellion-action]").forEach(control => {
      control.addEventListener("click", event => void this._dispatchAction(event), listenerOptions);
    });
    html.querySelectorAll("[data-ally-field]").forEach(control => {
      control.addEventListener("change", event => void this._updateAllyField(event), listenerOptions);
    });
    html.querySelectorAll("[data-ally-editor]").forEach(editor => {
      editor.addEventListener("toggle", () => {
        this._openAllyEditors ??= new Set();
        if (editor.open) this._openAllyEditors.add(editor.dataset.allyId);
        else this._openAllyEditors.delete(editor.dataset.allyId);
      }, listenerOptions);
    });
    html.querySelectorAll("[data-ally-source-select]").forEach(control => {
      control.addEventListener("change", event => void this._setAllyActorUuid(control.dataset.allyId, control.value), listenerOptions);
    });
    html.querySelectorAll("[data-ally-actor-drop]").forEach(control => {
      control.addEventListener("dragover", event => {
        event.preventDefault();
        control.classList.add("is-dragover");
      }, listenerOptions);
      control.addEventListener("dragleave", () => control.classList.remove("is-dragover"), listenerOptions);
      control.addEventListener("drop", event => void this._onAllyActorDrop(event), listenerOptions);
    });
    html.querySelectorAll(".sheet-identity__trackers .dot-value").forEach(control => {
      control.addEventListener("click", event => void this._onTrackerClick(event), listenerOptions);
    });
    html.querySelectorAll("[data-tyranny-input]").forEach(control => {
      control.addEventListener("change", event => void this._updateTyranny(event), listenerOptions);
    });
    html.querySelectorAll("[data-underground-workflow]").forEach(container => {
      container.querySelectorAll("[data-underground-actor], [data-underground-critical-aspect], [data-underground-least-aspect]")
        .forEach(control => control.addEventListener("change", () => this._syncGoingUnderground(container), listenerOptions));
      this._syncGoingUnderground(container);
    });
  }

  async _commit(updateFactory) {
    if (!this.isEditable) return false;
    try {
      return await queueDocumentPathUpdate(this.document, "system.rebelion", async () => {
        if (!this.isEditable) return false;
        const update = await updateFactory(sourceSystem(this.document));
        if (!update) return false;
        await this.document.update(update);
        return true;
      });
    } catch (error) {
      reportSheetInteractionFailure(error);
      return false;
    }
  }

  async _dispatchAction(event) {
    event.preventDefault();
    const control = event.currentTarget;
    const action = control.dataset.rebellionAction;
    if (action === "choose-moot") return this._chooseMoot(control, control.dataset.choice ?? "", "");
    if (action === "save-moot-answer") {
      const card = control.closest("[data-moot-card]");
      const answer = card?.querySelector?.("[data-moot-custom-answer]")?.value ?? "";
      const choice = card?.querySelector?.("[data-moot-choice]:checked")?.value ?? "";
      return this._chooseMoot(control, choice, answer);
    }
    if (action === "clear-moot-answer") return this._clearMootAnswer(control);
    if (action === "undo-aspect-rank") return this._undoAspectRank(control);
    if (action === "undo-territory-level") return this._undoTerritoryLevel(control);
    if (action === "add-ally") return this._addAlly();
    if (action === "remove-ally") return this._removeAlly(control.dataset.allyId);
    if (action === "open-ally-actor") return this._openAllyActor(control);
    if (action === "clear-ally-actor") return this._setAllyActorUuid(control.dataset.allyId, "");
    if (action === "going-underground") return this._applyGoingUnderground(control.closest("[data-underground-workflow]"));
    return false;
  }

  _updateTyranny(event) {
    const value = Math.max(0, integer(event.currentTarget.value));
    return this._commit(system => ({ "system.tyranny": { ...normalizeTyranny(system.tyranny), value } }));
  }

  async _onTrackerClick(event) {
    event.preventDefault();
    const control = event.currentTarget;
    const path = control.dataset.path;
    const selected = integer(control.dataset.value);
    const territoryLevel = /^rebellion\.location\.(towns|villages|lands)\.(\d+)\.level$/.exec(path ?? "");
    if (territoryLevel) {
      const [, collection, rawIndex] = territoryLevel;
      const index = integer(rawIndex, -1);
      const locations = asArray(sourceSystem(this.document)[collection]);
      const fallback = collection === "towns" ? 8 : collection === "villages" ? 6 : locations[index]?.sedition?.clock?.max ?? 6;
      const location = locations[index] ? normalizeLocation(locations[index], fallback) : null;
      const current = location?.sedition.level;
      const isReduction = selected < current || (selected === 1 && current === 1);
      if (isReduction) {
        return this._undoTerritoryLevel({
          dataset: { collection, index: String(index), territoryName: location.name },
        });
      }
    }
    let rankedUpAspect = "";
    const saved = await this._commit(system => {
      if (path === "system.heat.value") {
        const heat = correctHeat(system.heat, system.heat?.value ?? 0);
        if (selected > heat.value || (selected === heat.max && heat.value === heat.max)) {
          const delta = selected > heat.value ? selected - heat.value : 1;
          const gained = gainHeat({ heat, tyranny: system.tyranny }, delta);
          return { "system.heat": gained.heat, "system.tyranny": gained.tyranny };
        }
        if (selected < heat.value || (selected === 1 && heat.value === 1)) {
          return { "system.heat": correctHeat(heat, selected === 1 && heat.value === 1 ? 0 : selected) };
        }
        return null;
      }
      // Kept as a controller compatibility path for macros/tests created when
      // Tyranny used teeth; the sheet now uses its numeric field instead.
      if (path === "system.tyranny.value") {
        return { "system.tyranny": { ...normalizeTyranny(system.tyranny), value: Math.max(0, selected) } };
      }
      if (path === "system.resupply.value") {
        const current = normalizeResupply(system.resupply, system.aspects);
        if (selected > current.value) {
          return { "system.resupply": adjustResupply(current, system.aspects, selected - current.value) };
        }
        if (selected < current.value || (selected === 1 && current.value === 1)) {
          return { "system.resupply": { ...current, value: selected === 1 && current.value === 1 ? 0 : selected } };
        }
        return null;
      }
      if (path?.startsWith("rebellion.aspect.")) {
        const aspectName = path.slice("rebellion.aspect.".length);
        const aspects = normalizeAspects(system.aspects);
        const aspect = aspects.find(candidate => candidate.name === aspectName);
        if (!aspect || aspect.rank >= 3) return null;
        const current = aspect.progress[aspect.rank];
        if (selected > current) {
          const result = adjustAspectProgress(aspects, aspectName, selected - current);
          rankedUpAspect = result.rankedUp ? aspectName : "";
          return result.changed ? { "system.aspects": result.aspects } : null;
        }
        if (selected >= current && !(selected === 1 && current === 1)) return null;
        aspect.progress[aspect.rank] = selected === 1 && current === 1 ? 0 : selected;
        return { "system.aspects": aspects.map(serializeAspect) };
      }
      if (path?.startsWith("rebellion.location.")) {
        const [, , collection, indexText, field] = path.split(".");
        const index = integer(indexText, -1);
        const locations = asArray(system[collection]).map(location => clone(location));
        if (!locations[index] || !["clock", "level"].includes(field)) return null;
        const fallback = collection === "towns" ? 8 : collection === "villages" ? 6 : locations[index]?.sedition?.clock?.max ?? 6;
        const location = normalizeLocation(locations[index], fallback);
        const current = field === "clock" ? location.sedition.clock.value : location.sedition.level;
        if (field === "clock" && selected > current) {
          locations[index] = gainSedition(location, selected - current, fallback).location;
        } else if (selected < current || (selected === 1 && current === 1) || (field === "level" && selected !== current)) {
          const value = selected === 1 && current === 1 ? 0 : selected;
          locations[index] = correctSedition(location, field, value, fallback);
        } else return null;
        return { [`system.${collection}`]: locations };
      }
      return null;
    });
    if (saved && rankedUpAspect) {
      globalThis.ui?.notifications?.info?.(`${rankedUpAspect} ranked up. Record a Moot decision when ready.`);
    }
    return saved;
  }

  _chooseMoot(control, choice, customAnswer) {
    const catalogueId = control.dataset.catalogueId;
    const entry = this._mootCatalogue?.find(candidate => candidate.id === catalogueId);
    if (!entry || (!choice && !String(customAnswer).trim())) return Promise.resolve(false);
    return this._commit(system => {
      const aspects = normalizeAspects(system.aspects);
      const aspect = aspects.find(candidate => candidate.name === entry.aspect);
      if (!aspect || aspect.rank < entry.rank) return null;
      const old = aspect.decisions.find(decision => decision.catalogueId === entry.id
        || decision.sourceUuid === entry.sourceUuid
        || decision.title === entry.title);
      const snapshot = {
        id: old?.id ?? stableId(),
        catalogueId: entry.id,
        title: entry.title,
        sourceUuid: entry.sourceUuid,
        aspect: entry.aspect,
        rank: entry.rank,
        selectedChoice: String(choice),
        customAnswer: String(customAnswer).trim(),
        description: entry.description,
      };
      const existing = aspect.decisions.indexOf(old);
      if (existing >= 0) aspect.decisions[existing] = { ...old, ...snapshot };
      else aspect.decisions.push(snapshot);
      return { "system.aspects": aspects.map(serializeAspect) };
    });
  }

  _canCorrectMootHistory() {
    const allowed = Boolean(globalThis.game?.user?.isGM && this.isEditable);
    if (!allowed) {
      globalThis.ui?.notifications?.warn?.(
        globalThis.game?.i18n?.localize?.("BITD.RebellionCorrectionGMOnly")
          ?? "Only a GM can correct Moot history.",
      );
    }
    return allowed;
  }

  async _confirmCorrection(titleKey, messageKey, data = {}) {
    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (!DialogV2?.confirm) {
      globalThis.ui?.notifications?.error?.(
        globalThis.game?.i18n?.localize?.("BITD.RebellionCorrectionUnavailable")
          ?? "Confirmation is unavailable; no change was made.",
      );
      return false;
    }
    const localize = key => globalThis.game?.i18n?.localize?.(key) ?? key;
    const format = (key, values) => globalThis.game?.i18n?.format?.(key, values) ?? localize(key);
    try {
      return Boolean(await DialogV2.confirm({
        window: { title: localize(titleKey) },
        content: `<p>${escapeHTML(format(messageKey, data))}</p>`,
      }));
    } catch (error) {
      reportSheetInteractionFailure(error, "BITD.RebellionCorrectionFailed");
      return false;
    }
  }

  async _clearMootAnswer(control) {
    if (!this._canCorrectMootHistory()) return false;
    const aspectName = String(control?.dataset?.aspectName ?? "");
    const decisionId = String(control?.dataset?.decisionId ?? "");
    const catalogueId = String(control?.dataset?.catalogueId ?? "");
    const decisionTitle = String(control?.dataset?.decisionTitle ?? "Moot");
    const matchesDecision = decision => decisionId
      ? decision.id === decisionId
      : Boolean(catalogueId && decision.catalogueId === catalogueId);
    const currentAspect = normalizeAspects(sourceSystem(this.document).aspects)
      .find(aspect => aspect.name === aspectName);
    const currentDecision = currentAspect?.decisions.find(matchesDecision);
    if (!currentDecision) return false;

    const confirmed = await this._confirmCorrection(
      "BITD.RebellionClearAnswer",
      "BITD.RebellionClearAnswerConfirm",
      { title: decisionTitle, aspect: aspectName },
    );
    if (!confirmed) return false;

    let removed = false;
    const saved = await this._commit(system => {
      const aspects = normalizeAspects(system.aspects);
      const aspect = aspects.find(candidate => candidate.name === aspectName);
      if (!aspect) return null;
      const before = aspect.decisions.length;
      aspect.decisions = aspect.decisions.filter(decision => !matchesDecision(decision));
      removed = aspect.decisions.length < before;
      return removed ? { "system.aspects": aspects.map(serializeAspect) } : null;
    });
    if (saved && removed) {
      globalThis.ui?.notifications?.info?.(
        globalThis.game?.i18n?.format?.("BITD.RebellionClearAnswerSuccess", { title: decisionTitle })
          ?? `${decisionTitle} answer cleared.`,
      );
    }
    return Boolean(saved && removed);
  }

  async _undoAspectRank(control) {
    if (!this._canCorrectMootHistory()) return false;
    const aspectName = String(control?.dataset?.aspectName ?? "");
    const current = normalizeAspects(sourceSystem(this.document).aspects)
      .find(aspect => aspect.name === aspectName);
    if (!current || current.rank <= 0) return false;
    const targetRank = current.rank - 1;
    const confirmed = await this._confirmCorrection(
      "BITD.RebellionUndoLastRank",
      "BITD.RebellionUndoLastRankConfirm",
      { aspect: aspectName, rank: targetRank },
    );
    if (!confirmed) return false;

    let changed = false;
    const saved = await this._commit(system => {
      const result = undoAspectRank(system.aspects, aspectName);
      changed = result.changed;
      return result.changed ? { "system.aspects": result.aspects } : null;
    });
    if (saved && changed) {
      globalThis.ui?.notifications?.info?.(
        globalThis.game?.i18n?.format?.("BITD.RebellionUndoLastRankSuccess", { aspect: aspectName, rank: targetRank })
          ?? `${aspectName} returned to Rank ${targetRank}.`,
      );
    }
    return Boolean(saved && changed);
  }

  async _undoTerritoryLevel(control) {
    if (!this._canCorrectTerritoryHistory()) return false;
    const collection = String(control?.dataset?.collection ?? "");
    const index = integer(control?.dataset?.index, -1);
    const territoryName = String(control?.dataset?.territoryName ?? "");
    if (!["towns", "villages", "lands"].includes(collection) || index < 0) return false;

    const source = sourceSystem(this.document);
    const locations = asArray(source[collection]);
    const fallback = collection === "towns" ? 8 : collection === "villages" ? 6 : locations[index]?.sedition?.clock?.max ?? 6;
    const current = locations[index] ? normalizeLocation(locations[index], fallback) : null;
    if (!current || current.sedition.level <= 0) return false;
    const targetLevel = current.sedition.level - 1;

    const confirmed = await this._confirmCorrection(
      "BITD.RebellionUndoTerritoryLevel",
      "BITD.RebellionUndoTerritoryLevelConfirm",
      { territory: territoryName || current.name, level: targetLevel },
    );
    if (!confirmed) return false;

    let changed = false;
    const saved = await this._commit(system => {
      const nextLocations = asArray(system[collection]).map(location => clone(location));
      if (!nextLocations[index]) return null;
      const normalized = normalizeLocation(nextLocations[index], fallback);
      if (normalized.sedition.level <= 0) return null;
      nextLocations[index] = correctSedition(normalized, "level", normalized.sedition.level - 1, fallback);
      changed = true;
      return { [`system.${collection}`]: nextLocations };
    });
    if (saved && changed) {
      globalThis.ui?.notifications?.info?.(
        globalThis.game?.i18n?.format?.("BITD.RebellionUndoTerritoryLevelSuccess", {
          territory: territoryName || current.name,
          level: targetLevel,
        }) ?? `${territoryName || current.name} returned to Level ${targetLevel}.`,
      );
    }
    return Boolean(saved && changed);
  }

  _canCorrectTerritoryHistory() {
    const allowed = Boolean(globalThis.game?.user?.isGM && this.isEditable);
    if (!allowed) {
      globalThis.ui?.notifications?.warn?.(
        globalThis.game?.i18n?.localize?.("BITD.RebellionTerritoryCorrectionGMOnly")
        ?? "Only a GM can correct territory levels.",
      );
    }
    return allowed;
  }

  _addAlly() {
    return this._commit(system => ({
      "system.conclave": [...asArray(system.conclave).map(normalizeAlly), normalizeAlly({ id: stableId() })],
    }));
  }

  _removeAlly(id) {
    return this._commit(system => ({
      "system.conclave": asArray(system.conclave).map(normalizeAlly).filter(ally => ally.id !== id),
    }));
  }

  _updateAllyField(event) {
    const control = event.currentTarget;
    const id = control.dataset.allyId;
    const field = control.dataset.allyField;
    const value = control.value;
    return this._commit(system => {
      const allies = asArray(system.conclave).map(normalizeAlly);
      const ally = allies.find(candidate => candidate.id === id);
      if (!ally || !["name", "strengths", "sourceUuid", "originAspect", "originRank"].includes(field)) return null;
      ally[field] = field === "strengths"
        ? String(value).split(",").map(item => item.trim()).filter(Boolean)
        : field === "originRank" ? Math.min(3, Math.max(0, integer(value))) : String(value);
      return { "system.conclave": allies };
    });
  }

  async _setAllyActorUuid(id, uuid) {
    this._openAllyEditors ??= new Set();
    this._openAllyEditors.add(id);
    const value = String(uuid ?? "");
    if (value && !await resolveConclaveActor(value)) {
      globalThis.ui?.notifications?.warn?.(
        globalThis.game?.i18n?.localize?.("BITD.RebellionActorUnavailable") ?? "Actor unavailable.",
      );
      return false;
    }
    return this._commit(system => {
      const allies = asArray(system.conclave).map(normalizeAlly);
      const ally = allies.find(candidate => candidate.id === id);
      if (!ally || ally.sourceUuid === value) return null;
      ally.sourceUuid = value;
      return { "system.conclave": allies };
    });
  }

  async _onAllyActorDrop(event) {
    event.preventDefault();
    const target = event.currentTarget;
    target.classList?.remove("is-dragover");
    const uuid = actorUuidFromDrop(event);
    if (!uuid) {
      globalThis.ui?.notifications?.warn?.(
        globalThis.game?.i18n?.localize?.("BITD.RebellionActorUnavailable") ?? "Actor unavailable.",
      );
      return false;
    }
    return this._setAllyActorUuid(target.dataset.allyId, uuid);
  }

  async _openAllyActor(control) {
    const actor = await resolveConclaveActor(control?.dataset?.actorUuid);
    if (!actor?.sheet?.render) {
      globalThis.ui?.notifications?.warn?.(
        globalThis.game?.i18n?.localize?.("BITD.RebellionActorUnavailable") ?? "Actor unavailable.",
      );
      return false;
    }
    await actor.sheet.render({ force: true });
    return true;
  }

  _readGoingUndergroundSelection(container) {
    const selectedIds = [...(container?.querySelectorAll?.("[data-underground-actor]:checked") ?? [])]
      .map(control => String(control.value)).filter(Boolean);
    const actors = eligibleUndergroundActors()
      .filter(actor => selectedIds.includes(String(actor.id)) && typeof actor.document?.update === "function");
    const criticalAspect = String(container?.querySelector?.("[data-underground-critical-aspect]")?.value ?? "");
    const leastAspect = String(container?.querySelector?.("[data-underground-least-aspect]")?.value ?? "");
    const leastEligible = eligibleLeastProgressAspects(sourceSystem(this.document).aspects);
    return {
      actors,
      criticalAspect,
      leastAspect,
      valid: actors.length > 0 && ASPECT_NAMES.includes(criticalAspect) && leastEligible.includes(leastAspect),
    };
  }

  _goingUndergroundMutationLines(selection, system = sourceSystem(this.document)) {
    const i18n = globalThis.game?.i18n;
    const format = (key, data, fallback) => i18n?.format?.(key, data) ?? fallback;
    const tyranny = normalizeTyranny(system.tyranny);
    const heat = correctHeat(system.heat, system.heat?.value ?? 0);
    const aspects = normalizeAspects(system.aspects);
    const least = aspects.find(aspect => aspect.name === selection.leastAspect);
    return [
      format("BITD.RebellionUndergroundMutationTyranny", { from: tyranny.value, to: Math.max(0, tyranny.value - 1) }, `Tyranny: ${tyranny.value} → ${Math.max(0, tyranny.value - 1)}`),
      format("BITD.RebellionUndergroundMutationHeat", { from: heat.value }, `Heat: ${heat.value} → 0`),
      ...selection.actors.map(actor => format(
        "BITD.RebellionUndergroundMutationActor",
        { name: actor.name, resource: actor.resourceLabel, from: actor.resourceValue },
        `${actor.name}: ${actor.resourceLabel} ${actor.resourceValue} → 0`,
      )),
      format("BITD.RebellionUndergroundMutationCritical", { aspect: selection.criticalAspect }, `Critical: ${selection.criticalAspect} +2 progress`),
      format("BITD.RebellionUndergroundMutationSix", {}, "6: no additional change"),
      format("BITD.RebellionUndergroundMutationMixed", {}, "4–5: Resupply +2"),
      format("BITD.RebellionUndergroundMutationSetback", { aspect: selection.leastAspect, from: least?.currentProgress ?? 0 }, `1–3: ${selection.leastAspect} progress ${least?.currentProgress ?? 0} → 0`),
    ];
  }

  _syncGoingUnderground(container) {
    if (!container) return;
    const selection = this._readGoingUndergroundSelection(container);
    const action = container.querySelector?.('[data-rebellion-action="going-underground"]');
    const preview = container.querySelector?.("[data-underground-preview]");
    const pending = Boolean(this._goingUndergroundPending);
    if (action) {
      action.disabled = pending || !selection.valid;
      action.setAttribute("aria-disabled", String(action.disabled));
    }
    container.setAttribute?.("aria-busy", String(pending));
    if (preview) {
      preview.textContent = selection.valid
        ? this._goingUndergroundMutationLines(selection).join("\n")
        : globalThis.game?.i18n?.localize?.("BITD.RebellionUndergroundIncomplete")
          ?? "Select actors and both outcome Aspects to preview the exact changes.";
    }
  }

  async _applyGoingUnderground(container) {
    if (!globalThis.game?.user?.isGM || !this.isEditable) {
      globalThis.ui?.notifications?.warn?.(globalThis.game?.i18n?.localize?.("BITD.RebellionGMOnly") ?? "Only a GM can send the rebellion underground.");
      return false;
    }
    if (this._goingUndergroundPending) return false;
    const selection = this._readGoingUndergroundSelection(container);
    if (!selection.valid) {
      globalThis.ui?.notifications?.warn?.(globalThis.game?.i18n?.localize?.("BITD.RebellionUndergroundIncomplete") ?? "Select actors and both outcome Aspects before rolling.");
      this._syncGoingUnderground(container);
      return false;
    }

    this._goingUndergroundPending = true;
    this._syncGoingUnderground(container);
    try {
      const systemSnapshot = sourceSystem(this.document);
      const organization = normalizeAspects(systemSnapshot.aspects).find(aspect => aspect.name === "Organization");
      const dice = organization?.rank ?? 0;
      const actorNames = selection.actors.map(actor => actor.name).join(", ");
      const lines = this._goingUndergroundMutationLines(selection, systemSnapshot);
      const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
      if (!DialogV2?.confirm) throw new Error("Going Underground confirmation is unavailable.");
      const title = globalThis.game?.i18n?.localize?.("BITD.RebellionGoingUnderground") ?? "Going Underground";
      const heading = globalThis.game?.i18n?.format?.("BITD.RebellionUndergroundConfirm", { dice, actors: actorNames })
        ?? `Roll ${dice}d for Going Underground and reset ${actorNames}?`;
      const confirmed = await DialogV2.confirm({
        window: { title },
        content: `<p>${escapeHTML(heading)}</p><ul>${lines.map(line => `<li>${escapeHTML(line)}</li>`).join("")}</ul>`,
      });
      if (!confirmed) return false;

      const calculation = buildRollResolution({ baseDice: dice });
      const roll = new globalThis.foundry.dice.Roll(`${calculation.rolledDice}d6`, {});
      await roll.evaluate();
      await roll.toMessage({ flavor: title });
      const values = roll.dice?.[0]?.results?.map(entry => Number(entry.result)).filter(Number.isFinite) ?? [];
      if (!values.length) throw new Error("Going Underground roll produced no dice results.");
      const highest = calculation.zeroMode ? Math.min(...values) : Math.max(...values);
      const result = !calculation.zeroMode && values.filter(value => value === 6).length >= 2
        ? "critical" : highest >= 6 ? "6" : highest >= 4 ? "4-5" : "1-3";
      const aspectName = result === "critical" ? selection.criticalAspect : result === "1-3" ? selection.leastAspect : "";
      const committed = await this._commit(system => {
        const outcome = applyGoingUnderground(system, { result, aspectName });
        if (!outcome.changed || outcome.requiresChoice?.length) return null;
        return {
          "system.tyranny": outcome.system.tyranny,
          "system.heat": outcome.system.heat,
          "system.aspects": outcome.system.aspects,
          "system.resupply": outcome.system.resupply,
        };
      });
      if (!committed) return false;

      const resets = await Promise.allSettled(selection.actors.map(({ document, type }) => document.update(
        type === "character" ? { "system.stress.value": 0 } : { "system.essence.value": 0 },
      )));
      const failedNames = resets.flatMap((entry, index) => entry.status === "rejected" ? [selection.actors[index].name] : []);
      if (failedNames.length) {
        globalThis.ui?.notifications?.warn?.(
          globalThis.game?.i18n?.format?.("BITD.RebellionUndergroundPartialReset", {
            result,
            count: selection.actors.length - failedNames.length,
            failed: failedNames.join(", "),
          }) ?? `Going Underground: ${result}. Rebellion updated, but these actor resets failed: ${failedNames.join(", ")}.`,
        );
        return false;
      }
      globalThis.ui?.notifications?.info?.(
        globalThis.game?.i18n?.format?.("BITD.RebellionUndergroundResult", { result, count: selection.actors.length, failed: 0 })
          ?? `Going Underground: ${result}; Rebellion updated and ${selection.actors.length} actors reset.`,
      );
      return true;
    } catch (error) {
      reportSheetInteractionFailure(error, "BITD.RebellionUndergroundFailed");
      return false;
    } finally {
      this._goingUndergroundPending = false;
      this._syncGoingUnderground(container);
    }
  }

  async _onClose(options) {
    this._rebelionSheetListenerController?.abort();
    return super._onClose(options);
  }
}
