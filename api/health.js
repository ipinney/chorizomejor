/**
 * /api/health.js — Firestore health check for Chorizo Mejor
 *
 * Quick probe that verifies Firestore reads are working.
 * Returns 200 if healthy, 503 if Firestore permissions are broken.
 *
 * Usage: curl https://www.chorizomejor.com/api/health
 *
 * Can be wired to Vercel Cron, UptimeRobot, or any monitoring service
 * to alert immediately when Firestore rules get broken.
 */

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/chorizomejor-app/databases/(default)/documents';

export default async function handler(req, res) {
  const start = Date.now();
  const checks = {};

  try {
    // Test: read a single place document (should always work — allow read: if true)
    const placesRes = await fetch(`${FIRESTORE_BASE}/places?pageSize=1`);
    const placesData = await placesRes.json();
    checks.places = placesRes.ok && placesData.documents ? 'ok' : 'FAIL';

    // Test: read a single review document
    const reviewsRes = await fetch(`${FIRESTORE_BASE}/reviews?pageSize=1`);
    const reviewsData = await reviewsRes.json();
    checks.reviews = reviewsRes.ok && reviewsData.documents ? 'ok' : 'FAIL';

    const allHealthy = Object.values(checks).every(v => v === 'ok');
    const elapsed = Date.now() - start;

    const result = {
      status: allHealthy ? 'healthy' : 'UNHEALTHY',
      checks,
      elapsed_ms: elapsed,
      timestamp: new Date().toISOString()
    };

    if (!allHealthy) {
      console.error('HEALTH CHECK FAILED:', JSON.stringify(result));
    }

    return res
      .setHeader('Cache-Control', 'no-cache, no-store')
      .status(allHealthy ? 200 : 503)
      .json(result);

  } catch (err) {
    console.error('Health check error:', err);
    return res
      .setHeader('Cache-Control', 'no-cache, no-store')
      .status(503)
      .json({
        status: 'ERROR',
        error: err.message,
        elapsed_ms: Date.now() - start,
        timestamp: new Date().toISOString()
      });
  }
}
