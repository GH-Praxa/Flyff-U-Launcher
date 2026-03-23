# 📦 Patchnotes

---
## 🆕 Version 3.4.0

### ✨ New Features

**Custom Layout**
- New layout type "Custom" in the layout picker — allows free arrangement of 1–8 BrowserViews with individual position and size
- Visual editor with drag & drop: position cells on a canvas (16:9) and resize via corner/edge handles
- Adjustable grid (snap): 1%, 5% or 10% precision when moving and scaling
- Optional slider line (horizontal or vertical) for runtime split adjustment
- Overlapping cells are stacked (topmost cell receives input)
- Saved custom layouts show a dynamic ASCII preview based on the actual cell arrangement

**Adjustable Slider for 1×3 Layouts**
- The middle window in the 1×3 layout (row-3) can be resized via slider — the side windows share the remaining space equally

### ⚙️ Improvements

- Documentation expanded with the custom layout editor (all 8 languages)

### 🐛 Bug Fixes

- **Fonts**: Bundled fonts (Josefin Sans, Roboto, Open Sans, etc.) were not correctly applied to the game browsers; `@font-face` is now loaded in the author origin
- **Login**: Login via Facebook and Apple loaded endlessly

---
## 🐛 Version 3.3.0

### 🐛 Bug Fixes

- **Version Rollback**: Rolling back to an older version failed with "TypeError: this.currentVersion.format is not a function" — the update handler incorrectly overwrote internal version data with a plain string instead of a version object
- **Version Rollback**: Selecting a specific older version always found the latest release instead — now uses a direct asset URL for the target release, so any available version can be installed

---
## 🆕 Version 3.2.0

### ⚙️ Improvements

- **Quest Guide: EXP display** — EXP values are shown as percentages with 4 decimal places; OCR level is always used for EXP calculation, level mode only controls quest filtering

### 🐛 Bug Fixes

- **API-Fetch**: Endpoint selection (checkboxes) was ignored — fixed missing parameter in IPC handlers
- **API-Fetch**: World map tiles (`tile_grid`) are now downloaded correctly
- Error reports can now be sent even without existing log entries
- Error log send button now shows feedback after sending

---
## 🐛 Version 3.1.1

### 🐛 Bug Fixes

- Sidepanel UI completely broken in packaged build (white background, missing styles) — Content Security Policy blocked inline styles in temporary HTML files

---
## 🆕 Version 3.1.0

### ✨ New Features

**New Layout Types**
- Vertical layouts: 2x1, 3x1, 4x1 (views stacked vertically)
- Asymmetric layouts: main window + 2–3 side windows on the right (`main-r2`, `main-r3`) or bottom (`main-b2`, `main-b3`)
- Asymmetric layout split adjustable via slider (min 20% / max 80%)
- Layout picker with ASCII preview: hovering shows a diagram of the layout

**Profile Export/Import**
- Export and import profiles as `.flyffprofile` files
- Contains profile metadata, Electron session cookies, and localStorage data
- Enables backup and transfer between computers

**Character Names & Jobs per Character**
- Store character names and jobs per character in the profile — displayed as badges with job icon in the profile list, filterable, and selectable in plugins via combobox

**Launcher Announcements**
- New section in the right panel shows messages from the developer without an app update — e.g. known bugs, current developments, or planned features; available in German and English, can be disabled in settings
- Open profiles in the right panel are now collapsible

**Font Setting**
- New setting "Overlay & UI Font" in client settings — available fonts: Josefin Sans, Roboto, Open Sans, Lato, Montserrat, Raleway, Nunito, Ubuntu, Cinzel; font is applied to launcher overlays and DOM-based UI elements in the game

**Font Size Setting**
- New setting "Launcher Font Size": text size in the launcher window can be scaled (75–150%), does not affect the game itself

**Error Log & Message to Developer**
- Log window moved from sidepanel to the tab bar — allows viewing, saving, and deleting error logs as well as sending a message to the developer (displayed errors are included); 60-second cooldown

**Quest Guide Plugin**
- New plugin in the sidepanel: shows quests including start/end NPC, objectives, and rewards with map markers — requires quest, NPC, monster, and item data via API-Fetch

**Unified Upgrade Calculator**
- Upgrade calculator expanded with additional calculations for weapons, jewelry, armor piercing, weapon piercing, ultimate including pity system, FWC and event bonus as well as existing attempts

