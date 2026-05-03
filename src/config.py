from pathlib import Path
import os

APP_NAME = "Le Studio PDF"
APP_VERSION = "2.7.3"
APP_PUBLISHER = "Triskell Studio"

# Beta lifecycle
IS_BETA = True
BETA_EXPIRY_DAYS = 14

# Auto-update — GitHub Releases
GITHUB_OWNER = "Jordan-Bourillot"
GITHUB_REPO = "le-studio-pdf"
UPDATE_CHECK_DELAY_MS = 5000  # delai apres lancement avant 1er check
UPDATE_INSTALLER_PATTERN = "LeStudioPDF_setup_*.exe"  # asset GitHub a telecharger

ROOT = Path(__file__).resolve().parent.parent
UI_DIR = ROOT / "ui"
ASSETS_DIR = ROOT / "assets"

if os.name == "nt":
    DATA_DIR = Path(os.environ.get("APPDATA", str(Path.home()))) / "StudioPDF"
else:
    DATA_DIR = Path.home() / ".studiopdf"

DB_PATH = DATA_DIR / "studio.db"

TRIAL_DAYS = 14

WINDOW_WIDTH = 1200
WINDOW_HEIGHT = 800
WINDOW_MIN_WIDTH = 900
WINDOW_MIN_HEIGHT = 600

BG_COLOR = "#faf6f0"
