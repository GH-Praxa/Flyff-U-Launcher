# 📦 Yama Notları

---

## 🆕 Sürüm 2.5.1

### 🆕 Yeni Özellik: Giant Tracker
Killfeed eklentisindeki bağımsız pencere — **Giants**, **Violets** ve **Bosses** için kill istatistiklerini toplar ve görselleştirir.

**Filtre Sekmeleri**
- 5 sekme: **Tümü** · **Giants** · **Violets** · **Bosses** · **Drops**
- **Bosses** — `boss` rütbesine göre filtreler (kırmızı kart kenarlığı, özel ikon stili)
- **Drops** — yalnızca drop kaydı olan canavarları gösterir; kart içinde loot havuzu önizlemesini (nadirliğe göre ilk 5 eşya) içerir

**Kill İstatistikleri**
- Compact ve Expanded modlu kart görünümü
- Zaman aralıkları: Bugün, Hafta, Ay, Yıl, Toplam
- Canavar bilgisi: İkon, Ad, Seviye, Element, Rütbe, HP, ATK

**Drop Takibi**
- Canavarın loot havuzundan drop kaydı (nadirlik filtresiyle)
- Canavar başına drop geçmişi: eşya adı, kill sayacı değeri, zaman damgası
- İstatistikler: Ø kill/drop, son droptan beri kill

**Time to Kill (TTK)**
- Giants, Violets ve Bosses için savaş süresini otomatik ölçer
- Hedef seçimi kaldırıldığında 10 sn tolerans (buff, heal vb.) — duraklama süresi TTK'ye dahil edilmez
- Canavar adı + maksimum HP parmak izi: hedef güvenilir şekilde yeniden tanınır
- Gösterim: Son TTK, Ø TTK, En Hızlı
- Kill geçmişine kalıcı kaydedilir (CSV sütunu `TTK_ms`)

**Diğer**
- Kill sayısına, ada veya seviyeye göre sıralama
- Canavar adına göre filtreleme için arama alanı

### ✨ Ek İyileştirmeler
- Killfeed: canavar algılama iyileştirildi
- Yeni kimliklendirme ağırlığı: Canavar HP > Canavar Seviyesi > Canavar Elementi
- Killfeed: canavar takibi artık öldürülen mobları sayıyor
- Killfeed: geçmiş eklendi (profil bazında)
  - Tarih başına tekil kill kayıtlarını içeren günlük dosya (`Tarih/Saat`, `Karakter`, `Seviye`, `Monster-ID`, `Rütbe`, `Canavar`, `Element`, `EXP Artışı`, `Beklenen EXP`, `TTK_ms`)
  - `Kills`, `Toplam EXP`, `Canavar Dağılımı`, `İlk/Son Kill` içeren günlük toplu özet
- Killfeed: yan paneldeki canavar takibi artık kill sonrası hemen güncelleniyor (sekme değiştirmek gerekmiyor)
- Killfeed: canavar takip akordeonlarında artık her rütbe için tekil kill ListView'ını açan bir Kills düğmesi var.
  Tekil kill kayıtları doğrudan ListView içinden silinebilir.
  Tekil kill silindiğinde AppData geçmiş dosyaları (daily/YYYY-MM-DD.csv, history.csv) ve yan panel durumu güncellenir.
