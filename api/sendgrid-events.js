/**
 * SendGrid Event Webhook handler
 * Processes bounce, spam_report, and dropped events to protect sender reputation.
 * 
 * Setup: In SendGrid dashboard → Settings → Mail Settings → Event Webhook
 * URL: https://www.chorizomejor.com/api/sendgrid-events
 * Events to track: Bounced, Spam Report, Dropped
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA_KEY))
  });
}
const db = admin.firestore();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const events = req.body;
    
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'Expected array of events' });
    }

    let processed = 0;
    let bounces = 0;
    let spamReports = 0;

    for (const event of events) {
      const { email, event: eventType, reason, type: bounceType, timestamp } = event;
      
      if (!email) continue;

      // Only handle bounce-related events
      if (!['bounce', 'dropped', 'spamreport'].includes(eventType)) continue;

      processed++;

      // Find outreach records matching this email
      const snapshot = await db.collection('outreach')
        .where('contactEmail', '==', email)
        .get();

      // Also check contacts array
      let matchedDocs = [];
      if (!snapshot.empty) {
        matchedDocs = snapshot.docs;
      } else {
        // Search contacts array (can't query array fields directly, check recent outreach)
        const recentOutreach = await db.collection('outreach')
          .where('status', 'in', ['contacted', 'follow_up_1', 'follow_up_2'])
          .get();
        for (const doc of recentOutreach.docs) {
          const contacts = doc.data().contacts || [];
          if (contacts.some(c => c.email === email)) {
            matchedDocs.push(doc);
          }
        }
      }

      for (const doc of matchedDocs) {
        const updateData = {
          lastBounceAt: admin.firestore.FieldValue.serverTimestamp(),
          bounceEvent: {
            type: eventType,
            bounceType: bounceType || null,
            reason: reason || null,
            timestamp: timestamp ? new Date(timestamp * 1000).toISOString() : null,
            email: email
          }
        };

        if (eventType === 'bounce') {
          bounces++;
          if (bounceType === 'hard' || !bounceType) {
            // Hard bounce — permanently mark as bounced
            updateData.status = 'bounced';
            updateData.permanentlyExcluded = true;
            updateData.excludeReason = 'hard_bounce';
            updateData.excludedAt = admin.firestore.FieldValue.serverTimestamp();
            
            // Also exclude the place
            const placeId = doc.data().placeId;
            if (placeId) {
              await db.collection('places').doc(placeId).update({
                outreachExcluded: true,
                excludeReason: 'email_bounced'
              }).catch(() => {}); // Don't fail if place doesn't exist
            }
          } else {
            // Soft bounce — flag but don't permanently exclude yet
            updateData.softBounceCount = admin.firestore.FieldValue.increment(1);
          }
        } else if (eventType === 'spamreport') {
          spamReports++;
          // Spam report — IMMEDIATELY exclude, this is critical for reputation
          updateData.status = 'spam_reported';
          updateData.permanentlyExcluded = true;
          updateData.excludeReason = 'spam_report';
          updateData.excludedAt = admin.firestore.FieldValue.serverTimestamp();
          
          const placeId = doc.data().placeId;
          if (placeId) {
            await db.collection('places').doc(placeId).update({
              outreachExcluded: true,
              excludeReason: 'spam_report'
            }).catch(() => {});
          }
        } else if (eventType === 'dropped') {
          // Dropped — usually means previously bounced, treat as hard bounce
          updateData.status = 'bounced';
          updateData.permanentlyExcluded = true;
          updateData.excludeReason = 'dropped';
          updateData.excludedAt = admin.firestore.FieldValue.serverTimestamp();
        }

        await doc.ref.update(updateData);
      }

      // Also log to a dedicated bounce_events collection for tracking
      await db.collection('bounce_events').add({
        email,
        eventType,
        bounceType: bounceType || null,
        reason: reason || null,
        matchedOutreachIds: matchedDocs.map(d => d.id),
        timestamp: timestamp ? new Date(timestamp * 1000).toISOString() : null,
        receivedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Notify Ivan if any bounces or spam reports
    if (bounces > 0 || spamReports > 0) {
      const sgKey = process.env.SENDGRID_API_KEY;
      if (sgKey) {
        // Lightweight notification — don't import full sendgrid lib
        const https = require('https');
        const notifyData = JSON.stringify({
          personalizations: [{ to: [{ email: 'ivan@barrioenergy.com' }] }],
          from: { email: 'beto@chorizomejor.com', name: 'Chorizo Mejor System' },
          subject: `⚠️ Email Event: ${bounces} bounce(s), ${spamReports} spam report(s)`,
          content: [{ type: 'text/plain', value: `SendGrid events processed: ${processed} total, ${bounces} bounces, ${spamReports} spam reports. Check Firestore bounce_events collection for details.` }]
        });
        const options = {
          hostname: 'api.sendgrid.com',
          path: '/v3/mail/send',
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sgKey}`, 'Content-Type': 'application/json' }
        };
        const notifyReq = https.request(options);
        notifyReq.write(notifyData);
        notifyReq.end();
      }
    }

    return res.status(200).json({ 
      ok: true, 
      processed, 
      bounces, 
      spamReports 
    });

  } catch (err) {
    console.error('SendGrid event webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
};
