// A közös, minden oszlopadatot tartalmazó fájl közvetlen mentése GitHub-ra, a böngészőből,
// egy Personal Access Token (PAT) segítségével — nincs szükség szerverre.
//
// A token SOSEM kerül sehova a repóba, csak a böngésző saját localStorage-ában marad,
// és csak a github.com API felé megy ki, mentéskor.
//
// A fájl formátuma NDJSON: soronként egy-egy oszlop tömör JSON-rekordja. Ez git-diff-barát
// (egy módosítás = egy megváltozott sor) és könnyen olvasható/tömöríthető is.

const githubMentes = (function () {
  const REPO = 'Outsidertwo/OSM-terkep';
  const BRANCH = 'main';
  const API_BASE = 'https://api.github.com';
  const TAROLO_KULCS = 'github_pat_token';

  // A közös adat vonalanként külön fájlba kerül (sajat_adatok/{kod}.ndjson) -- ez teszi
  // lehetővé, hogy a térkép csak a ténylegesen megjelenített vonalakhoz tartozó adatot
  // töltse be, és hogy két vonal egyidejű szerkesztése ne ütközzön egymással GitHub-on.
  function fajlUtvonal(vonalKod) {
    if (!vonalKod) throw new Error('Nincs megadva, melyik vonalhoz tartozik a mentendő rekord (vonalKod hiányzik).');
    return `sajat_adatok/${vonalKod}.ndjson`;
  }

  function tokenBeallitasa(t) { localStorage.setItem(TAROLO_KULCS, t.trim()); }
  function token() { return localStorage.getItem(TAROLO_KULCS); }
  function tokenVan() { return !!token(); }
  function tokenTorlese() { localStorage.removeItem(TAROLO_KULCS); }

  // UTF-8-biztos base64 kódolás/dekódolás (az ékezetek miatt sima btoa/atob nem lenne elég).
  function b64Encode(str) { return btoa(unescape(encodeURIComponent(str))); }
  function b64Decode(str) { return decodeURIComponent(escape(atob(str))); }

  async function githubFetch(path, options) {
    const t = token();
    if (!t) throw new Error('Nincs beállítva GitHub token.');
    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options && options.headers),
        Authorization: `Bearer ${t}`,
        Accept: 'application/vnd.github+json'
      }
    });
  }

  // Egyetlen rekord mentése/frissítése a vonalhoz tartozó fájlban. `kulcs` az oszlopszám
  // (vagy bármi más egyedi azonosító), `rekord` egy sima JS objektum, `vonalKod` a vonal
  // rövid fájlkódja (pl. "120a") -- ez dönti el, melyik sajat_adatok/{kod}.ndjson fájlba
  // kerül. A fájl már meglévő, más oszlopokhoz tartozó sorai érintetlenül maradnak.
  async function rekordMentese(kulcs, rekord, vonalKod) {
    const FAJL_UTVONAL = fajlUtvonal(vonalKod);
    const path = `/repos/${REPO}/contents/${FAJL_UTVONAL}`;
    let sorok = [];
    let sha = null;

    const getValasz = await githubFetch(`${path}?ref=${BRANCH}`, { method: 'GET' });
    if (getValasz.status === 200) {
      const adat = await getValasz.json();
      sha = adat.sha;
      const szoveg = b64Decode(adat.content.replace(/\n/g, ''));
      sorok = szoveg.split('\n').filter(s => s.trim() !== '');
    } else if (getValasz.status !== 404) {
      const hibaSzoveg = await getValasz.text().catch(() => '');
      throw new Error(`Nem sikerült lekérni a jelenlegi fájlt (${getValasz.status}): ${hibaSzoveg}`);
    }
    // 404 esetén a fájl még nem létezik — üres sorlistával indulunk, majd létrejön.

    let talalt = false;
    const ujSorok = sorok.map(sor => {
      try {
        const obj = JSON.parse(sor);
        if (obj.szam === kulcs) { talalt = true; return JSON.stringify(rekord); }
      } catch (err) {
        // Hibás/értelmezhetetlen sor — érintetlenül hagyjuk, nem a mi dolgunk kijavítani.
      }
      return sor;
    });
    if (!talalt) ujSorok.push(JSON.stringify(rekord));

    const ujTartalom = ujSorok.join('\n') + '\n';
    const body = {
      message: `Oszlop ${kulcs} adatainak mentése (${vonalKod})`,
      content: b64Encode(ujTartalom),
      branch: BRANCH
    };
    if (sha) body.sha = sha;

    const putValasz = await githubFetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!putValasz.ok) {
      const hibaSzoveg = await putValasz.text().catch(() => '');
      throw new Error(`Nem sikerült menteni a fájlt (${putValasz.status}): ${hibaSzoveg}`);
    }
    return await putValasz.json();
  }

  // Több új rekord egyszeri, kötegelt beszúrása egy vonal fájljába (pl. Overpass-regisztráció).
  // FONTOS: ez INSERT-ONLY -- csak azokat a rekordokat írja be, amelyek _osm_id-ja MÉG NEM
  // szerepel a fájlban. A már meglévő rekordokat egyáltalán nem érinti, még akkor sem, ha az
  // ujRekordok listában van egy azonos _osm_id-jú, eltérő tartalmú elem -- azt egyszerűen
  // kihagyja. Ha nincs egyetlen ténylegesen új rekord sem, nem hív PUT-ot (nincs üres commit).
  async function ujRekordokKotegeltMentese(ujRekordok, vonalKod) {
    const FAJL_UTVONAL = fajlUtvonal(vonalKod);
    const path = `/repos/${REPO}/contents/${FAJL_UTVONAL}`;
    let sorok = [];
    let sha = null;

    const getValasz = await githubFetch(`${path}?ref=${BRANCH}`, { method: 'GET' });
    if (getValasz.status === 200) {
      const adat = await getValasz.json();
      sha = adat.sha;
      const szoveg = b64Decode(adat.content.replace(/\n/g, ''));
      sorok = szoveg.split('\n').filter(s => s.trim() !== '');
    } else if (getValasz.status !== 404) {
      const hibaSzoveg = await getValasz.text().catch(() => '');
      throw new Error(`Nem sikerült lekérni a jelenlegi fájlt (${getValasz.status}): ${hibaSzoveg}`);
    }
    // 404 esetén a fájl még nem létezik -- üres sorlistával indulunk, majd létrejön.

    const meglevoOsmIdk = new Set();
    sorok.forEach(sor => {
      try {
        const obj = JSON.parse(sor);
        if (obj._osm_id) meglevoOsmIdk.add(String(obj._osm_id));
      } catch (err) {
        // Hibás/értelmezhetetlen sor -- az azonosító-gyűjtésből kimarad, de a sor megmarad.
      }
    });

    const beirando = ujRekordok.filter(r => r._osm_id && !meglevoOsmIdk.has(String(r._osm_id)));
    if (beirando.length === 0) {
      return { ujSorokSzama: 0 };
    }

    const ujSorok = sorok.concat(beirando.map(r => JSON.stringify(r)));
    const ujTartalom = ujSorok.join('\n') + '\n';
    const body = {
      message: `${beirando.length} új oszlop regisztrálása Overpass-ból (${vonalKod})`,
      content: b64Encode(ujTartalom),
      branch: BRANCH
    };
    if (sha) body.sha = sha;

    const putValasz = await githubFetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!putValasz.ok) {
      const hibaSzoveg = await putValasz.text().catch(() => '');
      throw new Error(`Nem sikerült menteni a fájlt (${putValasz.status}): ${hibaSzoveg}`);
    }
    return { ujSorokSzama: beirando.length, valasz: await putValasz.json() };
  }

  // --- Helyi (még fel nem töltött) módosítások pufferelése -- 3. lépés, offline-first átalakítás ---
  //
  // A Mentés gomb (adatlap_motor.js) mostantól NEM ír azonnal GitHub-ra, csak ide, a
  // böngésző localStorage-ába. A GitHub-oldali állapot marad a "biztonságos" állapot; ez a
  // pending-lista csak napi/munkameneti puffer, amit a 4. lépésben egy kötegelt "Változások
  // feltöltése" gomb ürít ki.

  const PENDING_KULCS = 'pending_valtozasok';

  function pendingOlvasas() {
    try {
      const nyers = localStorage.getItem(PENDING_KULCS);
      return nyers ? JSON.parse(nyers) : {};
    } catch (err) {
      console.warn('Nem sikerült beolvasni a mentetlen módosításokat:', err);
      return {};
    }
  }

  function pendingIrasa(pending) {
    try {
      localStorage.setItem(PENDING_KULCS, JSON.stringify(pending));
    } catch (err) {
      console.warn('Nem sikerült elmenteni a mentetlen módosítást (localStorage hiba):', err);
      throw err; // a hívónak látnia kell -- ha ez elszáll, a "mentés" ténylegesen nem történt meg
    }
  }

  // Egy rekord helyi (még nem feltöltött) mentése -- ez a Mentés gomb új, elsődleges útja.
  // Ha az adott osmId-hoz már volt korábbi (még fel nem töltött) mentés, felülírja azt --
  // ez szándékos: a "kor" (mentesIdo) mindig az utolsó szerkesztéstől számít.
  function pendingMentese(osmId, rekord, vonalKod) {
    const pending = pendingOlvasas();
    pending[String(osmId)] = { rekord, vonalKod, mentesIdo: new Date().toISOString() };
    pendingIrasa(pending);
    return pending;
  }

  // A 4. lépéshez (kötegelt feltöltés) kell majd -- sikeres GitHub-írás után törli a
  // feltöltött tételt a pending-listából.
  function pendingTorles(osmId) {
    const pending = pendingOlvasas();
    delete pending[String(osmId)];
    pendingIrasa(pending);
    return pending;
  }

  function pendingDarab() {
    return Object.keys(pendingOlvasas()).length;
  }

  return {
    tokenBeallitasa, token, tokenVan, tokenTorlese, rekordMentese, ujRekordokKotegeltMentese,
    pendingOlvasas, pendingMentese, pendingTorles, pendingDarab
  };
})();
