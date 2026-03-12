// IndexNow API endpoint — notifies Bing + Yandex of new/changed URLs
// POST /api/indexnow with { urls: [...] } to submit URLs
// GET  /api/indexnow returns the key for verification

const KEY = '639752825b7040eba9e981334a4774a7';
const HOST = 'www.chorizomejor.com';

export default async function handler(req, res) {
  // GET — serve key for verification (Bing checks /{key}.txt exists)
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(KEY);
  }

  // POST — submit URLs to IndexNow
  if (req.method === 'POST') {
    const { urls } = req.body || {};
    if (!urls || !urls.length) {
      return res.status(400).json({ error: 'urls array required' });
    }

    const payload = {
      host: HOST,
      key: KEY,
      keyLocation: `https://${HOST}/api/indexnow`,
      urlList: urls
    };

    try {
      const resp = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return res.status(200).json({
        status: resp.status,
        message: resp.status === 200 ? 'URLs submitted successfully' : 'Submitted (may take time to process)',
        urlCount: urls.length
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
