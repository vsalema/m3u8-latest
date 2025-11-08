document.addEventListener('DOMContentLoaded', () => {
  const status = document.getElementById('status');
  const video = document.getElementById('video');
  const apiBaseInput = document.getElementById('apiBase');
  const manualUrlInput = document.getElementById('manualUrl');
  const loadLatestBtn = document.getElementById('loadLatest');
  const injectManualBtn = document.getElementById('injectManual');

  const DEFAULT_API_BASE = "https://your-render-url.example.com";
  apiBaseInput.value = DEFAULT_API_BASE;

  let hls = null;
  function setStatus(t){ status.textContent = t; console.log('[player]', t); }
  function destroyHls(){ if(hls){ try{ hls.destroy(); }catch(e){} hls = null; } }

  async function setSource(url){
    if(!url){ setStatus('Aucune URL à injecter'); return; }
    destroyHls();
    setStatus('Injection: ' + url);
    video.preload = 'auto';
    video.muted = true;
    const native = !!video.canPlayType && video.canPlayType('application/vnd.apple.mpegurl') !== '';
    if(native){
      try{ video.src = url; await video.play().catch(()=>{}); setStatus('Lecture native'); return; }
      catch(e){ console.warn('native failed', e); }
    }
    if(window.Hls && Hls.isSupported()){
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        capLevelToPlayerSize: true,
        startLevel: 0,
        abrEwmaDefaultEstimate: 400000,
        maxBufferLength: 15,
        maxMaxBufferLength: 30,
        maxBufferHole: 0.5,
        backBufferLength: 30,
        manifestLoadingMaxRetry: 2,
        levelLoadingMaxRetry: 2,
        fragLoadingMaxRetry: 2,
        manifestLoadingRetryDelay: 1500,
        levelLoadingRetryDelay: 1500,
        fragLoadingRetryDelay: 1500,
        debug: false
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('[HLS ERROR]', data);
        const info = `${data.type || ''} | ${data.details || ''} | ${data.response?.code ?? ''}`;
        setStatus('Erreur Hls.js: ' + info);
        if (data.details === 'bufferStalledError' || data.details === 'bufferSeekOverHole') {
          if (hls.autoLevelEnabled) {
            const lvl = Math.max(0, (hls.nextLevel ?? 1) - 1);
            hls.nextLevel = lvl;
          }
        }
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
            case Hls.ErrorTypes.MEDIA_ERROR:   hls.recoverMediaError(); break;
            default:                           hls.destroy(); break;
          }
        }
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().then(()=> setStatus('Lecture Hls.js')).catch(()=> setStatus('Flux chargé. Appuyez sur play.'));
      });

      hls.loadSource(url);
      hls.attachMedia(video);
    } else {
      setStatus('HLS non supporté');
    }
  }

  async function loadLatest(){
    const base = (apiBaseInput.value || DEFAULT_API_BASE).trim();
    if(!base){ setStatus('Configurer l’API dans Paramètres'); return; }
    try{
      const r = await fetch(base.replace(/\/$/, '') + '/latest', { cache:'no-store' });
      if(!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if(j && j.url){
        await setSource(j.url);
        setStatus('Chargé depuis /latest — ' + (j.ts || ''));
        return true;
      }
      setStatus('Aucune URL côté serveur');
    }catch(e){
      console.error(e);
      setStatus('Échec /latest: ' + e.message);
    }
    return false;
  }

  loadLatestBtn.addEventListener('click', (e)=>{ e.preventDefault(); loadLatest(); });
  injectManualBtn.addEventListener('click', (e)=>{ e.preventDefault(); setSource(manualUrlInput.value.trim()); });

  setTimeout(()=>{ loadLatest(); }, 250);
});