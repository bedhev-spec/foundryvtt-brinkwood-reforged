/**
 * TypeDataModel definitions for Item document types in the Brinkwood system.
 * Registered in blades.js via CONFIG.Item.dataModels.
 *
 * All schemas include every field observed in existing LevelDB pack data
 * (including fields absent from template.json such as `logic`) so that packs
 * load without data loss or validation errors.
 */

const { TypeDataModel } = foundry.abstract;
const { fields } = foundry.data;

/* -------------------------------------------- */
/*  Shared template-field factories             */
/* -------------------------------------------- */

/**
 * Returns the standard `activatedEffect` template fields as a plain object
 * ready to spread into a defineSchema() return.
 *
 * Used by Item types that reference the `activatedEffect` template in
 * template.json (item, mask) and by any Item whose pack data contains these
 * fields regardless of the original template declaration.
 *
 * `uses` is the nested-object flavour `{value, max, per}` used by non-item
 * types (mask items).  The `item` type overrides `uses` with a flat Number.
 * @returns {object}
 */
function activatedEffectSchema() {
  return {
    activation: new fields.SchemaField({
      type:      new fields.StringField({ required: false, initial: "" }),
      cost:      new fields.NumberField({ required: false, nullable: true, initial: 0 }),
      condition: new fields.StringField({ required: false, initial: "" })
    }),
    duration: new fields.SchemaField({
      value: new fields.NumberField({ required: false, nullable: true, initial: null }),
      units: new fields.StringField({ required: false, initial: "" })
    }),
    target: new fields.SchemaField({
      value: new fields.NumberField({ required: false, nullable: true, initial: null }),
      width: new fields.NumberField({ required: false, nullable: true, initial: null }),
      units: new fields.StringField({ required: false, initial: "" }),
      type:  new fields.StringField({ required: false, initial: "" })
    }),
    range: new fields.SchemaField({
      value: new fields.NumberField({ required: false, nullable: true, initial: null }),
      long:  new fields.NumberField({ required: false, nullable: true, initial: null }),
      units: new fields.StringField({ required: false, initial: "" })
    }),
    uses: new fields.SchemaField({
      value: new fields.NumberField({ required: false, nullable: true, initial: 0 }),
      max:   new fields.NumberField({ required: false, nullable: true, initial: 0 }),
      per:   new fields.StringField({ required: false, nullable: true, initial: null })
    }),
    consume: new fields.SchemaField({
      type:   new fields.StringField({ required: false, initial: "" }),
      target: new fields.StringField({ required: false, nullable: true, initial: null }),
      amount: new fields.NumberField({ required: false, nullable: true, initial: null })
    })
  };
}

/* -------------------------------------------- */
/*  Item: item                                  */
/* -------------------------------------------- */

export class ItemData extends TypeDataModel {

  /** @override */
  static defineSchema() {
    return {
      description:    new fields.HTMLField({ required: false, initial: "" }),
      // `logic` appears in pack data but is absent from template.json
      logic:          new fields.StringField({ required: false, initial: "" }),
      class:          new fields.StringField({ required: false, initial: "" }),
      load:           new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true }),
      // `uses` for the `item` type is a flat number (overrides the activatedEffect template)
      uses:           new fields.NumberField({ required: false, nullable: false, initial: 1 }),
      additional_info: new fields.StringField({ required: false, initial: "" }),
      equipped:       new fields.BooleanField({ required: false, initial: false }),
      num_available:  new fields.NumberField({ required: false, nullable: false, initial: 1, integer: true }),
      // activatedEffect template fields (activation, duration, target, range, consume)
      activation: new fields.SchemaField({
        type:      new fields.StringField({ required: false, initial: "" }),
        cost:      new fields.NumberField({ required: false, nullable: true, initial: 0 }),
        condition: new fields.StringField({ required: false, initial: "" })
      }),
      duration: new fields.SchemaField({
        value: new fields.NumberField({ required: false, nullable: true, initial: null }),
        units: new fields.StringField({ required: false, initial: "" })
      }),
      target: new fields.SchemaField({
        value: new fields.NumberField({ required: false, nullable: true, initial: null }),
        width: new fields.NumberField({ required: false, nullable: true, initial: null }),
        units: new fields.StringField({ required: false, initial: "" }),
        type:  new fields.StringField({ required: false, initial: "" })
      }),
      range: new fields.SchemaField({
        value: new fields.NumberField({ required: false, nullable: true, initial: null }),
        long:  new fields.NumberField({ required: false, nullable: true, initial: null }),
        units: new fields.StringField({ required: false, initial: "" })
      }),
      consume: new fields.SchemaField({
        type:   new fields.StringField({ required: false, initial: "" }),
        target: new fields.StringField({ required: false, nullable: true, initial: null }),
        amount: new fields.NumberField({ required: false, nullable: true, initial: null })
      })
    };
  }
}

