# Plugin-Erstellung fÃ¼r den Flyff-U-Launcher  
**Einsteigerfreundliche Komplettanleitung mit Fokus auf Kommunikation**

Diese Anleitung erklÃ¤rt vollstÃ¤ndig und zusammenhÃ¤ngend, wie Plugins fÃ¼r den Flyff-U-Launcher aufgebaut sind, wie sie geladen werden und wie sie miteinander sowie mit der BenutzeroberflÃ¤che (UI) kommunizieren.  
Sie richtet sich ausdrÃ¼cklich an Einsteiger und setzt nur grundlegende JavaScript-Kenntnisse voraus.

---

## 1. Was ist ein Plugin?

Ein Plugin ist eine eigenstÃ¤ndige Erweiterung des Launchers. Es lÃ¤uft isoliert vom Kern des Launchers und kann dessen Funktionen erweitern, ohne ihn direkt zu verÃ¤ndern.

Typische AnwendungsfÃ¤lle:
- Kill-Counter
- EXP-Tracker
- Buff-Timer
- OCR-Auswertung
- Overlays und Infofenster

Ein Plugin kann:
- Daten dauerhaft speichern
- mit Fenstern und Overlays kommunizieren
- Events von anderen Plugins empfangen
- selbst Events auslÃ¶sen
- vom Launcher bereitgestellte Services nutzen

---

## 2. Plugin-Verzeichnisstruktur

Jedes Plugin liegt in einem eigenen Ordner im Plugin-Verzeichnis des Launchers:

```
%APPDATA%/Flyff-U-Launcher/plugins/
â””â”€â”€ mein-plugin/
â”œâ”€â”€ manifest.json
â”œâ”€â”€ main.js
â””â”€â”€ (optionale weitere Dateien)
```

**Wichtig:**
- Der Ordnername **muss exakt der Plugin-ID entsprechen**
- `manifest.json` und `main.js` sind verpflichtend

---

## 3. Die manifest.json â€“ IdentitÃ¤t & Berechtigungen

Die `manifest.json` beschreibt dein Plugin vollstÃ¤ndig.  
Der Launcher liest diese Datei, **bevor irgendein Code ausgefÃ¼hrt wird**.

### Grundstruktur

```json
{
  "id": "mein-plugin",
  "name": "Mein Plugin",
  "version": "1.0.0",
  "minLauncherVersion": "1.2.0",
  "author": "Dein Name",
  "description": "Kurze Beschreibung des Plugins",
  "main": "main.js",
  "requires": [],
  "permissions": [],
  "ipcChannels": []
}
```

## 4. Plugin-ID Regeln
Die Plugin-ID ist der eindeutige technische Name des Plugins.
Sie wird intern fÃ¼r IPC, Events und Isolation verwendet.

Regeln:
- nur Kleinbuchstaben
- Zahlen erlaubt
- Bindestriche erlaubt
- 3 bis 32 Zeichen lang

GÃ¼ltige Beispiele:
- `kill-counter`
- `exp-tracker`
- `buff-timer`

UngÃ¼ltig:
- `KillCounter`
- `mein plugin`
- `plugin_01`

5. requires â€“ Launcher-Services nutzen
Services sind vom Launcher bereitgestellte Module.
Ein Plugin darf nur Services verwenden, die es explizit anfordert.

| Service       | Beschreibung                         |
| :------------ | :----------------------------------- |
| `profiles`    | Zugriff auf Profil- und Charakterdaten |
| `pythonOcr`   | Texterkennung aus Screenshots        |
| `windows`     | Fenster, Panels und Overlays         |
| `storage`     | Persistente Datenspeicherung         |
| `notifications` | Systembenachrichtigungen             |
| `http`        | HTTP-Requests                        |

Beispiel:

```json
"requires": ["storage", "windows"]
```
6. permissions â€“ Sicherheitsfreigaben
Permissions definieren, was ein Plugin darf.
Fehlende Permissions fÃ¼hren zu Fehlern oder blockierten Aktionen.

