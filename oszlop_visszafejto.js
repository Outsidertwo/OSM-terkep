// Közös, DOM-független logika, amit a térkép (terkep_motor.js) ÉS az adatlap
// (adatlap_motor.js) is használ. Cél: a "tagekből magyar mező/érték" visszafejtés
// és a fordítási szótárak EGY helyen legyenek, hogy ne csússzanak szét a két oldal
// között (ahogy korábban a térképi címke és az adatlap-előnézet eltért egymástól).
//
// Ezt a fájlt <script src="./oszlop_visszafejto.js"></script>-tal kell betölteni
// MINDKÉT html-ben, a motor-fájlok ELŐTT.

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function illikOsmDefinicioba(tags, osmDef) {
  if (!osmDef) return false;
  return Object.entries(osmDef).every(([k, v]) => tags[k] === v);
}

// Hosszabb kódok elöl, hogy a regex ne a rövidebb részstringre illeszkedjen (pl. "KR" előbb, mint "K").
const OSZLOP_TIPUS_KODOK = ['MKR', 'KR', 'Ta', 'CSŐ', 'T', 'L', 'F', 'K', 'P', 'BM'];
const ALAPTIPUS_KODOK = ['LE', 'A', 'B', 'U', 'C', 'V', 'Z', 'Y', 'D', 'E', 'F', 'G'];

// A típusbetűt (F/K/KR/MKR stb.) a name/ref mező VÉGÉBŐL olvassuk ki — ez megbízhatóbb,
// mint a structure=/material= tag-kombináció, mert pl. F/K/KR/MKR mind structure=lattice-t ad,
// tehát önmagában a tagekből nem egyértelmű, melyikről van szó.
function oszlopTipusBetuNevbol(tags) {
  const nevVagyRef = tags.name || tags.ref || '';
  const minta = new RegExp(`\\s(${OSZLOP_TIPUS_KODOK.join('|')})$`);
  const talalat = nevVagyRef.match(minta);
  return talalat ? talalat[1] : null;
}

// Legjobb-erőfeszítés visszafejtés: egy bejövő OSM tag-készletből (tags) a séma (sema)
// osm-leképezéseit fordítva használva előállítja:
//  - allapot: { mezo_kod: érték } — az adatlap-űrlap kitöltéséhez (checkbox: true, radio: kod, szoveg: nyers érték)
//  - sorok: [{ kod, nev, ertek }] — megjelenítésre kész, magyar (popup, térképi címke)
// Nem tökéletes: ha több mező is ugyanarra a tag-kombinációra illeszkedne, az elsőt fogadja el
// (kivéve az oszlop_tipus-t, amit a végén a name/ref alapján felülír, ha talál benne típusbetűt).
function visszafejtOszlopAdatokat(sema, tags) {
  const allapot = {};
  const sorok = [];

  function feldolgoz(mezok) {
    mezok.forEach(m => {
      if (m.rejtett) { if (m.gyerek_mezok) feldolgoz(m.gyerek_mezok); return; }
      let aktiv = false, ertekAllapotnak = null, ertekMegjelenitve = null;
      if (m.tipus === 'checkbox') {
        aktiv = illikOsmDefinicioba(tags, m.osm);
        if (aktiv) { ertekAllapotnak = true; ertekMegjelenitve = 'igen'; }
      } else if (m.tipus === 'radio' || m.tipus === 'select') {
        const talalt = m.opciok && m.opciok.find(o => illikOsmDefinicioba(tags, o.osm));
        if (talalt) { aktiv = true; ertekAllapotnak = talalt.kod; ertekMegjelenitve = talalt.nev; }
      } else if (m.osm) {
        const bej = Object.entries(m.osm);
        if (bej.length === 1 && bej[0][1] === '{ertek}' && tags[bej[0][0]] !== undefined) {
          aktiv = true;
          ertekAllapotnak = tags[bej[0][0]];
          ertekMegjelenitve = tags[bej[0][0]];
        }
      }
      if (aktiv) {
        allapot[m.kod] = ertekAllapotnak;
        sorok.push({ kod: m.kod, nev: m.nev, ertek: ertekMegjelenitve });
      }
      if (m.gyerek_mezok && aktiv) feldolgoz(m.gyerek_mezok);
    });
  }
  feldolgoz(sema.mezok);

  const tipusBetu = oszlopTipusBetuNevbol(tags);
  if (tipusBetu) {
    allapot['oszlop_tipus'] = tipusBetu;
    const tipusMezo = sema.mezok.find(m => m.kod === 'oszlop_tipus');
    const opcio = tipusMezo && tipusMezo.opciok.find(o => o.kod === tipusBetu);
    const nev = tipusMezo ? tipusMezo.nev : 'Oszlop típusa';
    const ertekMegjelenitve = opcio ? opcio.nev : tipusBetu;
    const meglevo = sorok.findIndex(s => s.kod === 'oszlop_tipus');
    if (meglevo >= 0) sorok[meglevo].ertek = ertekMegjelenitve;
    else sorok.push({ kod: 'oszlop_tipus', nev, ertek: ertekMegjelenitve });
  }

  return { allapot, sorok };
}

