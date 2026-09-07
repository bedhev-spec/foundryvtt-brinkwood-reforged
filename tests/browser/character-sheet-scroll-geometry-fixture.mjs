const frames = document.querySelector("#frames");
const output = document.querySelector("#character-scroll-geometry-results");

function createCase(name, height, width, expectedAttributeColumns) {
  return new Promise(resolve => {
    const frame = document.createElement("iframe");
    frame.title = `${name} Character sheet`;
    frame.height = String(height);
    frame.width = String(width + 40);
    frame.src = "./character-sheet-scroll-geometry-case.html";
    frame.addEventListener("load", async () => {
      frame.contentDocument.querySelector(".fixture-application").style.width = `${width}px`;
      await frame.contentDocument.fonts?.ready;
      requestAnimationFrame(() => resolve({ name, height, width, expectedAttributeColumns, frame }));
    }, { once: true });
    frames.append(frame);
  });
}

function geometry({ name, height, width, expectedAttributeColumns, frame }) {
  const view = frame.contentWindow;
  const document = frame.contentDocument;
  const application = document.querySelector(".fixture-application");
  const header = document.querySelector(".window-header");
  const form = document.querySelector("form.actor-sheet.character-sheet");
  const tabs = document.querySelector(".character-sheet__workspace > .sheet-tabs");
  const tab = document.querySelector(".sheet-tab-content > .tab.active");
  const bottom = document.querySelector(".fixture-bottom");
  const attributes = document.querySelector(".character-attributes > .attributes");
  const identity = document.querySelector("form.actor-sheet > .name-alias");
  const portrait = identity.querySelector(".sheet-identity__portrait");
  const identityDetails = identity.querySelector(".sheet-identity__details");
  const formStyle = view.getComputedStyle(form);
  const tabStyle = view.getComputedStyle(tab);
  const tabsStyle = view.getComputedStyle(tabs);
  const attributesStyle = view.getComputedStyle(attributes);
  const headerTop = header.getBoundingClientRect().top;
  const formMaxScroll = Math.max(0, form.scrollHeight - form.clientHeight);
  const tabMaxScroll = Math.max(0, tab.scrollHeight - tab.clientHeight);

  form.scrollTop = formMaxScroll;

  const applicationRect = application.getBoundingClientRect();
  const formRect = form.getBoundingClientRect();
  const identityRect = identity.getBoundingClientRect();
  const portraitRect = portrait.getBoundingClientRect();
  const identityDetailsRect = identityDetails.getBoundingClientRect();
  const formContentWidth = form.clientWidth
    - Number.parseFloat(formStyle.paddingLeft)
    - Number.parseFloat(formStyle.paddingRight);
  const tabsRect = tabs.getBoundingClientRect();
  const lastTabRect = tabs.lastElementChild.getBoundingClientRect();
  const bottomRect = bottom.getBoundingClientRect();
  return {
    name,
    viewportHeight: height,
    viewportWidth: width,
    expectedAttributeColumns,
    attributeColumns: attributesStyle.gridTemplateColumns.split(" ").filter(Boolean).length,
    noSheetHorizontalOverflow: application.scrollWidth <= application.clientWidth + 1,
    identityFillsForm: Math.abs(identityRect.width - formContentWidth) <= 1,
    narrowIdentityStacks: applicationRect.width > 480 + 1
      || identityDetailsRect.top >= portraitRect.bottom - 1,
    respectsMinimumWidth: applicationRect.width >= 480 - 1,
    respectsMaximumWidth: applicationRect.width <= 700 + 1,
    applicationFitsViewport: applicationRect.bottom <= height + 1,
    formOverflowY: formStyle.overflowY,
    tabOverflowY: tabStyle.overflowY,
    tabsPosition: tabsStyle.position,
    tabsFillWidth: Math.abs(lastTabRect.right - (tabsRect.right - 4)) <= 2,
    formMaxScroll,
    tabMaxScroll,
    bottomReachable: bottomRect.bottom <= formRect.bottom + 1,
    headerStayedFixed: Math.abs(header.getBoundingClientRect().top - headerTop) <= 1,
    tabsStayedInForm: tabsRect.top >= formRect.top - 1 && tabsRect.top <= formRect.bottom + 1,
  };
}

const results = (await Promise.all([
  createCase("short", 760, 700, 3),
  createCase("medium", 760, 560, 2),
  createCase("narrow", 760, 480, 2),
  createCase("below-min-attempt", 760, 320, 2),
  createCase("wide-attempt", 760, 820, 3),
  createCase("tall", 1300, 700, 3),
])).map(geometry);
const assertions = Object.fromEntries(results.flatMap(result => [
  [`${result.name}ApplicationFitsViewport`, result.applicationFitsViewport],
  [`${result.name}FormOwnsOverflow`, result.formOverflowY === "auto" && result.formMaxScroll > 0],
  [`${result.name}PanelExpands`, result.tabOverflowY === "visible" && result.tabMaxScroll === 0],
  [`${result.name}BottomReachable`, result.bottomReachable],
  [`${result.name}HeaderFixed`, result.headerStayedFixed],
  [`${result.name}TabsSticky`, result.tabsPosition === "sticky" && result.tabsStayedInForm],
  [`${result.name}TabsFillWidth`, result.tabsFillWidth],
  [`${result.name}NoSheetHorizontalOverflow`, result.noSheetHorizontalOverflow],
  [`${result.name}IdentityFillsForm`, result.identityFillsForm],
  [`${result.name}NarrowIdentityStacks`, result.narrowIdentityStacks],
  [`${result.name}RespectsMinimumWidth`, result.respectsMinimumWidth],
  [`${result.name}RespectsMaximumWidth`, result.respectsMaximumWidth],
  [`${result.name}AttributeColumns`, result.attributeColumns === result.expectedAttributeColumns],
]));

output.dataset.status = Object.values(assertions).every(Boolean) ? "passed" : "failed";
output.textContent = JSON.stringify({ assertions, results }, null, 2);
