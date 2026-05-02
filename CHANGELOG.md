# CHANGELOG — Le Studio PDF

Toutes les versions sont distribuées sur [GitHub Releases](https://github.com/Jordan-Bourillot/le-studio-pdf/releases).

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) · [SemVer](https://semver.org/lang/fr/).

---

## [2.7.0] — 2026-05-03 — Bêta

### 🦡 Identité
- Bertrand le blaireau (mascotte) intégré sur le splash, le hub, les écrans de succès et la barre des tâches
- Palette **Cognac & Ivoire** chaude et premium
- Halo lumineux cuivré autour de la mascotte (mode clair et sombre)
- Logo officiel Triskell Studio dans le hub footer et les préférences (cliquable vers triskell-studio.fr)

### 🛠️ Modules complets
- 🔗 Fusionner — combiner plusieurs PDF
- ✂️ Découper — extraire des pages
- 🗜️ Compresser — 3 niveaux (mail / web / archive)
- 🔄 Convertir — Word + Images
- 🔍 OCR — reconnaissance de texte (Tesseract)
- 🔒 Protéger — chiffrement AES-256
- 💧 Filigrane — texte + numérotation
- ✏️ Tampons — PAYÉ, BROUILLON, CONFIDENTIEL...

### ⚙️ Paramètres
- Page Préférences complète
- Toggle thème clair / sombre
- Choix dossier de sortie par défaut
- Langue OCR par défaut
- Effacer les fichiers récents
- Bouton Enregistrer

### 🌐 Distribution
- Installeur Windows (Inno Setup) avec assistant français
- Case "Créer un raccourci sur le bureau" pendant l'installation
- Visual C++ Redist + .NET Framework 4.8 embarqués (auto-install si manquants)
- Auto-update via GitHub Releases (vérification au démarrage)
- Canal **stable** ou **bêta** sélectionnable

---

## Roadmap

### v2.8 (prochaine bêta)
- Édition de texte directement dans le PDF
- Caviardage RGPD (vrai noircissement)
- Signature électronique (eIDAS, certificats RGS)

### v3.0 (stable)
- Formulaires interactifs
- Comparaison de 2 PDF (diff visuel)
- Traitement par lot
- PDF/A pour archivage légal
