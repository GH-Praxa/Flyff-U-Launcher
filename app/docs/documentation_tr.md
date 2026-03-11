## Temel Özellikler

:::accordion[Profil oluştur]

**Adım 1 — Yeni profil oluştur:**
- Üst başlıktaki **"Yeni Profil"** butonuna tıkla.

![Açıklama](create_profil/create_profil_1_tr.png)

**Adım 2 — Profil adı gir:**
- Profil adı gir ve **"Ekle"**ye tıkla.
- **"Kapat"**a tıklayarak profil oluşturmadan pencereyi kapat.

![Açıklama](create_profil/create_profil_2_tr.png)

**Adım 3 — Profil kartını anla:**

Her profil listede bir kart olarak gösterilir:

![Açıklama](create_profil/create_profil_3_tr.png)

| No | Öğe | Açıklama |
|----|-----|----------|
| ❶ | Sürükleme tutamağı | Profilleri sürükle-bırak ile sırala |
| ❷ | Overlay Hedefi | Hangi profilin OCR overlay'lerini ve yan paneli alacağını belirler |
| ❸ | Supporter Hedefi | Hangi profilin CD-Timer için supporter görünümü olduğunu belirler |
| ❹ | Başlatma modu | Profilin sekme veya pencere modunda açılacağını gösterir |
| ❺ | Dişli simgesi | Profil ayarlarını aç |
| ❻ | Oyna | Bu profille oyun oturumu başlat |

**Adım 4 — Profil ayarları:**

Ayarları açmak için dişli simgesine ❺ tıkla:

![Açıklama](create_profil/create_profil_4_tr.png)

| No | Öğe | Açıklama |
|----|-----|----------|
| ❶ | Profil adı | Profil adını değiştir |
| ❷ | Sınıf + karakter adı | Açılır menüden sınıf seç ve karakter adı gir. Her karakter kendi sınıfını alır. |
| ❸ | Karakter ekle | Profile başka bir karakter adı ekle ("Ekle" butonu) |
| ❹ | Sekmelerde kullan | Açık: profil çoklu sekmeli düzenlerde kullanılabilir. Kapalı: profil yalnızca kendi penceresinde açılır. |
| ❺ | Kaydet | Değişiklikleri uygula |
| ❻ | Profili kopyala | Tüm ayarlarla profilin bir kopyasını oluşturur |
| ❼ | Sil | Profili kalıcı olarak kaldır |
| ❽ | Kapat | Pencereyi kapat |

Bir profili hem sekme hem pencere modunda kullanmak için ❻ ile kopyala ve her mod için bir kopya kullan.

**Adım 5 — Karakterli profil listesi:**

Yapılandırılmış profiller listede karakter adları ve sınıf simgeleriyle gösterilir:

![Açıklama](create_profil/create_profil_5_tr.png)

- Her karakter, profil adının altında sınıf simgeli bir rozet olarak gösterilir.
- Başlıktaki sınıf filtresi ve karakter adı araması tüm profillerdeki tüm karakterleri tarar.
- Killfeed gibi eklentiler kayıtlı karakter adlarını açılır liste ile kullanır.

İstediğin kadar profil oluşturabilirsin. Her profil kendi Flyff oturumunu saklar.
Oyundaki ayarlar tarayıcıdaki gibi diğer oturumlara aktarılmaz.

**Profil Dışa/İçe Aktarma:**

![small](create_profil/create_profil_6.png)

| No | Öğe | Açıklama |
|----|-----|----------|
| ❶ | Dışa aktar | Profili `.flyffprofile` dosyası olarak kaydet |
| ❷ | İçe aktar | `.flyffprofile` dosyası yükle ve yeni profil oluştur |

Dışa aktarılan dosya şunları içerir:

- Profil meta verileri (ad, sınıf, ayarlar)
- Electron oturum çerezleri (giriş verileri)
- localStorage verileri (oyun ayarları)

Bu, yedekleme ve bilgisayarlar arası transfer sağlar.
:::

:::accordion[Layout oluştur]

**Adım 1 — Layout başlat:**

Sekmeleri etkin olan bir profilde **"Oyna"**ya tıkla.

![Açıklama](create_layout/create_layout_1_tr.png)

**Adım 2 — Grid seç:**

İstediğin grid'i seç. Üzerine gelince sağda bir **ASCII önizleme** gösterilir.

![Açıklama](create_layout/create_layout_2.png)

