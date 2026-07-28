import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = path.resolve(process.argv.find((item) => item.startsWith("--root="))?.slice(7) || ".");
const required = [
  ".github/workflows/deploy-pages.yml",
  ".github/workflows/i18n-check.yml",
  ".gitignore",
  ".nojekyll",
  "README.md",
  "assets/app.js",
  "assets/customizer.js",
  "assets/site-content-runtime.js",
  "assets/support-config.js",
  "assets/support.js",
  "index.html",
  "local-server.mjs",
  "scripts/customizer_cms_contract_check.mjs",
  "scripts/i18n_check.mjs",
  "scripts/order_frontend_contract_check.mjs",
  "scripts/site_content_runtime_check.mjs",
  "scripts/site_smoke.py",
  "scripts/support_handoff_check.mjs",
  "zh-CN/index.html"
];
const forbiddenPrefixes = [".env", "backups/", "data/runtime/", "node_modules/"];
const secretPatterns = [
  { name: "private_key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "github_token", pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: "aws_access_key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "api_key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ }
];

async function git(...args) {
  return (await exec("git", ["-C", root, ...args], { maxBuffer: 16 * 1024 * 1024 })).stdout;
}

const tracked = new Set((await git("ls-files", "-z")).split("\0").filter(Boolean));
const missing = [];
const untrackedRequired = [];
for (const name of required) {
  if (!(await fs.stat(path.join(root, name)).then(() => true, () => false))) missing.push(name);
  else if (!tracked.has(name)) untrackedRequired.push(name);
}

const forbiddenTracked = [...tracked].filter((name) => forbiddenPrefixes.some((prefix) => name === prefix || name.startsWith(prefix)));
const suspiciousSecrets = [];
for (const name of tracked) {
  if (/\.(?:png|jpe?g|gif|webp|pdf|woff2?|ttf|ico|zip|gz|enc)$/i.test(name)) continue;
  const source = await fs.readFile(path.join(root, name), "utf8").catch(() => null);
  if (source == null) continue;
  for (const item of secretPatterns) {
    if (item.pattern.test(source)) suspiciousSecrets.push({ file: name, pattern: item.name });
  }
}

const report = {
  ok: !missing.length && !untrackedRequired.length && !forbiddenTracked.length && !suspiciousSecrets.length,
  root,
  missing,
  untrackedRequired,
  forbiddenTracked,
  suspiciousSecrets,
  worktreeClean: (await git("status", "--porcelain=v1")).trim().length === 0
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exitCode = 1;
