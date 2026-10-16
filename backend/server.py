"""Meypporul local API and SQLite corpus service (Python standard library only)."""
from __future__ import annotations

import json
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import time
import threading
import unicodedata
from collections import defaultdict, deque
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "tirukkural.json"
AATHICHUDI_DATA = ROOT / "data" / "aathichudi.json"
DB = ROOT / "data" / "meypporul.sqlite3"
COMMUNITY_EDITION = "community-json"
LOCAL_PORT = 5173
PUNCTUATION = re.compile(r"[“”‘’\"'.,;:!?()[\]{}…—–-]")
SESSION_SECONDS = 60 * 60 * 24 * 7
PASSWORD_ROUNDS = 240_000
PUBLIC_API_LIMIT = 60
PUBLIC_API_WINDOW = 60
_public_hits = defaultdict(deque)
_public_hits_lock = threading.Lock()


def public_api_allowed(client_ip: str) -> bool:
    now = time.monotonic()
    with _public_hits_lock:
        hits = _public_hits[client_ip]
        while hits and now - hits[0] >= PUBLIC_API_WINDOW:
            hits.popleft()
        if len(hits) >= PUBLIC_API_LIMIT:
            return False
        hits.append(now)
        return True


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
        db.execute("""CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE,
          password_salt BLOB NOT NULL, password_hash BLOB NOT NULL,
          created_at INTEGER NOT NULL)""")
        db.execute("""CREATE TABLE IF NOT EXISTS auth_sessions (
          token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL)""")
        db.execute("CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at)")
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
        aathichudi = json.loads(AATHICHUDI_DATA.read_text(encoding="utf-8")) if AATHICHUDI_DATA.exists() else {"items": []}
        db.execute("""CREATE TABLE IF NOT EXISTS aathichudi (
          number INTEGER PRIMARY KEY, text TEXT NOT NULL, group_name TEXT NOT NULL DEFAULT '')""")
        db.execute("DELETE FROM aathichudi")
        db.executemany("INSERT INTO aathichudi(number,text,group_name) VALUES(?,?,?)",
                       [(int(item["number"]), item["text"], item.get("group", "")) for item in aathichudi.get("items", [])])
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


def all_aathichudi(query: str = ""):
    with connect() as db:
        rows = [dict(row) for row in db.execute("SELECT number,text,group_name FROM aathichudi ORDER BY number")]
    if query:
        needle = normalize(query, loose=True)
        rows = [row for row in rows if needle in normalize(row["text"] + row["group_name"], loose=True)
                or needle in str(row["number"])]
    return rows


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


