const VALID_POSITIONS = new Set(["controlled", "risky", "desperate"]);
const VALID_EFFECTS = new Set(["limited", "standard", "great"]);

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function normalizeChoice(value, validValues) {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  return validValues.has(normalized) ? normalized : "";
}

/**
 * Resolve every input which contributes to a Brinkwood dice pool.
 * Keeping this pure makes the calculation independently testable and gives
 * chat cards a complete, stable description of what was rolled.
 */
export function buildRollResolution({
  baseDice = 0,
  modifiers = [],
  position = "",
  effect = ""
} = {}) {
  const normalizedBaseDice = toInteger(baseDice);
  const normalizedModifiers = (Array.isArray(modifiers) ? modifiers : [])
    .map((modifier, index) => {
      const value = toInteger(modifier?.value);
      return {
        label: modifier?.label || "BITD.Modifier",
        value,
        sign: value < 0 ? "−" : "+",
        absoluteValue: Math.abs(value),
        order: index
      };
    });
  const modifierTotal = normalizedModifiers.reduce((total, modifier) => total + modifier.value, 0);
  const unclampedDicePool = normalizedBaseDice + modifierTotal;
  const dicePool = Math.max(0, unclampedDicePool);
  const wasClamped = unclampedDicePool < 0;
  const zeroMode = dicePool === 0;

  return {
    baseDice: normalizedBaseDice,
    modifiers: normalizedModifiers,
    modifierTotal,
    unclampedDicePool,
    dicePool,
    wasClamped,
    zeroMode,
    rolledDice: zeroMode ? 2 : dicePool,
    keep: zeroMode ? "lowest" : "highest",
    position: normalizeChoice(position, VALID_POSITIONS),
    effect: normalizeChoice(effect, VALID_EFFECTS)
  };
}

/** Read a DialogV2 form while retaining compatibility with legacy Dialog roots. */
export function readRollDialogValues(dialog) {
  const root = dialog?.element ?? dialog;
  const read = name => root?.querySelector?.(`[name="${name}"]`)?.value ?? "";
  const modifier = Number.parseInt(read("mod"), 10);

  return {
    modifier: Number.isFinite(modifier) ? modifier : 0,
    position: read("pos"),
    effect: read("fx"),
    note: read("note")
  };
}
