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

  // A vezeték-toldások (sosem kerülnek OSM-re, saját azonosítójuk van, nem OSM node)
  // teljesen külön fájlba kerülnek vonalanként, hogy az oszlop-rekordok feldolgozó
  // logikáját (OSM-tag-generálás, Overpass-egyesítés) ne kelljen ehhez az egészen más
  // adatszerkezethez igazítani.
  function fajlUtvonalToldasok(vonalKod) {
    if (!vonalKod) throw new Error('Nincs megadva, melyik vonalhoz tartozik a mentendő toldás (vonalKod hiányzik).');
    return `sajat_adatok/${vonalKod}_toldasok.ndjson`;
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

  // 409 (SHA-ütközés) újrapróbálkozás előtti rövid várakozás. Enélkül közvetlenül egy
  // sikeres írás után a következő GET néha még a régi (elavult) SHA-t adja vissza egy
  // rövid, GitHub API-oldali propagációs késés miatt -- emiatt várakozás nélkül mindhárom
  // próbálkozás ugyanabba az ablakba eshet, és mind a 3 hiába fut le (2026-09-26-i
  // hibajavítás). A várakozás próbálkozásonként nő (400ms, 800ms, ...).
  function varakozasUjraprobalkozasElott(probalkozas) {
    return new Promise(r => setTimeout(r, 400 * probalkozas));
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

  // --- Kötegelt feltöltés -- 4. lépés, offline-first átalakítás ---
  //
  // A pending-listából egy adott vonalhoz tartozó összes rekord egyetlen kötegelt feltöltése.
  // Mindig a LEGFRISSEBB GitHub-tartalmat kéri le (nem a localStorage-cache-elt verziót),
  // hogy ne írjon felül közben történt (pl. Overpass-regisztrációból vagy másik eszközről
  // származó) változást. SHA-ütközés (409) esetén automatikusan újrapróbálkozik (max.
  // maxProbalkozas alkalommal), minden alkalommal friss tartalomra alkalmazva a
  // pending-rekordokat. Sikeres feltöltés után a HÍVÓ felelőssége törölni a feltöltött
  // tételeket a pending-listából (pendingTorles) -- ez a függvény önmagában nem nyúl a
  // pending-listához, csak a GitHub-fájlt írja.
  //
  // pendingRekordokEhhezAVonalhoz: [{ osmId, rekord }, ...]
  async function pendingFeltoltesVonalra(vonalKod, pendingRekordokEhhezAVonalhoz, maxProbalkozas = 3) {
    const path = `/repos/${REPO}/contents/${fajlUtvonal(vonalKod)}`;
    for (let probalkozas = 1; probalkozas <= maxProbalkozas; probalkozas++) {
      const getValasz = await githubFetch(`${path}?ref=${BRANCH}`, { method: 'GET' });
      let sorok = [];
      let sha = null;
      if (getValasz.status === 200) {
        const adat = await getValasz.json();
        sha = adat.sha;
        sorok = b64Decode(adat.content.replace(/\n/g, '')).split('\n').filter(s => s.trim() !== '');
      } else if (getValasz.status !== 404) {
        const hibaSzoveg = await getValasz.text().catch(() => '');
        throw new Error(`Nem sikerült lekérni a jelenlegi fájlt (${getValasz.status}): ${hibaSzoveg}`);
      }
      // 404 esetén a fájl még nem létezik -- üres sorlistával indulunk, majd létrejön.

      // Pending rekordok ráillesztése: _osm_id szerint felülír vagy hozzáfűz. A fájl többi
      // sorát (amit nem érintett a pending) változatlanul hagyja.
      const osmIdKulcsSzerint = new Map(); // _osm_id -> sorindex
      sorok.forEach((sor, i) => {
        try { const o = JSON.parse(sor); if (o._osm_id) osmIdKulcsSzerint.set(String(o._osm_id), i); }
        catch (e) { /* hibás sor, kihagyva az indexelésből, de a sor megmarad érintetlenül */ }
      });
      pendingRekordokEhhezAVonalhoz.forEach(({ osmId, rekord }) => {
        const idx = osmIdKulcsSzerint.get(String(osmId));
        if (idx != null) sorok[idx] = JSON.stringify(rekord);
        else sorok.push(JSON.stringify(rekord));
      });

      const body = {
        message: `${pendingRekordokEhhezAVonalhoz.length} oszlop módosítása feltöltve (${vonalKod})`,
        content: b64Encode(sorok.join('\n') + '\n'),
        branch: BRANCH
      };
      if (sha) body.sha = sha;

      const putValasz = await githubFetch(path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (putValasz.ok) return await putValasz.json();
      if (putValasz.status === 409 && probalkozas < maxProbalkozas) { await varakozasUjraprobalkozasElott(probalkozas); continue; } // SHA-ütközés -- újrapróbál
      const hibaSzoveg = await putValasz.text().catch(() => '');
      throw new Error(`Feltöltés sikertelen (${putValasz.status}) ${maxProbalkozas} próbálkozás után: ${hibaSzoveg}`);
    }
  }

  // --- Vezeték-toldások -- saját, párhuzamos pending-tároló és feltöltés ---
  //
  // Ugyanaz a minta, mint az oszlopoknál (offline-first: helyi puffer, majd kötegelt
  // feltöltés), de külön localStorage-kulccsal és külön fájllal, mert a toldás sosem
  // OSM node -- nincs _osm_id-ja, saját generált `id` mezője azonosítja.

  const PENDING_TOLDAS_KULCS = 'pending_toldasok';

  function pendingToldasOlvasas() {
    try {
      const nyers = localStorage.getItem(PENDING_TOLDAS_KULCS);
      return nyers ? JSON.parse(nyers) : {};
    } catch (err) {
      console.warn('Nem sikerült beolvasni a mentetlen toldásokat:', err);
      return {};
    }
  }

  function pendingToldasIrasa(pending) {
    try {
      localStorage.setItem(PENDING_TOLDAS_KULCS, JSON.stringify(pending));
    } catch (err) {
      console.warn('Nem sikerült elmenteni a toldást (localStorage hiba):', err);
      throw err;
    }
  }

  function pendingToldasMentese(id, rekord, vonalKod) {
    const pending = pendingToldasOlvasas();
    pending[String(id)] = { rekord, vonalKod, mentesIdo: new Date().toISOString() };
    pendingToldasIrasa(pending);
    return pending;
  }

  function pendingToldasTorles(id) {
    const pending = pendingToldasOlvasas();
    delete pending[String(id)];
    pendingToldasIrasa(pending);
    return pending;
  }

  function pendingToldasDarab() {
    return Object.keys(pendingToldasOlvasas()).length;
  }

  // Kötegelt feltöltés egy vonal toldás-fájljába -- `id` mező szerint illeszt, nem
  // _osm_id szerint. Ugyanaz a SHA-ütközés-kezelés (újrapróbálkozás), mint az oszlopoknál.
  // tetelek: [{ id, rekord }, ...]
  async function pendingToldasFeltoltesVonalra(vonalKod, tetelek, maxProbalkozas = 3) {
    const path = `/repos/${REPO}/contents/${fajlUtvonalToldasok(vonalKod)}`;
    for (let probalkozas = 1; probalkozas <= maxProbalkozas; probalkozas++) {
      const getValasz = await githubFetch(`${path}?ref=${BRANCH}`, { method: 'GET' });
      let sorok = [];
      let sha = null;
      if (getValasz.status === 200) {
        const adat = await getValasz.json();
        sha = adat.sha;
        sorok = b64Decode(adat.content.replace(/\n/g, '')).split('\n').filter(s => s.trim() !== '');
      } else if (getValasz.status !== 404) {
        const hibaSzoveg = await getValasz.text().catch(() => '');
        throw new Error(`Nem sikerült lekérni a jelenlegi toldás-fájlt (${getValasz.status}): ${hibaSzoveg}`);
      }

      const idKulcsSzerint = new Map();
      sorok.forEach((sor, i) => {
        try { const o = JSON.parse(sor); if (o.id) idKulcsSzerint.set(String(o.id), i); }
        catch (e) { /* hibás sor, kihagyva az indexelésből, de a sor megmarad érintetlenül */ }
      });
      tetelek.forEach(({ id, rekord }) => {
        const idx = idKulcsSzerint.get(String(id));
        if (idx != null) sorok[idx] = JSON.stringify(rekord);
        else sorok.push(JSON.stringify(rekord));
      });

      const body = {
        message: `${tetelek.length} vezeték-toldás mentése (${vonalKod})`,
        content: b64Encode(sorok.join('\n') + '\n'),
        branch: BRANCH
      };
      if (sha) body.sha = sha;

      const putValasz = await githubFetch(path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (putValasz.ok) return await putValasz.json();
      if (putValasz.status === 409 && probalkozas < maxProbalkozas) { await varakozasUjraprobalkozasElott(probalkozas); continue; }
      const hibaSzoveg = await putValasz.text().catch(() => '');
      throw new Error(`Toldás-feltöltés sikertelen (${putValasz.status}) ${maxProbalkozas} próbálkozás után: ${hibaSzoveg}`);
    }
  }

  // Egyetlen, MÁR FELTÖLTÖTT toldás törlése egy vonal fájljából. Azonnal ír GitHub-ra
  // (nem kerül pending-listába -- egyesével, ritkán történik, kevés (~50) tétel várható).
  // Ugyanaz a GET+SHA+PUT+409-újrapróbálkozás minta, mint a pendingToldasFeltoltesVonalra-nál.
  async function toldasTorleseElesbol(vonalKod, id, maxProbalkozas = 3) {
    const path = `/repos/${REPO}/contents/${fajlUtvonalToldasok(vonalKod)}`;
    for (let probalkozas = 1; probalkozas <= maxProbalkozas; probalkozas++) {
      const getValasz = await githubFetch(`${path}?ref=${BRANCH}`, { method: 'GET' });
      if (getValasz.status === 404) throw new Error('A toldás-fájl nem létezik -- nincs mit törölni.');
      if (getValasz.status !== 200) {
        const hibaSzoveg = await getValasz.text().catch(() => '');
        throw new Error(`Nem sikerült lekérni a toldás-fájlt (${getValasz.status}): ${hibaSzoveg}`);
      }
      const adat = await getValasz.json();
      const sha = adat.sha;
      const sorok = b64Decode(adat.content.replace(/\n/g, '')).split('\n').filter(s => s.trim() !== '');
      const megmaradoSorok = sorok.filter(sor => {
        try { return JSON.parse(sor).id !== id; } catch (e) { return true; } // hibás sor: érintetlenül marad
      });
      if (megmaradoSorok.length === sorok.length) {
        throw new Error('A törlendő toldás nem található a fájlban (esetleg már törölve lett).');
      }

      const body = {
        message: `Vezeték-toldás törlése (${vonalKod}, ${id})`,
        content: b64Encode(megmaradoSorok.length ? megmaradoSorok.join('\n') + '\n' : ''),
        branch: BRANCH,
        sha
      };
      const putValasz = await githubFetch(path, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (putValasz.ok) return await putValasz.json();
      if (putValasz.status === 409 && probalkozas < maxProbalkozas) { await varakozasUjraprobalkozasElott(probalkozas); continue; }
      const hibaSzoveg = await putValasz.text().catch(() => '');
      throw new Error(`Toldás törlése sikertelen (${putValasz.status}) ${maxProbalkozas} próbálkozás után: ${hibaSzoveg}`);
    }
  }

  // Egyetlen, MÁR FELTÖLTÖTT toldás mezőinek szerkesztése (azonnal ír GitHub-ra, mint a
  // törlés). A pozíció (lat/lon) és az id NEM módosul -- ha a helyzet téves, a törlés +
  // újrafelvétel a helyes út, nem a szerkesztés.
  async function toldasSzerkeszteseElesben(vonalKod, id, ujMezok, maxProbalkozas = 3) {
    const path = `/repos/${REPO}/contents/${fajlUtvonalToldasok(vonalKod)}`;
    for (let probalkozas = 1; probalkozas <= maxProbalkozas; probalkozas++) {
      const getValasz = await githubFetch(`${path}?ref=${BRANCH}`, { method: 'GET' });
      if (getValasz.status !== 200) {
        const hibaSzoveg = await getValasz.text().catch(() => '');
        throw new Error(`Nem sikerült lekérni a toldás-fájlt (${getValasz.status}): ${hibaSzoveg}`);
      }
      const adat = await getValasz.json();
      const sha = adat.sha;
      const sorok = b64Decode(adat.content.replace(/\n/g, '')).split('\n').filter(s => s.trim() !== '');
      let talalt = false;
      const ujSorok = sorok.map(sor => {
        try {
          const rekord = JSON.parse(sor);
          if (rekord.id === id) { talalt = true; return JSON.stringify({ ...rekord, ...ujMezok }); }
        } catch (e) { /* hibás sor: érintetlenül marad */ }
        return sor;
      });
      if (!talalt) throw new Error('A szerkesztendő toldás nem található a fájlban.');

      const body = {
        message: `Vezeték-toldás szerkesztése (${vonalKod}, ${id})`,
        content: b64Encode(ujSorok.join('\n') + '\n'),
        branch: BRANCH,
        sha
      };
      const putValasz = await githubFetch(path, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (putValasz.ok) return await putValasz.json();
      if (putValasz.status === 409 && probalkozas < maxProbalkozas) { await varakozasUjraprobalkozasElott(probalkozas); continue; }
      const hibaSzoveg = await putValasz.text().catch(() => '');
      throw new Error(`Toldás szerkesztése sikertelen (${putValasz.status}) ${maxProbalkozas} próbálkozás után: ${hibaSzoveg}`);
    }
  }

  // Egy már regisztrált (oszlop/szelvénykő/útátjáró/egyéb) rekord áthelyezése egy másik
  // vonal fájljába -- pl. amikor az Overpass-regisztráció a vonalak találkozásánál rossz
  // vonalhoz sorolt be egy elemet (lásd 2026-09-26-i egyeztetés). Azonnal ír GitHub-ra,
  // OSM-et nem érinti (a fájl-hovatartozás tisztán a mi belső szervezésünk, nem OSM-tag).
  // Biztonsági sorrend: ELŐBB kerül be az új vonal fájljába, csak utána törlődik a régiből --
  // ha a törlés valamiért elszállna, a rekord átmenetileg inkább duplikálódik, mintsem
  // elvesszen.
  async function rekordAthelyezeseVonalra(regiVonalKod, ujVonalKod, osmId, ujRekord, maxProbalkozas = 3) {
    async function sorBeillesztese(vonalKod, uzenet) {
      const path = `/repos/${REPO}/contents/${fajlUtvonal(vonalKod)}`;
      for (let probalkozas = 1; probalkozas <= maxProbalkozas; probalkozas++) {
        const getValasz = await githubFetch(`${path}?ref=${BRANCH}`, { method: 'GET' });
        let sorok = [];
        let sha = null;
        if (getValasz.status === 200) {
          const adat = await getValasz.json();
          sha = adat.sha;
          sorok = b64Decode(adat.content.replace(/\n/g, '')).split('\n').filter(s => s.trim() !== '');
        } else if (getValasz.status !== 404) {
          const hibaSzoveg = await getValasz.text().catch(() => '');
          throw new Error(`Nem sikerült lekérni a(z) ${vonalKod} fájlt (${getValasz.status}): ${hibaSzoveg}`);
        }
        const mar_ott_van = sorok.some(sor => { try { return String(JSON.parse(sor)._osm_id) === String(osmId); } catch (e) { return false; } });
        if (!mar_ott_van) sorok.push(JSON.stringify(ujRekord));
        const body = { message: uzenet, content: b64Encode(sorok.join('\n') + '\n'), branch: BRANCH };
        if (sha) body.sha = sha;
        const putValasz = await githubFetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (putValasz.ok) return;
        if (putValasz.status === 409 && probalkozas < maxProbalkozas) { await varakozasUjraprobalkozasElott(probalkozas); continue; }
        const hibaSzoveg = await putValasz.text().catch(() => '');
        throw new Error(`Áthelyezés (beillesztés ${vonalKod}) sikertelen (${putValasz.status}): ${hibaSzoveg}`);
      }
    }
    async function sorTorlese(vonalKod, uzenet) {
      const path = `/repos/${REPO}/contents/${fajlUtvonal(vonalKod)}`;
      for (let probalkozas = 1; probalkozas <= maxProbalkozas; probalkozas++) {
        const getValasz = await githubFetch(`${path}?ref=${BRANCH}`, { method: 'GET' });
        if (getValasz.status === 404) return; // nincs mit törölni
        if (getValasz.status !== 200) {
          const hibaSzoveg = await getValasz.text().catch(() => '');
          throw new Error(`Nem sikerült lekérni a(z) ${vonalKod} fájlt (${getValasz.status}): ${hibaSzoveg}`);
        }
        const adat = await getValasz.json();
        const sha = adat.sha;
        const sorok = b64Decode(adat.content.replace(/\n/g, '')).split('\n').filter(s => s.trim() !== '');
        const megmaradoSorok = sorok.filter(sor => { try { return String(JSON.parse(sor)._osm_id) !== String(osmId); } catch (e) { return true; } });
        if (megmaradoSorok.length === sorok.length) return; // nem volt ott, nincs mit törölni
        const body = { message: uzenet, content: b64Encode(megmaradoSorok.length ? megmaradoSorok.join('\n') + '\n' : ''), branch: BRANCH, sha };
        const putValasz = await githubFetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (putValasz.ok) return;
        if (putValasz.status === 409 && probalkozas < maxProbalkozas) { await varakozasUjraprobalkozasElott(probalkozas); continue; }
        const hibaSzoveg = await putValasz.text().catch(() => '');
        throw new Error(`Áthelyezés (törlés ${vonalKod}) sikertelen (${putValasz.status}): ${hibaSzoveg}`);
      }
    }
    await sorBeillesztese(ujVonalKod, `Elem áthelyezve ide (${osmId}: ${regiVonalKod} -> ${ujVonalKod})`);
    await sorTorlese(regiVonalKod, `Elem áthelyezve innen (${osmId}: ${regiVonalKod} -> ${ujVonalKod})`);
  }

  return {
    tokenBeallitasa, token, tokenVan, tokenTorlese, rekordMentese, ujRekordokKotegeltMentese,
    pendingOlvasas, pendingMentese, pendingTorles, pendingDarab, pendingFeltoltesVonalra,
    fajlUtvonalToldasok, pendingToldasOlvasas, pendingToldasMentese, pendingToldasTorles,
    pendingToldasDarab, pendingToldasFeltoltesVonalra, toldasTorleseElesbol, toldasSzerkeszteseElesben,
    rekordAthelyezeseVonalra
  };
})();