*Simetrik layoutlar:*
- **1×1** — Tek pencere
- **1×2 / 2×1** — İki pencere yan yana / üst üste
- **1×3 / 3×1** — Üç pencere yan yana / üst üste
- **1×4 / 4×1** — Dört pencere yan yana / üst üste
- **2×2** — Dört pencere grid'de
- **3+2** — Üstte üç, altta iki
- **2×3** — Altı pencere grid'de
- **4+3** — Üstte dört, altta üç
- **2×4** — Sekiz pencere grid'de

*Asimetrik layoutlar:*
- **1+2 →** — Ana pencere solda, 2 yan pencere sağda
- **1+3 →** — Ana pencere solda, 3 yan pencere sağda
- **1+2 ↓** — Ana pencere üstte, 2 yan pencere altta
- **1+3 ↓** — Ana pencere üstte, 3 yan pencere altta

Asimetrik layoutlarda sekme çubuğunda **kaydırıcı** ile bölünme ayarlanabilir (min. %20 / maks. %80).

![small](create_layout/create_layout_slider.png)

**Adım 3 — Profil ata:**

Her hücreye bir profil ata. Gerekmeyen hücreler boş bırakılabilir.

![Açıklama](create_layout/create_layout_3_tr.png)

| No | Öğe | Açıklama |
|----|-----|----------|
| ❶ | Grid hücreleri | Seçilen grid'in hücrelerini gösterir. Aşağıdaki listeden profil atamak için bir hücreye tıkla. |
| ❷ | Profil listesi | Sekmeleri etkin tüm profiller. Seçili hücreye atamak için tıkla. |
| ❸ | İleri | Atamayı onaylar ve layoutu atanan profillerle başlatır. |

**Adım 4 — Layout kaydet:**

Resimde işaretlenen buton (başlık çubuğunda) kaydetme dialogunu açar.

![Açıklama](create_layout/create_layout_4.png)

Layout'a bir ad ver ve **"Kaydet"**e tıkla.

![Açıklama](create_layout/create_layout_5_tr.png)

**Adım 5 — Launcher'da layout kartı:**

Kaydedilen layoutlar profil listesinde kart olarak gösterilir:

![Açıklama](create_layout/create_layout_6_tr.png)

- Kart **layout adını**, **profil sayısını** ve **grid minyatürünü** gösterir.
- **"Oyna"** ile tüm layout başlatılır.
- **Dişli simgesi** layout ayarlarını açar (ad, profil ataması, grid).

**İlgili ayarlar** (Ayarlar / Layout altında):
- **Grid sekmelerini sıralı yükle** — Sekmeleri aynı anda değil sırayla başlat
- **Değişikliklerde layoutları güncelle** — Layout değişikliklerini otomatik kaydet
- **Aktif grid görünümünü vurgula** — O an odaklanan sekmeyi görsel olarak vurgula
- **Layoutlar için sekme gösterimi** — Launcher'da layout sekmelerinin gösterim modu
- **Layout gecikmesi** — Sekme değiştirirken gecikme süresi

**İlgili kısayollar** (Ayarlar / Kısayollar altında):
- **Önceki sekme** / **Sonraki sekme** — Sekmeler arasında geçiş yap
- **Sonraki pencere** — Açık pencereler arasında odağı değiştir
- **Sekme çubuğu aç/kapat** — Oturum penceresinde sekme çubuğunu göster/gizle

**Çoklu Pencere:**

Layoutların yanı sıra birden fazla bağımsız oturum penceresi paralel olarak açılabilir. Bir oturum aktifken profil açıldığında, mevcut pencereye eklenip eklenmeyeceği veya yeni pencere oluşturulup oluşturulmayacağı sorulur.
:::

:::accordion[Kısayol Tuşları]

Kısayol tuşları, oyun penceresi aktifken bile çalışan serbestçe atanabilir tuş kombinasyonlarıdır (2–3 tuş).

**Yapılandırma:**
- **Ayarlar → Kısayol Tuşları** bölümünü açın.
- Bir eylemin yanındaki rozete tıklayın ve istediğiniz tuş kombinasyonunu basın.
- Çakışmalar otomatik olarak algılanır ve görüntülenir.

![Açıklama](hotkeys/hotkeys_settings_de.png)

**Kullanılabilir eylemler:**

