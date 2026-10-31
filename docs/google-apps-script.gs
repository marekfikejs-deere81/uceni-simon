/**
 * Úložiště výsledků pro Šimonovu historii (https://marekfikejs-deere81.github.io/uceni-simon/historie.html)
 * Vlož do Google tabulky: Rozšíření → Apps Script, nahraď obsah tímto kódem a nasaď jako webovou aplikaci.
 * Verze 1.0 · 2026-10-31
 *
 * List „kola": jeden řádek = jedno dokončené kolo v appce.
 * List „stav":  aktuální průběh každé appky (úspěšnost po kategoriích) jako JSON.
 */
const KOLA = 'kola', STAV = 'stav';

function list_(nazev, hlavicka) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nazev);
  if (!sh) { sh = ss.insertSheet(nazev); sh.appendRow(hlavicka); sh.setFrozenRows(1); }
  return sh;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const m = JSON.parse(e.postData.contents || '{}');
    const kola = list_(KOLA, ['klic', 'appka', 'cas', 'datum', 'uloh', 'chyb', 'znamka', 'nastaveni']);
    const stav = list_(STAV, ['appka', 'json', 'aktualizovano']);

    // nová kola (bez duplicit podle appka|čas)
    const rounds = Array.isArray(m.rounds) ? m.rounds : [];
    if (rounds.length) {
      const last = kola.getLastRow();
      const known = new Set(last > 1 ? kola.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0])) : []);
      const rows = [];
      rounds.forEach(r => {
        if (!r || !r.a || !r.t) return;
        const k = r.a + '|' + r.t;
        if (known.has(k)) return;
        known.add(k);
        rows.push([k, String(r.a), Number(r.t), new Date(Number(r.t)), Number(r.n) || 0, Number(r.e) || 0, Number(r.g) || 0, String(r.d || '').slice(0, 200)]);
      });
      if (rows.length) kola.getRange(kola.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    // aktuální stav appek
    const states = m.states && typeof m.states === 'object' ? m.states : {};
    Object.keys(states).forEach(id => {
      const json = JSON.stringify(states[id]).slice(0, 45000);
      const last = stav.getLastRow();
      const ids = last > 1 ? stav.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0])) : [];
      const i = ids.indexOf(id);
      if (i >= 0) stav.getRange(i + 2, 2, 1, 2).setValues([[json, new Date()]]);
      else stav.appendRow([id, json, new Date()]);
    });
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  const kola = list_(KOLA, ['klic', 'appka', 'cas', 'datum', 'uloh', 'chyb', 'znamka', 'nastaveni']);
  const stav = list_(STAV, ['appka', 'json', 'aktualizovano']);
  const log = [], states = {};
  if (kola.getLastRow() > 1) {
    kola.getRange(2, 1, kola.getLastRow() - 1, 8).getValues().forEach(r => {
      log.push({ a: r[1], t: Number(r[2]), n: Number(r[4]), e: Number(r[5]), g: Number(r[6]), d: r[7] });
    });
  }
  if (stav.getLastRow() > 1) {
    stav.getRange(2, 1, stav.getLastRow() - 1, 2).getValues().forEach(r => {
      try { states[r[0]] = JSON.parse(r[1]); } catch (err) {}
    });
  }
  return ContentService.createTextOutput(JSON.stringify({ log: log, states: states }))
    .setMimeType(ContentService.MimeType.JSON);
}
