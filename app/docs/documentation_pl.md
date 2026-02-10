## Podstawowe funkcje

:::accordion[Tworzenie profilu]

- Kliknij **„Nowy profil”** w nagłówku.

![Opis](create_profil/create_profil_1_pl.png)

- Wpisz nazwę profilu i kliknij **„Dodaj”**.

![Opis](create_profil/create_profil_2_pl.png)

- Kliknij ikonę koła zębatego, aby otworzyć ustawienia profilu.

![Opis](create_profil/create_profil_3_pl.png)

W tym menu możesz:

- zmienić nazwę profilu,
- wybrać klasę (określa emblemat profilu i służy jako filtr wyszukiwania),
- zdecydować, czy profil może być otwierany wielokrotnie jednocześnie.

Gdy **„Używaj w kartach”** jest włączone, profil można używać równolegle; gdy jest wyłączone, otworzy się tylko w jednym oknie.

Jeśli potrzebujesz obu wariantów, zduplikuj profil i używaj jednej kopii z włączoną opcją, drugiej bez.  
Uwaga: jednocześnie można używać tylko jednego wariantu danego profilu.

![Opis](create_profil/create_profil_4_pl.png)

Możesz tworzyć dowolną liczbę profili. Każdy profil ma własną zapisaną sesję Flyff.  
Ustawienia w grze nie przenoszą się między sesjami jak w przeglądarce.
:::

:::accordion[Tworzenie layoutu]

- Kliknij **„Graj”** na karcie utworzonego profilu. Upewnij się, że profil można używać w kartach.  
![Opis](create_layout/create_layout_1_pl.png)

- Wybierz żądaną siatkę layoutu.  
![Opis](create_layout/create_layout_3.png)

- Przypisz profil do każdej komórki i kliknij **„Dalej”**.  
![Opis](create_layout/create_layout_4_pl.png)

- Kliknij **„+”**, aby dodać kolejne karty layoutu.  
![Opis](create_layout/create_layout_5.png)

- Zapisz layout, aby uruchamiać go z launchera.  
![Opis](create_layout/create_layout_6.png)  
![Opis](create_layout/create_layout_7.png)

- Karty można zmienić nazwę prawym przyciskiem.
- Karty mogą ładować się sekwencyjnie lub równocześnie.  
  -> Ustawienia / Client Settings / Ładuj karty siatki sekwencyjnie
:::

:::accordion[Ścieżki danych i trwałość (Windows)]

Wszystkie dane użytkownika znajdują się domyślnie w `%APPDATA%/Flyff-U-Launcher/` (Electron `userData`). Ważne pliki/katalogi:

| Funkcja/Plik                | Cel                                           | Ścieżka względem `%APPDATA%/Flyff-U-Launcher` |
|-----------------------------|-----------------------------------------------|-----------------------------------------------|
| Dane i ikony API-Fetch      | Surowe dane/ikony dla pluginów (przedmioty, potwory…) | `api_fetch/<endpoint>/...`                    |
| Ceny Premium Shopping List  | Ceny FCoin na przedmiot                       | `item-prices.json`                            |
| Profile                     | Profile launchera (nazwa, klasa, flagi)       | `profiles.json`                               |
| Layouty                     | Siatki layoutów kart                          | `tabLayouts.json`                             |
| Kalibracje ROI              | Definicje ROI dla OCR/Killfeed                | `rois.json`                                   |
| Timery OCR                  | Częstotliwości próbkowania OCR (Killfeed/CD-Timer) | `ocr-timers.json`                         |
| Ustawienia pluginów         | Ustawienia per plugin (np. killfeed, cd-timer)| `plugin-data/<pluginId>/settings.json`        |
| Motywy i kolory kart        | Motywy użytkownika / kolor aktywnej karty     | `themes.json`, `tabActiveColor.json`          |

:::

## Pluginy

Pluginy zwykle potrzebują danych i ikon z API. Pobierz je poprzez API-Fetch.

:::accordion[API-Fetch]

- Otwórz **„API-Fetch”**.  
![Opis](api_fetch/api_fetch_1.png)  
![Opis](api_fetch/api_fetch_2.png)

