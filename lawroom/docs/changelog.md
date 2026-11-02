# Değişiklik günlüğü

## 2 Kasım 2026 — Giriş ve hesap değiştirme kırılmaları

- PKCE kodu temizlendikten sonra kök rotanın tanıtıma dönmesi ve kimlik yüklenirken çıkışın loading durumunda kalması düzeltildi.
- Tek oturum/kimlik store'u; eski getSession/getUser/getIdentity/refresh yanıtlarını hesaba ve istek sürümüne bağlar. StrictMode aboneliği korunur.
- Süresi dolmuş giriş bağlantısında anlaşılır hata ve temiz URL'ye yeni bağlantı eylemi; sağlayıcı açıklaması yansıtılmaz.
- Kapalı tracking gate, etkin nonadmin hesabı 002'de kapatılmış eski tablo sorgularına göndermez. Admin yönetimi korunur.
- 10 yeni regresyon ve gerçek tarayıcı/sentetik Auth kontrolleri. Gerçek Auth/Storage opt-in testi hazır; hassas mevcut server anahtarı için açık onay beklendiğinden çalıştırılmadı.
- Son kontrol: **138/138 unit/entegrasyon + 34/34 SQL**, Pages build **1731 modül/1.23 sn** başarılı; gerçek servis testi ve gate açılışı bu sayılara dahil değildir.

Kanıt, kapsam ve son kontrol: [oturum düzeltmeleri](auth-flow-fixes.md).

## 2 Kasım 2026 — Canlı Supabase şeması ve private Storage uygulandı

- Kullanıcının canlı kurulum talebiyle Dashboard'da lawyer/lawportal erişimi doğrulandı. Eklenti bu sohbette eski hesabı seçiyor; ayrı CLI profili hatası sürüyor. Dashboard üzerinden uygulanabilir iş bekletilmedi.
- Foundation katalog eşleşmesi ve geri alınan deneme sonrası mevcut dört migration tek transaction'da canlıya COMMIT edildi: 32 tablo/299 kolon, tamamında RLS; private 20MB lr-matter-files bucket ve rol/DTO/RPC erişimi.
- Auth Site URL ve kesin Pages/5178/5173 redirect listesi kaydedildi. E-posta doğrulaması korundu. Yeni anahtar veya SMTP/worker/cron kurulmadı.
- 6 gerçek HTTP kontrolü ve rollback'li gerçek DB owner/client/admin/viewer/revocation/idempotency testi başarılı. Kalan test kullanıcısı/hesabı/dosyası 0/0/0; legacy tablo metadata'sı değişmedi.
- CLI history/db pull/diff, gerçek Auth + Storage baytları/Realtime kabulü ve canlı UI yayını açık. Pages demo olarak kaldı; canlıya uygulanmış SQL dosyaları tekrar çalıştırılmamalı. Altı legacy RLS hatası ayrıca açık.

Ayrıntılar: [canlı kurulum ve kanıtlar](supabase-live-rollout.md).

## 2 Kasım 2026 — Varsayılan kapalı Supabase UI geçişi, yerel

- Migration002/DTO/adapter ile yeni avukat/müvekkil çalışma alanı repository sınırında bağlandı; normal runtime seçimi `VITE_TRACKING_V2_ENABLED=false` ile korundu. Admin yönetim ekranında kalır.
- Payload allow-list, hesap değişiminde stale yanıtları engelleme, yetki reddinde cache temizliği, aynı UUID ile güvenli retry, belge rezervasyonu ve taze indirme kontrolü eklendi. Eksik sunucu kurulumunda demo/ham tablo fallback yok.
- Sentetik tarayıcıda rol/erişim/loading, viewer/arşiv, mesaj, mobil ve kayıp not/create yanıtı doğrulandı. Son birleşik sonuç **128 unit + 34 SQL**, Pages build **1729 modül/1.24 sn** başarılı.
- Bu devam stage/push/yayın veya canlı DB/Auth/Storage/Realtime/SMTP değişikliği yapmadı. Gerçek Supabase kabulü ve diğer açık ticket'lar sürüyor. Yayınlanan PR #3 demosunun sonucu 105+8'dir.

