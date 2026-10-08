from __future__ import annotations

from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PDF = ROOT / "public" / "email-assets" / "direct-optimize-gbp-keyword-case-studies.pdf"
OUTPUT_PDF = ROOT / "output" / "pdf" / "direct-optimize-gbp-keyword-case-studies.pdf"
LOGO_PATH = ROOT / "public" / "direct-optimize-logo-transparent.png"

PAGE_WIDTH = 612
PAGE_HEIGHT = 792

NAVY = HexColor("#0D2034")
SLATE = HexColor("#F2F6FA")
CARD = HexColor("#FFFFFF")
TEXT = HexColor("#192B42")
MUTED = HexColor("#5F738E")
LINE = HexColor("#D7E1EB")
CYAN = HexColor("#43BDE8")
TEAL = HexColor("#2B9279")
BLUE = HexColor("#627BD4")
GOLD = HexColor("#E0A02C")
TRACK = HexColor("#E8EEF4")

CASES = [
    {
        "label": "CASE 01",
        "views": 4627,
        "interactions": 840,
        "calls": 149,
        "directions": 318,
        "clicks": 373,
        "positions": [10, 1, 0, 1],
    },
    {
        "label": "CASE 02",
        "views": 483,
        "interactions": 102,
        "calls": 17,
        "directions": 41,
        "clicks": 44,
        "positions": [5, 8, 3, 0],
    },
    {
        "label": "CASE 03",
        "views": 1937,
        "interactions": 268,
        "calls": 104,
        "directions": 99,
        "clicks": 65,
        "positions": [13, 2, 0, 0],
    },
    {
        "label": "CASE 04",
        "views": 3304,
        "interactions": 540,
        "calls": 94,
        "directions": 201,
        "clicks": 245,
        "positions": [4, 9, 1, 2],
    },
]


def rounded_rect(pdf: canvas.Canvas, x: float, y: float, width: float, height: float, fill, radius: float = 16) -> None:
    pdf.setFillColor(fill)
    pdf.setStrokeColor(fill)
    pdf.roundRect(x, y, width, height, radius, fill=1, stroke=0)


def text(pdf: canvas.Canvas, value: str, x: float, y: float, size: float, color=TEXT, font: str = "Helvetica") -> None:
    pdf.setFillColor(color)
    pdf.setFont(font, size)
    pdf.drawString(x, y, value)


def right_text(pdf: canvas.Canvas, value: str, x: float, y: float, size: float, color=TEXT, font: str = "Helvetica") -> None:
    pdf.setFillColor(color)
    pdf.setFont(font, size)
    pdf.drawRightString(x, y, value)


def header(pdf: canvas.Canvas, section: str, title: str, subtitle: str) -> None:
    pdf.setFillColor(NAVY)
    pdf.rect(0, PAGE_HEIGHT - 186, PAGE_WIDTH, 186, fill=1, stroke=0)
    pdf.drawImage(
        ImageReader(str(LOGO_PATH)),
        46,
        PAGE_HEIGHT - 65,
        width=43,
        height=43,
        mask="auto",
        preserveAspectRatio=True,
        anchor="c",
    )
    text(pdf, "DIRECT OPTIMIZE", 103, PAGE_HEIGHT - 43, 16, white, "Helvetica-Bold")
    pdf.setFillColor(CYAN)
    pdf.circle(259, PAGE_HEIGHT - 38, 3, fill=1, stroke=0)
    right_text(pdf, section, 564, PAGE_HEIGHT - 43, 10, HexColor("#B5C3D5"), "Helvetica-Bold")
    text(pdf, title, 48, PAGE_HEIGHT - 110, 28, white, "Helvetica-Bold")
    text(pdf, subtitle, 48, PAGE_HEIGHT - 141, 13, HexColor("#D8E3EF"), "Helvetica")


def footer(pdf: canvas.Canvas, page_number: int) -> None:
    pdf.setStrokeColor(LINE)
    pdf.setLineWidth(0.75)
    pdf.line(48, 43, 564, 43)
    text(pdf, f"PROFILE RESULTS AND SUPPORT  |  {page_number:02d}", 48, 26, 9, MUTED)
    right_text(pdf, "DIRECT OPTIMIZE", 564, 26, 9, MUTED, "Helvetica-Bold")


def section_heading(pdf: canvas.Canvas, eyebrow: str, title: str, x: float, y: float) -> None:
    text(pdf, eyebrow, x, y, 9, MUTED, "Helvetica-Bold")
    text(pdf, title, x, y - 23, 15, TEXT, "Helvetica-Bold")