| Permission    | Erlaubt                       |
| :------------ | :---------------------------- |
| `window:create` | Fenster/Overlays erstellen    |
| `window:capture` | Screenshots anfertigen        |
| `ipc:register`  | IPC-Handler registrieren      |
| `storage:read`  | Daten lesen                   |
| `storage:write` | Daten schreiben               |
| `network:fetch` | HTTP-Zugriffe                 |
| `settings:ui`   | Eigene Einstellungsseite im Launcher |

Beispiel:

```json
"permissions": ["ipc:register", "storage:read", "storage:write"]
```
6b. settingsUI ƒ?" Plugin-UI im Launcher

Mit `settingsUI` kannst du eine HTML-Ansicht im Einstellungsfenster des Launchers einhÇÏngen. Voraussetzungen:
- Manifest-Feld setzen:  
  ```json
  "settingsUI": { "entry": "ui.html", "width": 760, "height": 520 }
  ```  
  `entry` zeigt auf deine HTML-Datei (relativ zum Plugin-Ordner). `width/height` sind optional.
- Permission `settings:ui` muss gesetzt sein.
- Plugin muss aktiviert sein, dann erscheint ein Button „UI Çüffnen“ in der Plugin-Liste.
- Theme-Variablen des Launchers (`--bg`, `--panel`, `--text`, `--tab-active-rgb`, …) werden dem iframe automatisch gesetzt, damit dein UI zum Launcher passt.

Kommunikation von UI → Plugin-Code:
- Im iframe steht `window.plugin.ipc.invoke(channel, ...args)` bereit.
- Der Channel muss in `manifest.ipcChannels` deklariert sein (wird automatisch mit der Plugin-ID geprefixt).
- Beispiel `ui.html`:
  ```html
  <script>
    async function loadData() {
      const value = await window.plugin.ipc.invoke("getKills");
      document.querySelector("#kills").textContent = value;
    }
    window.addEventListener("load", loadData);
  </script>
  <div>Aktuelle Kills: <span id="kills">-</span></div>
  ```
- Plugin-Seite (`main.js`):
  ```javascript
  module.exports = {
    async init(ctx) {
      ctx.ipc.handle("getKills", () => kills);
    },
    async start() {},
    async stop() {}
  };
  ```

7. main.js â€“ Der Lebenszyklus eines Plugins
Jedes Plugin exportiert drei asynchrone Funktionen:

```javascript
module.exports = {
  async init(ctx) {},
  async start(ctx) {},
  async stop(ctx) {}
};
```
`init(ctx)`
- wird einmal beim Laden aufgerufen
- IPC-Handler registrieren
- gespeicherte Daten laden
- Grundinitialisierung

`start(ctx)`
- Plugin wird aktiv
- Events abonnieren
- Timer oder Logik starten

`stop(ctx)`
- Plugin wird deaktiviert
- Events abmelden
- Timer stoppen
- Speicher freigeben

Grundregel:
Alles, was in start() beginnt, muss in stop() enden.

8. PluginContext (ctx)
ctx ist die zentrale Schnittstelle zwischen Plugin und Launcher.

Es bietet Zugriff auf:

Logger

IPC

Event-Bus

Services

9. Logging
```javascript
ctx.logger.info("Info");
ctx.logger.warn("Warnung");
ctx.logger.error("Fehler");
```
Logs erscheinen in den DevTools des Launchers.

10. Kommunikation Plugin â†” UI (IPC)
IPC (Inter-Process Communication) ermÃ¶glicht die Kommunikation zwischen Plugin und BenutzeroberflÃ¤che.

IPC-Handler registrieren
```javascript
ctx.ipc.handle("getData", async () => {
  return { value: 42 };
});
```
Die UI kann diesen Channel aufrufen und erhÃ¤lt die RÃ¼ckgabe.

