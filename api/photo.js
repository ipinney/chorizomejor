/**
 * /api/photo.js — Vercel Serverless Function
 *
 * Proxies Google Places photo requests so the API key stays server-side.
 *
 * Query params:
 *   ref     — photo resource name (e.g. "places/ChIJ.../photos/AUc7tXX...")
 *   maxW    — max width in pixels (default 400)
 *   maxH    — max height in pixels (default 400)
 *
 * Returns: redirects to the photo URL (302) or streams the image
 */

// Simple in-memory URL cache to avoid redundant API calls
const urlCache = new Map();
const URL_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { ref, maxW, maxH } = req.query;

  if (!ref) {
    return res.status(400).json({ error: 'Missing required param: ref (photo resource name)' });
  }

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleKey) {
    return res.status(500).json({ error: 'Google Places API key not configured' });
  }

  const width = parseInt(maxW) || 400;
  const height = parseInt(maxH) || 400;

  // Build the photo media URL
  const photoUrl = `https://places.googleapis.com/v1/${ref}/media?maxHeightPx=${height}&maxWidthPx=${width}&key=${googleKey}`;

  try {
    // Fetch the photo (Google returns a redirect to the actual image)
    const photoRes = await fetch(photoUrl, { redirect: 'follow' });

    if (!photoRes.ok) {
      console.error('Photo API error:', photoRes.status);
      return res.status(502).json({ error: 'Photo fetch failed', status: photoRes.status });
    }

    // Stream the image back to the client
    const contentType = photoRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    // Cache photos aggressively — they don't change
    res.setHeader('Cache-Control', 'public, s-maxage=2592000, max-age=604800, stale-while-revalidate=86400');

    const buffer = await photoRes.arrayBuffer();
    return res.status(200).send(Buffer.from(buffer));
  } catch (e) {
    console.error('Photo proxy error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
