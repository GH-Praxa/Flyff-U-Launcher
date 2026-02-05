# 📦 Patchnotes

---

## 🆕 Wersja 2.3.0

### 🐛 Poprawki

- Wartości OCR (panel boczny) są teraz poprawnie wykrywane, gdy gra działa w osobnym oknie multi-window
- Kalibracja ROI nie otwiera już błędnie nowej sesji, lecz używa istniejącego okna gry

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
- Overlaye pojawiają się w oknach dialogowych, np. „Zamknij” i „Wybierz layout”
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
