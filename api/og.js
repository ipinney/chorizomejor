/**
 * /api/og.js — Dynamic Open Graph meta tags for social sharing
 *
 * When a social crawler (Twitterbot, Facebook, Slack, etc.) hits a story URL,
 * this returns an HTML page with proper og:title, og:description, og:image tags.
 * Regular browsers get redirected to the SPA.
 *
 * Query params:
 *   slug — story slug (required)
 *   type — "story" (default) or "place"
 *   id   — place ID (for type=place)
 */

const SITE_URL = 'https://www.chorizomejor.com';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/chorizomejor-app/databases/(default)/documents';
const DEFAULT_OG_IMAGE = `${SITE_URL}/icons/og-image.png?v=2`;
const BETO_IMAGE = `${SITE_URL}/images/beto-garza.jpg`;

// Known social media / link preview crawlers
const CRAWLER_UAS = [
  'twitterbot', 'facebookexternalhit', 'linkedinbot', 'slackbot',
  'discordbot', 'whatsapp', 'telegrambot', 'googlebot',
  'bingbot', 'applebot', 'pinterest', 'tumblr', 'redditbot',
  'embedly', 'quora link preview', 'outbrain', 'rogerbot',
  'showyoubot', 'vkshare', 'w3c_validator', 'iframely'
];

function isCrawler(ua) {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return CRAWLER_UAS.some(bot => lower.includes(bot));
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Extract string value from Firestore REST response field
function fsVal(field) {
  if (!field) return '';
  return field.stringValue || '';
}

async function fetchStoryBySlug(slug) {
  // Firestore REST API structured query
  const url = `${FIRESTORE_BASE}:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'stories' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'slug' }, op: 'EQUAL', value: { stringValue: slug } } },
            { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'published' } } }
          ]
        }
      },
      limit: 1
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (!data || !data[0] || !data[0].document) return null;

  const fields = data[0].document.fields;
  return {
    title: fsVal(fields.title),
    excerpt: fsVal(fields.excerpt),
    author: fsVal(fields.author) || 'Beto Garza',
    column: fsVal(fields.column) || "Beto's Table",
    imageURL: fsVal(fields.imageURL) || null
  };
}

async function fetchPlace(placeId) {
  const url = `${FIRESTORE_BASE}/places/${placeId}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  if (!data || !data.fields) return null;

  const fields = data.fields;
  return {
    name: fsVal(fields.name),
    address: fsVal(fields.address),
    neighborhood: fsVal(fields.neighborhood),
    imageURL: fsVal(fields.imageURL) || null
  };
}

function buildOgHtml({ title, description, image, url, type = 'article', author }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>

  <!-- Open Graph -->
  <meta property="og:type" content="${type}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:site_name" content="Chorizo Mejor" />
  ${author ? `<meta property="article:author" content="${escapeHtml(author)}" />` : ''}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(title)}" />

  <!-- Redirect non-crawlers to the SPA -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(url)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(url)}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;
}

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';
  const { slug, type, id } = req.query;

  // If not a crawler, redirect immediately to the SPA
  if (!isCrawler(ua)) {
    if (type === 'place' && id) {
      return res.redirect(302, `${SITE_URL}/#/place/${id}`);
    }
    if (slug) {
      return res.redirect(302, `${SITE_URL}/#/story/${slug}`);
    }
    return res.redirect(302, SITE_URL);
  }

  try {
    // Handle story URLs
    if (slug) {
      const story = await fetchStoryBySlug(slug);

      if (!story) {
        // Story not found — return generic OG tags
        const html = buildOgHtml({
          title: 'Chorizo Mejor - Houston\'s Best Breakfast Tacos',
          description: 'Rate, review, and discover the best breakfast tacos in Houston.',
          image: DEFAULT_OG_IMAGE,
          url: SITE_URL
        });
        return res.setHeader('Content-Type', 'text/html').status(200).send(html);
      }

      const ogImage = story.imageURL || BETO_IMAGE;
      const html = buildOgHtml({
        title: `${story.title} | ${story.column}`,
        description: story.excerpt || `A new ${story.column} article by ${story.author} on Chorizo Mejor.`,
        image: ogImage,
        url: `${SITE_URL}/#/story/${slug}`,
        author: story.author
      });

      return res
        .setHeader('Content-Type', 'text/html')
        .setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
        .status(200)
        .send(html);
    }

    // Handle place URLs
    if (type === 'place' && id) {
      const place = await fetchPlace(id);

      if (!place) {
        const html = buildOgHtml({
          title: 'Chorizo Mejor - Houston\'s Best Breakfast Tacos',
          description: 'Rate, review, and discover the best breakfast tacos in Houston.',
          image: DEFAULT_OG_IMAGE,
          url: SITE_URL
        });
        return res.setHeader('Content-Type', 'text/html').status(200).send(html);
      }

      const html = buildOgHtml({
        title: `${place.name} | Chorizo Mejor`,
        description: `${place.name} — ${place.address}. Rate and review breakfast tacos on Chorizo Mejor.`,
        image: place.imageURL || DEFAULT_OG_IMAGE,
        url: `${SITE_URL}/#/place/${id}`,
        type: 'restaurant'
      });

      return res
        .setHeader('Content-Type', 'text/html')
        .setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
        .status(200)
        .send(html);
    }

    // Fallback
    const html = buildOgHtml({
      title: 'Chorizo Mejor - Houston\'s Best Breakfast Tacos',
      description: 'Rate, review, and discover the best breakfast tacos in Houston.',
      image: DEFAULT_OG_IMAGE,
      url: SITE_URL
    });
    return res.setHeader('Content-Type', 'text/html').status(200).send(html);

  } catch (err) {
    console.error('OG handler error:', err);
    return res.redirect(302, SITE_URL);
  }
}
