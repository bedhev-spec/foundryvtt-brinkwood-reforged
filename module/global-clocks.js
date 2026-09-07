/*
 * Clock-overlay behavior adapted from Global Progress Clocks by
 * Carlos Fernandez (Supe), copyright 2023, under the MIT License.
 * See THIRD_PARTY_NOTICES.md. This adaptation intentionally excludes the
 * upstream point-counter and horizontal-tracker systems.
 */

import {
  GLOBAL_CLOCK_MAX_SIZE,
  normalizeGlobalClockLocation,
  GLOBAL_CLOCK_SIZES,
  nextGlobalClockValue,
  normalizeGlobalClock,
  previousGlobalClockValue,
} from "./global-clock-utils.js";
import { escapeHTML } from "./html-utils.js";

const SYSTEM_ID = "brinkwood-reforged";
const SETTING_KEYS = Object.freeze({
  clocks: "globalClocks",
  location: "globalClockLocation",
  offset: "globalClockOffset",
});

export async function confirmAndDeleteGlobalClock(clock, confirm, deleteClock) {
  if (!clock || !await confirm(clock)) return false;
  return deleteClock(clock.id);
}

export function globalClockHudContainer(browserDocument) {
  return browserDocument.querySelector("#ui-right-column-1")
    ?? browserDocument.querySelector("#ui-right");
}

function visibleRect(element) {
  const rect = element?.getBoundingClientRect?.();
  if (!rect || rect.width <= 0 || rect.height <= 0 || element.hidden) return null;
  const style = element.ownerDocument?.defaultView?.getComputedStyle?.(element);
  if (style && (style.display === "none" || style.visibility === "hidden")) return null;
  return rect;
}

export function globalClockRightInset(browserDocument) {
  const viewportWidth = browserDocument.documentElement?.clientWidth ?? browserDocument.defaultView?.innerWidth;
  if (!Number.isFinite(viewportWidth)) return 0;
  const hudRect = visibleRect(globalClockHudContainer(browserDocument));
  const baseInset = Math.max(0, viewportWidth - (hudRect?.right ?? viewportWidth));
  return [browserDocument.querySelector("#sidebar"), browserDocument.querySelector("#sidebar-content")]
    .reduce((inset, panel) => {
      const rect = visibleRect(panel);
      if (!rect || rect.right < viewportWidth * 0.75) return inset;
      return Math.max(inset, Math.max(0, viewportWidth - rect.left));
    }, baseInset);
}

export function globalClockBottomInset(browserDocument, gap = 8) {
  const viewportHeight = browserDocument.documentElement?.clientHeight ?? browserDocument.defaultView?.innerHeight;
  if (!Number.isFinite(viewportHeight)) return 14;
  const message = browserDocument.querySelector("#chat-message");
  const chat = browserDocument.querySelector("#chat-form") ?? message?.closest?.("form") ?? message;
  const rect = visibleRect(chat);
  return rect ? Math.max(14, viewportHeight - rect.top + gap) : 14;
}

export function placeGlobalClockOverlay(element, location, browserDocument = document) {
  if (!element) return false;
  const normalizedLocation = normalizeGlobalClockLocation(location);
  const column = globalClockHudContainer(browserDocument);
  if (!column) return false;
  const locationChanged = element.dataset.location !== normalizedLocation;
  const rightInset = `${globalClockRightInset(browserDocument)}px`;
  const bottomInset = `${globalClockBottomInset(browserDocument)}px`;
  if (element.style?.getPropertyValue?.("--global-clock-right-inset") !== rightInset) {
    element.style?.setProperty("--global-clock-right-inset", rightInset);
  }
  if (element.style?.getPropertyValue?.("--global-clock-bottom-inset") !== bottomInset) {
    element.style?.setProperty("--global-clock-bottom-inset", bottomInset);
  }
  element.dataset.location = normalizedLocation;
  const display = element.querySelector?.(".global-clock-display");
  display?.classList.toggle("top", normalizedLocation === "topRight");
  display?.classList.toggle("bottom", normalizedLocation === "bottomRight");
  if (!column.contains?.(element) || locationChanged) {
    if (normalizedLocation === "topRight") column.prepend(element);
    else column.append(element);
  }
  return true;
}

export class GlobalClockStore extends Collection {
  #mutationQueue = Promise.resolve();

