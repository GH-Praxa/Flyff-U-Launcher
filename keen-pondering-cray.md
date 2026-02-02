# Multi-View Layout Feature - Implementierungsplan

## Zusammenfassung

Erweiterung des bestehenden 2-View-Split-Systems auf 1-8 BrowserViews pro Tab mit flexiblen Grid-Layouts, visueller Konfiguration und dynamischer Zellenverwaltung.

---

## 1. Schema-Erweiterungen

### Datei: `app/src/shared/schemas.ts`

**Neue Typen hinzufügen:**

```typescript
// Layout-Typ-Enum
export const LayoutTypeSchema = z.enum([
    "single",    // 1 View (Standard, kein Split)
    "split-2",   // 1x2 - 2 Views nebeneinander (bestehend)
    "grid-4",    // 2x2 - 4 Views
    "row-4",     // 1x4 - 4 Views horizontal
    "grid-6",    // 2x3 - 6 Views
    "grid-8",    // 2x4 - 8 Views
]);

// Grid-Zelle
export const GridCellSchema = z.object({
    id: IdSchema,                              // Profile-ID
    position: z.number().int().min(0).max(7),  // Position 0-7
});

// Neues Multi-View-Layout
export const MultiViewLayoutSchema = z.object({
    type: LayoutTypeSchema,
    cells: z.array(GridCellSchema).min(1).max(8),
    ratio: RatioSchema.optional(),              // Für split-2 Kompatibilität
    activePosition: z.number().int().min(0).max(7).optional(),
});

// TabLayoutSplitSchema erweitern (Union für Abwärtskompatibilität)
export const TabLayoutSplitSchema = z.union([
    // Legacy-Format (bestehend)
    z.object({
        leftId: IdSchema,
        rightId: IdSchema,
        ratio: RatioSchema.optional(),
    }),
    // Neues Format
    MultiViewLayoutSchema,
]);
```

**Migrations-Helfer:**

```typescript
export function isLegacySplit(split: unknown): boolean {
    return !!split && typeof split === "object"
        && "leftId" in split && !("type" in split);
}

export function migrateToMultiView(legacy: { leftId: string; rightId: string; ratio?: number }): MultiViewLayout {
    return {
        type: "split-2",
        cells: [
            { id: legacy.leftId, position: 0 },
            { id: legacy.rightId, position: 1 },
        ],
        ratio: legacy.ratio,
        activePosition: 0,
    };
}
```

---

## 2. Konstanten erweitern

### Datei: `app/src/shared/constants.ts`

```typescript
export const GRID_CONFIGS = {
    "single":  { rows: 1, cols: 1, maxViews: 1 },
    "split-2": { rows: 1, cols: 2, maxViews: 2 },
    "grid-4":  { rows: 2, cols: 2, maxViews: 4 },
    "row-4":   { rows: 1, cols: 4, maxViews: 4 },
    "grid-6":  { rows: 2, cols: 3, maxViews: 6 },
    "grid-8":  { rows: 2, cols: 4, maxViews: 8 },
} as const;

export const LAYOUT = {
    // ... bestehende Werte behalten ...
    GRID_GAP: 8,           // Gleich wie SPLIT_GAP
    MIN_CELL_WIDTH: 200,   // Mindestbreite pro Zelle
    MIN_CELL_HEIGHT: 150,  // Mindesthöhe pro Zelle
};
```

---

## 3. Session Tabs Manager

### Datei: `app/src/main/sessionTabs/manager.ts`

**State-Änderungen:**

```typescript
// Ersetze:
let sessionSplit: SplitPair | null = null;

// Durch:
let sessionLayout: MultiViewLayout | null = null;
```

**Neue Bounds-Berechnung:**

```typescript
function computeGridLayoutBounds(
    bounds: ViewBounds,
    layout: MultiViewLayout,
    gap: number
): Array<{ id: string; bounds: ViewBounds; position: number }> {
    const config = GRID_CONFIGS[layout.type];
    const { rows, cols } = config;

    // Für split-2 bestehende Ratio-Logik verwenden
    if (layout.type === "split-2" && layout.ratio !== undefined) {
        return computeSplit2Bounds(bounds, layout.cells, layout.ratio, gap);
    }

    // Grid-Berechnung
    const totalGapX = gap * (cols - 1);
    const totalGapY = gap * (rows - 1);
    const cellWidth = Math.floor((bounds.width - totalGapX) / cols);
    const cellHeight = Math.floor((bounds.height - totalGapY) / rows);

    return layout.cells.map((cell) => {
        const row = Math.floor(cell.position / cols);
        const col = cell.position % cols;
        return {
            id: cell.id,
            position: cell.position,
            bounds: {
                x: bounds.x + col * (cellWidth + gap),
                y: bounds.y + row * (cellHeight + gap),
                width: cellWidth,
                height: cellHeight,
            },
        };
    });
}
```

