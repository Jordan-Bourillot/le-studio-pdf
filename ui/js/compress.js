const CompressView = {
  file: null,
  level: "web",
  outputDir: "",
  _lastResult: null,

  async onEnter() {
    if (!this.outputDir && api()) {
      try {
        this.outputDir = await api().get_default_output_dir();
        $("#cmp-folder").value = this.outputDir;
      } catch (e) {
        console.error(e);
      }
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
      $("#cmp-name").value = "";
      this.render();
    } else if (result && !result.ok) {
      showToast(result.error, "error");
    } else if (result && result.info && result.info.encrypted) {
      showToast(`${result.info.filename} est protégé par mot de passe.`, "info");
    }
  },

  async setDropped(fileObj) {
    if (!api()) return;
    if (fileObj.path && fileObj.path !== "" && fileObj.path !== fileObj.name) {
      const res = await api().inspect_file(fileObj.path);
      if (res && res.ok && !res.info.encrypted) {
        this.file = res.info;
        $("#cmp-name").value = "";
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
        $("#cmp-name").value = "";
        this.render();
      } else {
        showToast(res.error || "Importation impossible.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur de lecture du fichier.", "error");
    }
  },

  selectLevel(level) {
    this.level = level;
    document.querySelectorAll(".cmp-preset").forEach((p) => {
      p.classList.toggle("cmp-preset--selected", p.dataset.level === level);
    });
  },

  reset() {
    this.file = null;
    this._lastResult = null;
    $("#cmp-name").value = "";
    this._exitSuccess();
    this.render();
  },

  _exitSuccess() {
    $("#cmp-success").hidden = true;
    $("#cmp-step-row-1").hidden = false;
  },

  _showSuccess(info) {
    this._lastResult = info;
    const stats = $("#cmp-success-stats");
    stats.innerHTML = `
      <div class="cmp-stat-block">
        <span class="cmp-stat-value cmp-stat-value--original">${formatBytes(info.original_size)}</span>
        <span class="cmp-stat-label">Avant</span>
      </div>
      <span class="cmp-stat-arrow">→</span>
      <div class="cmp-stat-block">
        <span class="cmp-stat-value cmp-stat-value--new">${formatBytes(info.new_size)}</span>
        <span class="cmp-stat-label">Après</span>
      </div>
      <div class="cmp-stat-block">
        <span class="cmp-stat-value cmp-stat-value--saved">−${info.saved_percent}%</span>
        <span class="cmp-stat-label">Économisé</span>
      </div>
    `;
    $("#cmp-success").hidden = false;
    $("#cmp-step-row-1").hidden = true;
    $("#cmp-step-row-2").hidden = true;
    $("#cmp-step-row-3").hidden = true;
  },

  _updateInputZone() {
    const empty = !this.file;
    const stepTitle = $("#cmp-step-row-1 .step-title");
    const stepSubtitle = $("#cmp-step-1-subtitle");
    const zone = $("#cmp-input-zone");

    if (empty) {
      stepTitle.textContent = "Sélectionnez votre PDF";
      stepSubtitle.textContent = "Glissez-déposez ou cliquez pour parcourir.";
      $("#cmp-input-empty").hidden = false;
      $("#cmp-input-loaded").hidden = true;
      zone.classList.remove("loaded");
    } else {
      stepTitle.textContent = "PDF sélectionné";
      stepSubtitle.textContent = "Vous pouvez en choisir un autre si besoin.";
      $("#cmp-input-empty").hidden = true;
      $("#cmp-input-loaded").hidden = false;
      zone.classList.add("loaded");
      $("#cmp-loaded-name").textContent = this.file.filename;
      $("#cmp-loaded-name").title = this.file.path;
      const pages = this.file.page_count || 0;
      $("#cmp-loaded-meta").textContent =
        `${pages} page${pages > 1 ? "s" : ""} — ${formatBytes(this.file.size_bytes)}`;
    }
  },

  render() {
    this._updateInputZone();
    const hasFile = !!this.file;
    $("#cmp-step-row-2").hidden = !hasFile;
    $("#cmp-step-row-3").hidden = !hasFile;

    const runBtn = $("#btn-cmp-run");
    if (!hasFile) {
      runBtn.disabled = true;
      runBtn.textContent = "Choisissez un PDF";
      return;
    }

    const nameInput = $("#cmp-name");
    if (!nameInput.value) {
      const base = this.file.filename.replace(/\.pdf$/i, "");
      nameInput.value = `${base}_compresse.pdf`;
    }

    runBtn.disabled = false;
    runBtn.textContent = "Compresser";
  },

  async run() {
    if (!this.file) return;
    const name = ($("#cmp-name").value || "").trim() || "fichier_compresse.pdf";
    const dir = $("#cmp-folder").value;
    if (!dir) {
      showToast("Choisissez un dossier de destination.", "error");
      return;
    }

    const runBtn = $("#btn-cmp-run");
    const oldText = runBtn.textContent;
    runBtn.disabled = true;
    runBtn.textContent = "Compression en cours…";
    try {
      const res = await api().compress_pdf(this.file.path, dir, name, this.level);
      if (res.ok) {
        this._showSuccess(res.info);
        if (res.info.saved_bytes === 0) {
          showToast("Ce PDF est déjà bien optimisé — aucune réduction obtenue.", "info");
        }
      } else {
        showToast(res.error || "Compression échouée.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur inattendue lors de la compression.", "error");
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = oldText;
    }
  },

  async pickFolder() {
    if (!api()) return;
    try {
      const folder = await api().pick_output_folder();
      if (folder) {
        this.outputDir = folder;
        $("#cmp-folder").value = folder;
      }
    } catch (e) {
      console.error(e);
    }
  },

  setupDragAndDrop() {
    const dz = $("#cmp-input-zone");
    if (!dz) return;

    ["dragenter", "dragover"].forEach((ev) => {
      dz.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add("dragging");
      });
    });
    ["dragleave", "dragend"].forEach((ev) => {
      dz.addEventListener(ev, (e) => {
        if (e.target === dz) dz.classList.remove("dragging");
      });
    });
    dz.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
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
      if (e.target.closest(".cmp-input-button")) return;
      if (e.target.closest(".cmp-input-secondary")) return;
      if (this.file) return;
      this.pickFile();
    });
  },
};

function initCompress() {
  CompressView.setupDragAndDrop();
  $("#btn-cmp-pick").addEventListener("click", (e) => {
    e.stopPropagation();
    CompressView.pickFile();
  });
  $("#btn-cmp-change").addEventListener("click", (e) => {
    e.stopPropagation();
    CompressView.pickFile();
  });
  $("#btn-cmp-pick-folder").addEventListener("click", () => CompressView.pickFolder());
  $("#btn-cmp-run").addEventListener("click", () => CompressView.run());
  $("#btn-cmp-again").addEventListener("click", () => CompressView.reset());
  $("#btn-cmp-open").addEventListener("click", () => {
    if (CompressView._lastResult && api()) api().open_file(CompressView._lastResult.path);
  });
  $("#btn-cmp-explorer").addEventListener("click", () => {
    if (CompressView._lastResult && api()) api().open_in_explorer(CompressView._lastResult.path);
  });
  $("#btn-back-compress").addEventListener("click", () => Views.show("hub"));

  document.querySelectorAll(".cmp-preset").forEach((p) => {
    p.addEventListener("click", () => CompressView.selectLevel(p.dataset.level));
  });
}

document.addEventListener("viewenter", (e) => {
  if (e.detail.name === "compress") CompressView.onEnter();
});