| Eylem | Açıklama |
|-------|----------|
| Katmanları aç/kapat | Tüm katmanları göster veya gizle |
| Yan paneli aç/kapat | Yan paneli aç veya kapat |
| Sekme çubuğunu aç/kapat | Oturum penceresinde sekme çubuğunu göster/gizle |
| Önceki sekme | Önceki sekmeye geç |
| Sonraki sekme | Sonraki sekmeye geç |
| Sonraki pencere | Açık pencereler arasında odağı değiştir |
| CD zamanlayıcıyı sıfırla | Tüm CD zamanlayıcılarını 00:00'a ayarla (tuş basımı bekleniyor) |
| Ekran görüntüsü | Aktif pencerenin ekran görüntüsünü kaydet |
| FCoins hesaplayıcı | FCoins hesaplayıcıyı aç |
| Alışveriş listesi | Premium alışveriş listesini aç |

Yapılandırılmış kısayol tuşları, sekme çubuğundaki **klavye simgesi** üzerinden her zaman görüntülenebilir.

![Açıklama](hotkeys/hotkeys_menu_de.png)
:::

:::accordion[Veri yolları ve kalıcılık (Windows)]

Tüm kullanıcı verileri varsayılan olarak `%APPDATA%/Flyff-U-Launcher/` içinde (Electron `userData`). Önemli dosyalar/klasörler:

| Özellik/Dosya               | Amaç                                         | `%APPDATA%/Flyff-U-Launcher`a göre yol |
|-----------------------------|----------------------------------------------|---------------------------------------|
| API-Fetch veri & ikonlar    | Pluginler için ham veriler/ikonlar (item, monster…) | `api_fetch/<endpoint>/...`          |
| Premium Shopping List fiyatları | Item başına FCoin fiyatı                 | `item-prices.json`                    |
| Profiller                   | Launcher profilleri (isim, sınıf, bayraklar) | `profiles.json`                       |
| Layoutlar                   | Sekmeler için grid layoutları                | `tabLayouts.json`                     |
| ROI kalibrasyonları         | OCR/Killfeed için ROI tanımları              | `rois.json`                           |
| OCR timerları               | OCR örnekleme hızları (Killfeed/CD-Timer)    | `ocr-timers.json`                     |
| Plugin ayarları             | Plugin bazlı ayarlar (killfeed, cd-timer vb.)| `plugin-data/<pluginId>/settings.json`|
| Temalar & sekme renkleri    | Kullanıcı temaları / aktif sekme rengi       | `themes.json`, `tabActiveColor.json`  |

:::

## Pluginler

Pluginlerin çoğu API verisi ve ikonlarına ihtiyaç duyar. Bunları API-Fetch ile indir.

:::accordion[API-Fetch]

- **"API-Fetch"**i aç.  
![Açıklama](api_fetch/api_fetch_1.png)  
![Açıklama](api_fetch/api_fetch_2.png)

- Pluginler API verisini belirli bir klasörde bekler. Çıkış klasörünün doğru olduğundan emin ol.  
![Açıklama](api_fetch/api_fetch_3.png)

- Gerekli endpointleri seçip **"Start"**a tıkla.  
![Açıklama](api_fetch/api_fetch_4.png)

:::

:::accordion[CD-Timer]
- Yetenek/eşya bekleme sürelerini takip eder. Süre dolunca kırmızı çerçeveli ikon tanımlı tuşa basmanı ister.
- İkonlar için gereken API-Fetch: "Item" + "Skill".

- CD-Timer'ın açık olduğundan emin ol.  
![Açıklama](cd_timer/cd_timer_1_de.png)

- Yan panelde CD-Timer sekmesi görünür:
![Açıklama](cd_timer/cd_timer_2_de.png)
- "0/0 aktiv" yapılandırılmış ve aktif timer sayısını gösterir.
- "Alle aktiv" kutusu tüm timerları açar.
- "Alle abgelaufen" butonu tüm timerları 0:00:00'a çeker ve tuş bekler.

- Timer ikonlarının görünümü ayarlanabilir: X/Y konumu, ikon boyutu, kolon sayısı.

- "+" ile yeni timer eklenir.