- Pluginy oczekują danych API w konkretnym folderze. Upewnij się, że jest ustawiony jako wyjściowy.  
![Opis](api_fetch/api_fetch_3.png)

- Wybierz potrzebne endpointy i kliknij **„Start”**.  
![Opis](api_fetch/api_fetch_4.png)

:::

:::accordion[CD-Timer]
- Śledzi cooldowny umiejętności/przedmiotów. Po wygaśnięciu ikona z czerwoną ramką prosi o naciśnięcie klawisza.
- Wymagane API-Fetch do ikon: "Item" + "Skill".

- Upewnij się, że CD-Timer jest włączony.  
![Opis](cd_timer/cd_timer_1_de.png)

- W panelu bocznym pojawi się zakładka CD-Timer:
![Opis](cd_timer/cd_timer_2_de.png)
- „0/0 aktiv” pokazuje liczbę skonfigurowanych i aktywnych timerów.
- Checkbox „Alle aktiv” aktywuje wszystkie timery.
- Przycisk „Alle abgelaufen” resetuje wszystkie timery do 0:00:00 i czeka na klawisz.

- Wyświetlanie ikon timerów jest konfigurowalne: pozycja X/Y, rozmiar, liczba kolumn.

- Kliknij „+”, aby dodać nowy timer.

- ![Opis](cd_timer/cd_timer_3_de.png)
- Checkbox aktywuje ten timer.
- Przycisk „Icon” otwiera okno wyboru ikony.
- Tekst z pola wprowadzania pojawia się na ikonie. Wskazówka: wpisz oczekiwany klawisz, np. „F1”.
- Po ustawieniu czasu i hotkeya wybierz cel:  
  Main (ikona miecza w launcherze) lub widok Support (ikona kostura).  
  Decyduje to, w którym oknie oczekiwany jest klawisz. Ikona zawsze wyświetla się w oknie Main.  
  Możesz ustawić timery na buffy RM i pokazywać w Main, że trzeba je odnowić.


- ![Opis](cd_timer/cd_timer_4_de.png)

- Timery kierowane na Support mają pomarańczową poświatę.


- ![Opis](cd_timer/cd_timer_5_de.png)
:::

:::accordion[Killfeed]
- Śledzi zabicia i EXP w czasie rzeczywistym dzięki OCR.
- Wymagany endpoint API-Fetch dla danych potworów: "Monster".

**Funkcje:**
- Detekcja zabicia przez OCR (automatyczna detekcja zmian EXP)
- Statystyki sesji i łączne (zabicia, EXP, zabicia/h, EXP/h itd.)
- Odznaki overlay wyświetlane bezpośrednio w oknie gry

**Uwaga:**
- Obecnie killfeed wspiera tylko levelowanie 1v1.
- Planowane rozszerzenie na AOE i śledzenie zabicia na grupę/bossa.

**Konfiguracja:**

1. **Jeśli trzeba: pobierz dane API**
   - Otwórz plugin [API-Fetch](action:openPlugin:api-fetch) i zaznacz endpoint **„Monster”**.
   - Uruchom pobieranie. Dane potworów potrzebne są do weryfikacji zabicia z tabelą EXP.  
     (zob. dokumentację API-Fetch)
2. **Aktywuj plugin**
   - W ustawieniach pluginów w launcherze włącz **Killfeed**.  
   ![Opis](killfeed/killfeed_1_de.png)

