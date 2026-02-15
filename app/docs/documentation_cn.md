## 基本功能

:::accordion[创建档案]

- 点击页眉中的 **“新档案”**。

![说明](create_profil/create_profil_1_cn.png)

- 输入档案名称并点击 **“添加”**。

![说明](create_profil/create_profil_2_cn.png)

- 点击齿轮图标打开档案设置。

![说明](create_profil/create_profil_3_cn.png)

在此菜单中你可以：

- 修改档案名称；
- 选择职业（决定档案徽章，也可作为搜索过滤）；
- 决定档案是否可同时多开。

启用 **“在标签中使用”** 时，档案可同时多开；关闭时，只会在单个窗口打开。

如果想同时拥有两种方式，复制该档案，一份开启此选项，一份关闭。  
注意：同一档案一次只能使用其中一种变体。

![说明](create_profil/create_profil_4_cn.png)

可以创建任意数量的档案，每个档案保存独立的 Flyff 会话。  
游戏内设置不会像浏览器那样在会话之间共享。
:::

:::accordion[创建布局]

- 在已创建档案的标签上点击 **“开始游戏”**，并确保该档案允许在标签中使用。  
![说明](create_layout/create_layout_1_cn.png)

- 选择想要的布局网格。  
![说明](create_layout/create_layout_3.png)

- 为每个格子选择一个档案并点击 **“下一步”**。  
![说明](create_layout/create_layout_4_cn.png)

- 点击 **“+”** 可创建更多布局标签。  
![说明](create_layout/create_layout_5.png)

- 保存布局，方便之后直接从启动器启动。  
![说明](create_layout/create_layout_6.png)  
![说明](create_layout/create_layout_7.png)

- 右键可重命名标签。
- 标签可顺序加载或同时加载。  
  -> 设置 / 客户端设置 / 顺序加载网格标签
:::

:::accordion[数据路径与持久化 (Windows)]

所有用户数据默认存放在 `%APPDATA%/Flyff-U-Launcher/`（Electron `userData`）。重要文件/文件夹：

| 功能/文件                   | 用途                                        | 相对 `%APPDATA%/Flyff-U-Launcher` 的路径 |
|-----------------------------|---------------------------------------------|-------------------------------------------|
| API-Fetch 数据与图标        | 插件所需原始数据/图标（物品、怪物…）        | `api_fetch/<endpoint>/...`                |
| Premium Shopping List 价格  | 每个物品的 FCoin 价格                       | `item-prices.json`                        |
| 档案                        | 启动器档案（名称、职业、标记）              | `profiles.json`                           |
| 布局                        | 标签的网格布局                              | `tabLayouts.json`                         |
| ROI 校准                    | OCR/Killfeed 的 ROI 定义                    | `rois.json`                               |
| OCR 定时器                  | OCR 采样率（Killfeed/CD-Timer）             | `ocr-timers.json`                         |
| 插件设置                    | 各插件设置（如 killfeed、cd-timer）         | `plugin-data/<pluginId>/settings.json`    |
| 主题与标签颜色              | 自定义主题 / 活动标签颜色                   | `themes.json`, `tabActiveColor.json`      |

:::

## 插件

插件通常需要来自 API 的数据和图标，可通过 API-Fetch 下载。

:::accordion[API-Fetch]

- 打开 **“API-Fetch”**。  
![说明](api_fetch/api_fetch_1.png)  
![说明](api_fetch/api_fetch_2.png)

- 插件期望 API 数据位于指定文件夹，请确认输出路径正确。  
![说明](api_fetch/api_fetch_3.png)

- 选择所需端点并点击 **“Start”**。  
![说明](api_fetch/api_fetch_4.png)

:::

:::accordion[CD-Timer]
- 跟踪技能/物品冷却。计时结束时，带红框的图标会提示按下对应按键。
- 显示图标所需的 API-Fetch："Item" + "Skill"。

- 确认已启用 CD-Timer。  
![说明](cd_timer/cd_timer_1_de.png)

- 侧边面板会出现 CD-Timer 标签：
![说明](cd_timer/cd_timer_2_de.png)
- “0/0 aktiv” 显示已配置与已激活的计时器数量。
- “Alle aktiv” 复选框可激活全部计时器。
- “Alle abgelaufen” 按钮将所有计时器重置为 0:00:00，等待按键。

- 计时器图标可设置：X/Y 位置、图标大小、列数。

- 点击 “+” 创建新计时器。

- ![说明](cd_timer/cd_timer_3_de.png)
- 复选框启用此计时器。
- “Icon” 按钮打开图标选择对话框。
- 文本输入框内容会显示在图标上。提示：写下需要按的按键，例如 “F1”。
- 设定时间和热键后可选择目标：  
  主视图（启动器中的剑图标）或辅助视图（法杖图标）。  
  这决定在哪个窗口等待按键。图标始终显示在主视图窗口。  
  例如可为 RM buff 设置计时器，并在主视图提示需要刷新。


