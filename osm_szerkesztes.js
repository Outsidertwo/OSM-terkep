// OSM node-szerkesztés (API 0.6) — changeset nyitása, egy node meglévő tagjeinek
// lekérdezése, majd a megadott tagek ráírása/frissítése és a node visszaküldése.
// Az osm_auth.js-re épül (onnan jön a Bearer token).
//
// Fontos: az OSM API 0.6 a node MÓDOSÍTÁSAKOR a teljes node-ot várja vissza (nem csak
// a megváltozott tageket) — ezért itt mindig lekérjük a jelenlegi állapotot, abba
// belefésüljük a változásokat, és úgy küldjük vissza. A node-on már meglévő, általunk
// nem kezelt tagek (pl. amiket valaki más adott hozzá) érintetlenül maradnak.

const osmSzerkesztes = (function () {
  const API_BASE = osmAuth.API_BASE;

  function xmlEscape(ertek) {
    return String(ertek)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async function osmFetch(path, options) {
    const t = osmAuth.token();
    if (!t) throw new Error('Nincs bejelentkezve OSM-mel.');
    const valasz = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...(options && options.headers), Authorization: `Bearer ${t}` }
    });
    if (!valasz.ok) {
      const hibaSzoveg = await valasz.text().catch(() => '');
      throw new Error(`OSM API hiba (${valasz.status}): ${hibaSzoveg || valasz.statusText}`);
    }
    return valasz;
  }

  // Új changeset nyitása. Visszaadja a changeset azonosítóját (szám).
  async function changesetMegnyitasa(megjegyzes) {
    const body =
      '<osm><changeset>' +
      '<tag k="created_by" v="MÁV Felsővezeték-oszlop térkép"/>' +
      `<tag k="comment" v="${xmlEscape(megjegyzes)}"/>` +
      '</changeset></osm>';
    const valasz = await osmFetch('/changeset/create', {
      method: 'PUT',
      headers: { 'Content-Type': 'text/xml' },
      body
    });
    const szoveg = await valasz.text();
    return szoveg.trim();
  }

  async function changesetLezarasa(changesetId) {
    await osmFetch(`/changeset/${changesetId}/close`, { method: 'PUT' });
  }

  // Egy node jelenlegi állapotának lekérdezése: verzió, koordináták, meglévő tagek.
  async function nodeLekerdezese(nodeId) {
    const valasz = await osmFetch(`/node/${nodeId}`, { method: 'GET' });
    const szoveg = await valasz.text();
    const dom = new DOMParser().parseFromString(szoveg, 'text/xml');
    const nodeEl = dom.querySelector('node');
    if (!nodeEl) throw new Error('A node válasz nem értelmezhető.');
    const tagek = {};
    nodeEl.querySelectorAll('tag').forEach(t => {
      tagek[t.getAttribute('k')] = t.getAttribute('v');
    });
    return {
      id: nodeEl.getAttribute('id'),
      verzio: nodeEl.getAttribute('version'),
      lat: nodeEl.getAttribute('lat'),
      lon: nodeEl.getAttribute('lon'),
      tagek
    };
  }

  // A node visszaküldése az adott (friss) verzióval, koordinátákkal és tagekkel.
  // Visszaadja az új verziószámot.
  async function nodeFrissitese(nodeId, changesetId, verzio, lat, lon, tagek) {
    const tagSorok = Object.entries(tagek)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `<tag k="${xmlEscape(k)}" v="${xmlEscape(v)}"/>`)
      .join('');
    const body =
      `<osm><node id="${nodeId}" changeset="${changesetId}" version="${verzio}" lat="${lat}" lon="${lon}">` +
      tagSorok +
      '</node></osm>';
    const valasz = await osmFetch(`/node/${nodeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/xml' },
      body
    });
    const szoveg = await valasz.text();
    return szoveg.trim();
  }

  // Magas szintű, egylépéses függvény: nyit egy changesetet, lekéri a node jelenlegi
  // állapotát, belefésüli az ujTagek-ben megadott kulcsokat (a node MEGLÉVŐ, itt nem
  // említett tagjei érintetlenül maradnak), visszaküldi a node-ot, majd lezárja a
  // changesetet. Visszaadja az eredmény összefoglalóját.
  async function nodeFeltoltese(nodeId, ujTagek, megjegyzes) {
    const changesetId = await changesetMegnyitasa(megjegyzes);
    try {
      const jelenlegi = await nodeLekerdezese(nodeId);
      const osszefesultTagek = { ...jelenlegi.tagek, ...ujTagek };
      const ujVerzio = await nodeFrissitese(
        nodeId, changesetId, jelenlegi.verzio, jelenlegi.lat, jelenlegi.lon, osszefesultTagek
      );
      await changesetLezarasa(changesetId);
      return {
        changesetId,
        ujVerzio,
        elozoTagek: jelenlegi.tagek,
        ujTagekOsszesitve: osszefesultTagek,
        changesetUrl: `https://www.openstreetmap.org/changeset/${changesetId}`,
        nodeUrl: `https://www.openstreetmap.org/node/${nodeId}`
      };
    } catch (err) {
      // Ha menet közben hiba történt, a changesetet akkor is megpróbáljuk lezárni,
      // hogy ne maradjon nyitva — de az eredeti hibát adjuk tovább.
      try { await changesetLezarasa(changesetId); } catch (zarasHiba) { /* nincs mit tenni */ }
      throw err;
    }
  }

  return { changesetMegnyitasa, changesetLezarasa, nodeLekerdezese, nodeFrissitese, nodeFeltoltese };
})();
