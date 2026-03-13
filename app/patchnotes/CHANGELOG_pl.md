# 📦 Patchnotes

---
## 🆕 Wersja 3.2.0

### ⚙️ Ulepszenia

- **Quest Guide: wyświetlanie EXP** — wartości EXP są wyświetlane jako procenty z 4 miejscami po przecinku; poziom OCR jest zawsze używany do obliczania EXP, tryb poziomu kontroluje jedynie filtrowanie questów

### 🐛 Poprawki błędów

- **API-Fetch**: wybór endpointów (checkboxy) był ignorowany — naprawiono brakujący parametr w handlerach IPC
- **API-Fetch**: kafelki mapy świata (`tile_grid`) są teraz pobierane poprawnie
- Raporty błędów mogą być teraz wysyłane nawet bez istniejących wpisów w logach
- Przycisk wysyłania protokołu błędów pokazuje teraz informację zwrotną po wysłaniu

---
## 🐛 Wersja 3.1.1

### 🐛 Poprawki błędów

- Interfejs Sidepanel całkowicie uszkodzony w spakowanej wersji (białe tło, brak stylów) — Content Security Policy blokowała style inline w tymczasowych plikach HTML

---
## 🆕 Wersja 3.1.0

### ✨ Nowe funkcje

**Nowe typy layoutów**
- Layouty pionowe: 2x1, 3x1, 4x1 (widoki jeden nad drugim)
- Layouty asymetryczne: okno główne + 2–3 okna boczne po prawej (`main-r2`, `main-r3`) lub na dole (`main-b2`, `main-b3`)
- Podział asymetrycznych layoutów regulowany suwakiem (min 20% / maks 80%)
- Wybór layoutu z podglądem ASCII: przy najechaniu wyświetlany jest diagram layoutu

**Eksport/Import profili**
- Eksportuj i importuj profile jako pliki `.flyffprofile`
- Zawiera metadane profilu, ciasteczka sesji Electron i dane localStorage
- Umożliwia tworzenie kopii zapasowych i transfer między komputerami

**Nazwy postaci i klasy per postać**
- Przypisanie nazw postaci i klas do profilu — wyświetlane jako odznaki z ikoną klasy na liście profili, z możliwością filtrowania i wyboru w pluginach przez Combobox

**Ogłoszenia launchera**
- Nowa sekcja w prawym panelu wyświetla wiadomości od dewelopera bez aktualizacji aplikacji — np. znane błędy, aktualne prace lub planowane funkcje; dostępne po niemiecku i angielsku, można wyłączyć w ustawieniach
- Otwarte profile w prawym panelu można rozwijać i zwijać

**Ustawienie czcionki**
- Nowe ustawienie „Czcionka nakładek i UI" w ustawieniach klienta — dostępne czcionki: Josefin Sans, Roboto, Open Sans, Lato, Montserrat, Raleway, Nunito, Ubuntu, Cinzel; czcionka jest stosowana w nakładkach launchera i elementach UI opartych na DOM w grze

**Ustawienie rozmiaru czcionki**
- Nowe ustawienie „Rozmiar czcionki launchera": rozmiar tekstu w oknie launchera skalowalny (75–150%), nie dotyczy samej gry

**Dziennik błędów i wiadomość do dewelopera**
- Okno logów przeniesione z Sidepanel do paska kart — umożliwia przeglądanie, zapisywanie i usuwanie logów błędów oraz wysyłanie wiadomości do dewelopera (wyświetlane błędy są dołączane); 60-sekundowy cooldown

**Plugin Quest Guide**
- Nowy plugin w Sidepanel: wyświetla questy z NPC startowym/końcowym, zadaniem i nagrodami ze znacznikiem na mapie — wymaga danych questów, NPC, potworów i przedmiotów z API-Fetch

**Ujednolicony kalkulator ulepszeń**
- Kalkulator ulepszeń rozszerzony o dodatkowe obliczenia dla broni, biżuterii, piercingu pancerza, piercingu broni, Ultimate z systemem Pity, FWC i bonusem eventowym oraz już wykonanymi próbami

