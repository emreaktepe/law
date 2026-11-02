# Migration002 — yerel hazırlık ve kabul sınırı

> **Sonraki canlı işlem — 2 Kasım:** Bu belgedeki hash değişmeden dört migration lawportal'a uygulanmıştır. Aşağıdaki yerel hazırlık anlatımı tarihsel kayıttır; tekrar uygulama talimatı değildir. CLI history ve gerçek uçtan uca kabul hâlâ açık. [Canlı sonuç](supabase-live-rollout.md).

Bu kayıt T2.1'in **yerel SQL/adapter hazırlığıdır**. Üretime uygulanmadı, canlı UI'ye bağlanmadı ve 49 ticket'ın canlı kabulünü kapatmaz. Kaynak oturumun PR #3 / `ecb5b68090bc2d563558a81e70f6a72fe4641731` demo yayını bu dosyaları içermez.

## Teslim ve doğrulama

- `supabase/migrations/20261101221002_002_matter_tracking.sql`: mevcut Supabase CLI'nin `--help`, `migration new --help` ve `migration new 002_matter_tracking` komutlarıyla oluşturulan dosya tamamlandı. Yeni CLI/Docker kurulmadı; CLI login/link/token değişmedi.
- SHA-256: `B35D100ABB68C39B78060A1C4EAA17EAA120F887282ABF00C381161ED06A6F7A`.
- `src/data/trackingSupabaseRepository.js`: doğru LawRoom istemcisine bağlı RPC/Storage adapter'ı; demo rol/aktör bilgisi yetki değildir. Henüz uygulama runtime'ına bağlanmadı.
- `src/domain/tracking-contract.js`: sunucunun seçtiği `schemaVersion:2`, `audience:lawyer|client` sözleşmesi. Müvekkil yanıtındaki beklenmeyen kök veya alt kayıt alanları reddedilir. Müvekkil DTO'su demo `trackingMatter/clientTrackingPreview` dönüşümünden geçirilmez; doğrudan sade görünüm sözleşmesidir.
- `supabase/tracking-preflight.sql`: yalnız katalog/şema metadata'sını okur. Müşteri, hukuk dosyası veya Auth kullanıcı satırı okumaz.
- `npm test`: **111/111**, 6 yeni adapter/DTO testi dahil.
- `npm run test:sql`: **31/31**. Önceki üç migration'ın 8 regresyon testi ayrı fixture'da; 23 yeni test foundation + önceki üç migration + 002 tam sırasını kullanır. Yeni fixture, Supabase'in geniş varsayılan ACL'lerini de yeniden üretir.
- `npm run build`: **1722 modül**, 1.73 sn. İlk sandbox denemesi `.vite-temp` yazma izninde durdu; yetkili yerel çalıştırma başarılı oldu. Otomatik onay reddi yok.

PGlite, gerçek Supabase servisi değildir. JWT imza/oturum kontrolü yerine sentetik `auth.uid()` GUC, Storage yerine metadata fixture'ı kullanılır. Auth e-posta/OAuth, PostgREST şema/cache/grant davranışı, Storage HTTP operation adı ve boyut metadata'sı, gerçek dosya baytları, Realtime kopması ve çok bağlantılı eşzamanlılık bu testlerle kabul edilmiş sayılmaz. Bu turda yeni UI değişikliği olmadığı için demo browser QA tekrarlanmadı; adapter'ın canlı uçtan uca browser kabulü açık.

## Şema ve erişim

Önceki üç migration sonrasına göre 002, **15 tablo ve toplam 182 kolon** ekler (yeni tabloların kolonları dahil). Atılabilir fixture'ın sonunda 32 `lr_` tablosu, 299 kolon, 41 `lr_`/Storage policy ve 100 public/private fonksiyon vardır; bu sayılar dört migration'ın birleşimidir. Canlıda son salt okunur metadata kaydı yalnız 15 foundation `lr_` tablosu/99 kolon ve dört private erişim helper'ı gösteriyordu. Eski altı site tablosuna dokunulmaz.

Yeni tablolar: `lr_matter_members`, `lr_matter_numbers`, `lr_stage_history`, `lr_agenda_items`, `lr_parties`, `lr_matter_parties`, `lr_matter_links`, `lr_document_versions`, `lr_expenses`, `lr_saved_views`, `lr_import_batches`, `lr_stage_templates`, `lr_event_types`, `lr_deadline_rules`, `lr_holidays`.

