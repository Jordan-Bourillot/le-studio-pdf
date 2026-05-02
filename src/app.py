import threading
import webview

from src.config import (
    APP_NAME,
    APP_VERSION,
    UI_DIR,
    BG_COLOR,
    WINDOW_WIDTH,
    WINDOW_HEIGHT,
    WINDOW_MIN_WIDTH,
    WINDOW_MIN_HEIGHT,
    UPDATE_CHECK_DELAY_MS,
)
from src.api.bridge import Bridge
from src.db.repository import init_db, get_preference


def _schedule_auto_update_check() -> None:
    """Lance une verification de mise a jour 5 sec apres le boot, en arriere-plan."""
    def _go() -> None:
        from src.core.updater import updater
        channel = get_preference("update_channel", "stable") or "stable"
        updater.set_channel(channel)
        updater.check_for_updates(async_=True)

    timer = threading.Timer(UPDATE_CHECK_DELAY_MS / 1000.0, _go)
    timer.daemon = True
    timer.start()


def main() -> None:
    init_db()

    bridge = Bridge()

    window = webview.create_window(
        title=f"{APP_NAME} {APP_VERSION}",
        url=str(UI_DIR / "index.html"),
        js_api=bridge,
        width=WINDOW_WIDTH,
        height=WINDOW_HEIGHT,
        min_size=(WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT),
        background_color=BG_COLOR,
    )
    bridge.set_window(window)
    bridge.attach_updater_listener()

    _schedule_auto_update_check()

    webview.start(debug=False)


if __name__ == "__main__":
    main()
