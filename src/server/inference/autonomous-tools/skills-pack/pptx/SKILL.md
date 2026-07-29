# pptx — creating PowerPoint decks in the sandbox

Environment: `python-pptx` is preinstalled.

## Creating
```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

prs = Presentation()
prs.slide_width = Inches(13.333)   # 16:9
prs.slide_height = Inches(7.5)

blank = prs.slide_layouts[6]
slide = prs.slides.add_slide(blank)

# Title textbox
box = slide.shapes.add_textbox(Inches(0.6), Inches(0.4), Inches(12), Inches(1))
tf = box.text_frame
tf.text = "Slide title"
tf.paragraphs[0].runs[0].font.size = Pt(32)
tf.paragraphs[0].runs[0].font.bold = True

prs.save("/tmp/outputs/deck.pptx")
```

## Layout discipline
- Use blank layout (index 6) and position textboxes explicitly — theme layouts vary by template and overflow silently.
- Body text: 18–24pt minimum; titles 28–40pt.
- Keep content inside slide bounds: check `left + width <= prs.slide_width`.
- One idea per slide; bullet lists via `tf.add_paragraph()` with `p.level`.

## Images and charts
Render charts with matplotlib first (see `charts` skill), then
`slide.shapes.add_picture("/tmp/outputs/chart.png", Inches(x), Inches(y), width=Inches(w))`.

## Verification
Re-open with `Presentation(path)` and print `len(prs.slides)` before delivering.
