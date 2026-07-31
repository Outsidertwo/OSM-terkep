// Terkep-specifikus logika: Overpass-lekeres, tipus/reteg-definiciok, marker-
// renderelesi, cluster, vonal-panel, szerkeszto-modal. Az oszlop-tag visszafejtes
// es a fordito szotarak az oszlop_visszafejto.js-ben vannak (kozos az adatlappal).

  const map = L.map('map').setView([47.35, 19.85], 10);


  // --- Alaptérkép réteg-választó (OSM standard / műholdas) ---
  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 21,
    maxNativeZoom: 19, // a hivatalos OSM-csempeszerver ténylegesen csak 19-ig rendel valódi csempét
    attribution: '&copy; OpenStreetMap közreműködők'
  });
  // Google Műhold közvetlen, kulcs nélküli beágyazása nem szabályos, ezért Esri World Imagery helyettesíti.
  // Az Esri csempéi sok helyen csak 19-es zoomig léteznek ténylegesen — afölött a maxNativeZoom
  // nélkül üres/szürke csempét adna. maxNativeZoom-mal a böngésző a legrészletesebb elérhető
  // csempét nagyítja fel tovább, ahelyett hogy semmit se mutatna.
  // Az Esri csempéi sok helyen csak 19-es zoomig léteznek ténylegesen — vidéki, kevésbé
  // sűrűn fedett területeken (mint egy regionális vasútvonal) ez a valós felbontási határ
  // gyakran ennél is alacsonyabb. maxNativeZoom-mal a böngésző a legrészletesebb elérhető
  // csempét nagyítja fel tovább, ahelyett hogy semmit se mutatna.
  const satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 21,
      maxNativeZoom: 17,
      attribution: 'Tiles &copy; Esri — Esri, Maxar, Earthstar Geographics'
    }
  );
  osmLayer.addTo(map);

  // --- GPS gomb ---
  L.control.locate({ position: 'topleft', strings: { title: 'Saját pozícióm' }, flyTo: true }).addTo(map);

  const statusEl = document.getElementById('status');

  // A vonalanként (élőben) letöltött, összes elem — ebből szűr a "Figyelt vonalak" panel,
  // hálózati kérés nélkül. Minden elem properties._vonal mezője jelzi, melyik vonalhoz
  // tartozik (átfedő vonalaknál egy elem csak az őt ténylegesen tartalmazó vonalhoz tartozik).
  let osszesFeature = [];

  // Szerkesztői mód — csak ekkor mozgathatók az elemek. FONTOS: ez egyelőre csak felületi
  // kapcsoló, nem valódi jogosultságkezelés (bárki bepipálhatja) — a tényleges védelem majd
  // a token-alapú beléptetéssel készül el a 2. fázisban.
  let szerkesztoiMod = false;
  const osszesMarker = []; // minden létrehozott marker, hogy a mód váltásakor egyben tudjuk (de)aktiválni a húzást
  document.getElementById('szerkesztoiModKapcsolo').addEventListener('change', (ev) => {
    szerkesztoiMod = ev.target.checked;
    osszesMarker.forEach(m => {
      if (szerkesztoiMod) m.dragging.enable();
      else m.dragging.disable();
    });
  });

  // A zoomszint, ami felett a clusterek egyedi pontokra bomlanak és a címkék megjelennek.
  // Egyelőre ideiglenes érték, terepi tapasztalat alapján finomítható.
  const LABEL_ZOOM = 16;

  // Útátjáró-csoportosítás: ilyen távolságon belüli level_crossing node-okat
  // egy logikai objektumként kezelünk (a legszélesebb, 4 vágányos átjáró ~25 m).
  const CROSSING_GROUP_RADIUS_M = 30;

  // ============================================================
  // FIGYELT VONALAK ÉS ÜZEMELTETŐ
  // A vonalak.json külön fájlból töltődik be induláskor (lásd inditas),
  // hogy bővítéskor / névváltozáskor ne kelljen a kódhoz nyúlni. Ha a
  // fájl valamiért nem érhető el, ez a két érték biztonsági alapértelmezés.
  // ============================================================
  let UZEMELTETO = 'MÁV';
  let OSZLOP_SEMA = null; // az adatlap_oszlop.json — a popup ezzel jeleníti meg a valódi mezőket, tag-dömping helyett
  let VONALAK = [
    { nev: '120a (Budapest–Szolnok)', relation: 252069, aktiv: true },
    { nev: '82 (Hatvan–Újszász)', relation: 77374, aktiv: true }
  ];

  // ============================================================
  // TÍPUSDEFINÍCIÓK
  // (Ez a blokk később egy külön konfiguracio.json fájlba kerül majd ki.)
  // ============================================================
  const TYPES = [
    {
      key: 'oszlop',
      label: 'Felsővezeték-oszlop',
      color: '#1ae86b',
      shape: 'circle',
      test: (t) => t.power === 'catenary_mast',
      buildLabelHtml: (t) => {
        // Azonosító (oszlopszám) — fekete. Hosszabb távon ref= a helyes tag,
        // de amíg a meglévő oszlopok name=-ben vannak, mindkettőt kezeljük.
        const idRaw = t.ref || t.name;
        const idPart = idRaw ? `<span class="label-id">${escapeHtml(idRaw)}</span>` : '';

        // Leíró adatok — típus + aktív logikai jelzők, második színnel.
        // Ezek egyelőre saját (nem hivatalos OSM) mezők, a nevük még finomítható,
        // amint elkészül az adatlap és eldől a tényleges tag-elnevezés.
        const descBits = [];
        if (t.tipus_betujel) descBits.push(escapeHtml(t.tipus_betujel));
        if (t.szikrakoz === 'yes') descBits.push('szk');
        if (t.sulyos === 'yes') descBits.push('s');
        if (t.fixpont === 'yes') descBits.push('fx');
        if (t.foldelesipont === 'yes') descBits.push('fp');
        const descPart = descBits.length > 0
          ? `<span class="label-desc">${descBits.join(' ')}</span>`
          : '';

        if (!idPart && !descPart) return null;
        return idPart + descPart;
      }
    },
    {
      key: 'szelvenyko',
      label: 'Szelvénykő',
      color: '#1a73e8',
      shape: 'diamond',
      test: (t) => t.railway === 'milestone',
      buildLabelHtml: (t) => {
        if (!t.name) return null;
        return `<span class="label-id">${escapeHtml(t.name)}</span>`;
      }
    },
    {
      key: 'atjaro',
      label: 'Útátjáró',
      color: '#e8341a',
      shape: 'cross',
      test: (t) => t.railway === 'level_crossing', // operator-tól függetlenül is idesorolva (lásd bővített Overpass-lekérdezés)
      groupRadiusM: CROSSING_GROUP_RADIUS_M,
      buildLabelHtml: (t) => {
        const parts = [];
        if (t.ref) parts.push(escapeHtml(t.ref));
        if (t.maxheight) parts.push(escapeHtml(t.maxheight) + ' m');
        if (parts.length === 0) return null;
        return `<span class="label-id">${parts.join(' · ')}</span>`;
      }
    },
    {
      key: 'egyeb',
      label: 'Egyéb MÁV elem',
      color: '#999999',
      shape: 'circle',
      defaultVisible: false, // gyűjtő kategória (kitérő, jelző, állomás stb.) — csak kérésre jelenjen meg
      test: () => true, // gyűjtő kategória: minden, ami nem a fenti három típus egyike
      buildLabelHtml: (t) => {
        const idRaw = t.ref || t.name;
        return idRaw ? `<span class="label-id">${escapeHtml(idRaw)}</span>` : null;
      }
    }
  ];
  // Egyelőre rejtve: railway=switch / signal / station / halt / stop / junction / radio stb.

  // ============================================================
  // MAGYAR FORDÍTÁSI SZÓTÁR
  // (Ez a blokk is a későbbi konfiguracio.json-ba kerül majd ki.)
  // Cél: a popup ablak és az adatlap magyarul jelenjen meg,
  // a mögöttes OSM-tagek angol nevei/értékei változatlanok maradnak.
  // ============================================================
  // Az Overpass Turbo GeoJSON-exportja ezeket a kozmetikai (nem valódi OSM-tag) mezőket
  // is hozzáadja a stílus alapján — ezek a popupban csak zajt jelentenének, kiszűrjük.
  // REJTETT_MEZOK, MEZO_FORDITAS, ERTEK_FORDITAS, magyarMezonev, magyarErtek,
  // escapeHtml: lásd oszlop_visszafejto.js (közös az adatlappal)

  // --- Cluster-csoportok, típusonként külön ---
  const clusterGroups = {};
  TYPES.forEach(type => {
    clusterGroups[type.key] = L.markerClusterGroup({
      disableClusteringAtZoom: LABEL_ZOOM,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="background:${type.color}; color:white; border-radius:50%;
                      width:34px; height:34px; display:flex; align-items:center;
                      justify-content:center; font-weight:bold; font-size:12px;
                      border:2px solid white; box-shadow:0 0 3px rgba(0,0,0,0.6);">
                   ${count}
                 </div>`,
          className: '', iconSize: [34, 34]
        });
      }
    });
    if (type.defaultVisible !== false) {
      clusterGroups[type.key].addTo(map);
    }
  });

  function makeIcon(color, shape) {
    const shapeClass = shape === 'diamond' ? 'diamond' : (shape === 'cross' ? 'cross' : '');
    const inner = shape === 'diamond' ? 'width:12px; height:12px;' : 'width:14px; height:14px;';
    return L.divIcon({
      className: `mav-icon ${shapeClass}`,
      html: `<div style="background:${color}; ${inner} border-radius:${shape === 'cross' ? '3px' : '50%'};"></div>`,
      iconSize: [14, 14]
    });
  }

  // Ugyanaz a legjobb-erőfeszítés visszafejtés, mint az adatlap_motor.js-ben — a nyers OSM
  // tagekből a séma alapján előállítja a magyar mezőnév → megjelenítendő érték párokat.
  // Csak azt mutatja, ami ténylegesen "aktív" (be van pipálva / illeszkedik egy opcióra) —
  // üzemeltető, power= stb. nyers mezők szándékosan nem kerülnek bele.
  // A visszafejtést az oszlop_visszafejto.js közös visszafejtOszlopAdatokat() végzi
  // (ugyanaz a logika, mint amit az adatlap_motor.js is használ import-hoz).

  function popupContent(tags, type) {
    let rows;
    if (type && type.key === 'oszlop' && OSZLOP_SEMA) {
      const { sorok } = visszafejtOszlopAdatokat(OSZLOP_SEMA, tags);
      rows = sorok.length > 0
        ? sorok.map(m => `<tr><td>${escapeHtml(m.nev)}</td><td>${escapeHtml(String(m.ertek))}</td></tr>`).join('')
        : `<tr><td colspan="2" style="color:#888;">Még nincs rögzített adat ezen az oszlopon</td></tr>`;
    } else {
      rows = Object.entries(tags)
        .filter(([k]) => !REJTETT_MEZOK.has(k) && k !== '_vonal')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `<tr><td>${escapeHtml(magyarMezonev(k))}</td><td>${escapeHtml(magyarErtek(k, v))}</td></tr>`)
        .join('');
    }

    // Szerkesztés gomb — egyelőre csak oszlophoz van kész adatlap-séma.
    // A tagek base64-kódolva mennek a modal-iframe URL-jébe; az adatlap_teszt.html
    // ebből próbálja előtölteni a mezőket (legjobb-erőfeszítés, nem tökéletes).
    let szerkesztoGomb = '';
    if (type && type.key === 'oszlop') {
      const tisztaTagek = { ...tags };
      delete tisztaTagek._vonal;
      const kodolt = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(tisztaTagek)))));
      szerkesztoGomb = `<div style="margin-top:8px;">
        <button onclick="megnyitSzerkesztoModal('${kodolt}')"
                style="font-size:13px; padding:4px 10px; border:1px solid #ccc; border-radius:4px; background:#f0f0f0; cursor:pointer;">
          Szerkesztés
        </button>
      </div>`;
    }

    return `<table class="popup-table">${rows}</table>${szerkesztoGomb}`;
  }

  // --- Szerkesztő-modal (iframe) ---
  function megnyitSzerkesztoModal(kodoltTagek) {
    document.getElementById('szerkesztoIframe').src = `adatlap_teszt.html?tagek=${kodoltTagek}&modal=1`;
    document.getElementById('szerkesztoModal').style.display = 'block';
  }
  function bezarSzerkesztoModal() {
    document.getElementById('szerkesztoModal').style.display = 'none';
    document.getElementById('szerkesztoIframe').src = 'about:blank';
  }
  document.getElementById('szerkesztoModalBezar').addEventListener('click', bezarSzerkesztoModal);
  // Ha az iframe-ben lévő adatlap_teszt.html jelzi (postMessage), hogy be szeretné záratni magát.
  window.addEventListener('message', (ev) => {
    if (ev.data === 'adatlap-bezaras-kerve') bezarSzerkesztoModal();
  });

  function classify(tags) {
    for (const type of TYPES) {
      if (type.test(tags)) return type;
    }
    return null;
  }

  // --- Haversine távolság méterben ---
  function distanceM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }

  // --- Közeli, azonos típusú pontok csoportosítása (pl. útátjárók vágányonként) ---
  function groupPoints(points, radiusM) {
    const groups = [];
    points.forEach(p => {
      let target = null;
      for (const g of groups) {
        if (distanceM(g.lat, g.lon, p.lat, p.lon) <= radiusM) { target = g; break; }
      }
      if (target) {
        target.members.push(p);
        target.lat = target.members.reduce((s, m) => s + m.lat, 0) / target.members.length;
        target.lon = target.members.reduce((s, m) => s + m.lon, 0) / target.members.length;
      } else {
        groups.push({ lat: p.lat, lon: p.lon, members: [p] });
      }
    });
    return groups;
  }

  // --- Réteg-választó: alaptérkép + elemtípusok ---
  const layerControl = L.control.layers(
    { 'OpenStreetMap': osmLayer, 'Műholdas (Esri)': satelliteLayer },
    {}, { collapsed: false, position: 'topright' }
  ).addTo(map);
  TYPES.forEach(type => layerControl.addOverlay(clusterGroups[type.key], type.label));

  function addMarker(type, lat, lon, tags, memberCount, feature) {
    const marker = L.marker([lat, lon], { icon: makeIcon(type.color, type.shape), draggable: szerkesztoiMod });
    marker.bindPopup(popupContent(tags, type));
    const labelHtml = type.buildLabelHtml(tags);
    if (labelHtml) {
      marker.bindTooltip(labelHtml, {
        permanent: true, direction: 'right', offset: [8, 0], className: 'mav-label'
      });
    }

    // Húzással áthelyezhető, DE csak szerkesztői módban — mezei (néző) felhasználó nem tudja
    // elmozdítani. Egyelőre csak a böngésző memóriájában/a "Mentés adatok.geojson-ként"
    // exportban frissül a pozíció, élő OSM-írás még nincs bekötve (2. fázis).
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      if (feature && feature.geometry) {
        feature.geometry.coordinates = [pos.lng, pos.lat];
      }
      console.info('Elem áthelyezve (csak helyben, OSM-re még nincs visszaírva):', tags.ref || tags.name || '(?)', pos);
    });

    osszesMarker.push(marker);
    clusterGroups[type.key].addLayer(marker);
  }

  function loadGeoJSON(geojson) {
    TYPES.forEach(t => clusterGroups[t.key].clearLayers());
    osszesMarker.length = 0;
    const counts = {};
    TYPES.forEach(t => counts[t.key] = 0);

    // Elsőként típusonként szétválogatjuk a pontokat.
    const byType = {};
    TYPES.forEach(t => byType[t.key] = []);

    geojson.features.forEach(f => {
      if (!f.geometry || f.geometry.type !== 'Point' || !f.properties) return;
      const tags = f.properties;
      const type = classify(tags); // az "egyeb" gyűjtőtípus miatt ez sosem null
      const [lon, lat] = f.geometry.coordinates;
      byType[type.key].push({ lat, lon, tags, feature: f });
    });

    TYPES.forEach(type => {
      const points = byType[type.key];
      if (type.groupRadiusM) {
        // Csoportosítandó típus (pl. útátjáró): közeli pontokat összevonjuk.
        const groups = groupPoints(points, type.groupRadiusM);
        groups.forEach(g => {
          addMarker(type, g.lat, g.lon, g.members[0].tags, g.members.length, g.members[0].feature);
          counts[type.key]++;
        });
      } else {
        points.forEach(p => {
          addMarker(type, p.lat, p.lon, p.tags, undefined, p.feature);
          counts[type.key]++;
        });
      }
    });

    const summary = TYPES.map(t => `${t.label}: ${counts[t.key]}`).join(' · ');
    statusEl.textContent = `Betöltve — ${summary}`;

    const allLayers = TYPES.map(t => clusterGroups[t.key]).filter(g => g.getLayers().length > 0);
    if (allLayers.length > 0) {
      const group = L.featureGroup(allLayers.flatMap(g => g.getLayers()));
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  // Élő Overpass-lekérdezés VONALANKÉNT (nem összevonva) — ez teszi lehetővé, hogy a
  // "Figyelt vonalak" pipálás utólag, hálózati kérés nélkül tudjon szűrni, még akkor is,
  // ha két vonal fizikailag átfedi egymást (pl. egy csomópontnál).
  function buildOverpassQueryForLine(line) {
    return `
      [out:json][timeout:180];
      rel(${line.relation}); way(r)->.w;
      node(around.w:50)["operator"="${UZEMELTETO}"]->.elemek;
      .elemek out body;
    `;
  }

  // Több Overpass-tükör, sorban kipróbálva — ha az egyik hibázik vagy időtúllépést ad,
  // a következővel próbálkozunk. Ha egyik sem válaszol időben, a .html mellé tett
  // helyi GeoJSON-fájlra esik vissza (adatok.geojson), hogy gyenge/nincs neten is működjön.
  const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];
  const OVERPASS_TIMEOUT_MS = 25000; // egy-egy tükörre max ennyit várunk
  const LOCAL_SNAPSHOT_PATH = './adatok.geojson';

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchOverpassWithFallback(query) {
    if (!navigator.onLine) {
      throw new Error('Nincs internetkapcsolat, helyi fájlra váltás.');
    }
    let lastError = null;
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        statusEl.textContent = `Élő adat lekérése (${endpoint.split('/')[2]})...`;
        const res = await fetchWithTimeout(endpoint, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(query)
        }, OVERPASS_TIMEOUT_MS);
        if (!res.ok) throw new Error(`${endpoint} — HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        console.warn('Overpass tükör sikertelen:', endpoint, err);
        lastError = err;
      }
    }
    throw lastError || new Error('Ismeretlen hiba az Overpass-lekérdezés közben.');
  }

  function overpassToGeoJSON(data, vonalNev) {
    return data.elements
      .filter(el => el.type === 'node')
      .map(el => ({
        type: 'Feature',
        properties: { ...(el.tags || {}), _vonal: vonalNev },
        geometry: { type: 'Point', coordinates: [el.lon, el.lat] }
      }));
  }

  async function loadLocalSnapshot() {
    statusEl.textContent = 'Helyi adatfájl betöltése (adatok.geojson)...';
    const res = await fetch(LOCAL_SNAPSHOT_PATH);
    if (!res.ok) throw new Error(`Helyi fájl sem elérhető (HTTP ${res.status})`);
    return await res.json();
  }

  // A ténylegesen megjelenő adatot az aktív vonalak alapján, hálózati kérés nélkül állítja
  // elő az osszesFeature-ből — ezt hívja a checkbox-pipálás is.
  function alkalmazSzurokEsRajzol() {
    const aktivNevek = new Set(VONALAK.filter(v => v.aktiv).map(v => v.nev));
    // Ha egy elemen nincs _vonal jelölés (pl. régebbi, a vonalankénti lekérés előtti mentésből
    // származik), biztonságból megjelenítjük — jobb, mint véletlenül eltüntetni valamit.
    const szurt = osszesFeature.filter(f => !f.properties._vonal || aktivNevek.has(f.properties._vonal));
    loadGeoJSON({ type: 'FeatureCollection', features: szurt });
  }

  const letoltottVonalak = new Set(); // már lekért vonalnevek — ugyanazt a vonalat nem kérjük le kétszer

  async function betoltesIndul() {
    const letoltendok = VONALAK.filter(v => v.aktiv && !letoltottVonalak.has(v.nev));
    if (letoltendok.length === 0) {
      // Minden bepipált vonal már le van töltve — csak szűrünk, nincs hálózati kérés.
      alkalmazSzurokEsRajzol();
      statusEl.textContent = 'Nincs új letöltendő vonal (a bepipáltak már be vannak töltve).';
      return;
    }

    statusEl.style.color = '';
    statusEl.textContent = `Élő adat lekérése (${letoltendok.map(v => v.nev).join(', ')})...`;
    const eredmenyek = await Promise.allSettled(
      letoltendok.map(line => fetchOverpassWithFallback(buildOverpassQueryForLine(line))
        .then(data => overpassToGeoJSON(data, line.nev)))
    );

    const sikeres = [];
    const sikertelenVonalak = [];
    eredmenyek.forEach((eredmeny, i) => {
      if (eredmeny.status === 'fulfilled') {
        sikeres.push(...eredmeny.value);
        letoltottVonalak.add(letoltendok[i].nev);
      } else {
        sikertelenVonalak.push(letoltendok[i].nev);
        console.warn('Vonal betöltése sikertelen:', letoltendok[i].nev, eredmeny.reason);
      }
    });

    if (sikeres.length === 0 && sikertelenVonalak.length > 0 && osszesFeature.length === 0) {
      // Semmi sem jött be élőben, és eddig sincs semmi adatunk — helyi fájlra esünk vissza.
      console.warn('Egyik vonal sem tölthető be élőben, helyi fájlra váltás.');
      try {
        const geojson = await loadLocalSnapshot();
        osszesFeature = geojson.features;
        geojson.features.forEach(f => { if (f.properties._vonal) letoltottVonalak.add(f.properties._vonal); });
        alkalmazSzurokEsRajzol();
        statusEl.textContent += ' (helyi mentett adat — nem feltétlenül friss!)';
        statusEl.style.color = '#b36b00';
      } catch (err2) {
        statusEl.textContent = 'Sem élő adat, sem helyi fájl nem elérhető: ' + err2.message;
        statusEl.style.color = 'red';
      }
      return;
    }

    osszesFeature = osszesFeature.concat(sikeres);
    alkalmazSzurokEsRajzol();
    statusEl.textContent = sikertelenVonalak.length > 0
      ? `Betöltve — de nem sikerült: ${sikertelenVonalak.join(', ')}`
      : 'Betöltve (élő adat)';
    if (sikertelenVonalak.length > 0) statusEl.style.color = '#b36b00';

    // Sikeres élő betöltés után felkínáljuk, hogy ez legyen az új helyi mentés is —
    // a böngésző biztonsági okból nem írhat csendben a lemezre, ezért ez egy
    // egykattintásos letöltés, amit utána a repóba kell másolni.
    const saveBtn = document.getElementById('saveSnapshotBtn');
    saveBtn.style.display = 'block';
    saveBtn.onclick = () => {
      const geojson = { type: 'FeatureCollection', features: osszesFeature };
      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'adatok.geojson';
      a.click();
      URL.revokeObjectURL(url);
    };
  }

  document.getElementById('adatokLetoltesBtn').addEventListener('click', () => { betoltesIndul(); });

  // --- Figyelt vonalak panel: pipálható lista, változtatáskor újratölti az adatot ---
  const vonalListaEl = document.getElementById('vonalLista');
  function vonalListaKirajzolas() {
    vonalListaEl.innerHTML = `
      <div style="margin-bottom:6px; color:#555;">Üzemeltető: <strong>${escapeHtml(UZEMELTETO)}</strong> (a vonalak.json-ban módosítható)</div>
      ` + VONALAK.map((v, i) => `
      <label style="display:block; white-space:nowrap;">
        <input type="checkbox" data-vonal-index="${i}" ${v.aktiv ? 'checked' : ''} />
        ${escapeHtml(v.nev)}
      </label>
    `).join('');
    vonalListaEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (ev) => {
        const idx = Number(ev.target.dataset.vonalIndex);
        VONALAK[idx].aktiv = ev.target.checked;
        if (VONALAK.every(v => !v.aktiv)) {
          statusEl.textContent = 'Legalább egy vonalat aktívnak kell hagyni.';
          statusEl.style.color = 'red';
          ev.target.checked = true;
          VONALAK[idx].aktiv = true;
          return;
        }
        alkalmazSzurokEsRajzol(); // csak szűrés a már betöltött adaton — új vonalhoz az "Adatok letöltése" gomb kell
      });
    });
  }

  // Induláskor: előbb a vonalak.json betöltése, utána az adatlekérés.
  // Ha a fájl nem érhető el (pl. hiányzik, vagy hibás JSON), a beépített
  // alapértelmezett VONALAK-kal folytatjuk, csak jelezzük a státuszsávban.
  async function inditas() {
    try {
      const res = await fetch('./vonalak.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const config = await res.json();
      UZEMELTETO = config.uzemelteto;
      VONALAK = config.vonalak;
    } catch (err) {
      console.warn('vonalak.json nem tölthető be, beépített alapértelmezés marad:', err);
      statusEl.textContent = 'Figyelmeztetés: vonalak.json nem tölthető be, beépített alapértelmezéssel indul.';
    }
    try {
      const res2 = await fetch('./adatlap_oszlop.json');
      if (!res2.ok) throw new Error('HTTP ' + res2.status);
      OSZLOP_SEMA = await res2.json();
    } catch (err) {
      console.warn('adatlap_oszlop.json nem tölthető be — az oszlop-popupok a nyers tageket mutatják majd:', err);
    }
    vonalListaKirajzolas();
    // Nincs automatikus letöltés — a felhasználó választja ki a vonalakat,
    // és az "Adatok letöltése" gombbal indítja el a lekérdezést.
  }
  inditas();

  // Kézi felülbírálás — bármikor használható, függetlenül attól, hogy az élő adat
  // "sikeresnek" tűnt-e (pl. ha egy Overpass-tükör hibás/hiányos, de HTTP 200-at ad vissza).
  document.getElementById('manualFileInput').addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    statusEl.textContent = 'Kézi fájl beolvasása...';
    statusEl.style.color = '';
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const geojson = JSON.parse(e.target.result);
        osszesFeature = geojson.features;
        geojson.features.forEach(f => { if (f.properties._vonal) letoltottVonalak.add(f.properties._vonal); });
        alkalmazSzurokEsRajzol();
        statusEl.textContent += ' (kézi fájlból)';
        statusEl.style.color = '#b36b00';
      } catch (err) {
        statusEl.textContent = 'Hiba a fájl feldolgozásakor: ' + err.message;
        statusEl.style.color = 'red';
      }
    };
    reader.readAsText(file);
  });