function magyarTizedes(ertek, tizedesek) {
  if (ertek === '' || ertek === undefined || ertek === null) return '';
  const szam = Number(String(ertek).replace(',', '.'));
  if (isNaN(szam)) return '';
  return szam.toFixed(tizedesek === undefined ? 1 : tizedesek).replace('.', ',');
}

// ============================================================
// FESZÍTÉSI TERV KONVERTER
// B→A (formázó): a strukturált adatból (allapot) összerakja a tömör szöveget.
// A→B (értelmező): a tömör szövegből visszafejti a mezőket.
// Csak azt a mezőkört fedi le, ami ténylegesen szerepel a feszítési terv
// jelölésben (típus, hossz, alaptest, betonmennyiség, kihúzás, lehorgonyzás) —
// a térképi/OSM jelzők (súly, szikraköz stb.) nem részei ennek a szövegnek.
// ============================================================

function epitsFeszitesiTervSzoveget(allapot) {
  const tipus = allapot['oszlop_tipus'] || '';
  if (!tipus) return '(még nincs elég adat — legalább az oszlop típusa kell)';

  const meret = allapot['szerkezeti_elem_meret'] || '';
  const cSuffix = allapot['tocsavaros'] ? 'C' : '';
  const tipusResz = `${meret}${tipus}${cSuffix}`;

  const hh = magyarTizedes(allapot['hasznos_hossz'], 1);
  const th = magyarTizedes(allapot['teljes_hossz'], 1);
  const hosszResz = (hh || th) ? `${hh}/${th};` : '';

  const alapTipusResz = (allapot['alaptipus'] || '') + (allapot['alap_meret'] || '');
  const betonResz = allapot['betonmennyiseg'] !== ''
    ? `${magyarTizedes(allapot['betonmennyiseg'], 2)}m3` : '';
  const kihuzasResz = allapot['kihuzas_merteke'] !== ''
    ? `kh:${magyarTizedes(allapot['kihuzas_merteke'], 1)}m` : '';

  const foSor = [tipusResz, hosszResz, alapTipusResz, betonResz, kihuzasResz]
    .filter(Boolean).join(' ');

  const sorok = [foSor];
  if (allapot['oszloplehorgonyzas']) {
    const laTipusResz = (allapot['la_alaptipus'] || '') + (allapot['la_meret'] || '');
    const laBeton = allapot['la_betonmennyiseg'] !== ''
      ? magyarTizedes(allapot['la_betonmennyiseg'], 2) : '';
    sorok.push(`la: ${laTipusResz}${laBeton ? '-' + laBeton + 'm3' : ''}`);
  }
  return sorok.join('\n');
}

function ertelmezFeszitesiTervet(szoveg) {
  const sorok = szoveg.split('\n').map(s => s.trim()).filter(Boolean);
  if (sorok.length === 0) throw new Error('Üres szöveg.');

  const foSor = sorok[0];
  const laSor = sorok.find(s => s.toLowerCase().startsWith('la:'));

  const tipusMinta = new RegExp(
    `^([\\d/]*)(${OSZLOP_TIPUS_KODOK.join('|')})(C)?\\s+([\\d,]+)\\/([\\d,]+);\\s*(${ALAPTIPUS_KODOK.join('|')})([\\d,x×]+)\\s+([\\d,]+)m3(?:\\s+kh:([\\d,]+)m)?\\s*$`
  );
  const talalat = foSor.match(tipusMinta);
  if (!talalat) {
    throw new Error('A fő sor nem illeszkedik a várt mintára (pl. "12T 8,4/11,5; C1,1 2,90m3 kh:0,2m").');
  }
  const eredmeny = {
    szerkezeti_elem_meret: talalat[1],
    oszlop_tipus: talalat[2],
    tocsavaros: !!talalat[3],
    hasznos_hossz: talalat[4].replace(',', '.'),
    teljes_hossz: talalat[5].replace(',', '.'),
    alaptipus: talalat[6],
    alap_meret: talalat[7],
    betonmennyiseg: talalat[8].replace(',', '.'),
    kihuzas_merteke: talalat[9] ? talalat[9].replace(',', '.') : '',
    oszloplehorgonyzas: false,
    la_alaptipus: '', la_meret: '', la_betonmennyiseg: ''
  };

  if (laSor) {
    const laMinta = new RegExp(`^la:\\s*(${ALAPTIPUS_KODOK.join('|')})([\\d,x×]+)(?:-([\\d,]+)m3)?\\s*$`, 'i');
    const laTalalat = laSor.match(laMinta);
    if (!laTalalat) {
      throw new Error('A "la:" sor nem illeszkedik a várt mintára (pl. "la: C0,9-1,98m3").');
    }
    eredmeny.oszloplehorgonyzas = true;
    eredmeny.la_alaptipus = laTalalat[1];
    eredmeny.la_meret = laTalalat[2];
    eredmeny.la_betonmennyiseg = laTalalat[3] ? laTalalat[3].replace(',', '.') : '';
  }

  return eredmeny;
}

