import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const visitor = await readFile(new URL("../assets/app.js", import.meta.url), "utf8");

assert.match(visitor, /\/api\/customer\/auth\/sms\/request/);
assert.match(visitor, /\/api\/customer\/auth\/sms\/verify/);
assert.match(visitor, /\/api\/customer\/auth\/session/);
assert.match(visitor, /data-order-logout/);
assert.match(visitor, /SMS_DELIVERY_FAILED/);
assert.match(visitor, /escapeHtml\(order\.title\)/);

console.log("Visitor order contract check passed.");
