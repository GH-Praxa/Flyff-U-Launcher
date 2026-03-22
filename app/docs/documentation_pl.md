## Podstawowe funkcje

:::accordion[Tworzenie profilu]

**Krok 1 — Utwórz nowy profil:**
- Kliknij **„Nowy profil”** w nagłówku.

![Opis](create_profil/create_profil_1_pl.png)

**Krok 2 — Wpisz nazwę profilu:**
- Wpisz nazwę profilu i kliknij **„Dodaj”**.
- Kliknij **„Zamknij”**, aby zamknąć okno bez tworzenia profilu.

![Opis](create_profil/create_profil_2_pl.png)

**Krok 3 — Karta profilu:**

Każdy profil wyświetlany jest jako karta na liście:

![Opis](create_profil/create_profil_3_pl.png)

| Nr | Element | Opis |
|----|---------|------|
| ❶ | Uchwyt przeciągania | Sortuj profile przez przeciągnij i upuść |
| ❷ | Cel Overlay | Określa, który profil otrzymuje nakładki OCR i panel boczny |
| ❸ | Cel Supportera | Określa, który profil służy jako widok supportera dla CD-Timera |
| ❹ | Tryb uruchamiania | Pokazuje, czy profil otwiera się w trybie kart czy okna |
| ❺ | Koło zębate | Otwórz ustawienia profilu |
| ❻ | Graj | Rozpocznij sesję z tym profilem |

**Krok 4 — Ustawienia profilu:**

Kliknij ikonę koła zębatego ❺, aby otworzyć ustawienia:

![Opis](create_profil/create_profil_4_pl.png)

| Nr | Element | Opis |
|----|---------|------|
| ❶ | Nazwa profilu | Zmień nazwę profilu |
| ❷ | Klasa + nazwa postaci | Wybierz klasę z listy rozwijanej i wpisz nazwę postaci. Każda postać otrzymuje własną klasę. |
| ❸ | Dodaj postać | Dodaj kolejną nazwę postaci do profilu (przycisk „Dodaj”) |
| ❹ | Używaj w kartach | Włączone: profil można używać w layoutach z wieloma kartami. Wyłączone: profil otwiera się tylko w osobnym oknie. |
| ❺ | Zapisz | Zastosuj zmiany |
| ❻ | Kopiuj profil | Tworzy kopię profilu ze wszystkimi ustawieniami |
| ❼ | Usuń | Trwale usuń profil |
| ❽ | Zamknij | Zamknij okno dialogowe |

Jeśli chcesz używać profilu zarówno w kartach, jak i w trybie okna, skopiuj go przyciskiem ❻ i użyj jednej kopii na tryb.

**Krok 5 — Lista profili z postaciami:**

Skonfigurowane profile wyświetlane są na liście z nazwami postaci i ikonami klas:

![Opis](create_profil/create_profil_5_pl.png)

- Każda postać wyświetlana jest jako odznaka z ikoną klasy pod nazwą profilu.
- Filtr klasy i wyszukiwanie nazw w nagłówku przeszukują wszystkie postacie ze wszystkich profili.
- Pluginy takie jak Killfeed korzystają z zapisanych nazw postaci za pomocą listy rozwijanej.

Możesz tworzyć dowolną liczbę profili. Każdy profil ma własną zapisaną sesję Flyff.
Ustawienia w grze nie przenoszą się między sesjami jak w przeglądarce.

**Eksport/Import profili:**

![small](create_profil/create_profil_6.png)

| Nr | Element | Opis |
|----|---------|------|
| ❶ | Eksport | Zapisz profil jako plik `.flyffprofile` |
| ❷ | Import | Wczytaj plik `.flyffprofile` i utwórz nowy profil |

Eksportowany plik zawiera:

- Metadane profilu (nazwa, klasa, ustawienia)
- Ciasteczka sesji Electron (dane logowania)
- Dane localStorage (ustawienia gry)

Umożliwia to tworzenie kopii zapasowych i transfer między komputerami.
:::

:::accordion[Tworzenie layoutu]

**Krok 1 — Rozpocznij layout:**

Kliknij **„Graj”** na profilu z włączonymi kartami.

![Opis](create_layout/create_layout_1_pl.png)

**Krok 2 — Wybierz siatkę:**

