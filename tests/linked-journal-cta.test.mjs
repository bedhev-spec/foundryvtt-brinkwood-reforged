import assert from "node:assert/strict";
import test from "node:test";

const updates = [];
globalThis.game = { user: { id: "user" }, i18n: { localize: key => key } };
globalThis.ui = { notifications: { warn() {} } };

const journal = {
  documentName: "JournalEntry",
  uuid: "JournalEntry.alpha",
  name: "The Chronicle",
  testUserPermission: () => true,
  sheet: { render: async force => { journal.rendered = force; } },
};
const page = {
  documentName: "JournalEntryPage",
  uuid: "JournalEntry.alpha.JournalEntryPage.one",
  name: "First Page",
  parent: journal,
  testUserPermission: () => true,
};
journal.pages = new Map([[page.uuid, page]]);
globalThis.fromUuid = async uuid => uuid === journal.uuid ? journal : null;

const {
  openLinkedJournal,
  persistLinkedJournalUuid,
  prepareLinkedJournalContext,
  prepareLinkedJournalPickerData,
  resolveLinkedJournal,
  unlinkJournal,
} = await import("../module/linked-journal-cta.js");

test("journal picker projects Foundry-style Entry and Page choices", () => {
  const hidden = {
    documentName: "JournalEntry",
    uuid: "JournalEntry.hidden",
    name: "Hidden",
    testUserPermission: () => false,
    pages: [],
  };
  const picker = prepareLinkedJournalPickerData(page, [journal, hidden]);
  assert.deepEqual(picker, {
    entries: [{
      uuid: journal.uuid,
      name: journal.name,
      pages: [{ uuid: page.uuid, name: page.name }],
    }],
    selectedEntryUuid: journal.uuid,
    selectedPageUuid: page.uuid,
  });
});

test("linked journal context projects linked, unlinked, and unavailable states without migrating Actor data", async () => {
  assert.deepEqual(await prepareLinkedJournalContext({ flags: {} }, { editable: false }), {
    state: "unlinked", uuid: "", available: false, show: false,
  });
  const linked = await prepareLinkedJournalContext({ flags: { "brinkwood-reforged": { linkedJournalUuid: journal.uuid } } }, { editable: true });
  assert.equal(linked.state, "linked");
  assert.equal(linked.title, "The Chronicle");
  const unavailable = await prepareLinkedJournalContext({ flags: { "brinkwood-reforged": { linkedJournalUuid: "JournalEntry.deleted" } } });
  assert.deepEqual(unavailable, { state: "unavailable", uuid: "JournalEntry.deleted", available: false, show: true, title: "" });
});

test("only Journal Entry and Journal Entry Page UUIDs are accepted and persist through one flag path", async () => {
  const sheet = { isEditable: true, document: { update: async change => updates.push(change) } };
  assert.equal(await persistLinkedJournalUuid(sheet, journal.uuid), true);
  assert.deepEqual(updates.pop(), { "flags.brinkwood-reforged.linkedJournalUuid": journal.uuid });
  globalThis.fromUuid = async () => ({ documentName: "Actor", uuid: "Actor.invalid" });
  assert.equal(await persistLinkedJournalUuid(sheet, "Actor.invalid"), false);
  globalThis.fromUuid = async uuid => uuid === journal.uuid ? journal : null;
  assert.equal(await unlinkJournal(sheet), true);
  assert.deepEqual(updates.pop(), { "flags.brinkwood-reforged.-=linkedJournalUuid": null });
});

test("opening resolves the link and renders the normal Journal sheet", async () => {
  assert.equal(await resolveLinkedJournal(journal.uuid), journal);
  assert.equal(await openLinkedJournal(journal.uuid), true);
  assert.equal(journal.rendered, true);
  assert.equal(await openLinkedJournal("JournalEntry.deleted"), false);
});
