#!/usr/bin/env python3
"""Extract stable localization messages from the English HTML templates."""

from __future__ import annotations

import hashlib
import html
import json
import re
from collections import defaultdict
from datetime import date
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGES = ROOT / "src" / "pages"
LOCALES = ROOT / "locales"
INDEX = ROOT / "i18n" / "source-index.json"
TRANSLATABLE_ATTRIBUTES = {"alt", "aria-label", "placeholder", "title"}
SKIP_TAGS = {"style"}
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
UI_MESSAGES = {
    "common.language.label": "Website language",
    "common.menu.open": "Open menu",
    "common.menu.close": "Close menu",
    "common.nav.products": "Products",
    "common.nav.trade": "OEM & Trade Partnership",
    "common.nav.manufacturing": "Manufacturing & Quality",
    "common.nav.projects": "Case Studies",
    "common.nav.company": "Company",
    "common.nav.contact": "Contact",
    "common.nav.privacy": "Privacy & file security",
    "common.nav.quote": "Request a quote",
    "common.nav.custom_quote": "Customize & request a quote",
    "common.floating.quote": "Request a quote",
    "common.form.enquiry_title": "Qinyi Printing enquiry {reference}",
    "common.form.default_product": "Custom paper product",
    "common.form.reference_created": "Reference {reference} created. Your email application will open next; the enquiry is only submitted after you send it.",
    "common.form.not_specified": "not specified",
    "common.rfq.production_brief": "RFQ / Production brief",
    "common.materials": "Materials",
    "quote.two_step_rfq": "Two-step RFQ",
    "quote.start_with_the_essentials": "Start with the essentials.",
    "quote.send_a_short_project_outline_first_qinyi": "Send a short project outline first. Qinyi will review manufacturing fit and then request the drawings, artwork and detailed specifications needed for pricing.",
    "quote.step_1_of_2": "Step 1 of 2",
    "quote.a_concise_first_review": "A concise first review.",
    "customizer.name": "Inspiration Customization Studio",
    "customizer.page.eyebrow": "Guided customization",
    "customizer.page.title": "Customization & request a quote",
    "customizer.page.intro": "Shape an initial product direction, then carry the resulting brief into your quote request.",
    "customizer.home.eyebrow": "Guided customization",
    "customizer.home.title": "Do not have a complete concept yet? Start with an idea.",
    "customizer.home.body": "Choose a product direction, structure, materials and visual style to create an editable initial brief that we can review with you.",
    "customizer.home.cta": "Start customizing",
    "customizer.home.secondary_cta": "Go directly to the quote form",
    "customizer.step.product.number": "01 / Direction",
    "customizer.step.structure.number": "02 / Structure",
    "customizer.step.material.number": "03 / Material",
    "customizer.step.visual.number": "04 / Visual",
    "customizer.progress": "Step {current} of 4",
    "customizer.step.product.title": "Product direction",
    "customizer.step.product.help": "Choose the starting point closest to your idea. You can add details later.",
    "customizer.step.structure.title": "Structure & form",
    "customizer.step.structure.help": "Choose an initial structural direction. Technical feasibility will be reviewed later.",
    "customizer.step.material.title": "Materials & finishes",
    "customizer.step.material.help": "Select preferred materials and finishes. You can choose more than one option or leave items open.",
    "customizer.step.visual.title": "Visual style & identity",
    "customizer.step.visual.help": "Choose the visual direction closest to the result you have in mind.",
    "customizer.product.puzzle": "Jigsaw product",
    "customizer.product.paper_3d": "3D paper or board puzzle",
    "customizer.product.game_packaging": "Paper games & gift packaging",
    "customizer.product.other": "More ideas",
    "customizer.product.other_help": "Describe your idea freely. You can also request support from a human creative adviser.",
    "customizer.product.other_label": "Describe your idea",
    "customizer.product.other_placeholder": "Tell us what you would like to make, how it will be used and what you want it to feel like.",
    "customizer.product.puzzle.help": "A flat jigsaw or art-led puzzle format.",
    "customizer.product.paper_3d.help": "A dimensional object assembled from printed paper components.",
    "customizer.product.game_packaging.help": "A card, paper-game, gift-box or coordinated packaging direction.",
    "customizer.open": "Open",
    "customizer.free_model": "Open concept",
    "customizer.waiting": "Choose a direction",
    "customizer.preview": "Preview: {name}",
    "customizer.shaped": "{count}/4 choices set",
    "customizer.shaped_open": "{count}/4 choices set · {open} open",
    "customizer.complete": "Complete",
    "customizer.handoff_ready": "Human-support request created: {ticket}",
    "customizer.model_puzzle": "Puzzle concept",
    "customizer.model_paper_3d": "3D paper concept",
    "customizer.model_paper_goods": "Paper goods concept",
    "customizer.structure.classic_description": "Balanced tabs and familiar assembly",
    "customizer.structure.custom_shape_description": "Rounded connections or a custom product outline",
    "customizer.structure.unsure_description": "Keep a special shape or construction open for review",
    "customizer.structure.foldable_description": "Parts connect through folds, slots or simple assembly",
    "customizer.structure.layered_description": "Printed layers build volume and depth",
    "customizer.structure.set_description": "Multiple components combine into one coordinated product",
    "customizer.structure.game_description": "Board, cards, rules and packaging as one set",
    "customizer.structure.cards_description": "Cards, dividers and a fitted printed box",
    "customizer.structure.pack_description": "A presentation box with coordinated inserts",
    "customizer.structure.open_description": "Keep the construction undefined for co-creation",
    "customizer.structure.hybrid_description": "Combine two or more paper product types",
    "customizer.structure.reference_description": "Start from an existing object or image",
    "customizer.finish.board_description": "Visible paper character and tactile warmth",
    "customizer.finish.lamination_description": "A durable matte or gloss surface",
    "customizer.finish.foil_description": "Controlled metallic highlights for key details",
    "customizer.finish.emboss_description": "Raised or pressed detail with tactile depth",
    "customizer.finish.spot_uv_description": "Selective gloss contrast on printed areas",
    "customizer.visual.minimal_description": "Clear hierarchy and restrained detail",
    "customizer.visual.bold_description": "Strong rhythm and distinct colour areas",
    "customizer.visual.illustrated_description": "A visual narrative carried across the product",
    "customizer.visual.brand_description": "A name, symbol or identity becomes the focal point",
    "customizer.structure.flat": "Classic flat format",
    "customizer.structure.custom_shape": "Custom shape & outline",
    "customizer.structure.layered": "Layered dimensional construction",
    "customizer.structure.foldable": "Foldable or assemble-yourself structure",
    "customizer.structure.set": "Coordinated product set",
    "customizer.structure.unsure": "To be defined",
    "customizer.material.greyboard": "Paper-wrapped greyboard",
    "customizer.material.special_paper": "Creative or specialty paper",
    "customizer.material.recycled": "Recycled paper",
    "customizer.material.unsure": "Material to be defined",
    "customizer.finish.lamination": "Matte or gloss lamination",
    "customizer.finish.foil": "Foil stamping",
    "customizer.finish.emboss": "Embossing or debossing",
    "customizer.finish.spot_uv": "Spot UV",
    "customizer.finish.unsure": "Finish to be defined",
    "customizer.visual.minimal": "Minimal & modern",
    "customizer.visual.illustrated": "Playful & illustrated",
    "customizer.visual.refined": "Premium & refined",
    "customizer.visual.natural": "Natural & textural",
    "customizer.visual.bold": "Bold & energetic",
    "customizer.visual.brand": "Follow an existing brand identity",
    "customizer.brief.title": "Add your project expectations",
    "customizer.brief.intro": "Approximate information is useful. Mark anything that still needs discussion.",
    "customizer.brief.use_case": "Intended use or occasion",
    "customizer.brief.use_case_placeholder": "For example: corporate gift, education, retail or personal use",
    "customizer.brief.audience": "Intended audience",
    "customizer.brief.audience_placeholder": "Who will receive, buy or use the product?",
    "customizer.brief.quantity": "Quantity range",
    "customizer.brief.quantity_placeholder": "Enter an approximate quantity",
    "customizer.brief.budget": "Indicative budget",
    "customizer.brief.budget_placeholder": "Enter a range and currency",
    "customizer.brief.delivery": "Preferred delivery window",
    "customizer.brief.delivery_placeholder": "Enter a target date or period",
    "customizer.brief.reference": "Style references",
    "customizer.brief.reference_placeholder": "Describe the style or add a public reference link",
    "customizer.brief.notes": "Additional notes",
    "customizer.brief.notes_placeholder": "Add dimensions, packaging needs, file requirements or other details",
    "customizer.summary.title": "Project brief summary",
    "customizer.summary.body": "Your selections are collected here as provisional requirements and can be edited before you request a quote.",
    "customizer.summary.empty": "Make a few selections to create your brief.",
    "customizer.summary.product": "Product direction",
    "customizer.summary.structure": "Structure & form",
    "customizer.summary.material": "Materials",
    "customizer.summary.finish": "Finishes",
    "customizer.summary.visual": "Visual style",
    "customizer.summary.use_case": "Intended use",
    "customizer.summary.audience": "Audience",
    "customizer.summary.quantity": "Quantity",
    "customizer.summary.budget": "Budget",
    "customizer.summary.delivery": "Delivery window",
    "customizer.summary.reference": "Style references",
    "customizer.summary.notes": "Additional notes",
    "customizer.summary.open_items": "Items to define",
    "customizer.summary.uncertain_tag": "To be confirmed",
    "customizer.summary.suggestion_tag": "Indicative suggestion",
    "customizer.preview.label": "Concept preview",
    "customizer.preview.waiting": "Your selections will shape the preview.",
    "customizer.preview.disclaimer": "This visualization is a concept preview only. It is not a production sample or a binding quote. Materials, finishes, dimensions, feasibility, price and lead time will be confirmed after technical review.",
    "customizer.quote.continue": "Continue to the quote form",
    "customizer.quote.prepare": "Prepare quote request",
    "customizer.quote.notice": "No price is calculated automatically. Feasibility, price and lead time will be confirmed after technical review.",
    "customizer.human.request": "Request a human creative adviser",
    "customizer.human.sending": "Sending adviser request...",
    "customizer.human.sent": "Adviser request sent",
    "customizer.human.failed": "The request could not be sent. Try again or continue with the quote form.",
    "customizer.action.start": "Start",
    "customizer.action.back": "Back",
    "customizer.action.next": "Continue",
    "customizer.action.confirm": "Confirm selection",
    "customizer.action.finish": "Complete concept brief",
    "customizer.action.edit": "Edit",
    "customizer.action.reset": "Reset selections",
    "customizer.summary.generated_label": "Customization brief",
    "customizer.status.required": "Required",
    "customizer.status.optional": "Optional",
    "customizer.status.missing": "Complete the required fields to continue.",
    "customizer.status.summary_ready": "Brief ready to review",
    "stats.established": "Established in {year}",
    "stats.facility": "Approximately {area} m² facility",
    "stats.team_members": "More than {count} team members",
    "stats.standard_moq": "Typical MOQ: {count} sets for standard jigsaw projects*",
}


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def is_translatable(value: str) -> bool:
    if not value or not re.search(r"[A-Za-z]", value):
        return False
    if re.fullmatch(r"(?:https?://|mailto:|tel:).+", value):
        return False
    if re.fullmatch(r"[\w.+-]+@[\w.-]+", value):
        return False
    return value not in {"Q", "EN", "DE", "FR", "MOQ", "RFQ", "FAQ"}


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, dict[str, str | None]]] = []
        self.items: list[tuple[str, str]] = []
        self.json_ld = False

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag not in VOID_TAGS:
            self.stack.append((tag, attributes))
        if tag == "script" and attributes.get("type") == "application/ld+json":
            self.json_ld = True
        for name, value in attrs:
            if name in TRANSLATABLE_ATTRIBUTES and value:
                text = normalize(value)
                if is_translatable(text):
                    self.items.append((f"attribute:{name}", text))
            if tag == "meta" and name == "content" and value:
                marker = attributes.get("name") or attributes.get("property")
                if marker in {"description", "og:title", "og:description"}:
                    text = normalize(value)
                    if is_translatable(text):
                        self.items.append((f"meta:{marker}", text))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag == "script":
            self.json_ld = False
        if self.stack and self.stack[-1][0] == tag:
            self.stack.pop()

    def handle_data(self, data):
        if not self.stack:
            return
        tag, attributes = self.stack[-1]
        if tag in SKIP_TAGS:
            return
        if attributes.get("data-i18n-message"):
            return
        if self.json_ld:
            self._extract_json_ld(data)
            return
        if tag == "script":
            return
        text = normalize(data)
        if is_translatable(text):
            self.items.append((f"text:{tag}", text))

    def _extract_json_ld(self, data: str) -> None:
        try:
            payload = json.loads(data)
        except json.JSONDecodeError:
            return

        def walk(value, parent_key=""):
            if isinstance(value, dict):
                for key, child in value.items():
                    if key not in {"@context", "@type", "@id", "url", "item", "email", "telephone", "image"}:
                        walk(child, key)
            elif isinstance(value, list):
                for child in value:
                    walk(child, parent_key)
            elif isinstance(value, str):
                text = normalize(value)
                if is_translatable(text) and parent_key not in {"addressCountry", "foundingDate"}:
                    self.items.append((f"jsonld:{parent_key}", text))

        walk(payload)


