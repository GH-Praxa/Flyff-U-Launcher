# 📦 Yama Notları

---
## 🆕 Sürüm 3.5.0

### ✨ Kumanda — yeni varsayılanlar ve yapılandırılabilir fare modu

Android uygulamasıyla (v33) eş zamanlı olarak, PC launcher aynı kumanda iyileştirmelerini alıyor:

**Yeni D-pad varsayılanları**
- D-pad ↑/↓ → **Yakınlaştır / Uzaklaştır** (ekran ortasında sentetik fare tekerleği)
- D-pad ←/→ → **Sekme geçişi** (`@prevTab`/`@nextTab`)
- D-pad-yukarı önceden action-pad için sabitlenmişti — `@actionPad` artık bir tuşa açıkça atanmalı (örn. Select)

**Fare modu (imleç) artık yapılandırılabilir**
- L2 önceden „imleç modu için ayrılmış" olarak sabitlenmişti; artık bu özel bir eylem `@cursorHold` (L2 için varsayılan)
- `@cursorHold` basılı tutulurken: sağ çubuk sentetik fare imlecini hareket ettirir, A tuşu = mevcut konumda sol fare tıklaması
- Alternatif `@cursorToggle`: dokunmak normal mod ile imleç modu arasında geçiş yapar
- Her ikisi de herhangi bir tuşa atanabilir — L2'yi yetenek slotu olarak istiyorsanız, imleç modunu örn. R2 veya L1'e atayın
- L2 artık modifier-katman slotu olarak da kullanılabilir (önceden hariç tutulmuştu)

---
## 🐛 Sürüm 3.4.1

### 🐛 Hata düzeltmeleri

**Aynı anda birden fazla yerleşim penceresi**
- Kaydedilmiş bir yerleşimde „Play" artık **ek** bir pencere açar — çalışan pencere açık kalır
- Pencere başlığı yerleşimin adını gösterir
- Bir profil zaten başka bir pencerede açıksa, hücre „Pencereye geç" düğmeli bir not gösterir — ikinci giriş yok, karakter kovulmaz

🙏 Ayrıntılı hata raporu için **@ODevil97**'a teşekkürler (GitHub)

---
## 🆕 Sürüm 3.4.0

### ✨ Yeni Özellikler

**Özel Düzen (Custom)**
- Düzen seçicisinde yeni düzen türü "Özel" — 1–8 BrowserView'ın bireysel konum ve boyutla serbest yerleşimine olanak tanır
- Sürükle ve bırak ile görsel editör: Hücreleri bir tuval (16:9) üzerinde konumlandırın ve köşe/kenar tutamaçlarıyla yeniden boyutlandırın
- Ayarlanabilir ızgara (snap): Taşıma ve ölçeklendirmede %1, %5 veya %10 hassasiyet
- İsteğe bağlı kaydırıcı çizgisi (yatay veya dikey) ile çalışma zamanında bölünme ayarı
- Üst üste binen hücreler yığılır (en üstteki hücre girişleri alır)
- Kaydedilen özel düzenler, gerçek hücre yerleşimine dayalı dinamik bir ASCII önizleme gösterir

**1×3 Düzenler için Ayarlanabilir Kaydırıcı**
- 1×3 düzenindeki (row-3) orta pencere kaydırıcı ile yeniden boyutlandırılabilir — yan pencereler kalan alanı eşit olarak paylaşır

### ⚙️ İyileştirmeler

- Belgeler özel düzen editörü ile genişletildi (tüm 8 dil)

### 🐛 Hata Düzeltmeleri

- **Yazı Tipleri**: Paketlenmiş yazı tipleri (Josefin Sans, Roboto, Open Sans vb.) oyun tarayıcılarına doğru şekilde uygulanmıyordu; `@font-face` artık author origin'de yükleniyor
- **Giriş**: Facebook ve Apple ile giriş sonsuz yükleniyordu

---
## 🐛 Sürüm 3.3.0

### 🐛 Hata Düzeltmeleri

