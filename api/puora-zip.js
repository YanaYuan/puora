import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).setHeader('Allow', 'GET, HEAD').end('Method not allowed');
  }

  try {
    const path = join(__dirname, '..', 'public', 'puora.zip');
    const stat = statSync(path);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="puora.zip"');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');

    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    const buf = readFileSync(path);
    return res.status(200).send(buf);
  } catch (err) {
    console.error('puora-zip error:', err);
    return res.status(404).type('text/plain').send('puora.zip not found');
  }
}
