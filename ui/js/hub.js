function setLoadedState(info) {
  AppState.currentFile = info;
  $("#dropzone-empty").hidden = true;
  $("#dropzone-loaded").hidden = false;
  $("#dropzone").classList.add("loaded");
  $("#loaded-name").textContent = info.filename;
  $("#loaded-name").title = info.path;
  const pageStr = info.page_count > 1 ? `${info.page_count} pages` : `${info.page_count} page`;
  $("#loaded-meta").textContent = `${pageStr} — ${formatBytes(info.size_bytes)}`;
}

function setEmptyState() {
  AppState.currentFile = null;
  $("#dropzone-empty").hidden = false;
  $("#dropzone-loaded").hidden = true;
  $("#dropzone").classList.remove("loaded");
}

function handleHubResult(result) {
  if (!result) return;
  if (!result.ok) {
    showToast(result.error || "Impossible d'ouvrir ce fichier.", "error");
    return;
  }
  const info = result.info;
  if (info.encrypted) {
    showToast(`${info.filename} est protégé par mot de passe.`, "info");
  } else {
    setLoadedState(info);
    showToast(
      `${info.filename} — ${info.page_count} page${info.page_count > 1 ? "s" : ""}, ${formatBytes(info.size_bytes)}`,
      "success"
    );
  }
  refreshHubState();
}

function renderTrial(state) {
  const banner = $("#trial-banner");
  const text = $("#trial-text");
  if (!state || state.status !== "trial") {
    banner.hidden = true;
    return;
  }
  if (state.expired) {
    text.textContent = "Période d'essai terminée — pensez à activer votre licence.";
  } else {
    const d = state.days_left;
    text.textContent = `Essai gratuit — ${d} jour${d > 1 ? "s" : ""} restant${d > 1 ? "s" : ""}.`;
  }
  banner.hidden = false;
}

function recentActionClass(action) {
  switch (action) {
    case "fusionné": return "merge";
    case "compressé": return "compress";
    case "découpé": return "split";
    case "converti": return "convert";
    default: return "open";
  }
}

function renderRecent(recent) {
  const list = $("#recent-list");
  if (!list) return;
  if (!recent || recent.length === 0) {
    list.innerHTML = `<div class="recent-empty">Aucun fichier récent. Ouvrez votre premier PDF ci-dessus.</div>`;
    return;
  }
  const checkSvg = `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M2.5 6.3 5 8.8 9.5 3.5"/></svg>`;

  list.innerHTML = recent
    .map((r) => {
      const action = r.last_action || "ouvert";
      const cls = recentActionClass(action);
      const pages = r.page_count ?? "?";
      const pageLabel = pages === 1 ? "page" : "pages";
      return `
    <div class="recent-item" data-path="${escapeHtml(r.path)}">
      <span class="recent-item-icon">📄</span>
      <div class="recent-item-info">
        <span class="file-name-row">
          <span class="file-name recent-item-name" title="${escapeHtml(r.path)}">${escapeHtml(r.filename)}</span>
          <span class="file-check" aria-label="PDF valide">${checkSvg}</span>
        </span>
        <span class="recent-item-meta">
          ${pages} ${pageLabel} ·
          <span class="recent-item-action recent-item-action--${cls}">${escapeHtml(action)}</span> ·
          ${relativeTime(r.last_opened)}
        </span>
      </div>
      <button class="recent-item-remove" data-path="${escapeHtml(r.path)}" title="Retirer de la liste" aria-label="Retirer">×</button>
    </div>`;
    })
    .join("");

  list.querySelectorAll(".recent-item").forEach((item) => {
    item.addEventListener("click", async (e) => {
      if (e.target.closest(".recent-item-remove")) return;
      const path = item.dataset.path;
      if (!api()) return;
      const result = await api().inspect_file(path);
      handleHubResult(result);
    });
  });

  list.querySelectorAll(".recent-item-remove").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const path = btn.dataset.path;
      if (!api()) return;
      try {
        await api().remove_recent(path);
        await refreshHubState();
        showToast("Fichier retiré de la liste.", "success");
      } catch (err) {
        showToast("Échec du retrait.", "error");
      }
    });
  });
}

async function refreshHubState() {
  if (!api()) return;
  try {
    const state = await api().get_state();
    renderTrial(state.license);
    renderRecent(state.recent);
  } catch (e) {
    console.error("refreshHubState failed", e);
  }
}

async function pickHubFile() {
  if (!api()) {
    showToast("Bridge Python indisponible.", "error");
    return;
  }
  const result = await api().open_file_dialog();
  handleHubResult(result);
}

