## Grundfunktionen

:::accordion[Profil erstellen]

**Schritt 1 — Neues Profil anlegen:**
- Klicke auf **"Neues Profil"** in der Kopfzeile.

![Beschreibung](create_profil/create_profil_1_de.png)

**Schritt 2 — Profilname eingeben:**
- Gib einen Namen für das Profil ein und klicke auf **"Hinzufügen"**.
- Mit **"Schließen"** wird der Dialog ohne Anlegen geschlossen.

![Beschreibung](create_profil/create_profil_2_de.png)

**Schritt 3 — Profilkarte verstehen:**

Jedes Profil wird als Karte in der Profilliste dargestellt:

![Beschreibung](create_profil/create_profil_3_de.png)

| Nr. | Element | Beschreibung |
|-----|---------|-------------|
| ❶ | Drag-Handle | Profil per Drag & Drop in der Liste sortieren |
| ❷ | Overlay-Ziel | Legt fest, welches Profil die OCR-Overlays und das Sidepanel erhält |
| ❸ | Supporter-Ziel | Legt fest, welches Profil als Supporter-View für den CD-Timer dient |
| ❹ | Startmodus | Zeigt an, ob das Profil im Tab- oder Fenstermodus geöffnet wird |
| ❺ | Zahnrad | Profileinstellungen öffnen |
| ❻ | Spielen | Spielsitzung mit diesem Profil starten |

**Schritt 4 — Profileinstellungen:**

Klicke auf das Zahnradsymbol ❺, um die Einstellungen zu öffnen:

![Beschreibung](create_profil/create_profil_4_de.png)

