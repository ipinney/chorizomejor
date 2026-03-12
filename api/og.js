/**
 * /api/og.js — Dynamic SEO handler for Chorizo Mejor
 *
 * Serves rich HTML with OG tags + JSON-LD structured data to crawlers.
 * Redirects regular browsers to the SPA hash routes.
 *
 * Query params:
 *   slug — story slug
 *   type — "place" (with id param)
 *   id   — place ID
 *   page — static page name (explore, leaderboard, stories, toty)
 */

const SITE_URL = 'https://www.chorizomejor.com';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/chorizomejor-app/databases/(default)/documents';
const DEFAULT_OG_IMAGE = `${SITE_URL}/icons/og-image.png?v=2`;
const BETO_IMAGE = `${SITE_URL}/images/beto-garza.jpg`;

// Known social media / link preview / search engine crawlers
const CRAWLER_UAS = [
  'twitterbot', 'facebookexternalhit', 'linkedinbot', 'slackbot',
  'discordbot', 'whatsapp', 'telegrambot', 'googlebot',
  'bingbot', 'applebot', 'pinterest', 'tumblr', 'redditbot',
  'embedly', 'quora link preview', 'outbrain', 'rogerbot',
  'showyoubot', 'vkshare', 'w3c_validator', 'iframely',
  'yandex', 'baiduspider', 'duckduckbot', 'ia_archiver',
  'petalbot', 'semrushbot', 'ahrefsbot', 'mj12bot'
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

function fsVal(field) {
  if (!field) return '';
  return field.stringValue || '';
}

function fsNum(field) {
  if (!field) return 0;
  return Number(field.doubleValue || field.integerValue || 0);
}

async function fetchStoryBySlug(slug) {
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
    body: fsVal(fields.body),
    author: fsVal(fields.author) || 'Beto Garza',
    column: fsVal(fields.column) || "Beto's Table",
    imageURL: fsVal(fields.imageURL) || null,
    heroImage: fsVal(fields.heroImage) || null,
    placeId: fsVal(fields.placeId) || null,
    publishedAt: fields.publishedAt ? (fields.publishedAt.timestampValue || '') : ''
  };
}

async function fetchPlace(placeId) {
  const url = `${FIRESTORE_BASE}/places/${placeId}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  if (!data || !data.fields) return null;

  const f = data.fields;
  return {
    name: fsVal(f.name),
    address: fsVal(f.address),
    neighborhood: fsVal(f.neighborhood),
    imageURL: fsVal(f.imageURL) || null,
    googlePhotoURL: fsVal(f.googlePhotoURL) || null,
    avgOverall: fsNum(f.avgOverall),
    reviewCount: fsNum(f.reviewCount),
    avgTortilla: fsNum(f.avgTortilla),
    avgProtein: fsNum(f.avgProtein),
    avgSalsa: fsNum(f.avgSalsa),
    avgValue: fsNum(f.avgValue),
    lat: fsNum(f.lat),
    lng: fsNum(f.lng),
    phone: fsVal(f.phone),
    websiteURL: fsVal(f.websiteURL)
  };
}

function buildSeoHtml({ title, description, image, url, type = 'website', jsonLd, bodyContent = '', author }) {
  const jsonLdScript = jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(url)}" />

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
  <meta name="twitter:site" content="@chorizomejor" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(title)}" />

  ${jsonLdScript}

  <!-- Redirect non-crawlers to the SPA -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(url)}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${bodyContent}
  <p><a href="${escapeHtml(url)}">View on Chorizo Mejor</a></p>
</body>
</html>`;
}

