## 基本機能

:::accordion[プロファイルを作成]

- ヘッダーの **「新しいプロファイル」** をクリック。

![説明](create_profil/create_profil_1_jp.png)

- プロファイル名を入力し **「追加」** をクリック。

![説明](create_profil/create_profil_2_jp.png)

- 歯車アイコンをクリックしてプロファイル設定を開く。

![説明](create_profil/create_profil_3_jp.png)

このメニューでできること：

- プロファイル名の変更
- 職業の選択（エンブレムに使用され、検索フィルタにもなる）
- プロファイルを同時に複数開けるかの設定

**「タブで使用」** をオンにすると複数同時利用が可能。オフの場合は単一ウィンドウのみ。

両方の使い分けをしたい場合はプロファイルを複製し、一方をオン、一方をオフにして使用。  
注意：同一プロファイルではどちらか一方のみ同時利用可能。

![説明](create_profil/create_profil_4_jp.png)

プロファイルはいくつでも作成可能。各プロファイルは独立した Flyff セッションを保存。  
ゲーム内設定はブラウザのように他セッションへ共有されない。
:::

:::accordion[レイアウトを作成]

- 作成済みプロファイルのタブで **「プレイ」** をクリック。プロファイルがタブ利用可であることを確認。  
![説明](create_layout/create_layout_1_jp.png)

- 希望するレイアウトグリッドを選択。  
![説明](create_layout/create_layout_3.png)

- 各セルにプロファイルを割り当て **「次へ」** をクリック。  
![説明](create_layout/create_layout_4_jp.png)

- **「+」** を押すとレイアウトタブを追加作成。  
![説明](create_layout/create_layout_5.png)

- レイアウトを保存してランチャーから起動できるようにする。  
![説明](create_layout/create_layout_6.png)  
![説明](create_layout/create_layout_7.png)

- 右クリックでタブ名を変更可能。
- タブは逐次または同時に読み込み可能。  
  -> 設定 / Client Settings / Grid-Tabs を順次読み込み
:::

:::accordion[データパスと永続化 (Windows)]

ユーザーデータは既定で `%APPDATA%/Flyff-U-Launcher/`（Electron `userData`）に保存。重要なファイル/フォルダ：

| 機能/ファイル                | 目的                                      | `%APPDATA%/Flyff-U-Launcher` からの相対パス |
|------------------------------|-------------------------------------------|---------------------------------------------|
| API-Fetch データとアイコン    | プラグイン用の生データ/アイコン（アイテム・モンスター等） | `api_fetch/<endpoint>/...`                  |
| Premium Shopping List 価格    | 各アイテムの FCoin 価格                   | `item-prices.json`                          |
| プロファイル                  | ランチャープロファイル（名前・職業・フラグ） | `profiles.json`                             |
| レイアウト                    | タブ用グリッドレイアウト                  | `tabLayouts.json`                           |
| ROI キャリブレーション        | OCR/Killfeed 用 ROI 定義                  | `rois.json`                                 |
| OCR タイマー                  | OCR サンプリングレート（Killfeed/CD-Timer）| `ocr-timers.json`                           |
| プラグイン設定                | プラグインごとの設定（killfeed, cd-timer 等） | `plugin-data/<pluginId>/settings.json`      |
| テーマ & タブ色               | ユーザーテーマ / アクティブタブ色         | `themes.json`, `tabActiveColor.json`        |

:::

## プラグイン

プラグインは通常 API データとアイコンを必要とします。API-Fetch でダウンロードできます。

:::accordion[API-Fetch]

- **「API-Fetch」** を開く。  
![説明](api_fetch/api_fetch_1.png)  
![説明](api_fetch/api_fetch_2.png)

- プラグインが期待する出力フォルダになっているか確認。  
![説明](api_fetch/api_fetch_3.png)

- 必要なエンドポイントを選び **「Start」** をクリック。  
![説明](api_fetch/api_fetch_4.png)