  #enqueue(operation) {
    const mutation = this.#mutationQueue.then(operation);
    this.#mutationQueue = mutation.catch(() => {});
    return mutation;
  }

  refresh() {
    this.#replace(game.settings.get(SYSTEM_ID, SETTING_KEYS.clocks) ?? {});
    game.brinkwood?.clockOverlay?.refresh();
  }

  #replace(clocks) {
    this.clear();
    for (const data of Object.values(clocks)) {
      const clock = normalizeGlobalClock(data);
      if (clock.id && clock.name) this.set(clock.id, clock);
    }
  }

  async #commit(clocks) {
    await game.settings.set(SYSTEM_ID, SETTING_KEYS.clocks, clocks);
    this.#replace(clocks);
    game.brinkwood?.clockOverlay?.refresh();
    return true;
  }

  create(data) {
    if (!game.user.isGM) return false;
    const clock = normalizeGlobalClock({ ...data, id: foundry.utils.randomID() });
    if (!clock.name) return false;
    return this.#enqueue(async () => {
      const clocks = foundry.utils.deepClone(game.settings.get(SYSTEM_ID, SETTING_KEYS.clocks) ?? {});
      clocks[clock.id] = clock;
      return this.#commit(clocks);
    });
  }

  update(id, changes) {
    if (!game.user.isGM) return false;
    return this.#enqueue(async () => {
      const clocks = foundry.utils.deepClone(game.settings.get(SYSTEM_ID, SETTING_KEYS.clocks) ?? {});
      if (!clocks[id]) return false;
      const clock = normalizeGlobalClock({ ...clocks[id], ...changes, id });
      clocks[id] = clock;
      return this.#commit(clocks);
    });
  }

  step(id, direction) {
    if (!game.user.isGM) return false;
    return this.#enqueue(async () => {
      const clocks = foundry.utils.deepClone(game.settings.get(SYSTEM_ID, SETTING_KEYS.clocks) ?? {});
      if (!clocks[id]) return false;
      const clock = normalizeGlobalClock(clocks[id]);
      clock.value = direction < 0
        ? previousGlobalClockValue(clock.value, clock.max)
        : nextGlobalClockValue(clock.value, clock.max);
      clocks[id] = clock;
      return this.#commit(clocks);
    });
  }

  togglePrivate(id) {
    if (!game.user.isGM) return false;
    return this.#enqueue(async () => {
      const clocks = foundry.utils.deepClone(game.settings.get(SYSTEM_ID, SETTING_KEYS.clocks) ?? {});
      if (!clocks[id]) return false;
      const clock = normalizeGlobalClock(clocks[id]);
      clock.private = !clock.private;
      clocks[id] = clock;
      return this.#commit(clocks);
    });
  }

  delete(id) {
    if (!game.user.isGM) return false;
    return this.#enqueue(async () => {
      const clocks = foundry.utils.deepClone(game.settings.get(SYSTEM_ID, SETTING_KEYS.clocks) ?? {});
      if (!clocks[id]) return false;
      delete clocks[id];
      await game.settings.set(SYSTEM_ID, SETTING_KEYS.clocks, clocks);
      super.delete(id);
      game.brinkwood?.clockOverlay?.refresh();
      return true;
    });
  }
}

const ApplicationV2 = foundry.applications.api.ApplicationV2;
const HandlebarsApplicationMixin = foundry.applications.api.HandlebarsApplicationMixin;

class GlobalClockDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "brinkwood-global-clock-dialog",
    classes: ["brinkwood-global-clock-dialog", "standard-form"],
    tag: "form",
    position: { width: 420, height: "auto" },
    window: { icon: "fa-solid fa-clock", title: "BITD.GlobalClock.DialogCreate" },
    actions: { cancel: GlobalClockDialog.#onCancel },
    form: { handler: GlobalClockDialog.#onSubmit, closeOnSubmit: false },
  };

  static PARTS = {
    main: { template: "systems/brinkwood-reforged/templates/overlay/global-clock-dialog.html", root: true },
  };

  constructor({ clock = null, onSubmit } = {}) {
    super();
    this.clock = clock;
    this.onSubmit = onSubmit;
  }

  get title() {
    return game.i18n.localize(this.clock ? "BITD.GlobalClock.DialogEdit" : "BITD.GlobalClock.DialogCreate");
  }

  async _prepareContext(options) {
    const clock = normalizeGlobalClock(this.clock ?? {});
    return {
      ...(await super._prepareContext(options)),
      clock,
      editing: Boolean(this.clock),
      sizes: Object.fromEntries(GLOBAL_CLOCK_SIZES.map(size => [size, size])),
      maxSize: GLOBAL_CLOCK_MAX_SIZE,
      defaultSize: clock.max,
    };
  }

  static #onCancel(_event, _target) {
    return this.close();
  }

  static async #onSubmit(_event, _form, formData) {
    const data = normalizeGlobalClock(formData.object);
    if (!data.name) {
      ui.notifications.warn("BITD.GlobalClock.NameRequired", { localize: true });
      return;
    }
    if (await this.onSubmit?.(data) === true) return this.close();
    return false;
  }
}

