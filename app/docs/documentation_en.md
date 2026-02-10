## Basic Features

:::accordion[Create Profile]

- Click **"New Profile"** in the header.

![Description](create_profil/create_profil_1_en.png)

- Enter a profile name and click **"Add"**.

![Description](create_profil/create_profil_2_en.png)

- Click the gear icon to open the profile settings.

![Description](create_profil/create_profil_3_en.png)

In this menu you can:

- change the profile name,
- select a job (defines the profile emblem and can be used as a search filter),
- decide whether the profile may be opened multiple times at once.

If **"Use in tabs"** is enabled, the profile can be used multiple times simultaneously.  
If it is disabled, the profile opens only in a single window.

If you want both variants, duplicate the profile and use one copy with the option enabled and one without.  
Note: Only one variant per profile can be used at the same time.

![Description](create_profil/create_profil_4_en.png)

You can create any number of profiles. Each profile stores its own Flyff session.  
In‑game settings are not shared across sessions like in a browser.
:::

:::accordion[Create Layout]

- Click **"Play"** in the tab of a created profile. Make sure this profile is allowed for tabs.  
![Description](create_layout/create_layout_1_en.png)

- Select the desired layout grid.  
![Description](create_layout/create_layout_3.png)

- Choose a profile for each cell and click **"Next"**.  
![Description](create_layout/create_layout_4_en.png)

- Click **"+"** to create additional layout tabs.  
![Description](create_layout/create_layout_5.png)

- Save the layout so you can launch it from the launcher.  
![Description](create_layout/create_layout_6.png)  
![Description](create_layout/create_layout_7.png)

- Tabs can be renamed with right-click.
- Tabs can be loaded sequentially or simultaneously.  
  -> Settings / Client Settings / Load grid tabs sequentially
:::

:::accordion[Data Paths & Persistence (Windows)]

All user data is stored by default under `%APPDATA%/Flyff-U-Launcher/` (Electron `userData`). Important files/folders:

| Feature/File                 | Purpose                                         | Path relative to `%APPDATA%/Flyff-U-Launcher` |
|------------------------------|-------------------------------------------------|-----------------------------------------------|
| API-Fetch data & icons       | Raw data/icons for plugins (items, monsters …)  | `api_fetch/<endpoint>/...`                    |
| Premium Shopping List prices | FCoin prices per item                           | `item-prices.json`                            |
| Profiles                     | Launcher profiles (name, job, flags)            | `profiles.json`                               |
| Layouts                      | Grid layouts for tabs                           | `tabLayouts.json`                             |
| ROI calibrations             | ROI definitions for OCR/Killfeed                | `rois.json`                                   |
| OCR timers                   | Sampling rates for OCR (Killfeed/CD-Timer)      | `ocr-timers.json`                             |
| Plugin settings              | Per-plugin settings (e.g., killfeed, cd-timer)  | `plugin-data/<pluginId>/settings.json`        |
| Themes & tab colors          | User themes / active tab color                  | `themes.json`, `tabActiveColor.json`          |

:::

## Plugins

Plugins usually need data and icons from the API. You can download them with API-Fetch.

:::accordion[API-Fetch]

- Open **"API-Fetch"**.  
![Description](api_fetch/api_fetch_1.png)  
![Description](api_fetch/api_fetch_2.png)

- Plugins expect the API data in a specific folder. Make sure this is set as the output.  
![Description](api_fetch/api_fetch_3.png)

- Select the required endpoints and click **"Start"**.  
![Description](api_fetch/api_fetch_4.png)

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

- The display of the timer icons can be configured: X/Y position, icon size, and number of columns.

- Click "+" to create a new timer.

- ![Description](cd_timer/cd_timer_3_de.png)
- The checkbox activates this timer.
- The "Icon" button opens a dialog to choose the icon.
- The text from the input field is shown on the icon. Tip: write which key is expected, e.g. "F1".
- After setting time and hotkey you can choose the target:  
  Main (sword icon in launcher) or Support View (staff icon in launcher).  
  This decides in which window the key press is awaited. The icon is always shown in the main window.  
  You can therefore set timers for RM buffs and display in the main that they need refresh.


- ![Description](cd_timer/cd_timer_4_de.png)

- Timers targeting the Support view have an orange glow for distinction.


- ![Description](cd_timer/cd_timer_5_de.png)
:::

:::accordion[Killfeed]
- Tracks kills and experience (EXP) in real time using the OCR system.
- Required API-Fetch to show monster data: "Monster".

