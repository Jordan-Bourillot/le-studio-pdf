const ConvertView = {
  file: null,
  outputDir: "",
  format: "word",
  imgFormat: "png",
  dpi: 144,
  _lastResult: null,

  async onEnter() {
    if (!this.outputDir && api()) {
      try {
        this.outputDir = await api().get_default_output_dir();
        $("#cv-folder").value = this.outputDir;
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
      $("#cv-name").value = "";
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
        $("#cv-name").value = "";
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
        $("#cv-name").value = "";
        this.render();
      } else {
        showToast(res.error || "Importation impossible.", "error");
      }
    } catch (e) {
      showToast("Erreur de lecture.", "error");
    }
  },

  setFormat(fmt) {
    this.format = fmt;
    document.querySelectorAll(".cv-format").forEach(el =>
      el.classList.toggle("cv-format--selected", el.dataset.fmt === fmt));
    $("#cv-options-images").hidden = fmt !== "images";
    $("#cv-name-row").hidden = fmt === "images";
    if (fmt === "images") {
      $("#cv-step-3-subtitle").textContent = "Choisissez le dossier où créer les images.";
    } else {
      $("#cv-step-3-subtitle").textContent = "Choisissez le nom et le dossier.";
    }
    this._updateName();
    this._refreshButton();
  },

  setImgFormat(fmt) {
    this.imgFormat = fmt;
    document.querySelectorAll(".cv-pill[data-img-fmt]").forEach(el =>
      el.classList.toggle("cv-pill--active", el.dataset.imgFmt === fmt));
  },

  setDpi(dpi) {
    this.dpi = parseInt(dpi, 10);
    document.querySelectorAll(".cv-pill[data-dpi]").forEach(el =>
      el.classList.toggle("cv-pill--active", parseInt(el.dataset.dpi, 10) === this.dpi));
  },

  reset() {
    this.file = null;
    this._lastResult = null;
    $("#cv-name").value = "";
    this._exitSuccess();
    this.render();
  },

  _exitSuccess() {
    $("#cv-success").hidden = true;
    $("#cv-step-row-1").hidden = false;
  },

  _showSuccess(info) {
    this._lastResult = info;
    if (info.kind === "word") {
      $("#cv-success-info").textContent = `${info.filename} — ${formatBytes(info.size_bytes)}`;
    } else {
      $("#cv-success-info").textContent =
        `${info.page_count} image${info.page_count > 1 ? "s" : ""} créée${info.page_count > 1 ? "s" : ""} dans /${info.filename}/`;
    }
    $("#cv-success").hidden = false;
    $("#cv-step-row-1").hidden = true;
    $("#cv-step-row-2").hidden = true;
    $("#cv-step-row-3").hidden = true;
  },

  _updateInputZone() {
    const empty = !this.file;
    const stepTitle = $("#cv-step-row-1 .step-title");
    const stepSubtitle = $("#cv-step-1-subtitle");
    const zone = $("#cv-input-zone");
    if (empty) {
      stepTitle.textContent = "Sélectionnez votre PDF";
      stepSubtitle.textContent = "Glissez-déposez ou cliquez pour parcourir.";
      $("#cv-input-empty").hidden = false;
      $("#cv-input-loaded").hidden = true;
      zone.classList.remove("loaded");
    } else {
      stepTitle.textContent = "PDF sélectionné";
      stepSubtitle.textContent = "Vous pouvez en choisir un autre si besoin.";
      $("#cv-input-empty").hidden = true;
      $("#cv-input-loaded").hidden = false;
      zone.classList.add("loaded");
      $("#cv-loaded-name").textContent = this.file.filename;
      $("#cv-loaded-name").title = this.file.path;
      const pages = this.file.page_count || 0;
      $("#cv-loaded-meta").textContent =
        `${pages} page${pages > 1 ? "s" : ""} — ${formatBytes(this.file.size_bytes)}`;
    }
  },

  _updateName() {
    if (!this.file || this.format === "images") return;
    const nameInput = $("#cv-name");
    if (!nameInput.value) {
      const base = this.file.filename.replace(/\.pdf$/i, "");
      nameInput.value = `${base}.docx`;
    }
  },

  _refreshButton() {
    const btn = $("#btn-cv-run");
    if (!this.file) {
      btn.disabled = true;
      btn.textContent = "Choisissez un PDF";
      return;
    }
    btn.disabled = false;
    btn.textContent = this.format === "word" ? "Convertir en Word" : "Extraire les images";
  },

  render() {
    this._updateInputZone();
    const hasFile = !!this.file;
    $("#cv-step-row-2").hidden = !hasFile;
    $("#cv-step-row-3").hidden = !hasFile;
    if (hasFile) this._updateName();
    this._refreshButton();
  },

  async run() {
    if (!this.file) return;
    const dir = $("#cv-folder").value;
    if (!dir) {
      showToast("Choisissez un dossier de destination.", "error");
      return;
    }

    const btn = $("#btn-cv-run");
    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Conversion en cours…";
    try {
      let res;
      if (this.format === "word") {
        const name = ($("#cv-name").value || "").trim() || "converti.docx";
        res = await api().convert_to_word(this.file.path, dir, name);
      } else {
        res = await api().convert_to_images(this.file.path, dir, this.imgFormat, this.dpi);
      }
      if (res.ok) {
        this._showSuccess(res.info);
      } else {
        showToast(res.error || "Conversion échouée.", "error");
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
      $("#cv-folder").value = folder;
    }
  },

  setupDragAndDrop() {
    const dz = $("#cv-input-zone");
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
      if (e.target.closest(".cv-input-button")) return;
      if (e.target.closest(".cv-input-secondary")) return;
      if (this.file) return;
      this.pickFile();
    });
  },
};

function initConvert() {
  ConvertView.setupDragAndDrop();
  $("#btn-cv-pick").addEventListener("click", (e) => { e.stopPropagation(); ConvertView.pickFile(); });
  $("#btn-cv-change").addEventListener("click", (e) => { e.stopPropagation(); ConvertView.pickFile(); });
  $("#btn-cv-pick-folder").addEventListener("click", () => ConvertView.pickFolder());
  $("#btn-cv-run").addEventListener("click", () => ConvertView.run());
  $("#btn-cv-again").addEventListener("click", () => ConvertView.reset());
  $("#btn-cv-open").addEventListener("click", () => {
    if (ConvertView._lastResult && api()) api().open_file(ConvertView._lastResult.path);
  });
  $("#btn-cv-explorer").addEventListener("click", () => {
    if (ConvertView._lastResult && api()) api().open_in_explorer(ConvertView._lastResult.path);
  });
  $("#btn-back-cv").addEventListener("click", () => Views.show("hub"));

  document.querySelectorAll(".cv-format").forEach((el) =>
    el.addEventListener("click", () => ConvertView.setFormat(el.dataset.fmt)));
  document.querySelectorAll(".cv-pill[data-img-fmt]").forEach((el) =>
    el.addEventListener("click", () => ConvertView.setImgFormat(el.dataset.imgFmt)));
  document.querySelectorAll(".cv-pill[data-dpi]").forEach((el) =>
    el.addEventListener("click", () => ConvertView.setDpi(el.dataset.dpi)));
}

document.addEventListener("viewenter", (e) => {
  if (e.detail.name === "convert") ConvertView.onEnter();
});