class GlobalClockOverlay extends HandlebarsApplicationMixin(ApplicationV2) {
  #clockListenerController;
  #positionObserver;
  #positionMutationObserver;
  #positionController;
  #placementFrame;

  static DEFAULT_OPTIONS = {
    id: "brinkwood-global-clock-overlay",
    classes: ["brinkwood-global-clocks"],
    window: { frame: false, positioned: false },
    actions: {
      addClock: GlobalClockOverlay.#onAddClock,
      toggleVisibility: GlobalClockOverlay.#onToggleVisibility,
      editClock: GlobalClockOverlay.#onEditClock,
      deleteClock: GlobalClockOverlay.#onDeleteClock,
    },
  };

  static PARTS = {
    main: {
      template: "systems/brinkwood-reforged/templates/overlay/global-clocks.html",
      scrollable: [".global-clock-list"],
    },
  };

  constructor(store) {
    super();
    this.store = store;
    this.refresh = foundry.utils.debounce(() => this.render({ force: true }), 100);
  }

  setLocation(location) {
    if (this.rendered) placeGlobalClockOverlay(this.element, location);
    this.refresh();
  }

  #schedulePlacement = () => {
    if (this.#placementFrame) return;
    const schedule = document.defaultView?.requestAnimationFrame ?? globalThis.requestAnimationFrame;
    const place = () => {
      this.#placementFrame = undefined;
      if (this.rendered) placeGlobalClockOverlay(this.element, this.element.dataset.location);
    };
    this.#placementFrame = schedule ? schedule(place) : setTimeout(place, 0);
  };

