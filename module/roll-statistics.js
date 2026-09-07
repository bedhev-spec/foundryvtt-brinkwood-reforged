import { escapeHTML } from "./html-utils.js";

const FLAG_SCOPE = "brinkwood-reforged";
const FLAG_KEY = "rollStatistics";
const OUTCOMES = ["critical-success", "success", "partial-success", "failure"];
const writeQueues = new Map();

export function emptyRollStatistics() {
  return {
    version: 1,
    total: 0,
    totalDicePool: 0,
    zeroDice: 0,
    outcomes: Object.fromEntries(OUTCOMES.map(outcome => [outcome, 0]))
  };
}

function normalizeRollStatistics(value) {
  const normalized = emptyRollStatistics();
  normalized.total = Math.max(0, Number(value?.total) || 0);
  normalized.totalDicePool = Math.max(0, Number(value?.totalDicePool) || 0);
  normalized.zeroDice = Math.max(0, Number(value?.zeroDice) || 0);
  for (const outcome of OUTCOMES) {
    normalized.outcomes[outcome] = Math.max(0, Number(value?.outcomes?.[outcome]) || 0);
  }
  return normalized;
}

export function addActionRollToStatistics(statistics, roll) {
  const next = normalizeRollStatistics(statistics);
  if (!OUTCOMES.includes(roll?.outcome)) return next;

  next.total += 1;
  next.totalDicePool += Math.max(0, Number(roll.dicePool) || 0);
  next.zeroDice += roll.zeroMode ? 1 : 0;
  next.outcomes[roll.outcome] += 1;
  return next;
}

export function summarizeRollStatistics(statistics) {
  const normalized = normalizeRollStatistics(statistics);
  const percentage = count => normalized.total ? (count / normalized.total) * 100 : 0;
  const critical = normalized.outcomes["critical-success"];
  const success = normalized.outcomes.success;
  const partial = normalized.outcomes["partial-success"];

  return {
    ...normalized,
    averageDicePool: normalized.total ? normalized.totalDicePool / normalized.total : 0,
    sixPlus: percentage(critical + success),
    fourPlus: percentage(critical + success + partial),
    rows: [
      { outcome: "critical-success", label: "BITD.RollCriticalSuccess", count: critical, percentage: percentage(critical) },
      { outcome: "success", label: "BITD.RollSuccess", count: success, percentage: percentage(success) },
      { outcome: "partial-success", label: "BITD.RollPartialSuccess", count: partial, percentage: percentage(partial) },
      { outcome: "failure", label: "BITD.RollFailure", count: normalized.outcomes.failure, percentage: percentage(normalized.outcomes.failure) }
    ]
  };
}

export async function recordActionRoll(roll, user = game.user) {
  if (!user?.id || typeof user.getFlag !== "function" || typeof user.setFlag !== "function") return;

  const previous = writeQueues.get(user.id) ?? Promise.resolve();
  const write = previous.catch(() => {}).then(async () => {
    const current = user.getFlag(FLAG_SCOPE, FLAG_KEY);
    const next = addActionRollToStatistics(current, roll);
    await user.setFlag(FLAG_SCOPE, FLAG_KEY, next);
  });
  writeQueues.set(user.id, write);

  try {
    await write;
  } finally {
    if (writeQueues.get(user.id) === write) writeQueues.delete(user.id);
  }
}

function formatPercentage(value) {
  return `${Math.round(value)}%`;
}

export function listStatisticsUsers(users) {
  return Array.from(users ?? []);
}