def activity_page(pdf: canvas.Canvas) -> None:
    header(
        pdf,
        "COMPARISON / 01",
        "Performance comparison",
        "A side-by-side view of profile activity reported across the four anonymized examples.",
    )
    section_heading(pdf, "CUSTOMER ACTION MIX", "Reported profile interactions", 48, 570)
    rounded_rect(pdf, 48, 365, 516, 153, CARD)
    text(pdf, "Calls", 72, 487, 9, MUTED, "Helvetica-Bold")
    text(pdf, "Directions", 134, 487, 9, MUTED, "Helvetica-Bold")
    text(pdf, "Website clicks", 226, 487, 9, MUTED, "Helvetica-Bold")
    for x, color in ((58, CYAN), (120, TEAL), (212, BLUE)):
        pdf.setFillColor(color)
        pdf.circle(x, 490, 4, fill=1, stroke=0)

    max_total = max(case["interactions"] for case in CASES)
    for index, case in enumerate(CASES):
        y = 459 - (index * 30)
        text(pdf, case["label"], 72, y + 2, 9, MUTED, "Helvetica-Bold")
        bar_x = 151
        bar_width = 304
        total = case["interactions"]
        visible_width = max(20, (total / max_total) * bar_width)
        rounded_rect(pdf, bar_x, y - 2, bar_width, 16, TRACK, 8)
        offset = 0
        for value, color in ((case["calls"], CYAN), (case["directions"], TEAL), (case["clicks"], BLUE)):
            width = (value / total) * visible_width
            pdf.setFillColor(color)
            pdf.rect(bar_x + offset, y - 2, width, 16, fill=1, stroke=0)
            offset += width
        right_text(pdf, f"{total:,}", 538, y + 2, 10, TEXT, "Helvetica-Bold")

    text(pdf, "Bar length represents the total recorded interactions. Segment color shows the action type.", 72, 345, 8.5, MUTED)

    rounded_rect(pdf, 48, 138, 248, 165, CARD)
    section_heading(pdf, "REPORTED ACTION RATE", "Actions per 100 profile views", 72, 274)
    max_rate = max((case["interactions"] / case["views"] * 100) for case in CASES)
    for index, case in enumerate(CASES):
        rate = case["interactions"] / case["views"] * 100
        y = 225 - (index * 25)
        text(pdf, case["label"].replace("CASE ", "C"), 72, y + 1, 8.5, MUTED, "Helvetica-Bold")
        rounded_rect(pdf, 107, y - 3, 110, 13, TRACK, 6.5)
        rounded_rect(pdf, 107, y - 3, max(8, (rate / max_rate) * 110), 13, TEAL, 6.5)
        right_text(pdf, f"{rate:.1f}", 266, y + 1, 10, TEXT, "Helvetica-Bold")

    rounded_rect(pdf, 316, 138, 248, 165, CARD)
    section_heading(pdf, "SOURCE TOTALS", "Profile reach and activity", 340, 274)
    text(pdf, "CASE", 340, 240, 8.5, MUTED, "Helvetica-Bold")
    right_text(pdf, "VIEWS", 474, 240, 8.5, MUTED, "Helvetica-Bold")
    right_text(pdf, "ACTIONS", 538, 240, 8.5, MUTED, "Helvetica-Bold")
    for index, case in enumerate(CASES):
        y = 216 - (index * 23)
        pdf.setStrokeColor(LINE)
        pdf.setLineWidth(0.5)
        pdf.line(340, y - 6, 538, y - 6)
        text(pdf, case["label"], 340, y, 9, TEXT, "Helvetica-Bold")
        right_text(pdf, f"{case['views']:,}", 474, y, 9, TEXT, "Helvetica-Bold")
        right_text(pdf, f"{case['interactions']:,}", 538, y, 9, TEXT, "Helvetica-Bold")

    text(pdf, "Action rate is calculated from source-reported interactions per 100 profile views; totals are not bookings, sales, or guaranteed leads.", 48, 92, 8, MUTED)
    text(pdf, "Report dates and durations are intentionally omitted.", 48, 77, 8.5, MUTED)
    footer(pdf, 14)


