# 📦 Yama Notları

---

## 🆕 Sürüm 2.3.0

### 🐛 Düzeltmeler

- OCR değerleri (yan panel) artık oyun ayrı bir çoklu pencere oturumunda çalışırken doğru algılanıyor
- ROI kalibrasyonu artık yanlışlıkla yeni bir oturum açmıyor, mevcut oyun penceresini kullanıyor

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
- Overlay’ler “Kapat” ve “Yerleşim seç” gibi diyaloglarda görünüyor
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
