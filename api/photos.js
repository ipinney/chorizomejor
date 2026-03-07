/**
 * /api/photos.js — Vercel Serverless Function
 *
 * Fetches real food photos from Google Places API (New) for taco spots.
 * Returns photo URLs that can be used directly as <img> src.
 *
 * Query params:
 *   name  — business name (required)
 *   lat   — latitude (required)
 *   lng   — longitude (required)
 *   size  — photo max dimension in px (optional, default 400)
 *
 * Returns:
 *   { photos: [{ url, width, height, attribution }], placeName }
 */

const ALLOWED_ORIGINS = [
  'https://www.chorizomejor.com',
  'https://chorizomejor.com',
  'https://chorizomejor-app.vercel.app'
];

// In-memory cache
const cache = new Map();
const CACHE_TTL = 14 * 24 * 60 * 60 * 1000; // 14 days (photos don't change often)

function getCorsOrigin(req) {
  const origin = req.headers.origin || req.headers.referer || '';
  if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return origin;
  return ALLOWED_ORIGINS[0];
}

function sanitizeString(str, maxLength = 200) {
  if (typeof str !== 'string') return '';
  return str.replace(/[^\w\s\-'.&(),/]/g, '').slice(0, maxLength).trim();
}

function isValidCoord(val) {
  const num = parseFloat(val);
  return !isNaN(num) && num >= -180 && num <= 180;
}

export default async function handler(req, res) {
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-cache');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { name, lat, lng, size = '400' } = req.query;

  if (!name || !lat || !lng) {
    return res.status(400).json({ error: 'Missing required params: name, lat, lng' });
  }

  if (!isValidCoord(lat) || !isValidCoord(lng)) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  const sanitizedName = sanitizeString(name);
  if (!sanitizedName) {
    return res.status(400).json({ error: 'Invalid name' });
  }

  const maxSize = Math.min(Math.max(parseInt(size) || 400, 100), 800);

  // Check cache
  const cacheKey = `photo|${sanitizedName}|${lat}|${lng}|${maxSize}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 's-maxage=1209600, stale-while-revalidate=86400');
    return res.status(200).json(cached.data);
  }

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Step 1: Search for the place to get its resource name and photos
    const searchRes = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.photos'
        },
        body: JSON.stringify({
          textQuery: `${sanitizedName} Houston TX`,
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

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.error('Google Places search error:', searchRes.status, errText);
      return res.status(200).json({ photos: [], placeName: sanitizedName });
    }

    const searchData = await searchRes.json();
    if (!searchData.places || searchData.places.length === 0) {
      return res.status(200).json({ photos: [], placeName: sanitizedName });
    }

    const place = searchData.places[0];
    const placeName = place.displayName?.text || sanitizedName;

    if (!place.photos || place.photos.length === 0) {
      return res.status(200).json({ photos: [], placeName });
    }

    // Step 2: Build photo URLs (Google Places API New returns photo resource names)
    // We take up to 3 photos
    const photoResults = [];
    const photosToFetch = place.photos.slice(0, 3);

    for (const photo of photosToFetch) {
      const photoName = photo.name; // e.g., "places/ChIJ.../photos/AUacShg..."
      const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${maxSize}&maxWidthPx=${maxSize}&key=${googleKey}`;

      // The photo URL redirects to the actual image — fetch to get final URL
      try {
        const photoRes = await fetch(photoUrl, { redirect: 'follow' });
        if (photoRes.ok) {
          // The final URL after redirect is the actual photo
          photoResults.push({
            url: photoRes.url,
            width: photo.widthPx || maxSize,
            height: photo.heightPx || maxSize,
            attribution: photo.authorAttributions?.[0]?.displayName || 'Google'
          });
        }
      } catch (photoErr) {
        console.error('Photo fetch error:', photoErr.message);
      }
    }

    const result = { photos: photoResults, placeName };

    // Cache successful results
    if (photoResults.length > 0) {
      cache.set(cacheKey, { ts: Date.now(), data: result });
      res.setHeader('Cache-Control', 's-maxage=1209600, stale-while-revalidate=86400');
    }

    return res.status(200).json(result);
  } catch (e) {
    console.error('Photos API error:', e.message);
    return res.status(200).json({ photos: [], placeName: sanitizedName });
  }
}
