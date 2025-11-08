import fetch from 'node-fetch';
const base = process.argv[2];
const key = process.argv[3];
const url = process.argv[4];
if(!base || !key || !url){
  console.log('Usage: node watcher-save.js <apiBase> <apiKey> <m3u8Url>');
  process.exit(1);
}
(async () => {
  try {
    const r = await fetch(base.replace(/\/$/, '') + '/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ url })
    });
    if(!r.ok){ console.error('Save failed', r.status, await r.text()); process.exit(2); }
    console.log('Saved ok:', await r.json());
  } catch(e){ console.error('Error:', e.message); process.exit(3); }
})();
