## Grundfunktionen

:::accordion[Profil erstellen]

- Klicke auf **"Neues Profil"** in der Kopfzeile.

![Beschreibung](create_profil/create_profil_1_de.png)

- Gib einen Namen für das Profil ein und klicke auf **"Hinzufügen"**.

![Beschreibung](create_profil/create_profil_2_de.png)

- Klicke auf das Zahnradsymbol, um die Profileinstellungen zu öffnen.

![Beschreibung](create_profil/create_profil_3_de.png)

In diesem Menü kannst du:

- den Profilnamen ändern,
- einen Beruf auswählen (bestimmt das Emblem des Profils und kann als Suchfilter dienen),
- festlegen, ob das Profil mehrfach gleichzeitig geöffnet werden darf.

Ist die Option **"In Tabs verwenden"** aktiviert, kann das Profil mehrfach gleichzeitig genutzt werden.  
Ist sie deaktiviert, wird das Profil nur in einem einzelnen Fenster geöffnet.

Möchtest du beide Varianten nutzen, dupliziere das Profil und verwende je eine Kopie mit aktivierter bzw. deaktivierter Option.  
Beachte: Es kann nur eine Variante pro Profil gleichzeitig genutzt werden.

![Beschreibung](create_profil/create_profil_4_de.png)

Es können beliebig viele Profile erstellt werden. Jedes Profil hat seine eigene gespeicherte Flyff-Sitzung.  
Einstellungen im Spiel werden nicht wie im Browser auf andere Sitzungen übertragen.
:::

:::accordion[Layout erstellen]

- Klicke auf **"Spielen"** im Reiter eines erstellten Profils. Stelle sicher, dass dieses Profil für Tabs verwendet werden darf.  
![Beschreibung](create_layout/create_layout_1_de.png)

- Wähle das gewünschte Layout-Grid aus.  
![Beschreibung](create_layout/create_layout_3.png)

- Wähle für jede Zelle ein Profil aus und klicke auf **"Weiter"**.  
![Beschreibung](create_layout/create_layout_4_de.png)

- Mit Klick auf **"+"** kannst du weitere Layout-Tabs erstellen.  
![Beschreibung](create_layout/create_layout_5.png)

- Speichere das Layout, damit du es vom Launcher aus starten kannst.  
![Beschreibung](create_layout/create_layout_6.png)  
![Beschreibung](create_layout/create_layout_7.png)

- Tabs können mit einem Rechtsklick umbenannt werden.
- Tabs können sequentiell oder gleichzeitig geladen werden  
  -> Einstellungen / Client Settings / Grid-Tabs sequentiell laden
:::

:::accordion[Datenpfade & Persistenz (Windows)]

Alle Nutzerdaten liegen standardmäßig unter `%APPDATA%/Flyff-U-Launcher/` (Electron `userData`). Wichtige Dateien/Ordner:

| Feature/Datei                | Zweck                                           | Pfad relativ zu `%APPDATA%/Flyff-U-Launcher` |
|------------------------------|-------------------------------------------------|----------------------------------------------|
| API-Fetch Daten & Icons      | Rohdaten/Icons für Plugins (Item, Monster, …)   | `api_fetch/<endpoint>/...`                   |
| Premium Shopping List Preise | FCoin-Preise pro Item                           | `item-prices.json`                           |
| Profile                      | Launcher-Profile (Name, Job, Flags)             | `profiles.json`                              |
| Layouts                      | Grid-Layouts für Tabs                           | `tabLayouts.json`                            |
| ROI-Kalibrierungen           | ROI-Definitionen für OCR/Killfeed               | `rois.json`                                  |
| OCR-Timer                    | Abtastraten für OCR (Killfeed/CD-Timer)         | `ocr-timers.json`                            |
| Plugin-Einstellungen         | Pro-Plugin Settings (z.B. killfeed, cd-timer)   | `plugin-data/<pluginId>/settings.json`       |
| Themes & Tab-Farben          | Benutzer-Themes / aktive Tabfarbe               | `themes.json`, `tabActiveColor.json`         |