:::

:::accordion[CD-Timer]
- スキル/アイテムのクールダウンを追跡。タイマー終了時、赤枠付きアイコンが対応キーを促す。
- アイコン表示に必要な API-Fetch："Item" + "Skill"。

- CD-Timer が有効か確認。  
![説明](cd_timer/cd_timer_1_de.png)

- サイドパネルに CD-Timer タブが表示：
![説明](cd_timer/cd_timer_2_de.png)
- 「0/0 aktiv」は設定済み/有効なタイマー数を示す。
- 「Alle aktiv」チェックで全タイマー有効化。
- 「Alle abgelaufen」ボタンで全タイマーを 0:00:00 にリセットしキー入力待ちに。

- タイマーアイコンの表示を設定可能：X/Y 位置、サイズ、列数。

- 「+」クリックで新しいタイマーを追加。

- ![説明](cd_timer/cd_timer_3_de.png)
- チェックボックスでこのタイマーを有効化。
- 「Icon」ボタンでアイコン選択ダイアログを開く。
- 入力欄のテキストがアイコン上に表示。ヒント：押すキーを記入（例「F1」）。
- 時間とホットキー設定後、ターゲットを選択：  
  メイン（ランチャーの剣アイコン）またはサポートビュー（杖アイコン）。  
  どのウィンドウでキー入力を待つかを決定。アイコンは常にメインに表示。  
  RM バフ用のタイマーを設定し、メインに更新通知を出すといった使い方が可能。


- ![説明](cd_timer/cd_timer_4_de.png)

- サポートビュー向けタイマーは判別のためオレンジ色の輝きが付く。


- ![説明](cd_timer/cd_timer_5_de.png)
:::

:::accordion[Killfeed]
- OCR でリアルタイムにキルと経験値を追跡。
- モンスター情報表示に必要な API-Fetch："Monster"。

**機能:**
- OCR によるキル検知（EXP 変化を自動検出）
- セッション/累積統計（キル数、EXP、キル/時、EXP/時 など）
- ゲーム画面に直接表示されるオーバーレイバッジ

**注意:**
- 現在は 1v1 レベリングのみ対応。
- 今後 AOE への拡張、モンスターグループやボスごとのキル追跡を予定。

**セットアップ:**

1. **未実施なら：API データをダウンロード**
   - プラグイン [API-Fetch](action:openPlugin:api-fetch) を開き、エンドポイント **"Monster"** を選択。
   - ダウンロードを開始。モンスターEXP表でキルを検証するのに必要。  
     （API-Fetch ドキュメント参照）
2. **プラグインを有効化**
   - ランチャーのプラグイン設定で **Killfeed** をオンに。  
   ![説明](killfeed/killfeed_1_de.png)

3. **OCR 領域をキャリブレーション**（プロファイルごとに一度）
   - ランチャーから「剣ボタン」を押してゲームウィンドウを起動。  
    ![説明](killfeed/killfeed_2_de.png)
   - サイドパネルで ROI キャリブレーションを開く。
   - ゲーム内の次の表示を囲む：
     - **EXP%** – 経験値表示
     - **Level** – レベル表示
     - **Character name** – キャラクター名
   - 保存すると各プロファイルに記録され、再設定不要。  
    ![説明](killfeed/killfeed_3_de.png)
   - 左クリックで ROI をドラッグ。
   - 1 つ置いたら TAB で次を選択。  
    ![説明](killfeed/killfeed_4_de.png)
   - Killfeed 用に設定：LVL, NAME, EXP, ENEMY（敵レベル）, ENEMY HP
   - 「Schließen」または ESC で終了。  
    ![説明](killfeed/killfeed_5_de.png)
   - 描画後も微調整可能。  
    ![説明](killfeed/killfeed_6_de.png)
   - 認識値はサイドパネルでライブ表示。
   - 重要なのは LVL と EXP。ENEMY/ENEMY HP は補助で、今後のため。
   - OCR のレベル表示が誤っていれば手動設定でき、手動値が優先。
   - EXP を OCR が一度誤検知した場合（例：キャラ切替）、手動で再設定可能。  
     EXP ルールが自動補正を阻害することがある。
   - ![説明](killfeed/killfeed_7_de.png)