3. **Skalibruj regiony OCR** (jednorazowo na profil)
   - Uruchom okno gry z włączonym „przyciskiem miecza” z launchera.  
    ![Opis](killfeed/killfeed_2_de.png)
   - W panelu bocznym otwórz kalibrację ROI.
   - Zaznacz obszary wokół:
     - **EXP%** – pasek doświadczenia
     - **Level** – poziom
     - **Character name** – nazwa postaci
   - Zapisz ROI. Są trzymane per profil, ustawiasz je tylko raz.  
    ![Opis](killfeed/killfeed_3_de.png)
   - Lewy przycisk myszy przeciąga ROI.
   - Po ustawieniu ROI wciśnij TAB, by wybrać następny.  
    ![Opis](killfeed/killfeed_4_de.png)
   - Dla Killfeed ustaw: LVL, NAME, EXP, ENEMY (poziom wroga), ENEMY HP
   - Naciśnij „Schließen” lub ESC, by zakończyć.  
    ![Opis](killfeed/killfeed_5_de.png)
   - ROI można później doprecyzować.  
    ![Opis](killfeed/killfeed_6_de.png)
   - Rozpoznane wartości są widoczne na żywo w panelu.
   - Najważniejsze są LVL i EXP; ENEMY i ENEMY HP to wsparcie na przyszłość.
   - Jeśli poziom w OCR jest błędny, ustaw go ręcznie – ma pierwszeństwo przed OCR.
   - Jeśli OCR „zgubi” EXP (np. po zmianie postaci), ustaw ręcznie ponownie;  
     reguły EXP mogą blokować auto-korektę.
   - ![Opis](killfeed/killfeed_7_de.png)


4. **Wybierz profil w panelu bocznym**
   - Otwórz zakładkę **Killfeed** w panelu.
   - Z listy wybierz profil do śledzenia.  
    ![Opis](killfeed/killfeed_8_de.png)


5. **Graj**
   - Po zabiciu potworów OCR wykryje zmiany EXP.
   - Zabicia i statystyki pojawią się w overlay i panelu automatycznie.

**Panel boczny:**
- Włączaj/wyłączaj odznaki (Zabicia/Sesja, EXP/h, Zabicia do lvl up). 
![Opis](killfeed/killfeed_9_de.png)
- Skala overlay (0.6x–1.6x).
- Liczba wierszy dla odznak. 
![Opis](killfeed/killfeed_10_de.png)
- Reset statystyk sesji przyciskiem Reset.
- Dane każdej sesji są zapisywane lokalnie.

![Opis](killfeed/killfeed_11_de.png)

- Każde wykryte zabicie jest wyświetlane w panelu bocznym i zapisywane trwale.
- Zapis odbywa się per profil do plików CSV w AppData:
  - `user/plugin-data/killfeed/history/<profile-id>/daily/YYYY-MM-DD.csv` (pojedyncze zabicia)
  - `user/plugin-data/killfeed/history/<profile-id>/history.csv` (podsumowanie dzienne)
- W akordeonach śledzenia potworów dostępny jest przycisk `Kills` dla każdego rangu.
- `Kills` otwiera widok listy z pojedynczymi zabiciami wybranego rangu.

![Opis](killfeed/killfeed_12_de.png)

- W widoku listy można usuwać pojedyncze zabicia (`Delete` -> `Confirm`).
- Usunięcie od razu aktualizuje widok panelu bocznego oraz pliki historii Killfeed (`daily/YYYY-MM-DD.csv` i `history.csv`).

![Opis](killfeed/killfeed_13_de.png)


**Reguły zaliczenia zabicia:**
Zabicie jest liczone, gdy spełnione są wszystkie warunki:
- Poziom się nie zmienił (brak level-up/down).
- EXP wzrosło o >0,001% (epsilon).
- Skok EXP maks. 40% (próg suspect); powyżej oznaczane jako podejrzane i odrzucane.
- W ostatnich 1500 ms wykryto pasek HP wroga (OCR). Bez paska: min. 2250 ms od ostatniego zabicia.
- Jeśli są dane potworów z API-Fetch: zysk EXP między 10% a 10× wartości z tabeli EXP; poza zakresem = błąd OCR.

**Odrzucane zmiany EXP:**
- Level-up/down: brak zaliczenia zabicia.
- Spadek EXP: ignorowany (szum OCR).
- Skok EXP > 40%: oznaczony jako podejrzany, nie liczony.
- Brak paska HP i <2250 ms od ostatniego zabicia: nie liczony.

**Uwagi:**
- OCR musi być aktywny, by wykrywać zabicia.
- Statystyki typu zabicia/h liczone są na ruchomym 5‑minutowym oknie.
:::

