const MergeView = {
  files: [],
  outputDir: "",
  _lastResult: null,

  async onEnter() {
    if (!this.outputDir && api()) {
      try {
        this.outputDir = await api().get_default_output_dir();
        $("#merge-folder").value = this.outputDir;
      } catch (e) {
        console.error(e);
      }
    }
    if (this.files.length === 0 && AppState.currentFile) {
      this.files = [{ ...AppState.currentFile }];
    }
    this._exitSuccess();
    this.render();
  },

  async addFiles() {
    if (!api()) return;
    try {
      const newFiles = await api().add_files_to_merge();
      if (!newFiles || !newFiles.length) return;
      let added = 0;
      for (const f of newFiles) {
        if (!this.files.find((x) => x.path === f.path)) {
          this.files.push(f);
          added++;
        }
      }
      if (added > 0) {
        showToast(`${added} fichier${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""}.`, "success");
      } else {
        showToast("Ces fichiers sont déjà dans la liste.", "info");
      }
      this.render();
    } catch (e) {
      console.error(e);
      showToast("Erreur à l'ajout des fichiers.", "error");
    }
  },

  async addDropped(fileObj) {
    if (!api()) return;
    if (fileObj.path && fileObj.path !== "" && fileObj.path !== fileObj.name) {
      const res = await api().inspect_file(fileObj.path);
      if (res && res.ok && !res.info.encrypted) {
        if (!this.files.find((x) => x.path === res.info.path)) {
          this.files.push(res.info);
          this.render();
        }
      } else if (res && !res.ok) {
        showToast(res.error, "error");
      }
      return;
    }
    try {
      const base64 = await readFileAsBase64(fileObj);
      const res = await api().import_pdf_for_merge(fileObj.name, base64);
      if (res.ok) {
        if (!this.files.find((x) => x.path === res.info.path)) {
          this.files.push(res.info);
          this.render();
        }
      } else {
        showToast(res.error || "Importation impossible.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur lors de la lecture du fichier.", "error");
    }
  },

  remove(idx) {
    this.files.splice(idx, 1);
    this.render();
  },

  move(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= this.files.length) return;
    [this.files[idx], this.files[j]] = [this.files[j], this.files[idx]];
    this.render();
  },

  reset() {
    this.files = [];
    this._lastResult = null;
    $("#merge-name").value = "";
    this._exitSuccess();
    this.render();
  },

  _exitSuccess() {
    $("#merge-success").hidden = true;
    $("#step-row-1").hidden = false;
  },

  _showSuccess(info) {
    this._lastResult = info;
    $("#merge-success-info").textContent =
      `${info.filename} — ${info.page_count} pages, ${formatBytes(info.size_bytes)}`;
    $("#merge-success").hidden = false;
    $("#step-row-1").hidden = true;
    $("#step-row-2").hidden = true;
    $("#step-row-3").hidden = true;
  },

  _updateAddZone(empty) {
    const stepTitle = $("#step-row-1 .step-title");
    const stepSubtitle = $("#step-row-1 .step-subtitle");
    const dz = $("#merge-add-zone");
    const dzText = $("#merge-add-zone .merge-add-text");
    const addBtn = $("#btn-merge-add");

    if (empty) {
      stepTitle.textContent = "Ajoutez vos PDF";
      stepSubtitle.textContent = "Glissez-déposez plusieurs fichiers ou cliquez pour parcourir.";
      dzText.textContent = "Glissez vos PDF ici";
      addBtn.textContent = "Ajouter des fichiers";
      dz.classList.remove("compact");
    } else {
      stepTitle.textContent = "Ajoutez d'autres PDF";
      stepSubtitle.textContent = "La même zone sert à ajouter d'autres fichiers à la liste.";
      dzText.textContent = "Glissez d'autres PDF ici pour les ajouter";
      addBtn.textContent = "+ Ajouter d'autres fichiers";
      dz.classList.add("compact");
    }
  },

  render() {
    const list = $("#merge-list");
    const totals = $("#merge-totals");
    const runBtn = $("#btn-merge-run");
    const empty = this.files.length === 0;

    this._updateAddZone(empty);

    if (empty) {
      $("#step-row-2").hidden = true;
      $("#step-row-3").hidden = true;
      return;
    }

    $("#step-row-2").hidden = false;
    $("#step-row-3").hidden = false;

    const subtitle = $("#step-2-subtitle");
    if (subtitle) {
      const n = this.files.length;
      subtitle.textContent = `${n} fichier${n > 1 ? "s" : ""} prêt${n > 1 ? "s" : ""} — utilisez les flèches pour réorganiser, ✕ pour retirer.`;
    }

    const totalPages = this.files.reduce((s, f) => s + (f.page_count || 0), 0);
    const totalBytes = this.files.reduce((s, f) => s + (f.size_bytes || 0), 0);
    totals.innerHTML = `Total : <strong>${totalPages} page${totalPages > 1 ? "s" : ""}</strong> — ${formatBytes(totalBytes)}`;

    const checkSvg = `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M2.5 6.3 5 8.8 9.5 3.5"/></svg>`;

    list.innerHTML = this.files
      .map(
        (f, idx) => `
      <li class="merge-item" data-idx="${idx}">
        <span class="merge-item-pos">${idx + 1}</span>
        <span class="merge-item-icon">📄</span>
        <div class="merge-item-info">
          <span class="file-name-row">
            <span class="file-name merge-item-name" title="${escapeHtml(f.path)}">${escapeHtml(f.filename)}</span>
            <span class="file-check" aria-label="PDF valide">${checkSvg}</span>
          </span>
          <span class="merge-item-meta">${f.page_count} page${f.page_count > 1 ? "s" : ""} — ${formatBytes(f.size_bytes)}</span>
        </div>
        <span class="merge-item-controls">
          <button class="merge-item-btn merge-item-up" data-idx="${idx}" ${idx === 0 ? "disabled" : ""} title="Monter" aria-label="Monter">↑</button>
          <button class="merge-item-btn merge-item-down" data-idx="${idx}" ${idx === this.files.length - 1 ? "disabled" : ""} title="Descendre" aria-label="Descendre">↓</button>
          <button class="merge-item-btn merge-item-remove" data-idx="${idx}" title="Retirer" aria-label="Retirer">✕</button>
        </span>
      </li>`
      )
      .join("");

    list.querySelectorAll(".merge-item-up").forEach((b) =>
      b.addEventListener("click", () => this.move(parseInt(b.dataset.idx, 10), -1))
    );
    list.querySelectorAll(".merge-item-down").forEach((b) =>
      b.addEventListener("click", () => this.move(parseInt(b.dataset.idx, 10), 1))
    );
    list.querySelectorAll(".merge-item-remove").forEach((b) =>
      b.addEventListener("click", () => this.remove(parseInt(b.dataset.idx, 10)))
    );

    const nameInput = $("#merge-name");
    if (!nameInput.value) {
      nameInput.value = `fusion_${this.files.length}_documents.pdf`;
    }

    runBtn.disabled = this.files.length < 2;
    runBtn.textContent = this.files.length < 2 ? "Ajoutez au moins 2 PDF" : `Fusionner les ${this.files.length} PDF`;
  },

  async run() {
    if (this.files.length < 2) return;
    const name = ($("#merge-name").value || "").trim() || "fusion.pdf";
    const dir = $("#merge-folder").value;
    if (!dir) {
      showToast("Choisissez un dossier de destination.", "error");
      return;
    }
    const paths = this.files.map((f) => f.path);
    const runBtn = $("#btn-merge-run");
    const oldText = runBtn.textContent;
    runBtn.disabled = true;
    runBtn.textContent = "Fusion en cours…";
    try {
      const res = await api().merge_pdfs(paths, dir, name);
      if (res.ok) {
        this._showSuccess(res.info);
      } else {
        showToast(res.error || "Échec de la fusion.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur inattendue lors de la fusion.", "error");
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
        $("#merge-folder").value = folder;
      }
    } catch (e) {
      console.error(e);
    }
  },

  setupDragAndDrop() {
    const dz = $("#merge-add-zone");
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
      if (files.length > 1) showToast(`Importation de ${files.length} fichiers…`, "info");
      for (const f of files) {
        await this.addDropped(f);
      }
    });
    dz.addEventListener("click", (e) => {
      if (e.target.closest(".merge-add-button")) return;
      this.addFiles();
    });
  },
};

function initMerge() {
  MergeView.setupDragAndDrop();
  $("#btn-merge-add").addEventListener("click", () => MergeView.addFiles());
  $("#btn-pick-folder").addEventListener("click", () => MergeView.pickFolder());
  $("#btn-merge-run").addEventListener("click", () => MergeView.run());
  $("#btn-merge-again").addEventListener("click", () => {
    MergeView.reset();
  });
  $("#btn-merge-open").addEventListener("click", () => {
    if (MergeView._lastResult && api()) api().open_file(MergeView._lastResult.path);
  });
  $("#btn-merge-explorer").addEventListener("click", () => {
    if (MergeView._lastResult && api()) api().open_in_explorer(MergeView._lastResult.path);
  });
  $("#btn-back-merge").addEventListener("click", () => Views.show("hub"));
}

document.addEventListener("viewenter", (e) => {
  if (e.detail.name === "merge") MergeView.onEnter();
});