- **Sürüm Geri Alma**: Eski bir sürüme geri dönüş "TypeError: this.currentVersion.format is not a function" hatasıyla başarısız oluyordu — güncelleme işleyicisi dahili sürüm verilerini sürüm nesnesi yerine düz bir dize ile yanlışlıkla üzerine yazıyordu
- **Sürüm Geri Alma**: Belirli bir eski sürümün seçilmesi her zaman en son sürümü buluyordu — artık hedef sürümün varlıkları için doğrudan URL kullanılıyor, böylece mevcut herhangi bir sürüm yüklenebilir

---
## 🆕 Sürüm 3.2.0

### ⚙️ İyileştirmeler

- **Quest Guide: EXP gösterimi** — EXP değerleri 4 ondalık basamakla yüzde olarak gösterilir; OCR seviyesi her zaman EXP hesaplaması için kullanılır, seviye modu yalnızca görev filtrelemesini kontrol eder

### 🐛 Hata Düzeltmeleri

- **API-Fetch**: Endpoint seçimi (onay kutuları) görmezden geliniyordu — IPC işleyicilerinde eksik parametre düzeltildi
- **API-Fetch**: Dünya haritası karoları (`tile_grid`) artık doğru şekilde indiriliyor
- Hata raporları artık mevcut günlük girişleri olmadan da gönderilebilir
- Hata günlüğü gönder butonu artık gönderdikten sonra geri bildirim gösteriyor

---
## 🐛 Sürüm 3.1.1

### 🐛 Hata Düzeltmeleri

- Paketlenmiş derlemede Sidepanel arayüzü tamamen bozulmuş (beyaz arka plan, eksik stiller) — Content Security Policy geçici HTML dosyalarındaki inline stilleri engelliyordu

---
## 🆕 Sürüm 3.1.0

### ✨ Yeni Özellikler

**Yeni Düzen Türleri**
- Dikey düzenler: 2x1, 3x1, 4x1 (görünümler alt alta)
- Asimetrik düzenler: Ana pencere + 2–3 yan pencere sağda (`main-r2`, `main-r3`) veya altta (`main-b2`, `main-b3`)
- Asimetrik düzenlerin bölünmesi kaydırıcı ile ayarlanabilir (min %20 / maks %80)
- ASCII önizlemeli düzen seçici: Üzerine gelindiğinde düzenin bir diyagramı gösterilir

**Profil Dışa/İçe Aktarma**
- Profiller `.flyffprofile` dosyası olarak dışa ve içe aktarılabilir
- Profil meta verileri, Electron oturum çerezleri ve localStorage verilerini içerir
- Bilgisayarlar arası yedekleme ve transfer imkanı sağlar

**Karakter Adları & Meslekler (Karakter Başına)**
- Karakter adları ve meslekleri profilde karakter bazında kaydedilebilir — Profil listesinde meslek ikonlu rozetler olarak gösterilir, filtrelenebilir ve eklentilerde açılır kutu ile seçilebilir

**Launcher Duyuruları**
- Sağ panelde yeni bölüm: uygulama güncellemesi gerektirmeden geliştiriciden mesajlar gösterir — ör. bilinen hatalar, güncel gelişmeler veya planlanan özellikler; Almanca ve İngilizce mevcut, ayarlardan devre dışı bırakılabilir
- Sağ paneldeki açık profiller açılıp kapatılabilir

**Yazı Tipi Ayarı**
- İstemci ayarlarında yeni "Overlay ve UI yazı tipi" ayarı — mevcut yazı tipleri: Josefin Sans, Roboto, Open Sans, Lato, Montserrat, Raleway, Nunito, Ubuntu, Cinzel; yazı tipi Launcher overlay'lerine ve oyun içi DOM tabanlı UI öğelerine uygulanır

**Yazı Boyutu Ayarı**
- Yeni ayar "Launcher yazı boyutu": Launcher penceresindeki metin boyutu ölçeklenebilir (%75–%150), oyun içinde geçerli değildir

**Hata Günlüğü & Geliştiriciye Mesaj**
- Günlük penceresi Sidepanel'den sekme çubuğuna taşındı — hata günlüklerini görüntüleme, kaydetme ve silme ile geliştiriciye mesaj gönderme imkanı sağlar (gösterilen hatalar birlikte gönderilir); 60 saniyelik bekleme süresi

**Quest Guide Eklentisi**
- Sidepanel'de yeni eklenti: başlangıç/bitiş NPC'si, görev ve ödülleri ile harita işaretçisi içeren görevleri gösterir — görev, NPC, canavar ve eşya verileri API-Fetch ile gereklidir

