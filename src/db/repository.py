import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path

from src.config import DB_PATH, TRIAL_DAYS


SCHEMA_FILE = Path(__file__).parent / "schema.sql"


@contextmanager
def _conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _conn() as c:
        c.executescript(SCHEMA_FILE.read_text(encoding="utf-8"))
    _ensure_trial()


def _ensure_trial() -> None:
    with _conn() as c:
        row = c.execute("SELECT key FROM license LIMIT 1").fetchone()
        if row is None:
            now = datetime.utcnow()
            ends = now + timedelta(days=TRIAL_DAYS)
            c.execute(
                "INSERT INTO license (key, status, trial_started_at, trial_ends_at)"
                " VALUES (?, ?, ?, ?)",
                ("TRIAL", "trial", now.isoformat(), ends.isoformat()),
            )


def get_license_status() -> dict:
    with _conn() as c:
        row = c.execute("SELECT * FROM license LIMIT 1").fetchone()
        if not row:
            return {"status": "unknown", "days_left": 0}
        if row["status"] == "trial":
            ends = datetime.fromisoformat(row["trial_ends_at"])
            delta = ends - datetime.utcnow()
            days_left = max(0, delta.days + (1 if delta.seconds > 0 else 0))
            return {
                "status": "trial",
                "days_left": days_left,
                "expired": days_left == 0,
            }
        return {"status": row["status"], "days_left": -1, "expired": False}


def add_recent(path: str, filename: str, page_count: int, action: str = "ouvert") -> None:
    with _conn() as c:
        c.execute(
            "DELETE FROM recent_files WHERE path = ?",
            (path,),
        )
        c.execute(
            "INSERT INTO recent_files (path, filename, last_opened, last_action, page_count)"
            " VALUES (?, ?, ?, ?, ?)",
            (path, filename, datetime.utcnow().isoformat(), action, page_count),
        )
        c.execute(
            "DELETE FROM recent_files WHERE id NOT IN ("
            "  SELECT id FROM recent_files ORDER BY last_opened DESC LIMIT 20"
            ")"
        )


def list_recent(limit: int = 6) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT path, filename, last_opened, last_action, page_count"
            " FROM recent_files ORDER BY last_opened DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def remove_recent(path: str) -> None:
    with _conn() as c:
        c.execute("DELETE FROM recent_files WHERE path = ?", (path,))


def get_preference(key: str, default: str | None = None) -> str | None:
    with _conn() as c:
        row = c.execute("SELECT value FROM preferences WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else default


def set_preference(key: str, value: str) -> None:
    with _conn() as c:
        c.execute(
            "INSERT INTO preferences (key, value) VALUES (?, ?)"
            " ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )


def get_all_preferences() -> dict:
    with _conn() as c:
        rows = c.execute("SELECT key, value FROM preferences").fetchall()
        return {row["key"]: row["value"] for row in rows}


def clear_recents() -> None:
    with _conn() as c:
        c.execute("DELETE FROM recent_files")


def log_action(action: str, duration_ms: int, success: bool, error: str | None = None) -> None:
    with _conn() as c:
        c.execute(
            "INSERT INTO action_log (action, duration_ms, success, error, created_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (action, duration_ms, 1 if success else 0, error, datetime.utcnow().isoformat()),
        )
