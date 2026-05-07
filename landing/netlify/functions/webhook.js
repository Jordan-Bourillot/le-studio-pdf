// POST /api/webhook — webhook Stripe pour Le Studio PDF.
// 1. Filtre par metadata.product pour eviter le fan-out
// 2. Envoie le mail de bienvenue avec lien de download
// 3. Appelle l'API du Lanceur pour ajouter la licence au compte Triskell

'use strict';

const Stripe = require('stripe');
const { Resend } = require('resend');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia'
});
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'method-not-allowed' };
  }

  const signature = event.headers['stripe-signature'];
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64')
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature invalide:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: JSON.stringify({ received: true, ignored: stripeEvent.type }) };
  }

  const session = stripeEvent.data.object;

  // Filtre PRODUIT (FIX bug fan-out) — on ignore les paiements d'autres produits.
  if (session.metadata?.product !== 'studio-pdf-v1') {
    console.log(`Webhook Studio PDF ignore : product="${session.metadata?.product}"`);
    return { statusCode: 200, body: JSON.stringify({ received: true, ignored_product: true }) };
  }

  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    return { statusCode: 200, body: JSON.stringify({ received: true, status: session.payment_status }) };
  }

  const email = session.customer_details?.email || session.customer_email;
  if (!email) {
    console.error('Email absent de la session', session.id);
    return { statusCode: 200, body: JSON.stringify({ received: true, error: 'no email' }) };
  }

  // 1. Mail de bienvenue avec lien vers La Table Ronde
  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'livraison@triskell-studio.fr',
      to: email,
      reply_to: process.env.REPLY_TO_EMAIL || 'contact@triskell-studio.fr',
      subject: '✓ Le Studio PDF — bienvenue',
      text: buildEmailText({ sessionId: session.id }),
      html: buildEmailHtml({ sessionId: session.id, firstName: session.customer_details?.name?.split(' ')[0] }),
      tags: [
        { name: 'product', value: 'studio-pdf' },
        { name: 'type',    value: 'delivery' }
      ]
    });
    console.log(`Email Studio PDF envoye a ${email} pour ${session.id}`);
  } catch (err) {
    console.error('Erreur Resend:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'email-failed' }) };
  }

  // 2. Enregistre la licence sur le compte Triskell (idempotent)
  try {
    const apiBase = process.env.LANCEUR_API_URL;
    const sharedSecret = process.env.LANCEUR_INTERNAL_SECRET;
    if (apiBase && sharedSecret) {
      await fetch(`${apiBase}/api/register-license`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': sharedSecret
        },
        body: JSON.stringify({
          email,
          productKey: 'studio-pdf',
          stripeSessionId: session.id
        })
      });
    }
  } catch (err) {
    // Pas critique : le client a son email, juste sa tuile dans le Lanceur
    // ne s'activera pas tant qu'on retry pas. On log et on laisse passer.
    console.error('register-license a echoue:', err);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

function buildEmailText({ sessionId }) {
  return `Bienvenue !

Ton accès au Studio PDF est activé.

Pour l'utiliser :

→ Tu as déjà La Table Ronde installée ?
   Ouvre-la — la tuile "Le Studio PDF" apparaît adoubée, clique "Installer".

→ Tu ne l'as pas encore ?
   Télécharge-la gratuitement ici : https://app.triskell-studio.fr
   Crée ton compte avec CET email, puis clique "Installer" sur la tuile Studio PDF.

Référence : ${sessionId}

Une question ? Réponds simplement à cet email.

— Triskell Studio
`;
}

function buildEmailHtml({ sessionId, firstName }) {
  const greeting = firstName ? `Salut ${firstName},` : 'Salut,';
  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,sans-serif;background:#0d0f12;color:#e9e6df;padding:32px;">
  <div style="max-width:520px;margin:0 auto;background:#161a20;border:1px solid #262b34;border-radius:12px;padding:36px;">
    <h1 style="color:#c9a961;margin:0 0 16px;font-size:22px;">Le Studio PDF est à toi</h1>
    <p style="color:#9aa0ab;font-size:15px;line-height:1.6;margin-bottom:18px;">${greeting}</p>
    <p style="color:#9aa0ab;font-size:15px;line-height:1.6;">Merci pour ton achat. Voici comment accéder au Studio PDF :</p>

    <div style="background:#0d0f12;border:1px solid #262b34;border-radius:8px;padding:16px 20px;margin:18px 0;">
      <p style="color:#c9a961;font-size:13px;font-weight:700;margin:0 0 8px;text-transform:uppercase;letter-spacing:.05em;">✓ Tu as déjà La Table Ronde</p>
      <p style="color:#9aa0ab;font-size:14px;line-height:1.6;margin:0;">Ouvre-la — la tuile <strong style="color:#e9e6df;">Le Studio PDF</strong> apparaît adoubée. Clique <strong style="color:#e9e6df;">Installer</strong>.</p>
    </div>

    <div style="background:#0d0f12;border:1px solid #262b34;border-radius:8px;padding:16px 20px;margin:18px 0 24px;">
      <p style="color:#c9a961;font-size:13px;font-weight:700;margin:0 0 8px;text-transform:uppercase;letter-spacing:.05em;">↓ Tu ne l'as pas encore</p>
      <ol style="color:#9aa0ab;font-size:14px;line-height:1.7;padding-left:18px;margin:0;">
        <li>Télécharge <strong style="color:#e9e6df;">La Table Ronde</strong> (gratuit) via le bouton ci-dessous</li>
        <li>Crée ton compte avec <strong style="color:#e9e6df;">cet email</strong></li>
        <li>Tuile "Le Studio PDF" → bouton <strong style="color:#e9e6df;">Installer</strong></li>
      </ol>
    </div>

    <p style="text-align:center;margin:0 0 22px;">
      <a href="https://app.triskell-studio.fr" style="background:#c9a961;color:#1a1408;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px;display:inline-block;">
        Télécharger / Ouvrir La Table Ronde
      </a>
    </p>
    <p style="color:#6b7280;font-size:12px;margin:0;">Référence commande : ${sessionId}</p>
    <p style="color:#6b7280;font-size:12px;margin:8px 0 0;">Garantie 14 jours satisfait ou remboursé. Réponds à cet email pour toute question.</p>
  </div>
</body></html>`;
}
