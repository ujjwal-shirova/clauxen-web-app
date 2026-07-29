# charts — rendering charts and plots in the sandbox

Environment: Python 3 with `matplotlib` (Agg backend) and `pandas` preinstalled. `seaborn` and `plotly` can be pip-installed if needed.

## Rules
1. Always use the non-interactive backend: `matplotlib.use("Agg")` BEFORE importing pyplot.
2. Save figures to `/tmp/outputs/<name>.png` at `dpi=150`, then attach via create_file flow for images if supported, or embed into PDFs/slides.
3. Never call `plt.show()` — output vanishes.
4. Set `plt.tight_layout()` before `savefig` to avoid clipped labels.
5. Close figures (`plt.close(fig)`) between charts to prevent style bleed and memory growth.

## Template
```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(x, y, marker="o", linewidth=2)
ax.set_title("...")
ax.set_xlabel("..."); ax.set_ylabel("...")
ax.grid(alpha=0.3)
plt.tight_layout()
fig.savefig("/tmp/outputs/chart.png", dpi=150)
plt.close(fig)
print("saved /tmp/outputs/chart.png")
```

## Data sanity
Print summary stats (`df.describe()`) before plotting so you can verify the chart matches the data. For dates, parse explicitly (`pd.to_datetime`) and use `fig.autofmt_xdate()`.

## Style
Default fonts ship with the image; for a cleaner look set `plt.rcParams["font.family"] = "DejaVu Sans"`. Avoid 3-D charts and heavy gridlines.
