// Közös térképi/adatlapi címke-építő logika.
//
// Korábban két külön implementáció létezett: a térkép (index.html buildLabelHtml,
// nyers OSM tageket nézett, pl. t.sulyos === 'yes' -- ez soha nem talált semmit, mert
// a mentett adat nem így van tárolva) és az adatlap (epitsCimkeHtml, az élő `allapot`
// objektumból épített). A kettő szét tudott csúszni, és a vizuális (CSS margóval
// megoldott) térköz az id és a leíró rész között Ctrl+C-Ctrl+V másoláskor eltűnt,
// mert nem volt köztük valódi szóköz-karakter.
//
// Ez a fájl az egyetlen forrás mindkét helyen: mindkettő ugyanazt a mentett rekordot
// (adatlapon: `allapot`, térképen: `feature.properties._sajat`) adja át neki.
//
// Formázási szabály (Lászlóval egyeztetve, 2026-09):
// - Fa oszlop (oszlop_tipus === 'FA'): az F betű közvetlenül a szám mögé kerül,
//   szóköz nélkül (pl. "07424F"), és semmilyen más jelölést nem kaphat -- a fa
//   oszlopnak nincs egyéb funkciója.
// - Minden más esetben: az oszlopszám és minden további jelölés (oszloptípus
//   betűjele + opcionális C tőcsavaros toldalék, szikraköz, súly, fixpont, földelés,
//   földelési pont, szakaszoló/trafó azonosító) egymástól MINDIG valódi szóközzel
//   különül el (pl. "07424 KC szk s fp Ü11").
(function (global) {
  function escapeHtmlCimke(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // rekord: a mentett _sajat / allapot objektum (szam, oszlop_tipus, tocsavaros,
  // szikrakoz, sulyos, fixpont, foldeles, foldelesi_pont, szakaszolo, szakaszolo_nev,
  // trafo, trafo_nev, ...). Tetszőleges (akár hiányos/üres) rekordot elfogad.
  function epitsCimkeHtml(rekord) {
    rekord = rekord || {};
    const szamNyers = rekord['szam'] || '';
    const faOszlop = rekord['oszlop_tipus'] === 'FA';

    let idResz = '';
    let leiroResz = '';

    if (faOszlop) {
      const szamMegjelenites = szamNyers + 'F';
      idResz = szamMegjelenites
        ? `<span class="label-id">${escapeHtmlCimke(szamMegjelenites)}</span>` : '';
    } else {
      idResz = szamNyers
        ? `<span class="label-id">${escapeHtmlCimke(szamNyers)}</span>` : '';

      const leiroBitek = [];
      let tipusKod = rekord['oszlop_tipus'];
      if (tipusKod) {
        if (rekord['tocsavaros']) tipusKod += 'C';
        leiroBitek.push(escapeHtmlCimke(tipusKod));
      }
      if (rekord['szikrakoz']) leiroBitek.push('szk');
      if (rekord['sulyos']) leiroBitek.push('s');
      if (rekord['fixpont']) leiroBitek.push('fx');
      if (rekord['foldeles'] === 'hosszu') leiroBitek.push('H');
      else if (rekord['foldeles'] === 'rovid') leiroBitek.push('R');
      if (rekord['foldelesi_pont']) leiroBitek.push('fp');
      if (rekord['szakaszolo'] && rekord['szakaszolo_nev']) leiroBitek.push(escapeHtmlCimke(rekord['szakaszolo_nev']));
      if (rekord['trafo'] && rekord['trafo_nev']) leiroBitek.push(escapeHtmlCimke(rekord['trafo_nev']));

      leiroResz = leiroBitek.length > 0
        ? `<span class="label-desc">${leiroBitek.join(' ')}</span>` : '';
    }

    if (!idResz && !leiroResz) return '';
    // Valódi szóköz-karakter (nem csak CSS margin!) az id és a leíró rész közt.
    return idResz + (idResz && leiroResz ? ' ' : '') + leiroResz;
  }

  global.epitsCimkeHtml = epitsCimkeHtml;
})(typeof window !== 'undefined' ? window : this);
