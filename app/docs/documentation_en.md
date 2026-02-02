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
