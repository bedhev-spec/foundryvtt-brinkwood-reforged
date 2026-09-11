import {
  BACKGROUND_GEOMETRY_CASES,
  SHEET_TYPES,
  SHEET_WIDTHS,
  backgroundMarkup,
  sheetMarkup,
} from "./sheet-geometry-cases.mjs";

const cases = document.querySelector("#cases");
const output = document.querySelector("#sheet-geometry-results");

for (const width of SHEET_WIDTHS) {
  for (const type of SHEET_TYPES) {
    const host = document.createElement("section");
    host.className = "geometry-case";
    host.dataset.width = width;
    host.dataset.type = type;
    host.style.width = `${width}px`;
    host.innerHTML = sheetMarkup(type);
    cases.append(host);
  }
}

for (const geometry of BACKGROUND_GEOMETRY_CASES) {
  const host = document.createElement("section");
  host.className = "geometry-case geometry-case--background";
  host.dataset.width = geometry.width;
  host.dataset.height = geometry.height;
  host.dataset.type = geometry.type;
  host.style.width = `${geometry.width}px`;
  host.style.height = `${geometry.height}px`;
  host.innerHTML = backgroundMarkup(geometry.type);
  cases.append(host);
}

await document.fonts?.ready;
await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

function ownerFor(host) {
  if (host.dataset.type === "character") return host.querySelector("form.actor-sheet");
  if (host.dataset.type === "mask") return host.querySelector(".mask-sheet__panel.active");
  if (host.dataset.type === "rebelion") return host.querySelector(".rebelion-sheet__panel.active");
  if (host.dataset.type === "npc") return host.querySelector("form.npc-dossier");
  return host.querySelector(host.dataset.type === "item-modern" ? "form.loadout-item-sheet" : "form.legacy-item-sheet");
}

function measure(host) {
  const owner = ownerFor(host);
  const focus = host.querySelector(".fixture-focus");
  focus.focus({ preventScroll: true, focusVisible: true });

  const ownerStyle = getComputedStyle(owner);
  const focusStyle = getComputedStyle(focus);
  const bottom = host.querySelector(".fixture-bottom");
  const content = host.querySelector(".window-content");
  const npcProfile = host.querySelector(".npc-dossier__profile");
  const npcEditors = host.querySelector(".npc-dossier__editors");
  const npcEditor = host.querySelector(".npc-dossier__editor-panel");
  const activePanel = host.querySelector(".sheet-tab-content > .tab.active");
  const before = owner.scrollTop;
  owner.scrollTop = owner.scrollHeight;

  const result = {
    type: host.dataset.type,
    width: Number(host.dataset.width),
    verticalOwner: ["auto", "scroll"].includes(ownerStyle.overflowY) && owner.scrollHeight > owner.clientHeight,
    singleVerticalOwner: !activePanel || activePanel === owner || activePanel.scrollHeight <= activePanel.clientHeight,
    noHorizontalOverflow: content.scrollWidth <= content.clientWidth + 1,
    reachable: bottom.getBoundingClientRect().bottom <= owner.getBoundingClientRect().bottom + 2,
    npcSectionsDoNotCollapse: host.dataset.type !== "npc" || (
      getComputedStyle(npcProfile).display === "block"
      && getComputedStyle(npcEditor).display === "block"
      && npcProfile.getBoundingClientRect().height > 100
      && npcEditors.getBoundingClientRect().height > 180
      && npcEditor.querySelector("prose-mirror, .editor") !== null
    ),
    visibleFocus: focus.matches(":focus-visible")
      && focusStyle.outlineStyle !== "none"
      && focusStyle.outlineWidth !== "0px",
  };
  owner.scrollTop = before;
  return result;
}

const results = [...document.querySelectorAll(".geometry-case:not(.geometry-case--background)")].map(measure);
const assertions = Object.fromEntries(results.map(result => [
  `${result.type}-${result.width}`,
  result.verticalOwner
    && result.singleVerticalOwner
    && result.noHorizontalOverflow
    && result.reachable
    && result.npcSectionsDoNotCollapse
    && result.visibleFocus,
]));

const backgroundResults = [...document.querySelectorAll(".geometry-case--background")].map(host => {
  const type = host.dataset.type;
  const form = host.querySelector("form.actor-sheet");
  const notes = host.querySelector(".sheet-notes.active");
  const surface = notes.querySelector(".sheet-notes__editor, .sheet-notes__preview");
  const formStyle = getComputedStyle(form);
  const notesStyle = getComputedStyle(notes);
  const before = form.scrollTop;
  form.scrollTop = form.scrollHeight;

  const formRect = form.getBoundingClientRect();
  const surfaceRect = surface.getBoundingClientRect();
  const bottomGap = formRect.bottom - surfaceRect.bottom;
  const result = {
    type,
    height: Number(host.dataset.height),
    notesDoNotOwnScroll: notesStyle.overflowY === "hidden",
    surfaceFillsAvailableHeight: surfaceRect.height >= 260,
    bottomGap,
    characterReducedReachable: type !== "character-background-reduced"
      || (formStyle.overflowY === "auto" && form.scrollHeight > form.clientHeight && surfaceRect.bottom <= formRect.bottom),
    characterEnlargedGrows: type !== "character-background-enlarged"
      || (form.scrollHeight <= form.clientHeight + 1 && surfaceRect.height > 260 && bottomGap >= 8 && bottomGap <= 12),
    maskBackgroundFills: !type.startsWith("mask-background-")
      || (surfaceRect.height > 260 && bottomGap >= 8 && bottomGap <= 12),
  };
  form.scrollTop = before;
  return result;
});

for (const result of backgroundResults) {
  assertions[result.type] = result.notesDoNotOwnScroll
    && result.surfaceFillsAvailableHeight
    && result.characterReducedReachable
    && result.characterEnlargedGrows
    && result.maskBackgroundFills;
}

output.dataset.status = Object.values(assertions).every(Boolean) ? "passed" : "failed";
output.textContent = JSON.stringify({ assertions, results, backgroundResults }, null, 2);
