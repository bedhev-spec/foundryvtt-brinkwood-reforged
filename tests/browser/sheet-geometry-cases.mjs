export const SHEET_WIDTHS = Object.freeze([700, 480, 410]);
export const SHEET_TYPES = Object.freeze(["character", "mask", "rebelion", "npc", "item-modern", "item-legacy"]);
export const BACKGROUND_GEOMETRY_CASES = Object.freeze([
  { type: "character-background-reduced", width: 700, height: 560 },
  { type: "character-background-enlarged", width: 700, height: 820 },
  { type: "mask-background-editable", width: 700, height: 680 },
  { type: "mask-background-readonly", width: 700, height: 680 },
]);

const filler = label => `
  <div class="fixture-filler">
    <p>${label} content exercises a tall localized sheet body.</p>
    <button type="button" class="fixture-bottom">Reachable end control</button>
  </div>`;

export function sheetMarkup(type) {
  if (type === "character") return `
    <article class="application brinkwood sheet actor pc character">
      <header class="window-header">Character</header>
      <div class="window-content">
        <form class="editable actor-sheet character-sheet" autocomplete="off">
          <header class="name-alias sheet-identity bw-section-frame">
            <div class="grow-two sheet-identity__portrait"><div class="sheet-identity__portrait-frame"></div></div>
            <section class="grow-two sheet-identity__details">
              <div class="sheet-identity__name-box"><label>Name</label><input class="name bw-text-field" value="Mara"></div>
              <div class="sheet-identity__rows character-identity-choices"></div>
            </section>
            <section class="grow-two sheet-identity__trackers"></section>
          </header>
          <section class="character-attributes sheet-attribute-presentation" aria-label="Attributes"></section>
          <section class="bans-armor bw-section-frame" aria-label="Bans and armor"></section>
          <section class="character-sheet__workspace sheet-tab-workspace">
            <nav class="tabs sheet-tabs" data-group="primary" aria-label="Character tabs">
              <button type="button" class="item active" role="tab" tabindex="0" aria-selected="true"
                aria-controls="fixture-character-loadout" data-action="tab" data-group="primary" data-tab="loadout">Loadout</button>
            </nav>
            <div class="tab-content sheet-tab-content flex-vertical grow-two">
              <section id="fixture-character-loadout" class="tab flex-vertical loadout active"
                role="tabpanel" data-group="primary" data-tab="loadout">
                <div class="loadout__panel bw-section-frame">
                  <div class="label-stripe loadout__header bw-section-frame__header"><h2 class="loadout__heading">Loadout</h2></div>
                  <div class="loadout__catalogue" aria-label="Loadout">
                    <article class="loadout__item" data-item-id="fixture-item">
                      <input class="loadout-item-select bw-checkbox-x" type="checkbox" aria-label="Rope">
                      <button type="button" class="fixture-focus loadout-item-open" data-item-id="fixture-item" aria-label="Rope">
                        <span class="loadout__item-name">Rope</span>
                      </button>
                      <input class="loadout-item-load" type="number" value="1" aria-label="Load: Rope">
                    </article>
                  </div>
                  ${filler("Character")}
                </div>
              </section>
            </div>
          </section>
        </form>
      </div>
    </article>`;

  if (type === "mask") return `
    <article class="application brinkwood sheet actor mask">
      <header class="window-header">Mask</header>
      <div class="window-content">
        <form class="editable actor-sheet mask-sheet" autocomplete="off">
          <header class="mask-sheet__identity-block sheet-identity bw-section-frame">
            <div class="sheet-identity__portrait"><div class="sheet-identity__portrait-frame"></div></div>
            <section class="mask-sheet__identity sheet-identity__details">
              <div class="mask-sheet__name-box sheet-identity__field-box sheet-identity__name-box">
                <label for="fixture-mask-name">Name</label>
                <input id="fixture-mask-name" class="name bw-text-field" value="Briar">
              </div>
              <div class="sheet-identity__rows"></div>
            </section>
          </header>
          <div class="mask-sheet__layout">
            <section class="mask-sheet__main sheet-tab-workspace">
              <nav class="tabs sheet-tabs mask-sheet__tabs" data-group="primary" aria-label="Mask tabs">
                <button type="button" class="fixture-focus item active" role="tab" tabindex="0" aria-selected="true"
                  aria-controls="fixture-mask-traits" data-action="tab" data-group="primary" data-tab="traits">Traits</button>
              </nav>
              <div class="mask-sheet__tab-content sheet-tab-content">
                <section id="fixture-mask-traits" class="tab mask-sheet__panel active" role="tabpanel"
                  data-group="primary" data-tab="traits">
                  <div class="mask-sheet__traits-workspace"><div class="mask-sheet__trait-library">${filler("Mask")}</div></div>
                </section>
              </div>
            </section>
          </div>
        </form>
      </div>
    </article>`;

  if (type === "rebelion") return `
    <article class="application brinkwood sheet actor rebelion">
      <header class="window-header">Rebellion</header>
      <div class="window-content">
        <form class="editable actor-sheet rebelion-sheet__form" autocomplete="off">
          <header class="rebelion-sheet__header bw-section-frame">
            <div class="sheet-identity__field-box sheet-identity__name-box"><label>Name</label><input class="fixture-focus name bw-text-field" value="The Unreasonably Long Cardenfell Liberation Assembly"></div>
          <div class="sheet-identity__trackers rebelion-sheet__trackers">
            <div class="big-teeth-section"><span class="black-label">Tyranny</span></div>
            <div class="big-teeth-section"><span class="black-label">Heat</span></div>
            <div class="big-teeth-section"><span class="black-label">Resupply</span></div>
          </div>
          <p class="rebelion-sheet__status-line">Aspect ranks 3 / 6 · Liberated 1</p>
          </header>
          <div class="sheet-tab-workspace rebelion-sheet__workspace">
            <nav class="tabs sheet-tabs" data-group="primary" aria-label="Rebellion tabs">
              <button type="button" class="item active" role="tab" tabindex="0" aria-selected="true" aria-controls="fixture-rebellion-aspects" data-action="tab" data-group="primary" data-tab="aspects">Aspects</button>
              <button type="button" class="item" role="tab" tabindex="-1" aria-selected="false" aria-controls="fixture-rebellion-territories" data-action="tab" data-group="primary" data-tab="territories">Territories</button>
              <button type="button" class="item" role="tab" tabindex="-1" aria-selected="false" aria-controls="fixture-rebellion-conclave" data-action="tab" data-group="primary" data-tab="conclave">Conclave</button>
            </nav>
            <section class="sheet-tab-content rebelion-sheet__content">
              <div id="fixture-rebellion-aspects" class="tab rebelion-sheet__panel active" data-group="primary" data-tab="aspects">
                <div class="rebelion-sheet__panel-stack"><section class="bw-section-frame rebelion-aspect"><div class="rebelion-aspect__body">${filler("Rebellion with a very long Moot decision title and answer")}</div></section></div>
              </div>
            <div id="fixture-rebellion-territories" class="tab rebelion-sheet__panel" data-group="primary" data-tab="territories">
              <div class="rebelion-sheet__panel-stack">
                <section class="bw-section-frame rebelion-settlements">
                  <h2 class="bw-section-frame__header rebelion-section-heading">Towns</h2>
                  <div class="rebelion-settlements__list">
                    <article class="rebelion-settlement">
                      <div class="rebelion-settlement__identity"><strong>Harrowgate</strong></div>
                      <div class="sheet-identity__trackers rebelion-settlement__trackers">
                        <div class="big-teeth-section"><span class="black-label">Sedition</span></div>
                        <div class="big-teeth-section"><span class="black-label">Level</span></div>
                      </div>
                    </article>
                  </div>
                </section>
                ${filler("Territories")}
              </div>
            </div>
            <div id="fixture-rebellion-conclave" class="tab rebelion-sheet__panel" data-group="primary" data-tab="conclave">
              <section class="bw-section-frame rebelion-conclave">
                <header class="bw-section-frame__header rebelion-section-heading rebelion-conclave__header"><h2>Conclave allies</h2></header>
                ${filler("Conclave")}
              </section>
            </div>
            </section>
          </div>
        </form>
      </div>
    </article>`;

  if (type === "npc") return `
    <article class="application brinkwood sheet actor npc">
      <header class="window-header">NPC</header>
      <div class="window-content">
        <form class="editable actor-sheet npc-dossier" autocomplete="off">
          <header class="npc-dossier__header">
            <div class="fixture-portrait"></div>
            <div class="npc-dossier__identity">
              <input class="fixture-focus name bw-text-field" name="name" value="Lady Rowan" aria-label="Name">
              <input name="system.description_short" value="A determined courtier" aria-label="Short description">
            </div>
          </header>
          <section class="npc-dossier__profile"><h2>Profile</h2>
            <div class="npc-dossier__profile-fields">
              <div class="npc-dossier__field"><label>Class or role</label><input value="Vampiric courtier" aria-label="Class or role"></div>
              <div class="npc-dossier__field"><label>Faction</label><input value="The Court" aria-label="Faction"></div>
              <div class="npc-dossier__field"><label>Faction type</label><input value="Vampire" aria-label="Faction type"></div>
              <div class="npc-dossier__field"><label>Tier</label><input type="number" value="3" aria-label="Tier"></div>
              <div class="npc-dossier__field"><label>Threat</label><input type="number" value="0" aria-label="Threat"></div>
              <label class="npc-dossier__field npc-dossier__elite">Elite<input type="checkbox" aria-label="Elite"></label>
            </div>
          </section>
          <section class="npc-dossier__editors">
            <nav class="tabs sheet-tabs npc-dossier__editor-tabs"><button class="item active">Description</button><button class="item">Abilities</button><button class="item">Schemes</button></nav>
            <div class="npc-dossier__editor-content">
        <section class="tab active npc-dossier__editor-panel bw-rich-text-surface"><prose-mirror>${filler("NPC description")}</prose-mirror></section>
        <section class="tab npc-dossier__editor-panel bw-rich-text-surface"><div class="editor editor-content">${filler("NPC abilities")}</div></section>
        <section class="tab npc-dossier__editor-panel bw-rich-text-surface"><div class="editor editor-content">${filler("NPC schemes")}</div></section>
            </div>
          </section>
        </form>
      </div>
    </article>`;

  if (type === "item-modern") return `
    <article class="application brinkwood item sheet">
      <header class="window-header">Modern Item</header>
      <div class="window-content">
        <form class="editable loadout-item-sheet" autocomplete="off">
          <header class="loadout-item-sheet__header">
            <div class="fixture-portrait"></div>
            <div class="loadout-item-sheet__identity">
              <span>Loadout item</span>
              <input class="fixture-focus" name="name" value="Rope" aria-label="Name">
            </div>
          </header>
          <section class="loadout-item-sheet__section"><h2>Description</h2><textarea>Useful rope.</textarea></section>
          <section class="loadout-item-sheet__section loadout-item-sheet__effects"><h2>Effects</h2>${filler("Modern Item")}</section>
        </form>
      </div>
    </article>`;

  if (type === "item-legacy") return `
    <article class="application brinkwood item sheet">
      <header class="window-header">Legacy Item</header>
      <div class="window-content">
        <form class="editable legacy-item-sheet" autocomplete="off">
          <header class="sheet-header">
            <div class="fixture-portrait"></div>
            <div class="header-fields"><h1><input class="fixture-focus" name="name" value="Trait" aria-label="Name"></h1></div>
          </header>
          <section class="sheet-body legacy-item-sheet__body">
            <div class="legacy-item-sheet__primary"><div class="label-stripe">Description</div>${filler("Legacy Item")}</div>
          </section>
        </form>
      </div>
    </article>`;

  throw new TypeError(`Unknown sheet fixture type: ${type}`);
}

