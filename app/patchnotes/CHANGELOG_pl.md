# 📦 Patchnotes

---

## 🆕 Wersja 2.5.1

### 🆕 Nowa funkcja: Giant Tracker
Niezależne okno w pluginie Killfeed — zbiera i wizualizuje statystyki zabójstw **Giants**, **Violets** i **Bosses**.

**Zakładki filtrów**
- 5 zakładek: **Wszystkie** · **Giants** · **Violets** · **Bosses** · **Drops**
- **Bosses** — filtruje po randze `boss` (czerwona ramka karty, osobny styl ikon)
- **Drops** — pokazuje tylko potwory z zarejestrowanymi dropami, w tym podgląd puli łupu (top 5 przedmiotów według rzadkości) bezpośrednio na karcie

**Statystyki zabójstw**
- Widok kart w trybie Compact i Expanded
- Zakresy czasu: Dzisiaj, Tydzień, Miesiąc, Rok, Całość
- Informacje o potworze: Ikona, Nazwa, Poziom, Żywioł, Ranga, HP, ATK

**Śledzenie dropów**
- Logowanie dropów z puli łupu potwora (z filtrem rzadkości)
- Historia dropów dla każdego potwora: nazwa przedmiotu, stan licznika zabójstw, znacznik czasu
- Statystyki: Ø zabójstw/drop, zabójstwa od ostatniego dropu

**Time to Kill (TTK)**
- Automatycznie mierzy czas walki z Giants, Violets i Bosses
- 10 s czasu karencji po odznaczeniu celu (buffowanie, leczenie itd.) — czas przerwy nie jest liczony do TTK
- Odcisk nazwy potwora + maks. HP: cel jest niezawodnie rozpoznawany ponownie
- Wyświetlanie: Ostatni TTK, Ø TTK, Najszybszy
- Zapisywane w historii zabójstw (kolumna CSV `TTK_ms`)

**Pozostałe**
- Sortowanie po liczbie zabójstw, nazwie lub poziomie
- Pole wyszukiwania do filtrowania po nazwie potwora

### ✨ Dalsze ulepszenia
- Killfeed: ulepszone rozpoznawanie potworów
- Nowe ważenie identyfikacji: HP potwora > Poziom potwora > Żywioł potwora
- Killfeed: śledzenie potworów liczy teraz zabite moby
- Killfeed: wprowadzono historię (na profil)
  - Dzienny plik dla każdej daty z pojedynczymi zabójstwami (`Data/Godzina`, `Postać`, `Poziom`, `Monster-ID`, `Ranga`, `Potwór`, `Żywioł`, `Przyrost EXP`, `Oczekiwane EXP`, `TTK_ms`)
  - Zagregowane dzienne podsumowanie z `Kills`, `EXP łącznie`, `Rozkład potworów`, `Pierwsze/Ostatnie zabójstwo`
- Killfeed: śledzenie potworów w panelu bocznym aktualizuje się teraz natychmiast po zabójstwach (bez przełączania zakładki)
- Killfeed: w akordeonach śledzenia potworów każda ranga ma teraz przycisk Kills z ListView pojedynczych zabójstw.
  Pojedyncze zabójstwa można usuwać bezpośrednio w ListView.
  Przy usuwaniu pojedynczych zabójstw aktualizowane są pliki historii AppData (daily/YYYY-MM-DD.csv, history.csv) oraz stan panelu bocznego.
- Killfeed: panel boczny stabilnie podąża teraz za profilem docelowym overlayu (bez przeskakiwania między ID profili)
- Zaktualizowano dane referencyjne potworów
- Zoptymalizowano wygląd okna dialogowego "Wybierz układ"
- Zoptymalizowano wygląd okna dialogowego "Zarządzaj profilami (wyloguj)"

### 🐛 Poprawki błędów
- Nakładki nie zasłaniają już okna dialogowego zamykania
- Akordeony w dokumentacji są teraz wyświetlane poprawnie
- Migracja z wersji 2.3.0 do nowej struktury AppData (`user/`) działa teraz niezawodnie
- Killfeed: ujemne skoki OCR EXP są teraz filtrowane jako szum OCR i nie zniekształcają już wykrywania zabójstw

