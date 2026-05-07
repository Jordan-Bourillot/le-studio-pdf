function parseRangesJS(spec, maxPage) {
  spec = (spec || "").trim().replace(/\s/g, "");
  if (!spec) throw new Error("Indiquez les pages à extraire.");
  const pages = [];
  for (const part of spec.split(",").filter(Boolean)) {
    if (part.includes("-")) {
      const [aStr, bStr] = part.split("-", 2);
      const a = parseInt(aStr, 10);
      const b = parseInt(bStr, 10);
      if (isNaN(a) || isNaN(b)) throw new Error(`Plage invalide : « ${part} »`);
      if (a > b) throw new Error(`Plage invalide : « ${part} » (début > fin)`);
      if (a < 1 || b > maxPage) throw new Error(`Hors limite : « ${part} » (PDF de ${maxPage} pages)`);
      for (let i = a; i <= b; i++) pages.push(i);
    } else {
      const p = parseInt(part, 10);
      if (isNaN(p)) throw new Error(`Numéro invalide : « ${part} »`);
      if (p < 1 || p > maxPage) throw new Error(`Page ${p} hors limite (PDF de ${maxPage} pages).`);
      pages.push(p);
    }
  }
  if (!pages.length) throw new Error("Aucune page indiquée.");
  return Array.from(new Set(pages));
}

const SplitView = {
  file: null,
  outputDir: "",
  _lastResult: null,

  async onEnter() {
    if (!this.outputDir && api()) {
      try {
        this.outputDir = await api().get_default_output_dir();
        $("#spl-folder").value = this.outputDir;
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
      $("#spl-name").value = "";
      $("#spl-ranges").value = "";
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
        $("#spl-name").value = "";
        $("#spl-ranges").value = "";
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
        $("#spl-name").value = "";
        $("#spl-ranges").value = "";
        this.render();
      } else {
        showToast(res.error || "Importation impossible.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur de lecture.", "error");
    }
  },

  reset() {
    this.file = null;
    this._lastResult = null;
    $("#spl-name").value = "";
    $("#spl-ranges").value = "";
    this._exitSuccess();
    this.render();
  },

  _exitSuccess() {
    $("#spl-success").hidden = true;
    $("#spl-step-row-1").hidden = false;
  },

  _showSuccess(info) {
    this._lastResult = info;
    $("#spl-success-info").textContent =
      `${info.filename} — ${info.page_count} page${info.page_count > 1 ? "s" : ""} extraite${info.page_count > 1 ? "s" : ""} sur ${info.source_total}.`;
    $("#spl-success").hidden = false;
    $("#spl-step-row-1").hidden = true;
    $("#spl-step-row-2").hidden = true;
    $("#spl-step-row-3").hidden = true;
  },

  _updateInputZone() {
    const empty = !this.file;
    const stepTitle = $("#spl-step-row-1 .step-title");
    const stepSubtitle = $("#spl-step-1-subtitle");
    const zone = $("#spl-input-zone");

    if (empty) {
      stepTitle.textContent = "Sélectionnez votre PDF";
      stepSubtitle.textContent = "Glissez-déposez ou cliquez pour parcourir.";
      $("#spl-input-empty").hidden = false;
      $("#spl-input-loaded").hidden = true;
      zone.classList.remove("loaded");
    } else {
      stepTitle.textContent = "PDF sélectionné";
      stepSubtitle.textContent = "Vous pouvez en choisir un autre si besoin.";
      $("#spl-input-empty").hidden = true;
      $("#spl-input-loaded").hidden = false;
      zone.classList.add("loaded");
      $("#spl-loaded-name").textContent = this.file.filename;
      $("#spl-loaded-name").title = this.file.path;
      const pages = this.file.page_count || 0;
      $("#spl-loaded-meta").textContent =
        `${pages} page${pages > 1 ? "s" : ""} — ${formatBytes(this.file.size_bytes)}`;
    }
  },

  _isReordered(pages) {
    for (let i = 1; i < pages.length; i++) {
      if (pages[i] < pages[i - 1]) return true;
    }
    return false;
  },

  _refreshPreview() {
    if (!this.file) return;
    const total = this.file.page_count;
    const spec = $("#spl-ranges").value;
    const preview = $("#spl-preview");
    const text = $("#spl-preview-text");

    if (!spec.trim()) {
      preview.className = "spl-preview";
      text.innerHTML = `Saisissez des pages pour voir un aperçu (PDF de <strong>${total}</strong> pages).`;
      return;
    }

    try {
      const pages = parseRangesJS(spec, total);
      preview.className = "spl-preview ok";
      const summary = pages.length <= 8
        ? pages.join(", ")
        : `${pages.slice(0, 5).join(", ")}, …, ${pages[pages.length - 1]}`;
      const reordered = this._isReordered(pages);
      const verb = reordered
        ? `réorganisée${pages.length > 1 ? "s" : ""} dans cet ordre`
        : `dans un nouveau PDF`;
      text.innerHTML = `Vous obtiendrez <strong>${pages.length} page${pages.length > 1 ? "s" : ""}</strong> (${summary}) ${verb}.`;
    } catch (e) {
      preview.className = "spl-preview ko";
      text.textContent = e.message;
    }
  },

  _refreshButton() {
    const runBtn = $("#btn-spl-run");
    if (!this.file) {
      runBtn.disabled = true;
      runBtn.textContent = "Choisissez un PDF";
      return;
    }
    const spec = $("#spl-ranges").value.trim();
    if (!spec) {
      runBtn.disabled = true;
      runBtn.textContent = "Saisissez les pages";
      return;
    }
    try {
      const pages = parseRangesJS(spec, this.file.page_count);
      runBtn.disabled = false;
      const plural = pages.length > 1 ? "s" : "";
      runBtn.textContent = this._isReordered(pages)
        ? `Extraire et réordonner ${pages.length} page${plural}`
        : `Extraire ${pages.length} page${plural}`;
    } catch (e) {
      runBtn.disabled = true;
      runBtn.textContent = "Plage invalide";
    }
  },

  applyHelper(kind) {
    if (!this.file) return;
    const total = this.file.page_count;
    let spec = "";
    switch (kind) {
      case "all":
        spec = `1-${total}`;
        break;
      case "even":
        spec = Array.from({ length: Math.floor(total / 2) }, (_, i) => 2 * (i + 1)).join(", ");
        break;
      case "odd":
        spec = Array.from({ length: Math.ceil(total / 2) }, (_, i) => 2 * i + 1).join(", ");
        break;
      case "first-half":
        spec = `1-${Math.ceil(total / 2)}`;
        break;
      case "second-half":
        spec = `${Math.floor(total / 2) + 1}-${total}`;
        break;
      case "reverse":
        spec = Array.from({ length: total }, (_, i) => total - i).join(", ");
        break;
      case "last":
        spec = `${total}`;
        break;
    }
    $("#spl-ranges").value = spec;
    this._refreshPreview();
    this._refreshButton();
  },

  render() {
    this._updateInputZone();
    const hasFile = !!this.file;
    $("#spl-step-row-2").hidden = !hasFile;
    $("#spl-step-row-3").hidden = !hasFile;

    if (hasFile) {
      const nameInput = $("#spl-name");
      if (!nameInput.value) {
        const base = this.file.filename.replace(/\.pdf$/i, "");
        nameInput.value = `${base}_extrait.pdf`;
      }
    }

    this._refreshPreview();
    this._refreshButton();
  },

  async run() {
    if (!this.file) return;
    const spec = $("#spl-ranges").value.trim();
    if (!spec) {
      showToast("Indiquez les pages à extraire.", "error");
      return;
    }
    const name = ($("#spl-name").value || "").trim() || "extrait.pdf";
    const dir = $("#spl-folder").value;
    if (!dir) {
      showToast("Choisissez un dossier de destination.", "error");
      return;
    }

    const runBtn = $("#btn-spl-run");
    const oldText = runBtn.textContent;
    runBtn.disabled = true;
    runBtn.textContent = "Extraction en cours…";
    try {
      const res = await api().split_pdf(this.file.path, dir, name, spec);
      if (res.ok) {
        this._showSuccess(res.info);
      } else {
        showToast(res.error || "Extraction échouée.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur inattendue.", "error");
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = oldText;
    }
  },

  async pickFolder() {
    if (!api()) return;
    const folder = await api().pick_output_folder();
    if (folder) {
      this.outputDir = folder;
      $("#spl-folder").value = folder;
    }
  },

  setupDragAndDrop() {
    const dz = $("#spl-input-zone");
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
      if (e.target.closest(".spl-input-button")) return;
      if (e.target.closest(".spl-input-secondary")) return;
      if (this.file) return;
      this.pickFile();
    });
  },
};