- ![说明](cd_timer/cd_timer_4_de.png)

- 指向辅助视图的计时器会有橙色光晕以示区分。


- ![说明](cd_timer/cd_timer_5_de.png)
:::

:::accordion[Killfeed]
- 通过 OCR 实时跟踪击杀与经验（EXP）。
- 显示怪物数据所需 API-Fetch："Monster"。

**功能：**
- 通过 OCR 识别击杀（自动检测 EXP 变化）
- 会话及总计统计（击杀、EXP、击杀/小时、EXP/小时等）
- 叠加徽章直接显示在游戏窗口

**说明：**
- 目前仅支持 1v1 升级。
- 未来将扩展到 AOE，并记录每组怪及 Boss 的击杀。

**设置：**

1. **如未完成：下载 API 数据**
   - 打开插件 [API-Fetch](action:openPlugin:api-fetch)，确保选择了端点 **“Monster”**。
   - 开始下载。需要怪物数据来按经验表校验击杀。  
     （见 API-Fetch 文档）
2. **启用插件**
   - 在启动器中打开插件设置，确保 **Killfeed** 已启用。  
   ![说明](killfeed/killfeed_1_de.png)

3. **校准 OCR 区域**（每个档案一次）
   - 通过启动器按下“剑按钮”启动游戏窗口。  
    ![说明](killfeed/killfeed_2_de.png)
   - 在侧边面板打开 ROI 校准。
   - 在游戏中框选以下区域：
     - **EXP%** – 经验显示
     - **Level** – 等级显示
     - **Character name** – 角色名
   - 保存区域。每个档案单独保存，只需设置一次。  
    ![说明](killfeed/killfeed_3_de.png)
   - 左键拖动 ROI。
   - 设置一个 ROI 后可按 TAB 选择下一个。  
    ![说明](killfeed/killfeed_4_de.png)
   - Killfeed 需要设置：LVL、NAME、EXP、ENEMY（怪物等级）、ENEMY HP
   - 按 “Schließen” 或 ESC 完成 ROI 输入。  
    ![说明](killfeed/killfeed_5_de.png)
   - ROI 可在绘制后微调。  
    ![说明](killfeed/killfeed_6_de.png)
   - 识别结果可在侧边面板实时查看。
   - 关键是 LVL 与 EXP；ENEMY 与 ENEMY HP 目前辅助，未来更重要。
   - 若实时 OCR 的等级不正确，可手动设置；手动值优先于 OCR。
   - 若 OCR 偶尔“吞掉”一次 EXP（如切换角色），可手动重设；  
     EXP 规则可能阻止自动纠正。
   - ![说明](killfeed/killfeed_7_de.png)


4. **在侧边面板选择档案**
   - 打开侧边面板，选择 **Killfeed** 标签。
   - 在下拉框中选择要跟踪的档案。  
    ![说明](killfeed/killfeed_8_de.png)


5. **开始游戏**
   - 击杀怪物后，OCR 会检测 EXP 变化。
   - 击杀与统计会自动显示在叠加层和侧边面板。

**侧边面板：**
- 可切换单个徽章（如 每会话击杀数、EXP/小时、升级所需击杀数）。
![说明](killfeed/killfeed_9_de.png)
- 调整叠加缩放（0.6x–1.6x）。
- 选择徽章跨越的行数。
![说明](killfeed/killfeed_10_de.png)
- 用重置按钮清空会话统计。
- 每个会话的数据都会本地保存。

![说明](killfeed/killfeed_11_de.png)

- 每次识别到的击杀都会显示在侧边面板中，并持久保存。
- 数据按配置档分别写入 AppData 下的 CSV 文件：
  - `user/plugin-data/killfeed/history/<profile-id>/daily/YYYY-MM-DD.csv`（单次击杀明细）
  - `user/plugin-data/killfeed/history/<profile-id>/history.csv`（每日汇总）
- 在怪物追踪折叠面板中，每个品级都有一个 `Kills` 按钮。
- 点击 `Kills` 会打开所选品级的单次击杀列表视图。

![说明](killfeed/killfeed_12_de.png)

- 在列表视图中可以删除单次击杀记录（`Delete` -> `Confirm`）。
- 删除后会直接更新侧边面板显示，以及 Killfeed 历史文件（`daily/YYYY-MM-DD.csv` 和 `history.csv`）。

![说明](killfeed/killfeed_13_de.png)