| Nr. | Element | Beschreibung |
|-----|---------|-------------|
| ❶ | Profilname | Name des Profils ändern |
| ❷ | Beruf + Charaktername | Beruf per Dropdown wählen und Charakternamen eintragen. Pro Charakter wird ein eigener Beruf zugewiesen. |
| ❸ | Charname hinzufügen | Weiteren Charakternamen zum Profil hinzufügen (mit „Hinzufügen"-Button) |
| ❹ | In Tabs verwenden | Aktiviert: Profil kann in Layouts mit mehreren Tabs genutzt werden. Deaktiviert: Profil öffnet nur ein eigenes Fenster. |
| ❺ | Speichern | Änderungen übernehmen |
| ❻ | Profil kopieren | Erstellt eine Kopie des Profils mit allen Einstellungen |
| ❼ | Löschen | Profil dauerhaft entfernen |
| ❽ | Schließen | Dialog schließen |

Möchtest du ein Profil sowohl in Tabs als auch im Fenstermodus nutzen, kopiere es mit ❻ und verwende je eine Kopie pro Modus.

**Schritt 5 — Profilliste mit Charakteren:**

Die fertig eingerichteten Profile werden in der Liste mit ihren Charakternamen und Job-Icons angezeigt:

![Beschreibung](create_profil/create_profil_5_de.png)

- Jeder Charakter wird als Badge mit Job-Icon unter dem Profilnamen dargestellt.
- Der Beruf-Filter und die Charname-Suche in der Kopfzeile durchsuchen alle Charaktere aller Profile.
- Plugins wie der Killfeed nutzen die hinterlegten Charakternamen per Combobox.

Es können beliebig viele Profile erstellt werden. Jedes Profil hat seine eigene gespeicherte Flyff-Sitzung.
Einstellungen im Spiel werden nicht wie im Browser auf andere Sitzungen übertragen.

**Profil-Export/Import:**

![small](create_profil/create_profil_6.png)

| Nr. | Element | Beschreibung |
|-----|---------|-------------|
| ❶ | Exportieren | Profil als `.flyffprofile`-Datei speichern |
| ❷ | Importieren | `.flyffprofile`-Datei laden und als neues Profil anlegen |

Die exportierte Datei enthält:

- Profil-Metadaten (Name, Beruf, Einstellungen)
- Electron-Session-Cookies (Login-Daten)
- localStorage-Daten (Spieleinstellungen)

Das ermöglicht Backups und Transfer zwischen Rechnern.
:::

:::accordion[Layout erstellen]

**Schritt 1 — Layout starten:**

Klicke auf **„Spielen"** bei einem Profil, das für Tabs aktiviert ist.

![Beschreibung](create_layout/create_layout_1_de.png)

**Schritt 2 — Layout-Grid wählen:**

Wähle das gewünschte Layout-Raster aus. Beim Hovern wird rechts eine **ASCII-Vorschau** des Rasters angezeigt.

![Beschreibung](create_layout/create_layout_2.png)

*Symmetrische Layouts:*
- **1×1** — Einzelfenster
- **1×2 / 2×1** — Zwei Fenster nebeneinander / übereinander
- **1×3 / 3×1** — Drei Fenster nebeneinander / übereinander
- **1×4 / 4×1** — Vier Fenster nebeneinander / übereinander
- **2×2** — Vier Fenster im Raster
- **3+2** — Drei oben, zwei unten
- **2×3** — Sechs Fenster im Raster
- **4+3** — Vier oben, drei unten
- **2×4** — Acht Fenster im Raster

*Asymmetrische Layouts:*
- **1+2 →** — Hauptfenster links, 2 Nebenfenster rechts gestapelt
- **1+3 →** — Hauptfenster links, 3 Nebenfenster rechts gestapelt
- **1+2 ↓** — Hauptfenster oben, 2 Nebenfenster unten nebeneinander
- **1+3 ↓** — Hauptfenster oben, 3 Nebenfenster unten nebeneinander

Bei asymmetrischen Layouts erscheint ein **Slider** in der Tab-Leiste, mit dem die Aufteilung zwischen Hauptfenster und Nebenfenstern angepasst werden kann (min. 20 % / max. 80 %).

![small](create_layout/create_layout_slider.png)

**Schritt 3 — Profile zuweisen:**

Weise jeder Zelle ein Profil zu. Nicht benötigte Zellen können leer gelassen werden.

![Beschreibung](create_layout/create_layout_3_de.png)

| Nr. | Element | Beschreibung |
|-----|---------|-------------|
| ❶ | Layout-Zellen | Zeigt die Zellen des gewählten Rasters. Klicke auf eine Zelle, um ein Profil aus der Liste darunter zuzuweisen. |
| ❷ | Profilliste | Alle für Tabs freigegebenen Profile. Klicke auf ein Profil, um es der ausgewählten Zelle zuzuweisen. |
| ❸ | Weiter | Übernimmt die Zuordnung und startet das Layout mit den zugewiesenen Profilen. |

**Schritt 4 — Layout speichern:**

Über den im Bild markierten Button in der Titelleiste wird der Speichern-Dialog geöffnet.

![Beschreibung](create_layout/create_layout_4.png)

Gib dem Layout einen Namen und klicke auf **„Speichern"**.

![Beschreibung](create_layout/create_layout_5_de.png)

**Schritt 5 — Layout-Karte im Launcher:**

Gespeicherte Layouts werden als Karte in der Profilliste angezeigt:

![Beschreibung](create_layout/create_layout_6_de.png)

- Die Karte zeigt den **Layout-Namen**, die **Anzahl der Profile** und eine **Miniatur des Rasters**.
- Über **„Spielen"** wird das gesamte Layout gestartet.
- Über das **Zahnrad** lassen sich Layout-Einstellungen anpassen (Name, Profil-Zuordnung, Raster).

**Benutzerdefiniertes Layout (Custom):**

Neben den vordefinierten Rastern kann über die Option **„Benutzerdefiniert"** ein freies Layout erstellt werden. Im Editor lassen sich 1–8 Zellen frei auf einer Leinwand platzieren und in der Größe anpassen.

![Beschreibung](custom_layout_editor.png)

| Nr. | Element | Beschreibung |
|-----|---------|-------------|
| ❶ | Zelle hinzufügen | Fügt eine neue Zelle hinzu (max. 8). |
| ❷ | Raster | Einrast-Genauigkeit beim Verschieben/Ändern der Größe (1 %, 5 % oder 10 %). |
| ❸ | Slider | Legt eine verstellbare Trennlinie fest: horizontal (↔), vertikal (↕) oder keine (—). Die grüne Linie kann im Editor verschoben werden und dient zur Laufzeit-Anpassung der Aufteilung. |
| ❹ | Zellen | Jede nummerierte Zelle kann per Drag verschoben und über die Griffe an Ecken und Kanten in der Größe verändert werden. |
| ❺ | Eigenschaften | X/Y-Position und Breite/Höhe der ausgewählten Zelle in Prozent. Werte können auch direkt eingegeben werden. |
| ❻ | Zelle entfernen | Entfernt die aktuell ausgewählte Zelle. |

Überlappende Zellen werden gestapelt — die oberste Zelle empfängt die Eingaben. Nach dem Bestätigen des Layouts folgt die Profil-Zuweisung wie bei den vordefinierten Rastern.

**Relevante Einstellungen** (unter Einstellungen / Layout):
- **Grid-Tabs sequentiell laden** — Tabs nacheinander statt gleichzeitig starten
- **Layouts bei Änderungen aktualisieren** — Änderungen am Layout automatisch speichern
- **Aktiven Grid-View hervorheben** — Den aktuell fokussierten Tab visuell hervorheben
- **Tab-Anzeige für Layouts** — Anzeigemodus der Layout-Tabs im Launcher
- **Layout-Verzögerung** — Verzögerung beim Tab-Wechsel

**Relevante Hotkeys** (unter Einstellungen / Hotkeys):
- **Vorheriger Tab** / **Nächster Tab** — Zwischen Tabs wechseln
- **Nächstes Fenster** — Fokus durch offene Fenster-Instanzen wechseln
- **Tab-Leiste ein/aus** — Tab-Leiste im Session-Fenster anzeigen/verbergen

**Multi-Window:**

Neben Layouts können auch mehrere unabhängige Session-Fenster parallel geöffnet werden. Beim Öffnen eines Profils, während bereits eine Session aktiv ist, wird abgefragt, ob es zum aktuellen Fenster hinzugefügt oder ein neues Fenster erstellt werden soll.
:::

:::accordion[Hotkeys]

Hotkeys sind frei belegbare Tastenkombinationen (2–3 Tasten), die auch bei aktivem Spielfenster funktionieren.

**Konfiguration:**
- Öffne **Einstellungen → Hotkeys**.
- Klicke auf den Badge neben einer Aktion und drücke die gewünschte Tastenkombination.
- Konflikte werden automatisch erkannt und angezeigt.

![Beschreibung](hotkeys/hotkeys_settings_de.png)

**Verfügbare Aktionen:**

| Aktion | Beschreibung |
|--------|-------------|
| Overlays ein/aus | Alle Overlays ein- oder ausblenden |
| Sidepanel ein/aus | Sidepanel öffnen oder schließen |
| Tab-Leiste ein/aus | Tab-Leiste im Session-Fenster anzeigen/verbergen |
| Vorheriger Tab | Zum vorherigen Tab wechseln |
| Nächster Tab | Zum nächsten Tab wechseln |
| Nächstes Fenster | Fokus durch offene Fenster-Instanzen wechseln |
| CD-Timer ablaufen | Alle CD-Timer auf 00:00 setzen (warten auf Tastendruck) |
| Screenshot | Screenshot des aktiven Fensters speichern |
| FCoins-Rechner | FCoins-Rechner öffnen |
| Einkaufsliste | Premium-Einkaufsliste öffnen |

Die konfigurierten Hotkeys können jederzeit über das **Tastatur-Symbol** in der Tab-Leiste eingesehen werden.

![Beschreibung](hotkeys/hotkeys_menu_de.png)
:::

:::accordion[Datenpfade & Persistenz]

Alle Nutzerdaten liegen plattformabhängig in folgenden Verzeichnissen:

| Plattform | Pfad |
|-----------|------|
| **Windows** | `%APPDATA%\Flyff-U-Launcher\user\` |
| **macOS** | `~/Library/Application Support/Flyff-U-Launcher/user/` |
| **Linux** | `~/.config/Flyff-U-Launcher/user/` |

**Wichtige Dateien und Ordner:**

| Feature | Zweck | Relativer Pfad |
|---------|-------|----------------|
| Profile | Launcher-Profile (Name, Job, Flags) | `user/profiles/profiles.json` |
| ROI-Kalibrierungen | ROI-Definitionen für OCR/Killfeed | `user/profiles/rois.json` |
| OCR-Timer | Abtastraten für OCR | `user/profiles/ocr-timers.json` |
| Layouts | Grid-Layouts für Tabs | `user/ui/tab-layouts.json` |
| Themes | Benutzer-Themes | `user/ui/themes.json` |
| Aktive Tabfarbe | Tabfarbe-Einstellung | `user/ui/tab-active-color.json` |
| Client-Einstellungen | Alle Launcher-Einstellungen | `user/config/settings.json` |
| Feature-Flags | Aktivierte Features | `user/config/features.json` |
| Premium-Einkaufsliste | FCoin-Preise pro Item | `user/shopping/item-prices.json` |
| Plugin-Einstellungen | Pro-Plugin Settings | `user/plugin-data/<pluginId>/settings.json` |
| Killfeed History | Tagesübersicht pro Profil | `user/plugin-data/killfeed/history/<id>/history.csv` |
| Killfeed Einzelkills | Detail-History pro Kill und Tag | `user/plugin-data/killfeed/history/<id>/daily/YYYY-MM-DD.csv` |
| API-Fetch Daten | Rohdaten/Icons für Plugins | `user/cache/` |
| Fehlerprotokolle | Diagnose-Logs | `user/logs/` |
| Upgrade-Rechner | Gespeicherte Preise/Einstellungen | `user/tools/upgrades/upgrade_cost_calc.json` |

:::

## Controller

Der Launcher lässt sich vollständig mit einem Gamepad steuern — sowohl das **Spiel** als auch die **Launcher-Oberfläche** selbst (Profilliste, Einstellungen, Tools). Im Spiel werden Buttons, Sticks, D-Pad und Trigger in Tastatureingaben übersetzt; diese Belegung wird **pro Profil** gespeichert, sodass jeder Charakter sein eigenes Layout haben kann.

:::accordion[Controller verbinden]

Unterstützt werden alle gängigen XInput-Gamepads:

- **Xbox-Controller** (Xbox One / Series, kabelgebunden oder per Bluetooth)
- **PlayStation-5-Controller** (DualSense)
- **Steam Deck** (interne Bedienelemente)
- weitere XInput-kompatible Pads (z. B. SCUF) funktionieren ebenfalls

Schließe den Controller an, bevor du eine Spielsitzung startest. Sobald er erkannt wird, erscheint eine kurze Bestätigung. Im Tab **Einstellungen → Controller** zeigt das Diagramm oben „Kein Controller verbunden", solange kein Pad aktiv ist.

:::

:::accordion[Launcher-Oberfläche mit dem Controller bedienen]

Nicht nur das Spiel, auch der **Launcher selbst** lässt sich mit dem Gamepad
bedienen — Profilliste, Einstellungen, Tool-Popups (Upgrade-Rechner,
FCoin-Rechner, Einkaufsliste) und der Layout-Editor.

| Eingabe | Funktion |
|---------|----------|
| Linker Stick / D-Pad | Fokus-Rahmen bewegen |
| ✕ | Aktivieren — Button klicken, Auswahl ändern, Textfeld öffnen |
| ◯ | Zurück — aktuelles Fenster / Menü schließen |
| ☰ Options | Einstellungen öffnen |
| L1 / R1 | In den Einstellungen die Sektion wechseln |
| Rechter Stick | Scrollen |

Der hell umrandete Fokus-Rahmen zeigt, welches Element gerade ausgewählt ist.
Maus und Controller lassen sich jederzeit gemischt benutzen.

**Textfelder:** Wird ein Eingabefeld mit ✕ aktiviert, öffnet sich eine
**virtuelle Tastatur**, die ebenfalls komplett per Controller bedient wird —
Tasten mit Stick/D-Pad ansteuern, mit ✕ tippen, mit ✓ schließen. Eine
angeschlossene physische Tastatur funktioniert parallel weiter.

:::

:::accordion[Belegung anpassen]

Öffne **Einstellungen → Controller**.

- Wähle oben unter **Profil** den Charakter, dessen Belegung du bearbeiten willst — die Belegung gilt nur für dieses Profil.
- Die Buttons sind in Gruppen sortiert: **Face-Buttons**, **Schultern & Trigger**, **D-Pad** und **System & Sticks**.
- Klicke bei einem Button auf **Taste setzen** und drücke anschließend die gewünschte Taste — sie wird als Ziel-Eingabe gespeichert.
- **Frei lassen** entfernt eine Belegung, **Standard** setzt einen einzelnen Button zurück, **Alle zurücksetzen** das ganze Profil.
- Im Controller-Diagramm kannst du einen Button anklicken oder mit der Maus überfahren, um direkt zu seiner Belegung zu springen.
- Mit **Speichern** wird die Belegung übernommen.

Die Sticks sind fest verdrahtet: **linker Stick = Bewegung**, **rechter Stick = Kamera**. Sie müssen nicht belegt werden.

:::

:::accordion[Standard-Belegung]

Ohne eigene Anpassung gilt diese Belegung (synchron zur Android-App):

| Button | Aktion |
|--------|--------|
| ✕ Cross / A | Leertaste (Springen / Aktion) |
| ◯ Circle / B | Escape (Menü / Abbrechen) |
| ☐ Square / X | Z (Angriff) |
| △ Triangle / Y | Tab (nächstes Ziel) |
| L1 | Skill-Slot 1 |
| R1 | Skill-Slot 2 |
| R2 | Skill-Slot 3 |
| L2 | Maus-Modus (halten) |
| L3 | I (Inventar) |
| R3 | C (Charakter-Info) |
| Options / Start | Enter (Chat) |
| D-Pad ↑ / ↓ | Zoom + / − |
| D-Pad ← / → | Voriger / Nächster Tab |
| Share / Select | nicht belegt |

**Steam Deck:** Zusätzlich sind die vier Back-Paddles mit den Skill-Slots 4–7 vorbelegt. Stelle dafür im Profil den Controller-Stil auf „Steam Deck".

:::

:::accordion[Spezial-Aktionen]

Ein Button kann statt einer normalen Taste eine **Spezial-Aktion** auslösen. Wähle sie beim Belegen über die Spezial-Aktion-Auswahl:

| Aktion | Wirkung |
|--------|---------|
| Action-Pad-Trigger | Klick auf die kalibrierte Stelle im Spiel-HUD |
| Maus-Modus (halten) | Solange gehalten: rechter Stick steuert die Maus |
| Maus-Modus (umschalten) | Tippen schaltet den Maus-Modus an / aus |
| Zoom + / Zoom − | Hinein- / Herauszoomen |
| Voriger / Nächster Tab | Wechselt zwischen offenen Profil-Tabs |
| View neu laden | Lädt das aktuelle Spielfenster neu |
| Vollbild umschalten | Schaltet das Launcher-Fenster auf Vollbild |
| Einstellungen öffnen | Öffnet das Einstellungen-Fenster |
| Ringmaster (Forward) | Leitet Eingaben an ein anderes Profil weiter (siehe unten) |

:::

:::accordion[Action-Pad]

Das Action-Pad legt einen frei platzierbaren Klickpunkt im Spielfenster fest — praktisch für HUD-Buttons, die kein Tastenkürzel haben.

**Schritt 1:** Belege einen Button (z. B. Select) mit der Spezial-Aktion **Action-Pad**.

**Schritt 2:** Fokussiere das Spielfenster und drücke **Strg + Shift + F1**, um die Kalibrierung zu starten.

**Schritt 3:** Der nächste Klick im Spiel legt den Anker für das Action-Pad fest.

:::

:::accordion[Modifier-Layer]

Mit dem **Modifier-Layer** verdoppelst du die verfügbaren Aktionen: Solange eine Schultertaste gehalten wird, nutzen die Face-Buttons (△ ◯ ✕ ☐) eine alternative Belegung statt des Standards.

- Öffne im Controller-Tab den Abschnitt **Modifier-Layer**.
- Aktiviere eine Schulter als Modifier (Schalter auf **AN**).
- Lege für jeden Face-Button die alternative Aktion fest. „(Default)" lässt weiterhin den Standard greifen.

:::

:::accordion[Maus-Modus]

Der Maus-Modus steuert einen Mauszeiger per Stick — nützlich für Menüs und Fenster ohne Tastenbedienung.

- Standardmäßig liegt der Maus-Modus auf **L2** (Aktion „Maus-Modus (halten)").
- Solange L2 gehalten wird: rechter Stick bewegt den Cursor, **✕** ist ein Linksklick.
- Alternativ legst du die Aktion **Maus-Modus (umschalten)** auf einen Button — dann wechselt ein einzelner Tastendruck zwischen Normal- und Maus-Modus.
- Beide Aktionen sind frei belegbar. Wer L2 als Skill-Slot braucht, legt den Maus-Modus z. B. auf R2 oder L1.

:::

:::accordion[Ringmaster-Forward]

Mit **Ringmaster-Forward** steuerst du einen Buffer-Charakter (z. B. Ringmaster) in einem Hintergrund-Tab, ohne das sichtbare Fenster zu wechseln — dein Main bleibt im Vordergrund spielbar.

**Schritt 1:** Wähle im Controller-Tab oben unter **Ringmaster-Ziel** das Profil, das die weitergeleiteten Eingaben erhalten soll.

**Schritt 2:** Lege die Spezial-Aktion **Ringmaster (Forward)** auf einen Button.

**Schritt 3:** Halte im Spiel die Forward-Taste → alle Eingaben (Buttons + Sticks) gehen an das Ziel-Profil. Loslassen → die Eingaben gehen wieder an den Vordergrund.

**Achtung:** Das Ziel-Profil muss geöffnet und eingeloggt sein. Ist es das nicht, laufen die weitergeleiteten Skills ins Leere.

:::

:::accordion[Skill-Icon-Picker]

Damit du auf einen Blick siehst, welcher Skill auf welchem Face-Button liegt, kannst du jedem Button (✕ ◯ △ ☐) ein Icon zuweisen.

- Klicke im Controller-Tab beim jeweiligen Button auf **Skill-Icon wählen**.
- Suche im Picker nach dem Icon oder filtere über die Tabs **Alle / Skills / Items / Buffs**.
- Ein Klick auf ein Icon übernimmt es; **Shift + Klick** auf den Button entfernt das Icon wieder.

**Hinweis:** Der Icon-Picker greift auf den Icon-Cache zu. Installiere und starte dafür die Plugins **API-Fetch** und **CD-Timer**, damit der Cache befüllt ist.

:::

## Plugins

Plugins benötigen in der Regel Daten und Icons aus der API. Diese kannst du mit API-Fetch herunterladen.

:::accordion[API-Fetch]

API-Fetch lädt Daten und Icons von der Flyff-Universe-API herunter. Andere Plugins (Killfeed, CD-Timer, Quest Guide, Premium-Einkaufsliste) benötigen diese Daten.

- Öffne **"API-Fetch"** im Einstellungsmenü oder im Sidepanel.
![Beschreibung](api_fetch/api_fetch_1.png)

- Wähle die benötigten Endpunkte aus und klicke auf **"Start"**.
![Beschreibung](api_fetch/api_fetch_2.png)

Der Fortschritt lässt sich live verfolgen. Status zeigt an, welche Endpunkte bereits abgearbeitet wurden.
Durch das API-Limit gibt es kurze Pausen, um die Raten einzuhalten.
![Beschreibung](api_fetch/api_fetch_3.png)

API-Fetch ist auch im Sidepanel verfügbar.
![Beschreibung](api_fetch/api_fetch_4.png)

**Verfügbare Endpunkte:**

| Endpunkt | Benötigt von |
|----------|-------------|
| **Monster** | Killfeed, Giant Tracker |
| **Item** | CD-Timer, Premium-Einkaufsliste, Quest Guide |
| **Skill** | CD-Timer |
| **Quest** | Quest Guide |
| **NPC** | Quest Guide |

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
- Bei Charakterwechsel kann es zu Verwechslungen kommen.

**Einrichtung:**

1. **Falls nicht geschehen: API-Daten herunterladen**
   - Öffne das Plugin [API-Fetch](action:openPlugin:api-fetch) und stelle sicher, dass der Endpunkt **"Monster"** ausgewählt ist.
   - Starte den Download. Die Monster-Daten werden benötigt, um Kills gegen die EXP-Tabelle zu validieren.
     (siehe API-Fetch Dokumentation)
2. **Plugin aktivieren**
   - Öffne die Plugin-Einstellungen im Launcher und stelle sicher, dass **Killfeed** aktiviert ist.

3. **OCR-Regionen kalibrieren** (einmalig pro Profil)
   - Starte ein Spielfenster mit aktivem "Schwert-Button" über den Launcher.
   - Öffne die ROI-Kalibrierung (Region of Interest) im Sidepanel.
   - Zeichne Bereiche um folgende Anzeigen im Spiel:
     - **EXP%** – die Erfahrungspunkte-Anzeige
     - **Level** – die Level-Anzeige
     - **Charaktername** – der Name des Charakters
   - Speichere die Regionen. Diese werden pro Profil gespeichert und müssen nur einmal eingerichtet werden.
   - Mit der linken Maustaste können die ROIs gezogen werden.
   - Nach dem Setzen eines ROIs kann mit TAB das nächste ausgewählt werden.
   - Setze für den Killfeed: LVL, NAME, EXP, ENEMY (Gegnerlevel), ENEMY HP
   - Drücke "Schließen" oder ESC um die ROI-Eingabe abzuschließen.
   - Die ROIs lassen sich nach dem Ziehen noch feinjustieren.
   - Die erkannten Werte können im Sidepanel live angesehen werden.
   - Am wichtigsten sind hier LVL und EXP; ENEMY und ENEMY HP wirken bisher nur unterstützend und sind für die Zukunft wichtiger.
   - Wird das gezeigte Level im Live OCR nicht korrekt angezeigt, kann es manuell gesetzt werden,
    der manuell gesetzte Wert hat Vorrang vor dem OCR-Wert.
   - Verschluckt sich das OCR beim EXP-Wert einmal(z.b. bei Charakterwechsel), kann dieser manuell neu gesetzt werden.
     Die EXP-Regeln könnten die automatische Korrektur verhindern.



4. **Profil im Sidepanel auswählen**
   - Öffne das Sidepanel und wähle den Reiter **Killfeed**.
   - Wähle im Dropdown das Profil aus, das getrackt werden soll.
   - Charakternamen werden per Combobox aus dem Profil gewählt — kein manuelles Eintippen nötig.


5. **Spielen**
   - Sobald du Monster besiegst, erkennt das OCR-System EXP-Veränderungen.
   - Kills und Statistiken werden automatisch im Overlay und Sidepanel angezeigt.

**Sidepanel:**
- Schalte einzelne Badges ein oder aus (z.B. Kills/Session, EXP/Stunde, Kills bis Level-Up).
- Passe die Overlay-Skalierung an (0.6x – 1.6x).
- Wähle, über wie viele Zeilen die Badges angezeigt werden sollen.
- Das Overlay kann per Drag an eine beliebige Position im Spielfenster verschoben werden. Die Position wird gespeichert.
- Setze die Session-Statistiken mit dem Reset-Button zurück.
- Die Daten jeder Session werden lokal auf deinem Rechner gespeichert.



- Jeder erkannte Kill wird im Sidepanel angezeigt und dauerhaft gespeichert.
- Die Speicherung erfolgt pro Profil in CSV-Dateien unter AppData:
  - `user/plugin-data/killfeed/history/<profile-id>/daily/YYYY-MM-DD.csv` (Einzelkills)
  - `user/plugin-data/killfeed/history/<profile-id>/history.csv` (Tagesübersicht)
- In den Monster-Tracking-Accordions steht pro Rang ein `Kills`-Button zur Verfügung.
- `Kills` öffnet eine ListView mit den einzelnen Kills des gewählten Rangs.
-

- In der ListView lassen sich einzelne Kills löschen (`Löschen` -> `Sicher`).
- Beim Löschen werden Sidepanel-Anzeige und Killfeed-History-Dateien (`daily/YYYY-MM-DD.csv` und `history.csv`) direkt aktualisiert.



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

:::accordion[Killfeed: Giant Tracker]
# ACHTUNG:
## Bis zum ersten erfassten Kill eines Giants, Violetts oder Boss werden Beispieldaten angezeigt um die Funktion darzustellen
---
Der Giant Tracker ist ein eigenständiges Fenster innerhalb des Killfeed-Plugins. Er erfasst und visualisiert Kill-Statistiken für **Giants**, **Violets** und **Bosse** — inklusive Zeiträume, Drops und Time to Kill (TTK). Die fünf Filter-Tabs (Alle, Giants, Violets, Bosse, Drops) ermöglichen gezieltes Filtern nach Rang oder nach geloggten Drops.

**Öffnen:**
- Im Killfeed-Sidepanel befindet sich der Button **„Giant Tracker"**.
- Ein Klick öffnet ein separates Fenster mit der Übersicht aller getrackten Boss-Monster.
- Liegen noch keine echten Kill-Daten vor, werden Beispieldaten angezeigt.

![Beschreibung](killfeed_giant_tracker/killfeed_giant_tracker_1_de.png)

---

**Filterung und Sortierung:**
- Über die Filterleiste lässt sich die Anzeige einschränken:
  - **Alle** / **Giants** / **Violets** / **Bosse** / **Drops** — filtert nach Monster-Rang bzw. Drops.
  - **Bosse** — zeigt nur Monster mit Rang `boss` (z.B. Clockworks, Meteonyker). Boss-Karten haben eine rote Border.
  - **Drops** — zeigt nur Monster, bei denen mindestens ein Drop geloggt wurde. Zusätzlich wird eine Loot-Pool-Vorschau (Top 5 Items nach Seltenheit) direkt in der Karte angezeigt.
  - **Sortierung** — nach Kills (auf-/absteigend), Name (A–Z / Z–A) oder Level (auf-/absteigend).
  - **Suchfeld** — filtert die Karten nach Monster-Namen.

![Beschreibung](killfeed_giant_tracker/killfeed_giant_tracker_2_de.png)

---

**Kartenansichten:**

Jedes getrackte Monster wird als Karte dargestellt. Es gibt zwei Ansichten:

*Compact Card (Standardansicht):*
- Monster-Icon, Name, Level, Element, Rang
- Kampfwerte (HP, ATK)
- Kill-Übersicht: Heute / Gesamt
- TTK-Anzeige (sofern Messdaten vorhanden): `TTK: 45.2s (Ø 52.3s)`
- Letzter Kill (Zeitangabe), Drop-Anzahl
- Button **„Details"** zum Aufklappen

![Beschreibung](killfeed_giant_tracker/killfeed_giant_tracker_3_de.png)

*Expanded Card (Detailansicht):*
- Alle Felder der Compact Card
- Kill-Statistiken nach Zeitraum: Heute, Woche, Monat, Jahr, Gesamt
- TTK-Statistiken: Ø TTK, Letzter TTK, Schnellster
- Drop-Bereich: Anzahl Drops, Ø Kills pro Drop, Kills seit letztem Drop
- Drop-History (auf-/zuklappbar): Einzelne Drops mit Item-Name, Kill-Zähler und Zeitstempel
- Button **„Drop loggen"** zum Erfassen eines Drops
- Button **„Einklappen"** zum Schließen der Detailansicht

![Beschreibung](killfeed_giant_tracker/killfeed_giant_tracker_4_de.png)

---

**Drop-Tracking:**

Über den Button **„Drop loggen"** in der Expanded Card öffnet sich ein Dialog:
- Zeigt den Loot-Pool des Monsters an (sofern Monster-Daten via API-Fetch heruntergeladen wurden).
- Items lassen sich nach Name durchsuchen und nach Seltenheit filtern (Gewöhnlich, Ungewöhnlich, Selten, Sehr Selten, Einzigartig, Ultimativ).
- Ein Klick auf ein Item erfasst den Drop mit aktuellem Zeitstempel und Kill-Zählerstand.
- Bereits geloggte Drops können in der Drop-History einzeln gelöscht werden.

![Beschreibung](killfeed_giant_tracker/killfeed_giant_tracker_5_de.png)
![Beschreibung](killfeed_giant_tracker/killfeed_giant_tracker_6_de.png)

---

**Time to Kill (TTK):**

Die TTK misst automatisch die Kampfdauer gegen ein Bossmonster — vom ersten Treffer bis zum Kill.

*Funktionsweise:*
- **Start:** Die gegnerische HP-Leiste wird mit `aktuell < max` erkannt (Kampf begonnen).
- **Stop:** Der Kill wird über die EXP-Erkennung bestätigt. Die akkumulierte Kampfzeit wird gespeichert.
- **Pause:** Die HP-Leiste verschwindet (z.B. durch Abwählen des Ziels zum Buffen oder Heilen). Eine Karenzzeit von 10 Sekunden beginnt.
- **Fortsetzen:** Wird das gleiche Bossmonster innerhalb der 10-Sekunden-Karenz erneut angewählt, läuft der Timer weiter. Die Pausenzeit fließt nicht in die TTK ein.
- **Abbruch:** Läuft die Karenzzeit ab, ohne dass der Boss erneut angewählt wird, wird die TTK-Messung verworfen.

*Identifikation des Ziels:*
- Beim Kampfstart werden der Monster-Name und die maximalen HP gespeichert.
- Bei erneutem Anwählen wird geprüft, ob Name und Max-HP übereinstimmen — erst dann wird der Timer fortgesetzt.
- Wird ein anderes Bossmonster angewählt, wird die laufende Messung abgebrochen und eine neue gestartet.
- Wird ein normales Monster angewählt, pausiert der Boss-Timer; normale Kills werden weiterhin gezählt.

*Anzeige und Statistiken:*
- Compact Card: `TTK: [letzter Kill] (Ø [Durchschnitt])`
- Expanded Card: Ø TTK, Letzter TTK, Schnellster
- Die TTK-Werte werden pro Kill in der CSV-History gespeichert (Spalte `TTK_ms`) und pro Monster aggregiert.

*Einschränkung:*
- Die TTK-Messung ist nur für Giants, Violets und Bosse aktiv. Normale Monster werden nicht gemessen.
- Die Genauigkeit hängt von der OCR-Abtastrate ab (typisch: alle 500–1000 ms).

---

**Datenquellen:**
- Kill-Daten stammen aus der Killfeed-CSV-History (`daily/YYYY-MM-DD.csv`).
- Drop-Logs werden separat pro Profil gespeichert.
- Monster-Details (Icon, HP, ATK, Loot-Pool) stammen aus den via API-Fetch heruntergeladenen Monster-Daten.

:::


:::accordion[Quest Guide]
- Zeigt verfügbare Quests gefiltert nach Level, Region und Typ — mit Chain-Visualisierung und Fortschritts-Tracking pro Profil.
- Benötigte API-Fetches: **Quest**, **NPC**, **Monster**, **Item**

**Einrichtung:**
1. Stelle sicher, dass das Plugin **Quest Guide** aktiviert ist.
2. Lade die benötigten API-Daten über API-Fetch herunter (Quest, NPC, Monster, Item).
3. Wähle im Sidepanel den Reiter **Quest Guide**.

**Filter & Suche:**
- **Suchfeld** — filtert nach Quest-Name, NPC oder Item
- **Level-Modus:**
  - *OCR ±* — zeigt Quests passend zum aktuell per OCR erkannten Level (mit einstellbarer Toleranz, Standard: ±5)
  - *Manuell* — Level und Toleranz manuell eingeben
  - *Min–Max* — festes Level-Fenster festlegen (Standard: 1–30)
- **Region** — schränkt die Anzeige auf eine bestimmte Spielregion ein
- **Typ-Filter** — Alle / Chain / Daily / Repeat / Category
- **Unterkategorie** — Bei Wiederholungsquests: Haustiere, Sammlung, Monsterjagd, Lieferung, Sonstige

**Fortschritts-Tracking:**
- Quests als erledigt markieren — Fortschritt wird pro Profil gespeichert
- Checkbox „Erledigte anzeigen" ein-/ausblenden
- Checkbox „Nicht verfügbare anzeigen" ein-/ausblenden
- Reset-Button setzt den Fortschritt zurück

**Statistik-Leiste:**
Zeigt die Anzahl Gesamt-, Verfügbarer und Erledigter Quests auf einen Blick.

**Quest Map:**
- Öffnet eine interaktive Karte mit Quest-Standorten über den Karten-Button im Sidepanel.

![Beschreibung](quest_guide/quest_guide_sidepanel_de.png)
![Beschreibung](quest_guide/quest_guide_map_de.png)
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
- Voraussetzungen: API-Fetch-Endpunkt **„Item"** inkl. Icons laden; ohne diese Daten bleibt die Suche leer.
![Beschreibung](tools/premium_shopping_list/premium_shopping_list_1.png)
- Nutzung:
  1. Tool im Menü (Stern) öffnen und Item-Namen ins Suchfeld tippen.
  2. Trefferliste (max. 20) zeigt Icon, Namen und Kategorie; mit **„+ Add"** hinzufügen oder Menge erhöhen.
  ![Beschreibung](tools/premium_shopping_list/premium_shopping_list_2.png)
  3. In der Liste Preis (FCoins) und Menge pro Item setzen; der Preis wird beim Verlassen des Felds gespeichert und bei künftigen Suchen vorausgefüllt.
  4. Checkbox markiert erledigte/gekaufte Items, „X" entfernt einen Eintrag.
  5. Der Balken unten zeigt die Summe aller Einträge (`Preis × Menge`) in FCoins.
- Speicherung: Preise werden dauerhaft im Launcher-Datenordner abgelegt; die Liste selbst ist pro Sitzung neu.

:::

:::accordion[Upgrade-Rechner]

Alle Upgrade-Typen in einem Fenster mit Sidebar-Navigation. Berechnet erwartete Kosten, Materialmengen und Versuchsanzahl.

![Beschreibung](tools/upgrade_cost_calc/upgrade_cost_calc_1.png)

**Sidebar-Sektionen:**

| Sektion | Würfel | Schutz |
|---------|--------|--------|
| **Waffe / Rüstung / Schild** | Powerdice 4/6 oder 12 | S-Protect / Low S-Protect |
| **Schmuck** | Dice 8 | A-Protect |
| **Rüstungs-Piercing** | Dice 8 | G-Protect |
| **Waffen-/Schild-Piercing** | Dice 8 | G-Protect |
| **Ultimate Waffe** | – | Ultimate Orb + XProtect |
| **Ultimate Schmuck** | – | Ultimate Orb + XProtect |

**Einstellungen (Waffe / Rüstung):**

- **Würfel-Typ:** Powerdice 4/6 (Standard) oder Powerdice 12 (höhere Erfolgschance)
- **Von-Level / Nach-Level:** Upgrade-Bereich festlegen (z.B. +3 → +7)
- **Modus:**
  - **Vergleichen** – Zeigt Kosten für beide Schutz-Systeme nebeneinander
  - **SProtect** – Berechnet mit regulären S-Protect-Scrolls
  - **Low SProtect** – Berechnet mit günstigeren Low-SProtect-Scrolls

**Materialpreise:**

Unter „Materialien" lassen sich die aktuellen Marktpreise eintragen. Mit der Checkbox „Vorhanden" werden Materialien von der Kostenberechnung ausgenommen.

![Beschreibung](tools/upgrade_cost_calc/upgrade_cost_calc_2.png)

**Ergebnis:**

Nach Klick auf „Berechnen" erscheint eine detaillierte Tabelle pro Upgrade-Stufe:

| Spalte | Bedeutung |
|--------|-----------|
| Level | Ziel-Upgrade-Stufe |
| Chance | Erfolgschance in Prozent |
| Versuche | Erwartete Anzahl Versuche |
| Mineral | Benötigte Mineral |
| Eron | Benötigte Eron |
| Penya | Penya-Kosten |
| Protects | Benötigte Schutz-Scrolls |
| Gesamtkosten | Summe aller Kosten in Penya |

![Beschreibung](tools/upgrade_cost_calc/upgrade_cost_calc_3.png)

Im Vergleichsmodus werden beide Schutz-Systeme nebeneinander dargestellt — die günstigere Option wird grün hervorgehoben.

**Speicherung:** Preise und Einstellungen werden automatisch gespeichert.

:::

## Weiteres

:::accordion[Ankündigungen]

Im rechten Panel des Launchers werden Nachrichten vom Entwickler angezeigt — ohne dass ein App-Update nötig ist. Beispiele: bekannte Fehler, aktuelle Entwicklungen oder geplante Features. Die Anzeige ist auf Deutsch und Englisch verfügbar und kann in den Einstellungen deaktiviert werden.

![Beschreibung](announcements/announcements_de.png)
:::

:::accordion[Nachrichten & Fehlerprotokoll (Logs)]

Über das **Log-Icon** in der Tab-Leiste öffnet sich ein separates Fenster mit dem Fehlerprotokoll.

**Funktionen:**
- Zeigt alle Warn- und Fehlermeldungen mit Zeitstempel an: `[HH:MM:SS] [LEVEL] [MODUL] Nachricht`
- **Löschen** — Alle Logeinträge entfernen
- **Speichern** — Logs als `.txt`-Datei exportieren (unter `user/logs/`)
- **Nachricht senden** — Logs direkt an den Entwickler (Discord) senden
  - Optional: Beschreibung und Ingame-/Discordname hinzufügen
  - 60-Sekunden-Cooldown zum Schutz vor versehentlichem Mehrfachsenden

![Beschreibung](logs/logs_window_de.png)
:::

:::accordion[Update-Prüfung & Versions-Rollback]

**Automatische Updates:**
- Der Launcher prüft beim Start, ob eine neue Version verfügbar ist (konfigurierbar unter Einstellungen).
- Ist ein Update verfügbar, wird ein Dialog mit der Möglichkeit zum Download angezeigt.
- Während des Downloads wird der Fortschritt als Prozentbalken angezeigt.
- Nach dem Download wird das Update beim nächsten Neustart installiert.

**Manuelle Prüfung:**
- Unter **Einstellungen → Verhalten** befindet sich ein **„Jetzt prüfen"**-Button.

**Versions-Rollback:**
- Ältere Launcher-Versionen (ab 3.0.5) können direkt aus den Einstellungen installiert werden.
- Ein Dropdown zeigt alle verfügbaren GitHub-Releases mit Datum und Markierung der aktuellen Version.
- Nach Auswahl einer Version wird diese heruntergeladen und beim Neustart installiert.

![Beschreibung](settings/settings_update_de.png)
:::

:::accordion[RAM-Anzeige]

Unter **Einstellungen → Anzeige → „RAM-Nutzung anzeigen"** kann eine Speicheranzeige in der Tab-Leiste aktiviert werden.

**Funktionen:**
- Zeigt den Gesamtspeicherverbrauch in MB an.
- Per Klick öffnet sich eine detaillierte Aufschlüsselung:
  - Speicherverbrauch pro Profil
  - Speicherverbrauch der Plugins (geschätzt, da geteilt)
  - System-Overhead (Launcher + OCR)

![Beschreibung](ram/ram_display_de.png)
:::

