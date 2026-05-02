import hashlib
import platform
import uuid


def get_machine_id() -> str:
    parts = [
        platform.node(),
        platform.machine(),
        str(uuid.getnode()),
    ]
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:32]
