import { escapeHTML } from "./html-utils.js";

export function clockImagePath(type, value) {
  return `systems/brinkwood-reforged/styles/assets/progressclocks-svg/Progress Clock ${type}-${value}.svg`;
}

export function normalizeClockState(type, value) {
  const parsedType = Number(type);
  const maximum = [4, 6, 8].includes(parsedType) ? parsedType : 4;
  const parsedValue = Number(value);
  const currentValue = Number.isFinite(parsedValue)
    ? Math.min(maximum, Math.max(0, Math.trunc(parsedValue)))
    : 0;

  return { type: String(maximum), value: currentValue };
}

export function normalizeClockLabel(label) {
  return ["string", "number"].includes(typeof label) ? String(label) : "";
}

export function prepareClockLabel(label) {
  const raw = normalizeClockLabel(label);
  return {
    text: escapeHTML(raw),
    suffix: raw ? `-${raw.replace(/[^a-zA-Z0-9_-]/g, "-")}` : ""
  };
}

const clockImagePreloads = new Map();

export function preloadClockImages(type) {
  const { type: normalizedType } = normalizeClockState(type, 0);
  if (typeof Image === "undefined") return Promise.resolve();
  if (clockImagePreloads.has(normalizedType)) return clockImagePreloads.get(normalizedType);

  const loading = Promise.allSettled(Array.from({ length: Number(normalizedType) + 1 }, (_unused, value) =>
    new Promise(resolve => {
      const image = new Image();
      image.onload = resolve;
      image.onerror = resolve;
      image.src = clockImagePath(normalizedType, value);
    })
  )).then(() => undefined);

  clockImagePreloads.set(normalizedType, loading);
  return loading;
}
