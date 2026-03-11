## Basic Features

:::accordion[Create Profile]

**Step 1 — Create a new profile:**
- Click **"New Profile"** in the header.

![Description](create_profil/create_profil_1_en.png)

**Step 2 — Enter profile name:**
- Enter a name for the profile and click **"Add"**.
- Click **"Close"** to dismiss the dialog without creating a profile.

![Description](create_profil/create_profil_2_en.png)

**Step 3 — Understanding the profile card:**

Each profile is displayed as a card in the profile list:

![Description](create_profil/create_profil_3_en.png)

| No. | Element | Description |
|-----|---------|-------------|
| ❶ | Drag handle | Sort profiles via drag & drop |
| ❷ | Overlay target | Determines which profile receives the OCR overlays and side panel |
| ❸ | Supporter target | Determines which profile serves as the supporter view for the CD timer |
| ❹ | Launch mode | Shows whether the profile opens in tab or window mode |
| ❺ | Gear icon | Open profile settings |
| ❻ | Play | Start a game session with this profile |

**Step 4 — Profile settings:**

Click the gear icon ❺ to open the settings:

![Description](create_profil/create_profil_4_en.png)

| No. | Element | Description |
|-----|---------|-------------|
| ❶ | Profile name | Change the profile name |
| ❷ | Job + character name | Select a job via dropdown and enter a character name. Each character gets its own job assignment. |
| ❸ | Add character | Add another character name to the profile (via "Add" button) |
| ❹ | Use in tabs | Enabled: profile can be used in layouts with multiple tabs. Disabled: profile opens in its own window only. |
| ❺ | Save | Apply changes |
| ❻ | Copy profile | Creates a copy of the profile with all settings |
| ❼ | Delete | Permanently remove the profile |
| ❽ | Close | Close the dialog |

If you want to use a profile in both tab and window mode, copy it with ❻ and use one copy per mode.

**Step 5 — Profile list with characters:**

Fully configured profiles are shown in the list with their character names and job icons:

![Description](create_profil/create_profil_5_en.png)

- Each character is displayed as a badge with job icon below the profile name.
- The job filter and character name search in the header search across all characters of all profiles.
- Plugins like the Killfeed use the stored character names via combobox.

You can create any number of profiles. Each profile stores its own Flyff session.
In-game settings are not shared across sessions like in a browser.

**Profile Export/Import:**

![small](create_profil/create_profil_6.png)

| No. | Element | Description |
|-----|---------|-------------|
| ❶ | Export | Save profile as `.flyffprofile` file |
| ❷ | Import | Load a `.flyffprofile` file and create a new profile |

The exported file contains:

- Profile metadata (name, job, settings)
- Electron session cookies (login data)
- localStorage data (game settings)

This enables backups and transfers between computers.
:::

:::accordion[Create Layout]

**Step 1 — Start a layout:**

Click **"Play"** on a profile that has tabs enabled.

![Description](create_layout/create_layout_1_en.png)

**Step 2 — Choose layout grid:**

Select the desired layout grid. Hovering shows an **ASCII preview** of the grid on the right.

![Description](create_layout/create_layout_2.png)

*Symmetric layouts:*
- **1×1** — Single window
- **1×2 / 2×1** — Two windows side by side / stacked
- **1×3 / 3×1** — Three windows side by side / stacked
- **1×4 / 4×1** — Four windows side by side / stacked
- **2×2** — Four windows in a grid
- **3+2** — Three on top, two on bottom
- **2×3** — Six windows in a grid
- **4+3** — Four on top, three on bottom
- **2×4** — Eight windows in a grid

*Asymmetric layouts:*
- **1+2 →** — Main window left, 2 side windows stacked right
- **1+3 →** — Main window left, 3 side windows stacked right
- **1+2 ↓** — Main window top, 2 side windows below
- **1+3 ↓** — Main window top, 3 side windows below

