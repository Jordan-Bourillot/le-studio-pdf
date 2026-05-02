const ProtectView = {
  file: null,
  outputDir: "",
  _lastResult: null,
  _showPwd1: false,
  _showPwd2: false,

  async onEnter() {
    if (!this.outputDir && api()) {
      try {
        this.outputDir = await api().get_default_output_dir();
        $("#prt-folder").value = this.outputDir;
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
      $("#prt-name").value = "";
      this.render();
    } else if (result && !result.ok) {
      showToast(result.error, "error");
    } else if (result && result.info && result.info.encrypted) {
      showToast(`${result.info.filename} est déjà protégé.`, "info");
    }
  },

  async setDropped(fileObj) {
    if (!api()) return;
    if (fileObj.path && fileObj.path !== "" && fileObj.path !== fileObj.name) {
      const res = await api().inspect_file(fileObj.path);
      if (res && res.ok && !res.info.encrypted) {
        this.file = res.info;
        $("#prt-name").value = "";
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
        $("#prt-name").value = "";
        this.render();
      } else {
        showToast(res.error || "Importation impossible.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur de lecture du fichier.", "error");
    }
  },

  reset() {
    this.file = null;
    this._lastResult = null;
    $("#prt-name").value = "";
    $("#prt-pwd").value = "";
    $("#prt-pwd2").value = "";
    this._refreshStrength();
    this._refreshMatch();
    this._exitSuccess();
    this.render();
  },

  _exitSuccess() {
    $("#prt-success").hidden = true;
    $("#prt-step-row-1").hidden = false;
  },

  _showSuccess(info) {
    this._lastResult = info;
    const restrictions = [];
    if (!info.allow_printing) restrictions.push("impression bloquée");
    if (!info.allow_copying) restrictions.push("copie bloquée");
    if (!info.allow_modifying) restrictions.push("modification bloquée");
    const restrText = restrictions.length
      ? `Restrictions actives : ${restrictions.join(", ")}.`
      : "Aucune restriction supplémentaire.";
    $("#prt-success-info").innerHTML = `${escapeHtml(info.filename)} — ${restrText}`;
    $("#prt-success").hidden = false;
    $("#prt-step-row-1").hidden = true;
    $("#prt-step-row-2").hidden = true;
    $("#prt-step-row-3").hidden = true;
  },

  _updateInputZone() {
    const empty = !this.file;
    const stepTitle = $("#prt-step-row-1 .step-title");
    const stepSubtitle = $("#prt-step-1-subtitle");
    const zone = $("#prt-input-zone");

    if (empty) {
      stepTitle.textContent = "Sélectionnez votre PDF";
      stepSubtitle.textContent = "Glissez-déposez ou cliquez pour parcourir.";
      $("#prt-input-empty").hidden = false;
      $("#prt-input-loaded").hidden = true;
      zone.classList.remove("loaded");
    } else {
      stepTitle.textContent = "PDF sélectionné";
      stepSubtitle.textContent = "Vous pouvez en choisir un autre si besoin.";
      $("#prt-input-empty").hidden = true;
      $("#prt-input-loaded").hidden = false;
      zone.classList.add("loaded");
      $("#prt-loaded-name").textContent = this.file.filename;
      $("#prt-loaded-name").title = this.file.path;
      const pages = this.file.page_count || 0;
      $("#prt-loaded-meta").textContent =
        `${pages} page${pages > 1 ? "s" : ""} — ${formatBytes(this.file.size_bytes)}`;
    }
  },

  _passwordStrength(pwd) {
    if (!pwd) return null;
    const len = pwd.length;
    if (len < 6) return "weak";
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasDigit = /\d/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
    const variety = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
    if (len >= 10 && variety >= 3) return "strong";
    if (len >= 8 && variety >= 2) return "medium";
    return "weak";
  },

  _refreshStrength() {
    const pwd = $("#prt-pwd").value;
    const wrap = $("#prt-strength");
    const fill = $("#prt-strength-fill");
    const label = $("#prt-strength-label");
    if (!pwd) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    const level = this._passwordStrength(pwd);
    fill.className = `pwd-strength-fill ${level}`;
    label.className = `pwd-strength-label ${level}`;
    const labels = { weak: "Faible", medium: "Moyen", strong: "Fort" };
    label.textContent = labels[level] || "";
  },

  _refreshMatch() {
    const pwd = $("#prt-pwd").value;
    const pwd2 = $("#prt-pwd2").value;
    const el = $("#prt-match");
    if (!pwd2) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    if (pwd === pwd2) {
      el.className = "pwd-match ok";
      el.textContent = "✓ Les mots de passe correspondent.";
    } else {
      el.className = "pwd-match ko";
      el.textContent = "✗ Les mots de passe ne correspondent pas.";
    }
  },

  _validate() {
    if (!this.file) return { ok: false, msg: "Choisissez un PDF." };
    const pwd = $("#prt-pwd").value;
    const pwd2 = $("#prt-pwd2").value;
    if (!pwd) return { ok: false, msg: "Saisissez un mot de passe." };
    if (pwd.length < 6) return { ok: false, msg: "Le mot de passe doit faire au moins 6 caractères." };
    if (pwd !== pwd2) return { ok: false, msg: "Les mots de passe ne correspondent pas." };
    return { ok: true };
  },

  _refreshButton() {
    const runBtn = $("#btn-prt-run");
    if (!this.file) {
      runBtn.disabled = true;
      runBtn.textContent = "Choisissez un PDF";
      return;
    }
    const v = this._validate();
    if (!v.ok) {
      runBtn.disabled = true;
      runBtn.textContent = v.msg;
      return;
    }
    runBtn.disabled = false;
    runBtn.textContent = "Protéger le PDF";
  },

  render() {
    this._updateInputZone();
    const hasFile = !!this.file;
    $("#prt-step-row-2").hidden = !hasFile;
    $("#prt-step-row-3").hidden = !hasFile;

    if (hasFile) {
      const nameInput = $("#prt-name");
      if (!nameInput.value) {
        const base = this.file.filename.replace(/\.pdf$/i, "");
        nameInput.value = `${base}_protege.pdf`;
      }
    }

    this._refreshButton();
  },

  togglePwd(which) {
    if (which === 1) {
      this._showPwd1 = !this._showPwd1;
      $("#prt-pwd").type = this._showPwd1 ? "text" : "password";
      $("#btn-prt-toggle1").classList.toggle("active", this._showPwd1);
    } else {
      this._showPwd2 = !this._showPwd2;
      $("#prt-pwd2").type = this._showPwd2 ? "text" : "password";
      $("#btn-prt-toggle2").classList.toggle("active", this._showPwd2);
    }
  },

  async run() {
    const v = this._validate();
    if (!v.ok) {
      showToast(v.msg, "error");
      return;
    }

    const pwd = $("#prt-pwd").value;
    const name = ($("#prt-name").value || "").trim() || "fichier_protege.pdf";
    const dir = $("#prt-folder").value;
    if (!dir) {
      showToast("Choisissez un dossier de destination.", "error");
      return;
    }

    const options = {
      allow_printing: !$("#prt-block-print").checked,
      allow_copying: !$("#prt-block-copy").checked,
      allow_modifying: !$("#prt-block-modify").checked,
    };

    const runBtn = $("#btn-prt-run");
    const oldText = runBtn.textContent;
    runBtn.disabled = true;
    runBtn.textContent = "Protection en cours…";
    try {
      const res = await api().protect_pdf(this.file.path, dir, name, pwd, options);
      if (res.ok) {
        this._showSuccess(res.info);
      } else {
        showToast(res.error || "Protection échouée.", "error");
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
    try {
      const folder = await api().pick_output_folder();
      if (folder) {
        this.outputDir = folder;
        $("#prt-folder").value = folder;
      }
    } catch (e) {
      console.error(e);
    }
  },

  setupDragAndDrop() {
    const dz = $("#prt-input-zone");
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
      if (e.target.closest(".prt-input-button")) return;
      if (e.target.closest(".prt-input-secondary")) return;
      if (this.file) return;
      this.pickFile();
    });
  },
};

function initProtect() {
  ProtectView.setupDragAndDrop();
  $("#btn-prt-pick").addEventListener("click", (e) => {
    e.stopPropagation();
    ProtectView.pickFile();
  });
  $("#btn-prt-change").addEventListener("click", (e) => {
    e.stopPropagation();
    ProtectView.pickFile();
  });
  $("#btn-prt-pick-folder").addEventListener("click", () => ProtectView.pickFolder());
  $("#btn-prt-run").addEventListener("click", () => ProtectView.run());
  $("#btn-prt-again").addEventListener("click", () => ProtectView.reset());
  $("#btn-prt-explorer").addEventListener("click", () => {
    if (ProtectView._lastResult && api()) api().open_in_explorer(ProtectView._lastResult.path);
  });
  $("#btn-back-protect").addEventListener("click", () => Views.show("hub"));

  $("#btn-prt-toggle1").addEventListener("click", () => ProtectView.togglePwd(1));
  $("#btn-prt-toggle2").addEventListener("click", () => ProtectView.togglePwd(2));

  $("#prt-pwd").addEventListener("input", () => {
    ProtectView._refreshStrength();
    ProtectView._refreshMatch();
    ProtectView._refreshButton();
  });
  $("#prt-pwd2").addEventListener("input", () => {
    ProtectView._refreshMatch();
    ProtectView._refreshButton();
  });
}

document.addEventListener("viewenter", (e) => {
  if (e.detail.name === "protect") ProtectView.onEnter();
});
