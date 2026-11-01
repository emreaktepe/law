# Ticket durumu — 2 Kasım 2026

Bu kayıt, `agents.md` başlangıç envanterini günceller. **Yerel demo kabulü, canlı ticket kabulü değildir.** Mevcut GitHub Pages yayını demo olarak kalır. Canlı SQL/Storage/SMTP/Realtime işlemleri bu geliştirme turunda yapılmadı.

Araştırma: [Dosya takibi ve 17 kullanım senaryosu](matter-workflow-research.md). Arayüz/davranış kanıtları: [Kokpit doğrulaması](verification-tracking.md), [Liste, Bugün, sihirbaz ve komut paleti](verification-workbench-local.md).

| Ticket | Gerçek durum / kalan eylem |
|---|---|
| T0.1 | Yerel test/build, Welcome/takvim masaüstü ve mobil doğrulandı. |
| T0.2 | Bağımsız bağımlılıklar, lock ve repo-local native OS ayarı; temiz kurulum doğrulandı. |
| T0.3 | `main.jsx` küçük bootstrap; Root, demo, auth, onboarding, liste, kokpit ve workbench özellik klasörlerinde. Legacy demo kodunun tamamı henüz silinmedi. |
| T0.4 | Veri yazmaları repository katmanında. Yeni aggregate komutları taze yükleme → doğrulama → tek yazma yapar. |
| T0.5 | **Açık:** CLI baseline/db pull ve boş db diff henüz alınmadı. Dashboard erişimi var; bu sohbetin MCP yönlendirmesi eski hesabı seçiyor. CLI hesabı değiştirilmedi. |
| T0.6 | Eski site erişim incelemesi ve RLS planı yazılı. Eski tablolara canlı değişiklik yok. |
| T0.7 | Branch, PR şablonu ve GitHub Actions/Pages kurulu; önceki yayın yeşil. Yeni sürüm son yayın doğrulamasıyla kaydedilir. |
| T1.1–T1.4 | Auth/onboarding/onay/atama/kabul UI ve migration taslakları ile SQL fixture testleri var. **Açık:** doğru projeye uygulama, gerçek Auth kullanıcılarıyla E2E. |
| T1.5 | **Açık:** büro daveti ve canlı üyelik kabul RPC/UI. Büro üyeliği kendiliğinden dosya erişimi açmamalı. |
| T2.1 | **Açık:** baseline sonrası ekip, numara, safahat, görev, takvim, belge sürümü, masraf vb. genişletme migration'ı; gerçek RLS matrisi/atomik RPC testleri. Mevcut foundation tekrar çalıştırılmadı. |
| T2.2 | 12 sürümlü/doğrulanmamış tür şablonu, alt türler, sade müvekkil etiketleri, 24 safahat türü ve numara normalizasyonu testli. |
| T2.3 | Yerel beş adımlı sihirbaz; numarasız/müvekkilsiz özel dosya, snapshot, ilk görev. **Açık:** canlı `lr_create_matter`. |
| T2.4 | Yerel kolonlu liste, çoklu filtre, sıralama, gruplama, yoğunluk, klavye; 500 dosya/10 bin olay benchmark'ı. Son performans sonucu doğrulama belgesinde. |
| T2.5 | Yerel kayıtlı/sabit/varsayılan görünümler, URL durumu ve geri alma; hesap namespace ayrımı. Canlı `lr_saved_views` T2.1'e bağlı. |
| T2.6 | Yerel kokpit: numaralar/kopyalama, şablon aşamaları, hesaplanan sıradaki iş, kaynak ve neden, sekmeler, mobil kart ve hızlı işlemler. |
| T2.7 | Yerel zaman çizelgesi, tür/görünürlük filtresi; orijinali koruyan gerekçeli düzeltme; kaynak süreyi geçersizleştirme. Canlı kalıcılık T2.1'e bağlı. |
| T2.8 | Yerel safahat + seçilen görevler + isteğe bağlı süre incelemesi tek aggregate yazması; eksik alt kayıtta hiçbir yazma yok. **Açık:** canlı `lr_add_proceeding` ve gerçek RPC rollback testi. |
| T2.9 | Yerel görev, dosya ekibinden sorumlu, öncelik/hedef, gerekçeli erteleme, iptal, tamamlanma ve audit. Canlı üyelik/RLS T2.1'e bağlı. |
| T2.10 | Yerel taraf/rol/özel iletişim, numara geçmişi, mevcut dosya bağlantısı ve yeni icra/kanun yolu dosyası türetme; iki yönlü bağlantı tek yazma. Paylaşım/müvekkil ilişkisi aktarılmaz. |
| T2.11 | Yerel aşama değişikliği ve kişi/zaman/not geçmişi. Dosyanın kilitlediği snapshot önce kullanılır. |
| T2.12 | Dokuz kademe domain testi + Bugün ekranı, yazılı neden ve görev tamamlama. Manuel çalışma hedefi kesin süre değildir. Canlı toplu veri sorgusu T2.1'e bağlı. |
| T2.13 | Ctrl/Cmd+K, numara/isim araması, yetkili son 5 dosya, klavye gezinme, yeni dosya/takvim/Bugün ve mevcut dosyaya safahat/görev/duruşma eylemleri. |
| T2.14 | Yerel çoklu sorumlu atama ve açık öğe kontrollü arşiv; tüm seçim doğrulanmadan yazma yok, audit var. Canlı ekip ataması T2.1'e bağlı. |
| T2.15 | Yerel gerçek CSV/XLSX okuma, kolon eşleme, önizleme, satır hataları, mükerrer kontrolü, tek toplu yazma ve değişmemiş batch için geri alınabilir arşiv. Canlı batch transaction T2.1'e bağlı. |
| T2.16 | Yerel açık görev/süre/takvim/manuel hedef kontrolü, gerekçeli kapanış, salt okunur arşiv ve gerekçeli yeniden açma. Paylaşım otomatik açılmaz. |
| T3.1 | Saf aritmetik motoru; hafta sonu/tatil, yıl/ay sonu, artık yıl, açık adli tatil kuralı ve belirsizlik testleri var. **Açık:** kaynaklı gerçek tatil verisi, hukukçu onaylı kural kataloğu ve canlı tablolar. Onaylı mevzuat kuralı sunulmuyor. |
| T3.2 | Yerel tebliğ/dayanak/kaynak/kural sürümü/avukat onaylı doğrulama diyaloğu; kaynak değişikliği invalidated; gerekçeli sonuçlandırma. **Açık:** canlı RPC. |
| T3.3 | Yerel kokpit ajandası, görev hedefleri ve öneri/doğrulanmış sürelerin ortak takvimde türetilmesi; müvekkile iç hedef/süre yok. **Açık:** `lr_agenda_items` bağlantısı ve eski bağımsız demo takvim kayıtlarının ortak modele taşınması. |
| T3.4 | Yerel duruşma sonucu → safahat + ara karar görevleri + sonraki duruşma tek aggregate yazması. **Açık:** canlı RPC ve takvim kaynağının tam birleşmesi. |
| T3.5 | **Açık:** büro sorumlu filtresi ve sunucuda iptal edilebilir ICS abonelik token'ı. Statik dosya indirmek abonelik kabulü sayılmadı. |
| T4.1 | Private Storage migration taslağı ve yerel SQL testleri. Tekrar kullanılabilir signed URL yerine her indirmede güncel yetki kontrolü seçildi. **Açık:** canlı bucket/policy uygulaması ve HTTP erişim testi. |
| T4.2 | Yerel gerçek Blob/IndexedDB yükleme, SHA-256, silinmeyen sürümler, kategori/kaynak safahat, resim ve tarayıcı PDF önizleme; UDF/DOCX orijinal indirme. **Açık:** gerçek Storage sürüm şeması ve pdf.js gereksinimi için büyük/çok sayfalı PDF kabulü. |
| T4.3 | Yerel sade müvekkil ana ekranı/detayı, allow-list önizleme, paylaşılan olay/ajanda/belgeler ve “Sizden beklenen”. İç not/hesap/ekip/özel taraf iletişimi aktarılmaz. **Açık:** canlı DTO ve ağ E2E kabulü. |
| T4.4 | Yerel açık paylaşılan belge talebine müvekkil yüklemesi → görev inceleme bekliyor; avukat inceleyip tamamlar. **Açık:** canlı talep tabloları/Storage RLS ve gerçek iki kullanıcı testi. |
| T4.5 | Yerel iki yönlü dosya mesajları, kaynak ve zaman; yeni müvekkil mesajı Bugün sıralamasına girer. **Açık:** canlı Realtime subscription ve ilişki iptalinde kesilme testi. |
| T4.6 | Yerel masraf kalemi/tutar/tarih/ödeyen/yansıtma/not, para birimine göre kuruş hassasiyetli toplam ve gerekçeli ters kayıt. Canlı tablo T2.1'e bağlı. |
| T5.1 | Outbox/worker, idempotency, lease ve taze alıcı yetkisi taslakları yerel testli. **Açık:** canlı deploy, Lawroom domaini, Resend anahtarı ve gerçek kontrollü teslimat. |
| T5.2 | **Açık:** tercihler, günlük özet ve hatırlatıcı planlama; Lawroom domaini sonrası gönderim. |
| T6.1–T6.5 | **Açık:** lisans/veri saklama/kota sağlayıcı kararı, erişim filtreli gerçek sağlayıcı adaptörü ve belge kaynaklı AI akışları. Sahte karar/atıf veya gerçek sağlayıcı bağlantısı üretilmedi. |
| T7.1–T7.3 | Kurgusal profil önizlemesi var, varsayılan kapalı. **Açık:** canlı görünürlük RPC/API 404, blog CMS ve referanslı profil akışının tam kabulü; gerçek profil sahibinin onayı. |

## Canlıya geçiş sırası

1. Doğru `lawportal` hesabıyla CLI/MCP yönlendirmesi, baseline ve şema farkı doğrulanır.
2. Mevcut yeni auth/storage/bildirim migration'ları ile T2.1 genişletmesi lokal servis/branch'te gerçek Auth/Storage/RLS/atomik RPC testlerinden geçirilir. Foundation tekrar uygulanmaz.
3. Canlıya yalnız gözden geçirilmiş yeni migration'lar uygulanır; farklı büro/avukat/müvekkil/admin/iptal edilmiş ilişki testleri yapılır. Yeni demo mutasyon repository'si canlı veriye bağlanmaz.
4. Hukukçu kaynaklı kuralları ve canlı aydınlatma metnini gözden geçirir. Lawroom alan adı doğrulanınca Resend kurulur. Dietroom kaynaklarına bağlantı kurulmaz.

## Yayın sınırı

Bu sürüm etkileşimli, kurgusal demo olarak yayınlanabilir. Yerel test veya mock Postgres sonucu, canlı hesap/izin veya gerçek veri işleme uygunluğu kanıtı değildir. Üretim moduna geçiş yukarıdaki açık kabul eylemlerine bağlıdır.