**击杀判定规则：**
满足以下全部条件才计为一次击杀：
- 等级未变化（无升级/降级）。
- EXP 增加超过 0.001%（epsilon 阈值）。
- EXP 跳变不超过 40%（suspect 阈值）；更大跳变视为可疑并丢弃。
- 最近 1500 ms 内检测到敌方血条（OCR）。若无血条，则与上次击杀间隔至少 2250 ms 也可接受。
- 若存在 API-Fetch 的怪物数据：EXP 增益需介于预期值的 10% 与 10 倍之间，超出视为 OCR 误差并丢弃。

**被拒绝的 EXP 变化：**
- 升级/降级：不计击杀。
- EXP 下降：忽略（OCR 噪声）。
- EXP 跳变超过 40%：标记可疑，不计入。
- 无血条且距上次击杀少于 2250 ms：不计击杀。

**提示：**
- 必须启用 OCR 系统才能识别击杀。
- 击杀/小时等统计按滚动的 5 分钟窗口计算。
:::

:::accordion[Killfeed：Giant Tracker]
# 注意：
## 在首次记录到 Giant、Violet 或 Boss 击杀之前，会显示示例数据来演示该功能。
---
Giant Tracker 是 Killfeed 插件中的独立窗口，用于追踪并可视化 **Giants**、**Violets** 和 **Bosses** 的击杀统计——包括时间范围、掉落物和击杀时间（TTK）。五个筛选标签（全部、Giants、Violets、Bosses、Drops）支持按等级或已记录的掉落进行针对性筛选。

**打开方式：**
- 在 Killfeed 侧边栏中有 **"Giant Tracker"** 按钮。
- 点击后会打开一个独立窗口，显示所有追踪的 Boss 怪物概览。
- 如果还没有真实击杀数据，将显示示例数据。

![说明](killfeed_giant_tracker/killfeed_giant_tracker_1_de.png)

---

**筛选和排序：**
- 筛选栏可以限制显示范围：
  - **全部** / **Giants** / **Violets** / **Bosses** / **Drops** ——按怪物等级或掉落物筛选。
  - **Bosses** ——仅显示等级为 `boss` 的怪物（如 Clockworks、Meteonyker）。Boss 卡片有红色边框。
  - **Drops** ——仅显示至少有一条掉落记录的怪物。此外，卡片中直接显示掉落池预览（按稀有度排列的前5个物品）。
  - **排序** ——按击杀数（升序/降序）、名称（A–Z / Z–A）或等级（升序/降序）。
  - **搜索框** ——按怪物名称筛选卡片。

![说明](killfeed_giant_tracker/killfeed_giant_tracker_2_de.png)

---

**卡片视图：**

每个追踪的怪物显示为一张卡片。有两种视图：

*紧凑卡片（默认视图）：*
- 怪物图标、名称、等级、属性、等级
- 战斗数值（HP、ATK）
- 击杀概览：今天 / 总计
- TTK 显示（如有测量数据）：`TTK: 45.2s (平均 52.3s)`
- 最后击杀（时间）、掉落数量
- **"详情"** 按钮展开

![说明](killfeed_giant_tracker/killfeed_giant_tracker_3_de.png)

*展开卡片（详细视图）：*
- 紧凑卡片的所有字段
- 按时间段的击杀统计：今天、本周、本月、今年、总计
- TTK 统计：平均 TTK、最后 TTK、最快
- 掉落区域：掉落数量、平均击杀/掉落、自上次掉落以来的击杀数
- 掉落历史（可折叠）：包含物品名称、击杀计数器和时间戳的单个掉落记录
- **"记录掉落"** 按钮记录掉落
- **"收起"** 按钮关闭详细视图

![说明](killfeed_giant_tracker/killfeed_giant_tracker_4_de.png)

---

**掉落追踪：**

展开卡片中的 **"记录掉落"** 按钮会打开一个对话框：
- 显示怪物的掉落池（如果已通过 API-Fetch 下载怪物数据）。
- 物品可以按名称搜索并按稀有度筛选（普通、稀有、稀少、非常稀少、唯一、究极）。
- 点击物品会记录掉落，附带当前时间戳和击杀计数。
- 之前记录的掉落可以从历史中逐个删除。

![说明](killfeed_giant_tracker/killfeed_giant_tracker_5_de.png)
![说明](killfeed_giant_tracker/killfeed_giant_tracker_6_de.png)

---

**击杀时间（TTK）：**

TTK 自动测量与 Boss 怪物的战斗时间——从第一次打击到击杀。

*工作原理：*
- **开始：** 检测到敌方 HP 条 `当前 < 最大`（战斗开始）。
- **停止：** 通过 EXP 检测确认击杀。累积的战斗时间被保存。
- **暂停：** HP 条消失（如取消选择目标进行增益或治疗）。开始 10 秒的宽限期。
- **继续：** 如果在 10 秒宽限期内重新选择同一 Boss 怪物，计时器继续。暂停时间不计入 TTK。
- **中止：** 如果宽限期结束仍未重新选择 Boss，TTK 测量被丢弃。

