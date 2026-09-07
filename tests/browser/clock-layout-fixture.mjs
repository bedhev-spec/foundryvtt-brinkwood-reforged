const rect = element => element.getBoundingClientRect();
const midpoint = bounds => bounds.top + bounds.height / 2;
const closeTo = (actual, expected, tolerance = 1) => Math.abs(actual - expected) <= tolerance;

const displays = [...document.querySelectorAll(".global-clock-display")];
const entries = [...document.querySelectorAll(".global-clock-entry")];
const faces = [...document.querySelectorAll(".global-clock__face")];
const addButtons = [...document.querySelectorAll(".global-clock__add")];
const toolbars = [...document.querySelectorAll(".global-clock__toolbar")];
const emptyDisplay = document.querySelector('[data-fixture="empty"]');
const emptyToolbar = emptyDisplay.querySelector(".global-clock__toolbar");
const firstEntry = entries[0];
const firstName = firstEntry.querySelector(".global-clock__name");
const firstLabel = firstEntry.querySelector(".global-clock__label");
const firstProgress = firstEntry.querySelector(".global-clock__progress");
const firstFace = firstEntry.querySelector(".global-clock__face");
const infoBackground = getComputedStyle(firstEntry).backgroundColor;
const overlayMaxWidth = getComputedStyle(document.querySelector("#brinkwood-global-clock-overlay")).maxWidth;
const faceBackground = getComputedStyle(firstFace).backgroundImage;
const addBackgrounds = addButtons.map(button => getComputedStyle(button).backgroundColor);
const expectedControlsWidth = 3 * 28 + 2 * 3 + 2 * 8;

const firstLabelRect = rect(firstLabel);
const firstProgressRect = rect(firstProgress);
const firstFaceRect = rect(firstFace);
const topEntries = [...displays[0].querySelectorAll(".global-clock-entry")];
const bottomEntries = [...displays[1].querySelectorAll(".global-clock-entry")];
const privateEntry = topEntries[1];
const privateLabelRect = rect(privateEntry.querySelector(".global-clock__label"));
const privateProgressRect = rect(privateEntry.querySelector(".global-clock__progress"));
const privateFaceRect = rect(privateEntry.querySelector(".global-clock__face"));
const topAddRect = rect(addButtons[0]);
const bottomAddRect = rect(addButtons[1]);
const emptyDisplayRect = rect(emptyDisplay);
const emptyToolbarRect = rect(emptyToolbar);
const entryFitsControls = entry => {
  const controls = entry.querySelector(".global-clock__controls");
  const face = entry.querySelector(".global-clock__face");
  const controlsRect = rect(controls);
  const faceRect = rect(face);
  const buttons = [...controls.querySelectorAll("button")].map(rect);
  return entry.offsetWidth >= expectedControlsWidth + face.offsetWidth &&
    controls.clientWidth >= expectedControlsWidth &&
    buttons.every(bounds => bounds.left >= controlsRect.left && bounds.right <= controlsRect.right) &&
    buttons.at(-1).right <= faceRect.left;
};

const assertions = {
  clockFaceIs36px: faces.every(face => face.offsetWidth === 36 && face.offsetHeight === 36),
  addButtonRemains36px: addButtons.every(button => button.offsetWidth === 36 && button.offsetHeight === 36),
  addControlUsesRestoredDarkClockLook:
    toolbars.every(toolbar => getComputedStyle(toolbar).backgroundColor === "rgb(32, 43, 54)") &&
    addButtons.every(button => getComputedStyle(button).color === "rgb(230, 231, 232)"),
  firstLoadAddStaysAtRightEdge: closeTo(emptyDisplayRect.right, emptyToolbarRect.right),
  onlyFaceUsesLightUnfilledColor:
    (faceBackground.includes("210, 212, 215") || faceBackground.includes("210 212 215")) &&
    faceBackground.includes("143, 47, 53") &&
    infoBackground !== "rgb(210, 212, 215)" &&
    addBackgrounds.every(background => background !== "rgb(210, 212, 215)"),
  infoCapsuleRetainsControlBackground: infoBackground === "rgb(32, 43, 54)",
  horizontalOrderIsNameProgressFace:
    firstName.compareDocumentPosition(firstFace) & Node.DOCUMENT_POSITION_FOLLOWING &&
    firstLabelRect.left < firstProgressRect.left &&
    firstProgressRect.right <= firstFaceRect.left,
  clockOverlayAllowsFifteenMorePixels: overlayMaxWidth === "305px",
  rowContentsShareVerticalCenter:
    closeTo(midpoint(firstLabelRect), midpoint(firstFaceRect)) &&
    closeTo(midpoint(firstProgressRect), midpoint(firstFaceRect)),
  hiddenClockProgressStaysVerticallyCentered:
    closeTo(midpoint(privateLabelRect), midpoint(privateFaceRect)) &&
    closeTo(midpoint(privateProgressRect), midpoint(privateFaceRect)),
  entryMinimumWidthFitsThreeControls: entries.every(entryFitsControls),
  clockInfoBlocksKeepIndependentWidths: topEntries[0].offsetWidth < topEntries[1].offsetWidth,
  topAddAlignsWithFirstClock: closeTo(topAddRect.top, rect(topEntries[0]).top),
  bottomAddAlignsWithLastClock: closeTo(bottomAddRect.bottom, rect(bottomEntries.at(-1)).bottom),
};

const output = document.querySelector("#clock-layout-results");
output.dataset.status = Object.values(assertions).every(Boolean) ? "passed" : "failed";
output.textContent = JSON.stringify({ assertions }, null, 2);