- Owner aynı organizasyonda `responsible` üyeliğe taşınır. Büro üyeliği tek başına dosya erişimi sağlamaz. Responsible/collaborator yazar, viewer yalnız okur; pasif hesap/üyelik/organizasyon erişimi keser. Admin dosya içeriği görmez.
- Legacy numara özgün değeriyle korunur, türü tahmin edilmeden `diger` olur; yalnız açık normalizasyon yapılır. Sadece kesin tür/key eşleşmesine **doğrulanmamış** snapshot eklenir. Bilinmeyen tür/asama tahmin edilmez.
- Eski tamamlanan görevler `completed`; kalanlar `open` olur. `review` ve `cancelled`, yeni UI ile aynı sözleşmededir. `uploaded_by` ikinci kez eklenmez; önceki documents migration'ındaki UUID kolon doğrulanır.
- Mevcut belgeler hash bilinmeyen `is_legacy` sürüm 1 olarak korunur. Yeni sürümün SHA-256'sı tarayıcı iddiasıdır; `sha256_verified=false`. Güvenilir byte-okuyan worker olmadan doğrulanmış hash sunulmaz. Önceki sürüm üzerine yazma/silme ve Storage UPDATE/DELETE açılmaz.
- Müvekkil yalnız kabul edilmiş/paylaşılan ilişkisine bağlı dosyanın sunucuda seçilmiş özetini, açık taleplerini, paylaşılan olay/ajanda/belge metadata'sını ve mesajlarını alır. İç görev/süre/not/ekip/hesap/yol alanları SQL'de yanıt dışındadır. Ham matters/events/documents/messages SELECT ve önceki kolon UPDATE grant'leri kaldırılır. Private iç helper/audit/DTO fonksiyonları doğrudan çağrıya açılmaz.
- Bütün yeni tablolar aynı transaction'da RLS + revoke alır. Public facade'lar security invoker; gerekli private girişler security definer ve boş search_path kullanır. Geniş PUBLIC/anon/authenticated fonksiyon/sequence varsayılanları kapatılıp yalnız açık girişler yetkilendirilir. Worker yalnız service_role kalır.

## İşlemler

`lr_create_matter`, `lr_add_proceeding`, `lr_record_hearing_outcome`, `lr_verify_deadline`, `lr_change_stage`, `lr_close_matter` ve genel `lr_tracking_command` gövdeleri vardır. Eski belgedeki doğrulama prototipinden farklı olarak verify payload'ı kural/inceleme sürümü, kaynak, tebliğ ve açık avukat onayı ister. Kapanış açık öğeleri sessizce silmez; reddeder. RPC aktörü `auth.uid()` ile belirlenir.

Safahat + görev/süre önerisi/ajanda; duruşma sonucu + görev/sonraki duruşma; türetilen dosya + iki yönlü bağlantı tek transaction'dır. Düzeltme orijinal safahatı silmez; bağlı süreyi invalidated yapar. Tarih-only süreler DATE olarak kalır, saat uydurulmaz. Otomatik onaylı hukuk kuralı/tatil verisi eklenmez.

Toplu atama tüm seçimin mevcut dosya üyeliğini doğrular; yeni erişim vermez. Toplu kapanışta sonraki bir hata önceki satırları da geri alır. Import en çok 500 özel/ilişkisiz dosya yaratır, normalize mükerrer numarayı reddeder. Undo yalnız aktarımı yapan kişi ve değişmemiş revision'lar için görevleri iptal edip dosyaları arşivler; hard delete yoktur. Kayıtlı görünüm filtreleri mevcut liste sözleşmesinin dizi alanlarını destekler; yalnız kendi kullanıcısı değiştirir, silme geri alınabilir.

Müvekkil yüklemesi açık, paylaşılmış, kendisine atanmış belge talebine bağlıdır. Yükleme tamamlanınca talep `review` olur; dosya ayrıca avukat paylaşana kadar özel kalır. İndirme her defasında authenticated Storage GET/RLS ile kontrol edilir; reusable signed URL üretilmez. İlişki/paylaşım iptali bilinen yolları da kapatır. Resend/SMTP/Realtime yayın üyeliği veya worker etkinleştirilmez.

## Sıralama, risk ve geri alma

Gerekli sıra: **onaylı foundation baseline/history uzlaştırması**, ardından `20261101191736_identity_onboarding.sql`, `20261101191740_private_documents.sql`, `20261101191742_notification_delivery.sql`, en son 002. Foundation canlıda tekrar çalıştırılmaz. 002, referral/delivery tabloları ve documents kolonları yoksa transaction'ı durdurur. Eski migration'lar değiştirilmedi veya uzaktan tekrar uygulanmadı.

Identity migration'ındaki applicant başına unique kısıtı mevcut çoklu başvurularla çakışırsa hangi başvurunun korunacağı kullanıcı kararıdır; otomatik silme/birleştirme yapılmaz. Böyle bir çakışma canlı veride araştırılmadı. Metadata tek başına veri kaynaklı unique/check geçişini garanti etmez; onaylı test ortamında kontrollü migration kabulü gerekir.

