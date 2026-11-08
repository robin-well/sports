#!/usr/bin/env python3
"""跃迹 YUEJI — zero-dependency local backend.

Serves the static frontend and a JSON API backed by SQLite.
Designed for local development / single-node deployment.

Run:
    python3 server.py
    python3 server.py --port 8080

Environment:
    YUEJI_PORT=8080
    YUEJI_SECURE_COOKIE=1     # set when serving over HTTPS
    YUEJI_DEV_CODE=123456     # local development OTP
    YUEJI_DB_PATH=./data/yueji.db
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DB_PATH = Path(os.environ.get("YUEJI_DB_PATH", DATA_DIR / "yueji.db"))
SEED_PATH = DATA_DIR / "demo-seed.json"
DEV_CODE = os.environ.get("YUEJI_DEV_CODE", "123456")
SECURE_COOKIE = os.environ.get("YUEJI_SECURE_COOKIE", "0") == "1"
COOKIE_NAME = "yueji_session"
SESSION_DAYS = 30
MAX_BODY = 15 * 1024 * 1024
SECRET = os.environ.get("YUEJI_SECRET", "local-dev-change-me")

PHONE_RE = re.compile(r"^1[3-9]\d{9}$")
DEMO_PHONE = "13800008888"
DEMO_USER_ID = "demo-user"
STRENGTH_PARTS = {"chest", "back", "shoulders", "arms", "legs", "glutes", "core", "full"}


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              phone TEXT NOT NULL UNIQUE,
              nickname TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS profiles (
              user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
              sex TEXT,
              age_band TEXT,
              height REAL,
              weight REAL,
              goal TEXT,
              freq INTEGER,
              level TEXT,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS activities (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              type TEXT NOT NULL,
              date TEXT NOT NULL,
              start_time TEXT,
              duration INTEGER NOT NULL DEFAULT 0,
              distance REAL,
              calories INTEGER,
              avg_hr INTEGER,
              max_hr INTEGER,
              rpe INTEGER,
              elevation INTEGER,
              notes TEXT,
              source TEXT,
              stream_json TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              deleted_at TEXT,
              revision INTEGER NOT NULL DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_activities_user_date
              ON activities(user_id, date);

            CREATE TABLE IF NOT EXISTS weights (
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              date TEXT NOT NULL,
              kg REAL NOT NULL,
              created_at TEXT NOT NULL,
              PRIMARY KEY (user_id, date)
            );

            CREATE TABLE IF NOT EXISTS sessions (
              token_hash TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              created_at TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              last_seen TEXT,
              user_agent TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

            CREATE TABLE IF NOT EXISTS otp_codes (
              phone TEXT PRIMARY KEY,
              code_hash TEXT NOT NULL,
              expires_at REAL NOT NULL,
              attempts INTEGER NOT NULL DEFAULT 0,
              sent_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS meta (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
            """
        )
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(activities)")}
        if "strength_json" not in cols:
            conn.execute("ALTER TABLE activities ADD COLUMN strength_json TEXT")
        seed_demo(conn)


