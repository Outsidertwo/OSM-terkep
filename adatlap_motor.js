// Adatlap-tesztelő motor — a séma-vezérelt űrlap-renderelő, előnézetek és a
// feszítési terv konverter. Csak ezt a fájlt kell módosítani új logikai
// finomításnál — az adatlap_teszt.html-hez nem kell hozzányúlni.

  // Beágyazott séma — ha a vonalak.json-hoz hasonlóan külön fájlból is be lehet tölteni,
  // itt is megpróbáljuk előbb a fájlt, csak utána esünk vissza a beágyazottra.
  const BEAGYAZOTT_SEMA = {"tipus_kod": "oszlop", "tipus_nev": "Felsővezeték-oszlop", "mezok": [{"kod": "szam", "nev": "Oszlopszám", "tipus": "szoveg", "terkepen": true, "kotelezo": true, "megjegyzes": "5 számjegy, opcionálisan /1 vagy /2, vagy max. 2 kis/nagybetű toldalék", "osm": {"ref": "{ertek}"}}, {"kod": "sulyos", "nev": "Súly", "tipus": "checkbox", "terkepen": true, "rovidites": "S", "kizarja": ["fixpont"], "osm": {"tensioning": "weights"}, "gyerek_mezok": [{"kod": "suly_tipus", "nev": "Súly típusa", "tipus": "radio", "terkepen": false, "alapertelmezett_opcio": "suly", "opciok": [{"kod": "suly", "nev": "Súly (alapértelmezett)", "osm": {"tensioning": "weights"}}, {"kod": "rugos", "nev": "Rugós", "osm": {"tensioning": "coil"}}]}, {"kod": "sulykosar_tipus", "nev": "Súlykosár / vezetőrúd", "tipus": "radio", "terkepen": false, "alapertelmezett_opcio": "sulykosar", "megjegyzes": "Nincs hozzá hivatalos OSM-tag, saját mező marad.", "opciok": [{"kod": "sulykosar", "nev": "Súlykosár (alapértelmezett)"}, {"kod": "vezetorud", "nev": "Vezetőrúd"}]}]}, {"kod": "szikrakoz", "nev": "Szikraköz", "tipus": "checkbox", "terkepen": true, "rovidites": "Szk", "megjegyzes": "Nincs hozzá hivatalos OSM-tag, saját mező marad.", "osm": null}, {"kod": "fixpont", "nev": "Fixpont", "tipus": "checkbox", "terkepen": true, "rovidites": "Fx", "kizarja": ["sulyos"], "megjegyzes": "Nincs hozzá hivatalos OSM-tag, saját mező marad.", "osm": null}, {"kod": "foldeles", "nev": "Földelés", "tipus": "radio", "terkepen": true, "megjegyzes": "Nincs hozzá hivatalos OSM-tag, saját mező marad. A térképi címkén H (hosszú) vagy R (rövid) betűvel jelenik meg.", "opciok": [{"kod": "hosszu", "nev": "Hosszú"}, {"kod": "rovid", "nev": "Rövid"}]}, {"kod": "foldelesi_pont", "nev": "Földelési pont", "tipus": "checkbox", "terkepen": true, "rovidites": "Fp", "megjegyzes": "Nincs hozzá hivatalos OSM-tag, saját mező marad.", "osm": null}, {"kod": "szakaszolo", "nev": "Szakaszoló", "tipus": "checkbox", "terkepen": true, "terkepi_forras": "szakaszolo_nev", "osm": {"switch": "disconnector", "location": "outdoor"}, "gyerek_mezok": [{"kod": "szakaszolo_nev", "nev": "Szakaszoló azonosítója", "tipus": "szoveg", "terkepen": true, "osm": {"ref:switch": "{ertek}"}}, {"kod": "szakaszolo_mukodtetes", "nev": "Működtetés", "tipus": "radio", "terkepen": false, "opciok": [{"kod": "kezi", "nev": "Kézi", "osm": {"actuator": "manual"}}, {"kod": "motoros", "nev": "Motoros", "osm": {"actuator": "electric_motor"}}]}, {"kod": "szakaszolo_foldelokeses", "nev": "Földelőkéses", "tipus": "checkbox", "terkepen": false, "osm": {"switch": "earthing"}}]}, {"kod": "trafo", "nev": "Transzformátor", "tipus": "checkbox", "terkepen": true, "terkepi_forras": "trafo_nev", "megjegyzes": "A trafó mindig önálló oszlopon van, más jelzőkkel jellemzően nem kombinálódik.", "gyerek_mezok": [{"kod": "trafo_nev", "nev": "Transzformátor azonosítója", "tipus": "szoveg", "terkepen": true, "osm": null}]}, {"kod": "tocsavaros", "nev": "Tőcsavaros kivitel (C jelölés)", "tipus": "checkbox", "terkepen": false, "megjegyzes": "A típuskódhoz C toldalékot ad (pl. KC)."}, {"kod": "fa_oszlop", "nev": "Fa oszlop (F jelölés a szám végén)", "tipus": "checkbox", "terkepen": false, "megjegyzes": "Ha igaz, az oszlopszám végére F kerül (pl. 05617F). Ez nem azonos a Feszítő (F) típuskóddal.", "osm": {"structure": "trunk"}}, {"kod": "oszlop_tipus", "nev": "Oszlop típusa", "tipus": "radio", "terkepen": true, "terkepen_meret_nelkul": true, "opciok": [{"kod": "T", "nev": "Tartó (T)", "osm": {"structure": "frame"}}, {"kod": "L", "nev": "Lengő (L)", "osm": {"structure": "frame"}, "megjegyzes": "Csak portál szerkezetben fordul elő."}, {"kod": "Ta", "nev": "Lehorgonyzó (Ta)", "osm": {"structure": "frame"}}, {"kod": "F", "nev": "Feszítő (F)", "osm": {"structure": "lattice"}}, {"kod": "K", "nev": "Keresztmező (K)", "osm": {"structure": "lattice"}}, {"kod": "KR", "nev": "Keretállás (KR)", "osm": {"structure": "lattice"}}, {"kod": "MKR", "nev": "Mini KR (MKR)", "osm": {"structure": "lattice"}}, {"kod": "P", "nev": "Pörgetett betonacél (P)", "osm": {"structure": "spun", "material": "concrete"}}, {"kod": "BM", "nev": "Betonacél (BM)", "osm": {"structure": "spun", "material": "concrete"}}, {"kod": "CSŐ", "nev": "Acél csőoszlop (CSŐ)", "osm": {"structure": "pole", "material": "steel"}}], "gyerek_mezok": [{"kod": "szerkezeti_elem_meret", "nev": "Szerkezeti elem mérete", "tipus": "szoveg", "terkepen": false, "megjegyzes": "Pl. 14, vagy 120/10", "csak_adatlapon": true}]}, {"kod": "mit_tart", "nev": "Csoportos tartószerkezet", "tipus": "radio", "terkepen": false, "alapertelmezett_opcio": "nincs", "megjegyzes": "Kézzel megadott mező, mert a valóság néha eltér a típusból várható kiviteltől. A \"nincs\" az alapértelmezett, és nem jelenik meg választható gombként — csak akkor kell beállítani, ha tényleg csoportos szerkezet része.", "opciok": [{"kod": "nincs", "nev": "Nincs", "rejtett": true}, {"kod": "keresztmezo", "nev": "Keresztmező", "osm": {"catenary_mast:supporting": "head_span"}}, {"kod": "portal", "nev": "Keretállás", "osm": {"catenary_mast:supporting": "portal"}}]}, {"kod": "oszloplehorgonyzas", "nev": "Oszloplehorgonyzás", "tipus": "checkbox", "terkepen": false, "osm": {"guyed": "yes"}, "gyerek_mezok": [{"kod": "la_alaptipus", "nev": "Lehorgonyzás alaptestének típusa (\"la.\")", "tipus": "radio", "terkepen": false, "opciok": [{"kod": "A", "nev": "A"}, {"kod": "B", "nev": "B"}, {"kod": "U", "nev": "U"}, {"kod": "C", "nev": "C"}, {"kod": "V", "nev": "V"}, {"kod": "Z", "nev": "Z"}, {"kod": "Y", "nev": "Y"}, {"kod": "D", "nev": "D"}, {"kod": "E", "nev": "E"}, {"kod": "F", "nev": "F"}, {"kod": "G", "nev": "G"}, {"kod": "LE", "nev": "LE"}]}, {"kod": "la_meret", "nev": "Lehorgonyzás alaptestének mérete", "tipus": "szoveg", "terkepen": false, "tizedesek": 1, "megjegyzes": "Pl. 1,0 — vagy LE esetén szélesség x magasság, pl. 1,9x2,2"}, {"kod": "la_betonmennyiseg", "nev": "Lehorgonyzás betonmennyisége", "tipus": "szam", "terkepen": false, "tizedesek": 2, "mertekegyseg": "m³"}]}, {"kod": "vezetek_kihorgonyzas", "nev": "Vezeték-kihorgonyzás", "tipus": "checkbox", "terkepen": false, "osm": {"catenary_mast:attachment": "anchor", "tensioning": "fixed"}}, {"kod": "tartoszerkezetek", "nev": "Szerkezeti szigetelők", "tipus": "tartoszerkezet_lista", "terkepen": false, "max_darab": 3, "megjegyzes": "Egy oszlopon 1-3 egyedi tartószerkezet lehet; mindegyik feszítőhuzalos vagy támasztókaros, és 2-2 fix szigetelőhellyel jár: a főkaron mindig csőcsatlakozású, a másik feszítőhuzalos esetén választószigetelő a feszítőhuzalon, támasztókaros esetén csőcsatlakozású a támasztókaron. A csatlakozás módjához nincs hivatalos OSM-tag, ez saját mező marad.", "tomeges_anyag_valaszto": true, "anyag_opciok": [{"kod": "porcelan", "nev": "Porcelán", "osm": {"insulation:material": "porcelain"}}, {"kod": "silicon", "nev": "Szilikon", "osm": {"insulation:material": "silicon"}}, {"kod": "isofix", "nev": "Isofix", "osm": {"insulation:material": "grp"}}]}, {"kod": "hasznos_hossz", "nev": "Hasznos hossz", "tipus": "szam", "terkepen": false, "tizedesek": 1, "mertekegyseg": "m", "megjegyzes": "Pl. 8,4"}, {"kod": "teljes_hossz", "nev": "Teljes hossz", "tipus": "szam", "terkepen": false, "tizedesek": 1, "mertekegyseg": "m", "megjegyzes": "Pl. 11,5"}, {"kod": "alaptipus", "nev": "Alaptípus", "tipus": "radio", "terkepen": false, "opciok": [{"kod": "A", "nev": "A"}, {"kod": "B", "nev": "B"}, {"kod": "U", "nev": "U"}, {"kod": "C", "nev": "C"}, {"kod": "V", "nev": "V"}, {"kod": "Z", "nev": "Z"}, {"kod": "Y", "nev": "Y"}, {"kod": "D", "nev": "D"}, {"kod": "E", "nev": "E"}, {"kod": "F", "nev": "F"}, {"kod": "G", "nev": "G"}, {"kod": "LE", "nev": "LE"}]}, {"kod": "alap_meret", "nev": "Alap mérete", "tipus": "szoveg", "terkepen": false, "tizedesek": 1, "megjegyzes": "Pl. 1,0 — vagy LE esetén szélesség x magasság, pl. 1,9x2,2"}, {"kod": "betonmennyiseg", "nev": "Teljes betonmennyiség", "tipus": "szam", "terkepen": false, "tizedesek": 2, "mertekegyseg": "m³"}, {"kod": "kihuzas_merteke", "nev": "Kihúzás mértéke", "tipus": "szam", "terkepen": false, "tizedesek": 1, "mertekegyseg": "m"}, {"kod": "tavolsag_szelvenyezeshez", "nev": "Oszlop távolsága a szelvényezéshez", "tipus": "szam", "terkepen": false, "elojel_kiirasa": true, "megjegyzes": "Csak a számot írd be — a \"+\" jel a megjelenítéskor automatikusan hozzáadódik, pl. +72"}, {"kod": "oszlopel_vagany_tavolsag", "nev": "Oszlopél - vágánytengely távolság", "tipus": "szam", "terkepen": false, "tizedesek": 2, "megjegyzes": "Pl. 3,51", "gyerek_mezok": []}, {"kod": "vaganyok_kozott", "nev": "Vágányok között elhelyezve", "tipus": "checkbox", "terkepen": false, "megjegyzes": "Ha igaz, két távolság adható meg (mindkét vágányhoz), pl. 4,98-5,29", "gyerek_mezok": [{"kod": "oszlopel_vagany_tavolsag_2", "nev": "Oszlopél - vágánytengely távolság (2. vágány)", "tipus": "szam", "terkepen": false, "tizedesek": 2}]}, {"kod": "megjegyzes", "nev": "Megjegyzés", "tipus": "hosszu_szoveg", "terkepen": false}, {"kod": "fenykep", "nev": "Fénykép", "tipus": "kep", "terkepen": false, "megjegyzes": "Részletek még megbeszélendők."}]};

  let sema = null;
  const allapot = {}; // kod -> érték (checkbox: bool, szoveg/szam: string, select: kod string)
  const tartoszerkezetek = []; // { tipus: 'feszitohuzalos'|'tamasztokaros', fokar_anyag, masodik_anyag }
  let tomegesSzigeteloAnyag = ''; // önálló, a felvett tartószerkezetektől független tömeges anyagválasztás

  async function betoltSchema() {
    try {
      const res = await fetch('./adatlap_oszlop.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      sema = await res.json();
    } catch (err) {
      console.warn('adatlap_oszlop.json nem tölthető be, beágyazott séma marad:', err);
      sema = BEAGYAZOTT_SEMA;
    }
    document.getElementById('cimSpan').textContent = sema.tipus_nev;
    inicializalAllapot(sema.mezok);
    kirajzolForma();
    frissitElonezet();
  }

  function inicializalAllapot(mezok) {
    mezok.forEach(m => {
      if (m.tipus === 'checkbox') allapot[m.kod] = false;
      else if (m.tipus === 'tartoszerkezet_lista') {
        // A tartoszerkezetek tömb már a modul szintjén inicializálva van, itt nincs teendő.
      } else if ((m.tipus === 'radio' || m.tipus === 'select') && m.alapertelmezett_opcio) {
        allapot[m.kod] = m.alapertelmezett_opcio;
      } else {
        allapot[m.kod] = '';
      }
      if (m.gyerek_mezok) inicializalAllapot(m.gyerek_mezok);
    });
  }

  function magyarTizedes(ertek, tizedesek) {
    if (ertek === '' || ertek === undefined || ertek === null) return '';
    const szam = Number(String(ertek).replace(',', '.'));
    if (isNaN(szam)) return '';
    return szam.toFixed(tizedesek === undefined ? 1 : tizedesek).replace('.', ',');
  }

  // ============================================================
  // FESZÍTÉSI TERV KONVERTER
  // B→A (formázó): a strukturált adatból összerakja a tömör szöveget.
  // A→B (értelmező): a tömör szövegből visszafejti a mezőket.
  // Csak azt a mezőkört fedi le, ami ténylegesen szerepel a feszítési
  // terv jelölésben (típus, hossz, alaptest, betonmennyiség, kihúzás,
  // lehorgonyzás) — a térképi/OSM jelzők (súly, szikraköz stb.) nem
  // részei ennek a szövegnek.
  // ============================================================

  function epitsFeszitesiTervSzoveget() {
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

  const OSZLOP_TIPUS_KODOK = ['MKR', 'KR', 'Ta', 'CSŐ', 'T', 'L', 'F', 'K', 'P', 'BM']; // hosszabb kódok elöl!
  const ALAPTIPUS_KODOK = ['LE', 'A', 'B', 'U', 'C', 'V', 'Z', 'Y', 'D', 'E', 'F', 'G'];

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

  function alkalmazFeszitesiTervEredmenyt(eredmeny) {
    Object.entries(eredmeny).forEach(([kod, ertek]) => { allapot[kod] = ertek; });
    // Az űrlap mezőinek vizuális szinkronizálása az új értékekkel.
    document.querySelectorAll('#mezokKontener input[data-kod], #mezokKontener textarea[data-kod]').forEach(el => {
      const kod = el.dataset.kod;
      if (!(kod in eredmeny)) return;
      if (el.type === 'checkbox') el.checked = !!eredmeny[kod];
      else if (el.type !== 'radio') el.value = eredmeny[kod];
    });
    szinkronizaljRadiokat(sema.mezok);
    frissitGyerekLathatosag();
    frissitElonezet();
  }

  // Az OSM name/ref mező (pl. a térkép popup-jából, jelenleg kézzel beillesztve) szövegének
  // értelmezése: oszlopszám, fa-oszlop F jelölés, típuskód és tőcsavaros C jelölés kiolvasása.
  // Amit nem lehet egyértelműen mezőhöz kötni (pl. "Ü6"), az a Megjegyzés mezőbe kerül,
  // hogy szerkesztéskor semmilyen, a térképi címkén szereplő információ ne vesszen el.
  function ertelmezCimkeSzoveget(szoveg) {
    const eredmeny = {};
    const tokenek = String(szoveg).trim().split(/\s+/).filter(Boolean);
    if (tokenek.length === 0) return eredmeny;

    // Az utolsó token lehet a típuskód, opcionális C (tőcsavaros) végződéssel — csak akkor
    // vizsgáljuk, ha legalább 2 token van, különben egyetlen beírt oszlopszámot tévesen
    // típuskódnak és számnak is értelmeznénk egyszerre.
    let tipusTalalt = false;
    if (tokenek.length >= 2) {
      const utolso = tokenek[tokenek.length - 1];
      const tipusIllesztes = utolso.match(/^([A-ZÁÉÍÓÖŐÚÜŰa-záéíóöőúüű]+?)(C)?$/);
      if (tipusIllesztes && OSZLOP_TIPUS_KODOK.includes(tipusIllesztes[1])) {
        eredmeny.oszlop_tipus = tipusIllesztes[1];
        eredmeny.tocsavaros = !!tipusIllesztes[2];
        tipusTalalt = true;
      }
    }

    // Az első token az oszlopszám — F véggel jelezve a fa oszlopot (pl. "05617F").
    const elso = tokenek[0];
    const faIllesztes = elso.match(/^(.+\d)F$/);
    if (faIllesztes) {
      eredmeny.szam = faIllesztes[1];
      eredmeny.fa_oszlop = true;
    } else {
      eredmeny.szam = elso;
      eredmeny.fa_oszlop = false;
    }

    // A közbülső (fel nem ismert) tokenek a Megjegyzésbe kerülnek, nem vesznek el.
    const kozepsoTokenek = tokenek.slice(1, tipusTalalt ? -1 : undefined);
    if (kozepsoTokenek.length > 0) {
      const uj = `Címkéből felismeretlen jelölés: ${kozepsoTokenek.join(' ')}`;
      const meglevo = allapot['megjegyzes'] || '';
      eredmeny.megjegyzes = (meglevo && !meglevo.includes(uj)) ? (meglevo + '\n' + uj) : (meglevo || uj);
    }

    return eredmeny;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function mezoAktiv(mezo) {
    // Egy checkbox-mező akkor "aktív" (gyerekei akkor látszanak), ha be van pipálva.
    // Egy select-mező gyerekei mindig látszanak, ha van választva érték.
    if (mezo.tipus === 'checkbox') return !!allapot[mezo.kod];
    if (mezo.tipus === 'select' || mezo.tipus === 'radio') return !!allapot[mezo.kod];
    return true;
  }

  function renderMezo(mezo) {
    let html = '';
    if (mezo.tipus === 'tartoszerkezet_lista') {
      html += renderTartoszerkezetLista(mezo);
      return html;
    }

    // Teljesen rejtett mező (pl. szigetelő típusa) — a felhasználó nem lát belőle semmit,
    // de az alapértelmezett értéke már az inicializáláskor beállt, és a gyerekei (ha vannak)
    // ugyanúgy renderelődnek, mintha a mező "aktív" lenne.
    if (mezo.rejtett) {
      let rejtettHtml = '';
      if (mezo.gyerek_mezok) {
        rejtettHtml += `<div class="gyerek aktiv" data-szulo="${mezo.kod}">`;
        mezo.gyerek_mezok.forEach(gy => { rejtettHtml += renderMezo(gy); });
        rejtettHtml += `</div>`;
      }
      return rejtettHtml;
    }

    html += `<div class="mezo ${mezo.tipus === 'checkbox' ? '' : 'szoveges'}" data-kod="${mezo.kod}">`;

    if (mezo.tipus === 'checkbox') {
      html += `<label>
        <input type="checkbox" data-kod="${mezo.kod}" />
        ${escapeHtml(mezo.nev)}
        ${mezo.terkepen ? '<span class="terkepen-jelzo">[térképen]</span>' : ''}
      </label>`;
    } else if (mezo.tipus === 'radio') {
      const lathatoOpciok = mezo.opciok.filter(o => !o.rejtett);
      html += `<label>${escapeHtml(mezo.nev)} ${mezo.terkepen ? '<span class="terkepen-jelzo">[térképen]</span>' : ''}</label>`;
      html += `<div class="radio-csoport" data-kod="${mezo.kod}">
        ${lathatoOpciok.map(o => `
          <label>
            <input type="radio" name="radio_${mezo.kod}" data-kod="${mezo.kod}" value="${escapeHtml(o.kod)}" />
            ${escapeHtml(o.nev)}
          </label>
        `).join('')}
      </div>`;
    } else if (mezo.tipus === 'hosszu_szoveg') {
      html += `<label>${escapeHtml(mezo.nev)}</label><textarea data-kod="${mezo.kod}"></textarea>`;
    } else if (mezo.tipus === 'kep') {
      html += `<label>${escapeHtml(mezo.nev)}</label><input type="file" accept="image/*" data-kod="${mezo.kod}" />`;
    } else if (mezo.tipus === 'szam') {
      const lepes = mezo.tizedesek ? (1 / Math.pow(10, mezo.tizedesek)).toFixed(mezo.tizedesek) : '1';
      html += `<label>${escapeHtml(mezo.nev)}${mezo.mertekegyseg ? ' (' + escapeHtml(mezo.mertekegyseg) + ')' : ''}</label>
        <input type="number" step="${lepes}" data-kod="${mezo.kod}" />`;
    } else {
      html += `<label>${escapeHtml(mezo.nev)} ${mezo.terkepen ? '<span class="terkepen-jelzo">[térképen]</span>' : ''}</label><input type="text" data-kod="${mezo.kod}" />`;
    }

    if (mezo.megjegyzes) {
      html += `<div class="megjegyzes">${escapeHtml(mezo.megjegyzes)}</div>`;
    }

    if (mezo.gyerek_mezok) {
      html += `<div class="gyerek" data-szulo="${mezo.kod}">`;
      mezo.gyerek_mezok.forEach(gy => { html += renderMezo(gy); });
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  }

  function renderTartoszerkezetLista(mezo) {
    let html = `<div class="mezo szoveges"><label>${escapeHtml(mezo.nev)}</label>`;
    if (mezo.megjegyzes) html += `<div class="megjegyzes" style="margin-left:0;">${escapeHtml(mezo.megjegyzes)}</div>`;

    if (mezo.tomeges_anyag_valaszto) {
      html += `<div style="margin:8px 0; padding:6px; background:#f7f7f7; border-radius:4px;">
        <div style="font-size:12px; color:#555; margin-bottom:4px;">Ha minden szigetelő anyaga azonos, itt egyszerre beállítható:</div>
        <div class="mini-radio-csoport" id="tomegesAnyagValaszto">
          ${mezo.anyag_opciok.map(o => `
            <label><input type="radio" name="tomeges_anyag" value="${escapeHtml(o.kod)}" /> ${escapeHtml(o.nev)}</label>
          `).join('')}
        </div>
      </div>`;
    }

    html += `<div id="tartoszerkezetKontener"></div>
      <button type="button" class="kicsi" id="tartoszerkezetHozzaadBtn">+ tartószerkezet hozzáadása</button>`;
    html += `</div>`;
    return html;
  }

  function kirajzolTartoszerkezetek(mezo) {
    const kont = document.getElementById('tartoszerkezetKontener');
    kont.innerHTML = tartoszerkezetek.map((ts, i) => {
      const masodikCimke = ts.tipus === 'tamasztokaros'
        ? 'Támasztókar szigetelő (csőcsatlakozású) anyaga'
        : 'Feszítőhuzal szigetelő (választószigetelő) anyaga';
      return `
      <div class="ag-blokk" data-ts-index="${i}">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3>#${i + 1} tartószerkezet</h3>
          <button type="button" class="kicsi" data-ts-torol="${i}">✕</button>
        </div>
        <div class="mini-radio-csoport">
          <label><input type="radio" name="ts_tipus_${i}" data-ts="${i}" data-ts-mezo="tipus" value="feszitohuzalos" ${ts.tipus === 'feszitohuzalos' ? 'checked' : ''} /> Feszítőhuzalos</label>
          <label><input type="radio" name="ts_tipus_${i}" data-ts="${i}" data-ts-mezo="tipus" value="tamasztokaros" ${ts.tipus === 'tamasztokaros' ? 'checked' : ''} /> Támasztókaros</label>
        </div>
        <div style="font-size:12px; color:#888; margin-top:6px;">Főkar szigetelő (csőcsatlakozású) anyaga</div>
        <div class="mini-radio-csoport" data-ts-anyag="${i}" data-ts-anyag-mezo="fokar_anyag">
          ${mezo.anyag_opciok.map(o => `
            <label><input type="radio" name="ts_fokar_${i}" data-ts="${i}" data-ts-mezo="fokar_anyag" value="${escapeHtml(o.kod)}" ${ts.fokar_anyag === o.kod ? 'checked' : ''} /> ${escapeHtml(o.nev)}</label>
          `).join('')}
        </div>
        <div style="font-size:12px; color:#888; margin-top:6px;">${escapeHtml(masodikCimke)}</div>
        <div class="mini-radio-csoport" data-ts-anyag="${i}" data-ts-anyag-mezo="masodik_anyag">
          ${mezo.anyag_opciok.map(o => `
            <label><input type="radio" name="ts_masodik_${i}" data-ts="${i}" data-ts-mezo="masodik_anyag" value="${escapeHtml(o.kod)}" ${ts.masodik_anyag === o.kod ? 'checked' : ''} /> ${escapeHtml(o.nev)}</label>
          `).join('')}
        </div>
      </div>`;
    }).join('');

    kont.querySelectorAll('input[type="radio"][data-ts]').forEach(el => {
      el.addEventListener('change', () => {
        if (!el.checked) return;
        const idx = Number(el.dataset.ts), mezoKod = el.dataset.tsMezo;
        tartoszerkezetek[idx][mezoKod] = el.value;
        if (mezoKod === 'tipus') {
          kirajzolTartoszerkezetek(mezo); // a második szigetelő címkéje frissül
        } else if (mezoKod === 'fokar_anyag' || mezoKod === 'masodik_anyag') {
          // Egyedi módosítás megtörheti az eddigi egységességet — a tömeges választás
          // innentől már nem tekinthető érvényesnek, az OSM-tag az "egyezik-e mind" ellenőrzésre esik vissza.
          tomegesSzigeteloAnyag = '';
          const tomegesRadiok = document.querySelectorAll('#tomegesAnyagValaszto input[type="radio"]');
          tomegesRadiok.forEach(r => { r.checked = false; });
        }
        frissitElonezet();
      });
    });
    kont.querySelectorAll('button[data-ts-torol]').forEach(btn => {
      btn.addEventListener('click', () => {
        tartoszerkezetek.splice(Number(btn.dataset.tsTorol), 1);
        kirajzolTartoszerkezetek(mezo);
        frissitElonezet();
      });
    });
  }

  function kirajzolForma() {
    const kont = document.getElementById('mezokKontener');
    kont.innerHTML = sema.mezok.map(renderMezo).join('');

    // Checkbox/szöveg/szám/select mezők eseménykezelői
    kont.querySelectorAll('input[type="checkbox"][data-kod]').forEach(el => {
      el.addEventListener('change', () => {
        allapot[el.dataset.kod] = el.checked;
        kezelKizarast(el.dataset.kod);
        frissitGyerekLathatosag();
        frissitElonezet();
      });
    });
    kont.querySelectorAll('input[type="text"][data-kod], input[type="number"][data-kod], textarea[data-kod]').forEach(el => {
      el.addEventListener('input', () => {
        allapot[el.dataset.kod] = el.value;
        frissitElonezet();
      });
    });
    kont.querySelectorAll('input[type="radio"][data-kod]').forEach(el => {
      el.addEventListener('change', () => {
        if (el.checked) {
          allapot[el.dataset.kod] = el.value;
          frissitGyerekLathatosag();
          frissitElonezet();
        }
      });
    });
    kont.querySelectorAll('input[type="file"][data-kod]').forEach(el => {
      el.addEventListener('change', () => {
        allapot[el.dataset.kod] = el.files[0] ? el.files[0].name : '';
        frissitElonezet();
      });
    });

    // Tartószerkezetek (szerkezeti szigetelők)
    const semaTartoszerkezetek = megtalalMezo(sema.mezok, 'tartoszerkezetek');
    if (semaTartoszerkezetek) {
      document.getElementById('tartoszerkezetHozzaadBtn').addEventListener('click', () => {
        if (tartoszerkezetek.length >= semaTartoszerkezetek.max_darab) return;
        tartoszerkezetek.push({ tipus: 'feszitohuzalos', fokar_anyag: '', masodik_anyag: '' });
        kirajzolTartoszerkezetek(semaTartoszerkezetek);
        frissitElonezet();
      });
      kirajzolTartoszerkezetek(semaTartoszerkezetek);
    }

    // Tömeges anyag-választó: minden meglévő tartószerkezet mindkét szigetelőjére ráírja az anyagot,
    // és önmagában is elég (nem kell hozzá előbb tartószerkezetet felvenni).
    const tomegesValaszto = document.getElementById('tomegesAnyagValaszto');
    if (tomegesValaszto) {
      tomegesValaszto.querySelectorAll('input[type="radio"]').forEach(radio => {
        if (radio.value === tomegesSzigeteloAnyag) radio.checked = true;
        radio.addEventListener('change', () => {
          if (!radio.checked) return;
          tomegesSzigeteloAnyag = radio.value;
          tartoszerkezetek.forEach(ts => { ts.fokar_anyag = radio.value; ts.masodik_anyag = radio.value; });
          if (semaTartoszerkezetek) kirajzolTartoszerkezetek(semaTartoszerkezetek);
          frissitElonezet();
        });
      });
    }

    frissitGyerekLathatosag();
    szinkronizaljRadiokat(sema.mezok);
  }

  function szinkronizaljRadiokat(mezok) {
    mezok.forEach(m => {
      if (m.tipus === 'radio' && allapot[m.kod]) {
        const el = document.querySelector(`input[type="radio"][data-kod="${m.kod}"][value="${allapot[m.kod]}"]`);
        if (el) el.checked = true;
      }
      if (m.gyerek_mezok) szinkronizaljRadiokat(m.gyerek_mezok);
    });
  }

  function megtalalMezo(mezok, kod) {
    for (const m of mezok) {
      if (m.kod === kod) return m;
      if (m.gyerek_mezok) { const r = megtalalMezo(m.gyerek_mezok, kod); if (r) return r; }
    }
    return null;
  }

  function kezelKizarast(kod) {
    const mezo = megtalalMezo(sema.mezok, kod);
    if (mezo && mezo.kizarja && allapot[kod]) {
      mezo.kizarja.forEach(masikKod => {
        allapot[masikKod] = false;
        const cb = document.querySelector(`input[type="checkbox"][data-kod="${masikKod}"]`);
        if (cb) cb.checked = false;
      });
    }
  }

  function frissitGyerekLathatosag() {
    document.querySelectorAll('.gyerek[data-szulo]').forEach(gyerekDiv => {
      const szuloKod = gyerekDiv.dataset.szulo;
      const szuloMezo = megtalalMezo(sema.mezok, szuloKod);
      gyerekDiv.classList.toggle('aktiv', mezoAktiv(szuloMezo));
    });
  }

  function osszegyujtOsmTageket() {
    let tagek = {};
    function feldolgoz(mezok) {
      mezok.forEach(m => {
        if (m.tipus === 'checkbox') {
          if (allapot[m.kod] && m.osm) tagek = { ...tagek, ...m.osm };
          if (allapot[m.kod] && m.gyerek_mezok) feldolgoz(m.gyerek_mezok);
        } else if (m.tipus === 'radio' || m.tipus === 'select') {
          const valasztott = m.opciok && m.opciok.find(o => o.kod === allapot[m.kod]);
          if (valasztott && valasztott.osm) tagek = { ...tagek, ...valasztott.osm };
          if (allapot[m.kod] && m.gyerek_mezok) feldolgoz(m.gyerek_mezok);
        } else if (m.osm && allapot[m.kod]) {
          Object.entries(m.osm).forEach(([k, v]) => {
            tagek[k] = String(v).replace('{ertek}', allapot[m.kod]);
          });
        }
      });
    }
    feldolgoz(sema.mezok);

    // Szigetelők: az insulator=post mindig fix (nincs hivatalos tag a csatlakozás módjára),
    // az insulation:material a tömeges választásból jön, ha van; ha nincs, csak akkor,
    // ha minden tartószerkezet mindkét szigetelőjén ugyanaz az anyag.
    const semaTartoszerkezetek = megtalalMezo(sema.mezok, 'tartoszerkezetek');
    const osszesAnyag = tartoszerkezetek.flatMap(ts => [ts.fokar_anyag, ts.masodik_anyag]).filter(Boolean);
    const vanBarmilyenSzigetelo = tartoszerkezetek.length > 0 || !!tomegesSzigeteloAnyag;

    if (vanBarmilyenSzigetelo) {
      tagek['insulator'] = 'post';
      let anyagKod = tomegesSzigeteloAnyag || null;
      if (!anyagKod && osszesAnyag.length > 0 && osszesAnyag.every(k => k === osszesAnyag[0])) {
        anyagKod = osszesAnyag[0];
      }
      if (anyagKod && semaTartoszerkezetek) {
        const opcio = semaTartoszerkezetek.anyag_opciok.find(o => o.kod === anyagKod);
        if (opcio && opcio.osm) tagek = { ...tagek, ...opcio.osm };
      }
    }

    return tagek;
  }

  function epitsCimkeHtml() {
    const fa = allapot['fa_oszlop'];
    const szamNyers = allapot['szam'] || '';
    const szamMegjelenites = szamNyers + (fa ? 'F' : '');
    const idResz = szamMegjelenites
      ? `<span class="label-id">${escapeHtml(szamMegjelenites)}</span>` : '';

    const leiroBitek = [];
    const tipusMezo = megtalalMezo(sema.mezok, 'oszlop_tipus');
    let tipusKod = allapot['oszlop_tipus'];
    if (tipusKod) {
      if (allapot['tocsavaros']) tipusKod += 'C';
      leiroBitek.push(escapeHtml(tipusKod));
    }
    if (allapot['szikrakoz']) leiroBitek.push('szk');
    if (allapot['sulyos']) leiroBitek.push('s');
    if (allapot['fixpont']) leiroBitek.push('fx');
    if (allapot['foldeles'] === 'hosszu') leiroBitek.push('H');
    else if (allapot['foldeles'] === 'rovid') leiroBitek.push('R');
    if (allapot['foldelesi_pont']) leiroBitek.push('fp');
    if (allapot['szakaszolo'] && allapot['szakaszolo_nev']) leiroBitek.push(escapeHtml(allapot['szakaszolo_nev']));
    if (allapot['trafo'] && allapot['trafo_nev']) leiroBitek.push(escapeHtml(allapot['trafo_nev']));

    const leiroResz = leiroBitek.length > 0
      ? `<span class="label-desc">${leiroBitek.join(' ')}</span>` : '';

    return idResz + leiroResz || '<em style="color:#999;">(még nincs adat)</em>';
  }

  function formazottRekord() {
    const masolat = { ...allapot };
    const tavMezo = megtalalMezo(sema.mezok, 'tavolsag_szelvenyezeshez');
    if (tavMezo && tavMezo.elojel_kiirasa && masolat['tavolsag_szelvenyezeshez'] !== '') {
      const szam = Number(masolat['tavolsag_szelvenyezeshez']);
      if (!isNaN(szam)) {
        masolat['tavolsag_szelvenyezeshez'] = (szam >= 0 ? '+' : '') + szam;
      }
    }

    // A lehorgonyzás adatait a sémában (más okból) az alap adatai ELŐTT vesszük fel,
    // de a kiírt/mentett rekordban logikusabb, ha az alap adatai UTÁN, egy önálló
    // "lehorgonyzas" csoportban szerepelnek — ahogy a feszítési terv szövegében is az
    // alap fő sora után jön a "la:" sor. Ha nincs lehorgonyzás, ki is marad a rekordból.
    const { oszloplehorgonyzas, la_alaptipus, la_meret, la_betonmennyiseg, ...tobbi } = masolat;
    if (!oszloplehorgonyzas) return tobbi;

    const vegleges = {};
    let beilleszve = false;
    Object.entries(tobbi).forEach(([kod, ertek]) => {
      vegleges[kod] = ertek;
      if (kod === 'kihuzas_merteke') {
        vegleges['lehorgonyzas'] = { alaptipus: la_alaptipus, meret: la_meret, betonmennyiseg: la_betonmennyiseg };
        beilleszve = true;
      }
    });
    if (!beilleszve) {
      vegleges['lehorgonyzas'] = { alaptipus: la_alaptipus, meret: la_meret, betonmennyiseg: la_betonmennyiseg };
    }
    return vegleges;
  }

  function frissitElonezet() {
    document.getElementById('cimkeElonezet').innerHTML = epitsCimkeHtml();
    document.getElementById('osmElonezet').textContent = JSON.stringify(osszegyujtOsmTageket(), null, 2);
    const rekord = { ...formazottRekord(), tartoszerkezetek: tartoszerkezetek };
    document.getElementById('rekordElonezet').textContent = JSON.stringify(rekord, null, 2);
    document.getElementById('feszitesiTervElonezet').value = epitsFeszitesiTervSzoveget();
  }

  window.mentes = function() {
    frissitElonezet();
    return osszegyujtOsmTageket();
  };

  betoltSchema();

  const feszitesiTervBeolvasBtnEl = document.getElementById('feszitesiTervBeolvasBtn');
  if (feszitesiTervBeolvasBtnEl) {
    feszitesiTervBeolvasBtnEl.addEventListener('click', () => {
      const hibaEl = document.getElementById('feszitesiTervHiba');
      hibaEl.textContent = '';
      const szoveg = document.getElementById('feszitesiTervElonezet').value;
      try {
        const eredmeny = ertelmezFeszitesiTervet(szoveg);
        alkalmazFeszitesiTervEredmenyt(eredmeny);
      } catch (err) {
        hibaEl.textContent = err.message;
      }
    });
  }

  const nevMezoBemenetEl = document.getElementById('nevMezoBemenet');
  if (nevMezoBemenetEl) {
    nevMezoBemenetEl.addEventListener('change', () => {
      const eredmeny = ertelmezCimkeSzoveget(nevMezoBemenetEl.value);
      alkalmazFeszitesiTervEredmenyt(eredmeny);
    });
  }

  // Bezárja az adatlap ablakát/panelt — akár iframe-be ágyazva (a jövőbeli térkép-integrációnál
  // postMessage-en keresztül), akár önálló popup ablakként (window.opener), akár egyelőre
  // csak önmagában megnyitva (ilyenkor a böngésző jellemzően nem engedi a szkriptes bezárást,
  // ez esetben egy üzenetet mutatunk).
  function bezarAblakot() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ tipus: 'adatlap-bezaras' }, '*');
        return;
      }
    } catch (err) { /* keresztdomain hozzáférés esetén nem elérhető, folytatjuk lejjebb */ }
    window.close();
    // Ha a fenti nem hatott (mert a böngésző nem engedi szkriptből bezárni az önállóan
    // megnyitott lapot), legalább jelezzük, hogy a mentés/mégse megtörtént.
    document.body.insertAdjacentHTML('afterbegin',
      '<div style="background:#eef7ee; color:#2d6a2d; padding:10px 14px; font-size:14px;">' +
      'Kész. Ezt a lapot most már bezárhatod.</div>');
  }

  function ervenyesitKotelezoMezoket() {
    const hianyzok = [];
    (sema.mezok || []).forEach(m => {
      if (m.kotelezo && !allapot[m.kod]) hianyzok.push(m.nev);
    });
    return hianyzok;
  }

  const mentesBtnEl = document.getElementById('mentesBtn');
  if (mentesBtnEl) {
    mentesBtnEl.addEventListener('click', () => {
      const hianyzok = ervenyesitKotelezoMezoket();
      if (hianyzok.length > 0) {
        alert('Mentés előtt töltsd ki: ' + hianyzok.join(', '));
        return;
      }
      frissitElonezet();
      // Egyelőre csak a saját (GitHubra szánt) rekordot mentjük fájlba — az OSM-kompatibilis
      // tagek (a "Generált OSM-tagek" panelen láthatók) egyelőre külön, kézzel kerülnek fel
      // az OSM-re. Később, ha a mentési folyamat készen áll, ez a gomb az OSM-re menthető
      // mezőket automatikusan a szerkesztésekhez (changesethez) is hozzáadhatja.
      const rekord = { ...formazottRekord(), tartoszerkezetek: tartoszerkezetek };
      const fajlnev = (allapot['szam'] || 'oszlop') + '.json';
      const blob = new Blob([JSON.stringify(rekord, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fajlnev;
      a.click();
      URL.revokeObjectURL(url);
      bezarAblakot();
    });
  }

  const megseBtnEl = document.getElementById('megseBtn');
  if (megseBtnEl) {
    megseBtnEl.addEventListener('click', () => {
      bezarAblakot();
    });
  }