Wybierz żądaną siatkę. Po najechaniu kursorem wyświetla się **podgląd ASCII** siatki.

![Opis](create_layout/create_layout_2.png)

*Layouty symetryczne:*
- **1×1** — Pojedyncze okno
- **1×2 / 2×1** — Dwa okna obok siebie / jedno nad drugim
- **1×3 / 3×1** — Trzy okna obok siebie / jedno nad drugim
- **1×4 / 4×1** — Cztery okna obok siebie / jedno nad drugim
- **2×2** — Cztery okna w siatce
- **3+2** — Trzy u góry, dwa na dole
- **2×3** — Sześć okien w siatce
- **4+3** — Cztery u góry, trzy na dole
- **2×4** — Osiem okien w siatce

*Layouty asymetryczne:*
- **1+2 →** — Okno główne z lewej, 2 boczne po prawej
- **1+3 →** — Okno główne z lewej, 3 boczne po prawej
- **1+2 ↓** — Okno główne u góry, 2 boczne na dole
- **1+3 ↓** — Okno główne u góry, 3 boczne na dole

Layouty asymetryczne oferują **suwak** w pasku kart do regulacji podziału (min. 20 % / maks. 80 %).

![small](create_layout/create_layout_slider.png)

**Krok 3 — Przypisz profile:**

Przypisz profil do każdej komórki. Niepotrzebne komórki mogą pozostać puste.

![Opis](create_layout/create_layout_3_pl.png)

| Nr | Element | Opis |
|----|---------|------|
| ❶ | Komórki siatki | Pokazuje komórki wybranej siatki. Kliknij komórkę, aby przypisać profil z listy poniżej. |
| ❷ | Lista profili | Wszystkie profile z włączonymi kartami. Kliknij, aby przypisać do wybranej komórki. |
| ❸ | Dalej | Potwierdza przypisanie i uruchamia layout z przypisanymi profilami. |

**Krok 4 — Zapisz layout:**

Przycisk zaznaczony na obrazku (na pasku tytułu) otwiera dialog zapisu.

![Opis](create_layout/create_layout_4.png)

Nadaj layoutowi nazwę i kliknij **„Zapisz”**.

![Opis](create_layout/create_layout_5_pl.png)

**Krok 5 — Karta layoutu w launcherze:**

Zapisane layouty wyświetlane są jako karta na liście profili:

![Opis](create_layout/create_layout_6_pl.png)

- Karta pokazuje **nazwę layoutu**, **liczbę profili** i **miniaturę siatki**.
- **„Graj”** uruchamia cały layout.
- **Koło zębate** otwiera ustawienia layoutu (nazwa, przypisanie profili, siatka).

**Niestandardowy układ (Custom):**

Oprócz predefiniowanych siatek opcja **„Niestandardowy"** pozwala stworzyć dowolny układ. W edytorze można swobodnie umieszczać i zmieniać rozmiar 1–8 komórek na płótnie.

![Opis](custom_layout_editor.png)

| Nr | Element | Opis |
|-----|---------|-------------|
| ❶ | Dodaj komórkę | Dodaje nową komórkę (maks. 8). |
| ❷ | Siatka | Dokładność przyciągania przy przesuwaniu/zmianie rozmiaru (1%, 5% lub 10%). |
| ❸ | Suwak | Ustawia regulowaną linię podziału: poziomą (↔), pionową (↕) lub brak (—). Zielona linia może być przeciągana w edytorze i umożliwia dostosowanie podziału w trakcie użytkowania. |
| ❹ | Komórki | Każda ponumerowana komórka może być przeciągana i zmieniana za pomocą uchwytów na rogach i krawędziach. |
| ❺ | Właściwości | Pozycja X/Y oraz szerokość/wysokość wybranej komórki w procentach. Wartości można również wpisać bezpośrednio. |
| ❻ | Usuń komórkę | Usuwa aktualnie wybraną komórkę. |

Nakładające się komórki są układane w stos — górna komórka odbiera dane wejściowe. Po zatwierdzeniu układu następuje przypisanie profili, jak w przypadku predefiniowanych siatek.

