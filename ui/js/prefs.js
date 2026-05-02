const PrefsView = {
  prefs: {},

  async onEnter() {
    if (api()) {
      try {
        this.prefs = await api().get_prefs();
      } catch (e) {
        this.prefs = {};
      }
    }
    this.render();
  },

  async render() {
    const theme = ThemeManager.current();
    $("#prefs-theme-current").textContent = theme === "dark" ? "🌙 Sombre" : "☀️ Clair";

    let outputDir = this.prefs.output_dir || "";
    if (!outputDir && api()) {
      try {
        outputDir = await api().get_default_output_dir();
      } catch (e) {}
    }
    $("#prefs-output-dir").value = outputDir;

    $("#prefs-ocr-lang").value = this.prefs.ocr_lang || "fra";
  },

  async setPref(key, value) {
    if (!api()) return;
    try {
      await api().set_pref(key, String(value));
      this.prefs[key] = value;
    } catch (e) {
      console.error(e);
      showToast("Échec de l'enregistrement.", "error");
    }
  },

  async pickOutputDir() {
    if (!api()) return;
    const folder = await api().pick_output_folder();
    if (folder) {
      $("#prefs-output-dir").value = folder;
      await this.setPref("output_dir", folder);
      showToast("Dossier par défaut enregistré.", "success");
    }
  },

  toggleTheme() {
    const next = ThemeManager.toggle();
    $("#prefs-theme-current").textContent = next === "dark" ? "🌙 Sombre" : "☀️ Clair";
    showToast(next === "dark" ? "Mode sombre activé." : "Mode clair activé.");
  },

  async clearRecents() {
    if (!api()) return;
    if (!confirm("Effacer la liste des fichiers récents ? Les fichiers eux-mêmes ne seront pas supprimés.")) {
      return;
    }
    try {
      await api().clear_recents();
      showToast("Liste effacée.", "success");
    } catch (e) {
      console.error(e);
      showToast("Échec.", "error");
    }
  },

  async openDataFolder() {
    if (!api()) return;
    try {
      await api().open_data_folder();
    } catch (e) {
      showToast("Impossible d'ouvrir le dossier.", "error");
    }
  },
};

function initPrefs() {
  $("#btn-prefs-theme").addEventListener("click", () => PrefsView.toggleTheme());
  $("#btn-prefs-pick-dir").addEventListener("click", () => PrefsView.pickOutputDir());
  $("#btn-prefs-clear-recents").addEventListener("click", () => PrefsView.clearRecents());
  $("#btn-prefs-open-data").addEventListener("click", () => PrefsView.openDataFolder());
  $("#prefs-ocr-lang").addEventListener("change", (e) => {
    PrefsView.setPref("ocr_lang", e.target.value);
    showToast("Langue OCR enregistrée.", "success");
  });
  $("#btn-back-prefs").addEventListener("click", () => Views.show("hub"));
  const studioLink = $("#btn-prefs-studio-link");
  if (studioLink) {
    studioLink.addEventListener("click", async () => {
      if (api() && api().open_url) {
        await api().open_url("https://triskell-studio.fr");
      }
    });
  }
}

document.addEventListener("viewenter", (e) => {
  if (e.detail.name === "prefs") PrefsView.onEnter();
});