// Static page SEO configs
const STATIC_PAGES = {
  explore: {
    title: 'Explore Houston Taco Spots | Chorizo Mejor',
    description: 'Browse 160+ breakfast taco spots across Houston neighborhoods. Filter by rating, neighborhood, and type. Find your next favorite taco.',
    hash: '#/explore'
  },
  leaderboard: {
    title: 'Best Breakfast Tacos in Houston — Leaderboard | Chorizo Mejor',
    description: 'See which Houston taco spots rank highest for overall quality, tortilla, protein, salsa, and value. Community-powered rankings updated daily.',
    hash: '#/leaderboard'
  },
  stories: {
    title: "Beto's Table — Houston Taco Stories | Chorizo Mejor",
    description: "Weekly longform stories about Houston's best taco spots and the people behind the counter. By Beto \"El Gordo\" Garza.",
    hash: '#/stories'
  },
  toty: {
    title: "2026 Taco of the Year — Houston's Best Taco Award | Chorizo Mejor",
    description: "Vote for Houston's 2026 Taco of the Year. Categories: Best Overall, Best Tortilla, Best Protein, Best Salsa, Best Value, Best Newcomer.",
    hash: '#/toty'
  }
};

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';
  const { slug, type, id, page } = req.query;

  // If not a crawler, redirect immediately to the SPA
  if (!isCrawler(ua)) {
    if (type === 'place' && id) return res.redirect(302, `${SITE_URL}/#/place/${id}`);
    if (slug) return res.redirect(302, `${SITE_URL}/#/story/${slug}`);
    if (page && STATIC_PAGES[page]) return res.redirect(302, `${SITE_URL}/${STATIC_PAGES[page].hash}`);
    return res.redirect(302, SITE_URL);
  }

  try {
    // Handle static pages
    if (page && STATIC_PAGES[page]) {
      const pg = STATIC_PAGES[page];
      const html = buildSeoHtml({
        title: pg.title,
        description: pg.description,
        image: DEFAULT_OG_IMAGE,
        url: `${SITE_URL}/${pg.hash}`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          'name': pg.title,
          'description': pg.description,
          'url': `${SITE_URL}/${pg.hash}`,
          'isPartOf': { '@type': 'WebSite', 'name': 'Chorizo Mejor', 'url': SITE_URL }
        }
      });
      return res
        .setHeader('Content-Type', 'text/html')
        .setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
        .status(200)
        .send(html);
    }

    // Handle story URLs
    if (slug) {
      const story = await fetchStoryBySlug(slug);

      if (!story) {
        const html = buildSeoHtml({
          title: 'Chorizo Mejor - Houston\'s Best Breakfast Tacos',
          description: 'Rate, review, and discover the best breakfast tacos in Houston.',
          image: DEFAULT_OG_IMAGE,
          url: SITE_URL
        });
        return res.setHeader('Content-Type', 'text/html').status(200).send(html);
      }

      let ogImage = story.imageURL || story.heroImage || null;
      if (!ogImage && story.placeId) {
        try {
          const place = await fetchPlace(story.placeId);
          if (place) ogImage = place.imageURL || place.googlePhotoURL || null;
        } catch (e) { /* fall through */ }
      }
      ogImage = ogImage || BETO_IMAGE;

      // Build rich body content for crawlers
      const excerptHtml = story.excerpt ? `<p>${escapeHtml(story.excerpt)}</p>` : '';
      const storyUrl = `${SITE_URL}/#/story/${slug}`;

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': story.title,
        'description': story.excerpt,
        'author': { '@type': 'Person', 'name': story.author },
        'publisher': { '@type': 'Organization', 'name': 'Chorizo Mejor', 'url': SITE_URL, 'logo': { '@type': 'ImageObject', 'url': DEFAULT_OG_IMAGE } },
        'url': storyUrl,
        'mainEntityOfPage': storyUrl,
        'image': ogImage
      };
      if (story.publishedAt) jsonLd.datePublished = story.publishedAt;

      const html = buildSeoHtml({
        title: `${story.title} | ${story.column}`,
        description: story.excerpt || `A new ${story.column} article by ${story.author} on Chorizo Mejor.`,
        image: ogImage,
        url: storyUrl,
        type: 'article',
        author: story.author,
        jsonLd,
        bodyContent: `<p>By ${escapeHtml(story.author)} — ${escapeHtml(story.column)}</p>${excerptHtml}`
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
        const html = buildSeoHtml({
          title: 'Chorizo Mejor - Houston\'s Best Breakfast Tacos',
          description: 'Rate, review, and discover the best breakfast tacos in Houston.',
          image: DEFAULT_OG_IMAGE,
          url: SITE_URL
        });
        return res.setHeader('Content-Type', 'text/html').status(200).send(html);
      }

      const ratingStr = place.avgOverall ? place.avgOverall.toFixed(1) : null;
      const desc = ratingStr
        ? `${place.name} — rated ${ratingStr}/5 on Chorizo Mejor. ${place.reviewCount} community reviews. ${place.address}`
        : `${place.name} — ${place.address}. Rate and review breakfast tacos on Chorizo Mejor.`;

      const placeUrl = `${SITE_URL}/#/place/${id}`;

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        'name': place.name,
        'address': {
          '@type': 'PostalAddress',
          'streetAddress': place.address,
          'addressLocality': 'Houston',
          'addressRegion': 'TX'
        },
        'servesCuisine': 'Mexican, Breakfast Tacos',
        'url': placeUrl
      };

      if (place.lat && place.lng) {
        jsonLd.geo = { '@type': 'GeoCoordinates', 'latitude': place.lat, 'longitude': place.lng };
      }
      if (ratingStr) {
        jsonLd.aggregateRating = {
          '@type': 'AggregateRating',
          'ratingValue': ratingStr,
          'bestRating': '5',
          'worstRating': '1',
          'ratingCount': String(place.reviewCount || 0)
        };
      }
      if (place.phone) jsonLd.telephone = place.phone;
      if (place.websiteURL) jsonLd.sameAs = place.websiteURL;

      const bodyContent = `
        <p>${escapeHtml(place.address)}</p>
        ${ratingStr ? `<p>Rating: ${ratingStr}/5 from ${place.reviewCount} reviews</p>` : ''}
        ${place.avgTortilla ? `<p>Tortilla: ${place.avgTortilla.toFixed(1)} | Protein: ${place.avgProtein.toFixed(1)} | Salsa: ${place.avgSalsa.toFixed(1)} | Value: ${place.avgValue.toFixed(1)}</p>` : ''}
      `;

      const html = buildSeoHtml({
        title: `${place.name} — Breakfast Taco Reviews | Chorizo Mejor`,
        description: desc,
        image: place.imageURL || place.googlePhotoURL || DEFAULT_OG_IMAGE,
        url: placeUrl,
        type: 'restaurant',
        jsonLd,
        bodyContent
      });

      return res
        .setHeader('Content-Type', 'text/html')
        .setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
        .status(200)
        .send(html);
    }

    // Fallback — homepage
    const html = buildSeoHtml({
      title: 'Chorizo Mejor - Houston\'s Best Breakfast Tacos',
      description: 'Rate, review, and discover the best breakfast tacos in Houston. Community-powered ratings for 160+ taco spots.',
      image: DEFAULT_OG_IMAGE,
      url: SITE_URL,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': 'Chorizo Mejor',
        'url': SITE_URL,
        'description': "Houston's #1 breakfast taco rating and review community.",
        'potentialAction': {
          '@type': 'SearchAction',
          'target': `${SITE_URL}/#/explore?q={search_term_string}`,
          'query-input': 'required name=search_term_string'
        }
      }
    });
    return res.setHeader('Content-Type', 'text/html').status(200).send(html);

  } catch (err) {
    console.error('OG handler error:', err);
    return res.redirect(302, SITE_URL);
  }
}