Ayrıntılar: [yerel geçiş kaydı](tracking-ui-cutover.md), [sentetik kabul](verification-tracking-live-mock.md).

## 2 Kasım 2026 — Araştırmaya dayalı dosya takibi

- Beş birincil blog/rehber/ürün kaynağı incelendi; 17 kullanım senaryosu ve dosya takip kararları `matter-workflow-research.md` içinde.
- Liste, kayıtlı görünüm, sihirbaz, Bugün, son dosyalar/bağlamsal komut paleti, toplu işlem ve gerçek CSV/XLSX içe aktarma demo uygulamasına bağlandı.
- Yeni dosya kokpiti: hesaplanan sıradaki iş, numara geçmişi, şablon snapshot, safahat filtre/düzeltme, görev/sorumlu/öncelik/gerekçeli erteleme, aşama ve denetim geçmişi.
- Tebligat → seçilen işler + süre incelemesi; duruşma sonucu → safahat + ara karar görevleri + sonraki duruşma; tüm alt kayıtlar tek yerel aggregate yazmasıyla saklanır.
- Taraflar, iki yönlü dosya bağlantıları, yeni icra/kanun yolu dosyası türetme; para birimi başına kuruş hassasiyetli masraf ve ters kayıt; açık iş kontrollü salt okunur arşiv/yeniden açma.
- Gerçek demo Blob/IndexedDB belgeleri, SHA-256, ayrı sürümler, resim/tarayıcı PDF önizleme, kaynak safahat; açık talebe bağlı müvekkil yüklemesi ve avukat incelemesi.
- Ayrı sade müvekkil ekranı ve allow-list önizleme; iç hedef/hesap/özel not/taraf iletişimi gösterilmez. Ortak takvimde kokpit ajandası/görev/süreler; iç hedefler müvekkil takviminden çıkarıldı.
- Kaynaklı açık kural/takvim girdileriyle yalnız öneri üreten süre aritmetiği; belirsizlikte sonuç yok. Hazır onaylı mevzuat kuralı sunulmaz.
- Son kontrol: **105 birim/repository testi + 8 SQL testi başarılı**, Pages build başarılı. Liste pipeline'ındaki tekrar hesap kaldırıldı; 500 dosya/10k olay kabulü 300 ms altında. Masaüstü, 390px mobil, klavye, gerçek belge yükleme ve müvekkil görünümü tarayıcıda doğrulandı.
- Canlı Supabase migration/bucket/RPC/SMTP/Realtime uygulanmadı. Resend kendi Lawroom domainini bekler. Yeni demo repository'si canlıya bağlanmadı.

Ayrıntılar: [kabul kanıtı](verification-tracking.md), [ticket durumu](tracking-status.md). Aşağıdaki kayıtlar kendi tarihlerindeki ara checkpoint'lerdir; son durum olarak okunmamalıdır.

## 1 Kasım 2026 — Giriş, ilk kurulum ve yayın paketi