:::

## Plugins

Plugins benötigen in der Regel Daten und Icons aus der API. Diese kannst du mit API-Fetch herunterladen.

:::accordion[API-Fetch]

- Öffne **"API-Fetch"**.  
![Beschreibung](api_fetch/api_fetch_1.png)  
![Beschreibung](api_fetch/api_fetch_2.png)

- Plugins erwarten die API-Daten in einem bestimmten Ordner. Stelle sicher, dass dieser als Output angegeben ist.  
![Beschreibung](api_fetch/api_fetch_3.png)

- Wähle die benötigten Endpunkte aus und klicke auf **"Start"**.  
![Beschreibung](api_fetch/api_fetch_4.png)

:::

:::accordion[CD-Timer]
- Verfolgt Cooldowns deiner Skills/Items. Nach Ablauf eines Timers fordert ein Icon mit roter Umrandung zum Drücken der entsprechenden Taste auf.
- Benötigte API-Fetches zum Anzeigen der Icons: "Item" + "Skill".

- Stelle sicher, dass CD-Timer aktiviert ist.  
![Beschreibung](cd_timer/cd_timer_1_de.png)

- Im Sidepanel ist dann der Reiter CD-Timer verfügbar:
![Beschreibung](cd_timer/cd_timer_2_de.png)
- "0/0 aktiv" zeigt an wie viele Timer konfiguriert sind und wie viele davon aktiv sind.
- Mit der Checkbox "Alle aktiv" werden alle Timer aktiviert.
- Der Button "Alle abgelaufen" setzt alle Timer auf 0:00:00, 
  es wird also auf die Eingabe der konfigurierten Taste gewartet.

- Die Anzeige der Timer-Icons lässt sich konfigurieren: X- und Y-Position, Icongröße sowie Spaltenanzahl.

- Mit Klick auf "+" lässt sich ein neuer Timer festlegen.

- ![Beschreibung](cd_timer/cd_timer_3_de.png)
- Die Checkbox aktiviert diesen Timer.
- Mit Klick auf den "Icon"-Button öffnet sich ein Dialog zur Auswahl des Icons.
- Der Text aus dem Texteingabefeld wird im Icon angezeigt.
  Tipp: schreibe rein welche Taste erwartet wird. z.b. "F1"
- Nach dem Einstellen der Zeit und des Hotkeys kann noch das Ziel ausgewählt werden.
  Main(Schwertsymbol im Launcher) oder Support-View(Stabsymbol im Launcher)
 Diese Einstellung entscheidet in welchem Fenster auf den Tastendruck gewartet wird.
  Das Icon wird immer in dem Fenster des Mains angezeigt.
 Du kannst also Timer für RM-Buffs einstellen und im Main anzeigen, dass sie erneuert werden müssen.


- ![Beschreibung](cd_timer/cd_timer_4_de.png)

- Timer, die auf Supporterview abzielen, haben zur Unterscheidung einen orangenen Schimmer.


- ![Beschreibung](cd_timer/cd_timer_5_de.png)
:::

:::accordion[Killfeed]
- Verfolgt Kills und Erfahrungspunkte (EXP) in Echtzeit mithilfe des OCR-Systems.
- Benötigte API-Fetches zum Anzeigen der Monster-Daten: "Monster"

**Funktionen:**
- Kill-Erkennung über OCR (EXP-Veränderungen werden automatisch erkannt)
- Session- und Gesamtstatistiken (Kills, EXP, Kills/Stunde, EXP/Stunde, etc.)
- Overlay-Badges, die direkt im Spielfenster angezeigt werden

**Hinweis:**
- Aktuell unterstützt der Killfeed nur das 1v1-Leveln.
- In der Zukunft soll es auf AOE ausgeweitet werden, sowie das Tracken der Kills pro Monstergruppe und Bossmonster ermöglichen.