**UI Tooltips & Help Icons**
- All important controls in the launcher have tooltips (in all 8 languages)
- Help icons (?) for complex features: profile name, tab/window mode, character names
- Hints for launcher width/height, filters, layout selection, and grid cells

**Telemetry**
- Optional anonymous startup statistics (version, operating system, random ID)
- Enabled by default, no personal data, can be disabled at any time

**Update Check & Version Rollback**
- New setting: automatically check for updates on startup (on/off)
- Manual "Check now" button in settings
- Version rollback: older launcher versions (from 3.0.5) can be installed directly from settings
- Dropdown with all available GitHub releases including date and current version marker

### 🚀 Performance

**OCR System Optimized**
- Platform-safe screen capture method: `xwd` on Linux (no GPU contact), `capturePage()` on Win/Mac — prevents GPU stalls and game freezes
- On Linux, capture errors cause the scan to be skipped instead of freezing the game
- Pixel hash cache: OCR is skipped when the frame has not changed — reduces CPU load on static game content
- Empty OCR results are cached correctly — no unnecessary Tesseract retries on unchanged pixels
- Global Tesseract concurrency limit (max 1 simultaneous) — prevents CPU starvation of the GPU process
- In-memory caches for profiles, ROI store, and ROI visibility store instead of frequent DB reads

**Overlay Optimization**
- Efficient overlay polling: minimized opacity switches and reduced intervals
- Linux: avoidance of unnecessary show/hide cycles for transparent overlays

### ⚙️ Improvements

- **Layout cards improved**: ASCII preview of the layout type directly in the layout card; displays "X Profiles" instead of "X Tabs"; more compact presentation
- **Profile cards more compact**: Reduced card height, characters with job icons as horizontal badges below the profile name
- **Settings completely redesigned**: New sidebar layout with categorized subpages, toggle switches, and slider cards
- **RAM display**: Setting "Show RAM usage" with memory details per profile, plugin, and system process
- **Killfeed overlay positionable**: Overlay can be dragged to reposition, position is saved (x/y in layout)
- **Killfeed character selection**: Character names are selected via combobox from the profile
- **Side panel button** in the session tab bar (instead of in the overlay)
- **Killfeed and scan tabs in sidepanel simplified**: cleaner presentation and reduced complexity

### 🐛 Bug Fixes

- Suppressed GLib/GTK assertion warnings on Linux (harmless Chromium-internal messages)

### 📦 Linux Support

- Tesseract binaries and libraries bundled for Linux
- tessdata language files bundled for Linux

### 🌐 Translations

- Translations expanded

---
## 🐛 Version 3.0.5

### 🐛 Bug Fixes
- Fixed: Google account login issue

---
## 🐛 Version 3.0.4

### 🐛 Bug Fixes (macOS)
- Fixed: "damaged and can't be opened" error — the app inside the DMG is now ad-hoc signed before the DMG is assembled (previously the signing step ran after the DMG was already sealed).
- Fixed: Signing order is now correct: `package → sign → make DMG`.
- Note: macOS still shows an "unidentified developer" prompt on first launch. Right-click the app → **Open** → **Open Anyway**, or see README for the Terminal one-liner.

---
## 🆕 Version 3.0.0

### 🆕 New Tool: Upgrade Cost Calculator
- Calculates expected costs for item upgrades from +0 to +10
  including material requirements, number of attempts, and comparison between Low S-Protect and S-Protect.

### ✨ New Features
- New Logs tab in the sidepanel with live error log (Warn/Error) as well as delete and save actions.
- API-Fetch plugin 3.0.0 with new native sidepanel interface (no separate Python UI window anymore).

### 🚀 Platform & Distribution - Linux and Mac Support
- Build/Release pipeline for Windows, macOS, and Linux in GitHub Actions.
- New package formats: macOS DMG as well as Linux AppImage/DEB/RPM.
- Platform-specific Tesseract bundling (win32, darwin, linux) including adapted runtime detection/fallback.

### 🐛 Bug Fixes
- Fcoin to Penya exchange rate corrected
- Killfeed: Reduced race conditions during fast OCR updates (profile-wise serialization), broadcast updates are no longer discarded.

### 📦 Runtime & Dependencies
- Sharp library for image processing bundled in the package (no separate installation needed).

### ⚙️ Improvements
- Killfeed monster detection now prioritizes monster HP (with tolerance), then element/level.
- TTK target detection more robust through HP tolerance; monster grace window adjusted from 5s to 2s.
- Stats engine better distinguishes between OCR level noise and actual level changes.
- Further Killfeed improvements coming soon
- API-Fetch rebuilt for the platform. Still accessible in settings, additionally in the sidepanel.
- Settings -> Documentation expanded.

