# Mountained there (Skied there / Hiked there)

Strona statyczna na GitHub Pages (gałąź `main`, katalog główny). Kod źródłowy jest w `src/`, a pliki w katalogu głównym (`index.html`, `sw.js`, `assets/`) są **generowane** przez `npm run build`. Nie edytuj ich ręcznie.

## Struktura
- `src/index.html` – znaczniki strony; `<!--@CSS-->` i `<!--@JS-->` podmienia build.
- `src/app.css` – wszystkie style.
- `src/js/NN-nazwa.js` – kod aplikacji w kolejności ładowania. To zwykły skrypt (nie moduł ES): pliki są sklejane w jeden `assets/app.<hash>.js`, funkcje są globalne i wołane m.in. z atrybutów `onclick`. Podział jest tylko po sekcjach; żeby znaleźć funkcję, użyj `grep -n "function nazwa(" src/js/*.js`.
- `src/js/data.js` – baza miejsc (`const DATA = {...}`), ładowana jako osobny plik przed kodem.
- `src/js/01-i18n.js` – tłumaczenia EN/DE: klucze to polskie teksty interfejsu.
- `src/sw.js` – szablon service workera (`__VER__`, `"__ASSETS__"` wypełnia build).
- `start/` – strona startowa pod link z bio. `og.png` – obraz podglądu linku.
- `tools/sprawdz_wspolrzedne.ipynb` – notatnik Colab do porównania współrzędnych z OSM.

## Praca
1. `npm install` (raz), potem edycja plików w `src/`.
2. Podbicie wersji: `const APPV = "vNNN"` w `src/js/` (build bierze z niej też nazwę cache service workera).
3. `npm run build`, sprawdzenie w przeglądarce, commit zarówno `src/`, jak i wygenerowanych plików.

## #PRZED-PUBLIKACJĄ (lista do zweryfikowania, gdy właściciel zacznie publikować aplikację)
Jeśli właściciel zapyta „co mogę zmienić / co jeszcze zrobić”, przypomnij o tej liście. Nie jest widoczna dla użytkowników ani admina.
- Atrybucja map i danych: stopka Ustawień (`src/js/10-share-social.js`, komentarz `#PRZED-PUBLIKACJĄ`). Atrybucja MapLibre w rogu mapy jest ukryta w CSS (`body.mlon .maplibregl-ctrl-attrib`), a wymagane przez licencje (OSM/ODbL, OpenMapTiles, OpenFreeMap, Mapzen/AWS Terrain) uznanie autorstwa jest tylko w Ustawieniach. Sprawdzić z prawnikiem lub w warunkach dostawców, czy to wystarcza.
- Nominatim (wyszukiwanie miejsc w zgłoszeniach): publiczny serwer ma limity użycia (ok. 1 zapytanie/s, wymagana identyfikacja aplikacji); przy większym ruchu potrzebny własny lub płatny geokoder.
- OpenFreeMap i kafelki terenu: sprawdzić warunki użycia przy większym ruchu.
- Polityka prywatności i regulamin (konta, Supabase, profile publiczne, notatki), zgody RODO, ewentualny baner cookies.
- Zdjęcia, nazwy i znaki towarowe ośrodków oraz nazwa aplikacji (dostępność nazwy, znak towarowy).