- ![Açıklama](cd_timer/cd_timer_3_de.png)
- Checkbox bu timerı etkinleştirir.
- "Icon" butonu ikon seçme penceresini açar.
- Metin kutusundaki yazı ikonda görünür. İpucu: beklenen tuşu yaz (ör. "F1").
- Süre ve hotkeyi ayarladıktan sonra hedefi seç:  
  Main (launcher’daki kılıç ikonu) veya Support görünümü (asa ikonu).  
  Hangi pencerede tuş bekleneceğini belirler. İkon her zaman Main penceresinde gösterilir.  
  Böylece RM buffları için timer kurup Main'de yenileme uyarısı gösterebilirsin.


- ![Açıklama](cd_timer/cd_timer_4_de.png)

- Support hedefli timerlar turuncu bir parıltıyla ayrılır.


- ![Açıklama](cd_timer/cd_timer_5_de.png)
:::

:::accordion[Killfeed]
- OCR ile gerçek zamanlı öldürme ve EXP takibi yapar.
- Canavar verisi için gereken API-Fetch: "Monster".

**Özellikler:**
- OCR ile kill tespiti (EXP değişimleri otomatik algılanır)
- Oturum ve toplam istatistikler (kill, EXP, kill/saat, EXP/saat vb.)
- Oyun penceresinde görünen overlay rozetler

**Not:**
- Şu anda sadece 1v1 level kasma destekleniyor.
- Gelecekte AOE ve canavar grubu/boss başına takip planlanıyor.

**Kurulum:**

1. **Henüz yapmadıysan: API verilerini indir**
   - [API-Fetch](action:openPlugin:api-fetch) pluginini aç, **"Monster"** endpointini seç.
   - İndirmeyi başlat. Canavar verisi killleri EXP tablosuna karşı doğrulamak için gerekir.  
     (bkz. API-Fetch dokümantasyonu)
2. **Plugini etkinleştir**
   - Launcher’daki plugin ayarlarında **Killfeed**i aç.  

3. **OCR bölgelerini kalibre et** (profil başına bir kez)
   - Launcher üzerinden "kılıç butonu" ile oyun penceresi başlat.  
   - Yan panelde ROI kalibrasyonunu aç.
   - Oyunda şu alanları çerçevele:
     - **EXP%** – deneyim göstergesi
     - **Level** – seviye
     - **Character name** – karakter adı
   - Bölgeleri kaydet; profil başına tutulur, bir kez yeter.  
   - Sol tıkla ROI'leri sürükleyebilirsin.
   - ROI yerleştirdikten sonra TAB ile sıradaki ROI'yi seç.  
   - Killfeed için ayarla: LVL, NAME, EXP, ENEMY (düşman seviyesi), ENEMY HP
   - "Schließen" veya ESC ile girişten çık.  
   - Çizdikten sonra ROI'ler ince ayar yapılabilir.  
   - Algılanan değerler yan panelde canlı görülür.
   - En kritik olanlar LVL ve EXP; ENEMY ve ENEMY HP şimdilik destekleyici, ileride daha önemli.
   - Canlı OCR'da seviye yanlışsa elle ayarla; elle girilen değer OCR'ın önüne geçer.
   - OCR bir kez EXP'yi "yutarsa" (ör. karakter değişimi), manuel olarak yeniden ayarlayabilirsin;  
     EXP kuralları otomatik düzeltmeyi engelleyebilir.


4. **Yan panelde profil seç**
   - Yan panelde **Killfeed** sekmesini aç.
   - Takip edilecek profili açılır listeden seç.  


5. **Oyna**
   - Canavar kestikçe OCR EXP değişimini algılar.
   - Kill ve istatistikler overlay ve panelde otomatik gösterilir.

