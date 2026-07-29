# xlsx — creating Excel spreadsheets in the sandbox

Environment: `openpyxl` preinstalled; `pandas` available for frame-heavy work. `xlsxwriter` can be pip-installed for charts/conditional formats at write time.

## Creating (openpyxl)
```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

wb = Workbook()
ws = wb.active
ws.title = "Summary"

ws.append(["Metric", "Q1", "Q2"])
ws.append(["Revenue", 12.4, 14.1])

for cell in ws[1]:
    cell.font = Font(bold=True, color="FFFFFF")
    cell.fill = PatternFill("solid", fgColor="305496")
    cell.alignment = Alignment(horizontal="center")

for col in ("A", "B", "C"):
    ws.column_dimensions[col].width = 18

ws.freeze_panes = "A2"
wb.save("/tmp/outputs/report.xlsx")
```

## pandas route
```python
import pandas as pd
df = pd.DataFrame(rows)
df.to_excel("/tmp/outputs/data.xlsx", sheet_name="Data", index=False)
```

## Formulas
Set `cell.value = "=SUM(B2:B10)"` — formulas are stored, not evaluated by openpyxl. If you need computed values in the file, compute them in Python and write literals.

## Verification
Re-open with `load_workbook(path)` and print sheet names and `ws.max_row`/`max_column` to confirm the write succeeded.

## Multiple sheets
`wb.create_sheet("Details")` — the active sheet is first; order sheets by creation order.