**Hover-Aktivierung für Grids:**

```typescript
function checkHoverActivation() {
    if (!sessionLayout || !sessionVisible) return;

    const layout = computeGridLayoutBounds(sessionBounds, sessionLayout, LAYOUT.GRID_GAP);
    const cursor = screen.getCursorScreenPoint();
    // ... Cursor-Position auf lokale Koordinaten umrechnen ...

    const target = layout.find(({ bounds }) =>
        localX >= bounds.x && localX <= bounds.x + bounds.width &&
        localY >= bounds.y && localY <= bounds.y + bounds.height
    );

    if (target && target.id !== sessionActiveId) {
        sessionActiveId = target.id;
        sessionLayout = { ...sessionLayout, activePosition: target.position };
        focusActiveView();
        notifyActiveChanged();
    }
}
```

**Neue Funktionen:**

```typescript
// Neues Layout setzen
async function setMultiLayout(layout: MultiViewLayout | null): Promise<boolean>;

// Einzelne Zelle aktualisieren (dynamisch)
async function updateCell(position: number, profileId: string | null): Promise<boolean>;

// Abwärtskompatibilität: setSplit intern auf setMultiLayout mappen
async function setSplit(pair: SplitPair | null): Promise<boolean> {
    if (!pair) return setMultiLayout(null);
    return setMultiLayout({
        type: "split-2",
        cells: [
            { id: pair.primary, position: 0 },
            { id: pair.secondary, position: 1 },
        ],
        ratio: pair.ratio,
        activePosition: 0,
    });
}
```

---

## 4. IPC-Erweiterungen

### Datei: `app/src/main/ipc/handlers/sessions.ts`

```typescript
// Neuer Handler
safeHandle("sessionTabs:setMultiLayout", async (_e, layout: MultiViewLayout | null) => {
    if (layout !== null) {
        assertValid(MultiViewLayoutSchema, layout, "multi-view layout");
    }
    await opts.sessionTabs.setMultiLayout(layout);
    return true;
});

// Neuer Handler für dynamische Zellen-Updates
safeHandle("sessionTabs:updateCell", async (_e, position: number, profileId: string | null) => {
    await opts.sessionTabs.updateCell(position, profileId);
    return true;
});
```

### Datei: `app/src/preload.ts`

```typescript
sessionTabsSetMultiLayout: (layout: MultiViewLayout | null) =>
    unwrapIpc(ipcRenderer.invoke("sessionTabs:setMultiLayout", layout)),

sessionTabsUpdateCell: (position: number, profileId: string | null) =>
    unwrapIpc(ipcRenderer.invoke("sessionTabs:updateCell", position, profileId)),
```

---

## 5. UI/UX Implementierung

### Datei: `app/src/renderer.ts`

**Layout-Typ-Selector:**

- Button neben dem bestehenden Split-Button
- Dropdown-Menü mit Layout-Optionen: Single | 1x2 | 2x2 | 1x4 | 2x3 | 2x4
- Visuelles Icon für jeden Layout-Typ

**Grid-Konfigurations-Modal:**

```typescript
async function showGridConfigModal(type: LayoutType): Promise<MultiViewLayout | null> {
    const config = GRID_CONFIGS[type];
    // Modal mit Grid-Vorschau anzeigen
    // Zellen sind klickbar -> öffnet Profil-Picker
    // Bestätigen/Abbrechen Buttons
}
```

**Dynamische Zellenverwaltung:**

- Klick auf gefüllte Zelle -> Optionen: Profil wechseln, Zelle leeren
- Klick auf leere Zelle -> Profil-Picker öffnen
- Drag & Drop optional für spätere Erweiterung

**Tab-Glyphen aktualisieren:**

- Statt L/R für Split: Positionsnummern 1-8 anzeigen
- Aktive Position hervorheben

---

## 6. Layout-Store Migration

### Datei: `app/src/main/sessionTabs/layoutStore.ts`

