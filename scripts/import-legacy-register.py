#!/usr/bin/env python3
"""One-time import of the legacy "TR 1 Asset register 2025.xlsx" workbook's
"Asset register 2025" sheet into asset-register's `assets` table.

Written in Python (not .cjs like the app's other scripts) because it needs
openpyxl to read the source workbook, and this script is never shipped or
run in production — it's a single local operation against a fresh dev.db,
run once after `bootstrap-shared-db.cjs` has created the schema.

What it does, and why:
  - The source .xlsx has a corrupted xl/styles.xml (one font's `family`
    attribute is 34, outside openpyxl's accepted 0-14 range) — this patches
    a scratch copy in-memory before opening it. Never touches your original
    file.
  - Reads column J ("Opening value") as `cost` for assets that existed
    before this fiscal year; for the ~12 rows purchased *during* FY2025
    (where J is blank and the real acquisition cost sits in column K,
    "Additions 2025"), uses K instead — see the header comment in
    src/lib/depreciation.ts for why a single `cost` + `purchaseDate` is all
    the schedule needs.
  - Skips one row ("PROCEEDS FROM INSURANCE - asset rollover...", a
    negative-value journal correction, not a physical asset) and reports it.
  - The 3 rows with a date in the "Sold" column import as status='sold'
    with that date as disposalDate. Note: this app's depreciation engine
    (v1) simply stops accruing depreciation after the disposal fiscal year,
    rather than writing off the remaining book value to exactly zero the
    way the spreadsheet's manual "Disposals2" plug did — so these 3 assets
    will show a small non-zero carrying value here versus the spreadsheet,
    until proper disposal/profit-loss recording is built.

Usage:
  DATABASE_URL=file:./local-shared.db python3 scripts/import-legacy-register.py \
      "/Users/willievdwalt/Desktop/Claude/TR 1 Asset register 2025.xlsx" \
      --user test.admin
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import sqlite3
import sys
import tempfile
import zipfile
from datetime import datetime

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl is required: pip3 install --user openpyxl")

SHEET_NAME = "Asset register 2025"


def patch_and_open(xlsx_path: str):
    """Return an openpyxl Workbook, working around this file's corrupted
    styles.xml (a font family value of 34, outside the 0-14 openpyxl
    accepts) by patching a scratch copy — the original file is never
    written to."""
    tmp_dir = tempfile.mkdtemp(prefix="asset-register-import-")
    extract_dir = os.path.join(tmp_dir, "extract")
    os.makedirs(extract_dir)
    with zipfile.ZipFile(xlsx_path) as zf:
        zf.extractall(extract_dir)

    styles_path = os.path.join(extract_dir, "xl", "styles.xml")
    if os.path.exists(styles_path):
        with open(styles_path, "r", encoding="utf-8") as f:
            xml = f.read()
        patched = re.sub(r'family val="(?!(?:[0-9]|1[0-4])")\d+"', 'family val="2"', xml)
        with open(styles_path, "w", encoding="utf-8") as f:
            f.write(patched)

    fixed_path = os.path.join(tmp_dir, "fixed.xlsx")
    with zipfile.ZipFile(fixed_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(extract_dir):
            for name in files:
                full = os.path.join(root, name)
                arcname = os.path.relpath(full, extract_dir)
                zf.write(full, arcname)

    wb = openpyxl.load_workbook(fixed_path, data_only=True)
    shutil.rmtree(tmp_dir, ignore_errors=True)
    return wb


def excel_date_to_iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("xlsx_path")
    parser.add_argument("--user", default="test.admin", help="username to record as created_by/recorded_by")
    parser.add_argument("--dry-run", action="store_true", help="parse and report only, no DB writes")
    args = parser.parse_args()

    db_path = os.environ.get("DATABASE_URL", "file:./dev.db").removeprefix("file:")
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(project_root, db_path) if not os.path.isabs(db_path) else db_path

    wb = patch_and_open(args.xlsx_path)
    if SHEET_NAME not in wb.sheetnames:
        sys.exit(f"Sheet '{SHEET_NAME}' not found. Sheets: {wb.sheetnames}")
    ws = wb[SHEET_NAME]

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cur = conn.cursor()

    user_row = cur.execute("SELECT id FROM users WHERE username = ?", (args.user,)).fetchone()
    if not user_row:
        sys.exit(f"No user '{args.user}' found in {db_path}. Run bootstrap-shared-db.cjs --seed-test-users first, "
                  f"or pass --user with a real username.")
    user_id = user_row[0]

    imported = 0
    skipped = []

    # Header is on row 5 (see analysis notes): A=Purchase date, B=Description,
    # C=Invoice number, D=Column3 (unused), E=VIN, F=Status, G=Registration,
    # H=Control lookup (unused), I=Column1 (unused), J=Opening value,
    # K=Additions 2025, L=Disposals, M=Closing balance, N=Column2 (unused),
    # ... Z=Sold, AA=Carrying value, AB=Comments, AC=Lifetime.
    for r in range(6, ws.max_row + 1):
        description = ws.cell(row=r, column=2).value
        if not description or not str(description).strip():
            continue
        description = str(description).strip()

        purchase_date = excel_date_to_iso(ws.cell(row=r, column=1).value)
        invoice_number = ws.cell(row=r, column=3).value
        vin_number = ws.cell(row=r, column=5).value
        status_raw = ws.cell(row=r, column=6).value
        registration = ws.cell(row=r, column=7).value
        opening_value = ws.cell(row=r, column=10).value
        additions = ws.cell(row=r, column=11).value
        sold_date = excel_date_to_iso(ws.cell(row=r, column=26).value)
        comments = ws.cell(row=r, column=28).value
        lifetime = ws.cell(row=r, column=29).value

        cost = opening_value if opening_value else additions

        if not purchase_date:
            skipped.append((r, description, "no purchase date"))
            continue
        if not cost or cost <= 0:
            skipped.append((r, description, f"no positive cost (opening={opening_value!r}, additions={additions!r})"))
            continue
        if not lifetime or lifetime <= 0:
            skipped.append((r, description, "no useful life"))
            continue

        status = "sold" if sold_date else "active"

        if args.dry_run:
            imported += 1
            continue

        cur.execute(
            """
            INSERT INTO assets
                (description, invoice_number, vin_number, registration, status,
                 purchase_date, disposal_date, cost, useful_life_years, comments, created_by_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                description,
                str(invoice_number).strip() if invoice_number else None,
                str(vin_number).strip() if vin_number else None,
                str(registration).strip() if registration else None,
                status,
                purchase_date,
                sold_date,
                float(cost),
                float(lifetime),
                str(comments).strip() if comments else None,
                user_id,
            ),
        )
        imported += 1

    if not args.dry_run:
        conn.commit()
    conn.close()

    print(f"Imported {imported} assets{' (dry run, no writes)' if args.dry_run else ''}.")
    if skipped:
        print(f"\nSkipped {len(skipped)} row(s):")
        for r, desc, reason in skipped:
            print(f"  row {r} ({desc!r}): {reason}")


if __name__ == "__main__":
    main()