**Birleşik Yükseltme Hesaplayıcı**
- Yükseltme hesaplayıcı silah, takı, zırh delme, silah delme, Ultimate için ek hesaplamalarla genişletildi; Pity sistemi, FWC ve etkinlik bonusu ile mevcut deneme sayısı dahil

**UI Araç İpuçları & Yardım Simgeleri**
- Launcher'daki tüm önemli kontrol öğelerinde araç ipuçları bulunur (8 dilde)
- Karmaşık özellikler için yardım simgeleri (?): Profil adı, sekme/pencere modu, karakter adları
- Launcher genişliği/yüksekliği, filtre, düzen seçimi ve ızgara hücreleri için ipuçları

**Telemetri**
- İsteğe bağlı anonim başlangıç istatistikleri (sürüm, işletim sistemi, rastgele ID)
- Varsayılan olarak etkin, kişisel veri yok, istediğiniz zaman devre dışı bırakılabilir

**Güncelleme Kontrolü & Sürüm Geri Alma**
- Yeni ayar: Başlangıçta otomatik güncelleme kontrolü (açık/kapalı)
- Ayarlarda manuel "Şimdi kontrol et" butonu
- Sürüm geri alma: Eski Launcher sürümleri (3.0.5'ten itibaren) doğrudan ayarlardan yüklenebilir
- Tüm mevcut GitHub sürümlerini tarih ve mevcut sürüm işareti ile gösteren açılır menü

### 🚀 Performans

**OCR Sistemi Optimize Edildi**
- Platform güvenli ekran yakalama yöntemi: Linux'ta `xwd` (GPU teması yok), Win/Mac'te `capturePage()` — GPU durakslamalarını ve oyun donmalarını önler
- Linux'ta yakalama hatası durumunda oyunu dondurmak yerine tarama atlanır
- Piksel hash önbelleği: Kare değişmediğinde OCR atlanır — sabit oyun içeriklerinde CPU yükünü azaltır
- Boş OCR sonuçları doğru şekilde önbelleğe alınır — değişmemiş piksellerde gereksiz Tesseract tekrarları yapılmaz
- Global Tesseract eşzamanlılık sınırı (maks. 1 aynı anda) — GPU sürecinin CPU açlığını önler
- Sık DB okumaları yerine profiller, ROI deposu ve ROI görünürlük deposu için bellek içi önbellekler

**Overlay Optimizasyonu**
- Verimli overlay yoklaması: minimize edilmiş opaklık değişimleri ve azaltılmış aralıklar
- Linux: Şeffaf overlay'ler için gereksiz göster/gizle döngülerinden kaçınma

### ⚙️ İyileştirmeler

- **Düzen kartları iyileştirildi**: Düzen kartında doğrudan düzen türünün ASCII önizlemesi; "X Sekme" yerine "X Profil" gösterimi; daha kompakt görünüm
- **Profil kartları daha kompakt**: Azaltılmış kart yüksekliği, meslek ikonlu yatay rozetler olarak karakterler profil adının altında
- **Ayarlar tamamen yeniden tasarlandı**: Kategorize alt sayfalar, geçiş anahtarları ve kaydırıcı kartlar ile yeni kenar çubuğu düzeni
- **RAM Göstergesi**: "RAM kullanımını göster" ayarı ile profil, eklenti ve sistem süreci başına bellek detayları
- **Killfeed overlay'i konumlandırılabilir**: Overlay sürükleyerek taşınabilir, konum kaydedilir (düzende x/y)
- **Killfeed karakter seçimi**: Karakter adları profilden açılır kutu ile seçilir
- **Side-Panel butonu** oturum sekme çubuğunda (overlay yerine)
- **Sidepanel'de Killfeed ve tarama sekmeleri basitleştirildi**: daha düzenli görünüm ve azaltılmış karmaşıklık

### 🐛 Hata Düzeltmeleri

- Linux'ta GLib/GTK doğrulama uyarıları bastırıldı (zararsız Chromium dahili mesajları)

### 📦 Linux Desteği

- Linux için Tesseract ikili dosyaları ve kütüphaneleri paketlendi
- Linux için tessdata dil dosyaları paketlendi

### 🌐 Çeviriler

- Çeviriler genişletildi

---
## 🐛 Sürüm 3.0.5

### 🐛 Hata Düzeltmeleri
- Düzeltildi: Google hesabıyla giriş yapma sorunu

---
## 🐛 Sürüm 3.0.4

### 🐛 Hata Düzeltmeleri (macOS)
- Düzeltildi: "damaged and can't be opened" hatası — DMG içindeki uygulama artık DMG oluşturulmadan önce ad-hoc olarak imzalanıyor (daha önce imzalama adımı DMG tamamlandıktan sonra yapılıyordu).
- Düzeltildi: Sıralama artık doğru: `paketleme → imzalama → DMG oluşturma`.
- Not: macOS ilk başlatmada "Bilinmeyen Geliştirici" uyarısını göstermeye devam eder. Uygulamaya sağ tıklayın → **Aç** → **Yine de Aç** veya README'deki Terminal komutunu kullanın.

---
## 🆕 Sürüm 3.0.0

### 🆕 Yeni Araç: Yükseltme Maliyet Hesaplayıcı
- +0'dan +10'a kadar eşya yükseltmeleri için beklenen maliyetleri hesaplar,
malzeme ihtiyacı, deneme sayısı ve Low Sprotect ile Sprotect karşılaştırması dahil.

### ✨ Yeni Özellikler
- Sidepanel'de yeni Günlükler sekmesi: canlı hata günlüğü (Uyarı/Hata) ile silme ve kaydetme işlevi.
- API-Fetch eklentisi 3.0.0: yeni yerleşik Sidepanel arayüzü (artık ayrı Python UI penceresi yok).

### 🚀 Platform & Dağıtım - Linux ve Mac Desteği
- GitHub Actions'da Windows, macOS ve Linux için derleme/yayınlama hattı.
- Yeni paket formatları: macOS DMG ile Linux AppImage/DEB/RPM.
- Platforma özel Tesseract paketleme (win32, darwin, linux) ile uyarlanmış çalışma zamanı algılama/geri dönüş.

### 🐛 Hata Düzeltmeleri
- Fcoin-Penya kuru düzeltildi
- Killfeed: Hızlı OCR güncellemelerinde yarış koşulları azaltıldı (profil bazında serileştirme), yayın güncellemeleri artık atılmıyor.

### 📦 Çalışma Zamanı & Bağımlılıklar
- Görüntü işleme için Sharp kütüphanesi pakete dahil edildi (ayrı kurulum gerekmez).

### ⚙️ İyileştirmeler
- Killfeed canavar tanıma artık canavar HP'sine öncelik veriyor (toleranslı), ardından element/seviye.
- TTK hedef tanıma HP toleransı ile daha dayanıklı; canavar bekleme süresi 5s'den 2s'ye ayarlandı.
- İstatistik motoru OCR seviye gürültüsü ile gerçek seviye değişimleri arasında daha iyi ayrım yapıyor.
- ### Diğer Killfeed İyileştirmeleri Takip Edecek
- API-Fetch platform kapsamında yeniden oluşturuldu. Hala ayarlardan açılabilir, ek olarak Sidepanel'de mevcut.
- Ayarlar → Dokümantasyon genişletildi.

### 🧹 Temizlik Çalışmaları
- Eski API-Fetch Python dosyaları kaldırıldı (.py, .exe), JS/Sidepanel varyantı lehine.
- Tesseract kaynakları yeni platform alt klasörlerine yeniden yapılandırıldı.

:::accordion[Platforma Göre Depolama Yolları]
Tüm kullanıcı verileri platforma bağlı olarak aşağıdaki dizinlerde bulunur:

| **Windows** | `%APPDATA%\Flyff-U-Launcher\user\` |
| **macOS** | `~/Library/Application Support/Flyff-U-Launcher/user/` |
| **Linux** | `~/.config/Flyff-U-Launcher/user/` |

**2.5.1'den beri yeni dosyalar:**
- `user/tools/upgrades/upgrade_cost_calc.json` — Yükseltme maliyet hesaplayıcı
- `user/logs/errors-*.txt` — Hata günlükleri
- `user/logs/ocr/` — OCR hata ayıklama günlükleri

:::

---
## 🆕 Sürüm 2.5.1

### 🆕 Yeni Özellik: Giant Tracker
Killfeed eklentisi içinde bağımsız pencere — **Giant**, **Violet** ve **Boss** monster'lar için öldürme istatistiklerini kaydeder ve görselleştirir.

**Filtre Sekmeleri**
- 5 sekme: **Tümü** · **Giant** · **Violet** · **Boss** · **Ganimetler**
- **Boss** — `boss` rütbesine göre filtreler (kırmızı kart kenarlığı, özel ikon stili)
- **Ganimetler** — yalnızca kaydedilmiş ganimetleri olan monster'ları gösterir, kartın içinde ganimet havuzu önizlemesi (nadirliğe göre ilk 5 eşya) dahil

**Öldürme İstatistikleri**
- Kompakt ve genişletilmiş modlu kart görünümü
- Zaman aralıkları: Bugün, Hafta, Ay, Yıl, Toplam
- Monster bilgisi: İkon, Ad, Seviye, Element, Rütbe, HP, ATK

**Ganimet Takibi**
- Monster'ın ganimet havuzundan ganimetleri kaydetme (nadirlik filtresi ile)
- Monster başına ganimet geçmişi: Eşya adı, öldürme sayacı, zaman damgası
- İstatistikler: Ort. öldürme/ganimet, son ganimetten bu yana öldürme

**Time to Kill (TTK)**
- Giant, Violet ve Boss'lara karşı savaş süresini otomatik ölçer
- Hedefin seçimini kaldırırken (buff, iyileştirme vb.) 10s bekleme süresi — duraklama süresi TTK'ya dahil edilmez
- Monster adı + maks HP parmak izi: Hedef güvenilir şekilde yeniden tanınır
- Gösterim: Son TTK, Ort. TTK, En Hızlı
- Öldürme geçmişinde kalıcı depolama (CSV sütunu `TTK_ms`)

**Diğer**
- Öldürme, ad veya seviyeye göre sıralama
- Monster adına göre filtreleme için arama alanı

### ✨ Diğer İyileştirmeler
- Killfeed: İyileştirilmiş monster tanıma
- Yeni tanımlama ağırlıklandırması: Monster HP > Monster Seviye > Monster Element
- Killfeed: Monster takibi artık öldürülen mob'ları sayıyor
- Killfeed: Geçmiş eklendi (profil başına)
  - Tarih başına günlük dosya ile tekil öldürmeler (`Tarih/Saat`, `Karakter`, `Seviye`, `Monster-ID`, `Rütbe`, `Monster`, `Element`, `EXP artışı`, `beklenen EXP`, `TTK_ms`)
  - Toplu günlük özet: `Öldürmeler`, `toplam EXP`, `Monster dağılımı`, `ilk/son öldürme`
- Killfeed: Sidepanel'deki monster takibi artık öldürmelerden hemen sonra güncelleniyor (sekme değiştirme gerekmiyor)
- Killfeed: Monster takip akordeonlarında rütbe başına tekil öldürmelerin ListView'ı ile Öldürmeler butonu var.
  Tekil öldürmeler doğrudan ListView'dan silinebilir.
  Tekil öldürmeler silinirken AppData geçmiş dosyaları (daily/YYYY-MM-DD.csv, history.csv) ve Sidepanel durumu güncellenir.
- Killfeed: Sidepanel artık overlay hedef profilini kararlı şekilde takip ediyor (profil kimlikleri arasında atlama yok)
- Monster referans verileri güncellendi
- "Düzen seç" diyalog tasarımı optimize edildi
- "Profilleri yönet (çıkış yap)" diyalog tasarımı optimize edildi

### 🐛 Hata Düzeltmeleri
- Overlay'ler artık kapatma diyaloğunu örtmüyor
- Dokümantasyondaki akordeonlar doğru şekilde gösteriliyor
- Sürüm 2.3.0'dan yeni AppData yapısına (`user/`) geçiş artık güvenilir şekilde çalışıyor
- Killfeed: Negatif OCR-EXP atlamaları OCR gürültüsü olarak yakalanıyor ve artık öldürme algılamayı bozmuyor

### 🧹 Temizlik Çalışmaları
- Renderer mimarisi modülerleştirildi (dahili yeniden yapılandırma)
- Dahili veri klasörü `api_fetch/` → `cache/` olarak yeniden adlandırıldı
- AppData dizin yapısı yeniden düzenlendi: Veriler artık AppData\Roaming\Flyff-U-Launcher\user alt klasöründe sıralanmış
- Otomatik geçiş: Mevcut veriler ilk başlatmada sorunsuz şekilde taşınır — ilerleme göstergesi ile
- Statik veriler (referans verileri dahil) derlemeye dahil edildi, böylece yayın derlemelerinde güvenilir şekilde kullanılabilir
- Killfeed/overlay hata ayıklama günlükleri azaltıldı, konsol daha okunabilir

:::accordion[Yeni Depolama Yolları]
Tüm kullanıcı verileri artık `%APPDATA%\Flyff-U-Launcher\user\` altında:

- `user/config/settings.json` — İstemci ayarları
- `user/config/features.json` — Özellik bayrakları
- `user/profiles/profiles.json` — Launcher profilleri
- `user/profiles/rois.json` — ROI kalibrasyonları
- `user/profiles/ocr-timers.json` — OCR zamanlayıcıları
- `user/ui/themes.json` — Temalar
- `user/ui/tab-layouts.json` — Sekme düzenleri
- `user/ui/tab-active-color.json` — Aktif sekme rengi
- `user/shopping/item-prices.json` — Premium alışveriş listesi fiyatları
- `user/plugin-data/` — Eklenti ayarları
- `user/plugin-data/killfeed/history/<profile-id>/history.csv` — Killfeed günlük özeti (profil başına)
- `user/plugin-data/killfeed/history/<profile-id>/daily/YYYY-MM-DD.csv` — Killfeed detay geçmişi (öldürme ve gün başına)
- `user/cache/` — API-Fetch verileri & ikonlar
- `user/logs/` — Tanılama günlükleri
:::

---

## 🆕 Sürüm 2.3.0

### 🐛 Hata Düzeltmeleri

- OCR değerleri (Sidepanel) artık oyun ayrı bir Multi-Window penceresinde çalışırken doğru şekilde algılanıyor
- ROI kalibrasyonu artık yanlışlıkla yeni bir oturum açmıyor, mevcut oyun penceresini kullanıyor
- OCR artık güvenilir şekilde dahil edilen Tesseract'ı kullanıyor — ayrı bir kurulum artık gerekli değil

### ✨ İyileştirmeler

- Dokümantasyon akordeonları artık yerel HTML5 öğeleri kullanıyor (JavaScript artık gerekli değil)

---

## 🆕 Sürüm 2.2.0

### ➕ Yeni Özellikler

**Düzenler**
- Düzen işlevi yeniden tasarlandı, desteklenen oyun görünümleri:
  - 1x1 Tek pencere
  - 1x2 Bölünmüş ekran
  - 1x3, 1x4, 2x2, 3+2, 2x3, 4+3, 2x4 Çoklu ekranlar
- Sekme çubuğuna, oyun ekranlarının açılma ilerlemesini gösteren ilerleme çubuğu eklendi
- Çoklu pencere sistemi: Birden fazla bağımsız oturum penceresi açılabilir

**Kısayol Tuşları** — serbestçe atanabilen tuş kombinasyonları (2-3 tuş)
- Overlay'leri gizle
- Sidepanel aç/kapat
- Sekme çubuğu aç/kapat
- Aktif pencerenin ekran görüntüsünü `C:\Users\<USER>\Pictures\Flyff-U-Launcher\` konumuna kaydet
- Önceki sekme / Sonraki sekme
- Sonraki pencere örneği
- CD zamanlayıcıyı 00:00'a ayarla, ikonlar tıklamayı bekler
- FCoins hesaplayıcısını aç
- Premium alışveriş listesini aç

**Yeni İstemci Ayarları**
- Launcher genişliği / Launcher yüksekliği
- Izgara sekmelerini sıralı yükle
- Düzenler için sekme gösterimi
- Aktif ızgara görünümünü vurgula
- Değişikliklerde düzenleri güncelle
- Durum mesajları süresi
- FCoins döviz kuru
- Sekme düzeni görüntüleme modu (Kompakt, Gruplu, Ayrı, Mini Izgara)

**Menüler & Araçlar**
- Sekme çubuğuna yeni "Araçlar (yıldız simgesi)" menüsü eklendi.
  Menü tarayıcı görünümünü gizler, karakterler giriş yapmış kalır.
  - Dahili araçlar: FCoins-Penya hesaplayıcı, Premium alışveriş listesi
  - Harici bağlantılar: Flyff Universe Ana Sayfa, Flyffipedia, Flyffulator, Skillulator
- Sekme çubuğuna yeni menü (klavye) atanmış kısayol tuşlarını gösterir.
  Menü tarayıcı görünümünü gizler, karakterler giriş yapmış kalır.

**Dokümantasyon**
- Ayarlar menüsünde yeni "Dokümantasyon" sekmesi, çeşitli dillerde açıklamalar:
  - Profil oluşturma, düzen oluşturma, veri yolları & kalıcılık, API-Fetch,
    CD zamanlayıcı, Killfeed, FCoins <-> Penya, Premium alışveriş listesi
- Metin tüm mevcut dillere çevrildi. Bazı görseller henüz eksik.
  Geri dönüş: İngilizce UI → Almanca UI.

**Diğer**
- Yeni "Steel Ruby" teması eklendi
- Launcher, haber akışının altında zaten açılmış profillerin listesini gösterir
- Ayarlar → Destek'e bağış işlevi eklendi
- MultiTabs kapatma diyaloğunda "Tekil sekmelere ayır" seçeneği bulunur
- Halihazırda aktif bir oturum varken profil açıldığında, mevcut pencereye eklenip eklenmeyeceği veya yeni pencere oluşturulup oluşturulmayacağı sorulur

### 🧹 Temizlik Çalışmaları

- Launcher penceresi artık minimum boyuta sahip ve o boyuta kadar duyarlı
- Launcher'ın varsayılan pencere boyutu 980×640'tan 1200×970'e değiştirildi
- Ayarlar menüsüne "X" butonu eklendi
- Ayarlar penceresinin boyutu ayarlandı
- Profiller ve düzenler için "Yönet" menüsü değiştirildi. Bunlar "Yeniden Adlandır" ve "Sil" içerir
- Düzen seçiminde "Profiller" butonu eklendi. Düzenin içerdiği profilleri gösterir
- Sekme çubuğunu büyütme butonu için ikon eklendi
- Kapatma diyaloğunda aktif sekme vurgulanmış olarak gösterilir

### 🐛 Hata Düzeltmeleri

- Sekme değiştirirken oyunun gizlenmesine neden olan hata düzeltildi

### 🐛 Bilinen Hatalar

- Sidepanel'deki metin girişlerinin doğru şekilde iletilmemesi oluşabilir
- Overlay'ler "Kapat" ve "Düzen seç" gibi diyalog pencerelerinde gösteriliyor     ✅ 2.4.1'de düzeltildi
- Sidepanel pencere modunda gösterilmiyor


---

## 🆕 Sürüm 2.1.1

### ✨ İyileştirmeler

- Overlay'ler artık harici pencereleri örtmüyor.
  Pencere etkin olmadığında otomatik olarak gizlenirler.
- Pencere taşınırken overlay titremesi düzeltildi.
  Burada da overlay'ler artık doğru şekilde gizleniyor.
- Düzendeki son sekme, bölünmüş ekran etkinleştirilmeden önce yeterli yükleme süresi alıyor.
- Kapatma diyaloğundaki tüm işlemler (İptal hariç) artık tehlike butonları (kırmızı) olarak işaretlendi.
  "İptal" bilinçli olarak nötr kalır.
- Ayarlar menüsüne yama notları sekmesi eklendi.
  Gösterim seçilen dilde yapılır.

### ➕ Yeni Özellikler

- CD zamanlayıcının sonuna "+" butonu eklendi

### 🧹 Temizlik Çalışmaları

- İkon diyaloğundaki kullanılmayan sekme kaldırıldı
- Kullanılmayan "RM-EXP" rozeti sağ üstten kaldırıldı

---

## 🔄 Sürüm 2.1.0

### 🚀 Yenilikler

- Güncellemeler artık doğrudan Launcher üzerinden yapılabilir

---

## 🔄 Sürüm 2.0.2

### 🐛 Hata Düzeltmeleri

- Sidepanel'in boş gösterilmesine neden olan hata düzeltildi
- Çevirideki hata düzeltildi
