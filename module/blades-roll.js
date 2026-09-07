import { BladesHelpers, capitalize } from "./blades-helpers.js";
import { buildRollResolution } from "./roll-resolution.js";
import { recordActionRoll } from "./roll-statistics.js";

/**
 * Roll Dice.
 * @param {int} dice_amount
 * @param {string} attribute_name
 * @param {string} position
 * @param {string} effect
 */
export async function bladesRoll(dice_amount, attribute_label = "", position = "risky", effect = "standard", note = "", options = {}) {
  const calculation = buildRollResolution({
    baseDice: dice_amount,
    modifiers: options.modifiers,
    position,
    effect
  });
  const zeromode = calculation.zeroMode;
  let r = new foundry.dice.Roll(`${calculation.rolledDice}d6`, {});

  // show 3d Dice so Nice if enabled
  await r.evaluate();
  await showChatRollMessage(r, zeromode, attribute_label, calculation.position, calculation.effect, note, calculation);
}

/**
 * Shows Chat message.
 *
 * @param {Roll} r
 * @param {Boolean} zeromode
 * @param {String} attribute_name
 * @param {string} position
 * @param {string} effect
 */
async function showChatRollMessage(r, zeromode, attribute_label = "", position = "", effect = "", note = "", calculation = {}) {

  const speaker = foundry.documents.ChatMessage.getSpeaker();
  const rolls = r.dice[0].results;
	const position_localize = `BITD.Position${capitalize(position)}`;
	const effect_localize = `BITD.Effect${capitalize(effect)}`;

  const roll_status = getBladesRollStatus(rolls, zeromode);

  let result;

	const rollType = BladesHelpers.rollType(attribute_label);
	switch ( rollType ) {
 		case 'resist':
      const stress = getBladesRollStress(rolls, zeromode);
      result = await foundry.applications.handlebars.renderTemplate("systems/brinkwood-reforged/templates/chat/resistance-roll.html", {rolls: rolls, roll_status: roll_status, attribute_label: attribute_label, stress: stress, note: note, calculation: calculation});
    	break;
		case 'essence':
      const essence = getBladesRollEssence(rolls, zeromode);
      result = await foundry.applications.handlebars.renderTemplate('systems/brinkwood-reforged/templates/chat/essence-roll.html', {rolls: rolls, roll_status: roll_status, attribute_label: attribute_label, essence: essence, note: note, calculation: calculation});
			break;
  	default:
      result = await foundry.applications.handlebars.renderTemplate("systems/brinkwood-reforged/templates/chat/action-roll.html", {rolls: rolls, roll_status: roll_status, attribute_label: attribute_label, position: position, position_localize: position_localize, effect: effect, effect_localize: effect_localize, note: note, calculation: calculation});
 
	}

  const rollRecord = rollType === "action" && attribute_label ? {
    version: 1,
    userId: game.user?.id,
    actorId: speaker.actor ?? null,
    attributeLabel: attribute_label,
    outcome: roll_status,
    dicePool: calculation.dicePool,
    zeroMode: calculation.zeroMode,
    position,
    effect,
    modifiers: calculation.modifiers.map(({ label, value }) => ({ label, value }))
  } : null;
  let messageData = {
    speaker: speaker,
    content: result,
    style: CONST.CHAT_MESSAGE_STYLES.ROLL,
    rolls: [r],
    ...(rollRecord ? { flags: { "brinkwood-reforged": { roll: rollRecord } } } : {})
  }

  await CONFIG.ChatMessage.documentClass.create(messageData, {});
  if (rollRecord) {
    try {
      await recordActionRoll(rollRecord);
    } catch (error) {
      console.warn("Brinkwood | Could not update player roll statistics", error);
    }
  }
}

/**
 * Get status of the Roll.
 *  - failure
 *  - partial-success
 *  - success
 *  - critical-success
 * @param {Array} rolls
 * @param {Boolean} zeromode
 */
export function getBladesRollStatus(rolls, zeromode = false) {

  // Sort roll values from lowest to highest.
  let sorted_rolls = rolls.map(i => i.result).sort();

  let roll_status = "failure"

  if (sorted_rolls[0] === 6 && zeromode) {
    roll_status = "success";
  }
  else {
    let use_die;
    let prev_use_die = false;

    if (zeromode) {
      use_die = sorted_rolls[0];
    }
    else {
      use_die = sorted_rolls[sorted_rolls.length - 1];

      if (sorted_rolls.length - 2 >= 0) {
        prev_use_die = sorted_rolls[sorted_rolls.length - 2]
      }
    }

    // 1,2,3 = failure
    if (use_die <= 3) {
      roll_status = "failure";
    }
    // if 6 - check the prev highest one.
    else if (use_die === 6) {
      // 6,6 - critical success
      if (prev_use_die && prev_use_die === 6) {
        roll_status = "critical-success";
      }
      // 6 - success
      else {
        roll_status = "success";
      }
    }
    // else (4,5) = partial success
    else {
      roll_status = "partial-success";
    }

  }

  return roll_status;

}
/**
 * Get stress of the Roll.
 * @param {Array} rolls
 * @param {Boolean} zeromode
 */
export function getBladesRollStress(rolls, zeromode = false) {
  const sortedRolls = rolls.map(roll => Number(roll.result)).sort((left, right) => left - right);
  const highest = zeromode ? sortedRolls[0] : sortedRolls.at(-1);
  const previous = zeromode ? undefined : sortedRolls.at(-2);

  if (!zeromode && highest === 6 && previous === 6) return 0;
  if (highest === 6) return 1;
  if (highest >= 4) return 2;
  return 3;

}

export function getBladesRollEssence(rolls, zeromode = false) {

  // Sort roll values from lowest to highest.
  const sorted_rolls = rolls.map(i => i.result).sort().reverse();
	const high_roll = ( zeromode ? sorted_rolls[1] : sorted_rolls[0] );
	let essence = 0;
 
	switch ( high_roll ) {
		case 6:
			essence = ( !zeromode && sorted_rolls[1] == 6 ? 6 : 5 )
		  break;
		case 5:
		case 4:
			essence = 4;
			break;
		default:
      essence = 2;
	}

  return essence;
}



/**
 * Call a Roll popup.
 */
export async function simpleRollPopup() {

  const values = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("BITD.SimpleRoll") },
    content: `
      <h2>${game.i18n.localize("BITD.RollSomeDice")}</h2>
      <p>${game.i18n.localize("BITD.RollTokenDescription")}</p>
      <form>
        <div class="form-group">
          <label>${game.i18n.localize("BITD.RollNumberOfDice")}:</label>
          <select id="qty" name="qty">
            ${Array(11).fill().map((item, i) => `<option value="${i}">${i}d</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('BITD.Notes')}:</label>
          <input id="note" name="note" type="text" value="">
        </div><br/>
      </form>
    `,
    buttons: [{
      action: "roll",
        icon: "<i class='fas fa-check'></i>",
        label: `Roll`,
        default: true,
        callback: (_event, button, dialog) => {
          const form = button.form ?? dialog.element.querySelector("form");
          return {
            diceQty: Number(form?.elements.qty?.value ?? 0),
            note: form?.elements.note?.value ?? "",
          };
        },
      },
      {
        action: "cancel",
        icon: "<i class='fas fa-times'></i>",
        label: game.i18n.localize('Cancel'),
      },
    ],
    rejectClose: false,
  });

  if (!values) return;
  await bladesRoll(values.diceQty, "", "", "", values.note);
}
