/**
 * /api/inbound.js — Vercel Serverless Function
 *
 * Receives inbound emails via SendGrid Inbound Parse webhook.
 * When someone replies to beto@chorizomejor.com, SendGrid POSTs
 * the email data here. We match the sender to an outreach record
 * in Firestore and update the pipeline status.
 *
 * SendGrid Inbound Parse sends multipart/form-data with fields:
 *   - from: sender email + name
 *   - to: recipient (beto@chorizomejor.com)
 *   - subject: email subject
 *   - text: plain text body
 *   - html: HTML body
 *   - envelope: JSON string with sender/recipient info
 *   - attachments: number of attachments
 *   - attachment-info: JSON with attachment metadata
 *
 * Flow:
 * 1. Parse the sender email from the webhook payload
 * 2. Look up the sender in Firestore outreach collection
 * 3. If found, update status based on current state
 * 4. Store the reply content in the outreach document
 * 5. Notify Ivan via email that a shop responded
 *
 * No env vars beyond FIREBASE_SERVICE_ACCOUNT needed.
 * SendGrid Inbound Parse doesn't require auth — it just POSTs to the URL.
 * We validate that the request looks like a real SendGrid webhook.
 */

// Disable Vercel body parser — SendGrid sends multipart/form-data
// We need the raw body to parse it ourselves
const { formidable } = require('formidable');

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

/**
 * Extract email address from a "Name <email>" string
 */
function extractEmail(fromStr) {
  if (!fromStr) return null;
  const match = fromStr.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  // If no angle brackets, assume it's just an email
  if (fromStr.includes('@')) return fromStr.toLowerCase().trim();
  return null;
}

/**
 * Extract display name from a "Name <email>" string
 */
function extractName(fromStr) {
  if (!fromStr) return null;
  const match = fromStr.match(/^([^<]+)</);
  if (match) return match[1].trim().replace(/^"|"$/g, '');
  return null;
}

/**
 * Classify a reply to give the automation hints about how to respond.
 * This is a lightweight heuristic — the automation does the real thinking.
 */