Asymmetric layouts show a **slider** in the tab bar to adjust the split between main and side windows (min. 20% / max. 80%).

![small](create_layout/create_layout_slider.png)

**Step 3 — Assign profiles:**

Assign a profile to each cell. Unneeded cells can be left empty.

![Description](create_layout/create_layout_3_en.png)

| No. | Element | Description |
|-----|---------|-------------|
| ❶ | Layout cells | Shows the cells of the chosen grid. Click a cell to assign a profile from the list below. |
| ❷ | Profile list | All profiles enabled for tabs. Click a profile to assign it to the selected cell. |
| ❸ | Next | Confirms the assignment and launches the layout with the assigned profiles. |

**Step 4 — Save layout:**

The button highlighted in the image (in the title bar) opens the save dialog.

![Description](create_layout/create_layout_4.png)

Enter a name for the layout and click **"Save"**.

![Description](create_layout/create_layout_5_en.png)

**Step 5 — Layout card in the launcher:**

Saved layouts are shown as a card in the profile list:

![Description](create_layout/create_layout_6_en.png)

- The card shows the **layout name**, the **number of profiles**, and a **grid miniature**.
- Click **"Play"** to launch the entire layout.
- The **gear icon** opens layout settings (name, profile assignment, grid).

**Relevant settings** (under Settings / Layout):
- **Load grid tabs sequentially** — Start tabs one after another instead of simultaneously
- **Update layouts on changes** — Automatically save layout changes
- **Highlight active grid view** — Visually highlight the currently focused tab
- **Tab display for layouts** — Display mode for layout tabs in the launcher
- **Layout delay** — Delay when switching tabs

**Relevant hotkeys** (under Settings / Hotkeys):
- **Previous tab** / **Next tab** — Switch between tabs
- **Next window** — Cycle focus through open window instances
- **Toggle tab bar** — Show/hide the tab bar in the session window

**Multi-Window:**

Besides layouts, multiple independent session windows can be opened in parallel. When opening a profile while a session is already active, you are asked whether to add it to the current window or create a new one.
:::

:::accordion[Hotkeys]

Hotkeys are freely assignable key combinations (2–3 keys) that work even when the game window is active.

**Configuration:**
- Open **Settings → Hotkeys**.
- Click on the badge next to an action and press the desired key combination.
- Conflicts are automatically detected and displayed.

![Description](hotkeys/hotkeys_settings_de.png)

**Available actions:**

| Action | Description |
|--------|-------------|
| Toggle overlays | Show or hide all overlays |
| Toggle sidepanel | Open or close sidepanel |
| Toggle tab bar | Show/hide tab bar in the session window |
| Previous tab | Switch to the previous tab |
| Next tab | Switch to the next tab |
| Next window | Cycle focus through open window instances |
| Expire CD timer | Set all CD timers to 00:00 (waiting for key press) |
| Screenshot | Save a screenshot of the active window |
| FCoins calculator | Open FCoins calculator |
| Shopping list | Open premium shopping list |

The configured hotkeys can be viewed at any time via the **keyboard icon** in the tab bar.

![Description](hotkeys/hotkeys_menu_de.png)
:::

:::accordion[Data Paths & Persistence]

All user data is stored in platform-dependent directories:

