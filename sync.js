/*
  Název:   Synchronizace výsledků (sdílené pro všechny appky)
  Téma:    Posílá dokončená kola a průběh appek do Google tabulky rodiče, aby šla Šimonova historie
           otevřít na jakémkoli zařízení. Bez nastavené adresy nedělá nic a appky fungují jen lokálně.
  Datum:   2026-10-31
  Verze:   1.0
  Nastavení: do SYNC_URL vlož adresu webové aplikace Google Apps Script (končí na /exec).
*/
window.UceniSync = (function(){
  'use strict';
  const SYNC_URL = '';
  const QUEUE_KEY = 'uceni-sync-fronta-v1';
  const INIT_KEY = 'uceni-sync-uvod-v1';
  const LOG_KEY = 'uceni-historie-v1';
  const APP_IDS = ['mala-nasobilka','deleni-jednocifernym','slovni-druhy','urcovani-padu','vyjmenovana-slova'];

  const read = (k, fb) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch(e){ return fb; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };

  function enqueue(msg){ const q = read(QUEUE_KEY, []); q.push(msg); write(QUEUE_KEY, q.slice(-300)); }

  let busy = false;
  async function flush(){
    if (!SYNC_URL || busy || (typeof navigator!=='undefined' && navigator.onLine===false)) return;
    busy = true;
    try {
      let q = read(QUEUE_KEY, []);
      while (q.length){
        // text/plain = bez CORS předletu; odpověď v režimu no-cors nevidíme, chyba sítě ale vyhodí výjimku
        await fetch(SYNC_URL, { method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(q[0]) });
        q = read(QUEUE_KEY, []); q.shift(); write(QUEUE_KEY, q);
      }
    } catch(e) { /* offline – zkusí se příště */ }
    busy = false;
  }

  /* volá appka na konci kola: záznam kola + aktuální průběh appky */
  function push(round, state){
    if (!SYNC_URL) return;
    const states = {}; if (state) states[round.a] = state;
    enqueue({ rounds:[round], states });
    flush();
  }

  /* první spuštění se synchronizací: pošle vše, co už je v zařízení */
  function initialUpload(){
    if (!SYNC_URL || read(INIT_KEY, false)) return;
    const states = {};
    APP_IDS.forEach(id => { const s = read(id+'-v1', null); if (s) states[id] = s; });
    const rounds = read(LOG_KEY, []);
    if (rounds.length || Object.keys(states).length) enqueue({ rounds, states });
    write(INIT_KEY, true);
  }

  /* pro přehled: načte vše z tabulky */
  async function fetchAll(){
    if (!SYNC_URL) throw new Error('vypnuto');
    const r = await fetch(SYNC_URL + '?akce=data&_=' + Date.now(), { cache:'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json(); // { log:[...], states:{ id: stav } }
  }

  initialUpload();
  flush();
  if (typeof window!=='undefined') window.addEventListener('online', flush);

  return { enabled: !!SYNC_URL, push, flush, fetchAll };
})();