```typescript
function normalizeSplit(v: unknown): TabLayoutSplit | null {
    if (!v || typeof v !== "object") return null;

    // Neues Format erkennen
    if ("type" in v && "cells" in v) {
        return validateMultiViewLayout(v);
    }

    // Legacy-Format migrieren
    if ("leftId" in v && "rightId" in v) {
        return migrateToMultiView(v as LegacySplit);
    }

    return null;
}
```

---

## 7. Zu ändernde Dateien

| Datei | Änderung |
|-------|----------|
| `app/src/shared/schemas.ts` | Neue Schema-Typen hinzufügen |
| `app/src/shared/constants.ts` | GRID_CONFIGS und Layout-Konstanten |
| `app/src/main/sessionTabs/manager.ts` | Grid-Bounds-Berechnung, Hover für Grids |
| `app/src/main/sessionTabs/layoutStore.ts` | Migration Legacy -> MultiView |
| `app/src/main/ipc/handlers/sessions.ts` | Neue IPC-Handler |
| `app/src/preload.ts` | API-Bridge erweitern |
| `app/src/renderer.ts` | UI: Layout-Selector, Grid-Modal, Glyphen |
| `app/src/index.css` | Styles für Modal, Grid-Preview, Zellen |
| `app/src/i18n/translations.ts` | Übersetzungen für neue UI-Elemente |

---

## 8. Positions-Mapping

```
single:      split-2:     grid-4:      row-4:
+-------+    +---+---+    +---+---+    +--+--+--+--+
|   0   |    | 0 | 1 |    | 0 | 1 |    | 0| 1| 2| 3|
+-------+    +---+---+    +---+---+    +--+--+--+--+
                          | 2 | 3 |
                          +---+---+

grid-6:        grid-8:
+---+---+---+  +---+---+---+---+
| 0 | 1 | 2 |  | 0 | 1 | 2 | 3 |
+---+---+---+  +---+---+---+---+
| 3 | 4 | 5 |  | 4 | 5 | 6 | 7 |
+---+---+---+  +---+---+---+---+
```

---

## 9. Verifizierung

### Tests

1. **Bestehender 2er-Split funktioniert weiterhin:**
   - Split aktivieren mit 2 Profilen
   - Ratio-Slider testen
   - Hover-Aktivierung prüfen
   - Layout speichern und laden

2. **Neue Grid-Layouts:**
   - Jedes Layout-Typ (2x2, 1x4, 2x3, 2x4) erstellen
   - Profile zuweisen über Modal
   - Hover-Aktivierung für alle Zellen
   - Layout speichern und neu laden

3. **Dynamische Zellen:**
   - Zelle während Nutzung hinzufügen
   - Zelle entfernen
   - Profil in Zelle wechseln

4. **Migration:**
   - Alte Layout-Dateien werden korrekt geladen
   - Bestehende split-2 Konfigurationen funktionieren

### Manueller Test-Flow

1. App starten
2. 4 Profile erstellen/öffnen
3. Layout-Selector -> "2x2" wählen
4. Im Modal alle 4 Positionen mit Profilen belegen
5. Bestätigen -> 4 BrowserViews im Grid
6. Mit Maus über verschiedene Zellen hovern -> Fokus wechselt
7. Auf eine Zelle klicken -> Profil wechseln
8. Layout speichern
9. App neu starten -> Layout wird wiederhergestellt

---

## 10. Implementierungsreihenfolge

1. **Phase 1 - Schema & Konstanten** (Fundament)
   - `schemas.ts` erweitern
   - `constants.ts` erweitern
   - TypeScript-Typen verfügbar machen

2. **Phase 2 - Backend-Logik** (Kern)
   - `manager.ts`: computeGridLayoutBounds
   - `manager.ts`: setMultiLayout, updateCell
   - `manager.ts`: Hover-Aktivierung für Grids
   - `layoutStore.ts`: Migration

3. **Phase 3 - IPC-Layer** (Kommunikation)
   - `sessions.ts`: Handler hinzufügen
   - `preload.ts`: API-Bridge erweitern

4. **Phase 4 - UI** (Benutzeroberfläche)
   - `renderer.ts`: Layout-Selector
   - `renderer.ts`: Grid-Konfigurations-Modal
   - `renderer.ts`: Dynamische Zellen-UI
   - `index.css`: Styling

5. **Phase 5 - Feinschliff**
   - Übersetzungen
   - Edge-Cases
   - Performance-Optimierung
