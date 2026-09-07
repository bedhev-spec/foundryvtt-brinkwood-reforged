import { SHEET_TYPES, SHEET_WIDTHS, sheetMarkup } from "./sheet-geometry-cases.mjs";

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

await document.fonts?.ready;
await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

function ownerFor(host) {
  if (host.dataset.type === "character") return host.querySelector("form.actor-sheet");
  if (host.dataset.type === "mask") return host.querySelector(".mask-sheet__panel.active");
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
      && npcEditor.querySelector("h2").getBoundingClientRect().bottom
        <= npcEditor.querySelector("prose-mirror, .editor").getBoundingClientRect().top
    ),
    visibleFocus: focus.matches(":focus-visible")
      && focusStyle.outlineStyle !== "none"
      && focusStyle.outlineWidth !== "0px",
  };
  owner.scrollTop = before;
  return result;
}

const results = [...document.querySelectorAll(".geometry-case")].map(measure);
const assertions = Object.fromEntries(results.map(result => [
  `${result.type}-${result.width}`,
  result.verticalOwner
    && result.singleVerticalOwner
    && result.noHorizontalOverflow
    && result.reachable
    && result.npcSectionsDoNotCollapse
    && result.visibleFocus,
]));

output.dataset.status = Object.values(assertions).every(Boolean) ? "passed" : "failed";
output.textContent = JSON.stringify({ assertions, results }, null, 2);