function classifyReply(textBody, senderEmail, contactEmail) {
  const text = (textBody || '').toLowerCase();
  const hints = {};

  // Language detection (basic Spanish check)
  const spanishWords = ['hola', 'gracias', 'buenas', 'buenos', 'quiero', 'nosotros', 'estamos', 'puede', 'favor', 'interesado', 'tienda', 'correo', 'también'];
  const spanishCount = spanishWords.filter(w => text.includes(w)).length;
  if (spanishCount >= 2) {
    hints.language = 'es';
  } else {
    hints.language = 'en';
  }

  // Is this a different person than who we emailed?
  hints.isNewSender = senderEmail !== (contactEmail || '').toLowerCase();

  // Owner self-identification — MUST be checked before gatekeeper to cancel false positives
  const ownerSelfIdPhrases = ['i\'m the owner', 'i am the owner', 'i own', 'this is the owner', 'i\'m the one who owns', 'i own the', 'i\'m the proprietor', 'my restaurant', 'my shop', 'my taqueria', 'my place', 'it\'s my place', 'it\'s my shop', 'it\'s my restaurant', 'soy el dueño', 'soy la dueña', 'soy el propietario', 'soy dueño'];
  hints.ownerSelfId = ownerSelfIdPhrases.some(p => text.includes(p));

  // Gatekeeper signals — cancelled if ownerSelfId is true
  const gatekeeperPhrases = ['let me check', 'i\'ll ask', 'talk to the owner', 'pass this along', 'forward this', 'i\'ll let them know', 'send this to', 'i will share', 'let me forward', 'my boss', 'connect you with', 'i\'m not the owner', 'i work here but', 'let me ask the', 'i\'ll pass it', 'check with my', 'run it by'];
  // NOTE: "the owner" was removed as a standalone phrase — it triggered false positives
  // when someone said "I'm the owner". Gatekeeper detection now relies on more specific
  // phrases like "talk to the owner", "i'm not the owner", etc.
  hints.gatekeeperSignal = !hints.ownerSelfId && gatekeeperPhrases.some(p => text.includes(p));

  // Redirect signals (someone else should be contacted)
  const redirectPhrases = ['you should contact', 'reach out to', 'email them at', 'the owner is', 'talk to', 'better to email', 'try reaching', 'person to talk to', 'their email is', 'you can reach them', 'here\'s their', 'contact them at', 'his email', 'her email', 'their number'];
  hints.redirectSignal = redirectPhrases.some(p => text.includes(p));

  // Auto-extract redirected email addresses from the reply body
  // When a gatekeeper or redirect says "the owner is Carlos at owner@shop.com"
  hints.extractedEmails = [];
  if (hints.redirectSignal || hints.gatekeeperSignal) {
    // Match email addresses in the body that aren't the sender or beto
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const foundEmails = (textBody || '').match(emailRegex) || [];
    hints.extractedEmails = foundEmails
      .map(e => e.toLowerCase().trim())
      .filter(e => e !== senderEmail && e !== 'beto@chorizomejor.com' && e !== (contactEmail || '').toLowerCase());
  }

  // Skeptic signals
  const skepticPhrases = ['how much', 'what\'s the cost', 'is this free', 'what\'s the catch', 'no thanks', 'not interested', 'sounds like', 'is this legit', 'scam', 'spam', 'too good', 'is there a cost', 'is there a fee', 'what do i need to pay', 'is this a promotion', 'is this an ad', 'what do you get out of', 'why is it free', 'what\'s in it for you', 'is this marketing'];
  hints.skepticSignal = skepticPhrases.some(p => text.includes(p));

  // Positive signals
  const positivePhrases = ['sounds great', 'i\'d love', 'we\'d love', 'interested', 'yes', 'sure', 'absolutely', 'let\'s do it', 'count me in', 'love to', 'sounds good', 'send me', 'go ahead', 'sounds interesting', 'tell me more', 'i\'m down', 'yeah', 'cool', 'sweet', 'let\'s go', 'sign me up', 'we\'re in', 'down for it', 'i\'m interested', 'we\'re interested', 'send them over', 'send it over', 'go for it'];
  hints.positiveSignal = positivePhrases.some(p => text.includes(p));

  // Decline signals
  const declinePhrases = ['not interested', 'no thank', 'pass on this', 'don\'t want', 'no thanks', 'unsubscribe', 'stop emailing', 'remove me', 'not for us', 'we\'ll pass', 'leave us alone', 'don\'t contact', 'not right now', 'maybe later', 'bad time'];
  hints.declineSignal = declinePhrases.some(p => text.includes(p));

  return hints;
}

/**
 * Determine the next pipeline status based on current status
 */
function getNextStatus(currentStatus) {
  switch (currentStatus) {
    // Phase 1: Initial outreach — they replied!
    case 'contacted':
    case 'follow_up_1':
    case 'follow_up_2':
      return 'responded';
    // Phase 2: Starter questions — they answered the basics
    case 'starter_questions_sent':
      return 'starter_answered';
    // Phase 3: Deep dive — they answered the follow-ups
    case 'deep_dive_sent':
      return 'deep_dive_answered';
    // Phase 4: Media request — they sent photos
    case 'media_requested':
      return 'media_received';
    // Phase 5: Draft review — they replied (approval or changes)
    case 'draft_sent':
      return 'approved';
    // Already in a "received" state — just store the new message
    case 'responded':
    case 'starter_answered':
    case 'deep_dive_answered':
    case 'media_received':
    case 'approved':
      return currentStatus;
    // Legacy statuses (backward compat)
    case 'questions_sent':
      return 'starter_answered';
    case 'info_received':
      return 'deep_dive_answered';
    default:
      return currentStatus;
  }
}