def seed_demo(conn: sqlite3.Connection) -> None:
    """Seed the demo account exactly once (unless the DB is deleted)."""
    existing = conn.execute("SELECT id FROM users WHERE phone = ?", (DEMO_PHONE,)).fetchone()
    row = conn.execute("SELECT value FROM meta WHERE key = 'demo_seed_version'").fetchone()
    if row and row["value"] == "v2" and existing:
        return
    if not SEED_PATH.exists():
        return
    try:
        data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return

    now = now_iso()
    if not existing:
        conn.execute(
            "INSERT INTO users(id, phone, nickname, created_at) VALUES (?, ?, ?, ?)",
            (DEMO_USER_ID, DEMO_PHONE, data["user"].get("nickname", "林一"), now),
        )
        profile = data["user"].get("profile") or {}
        conn.execute(
            """INSERT INTO profiles(user_id, sex, age_band, height, weight, goal, freq, level, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                DEMO_USER_ID,
                profile.get("sex"),
                profile.get("ageBand"),
                profile.get("height"),
                profile.get("weight"),
                profile.get("goal"),
                profile.get("freq"),
                profile.get("level"),
                now,
            ),
        )

    uid = existing["id"] if existing else DEMO_USER_ID
    count = conn.execute(
        "SELECT COUNT(*) AS n FROM activities WHERE user_id = ?", (uid,)
    ).fetchone()["n"]
    if count == 0:
        for activity in data.get("activities", []):
            insert_activity(conn, uid, activity, preserve_id=True)
    wcount = conn.execute(
        "SELECT COUNT(*) AS n FROM weights WHERE user_id = ?", (uid,)
    ).fetchone()["n"]
    if wcount == 0:
        for weight in data.get("weights", []):
            conn.execute(
                "INSERT OR REPLACE INTO weights(user_id, date, kg, created_at) VALUES (?, ?, ?, ?)",
                (uid, weight["date"], float(weight["kg"]), now),
            )
    conn.execute(
        "INSERT OR REPLACE INTO meta(key, value) VALUES ('demo_seed_version', 'v2')"
    )
    conn.commit()


# ---------------------------------------------------------------------------
# Serialization / helpers
# ---------------------------------------------------------------------------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def today_iso() -> str:
    return date.today().isoformat()


def hash_code(phone: str, code: str) -> str:
    return hmac.new(SECRET.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def hash_token(token: str) -> str:
    return hmac.new(SECRET.encode(), token.encode(), hashlib.sha256).hexdigest()


def profile_dict(row: sqlite3.Row | None) -> dict | None:
    if not row:
        return None
    return {
        "sex": row["sex"],
        "ageBand": row["age_band"],
        "height": row["height"],
        "weight": row["weight"],
        "goal": row["goal"],
        "freq": row["freq"],
        "level": row["level"],
    }


def user_dict(conn: sqlite3.Connection, user_id: str) -> dict | None:
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        return None
    profile = conn.execute(
        "SELECT * FROM profiles WHERE user_id = ?", (user_id,)
    ).fetchone()
    return {
        "id": row["id"],
        "phone": row["phone"],
        "nickname": row["nickname"],
        "createdAt": row["created_at"],
        "profile": profile_dict(profile),
    }


def activity_dict(row: sqlite3.Row) -> dict:
    stream = None
    if row["stream_json"]:
        try:
            stream = json.loads(row["stream_json"])
        except json.JSONDecodeError:
            stream = None
    strength = []
    try:
        if row["strength_json"]:
            parsed = json.loads(row["strength_json"])
            if isinstance(parsed, list):
                strength = parsed
    except (json.JSONDecodeError, IndexError):
        strength = []
    return {
        "id": row["id"],
        "type": row["type"],
        "date": row["date"],
        "startTime": row["start_time"] or "",
        "duration": row["duration"],
        "distance": row["distance"],
        "calories": row["calories"],
        "avgHr": row["avg_hr"],
        "maxHr": row["max_hr"],
        "rpe": row["rpe"],
        "elevation": row["elevation"],
        "notes": row["notes"] or "",
        "source": row["source"] or "manual",
        "stream": stream,
        "strength": strength,
        "createdAt": row["created_at"],
        "revision": row["revision"],
    }


def list_activities(conn: sqlite3.Connection, user_id: str) -> list[dict]:
    rows = conn.execute(
        """SELECT * FROM activities
           WHERE user_id = ? AND deleted_at IS NULL
           ORDER BY date DESC, created_at DESC""",
        (user_id,),
    ).fetchall()
    return [activity_dict(r) for r in rows]


def list_weights(conn: sqlite3.Connection, user_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT date, kg FROM weights WHERE user_id = ? ORDER BY date ASC", (user_id,)
    ).fetchall()
    return [{"date": r["date"], "kg": r["kg"]} for r in rows]


def bootstrap_payload(conn: sqlite3.Connection, user_id: str) -> dict:
    return {
        "user": user_dict(conn, user_id),
        "activities": list_activities(conn, user_id),
        "weights": list_weights(conn, user_id),
        "serverTime": now_iso(),
    }


def int_or_none(value):
    if value is None or value == "":
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def float_or_none(value):
    if value is None or value == "":
        return None
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return None


def sanitize_strength(value) -> list[dict]:
    if not isinstance(value, list):
        return []
    out = []
    for item in value[:40]:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()[:60]
        if not name:
            continue
        part = str(item.get("part") or "full")
        if part not in STRENGTH_PARTS:
            part = "full"
        sets = int_or_none(item.get("sets")) or 1
        reps = int_or_none(item.get("reps")) or 1
        weight = float_or_none(item.get("weight"))
        if weight is None or weight < 0:
            weight = 0.0
        out.append({
            "name": name,
            "part": part,
            "sets": max(1, min(20, sets)),
            "reps": max(1, min(100, reps)),
            "weight": round(min(500.0, weight), 1),
        })
    return out


def sanitize_activity(data: dict, existing: dict | None = None) -> dict:
    src = {**(existing or {}), **(data or {})}
    duration = int_or_none(src.get("duration")) or 0
    return {
        "id": src.get("id") or str(uuid.uuid4()),
        "type": str(src.get("type") or "other")[:24],
        "date": str(src.get("date") or today_iso())[:10],
        "startTime": str(src.get("startTime") or "")[:8],
        "duration": max(0, duration),
        "distance": float_or_none(src.get("distance")),
        "calories": int_or_none(src.get("calories")),
        "avgHr": int_or_none(src.get("avgHr")),
        "maxHr": int_or_none(src.get("maxHr")),
        "rpe": int_or_none(src.get("rpe")),
        "elevation": int_or_none(src.get("elevation")),
        "notes": str(src.get("notes") or "")[:500],
        "source": str(src.get("source") or "manual")[:24],
        "stream": src.get("stream") if isinstance(src.get("stream"), list) else None,
        "strength": sanitize_strength(src.get("strength")),
    }


def insert_activity(conn: sqlite3.Connection, user_id: str, data: dict, preserve_id: bool = False) -> dict:
    a = sanitize_activity(data)
    now = now_iso()
    activity_id = a["id"] if preserve_id or a.get("id") else str(uuid.uuid4())
    # Never let a client overwrite another user's row.
    if conn.execute("SELECT 1 FROM activities WHERE id = ?", (activity_id,)).fetchone():
        activity_id = str(uuid.uuid4())
    stream_json = json.dumps(a["stream"], separators=(",", ":")) if a["stream"] else None
    strength_json = json.dumps(a["strength"], separators=(",", ":")) if a["strength"] else None
    conn.execute(
        """INSERT INTO activities(
             id, user_id, type, date, start_time, duration, distance, calories,
             avg_hr, max_hr, rpe, elevation, notes, source, stream_json, strength_json,
             created_at, updated_at, revision
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)""",
        (
            activity_id, user_id, a["type"], a["date"], a["startTime"],
            a["duration"], a["distance"], a["calories"], a["avgHr"], a["maxHr"],
            a["rpe"], a["elevation"], a["notes"], a["source"], stream_json, strength_json, now, now,
        ),
    )
    row = conn.execute("SELECT * FROM activities WHERE id = ?", (activity_id,)).fetchone()
    return activity_dict(row)


def is_duplicate(conn: sqlite3.Connection, user_id: str, a: dict) -> bool:
    row = conn.execute(
        """SELECT 1 FROM activities
           WHERE user_id = ? AND deleted_at IS NULL AND date = ? AND type = ?
             AND ABS(duration - ?) <= 1
             AND ABS(COALESCE(distance, 0) - COALESCE(?, 0)) < 0.05
           LIMIT 1""",
        (user_id, a["date"], a["type"], a["duration"], a.get("distance")),
    ).fetchone()
    return row is not None


def set_session_cookie(handler: BaseHTTPRequestHandler, token: str) -> None:
    parts = [
        f"{COOKIE_NAME}={token}",
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        f"Max-Age={SESSION_DAYS * 86400}",
    ]
    if SECURE_COOKIE:
        parts.append("Secure")
    handler.send_header("Set-Cookie", "; ".join(parts))


def clear_session_cookie(handler: BaseHTTPRequestHandler) -> None:
    parts = [f"{COOKIE_NAME}=", "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"]
    if SECURE_COOKIE:
        parts.append("Secure")
    handler.send_header("Set-Cookie", "; ".join(parts))


def parse_cookies(header: str | None) -> dict[str, str]:
    out = {}
    if not header:
        return out
    for part in header.split(";"):
        if "=" in part:
            k, v = part.split("=", 1)
            out[k.strip()] = v.strip()
    return out


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

class YUEJIHandler(BaseHTTPRequestHandler):
    server_version = "YUEJI/2.0"
    protocol_version = "HTTP/1.1"

    # ---- plumbing ----

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[yueji] " + (fmt % args) + "\n")

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def error(self, status: int, message: str) -> None:
        self.send_json(status, {"error": message})

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        if length > MAX_BODY:
            raise ValueError("请求体过大")
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ValueError("JSON 格式不正确")
        if not isinstance(data, dict):
            raise ValueError("JSON 必须是对象")
        return data

    def check_origin(self) -> bool:
        origin = self.headers.get("Origin")
        if not origin:
            return True
        host = self.headers.get("Host", "")
        allowed = {f"http://{host}", f"https://{host}"}
        return origin in allowed

    def session_user(self) -> sqlite3.Row | None:
        cookies = parse_cookies(self.headers.get("Cookie"))
        token = cookies.get(COOKIE_NAME)
        if not token:
            return None
        conn = connect()
        try:
            row = conn.execute(
                """SELECT s.token_hash, s.expires_at, u.*
                   FROM sessions s JOIN users u ON u.id = s.user_id
                   WHERE s.token_hash = ?""",
                (hash_token(token),),
            ).fetchone()
            if not row:
                return None
            if row["expires_at"] < now_iso():
                conn.execute("DELETE FROM sessions WHERE token_hash = ?", (row["token_hash"],))
                conn.commit()
                return None
            conn.execute(
                "UPDATE sessions SET last_seen = ? WHERE token_hash = ?",
                (now_iso(), row["token_hash"]),
            )
            conn.commit()
            return row
        finally:
            conn.close()

    def require_user(self) -> sqlite3.Row | None:
        user = self.session_user()
        if not user:
            self.error(HTTPStatus.UNAUTHORIZED, "请先登录")
            return None
        return user

    # ---- HTTP methods ----

    def do_GET(self) -> None:
        path = unquote(urlparse(self.path).path)
        if path.startswith("/api/"):
            self.handle_api("GET", path)
            return
        self.serve_static(path)

    def do_HEAD(self) -> None:
        path = unquote(urlparse(self.path).path)
        if path.startswith("/api/"):
            self.handle_api("GET", path, head=True)
            return
        self.serve_static(path, head=True)

    def do_POST(self) -> None:
        self.handle_api("POST", unquote(urlparse(self.path).path))

    def do_PUT(self) -> None:
        self.handle_api("PUT", unquote(urlparse(self.path).path))

    def do_PATCH(self) -> None:
        self.handle_api("PATCH", unquote(urlparse(self.path).path))

    def do_DELETE(self) -> None:
        self.handle_api("DELETE", unquote(urlparse(self.path).path))

    # ---- API ----

    def handle_api(self, method: str, path: str, head: bool = False) -> None:
        try:
            if method in {"POST", "PUT", "PATCH", "DELETE"} and not self.check_origin():
                self.error(HTTPStatus.FORBIDDEN, "非法请求来源")
                return
            if path == "/api/health" and method == "GET":
                self.send_json(200, {"ok": True, "service": "yueji", "time": now_iso()})
                return
            if path == "/api/auth/send-code" and method == "POST":
                self.api_send_code()
                return
            if path == "/api/auth/login" and method == "POST":
                self.api_login()
                return
            if path == "/api/auth/demo" and method == "POST":
                self.api_demo_login()
                return
            if path == "/api/auth/logout" and method == "POST":
                self.api_logout()
                return
            if path == "/api/bootstrap" and method == "GET":
                self.api_bootstrap()
                return
            if path == "/api/profile" and method == "PUT":
                self.api_update_profile()
                return
            if path == "/api/activities" and method == "POST":
                self.api_create_activity()
                return
            if path == "/api/activities/bulk" and method == "POST":
                self.api_bulk_activities()
                return
            if path.startswith("/api/activities/") and method == "PATCH":
                self.api_update_activity(path.rsplit("/", 1)[-1])
                return
            if path.startswith("/api/activities/") and method == "DELETE":
                self.api_delete_activity(path.rsplit("/", 1)[-1])
                return
            if path == "/api/weights" and method == "POST":
                self.api_add_weight()
                return
            if path == "/api/demo/load" and method == "POST":
                self.api_load_sample()
                return
            if path == "/api/data" and method == "DELETE":
                self.api_clear_data()
                return
            if path == "/api/export" and method == "GET":
                self.api_export()
                return
            self.error(HTTPStatus.NOT_FOUND, "接口不存在")
        except ValueError as exc:
            self.error(HTTPStatus.BAD_REQUEST, str(exc))
        except Exception as exc:  # noqa: BLE001 - last-resort API guard
            self.log_message("API error: %s", exc)
            self.error(HTTPStatus.INTERNAL_SERVER_ERROR, "服务器内部错误")

    def create_session(self, conn: sqlite3.Connection, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        now = now_iso()
        expires = (datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)).isoformat(timespec="seconds")
        conn.execute(
            """INSERT INTO sessions(token_hash, user_id, created_at, expires_at, last_seen, user_agent)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (hash_token(token), user_id, now, expires, now, (self.headers.get("User-Agent") or "")[:300]),
        )
        conn.commit()
        return token

    def get_or_create_user(self, conn: sqlite3.Connection, phone: str) -> str:
        row = conn.execute("SELECT id FROM users WHERE phone = ?", (phone,)).fetchone()
        if row:
            return row["id"]
        user_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO users(id, phone, nickname, created_at) VALUES (?, ?, ?, ?)",
            (user_id, phone, f"运动者 {phone[-4:]}", now_iso()),
        )
        conn.commit()
        return user_id

    def api_send_code(self) -> None:
        data = self.read_json()
        phone = str(data.get("phone") or "").strip()
        if not PHONE_RE.match(phone):
            self.error(HTTPStatus.BAD_REQUEST, "请输入有效的手机号")
            return
        conn = connect()
        try:
            row = conn.execute("SELECT sent_at FROM otp_codes WHERE phone = ?", (phone,)).fetchone()
            if row and time_now() - row["sent_at"] < 60:
                self.error(HTTPStatus.TOO_MANY_REQUESTS, "验证码发送过于频繁，请稍后再试")
                return
            code = DEV_CODE
            now = time_now()
            conn.execute(
                """INSERT INTO otp_codes(phone, code_hash, expires_at, attempts, sent_at)
                   VALUES (?, ?, ?, 0, ?)
                   ON CONFLICT(phone) DO UPDATE SET
                     code_hash = excluded.code_hash,
                     expires_at = excluded.expires_at,
                     attempts = 0,
                     sent_at = excluded.sent_at""",
                (phone, hash_code(phone, code), now + 300, now),
            )
            conn.commit()
            self.log_message("DEV OTP for %s is %s", phone, code)
            self.send_json(200, {"ok": True, "expiresIn": 300, "devCode": DEV_CODE})
        finally:
            conn.close()

    def api_login(self) -> None:
        data = self.read_json()
        phone = str(data.get("phone") or "").strip()
        code = str(data.get("code") or "").strip()
        if not PHONE_RE.match(phone):
            self.error(HTTPStatus.BAD_REQUEST, "请输入有效的手机号")
            return
        if not re.match(r"^\d{6}$", code):
            self.error(HTTPStatus.BAD_REQUEST, "请输入 6 位验证码")
            return
        conn = connect()
        try:
            row = conn.execute("SELECT * FROM otp_codes WHERE phone = ?", (phone,)).fetchone()
            if not row or row["expires_at"] < time_now() or row["attempts"] >= 5:
                self.error(HTTPStatus.UNAUTHORIZED, "验证码已过期，请重新获取")
                return
            if not hmac.compare_digest(row["code_hash"], hash_code(phone, code)):
                conn.execute("UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?", (phone,))
                conn.commit()
                self.error(HTTPStatus.UNAUTHORIZED, "验证码不正确")
                return
            conn.execute("DELETE FROM otp_codes WHERE phone = ?", (phone,))
            conn.commit()
            user_id = self.get_or_create_user(conn, phone)
            token = self.create_session(conn, user_id)
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            set_session_cookie(self, token)
            payload = bootstrap_payload(conn, user_id)
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)
        finally:
            conn.close()

    def api_demo_login(self) -> None:
        self.read_json()  # consume the POST body so keep-alive stays aligned
        conn = connect()
        try:
            row = conn.execute("SELECT id FROM users WHERE phone = ?", (DEMO_PHONE,)).fetchone()
            if not row:
                seed_demo(conn)
                row = conn.execute("SELECT id FROM users WHERE phone = ?", (DEMO_PHONE,)).fetchone()
            if not row:
                self.error(HTTPStatus.INTERNAL_SERVER_ERROR, "体验账号尚未初始化")
                return
            token = self.create_session(conn, row["id"])
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            set_session_cookie(self, token)
            body = json.dumps(bootstrap_payload(conn, row["id"]), ensure_ascii=False).encode("utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)
        finally:
            conn.close()

    def api_logout(self) -> None:
        self.read_json()  # consume the POST body so keep-alive stays aligned
        cookies = parse_cookies(self.headers.get("Cookie"))
        token = cookies.get(COOKIE_NAME)
        if token:
            conn = connect()
            try:
                conn.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_token(token),))
                conn.commit()
            finally:
                conn.close()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        clear_session_cookie(self)
        body = b'{"ok":true}'
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def api_bootstrap(self) -> None:
        user = self.require_user()
        if not user:
            return
        conn = connect()
        try:
            self.send_json(200, bootstrap_payload(conn, user["id"]))
        finally:
            conn.close()

    def api_update_profile(self) -> None:
        user = self.require_user()
        if not user:
            return
        data = self.read_json()
        profile = data.get("profile") if isinstance(data.get("profile"), dict) else data
        try:
            height = float(profile.get("height") or 0)
            weight = float(profile.get("weight") or 0)
            freq = int(profile.get("freq") or 0)
        except (TypeError, ValueError):
            self.error(HTTPStatus.BAD_REQUEST, "身体数据格式不正确")
            return
        if not 100 <= height <= 250 or not 25 <= weight <= 300:
            self.error(HTTPStatus.BAD_REQUEST, "身高或体重超出合理范围")
            return
        if not 1 <= freq <= 7:
            self.error(HTTPStatus.BAD_REQUEST, "训练频率格式不正确")
            return
        nickname = data.get('nickname')
        if nickname is not None:
            nickname = ' '.join(str(nickname).split())
            if not nickname or len(nickname) > 20:
                self.error(HTTPStatus.BAD_REQUEST, '昵称长度需在 1–20 个字符之间')
                return
        now = now_iso()
        conn = connect()
        try:
            if nickname is not None:
                conn.execute("UPDATE users SET nickname = ? WHERE id = ?", (nickname, user["id"]))
            conn.execute(
                """INSERT INTO profiles(user_id, sex, age_band, height, weight, goal, freq, level, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(user_id) DO UPDATE SET
                     sex = excluded.sex, age_band = excluded.age_band,
                     height = excluded.height, weight = excluded.weight,
                     goal = excluded.goal, freq = excluded.freq,
                     level = excluded.level, updated_at = excluded.updated_at""",
                (
                    user["id"], str(profile.get("sex") or "male"),
                    str(profile.get("ageBand") or "26-35"), height, weight,
                    str(profile.get("goal") or "health"), freq,
                    str(profile.get("level") or "casual"), now,
                ),
            )
            conn.execute(
                """INSERT INTO weights(user_id, date, kg, created_at) VALUES (?, ?, ?, ?)
                   ON CONFLICT(user_id, date) DO UPDATE SET kg = excluded.kg""",
                (user["id"], today_iso(), weight, now),
            )
            conn.commit()
            current_nickname = conn.execute(
                "SELECT nickname FROM users WHERE id = ?", (user["id"],)
            ).fetchone()["nickname"]
            self.send_json(200, {"ok": True, "nickname": current_nickname, "profile": profile_dict(
                conn.execute("SELECT * FROM profiles WHERE user_id = ?", (user["id"],)).fetchone()
            )})
        finally:
            conn.close()

    def api_create_activity(self) -> None:
        user = self.require_user()
        if not user:
            return
        data = self.read_json()
        activity = data.get("activity") if isinstance(data.get("activity"), dict) else data
        candidate = sanitize_activity(activity)
        if not candidate["duration"] and not candidate["distance"]:
            self.error(HTTPStatus.BAD_REQUEST, "时长和距离不能同时为空")
            return
        conn = connect()
        try:
            created = insert_activity(conn, user["id"], candidate)
            conn.commit()
            self.send_json(HTTPStatus.CREATED, {"ok": True, "activity": created})
        finally:
            conn.close()

    def api_update_activity(self, activity_id: str) -> None:
        user = self.require_user()
        if not user:
            return
        data = self.read_json()
        conn = connect()
        try:
            row = conn.execute(
                "SELECT * FROM activities WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
                (activity_id, user["id"]),
            ).fetchone()
            if not row:
                self.error(HTTPStatus.NOT_FOUND, "记录不存在")
                return
            existing = activity_dict(row)
            candidate = sanitize_activity(data.get("activity") if isinstance(data.get("activity"), dict) else data, existing)
            candidate["id"] = activity_id
            stream_json = json.dumps(candidate["stream"], separators=(",", ":")) if candidate.get("stream") else None
            strength_json = json.dumps(candidate["strength"], separators=(",", ":")) if candidate.get("strength") else None
            conn.execute(
                """UPDATE activities SET
                     type = ?, date = ?, start_time = ?, duration = ?, distance = ?,
                     calories = ?, avg_hr = ?, max_hr = ?, rpe = ?, elevation = ?,
                     notes = ?, stream_json = ?, strength_json = ?, updated_at = ?, revision = revision + 1
                   WHERE id = ? AND user_id = ?""",
                (
                    candidate["type"], candidate["date"], candidate["startTime"], candidate["duration"],
                    candidate["distance"], candidate["calories"], candidate["avgHr"], candidate["maxHr"],
                    candidate["rpe"], candidate["elevation"], candidate["notes"], stream_json, strength_json,
                    now_iso(), activity_id, user["id"],
                ),
            )
            conn.commit()
            updated = conn.execute("SELECT * FROM activities WHERE id = ?", (activity_id,)).fetchone()
            self.send_json(200, {"ok": True, "activity": activity_dict(updated)})
        finally:
            conn.close()

    def api_delete_activity(self, activity_id: str) -> None:
        user = self.require_user()
        if not user:
            return
        conn = connect()
        try:
            row = conn.execute(
                "SELECT 1 FROM activities WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
                (activity_id, user["id"]),
            ).fetchone()
            if not row:
                self.error(HTTPStatus.NOT_FOUND, "记录不存在")
                return
            conn.execute(
                """UPDATE activities SET deleted_at = ?, updated_at = ?, revision = revision + 1
                   WHERE id = ? AND user_id = ?""",
                (now_iso(), now_iso(), activity_id, user["id"]),
            )
            conn.commit()
            self.send_json(200, {"ok": True})
        finally:
            conn.close()

    def api_bulk_activities(self) -> None:
        user = self.require_user()
        if not user:
            return
        data = self.read_json()
        activities = data.get("activities") or []
        weights = data.get("weights") or []
        if not isinstance(activities, list) or not isinstance(weights, list):
            self.error(HTTPStatus.BAD_REQUEST, "数据格式不正确")
            return
        added = 0
        skipped = 0
        conn = connect()
        try:
            for item in activities:
                if not isinstance(item, dict):
                    continue
                candidate = sanitize_activity(item)
                if not candidate["duration"] and not candidate["distance"]:
                    skipped += 1
                    continue
                if is_duplicate(conn, user["id"], candidate):
                    skipped += 1
                    continue
                candidate["source"] = str(item.get("source") or "json")[:24]
                insert_activity(conn, user["id"], candidate)
                added += 1
            weight_count = 0
            for weight in weights:
                if not isinstance(weight, dict):
                    continue
                try:
                    kg = float(weight.get("kg"))
                    day = str(weight.get("date"))[:10]
                except (TypeError, ValueError):
                    continue
                if not day or not 25 <= kg <= 300:
                    continue
                conn.execute(
                    """INSERT INTO weights(user_id, date, kg, created_at) VALUES (?, ?, ?, ?)
                       ON CONFLICT(user_id, date) DO UPDATE SET kg = excluded.kg""",
                    (user["id"], day, kg, now_iso()),
                )
                weight_count += 1
            if weight_count:
                latest = conn.execute(
                    "SELECT date, kg FROM weights WHERE user_id = ? ORDER BY date DESC LIMIT 1",
                    (user["id"],),
                ).fetchone()
                if latest:
                    conn.execute(
                        "UPDATE profiles SET weight = ?, updated_at = ? WHERE user_id = ?",
                        (latest["kg"], now_iso(), user["id"]),
                    )
            conn.commit()
            self.send_json(200, {"ok": True, "added": added, "skipped": skipped, "weights": weight_count})
        finally:
            conn.close()

    def api_add_weight(self) -> None:
        user = self.require_user()
        if not user:
            return
        data = self.read_json()
        try:
            kg = float(data.get("kg"))
        except (TypeError, ValueError):
            self.error(HTTPStatus.BAD_REQUEST, "体重格式不正确")
            return
        day = str(data.get("date") or today_iso())[:10]
        if not 25 <= kg <= 300:
            self.error(HTTPStatus.BAD_REQUEST, "体重超出合理范围")
            return
        conn = connect()
        try:
            conn.execute(
                """INSERT INTO weights(user_id, date, kg, created_at) VALUES (?, ?, ?, ?)
                   ON CONFLICT(user_id, date) DO UPDATE SET kg = excluded.kg""",
                (user["id"], day, kg, now_iso()),
            )
            latest = conn.execute(
                "SELECT date, kg FROM weights WHERE user_id = ? ORDER BY date DESC LIMIT 1",
                (user["id"],),
            ).fetchone()
            # Only move the profile's current weight when this entry is the latest.
            if latest and latest["date"] == day:
                conn.execute(
                    "UPDATE profiles SET weight = ?, updated_at = ? WHERE user_id = ?",
                    (kg, now_iso(), user["id"]),
                )
            conn.commit()
            self.send_json(200, {
                "ok": True,
                "date": day,
                "kg": kg,
                "currentWeight": latest["kg"] if latest else kg,
                "profileUpdated": bool(latest and latest["date"] == day),
            })
        finally:
            conn.close()

    def api_load_sample(self) -> None:
        self.read_json()  # consume the POST body so keep-alive stays aligned
        user = self.require_user()
        if not user:
            return
        conn = connect()
        try:
            count = conn.execute(
                "SELECT COUNT(*) AS n FROM activities WHERE user_id = ? AND deleted_at IS NULL",
                (user["id"],),
            ).fetchone()["n"]
            if count:
                self.error(HTTPStatus.CONFLICT, "当前账号已有运动记录，示例数据仅可导入空账号")
                return
            if not SEED_PATH.exists():
                self.error(HTTPStatus.NOT_FOUND, "示例数据不存在")
                return
            seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
            profile = conn.execute("SELECT weight FROM profiles WHERE user_id = ?", (user["id"],)).fetchone()
            current_weight = profile["weight"] if profile and profile["weight"] else 70
            demo_weights = seed.get("weights") or []
            last_demo = demo_weights[-1]["kg"] if demo_weights else current_weight
            shift = float(current_weight) - float(last_demo)
            inserted = 0
            for item in seed.get("activities", []):
                candidate = sanitize_activity(item)
                candidate["id"] = str(uuid.uuid4())
                insert_activity(conn, user["id"], candidate)
                inserted += 1
            for weight in demo_weights:
                conn.execute(
                    """INSERT OR REPLACE INTO weights(user_id, date, kg, created_at)
                       VALUES (?, ?, ?, ?)""",
                    (user["id"], weight["date"], round(float(weight["kg"]) + shift, 1), now_iso()),
                )
            conn.commit()
            self.send_json(200, {"ok": True, "added": inserted, "weights": len(demo_weights)})
        finally:
            conn.close()

    def api_clear_data(self) -> None:
        user = self.require_user()
        if not user:
            return
        conn = connect()
        try:
            activities = conn.execute(
                "SELECT COUNT(*) AS n FROM activities WHERE user_id = ?", (user["id"],)
            ).fetchone()["n"]
            weights = conn.execute(
                "SELECT COUNT(*) AS n FROM weights WHERE user_id = ?", (user["id"],)
            ).fetchone()["n"]
            conn.execute("DELETE FROM activities WHERE user_id = ?", (user["id"],))
            conn.execute("DELETE FROM weights WHERE user_id = ?", (user["id"],))
            conn.commit()
            self.send_json(200, {"ok": True, "activities": activities, "weights": weights})
        finally:
            conn.close()

    def api_export(self) -> None:
        user = self.require_user()
        if not user:
            return
        conn = connect()
        try:
            payload = bootstrap_payload(conn, user["id"])
            payload["app"] = "跃迹 YUEJI"
            payload["version"] = 2
            payload["exportedAt"] = now_iso()
            self.send_json(200, payload)
        finally:
            conn.close()

    # ---- static files ----

    def serve_static(self, path: str, head: bool = False) -> None:
        if path == "/":
            path = "/index.html"
        relative = path.lstrip("/")
        if relative.startswith("data/") or relative.startswith(".git") or relative == "server.py":
            self.error(HTTPStatus.NOT_FOUND, "Not found")
            return
        target = (ROOT / relative).resolve()
        try:
            target.relative_to(ROOT)
        except ValueError:
            self.error(HTTPStatus.NOT_FOUND, "Not found")
            return
        if not target.is_file():
            self.error(HTTPStatus.NOT_FOUND, "Not found")
            return

        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if target.suffix == ".js":
            content_type = "text/javascript; charset=utf-8"
        elif target.suffix in {".css", ".html", ".svg"}:
            content_type += "; charset=utf-8"
        data = target.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        if target.suffix == ".html":
            self.send_header("Referrer-Policy", "same-origin")
        self.end_headers()
        if not head:
            self.wfile.write(data)


def time_now() -> float:
    return datetime.now(timezone.utc).timestamp()


def main() -> None:
    parser = argparse.ArgumentParser(description="跃迹 YUEJI local backend")
    parser.add_argument("--port", type=int, default=int(os.environ.get("YUEJI_PORT", "8080")))
    parser.add_argument("--host", default=os.environ.get("YUEJI_HOST", "127.0.0.1"))
    args = parser.parse_args()

    init_db()
    server = ThreadingHTTPServer((args.host, args.port), YUEJIHandler)
    print(f"跃迹 YUEJI running at http://{args.host}:{args.port}")
    print(f"SQLite: {DB_PATH}")
    print(f"Dev OTP: {DEV_CODE}  (local development only)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping…")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