def all_kurals(section: str = "", chapter: str = ""):
    clauses, values = [], []
    if section:
        clauses.append("section=?")
        values.append(section)
    if chapter:
        clauses.append("chapter=?")
        values.append(chapter)
    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    with connect() as db:
        return [dict(row) for row in db.execute("SELECT * FROM kurals" + where + " ORDER BY number", values)]


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
    for row in all_aathichudi():
        source = row["text"]
        if strict == normalize(source):
            kind = "exact" if unicodedata.normalize("NFC", text).strip() == unicodedata.normalize("NFC", source).strip() else "format"
            return {"kind": kind, "work": "ஆத்திச்சூடி", "author": "ஔவையார் (மூலப் பதிவின் attribution)",
                    "item": {"number": row["number"], "couplet": source, "chapter": row["group_name"],
                             "meaning": "இந்த ஆத்திச்சூடி வரிக்கான விளக்கத்தை உறுதிப்படுத்திய மூலத் தரவில் சேர்க்கவில்லை.",
                             "source": "https://www.projectmadurai.org/pm_etexts/utf8/pmuni0002.html"}}
        if loose == normalize(source, True):
            return {"kind": "format", "work": "ஆத்திச்சூடி", "author": "ஔவையார் (மூலப் பதிவின் attribution)",
                    "item": {"number": row["number"], "couplet": source, "chapter": row["group_name"],
                             "meaning": "இந்த ஆத்திச்சூடி வரிக்கான விளக்கத்தை உறுதிப்படுத்திய மூலத் தரவில் சேர்க்கவில்லை.",
                             "source": "https://www.projectmadurai.org/pm_etexts/utf8/pmuni0002.html"}}
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

    def send_json(self, value, status=200, headers=None):
        payload = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/auth/session":
            user = self.current_user()
            return self.send_json({"authenticated": bool(user), "username": user["username"] if user else None})
        if path == "/api/health":
            with connect() as db:
                count = db.execute("SELECT COUNT(*) FROM kurals").fetchone()[0]
                aathi_count = db.execute("SELECT COUNT(*) FROM aathichudi").fetchone()[0]
            return self.send_json({"ok": True, "corpusCount": count, "aathichudiCount": aathi_count, "database": "SQLite"})
        if path == "/api/works":
            return self.send_json([{"id": "thirukkural", "name": "திருக்குறள்", "count": 1330},
                                   {"id": "aathichudi", "name": "ஆத்திச்சூடி", "count": len(all_aathichudi()),
                                    "source": "https://www.projectmadurai.org/pm_etexts/utf8/pmuni0002.html"}])
        if path.startswith("/api/") and not self.current_user():
            return self.send_json({"error": "உள்நுழைந்த பிறகே இந்த வசதியைப் பயன்படுத்தலாம்."}, 401)
        if path == "/api/aathichudi":
            query = parse_qs(urlparse(self.path).query).get("q", [""])[0]
            return self.send_json(all_aathichudi(query))
        if path == "/api/kurals":
            query = parse_qs(urlparse(self.path).query)
            section = query.get("section", [""])[0]
            chapter = query.get("chapter", [""])[0]
            return self.send_json(all_kurals(section=section, chapter=chapter))
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

    def do_OPTIONS(self):
        if urlparse(self.path).path != "/api/public/verify":
            return self.send_error(404)
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_POST(self):
        path = urlparse(self.path).path
        if path not in ("/api/auth/register", "/api/auth/login", "/api/auth/logout", "/api/verify", "/api/gate", "/api/teacher/check", "/api/public/verify"):
            return self.send_json({"error": "Not found"}, 404)
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size < 1 or size > 100_000:
                return self.send_json({"error": "Request must be between 1 and 100000 bytes"}, 400)
            body = json.loads(self.rfile.read(size))
            if path == "/api/auth/register":
                username = str(body.get("username", "")).strip()
                password = str(body.get("password", ""))
                valid_name = all(unicodedata.category(char)[0] in ("L", "M", "N") or char in "_.-" for char in username)
                if not 3 <= len(username) <= 32 or not valid_name:
                    return self.send_json({"error": "பயனர் பெயர் 3 முதல் 32 எழுத்துகள் வரை இருக்க வேண்டும்; ஆங்கிலம் அல்லது தமிழ் எழுத்துகள், எண்கள், _, ., - ஆகியவற்றைப் பயன்படுத்தலாம்."}, 400)
                if len(password) < 8:
                    return self.send_json({"error": "கடவுச்சொல் குறைந்தது 8 எழுத்துகள் கொண்டிருக்க வேண்டும்."}, 400)
                salt = secrets.token_bytes(16)
                digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PASSWORD_ROUNDS)
                try:
                    with connect() as db:
                        cursor = db.execute("INSERT INTO users(username,password_salt,password_hash,created_at) VALUES(?,?,?,?)",
                                            (username, salt, digest, int(time.time())))
                        user_id = cursor.lastrowid
                except sqlite3.IntegrityError:
                    return self.send_json({"error": "இந்தப் பயனர் பெயர் ஏற்கெனவே பயன்படுத்தப்படுகிறது. வேறு பெயரைத் தேர்ந்தெடுக்கவும்."}, 409)
                return self.create_session(user_id, username)
            if path == "/api/auth/login":
                username = str(body.get("username", "")).strip()
                password = str(body.get("password", ""))
                with connect() as db:
                    user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
                if not user:
                    return self.send_json({"error": "பயனர் பெயர் அல்லது கடவுச்சொல் தவறாக உள்ளது. இரண்டையும் சரிபார்த்து மீண்டும் முயற்சிக்கவும்."}, 401)
                digest = hashlib.pbkdf2_hmac("sha256", password.encode(), user["password_salt"], PASSWORD_ROUNDS)
                if not hmac.compare_digest(digest, user["password_hash"]):
                    return self.send_json({"error": "பயனர் பெயர் அல்லது கடவுச்சொல் தவறாக உள்ளது. இரண்டையும் சரிபார்த்து மீண்டும் முயற்சிக்கவும்."}, 401)
                return self.create_session(user["id"], user["username"])
            if path == "/api/auth/logout":
                token = self.session_token()
                if token:
                    with connect() as db:
                        db.execute("DELETE FROM auth_sessions WHERE token_hash=?", (hashlib.sha256(token.encode()).hexdigest(),))
                return self.send_json({"ok": True}, headers={"Set-Cookie": self.session_cookie("", clear=True)})
            if path == "/api/public/verify":
                if not public_api_allowed(self.client_address[0]):
                    return self.send_json({"error": "கோரிக்கை வரம்பு எட்டப்பட்டது; ஒரு நிமிடம் கழித்து முயற்சிக்கவும்."}, 429,
                                          {"Access-Control-Allow-Origin": "*"})
                text = body.get("text", "")
                if not isinstance(text, str) or len(text) > 10_000:
                    return self.send_json({"error": "text என்ற உரையை 10000 எழுத்துகளுக்குள் அனுப்பவும்."}, 400,
                                          {"Access-Control-Allow-Origin": "*"})
                return self.send_json(verify(text), headers={"Access-Control-Allow-Origin": "*"})
            if not self.current_user():
                return self.send_json({"error": "உள்நுழைந்த பிறகே இந்த வசதியைப் பயன்படுத்தலாம்."}, 401)
            if path == "/api/verify":
                text = body.get("text", "")
                if not isinstance(text, str):
                    return self.send_json({"error": "text must be a string"}, 400)
                return self.send_json(verify(text))
            if path == "/api/teacher/check":
                quotes = body.get("quotes", [])
                if not isinstance(quotes, list) or not 1 <= len(quotes) <= 100 or any(not isinstance(q, str) for q in quotes):
                    return self.send_json({"error": "1 முதல் 100 வரையிலான உரை வரிகளை அனுப்பவும்."}, 400)
                results = [{"quote": quote, "result": verify(quote)} for quote in quotes if quote.strip()]
                verified = sum(result["result"]["kind"] in ("exact", "format") for result in results)
                return self.send_json({"total": len(results), "verified": verified,
                                       "review": len(results) - verified, "results": results})
            draft = body.get("draft", "")
            manual = body.get("quote", "")
            return self.send_json(evaluate_gate(draft, manual))
        except (ValueError, json.JSONDecodeError) as exc:
            return self.send_json({"error": str(exc)}, 400)

    def session_token(self):
        for part in self.headers.get("Cookie", "").split(";"):
            name, _, value = part.strip().partition("=")
            if name == "meypporul_session":
                return value
        return ""

    def current_user(self):
        token = self.session_token()
        if not token:
            return None
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        with connect() as db:
            db.execute("DELETE FROM auth_sessions WHERE expires_at < ?", (int(time.time()),))
            row = db.execute("SELECT u.id,u.username FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>=?",
                             (token_hash, int(time.time()))).fetchone()
        return row

    def session_cookie(self, token, clear=False):
        secure = "; Secure" if self.headers.get("X-Forwarded-Proto", "").lower() == "https" else ""
        age = 0 if clear else SESSION_SECONDS
        return f"meypporul_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={age}{secure}"

    def create_session(self, user_id, username):
        token = secrets.token_urlsafe(32)
        digest = hashlib.sha256(token.encode()).hexdigest()
        with connect() as db:
            db.execute("DELETE FROM auth_sessions WHERE expires_at < ?", (int(time.time()),))
            db.execute("INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
                       (digest, user_id, int(time.time()) + SESSION_SECONDS))
        return self.send_json({"authenticated": True, "username": username}, headers={"Set-Cookie": self.session_cookie(token)})

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
