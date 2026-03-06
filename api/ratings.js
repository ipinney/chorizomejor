/**
 * /api/ratings.js — Vercel Serverless Function
 *
 * Fetches live rating from Google Places API (New) via Text Search.
 * Returns cached results for 7 days via Vercel Edge Cache + in-memory.
 *
 * Query params:
 *   name  — business name (required)
 *   lat   — latitude (required)
 *   lng   — longitude (required)
 *
 * Returns:
 *   { google: { rating, reviewCount, url } }
 */

// In-memory cache (survives across warm invocations on same instance)
const cache = new Map();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  // Default: no CDN cache (will be upgraded on success)
  res.setHeader('Cache-Control', 'no-cache');

  const { name, lat, lng } = req.query;

  if (!name || !lat || !lng) {
    return res.status(400).json({ error: 'Missing required params: name, lat, lng' });
  }

  // Check in-memory cache
  const cacheKey = `${name}|${lat}|${lng}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  const result = { google: null };

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleKey) {
    return res.status(500).json({ error: 'Google Places API key not configured' });
  }

  try {
    const googleRes = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleKey,
          'X-Goog-FieldMask': 'places.rating,places.userRatingCount,places.googleMapsUri,places.displayName'
        },
        body: JSON.stringify({
          textQuery: `${name} Houston TX`,
          locationBias: {
            circle: {
              center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
              radius: 1000.0
            }
          },
          maxResultCount: 1
        })
      }
    );

    if (googleRes.ok) {
      const googleData = await googleRes.json();
      if (googleData.places && googleData.places.length > 0) {
        const place = googleData.places[0];
        result.google = {
          rating: place.rating,
          reviewCount: place.userRatingCount,
          url: place.googleMapsUri
        };
      }
    } else {
      const errText = await googleRes.text();
      console.error('Google Places API error:', googleRes.status, errText);
    }
  } catch (e) {
    console.error('Google Places API fetch error:', e.message);
  }

  // Only cache successful results (not errors)
  if (result.google) {
    cache.set(cacheKey, { ts: Date.now(), data: result });
    // Edge / CDN cache for 7 days, serve stale for 1 day while revalidating
    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=86400');
  }

  return res.status(200).json(result);
}