**Features:**
- Kill detection via OCR (EXP changes are detected automatically)
- Session and overall stats (kills, EXP, kills/hour, EXP/hour, etc.)
- Overlay badges displayed directly in the game window

**Note:**
- Currently the killfeed only supports 1v1 leveling.
- In the future it will be extended to AOE and to track kills per monster group and bosses.

**Setup:**

1. **If not done: download API data**
   - Open the plugin [API-Fetch](action:openPlugin:api-fetch) and ensure the endpoint **"Monster"** is selected.
   - Start the download. Monster data is needed to validate kills against the EXP table.  
     (see API-Fetch documentation)
2. **Activate the plugin**
   - Open plugin settings in the launcher and make sure **Killfeed** is enabled.  
   ![Description](killfeed/killfeed_1_de.png)

3. **Calibrate OCR regions** (once per profile)
   - Start a game window with the "sword button" enabled via the launcher.  
    ![Description](killfeed/killfeed_2_de.png)
   - Open ROI calibration in the side panel.
   - Draw regions around these game UI elements:
     - **EXP%** – the experience display
     - **Level** – the level display
     - **Character name** – the character name
   - Save the regions. They are stored per profile and only need to be set once.  
    ![Description](killfeed/killfeed_3_de.png)
   - Left-click to drag ROIs.
   - After placing an ROI you can press TAB to select the next.
    ![Description](killfeed/killfeed_4_de.png)
   - Set for killfeed: LVL, NAME, EXP, ENEMY (enemy level), ENEMY HP
   - Press "Close" or ESC to finish ROI input.  
    ![Description](killfeed/killfeed_5_de.png)
   - ROIs can be fine-tuned after drawing.  
    ![Description](killfeed/killfeed_6_de.png)
   - The recognized values can be viewed live in the side panel.
   - Most important are LVL and EXP; ENEMY and ENEMY HP are currently auxiliary and more important in future.
   - If the shown level is incorrect in live OCR, you can set it manually; the manual value takes precedence over OCR.
   - If OCR "swallows" the EXP value once (e.g., on character swap), you can set it manually again.  
     The EXP rules might prevent automatic correction.
   - ![Description](killfeed/killfeed_7_de.png)


4. **Select profile in side panel**
   - Open the side panel and choose the **Killfeed** tab.
   - Select the profile to track from the dropdown.  
    ![Description](killfeed/killfeed_8_de.png)


5. **Play**
   - Once you defeat monsters, the OCR system detects EXP changes.
   - Kills and stats appear automatically in the overlay and side panel.

**Side panel:**
- Toggle individual badges (e.g., Kills/Session, EXP/hour, Kills to level-up).
![Description](killfeed/killfeed_9_de.png)
- Adjust overlay scale (0.6x – 1.6x).
- Choose how many rows the badges span.
![Description](killfeed/killfeed_10_de.png)
- Reset session stats with the reset button.
- Each session’s data is stored locally on your PC.

![Description](killfeed/killfeed_11_de.png)

- Each detected kill is shown in the side panel and stored persistently.
- Storage is written per profile to CSV files under AppData:
  - `user/plugin-data/killfeed/history/<profile-id>/daily/YYYY-MM-DD.csv` (individual kills)
  - `user/plugin-data/killfeed/history/<profile-id>/history.csv` (daily summary)
- Monster tracking accordions provide a `Kills` button per rank.
- `Kills` opens a list view with individual kills for the selected rank.

![Description](killfeed/killfeed_12_de.png)

- Individual kills can be deleted in the list view (`Delete` -> `Confirm`).
- Deleting a kill directly updates the side panel view and Killfeed history files (`daily/YYYY-MM-DD.csv` and `history.csv`).

![Description](killfeed/killfeed_13_de.png)


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

## Tools

Tools can be opened via hotkey or in the tab bar through the star menu.

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
  1. Open the tool in the star menu and type the item name into the search field.
  2. The result list (max. 20) shows icon, name, and category; add via **"+ Add"** or increase quantity.  
  ![Description](tools/premium_shopping_list/premium_shopping_list_2.png)
  3. In the list set price (FCoins) and quantity per item; price is saved when leaving the field and prefilled next time.
  4. Checkbox marks items as done/bought; "X" removes an entry.
  5. The bar at the bottom shows the sum of all entries (`price × quantity`) in FCoins.
- Storage: Prices persist in the launcher data folder (`%APPDATA%/Flyff-U-Launcher/item-prices.json`); the list itself is new per session.

:::