- Killfeed: yan panel artık overlay hedef profilini stabil şekilde takip ediyor (profil ID'leri arasında atlama yok)
- Canavar referans verileri güncellendi
- "Yerleşim seç" iletişim penceresi tasarımı iyileştirildi
- "Profilleri yönet (çıkış yap)" iletişim penceresi tasarımı iyileştirildi

### 🐛 Hata Düzeltmeleri
- Overlay'ler artık kapatma iletişim penceresinin üstüne binmiyor
- Dokümantasyondaki akordeonlar artık doğru şekilde görüntüleniyor
- Sürüm 2.3.0'dan yeni AppData yapısına (`user/`) geçiş artık güvenilir şekilde çalışıyor
- Killfeed: negatif OCR EXP sıçramaları artık OCR gürültüsü olarak filtreleniyor ve kill algılamasını bozmuyor

### 🧹 Temizlik
- Renderer mimarisi modülerleştirildi (dahili yeniden yapılandırma)
- Dahili veri klasörü `api_fetch/`, `cache/` olarak yeniden adlandırıldı
- AppData dizin yapısı yeniden düzenlendi: veriler artık AppData\Roaming\Flyff-U-Launcher\user alt klasöründe tutuluyor
- Otomatik geçiş: mevcut veriler ilk açılışta kesintisiz şekilde taşınıyor — ilerleme göstergesiyle birlikte
- Statik veriler (referans verileri dahil) build içine gömülüyor, böylece release build'lerinde güvenilir şekilde kullanılabiliyor
- Konsolun daha okunabilir olması için Killfeed/overlay debug logları azaltıldı

:::accordion[Yeni Depolama Yolları]
Tüm kullanıcı verileri artık `%APPDATA%\Flyff-U-Launcher\user\` altında bulunur:

- `user/config/settings.json` — İstemci ayarları
- `user/config/features.json` — Özellik bayrakları
- `user/profiles/profiles.json` — Başlatıcı profilleri
- `user/profiles/rois.json` — ROI kalibrasyonları
- `user/profiles/ocr-timers.json` — OCR zamanlayıcıları
- `user/ui/themes.json` — Temalar
- `user/ui/tab-layouts.json` — Sekme düzenleri
- `user/ui/tab-active-color.json` — Aktif sekme rengi
- `user/shopping/item-prices.json` — Premium alışveriş listesi fiyatları
- `user/plugin-data/` — Eklenti ayarları
- `user/plugin-data/killfeed/history/<profile-id>/history.csv` — Profil başına Killfeed günlük özeti
- `user/plugin-data/killfeed/history/<profile-id>/daily/YYYY-MM-DD.csv` — Kill ve gün bazında Killfeed ayrıntılı geçmişi
- `user/cache/` — API fetch verileri ve ikonlar
- `user/logs/` — Tanılama günlükleri
:::

---

## 🆕 Sürüm 2.3.0

### 🐛 Düzeltmeler

- OCR değerleri (yan panel) artık oyun ayrı bir çoklu pencere oturumunda çalışırken doğru algılanıyor
- ROI kalibrasyonu artık yanlışlıkla yeni bir oturum açmıyor, mevcut oyun penceresini kullanıyor
- OCR artık güvenilir şekilde dahili Tesseract'ı kullanıyor — ayrı bir kurulum artık gerekli değil

### ✨ İyileştirmeler

- Dokümantasyon akordeonları artık yerel HTML5 öğelerini kullanıyor (JavaScript artık gerekli değil)

---

## 🆕 Sürüm 2.2.0

### ➕ Yeni Özellikler

**Yerleşimler**
- Yerleşim özelliği elden geçirildi, desteklenen oyun görünümleri:
  - 1x1 tek pencere
  - 1x2 bölünmüş ekran
  - 1x3, 1x4, 2x2, 3+2, 2x3, 4+3, 2x4 çoklu ekran
- Oyun ekranları açılırken ilerlemeyi gösteren ilerleme çubuğu sekme çubuğuna eklendi
- Çoklu pencere sistemi: birden fazla bağımsız oturum penceresi açılabilir

**Kısayollar** — serbest atanabilir tuş kombinasyonları (2-3 tuş)
- Overlay'leri gizle
- Yan panel aç/kapat
- Sekme çubuğu aç/kapat
- Aktif pencerenin ekran görüntüsünü `C:\Users\<USER>\Pictures\Flyff-U-Launcher\` klasörüne kaydet
- Önceki sekme / Sonraki sekme
- Sonraki pencere örneği
- CD zamanlayıcısını 00:00’a sıfırla, ikonlar tık bekler
- FCoins hesaplayıcısını aç
- Premium alışveriş listesini aç

**Yeni İstemci Ayarları**
- Launcher genişliği / yüksekliği
- Grid sekmelerini sırayla yükle
- Yerleşimler için sekme gösterimi
- Aktif grid görünümünü vurgula
- Değişikliklerde yerleşimleri güncelle
- Durum mesajı süresi
- FCoins döviz kuru
- Sekme yerleşimi görüntü modu (Kompakt, Gruplu, Ayrı, Mini-grid)

**Menüler ve Araçlar**
- Sekme çubuğuna yeni “Araçlar (yıldız simgesi)” menüsü eklendi.
  Menü tarayıcı görünümünü gizler, karakterler oturumda kalır.
  - Dahili araçlar: FCoins → Penya hesaplayıcı, Premium alışveriş listesi
  - Harici bağlantılar: Flyff Universe ana sayfası, Flyffipedia, Flyffulator, Skillulator
- Sekme çubuğunda yeni “Klavye” menüsü ayarlanmış kısayolları gösterir.
  Menü tarayıcı görünümünü gizler, karakterler oturumda kalır.

**Dokümantasyon**
- Ayarlar menüsüne çok dilli açıklamalar içeren yeni “Dokümantasyon” sekmesi eklendi:
  - Profil oluştur, yerleşim oluştur, veri yolları ve kalıcılık, API fetch,
    CD zamanlayıcı, killfeed, FCoins <-> Penya, Premium alışveriş listesi
- Metin mevcut tüm dillere çevrildi. Bazı görseller henüz yok.
  Yedek: İngilizce arayüz → Almanca arayüz.

**Diğer**
- Yeni “Steel Ruby” teması eklendi
- Launcher, haber akışının altında zaten açılmış profillerin listesini gösterir
- Ayarlar → Destek bölümüne bağış özelliği eklendi
- Çoklu sekme kapatma diyaloguna “Tekil sekmelere ayır” seçeneği eklendi
- Halihazırda oturum açıkken bir profil açıldığında, mevcut pencereye ekleme veya yeni pencere oluşturma sorulur

### 🧹 Temizlik

- Launcher penceresinin artık bir minimum boyutu var ve o sınıra kadar duyarlı
- Varsayılan pencere boyutu 980×640’tan 1200×970’e değiştirildi
- Ayarlar menüsüne “X” düğmesi eklendi
- Ayarlar penceresinin boyutu ayarlandı
- Profiller ve yerleşimler için “Yönet” menüsü değiştirildi; artık “Yeniden adlandır” ve “Sil” içeriyor
- Yerleşim seçiminde “Profil” düğmesi eklendi; yerleşimdeki profilleri gösterir
- Sekme çubuğunu büyütme düğmesine simge eklendi
- Kapatma diyalogunda aktif sekme vurgulandı

### 🐛 Düzeltmeler

- Sekme değiştirirken oyunun gizlenmesine yol açan hata düzeltildi

### 🐛 Bilinen Hatalar

- Yan paneldeki metin girişleri bazen doğru iletilmiyor
- Overlay’ler “Kapat” ve “Yerleşim seç” gibi diyaloglarda görünüyor — 2.4.1’de düzeltildi ✅
- Yan panel pencere modunda gösterilmiyor


---

## 🆕 Sürüm 2.1.1

### ✨ İyileştirmeler

- Overlay’ler artık harici pencereleri kaplamıyor.
  Pencere etkin değilse otomatik gizleniyorlar.
- Pencere taşınırken overlay’lerin titremesi düzeltildi.
  Hareket sırasında da doğru şekilde gizleniyorlar.
- Yerleşimdeki son sekme, bölünmüş ekran açılmadan önce yeterli yükleme süresi alıyor.
- Çıkış diyalogundaki tüm işlemler (İptal hariç) artık tehlikeli düğme (kırmızı) olarak işaretli.
  “İptal” kasıtlı olarak nötr bırakıldı.
- Ayarlar menüsüne yama notları sekmesi eklendi.
  Görüntüleme seçili dilde yapılır.

### ➕ Yeni Özellikler

- CD zamanlayıcısının sonuna “+” düğmesi eklendi

### 🧹 Temizlik

- Simge diyalogundaki kullanılmayan sekme kaldırıldı
- Sağ üstteki kullanılmayan “RM-EXP” rozeti kaldırıldı

---

## 🔄 Sürüm 2.1.0

### 🚀 Yenilikler

- Güncellemeler artık doğrudan launcher üzerinden yapılabiliyor

---

## 🔄 Sürüm 2.0.2

### 🐛 Düzeltmeler

- Yan panelin boş görünmesine neden olan hata düzeltildi
- Çeviri hataları düzeltildi