| Platform | Path |
|-----------|------|
| **Windows** | `%APPDATA%\Flyff-U-Launcher\user\` |
| **macOS** | `~/Library/Application Support/Flyff-U-Launcher/user/` |
| **Linux** | `~/.config/Flyff-U-Launcher/user/` |

**Important files and folders:**

| Feature | Purpose | Relative path |
|---------|---------|----------------|
| Profiles | Launcher profiles (name, job, flags) | `user/profiles/profiles.json` |
| ROI calibrations | ROI definitions for OCR/Killfeed | `user/profiles/rois.json` |
| OCR timers | Sampling rates for OCR | `user/profiles/ocr-timers.json` |
| Layouts | Grid layouts for tabs | `user/ui/tab-layouts.json` |
| Themes | User themes | `user/ui/themes.json` |
| Active tab color | Tab color setting | `user/ui/tab-active-color.json` |
| Client settings | All launcher settings | `user/config/settings.json` |
| Feature flags | Enabled features | `user/config/features.json` |
| Premium shopping list | FCoin prices per item | `user/shopping/item-prices.json` |
| Plugin settings | Per-plugin settings | `user/plugin-data/<pluginId>/settings.json` |
| Killfeed History | Daily summary per profile | `user/plugin-data/killfeed/history/<id>/history.csv` |
| Killfeed individual kills | Detailed history per kill and day | `user/plugin-data/killfeed/history/<id>/daily/YYYY-MM-DD.csv` |
| API-Fetch data | Raw data/icons for plugins | `user/cache/` |
| Error logs | Diagnostic logs | `user/logs/` |
| Upgrade calculator | Saved prices/settings | `user/tools/upgrades/upgrade_cost_calc.json` |

:::

## Plugins

Plugins usually need data and icons from the API. You can download them with API-Fetch.

:::accordion[API-Fetch]

API-Fetch downloads data and icons from the Flyff Universe API. Other plugins (Killfeed, CD-Timer, Quest Guide, Premium Shopping List) require this data.

- Open **"API-Fetch"** in the settings menu or in the sidepanel.
![Description](api_fetch/api_fetch_1.png)

- Select the required endpoints and click **"Start"**.
![Description](api_fetch/api_fetch_2.png)

Progress can be tracked live. Status shows which endpoints have already been processed.
Due to the API rate limit there are short pauses to respect the limits.
![Description](api_fetch/api_fetch_3.png)

API-Fetch is also available in the sidepanel.
![Description](api_fetch/api_fetch_4.png)

**Available endpoints:**

| Endpoint | Required by |
|----------|-------------|
| **Monster** | Killfeed, Giant Tracker |
| **Item** | CD-Timer, Premium Shopping List, Quest Guide |
| **Skill** | CD-Timer |
| **Quest** | Quest Guide |
| **NPC** | Quest Guide |

:::

:::accordion[CD-Timer]
- Tracks cooldowns of your skills/items. When a timer expires, an icon with a red border prompts you to press the configured key.
- Required API-Fetches to show icons: "Item" + "Skill".

- Make sure CD-Timer is enabled.
![Description](cd_timer/cd_timer_1_de.png)

- The CD-Timer tab is then available in the side panel:
![Description](cd_timer/cd_timer_2_de.png)
- "0/0 active" shows how many timers are configured and how many are active.
- The "All active" checkbox activates all timers.
- The "All expired" button resets all timers to 0:00:00, waiting for the configured key press.

- The display of the timer icons can be configured: X and Y position, icon size, and number of columns.

- Click "+" to create a new timer.

- ![Description](cd_timer/cd_timer_3_de.png)
- The checkbox activates this timer.
- The "Icon" button opens a dialog to choose the icon.
- The text from the input field is shown on the icon.
  Tip: write which key is expected, e.g. "F1".
- After setting time and hotkey you can choose the target:
  Main (sword icon in launcher) or Support View (staff icon in launcher).
 This decides in which window the key press is awaited.
  The icon is always shown in the main window.
 You can therefore set timers for RM buffs and display in the main that they need refresh.


- ![Description](cd_timer/cd_timer_4_de.png)

- Timers targeting the Support view have an orange glow for distinction.


- ![Description](cd_timer/cd_timer_5_de.png)
:::

:::accordion[Killfeed]
- Tracks kills and experience (EXP) in real time using the OCR system.
- Required API-Fetch to show monster data: "Monster"

**Features:**
- Kill detection via OCR (EXP changes are detected automatically)
- Session and overall stats (kills, EXP, kills/hour, EXP/hour, etc.)
- Overlay badges displayed directly in the game window

**Note:**
- Currently the killfeed only supports 1v1 leveling.
- Character switches may cause mix-ups.

**Setup:**

1. **If not done: download API data**
   - Open the plugin [API-Fetch](action:openPlugin:api-fetch) and ensure the endpoint **"Monster"** is selected.
   - Start the download. Monster data is needed to validate kills against the EXP table.
     (see API-Fetch documentation)
2. **Activate the plugin**
   - Open plugin settings in the launcher and make sure **Killfeed** is enabled.

3. **Calibrate OCR regions** (once per profile)
   - Start a game window with the "sword button" enabled via the launcher.
   - Open ROI calibration (Region of Interest) in the side panel.
   - Draw regions around the following game UI elements:
     - **EXP%** – the experience display
     - **Level** – the level display
     - **Character name** – the character name
   - Save the regions. They are stored per profile and only need to be set once.
   - Left-click to drag ROIs.
   - After placing an ROI you can press TAB to select the next.
   - Set for killfeed: LVL, NAME, EXP, ENEMY (enemy level), ENEMY HP
   - Press "Close" or ESC to finish ROI input.
   - ROIs can be fine-tuned after drawing.
   - The recognized values can be viewed live in the side panel.
   - Most important are LVL and EXP; ENEMY and ENEMY HP are currently auxiliary and more important in future.
   - If the shown level is incorrect in live OCR, you can set it manually;
    the manual value takes precedence over the OCR value.
   - If OCR "swallows" the EXP value once (e.g., on character swap), you can set it manually again.
     The EXP rules might prevent automatic correction.



4. **Select profile in side panel**
   - Open the side panel and choose the **Killfeed** tab.
   - Select the profile to track from the dropdown.
   - Character names are selected via combobox from the profile — no manual typing needed.


5. **Play**
   - Once you defeat monsters, the OCR system detects EXP changes.
   - Kills and stats appear automatically in the overlay and side panel.

**Side panel:**
- Toggle individual badges (e.g., Kills/Session, EXP/hour, Kills to level-up).
- Adjust overlay scale (0.6x – 1.6x).
- Choose how many rows the badges span.
- The overlay can be dragged to any position in the game window. The position is saved.
- Reset session stats with the reset button.
- Each session's data is stored locally on your computer.



- Each detected kill is shown in the side panel and stored persistently.
- Storage is written per profile to CSV files under AppData:
  - `user/plugin-data/killfeed/history/<profile-id>/daily/YYYY-MM-DD.csv` (individual kills)
  - `user/plugin-data/killfeed/history/<profile-id>/history.csv` (daily summary)
- Monster tracking accordions provide a `Kills` button per rank.
- `Kills` opens a list view with individual kills for the selected rank.
-

- Individual kills can be deleted in the list view (`Delete` -> `Confirm`).
- Deleting a kill directly updates the side panel view and Killfeed history files (`daily/YYYY-MM-DD.csv` and `history.csv`).



**Kill detection – rules:**
A kill is counted when all conditions are met:
- Level has not changed (no level-up / level-down).
- EXP increased by more than 0.001% (epsilon threshold).
- EXP jump is at most 40% (suspect threshold). Larger jumps are marked suspicious and discarded.
- Within the last 1500 ms an enemy HP bar was detected (OCR). Alternatively: without HP bar a kill is accepted if at least 2250 ms passed since last kill.
- If monster data from API-Fetch exists: EXP gain must be between 10% and 10× of the expected value from the monster EXP table. Outside values are treated as OCR errors and discarded.

**Rejected EXP changes:**
- Level-up or level-down: no kill counted.
- EXP decreased: ignored (OCR noise).
- EXP jump over 40%: marked suspicious, not counted.
- No HP bar and less than 2250 ms since last kill: no kill counted.

**Notes:**
- The OCR system must be active for kills to be detected.
- Stats like kills/hour are calculated over a rolling 5-minute window.
:::

:::accordion[Killfeed: Giant Tracker]
# ATTENTION:
## Until the first recorded kill of a Giant, Violet, or Boss, example data is shown to demonstrate the feature.
---
The Giant Tracker is a standalone window inside the Killfeed plugin. It tracks and visualizes kill statistics for **Giants**, **Violets**, and **Bosses** — including time ranges, drops, and Time to Kill (TTK). The five filter tabs (All, Giants, Violets, Bosses, Drops) allow targeted filtering by rank or by logged drops.

**Opening:**
- The **"Giant Tracker"** button is located in the Killfeed side panel.
- A click opens a separate window with an overview of all tracked boss monsters.
- If no real kill data is available, example data is shown.

![Description](killfeed_giant_tracker/killfeed_giant_tracker_1_de.png)

---

**Filtering and Sorting:**
- The filter bar allows narrowing the display:
  - **All** / **Giants** / **Violets** / **Bosses** / **Drops** — filters by monster rank or drops.
  - **Bosses** — shows only monsters with rank `boss` (e.g. Clockworks, Meteonyker). Boss cards have a red border.
  - **Drops** — shows only monsters with at least one logged drop. Additionally, a loot pool preview (top 5 items by rarity) is shown directly in the card.
  - **Sorting** — by kills (asc/desc), name (A–Z / Z–A) or level (asc/desc).
  - **Search field** — filters cards by monster name.

![Description](killfeed_giant_tracker/killfeed_giant_tracker_2_de.png)

---

**Card Views:**

Each tracked monster is displayed as a card. There are two views:

*Compact Card (Default view):*
- Monster icon, name, level, element, rank
- Combat stats (HP, ATK)
- Kill overview: Today / Total
- TTK display (if measurement data available): `TTK: 45.2s (Avg 52.3s)`
- Last kill (time), drop count
- **"Details"** button to expand

![Description](killfeed_giant_tracker/killfeed_giant_tracker_3_de.png)

*Expanded Card (Detail view):*
- All fields from the compact card
- Kill statistics by time range: Today, Week, Month, Year, Total
- TTK statistics: Avg TTK, Last TTK, Fastest
- Drop section: Drop count, avg kills per drop, kills since last drop
- Drop history (collapsible): Individual drops with item name, kill counter, and timestamp
- **"Log Drop"** button to record a drop
- **"Collapse"** button to close the detail view

![Description](killfeed_giant_tracker/killfeed_giant_tracker_4_de.png)

---

**Drop Tracking:**

The **"Log Drop"** button in the expanded card opens a dialog:
- Shows the loot pool of the monster (if monster data was downloaded via API-Fetch).
- Items can be searched by name and filtered by rarity (Common, Uncommon, Rare, Very Rare, Unique, Ultimate).
- A click on an item records the drop with the current timestamp and kill counter.
- Previously logged drops can be individually deleted from the drop history.

![Description](killfeed_giant_tracker/killfeed_giant_tracker_5_de.png)
![Description](killfeed_giant_tracker/killfeed_giant_tracker_6_de.png)

---

**Time to Kill (TTK):**

TTK automatically measures the combat duration against a boss monster — from the first hit to the kill.

*How it works:*
- **Start:** The enemy HP bar is detected with `current < max` (combat started).
- **Stop:** The kill is confirmed via EXP detection. The accumulated combat time is saved.
- **Pause:** The HP bar disappears (e.g. by deselecting the target to buff or heal). A grace period of 10 seconds begins.
- **Resume:** If the same boss monster is re-targeted within the 10-second grace period, the timer continues. Pause time is not counted toward TTK.
- **Abort:** If the grace period expires without re-targeting the boss, the TTK measurement is discarded.

*Target identification:*
- At combat start, the monster name and max HP are saved.
- When re-targeting, name and max HP are compared — only then is the timer resumed.
- If a different boss monster is targeted, the current measurement is aborted and a new one starts.
- If a normal monster is targeted, the boss timer pauses; normal kills continue to be counted.

*Display and statistics:*
- Compact Card: `TTK: [last kill] (Avg [average])`
- Expanded Card: Avg TTK, Last TTK, Fastest
- TTK values are saved per kill in the CSV history (column `TTK_ms`) and aggregated per monster.

*Limitation:*
- TTK measurement is only active for Giants, Violets, and Bosses. Normal monsters are not measured.
- Accuracy depends on the OCR sampling rate (typical: every 500–1000 ms).

---

**Data sources:**
- Kill data comes from the Killfeed CSV history (`daily/YYYY-MM-DD.csv`).
- Drop logs are stored separately per profile.
- Monster details (icon, HP, ATK, loot pool) come from the monster data downloaded via API-Fetch.

:::


:::accordion[Quest Guide]
- Shows available quests filtered by level, region, and type — with chain visualization and progress tracking per profile.
- Required API-Fetches: **Quest**, **NPC**, **Monster**, **Item**

**Setup:**
1. Make sure the **Quest Guide** plugin is enabled.
2. Download the required API data via API-Fetch (Quest, NPC, Monster, Item).
3. Select the **Quest Guide** tab in the sidepanel.

**Filters & Search:**
- **Search field** — filters by quest name, NPC, or item
- **Level mode:**
  - *OCR ±* — shows quests matching the currently OCR-detected level (with adjustable tolerance, default: ±5)
  - *Manual* — enter level and tolerance manually
  - *Min–Max* — set a fixed level window (default: 1–30)
- **Region** — restricts display to a specific game region
- **Type filter** — All / Chain / Daily / Repeat / Category
- **Subcategory** — For repeatable quests: Pets, Collection, Monster Hunt, Delivery, Other

**Progress Tracking:**
- Mark quests as completed — progress is saved per profile
- Checkbox "Show completed" to show/hide
- Checkbox "Show unavailable" to show/hide
- Reset button resets progress

**Stats bar:**
Shows the number of total, available, and completed quests at a glance.

**Quest Map:**
- Opens an interactive map with quest locations via the map button in the sidepanel.

![Description](quest_guide/quest_guide_sidepanel_de.png)
![Description](quest_guide/quest_guide_map_de.png)
:::

## Tools

Tools can be opened via hotkey or in the tab bar through the menu (star icon).

:::accordion[Fcoin <-> Penya]

![Description](tools/fcoin_zu_penya/fcoin_zu_penya_1.png)
- Converts FCoins to Penya and vice versa.
- Enter the current Penya-per-FCoin rate. The rate is saved and auto-loaded next time.
- Change either the FCoin amount or the Penya result — calculation happens both ways.

![Description](tools/fcoin_zu_penya/fcoin_zu_penya_2.png)

:::

:::accordion[Premium Shopping List]
- Planning tool for Premium Shop purchases; useful to estimate demand before buying FCoins. Pop-ups must be allowed.
- Requirements: API-Fetch endpoint **"Item"** including icons; without these data the search stays empty.
![Description](tools/premium_shopping_list/premium_shopping_list_1.png)
- Usage:
  1. Open the tool in the menu (star icon) and type the item name into the search field.
  2. The result list (max. 20) shows icon, name, and category; add via **"+ Add"** or increase quantity.
  ![Description](tools/premium_shopping_list/premium_shopping_list_2.png)
  3. In the list set price (FCoins) and quantity per item; price is saved when leaving the field and prefilled next time.
  4. Checkbox marks items as done/bought; "X" removes an entry.
  5. The bar at the bottom shows the sum of all entries (`price × quantity`) in FCoins.
- Storage: Prices persist in the launcher data folder; the list itself is new per session.

:::

:::accordion[Upgrade Calculator]

All upgrade types in a single window with sidebar navigation. Calculates expected costs, material quantities, and number of attempts.

![Description](tools/upgrade_cost_calc/upgrade_cost_calc_1.png)

**Sidebar sections:**

| Section | Dice | Protection |
|---------|------|--------|
| **Weapon / Armor / Shield** | Powerdice 4/6 or 12 | S-Protect / Low S-Protect |
| **Jewelry** | Dice 8 | A-Protect |
| **Armor Piercing** | Dice 8 | G-Protect |
| **Weapon/Shield Piercing** | Dice 8 | G-Protect |
| **Ultimate Weapon** | – | Ultimate Orb + XProtect |
| **Ultimate Jewelry** | – | Ultimate Orb + XProtect |

**Settings (Weapon / Armor):**

- **Dice type:** Powerdice 4/6 (default) or Powerdice 12 (higher success chance)
- **From level / To level:** Define upgrade range (e.g. +3 → +7)
- **Mode:**
  - **Compare** – Shows costs for both protection systems side by side
  - **SProtect** – Calculates with regular S-Protect scrolls
  - **Low SProtect** – Calculates with cheaper Low S-Protect scrolls

**Material Prices:**

Under "Materials" you can set the current market prices. With the "Owned" checkbox, materials are excluded from cost calculation.

![Description](tools/upgrade_cost_calc/upgrade_cost_calc_2.png)

**Result:**

After clicking "Calculate", a detailed table per upgrade level appears:

| Column | Meaning |
|--------|---------|
| Level | Target upgrade level |
| Chance | Success chance in percent |
| Attempts | Expected number of attempts |
| Mineral | Required minerals |
| Eron | Required erons |
| Penya | Penya costs |
| Protects | Required protection scrolls |
| Total Cost | Sum of all costs in Penya |

![Description](tools/upgrade_cost_calc/upgrade_cost_calc_3.png)

In comparison mode, both protection systems are displayed side by side — the cheaper option is highlighted in green.

**Storage:** Prices and settings are saved automatically.

:::

## Other

:::accordion[Announcements]

The right panel of the launcher displays messages from the developer — without requiring an app update. Examples: known bugs, current developments, or planned features. The display is available in German and English and can be disabled in settings.

![Description](announcements/announcements_de.png)
:::

:::accordion[Messages & Error Log (Logs)]

The **log icon** in the tab bar opens a separate window with the error log.

**Features:**
- Displays all warning and error messages with timestamp: `[HH:MM:SS] [LEVEL] [MODULE] Message`
- **Delete** — Remove all log entries
- **Save** — Export logs as `.txt` file (under `user/logs/`)
- **Send message** — Send logs directly to the developer (Discord)
  - Optional: add a description and ingame/Discord name
  - 60-second cooldown to prevent accidental multiple sends

![Description](logs/logs_window_de.png)
:::

:::accordion[Update Check & Version Rollback]

**Automatic Updates:**
- The launcher checks for a new version on startup (configurable in settings).
- If an update is available, a dialog with download option is shown.
- During the download, progress is displayed as a percentage bar.
- After downloading, the update is installed on the next restart.

**Manual Check:**
- Under **Settings → Behavior** there is a **"Check now"** button.

**Version Rollback:**
- Older launcher versions (from 3.0.5) can be installed directly from settings.
- A dropdown shows all available GitHub releases with date and current version marker.
- After selecting a version, it is downloaded and installed on restart.

![Description](settings/settings_update_de.png)
:::

:::accordion[RAM Display]

Under **Settings → Display → "Show RAM usage"** a memory display can be enabled in the tab bar.

**Features:**
- Shows total memory usage in MB.
- Clicking opens a detailed breakdown:
  - Memory usage per profile
  - Memory usage of plugins (estimated, as shared)
  - System overhead (launcher + OCR)

![Description](ram/ram_display_de.png)
:::