**Einrichtung:**

1. **Falls nicht geschehen: API-Daten herunterladen**
   - Öffne das Plugin [API-Fetch](action:openPlugin:api-fetch) und stelle sicher, dass der Endpunkt **"Monster"** ausgewählt ist.
   - Starte den Download. Die Monster-Daten werden benötigt, um Kills gegen die EXP-Tabelle zu validieren.
     (siehe API-Fetch Dokumentation)
2. **Plugin aktivieren**
   - Öffne die Plugin-Einstellungen im Launcher und stelle sicher, dass **Killfeed** aktiviert ist.
   ![Beschreibung](killfeed/killfeed_1_de.png)

3. **OCR-Regionen kalibrieren** (einmalig pro Profil)
   - Starte ein Spielfenster mit aktivem "Schwert-Button" über den Launcher.
    ![Beschreibung](killfeed/killfeed_2_de.png)
   - Öffne die ROI-Kalibrierung (Region of Interest) im Sidepanel.
   - Zeichne Bereiche um folgende Anzeigen im Spiel:
     - **EXP%** – die Erfahrungspunkte-Anzeige
     - **Level** – die Level-Anzeige
     - **Charaktername** – der Name des Charakters
   - Speichere die Regionen. Diese werden pro Profil gespeichert und müssen nur einmal eingerichtet werden.
    ![Beschreibung](killfeed/killfeed_3_de.png)
   - Mit der linken Maustaste können die ROIs gezogen werden.
   - Nach dem Setzen eines ROIs kann mit TAB das nächste ausgewählt werden.
    ![Beschreibung](killfeed/killfeed_4_de.png)
   - Setze für den Killfeed: LVL, NAME, EXP, ENEMY (Gegnerlevel), ENEMY HP
   - Drücke "Schließen" oder ESC um die ROI-Eingabe abzuschließen.
    ![Beschreibung](killfeed/killfeed_5_de.png)
   - Die ROIs lassen sich nach dem Ziehen noch feinjustieren.
    ![Beschreibung](killfeed/killfeed_6_de.png)
   - Die erkannten Werte können im Sidepanel live angesehen werden.
   - Am wichtigsten sind hier LVL und EXP; ENEMY und ENEMY HP wirken bisher nur unterstützend und sind für die Zukunft wichtiger.
   - Wird das gezeigte Level im Live OCR nicht korrekt angezeigt, kann es manuell gesetzt werden,
    der manuell gesetzte Wert hat Vorrang vor dem OCR-Wert.
   - Verschluckt sich das OCR beim EXP-Wert einmal(z.b. bei Charakterwechsel), kann dieser manuell neu gesetzt werden.
     Die EXP-Regeln könnten die automatische Korrektur verhindern.
   - ![Beschreibung](killfeed/killfeed_7_de.png)



4. **Profil im Sidepanel auswählen**
   - Öffne das Sidepanel und wähle den Reiter **Killfeed**.
   - Wähle im Dropdown das Profil aus, das getrackt werden soll.
    ![Beschreibung](killfeed/killfeed_8_de.png)


5. **Spielen**
   - Sobald du Monster besiegst, erkennt das OCR-System EXP-Veränderungen.
   - Kills und Statistiken werden automatisch im Overlay und Sidepanel angezeigt.

**Sidepanel:**
- Schalte einzelne Badges ein oder aus (z.B. Kills/Session, EXP/Stunde, Kills bis Level-Up).
![Beschreibung](killfeed/killfeed_9_de.png)
- Passe die Overlay-Skalierung an (0.6x – 1.6x).
- Wähle, über wie viele Zeilen die Badges angezeigt werden sollen.
![Beschreibung](killfeed/killfeed_10_de.png)
- Setze die Session-Statistiken mit dem Reset-Button zurück.
- Die Daten jeder Session werden lokal auf deinem Rechner gespeichert.

