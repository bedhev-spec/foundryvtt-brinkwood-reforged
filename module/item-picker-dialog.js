import { escapeHTML } from "./html-utils.js";

const ITEM_PICKER_MIN_HEIGHT = 220;
const ITEM_PICKER_MAX_HEIGHT = 640;
const ITEM_PICKER_VIEWPORT_GUTTER = 48;
const ITEM_PICKER_CHROME_HEIGHT = 112;
const ITEM_PICKER_ROW_HEIGHT = 42;

/** Choose a useful initial height while keeping the picker inside the viewport. */
export function itemPickerDialogHeight(rowCount, viewportHeight = globalThis.window?.innerHeight) {
  const rows = Math.max(0, Number(rowCount) || 0);
  const viewportLimit = Number.isFinite(viewportHeight)
    ? Math.max(0, viewportHeight - ITEM_PICKER_VIEWPORT_GUTTER)
    : ITEM_PICKER_MAX_HEIGHT;
  const preferred = ITEM_PICKER_CHROME_HEIGHT + (rows * ITEM_PICKER_ROW_HEIGHT);
  return Math.max(
    Math.min(ITEM_PICKER_MIN_HEIGHT, viewportLimit),
    Math.min(preferred, ITEM_PICKER_MAX_HEIGHT, viewportLimit),
  );
}

/** Read selected picker inputs from either supported DialogV2 callback root. */
export function readItemPickerSelection(button, dialog) {
  const roots = [button?.form, dialog?.element?.querySelector("form")].filter(Boolean);
  for (const root of roots) {
    const selected = root.querySelectorAll(".items-to-add input:checked");
    if (root.querySelector(".items-to-add")) return Array.from(selected, input => input.value);
  }
  return [];
}

/** Render the reusable picker body from prepared, presentation-only row data. */
export function renderItemPickerContent(rows, { inputType, tooltipLabel }) {
  const safeInputType = inputType === "radio" ? "radio" : "checkbox";
  const safeTooltipLabel = escapeHTML(tooltipLabel);
  const renderedRows = Array.from(rows ?? []).map(row => {
    const id = escapeHTML(row.id);
    const name = escapeHTML(row.name);
    const details = escapeHTML(row.details);
    const tooltipHtml = escapeHTML(row.tooltipHtml);
    return `<div class="item-picker-row">
      <input id="select-item-${id}" type="${safeInputType}" name="select_items" value="${id}">
      <label class="flex-horizontal" for="select-item-${id}">
        <span>${name}</span><span class="item-picker-row__detail">${details}</span>
      </label>
      <i class="tooltip fas fa-question-circle" tabindex="0" aria-label="${safeTooltipLabel}"
        data-tooltip-html="${tooltipHtml}" data-tooltip-class="brinkwood-item-tooltip-shell"
        data-tooltip-direction="RIGHT"></i>
    </div>`;
  }).join("");
  return `<div class="item-picker-content"><div class="items-to-add">${renderedRows}</div></div>`;
}

/** Build a DialogV2 variant whose native resize handle changes height only. */
export function createHeightResizablePickerDialog(DialogV2) {
  return class HeightResizablePickerDialog extends DialogV2 {
    _pickerWidthLocked = false;

    async _onFirstRender(context, options) {
      await super._onFirstRender(context, options);
      this._pickerWidthLocked = true;
    }

    setPosition(position = {}) {
      if (!this._pickerWidthLocked || position.width === undefined) {
        return super.setPosition(position);
      }
      const { width: _ignoredWidth, ...heightOnlyPosition } = position;
      return super.setPosition(heightOnlyPosition);
    }
  };
}

/** Present a height-resizable picker whose list owns overflow scrolling. */
export function promptItemPicker({ rows, inputType, title, addLabel, tooltipLabel, onDialog }) {
  const PickerDialog = createHeightResizablePickerDialog(foundry.applications.api.DialogV2);
  return PickerDialog.prompt({
      // Keep Foundry's native DialogV2 appearance. This class exists only to
      // provide picker layout, scrolling, and the vertical resize contract.
      classes: ["item-picker-dialog"],
    window: {
      title,
      resizable: true,
    },
    position: { height: itemPickerDialogHeight(rows?.length) },
    content: renderItemPickerContent(rows, { inputType, tooltipLabel }),
    ok: {
      label: addLabel,
      callback: (_event, button, dialog) => readItemPickerSelection(button, dialog),
    },
    render: (_event, dialog) => onDialog?.(dialog),
    rejectClose: false,
  });
}