*目标识别：*
- 战斗开始时保存怪物名称和最大 HP。
- 重新选择时比较名称和最大 HP——只有匹配时计时器才会继续。
- 如果选择了不同的 Boss 怪物，当前测量被中止并开始新的测量。
- 如果选择了普通怪物，Boss 计时器暂停；普通击杀继续计数。

*显示和统计：*
- 紧凑卡片：`TTK: [最后击杀] (平均 [平均值])`
- 展开卡片：平均 TTK、最后 TTK、最快
- TTK 值按击杀保存在 CSV 历史中（`TTK_ms` 列），并按怪物汇总。

*限制：*
- TTK 测量仅对 Giants、Violets 和 Bosses 有效。普通怪物不被测量。
- 精度取决于 OCR 采样率（通常：每 500-1000 毫秒）。

---

**数据来源：**
- 击杀数据来自 Killfeed CSV 历史（`daily/YYYY-MM-DD.csv`）。
- 掉落日志按配置文件分别存储。
- 怪物详情（图标、HP、ATK、掉落池）来自通过 API-Fetch 下载的怪物数据。

:::

## 工具

工具可通过热键或标签栏的星形菜单打开。

:::accordion[Fcoin <-> Penya]

![说明](tools/fcoin_zu_penya/fcoin_zu_penya_1.png)
- 将 FCoins 与 Penya 互相换算。
- 输入当前每 FCoin 的 Penya 汇率。汇率会保存，下次自动加载。
- 修改 FCoin 数或 Penya 结果，计算双向自动更新。

![说明](tools/fcoin_zu_penya/fcoin_zu_penya_2.png)

:::

:::accordion[Premium 购物清单]
- Premium 商店购物规划；方便在购买 FCoin 前估算需求。需允许弹窗。
- 要求：API-Fetch 端点 **“Item”** 包含图标；否则搜索为空。
![说明](tools/premium_shopping_list/premium_shopping_list_1.png)
- 用法：
  1. 在星形菜单打开工具，在搜索框输入物品名。
  2. 结果列表（最多 20 条）显示图标、名称、类别；用 **“+ Add”** 添加或增加数量。  
  ![说明](tools/premium_shopping_list/premium_shopping_list_2.png)
  3. 在列表中设置每个物品的价格（FCoin）和数量；离开输入框时价格会保存，下次预填。
  4. 复选框标记已完成/已购买，"X" 删除条目。
  5. 底部进度条显示所有条目的总和（`价格 × 数量`）单位 FCoin。
- 存储：价格持久保存在启动器数据目录 (`%APPDATA%/Flyff-U-Launcher/item-prices.json`)，列表本身每个会话重新开始。

:::

:::accordion[升级费用计算器]

计算从 +0 到 +10 的物品升级预期费用 —— 包括所需材料、尝试次数以及不同保护系统的对比。

![说明](tools/upgrade_cost_calc/upgrade_cost_calc_1.png)

**设置：**

- **骰子类型：** Powerdice 4/6（标准）或 Powerdice 12（更高成功率）
- **从等级 / 到等级：** 设定升级范围（如 +3 → +7）
- **模式：**
  - **对比** – 并排显示两种保护系统的费用
  - **S-Protect** – 使用普通 S-Protect 卷轴计算
  - **S-Protect (Low)** – 使用更便宜的 Low S-Protect 卷轴计算

**材料价格：**

在„材料"下可以设置以下物品的当前市场价格：
- 矿物
- Eron
- S-Protect
- Low S-Protect
- Powerdice 4、6、12

勾选„已拥有"可将材料从费用计算中排除。

![说明](tools/upgrade_cost_calc/upgrade_cost_calc_2.png)

**结果：**

点击„计算"后，会显示每个升级等级的详细表格：

| 列 | 含义 |
|----|------|
| 等级 | 目标升级等级 |
| 概率 | 成功率（百分比） |
| 尝试次数 | 预期尝试次数 |
| 矿物 | 所需矿物 |
| Eron | 所需 Eron |
| Penya | Penya 费用 |
| 保护卷轴 | 所需保护卷轴 |
| 总费用 | 所有费用的 Penya 总和 |

![说明](tools/upgrade_cost_calc/upgrade_cost_calc_3.png)

在对比模式下，两种保护系统（S-Protect vs. S-Protect Low）并排显示。更便宜的选项以绿色高亮。

**存储：** 价格和设置自动保存（`%APPDATA%/Flyff-U-Launcher/user/tools/upgrades/upgrade_cost_calc.json`）。

:::
