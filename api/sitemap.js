/**
 * /api/sitemap.js — Dynamic XML sitemap for Chorizo Mejor
 *
 * Generates a sitemap with:
 *   - Static pages (home, explore, leaderboard, stories, toty)
 *   - All published stories from Firestore
 *   - All places from Firestore
 *
 * Cached for 6 hours via CDN.
 */

const SITE_URL = 'https://www.chorizomejor.com';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/chorizomejor-app/databases/(default)/documents';

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toISODate(ts) {
  if (!ts) return new Date().toISOString().split('T')[0];
  // Firestore timestamp format
  if (ts.timestampValue) {
    return new Date(ts.timestampValue).toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

async function fetchPublishedStories() {
  const url = `${FIRESTORE_BASE}:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'stories' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'status' },
          op: 'EQUAL',
          value: { stringValue: 'published' }
        }
      },
      orderBy: [{ field: { fieldPath: 'publishedAt' }, direction: 'DESCENDING' }],
      limit: 500
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .filter(d => d.document)
      .map(d => {
        const f = d.document.fields;
        return {
          slug: (f.slug && f.slug.stringValue) || '',
          publishedAt: f.publishedAt ? toISODate(f.publishedAt) : null
        };
      })
      .filter(s => s.slug);
  } catch (e) {
    console.error('Sitemap: error fetching stories:', e);
    return [];
  }
}

async function fetchAllPlaces() {
  const places = [];
  let pageToken = null;

  // Paginate through all place documents
  for (let i = 0; i < 10; i++) { // max 10 pages = 3000 places
    let url = `${FIRESTORE_BASE}/places?pageSize=300`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.documents) {
        for (const doc of data.documents) {
          const f = doc.fields;
          const docPath = doc.name.split('/').pop();
          places.push({
            id: docPath,
            name: (f.name && f.name.stringValue) || '',
            updatedAt: f.updatedAt ? toISODate(f.updatedAt) : null
          });
        }
      }

      if (data.nextPageToken) {
        pageToken = data.nextPageToken;
      } else {
        break;
      }
    } catch (e) {
      console.error('Sitemap: error fetching places:', e);
      break;
    }
  }

  return places;
}

export default async function handler(req, res) {
  try {
    const [stories, places] = await Promise.all([
      fetchPublishedStories(),
      fetchAllPlaces()
    ]);

    const today = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Static pages -->
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/explore</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${SITE_URL}/leaderboard</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${SITE_URL}/stories</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${SITE_URL}/toty</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;

    // Story URLs
    for (const story of stories) {
      xml += `  <url>
    <loc>${SITE_URL}/story/${escapeXml(story.slug)}</loc>
    ${story.publishedAt ? `<lastmod>${story.publishedAt}</lastmod>` : ''}
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }

    // Place URLs
    for (const place of places) {
      xml += `  <url>
    <loc>${SITE_URL}/place/${escapeXml(place.id)}</loc>
    ${place.updatedAt ? `<lastmod>${place.updatedAt}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
`;
    }

    xml += '</urlset>';

    res
      .setHeader('Content-Type', 'application/xml')
      .setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400')
      .status(200)
      .send(xml);

  } catch (err) {
    console.error('Sitemap error:', err);
    res.status(500).send('Error generating sitemap');
  }
}
