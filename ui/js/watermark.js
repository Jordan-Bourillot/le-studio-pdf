const WatermarkView = {
  file: null,
  outputDir: "",
  mode: "text",
  position: "bottom-right",
  _lastResult: null,

  async onEnter() {
    if (!this.outputDir && api()) {
      try {
        this.outputDir = await api().get_default_output_dir();
        $("#wm-folder").value = this.outputDir;
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
      $("#wm-name").value = "";
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
        $("#wm-name").value = "";
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
        $("#wm-name").value = "";
        this.render();
      } else {
        showToast(res.error || "Importation impossible.", "error");
      }
    } catch (e) {
      showToast("Erreur de lecture.", "error");
    }
  },

  setMode(mode) {
    this.mode = mode;
    document.querySelectorAll(".wm-tab").forEach((t) => {
      t.classList.toggle("wm-tab--active", t.dataset.mode === mode);
    });
    $("#wm-mode-text").hidden = mode !== "text";
    $("#wm-mode-numbers").hidden = mode !== "numbers";
    this._updateName();
    this._refreshButton();
  },

  setPosition(pos) {
    this.position = pos;
    document.querySelectorAll(".wm-position").forEach((p) => {
      p.classList.toggle("wm-position--active", p.dataset.pos === pos);
    });
  },

  reset() {
    this.file = null;
    this._lastResult = null;
    $("#wm-name").value = "";
    $("#wm-text").value = "CONFIDENTIEL";
    this._exitSuccess();
    this.render();
  },

  _exitSuccess() {
    $("#wm-success").hidden = true;
    $("#wm-step-row-1").hidden = false;
  },

  _showSuccess(info, action) {
    this._lastResult = info;
    $("#wm-success-info").textContent =
      `${info.filename} — ${info.page_count} page${info.page_count > 1 ? "s" : ""} ${action}.`;
    $("#wm-success").hidden = false;
    $("#wm-step-row-1").hidden = true;
    $("#wm-step-row-2").hidden = true;
    $("#wm-step-row-3").hidden = true;
  },

  _updateInputZone() {
    const empty = !this.file;
    const stepTitle = $("#wm-step-row-1 .step-title");
    const stepSubtitle = $("#wm-step-1-subtitle");
    const zone = $("#wm-input-zone");

    if (empty) {
      stepTitle.textContent = "Sélectionnez votre PDF";
      stepSubtitle.textContent = "Glissez-déposez ou cliquez pour parcourir.";
      $("#wm-input-empty").hidden = false;
      $("#wm-input-loaded").hidden = true;
      zone.classList.remove("loaded");
    } else {
      stepTitle.textContent = "PDF sélectionné";
      stepSubtitle.textContent = "Vous pouvez en choisir un autre si besoin.";
      $("#wm-input-empty").hidden = true;
      $("#wm-input-loaded").hidden = false;
      zone.classList.add("loaded");
      $("#wm-loaded-name").textContent = this.file.filename;
      $("#wm-loaded-name").title = this.file.path;
      const pages = this.file.page_count || 0;
      $("#wm-loaded-meta").textContent =
        `${pages} page${pages > 1 ? "s" : ""} — ${formatBytes(this.file.size_bytes)}`;
    }
  },

  _updateName() {
    if (!this.file) return;
    const nameInput = $("#wm-name");
    const base = this.file.filename.replace(/\.pdf$/i, "");
    const suffix = this.mode === "text" ? "_filigrane" : "_numerote";
    nameInput.value = `${base}${suffix}.pdf`;
  },

  _refreshButton() {
    const btn = $("#btn-wm-run");
    if (!this.file) {
      btn.disabled = true;
      btn.textContent = "Choisissez un PDF";
      return;
    }
    if (this.mode === "text") {
      const text = $("#wm-text").value.trim();
      if (!text) {
        btn.disabled = true;
        btn.textContent = "Saisissez un texte";
        return;
      }
      btn.disabled = false;
      btn.textContent = "Appliquer le filigrane";
    } else {
      btn.disabled = false;
      btn.textContent = "Numéroter les pages";
    }
  },

  render() {
    this._updateInputZone();
    const hasFile = !!this.file;
    $("#wm-step-row-2").hidden = !hasFile;
    $("#wm-step-row-3").hidden = !hasFile;

    if (hasFile && !$("#wm-name").value) {
      this._updateName();
    }
    this._refreshButton();
  },

  async run() {
    if (!this.file) return;
    const name = ($("#wm-name").value || "").trim();
    const dir = $("#wm-folder").value;
    if (!dir) {
      showToast("Choisissez un dossier de destination.", "error");
      return;
    }

    const btn = $("#btn-wm-run");
    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Traitement en cours…";

    try {
      let res;
      let action = "";
      if (this.mode === "text") {
        const text = $("#wm-text").value.trim();
        const opacity = parseInt($("#wm-opacity").value, 10) / 100;
        res = await api().add_text_watermark(this.file.path, dir, name, text, opacity);
        action = "filigranée(s)";
      } else {
        const fmt = $("#wm-format").value;
        const start = parseInt($("#wm-start").value, 10) || 1;
        res = await api().add_page_numbers(this.file.path, dir, name, this.position, fmt, start);
        action = "numérotée(s)";
      }

      if (res.ok) {
        this._showSuccess(res.info, action);
      } else {
        showToast(res.error || "Opération échouée.", "error");
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
      $("#wm-folder").value = folder;
    }
  },

  setupDragAndDrop() {
    const dz = $("#wm-input-zone");
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
        f.name.toLowerCase().endsWith(".pdf")
      );
      if (files.length === 0) {
        showToast("Aucun PDF détecté.", "error");
        return;
      }
      await this.setDropped(files[0]);
    });
    dz.addEventListener("click", (e) => {
      if (e.target.closest(".wm-input-button")) return;
      if (e.target.closest(".wm-input-secondary")) return;
      if (this.file) return;
      this.pickFile();
    });
  },
};

