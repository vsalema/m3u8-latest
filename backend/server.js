import 'dotenv/config';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const RAW_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:5500,https://<github-user>.github.io';
const ALLOWED = new Set(RAW_ORIGINS.split(',').map(s => s.trim()).filter(Boolean));
app.use((req, res, next) => {
  const o = req.headers.origin || '';
  if (ALLOWED.has(o)) res.setHeader('Access-Control-Allow-Origin', o);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const saveLimiter = rateLimit({ windowMs: 60_000, max: 30 });

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.resolve(__dirname, 'latest.json');
const API_KEY = process.env.NODE_API_KEY || '';

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/latest', async (req, res) => {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8').catch(()=>null);
    if(!raw) return res.json({ url: null, ts: null });
    const obj = JSON.parse(raw);
    return res.json(obj);
  } catch(e){ return res.status(500).json({ error: 'internal error' }); }
});

app.post('/save', saveLimiter, async (req, res) => {
  try{
    const key = req.get('x-api-key') || '';
    if(!API_KEY || key !== API_KEY) return res.status(401).send('unauthorized');
    const url = req.body && req.body.url;
    if(!url || typeof url !== 'string') return res.status(400).send('missing url');
    const payload = { url, ts: new Date().toISOString() };
    await fs.writeFile(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
    return res.json({ ok: true, saved: payload });
  }catch(e){ return res.status(500).json({ error: 'internal error' }); }
});
app.listen(PORT, '0.0.0.0', () => console.log('API up on :' + PORT));

