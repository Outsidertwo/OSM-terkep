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
  // említett tagjei érintetlenül maradnak), opcionálisan felülírja a koordinátáit is
  // (ujKoordinata = {lat, lon}, ha meg van adva — pl. mozgatáskor), visszaküldi a
  // node-ot, majd lezárja a changesetet. Visszaadja az eredmény összefoglalóját.
  async function nodeFeltoltese(nodeId, ujTagek, megjegyzes, ujKoordinata) {
    const changesetId = await changesetMegnyitasa(megjegyzes);
    try {
      const jelenlegi = await nodeLekerdezese(nodeId);
      const osszefesultTagek = { ...jelenlegi.tagek, ...ujTagek };
      const lat = ujKoordinata ? ujKoordinata.lat : jelenlegi.lat;
      const lon = ujKoordinata ? ujKoordinata.lon : jelenlegi.lon;
      const ujVerzio = await nodeFrissitese(nodeId, changesetId, jelenlegi.verzio, lat, lon, osszefesultTagek);
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

  // --- Additív, ütközés-biztos kötegelt feltöltés (C pont, 2026-09-16) ---
  //
  // A nodeFeltoltese() fenti, korai változata VAKON összefésül -- ha egy tag már más
  // értékkel szerepel a node-on, egyszerűen felülírja. Ez a rész ehelyett SOHA nem ír
  // felül eltérő értékű, már létező taget: csak a hiányzó tageket pótolja. Ha egy tagnál
  // valódi ütközés van (a node-on más érték van, mint amit mi mentenénk), azt a tagot
  // kihagyja, és jelenti a hívónak -- kézi, iD/JOSM-es átnézésre. Ez a v1, óvatos
  // változat; egy későbbi körben ez bővíthető tagenkénti interaktív visszakérdezéssel.

  // Összehasonlítja a node jelenlegi (OSM-en élő) tageit a mentendő (séma szerint ismert)
  // tagekkel. Visszaadja: alkalmazandoTagek (a jelenlegi tagek + a ténylegesen hiányzó,
  // újonnan pótolható tagek -- ez küldendő vissza a node-nak), kihagyottTagek (azok a
  // kulcsok, ahol a node-on már más érték szerepel, mint amit mi mentenénk -- ezekhez NEM
  // nyúlunk jóváhagyás nélkül), és torlendoTagek (azok a KEZELT kulcsok, amik a node-on
  // megvannak, de a mentendő tagek között már nincsenek -- vagyis a felmérésből törölték
  // az adott mezőt -- ezekhez sem nyúlunk jóváhagyás nélkül). kezeltKulcsok nélkül (pl.
  // ha a séma nem tölthető be) a torlés-felismerés kimarad, csak additív mukodés marad.
  function tagekOsszehasonlitasa(jelenlegiTagek, ujTagek, kezeltKulcsok) {
    const alkalmazandoTagek = { ...jelenlegiTagek };
    const kihagyottTagek = [];
    let vanValodiValtozas = false;
    Object.entries(ujTagek).forEach(([kulcs, ertek]) => {
      if (ertek === undefined || ertek === null || ertek === '') return;
      const ertekSzoveg = String(ertek);
      if (!(kulcs in jelenlegiTagek)) {
        alkalmazandoTagek[kulcs] = ertekSzoveg;
        vanValodiValtozas = true;
      } else if (jelenlegiTagek[kulcs] !== ertekSzoveg) {
        kihagyottTagek.push({ kulcs, regiErtek: jelenlegiTagek[kulcs], ujErtek: ertekSzoveg });
      }
      // Ha a kulcs már megvan, ugyanazzal az értékkel -- nincs teendő, marad ahogy van.
    });
    const torlendoTagek = [];
    if (kezeltKulcsok) {
      Object.keys(jelenlegiTagek).forEach(kulcs => {
        if (kezeltKulcsok.has(kulcs) && !(kulcs in ujTagek)) {
          torlendoTagek.push({ kulcs, regiErtek: jelenlegiTagek[kulcs] });
        }
      });
    }
    return { alkalmazandoTagek, kihagyottTagek, torlendoTagek, vanValodiValtozas };
  }

  // Egy egész vonalhoz tartozó köteg feltöltése EGYETLEN changeset-ben, KÉT FÁZISBAN:
  //  1) száraz futás -- minden node lekérdezése, a különbségek (frissítendő + törlendő
  //     tagek) összegyűjtése, MÉG SEMMI nem íródik OSM-re;
  //  2) ha volt ütköző VAGY törlendő tag, EGYETLEN összesített, egyszerű kérdéssel
  //     (window.confirm) eldöntjük: mindet végrehajtjuk-e (felülírás + törlés is), vagy
  //     egyiket sem (ekkor a régi, óvatos viselkedés marad: csak a hiányzó tagek
  //     pótlódnak). Ez egy globális döntés, nem soronkénti -- ha a gyakorlatban ez
  //     kevésnek bizonyul, később bővíthető (2026-09-16/17, kérésre: egyelőre az
  //     egyszerűbb, egy közös jóváhagyás elég).
  // tetelek: [{ osmId, lat, lon, ujTagek }, ...] -- a lat/lon csak tartalékként kell, az
  // OSM-re mindig a frissen lekérdezett OSM-koordináta megy vissza, hogy a node soha ne
  // mozduljon el véletlenül.
  // kezeltKulcsok: Set<string> -- azok az OSM-kulcsok, amiket a séma valaha beírhat; ha a
  // node-on egy ilyen kulcs megvan, de a mentendő tagek között már nincs, törlésre
  // jelöljük (más, nem-kezelt/idegen tagekhez soha nem nyúlunk). Elhagyható -- akkor a
  // törlés-felismerés kimarad, csak additív működés marad.
  // Egy-egy node hibája nem szakítja meg a többi feldolgozását (best effort); a changeset
  // a végén, akkor is lezáródik, ha közben volt hiba.
  // Visszaadja tételenként az eredményt:
  //   { osmId, allapot: 'sikeres' | 'nincs_valtozas' | 'hiba', ujVerzio?, kihagyottTagek, torolt?, hiba? }
  async function csomagFeltoltese(vonalNev, tetelek, megjegyzes, kezeltKulcsok) {
    if (!tetelek || tetelek.length === 0) return [];

    // --- 1. fázis: száraz futás ---
    const szarazFutas = [];
    for (const tetel of tetelek) {
      try {
        const jelenlegi = await nodeLekerdezese(tetel.osmId);
        const { alkalmazandoTagek, kihagyottTagek, torlendoTagek, vanValodiValtozas } =
          tagekOsszehasonlitasa(jelenlegi.tagek, tetel.ujTagek || {}, kezeltKulcsok);
        szarazFutas.push({ osmId: tetel.osmId, jelenlegi, alkalmazandoTagek, kihagyottTagek, torlendoTagek, vanValodiValtozas });
      } catch (err) {
        szarazFutas.push({ osmId: tetel.osmId, hiba: err.message });
      }
    }

    // --- Egyetlen összesített visszakérdezés, ha volt ütközés vagy törlendő tag ---
    const osszesUtkozes = szarazFutas.flatMap(d => (d.kihagyottTagek || []).map(k => ({ osmId: d.osmId, ...k })));
    const osszesTorles = szarazFutas.flatMap(d => (d.torlendoTagek || []).map(k => ({ osmId: d.osmId, ...k })));
    let vegrehajtasVallalt = false;
    if (osszesUtkozes.length > 0 || osszesTorles.length > 0) {
      const sorok = [
        ...osszesUtkozes.map(u => `FRISSÍTÉS #${u.osmId}: ${u.kulcs}  (OSM-en: "${u.regiErtek}"  →  nálad: "${u.ujErtek}")`),
        ...osszesTorles.map(u => `TÖRLÉS #${u.osmId}: ${u.kulcs}  (jelenlegi OSM-érték: "${u.regiErtek}", nálad már nincs megadva)`)
      ];
      vegrehajtasVallalt = window.confirm(
        `${sorok.length} tag igényel jóváhagyást -- ezeknél az OSM-en más adat szerepel, mint amit menteni szeretnél, vagy egy korábbi tag már nincs nálad megadva:\n\n` +
        sorok.join('\n') + '\n\n' +
        `OK = mindet végrehajtom (felülírás + törlés is).\nMégse = egyiket sem, csak a hiányzó tagek pótlódnak.`
      );
    }

    // --- 2. fázis: tényleges írás ---
    const changesetId = await changesetMegnyitasa(megjegyzes || `${tetelek.length} felsővezeték-oszlop adatainak frissítése (${vonalNev})`);
    const eredmenyek = [];
    try {
      for (const d of szarazFutas) {
        if (d.hiba) {
          eredmenyek.push({ osmId: d.osmId, allapot: 'hiba', hiba: d.hiba, kihagyottTagek: [] });
          continue;
        }
        let vegsoTagek = d.alkalmazandoTagek;
        let vegsoKihagyott = d.kihagyottTagek;
        let vegsoTorolt = [];
        let vanIras = d.vanValodiValtozas;
        if (vegrehajtasVallalt) {
          if (d.kihagyottTagek.length > 0) {
            vegsoTagek = { ...vegsoTagek };
            d.kihagyottTagek.forEach(k => { vegsoTagek[k.kulcs] = k.ujErtek; });
            vegsoKihagyott = [];
            vanIras = true;
          }
          if (d.torlendoTagek.length > 0) {
            vegsoTagek = { ...vegsoTagek };
            d.torlendoTagek.forEach(k => { delete vegsoTagek[k.kulcs]; });
            vegsoTorolt = d.torlendoTagek;
            vanIras = true;
          }
        }
        if (!vanIras) {
          eredmenyek.push({ osmId: d.osmId, allapot: 'nincs_valtozas', kihagyottTagek: vegsoKihagyott });
          continue;
        }
        try {
          const ujVerzio = await nodeFrissitese(
            d.osmId, changesetId, d.jelenlegi.verzio, d.jelenlegi.lat, d.jelenlegi.lon, vegsoTagek
          );
          eredmenyek.push({ osmId: d.osmId, allapot: 'sikeres', ujVerzio, kihagyottTagek: vegsoKihagyott, torolt: vegsoTorolt });
        } catch (err) {
          eredmenyek.push({ osmId: d.osmId, allapot: 'hiba', hiba: err.message, kihagyottTagek: vegsoKihagyott });
        }
      }
    } finally {
      // A changesetet mindenképp lezárjuk, akkor is, ha közben egyes node-oknál hiba volt.
      try { await changesetLezarasa(changesetId); } catch (zarasHiba) { /* nincs mit tenni */ }
    }
    return eredmenyek;
  }

  return {
    changesetMegnyitasa, changesetLezarasa, nodeLekerdezese, nodeFrissitese, nodeFeltoltese,
    tagekOsszehasonlitasa, csomagFeltoltese
  };
})();
