/**
 * Shared, DOM-only helpers for ApplicationV2 sheet navigation.  They keep
 * native Foundry primary tabs in charge while preserving transient sheet view
 * state across renders triggered by form controls or effect actions.
 */

const CHARACTER_EFFECTS_VIEWPORT_SELECTOR = ".actor-effects";

function characterForm(root) {
  const form = root?.matches?.("form.actor-sheet.character-sheet")
    ? root
    : root?.querySelector?.("form.actor-sheet.character-sheet");
  return form?.matches?.("form.actor-sheet.character-sheet") ? form : null;
}


/** Capture a stable Effects-section point before a Character effect render. */
export function captureCharacterEffectViewport(root, control) {
  const form = characterForm(root);
  if (!form) return null;
  const groups = Array.from(form.querySelectorAll?.(CHARACTER_EFFECTS_VIEWPORT_SELECTOR) ?? []);
  const anchor = control?.closest?.(CHARACTER_EFFECTS_VIEWPORT_SELECTOR) ?? groups[0];
  const viewportTop = anchor?.getBoundingClientRect?.().top;
  if (!anchor || !Number.isFinite(viewportTop)) return null;
  return {
    anchorIndex: Math.max(0, groups.indexOf(anchor)),
    viewportTop,
  };
}

/**
 * Keep the Effects section stable when the natural scroll range permits it.
 * When deletion shortens the sheet, clamp immediately to the new bottom so
 * the scrollbar always reflects the visible content.
 */
export function restoreCharacterEffectViewport(root, state) {
  const form = characterForm(root);
  if (!form || !state) return false;

  const groups = Array.from(form.querySelectorAll?.(CHARACTER_EFFECTS_VIEWPORT_SELECTOR) ?? []);
  const anchor = groups[state.anchorIndex] ?? groups[0];
  const rect = anchor?.getBoundingClientRect?.();
  if (!anchor || !rect || !Number.isFinite(rect.top)) return false;

  const currentScrollTop = Number(form.scrollTop) || 0;
  const desiredScrollTop = Math.max(0, currentScrollTop + rect.top - state.viewportTop);
  const naturalMaxScroll = Math.max(
    0,
    (Number(form.scrollHeight) || 0) - (Number(form.clientHeight) || 0),
  );
  form.scrollTop = Math.min(desiredScrollTop, naturalMaxScroll);
  return true;
}

export function getSheetScrollContainers(root) {
  const tabViewport = root?.querySelector?.(".sheet-tab-content > .tab.active");
  const form = root?.matches?.("form") || root?.matches?.("form.actor-sheet")
    ? root
    : root?.querySelector?.("form") ?? root?.querySelector?.("form.actor-sheet");

  // ApplicationV2 owns the Character part root through PARTS.scrollable.
  // Do not race its render-cycle restoration with a manual position.
  if (form?.matches?.("form.actor-sheet.character-sheet")) {
    return [];
  }
  // Bounded actor sheets keep their header and tabs fixed. Their active panel
  // is the only scroll owner, so restoring outer scroll would move fixed UI.
  if (tabViewport) return [["tab", tabViewport]];

  const windowContent = root?.closest?.(".window-content") ?? root?.querySelector?.(".window-content");
  return [["form", form], ["window", windowContent]].filter(([, element]) => element);
}

export function captureSheetViewState(root, { primaryTab, effectTab } = {}) {
  const activePanel = root?.querySelector?.('.tab[data-group="primary"].active');
  return {
    primaryTab: primaryTab ?? activePanel?.dataset.tab,
    effectTab,
    scrollPositions: Object.fromEntries(getSheetScrollContainers(root).map(([name, element]) => [name, {
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft,
    }])),
  };
}

export function restoreSheetViewState(root, state, { setPrimaryTab, activateEffectTab } = {}) {
  if (!state) return;
  if (state.primaryTab) setPrimaryTab?.(state.primaryTab);
  const scrollContainers = getSheetScrollContainers(root);
  for (const [name, element] of scrollContainers) {
    const position = state.scrollPositions?.[name];
    if (!position) continue;
    element.scrollTop = position.scrollTop;
    element.scrollLeft = position.scrollLeft;
  }
  // A bounded viewport can replace the inner tab pane during a rerender.
  // Ensure stale outer positions cannot shift the fixed header into view.
  const form = root?.matches?.("form.actor-sheet") ? root : root?.querySelector?.("form.actor-sheet");
  const isCharacter = form?.matches?.("form.actor-sheet.character-sheet");
  if (!isCharacter && root?.querySelector?.(".sheet-tab-content")) {
    const windowContent = root.closest?.(".window-content") ?? root.querySelector?.(".window-content");
    const tabViewport = root.querySelector?.(".sheet-tab-content > .tab.active");
    const scrollOwners = new Set(scrollContainers.map(([, element]) => element));
    for (const element of [form, windowContent, tabViewport]) {
      if (!element || scrollOwners.has(element)) continue;
      element.scrollTop = 0;
      element.scrollLeft = 0;
    }
  }
  if (state.effectTab) activateEffectTab?.(state.effectTab);
}

export function normalizeEffectTab(effects, activeTab, fallback = "temporary") {
  const visible = Object.values(effects ?? {}).filter(section => section.visible).map(section => section.type);
  return visible.includes(activeTab) ? activeTab : visible[0] ?? fallback;
}

export function activateEffectTab(root, type) {
  const nextTab = root?.querySelector?.(`[data-effect-tab="${type}"]`);
  if (!nextTab) return false;
  root.querySelectorAll("[data-effect-tab]").forEach(tab => {
    const active = tab === nextTab;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  root.querySelectorAll("[data-effect-panel]").forEach(panel => {
    panel.hidden = panel.dataset.effectPanel !== type;
  });
  return true;
}

export function bindEffectTabs(root, { signal, onActivate } = {}) {
  root?.querySelectorAll?.("[data-effect-tab]").forEach(tab => {
    tab.addEventListener("click", event => {
      event.preventDefault();
      onActivate?.(event.currentTarget.dataset.effectTab);
    }, { signal });
    tab.addEventListener("keydown", event => {
      const tabs = Array.from(event.currentTarget.closest('[role="tablist"]')?.querySelectorAll("[data-effect-tab]") ?? []);
      const current = tabs.indexOf(event.currentTarget);
      const target = event.key === "Home" ? tabs[0]
        : event.key === "End" ? tabs.at(-1)
        : event.key === "ArrowRight" || event.key === "ArrowDown" ? tabs[(current + 1) % tabs.length]
        : event.key === "ArrowLeft" || event.key === "ArrowUp" ? tabs[(current - 1 + tabs.length) % tabs.length]
        : null;
      if (!target) return;
      event.preventDefault();
      target.focus();
      onActivate?.(target.dataset.effectTab);
    }, { signal });
  });
}