- T0.1 tarayıcı kontrolü tamamlandı; Welcome/takvim ve yeni giriş/kayıt/ilk kurulum ekranlarının masaüstü/mobil görüntüleri `docs/screens/` içinde.
- T0.2 bağımsız bağımlılıklar ve lock dosyası; temiz Windows kurulumu `npm ci --os=win32` ile doğrulandı. Genel npm ayarı değiştirilmedi.
- Giriş dosyası ayrıldı; demo `app/DemoApp.jsx` içinde korundu. Demo kayıtları ve canlı sorgular ayrı repository'lerde.
- T0.5 uzak baseline doğru Supabase hesabını bekliyor; foundation yeniden çalıştırılmadı. T0.6 eski site RLS önerisi `docs/legacy-rls.md` içinde; eski tablolar değiştirilmedi.
- CI/Pages workflow'u ve PR şablonu hazırlandı.
- T0.7 yayınlandı: [PR #2](https://github.com/emreaktepe/law/pull/2) birleştirildi, [main CI/Pages dağıtımı](https://github.com/emreaktepe/law/actions/runs/41348097433) başarılı. [Canlı demo](https://emreaktepe.github.io/law/) tarayıcıda açıldı; giriş/kayıt ve müvekkil ilk kurulum önizlemesi doğrulandı. Yayın canlı veri modu değildir.
- E-posta/magic link giriş, kayıt, üç adımlı ilk kurulum, başvuru/onay akışları için arayüz ve SQL. Rol metadata'dan alınmaz; atama, kabul ve dosya paylaşımı ayrı kalır.
- Özel Storage bucket ve dosya yükleme/indirme/paylaşım RPC'leri hazırlandı. İndirme her istekte JWT/RLS kontrolünden geçer; reusable signed URL üretimi kapalıdır.
- Resend worker'ı, kuyruk kilidi, alıcı yeniden yetkilendirmesi ve teslim kayıtları hazırlandı. Deno tür kontrolü başarılı. Gerçek gönderim kapalıdır.
- Kullanıcının son kararı: Resend kurulumu Lawroom'un kendi domainini bekler. Dietroom ile çalışma zamanı/veri/domain/anahtar bağlantısı yoktur; yalnız ürün benchmark'ıdır. Resend anahtarı oluşturulmadı.
- Yayın demosunda kurgusal avukat profilleri; Kâtip resmi ve Auth dönüş yolu Pages alt dizinini destekler.

Canlı uygulanmamış işlemler ve sınırlar: [kurulum paketi](release-setup.md).

### İlk doğrulama kaydı (arşiv)

- `npm test`: 8 test geçti, 0 hata; takvim ve rol/görünürlük testleri başarılı.
- `npm run build`: başarılı; Vite 8.3.5, 1575 modül, derleme süresi 1,64 sn.
- Yerel geliştirme sunucusu `http://127.0.0.1:5178/` adresinde 599 ms içinde açıldı.
- Welcome ve takvimin masaüstü/mobil tarayıcı kontrolü ile ekran görüntüleri bekliyor. Tarayıcı aracı `Local browser use is disabled in Work settings` yanıtı verdi.
- T0.1 tamamlandı olarak işaretlenmedi; sonraki ticket'a geçilmedi.
- Uygulama kaynakları, bağımlılıklar ve veritabanı değiştirilmedi.
- Ayrıntılar: [T0.1 doğrulama kaydı](verification-t0.1.md).

## 1–2 Kasım 2026 — Yerel liste, Bugün, komut paleti ve yeni dosya

- LawRoom beklenen Supabase ref koruması ana istemciye entegre edildi; yanlış proje/URL/anahtar türü kapalı kalır. İki hesap açık bağlantı kimliğiyle doğrulandı; DietApp ile refs ayrıdır.
- T2.4/T2.5: avukat dosya listesi, normalize arama, filtre/grup/sıralama/yoğunluk/sayfalama; demo kayıtlı görünüm, pin/default, URL durumu ve geri alınabilir kaldırma entegre edildi.
- T2.12: dokuz kademeli dikkat sıralaması Bugün ekranına bağlandı; yazılı gerekçe ve audit'li görev tamamlama eklendi.
- T2.13 çekirdek Ctrl+K paleti: numara/metin arama, dosya/Bugün/takvim/yeni dosya. Son beş dosya ve bağlamsal safahat/görev/duruşma komutları henüz açık.
- T2.3: beş adımlı demo dosya sihirbazı; müvekkilsiz/kapalı paylaşım, normalize birincil no, şablon snapshot, ilk görev ve denetim kaydı. Canlı lr_create_matter/RLS/E2E tamamlanmış sayılmadı.
- Doğrulama: son ortak unit suite 78/78 (16 takip testi kaynak ajana ait), mevcut SQL 8/8; build 1649 modül, 1.47 sn. 500 dosya/10k olay pipeline medyan 124.0 ms. Gerçek tarayıcıda arama, kayıt/reload/geri alma, klavye, 390px mobil, sihirbaz→dosya→Bugün→görev tamamlama→reload ve müvekkil gizliliği kontrol edildi.
- Bu devam değişiklikleri yereldir; bu görev push/yayın/canlı DB yazımı yapmadı. Kaynak ajan tracking/kokpit entegrasyonunu devam ettiriyor; bütün 49 ticket kapalı değildir.

Ayrıntılar ve kalanlar: [yerel doğrulama](verification-workbench-local.md), [proje bağlantıları](multi-project-supabase.md).
### Son yerel QA — toplu işlem / CSV-XLSX / komut paleti

- T2.13 bağlamsal safahat/görev/duruşma ve son beş dosya artık entegre; üç gerçek form tarayıcıda açıldı.
- T2.14 sorumlu atama/reload, açık öğede atomik arşiv reddi ve boş dosyada salt okunur arşiv tarayıcıdan doğrulandı.
- T2.15 CSV ve XLSX gerçek okuma/eşleme/önizleme/kayıt, reload sonrası batch geçmişi, mükerrer satırda kapalı aktarım ve geri alınabilir arşiv doğrulandı. 390px mobilde taşma ve console hatası yok.
- İlk görev tamamlanınca aynı işi yeniden gösteren manuel hedef tekrarı kaldırıldı. Liste performansında batch attention tekrar kullanıldı; 300ms eşiği korundu. Son ortak test 105/105, 500/10k medyan 135.6ms; son build 1722 modül/1.28sn. Yeni bağımlılıkla temiz npm ci +91 unit/+8SQL/build de geçti; sonraki final kaynak kontrolleri ayrı kaydedilir.
- Bu görev canlı DB/anahtar/CLI login/yayın yapmadı. Bütün 49 ticket'ın canlı kabulü tamamlanmış sayılmadı.

Kanıt ve sınırlar: [son yerel QA](verification-bulk-import-palette.md).

## 2 Kasım 2026 — T2.1 yerel SQL/DTO/adapter hazırlığı

- Gerçek `20261101221002_002_matter_tracking.sql`: önceki üç migration sırasını doğrular; ekip, sürümlü katalog/snapshot, numara/geçmiş, görev/süre/ajanda, taraf/bağ, belge sürümü, masraf, görünüm ve import/undo tabloları/RPC'leri içerir. Legacy owner/numara/görev/belge korunur, `uploaded_by` çakışması yoktur.
- Sunucuda seçilen client/lawyer DTO ve doğru proje ref kontrolü yapan RPC/Storage adapter'ı eklendi. Ham ortak satır ve kolon UPDATE grant'leri kapatılır; müvekkil iç alanları SQL'de alamaz. Canlı UI cutover henüz yapılmadı.
- `npm test`111/111, `npm run test:sql`31/31 (8 eski +23 yeni), `npm run build`1722 modül/1.73sn geçti. Yeni SQL testleri geniş varsayılan ACL, roller, değişen üyelik/ilişki, işlem atomikliği, import revision, saved view, Storage yolu ve client DTO sızıntısını sınar. PGlite gerçek Supabase servis kabulü değildir.
- Yeni dosyalar stage/push/publish edilmedi; canlı DDL/DML, baseline/history repair, bucket/Auth/Realtime/SMTP/credential işlemi yapılmadı. PR#3 demo yayını bunları içermez. 49 ticket'ın canlı kabulü açık kalır.

Hash, riskler, geri alma ve açık adımlar: [Migration002 hazırlığı](migration-002-local.md).