:::accordion[Killfeed: Giant Tracker]
# UWAGA:
## Do czasu pierwszego zarejestrowanego zabicia Gianta, Violeta lub Bossa wyświetlane są dane przykładowe, aby pokazać działanie funkcji.
---
Giant Tracker to osobne okno w pluginie Killfeed. Śledzi i wizualizuje statystyki zabójstw **Giants**, **Violets** i **Bossów** — w tym zakresy czasu, dropy i Time to Kill (TTK). Pięć zakładek filtrów (Wszystkie, Giants, Violets, Bosses, Drops) umożliwia ukierunkowane filtrowanie według rangi lub zarejestrowanych dropów.

**Otwieranie:**
- Przycisk **„Giant Tracker"** znajduje się w panelu bocznym Killfeed.
- Kliknięcie otwiera osobne okno z przeglądem wszystkich śledzonych bossów.
- Jeśli nie ma jeszcze rzeczywistych danych o killach, wyświetlane są dane przykładowe.

![Opis](killfeed_giant_tracker/killfeed_giant_tracker_1_de.png)

---

**Filtrowanie i sortowanie:**
- Pasek filtrów pozwala zawęzić wyświetlanie:
  - **Wszystkie** / **Giants** / **Violets** / **Bosses** / **Drops** — filtruje według rangi potwora lub dropów.
  - **Bosses** — pokazuje tylko potwory z rangą `boss` (np. Clockworks, Meteonyker). Karty bossów mają czerwoną ramkę.
  - **Drops** — pokazuje tylko potwory z co najmniej jednym zarejestrowanym dropem. Dodatkowo w karcie wyświetlany jest podgląd loot poola (top 5 itemów według rzadkości).
  - **Sortowanie** — według zabójstw (rosnąco/malejąco), nazwy (A–Z / Z–A) lub poziomu (rosnąco/malejąco).
  - **Pole wyszukiwania** — filtruje karty według nazwy potwora.

![Opis](killfeed_giant_tracker/killfeed_giant_tracker_2_de.png)

---

**Widoki kart:**

Każdy śledzony potwór jest wyświetlany jako karta. Dostępne są dwa widoki:

*Karta kompaktowa (widok domyślny):*
- Ikona potwora, nazwa, poziom, żywioł, ranga
- Statystyki walki (HP, ATK)
- Przegląd zabójstw: Dziś / Łącznie
- Wyświetlanie TTK (jeśli dostępne dane pomiarowe): `TTK: 45.2s (Śr 52.3s)`
- Ostatni kill (czas), liczba dropów
- Przycisk **„Szczegóły"** do rozwinięcia

![Opis](killfeed_giant_tracker/killfeed_giant_tracker_3_de.png)

*Karta rozszerzona (widok szczegółowy):*
- Wszystkie pola z karty kompaktowej
- Statystyki zabójstw według okresu: Dziś, Tydzień, Miesiąc, Rok, Łącznie
- Statystyki TTK: Śr. TTK, Ostatni TTK, Najszybszy
- Sekcja dropów: Liczba dropów, śr. zabójstw na drop, zabójstwa od ostatniego dropu
- Historia dropów (zwijana): Pojedyncze dropy z nazwą itemu, licznikiem zabójstw i znacznikiem czasu
- Przycisk **„Zapisz drop"** do rejestrowania dropu
- Przycisk **„Zwiń"** do zamknięcia widoku szczegółowego

![Opis](killfeed_giant_tracker/killfeed_giant_tracker_4_de.png)

---

**Śledzenie dropów:**

Przycisk **„Zapisz drop"** w karcie rozszerzonej otwiera dialog:
- Wyświetla loot pool potwora (jeśli dane pobrano przez API-Fetch).
- Itemy można wyszukiwać po nazwie i filtrować według rzadkości (Pospolity, Niepospolity, Rzadki, Bardzo rzadki, Unikalny, Ostateczny).
- Kliknięcie na item rejestruje drop z aktualnym znacznikiem czasu i licznikiem zabójstw.
- Wcześniej zarejestrowane dropy można indywidualnie usuwać z historii.

![Opis](killfeed_giant_tracker/killfeed_giant_tracker_5_de.png)
![Opis](killfeed_giant_tracker/killfeed_giant_tracker_6_de.png)

---

**Time to Kill (TTK):**