function initWatermark() {
  WatermarkView.setupDragAndDrop();
  $("#btn-wm-pick").addEventListener("click", (e) => { e.stopPropagation(); WatermarkView.pickFile(); });
  $("#btn-wm-change").addEventListener("click", (e) => { e.stopPropagation(); WatermarkView.pickFile(); });
  $("#btn-wm-pick-folder").addEventListener("click", () => WatermarkView.pickFolder());
  $("#btn-wm-run").addEventListener("click", () => WatermarkView.run());
  $("#btn-wm-again").addEventListener("click", () => WatermarkView.reset());
  $("#btn-wm-open").addEventListener("click", () => {
    if (WatermarkView._lastResult && api()) api().open_file(WatermarkView._lastResult.path);
  });
  $("#btn-wm-explorer").addEventListener("click", () => {
    if (WatermarkView._lastResult && api()) api().open_in_explorer(WatermarkView._lastResult.path);
  });
  $("#btn-back-wm").addEventListener("click", () => Views.show("hub"));

  document.querySelectorAll(".wm-tab").forEach((t) => {
    t.addEventListener("click", () => WatermarkView.setMode(t.dataset.mode));
  });
  document.querySelectorAll(".wm-position").forEach((p) => {
    p.addEventListener("click", () => WatermarkView.setPosition(p.dataset.pos));
  });

  $("#wm-text").addEventListener("input", () => WatermarkView._refreshButton());
  $("#wm-text").addEventListener("focus", (e) => e.target.select());
  $("#wm-opacity").addEventListener("input", (e) => {
    $("#wm-opacity-val").textContent = `${e.target.value} %`;
  });
}

document.addEventListener("viewenter", (e) => {
  if (e.detail.name === "watermark") WatermarkView.onEnter();
});
