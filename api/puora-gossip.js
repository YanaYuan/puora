import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).setHeader('Allow', 'GET, OPTIONS').json({ error: 'Method not allowed' });
  }

  try {
    const path = join(__dirname, '..', 'public', 'PuoraGossip.md');
    const body = readFileSync(path, 'utf8');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
    return res.status(200).send(body);
  } catch (err) {
    console.error('puora-gossip read error:', err);
    return res.status(500).type('text/plain').send('Failed to load PuoraGossip.md');
  }
}
