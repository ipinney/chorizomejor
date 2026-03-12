# Chorizo Mejor SEO Plan — March 2026

## What We Implemented (Code Changes)

### 1. Dynamic XML Sitemap (`/api/sitemap.js`)
- Serverless function pulling all published stories + places from Firestore
- CDN-cached 6 hours, paginated Firestore fetching (up to 3000 places)
- Accessible at: https://www.chorizomejor.com/sitemap.xml

### 2. Enhanced Crawler Handler (`/api/og.js` rewrite)
- Detects crawlers via user-agent (Google, Bing, Facebook, Twitter, Yandex, DuckDuck, Semrush, Ahrefs, etc.)
- Serves rich HTML with JSON-LD structured data to bots
- Schema.org types: Restaurant (places), Article (stories), WebSite, WebPage, AggregateRating
- Includes canonical URLs, meta descriptions, OG tags, and actual body content for crawlers

### 3. Client-Side SEO Engine (`app.js`)
- `updateSEO()` — dynamically updates document title, meta description, canonical link, OG tags, and JSON-LD on every route change
- `seoForPlace()` — generates Restaurant schema with ratings, address, geo coordinates
- `seoForStory()` — generates Article schema with author, publisher, date

### 4. Clean URL Rewrites (`vercel.json`)
- `/sitemap.xml` → `/api/sitemap`
- `/story/:slug` → `/api/og?slug=:slug`
- `/place/:id` → `/api/og?type=place&id=:id`
- `/explore`, `/leaderboard`, `/stories`, `/toty` → OG handler with page context
- `/{indexnow-key}.txt` → `/api/indexnow`

### 5. Robots.txt Updates
- Added `Sitemap: https://www.chorizomejor.com/api/sitemap`
- Added `Crawl-delay: 2`
- Explicit allow rules for major crawlers

### 6. IndexNow Integration (`/api/indexnow.js`)
- Instant URL indexing for Bing + Yandex
- Key: `639752825b7040eba9e981334a4774a7`
- POST endpoint for bulk URL submission
- GET endpoint serves key for verification

---

## Search Engine Submissions (Completed)

| Platform | Status | Details |
|----------|--------|---------|
| Google Search Console | ✅ Verified + Sitemap submitted | Meta tag verification, sitemap.xml submitted |
| Bing (IndexNow) | ✅ URLs submitted | Homepage, explore, stories, leaderboard pinged |
| Bing (robots.txt) | ✅ Sitemap discoverable | Bing will auto-find via robots.txt |
| Google Business Profile | ⏭️ Skipped | Not applicable — CM is a review site, not a restaurant |

---

## Git Commits

1. `23fa610` — SEO overhaul: sitemap, structured data, dynamic titles, clean URL rewrites
2. `0df38e9` — Add Google Search Console verification meta tag
3. `e82b0fe` — Add IndexNow support for Bing/Yandex instant indexing

---

## Manual Next Steps (For Ivan)

### High Priority
1. **Bing Webmaster Tools full setup** — Google OAuth was failing during our session. Try signing in at https://www.bing.com/webmasters with betogarza@gmail.com or your Google account when you get a chance. Import from Google Search Console for easy setup.

2. **Submit to Product Hunt** — Great for backlinks and traffic. Post Chorizo Mejor as a Houston breakfast taco discovery app. https://www.producthunt.com/posts/new

3. **Reddit posts** — Post in r/houston, r/HoustonFood, r/tacos with genuine content (not spammy). Share interesting findings from the leaderboard or taco of the year.

### Medium Priority
4. **Houstonia Magazine pitch** — Email editorial@houstoniamag.com about Chorizo Mejor as a Houston food tech story. They cover local food culture extensively.

5. **Houston Chronicle / CultureMap** — Pitch as a local tech/food story. "Houston developer builds breakfast taco rating app."

6. **Eater Houston** — Submit a tip about the site for their newsletter.

### Ongoing SEO
7. **Keep publishing Beto's Table stories** — Each new story = a new indexed page with rich structured data. This is the biggest organic SEO driver.

8. **Cross-link stories** — When writing new stories, reference other taco spots and stories already on the site. Internal linking helps crawlers.

9. **Social sharing** — Every new story should be shared on social media. Social signals indirectly boost SEO.

10. **Monitor Google Search Console** — Check weekly for indexing issues, coverage gaps, and search performance data. It takes 2-4 weeks for Google to fully process the sitemap.

---

## Expected SEO Timeline

- **Week 1-2**: Google begins crawling sitemap, indexing new pages
- **Week 2-4**: Individual place and story pages start appearing in search results
- **Month 2-3**: Structured data rich snippets (star ratings, etc.) begin showing
- **Month 3-6**: With consistent new content (Beto's Table), organic traffic should grow steadily
