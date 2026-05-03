// ===== Updater + Beta UI — pattern recopie de DéliNote =====

const UpdaterUI = {
  status: { phase: "idle", current_version: "0.0.0" },
  betaStatus: null,
  bannerDismissed: false,

  async init() {
    if (!api()) return;

    // Status initial
    try {
      this.status = await api().updater_status();
    } catch (e) {}

    // Synchronise tous les affichages de version (topbar, splash, à propos)
    this._syncVersionDisplays();

    // Bind global pour push depuis Python
    window.onUpdaterStatus = (s) => {
      this.status = s;
      this.renderBanner();
      this.renderPrefsStatus();
    };

    // Beta check au boot
    try {
      this.betaStatus = await api().beta_status();
      this.renderBetaBanner();
      this.renderBetaExpired();
    } catch (e) {}

    this.renderBanner();
    this.renderPrefsStatus();
  },

  _syncVersionDisplays() {
    const v = (this.status && this.status.current_version) || "—";
    const brand = document.getElementById("brand-version");
    if (brand) brand.textContent = "v" + v;
    const about = document.getElementById("about-version");
    if (about) about.textContent = `Le Studio PDF — version ${v}`;
    const splash = document.querySelector(".splash-version");
    if (splash) splash.textContent = `Version ${v}`;
  },

  renderBanner() {
    const banner = document.getElementById("update-banner");
    if (!banner) return;
    const s = this.status;

    if (this.bannerDismissed) {
      banner.classList.remove("is-visible");
      return;
    }
    if (!["available", "downloading", "ready"].includes(s.phase)) {
      banner.classList.remove("is-visible");
      return;
    }

    let html = "";
    if (s.phase === "available") {
      html = `
        <span class="update-banner-icon">⬇</span>
        <span class="update-banner-text">
          Mise à jour <strong>${s.next_version}</strong> disponible — téléchargement…
        </span>
        <button class="update-banner-close" id="btn-update-banner-close">×</button>
      `;
    } else if (s.phase === "downloading") {
      html = `
        <span class="update-banner-icon spinning">↻</span>
        <span class="update-banner-text">Téléchargement <strong>${s.next_version}</strong></span>
        <span class="update-banner-progress"><span class="update-banner-progress-bar" style="width:${s.percent || 0}%"></span></span>
        <span class="update-banner-pct">${s.percent || 0}% · ${formatBytes(s.bytes_per_second || 0)}/s</span>
        <button class="update-banner-close" id="btn-update-banner-close">×</button>
      `;
    } else if (s.phase === "ready") {
      html = `
        <span class="update-banner-icon">✓</span>
        <span class="update-banner-text">Mise à jour <strong>${s.next_version}</strong> prête à installer</span>
        <button class="update-banner-install" id="btn-update-install">Installer maintenant</button>
        <button class="update-banner-close" id="btn-update-banner-close">×</button>
      `;
    }

    banner.innerHTML = html;
    banner.classList.add("is-visible");

    const installBtn = document.getElementById("btn-update-install");
    if (installBtn) installBtn.addEventListener("click", () => this.install());
    const closeBtn = document.getElementById("btn-update-banner-close");
    if (closeBtn) closeBtn.addEventListener("click", () => {
      this.bannerDismissed = true;
      this.renderBanner();
    });
  },

  renderBetaBanner() {
    const banner = document.getElementById("beta-banner");
    if (!banner || !this.betaStatus) return;
    if (!this.betaStatus.is_beta || this.betaStatus.expired) {
      banner.classList.remove("is-visible");
      return;
    }
    const d = this.betaStatus.days_left;
    const v = this.betaStatus.version;
    banner.innerHTML = `
      <span class="beta-banner-tag">BÊTA</span>
      Version ${v} — expire dans ${d} jour${d > 1 ? "s" : ""}
    `;
    banner.classList.add("is-visible");
  },

  renderBetaExpired() {
    const overlay = document.getElementById("beta-expired");
    if (!overlay || !this.betaStatus) return;
    if (this.betaStatus.is_beta && this.betaStatus.expired) {
      overlay.classList.add("is-visible");
    } else {
      overlay.classList.remove("is-visible");
    }
  },

  renderPrefsStatus() {
    const el = document.getElementById("prefs-update-status");
    if (!el) return;
    const s = this.status;
    el.className = "prefs-update-status " + (s.phase || "idle");

    let icon = "ℹ️", text = "";
    switch (s.phase) {
      case "idle": icon = "ℹ️"; text = "Aucune vérification effectuée pour cette session."; break;
      case "checking": icon = "↻"; text = "Recherche d'une mise à jour…"; break;
      case "available": icon = "⬇"; text = `Version ${s.next_version} disponible — téléchargement…`; break;
      case "not-available": icon = "✓"; text = `Vous êtes à jour (${s.current_version}).`; break;
      case "downloading": icon = "↻"; text = `Téléchargement ${s.next_version}…`; break;
      case "ready": icon = "✓"; text = `Version ${s.next_version} prête à installer.`; break;
      case "error": icon = "✗"; text = s.message || "Erreur de mise à jour."; break;
    }
    let html = `<span class="prefs-update-status-icon">${icon}</span><span class="prefs-update-status-text">${escapeHtml(text)}</span>`;
    if (s.phase === "downloading") {
      html += `<span class="prefs-update-progress-bar"><div style="width:${s.percent || 0}%"></div></span>`;
    }
    if (s.phase === "ready") {
      html += `<button class="btn-primary" id="btn-prefs-update-install" style="padding:5px 14px;font-size:12px;">Installer</button>`;
    }
    el.innerHTML = html;

    const installBtn = document.getElementById("btn-prefs-update-install");
    if (installBtn) installBtn.addEventListener("click", () => this.install());
  },

  async checkNow() {
    if (!api()) return;
    try {
      await api().updater_check();
    } catch (e) {
      showToast("Vérification impossible.", "error");
    }
  },

  async install() {
    if (!api()) return;
    showToast("Lancement de l'installeur…", "info");
    try {
      await api().updater_install();
    } catch (e) {
      showToast("Installation impossible.", "error");
    }
  },

  async setChannel(channel) {
    if (!api()) return;
    try {
      await api().updater_set_channel(channel);
      document.querySelectorAll(".prefs-channel-toggle button").forEach((b) =>
        b.classList.toggle("is-active", b.dataset.channel === channel));
      showToast(channel === "beta" ? "Canal bêta activé." : "Canal stable activé.");
      this.checkNow();
    } catch (e) {}
  },
};

function initUpdater() {
  UpdaterUI.init();

  const checkBtn = document.getElementById("btn-prefs-check-update");
  if (checkBtn) checkBtn.addEventListener("click", () => UpdaterUI.checkNow());

  document.querySelectorAll(".prefs-channel-toggle button").forEach((b) => {
    b.addEventListener("click", () => UpdaterUI.setChannel(b.dataset.channel));
  });

  const downloadBtn = document.getElementById("btn-beta-expired-download");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", async () => {
      if (api()) await api().open_url("https://github.com/Jordan-Bourillot/le-studio-pdf/releases/latest");
    });
  }
}

document.addEventListener("viewenter", (e) => {
  if (e.detail.name === "prefs") UpdaterUI.renderPrefsStatus();
});
