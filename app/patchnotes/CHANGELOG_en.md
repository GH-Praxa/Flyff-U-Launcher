# 📦 Patchnotes

---

## 🆕 Version 2.4.1

### ✨ Improvements
- Killfeed: Improved monster detection
  - New identification weighting: Monster HP > Monster Level > Monster Element
- Killfeed: Monster tracking now counts killed mobs
- Monster reference data updated
- "Select layout" dialog design refined
- "Manage profiles (log out)" dialog design refined

### 🐛 Bug Fixes
- Overlays no longer overlap the close dialog

### 🧹 Cleanup
- Renderer architecture modularized (internal restructuring)
- Internal data folder `api_fetch/` renamed to `cache/`
- AppData directory reorganized: data now resides inside AppData\Roaming\Flyff-U-Launcher\user
- Automatic migration: existing data is seamlessly migrated on first launch — with progress display

:::accordion[New Storage Paths]
All user data now resides under `%APPDATA%\Flyff-U-Launcher\user\`:

- `user/config/settings.json` — Client settings
- `user/config/features.json` — Feature flags
- `user/profiles/profiles.json` — Launcher profiles
- `user/profiles/rois.json` — ROI calibrations
- `user/profiles/ocr-timers.json` — OCR timers
- `user/ui/themes.json` — Themes
- `user/ui/tab-layouts.json` — Tab layouts
- `user/ui/tab-active-color.json` — Active tab color
- `user/shopping/item-prices.json` — Premium shopping list prices
- `user/plugin-data/` — Plugin settings
- `user/cache/` — API fetch data & icons
- `user/logs/` — Diagnostic logs
:::

---

## 🆕 Version 2.3.0

### 🐛 Bug Fixes

- OCR values (side panel) are now correctly detected when the game runs in a separate multi-window session
- ROI calibration no longer incorrectly opens a new session but uses the existing game window
- OCR now reliably uses the bundled Tesseract — a separate installation is no longer required

### ✨ Improvements

- Documentation accordions now use native HTML5 elements (no JavaScript required)

---

## 🆕 Version 2.2.0

### ➕ New Features

**Layouts**
- Layout function revised; supported game displays:
  - 1x1 single window
  - 1x2 split screen
  - 1x3, 1x4, 2x2, 3+2, 2x3, 4+3, 2x4 multi-screens
- Progress bar added to the tab bar showing the progress while opening game screens
- Multi-window system: multiple independent session windows can be opened

**Hotkeys** — freely assignable key combinations (2-3 keys)
- Hide overlays
- Side panel on/off
- Tab bar on/off
- Save screenshot of the active window to `C:\Users\<USER>\Pictures\Flyff-U-Launcher\`
- Previous tab / Next tab
- Next window instance
- Reset CD timer to 00:00, icons wait for click
- Open FCoins calculator
- Open premium shopping list

**New Client Settings**
- Launcher width / Launcher height
- Load grid tabs sequentially
- Tab display for layouts
- Highlight active grid view
- Refresh layouts when changes occur
- Status message duration
- FCoins exchange rate
- Tab layout display mode (Compact, Grouped, Separate, Mini-grid)

**Menus & Tools**
- New menu "Tools (star icon)" added to the tab bar. The menu hides the browser view; characters stay logged in.
  - Internal tools: FCoins to Penya calculator, premium shopping list
  - External links: Flyff Universe homepage, Flyffipedia, Flyffulator, Skillulator
- New menu in the tab bar (keyboard icon) shows the configured hotkeys. The menu hides the browser view; characters stay logged in.

**Documentation**
- New tab in the settings menu "Documentation" with explanations in various languages:
  - Create profile, create layout, data paths & persistence, API fetch,
    CD timer, killfeed, FCoins <-> Penya, premium shopping list
- The text is translated into all available languages. Some images are still missing.
  Fallback: English UI → German UI.

**Miscellaneous**
- New theme "Steel Ruby" added
- Launcher shows a list of already opened profiles below the newsfeed
- Donation feature added in Settings → Support
- Close dialog in multi-tabs contains the option "Split into individual tabs"
- When opening a profile while a session is already active, you are asked whether to add it to the current window or create a new window

### 🧹 Cleanup

- The launcher window now has a minimum size and is responsive up to that point
- Default launcher window size changed from 980×640 to 1200×970
- "X" button added in the settings menu
- Settings window size adjusted
- "Manage" menu for profiles and layouts changed. They now include "Rename" and "Delete"
- "Profile" button added in the layout selection. It shows profiles contained in the layout
- Icon added for the button to enlarge the tab bar
- Highlighted the active tab in the close dialog

### 🐛 Bug Fixes

- Fixed a bug that caused the game to be hidden when switching tabs

### 🐛 Known Issues

- Occasionally, text inputs in the side panel are not received correctly
- Overlays appear in dialog windows, e.g., "Close" and "Select layout" — fixed in 2.4.1 ✅
- The side panel is not displayed in windowed mode


---

## 🆕 Version 2.1.1

### ✨ Improvements

- Overlays no longer overlap external windows.
  When the window is inactive they are hidden automatically.
- Overlay flickering when moving the window fixed.
  Overlays are now correctly hidden during movement.
- Last tab in the layout now gets enough loading time before split screen is activated.
- All actions in the exit dialog (except Cancel) are now marked as danger buttons (red).
  "Cancel" deliberately stays neutral.
- Patchnotes tab added in the settings menu.
  Display uses the currently selected language.

### ➕ New Features

- "+" button added at the end of the CD timer

### 🧹 Cleanup

- Unused tab in the icon dialog removed
- Unused "RM-EXP" badge in the top right removed

---

## 🔄 Version 2.1.0

### 🚀 New Features

- Updates can now be carried out directly via the launcher

---

## 🔄 Version 2.0.2

### 🐛 Bug Fixes

- Fixed a bug that showed the side panel as empty
- Fixed translation errors