![Beschreibung](killfeed/killfeed_11_de.png)


**Kill-Erkennung – Regeln:**
Ein Kill wird gezählt, wenn alle folgenden Bedingungen erfüllt sind:
- Das Level hat sich nicht verändert (kein Level-Up / Level-Down).
- Die EXP sind um mehr als 0.001% gestiegen (Epsilon-Schwelle).
- Der EXP-Sprung liegt bei maximal 40% (Suspect-Schwelle). Sprünge darüber werden als verdächtig markiert und verworfen.
- Innerhalb der letzten 1500 ms wurde eine gegnerische HP-Leiste erkannt (OCR). Alternativ: Ohne HP-Leiste wird ein Kill akzeptiert, wenn der Abstand zum letzten Kill mindestens 2250 ms beträgt.
- Falls Monster-Daten aus API-Fetch vorliegen: Der EXP-Gewinn muss zwischen 10% und dem 10-fachen des erwarteten Werts aus der Monster-EXP-Tabelle liegen. Werte außerhalb werden als OCR-Fehler verworfen.

**Abgelehnte EXP-Änderungen:**
- Level-Up oder Level-Down: Kein Kill gezählt.
- EXP gesunken: Wird ignoriert (OCR-Rauschen).
- EXP-Sprung über 40%: Als verdächtig markiert und nicht gezählt.
- Kein HP-Balken und weniger als 2250 ms seit letztem Kill: Kein Kill gezählt.

**Hinweise:**
- Das OCR-System muss aktiv sein, damit Kills erkannt werden.
- Statistiken wie Kills/Stunde werden über ein rollendes Zeitfenster von 5 Minuten berechnet.
:::

## Tools

Tools lassen sich entweder per Hotkey oder in der Tab-Leiste über das Menü (Stern) öffnen.

:::accordion[Fcoin <-> Penya]

![Beschreibung](tools/fcoin_zu_penya/fcoin_zu_penya_1.png)
- Rechnet FCoins in Penya um und umgekehrt.
- Gib den aktuellen Penya-pro-FCoin-Kurs ein. Der Kurs wird gespeichert und beim nächsten Öffnen automatisch geladen.
- Ändere den FCoin-Betrag oder das Penya-Ergebnis – die Berechnung erfolgt automatisch in beide Richtungen.

![Beschreibung](tools/fcoin_zu_penya/fcoin_zu_penya_2.png)

:::

:::accordion[Premium Einkaufsliste]
- Planungs-Tool für Einkäufe im Premium-Shop; hilfreich, um vor dem FCoin-Kauf den Bedarf zu kalkulieren. Pop-ups müssen erlaubt sein.
- Voraussetzungen: API-Fetch-Endpunkt **„Item“** inkl. Icons laden; ohne diese Daten bleibt die Suche leer.
![Beschreibung](tools/premium_shopping_list/premium_shopping_list_1.png)
- Nutzung:
  1. Tool im Menü (Stern) öffnen und Item-Namen ins Suchfeld tippen.
  2. Trefferliste (max. 20) zeigt Icon, Namen und Kategorie; mit **„+ Add“** hinzufügen oder Menge erhöhen.
  ![Beschreibung](tools/premium_shopping_list/premium_shopping_list_2.png)
  3. In der Liste Preis (FCoins) und Menge pro Item setzen; der Preis wird beim Verlassen des Felds gespeichert und bei künftigen Suchen vorausgefüllt.
  4. Checkbox markiert erledigte/gekaufte Items, „X“ entfernt einen Eintrag.
  5. Der Balken unten zeigt die Summe aller Einträge (`Preis × Menge`) in FCoins.
- Speicherung: Preise werden dauerhaft im Launcher-Datenordner abgelegt (`%APPDATA%/Flyff-U-Launcher/item-prices.json`); die Liste selbst ist pro Sitzung neu.

:::
