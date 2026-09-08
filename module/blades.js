/**
 * A simple and flexible system for world-building using an arbitrary collection of character and item attributes
 * Author: Atropos
 * Software License: GNU GPLv3
 */

// Import Modules
import { registerSystemSettings } from "./settings.js";
import { registerItemCreationTypeFilter } from "./item-creation-types.js";
import { preloadHandlebarsTemplates } from "./blades-templates.js";
import { bladesRoll, simpleRollPopup } from "./blades-roll.js";
import { BladesHelpers } from "./blades-helpers.js";
import { BladesActor } from "./blades-actor.js";
import { BladesItem } from "./blades-item.js";
import { BladesItemSheet } from "./blades-item-sheet.js";
import { BladesActorSheet } from "./blades-actor-sheet.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { BladesNPCSheet } from "./blades-npc-sheet.js";
import { BladesClockSheet } from "./blades-clock-sheet.js";
import { BladesMaskSheet } from "./blades-mask-sheet.js";
import { BladesRebelionSheet } from "./blades-rebelion-sheet.js";
import { showRollStatistics } from "./roll-statistics.js";
import { clockImagePath, prepareClockLabel } from "./clock-utils.js";
import { syncOpenActorTrackers } from "./sheet-tracker-sync.js";
import { registerGlobalClockSystem, startGlobalClockSystem } from "./global-clocks.js";


