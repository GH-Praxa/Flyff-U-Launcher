## Temel Özellikler

:::accordion[Profil oluştur]

- Üst başlıktaki **"Yeni Profil"** butonuna tıkla.

![Açıklama](create_profil/create_profil_1_tr.png)

- Profil adı gir ve **"Ekle"**ye tıkla.

![Açıklama](create_profil/create_profil_2_tr.png)

- Dişli simgesine tıklayarak profil ayarlarını aç.

![Açıklama](create_profil/create_profil_3_tr.png)

Bu menüde şunları yapabilirsin:

- profil adını değiştirmek,
- bir sınıf seçmek (profil amblemini belirler, arama filtresi olarak da kullanılabilir),
- profilin aynı anda birden fazla açılıp açılamayacağını belirlemek.

**"Sekmelerde kullan"** açıkken profil aynı anda birden çok kez kullanılabilir; kapalıysa tek pencerede açılır.

Her iki seçeneğe de ihtiyaç duyuyorsan, profili kopyala: biri açık, biri kapalı.  
Not: Aynı profil için aynı anda sadece tek bir varyant kullanılabilir.

![Açıklama](create_profil/create_profil_4_tr.png)

İstediğin kadar profil oluşturabilirsin. Her profil kendi Flyff oturumunu saklar.  
Oyundaki ayarlar tarayıcıdaki gibi diğer oturumlara aktarılmaz.
:::

:::accordion[Layout oluştur]

- Oluşturduğun profilin sekmesinde **"Oyna"**ya tıkla. Profilin sekmelerde kullanıma izin verdiğinden emin ol.  
![Açıklama](create_layout/create_layout_1_tr.png)

- İstediğin layout gridini seç.  
![Açıklama](create_layout/create_layout_3.png)

- Her hücre için bir profil seç ve **"İleri"**ye tıkla.  
![Açıklama](create_layout/create_layout_4_tr.png)

- **"+"** ile ek layout sekmeleri oluştur.  
![Açıklama](create_layout/create_layout_5.png)

- Layoutu kaydet, böylece launcher'dan başlatabilirsin.  
![Açıklama](create_layout/create_layout_6.png)  
![Açıklama](create_layout/create_layout_7.png)

- Sekmeler sağ tıkla yeniden adlandırılabilir.
- Sekmeler sıralı veya aynı anda yüklenebilir.  
  -> Ayarlar / Client Settings / Grid sekmelerini sıralı yükle
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
   ![Açıklama](killfeed/killfeed_1_de.png)

3. **OCR bölgelerini kalibre et** (profil başına bir kez)
   - Launcher üzerinden "kılıç butonu" ile oyun penceresi başlat.  
    ![Açıklama](killfeed/killfeed_2_de.png)
   - Yan panelde ROI kalibrasyonunu aç.
   - Oyunda şu alanları çerçevele:
     - **EXP%** – deneyim göstergesi
     - **Level** – seviye
     - **Character name** – karakter adı
   - Bölgeleri kaydet; profil başına tutulur, bir kez yeter.  
    ![Açıklama](killfeed/killfeed_3_de.png)
   - Sol tıkla ROI'leri sürükleyebilirsin.
   - ROI yerleştirdikten sonra TAB ile sıradaki ROI'yi seç.  
    ![Açıklama](killfeed/killfeed_4_de.png)
   - Killfeed için ayarla: LVL, NAME, EXP, ENEMY (düşman seviyesi), ENEMY HP
   - "Schließen" veya ESC ile girişten çık.  
    ![Açıklama](killfeed/killfeed_5_de.png)
   - Çizdikten sonra ROI'ler ince ayar yapılabilir.  
    ![Açıklama](killfeed/killfeed_6_de.png)
   - Algılanan değerler yan panelde canlı görülür.
   - En kritik olanlar LVL ve EXP; ENEMY ve ENEMY HP şimdilik destekleyici, ileride daha önemli.
   - Canlı OCR'da seviye yanlışsa elle ayarla; elle girilen değer OCR'ın önüne geçer.
   - OCR bir kez EXP'yi "yutarsa" (ör. karakter değişimi), manuel olarak yeniden ayarlayabilirsin;  
     EXP kuralları otomatik düzeltmeyi engelleyebilir.
   - ![Açıklama](killfeed/killfeed_7_de.png)


4. **Yan panelde profil seç**
   - Yan panelde **Killfeed** sekmesini aç.
   - Takip edilecek profili açılır listeden seç.  
    ![Açıklama](killfeed/killfeed_8_de.png)


5. **Oyna**
   - Canavar kestikçe OCR EXP değişimini algılar.
   - Kill ve istatistikler overlay ve panelde otomatik gösterilir.

**Yan panel:**
- Tek tek rozetleri aç/kapat (Kill/Oturum, EXP/saat, level up'a kalan kill vb.).
![Açıklama](killfeed/killfeed_9_de.png)
- Overlay ölçeği (0.6x–1.6x).
- Rozetlerin kaç satıra yayılacağı.
![Açıklama](killfeed/killfeed_10_de.png)
- Reset butonuyla oturum istatistiklerini sıfırla.
- Her oturumun verisi yerelde saklanır.

![Açıklama](killfeed/killfeed_11_de.png)


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