**Yan panel:**
- Tek tek rozetleri aç/kapat (Kill/Oturum, EXP/saat, level up'a kalan kill vb.).
- Overlay ölçeği (0.6x–1.6x).
- Rozetlerin kaç satıra yayılacağı.
- Reset butonuyla oturum istatistiklerini sıfırla.
- Her oturumun verisi yerelde saklanır.


- Tespit edilen her kill sidepanel’de gösterilir ve kalıcı olarak kaydedilir.
- Kayıtlar profil bazında AppData altındaki CSV dosyalarına yazılır:
  - `user/plugin-data/killfeed/history/<profile-id>/daily/YYYY-MM-DD.csv` (tekil kill kayıtları)
  - `user/plugin-data/killfeed/history/<profile-id>/history.csv` (günlük özet)
- Monster Tracking accordions içinde her rank için bir `Kills` butonu bulunur.
- `Kills`, seçili rank için tekil kill kayıtlarını liste görünümünde açar.


- Liste görünümünde tekil kill kayıtları silinebilir (`Delete` -> `Confirm`).
- Silme işlemi sidepanel görünümünü ve Killfeed geçmiş dosyalarını (`daily/YYYY-MM-DD.csv` ve `history.csv`) doğrudan günceller.



**Kill sayma kuralları:**
Kill, tüm şu koşullar sağlanınca sayılır:
- Seviye değişmedi (seviye atlama/düşme yok).
- EXP %0.001'den fazla arttı (epsilon eşiği).
- EXP sıçraması en fazla %40 (suspect eşiği); üzeri şüpheli sayılır ve atılır.
- Son 1500 ms içinde düşman HP çubuğu OCR ile görüldü. HP çubuğu yoksa: son kill'den en az 2250 ms geçtiyse kabul edilir.
- API-Fetch canavar verisi varsa: EXP kazancı beklenen değerin %10 ile 10 katı arasında olmalı; dışında ise OCR hatası sayılır.

**Reddedilen EXP değişimleri:**
- Level-up/down: kill sayılmaz.
- EXP düşüşü: yok sayılır (OCR gürültüsü).
- EXP sıçraması > %40: şüpheli, sayılmaz.
- HP çubuğu yok ve son kill'den <2250 ms: sayılmaz.

**Notlar:**
- Kill tespiti için OCR aktif olmalıdır.
- Kill/saat gibi istatistikler 5 dakikalık kayan pencereyle hesaplanır.
:::

:::accordion[Killfeed: Giant Tracker]
# DİKKAT:
## İlk Giant, Violet veya Boss kill kaydı oluşana kadar özelliği göstermek için örnek veriler gösterilir.
---
Giant Tracker, Killfeed eklentisi içinde bağımsız bir penceredir. **Giants**, **Violets** ve **Bosses** için kill istatistiklerini takip eder ve görselleştirir — zaman aralıkları, droplar ve Time to Kill (TTK) dahil. Beş filtre sekmesi (Tümü, Giants, Violets, Bosses, Drops) rütbeye veya kaydedilen droplara göre hedefli filtreleme sağlar.

**Açma:**
- **"Giant Tracker"** düğmesi Killfeed yan panelinde bulunur.
- Tıklandığında takip edilen tüm boss canavarların genel görünümüyle ayrı bir pencere açılır.
- Henüz gerçek kill verisi yoksa örnek veriler gösterilir.

![Açıklama](killfeed_giant_tracker/killfeed_giant_tracker_1_de.png)

---

**Filtreleme ve sıralama:**
- Filtre çubuğu görünümü daraltmaya olanak tanır:
  - **Tümü** / **Giants** / **Violets** / **Bosses** / **Drops** — canavar rütbesine veya droplara göre filtreler.
  - **Bosses** — yalnızca `boss` rütbesindeki canavarları gösterir (ör. Clockworks, Meteonyker). Boss kartlarının kırmızı kenarlığı vardır.
  - **Drops** — yalnızca en az bir kaydedilmiş dropu olan canavarları gösterir. Ek olarak, kartta doğrudan bir loot pool önizlemesi (nadirliğe göre ilk 5 eşya) gösterilir.
  - **Sıralama** — killere (artan/azalan), ada (A–Z / Z–A) veya seviyeye (artan/azalan) göre.
  - **Arama alanı** — kartları canavar adına göre filtreler.

![Açıklama](killfeed_giant_tracker/killfeed_giant_tracker_2_de.png)

---

**Kart görünümleri:**

Takip edilen her canavar bir kart olarak gösterilir. İki görünüm vardır:

*Kompakt kart (varsayılan görünüm):*
- Canavar ikonu, ad, seviye, element, rütbe
- Savaş istatistikleri (HP, ATK)
- Kill özeti: Bugün / Toplam
- TTK gösterimi (ölçüm verisi varsa): `TTK: 45.2s (Ort 52.3s)`
- Son kill (zaman), drop sayısı
- Genişletmek için **"Detaylar"** düğmesi

![Açıklama](killfeed_giant_tracker/killfeed_giant_tracker_3_de.png)

*Genişletilmiş kart (detay görünümü):*
- Kompakt karttaki tüm alanlar
- Zaman aralığına göre kill istatistikleri: Bugün, Hafta, Ay, Yıl, Toplam
- TTK istatistikleri: Ort. TTK, Son TTK, En hızlı
- Drop bölümü: Drop sayısı, ort. kill/drop, son droptan bu yana killer
- Drop geçmişi (katlanabilir): Eşya adı, kill sayacı ve zaman damgasıyla bireysel droplar
- Drop kaydetmek için **"Drop kaydet"** düğmesi
- Detay görünümünü kapatmak için **"Daralt"** düğmesi

![Açıklama](killfeed_giant_tracker/killfeed_giant_tracker_4_de.png)

---

**Drop takibi:**

Genişletilmiş karttaki **"Drop kaydet"** düğmesi bir diyalog açar:
- Canavarın loot poolunu gösterir (canavar verileri API-Fetch ile indirildiyse).
- Eşyalar ada göre aranabilir ve nadirliğe göre filtrelenebilir (Sıradan, Sıra dışı, Nadir, Çok nadir, Eşsiz, Nihai).
- Bir eşyaya tıklamak, geçerli zaman damgası ve kill sayacı ile dropu kaydeder.
- Daha önce kaydedilmiş droplar geçmişten tek tek silinebilir.

![Açıklama](killfeed_giant_tracker/killfeed_giant_tracker_5_de.png)
![Açıklama](killfeed_giant_tracker/killfeed_giant_tracker_6_de.png)

---

**Time to Kill (TTK):**

TTK, bir boss canavara karşı savaş süresini otomatik olarak ölçer — ilk vuruştan kill'e kadar.

*İşleyiş:*
- **Başlangıç:** Düşman HP çubuğu `mevcut < maks` ile algılanır (savaş başladı).
- **Bitiş:** Kill, EXP algılaması ile doğrulanır. Biriken savaş süresi kaydedilir.
- **Duraklatma:** HP çubuğu kaybolur (ör. buff veya iyileştirme için hedef değiştirme). 10 saniyelik bir tolerans süresi başlar.
- **Devam:** Aynı boss canavar 10 saniye içinde yeniden hedeflenirse, zamanlayıcı devam eder. Duraklama süresi TTK'ya sayılmaz.
- **İptal:** Tolerans süresi boss yeniden hedeflenmeden sona ererse, TTK ölçümü iptal edilir.

*Hedef tanımlama:*
- Savaş başlangıcında canavar adı ve maks HP kaydedilir.
- Yeniden hedeflemede ad ve maks HP karşılaştırılır — yalnızca eşleşirse zamanlayıcı devam eder.
- Farklı bir boss canavar hedeflenirse, mevcut ölçüm iptal edilir ve yeni bir ölçüm başlar.
- Normal bir canavar hedeflenirse, boss zamanlayıcısı duraklar; normal killer sayılmaya devam eder.

*Gösterim ve istatistikler:*
- Kompakt kart: `TTK: [son kill] (Ort [ortalama])`
- Genişletilmiş kart: Ort. TTK, Son TTK, En hızlı
- TTK değerleri CSV geçmişinde kill başına kaydedilir (`TTK_ms` sütunu) ve canavar başına toplanır.

*Sınırlama:*
- TTK ölçümü yalnızca Giants, Violets ve Bosses için aktiftir. Normal canavarlar ölçülmez.
- Doğruluk OCR örnekleme hızına bağlıdır (tipik: her 500–1000 ms).

---

**Veri kaynakları:**
- Kill verileri Killfeed CSV geçmişinden gelir (`daily/YYYY-MM-DD.csv`).
- Drop kayıtları profil başına ayrı saklanır.
- Canavar detayları (ikon, HP, ATK, loot pool) API-Fetch ile indirilen canavar verilerinden gelir.

:::

:::accordion[Görev Rehberi]
- Seviye, bölge ve türe göre filtrelenmiş mevcut görevleri gösterir — zincir görselleştirmesi ve profil başına ilerleme takibi ile.
- Gerekli API-Fetch'ler: **Quest**, **NPC**, **Monster**, **Item**

**Kurulum:**
1. **Quest Guide** eklentisinin etkin olduğundan emin olun.
2. Gerekli API verilerini API-Fetch aracılığıyla indirin (Quest, NPC, Monster, Item).
3. Yan panelde **Quest Guide** sekmesini seçin.

**Filtreler ve arama:**
- **Arama alanı** — görev adı, NPC veya öğeye göre filtreler
- **Seviye modu:**
  - *OCR ±* — şu anda OCR ile algılanan seviyeye uyan görevleri gösterir (ayarlanabilir tolerans, varsayılan: ±5)
  - *Manuel* — seviye ve toleransı manuel olarak girin
  - *Min–Maks* — sabit bir seviye aralığı belirleyin (varsayılan: 1–30)
- **Bölge** — görüntülemeyi belirli bir oyun bölgesiyle sınırlar
- **Tür filtresi** — Tümü / Zincir / Günlük / Tekrarlanabilir / Kategori
- **Alt kategori** — Tekrarlanabilir görevler için: Evcil Hayvanlar, Koleksiyon, Canavar Avı, Teslimat, Diğer

**İlerleme takibi:**
- Görevleri tamamlandı olarak işaretle — ilerleme profil başına kaydedilir
- „Tamamlananları göster" onay kutusu ile göster/gizle
- „Kullanılamayanları göster" onay kutusu ile göster/gizle
- Sıfırlama düğmesi ilerlemeyi sıfırlar

**İstatistik çubuğu:**
Toplam, mevcut ve tamamlanmış görev sayısını bir bakışta gösterir.

**Görev haritası:**
- Yan paneldeki harita düğmesi ile görev konumlarını gösteren interaktif bir harita açar.

![Açıklama](quest_guide/quest_guide_sidepanel_de.png)
![Açıklama](quest_guide/quest_guide_map_de.png)
:::

## Araçlar

Araçlar kısayol ile veya sekme çubuğundaki yıldız menüsünden açılır.

:::accordion[Fcoin <-> Penya]

![Açıklama](tools/fcoin_zu_penya/fcoin_zu_penya_1.png)
- FCoins'i Penya'ya ve tersine çevirir.
- Güncel Penya/FCoin kurunu gir. Kur kaydedilir ve otomatik yüklenir.
- FCoin miktarını veya Penya sonucunu değiştir, hesaplama çift yönlü güncellenir.

![Açıklama](tools/fcoin_zu_penya/fcoin_zu_penya_2.png)

:::

:::accordion[Premium Alışveriş Listesi]
- Premium mağaza alışverişini planlama aracı; FCoin almadan önce ihtiyacı hesaplamak için. Pop-up'lar izinli olmalı.
- Gereksinim: API-Fetch endpoint **"Item"** (ikonlarla). Bunlar yoksa arama boş kalır.
![Açıklama](tools/premium_shopping_list/premium_shopping_list_1.png)
- Kullanım:
  1. Yıldız menüsünden aracı aç ve arama kutusuna item adı yaz.
  2. Sonuç listesi (max 20) ikon, ad ve kategoriyi gösterir; **"+ Add"** ile ekle veya miktarı artır.  
  ![Açıklama](tools/premium_shopping_list/premium_shopping_list_2.png)
  3. Listede fiyatı (FCoins) ve miktarı ayarla; fiyat alandan çıkınca kaydedilir ve sonraki aramalarda otomatik doldurulur.
  4. Checkbox tamamlanan/alışverişi yapılan itemi işaretler, "X" satırı siler.
  5. Alt çubuk tüm girdilerin toplamını (`fiyat × miktar`) FCoins olarak gösterir.
- Saklama: fiyatlar launcher veri klasöründe kalıcıdır (`%APPDATA%/Flyff-U-Launcher/item-prices.json`); listenin kendisi her oturumda sıfırdan başlar.

:::

:::accordion[Yükseltme Maliyet Hesaplayıcı]

+0'dan +10'a kadar item yükseltmeleri için beklenen maliyetleri hesaplar — gerekli malzemeler, deneme sayısı ve farklı koruma sistemleri arasındaki karşılaştırma dahil.

![Açıklama](tools/upgrade_cost_calc/upgrade_cost_calc_1.png)

**Ayarlar:**

- **Zar Türü:** Powerdice 4/6 (standart) veya Powerdice 12 (daha yüksek başarı şansı)
- **Seviyeden / Seviyeye:** Yükseltme aralığını belirle (örn. +3 → +7)
- **Mod:**
  - **Karşılaştır** – Her iki koruma sisteminin maliyetlerini yan yana gösterir
  - **S-Protect** – Normal S-Protect scrolları ile hesaplar
  - **S-Protect (Low)** – Daha ucuz Low S-Protect scrolları ile hesaplar

**Malzeme Fiyatları:**

„Malzemeler" altında şu itemler için güncel piyasa fiyatlarını ayarlayabilirsin:
- Mineral
- Eron
- S-Protect
- Low S-Protect
- Powerdice 4, 6, 12

„Sahip" onay kutusu ile malzemeler maliyet hesaplamasından çıkarılır.

![Açıklama](tools/upgrade_cost_calc/upgrade_cost_calc_2.png)

**Sonuç:**

„Hesapla" butonuna tıkladıktan sonra her yükseltme seviyesi için detaylı bir tablo görünür:

| Sütun | Anlamı |
|-------|--------|
| Seviye | Hedef yükseltme seviyesi |
| Şans | Başarı şansı yüzde olarak |
| Deneme | Beklenen deneme sayısı |
| Mineral | Gerekli mineraller |
| Eron | Gerekli eronlar |
| Penya | Penya maliyetleri |
| Korumalar | Gerekli koruma scrolları |
| Toplam Maliyet | Tüm maliyetlerin toplamı Penya olarak |

![Açıklama](tools/upgrade_cost_calc/upgrade_cost_calc_3.png)

Karşılaştırma modunda her iki koruma sistemi (S-Protect vs. S-Protect Low) yan yana gösterilir. Daha ucuz seçenek yeşille vurgulanır.

**Saklama:** Fiyatlar ve ayarlar otomatik olarak kaydedilir (`%APPDATA%/Flyff-U-Launcher/user/tools/upgrades/upgrade_cost_calc.json`).

:::

:::accordion[Duyurular]

Launcher'ın sağ panelinde geliştiriciden gelen mesajlar görüntülenir — uygulama güncellemesi gerekmez. Örnekler: bilinen hatalar, güncel geliştirmeler veya planlanan özellikler. Görüntüleme Almanca ve İngilizce olarak mevcuttur ve ayarlardan devre dışı bırakılabilir.

![Açıklama](announcements/announcements_de.png)
:::

:::accordion[Mesajlar ve Hata Günlüğü (Loglar)]

Sekme çubuğundaki **log simgesi** hata günlüğü ile ayrı bir pencere açar.

**Özellikler:**
- Tüm uyarı ve hata mesajlarını zaman damgası ile görüntüler: `[SS:DD:SN] [SEVİYE] [MODÜL] Mesaj`
- **Sil** — Tüm log girişlerini kaldır
- **Kaydet** — Logları `.txt` dosyası olarak dışa aktar (`user/logs/` altında)
- **Mesaj gönder** — Logları doğrudan geliştiriciye (Discord) gönder
  - İsteğe bağlı: açıklama ve oyun içi/Discord adı ekle
  - Yanlışlıkla birden fazla gönderimi önlemek için 60 saniyelik bekleme süresi

![Açıklama](logs/logs_window_de.png)
:::

:::accordion[Güncelleme Kontrolü ve Sürüm Geri Alma]

**Otomatik güncellemeler:**
- Launcher başlangıçta yeni bir sürümün mevcut olup olmadığını kontrol eder (ayarlardan yapılandırılabilir).
- Bir güncelleme mevcutsa, indirme seçeneği ile bir iletişim kutusu gösterilir.
- İndirme sırasında ilerleme yüzde çubuğu olarak görüntülenir.
- İndirmeden sonra güncelleme bir sonraki yeniden başlatmada yüklenir.

**Manuel kontrol:**
- **Ayarlar → Davranış** altında **„Şimdi kontrol et"** düğmesi bulunur.

**Sürüm geri alma:**
- Eski launcher sürümleri (3.0.5'ten itibaren) doğrudan ayarlardan yüklenebilir.
- Açılır menü, tarih ve mevcut sürüm işaretçisi ile tüm mevcut GitHub sürümlerini gösterir.
- Bir sürüm seçildikten sonra indirilir ve yeniden başlatmada yüklenir.

![Açıklama](settings/settings_update_de.png)
:::

:::accordion[RAM Göstergesi]

**Ayarlar → Görüntüleme → „RAM kullanımını göster"** altında sekme çubuğunda bir bellek göstergesi etkinleştirilebilir.

**Özellikler:**
- Toplam bellek kullanımını MB cinsinden gösterir.
- Tıklandığında ayrıntılı bir döküm açılır:
  - Profil başına bellek kullanımı
  - Eklentilerin bellek kullanımı (paylaşımlı olduğundan tahmini)
  - Sistem yükü (launcher + OCR)

![Açıklama](ram/ram_display_de.png)
:::
