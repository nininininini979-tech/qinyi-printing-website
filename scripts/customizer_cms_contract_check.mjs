import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const customizer = fs.readFileSync(path.join(root, "assets/customizer.js"), "utf8");
const runtime = fs.readFileSync(path.join(root, "assets/site-content-runtime.js"), "utf8");

const failures = [];
if (!customizer.includes("window.QINYI_CONTENT?.customizer")) failures.push("customizer does not consume the published CMS contract");
if (!customizer.includes('document.addEventListener("qinyi:content-ready"')) failures.push("customizer does not wait for the CMS contract");
if (!customizer.includes("fallbackStages")) failures.push("customizer has no stable fallback for incomplete CMS data");
if (!runtime.includes("applyCustomizer(content)")) failures.push("site runtime does not apply model-slot state");
if (!runtime.includes("customizer.enabled === false")) failures.push("CMS cannot take the customizer surface offline");

if (failures.length) throw new Error(failures.join("\n"));
console.log("Customizer CMS contract check passed.");
