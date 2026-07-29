# pdf — creating and processing PDFs in the sandbox

Environment: Ubuntu sandbox, Python 3. `reportlab` and `fpdf2` are preinstalled; `pypdf` is available for reading/merging. For HTML-rendered PDFs, `weasyprint` may be installed on demand via `pip install weasyprint` (system deps `libpango` are present).

## Creating a PDF
Prefer `fpdf2` for text-first documents and `reportlab` for precise layout.

```python
from fpdf import FPDF

pdf = FPDF()
pdf.set_auto_page_break(auto=True, margin=15)
pdf.add_page()
pdf.set_font("helvetica", "B", 16)
pdf.cell(0, 10, "Title", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("helvetica", "", 11)
pdf.multi_cell(0, 6, "Body text here.")
pdf.output("/tmp/outputs/document.pdf")
```

Unicode: helvetica covers latin-1 only. For non-latin text or emoji, register a TTF (DejaVuSans ships at `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`) with `pdf.add_font("dejavu", "", path, uni=True)`.

## Tables
Use `fpdf2`'s `with pdf.table() as table:` context (v2.7+) or draw cells manually with `reportlab.platypus.Table` + `TableStyle` for styled grids.

## Reading / merging PDFs
```python
from pypdf import PdfReader, PdfWriter
reader = PdfReader("input.pdf")
text = "\n".join(page.extract_text() or "" for page in reader.pages)
```

## Charts inside PDFs
Render charts with matplotlib to PNG first (see the `charts` skill), then `pdf.image(path, w=170)`.

## Delivery
Save the PDF under `/tmp/outputs/` with a descriptive name, print its size (`os.path.getsize`) to confirm it wrote, then deliver it with `create_file` using the same path — the platform attaches the file as a downloadable card.
