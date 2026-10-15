"""Meypporul local API and SQLite corpus service (Python standard library only)."""
from __future__ import annotations

import json
import os
import re
import sqlite3
import unicodedata
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "tirukkural.json"
DB = ROOT / "data" / "meypporul.sqlite3"
COMMUNITY_EDITION = "community-json"
LOCAL_PORT = 5173
PUNCTUATION = re.compile(r"[“”‘’\"'.,;:!?()[\]{}…—–-]")


def normalize(text: str, loose: bool = False) -> str:
    text = unicodedata.normalize("NFC", str(text or ""))
    text = re.sub(r"[\u200b-\u200d\ufeff]", "", text)
    text = PUNCTUATION.sub("", text)
    text = " ".join(text.split())
    return text.replace(" ", "") if loose else text


@contextmanager
def connect():
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize_database() -> int:
    if not DATA.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA}")
    entries = json.loads(DATA.read_text(encoding="utf-8"))
    if not isinstance(entries, list) or len(entries) != 1330:
        raise ValueError("Dataset must contain exactly 1330 Kural records")
    numbers = [int(item["number"]) for item in entries]
    if sorted(numbers) != list(range(1, 1331)):
        raise ValueError("Dataset contains missing or duplicate Kural numbers")
    with connect() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS kurals (
          number INTEGER PRIMARY KEY, line1 TEXT NOT NULL, line2 TEXT NOT NULL,
          couplet TEXT NOT NULL, meaning TEXT NOT NULL DEFAULT '', chapter TEXT NOT NULL DEFAULT '',
          chapter_number INTEGER, section TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL DEFAULT '')""")
        db.execute("""CREATE TABLE IF NOT EXISTS editions (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, source_url TEXT NOT NULL,
          attribution TEXT NOT NULL DEFAULT '', license_note TEXT NOT NULL DEFAULT '',
          sha256 TEXT NOT NULL DEFAULT '', imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
        db.execute("""CREATE TABLE IF NOT EXISTS edition_verses (
          id INTEGER PRIMARY KEY AUTOINCREMENT, edition_id TEXT NOT NULL REFERENCES editions(id),
          number INTEGER NOT NULL, printed_number TEXT NOT NULL DEFAULT '', occurrence INTEGER NOT NULL DEFAULT 1, line1 TEXT NOT NULL,
          line2 TEXT NOT NULL, couplet TEXT NOT NULL, source_locator TEXT NOT NULL DEFAULT '',
          UNIQUE(edition_id, number, occurrence))""")
        # Existing local databases predate preservation of the source's printed label.
        verse_columns = {row[1] for row in db.execute("PRAGMA table_info(edition_verses)")}
        if "printed_number" not in verse_columns:
            db.execute("ALTER TABLE edition_verses ADD COLUMN printed_number TEXT NOT NULL DEFAULT ''")
        db.execute("CREATE INDEX IF NOT EXISTS idx_edition_verses_number ON edition_verses(number)")
        db.execute("DELETE FROM kurals")
        db.executemany("""INSERT INTO kurals
              (number,line1,line2,couplet,meaning,chapter,chapter_number,section,source_url)
              VALUES (:number,:line1,:line2,:couplet,:meaning,:chapter,:chapterNumber,:section,:sourceUrl)""",
              [{**item, "meaning": item.get("meaning", ""), "sourceUrl": item.get("sourceUrl", "")} for item in entries])
        db.execute("CREATE INDEX IF NOT EXISTS idx_kurals_chapter ON kurals(chapter_number)")
        source_url = entries[0].get("sourceUrl", "https://github.com/tk120404/thirukkural")
        db.execute("""INSERT INTO editions(id,name,source_url,attribution,license_note)
          VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,source_url=excluded.source_url,
          attribution=excluded.attribution,license_note=excluded.license_note""",
          (COMMUNITY_EDITION, "திறந்தநிலைத் திருக்குறள் JSON தரவுத்தொகுப்பு", source_url,
           "tk120404/thirukkural; தற்போதைய திட்டத்தின் தரவு மூலம்", "உரிம நிபந்தனைகளை மூலக் களஞ்சியத்தில் சரிபார்க்கவும்"))
        db.execute("DELETE FROM edition_verses WHERE edition_id=?", (COMMUNITY_EDITION,))
        db.executemany("""INSERT INTO edition_verses
          (edition_id,number,printed_number,occurrence,line1,line2,couplet,source_locator)
          VALUES(?,?,?,1,?,?,?,?)""",
          [(COMMUNITY_EDITION, int(item["number"]), str(item["number"]), item.get("line1", ""), item.get("line2", ""),
            item["couplet"], f"Kural {item['number']}") for item in entries])
    return 1330


def get_kural(number: int):
    with connect() as db:
        row = db.execute("SELECT * FROM kurals WHERE number=?", (number,)).fetchone()
    return dict(row) if row else None


def witness_report(number: int) -> dict:
    primary = get_kural(number)
    if not primary:
        return {"error": "Kural number must be between 1 and 1330"}
    primary_text = normalize(primary["couplet"])
    with connect() as db:
        editions = [dict(row) for row in db.execute("""SELECT e.id,e.name,e.source_url,e.attribution,e.license_note,e.sha256,
          v.number,v.printed_number,v.occurrence,v.line1,v.line2,v.couplet,v.source_locator
          FROM editions e LEFT JOIN edition_verses v ON v.edition_id=e.id AND v.number=?
          ORDER BY e.id,v.occurrence""", (number,))]
        records = [dict(row) for row in db.execute("SELECT number,couplet FROM kurals")]
    text_to_numbers = {}
    for record in records:
        text_to_numbers.setdefault(normalize(record["couplet"]), []).append(record["number"])
    grouped = {}
    for row in editions:
        entry = grouped.setdefault(row["id"], {"editionId": row["id"], "edition": row["name"],
            "sourceUrl": row["source_url"], "attribution": row["attribution"],
            "licenseNote": row["license_note"], "sha256": row["sha256"], "readings": []})
        if row["couplet"]:
            matched_numbers = text_to_numbers.get(normalize(row["couplet"]), [])
            if (row["printed_number"] and row["printed_number"] != str(row["number"])):
                status = "number-conflict"
            elif normalize(row["couplet"]) == primary_text:
                status = "same-text"
            elif matched_numbers and number not in matched_numbers:
                status = "number-conflict"
            else:
                status = "text-variant"
            entry["readings"].append({"number": row["number"], "printedNumber": row["printed_number"] or str(row["number"]), "occurrence": row["occurrence"],
                "line1": row["line1"], "line2": row["line2"], "couplet": row["couplet"],
                "locator": row["source_locator"], "status": status,
                "alsoMatchesNumbers": matched_numbers})
    return {"number": number, "primary": primary, "editions": list(grouped.values())}


def all_kurals():
    with connect() as db:
        return [dict(row) for row in db.execute("SELECT * FROM kurals ORDER BY number")]


def distance(a: str, b: str) -> int:
    left, right = list(a), list(b)
    if len(left) < len(right):
        left, right = right, left
    previous = list(range(len(right) + 1))
    for i, char_a in enumerate(left, 1):
        current = [i]
        for j, char_b in enumerate(right, 1):
            current.append(min(current[-1] + 1, previous[j] + 1,
                               previous[j - 1] + (char_a != char_b)))
        previous = current
    return previous[-1]


def verify(text: str) -> dict:
    text = str(text or "")
    tamil_count = len(re.findall(r"[\u0b80-\u0bff]", text))
    if tamil_count < 8:
        return {"kind": "insufficient", "item": None}
    strict, loose = normalize(text), normalize(text, True)
    records = all_kurals()
    for item in records:
        source = item["couplet"]
        if strict == normalize(source):
            item["source"] = item.pop("source_url", "")
            return {"kind": "exact" if unicodedata.normalize("NFC", text).strip() == source.strip() else "format", "item": item}
        if loose == normalize(source, True):
            item["source"] = item.pop("source_url", "")
            return {"kind": "format", "item": item}
    for item in records:
        if len(loose) >= 12 and loose in normalize(item["couplet"], True):
            item["source"] = item.pop("source_url", "")
            return {"kind": "partial", "item": item}
    best = None
    for item in records:
        candidate = normalize(item["couplet"], True)
        if abs(len(candidate) - len(loose)) > max(24, int(len(loose) * .7)):
            continue
        similarity = 1 - distance(loose, candidate) / max(len(loose), len(candidate), 1)
        if best is None or similarity > best[0]:
            best = (similarity, item)
    if best and best[0] >= .58:
        item = best[1]
        item["source"] = item.pop("source_url", "")
        return {"kind": "altered", "item": item, "similarity": round(best[0], 3)}
    return {"kind": "not-found", "item": None}


def evaluate_gate(draft: str, manual: str = "") -> dict:
    """Verify every detected quote; manual selection alone never approves a whole draft."""
    found = re.findall(r"“([^”]{8,})”|‘([^’]{8,})’|\"([^\"]{8,})\"|'([^']{8,})'", draft)
    quotes = list(dict.fromkeys(next(part for part in match if part).strip() for match in found))
    if manual:
        if normalize(manual) not in normalize(draft):
            return {"approved": False, "reason": "selected_quote_not_in_draft", "results": []}
        if normalize(manual) not in [normalize(q) for q in quotes]:
            quotes.append(manual)
    results = [{"quote": quote, "result": verify(quote)} for quote in quotes]
    selected_verified = bool(results) and all(x["result"]["kind"] in ("exact", "format") for x in results)
    approved = selected_verified and bool(found) and not manual
    return {"approved": approved, "selectedQuoteVerified": selected_verified,
            "quoteCount": len(quotes), "results": results}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, value, status=200):
        payload = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            with connect() as db:
                count = db.execute("SELECT COUNT(*) FROM kurals").fetchone()[0]
            return self.send_json({"ok": True, "corpusCount": count, "database": "SQLite"})
        if path == "/api/kurals":
            return self.send_json(all_kurals())
        match = re.fullmatch(r"/api/witness/(\d+)", path)
        if match:
            result = witness_report(int(match.group(1)))
            return self.send_json(result, 404 if "error" in result else 200)
        match = re.fullmatch(r"/api/kurals/(\d+)", path)
        if match:
            item = get_kural(int(match.group(1)))
            if not item:
                return self.send_json({"error": "Kural number must be between 1 and 1330"}, 404)
            item["source"] = item.pop("source_url", "")
            return self.send_json(item)
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path not in ("/api/verify", "/api/gate"):
            return self.send_json({"error": "Not found"}, 404)
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size < 1 or size > 100_000:
                return self.send_json({"error": "Request must be between 1 and 100000 bytes"}, 400)
            body = json.loads(self.rfile.read(size))
            if path == "/api/verify":
                text = body.get("text", "")
                if not isinstance(text, str):
                    return self.send_json({"error": "text must be a string"}, 400)
                return self.send_json(verify(text))
            draft = body.get("draft", "")
            manual = body.get("quote", "")
            return self.send_json(evaluate_gate(draft, manual))
        except (ValueError, json.JSONDecodeError) as exc:
            return self.send_json({"error": str(exc)}, 400)

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} - {fmt % args}")


if __name__ == "__main__":
    count = initialize_database()
    print(f"Meypporul API ready: {count} Kurals in {DB}")
    httpd = None
    ThreadingHTTPServer.allow_reuse_address = True
    # Hosted services provide PORT and require binding to all interfaces.
    # Local runs stay bound to loopback and can fall back across nearby ports.
    hosted_port = os.environ.get("PORT")
    host = "0.0.0.0" if hosted_port else "127.0.0.1"
    candidate_ports = [int(hosted_port)] if hosted_port else range(LOCAL_PORT, LOCAL_PORT + 10)
    for candidate_port in candidate_ports:
        try:
            httpd = ThreadingHTTPServer((host, candidate_port), Handler)
            break
        except OSError:
            continue
    if httpd is None:
        raise RuntimeError(f"Could not bind HTTP server to {host}:{hosted_port or '5173–5182'}")
    print(f"Open http://localhost:{httpd.server_port}/")
    httpd.serve_forever()