module.exports = async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data from SendGrid
    const form = formidable({ multiples: true, maxFileSize: 25 * 1024 * 1024 });

    const [fields] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    // Extract key fields — formidable v3 wraps values in arrays
    const fromRaw = Array.isArray(fields.from) ? fields.from[0] : fields.from;
    const toRaw = Array.isArray(fields.to) ? fields.to[0] : fields.to;
    const subject = Array.isArray(fields.subject) ? fields.subject[0] : fields.subject;
    const textBody = Array.isArray(fields.text) ? fields.text[0] : fields.text;
    const htmlBody = Array.isArray(fields.html) ? fields.html[0] : fields.html;
    const numAttachments = parseInt(
      Array.isArray(fields.attachments) ? fields.attachments[0] : fields.attachments || '0'
    );

    // Extract email headers for threading — SendGrid sends a raw headers string
    const headersRaw = Array.isArray(fields.headers) ? fields.headers[0] : fields.headers;
    let inboundMessageId = null;
    let inboundReferences = null;
    if (headersRaw) {
      const midMatch = headersRaw.match(/^Message-ID:\s*(.+)$/mi);
      if (midMatch) inboundMessageId = midMatch[1].trim();
      const refMatch = headersRaw.match(/^References:\s*(.+)$/mi);
      if (refMatch) inboundReferences = refMatch[1].trim();
    }

    const senderEmail = extractEmail(fromRaw);
    const senderName = extractName(fromRaw);

    if (!senderEmail) {
      console.log('Inbound: No sender email found, ignoring');
      return res.status(200).json({ ok: true, action: 'ignored', reason: 'no sender' });
    }

    // Ignore emails from ourselves (avoid loops)
    if (senderEmail === 'beto@chorizomejor.com') {
      console.log('Inbound: Ignoring email from ourselves');
      return res.status(200).json({ ok: true, action: 'ignored', reason: 'self' });
    }

    console.log(`Inbound email from: ${senderEmail} (${senderName || 'unknown'})`);
    console.log(`Subject: ${subject}`);
    console.log(`Attachments: ${numAttachments}`);

    // Look up sender in outreach collection
    const firestore = await getFirestore();
    const outreachRef = firestore.collection('outreach');

    // MATCHING STRATEGY (ordered by confidence):
    // 1. Thread match — References header contains one of our Message-IDs (highest confidence)
    // 2. Email match — sender matches contactEmail or any email in contacts array
    //    If multiple records match, pick the most recently contacted one
    // 3. Subject match — subject line contains a shop name from outreach records
    //    (handles CCs, forwards, owner replying from a different email)

    let matchedDoc = null;
    let matchMethod = null;

    // --- Strategy 1: Thread match via References header ---
    if (!matchedDoc && inboundReferences) {
      console.log(`Inbound: Trying thread match via References header...`);
      const allOutreach = await outreachRef.get();
      for (const doc of allOutreach.docs) {
        const data = doc.data();
        // Check if any of our sent Message-IDs appear in the References header
        const threadId = data.threadMessageId || '';
        const lastSentId = data.lastSentMessageId || '';
        if (threadId && inboundReferences.includes(threadId)) {
          matchedDoc = doc;
          matchMethod = 'thread-references';
          console.log(`Inbound: Thread match! References contains threadMessageId for ${data.shopName}`);
          break;
        }
        if (lastSentId && inboundReferences.includes(lastSentId)) {
          matchedDoc = doc;
          matchMethod = 'thread-lastSent';
          console.log(`Inbound: Thread match! References contains lastSentMessageId for ${data.shopName}`);
          break;
        }
      }
    }

    // --- Strategy 2: Email match (contactEmail or contacts array) ---
    if (!matchedDoc) {
      // Query all records matching this sender email as contactEmail
      const emailSnapshot = await outreachRef
        .where('contactEmail', '==', senderEmail)
        .get();

      if (!emailSnapshot.empty) {
        if (emailSnapshot.docs.length === 1) {
          // Single match — easy case
          matchedDoc = emailSnapshot.docs[0];
          matchMethod = 'email-contactEmail';
        } else {
          // Multiple records share this contactEmail — disambiguate
          console.log(`Inbound: ${emailSnapshot.docs.length} records match ${senderEmail}, disambiguating...`);

          // First, try subject line to narrow it down
          if (subject) {
            const subjectLower = (subject || '').toLowerCase();
            for (const doc of emailSnapshot.docs) {
              const shopName = (doc.data().shopName || '').toLowerCase();
              if (shopName && shopName.length > 3 && subjectLower.includes(shopName)) {
                matchedDoc = doc;
                matchMethod = 'email+subject';
                console.log(`Inbound: Disambiguated by subject — matched to ${doc.data().shopName}`);
                break;
              }
            }
          }

          // If subject didn't help, pick the most recently contacted record
          if (!matchedDoc) {
            let mostRecent = emailSnapshot.docs[0];
            let mostRecentTime = 0;
            for (const doc of emailSnapshot.docs) {
              const data = doc.data();
              const contactedAt = data.contactedAt ? data.contactedAt.toMillis() : 0;
              if (contactedAt > mostRecentTime) {
                mostRecentTime = contactedAt;
                mostRecent = doc;
              }
            }
            matchedDoc = mostRecent;
            matchMethod = 'email-mostRecent';
            console.log(`Inbound: Disambiguated by recency — matched to ${mostRecent.data().shopName}`);
          }
        }
      }

      // Also check if sender appears in any record's contacts array (multi-contact shops)
      if (!matchedDoc) {
        const allOutreach = await outreachRef.get();
        for (const doc of allOutreach.docs) {
          const data = doc.data();
          const contacts = data.contacts || [];
          if (contacts.some(c => (c.email || '').toLowerCase() === senderEmail)) {
            matchedDoc = doc;
            matchMethod = 'email-contacts-array';
            console.log(`Inbound: Matched via contacts array for ${data.shopName}`);
            break;
          }
        }
      }
    }

    // --- Strategy 3: Subject-line match (handles CCs, forwards, new sender) ---
    if (!matchedDoc && subject) {
      console.log(`Inbound: No email match for ${senderEmail}, trying subject-line match...`);
      const allOutreach = await outreachRef.get();
      for (const doc of allOutreach.docs) {
        const data = doc.data();
        const shopName = (data.shopName || '').toLowerCase();
        const subjectLower = (subject || '').toLowerCase();
        if (shopName && shopName.length > 3 && subjectLower.includes(shopName)) {
          matchedDoc = doc;
          matchMethod = 'subject-shopName';
          console.log(`Inbound: Subject-line match! "${subject}" matched to ${data.shopName}`);
          break;
        }
      }
    }

    // Build a snapshot-like result for the rest of the code
    const snapshot = matchedDoc
      ? { empty: false, docs: [matchedDoc] }
      : { empty: true, docs: [] };

    if (snapshot.empty) {
      // Unknown sender — could be spam, a subscriber question, etc.
      // Store it as an unmatched inbound for Ivan to review
      await firestore.collection('inbound_emails').add({
        from: senderEmail,
        fromName: senderName || null,
        subject: subject || '',
        textBody: (textBody || '').slice(0, 5000),  // Cap at 5K chars
        hasAttachments: numAttachments > 0,
        attachmentCount: numAttachments,
        matched: false,
        receivedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
      });

      console.log(`Inbound: No outreach match for ${senderEmail}, stored as unmatched`);

      // Still notify Ivan
      await notifyIvan(firestore, {
        type: 'unmatched',
        from: senderEmail,
        fromName: senderName,
        subject,
        preview: (textBody || '').slice(0, 200)
      });

      return res.status(200).json({ ok: true, action: 'stored_unmatched' });
    }

    // Found a match! Update the outreach record
    const outreachDoc = snapshot.docs[0];
    const outreachData = outreachDoc.data();
    const currentStatus = outreachData.status;
    const newStatus = getNextStatus(currentStatus);
    const shopName = outreachData.shopName || 'Unknown Shop';

    // Classify the reply to help the automation respond intelligently
    const replyHints = classifyReply(textBody, senderEmail, outreachData.contactEmail);

    // Build the reply record
    // Note: FieldValue.serverTimestamp() cannot be used inside arrays in Firestore,
    // so we use a regular Date for array entries. Top-level fields can use serverTimestamp().
    const reply = {
      from: senderEmail,
      fromName: senderName || null,
      subject: subject || '',
      textBody: (textBody || '').slice(0, 10000),  // Cap at 10K
      hasAttachments: numAttachments > 0,
      attachmentCount: numAttachments,
      hints: replyHints,
      messageId: inboundMessageId || null,  // For threading replies
      receivedAt: new Date().toISOString()
    };

    // Update the outreach document
    const updateData = {
      status: newStatus,
      lastReplyAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
    };

    // Store threading info at document level for easy access when replying
    if (inboundMessageId) {
      updateData.lastInboundMessageId = inboundMessageId;
    }

    // Append to replies array
    const existingReplies = outreachData.replies || [];
    updateData.replies = [...existingReplies, reply];

    // If they responded to initial outreach, note it
    if (currentStatus === 'contacted' || currentStatus.startsWith('follow_up')) {
      updateData.respondedAt = require('firebase-admin').firestore.FieldValue.serverTimestamp();
    }

    // Bug 3 fix: Auto-extract redirected emails and store as contacts
    if (replyHints.extractedEmails && replyHints.extractedEmails.length > 0) {
      const existingContacts = outreachData.contacts || [];
      const existingEmails = new Set(existingContacts.map(c => (c.email || '').toLowerCase()));
      // Also exclude the current contactEmail
      existingEmails.add((outreachData.contactEmail || '').toLowerCase());

      const newContacts = replyHints.extractedEmails
        .filter(e => !existingEmails.has(e))
        .map(e => ({
          email: e,
          name: null,  // We don't always know the name from the redirect text
          role: 'owner',  // Gatekeepers usually redirect to the owner
          source: 'auto-extracted-from-reply',
          priority: 1,  // Higher priority than the gatekeeper
          attempted: false,
          responseType: null
        }));

      if (newContacts.length > 0) {
        updateData.contacts = [...existingContacts, ...newContacts];
        console.log(`Inbound: Auto-extracted ${newContacts.length} new contact(s): ${newContacts.map(c => c.email).join(', ')}`);
      }
    }

    // Log match method for debugging
    if (matchMethod) {
      updateData.lastMatchMethod = matchMethod;
    }

    await outreachDoc.ref.update(updateData);

    console.log(`Inbound: Matched ${senderEmail} to ${shopName} via [${matchMethod}], ${currentStatus} → ${newStatus}`);

    // Notify Ivan
    await notifyIvan(firestore, {
      type: 'matched',
      shopName,
      from: senderEmail,
      fromName: senderName,
      subject,
      preview: (textBody || '').slice(0, 300),
      oldStatus: currentStatus,
      newStatus,
      hasAttachments: numAttachments > 0
    });

    return res.status(200).json({
      ok: true,
      action: 'updated',
      shop: shopName,
      oldStatus: currentStatus,
      newStatus
    });

  } catch (err) {
    console.error('Inbound error:', err);
    // Always return 200 to SendGrid so it doesn't retry endlessly
    return res.status(200).json({ ok: true, action: 'error', error: err.message });
  }
};

