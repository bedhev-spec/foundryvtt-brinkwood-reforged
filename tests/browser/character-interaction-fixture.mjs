globalThis.Hooks = { on() {} };
globalThis.CONST = { ACTIVE_EFFECT_MODES: { CUSTOM: 0 } };
globalThis.foundry = {
  abstract: { TypeDataModel: class {} }, data: { fields: {} },
  applications: { api: { HandlebarsApplicationMixin: Base => Base }, sheets: { ActorSheetV2: class {} } },
  documents: { ActiveEffect: class {} },
  utils: {
    deepClone: value => structuredClone(value),
    getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object),
  },
};
globalThis.game = { user: { isGM: true }, items: new Map(), packs: [] };
const { BladesActorSheet, updateCharacterClockDisplay } = await import("../../module/blades-actor-sheet.js");
const { BladesSheet } = await import("../../module/blades-sheet.js");
const { bindLoadoutControls } = await import("../../module/character/loadout.js");
const { clockImagePath } = await import("../../module/clock-utils.js");

const host = document.querySelector("#host");
const output = document.querySelector("#results");
let sheet, pending, changeCalls, renders, loadoutCreates;

function markup() {
  const owned = sheet.actor.items.find(item => item.flags?.["brinkwood-reforged"]?.loadoutSourceId === "sword");
  return `<form class="actor-sheet character-sheet"><div class="spacer"></div>
    <div class="controls">
      <input id="loadout" type="checkbox" class="loadout-item-select" data-loadout-source-id="sword" data-item-id="${owned?.id ?? ""}" data-loadout-item-name="Longsword" ${owned?.system.equipped ? "checked" : ""}>
      <label for="loadout">Longsword</label>
      <div class="actor-effects">${["create", "edit", "toggle", "delete"].map(action =>
        `<button type="button" id="effect-${action}" class="effect-control" data-effect-action="${action}">${action} effect</button>`
      ).join("")}</div>
      <div><div class="blades-clock clock-4 clock-4-0">
        ${Array.from({ length: 5 }, (_, value) => `<input type="radio" id="clock-${value}" name="system.scars" value="${value}">`).join("")}
        <label for="clock-2" title="Clock segment 2"></label>
      </div><span class="clock-progress">0/4</span></div>
    </div><div class="spacer"></div></form>`;
}

function bind() {
  sheet.element = host.querySelector("form");
  sheet._bindSheetViewState(sheet.element, {});
  bindLoadoutControls(sheet, sheet.element, {});
  sheet.element.querySelector("#loadout").addEventListener("change", () => { changeCalls++; });
  for (const radio of sheet.element.querySelectorAll('[name="system.scars"]')) {
    radio.addEventListener("click", event => {
      pending = BladesActorSheet.prototype._onClockClick.call(sheet, event);
    });
  }
  updateCharacterClockDisplay(sheet.element, "system.scars", sheet.document.system.scars);
  sheet.element.querySelectorAll(".effect-control").forEach(control => {
    control.addEventListener("click", event => {
      pending = sheet._onActorEffectControl(event, async () => {
        event.preventDefault();
        return {};
      }, { renderAfter: event.currentTarget.dataset.effectAction !== "edit" });
    });
  });
}

function replaceRoot() {
  const prior = sheet.element;
  const focusId = prior.querySelector(":focus")?.id;
  const scroll = BladesActorSheet.PARTS.sheet.scrollable.includes("") ? prior.scrollTop : null;
  host.innerHTML = markup();
  const next = host.querySelector("form");
  if (focusId) next.querySelector(`#${focusId}`)?.focus();
  if (scroll !== null) next.scrollTop = scroll;
  bind();
}

function reset() {
  changeCalls = 0; renders = 0; loadoutCreates = 0; pending = Promise.resolve();
  const source = {
    type: "item",
    toObject: () => ({ _id: "sword", type: "item", name: "Longsword", flags: {}, system: { equipped: false, load: 1 } }),
  };
  game.packs = [{ metadata: { name: "item" }, getDocument: async id => id === "sword" ? source : null }];
  sheet = Object.assign(Object.create(BladesSheet.prototype), {
    isEditable: true, tabGroups: { primary: "loadout" }, actor: { items: [] },
    document: {
      system: { scars: 0 },
      async update(changes) { this.system.scars = changes["system.scars"]; },
      async createEmbeddedDocuments(_type, [data], options) {
        loadoutCreates++;
        await Promise.resolve();
        const created = { ...data, id: "owned", _id: "owned" };
        sheet.actor.items.push(created);
        if (options?.render !== false) throw new Error("first-time loadout creation must suppress root replacement");
        return [created];
      },
    },
    async render() {
      renders++;
      replaceRoot();
      await Promise.resolve();
    },
  });
  host.innerHTML = markup();
  bind();
  sheet.element.scrollTop = 340;
}

function mouseActivate(control) {
  // dispatchEvent exposes whether production canceled the browser's mousedown
  // focus default. click() then performs the real checkbox/radio default action.
  const nativeFocus = control.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
  if (nativeFocus) control.focus();
  control.click();
  return nativeFocus;
}