4. **サイドパネルでプロファイルを選択**
   - サイドパネルの **Killfeed** タブを開く。
   - ドロップダウンから追跡するプロファイルを選択。  
    ![説明](killfeed/killfeed_8_de.png)


5. **プレイする**
   - モンスターを倒すと OCR が EXP 変化を検出。
   - キルと統計がオーバーレイとサイドパネルに自動表示。

**サイドパネル:**
- 個別バッジのオン/オフ（キル/セッション、EXP/時、レベルアップまでのキル数など）。
![説明](killfeed/killfeed_9_de.png)
- オーバーレイスケールを調整（0.6x–1.6x）。
- バッジを表示する行数を選択。
![説明](killfeed/killfeed_10_de.png)
- Reset ボタンでセッション統計をリセット。
- 各セッションのデータはローカル保存。

![説明](killfeed/killfeed_11_de.png)


**キル判定ルール:**
以下すべて満たすとキルとしてカウント：
- レベルが変化していない（レベルアップ/ダウンなし）。
- EXP が 0.001% 超増加（イプシロン閾値）。
- EXP ジャンプが 40% 以下（サスペクト閾値）。超えると「疑わしい」として除外。
- 直近 1500 ms 内に敵 HP バーを検出。HP バーなしの場合は前回キルから 2250 ms 以上で許可。
- API-Fetch のモンスターデータがある場合：EXP 増加が期待値の 10%〜10 倍の範囲内。外れると OCR エラーとして除外。

**却下される EXP 変化:**
- レベルアップ/ダウン：カウントなし。
- EXP 減少：無視（OCR ノイズ）。
- EXP ジャンプが 40% 超：疑わしいとして不採用。
- HP バーなし かつ 前回キルから 2250 ms 未満：カウントなし。

**備考:**
- キル検知には OCR が有効である必要があります。
- キル/時などの統計は 5 分のローリングウィンドウで算出。
:::

## ツール

ツールはホットキー、またはタブバーの星メニューから開けます。

:::accordion[Fcoin <-> Penya]

![説明](tools/fcoin_zu_penya/fcoin_zu_penya_1.png)
- FCoins と Penya を相互換算。
- 現在の Penya/FCoin レートを入力。レートは保存され次回自動ロード。
- FCoin 量または Penya 結果を変えると双方向に即計算。

![説明](tools/fcoin_zu_penya/fcoin_zu_penya_2.png)

:::

:::accordion[プレミアム買い物リスト]
- プレミアムショップ購入の計画ツール。FCoin 購入前の必要量試算に便利。ポップアップを許可しておくこと。
- 必要条件：API-Fetch エンドポイント **"Item"**（アイコン含む）。これが無いと検索結果は空。
![説明](tools/premium_shopping_list/premium_shopping_list_1.png)
- 使い方：
  1. 星メニューでツールを開き、検索欄にアイテム名を入力。
  2. 結果リスト（最大 20 件）にアイコン・名前・カテゴリが表示；**"+ Add"** で追加または数量増。  
  ![説明](tools/premium_shopping_list/premium_shopping_list_2.png)
  3. リストで価格（FCoins）と数量を設定。価格はフォーカスが外れた時に保存され、次回の検索で自動入力。
  4. チェックボックスで購入済み/完了をマーク、「X」で削除。
  5. 下部バーに全エントリの合計（`価格 × 数量`）を FCoins で表示。
- 保存：価格はランチャーデータフォルダに永続化（`%APPDATA%/Flyff-U-Launcher/item-prices.json`）。リスト自体はセッションごとにリセット。

:::