002 yalnız eklemeler ve koruyucu backfill/grant değişiklikleri yapar. DROP edilen eski deadline check'i daha güçlü, tarih-only uyumlu proof check'i ile aynı transaction'da değiştirilir. Yeni kolonların API görünürlüğünü kapatması **davranış değişikliğidir**: eski LiveWorkspace'in ham tablo okuma/yazmaları artık reddedilir. Bu nedenle yeni adapter + müvekkil DTO tüketimi birlikte geçirilmeden migration uygulanmamalı; bu çalışma şu an üretime hazır/canlı özellik değildir.

Yerel dosyalar stage edilmedi; geri almak için yalnız bu yeni dosyalar ve `tests/sql/access.test.js` kapsam değişikliği üzerinden seçici diff geri alınabilir. Başka kullanıcının mevcut `es-avukatlik` silinmeleri kapsam dışıdır. SQL uygulaması transaction içinde hata verirse tamamı rollback olur. COMMIT sonrasında veri kaybettiren down/drop betiği verilmedi: önceden doğrulanmış backup/PITR ve test branch'i, yazmaları durdurma, gerektiğinde ileri düzeltme migration'ı gerekir. Yeni verilere dokunmadan eski uygulamaya kör rollback güvenli değildir.

## Kalan en küçük karar/onay paketi

Hedef yalnız **LawRoom `deezwydtiibbdtimxcxf`**. DietApp hesabı/DB'si kapsam dışıdır.

1. Baseline ve boş diff için mevcut yetkili DB bağlantısının güvenli kullanımı ve çalışma ortamı seçimi: Docker PATH'te yok; yeni yazılım kurulmadı. CLI DB yetkisi/bağlantısı doğrulanmadı, kalıcı token oluşturulmadı/taşınmadı. Onaylı geçici Supabase branch veya kullanıcı tarafından sağlanan yerel servis seçilmeden bu adım bekler.
2. O ortamda önceki üç migration + bu hash'in DDL/DML/grant/bucket etkisinin uygulanması; iki organizasyon, farklı avukat/ekip/viewer/admin/müvekkil/iptal edilmiş ilişki ile sentetik gerçek Auth/Storage/PostgREST E2E. Gerçek müşteri/hukuk verisi kullanılmaz. Baseline/history repair ayrıca somut diff ile onaylanır; otomatik yapılmaz.
3. Yeni UI/adapter cutover ve HTTP ağ yanıtında müvekkil alan sızıntısı kontrolü, sürüm yükleme/indirme ve iptal testi. Sonra üretim migration/publish ayrı değerlendirilir. Bu turda DB yazımı, bucket/Auth/Realtime/SMTP değişimi, credential kurulumu veya yayın için işlem başlatılmadı.
4. Hukukçu onaylı kural/tatil kapsamı, yeni LawRoom domaini/Resend ve diğer ürün kararları ayrı kalır; bunlar tahmin edilerek etkinleştirilmez.

## 49 ticket'ın durumu

Tam liste [tracking-status.md](tracking-status.md) içindedir. **20 yerel teslim/plan kanıtı:** T0.1,T0.2,T0.4,T0.6,T0.7,T2.2–T2.16. Bunların canlı kalıcılık/E2E şartları kapanmadı. **16 kısmi/yerel hazırlık:** T1.1–T1.4,T2.1,T3.1–T3.4,T4.1–T4.6,T5.1. **13 açık/parça/karar:** T0.3,T0.5,T1.5,T3.5,T5.2,T6.1–T6.5,T7.1–T7.3. T2.1 bu turda salt taslaktan testli yerel migration/adapter hazırlığına ilerledi; gerçek Supabase kabulü hâlâ açık.

Resmi kaynaklar tekrar kontrol edildi: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [fonksiyon güvenliği](https://supabase.com/docs/guides/database/functions), [Storage erişimi](https://supabase.com/docs/guides/storage/security/access-control), [CLI migration new](https://supabase.com/docs/reference/cli/supabase-migration-new), [changelog](https://supabase.com/changelog). Güncel changelog'daki başka bölgelerin timezone düzeltmesi bu çalışma adına canlı upgrade yapılması anlamına gelmez; İstanbul tarih dönüşümü sentetik testte ayrıca kontrol edilir.

Salt okunur yayın kontrolü: [PR #3](https://github.com/emreaktepe/law/pull/3) birleşmiş, main merge commit'i `dea3019`; [Actions 41355370033](https://github.com/emreaktepe/law/actions/runs/41355370033) Success/39sn ve deploy10sn olarak bağımsız doğrulandı. Kaynak feature commit'i `ecb5b68`'dir. Bu yeni yerel SQL/adapter bu yayına dahil değildir. Yerel main referansı eski kalmış olabilir; bu görev fetch/push/merge yapmadı.