TTK automatycznie mierzy czas walki z bossem — od pierwszego uderzenia do zabicia.

*Działanie:*
- **Start:** Pasek HP wroga wykryty z `aktualne < max` (walka rozpoczęta).
- **Stop:** Zabicie potwierdzone przez wykrycie EXP. Skumulowany czas walki zostaje zapisany.
- **Pauza:** Pasek HP znika (np. przez odznaczenie celu do buffowania lub leczenia). Rozpoczyna się 10-sekundowy okres karencji.
- **Wznowienie:** Jeśli ten sam boss zostanie ponownie wybrany w ciągu 10 sekund, timer kontynuuje. Czas pauzy nie jest wliczany do TTK.
- **Przerwanie:** Jeśli okres karencji minie bez ponownego wybrania bossa, pomiar TTK zostaje odrzucony.

*Identyfikacja celu:*
- Na początku walki zapisywana jest nazwa potwora i maksymalne HP.
- Przy ponownym wybraniu porównywane są nazwa i maks. HP — timer wznawia się tylko wtedy, gdy się zgadzają.
- Jeśli wybrany zostanie inny boss, bieżący pomiar jest przerywany i rozpoczyna się nowy.
- Jeśli wybrany zostanie normalny potwór, timer bossa pauzuje; normalne zabójstwa są nadal liczone.

*Wyświetlanie i statystyki:*
- Karta kompaktowa: `TTK: [ostatni kill] (Śr [średnia])`
- Karta rozszerzona: Śr. TTK, Ostatni TTK, Najszybszy
- Wartości TTK są zapisywane per kill w historii CSV (kolumna `TTK_ms`) i agregowane per potwór.

*Ograniczenie:*
- Pomiar TTK jest aktywny tylko dla Giants, Violets i Bossów. Normalne potwory nie są mierzone.
- Dokładność zależy od częstotliwości próbkowania OCR (typowo: co 500–1000 ms).

---

**Źródła danych:**
- Dane o killach pochodzą z historii CSV Killfeed (`daily/YYYY-MM-DD.csv`).
- Logi dropów są przechowywane osobno dla każdego profilu.
- Szczegóły potworów (ikona, HP, ATK, loot pool) pochodzą z danych pobranych przez API-Fetch.

:::

## Narzędzia

Narzędzia otworzysz skrótem klawiszowym lub w pasku kart przez menu gwiazdki.

:::accordion[Fcoin <-> Penya]

![Opis](tools/fcoin_zu_penya/fcoin_zu_penya_1.png)
- Przelicza FCoins na Penya i odwrotnie.
- Wpisz aktualny kurs Penya za FCoin. Kurs jest zapisywany i ładowany przy następnym uruchomieniu.
- Zmień kwotę FCoin albo wynik w Penya – przeliczenie działa w obie strony.

![Opis](tools/fcoin_zu_penya/fcoin_zu_penya_2.png)

:::

:::accordion[Premium Shopping List]
- Narzędzie do planowania zakupów w sklepie Premium; pomaga oszacować zapotrzebowanie przed kupnem FCoins. Wymagane włączone popupy.
- Wymagania: endpoint API-Fetch **„Item”** z ikonami; bez tego wyszukiwarka jest pusta.
![Opis](tools/premium_shopping_list/premium_shopping_list_1.png)
- Jak używać:
  1. Otwórz narzędzie w menu gwiazdki i wpisz nazwę przedmiotu.
  2. Lista wyników (max 20) pokazuje ikonę, nazwę, kategorię; dodaj przez **„+ Add”** lub zwiększ ilość.  
  ![Opis](tools/premium_shopping_list/premium_shopping_list_2.png)
  3. Ustaw cenę (FCoins) i ilość na liście; cena zapisuje się po wyjściu z pola i będzie wstępnie wypełniona później.
  4. Checkbox oznacza kupione/załatwione, „X” usuwa wpis.
  5. Pasek na dole pokazuje sumę (`cena × ilość`) w FCoins.
- Zapisywanie: ceny są trwałe w folderze danych launchera (`%APPDATA%/Flyff-U-Launcher/item-prices.json`); lista jest nowa w każdej sesji.

:::