export function backgroundMarkup(type) {
  if (type.startsWith("character-background-")) return `
    <article class="application brinkwood sheet actor pc character">
      <header class="window-header">Character</header>
      <div class="window-content">
        <form class="editable actor-sheet character-sheet" autocomplete="off">
          <header class="name-alias sheet-identity bw-section-frame">
            <div class="grow-two sheet-identity__portrait"><div class="sheet-identity__portrait-frame"></div></div>
            <section class="grow-two sheet-identity__details">
              <div class="sheet-identity__name-box"><label>Name</label><input class="name bw-text-field" value="Mara"></div>
              <div class="sheet-identity__rows character-identity-choices"></div>
            </section>
            <section class="grow-two sheet-identity__trackers"></section>
          </header>
          <section class="character-attributes sheet-attribute-presentation" aria-label="Attributes"></section>
          <section class="bans-armor bw-section-frame" aria-label="Bans and armor"></section>
          <section class="character-sheet__workspace sheet-tab-workspace">
            <nav class="tabs sheet-tabs" data-group="primary" aria-label="Character tabs">
              <button type="button" class="item active" role="tab" tabindex="0" aria-selected="true"
                aria-controls="fixture-character-background" data-action="tab" data-group="primary" data-tab="character-notes">Background</button>
            </nav>
            <div class="tab-content sheet-tab-content flex-vertical grow-two">
              <section id="fixture-character-background" class="tab sheet-notes bw-rich-text-surface active flex-vertical"
                data-group="primary" data-tab="character-notes">
                <prose-mirror class="sheet-notes__editor fixture-focus" tabindex="0"><div class="ProseMirror">${filler("Character Background")}</div></prose-mirror>
              </section>
            </div>
          </section>
        </form>
      </div>
    </article>`;

  if (type === "mask-background-editable" || type === "mask-background-readonly") {
    const readonly = type.endsWith("readonly");
    const notes = readonly
      ? `<div class="editor editor-content sheet-notes__preview fixture-focus" tabindex="0">${filler("Mask Background preview")}</div>`
      : `<prose-mirror class="sheet-notes__editor fixture-focus" tabindex="0"><div class="ProseMirror">${filler("Mask Background editor")}</div></prose-mirror>`;
    return `
      <article class="application brinkwood sheet actor mask">
        <header class="window-header">Mask</header>
        <div class="window-content">
          <form class="${readonly ? "locked" : "editable"} actor-sheet mask-sheet" autocomplete="off">
            <header class="mask-sheet__identity-block sheet-identity bw-section-frame">
              <div class="sheet-identity__portrait"><div class="sheet-identity__portrait-frame"></div></div>
              <section class="mask-sheet__identity sheet-identity__details">
                <div class="mask-sheet__name-box sheet-identity__field-box sheet-identity__name-box"><label>Name</label><input class="name bw-text-field" value="Briar"></div>
                <div class="sheet-identity__rows"></div>
              </section>
            </header>
            <div class="mask-sheet__layout">
              <section class="mask-sheet__main sheet-tab-workspace">
                <nav class="tabs sheet-tabs mask-sheet__tabs" data-group="primary" aria-label="Mask tabs">
                  <button type="button" class="item active" role="tab" tabindex="0" aria-selected="true"
                    aria-controls="fixture-mask-background" data-action="tab" data-group="primary" data-tab="mask-notes">Background</button>
                </nav>
                <div class="mask-sheet__tab-content sheet-tab-content">
                  <section id="fixture-mask-background" class="tab mask-sheet__panel mask-sheet__notes flex-vertical sheet-notes bw-rich-text-surface active"
                    data-group="primary" data-tab="mask-notes" role="tabpanel">${notes}</section>
                </div>
              </section>
            </div>
          </form>
        </div>
      </article>`;
  }

  throw new TypeError(`Unknown background geometry fixture type: ${type}`);
}
