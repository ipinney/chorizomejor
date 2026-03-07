/**
 * /api/subscribe.js — Vercel Serverless Function
 *
 * Handles newsletter subscriptions for Beto's Table:
 * 1. Writes subscriber to Firestore newsletter_subscribers collection
 * 2. Sends welcome email via SendGrid
 *
 * POST body: { email: string, name?: string }
 *
 * Env vars needed:
 *   SENDGRID_API_KEY — SendGrid API key
 *   FIREBASE_SERVICE_ACCOUNT — JSON string of Firebase service account
 *   CMEJOR_UNSUB_SECRET — HMAC secret for generating unsubscribe tokens
 */

const ALLOWED_ORIGINS = [
  'https://www.chorizomejor.com',
  'https://chorizomejor.com',
  'https://chorizomejor-app.vercel.app'
];

// Simple HMAC for unsubscribe tokens (Node.js built-in)
const crypto = require('crypto');

function getUnsubToken(email, secret) {
  return crypto.createHmac('sha256', secret)
    .update(email.toLowerCase().trim())
    .digest('hex')
    .slice(0, 16);
}

function getUnsubUrl(email, secret) {
  return `https://chorizomejor.com/api/unsubscribe?email=${encodeURIComponent(email)}&token=${getUnsubToken(email, secret)}`;
}

function getCorsOrigin(req) {
  const origin = req.headers.origin || req.headers.referer || '';
  if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return origin;
  return ALLOWED_ORIGINS[0];
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

// Welcome email HTML template
function welcomeEmailHtml(name, unsubUrl) {
  const greeting = name ? `Hey ${name},` : 'Hey,';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#FFF8E1;font-family:Georgia,serif;">
<div style="max-width:580px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <span style="font-size:48px;">🌮</span>
    <h1 style="font-family:'Helvetica Neue',Arial,sans-serif;color:#D84315;margin:8px 0 0;">Beto's Table</h1>
    <p style="color:#8D6E63;font-style:italic;margin:4px 0 0;">Every taco has a story. Pull up a chair.</p>
  </div>
  <div style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <p style="font-size:18px;line-height:1.7;color:#2D2D2D;">${greeting}</p>
    <p style="font-size:18px;line-height:1.7;color:#2D2D2D;">Welcome to the table.</p>
    <p style="font-size:18px;line-height:1.7;color:#2D2D2D;">I'm Beto Garza, and every week I write about one Houston taqueria — the history, the people, the food. Not reviews. Stories.</p>
    <p style="font-size:18px;line-height:1.7;color:#2D2D2D;">If you love tacos and you love Houston, you're in the right place.</p>
    <p style="font-size:18px;line-height:1.7;color:#2D2D2D;">Your first issue will land in your inbox next Taco Tuesday. In the meantime, catch up on recent features:</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="https://chorizomejor.com/#/stories" style="display:inline-block;background:#D84315;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:16px;">Read Beto's Table →</a>
    </div>
    <p style="font-size:18px;line-height:1.7;color:#2D2D2D;">Every taco has a story. Pull up a chair.</p>
    <p style="font-size:18px;line-height:1.7;color:#2D2D2D;margin-bottom:0;">— Beto Garza<br><span style="color:#8D6E63;">Chorizo Mejor</span></p>
  </div>
  <div style="text-align:center;margin-top:32px;font-size:13px;color:#999;">
    <p>You're receiving this because you subscribed to Beto's Table on chorizomejor.com.</p>
    <p><a href="${unsubUrl}" style="color:#999;">Unsubscribe</a></p>
  </div>
</div>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, name } = req.body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = (name || '').trim();

    // 1. Write to Firestore
    const firestore = await getFirestore();
    const subsRef = firestore.collection('newsletter_subscribers');

    // Check if already subscribed
    const existing = await subsRef.where('email', '==', cleanEmail).limit(1).get();
    if (!existing.empty) {
      return res.status(200).json({ success: true, message: 'Already subscribed!' });
    }

    await subsRef.add({
      email: cleanEmail,
      name: cleanName || null,
      subscribedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      active: true
    });

    // 2. Send welcome email via SendGrid
    const sgKey = process.env.SENDGRID_API_KEY;
    const unsubSecret = process.env.CMEJOR_UNSUB_SECRET || 'cmejor-unsub-2026';
    const unsubUrl = getUnsubUrl(cleanEmail, unsubSecret);

    if (sgKey) {
      const sgResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sgKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: cleanEmail, name: cleanName || undefined }] }],
          from: { email: 'beto@chorizomejor.com', name: 'Beto Garza | Chorizo Mejor' },
          subject: 'Welcome to Beto\'s Table',
          content: [{ type: 'text/html', value: welcomeEmailHtml(cleanName, unsubUrl) }]
        })
      });

      if (!sgResponse.ok) {
        console.error('SendGrid error:', sgResponse.status, await sgResponse.text());
        // Don't fail the subscribe — they're still in Firestore
      }
    }

    return res.status(200).json({ success: true, message: 'Welcome to Beto\'s Table!' });
  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};
