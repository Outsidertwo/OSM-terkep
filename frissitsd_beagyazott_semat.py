#!/usr/bin/env python3
"""
Frissíti a BEAGYAZOTT_SEMA-t az adatlap_motor.js-ben az adatlap_oszlop.json
mindenkori tartalmából.

Cél: az adatlap.html (a felmérési űrlap) offline-fallback sémája sose
csússzon szét a "hivatalos" adatlap_oszlop.json-tól. A séma minden
módosítása után futtatandó:

    python3 frissitsd_beagyazott_semat.py
    node --check adatlap_motor.js

A szkript KIZÁRÓLAG a "const BEAGYAZOTT_SEMA = {...};" sort cseréli le,
minden mást (kommentek, egyéb kód) érintetlenül hagy.
"""
import json
import re
import sys
from pathlib import Path

SEMA_JSON = Path(__file__).parent / "adatlap_oszlop.json"
MOTOR_JS = Path(__file__).parent / "adatlap_motor.js"

SOR_MINTA = re.compile(r"const BEAGYAZOTT_SEMA = \{.*?\};", re.S)


def main():
    if not SEMA_JSON.exists():
        sys.exit(f"HIBA: nem található {SEMA_JSON}")
    if not MOTOR_JS.exists():
        sys.exit(f"HIBA: nem található {MOTOR_JS}")

    sema = json.loads(SEMA_JSON.read_text(encoding="utf-8"))
    # Tömör, de érvényes JS-objektum-literál (a JSON szintaxisa itt megegyezik
    # a JS objektum-literáléval, ezért egyszerű json.dumps elég).
    tomor_json = json.dumps(sema, ensure_ascii=False, separators=(", ", ": "))
    uj_sor = f"const BEAGYAZOTT_SEMA = {tomor_json};"

    tartalom = MOTOR_JS.read_text(encoding="utf-8")
    talalatok = SOR_MINTA.findall(tartalom)
    if len(talalatok) != 1:
        sys.exit(
            f"HIBA: {len(talalatok)} db BEAGYAZOTT_SEMA sort találtam "
            f"(pontosan 1-nek kellene lennie) -- kézi ellenőrzés szükséges."
        )

    if talalatok[0] == uj_sor:
        print("A beágyazott séma már naprakész, nincs teendő.")
        return

    # A cserét függvényként adjuk át, hogy re.sub NE értelmezze a
    # cserélt szövegben lévő backslash-eket (\1, \g<0> stb.) -- azok itt
    # a JSON-string escape-jei, nem regex-visszahivatkozások.
    uj_tartalom = SOR_MINTA.sub(lambda m: uj_sor, tartalom, count=1)
    MOTOR_JS.write_text(uj_tartalom, encoding="utf-8")
    print(f"Frissítve: {MOTOR_JS.name} (a beágyazott séma most már megegyezik "
          f"a(z) {SEMA_JSON.name} tartalmával).")
    print("Ne felejtsd el a BUILD_VERZIO-t is frissíteni, és futtatni: node --check adatlap_motor.js")


if __name__ == "__main__":
    main()
