"""Batch asset downloads via aria2c with live progress summary."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path


def aria2_available() -> bool:
    return shutil.which("aria2c") is not None


def run_aria2_batch(
    jobs: dict[str, Path],
    *,
    connections: int = 16,
    parallel: int = 16,
    split: int = 16,
) -> tuple[int, int]:
    """
    Download unique URLs with aria2c.
    Returns (ok_count, fail_count).
    """
    if not jobs:
        return 0, 0
    if not aria2_available():
        raise RuntimeError("aria2c not found — install: brew install aria2")

    lines: list[str] = []
    for url, dest in sorted(jobs.items(), key=lambda x: x[0]):
        dest.parent.mkdir(parents=True, exist_ok=True)
        lines.append(url)
        lines.append(f"  dir={dest.parent}")
        lines.append(f"  out={dest.name}")
        lines.append("")

    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".aria2.txt",
        delete=False,
        encoding="utf-8",
    ) as tmp:
        tmp.write("\n".join(lines))
        input_path = tmp.name

    cmd = [
        "aria2c",
        f"-i{input_path}",
        f"-x{connections}",
        f"-s{split}",
        f"-j{parallel}",
        "-k2M",
        "--min-split-size=1M",
        "--max-concurrent-downloads=64",
        "--auto-file-renaming=false",
        "--allow-overwrite=true",
        "--check-certificate=true",
        "--console-log-level=notice",
        "--summary-interval=1",
        "--show-console-readout=true",
        "--human-readable=true",
        "--file-allocation=none",
        "--retry-wait=2",
        "--max-tries=5",
        "--timeout=60",
        "--connect-timeout=30",
    ]

    print(
        f"\naria2c: {len(jobs)} assets "
        f"(x{connections} conn, j{parallel} parallel, s{split} splits)…"
    )
    proc = subprocess.run(cmd, check=False)
    Path(input_path).unlink(missing_ok=True)

    # ponytail: aria2 exit 0 even with partial failures — count files on disk
    ok = sum(1 for dest in jobs.values() if dest.is_file() and dest.stat().st_size > 0)
    fail = len(jobs) - ok
    if proc.returncode != 0 and ok == 0:
        raise RuntimeError(f"aria2c failed (exit {proc.returncode})")
    return ok, fail
