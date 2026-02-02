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
