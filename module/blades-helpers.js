import { CharacterData, MaskActorData } from "./data/actor-data-models.js";

/**
 * Capitalise the first character of a string.
 * Replaces the former String.prototype.capitalize extension.
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export class BladesHelpers {

  /**
   * Identifies duplicate items by type and returns a array of item ids to remove
   *
   * @param {Object} item_data
   * @param {Document} actor
   * @returns {Array}
   *
   */
  static removeDuplicatedItemType(item_data, actor) {
    let dupe_list = [];
    let distinct_types = ["upbringing", "profession", "class", "mask", "heritage", "pact"];
    let allowed_types = ["item"];
    let should_be_distinct = distinct_types.includes(item_data.type);
    // If the Item has the exact same name - remove it from list.
    // Remove Duplicate items from the array.
    actor.items.forEach( i => {
      let has_double = (item_data.type === i.type);
      if ( ( ( i.name === item_data.name ) || ( should_be_distinct && has_double ) ) && !( allowed_types.includes( item_data.type ) ) && ( item_data._id !== i.id ) ) {
        dupe_list.push (i.id);
      }
    });

    return dupe_list;
  }

  /**
   * Get a nested dynamic attribute.
   * @param {Object} obj
   * @param {string} property
   */
  static getNestedProperty(obj, property) {
    return property.split('.').reduce((r, e) => {
        return r[e];
    }, obj);
  }


  /**
   * Add item functionality
   */
  static _addOwnedItem(event, actor) {

    event.preventDefault();
    const a = event.currentTarget;
    const item_type = a.dataset.itemType;

    let data = {
      name: foundry.utils.randomID(),
      type: item_type
    };
    return actor.createEmbeddedDocuments("Item", [data]);
  }

  /* -------------------------------------------- */

  /**
   * Returns the label for attribute.
   *
   * @param {string} attribute_name
   * @returns {string}
   */
  static getAttributeLabel(attribute_name) {
    let attribute_labels = {};
    const attributes = { ...MaskActorData.ATTRIBUTES, ...CharacterData.ATTRIBUTES };

    for (const att_name in attributes) {
      attribute_labels[att_name] = attributes[att_name].label;
      for (const skill_name in attributes[att_name].skills) {
        attribute_labels[skill_name] = attributes[att_name].skills[skill_name].label;
      }
    }
    return `${attribute_labels[attribute_name]}.Name`;
  }

  /**
   * Returns true if the attribute is an action
   *
   * @param {string} attribute_name
   * @returns {Boolean}
   */
  static isAttributeAction(attribute_name) {
    const model_attributes = CharacterData.ATTRIBUTES;

    return !Object.keys(model_attributes).some(attr => attribute_name.toLowerCase().includes(attr));
  }

  static rollType(attribute_name) {
    const model_attributes = CharacterData.ATTRIBUTES;
		let type = '';
    if ( Object.keys(model_attributes).some(attr => attribute_name.toLowerCase().includes(attr)) ) {
			type = 'resist';
		} else if ( attribute_name.includes("Essence") ) {
			type = 'essence';
		} else {
			type = 'action';
		}
    
		return type;
	}

  /* -------------------------------------------- */

  /**
   * Creates options for faction clocks.
   *
   * @param {int[]} sizes
   *  array of possible clock sizes
   * @param {int} default_size
   *  default clock size
   * @param {int} current_size
   *  current clock size
   * @returns {string}
   *  html-formatted option string
   */
  static createListOfClockSizes( sizes, default_size, current_size ) {

    let text = ``;

    sizes.forEach( size => {
      text += `<option value="${size}"`;
      if ( !( current_size ) && ( size === default_size ) ) {
        text += ` selected`;
      } else if ( size === current_size ) {
        text += ` selected`;
      }

      text += `>${size}</option>`;
    });

    return text;

  }
}
