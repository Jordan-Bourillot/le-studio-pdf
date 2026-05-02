const StampView = {
  file: null,
  outputDir: "",
  color: "red",
  position: "top-left",
  pagesMode: "all",
  _lastResult: null,

  async onEnter() {
    if (!this.outputDir && api()) {
      try {
        this.outputDir = await api().get_default_output_dir();
        $("#st-folder").value = this.outputDir;
      } catch (e) { console.error(e); }
    }
    if (!this.file && AppState.currentFile) {
      this.file = { ...AppState.currentFile };
    }
    this._exitSuccess();
    this.render();
  },

  async pickFile() {
    if (!api()) return;
    const result = await api().open_file_dialog();
    if (result && result.ok && !result.info.encrypted) {
      this.file = result.info;
      $("#st-name").value = "";
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
        $("#st-name").value = "";
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
        $("#st-name").value = "";
        this.render();
      } else {
        showToast(res.error || "Importation impossible.", "error");
      }
    } catch (e) {
      showToast("Erreur de lecture.", "error");
    }
  },

  setPreset(text) {
    $("#st-text").value = text;
    document.querySelectorAll(".st-preset").forEach(el =>
      el.classList.toggle("st-preset--active", el.dataset.preset === text));
  },

  setColor(color) {
    this.color = color;
    document.querySelectorAll(".st-color").forEach(el =>
      el.classList.toggle("st-color--selected", el.dataset.color === color));
  },

  setPosition(pos) {
    this.position = pos;
    document.querySelectorAll("#view-stamp .wm-position").forEach(el =>
      el.classList.toggle("wm-position--active", el.dataset.pos === pos));
  },

  setPagesMode(mode) {
    this.pagesMode = mode;
    document.querySelectorAll(".st-page-helper").forEach(el =>
      el.classList.toggle("st-page-helper--active", el.dataset.pages === mode));
    $("#st-pages").hidden = mode !== "custom";
  },

  reset() {
    this.file = null;
    this._lastResult = null;
    $("#st-name").value = "";
    $("#st-text").value = "PAYÉ";
    this.color = "red";
    this.position = "top-left";
    this.pagesMode = "all";
    this._exitSuccess();
    this.render();
  },

  _exitSuccess() {
    $("#st-success").hidden = true;
    $("#st-step-row-1").hidden = false;
  },

  _showSuccess(info) {
    this._lastResult = info;
    $("#st-success-info").textContent =
      `${info.filename} — ${info.stamped_count} page${info.stamped_count > 1 ? "s" : ""} tamponnée${info.stamped_count > 1 ? "s" : ""} sur ${info.page_count}.`;
    $("#st-success").hidden = false;
    $("#st-step-row-1").hidden = true;
    $("#st-step-row-2").hidden = true;
    $("#st-step-row-3").hidden = true;
  },

  _updateInputZone() {
    const empty = !this.file;
    const zone = $("#st-input-zone");
    if (empty) {
      $("#st-input-empty").hidden = false;
      $("#st-input-loaded").hidden = true;
      zone.classList.remove("loaded");
    } else {
      $("#st-input-empty").hidden = true;
      $("#st-input-loaded").hidden = false;
      zone.classList.add("loaded");
      $("#st-loaded-name").textContent = this.file.filename;
      $("#st-loaded-name").title = this.file.path;
      const pages = this.file.page_count || 0;
      $("#st-loaded-meta").textContent =
        `${pages} page${pages > 1 ? "s" : ""} — ${formatBytes(this.file.size_bytes)}`;
    }
  },

  _refreshButton() {
    const btn = $("#btn-st-run");
    if (!this.file) {
      btn.disabled = true;
      btn.textContent = "Choisissez un PDF";
      return;
    }
    const text = $("#st-text").value.trim();
    if (!text) {
      btn.disabled = true;
      btn.textContent = "Saisissez un texte";
      return;
    }
    btn.disabled = false;
    btn.textContent = "Apposer le tampon";
  },

  render() {
    this._updateInputZone();
    const hasFile = !!this.file;
    $("#st-step-row-2").hidden = !hasFile;
    $("#st-step-row-3").hidden = !hasFile;
    if (hasFile) {
      const nameInput = $("#st-name");
      if (!nameInput.value) {
        const base = this.file.filename.replace(/\.pdf$/i, "");
        nameInput.value = `${base}_tamponne.pdf`;
      }
    }
    this._refreshButton();
  },

  async run() {
    if (!this.file) return;
    const text = $("#st-text").value.trim();
    if (!text) {
      showToast("Saisissez un texte de tampon.", "error");
      return;
    }
    const name = ($("#st-name").value || "").trim() || "tamponne.pdf";
    const dir = $("#st-folder").value;
    if (!dir) {
      showToast("Choisissez un dossier.", "error");
      return;
    }

    let pagesSpec = "all";
    if (this.pagesMode === "first") pagesSpec = "first";
    else if (this.pagesMode === "last") pagesSpec = "last";
    else if (this.pagesMode === "custom") {
      pagesSpec = $("#st-pages").value.trim();
      if (!pagesSpec) {
        showToast("Indiquez les pages à tamponner.", "error");
        return;
      }
    }

    const btn = $("#btn-st-run");
    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Tamponnage en cours…";
    try {
      const res = await api().add_stamp(this.file.path, dir, name, text, this.position, this.color, pagesSpec);
      if (res.ok) {
        this._showSuccess(res.info);
      } else {
        showToast(res.error || "Tamponnage échoué.", "error");
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
      $("#st-folder").value = folder;
    }
  },

  setupDragAndDrop() {
    const dz = $("#st-input-zone");
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
      if (e.target.closest(".st-input-button")) return;
      if (e.target.closest(".st-input-secondary")) return;
      if (this.file) return;
      this.pickFile();
    });
  },
};

function initStamp() {
  StampView.setupDragAndDrop();
  $("#btn-st-pick").addEventListener("click", (e) => { e.stopPropagation(); StampView.pickFile(); });
  $("#btn-st-change").addEventListener("click", (e) => { e.stopPropagation(); StampView.pickFile(); });
  $("#btn-st-pick-folder").addEventListener("click", () => StampView.pickFolder());
  $("#btn-st-run").addEventListener("click", () => StampView.run());
  $("#btn-st-again").addEventListener("click", () => StampView.reset());
  $("#btn-st-open").addEventListener("click", () => {
    if (StampView._lastResult && api()) api().open_file(StampView._lastResult.path);
  });
  $("#btn-st-explorer").addEventListener("click", () => {
    if (StampView._lastResult && api()) api().open_in_explorer(StampView._lastResult.path);
  });
  $("#btn-back-st").addEventListener("click", () => Views.show("hub"));

  document.querySelectorAll(".st-preset").forEach(el =>
    el.addEventListener("click", () => StampView.setPreset(el.dataset.preset)));
  document.querySelectorAll(".st-color").forEach(el =>
    el.addEventListener("click", () => StampView.setColor(el.dataset.color)));
  document.querySelectorAll("#view-stamp .wm-position").forEach(el =>
    el.addEventListener("click", () => StampView.setPosition(el.dataset.pos)));
  document.querySelectorAll(".st-page-helper").forEach(el =>
    el.addEventListener("click", () => StampView.setPagesMode(el.dataset.pages)));
  $("#st-text").addEventListener("input", () => StampView._refreshButton());
  $("#st-text").addEventListener("focus", (e) => e.target.select());
}

document.addEventListener("viewenter", (e) => {
  if (e.detail.name === "stamp") StampView.onEnter();
});
