// OSM OAuth 2.0 (PKCE) bejelentkezés — kliens-oldali, szerver nélküli folyamat.
// Nincs client secret (nyilvános/nem bizalmas alkalmazásként regisztrálva az OSM-en),
// ezért a biztonságot a PKCE code_verifier/code_challenge páros adja.
//
// Használat más fájlból:
//   osmAuth.bejelentkezes()              — átirányít az OSM bejelentkező oldalára
//   await osmAuth.visszaterasFeldolgozasa() — hívd meg minden oldalbetöltéskor; true, ha most zajlott le sikeres bejelentkezés
//   osmAuth.tokenVan()                   — van-e mentett hozzáférési token
//   osmAuth.token()                      — a mentett hozzáférési token (vagy null)
//   await osmAuth.sajatAdatok()          — a bejelentkezett OSM-felhasználó adatai
//   osmAuth.kijelentkezes()              — token törlése

const osmAuth = (function () {
  const CLIENT_ID = '8xg7oyYlOaJHoQLpx5-O43MLhskz-SlkE14p5YmvJ2o';
  const REDIRECT_URI = 'https://outsidertwo.github.io/OSM-terkep/';
  const SCOPE = 'write_api openid';
  const AUTHORIZE_URL = 'https://www.openstreetmap.org/oauth2/authorize';
  const TOKEN_URL = 'https://www.openstreetmap.org/oauth2/token';
  const API_BASE = 'https://www.openstreetmap.org/api/0.6';

  const TAROLO_KULCS_TOKEN = 'osm_auth_access_token';
  const TAROLO_KULCS_VERIFIER = 'osm_auth_code_verifier';
  const TAROLO_KULCS_STATE = 'osm_auth_state';

  function veletlenSzoveg(hossz) {
    const tomb = new Uint8Array(hossz);
    crypto.getRandomValues(tomb);
    return base64Url(tomb);
  }

  function base64Url(byteTomb) {
    let bin = '';
    byteTomb.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function sha256(szoveg) {
    const kodolt = new TextEncoder().encode(szoveg);
    const hash = await crypto.subtle.digest('SHA-256', kodolt);
    return base64Url(new Uint8Array(hash));
  }

  // Átirányítja a böngészőt az OSM bejelentkező/engedélyező oldalára.
  async function bejelentkezes() {
    const verifier = veletlenSzoveg(64);
    const state = veletlenSzoveg(16);
    const challenge = await sha256(verifier);

    sessionStorage.setItem(TAROLO_KULCS_VERIFIER, verifier);
    sessionStorage.setItem(TAROLO_KULCS_STATE, state);

    const parameterek = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPE,
      state: state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });
    window.location.href = `${AUTHORIZE_URL}?${parameterek.toString()}`;
  }

  // Az oldal betöltésekor hívandó: ha az URL-ben ?code=...&state=... szerepel
  // (mert az OSM most irányított vissza minket sikeres engedélyezés után),
  // beváltja a kódot hozzáférési tokenre, és megtisztítja a URL-t.
  // Visszaadja: true, ha most zajlott le sikeres bejelentkezés; egyébként false.
  async function visszaterasFeldolgozasa() {
    const parameterek = new URLSearchParams(window.location.search);
    const kod = parameterek.get('code');
    const state = parameterek.get('state');
    if (!kod) return false;

    const mentettState = sessionStorage.getItem(TAROLO_KULCS_STATE);
    const verifier = sessionStorage.getItem(TAROLO_KULCS_VERIFIER);
    sessionStorage.removeItem(TAROLO_KULCS_STATE);
    sessionStorage.removeItem(TAROLO_KULCS_VERIFIER);

    // A URL-ből mindenképp töröljük a code/state paramétereket, hogy egy
    // esetleges frissítésnél (F5) ne próbálja újra beváltani ugyanazt a kódot.
    const tisztaUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, tisztaUrl);

    if (!mentettState || state !== mentettState) {
      console.warn('OSM bejelentkezés: state eltérés, a kérést eldobjuk (esetleg CSRF-kísérlet vagy elévült munkamenet).');
      return false;
    }
    if (!verifier) {
      console.warn('OSM bejelentkezés: hiányzó code_verifier (talán új lapon nyílt meg a visszatérés).');
      return false;
    }

    const valaszTest = new URLSearchParams({
      grant_type: 'authorization_code',
      code: kod,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier
    });

    const valasz = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: valaszTest.toString()
    });
    if (!valasz.ok) {
      console.error('OSM bejelentkezés: a token-csere sikertelen volt (' + valasz.status + ').');
      return false;
    }
    const adat = await valasz.json();
    localStorage.setItem(TAROLO_KULCS_TOKEN, adat.access_token);
    return true;
  }

  function tokenVan() {
    return !!localStorage.getItem(TAROLO_KULCS_TOKEN);
  }

  function token() {
    return localStorage.getItem(TAROLO_KULCS_TOKEN);
  }

  function kijelentkezes() {
    localStorage.removeItem(TAROLO_KULCS_TOKEN);
  }

  // Lekéri a bejelentkezett OSM-felhasználó adatait (pl. felhasználónév megjelenítéséhez).
  async function sajatAdatok() {
    const t = token();
    if (!t) throw new Error('Nincs bejelentkezve.');
    const valasz = await fetch(`${API_BASE}/user/details.json`, {
      headers: { Authorization: `Bearer ${t}` }
    });
    if (!valasz.ok) {
      if (valasz.status === 401) kijelentkezes(); // a token lejárt/visszavonták
      throw new Error('Nem sikerült lekérni a felhasználói adatokat (' + valasz.status + ').');
    }
    const adat = await valasz.json();
    return adat.user;
  }

  return { bejelentkezes, visszaterasFeldolgozasa, tokenVan, token, kijelentkezes, sajatAdatok, API_BASE };
})();
