const api = () => (window.pywebview && window.pywebview.api) || null;
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let _toastTimer = null;

function showToast(message, type = "info") {
  const toast = $("#toast");
  if (!toast) return;
  if (_toastTimer) clearTimeout(_toastTimer);
  toast.textContent = message;
  toast.className = `toast ${type === "error" ? "error" : type === "success" ? "success" : ""}`;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("show"));
  _toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.hidden = true;
    }, 220);
  }, 3500);
}

function relativeTime(iso) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString("fr-FR");
}

function formatBytes(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ThemeManager = {
  STORAGE_KEY: "studioPdfTheme",

  current() {
    return document.documentElement.getAttribute("data-theme") || "light";
  },

  apply(theme) {
    if (theme !== "dark" && theme !== "light") theme = "light";
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(this.STORAGE_KEY, theme);
    } catch (e) {}
  },

  toggle() {
    const next = this.current() === "light" ? "dark" : "light";
    this.apply(next);
    return next;
  },

  init() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        this.apply(stored);
        return;
      }
    } catch (e) {}
    this.apply("light");
  },
};

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.substring(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Lecture impossible"));
    reader.readAsDataURL(file);
  });
}
