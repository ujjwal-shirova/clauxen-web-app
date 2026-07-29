# data-analysis — working with data files in the sandbox

Environment: Python 3 with `pandas`, `numpy`, `matplotlib` preinstalled. Input files live in the workspace (use `file_read` or bash `ls` to find them).

## Workflow
1. Inspect first: `df.head()`, `df.dtypes`, `df.shape`, `df.isna().sum()` — print them.
2. Parse types explicitly: `pd.to_datetime(..., errors="coerce")`, `pd.to_numeric(..., errors="coerce")`.
3. State assumptions before cleaning (dropped rows, filled NaNs) and print row counts before/after.
4. Compute the actual numbers the user asked for; print them rounded sensibly.
5. Visualize with matplotlib (see `charts` skill) when a trend/comparison is clearer as a picture.

## Reading files
- CSV: `pd.read_csv(path)` — try `encoding="utf-8"`, fall back to `latin-1`.
- Excel: `pd.read_excel(path)` (openpyxl engine preinstalled).
- JSON: `pd.read_json` or `json.load` depending on shape.
- Parquet: install `pyarrow` on demand.

## Gotchas
- Memory: the sandbox is small — avoid `df.copy()` chains on >100MB files; use `chunksize` for huge CSVs.
- Timezones: naive datetimes are the norm in CSVs; don't localize unless asked.
- Currency/percent columns arrive as strings — strip symbols before `to_numeric`.

## Deliverables
- Numbers in prose for quick answers.
- `create_file` a cleaned CSV/MD report when the user wants a takeaway artifact.
- Charts as PNG + optional PDF report combining them (see `pdf` skill).
