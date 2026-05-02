"""
Garde de cycle de vie BETA — recopie le pattern DéliNote (betaGuard.ts).

Chaque version est marquee comme beta avec une expiration en N jours depuis
la 1ere fois ou l user ouvre cette version specifique sur sa machine. Quand
expire, l app affiche un ecran bloquant tant qu une nouvelle build n est pas
installee. Le timestamp 'first_seen' est stocke par version, donc chaque
upgrade reset le compteur.

Pour shipper une release non-beta : config.IS_BETA = False (no-op).
"""
from datetime import datetime, timedelta

from src.config import APP_VERSION, IS_BETA, BETA_EXPIRY_DAYS
from src.db import repository as repo


_FIRST_SEEN_KEY_PREFIX = "beta_first_seen_"


def get_beta_status() -> dict:
    if not IS_BETA:
        return {
            "is_beta": False,
            "expired": False,
            "days_left": 999_999,
            "hours_left": 999_999,
            "version": APP_VERSION,
            "first_seen": "",
            "expires_at": "",
        }

    key = _FIRST_SEEN_KEY_PREFIX + APP_VERSION
    stored = repo.get_preference(key)
    try:
        first_seen = datetime.fromisoformat(stored) if stored else datetime.utcnow()
    except (ValueError, TypeError):
        first_seen = datetime.utcnow()

    if not stored:
        repo.set_preference(key, first_seen.isoformat())

    expires_at = first_seen + timedelta(days=BETA_EXPIRY_DAYS)
    now = datetime.utcnow()
    delta = expires_at - now
    expired = delta.total_seconds() <= 0
    days_left = max(0, delta.days + (1 if delta.seconds > 0 else 0))
    hours_left = max(0, int(delta.total_seconds() // 3600))

    return {
        "is_beta": True,
        "expired": expired,
        "days_left": days_left,
        "hours_left": hours_left,
        "version": APP_VERSION,
        "first_seen": first_seen.isoformat(),
        "expires_at": expires_at.isoformat(),
    }