import * as migrations from "./migration.js";
import {
  CharacterData, ClockData, NpcData, MaskActorData, RebelionData
} from "./data/actor-data-models.js";
import {
  ItemData, ClassData, TraitData, UpbringingData, ProfessionData,
  PactData, AssociatesData, MaskItemData, MootDecisionData
} from "./data/item-data-models.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */
Hooks.once("init", async function() {

  Hooks.on("updateActor", (actor, changes) => syncOpenActorTrackers(actor, changes));
  game.blades = {
    dice: bladesRoll,
    rollStatistics: showRollStatistics
  };
  CONFIG.Item.documentClass = BladesItem;
  CONFIG.Actor.documentClass = BladesActor;
  CONFIG.ActiveEffect.documentClass = BladesActiveEffect;

  // Register typed data models (v13) — each Actor/Item type gets a TypeDataModel
  // that provides a validated schema.  These replace the legacy template.json model
  // access pattern (`game.system.model`) for type-specific data.
  CONFIG.Actor.dataModels = {
    "character":  CharacterData,
    "clock":      ClockData,
    "npc":        NpcData,
    "mask":       MaskActorData,
    "rebelion":   RebelionData
  };
  CONFIG.Item.dataModels = {
    "item":         ItemData,
    "class":        ClassData,
    "trait":        TraitData,
    "upbringing":   UpbringingData,
    "profession":   ProfessionData,
    "pact":         PactData,
    "associates":   AssociatesData,
    "mask":         MaskItemData,
    "moot_decision": MootDecisionData
  };

  // Register System Settings
  registerSystemSettings();
  registerItemCreationTypeFilter();
  registerGlobalClockSystem();

  // Register sheet application classes (ApplicationV2)
  const { DocumentSheetConfig } = foundry.applications.apps;
  // Unregister Foundry's default v2 sheets so ours take precedence
  DocumentSheetConfig.unregisterSheet(foundry.documents.Actor, "core", foundry.applications.sheets.ActorSheetV2);
  DocumentSheetConfig.registerSheet(foundry.documents.Actor, "brinkwood-reforged", BladesActorSheet, {
    types: ["character"],
    makeDefault: true,
    label: "Brinkwood Character Sheet",
  });
  DocumentSheetConfig.registerSheet(foundry.documents.Actor, "brinkwood-reforged", BladesNPCSheet, { types: ["npc"], makeDefault: true });
  DocumentSheetConfig.registerSheet(foundry.documents.Actor, "brinkwood-reforged", BladesClockSheet, { types: ["clock"], makeDefault: true });
  DocumentSheetConfig.registerSheet(foundry.documents.Actor, "brinkwood-reforged", BladesMaskSheet, { types: ["mask"], makeDefault: true });
  DocumentSheetConfig.registerSheet(foundry.documents.Actor, "brinkwood-reforged", BladesRebelionSheet, { types: ["rebelion"], makeDefault: true });
  DocumentSheetConfig.unregisterSheet(foundry.documents.Item, "core", foundry.applications.sheets.ItemSheetV2);
  DocumentSheetConfig.registerSheet(foundry.documents.Item, "brinkwood-reforged", BladesItemSheet, {makeDefault: true});
  await preloadHandlebarsTemplates();


  // Multiboxes – native DOM, no jQuery.
  Handlebars.registerHelper('multiboxes', function(selected, options) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = options.fn(this);
    const input = wrapper.querySelector(`input[type='radio'][value='${selected}']`);
    if (input) input.checked = true;
    return wrapper.innerHTML;
  });


  // Enrich the HTML replace /n with <br>
  Handlebars.registerHelper('html', (options) => {

    let text = options.hash['text'].replace(/\n/g, "<br />");

    return new Handlebars.SafeString(text);
  });

  // "N Times" loop for handlebars.
  //  Block is executed N times starting from n=1.
  //
  // Usage:
  // {{#times_from_1 10}}
  //   <span>{{this}}</span>
  // {{/times_from_1}}
  Handlebars.registerHelper('times_from_1', function(n, block) {
    var accum = '';
    for (var i = 1; i <= n; ++i) {
      accum += block.fn(i);
    }
    return accum;
  });

  // "N Times" loop for handlebars.
  //  Block is executed N times starting from n=0.
  //
  // Usage:
  // {{#times_from_0 10}}
  //   <span>{{this}}</span>
  // {{/times_from_0}}
  Handlebars.registerHelper('times_from_0', function(n, block) {

    var accum = '';
    for (var i = 0; i <= n; ++i) {
      accum += block.fn(i);
    }
    return accum;
  });

  Handlebars.registerHelper('contains', function(elem, list, options) {
    if(list.indexOf(elem) > -1) {
      return options.fn(this);
    }
      return options.inverse(this);
  });

	Handlebars.registerHelper("math", function(lvalue, operator, rvalue, options) {
			lvalue = parseFloat(lvalue);
			rvalue = parseFloat(rvalue);
					
			return {
					"+": lvalue + rvalue,
					"-": lvalue - rvalue,
					"*": lvalue * rvalue,
					"/": lvalue / rvalue,
					"%": lvalue % rvalue
			}[operator];
	});

  // Concat helper
  // https://gist.github.com/adg29/f312d6fab93652944a8a1026142491b1
  // Usage: (concat 'first 'second')
  Handlebars.registerHelper('concat', function() {
    var outStr = '';
    for(var arg in arguments){
        if(typeof arguments[arg]!='object'){
            outStr += arguments[arg];
        }
    }
    return outStr;
  });


  /**
   * @inheritDoc
   * Takes label from Selected option instead of just plain value.
   */

  Handlebars.registerHelper('selectOptionsWithLabel', function(choices, options) {

    const localize = options.hash['localize'] ?? false;
    let selected = options.hash['selected'] ?? null;
    let blank = options.hash['blank'] || null;
    selected = selected instanceof Array ? selected.map(String) : [String(selected)];

    // Create an option
    const option = (key, object) => {
      if ( localize ) object.label = game.i18n.localize(object.label);
      let isSelected = selected.includes(key);
      html += `<option value="${key}" ${isSelected ? "selected" : ""}>${object.label}</option>`
    };

    // Create the options
    let html = "";
    if ( blank ) option("", blank);
    Object.entries(choices).forEach(e => option(...e));

    return new Handlebars.SafeString(html);
  });


  /**
   * Create appropriate Blades clock
   */

  Handlebars.registerHelper('blades-clock', function(parameter_name, type, current_value, uniq_id, label=null) {
    let html = '';
    const { text: clockLabel, suffix: labelSuffix } = prepareClockLabel(label);
  
    if (current_value === null || current_value === 'null') {
      current_value = 0;
    }

    if (parseInt(current_value) > parseInt(type)) {
      current_value = type;
    }

    // Label for 0
    html += `<label class="clock-zero-label" for="clock-0-${uniq_id}${labelSuffix}" title="${clockLabel} 0/${type}"><i class="fab fa-creative-commons-zero nullifier" aria-hidden="true"></i><span class="clock-label">${clockLabel}</span></label>`;
    html += `<div id="blades-clock-${uniq_id}${labelSuffix}" class="blades-clock clock-${type} clock-${type}-${current_value}" style="background-image:url('${clockImagePath(type, current_value)}');">`;

    let zero_checked = (parseInt(current_value) === 0) ? 'checked' : '';
    html += `<input type="radio" value="0" id="clock-0-${uniq_id}${labelSuffix}" data-dType="Number" name="${parameter_name}" aria-label="${clockLabel} 0/${type}" ${zero_checked}>`;

    for (let i = 1; i <= parseInt(type); i++) {
      let checked = (parseInt(current_value) === i) ? 'checked' : '';
      html += `
        <input type="radio" value="${i}" id="clock-${i}-${uniq_id}${labelSuffix}" data-dType="Number" name="${parameter_name}" aria-label="${clockLabel} ${i}/${type}" ${checked}>
        <label for="clock-${i}-${uniq_id}${labelSuffix}" title="${clockLabel} ${i}/${type}"></label>
      `;
    }

    html += `</div>`;
    html += `<span class="clock-progress" aria-live="polite">${current_value}/${type}</span>`;
    return html;
  });
});

/**
 * Once the entire VTT framework is initialized, check to see if we should perform a data migration
 */
Hooks.once("ready", async function() {
  if (game.user.isGM && migrations.isMigrationAuthority()) {
    await migrations.migrateWorld();
  }
  await startGlobalClockSystem();
});

/*
 * Hooks
 */

Hooks.on("getSceneControlButtons", controls => {
  const tokenControls = controls.find(control => control.name === "token");
  if (!tokenControls) return;

  const tool = {
    name: "brinkwood-roll",
    title: game.i18n.localize("BITD.DiceRoll"),
    icon: "fas fa-dice",
    button: true,
    onChange: () => simpleRollPopup()
  };

  if (Array.isArray(tokenControls.tools)) tokenControls.tools.push(tool);
  else tokenControls.tools[tool.name] = tool;
});

/*
 * Functions
 */