async function settled() {
  await pending;
  // Loadout binding deliberately does not expose event-listener promises.
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function assertEffectDeletionGeometry(assertions) {
  let rows = 3;
  let deletion;
  const geometrySheet = Object.assign(Object.create(BladesSheet.prototype), {
    tabGroups: { primary: "effects" },
    async render() {
      const scrollTop = this.element?.scrollTop ?? 0;
      host.innerHTML = `<form class="actor-sheet character-sheet">
        <div style="height:500px">Character header</div>
        <section class="actor-effects">
          ${Array.from({ length: rows }, (_, index) => `
            <div class="geometry-effect-row" style="height:160px;display:flex;align-items:flex-end">
              Effect ${index + 1}
              <button type="button" class="effect-control" data-effect-action="delete">Delete effect</button>
            </div>`).join("")}
          <div class="geometry-effect-footer" style="height:32px">Add Effect</div>
        </section>
      </form>`;
      this.element = host.querySelector("form");
      this.element.scrollTop = scrollTop;
      this._bindSheetViewState(this.element, {});
      this.element.querySelectorAll(".effect-control").forEach(control => {
        control.addEventListener("click", event => {
          deletion = this._onActorEffectControl(event, async () => {
            event.preventDefault();
            rows--;
          }, { renderAfter: true });
        });
      });
    },
  });

  await geometrySheet.render();
  while (rows > 0) {
    const previousRows = rows;
    const outgoing = geometrySheet.element;
    outgoing.scrollTop = outgoing.scrollHeight - outgoing.clientHeight;
    const previousHeight = outgoing.scrollHeight;
    [...outgoing.querySelectorAll(".geometry-effect-row .effect-control")].at(-1).click();
    await deletion;

    const form = geometrySheet.element;
    const naturalBottom = form.scrollHeight - form.clientHeight;
    const footer = form.querySelector(".geometry-effect-footer");
    const viewportBottom = form.getBoundingClientRect().top + form.clientTop + form.clientHeight;
    const key = `deleteEffectLeaving${rows}`;
    assertions[`${key}RemovesRow`] =
      form.querySelectorAll(".geometry-effect-row").length === previousRows - 1;
    assertions[`${key}ShrinksScrollRange`] =
      Math.abs(previousHeight - form.scrollHeight - 160) <= 1;
    assertions[`${key}ClampsImmediately`] = Math.abs(form.scrollTop - naturalBottom) <= 1;
    assertions[`${key}LeavesFooterVisible`] = footer.getBoundingClientRect().bottom <= viewportBottom + 1;
    assertions[`${key}AddsNoSpacer`] =
      !form.querySelector("[data-brinkwood-effect-scroll-spacer]");
  }
}

document.querySelector("#run").addEventListener("click", async () => {
  try {
    reset();
    const assertions = {};
    const before = sheet.element.scrollTop;
    const input = sheet.element.querySelector("#loadout");
    assertions.nativeMouseDefaultPreserved = mouseActivate(input) && sheet.element.scrollTop === before;
    assertions.nativeCheckboxChecksOnFirstClick = input.checked && changeCalls === 1;
    await settled();
    assertions.firstClickPersists = sheet.actor.items[0].system.equipped && sheet.element.querySelector("#loadout").checked;
    assertions.firstClickCreatesExactlyOneItem = loadoutCreates === 1 && sheet.actor.items.length === 1;
    assertions.loadoutDoesNotRender = renders === 0;
    assertions.loadoutScrollPreserved = sheet.element.scrollTop === before;
    for (const action of ["create", "edit", "toggle", "delete"]) {
      mouseActivate(sheet.element.querySelector(`#effect-${action}`));
      await settled();
      assertions[`effect${action[0].toUpperCase()}${action.slice(1)}ScrollPreserved`] =
        sheet.element.scrollTop === before;
    }
    mouseActivate(sheet.element.querySelector('label[for="clock-2"]'));
    await settled();
    const clock = sheet.element.querySelector(".blades-clock");
    assertions.clockFillsWithoutAnotherCTA = sheet.document.system.scars === 2
      && clock.style.backgroundImage.includes(clockImagePath(4, 2))
      && clock.classList.contains("clock-4-2")
      && sheet.element.querySelector(".clock-progress").textContent === "2/4"
      && sheet.element.querySelector("#clock-2").checked;
    assertions.clockDoesNotRender = renders === 3;
    assertions.clockScrollPreserved = sheet.element.scrollTop === before;
    await assertEffectDeletionGeometry(assertions);
    output.dataset.status = Object.values(assertions).every(Boolean) ? "passed" : "failed";
    output.textContent = JSON.stringify({ assertions, changeCalls, renders, scrollTop: sheet.element.scrollTop }, null, 2);
  } catch (error) {
    output.dataset.status = "failed";
    output.textContent = error.stack;
  }
});
reset();
