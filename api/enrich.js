/**
 * /api/enrich.js — Vercel Serverless Function
 *
 * Fetches rich place data from Google Places API (New) via Text Search.
 * Returns: photos, hours, phone, price level, editorial summary, website.
 *
 * Query params:
 *   name  — business name (required)
 *   lat   — latitude (required)
 *   lng   — longitude (required)
 *
 * Returns:
 *   { photos: [...], hours: {...}, phone, priceLevel, description, website, googleMapsURL }
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { name, lat, lng } = req.query;

  if (!name || !lat || !lng) {
    return res.status(400).json({ error: 'Missing required params: name, lat, lng' });
  }

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
          'X-Goog-FieldMask': [
            'places.displayName',
            'places.photos',
            'places.regularOpeningHours',
            'places.priceLevel',
            'places.editorialSummary',
            'places.nationalPhoneNumber',
            'places.websiteUri',
            'places.googleMapsUri',
            'places.rating',
            'places.userRatingCount'
          ].join(',')
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

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      console.error('Google Places API error:', googleRes.status, errText);
      return res.status(502).json({ error: 'Google Places API error', status: googleRes.status });
    }

    const data = await googleRes.json();

    if (!data.places || data.places.length === 0) {
      return res.status(200).json({ found: false });
    }

    const place = data.places[0];

    // Extract photo references (up to 5)
    const photos = (place.photos || []).slice(0, 5).map(p => ({
      name: p.name, // e.g. "places/ChIJ.../photos/AUc7tXX..."
      widthPx: p.widthPx,
      heightPx: p.heightPx
    }));

    // Extract hours
    let hours = null;
    if (place.regularOpeningHours) {
      hours = {
        weekdayDescriptions: place.regularOpeningHours.weekdayDescriptions || [],
        openNow: place.regularOpeningHours.openNow
      };
    }

    const result = {
      found: true,
      displayName: place.displayName?.text || null,
      photos,
      hours,
      phone: place.nationalPhoneNumber || null,
      priceLevel: place.priceLevel || null,
      description: place.editorialSummary?.text || null,
      website: place.websiteUri || null,
      googleMapsURL: place.googleMapsUri || null,
      rating: place.rating || null,
      reviewCount: place.userRatingCount || null
    };

    // Cache successful enrichment for 30 days
    res.setHeader('Cache-Control', 's-maxage=2592000, stale-while-revalidate=86400');
    return res.status(200).json(result);
  } catch (e) {
    console.error('Enrich fetch error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