**Powiązane ustawienia** (w Ustawienia / Layout):
- **Ładuj karty siatki sekwencyjnie** — Uruchamiaj karty po kolei zamiast jednocześnie
- **Aktualizuj layouty przy zmianach** — Automatycznie zapisuj zmiany layoutu
- **Podświetl aktywny widok siatki** — Wizualnie wyróżnij aktualnie wybraną kartę
- **Wyświetlanie kart dla layoutów** — Tryb wyświetlania kart layoutu w launcherze
- **Opóźnienie layoutu** — Opóźnienie przy przełączaniu kart

**Powiązane skróty** (w Ustawienia / Skróty):
- **Poprzednia karta** / **Następna karta** — Przełączaj między kartami
- **Następne okno** — Przełączaj fokus między otwartymi oknami
- **Pasek kart wł./wył.** — Pokaż/ukryj pasek kart w oknie sesji

**Multi-Window:**

Oprócz layoutów można otwierać wiele niezależnych okien sesji równolegle. Przy otwieraniu profilu gdy sesja jest aktywna, pojawia się pytanie czy dodać do bieżącego okna czy utworzyć nowe.
:::

:::accordion[Skróty klawiszowe]

Skróty klawiszowe to dowolne kombinacje klawiszy (2–3 klawisze), które działają nawet gdy okno gry jest aktywne.

**Konfiguracja:**
- Otwórz **Ustawienia → Skróty klawiszowe**.
- Kliknij na znacznik obok akcji i naciśnij żądaną kombinację klawiszy.
- Konflikty są automatycznie wykrywane i wyświetlane.

![Opis](hotkeys/hotkeys_settings_de.png)

**Dostępne akcje:**

| Akcja | Opis |
|-------|------|
| Przełącz nakładki | Pokaż lub ukryj wszystkie nakładki |
| Przełącz panel boczny | Otwórz lub zamknij panel boczny |
| Przełącz pasek kart | Pokaż/ukryj pasek kart w oknie sesji |
| Poprzednia karta | Przełącz na poprzednią kartę |
| Następna karta | Przełącz na następną kartę |
| Następne okno | Przełącz fokus między otwartymi oknami |
| Wyzeruj CD timer | Ustaw wszystkie CD timery na 00:00 (oczekiwanie na naciśnięcie klawisza) |
| Zrzut ekranu | Zapisz zrzut ekranu aktywnego okna |
| Kalkulator FCoins | Otwórz kalkulator FCoins |
| Lista zakupów | Otwórz listę zakupów premium |

Skonfigurowane skróty klawiszowe można w każdej chwili sprawdzić za pomocą **ikony klawiatury** na pasku kart.

![Opis](hotkeys/hotkeys_menu_de.png)
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

3. **Skalibruj regiony OCR** (jednorazowo na profil)
   - Uruchom okno gry z włączonym „przyciskiem miecza” z launchera.  
   - W panelu bocznym otwórz kalibrację ROI.
   - Zaznacz obszary wokół:
     - **EXP%** – pasek doświadczenia
     - **Level** – poziom
     - **Character name** – nazwa postaci
   - Zapisz ROI. Są trzymane per profil, ustawiasz je tylko raz.  
   - Lewy przycisk myszy przeciąga ROI.
   - Po ustawieniu ROI wciśnij TAB, by wybrać następny.  
   - Dla Killfeed ustaw: LVL, NAME, EXP, ENEMY (poziom wroga), ENEMY HP
   - Naciśnij „Schließen” lub ESC, by zakończyć.  
   - ROI można później doprecyzować.  
   - Rozpoznane wartości są widoczne na żywo w panelu.
   - Najważniejsze są LVL i EXP; ENEMY i ENEMY HP to wsparcie na przyszłość.
   - Jeśli poziom w OCR jest błędny, ustaw go ręcznie – ma pierwszeństwo przed OCR.
   - Jeśli OCR „zgubi” EXP (np. po zmianie postaci), ustaw ręcznie ponownie;  
     reguły EXP mogą blokować auto-korektę.


4. **Wybierz profil w panelu bocznym**
   - Otwórz zakładkę **Killfeed** w panelu.
   - Z listy wybierz profil do śledzenia.  


5. **Graj**
   - Po zabiciu potworów OCR wykryje zmiany EXP.
   - Zabicia i statystyki pojawią się w overlay i panelu automatycznie.