**Podpowiedzi UI i ikony pomocy**
- Wszystkie ważne elementy sterujące w launcherze mają podpowiedzi (we wszystkich 8 językach)
- Ikony pomocy (?) dla złożonych funkcji: nazwa profilu, tryb kart/okien, nazwy postaci
- Wskazówki dotyczące szerokości/wysokości launchera, filtrów, wyboru layoutu i komórek siatki

**Telemetria**
- Opcjonalne anonimowe statystyki uruchomień (wersja, system operacyjny, losowe ID)
- Domyślnie włączone, brak danych osobowych, można wyłączyć w dowolnym momencie

**Sprawdzanie aktualizacji i przywracanie wersji**
- Nowe ustawienie: automatyczne sprawdzanie aktualizacji przy starcie (wł./wył.)
- Ręczny przycisk „Sprawdź teraz" w ustawieniach
- Przywracanie wersji: starsze wersje launchera (od 3.0.5) można zainstalować bezpośrednio z ustawień
- Lista rozwijana ze wszystkimi dostępnymi wydaniami GitHub z datą i oznaczeniem aktualnej wersji

### 🚀 Wydajność

**Optymalizacja systemu OCR**
- Bezpieczna dla platformy metoda przechwytywania ekranu: `xwd` na Linux (bez kontaktu z GPU), `capturePage()` na Win/Mac — zapobiega przestojom GPU i zawieszeniom gry
- W przypadku błędu przechwytywania na Linux skan jest pomijany zamiast zawieszania gry
- Cache hashów pikseli: OCR jest pomijany, gdy klatka się nie zmieniła — zmniejsza obciążenie CPU przy statycznej zawartości gry
- Puste wyniki OCR są prawidłowo cachowane — brak niepotrzebnych powtórzeń Tesseract na niezmienionych pikselach
- Globalny limit współbieżności Tesseract (maks. 1 jednocześnie) — zapobiega wygłodzeniu CPU procesu GPU
- Cache w pamięci dla profili, ROI-Store i ROI-Visibility-Store zamiast częstych odczytów z bazy danych

**Optymalizacja nakładek**
- Efektywne odpytywanie nakładek: zminimalizowane zmiany przezroczystości i zmniejszone interwały
- Linux: unikanie niepotrzebnych cykli Show/Hide dla przezroczystych nakładek

### ⚙️ Ulepszenia

- **Ulepszone karty layoutów**: podgląd ASCII typu layoutu bezpośrednio na karcie layoutu; wyświetlanie „X profili" zamiast „X kart"; bardziej kompaktowa prezentacja
- **Bardziej kompaktowe karty profili**: zmniejszona wysokość kart, postacie z ikonami klas jako poziome odznaki pod nazwą profilu
- **Całkowicie przebudowane ustawienia**: nowy układ z paskiem bocznym z kategoryzowanymi podstronami, przełącznikami Toggle i kartami Slider
- **Wyświetlanie RAM**: ustawienie „Pokaż użycie RAM" ze szczegółami pamięci na profil, plugin i proces systemowy
- **Killfeed-Overlay z możliwością pozycjonowania**: nakładkę można przeciągać, pozycja jest zapisywana (x/y w layoucie)
- **Wybór postaci w Killfeed**: nazwy postaci wybierane przez Combobox z profilu
- **Przycisk Side-Panel** w pasku kart sesji (zamiast w nakładce)
- **Uproszczone karty Killfeed i Scan w Sidepanel**: bardziej przejrzysta prezentacja i zmniejszona złożoność

### 🐛 Poprawki błędów

- Stłumione ostrzeżenia GLib/GTK-Assertion na Linux (nieszkodliwe wewnętrzne komunikaty Chromium)

### 📦 Wsparcie Linux

- Pliki binarne i biblioteki Tesseract dołączone dla Linux
- Pliki językowe tessdata dołączone dla Linux

### 🌐 Tłumaczenia

- Rozszerzone tłumaczenia