/**
 * Send Ivan a notification email when someone replies to Beto
 */
async function notifyIvan(firestore, info) {
  const sgKey = process.env.SENDGRID_API_KEY;
  if (!sgKey) return;

  let subject, body;

  if (info.type === 'matched') {
    subject = `🌮 ${info.shopName} replied to Beto!`;
    body = `
      <h2>${info.shopName} responded</h2>
      <p><strong>From:</strong> ${info.fromName || info.from} &lt;${info.from}&gt;</p>
      <p><strong>Subject:</strong> ${info.subject}</p>
      <p><strong>Pipeline:</strong> ${info.oldStatus} → ${info.newStatus}</p>
      ${info.hasAttachments ? '<p>📎 <strong>Has attachments</strong> (photos?)</p>' : ''}
      <hr>
      <p><strong>Preview:</strong></p>
      <blockquote style="border-left:3px solid #D84315;padding-left:12px;color:#555;">
        ${(info.preview || '').replace(/\n/g, '<br>')}
      </blockquote>
      <p style="color:#999;font-size:13px;">This was automatically matched to the outreach pipeline. The status has been updated in Firestore.</p>
    `;
  } else {
    subject = `📬 Unmatched email to beto@chorizomejor.com`;
    body = `
      <h2>Unknown sender emailed Beto</h2>
      <p><strong>From:</strong> ${info.fromName || info.from} &lt;${info.from}&gt;</p>
      <p><strong>Subject:</strong> ${info.subject}</p>
      <hr>
      <p><strong>Preview:</strong></p>
      <blockquote style="border-left:3px solid #999;padding-left:12px;color:#555;">
        ${(info.preview || '').replace(/\n/g, '<br>')}
      </blockquote>
      <p style="color:#999;font-size:13px;">This sender wasn't found in the outreach pipeline. Could be a subscriber question, spam, or a new contact. Stored in Firestore inbound_emails collection.</p>
    `;
  }

  try {
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sgKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: 'ivan.pinney@gmail.com' }] }],
        from: { email: 'beto@chorizomejor.com', name: 'Beto\'s Table Pipeline' },
        subject,
        content: [{ type: 'text/html', value: body }]
      })
    });
  } catch (err) {
    console.error('Failed to notify Ivan:', err);
  }
}

// Tell Vercel not to parse the body — we need raw multipart
module.exports.config = {
  api: {
    bodyParser: false
  }
};