/* -------------------------------------------- */
/*  Item: class                                 */
/* -------------------------------------------- */

export class ClassData extends TypeDataModel {

  /** @override */
  static defineSchema() {
    return {
      description:     new fields.HTMLField({ required: false, initial: "" }),
      logic:           new fields.StringField({ required: false, initial: "" }),
      experience_clues: new fields.ArrayField(new fields.StringField()),
      // Class-specific default attribute levels — complex nested, preserve verbatim
      attributes:      new fields.ObjectField()
    };
  }
}

/* -------------------------------------------- */
/*  Item: trait                                 */
/* -------------------------------------------- */

export class TraitData extends TypeDataModel {

  /** @override */
  static defineSchema() {
    return {
      description:   new fields.HTMLField({ required: false, initial: "" }),
      logic:         new fields.StringField({ required: false, initial: "" }),
      class:         new fields.StringField({ required: false, initial: "" }),
      price:         new fields.NumberField({ required: false, nullable: false, initial: 1, integer: true }),
      purchased:     new fields.BooleanField({ required: false, initial: false }),
      class_default: new fields.BooleanField({ required: false, initial: false }),
      alchemicBlood: new fields.SchemaField({
        effects: new fields.SchemaField({
          soporific: new fields.BooleanField({ required: false, initial: false }),
          ashen: new fields.BooleanField({ required: false, initial: false }),
          caustic: new fields.BooleanField({ required: false, initial: false }),
          flechette: new fields.BooleanField({ required: false, initial: false }),
          naptha: new fields.BooleanField({ required: false, initial: false }),
          narcotic: new fields.BooleanField({ required: false, initial: false })
        })
      })
    };
  }
}

/* -------------------------------------------- */
/*  Item: upbringing                            */
/* -------------------------------------------- */

export class UpbringingData extends TypeDataModel {

  /** @override */
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, initial: "" }),
      logic:       new fields.StringField({ required: false, initial: "" })
    };
  }
}

/* -------------------------------------------- */
/*  Item: profession                            */
/* -------------------------------------------- */

export class ProfessionData extends TypeDataModel {

  /** @override */
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, initial: "" }),
      logic:       new fields.StringField({ required: false, initial: "" }),
      // Profession-specific default attribute levels — preserve verbatim
      attributes:  new fields.ObjectField()
    };
  }
}

/* -------------------------------------------- */
/*  Item: pact                                  */
/* -------------------------------------------- */

export class PactData extends TypeDataModel {

  /** @override */
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, initial: "" }),
      logic:       new fields.StringField({ required: false, initial: "" })
    };
  }
}

/* -------------------------------------------- */
/*  Item: associates                            */
/* -------------------------------------------- */

export class AssociatesData extends TypeDataModel {

  /** @override */
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, initial: "" })
    };
  }
}

/* -------------------------------------------- */
/*  Item: mask                                  */
/* -------------------------------------------- */

export class MaskItemData extends TypeDataModel {

  /** @override */
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, initial: "" }),
      logic:       new fields.StringField({ required: false, initial: "" }),
      // Full activatedEffect template including nested uses {value, max, per}
      ...activatedEffectSchema()
    };
  }
}

/* -------------------------------------------- */
/*  Item: moot_decision                         */
/* -------------------------------------------- */

export class MootDecisionData extends TypeDataModel {

  /** @override */
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, initial: "" }),
      // Canonical Moot pack data stores the two choices by numbered key.
      choice: new fields.SchemaField({
        0: new fields.StringField({ required: false, initial: "" }),
        1: new fields.StringField({ required: false, initial: "" })
      }),
      aspect:   new fields.StringField({ required: false, initial: "" }),
      rank:     new fields.NumberField({ required: false, nullable: true, initial: null })
    };
  }
}
