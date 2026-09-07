export const GLOBAL_CLOCK_SIZES = Object.freeze([2, 3, 4, 5, 6, 8, 10, 12]);
export const GLOBAL_CLOCK_MAX_SIZE = 12;
export const GLOBAL_CLOCK_LOCATIONS = Object.freeze(["topRight", "bottomRight"]);
export const GLOBAL_CLOCK_FACE_BACKGROUND = "rgb(210 212 215)";
const LEGACY_GLOBAL_CLOCK_FACE_BACKGROUND = "rgba(20, 16, 18, 0.78)";

/** Keep deprecated and malformed placement settings on the right-hand HUD. */
export function normalizeGlobalClockLocation(location) {
  return location === "topRight" ? "topRight" : "bottomRight";
}

export function clampGlobalClockValue(value, maximum) {
  const max = Math.max(1, Math.min(GLOBAL_CLOCK_MAX_SIZE, Number(maximum) || 4));
  return Math.max(0, Math.min(max, Number(value) || 0));
}

export function normalizeGlobalClock(data = {}) {
  const max = Math.max(1, Math.min(GLOBAL_CLOCK_MAX_SIZE, Number(data.max) || 4));
  return {
    id: data.id ?? null,
    name: String(data.name ?? "").trim(),
    value: clampGlobalClockValue(data.value, max),
    max,
    color: String(data.color || "#8f2f35"),
    backgroundColor: !data.backgroundColor || data.backgroundColor === LEGACY_GLOBAL_CLOCK_FACE_BACKGROUND
      ? GLOBAL_CLOCK_FACE_BACKGROUND
      : String(data.backgroundColor),
    private: Boolean(data.private),
  };
}

export function nextGlobalClockValue(value, maximum) {
  const max = Math.max(1, Number(maximum) || 1);
  const current = clampGlobalClockValue(value, max);
  return current >= max ? 0 : current + 1;
}

export function previousGlobalClockValue(value, maximum) {
  const max = Math.max(1, Number(maximum) || 1);
  const current = clampGlobalClockValue(value, max);
  return current <= 0 ? max : current - 1;
}