def visibility_page(pdf: canvas.Canvas) -> None:
    header(
        pdf,
        "COMPARISON / 02",
        "Search visibility comparison",
        "Latest listed positions across the four anonymized keyword snapshots.",
    )
    section_heading(pdf, "LATEST REPORTED POSITIONS", "Selected keyword position mix", 48, 570)
    rounded_rect(pdf, 48, 335, 516, 185, CARD)

    legend = [
        ("#1 positions", CYAN),
        ("Top 2-3", TEAL),
        ("#4-10", BLUE),
        ("#11+ / not found", GOLD),
    ]
    for index, (label, color) in enumerate(legend):
        x = 72 + (index * 116)
        pdf.setFillColor(color)
        pdf.circle(x, 486, 4, fill=1, stroke=0)
        text(pdf, label, x + 9, 482, 8.5, MUTED, "Helvetica-Bold")

    for index, case in enumerate(CASES):
        total_terms = sum(case["positions"])
        y = 446 - (index * 34)
        text(pdf, case["label"], 72, y + 3, 9, MUTED, "Helvetica-Bold")
        bar_x = 153
        bar_width = 304
        rounded_rect(pdf, bar_x, y - 1, bar_width, 18, TRACK, 9)
        offset = 0
        for value, color in zip(case["positions"], (CYAN, TEAL, BLUE, GOLD)):
            if not value:
                continue
            width = (value / total_terms) * bar_width
            pdf.setFillColor(color)
            pdf.rect(bar_x + offset, y - 1, width, 18, fill=1, stroke=0)
            if width >= 28:
                text(pdf, str(value), bar_x + offset + (width / 2) - 2.5, y + 3, 8, NAVY, "Helvetica-Bold")
            offset += width
        right_text(pdf, f"{total_terms} terms", 538, y + 3, 9, TEXT, "Helvetica-Bold")

    text(pdf, "Each bar equals the selected terms listed in that case's keyword appendix.", 72, 316, 8.5, MUTED)

    rounded_rect(pdf, 48, 135, 516, 137, CARD)
    section_heading(pdf, "AT-A-GLANCE", "Top-position coverage in the selected snapshots", 72, 243)
    for index, case in enumerate(CASES):
        total_terms = sum(case["positions"])
        top_one = case["positions"][0]
        x = 72 + (index * 120)
        text(pdf, case["label"], x, 205, 8.5, MUTED, "Helvetica-Bold")
        text(pdf, f"{top_one} / {total_terms}", x, 178, 19, TEXT, "Helvetica-Bold")
        text(pdf, "listed at #1", x, 162, 8.5, MUTED)

    text(pdf, "These are position snapshots from the supplied reports, not a comparison of campaign outcomes.", 48, 92, 8.5, MUTED)
    text(pdf, "Search context, keyword sets, report dates, and tracking durations differ and are intentionally omitted.", 48, 77, 8.5, MUTED)
    footer(pdf, 15)


def build_chart_pages() -> PdfReader:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(PAGE_WIDTH, PAGE_HEIGHT), pageCompression=1)
    pdf.setTitle("Direct Optimize | GBP Keyword Case Studies")
    activity_page(pdf)
    pdf.showPage()
    visibility_page(pdf)
    pdf.save()
    buffer.seek(0)
    return PdfReader(buffer)


def base_pages(source: PdfReader):
    pages = list(source.pages)
    # Allow safe re-generation after the public asset has already received these two pages.
    if len(pages) >= 2:
        trailing_text = "\n".join((page.extract_text() or "") for page in pages[-2:])
        if "Performance comparison" in trailing_text and "Search visibility comparison" in trailing_text:
            pages = pages[:-2]
    return pages


def main() -> None:
    if not SOURCE_PDF.exists():
        raise FileNotFoundError(f"Missing source case-study PDF: {SOURCE_PDF}")
    if not LOGO_PATH.exists():
        raise FileNotFoundError(f"Missing Direct Optimize logo: {LOGO_PATH}")

    source = PdfReader(str(SOURCE_PDF))
    output = PdfWriter()
    for page in base_pages(source):
        output.add_page(page)
    for page in build_chart_pages().pages:
        output.add_page(page)
    output.add_metadata({
        "/Title": "Direct Optimize | Google Business Profile Case Studies",
        "/Author": "Direct Optimize",
        "/Subject": "Anonymized keyword, profile activity, and comparison examples from supplied reports",
    })

    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PDF.open("wb") as stream:
        output.write(stream)
    print(f"Wrote {OUTPUT_PDF} with {len(output.pages)} pages")


if __name__ == "__main__":
    main()
