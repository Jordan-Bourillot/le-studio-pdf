// Bouton "Acheter" -> POST /api/create-checkout -> redirige vers Stripe.
// Auto-déclenchement si l'URL contient ?buy=1 (skip de la page intermédiaire
// quand on arrive depuis la grande landing triskell-studio.fr/studio-pdf).
'use strict';

(function () {
  const btn = document.getElementById('buy-btn');
  if (!btn) return;

  async function startCheckout(originLabel) {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Chargement...';

    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Réponse invalide');
      }
      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      btn.textContent = original;
      // En auto-buy, on annule le mode "redirection" pour laisser l'utilisateur
      // voir la page et réessayer manuellement.
      document.body.classList.remove('auto-buy');
      alert('Impossible de lancer le paiement : ' + err.message + '\n\nRéessaie ou contacte contact@triskell-studio.fr');
    }
  }

  btn.addEventListener('click', () => startCheckout('click'));

  // Auto-buy : si on arrive avec ?buy=1, on lance Stripe immédiatement
  // pour épargner à l'utilisateur un clic supplémentaire.
  const params = new URLSearchParams(window.location.search);
  if (params.get('buy') === '1') {
    document.body.classList.add('auto-buy');
    startCheckout('auto');
  }
})();
