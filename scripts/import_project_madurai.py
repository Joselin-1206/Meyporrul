"""Import the Project Madurai Unicode Thirukkural as a named textual witness.

Run after the backend has once created its SQLite schema:
    python scripts/import_project_madurai.py
The original HTML is retained under data/source_snapshots so its attribution
header accompanies the redistributed e-text as required by Project Madurai.
"""
from __future__ import annotations

import hashlib
import re
import sys
import urllib.request
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
import server

URL = "https://www.projectmadurai.org/pm_etexts/utf8/pmuni0001.html"
EDITION_ID = "project-madurai-unicode-2000"


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() in {"br", "p", "div", "h1", "h2", "h3", "h4", "tr"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag.lower() in {"p", "div", "h1", "h2", "h3", "h4", "tr"}:
            self.parts.append("\n")

    def handle_data(self, data):
        self.parts.append(data)


def parse_readings(html: str, reference_index=None):
    parser = TextExtractor()
    parser.feed(html)
    lines = [" ".join(line.replace("\xa0", " ").split()) for line in "".join(parser.parts).splitlines()]
    lines = [line for line in lines if line]
    readings = []
    seen = Counter()
    tamil = re.compile(r"[\u0b80-\u0bff]")
    number_at_end = re.compile(r"^(.*?)\s+([0-9]{1,5})\s*[.)]?$")
    for index, numbered_line in enumerate(lines):
        match = number_at_end.match(numbered_line)
        if not match or index == 0:
            continue
        printed_number = match.group(2)
        printed_value = int(printed_number)
        line2 = match.group(1).strip()
        line1 = lines[index - 1].strip()
        if not (tamil.search(line1) and tamil.search(line2)):
            continue
        couplet = f"{line1}\n{line2}"
        # Text may identify the intended canonical record even when the source's
        # printed label is duplicated or malformed. Keep both facts separately.
        text_matches = (reference_index or {}).get(server.normalize(couplet, loose=True), [])
        if len(text_matches) == 1:
            number = text_matches[0]
        elif 1 <= printed_value <= 1330:
            number = printed_value
        else:
            continue
        seen[number] += 1
        readings.append({"number": number, "printed_number": printed_number,
            "occurrence": seen[number], "line1": line1, "line2": line2,
            "couplet": couplet, "source_locator": f"Project Madurai e-text · literal printed label {printed_number}, occurrence {seen[number]}"})
    return readings


def main():
    snapshot_dir = ROOT / "data" / "source_snapshots"
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    snapshot = snapshot_dir / "project_madurai_pmuni0001.html"
    if snapshot.exists():
        raw = snapshot.read_bytes()
        encoding = "utf-8"
    else:
        request = urllib.request.Request(URL, headers={"User-Agent": "Meypporul-Hackathon-Prototype/1.0"})
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
            encoding = response.headers.get_content_charset() or "utf-8"
    html = raw.decode(encoding, errors="replace")
    server.initialize_database()
    reference_index = {}
    for item in server.all_kurals():
        reference_index.setdefault(server.normalize(item["couplet"], loose=True), []).append(item["number"])
    readings = parse_readings(html, reference_index)
    if len(readings) < 1300:
        raise SystemExit(f"Import stopped: parsed only {len(readings)} numbered readings; inspect the source/parser before importing.")

    snapshot.write_bytes(raw)
    digest = hashlib.sha256(raw).hexdigest()

    with server.connect() as db:
        db.execute("""INSERT INTO editions(id,name,source_url,attribution,license_note,sha256)
          VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,
          source_url=excluded.source_url,attribution=excluded.attribution,
          license_note=excluded.license_note,sha256=excluded.sha256,imported_at=CURRENT_TIMESTAMP""",
          (EDITION_ID, "Project Madurai Unicode திருக்குறள் e-text", URL,
           "Project Madurai 1998–2000; HTML header retained in data/source_snapshots/project_madurai_pmuni0001.html",
           "Project Madurai permits free distribution provided its header page is kept intact; see retained source snapshot.", digest))
        db.execute("DELETE FROM edition_verses WHERE edition_id=?", (EDITION_ID,))
        db.executemany("""INSERT INTO edition_verses
          (edition_id,number,printed_number,occurrence,line1,line2,couplet,source_locator)
          VALUES(?,?,?,?,?,?,?,?)""",
          [(EDITION_ID, row["number"], row["printed_number"], row["occurrence"], row["line1"], row["line2"], row["couplet"], row["source_locator"])
           for row in readings])
    duplicates = {key: count for key, count in Counter(r["printed_number"] for r in readings).items() if count > 1}
    label_mismatches = [(r["number"], r["printed_number"]) for r in readings if str(r["number"]) != r["printed_number"]]
    missing = sorted(set(range(1, 1331)) - {r["number"] for r in readings})
    print(f"Imported {len(readings)} source readings from Project Madurai.")
    print(f"Distinct canonical text references: {len(set(r['number'] for r in readings))} / 1330")
    print(f"Source snapshot: {snapshot}")
    print(f"SHA-256: {digest}")
    print(f"Repeated literal printed labels: {duplicates or 'none'}")
    print(f"Printed-label/text-reference disagreements (canonical, literal label): {label_mismatches or 'none'}")
    print(f"Canonical text references not imported: {missing or 'none'}")
    print("Literal printed labels and source text are retained; canonical text mapping is shown separately, not treated as a correction to the source.")


if __name__ == "__main__":
    main()