// ============================================================
// ÁLTALÁNOS (NEM OSZLOP-SPECIFIKUS) TAG-FORDÍTÁS
// A szelvénykő/útátjáró/egyéb típusoknál egyelőre még nyers OSM-tageket mutatunk,
// de magyarított névvel/értékkel — ehhez kellenek ezek a szótárak.
// ============================================================

const REJTETT_MEZOK = new Set([
  'icon', 'icon-color', 'icon-opacity', 'icon-scale', 'icon-offset',
  'icon-offset-units', 'label-scale', 'styleUrl'
]);

const MEZO_FORDITAS = {
  railway: 'Típus (railway)',
  power: 'Típus (power)',
  operator: 'Üzemeltető',
  'operator:wikidata': 'Üzemeltető (Wikidata)',
  name: 'Név/szám (name)',
  'name:ru': 'Név (oroszul)',
  ref: 'Azonosító (ref)',
  'ref:mav': 'MÁV-azonosító',
  'ref:MAV': 'MÁV-azonosító',
  'railway:ref': 'Vasúti azonosító',
  local_ref: 'Helyi azonosító',
  maxheight: 'Legnagyobb magasság',
  'railway:position': 'Szelvényezési hely (km)',
  'railway:position:exact': 'Pontos szelvényezési hely',
  crossing: 'Átjáró védettsége',
  'crossing:barrier': 'Sorompó',
  'crossing:light': 'Fényjelzés',
  'crossing:bell': 'Hangjelzés',
  supervised: 'Felügyelt',
  informal: 'Nem hivatalos',
  material: 'Anyag',
  structure: 'Szerkezet',
  voltage: 'Feszültség',
  location: 'Elhelyezkedés',
  direction: 'Irány',
  switch: 'Szakaszoló',
  'communication:gsm-r': 'GSM-R',
  description: 'Leírás',
  source: 'Forrás',
  website: 'Weboldal',
  wikidata: 'Wikidata',
  wikipedia: 'Wikipédia',
  wikimedia_commons: 'Wikimedia Commons',
  wheelchair: 'Kerekesszékkel',
  public_transport: 'Közösségi közlekedés',
  train: 'Vonat megáll',
  uic_ref: 'UIC-azonosító',
  man_made: 'Mesterséges létesítmény',
  line_attachment: 'Vezeték-rögzítés',
  information: 'Információ',
  tourism: 'Turizmus',
  'addr:city': 'Település',
  'addr:street': 'Utca',
  'addr:housenumber': 'Házszám',
  'addr:postcode': 'Irányítószám',
  '@id': 'OSM azonosító'
};

const ERTEK_FORDITAS = {
  railway: { milestone: 'Szelvénykő', level_crossing: 'Útátjáró', switch: 'Kitérő', signal: 'Jelző', station: 'Állomás', halt: 'Megállóhely', stop: 'Megálló', junction: 'Csomópont' },
  power: { catenary_mast: 'Felsővezeték-oszlop' },
  crossing: { uncontrolled: 'Jelzés nélküli', traffic_signals: 'Fénysorompós', no_signals: 'Jelzés nélküli' },
  'crossing:barrier': { full: 'Teljes sorompó', half: 'Fél sorompó', no: 'Nincs sorompó' }
};

function magyarMezonev(kulcs) {
  return MEZO_FORDITAS[kulcs] || kulcs;
}

function magyarErtek(kulcs, ertek) {
  if (ertek === 'yes') return 'igen';
  if (ertek === 'no') return 'nem';
  const tablazat = ERTEK_FORDITAS[kulcs];
  if (tablazat && tablazat[ertek]) return tablazat[ertek];
  return ertek;
}
