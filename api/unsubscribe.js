/**
 * /api/unsubscribe.js — Vercel Serverless Function
 *
 * Handles newsletter unsubscription for Beto's Table.
 * Validates HMAC token, marks subscriber as inactive in Firestore.
 *
 * GET: /api/unsubscribe?email=xxx&token=yyy
 *   → Shows confirmation page (or auto-processes if token is valid)
 *
 * Env vars needed:
 *   FIREBASE_SERVICE_ACCOUNT — JSON string of Firebase service account
 *   CMEJOR_UNSUB_SECRET — HMAC secret for validating unsubscribe tokens
 */

const crypto = require('crypto');

function getUnsubToken(email, secret) {
  return crypto.createHmac('sha256', secret)
    .update(email.toLowerCase().trim())
    .digest('hex')
    .slice(0, 16);
}

// Lazy-init Firebase Admin
let adminDb = null;
async function getFirestore() {
  if (adminDb) return adminDb;
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  adminDb = admin.firestore();
  return adminDb;
}

function htmlPage(title, message, success = true) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — Chorizo Mejor</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; background: #FFF8E1; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #fff; border-radius: 16px; padding: 48px; max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .emoji { font-size: 64px; margin-bottom: 16px; }
    h1 { font-family: 'Helvetica Neue', Arial, sans-serif; color: ${success ? '#2D2D2D' : '#D84315'}; margin-bottom: 12px; font-size: 24px; }
    p { color: #666; line-height: 1.6; font-size: 16px; margin-bottom: 16px; }
    a { color: #D84315; text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${success ? '👋' : '🤔'}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="https://chorizomejor.com/#/stories">← Back to Chorizo Mejor</a></p>
  </div>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const { email, token } = req.query || {};

    if (!email || !token) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(htmlPage(
        'Invalid Link',
        'This unsubscribe link appears to be broken. If you want to unsubscribe, reply to any Beto\'s Table email with "Unsubscribe" in the subject.',
        false
      ));
    }

    const secret = process.env.CMEJOR_UNSUB_SECRET || 'cmejor-unsub-2026';
    const expectedToken = getUnsubToken(email, secret);

    if (token !== expectedToken) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(403).send(htmlPage(
        'Invalid Token',
        'This unsubscribe link is invalid or expired. Reply to any Beto\'s Table email with "Unsubscribe" in the subject and we\'ll take care of it.',
        false
      ));
    }

    // Token valid — remove subscriber from Firestore
    const firestore = await getFirestore();
    const subsRef = firestore.collection('newsletter_subscribers');
    const snap = await subsRef.where('email', '==', email.toLowerCase().trim()).get();

    if (snap.empty) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(htmlPage(
        'Already Unsubscribed',
        'Looks like you\'re already off the list. You won\'t receive any more emails from Beto\'s Table.'
      ));
    }

    // Delete all matching subscriber docs
    const batch = firestore.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(htmlPage(
      'Unsubscribed',
      'You\'ve been removed from Beto\'s Table. We\'re sorry to see you go — but the tacos will be here if you ever come back.'
    ));
  } catch (err) {
    console.error('Unsubscribe error:', err);
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(htmlPage(
      'Something Went Wrong',
      'We couldn\'t process your unsubscribe request. Reply to any Beto\'s Table email with "Unsubscribe" and we\'ll handle it manually.',
      false
    ));
  }
};
