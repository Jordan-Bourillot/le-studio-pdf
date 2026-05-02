const OcrView = {
  file: null,
  outputDir: "",
  language: "fra",
  _lastResult: null,
  _depsChecked: false,
  _depsAvailable: false,

  async onEnter() {
    if (!this._depsChecked) {
      await this._checkDeps();
    }
    if (!this.outputDir && api()) {
      try {
        this.outputDir = await api().get_default_output_dir();
        $("#ocr-folder").value = this.outputDir;
      } catch (e) { console.error(e); }
    }
    if (!this.file && AppState.currentFile) {
      this.file = { ...AppState.currentFile };
    }
    this._exitSuccess();
    this.render();
  },

  async _checkDeps() {
    if (!api()) return;
    try {
      const deps = await api().check_ocr_deps();
      this._depsChecked = true;
      this._depsAvailable = !!deps.available;
      const banner = $("#ocr-deps");
      if (!this._depsAvailable) {
        const missing = [];
        if (!deps.tesseract) missing.push("Tesseract OCR");
        if (!deps.ghostscript) missing.push("Ghostscript");
        banner.querySelector(".ocr-deps-text strong").textContent =
          `Dépendance${missing.length > 1 ? "s" : ""} manquante${missing.length > 1 ? "s" : ""} : ${missing.join(" et ")}.`;
        banner.querySelector(".ocr-deps-link").href = !deps.tesseract
          ? "https://github.com/UB-Mannheim/tesseract/wiki"
          : "https://www.ghostscript.com/releases/gsdnld.html";
        banner.hidden = false;
      } else {
        banner.hidden = true;
      }
    } catch (e) {
      console.error("OCR deps check failed", e);
    }
  },

  async pickFile() {
    if (!api()) return;
    const result = await api().open_file_dialog();
    if (result && result.ok && !result.info.encrypted) {
      this.file = result.info;
      $("#ocr-name").value = "";
      this.render();
    } else if (result && !result.ok) {
      showToast(result.error, "error");
    }
  },

  async setDropped(fileObj) {
    if (!api()) return;
    if (fileObj.path && fileObj.path !== "" && fileObj.path !== fileObj.name) {
      const res = await api().inspect_file(fileObj.path);
      if (res && res.ok && !res.info.encrypted) {
        this.file = res.info;
        $("#ocr-name").value = "";
        this.render();
      } else if (res && !res.ok) {
        showToast(res.error, "error");
      }
      return;
    }
    showToast("Importation du fichier…", "info");
    try {
      const base64 = await readFileAsBase64(fileObj);
      const res = await api().inspect_dropped(fileObj.name, base64);
      if (res.ok && !res.info.encrypted) {
        this.file = res.info;
        $("#ocr-name").value = "";
        this.render();
      } else {
        showToast(res.error || "Importation impossible.", "error");
      }
    } catch (e) {
      showToast("Erreur de lecture.", "error");
    }
  },

  setLanguage(lang) {
    this.language = lang;
    document.querySelectorAll(".ocr-lang").forEach(el =>
      el.classList.toggle("ocr-lang--selected", el.dataset.lang === lang));
  },

  reset() {
    this.file = null;
    this._lastResult = null;
    $("#ocr-name").value = "";
    this._exitSuccess();
    this.render();
  },

  _exitSuccess() {
    $("#ocr-success").hidden = true;
    $("#ocr-step-row-1").hidden = false;
  },

  _showSuccess(info) {
    this._lastResult = info;
    $("#ocr-success-info").textContent =
      `${info.filename} — texte reconnu (${info.language}). Ouvrez-le et essayez Ctrl+F pour rechercher.`;
    $("#ocr-success").hidden = false;
    $("#ocr-step-row-1").hidden = true;
    $("#ocr-step-row-2").hidden = true;
    $("#ocr-step-row-3").hidden = true;
  },

  _updateInputZone() {
    const empty = !this.file;
    const zone = $("#ocr-input-zone");
    if (empty) {
      $("#ocr-input-empty").hidden = false;
      $("#ocr-input-loaded").hidden = true;
      zone.classList.remove("loaded");
    } else {
      $("#ocr-input-empty").hidden = true;
      $("#ocr-input-loaded").hidden = false;
      zone.classList.add("loaded");
      $("#ocr-loaded-name").textContent = this.file.filename;
      $("#ocr-loaded-name").title = this.file.path;
      const pages = this.file.page_count || 0;
      $("#ocr-loaded-meta").textContent =
        `${pages} page${pages > 1 ? "s" : ""} — ${formatBytes(this.file.size_bytes)}`;
    }
  },

  _refreshButton() {
    const btn = $("#btn-ocr-run");
    if (!this._depsAvailable) {
      btn.disabled = true;
      btn.textContent = "Tesseract requis";
      return;
    }
    if (!this.file) {
      btn.disabled = true;
      btn.textContent = "Choisissez un PDF";
      return;
    }
    btn.disabled = false;
    btn.textContent = "Lancer la reconnaissance";
  },

  render() {
    this._updateInputZone();
    const hasFile = !!this.file;
    $("#ocr-step-row-2").hidden = !hasFile;
    $("#ocr-step-row-3").hidden = !hasFile;
    if (hasFile) {
      const nameInput = $("#ocr-name");
      if (!nameInput.value) {
        const base = this.file.filename.replace(/\.pdf$/i, "");
        nameInput.value = `${base}_ocr.pdf`;
      }
    }
    this._refreshButton();
  },

  async run() {
    if (!this.file || !this._depsAvailable) return;
    const name = ($("#ocr-name").value || "").trim() || "ocr.pdf";
    const dir = $("#ocr-folder").value;
    if (!dir) {
      showToast("Choisissez un dossier.", "error");
      return;
    }

    const btn = $("#btn-ocr-run");
    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Reconnaissance en cours… (peut prendre 1 min)";
    try {
      const res = await api().run_ocr(this.file.path, dir, name, this.language);
      if (res.ok) {
        this._showSuccess(res.info);
      } else {
        if (res.missing_deps) {
          await this._checkDeps();
        }
        showToast(res.error || "OCR échoué.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur inattendue.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  },

  async pickFolder() {
    if (!api()) return;
    const folder = await api().pick_output_folder();
    if (folder) {
      this.outputDir = folder;
      $("#ocr-folder").value = folder;
    }
  },

  setupDragAndDrop() {
    const dz = $("#ocr-input-zone");
    if (!dz) return;
    ["dragenter", "dragover"].forEach((ev) => {
      dz.addEventListener(ev, (e) => {
        e.preventDefault(); e.stopPropagation();
        dz.classList.add("dragging");
      });
    });
    ["dragleave", "dragend"].forEach((ev) => {
      dz.addEventListener(ev, (e) => {
        if (e.target === dz) dz.classList.remove("dragging");
      });
    });
    dz.addEventListener("drop", async (e) => {
      e.preventDefault(); e.stopPropagation();
      dz.classList.remove("dragging");
      const files = Array.from(e.dataTransfer.files || []).filter((f) =>
        f.name.toLowerCase().endsWith(".pdf"));
      if (files.length === 0) {
        showToast("Aucun PDF détecté.", "error");
        return;
      }
      await this.setDropped(files[0]);
    });
    dz.addEventListener("click", (e) => {
      if (e.target.closest(".ocr-input-button")) return;
      if (e.target.closest(".ocr-input-secondary")) return;
      if (this.file) return;
      this.pickFile();
    });
  },
};

function initOcr() {
  OcrView.setupDragAndDrop();
  $("#btn-ocr-pick").addEventListener("click", (e) => { e.stopPropagation(); OcrView.pickFile(); });
  $("#btn-ocr-change").addEventListener("click", (e) => { e.stopPropagation(); OcrView.pickFile(); });
  $("#btn-ocr-pick-folder").addEventListener("click", () => OcrView.pickFolder());
  $("#btn-ocr-run").addEventListener("click", () => OcrView.run());
  $("#btn-ocr-again").addEventListener("click", () => OcrView.reset());
  $("#btn-ocr-open").addEventListener("click", () => {
    if (OcrView._lastResult && api()) api().open_file(OcrView._lastResult.path);
  });
  $("#btn-ocr-explorer").addEventListener("click", () => {
    if (OcrView._lastResult && api()) api().open_in_explorer(OcrView._lastResult.path);
  });
  $("#btn-back-ocr").addEventListener("click", () => Views.show("hub"));
  $("#ocr-deps-link").addEventListener("click", (e) => {
    e.preventDefault();
    const url = e.target.getAttribute("href");
    if (api() && api().open_file) api().open_file(url);
  });

  document.querySelectorAll(".ocr-lang").forEach((el) =>
    el.addEventListener("click", () => OcrView.setLanguage(el.dataset.lang)));
}

document.addEventListener("viewenter", (e) => {
  if (e.detail.name === "ocr") OcrView.onEnter();
});