**Panel boczny:**
- Włączaj/wyłączaj odznaki (Zabicia/Sesja, EXP/h, Zabicia do lvl up). 
- Skala overlay (0.6x–1.6x).
- Liczba wierszy dla odznak. 
- Reset statystyk sesji przyciskiem Reset.
- Dane każdej sesji są zapisywane lokalnie.


- Każde wykryte zabicie jest wyświetlane w panelu bocznym i zapisywane trwale.
- Zapis odbywa się per profil do plików CSV w AppData:
  - `user/plugin-data/killfeed/history/<profile-id>/daily/YYYY-MM-DD.csv` (pojedyncze zabicia)
  - `user/plugin-data/killfeed/history/<profile-id>/history.csv` (podsumowanie dzienne)
- W akordeonach śledzenia potworów dostępny jest przycisk `Kills` dla każdego rangu.
- `Kills` otwiera widok listy z pojedynczymi zabiciami wybranego rangu.


- W widoku listy można usuwać pojedyncze zabicia (`Delete` -> `Confirm`).
- Usunięcie od razu aktualizuje widok panelu bocznego oraz pliki historii Killfeed (`daily/YYYY-MM-DD.csv` i `history.csv`).



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

:::accordion[Przewodnik po zadaniach]
- Pokazuje dostępne zadania filtrowane według poziomu, regionu i typu — z wizualizacją łańcuchów i śledzeniem postępów na profil.
- Wymagane API-Fetche: **Quest**, **NPC**, **Monster**, **Item**

**Konfiguracja:**
1. Upewnij się, że wtyczka **Quest Guide** jest włączona.
2. Pobierz wymagane dane API przez API-Fetch (Quest, NPC, Monster, Item).
3. Wybierz zakładkę **Quest Guide** w panelu bocznym.

**Filtry i wyszukiwanie:**
- **Pole wyszukiwania** — filtruje po nazwie zadania, NPC lub przedmiocie
- **Tryb poziomu:**
  - *OCR ±* — pokazuje zadania odpowiadające aktualnie wykrytemu poziomowi OCR (z regulowaną tolerancją, domyślnie: ±5)
  - *Ręczny* — wprowadź poziom i tolerancję ręcznie
  - *Min–Max* — ustaw stały zakres poziomów (domyślnie: 1–30)
- **Region** — ogranicza wyświetlanie do konkretnego regionu gry
- **Filtr typu** — Wszystkie / Łańcuchowe / Dzienne / Powtarzalne / Kategoria
- **Podkategoria** — Dla powtarzalnych zadań: Zwierzęta, Kolekcja, Polowanie na potwory, Dostawa, Inne

**Śledzenie postępów:**
- Oznacz zadania jako ukończone — postęp jest zapisywany per profil
- Pole wyboru „Pokaż ukończone" do wyświetlania/ukrywania
- Pole wyboru „Pokaż niedostępne" do wyświetlania/ukrywania
- Przycisk resetowania resetuje postępy

**Pasek statystyk:**
Pokazuje liczbę wszystkich, dostępnych i ukończonych zadań w skrócie.

**Mapa zadań:**
- Otwiera interaktywną mapę z lokalizacjami zadań za pomocą przycisku mapy w panelu bocznym.

![Opis](quest_guide/quest_guide_sidepanel_de.png)
![Opis](quest_guide/quest_guide_map_de.png)
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

:::accordion[Kalkulator kosztów ulepszeń]

Oblicza oczekiwane koszty ulepszeń przedmiotów od +0 do +10 — w tym wymagane materiały, liczbę prób i porównanie różnych systemów ochrony.

![Opis](tools/upgrade_cost_calc/upgrade_cost_calc_1.png)

**Ustawienia:**

- **Typ kości:** Powerdice 4/6 (standardowe) lub Powerdice 12 (wyższa szansa powodzenia)
- **Od poziomu / Do poziomu:** Określ zakres ulepszenia (np. +3 → +7)
- **Tryb:**
  - **Porównaj** – Pokazuje koszty obu systemów ochrony obok siebie
  - **S-Protect** – Oblicza ze zwykłymi scrollami S-Protect
  - **S-Protect (Low)** – Oblicza z tańszymi scrollami Low S-Protect

**Ceny materiałów:**

