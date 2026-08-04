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
  const FAJL_UTVONAL = 'sajat_adatok.ndjson';
  const BRANCH = 'main';
  const API_BASE = 'https://api.github.com';
  const TAROLO_KULCS = 'github_pat_token';

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

  // Egyetlen rekord mentése/frissítése a közös fájlban. `kulcs` az oszlopszám (vagy bármi
  // más egyedi azonosító), `rekord` egy sima JS objektum. A fájl már meglévő, más
  // oszlopokhoz tartozó sorai érintetlenül maradnak.
  async function rekordMentese(kulcs, rekord) {
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
      message: `Oszlop ${kulcs} adatainak mentése`,
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

  return { tokenBeallitasa, token, tokenVan, tokenTorlese, rekordMentese };
})();