### 🧹 Porządki
- Zmodularyzowano architekturę renderera (wewnętrzna restrukturyzacja)
- Wewnętrzny folder danych `api_fetch/` przemianowano na `cache/`
- Zreorganizowano strukturę katalogu AppData: dane są teraz uporządkowane w podfolderze AppData\Roaming\Flyff-U-Launcher\user
- Automatyczna migracja: istniejące dane są płynnie migrowane przy pierwszym uruchomieniu — z paskiem postępu
- Dane statyczne (m.in. dane referencyjne) są bundlowane w buildzie, aby były niezawodnie dostępne w buildach release
- Ograniczono logowanie debugowe Killfeed/overlay, aby konsola była bardziej czytelna

:::accordion[Nowe ścieżki przechowywania]
Wszystkie dane użytkownika znajdują się teraz pod `%APPDATA%\Flyff-U-Launcher\user\`:

- `user/config/settings.json` — Ustawienia klienta
- `user/config/features.json` — Flagi funkcji
- `user/profiles/profiles.json` — Profile launchera
- `user/profiles/rois.json` — Kalibracje ROI
- `user/profiles/ocr-timers.json` — Timery OCR
- `user/ui/themes.json` — Motywy
- `user/ui/tab-layouts.json` — Układy kart
- `user/ui/tab-active-color.json` — Kolor aktywnej karty
- `user/shopping/item-prices.json` — Ceny listy zakupów premium
- `user/plugin-data/` — Ustawienia wtyczek
- `user/plugin-data/killfeed/history/<profile-id>/history.csv` — Dzienne podsumowanie Killfeed na profil
- `user/plugin-data/killfeed/history/<profile-id>/daily/YYYY-MM-DD.csv` — Szczegółowa historia Killfeed dla każdego zabójstwa i dnia
- `user/cache/` — Dane API fetch i ikony
- `user/logs/` — Logi diagnostyczne
:::

---

## 🆕 Wersja 2.3.0

### 🐛 Poprawki

- Wartości OCR (panel boczny) są teraz poprawnie wykrywane, gdy gra działa w osobnym oknie multi-window
- Kalibracja ROI nie otwiera już błędnie nowej sesji, lecz używa istniejącego okna gry
- OCR teraz niezawodnie korzysta z dołączonego Tesseract — oddzielna instalacja nie jest już wymagana

### ✨ Ulepszenia

- Akordeony dokumentacji korzystają teraz z natywnych elementów HTML5 (JavaScript nie jest już potrzebny)

---

## 🆕 Wersja 2.2.0

### ➕ Nowe funkcje

**Layouty**
- Przebudowana funkcja layoutów, obsługiwane widoki gry:
  - 1x1 pojedyncze okno
  - 1x2 podział ekranu
  - 1x3, 1x4, 2x2, 3+2, 2x3, 4+3, 2x4 multi-screen
- Pasek postępu w pasku kart pokazujący otwieranie ekranów gry
- System wielu okien: można otworzyć kilka niezależnych okien sesji

**Skróty klawiszowe** — dowolnie przypisywane kombinacje (2-3 klawisze)
- Ukryj overlaye
- Panel boczny włącz/wyłącz
- Pasek kart włącz/wyłącz
- Zapisz zrzut ekranu aktywnego okna w `C:\Users\<USER>\Pictures\Flyff-U-Launcher\`
- Poprzednia karta / Następna karta
- Następna instancja okna
- Ustaw timer CD na 00:00, ikony czekają na kliknięcie
- Otwórz kalkulator FCoins
- Otwórz listę zakupów Premium

**Nowe ustawienia klienta**
- Szerokość / wysokość launchera
- Ładuj karty siatki sekwencyjnie
- Wyświetlanie kart dla layoutów
- Podświetl aktywny widok siatki
- Odświeżaj layouty przy zmianach
- Czas wyświetlania komunikatów statusu
- Kurs wymiany FCoins
- Tryb wyświetlania układu kart (Kompaktowy, Grupowany, Oddzielny, Mini-grid)

**Menu i narzędzia**
- Nowe menu „Tools (gwiazdka)” w pasku kart.
  Menu ukrywa widok przeglądarki, postacie pozostają zalogowane.
  - Narzędzia wewnętrzne: kalkulator FCoins → Penya, lista zakupów Premium
  - Linki zewnętrzne: strona Flyff Universe, Flyffipedia, Flyffulator, Skillulator
- Nowe menu w pasku kart (ikona klawiatury) pokazuje ustawione skróty.
  Menu ukrywa widok przeglądarki, postacie pozostają zalogowane.

**Dokumentacja**
- Nowa karta „Dokumentacja” w ustawieniach z opisami w różnych językach:
  - Tworzenie profilu, tworzenie layoutu, ścieżki danych i persystencja, pobieranie API,
    timer CD, killfeed, FCoins <-> Penya, lista zakupów Premium
- Tekst jest przetłumaczony na wszystkie dostępne języki. Niektórych obrazów jeszcze brakuje.
  Fallback: angielski interfejs → niemiecki interfejs.

**Inne**
- Dodano nowy motyw „Steel Ruby”
- Launcher pokazuje pod kanałem aktualności listę już otwartych profili
- Dodano możliwość darowizny w Ustawienia → Wsparcie
- Dialog zamykania przy multi-tabach ma opcję „Rozdziel na pojedyncze karty”
- Przy otwieraniu profilu, gdy sesja jest już aktywna, pojawia się pytanie czy dodać go do bieżącego okna czy utworzyć nowe

### 🧹 Porządki

- Okno launchera ma teraz minimalny rozmiar i jest responsywne do tego progu
- Domyślny rozmiar okna zmieniono z 980×640 na 1200×970
- Dodano przycisk „X” w menu ustawień
- Dopasowano rozmiar okna ustawień
- Zmieniono menu „Zarządzaj” dla profili i layoutów. Zawiera „Zmień nazwę” i „Usuń”
- Dodano przycisk „Profile” w wyborze layoutu; pokazuje profile w layoucie
- Dodano ikonę do przycisku powiększania paska kart
- Wyróżniono aktywną kartę w dialogu zamykania

### 🐛 Poprawki

- Naprawiono błąd, który powodował ukrycie gry przy zmianie karty

### 🐛 Znane problemy

- Zdarza się, że wpisy tekstowe w panelu bocznym nie docierają poprawnie
- Overlaye pojawiają się w oknach dialogowych, np. „Zamknij” i „Wybierz layout” — naprawione w 2.4.1 ✅
- Panel boczny nie jest wyświetlany w trybie okienkowym


---

## 🆕 Wersja 2.1.1

### ✨ Ulepszenia

- Overlaye nie zakrywają już zewnętrznych okien.
  Gdy okno jest nieaktywne, ukrywają się automatycznie.
- Naprawiono migotanie overlayów przy przesuwaniu okna.
  Również w ruchu są poprawnie ukrywane.
- Ostatnia karta w layoucie dostaje wystarczający czas ładowania przed włączeniem podziału ekranu.
- Wszystkie akcje w dialogu wyjścia (poza Anuluj) są teraz oznaczone jako przyciski ostrzegawcze (czerwone).
  „Anuluj” pozostaje neutralne.
- Dodano kartę patchnotes w menu ustawień.
  Wyświetla się w aktualnie wybranym języku.

### ➕ Nowe funkcje

- Dodano przycisk „+” na końcu timera CD

### 🧹 Porządki

- Usunięto nieużywany zakładkę w oknie ikon
- Usunięto nieużywany znaczek „RM-EXP” w prawym górnym rogu

---

## 🔄 Wersja 2.1.0

### 🚀 Nowości

- Aktualizacje można teraz wykonywać bezpośrednio przez launcher

---

## 🔄 Wersja 2.0.2

### 🐛 Poprawki

- Naprawiono błąd powodujący pusty panel boczny
- Poprawiono błędy tłumaczeń