W sekcji „Materiały" możesz ustawić aktualne ceny rynkowe dla następujących przedmiotów:
- Minerał
- Eron
- S-Protect
- Low S-Protect
- Powerdice 4, 6, 12

Zaznaczenie „Posiadane" wyklucza materiały z kalkulacji kosztów.

![Opis](tools/upgrade_cost_calc/upgrade_cost_calc_2.png)

**Wynik:**

Po kliknięciu „Oblicz" pojawia się szczegółowa tabela dla każdego poziomu ulepszenia:

| Kolumna | Znaczenie |
|---------|-----------|
| Poziom | Docelowy poziom ulepszenia |
| Szansa | Szansa powodzenia w procentach |
| Próby | Oczekiwana liczba prób |
| Minerał | Wymagane minerały |
| Eron | Wymagane erony |
| Penya | Koszty w Penya |
| Ochrony | Wymagane scrolla ochronne |
| Całkowity koszt | Suma wszystkich kosztów w Penya |

![Opis](tools/upgrade_cost_calc/upgrade_cost_calc_3.png)

W trybie porównania oba systemy ochrony (S-Protect vs. S-Protect Low) są wyświetlane obok siebie. Tańsza opcja jest podświetlona na zielono.

**Zapisywanie:** Ceny i ustawienia są zapisywane automatycznie (`%APPDATA%/Flyff-U-Launcher/user/tools/upgrades/upgrade_cost_calc.json`).

:::

:::accordion[Ogłoszenia]

W prawym panelu launchera wyświetlane są wiadomości od dewelopera — bez konieczności aktualizacji aplikacji. Przykłady: znane błędy, bieżące prace rozwojowe lub planowane funkcje. Wyświetlanie jest dostępne w języku niemieckim i angielskim i można je wyłączyć w ustawieniach.

![Opis](announcements/announcements_de.png)
:::

:::accordion[Wiadomości i dziennik błędów (Logi)]

**Ikona logów** na pasku kart otwiera osobne okno z dziennikiem błędów.

**Funkcje:**
- Wyświetla wszystkie ostrzeżenia i komunikaty o błędach ze znacznikiem czasu: `[HH:MM:SS] [POZIOM] [MODUŁ] Wiadomość`
- **Usuń** — Usuń wszystkie wpisy logów
- **Zapisz** — Eksportuj logi jako plik `.txt` (do `user/logs/`)
- **Wyślij wiadomość** — Wyślij logi bezpośrednio do dewelopera (Discord)
  - Opcjonalnie: dodaj opis i nazwę ingame/Discord
  - 60-sekundowy cooldown, aby zapobiec przypadkowemu wielokrotnemu wysyłaniu

![Opis](logs/logs_window_de.png)
:::

:::accordion[Sprawdzanie aktualizacji i przywracanie wersji]

**Automatyczne aktualizacje:**
- Launcher sprawdza przy starcie, czy dostępna jest nowa wersja (konfigurowalne w ustawieniach).
- Jeśli aktualizacja jest dostępna, wyświetlany jest dialog z opcją pobrania.
- Podczas pobierania postęp jest wyświetlany jako pasek procentowy.
- Po pobraniu aktualizacja jest instalowana przy następnym restarcie.

**Ręczne sprawdzanie:**
- W **Ustawienia → Zachowanie** znajduje się przycisk **„Sprawdź teraz"**.

**Przywracanie wersji:**
- Starsze wersje launchera (od 3.0.5) można zainstalować bezpośrednio z ustawień.
- Lista rozwijana pokazuje wszystkie dostępne wydania GitHub z datą i oznaczeniem bieżącej wersji.
- Po wybraniu wersji jest ona pobierana i instalowana przy restarcie.

![Opis](settings/settings_update_de.png)
:::

:::accordion[Wyświetlanie RAM]

W **Ustawienia → Wyświetlanie → „Pokaż użycie RAM"** można włączyć wskaźnik pamięci na pasku kart.

**Funkcje:**
- Pokazuje całkowite użycie pamięci w MB.
- Kliknięcie otwiera szczegółowy podział:
  - Użycie pamięci na profil
  - Użycie pamięci przez wtyczki (szacunkowe, ponieważ współdzielone)
  - Narzut systemowy (launcher + OCR)

![Opis](ram/ram_display_de.png)
:::