Hinweis:
IPC-Channels werden intern automatisch mit der Plugin-ID geprefixed.

Daten an Fenster senden
```javascript
ctx.ipc.send(window, "update", data);
```
An alle Fenster senden:

```javascript
ctx.ipc.broadcast("killsUpdated", kills);
```
11. Kommunikation Plugin â†” Plugin (Event-System)
Plugins sprechen nicht direkt miteinander, sondern Ã¼ber Events.

Event auslÃ¶sen
```javascript
ctx.events.emit("kill-registered", {
  mob: "Mushpang",
  time: Date.now()
});
```
Event empfangen
```javascript
ctx.events.on("*:kill-registered", (data, from) => {
  // data = Event-Daten
  // from = sendendes Plugin
});
```
OCR-Ticks aus dem Core empfangen  
Der Core sendet nach jedem OCR-Scan ein Event `core:ocr:update` mit Profil- und Wertedaten.

Beispiel:
```javascript
ctx.events.on("core:ocr:update", (payload) => {
  // payload: { profileId, key, value, values: { lvl?, exp?, charname?, lauftext?, updatedAt } }
  ctx.logger.info(`OCR ${payload.key} für ${payload.profileId}: ${payload.value}`);
});
```

Gezielt von einem Plugin:

```javascript
ctx.events.on("combat-plugin:kill-registered", handler);
```
Plugin-Anfrage (Request)
```javascript
const result = await ctx.events.request(
  "stats-plugin",
  "getStats",
  {}
);
```
Dies funktioniert wie ein Funktionsaufruf zwischen Plugins.

12. Storage â€“ Dauerhafte Daten
```javascript
await ctx.services.storage.set("kills", 5);
const kills = await ctx.services.storage.get("kills");
```
Die Daten bleiben auch nach einem Launcher-Neustart erhalten.

13. Beispiel: Einfacher Kill-Counter
manifest.json
```json
{
  "id": "kill-counter",
  "name": "Kill Counter",
  "version": "1.0.0",
  "minLauncherVersion": "1.2.0",
  "author": "Beispiel",
  "description": "ZÃ¤hlt Kills",
  "main": "main.js",
  "requires": ["storage"],
  "permissions": ["ipc:register", "storage:read", "storage:write"],
  "ipcChannels": ["getKills", "resetKills"]
}
```
main.js
```javascript
let kills = 0;
let unsubscribe;

module.exports = {
  async init(ctx) {
    kills = await ctx.services.storage.get("kills") || 0;

    ctx.ipc.handle("getKills", () => kills);

    ctx.ipc.handle("resetKills", async () => {
      kills = 0;
      await ctx.services.storage.set("kills", 0);
      return true;
    });
  },

  async start(ctx) {
    unsubscribe = ctx.events.on("*:kill-registered", async () => {
      kills++;
      await ctx.services.storage.set("kills", kills);
      ctx.ipc.broadcast("killsUpdated", kills);
    });
  },

  async stop() {
    if (unsubscribe) unsubscribe();
  }
};
```
## 14. Wichtige Regeln
- Keine `node_modules` verwenden
- Immer `async/await` nutzen
- Cleanup konsequent in `stop()`
- BenÃ¶tigte Permissions deklarieren
- Fehler crashen nicht den Launcher
- IPC-Channels sind automatisch geprefixed

## 15. Plugin testen
- Plugin-Ordner erstellen
- Dateien anlegen
- Launcher starten
- Einstellungen â†’ Plugins
- Plugin aktivieren/deaktivieren
- DevTools Ã¶ffnen (Ctrl + Shift + I)
- Logs prÃ¼fen

## 16. Mentales Modell
- `IPC` â†’ Plugin â†” UI
- `Events` â†’ Plugin â†” Plugin
- `Services` â†’ Plugin â†” Launcher
- `Storage` â†’ Plugin â†” Festplatte

