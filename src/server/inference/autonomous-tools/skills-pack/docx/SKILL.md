# docx — creating Word documents in the sandbox

Environment: `python-docx` is preinstalled.

## Creating
```python
from docx import Document
from docx.shared import Pt, Inches, RGBColor

doc = Document()
doc.add_heading("Title", level=0)
doc.add_paragraph("Body text.")
doc.add_heading("Section", level=1)
doc.add_bullet = None  # no helper — use styles:
doc.add_paragraph("Bullet point", style="List Bullet")
doc.add_paragraph("Numbered item", style="List Number")

table = doc.add_table(rows=2, cols=3)
table.style = "Light Grid Accent 1"
table.rows[0].cells[0].text = "Header"

doc.save("/tmp/outputs/report.docx")
```

## Formatting runs
```python
p = doc.add_paragraph()
run = p.add_run("Bold part")
run.bold = True
run.font.size = Pt(12)
run.font.color.rgb = RGBColor(0x33, 0x33, 0x33)
```

## Page setup
`section = doc.sections[0]` → `section.page_width`, `section.left_margin = Inches(1)`, orientation via `WD_ORIENT.LANDSCAPE`.

## Gotchas
- Style names must exist in the default template: "List Bullet", "List Number", "Intense Quote", "Title", "Heading 1..9".
- `add_heading(level=0)` is the document title; level starts at 1 for sections.
- Long tables: set `table.autofit = True` and repeat header rows via `row.repeat_header` XML only if needed.
- Verify output: re-open with `Document(path)` and print paragraph count before delivering.
