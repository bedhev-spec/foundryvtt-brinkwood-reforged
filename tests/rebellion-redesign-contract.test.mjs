import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { gainHeat, normalizeTyranny, tyrannySeverity } from "../module/rebellion/rules.js";
import { projectRebellion } from "../module/rebellion/presentation.js";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Tyranny is unbounded and has deterministic manual severity bands", () => {
  assert.equal(normalizeTyranny({ value: 19, max: 4 }).value, 19);
  assert.equal(gainHeat({ heat: { value: 10, max: 10 }, tyranny: { value: 19, max: 4 } }, 1).tyranny.value, 20);
  assert.deepEqual([0, 1, 2, 3].map(tyrannySeverity), ["low", "low", "moderate", "high"]);
});

test("Rebellion UI keeps record edits explicit and Going Underground preflight visible", async () => {
  const [sheet, aspect, source, migration] = await Promise.all([
    read("templates/rebelion-sheet.html"), read("templates/rebelion-sheet/moot-section.html"),
    read("module/blades-rebelion-sheet.js"), read("module/migration.js"),
  ]);
  assert.match(sheet, /data-underground-actor/);
  assert.match(sheet, /data-tyranny-input/);
  assert.match(sheet, /RebellionLegacyLands/);
  assert.match(aspect, /data-moot-choice/);
  assert.match(aspect, /data-rebellion-action="save-moot-answer"/);
  assert.match(aspect, /rebelion-moot__recorded/);
  assert.match(aspect, /unmatchedDecisions/);
  assert.match(source, /buildRollResolution/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /roll\.toMessage/);
  assert.match(migration, /isNewerVersion\("0\.7\.1"/);
});

test("Rebellion owns usable window geometry and full-width vertical tab sections", async () => {
  const [source, styles] = await Promise.all([
    read("module/blades-rebelion-sheet.js"),
    read("scss/import/rebelion-sheet.scss"),
  ]);
  assert.match(source, /position:\s*\{\s*width:\s*900,\s*height:\s*760\s*\}/);
  assert.match(styles, /min-width:\s*440px/);
  assert.match(styles, /min-height:\s*560px/);
  assert.match(styles, /\.rebelion-sheet__content\s*\{\s*display:\s*block/);
  assert.match(styles, /\.rebelion-sheet__content\s*>\s*\.rebelion-sheet__panel\.active\s*\{\s*width:\s*100%/);
  assert.match(styles, /\.rebelion-sheet__content\s*>\s*\.rebelion-sheet__panel\.active\s*\{[\s\S]*?scrollbar-gutter:\s*auto/);
  assert.match(styles, /\.rebelion-settlements,[\s\S]*\.rebelion-conclave,[\s\S]*\.rebelion-legacy\s*\{[\s\S]*display:\s*block;[\s\S]*width:\s*100%/);
});

test("Rebellion reuses the shared portrait and always opens a valid dashboard section", async () => {
  const [template, source, styles] = await Promise.all([
    read("templates/rebelion-sheet.html"),
    read("module/blades-rebelion-sheet.js"),
    read("scss/import/rebelion-sheet.scss"),
  ]);
  assert.match(template, /rebelion-sheet__header sheet-identity bw-section-frame/);
  assert.match(template, /parts\/sheet-identity-portrait\.html" img=img name=name editable=editable/);
  assert.match(source, /this\._ensureValidPrimaryTab\(context\)/);
  assert.match(source, /const validTabs = \["aspects", "territories", "conclave"\]/);
  assert.match(source, /this\.tabGroups\.primary = "aspects"/);
  assert.match(styles, /--bw-portrait-size:\s*132px/);
  assert.match(styles, /grid-template-columns:\s*132px minmax\(180px, 0\.72fr\) minmax\(320px, 1\.55fr\)/);
});

test("Rebellion main information aligns shared Name and Tyranny fields", async () => {
  const [template, styles, identityStyles] = await Promise.all([
    read("templates/rebelion-sheet.html"),
    read("scss/import/rebelion-sheet.scss"),
    read("scss/import/sheet-identity.scss"),
  ]);

  assert.match(template, /class="sheet-identity__field-box rebelion-tyranny"/);
  assert.match(template, /class="bw-text-field"[^>]*data-tyranny-input/);
  assert.match(styles, /\.rebelion-sheet__header\s*\{[\s\S]*?padding:\s*14px/);
  assert.match(styles, /\.rebelion-tyranny\s*\{[\s\S]*?margin-bottom:\s*8px/);
  assert.match(styles, /\.rebelion-tyranny__control\s*\{[\s\S]*?grid-template-columns:\s*2\.75rem minmax\(0, 1fr\)/);
  assert.match(styles, /\.rebelion-tyranny > label\s*\{[\s\S]*?font-size:\s*0\.78rem[\s\S]*?text-transform:\s*uppercase/);
  assert.match(styles, /\.rebelion-sheet__trackers > \.rebelion-tracker\s*\{[\s\S]*?width:\s*fit-content[\s\S]*?padding-right:\s*10px[\s\S]*?border-top:\s*1px solid var\(--bw-rule\)/);
  assert.match(identityStyles, /\.bw-text-field\s*\{[\s\S]*?background:\s*#fff[\s\S]*?color:\s*var\(--bw-ink\)/);
});

test("Rebellion Aspects reuse the complete Character/Mask Trait-card palette", async () => {
  const [sheet, aspect, trait, sharedStyles, traitStyles] = await Promise.all([
    read("templates/rebelion-sheet.html"),
    read("templates/rebelion-sheet/aspect-section.html"),
    read("templates/parts/actor/trait-card.html"),
    read("scss/import/general-styles.scss"),
    read("scss/import/trait-card.scss"),
  ]);
  assert.match(aspect, /class="bw-ruled-card bw-ruled-card--trait-palette rebelion-aspect-summary"/);
  assert.match(aspect, /<header class="bw-ruled-card__title-band">\s*<h2 class="bw-ruled-card__title"/);
  assert.match(sheet, /<summary class="bw-ruled-card__title-band"><span class="bw-ruled-card__title">\{\{localize "BITD\.RebellionGoingUnderground"\}\}<\/span><\/summary>/);
  assert.match(aspect, /<div class="bw-ruled-card__body">/);
  assert.match(trait, /class="item trait-card bw-ruled-card bw-ruled-card--trait-palette"/);
  assert.match(sharedStyles, /\.bw-ruled-card--trait-palette\s*\{[\s\S]*?--bw-ruled-card-title-band:\s*#e0d7c5;/);
  assert.match(sharedStyles, /\.bw-ruled-card__title-band\s*\{[\s\S]*?background:\s*var\(--bw-ruled-card-title-band\);/);
  assert.doesNotMatch(traitStyles, /background:\s*#e0d7c5/);
});

test("Rebellion Aspect headers keep title and explicit Rank together above progress", async () => {
  const [aspect, styles] = await Promise.all([
    read("templates/rebelion-sheet/aspect-section.html"),
    read("scss/import/rebelion-sheet.scss"),
  ]);

  assert.match(aspect, /<header class="bw-ruled-card__title-band">[\s\S]*?<h2[^>]*>\{\{aspect\.name\}\}<\/h2>[\s\S]*?<span>\{\{localize "BITD\.RebellionAspectRank" rank=aspect\.rank\}\}<\/span>[\s\S]*?<\/header>/);
  assert.match(aspect, /<div class="bw-ruled-card__body">[\s\S]*?sheet-identity-tracker\.html/);
  assert.match(styles, /\.rebelion-aspect-summary > \.bw-ruled-card__title-band\s*\{[\s\S]*?display:\s*flex[\s\S]*?justify-content:\s*space-between/);
  assert.match(aspect, /<\/div>\s*\{\{#if aspect\.nextMootRank\}\}\s*<footer class="rebelion-aspect-summary__footer">/);
  assert.match(aspect, /<footer class="rebelion-aspect-summary__footer">[\s\S]*?Next Moot at Rank \{\{aspect\.nextMootRank\}\}[\s\S]*?<\/footer>/);
  assert.match(styles, /\.rebelion-aspect-summary\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\) auto;[\s\S]*?height:\s*100%/);
  assert.match(styles, /\.rebelion-aspect-summary__footer\s*\{[\s\S]*?padding:\s*8px 12px 13px;[\s\S]*?border-top:\s*1px solid var\(--bw-rule\)/);
  assert.doesNotMatch(styles, /\.rebelion-aspect__next-moot\s*\{[\s\S]*?margin:\s*auto/);
});

test("Rebellion composes three Aspect-owned cards without a duplicate downtime section", async () => {
  const [sheet, aspect, moot, styles] = await Promise.all([
    read("templates/rebelion-sheet.html"),
    read("templates/rebelion-sheet/aspect-section.html"),
    read("templates/rebelion-sheet/moot-section.html"),
    read("scss/import/rebelion-sheet.scss"),
  ]);

  assert.match(sheet, /class="rebelion-aspects-grid"[\s\S]*?#each rebellion\.aspects[\s\S]*?aspect-section\.html/);
  assert.doesNotMatch(sheet, /rebelion-downtime|rebellion\.entitlements|class="rebelion-moots"/);
  assert.match(aspect, /aspect\.entitlement\.count/);
  assert.match(aspect, /aspect\.entitlement\.actions/);
  assert.match(aspect, /Next Moot at Rank \{\{aspect\.nextMootRank\}\}/);
  assert.match(aspect, /moot-section\.html" aspect=aspect/);
  assert.match(moot, /^\{\{#if aspect\.hasMootContent\}\}/);
  assert.match(moot, /aspect\.unansweredMoots/);
  assert.match(moot, /class="rebelion-moot__heading"/);
  assert.match(styles, /\.rebelion-moot__heading\s*\{[\s\S]*?color:\s*var\(--bw-ink\)/);
  assert.match(moot, /<details class="rebelion-moot__history">/);
  assert.match(styles, /\.rebelion-aspects-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.rebelion-aspect__downtime small\s*\{[\s\S]*?font-size:\s*0\.9rem;[\s\S]*?line-height:\s*1\.35;/);
  assert.match(styles, /@container \(max-width: 760px\)[\s\S]*?\.rebelion-aspects-grid[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@container \(max-width: 520px\)[\s\S]*?\.rebelion-aspects-grid[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.doesNotMatch(styles, /rebelion-downtime/);
});

test("Rebellion projects rank-zero, unanswered, history-only, and maximum Aspect states", () => {
  const decision = {
    id: "organization-rank-1",
    title: "Organization choice",
    aspect: "Organization",
    rank: 1,
    choices: ["A", "B"],
    description: "Choose.",
    sourceUuid: "Manual.organization.rank1",
  };
  const system = rank => ({
    aspects: [
      { name: "Organization", rank, progress: [0, 0, 0], decisions: [] },
      { name: "Force", rank: 0, progress: [0, 0, 0], decisions: [] },
      { name: "Influence", rank: 0, progress: [0, 0, 0], decisions: [] },
    ],
  });

  const rankZero = projectRebellion(system(0), [decision]).aspects[0];
  assert.equal(rankZero.entitlement.count, 0);
  assert.equal(rankZero.nextMootRank, 1);
  assert.equal(rankZero.hasMootContent, false);

  const unanswered = projectRebellion(system(1), [decision]).aspects[0];
  assert.equal(unanswered.entitlement.count, 1);
  assert.equal(unanswered.unansweredMoots.length, 1);
  assert.equal(unanswered.hasMootContent, true);

  const answeredSystem = system(1);
  answeredSystem.aspects[0].decisions.push({
    id: "saved-decision",
    catalogueId: decision.id,
    sourceUuid: decision.sourceUuid,
    title: decision.title,
    rank: 1,
    selectedChoice: "A",
  });
  const historyOnly = projectRebellion(answeredSystem, [decision]).aspects[0];
  assert.equal(historyOnly.unansweredMoots.length, 0);
  assert.equal(historyOnly.recordedMoots.length, 1);
  assert.equal(historyOnly.hasMootContent, true);

  const maximum = projectRebellion(system(3), [decision]).aspects[0];
  assert.equal(maximum.entitlement.count, 3);
  assert.equal(maximum.nextMootRank, null);
  assert.equal(maximum.currentProgress, 8);
  assert.equal(maximum.currentMaximum, 8);
});