export function renderRollStatisticsContent(statistics, playerName, localize = key => key, chat = false) {
  const summary = summarizeRollStatistics(statistics);
  const chatClass = chat ? " brinkwood-roll-statistics--chat" : "";
  const rows = summary.rows.map(row => `
    <div class="brinkwood-roll-statistics__row brinkwood-roll-statistics__row--${row.outcome}">
      <span>${escapeHTML(localize(row.label))}</span>
      <div class="brinkwood-roll-statistics__track" aria-hidden="true">
        <span style="width: ${row.percentage.toFixed(1)}%"></span>
      </div>
      <strong>${formatPercentage(row.percentage)}</strong>
      <span class="brinkwood-roll-statistics__count">${row.count}</span>
    </div>`).join("");

  const empty = summary.total === 0
    ? `<p class="brinkwood-roll-statistics__empty">${escapeHTML(localize("BITD.RollStatisticsEmpty"))}</p>`
    : "";

  return `
    <section class="brinkwood-roll-statistics${chatClass}">
      <header>
        <h2>${escapeHTML(playerName)}</h2>
        <p>${summary.total} ${escapeHTML(localize("BITD.RollStatisticsRecorded"))}</p>
      </header>
      ${empty || rows}
      <dl class="brinkwood-roll-statistics__summary">
        <div><dt>${escapeHTML(localize("BITD.RollStatisticsSixPlus"))}</dt><dd>${formatPercentage(summary.sixPlus)}</dd></div>
        <div><dt>${escapeHTML(localize("BITD.RollStatisticsFourPlus"))}</dt><dd>${formatPercentage(summary.fourPlus)}</dd></div>
        <div><dt>${escapeHTML(localize("BITD.RollStatisticsAveragePool"))}</dt><dd>${summary.averageDicePool.toFixed(1)}d</dd></div>
        <div><dt>${escapeHTML(localize("BITD.RollStatisticsZeroDice"))}</dt><dd>${summary.zeroDice}</dd></div>
      </dl>
    </section>`;
}

export async function sendRollStatisticsToChat(statistics, user) {
  if (!user) return;
  const content = renderRollStatisticsContent(
    statistics,
    user.name,
    key => game.i18n.localize(key),
    true
  );
  return CONFIG.ChatMessage.documentClass.create({
    speaker: { alias: user.name },
    content,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    whisper: [],
    blind: false,
    flags: { "brinkwood-reforged": { rollStatistics: { userId: user.id } } }
  });
}

async function selectStatisticsUser() {
  const users = listStatisticsUsers(game.users);
  if (!users.length) return game.user?.id;
  const options = users
    .map(user => `<option value="${escapeHTML(user.id)}">${escapeHTML(user.name)}</option>`)
    .join("");

  return foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("BITD.RollStatistics") },
    content: `<form><div class="form-group"><label>${escapeHTML(game.i18n.localize("BITD.RollStatisticsPlayer"))}</label><select name="userId">${options}</select></div></form>`,
    ok: {
      label: game.i18n.localize("BITD.RollStatisticsView"),
      callback: (_event, button) => button.form?.querySelector('[name="userId"]')?.value
    },
    rejectClose: false
  });
}

export async function showRollStatistics(userId) {
  const selectedUserId = userId ?? (game.user?.isGM ? await selectStatisticsUser() : game.user?.id);
  if (!selectedUserId) return;
  const user = game.users?.get?.(selectedUserId) ?? (selectedUserId === game.user?.id ? game.user : null);
  if (!user || (user.id !== game.user?.id && !game.user?.isGM)) return;

  const statistics = user.getFlag(FLAG_SCOPE, FLAG_KEY);
  const content = renderRollStatisticsContent(statistics, user.name, key => game.i18n.localize(key));
  return foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("BITD.RollStatistics") },
    content,
    buttons: [
      {
        action: "send",
        label: game.i18n.localize("BITD.RollStatisticsSendToChat"),
        icon: "<i class='fas fa-paper-plane'></i>",
        callback: () => sendRollStatisticsToChat(statistics, user)
      },
      {
        action: "close",
        label: game.i18n.localize("Close"),
        icon: "<i class='fas fa-times'></i>",
        default: true,
        callback: () => "close"
      }
    ],
    rejectClose: false
  });
}
