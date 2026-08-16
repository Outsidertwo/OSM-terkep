# Offline-first átalakítási terv

Státusz: **megtervezve, kódolás még nem kezdődött el**
Utolsó frissítés: 2026-08-16

## Cél

Minél kevesebb online adatforgalom, teljes offline működés (legfeljebb a
térképcsempék nem látszanak terepen). A háttér: az objektumok alapadatai már
megvannak, de a kiegészítő (felmérési) adatok rögzítése hosszú ideig, több
szakaszban, terepen (mobilon) történik. A kész objektumok adatai majdnem
konstansok — a folyamatos munka a hiányzó mezők fokozatos kitöltése.

## 1. lépés — Helyi tárolás

- Kizárólag a `sajat_adatok.ndjson` tartalma kerül `localStorage`-ba (a
  `vonalak.json` is bevehető, apró mérete miatt).
- **Indítás**: azonnal a `localStorage`-tartalomból rajzol (offline is
  működik, gyors indítás). Ha van hálózat, háttérben lekéri a friss
  `sajat_adatok.ndjson`-t, és összeveti a tárolt verzióval.
- **Ha eltérés van**: azonnal frissíti a `localStorage`-t és a térképet — a
  nyitott adatlapot ez nem érinti.
- **Overpass szerepe átalakul**: nem rutin adatforrás többé. Csak
  vonalankénti, ritka "regisztrációs" művelet — első letöltéskor (vagy amikor
  explicit "Új oszlopok keresése" gombot nyomsz) az összes talált oszlopot
  **egy kötegelt GitHub-commitban** beírja a `sajat_adatok.ndjson`-ba, üres
  felmérési mezőkkel, OSM-tagekkel és koordinátával. Ettől kezdve ez a fájl a
  teljes, hiánytalan nyilvántartás; az Overpass-t rutinszerűen (induláskor,
  minden vonalletöltéskor) többé nem kell hívni.

## 2. lépés — Szerkesztések helyi gyűjtése

- **Hatókör**: csak a GitHub-oldali (`sajat_adatok.ndjson`) kötegelés. Az
  OSM-changeset kötegelése később, a name/ref visszaírás megvalósításakor
  kerül tervezésre (jelenleg a Mentés gomb nem ír OSM name/ref taget — ismert,
  elhalasztott pont).
- **Mentés gomb** az adatlapon:
  1. Frissíti a rekordot a `sajatAdatokLocal`-ban (`localStorage`) → a térkép
     azonnal mutatja a változást.
  2. Az `_osm_id` bekerül a `pendingKulcsok` listába (`localStorage`, hogy
     böngésző-újraindítás se veszítse el aznap).
  3. **Nincs azonnali GitHub-hívás.**
  4. Frissül egy általános számláló a panelen ("N mentetlen módosítás") — nem
     oszloponkénti jelzés a térképen.
- **Védőháló**: `beforeunload` figyelmeztetés, ha van mentetlen módosítás és
  be akarod zárni a lapot/fület.
- **Fontos**: a pending-lista **nem hosszú életű piszkozat-tár**, csak
  napi/munkameneti puffer. A "biztonságot" a GitHub-on lévő állapot adja, nem
  a helyi tárolás tartóssága — ezért napi kötelező feltöltési szabály él (ld.
  3. lépés).

## 3. lépés — Kötegelt feltöltés

"Változások feltöltése" gomb folyamata:

1. Ha a `pendingKulcsok` üres → nincs teendő.
2. Lekéri a legfrissebb `sajat_adatok.ndjson`-t GitHub-ról a hozzá tartozó
   SHA-val.
3. A frissen lekért tartalomba beilleszti/felülírja azokat a sorokat,
   amelyek `_osm_id`-je szerepel a `pendingKulcsok`-ban (a
   `sajatAdatokLocal`-ból véve) — nem a teljes helyi tükröt tolja rá vakon.
4. Egyetlen PUT-tal elküldi, egy commit-üzenettel (pl. "Kötegelt mentés – 12
   rekord – 2026-08-16 14:32").
5. **Siker**: `pendingKulcsok` kiürül, "utolsó feltöltés" időbélyeg frissül,
   számláló nullázódik.
6. **Hiba** (nincs net, vagy GitHub 409 — közben megváltozott a SHA): semmi
   nem vész el, a `pendingKulcsok` érintetlen marad.
   - 409 ütközés esetén: **automatikus újrapróbálkozás** friss tartalomra
     alkalmazva a helyi változásokat.
   - Egyéb hiba (pl. nincs net): hibaüzenet, a gomb újra nyomható.

### Napi feltöltési szabály

- Napközben tetszőleges számú mentés mehet helyi pending-listába,
  GitHub-hívás nélkül.
- Ha aznap történt bármilyen rögzítés, azt **naponta legalább egyszer
  kötelezően fel kell tölteni** GitHub-ra.
- Intenzívebb napon több kötegelt feltöltés is történhet.
- Ha **több mint 12 órája** van mentetlen adat, a számláló mellett **kifejezett
  figyelmeztető jelzés** jelenik meg (szín/ikon váltás).

## Terepi használat — kontextus

A helyszíni felmérés csak mobilon történik (egy eszköz), ezért a
többeszközös ütközés valószínűsége elhanyagolható — nincs szükség bonyolult
összefésülő (merge) logikára, elég egy egyszerű védőháló (409-kezelés fent).

## Megvalósítási sorrend

Kis, tesztelhető lépésekben, `node --check` minden JS-módosítás után:

1. `localStorage`-alapú `sajat_adatok.ndjson`-cache + induláskori
   frissesség-ellenőrzés (1. lépés)
2. Overpass "vonal-regisztráció" kötegelt írása (1. lépés kiegészítése)
3. `pendingKulcsok` + helyi Mentés-folyamat átalakítása (2. lépés)
4. "Változások feltöltése" gomb + 409-kezelés + napi figyelmeztetés (3. lépés)

## Külön (később eldöntendő) témák

- Popupablak tartalmának átalakítása (nincs még részletezve)
- Térképi cimke "okos" logikára váltása + OSM name/ref visszaírás