### 🧹 Cleanup
- Removed old API-Fetch Python artifacts (.py, .exe) in favor of the JS/Sidepanel variant.
- Restructured Tesseract resources into the new platform subfolders.

:::accordion[Storage Paths by Platform]
All user data is stored in platform-dependent directories:

| **Windows** | `%APPDATA%\Flyff-U-Launcher\user\` |
| **macOS** | `~/Library/Application Support/Flyff-U-Launcher/user/` |
| **Linux** | `~/.config/Flyff-U-Launcher/user/` |

**New files since 2.5.1:**
- `user/tools/upgrades/upgrade_cost_calc.json` — Upgrade Cost Calculator
- `user/logs/errors-*.txt` — Error logs
- `user/logs/ocr/` — OCR debug logs

:::

---

## 🆕 Version 2.5.1

### 🆕 New Feature: Giant Tracker
Standalone window in the Killfeed plugin — captures and visualizes kill statistics for **Giants**, **Violets**, and **Bosses**.

**Filter Tabs**
- 5 tabs: **All** · **Giants** · **Violets** · **Bosses** · **Drops**
- **Bosses** — filters by rank `boss` (red card border, dedicated icon styling)
- **Drops** — shows only monsters with logged drops, including loot pool preview (top 5 items by rarity) directly on the card

**Kill Statistics**
- Card view with Compact and Expanded mode
- Time ranges: Today, Week, Month, Year, Total
- Monster info: Icon, Name, Level, Element, Rank, HP, ATK

**Drop Tracking**
- Log drops from the monster's loot pool (with rarity filter)
- Drop history per monster: Item name, kill counter state, timestamp
- Statistics: Avg. kills/drop, kills since last drop

**Time to Kill (TTK)**
- Automatically measures combat duration against Giants, Violets, and Bosses
- 10s grace period when deselecting the target (buffing, healing, etc.) — pause time is not counted toward TTK
- Monster name + max HP fingerprint: target is reliably recognized again
- Display: Last TTK, Avg. TTK, Fastest
- Persisted in kill history (CSV column `TTK_ms`)

**Other**
- Sorting by kills, name, or level
- Search field to filter by monster name

### ✨ Additional Improvements
- Killfeed: Improved monster detection
- New identification weighting: Monster HP > Monster Level > Monster Element
- Killfeed: Monster tracking now counts killed mobs
- Killfeed: History introduced (per profile)
  - Daily file per date with individual kills (`Date/Time`, `Character`, `Level`, `Monster-ID`, `Rank`, `Monster`, `Element`, `EXP Gain`, `Expected EXP`, `TTK_ms`)
  - Aggregated daily summary with `Kills`, `Total EXP`, `Monster Distribution`, `First/Last Kill`
- Killfeed: Monster tracking in the sidepanel now updates immediately after kills (no tab switch required)
- Killfeed: In the monster-tracking accordions, each rank now has a Kills button with a ListView of individual kills.
  Individual kills can be deleted directly in the ListView.
  When deleting individual kills, AppData history files (daily/YYYY-MM-DD.csv, history.csv) and sidepanel state are updated.
- Killfeed: Sidepanel now follows the overlay target profile reliably (no jumping between profile IDs)
- Monster reference data updated
- "Select layout" dialog design optimized
- "Manage profiles (log out)" dialog design optimized

### 🐛 Bug Fixes
- Overlays no longer overlap the close dialog
- Accordions in the documentation are displayed correctly
- Migration from version 2.3.0 to the new AppData structure (`user/`) now runs reliably
- Killfeed: Negative OCR EXP jumps are now filtered as OCR noise and no longer distort kill detection

### 🧹 Cleanup
- Renderer architecture modularized (internal restructuring)
- Internal data folder `api_fetch/` renamed to `cache/`
- AppData directory structure reorganized: data is now sorted in the AppData\Roaming\Flyff-U-Launcher\user subfolder
- Automatic migration: existing data is migrated seamlessly on first launch — with progress indicator
- Static data (including reference data) is bundled in the build so it is reliably available in release builds
- Killfeed/overlay debug logging reduced to keep the console easier to read

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
- `user/plugin-data/killfeed/history/<profile-id>/history.csv` — Killfeed daily summary per profile
- `user/plugin-data/killfeed/history/<profile-id>/daily/YYYY-MM-DD.csv` — Killfeed detailed history per kill and day
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