  #watchPosition() {
    this.#positionObserver?.disconnect();
    this.#positionMutationObserver?.disconnect();
    this.#positionController?.abort();
    this.#positionController = new AbortController();
    const signal = this.#positionController.signal;
    document.defaultView?.addEventListener("resize", this.#schedulePlacement, { signal });

    const observedPanels = [
      globalClockHudContainer(document),
      document.querySelector("#ui-right"),
      document.querySelector("#sidebar"),
      document.querySelector("#sidebar-content"),
      document.querySelector("#chat-form"),
      document.querySelector("#chat-message"),
    ].filter(Boolean);
    if (typeof ResizeObserver !== "undefined") {
      this.#positionObserver = new ResizeObserver(this.#schedulePlacement);
      observedPanels.forEach(panel => this.#positionObserver.observe(panel));
    }
    if (typeof MutationObserver !== "undefined") {
      this.#positionMutationObserver = new MutationObserver(this.#schedulePlacement);
      observedPanels.forEach(panel => this.#positionMutationObserver.observe(panel, {
        attributes: true,
        attributeFilter: ["class", "style", "hidden"],
      }));
    }
  }

  async _prepareContext(options) {
    const location = normalizeGlobalClockLocation(game.settings.get(SYSTEM_ID, SETTING_KEYS.location));
    return {
      ...(await super._prepareContext(options)),
      editable: game.user.isGM,
      location,
      horizontalEdge: "right",
      verticalEdge: location === "topRight" ? "top" : "bottom",
      verticalOffset: `${game.settings.get(SYSTEM_ID, SETTING_KEYS.offset)}px`,
      clocks: this.store.contents
        .filter(clock => game.user.isGM || !clock.private)
        .map(clock => ({ ...clock, spokes: Array.from({ length: clock.max }, (_, index) => index) })),
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#clockListenerController?.abort();
    this.#clockListenerController = new AbortController();
    const listenerOptions = { signal: this.#clockListenerController.signal };
    const html = this.element;
    if (!placeGlobalClockOverlay(html, context.location)) return;
    this.#watchPosition();

    if (!game.user.isGM) return;
    html.querySelectorAll(".global-clock__face[data-clock-id]").forEach(face => {
      face.addEventListener("click", event => {
        void this.#runStoreMutation(this.store.step(event.currentTarget.dataset.clockId, 1));
      }, listenerOptions);
      face.addEventListener("contextmenu", event => {
        event.preventDefault();
        void this.#runStoreMutation(this.store.step(event.currentTarget.dataset.clockId, -1));
      }, listenerOptions);
    });
  }

  _onClose(options) {
    this.#clockListenerController?.abort();
    this.#positionObserver?.disconnect();
    this.#positionMutationObserver?.disconnect();
    this.#positionController?.abort();
    if (this.#placementFrame) {
      const cancel = document.defaultView?.cancelAnimationFrame ?? globalThis.cancelAnimationFrame;
      if (cancel) cancel(this.#placementFrame);
      else clearTimeout(this.#placementFrame);
    }
    this.#positionObserver = undefined;
    this.#positionMutationObserver = undefined;
    this.#positionController = undefined;
    this.#placementFrame = undefined;
    return super._onClose(options);
  }

  async #runStoreMutation(mutation) {
    try {
      return await mutation;
    } catch (error) {
      console.error("Brinkwood global clock update failed", error);
      globalThis.ui?.notifications?.warn?.("BITD.SaveFailed", { localize: true });
      return false;
    }
  }

  static #onAddClock() {
    new GlobalClockDialog({ onSubmit: data => this.#runStoreMutation(this.store.create(data)) }).render({ force: true });
  }

  static #onEditClock(_event, target) {
    const clock = this.store.get(target.closest("[data-clock-id]")?.dataset.clockId);
    if (!clock) return;
    new GlobalClockDialog({
      clock,
      onSubmit: data => this.#runStoreMutation(this.store.update(clock.id, data)),
    }).render({ force: true });
  }

  static #onToggleVisibility(_event, target) {
    const clock = this.store.get(target.closest("[data-clock-id]")?.dataset.clockId);
    if (clock) void this.#runStoreMutation(this.store.togglePrivate(clock.id));
  }

  static async #onDeleteClock(_event, target) {
    const clock = this.store.get(target.closest("[data-clock-id]")?.dataset.clockId);
    if (!clock) return;
    await this.#runStoreMutation(confirmAndDeleteGlobalClock(
      clock,
      () => foundry.applications.api.DialogV2.confirm({
        window: { title: "BITD.GlobalClock.DeleteTitle" },
        content: `<p>${game.i18n.format("BITD.GlobalClock.DeleteMessage", { name: escapeHTML(clock.name) })}</p>`,
        modal: true,
      }),
      id => this.store.delete(id),
    ));
  }
}

export function registerGlobalClockSystem() {
  const refreshOverlay = () => game.brinkwood?.clockOverlay?.refresh();
  const moveOverlay = location => game.brinkwood?.clockOverlay?.setLocation(location);
  game.settings.register(SYSTEM_ID, SETTING_KEYS.clocks, {
    name: "Global Clocks",
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: () => game.brinkwood?.clocks?.refresh(),
  });
  game.settings.register(SYSTEM_ID, SETTING_KEYS.location, {
    name: "BITD.GlobalClock.LocationName",
    hint: "BITD.GlobalClock.LocationHint",
    scope: "user",
    config: true,
    type: String,
    choices: {
      topRight: "BITD.GlobalClock.LocationTopRight",
      bottomRight: "BITD.GlobalClock.LocationBottomRight",
    },
    default: "topRight",
    onChange: moveOverlay,
  });
  game.settings.register(SYSTEM_ID, SETTING_KEYS.offset, {
    name: "BITD.GlobalClock.OffsetName",
    hint: "BITD.GlobalClock.OffsetHint",
    scope: "user",
    config: true,
    type: Number,
    default: 0,
    onChange: refreshOverlay,
  });

  game.brinkwood ??= {};
  game.brinkwood.clocks = new GlobalClockStore();
  game.brinkwood.clockOverlay = new GlobalClockOverlay(game.brinkwood.clocks);
  Hooks.on("canvasReady", () => game.brinkwood.clockOverlay.render({ force: true }));
}

export function startGlobalClockSystem() {
  game.brinkwood.clocks.refresh();
  return game.brinkwood.clockOverlay.render({ force: true });
}
