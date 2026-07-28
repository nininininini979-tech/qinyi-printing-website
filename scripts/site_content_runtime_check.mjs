import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../assets/site-content-runtime.js", import.meta.url), "utf8");
const visitorAppSource = await readFile(new URL("../assets/app.js", import.meta.url), "utf8");

function textNode(value) {
  return {
    textContent: value,
    attributes: new Map(),
    setAttribute(name, nextValue) { this.attributes.set(name, nextValue); },
    getAttribute(name) { return this.attributes.get(name); }
  };
}

const title = textNode("Static hero title");
const body = textNode("Static hero body");
const description = textNode("");
description.setAttribute("content", "Static SEO description");

const document = {
  documentElement: { lang: "en" },
  getElementById() { return null; },
  querySelector(selector) {
    if (selector.includes("hero-title") || selector.includes(".page-hero h1")) return title;
    if (selector.includes("hero-body") || selector.includes(".page-hero-aside")) return body;
    if (selector === 'meta[name="description"]') return description;
    return null;
  },
  querySelectorAll() { return []; },
  dispatchEvent() {}
};

const window = {
  __QINYI_SUPPORT_CONFIG__: {},
  location: { pathname: "/en/index.html" }
};
const context = vm.createContext({
  window,
  document,
  CustomEvent: class CustomEvent {},
  fetch: async () => ({ ok: false })
});
vm.runInContext(source, context);

const pendingPage = {
  slug: "index.html",
  status: "published",
  hero: {
    titleZh: "首页",
    titleEn: "Home",
    titleStatus: "pending_input",
    bodyZh: "待补充",
    bodyEn: "Pending input",
    bodyStatus: "pending_input"
  },
  sections: [],
  seo: {
    descriptionZh: "待补充",
    descriptionEn: "Pending input",
    descriptionStatus: "pending_input"
  }
};

window.QinyiSiteContent.applyContent({ revision: 2, pages: [pendingPage], navigation: [] });
assert.equal(title.textContent, "Static hero title");
assert.equal(body.textContent, "Static hero body");
assert.equal(description.getAttribute("content"), "Static SEO description");

const editedPage = structuredClone(pendingPage);
editedPage.hero.titleEn = "Managed hero title";
editedPage.hero.bodyEn = "Managed hero body";
editedPage.seo.descriptionEn = "Managed SEO description";
delete editedPage.hero.titleStatus;
delete editedPage.hero.bodyStatus;
delete editedPage.seo.descriptionStatus;
window.QinyiSiteContent.applyContent({ revision: 3, pages: [editedPage], navigation: [] });
assert.equal(title.textContent, "Managed hero title");
assert.equal(body.textContent, "Managed hero body");
assert.equal(description.getAttribute("content"), "Managed SEO description");
assert.match(source, /staticPageSlugs/);
assert.match(source, /\/site\/\$\{encodeURIComponent\(locale\)\}\/\$\{encodeURIComponent\(slug\)\}/);
assert.match(visitorAppSource, /window\.QINYI_MANAGED_PAGE/);

console.log("Site content runtime pending-field check passed.");
