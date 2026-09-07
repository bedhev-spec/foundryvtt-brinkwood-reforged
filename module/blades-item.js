import { BladesHelpers } from "./blades-helpers.js";

/**
 * Extend the basic Item
 * @extends {Item}
 */
export class BladesItem extends foundry.documents.Item {

  /** @override */
  async _preCreate( data, options, user ) {
    await super._preCreate( data, options, user );
    let removeItems = [];
    // Mask configuration is an actor-level create -> grant -> remove command.
    // Let it retire the old Mask only after the replacement is committed.
    const isMaskConfiguration = data.type === "mask" && options?.brinkwoodConfigureMask;
    const isActionDotConfiguration = ["class", "profession"].includes(data.type)
      && options?.brinkwoodConfigureActionDotSource;
    // Trait synchronization already holds the actor lifecycle queue. The
    // legacy same-name duplicate hook would re-enter actor deletion and wait
    // for that queue, so managed grants must bypass it.
    const isManagedTraitGrant = data.type === "trait" && options?.brinkwoodTraitGrant;
    if( !isMaskConfiguration && !isActionDotConfiguration && !isManagedTraitGrant && user.id === game.user.id ) {
      let actor = this.parent ? this.parent : null;
      if( actor?.documentName === "Actor" ) {
        removeItems = BladesHelpers.removeDuplicatedItemType( data, actor );
      }
      if( removeItems.length !== 0 ) {
        await actor.deleteEmbeddedDocuments( "Item", removeItems );
      }
    }
  }

  async _onCreate(data, options, user) {
    await super._onCreate(data, options, user);
    let item = this;
    //Append new items automaticaly to the characters item list
    if ( data.type == "item" && data.system.class == "" && !this.isEmbedded ) {
      await item.setFlag("brinkwood-reforged", "parentItem_id", item._id);
      for (const actor of game.actors.filter(a => a.type == "character")) {
        await actor.createEmbeddedDocuments("Item", [item.toObject()]);
      }
    }
  }


  async _onDelete(options, user) {
    await super._onDelete(options, user);
    let item = this;
    //Remove deleted basic items from characters item list
    if ( item.type == "item" && item.system.class == "" && !item.isEmbedded ) {
      for (const actor of game.actors.filter(a => a.type == "character")) {
        let itemsForDeletion = actor.items
          .filter(i => i.getFlag("brinkwood-reforged", "parentItem_id") == item._id)
          .map(i => i._id);
        await actor.deleteEmbeddedDocuments("Item", itemsForDeletion);
      }
    }
  }



  /* -------------------------------------------- */

  /* override */
  prepareData() {

    super.prepareData();

    const item_data = this.system;
  }


  /**
   * Prepares Cohort data
   *
   * @param {object} data
   */
  _prepareCohort(item_data) {

    let quality = 0;
    let scale = 0;

    // Adds Scale and Quality
    if (this.actor?.system) {
      switch (item_data.cohort) {
        case "Gang":
          scale = parseInt(this.actor.system.tier);
          quality = parseInt(this.actor.system.tier);
          break;
        case "Expert":
          scale = 0;
          quality = parseInt(this.actor.system.tier) + 1;
          break;
      }
    }

    this.system.scale = scale;
    this.system.quality = quality;
}
}