def slugify(value: str) -> str:
    value = value.lower().replace("qinyi printing", "qinyi")
    words = re.findall(r"[a-z0-9]+", value)[:7]
    return "_".join(words) or "message"


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def load_existing() -> tuple[dict[str, dict], dict[str, str], dict[tuple[str, int, str], str]]:
    if not INDEX.exists():
        return {}, {}, {}
    data = json.loads(INDEX.read_text())
    messages = data.get("messages", {})
    ref_to_key = {}
    for key, entry in messages.items():
        for ref in entry.get("references", []):
            if "position" in ref:
                ref_to_key[(ref["page"], ref["position"], ref["kind"])] = key
    return messages, {entry["source"]: key for key, entry in messages.items()}, ref_to_key


def main() -> None:
    LOCALES.mkdir(exist_ok=True)
    INDEX.parent.mkdir(exist_ok=True)
    existing, source_to_key, ref_to_key = load_existing()
    occurrences: dict[str, list[dict[str, str]]] = defaultdict(list)

    for path in sorted(PAGES.glob("*.html")):
        parser = TextExtractor()
        parser.feed(path.read_text())
        for position, (kind, source) in enumerate(parser.items):
            occurrences[source].append({"page": path.stem, "kind": kind, "position": position})

    reserved = set(existing)
    messages: dict[str, dict] = {}
    for source, refs in sorted(occurrences.items(), key=lambda item: (item[1][0]["page"], item[0])):
        key = source_to_key.get(source)
        if not key:
            candidate_keys = {
                ref_to_key.get((ref["page"], ref["position"], ref["kind"]))
                for ref in refs
            } - {None}
            if len(candidate_keys) == 1:
                key = candidate_keys.pop()
        if not key:
            pages = {ref["page"] for ref in refs}
            namespace = "common" if len(pages) > 1 else refs[0]["page"]
            base = f"{namespace}.{slugify(source)}"
            key = base
            counter = 2
            while key in reserved or key in messages:
                key = f"{base}_{counter}"
                counter += 1
        if key in messages and messages[key].get("source") != source:
            key = None
        if not key:
            pages = {ref["page"] for ref in refs}
            namespace = "common" if len(pages) > 1 else refs[0]["page"]
            base = f"{namespace}.{slugify(source)}"
            key = base
            counter = 2
            while key in reserved or key in messages:
                key = f"{base}_{counter}"
                counter += 1
        messages[key] = {
            "source": source,
            "sourceHash": digest(source),
            "references": refs,
        }

    # Runtime messages are keyed contracts. Preserve separate keys even when
    # two controls intentionally display the same English text. HTML occurrences
    # keep their established source-derived keys.
    for position, (key, source) in enumerate(UI_MESSAGES.items()):
        messages[key] = {
            "source": source,
            "sourceHash": digest(source),
            "references": [{"page": "common", "kind": "javascript", "position": position}],
        }

    index_payload = {
        "schemaVersion": 1,
        "sourceLocale": "en",
        "messages": dict(sorted(messages.items())),
    }
    INDEX.write_text(json.dumps(index_payload, ensure_ascii=False, indent=2) + "\n")

    en_messages = {
        key: {
            "value": entry["source"],
            "status": "source",
            "sourceHash": entry["sourceHash"],
        }
        for key, entry in sorted(messages.items())
    }
    previous_updated_at = None
    en_path = LOCALES / "en.json"
    if en_path.exists():
        previous_en = json.loads(en_path.read_text())
        if previous_en.get("messages") == en_messages:
            previous_updated_at = previous_en.get("updatedAt")
    en_payload = {
        "locale": "en",
        "languageName": "English",
        "direction": "ltr",
        "updatedAt": previous_updated_at or date.today().isoformat(),
        "messages": en_messages,
    }
    en_path.write_text(json.dumps(en_payload, ensure_ascii=False, indent=2) + "\n")
    print(f"Extracted {len(messages)} messages from {len(list(PAGES.glob('*.html')))} pages.")


if __name__ == "__main__":
    main()