function setupHubDragAndDrop() {
  const dz = $("#dropzone");

  ["dragenter", "dragover"].forEach((ev) => {
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.add("dragging");
    });
  });

  ["dragleave", "dragend"].forEach((ev) => {
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.target === dz) dz.classList.remove("dragging");
    });
  });

  dz.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dz.classList.remove("dragging");

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) {
      showToast("Aucun fichier détecté.", "error");
      return;
    }
    const f = files[0];
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      showToast("Seuls les fichiers PDF sont acceptés.", "error");
      return;
    }
    if (!api()) return;

    if (f.path && f.path !== "" && f.path !== f.name) {
      const result = await api().inspect_file(f.path);
      handleHubResult(result);
      return;
    }

    showToast("Importation du fichier…", "info");
    try {
      const base64 = await readFileAsBase64(f);
      const result = await api().inspect_dropped(f.name, base64);
      handleHubResult(result);
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de la lecture du fichier.", "error");
    }
  });

  dz.addEventListener("click", (e) => {
    if (e.target.closest(".dropzone-button")) return;
    if (e.target.closest(".dropzone-button-secondary")) return;
    if (AppState.currentFile) return;
    pickHubFile();
  });
}

function setupHubActions() {
  const labels = {
    merge: "Fusionner",
    split: "Découper",
    compress: "Compresser",
    convert: "Convertir",
    ocr: "OCR",
    protect: "Protéger",
    watermark: "Filigrane",
    annotate: "Annoter",
  };
  document.querySelectorAll(".action-tile").forEach((t) => {
    t.addEventListener("click", () => {
      const action = t.dataset.action;
      if (action === "merge") {
        Views.show("merge");
        return;
      }
      if (action === "compress") {
        Views.show("compress");
        return;
      }
      if (action === "protect") {
        Views.show("protect");
        return;
      }
      if (action === "split") {
        Views.show("split");
        return;
      }
      if (action === "watermark") {
        Views.show("watermark");
        return;
      }
      if (action === "convert") {
        Views.show("convert");
        return;
      }
      if (action === "ocr") {
        Views.show("ocr");
        return;
      }
      if (action === "annotate") {
        Views.show("stamp");
        return;
      }
      if (AppState.currentFile) {
        showToast(`Module « ${labels[action]} » sur ${AppState.currentFile.filename} — bientôt disponible.`);
      } else {
        showToast(`Module « ${labels[action]} » — bientôt disponible.`);
      }
    });
  });
}

function setupHubTopbar() {
  $("#btn-theme").addEventListener("click", () => {
    const next = ThemeManager.toggle();
    showToast(next === "dark" ? "Mode sombre activé." : "Mode clair activé.");
  });
  $("#btn-prefs").addEventListener("click", () => Views.show("prefs"));
  $("#btn-license").addEventListener("click", () => showToast("Activation de licence — bientôt disponible."));
  $("#btn-pick").addEventListener("click", (e) => {
    e.stopPropagation();
    pickHubFile();
  });
  $("#btn-change").addEventListener("click", (e) => {
    e.stopPropagation();
    pickHubFile();
  });

  const footer = document.getElementById("btn-hub-footer-link");
  if (footer) {
    footer.addEventListener("click", async () => {
      if (!api()) {
        showToast("Bridge Python indisponible.", "error");
        return;
      }
      if (typeof api().open_url !== "function") {
        showToast("open_url n'est pas exposé par le bridge.", "error");
        return;
      }
      try {
        const ok = await api().open_url("https://triskell-studio.fr");
        if (!ok) showToast("Impossible d'ouvrir le navigateur.", "error");
      } catch (e) {
        console.error(e);
        showToast("Erreur ouverture du site.", "error");
      }
    });
  }
}

function initHub() {
  setupHubDragAndDrop();
  setupHubActions();
  setupHubTopbar();
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
}

function dismissSplash(delayMs = 6000) {
  const splash = document.getElementById("splash");
  if (!splash) return;
  setTimeout(() => {
    splash.classList.add("fade-out");
    setTimeout(() => {
      splash.style.display = "none";
    }, 500);
  }, delayMs);
}

function bootApp() {
  ThemeManager.init();
  initHub();
  if (typeof initMerge === "function") initMerge();
  if (typeof initCompress === "function") initCompress();
  if (typeof initProtect === "function") initProtect();
  if (typeof initSplit === "function") initSplit();
  if (typeof initWatermark === "function") initWatermark();
  if (typeof initConvert === "function") initConvert();
  if (typeof initOcr === "function") initOcr();
  if (typeof initStamp === "function") initStamp();
  if (typeof initPrefs === "function") initPrefs();
  if (typeof initUpdater === "function") initUpdater();
  Views.show("hub");
  refreshHubState();
  dismissSplash(6000);
}

document.addEventListener("viewenter", (e) => {
  if (e.detail.name === "hub") refreshHubState();
});

if (window.pywebview) {
  bootApp();
} else {
  window.addEventListener("pywebviewready", bootApp);
}
