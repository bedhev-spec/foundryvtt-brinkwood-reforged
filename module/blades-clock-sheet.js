import { BladesSheet } from "./blades-sheet.js";
import { clockImagePath, normalizeClockState } from "./clock-utils.js";
import { queueDocumentPathUpdate, reportSheetInteractionFailure } from "./sheet-dom.js";

/**
 * A standalone, token-backed progress clock.
 *
 * Clock changes are a single document operation: the saved face artwork and
 * prototype-token image always describe the same normalized clock state.
 */
export class BladesClockSheet extends BladesSheet {
  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "actor", "clock"],
    position: { width: 420, height: 460 },
    form: { closeOnSubmit: false, submitOnChange: false },
    window: { resizable: true },
  };

  static PARTS = {
    sheet: { template: "systems/brinkwood-reforged/templates/clock-sheet.html", scrollable: [""] },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const clock = normalizeClockState(context.system.type, context.system.value);
    context.system.type = Number(clock.type);
    context.system.value = clock.value;
    context.img = clockImagePath(clock.type, clock.value);
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this._clockSheetListenerController?.abort();
    this._clockSheetListenerController = new AbortController();
    const listenerOptions = { signal: this._clockSheetListenerController.signal };
    const html = this.element;
    if (!this.isEditable) return;

    html.querySelectorAll('input[name="system.value"], select[name="system.type"]').forEach(control => {
      control.addEventListener("change", event => void this._persistClockChange(event), listenerOptions);
    });
    html.querySelector('input[name="name"]')?.addEventListener(
      "change",
      event => void this._persistNameChange(event),
      listenerOptions,
    );
  }

  async _persistNameChange(event) {
    const name = event.currentTarget?.value ?? "";
    if (!this.isEditable || name === this.document.name) return false;
    try {
      await this.document.update({ name });
      return true;
    } catch (error) {
      reportSheetInteractionFailure(error);
      return false;
    }
  }

  async _persistClockChange(event) {
    if (!this.isEditable) return false;
    const control = event.currentTarget;
    const path = control?.name;
    if (path !== "system.type" && path !== "system.value") return false;
    if (control.type === "radio" && !control.checked) return false;
    const selected = Number(control.value);
    if (!Number.isFinite(selected)) return false;
    return this._persistClock(path === "system.type" ? { type: selected } : { value: selected });
  }

  async _persistClock({ type, value } = {}) {
    if (!this.isEditable) return false;
    try {
      await queueDocumentPathUpdate(this.document, "clock", async () => {
        const clock = normalizeClockState(
          type ?? this.document.system.type,
          value ?? this.document.system.value,
        );
        const image = clockImagePath(clock.type, clock.value);
        await this.document.update({
          "system.type": Number(clock.type),
          "system.value": clock.value,
          img: image,
          "prototypeToken.texture.src": image,
        });
        await this._syncActiveTokenImages(image);
      });
      return true;
    } catch (error) {
      reportSheetInteractionFailure(error, "BITD.ClockUpdateFailed");
      return false;
    }
  }

  async _syncActiveTokenImages(image) {
    const tokens = this.document.getActiveTokens?.() ?? [];
    if (!tokens.length || !globalThis.game?.scenes?.current) return;
    await TokenDocument.updateDocuments(
      tokens.map(token => ({ _id: token.id, "texture.src": image })),
      { parent: game.scenes.current },
    );
  }

  async _onClose(options) {
    this._clockSheetListenerController?.abort();
    return super._onClose(options);
  }
}
