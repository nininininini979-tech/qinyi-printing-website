import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [supportJs, supportCss, supportI18n, supportHtml, appJs, customizerJs] = await Promise.all([
  readFile(new URL("assets/support.js", root), "utf8"),
  readFile(new URL("assets/support.css", root), "utf8"),
  readFile(new URL("assets/support-i18n.js", root), "utf8"),
  readFile(new URL("ai-support.html", root), "utf8"),
  readFile(new URL("assets/app.js", root), "utf8"),
  readFile(new URL("assets/customizer.js", root), "utf8"),
]);

assert.doesNotThrow(() => new Function(supportJs), "support.js must parse");
assert.doesNotThrow(() => new Function(supportI18n), "support-i18n.js must parse");
assert.doesNotThrow(() => new Function(appJs), "app.js must parse");
assert.doesNotThrow(() => new Function(customizerJs), "customizer.js must parse");

for (const status of ["waiting_human", "acknowledged", "human_active", "resolved"]) {
  assert.match(supportJs, new RegExp(`\\b${status}\\b`), `missing ${status} state`);
}

assert.match(supportJs, /tickets\/\$\{encodeURIComponent\(ticketId\)\}\/events\?after=/, "missing event polling endpoint");
assert.match(supportJs, /EVENT_POLL_TIMEOUT_MS/, "event polling must have a request timeout");
assert.match(supportJs, /else startEventPolling\(\)/, "a newly returned handoff must start event polling");
assert.match(supportJs, /olderTimestamp \|\| statusRegression/, "older handoff responses must not replace current state");
assert.match(supportJs, /state\.handoffStatus !== "resolved"/, "resolved handoffs must not restart polling");
assert.match(supportJs, /fetch\(apiUrl\("\/api\/support\/chat"\),\s*\{[\s\S]*?method:\s*"POST"/, "visitor messages must keep using the chat endpoint");
assert.match(supportJs, /\[404, 410\]\.includes\(response\.status\)[\s\S]*delete payload\.sessionId/, "expired AI sessions must retry without the stale session token");
assert.match(supportJs, /else resumeAiConversation\(\)/, "a successful AI reply must clear the resolved handoff banner");
assert.match(supportJs, /humanSupport.*勤益人工客服/, "missing human-support identity");
assert.match(supportHtml, /id="handoffStatus"[\s\S]*aria-live="polite"/, "missing accessible handoff status region");
assert.match(supportCss, /\.message--human\b/, "missing human message style");
assert.match(supportCss, /\.message--system\b/, "missing system message style");
assert.match(supportCss, /grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto auto/, "chat grid must reserve a handoff-status row");

for (const key of ["handoffWaitingTitle", "handoffWaitingBadge", "handoffWaitingDetail"]) {
  const matches = supportI18n.match(new RegExp(`${key}:`, "g")) || [];
  assert.equal(matches.length, 2, `${key} must exist in Chinese and English`);
}

assert.match(customizerJs, /if \(!ticketId \|\| \(action && action !== "handoff"\)\)/, "customizer must require a confirmed handoff ticket");
assert.match(customizerJs, /new AbortController\(\)[\s\S]*?controller\.abort\(\)/, "customizer handoff must have a request timeout");
assert.match(customizerJs, /qinyi:open-support[\s\S]*?ticketId/, "customizer must pass the new ticket to the support widget");
assert.match(customizerJs, /event\.persisted[\s\S]*?resizeObserver\.disconnect\(\)/, "3D cleanup must preserve bfcache and disconnect observers on final exit");
assert.match(appJs, /ticketUrl\.searchParams\.set\('ticket', ticketId\)[\s\S]*?frame\.src = ticketUrl\.href/, "loaded support iframe must refresh onto a newly created ticket");

console.log("Support handoff contract check passed.");