function initSplit() {
  SplitView.setupDragAndDrop();
  $("#btn-spl-pick").addEventListener("click", (e) => { e.stopPropagation(); SplitView.pickFile(); });
  $("#btn-spl-change").addEventListener("click", (e) => { e.stopPropagation(); SplitView.pickFile(); });
  $("#btn-spl-pick-folder").addEventListener("click", () => SplitView.pickFolder());
  $("#btn-spl-run").addEventListener("click", () => SplitView.run());
  $("#btn-spl-again").addEventListener("click", () => SplitView.reset());
  $("#btn-spl-open").addEventListener("click", () => {
    if (SplitView._lastResult && api()) api().open_file(SplitView._lastResult.path);
  });
  $("#btn-spl-explorer").addEventListener("click", () => {
    if (SplitView._lastResult && api()) api().open_in_explorer(SplitView._lastResult.path);
  });
  $("#btn-back-split").addEventListener("click", () => Views.show("hub"));

  $("#spl-ranges").addEventListener("input", () => {
    SplitView._refreshPreview();
    SplitView._refreshButton();
  });

  document.querySelectorAll(".spl-helper").forEach((b) => {
    b.addEventListener("click", () => SplitView.applyHelper(b.dataset.helper));
  });
}

document.addEventListener("viewenter", (e) => {
  if (e.detail.name === "split") SplitView.onEnter();
});