---
## 🐛 Wersja 3.0.5

### 🐛 Poprawki błędów
- Naprawiono: problem z logowaniem przez konto Google

---
## 🐛 Wersja 3.0.4

### 🐛 Poprawki błędów (macOS)
- Naprawiono: błąd "damaged and can't be opened" — aplikacja wewnątrz DMG jest teraz podpisywana ad-hoc przed złożeniem DMG (wcześniej krok podpisywania następował dopiero po gotowym DMG).
- Naprawiono: kolejność jest teraz prawidłowa: `package → sign → DMG erstellen`.
- Uwaga: macOS przy pierwszym uruchomieniu nadal wyświetla dialog "Nieznany deweloper". Kliknij prawym przyciskiem na aplikację → **Otwórz** → **Otwórz mimo to**, lub użyj polecenia Terminal z README.

---
## 🆕 Wersja 3.0.0

### 🆕 Nowe narzędzie: Kalkulator kosztów ulepszeń
- Oblicza przewidywane koszty ulepszeń przedmiotów od +0 do +10
włącznie z zapotrzebowaniem na materiały, liczbą prób i porównaniem między Low Sprotect a Sprotect.

### ✨ Nowe funkcje
- Nowa karta Logs w Sidepanel z podglądem błędów na żywo (Warn/Error) oraz akcjami usuwania i zapisywania.
- Plugin API-Fetch 3.0.0 z nowym natywnym interfejsem Sidepanel (bez osobnego okna Python-UI).

### 🚀 Platforma i dystrybucja - wsparcie Linux i Mac
- Pipeline budowania/wydawania dla Windows, macOS i Linux w GitHub Actions.
- Nowe formaty pakietów: macOS DMG oraz Linux AppImage/DEB/RPM.
- Platformowe bundlowanie Tesseract (win32, darwin, linux) z dostosowanym wykrywaniem w czasie działania/fallbackiem.

### 🐛 Poprawki błędów
- Poprawiono kurs Fcoin do Penya
- Killfeed: zmniejszono warunki wyścigu przy szybkich aktualizacjach OCR (serializacja per profil), aktualizacje broadcast nie są już odrzucane.

### 📦 Runtime i zależności
- Biblioteka Sharp do przetwarzania obrazów dołączona do pakietu (nie wymaga osobnej instalacji).

### ⚙️ Ulepszenia
- Rozpoznawanie potworów w Killfeed priorytetyzuje teraz HP potwora (z tolerancją), następnie Element/Level.
- Rozpoznawanie celów TTK bardziej niezawodne dzięki tolerancji HP; okno karencji potwora zmniejszone z 5s do 2s.
- Silnik statystyk lepiej rozróżnia szum OCR poziomu od rzeczywistych zmian poziomu.
- ### Dalsze ulepszenia Killfeed w przygotowaniu
- API-Fetch przebudowany w ramach nowej platformy. Nadal dostępny w ustawieniach, dodatkowo w Sidepanel.
- Ustawienia -> Dokumentacja rozszerzona.

### 🧹 Porządki
- Usunięto stare artefakty Python API-Fetch (.py, .exe) na rzecz wariantu JS/Sidepanel.
- Zasoby Tesseract przeniesione do nowych podfolderów platformowych.

:::accordion[Ścieżki przechowywania wg platformy]
Wszystkie dane użytkownika znajdują się w zależności od platformy w następujących katalogach:

| **Windows** | `%APPDATA%\Flyff-U-Launcher\user\` |
| **macOS** | `~/Library/Application Support/Flyff-U-Launcher/user/` |
| **Linux** | `~/.config/Flyff-U-Launcher/user/` |

**Nowe pliki od 2.5.1:**
- `user/tools/upgrades/upgrade_cost_calc.json` — Kalkulator kosztów ulepszeń
- `user/logs/errors-*.txt` — Dzienniki błędów
- `user/logs/ocr/` — Logi debugowania OCR

:::

---
## 🆕 Wersja 2.5.1

### 🆕 Nowa funkcja: Giant Tracker
Samodzielne okno w pluginie Killfeed — rejestruje i wizualizuje statystyki zabójstw dla **Giantów**, **Violetów** i **Bossów**.

**Karty filtrów**
- 5 kart: **Wszystko** · **Giants** · **Violets** · **Bossy** · **Dropy**
- **Bossy** — filtruje według rangi `boss` (czerwona ramka karty, własny styl ikon)
- **Dropy** — pokazuje tylko potwory z zalogowanymi dropami, w tym podgląd puli łupów (Top 5 przedmiotów wg rzadkości) bezpośrednio na karcie

**Statystyki zabójstw**
- Widok kart z trybem kompaktowym i rozszerzonym
- Okresy: Dziś, Tydzień, Miesiąc, Rok, Łącznie
- Informacje o potworze: ikona, nazwa, poziom, żywioł, ranga, HP, ATK

**Śledzenie dropów**
- Logowanie dropów przez pulę łupów potwora (z filtrem rzadkości)
- Historia dropów per potwór: nazwa przedmiotu, stan licznika zabójstw, znacznik czasu
- Statystyki: Ø zabójstw/drop, zabójstwa od ostatniego dropu

**Time to Kill (TTK)**
- Automatycznie mierzy czas walki z Giantami, Violetami i Bossami
- 10s karencja przy odznaczeniu celu (buffy, leczenie itp.) — czas pauzy nie wlicza się do TTK
- Nazwa potwora + odcisk Max-HP: cel jest niezawodnie rozpoznawany ponownie
- Wyświetlanie: Ostatni TTK, Ø TTK, Najszybszy
- Zapis w historii zabójstw (kolumna CSV `TTK_ms`)

**Inne**
- Sortowanie według zabójstw, nazwy lub poziomu
- Pole wyszukiwania do filtrowania po nazwie potwora

### ✨ Dalsze ulepszenia
- Killfeed: ulepszone rozpoznawanie potworów
- Nowa waga identyfikacji: HP potwora > Poziom potwora > Żywioł potwora
- Killfeed: śledzenie potworów zlicza teraz zabite moby
- Killfeed: wprowadzono historię (per profil)
  - Plik dzienny per datę z pojedynczymi zabójstwami (`Data/Godzina`, `Postać`, `Poziom`, `ID potwora`, `Ranga`, `Potwór`, `Żywioł`, `Przyrost EXP`, `Oczekiwany EXP`, `TTK_ms`)
  - Zagregowane podsumowanie dzienne z `Zabójstwa`, `EXP łącznie`, `Rozkład potworów`, `Pierwszy/ostatni kill`
- Killfeed: śledzenie potworów w Sidepanel aktualizuje się teraz natychmiast po zabójstwach (nie trzeba przełączać kart)
- Killfeed: w akordeonach śledzenia potworów jest teraz per ranga przycisk Kills z ListView pojedynczych zabójstw.
  Pojedyncze zabójstwa można usuwać bezpośrednio w ListView.
  Przy usuwaniu pojedynczych zabójstw pliki historii AppData (daily/YYYY-MM-DD.csv, history.csv) i status Sidepanel są aktualizowane.
- Killfeed: Sidepanel stabilnie podąża teraz za docelowym profilem nakładki (bez przeskakiwania między ID profili)
- Zaktualizowano dane referencyjne potworów
- Zoptymalizowano wygląd dialogu "Wybierz layout"
- Zoptymalizowano wygląd dialogu "Zarządzaj profilami (wyloguj)"

### 🐛 Poprawki błędów
- Nakładki nie zasłaniają już dialogu zamykania
- Akordeony w dokumentacji są prawidłowo wyświetlane
- Migracja z wersji 2.3.0 do nowej struktury AppData (`user/`) działa teraz niezawodnie
- Killfeed: ujemne skoki OCR-EXP są przechwytywane jako szum OCR i nie fałszują już rozpoznawania zabójstw

### 🧹 Porządki
- Architektura renderera zmodularyzowana (wewnętrzna restrukturyzacja)
- Wewnętrzny folder danych `api_fetch/` przemianowany na `cache/`
- Struktura katalogów AppData zreorganizowana: dane są teraz posortowane w podfolderze AppData\Roaming\Flyff-U-Launcher\user
- Automatyczna migracja: istniejące dane są bezproblemowo migrowane przy pierwszym uruchomieniu — z paskiem postępu
- Dane statyczne (m.in. dane referencyjne) są dołączane do buildu, aby były niezawodnie dostępne w wydaniach
- Zmniejszone logowanie debugowania Killfeed/Overlay, aby konsola była bardziej czytelna

:::accordion[Nowe ścieżki przechowywania]
Wszystkie dane użytkownika znajdują się teraz w `%APPDATA%\Flyff-U-Launcher\user\`:

- `user/config/settings.json` — Ustawienia klienta
- `user/config/features.json` — Flagi funkcji
- `user/profiles/profiles.json` — Profile launchera
- `user/profiles/rois.json` — Kalibracje ROI
- `user/profiles/ocr-timers.json` — Timery OCR
- `user/ui/themes.json` — Motywy
- `user/ui/tab-layouts.json` — Layouty kart
- `user/ui/tab-active-color.json` — Aktywny kolor karty
- `user/shopping/item-prices.json` — Ceny Premium listy zakupów
- `user/plugin-data/` — Ustawienia pluginów
- `user/plugin-data/killfeed/history/<profile-id>/history.csv` — Podsumowanie dzienne Killfeed per profil
- `user/plugin-data/killfeed/history/<profile-id>/daily/YYYY-MM-DD.csv` — Szczegółowa historia Killfeed per zabójstwo i dzień
- `user/cache/` — Dane API-Fetch i ikony
- `user/logs/` — Logi diagnostyczne
:::

---

## 🆕 Wersja 2.3.0

### 🐛 Poprawki błędów

- Wartości OCR (Sidepanel) są teraz prawidłowo rozpoznawane, gdy gra działa w osobnym oknie Multi-Window
- Kalibracja ROI nie otwiera już błędnie nowej sesji, lecz korzysta z istniejącego okna gry
- OCR korzysta teraz niezawodnie z dołączonego Tesseract — osobna instalacja nie jest już potrzebna

### ✨ Ulepszenia

- Akordeony dokumentacji używają teraz natywnych elementów HTML5 (JavaScript nie jest już potrzebny)

---

## 🆕 Wersja 2.2.0

### ➕ Nowe funkcje

**Layouty**
- Funkcja layoutów przebudowana, obsługiwane widoki gry:
  - 1x1 Pojedyncze okno
  - 1x2 Splitscreen
  - 1x3, 1x4, 2x2, 3+2, 2x3, 4+3, 2x4 Multiscreeny
- Pasek postępu w pasku kart, pokazujący postęp otwierania ekranów gry
- System Multi-Window: można otwierać wiele niezależnych okien sesji

**Hotkeys** — dowolnie konfigurowalne kombinacje klawiszy (2-3 klawisze)
- Ukryj nakładki
- Sidepanel wł./wył.
- Pasek kart wł./wył.
- Zrzut ekranu aktywnego okna zapisz w `C:\Users\<USER>\Pictures\Flyff-U-Launcher\`
- Poprzednia karta / Następna karta
- Następna instancja okna
- Ustaw CD-Timer na 00:00, ikony czekają na kliknięcie
- Otwórz kalkulator FCoins
- Otwórz Premium listę zakupów

**Nowe ustawienia klienta**
- Szerokość launchera / Wysokość launchera
- Sekwencyjne ładowanie Grid-Tabs
- Wyświetlanie kart dla layoutów
- Podświetlanie aktywnego Grid-View
- Aktualizuj layouty przy zmianach
- Czas trwania komunikatów statusu
- Kurs wymiany FCoins
- Tryb wyświetlania layoutu kart (Kompaktowy, Grupowany, Rozdzielony, Mini-Grid)

**Menu i narzędzia**
- Nowe menu "Narzędzia (symbol gwiazdki)" dodane do paska kart.
  Menu ukrywa Browserview, postacie pozostają zalogowane.
  - Wewnętrzne narzędzia: Kalkulator FCoins na Penya, Premium lista zakupów
  - Linki zewnętrzne: Flyff Universe Homepage, Flyffipedia, Flyffulator, Skillulator
- Nowe menu w pasku kart (klawiatura) wyświetla ustawione hotkeye.
  Menu ukrywa Browserview, postacie pozostają zalogowane.

**Dokumentacja**
- Nowa karta w menu ustawień "Dokumentacja" z objaśnieniami w różnych językach:
  - Tworzenie profilu, tworzenie layoutu, ścieżki danych i persystencja, API-Fetch,
    CD-Timer, Killfeed, FCoins <-> Penya, Premium lista zakupów
- Tekst jest przetłumaczony na wszystkie dostępne języki. Obrazy częściowo jeszcze brakują.
  Fallback: angielskie UI → niemieckie UI.

**Inne**
- Dodano nowy motyw "Steel Ruby"
- Launcher wyświetla pod newsfeedem listę już otwartych profili
- Dodano funkcję darowizn w Ustawienia → Wsparcie
- Dialog zamykania przy MultiTabs zawiera opcję "Rozdziel na osobne karty"
- Przy otwieraniu profilu, gdy sesja jest już aktywna, wyświetla się pytanie, czy dodać do bieżącego okna, czy utworzyć nowe okno

### 🧹 Porządki

- Okno launchera ma teraz minimalny rozmiar i jest do niego responsywne
- Domyślny rozmiar okna launchera zmieniony z 980×640 na 1200×970
- Dodano przycisk "X" w menu ustawień
- Dostosowano rozmiar okna ustawień
- Zmieniono menu "Zarządzaj" dla profili i layoutów. Zawierają teraz "Zmień nazwę" i "Usuń"
- Dodano przycisk "Profile" w wyborze layoutu. Wyświetla zawarte profile layoutu
- Dodano ikonę przycisku powiększania paska kart
- Podświetlono wyświetlanie aktywnej karty w dialogu zamykania

### 🐛 Poprawki błędów

- Naprawiono błąd powodujący ukrycie gry przy przełączaniu kart

### 🐛 Znane błędy

- Zdarza się, że wpisy tekstowe w Sidepanel nie docierają prawidłowo
- Nakładki wyświetlają się w oknach dialogowych np. "Zamknij" i "Wybierz layout"     ✅ naprawiono w 2.4.1
- Sidepanel nie wyświetla się w trybie okienkowym


---

## 🆕 Wersja 2.1.1

### ✨ Ulepszenia

- Nakładki nie zasłaniają już zewnętrznych okien.
  Przy nieaktywności okna są automatycznie ukrywane.
- Naprawiono migotanie nakładek przy przesuwaniu okna.
  Również tutaj nakładki są teraz prawidłowo ukrywane.
- Ostatnia karta w layoucie otrzymuje teraz wystarczający czas ładowania przed aktywacją splitscreenu.
- Wszystkie akcje w dialogu zamykania (oprócz Anuluj) są teraz oznaczone jako przyciski Danger (czerwone).
  „Anuluj" celowo pozostaje neutralne.
- Dodano kartę Patchnotes w menu ustawień.
  Wyświetlanie odbywa się w wybranym języku.

### ➕ Nowe funkcje

- Dodano przycisk „+" na końcu CD-Timera

### 🧹 Porządki

- Usunięto nieużywaną kartę w dialogu ikon
- Usunięto nieużywaną odznakę „RM-EXP" w prawym górnym rogu

---

## 🔄 Wersja 2.1.0

### 🚀 Nowości

- Aktualizacje mogą być teraz przeprowadzane bezpośrednio przez launcher

---

## 🔄 Wersja 2.0.2

### 🐛 Poprawki błędów

- Naprawiono błąd wyświetlający pusty Sidepanel
- Poprawiono błąd w tłumaczeniu