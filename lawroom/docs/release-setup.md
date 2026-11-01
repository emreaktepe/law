# Giriş, ilk kurulum, belgeler ve yayın paketi

## Yerel yapı

`src/main.jsx` yalnız uygulamayı başlatır. `app/Root.jsx` hash rotalarını, `app/DemoApp.jsx` mevcut demoyu, `features/auth`, `features/onboarding`, `features/workspace` yeni akışları içerir. Demo kayıtları `data/demoRepository.js`; canlı sorgular `data/supabaseRepository.js` üzerinden yürür.

`@supabase/supabase-js` istemci bağımlılığıdır. Sabit sürümlü Supabase CLI migration üretimi içindir. PGlite yalnız geliştirme/test bağımlılığıdır: Docker bulunmayan bu ortamda geçici PostgreSQL üzerinde gerçek SQL/RLS testleri çalıştırır. Auth/Storage HTTP servislerini taklit ederek başarı iddiasında bulunmaz.

## Rotalar

| Rota | İş |
|---|---|
| `#` | Tanıtım ana sayfası |
| `#/giris` | E-posta + magic link; yeni hesap oluşturmaz |
| `#/kayit` | E-posta doğrulamasıyla kayıt başlangıcı |
| `#/ilk-kurulum` | Hesap türü → bilgiler → kontrol → onay bekleme |
| `#/ilk-kurulum?preview=1` | Yalnız demo modunda, kalıcı kayıt oluşturmayan tasarım önizlemesi |
| `#/oturum` | Oturuma ve sunucu hesabına göre çalışma alanı |
| `#demo?...` | Önceki demo, canlı veriden ayrı |

## Supabase uygulama sırası

1. Doğru Supabase hesabına erişim sağlanmalı. Dashboard `lawportal` projesine erişiyor; bu oturumdaki MCP/CLI hesabında proje görünmüyor.
2. `supabase db pull` ile mevcut uzak şema baseline alınmalı; mevcut foundation yeniden çalıştırılmamalı. `supabase/preflight.sql` ile kolonlar, grant'ler, Storage helper desteği, mevcut bucket ve mükerrer başvurular kontrol edilmeli. Şu an yalnız canlı tablo/politika envanteri kaydedildi; `db diff` boşluğu henüz doğrulanmadı.
3. Yeni migration'lar önce yerel Supabase veya ayrı geliştirme ortamında doğrulanmalı. Bu ortamda ek olarak `npm run test:sql` ile PostgreSQL erişim matrisi sınanır.
4. Sırayla `identity_onboarding`, `private_documents`, `notification_delivery` migration'ları uygulanmalı. Eski altı site tablosu değiştirilmez.
5. Doğrulanmış ilk yönetici hesabı proje sahibi tarafından `lr_accounts` içine sunucu tarafında eklenmeli. E-posta, kullanıcı metadata'sı veya URL ile yönetici olunmaz.
6. İstemci için yalnız publishable/anon anahtarı `.env.local` içinde kullanılmalı. Service role ve Resend anahtarı tarayıcıya veya GitHub Pages artifact'ine konmaz.

## Auth ayarları

Site URL: `https://emreaktepe.github.io/law/`.

İzin verilecek dönüş adresleri: aynı kesin Pages adresi ve geliştirme için `http://127.0.0.1:5178/`, `http://127.0.0.1:5173/`. Üretimde geniş joker desen kullanılmaz. Başka uygulamalar aynı projeyi kullanıyorsa mevcut izinli adresler korunur.

E-posta doğrulaması açık kalır. SPA PKCE akışı kullanır; magic link aynı tarayıcıda açılır. `templates/magic-link.html` hem magic link hem yeni hesap doğrulama şablonuna uyarlanabilir. Auth ayarı ve gerçek e-posta dönüşü henüz canlıda sınanmadı.

## Belgeler

Özel bucket: `lr-matter-files`, 20 MB, PDF/PNG/JPEG/DOCX/UDF. Yol sunucuda `{organization}/{matter}/{document}/1-{filename}` olarak üretilir. Akış: rezervasyon → yeni object yükleme → boyut ve erişim kontrolüyle tamamlama. Başlangıç görünürlüğü yalnız avukattır; mevcut nesne üzerine yazma ve silme yetkisi verilmez.

İndirmeler kullanıcı JWT'siyle her istekte RLS kontrolünden geçer. Erişim kaldırıldığında önceden alınmış Storage yolunun tekrar kullanılması engellenir. Yeniden kullanılabilir signed URL üretimi izinli değildir: bu, erişim iptali sonrasında linkin çalışmaması gereksinimi için bilinçli bir tercihtir. Daha önce indirilmiş bir dosya kullanıcının cihazından geri alınamaz.

Bu sürümde her yeni yükleme yeni belge kaydıdır. Aynı belgenin sürümleri, SHA-256, PDF önizleme ve müvekkil belge talebi akışı hâlâ Faz 4 kapsamındadır.

Kaynak: [Supabase Storage erişim kuralları](https://supabase.com/docs/guides/storage/security/access-control), [işlem bazlı Storage helper'ları](https://supabase.com/docs/guides/storage/schema/helper-functions).

## Resend

Kullanıcı kararı (1 Kasım 2026): Lawroom için yeni domain beklenecek. Dietroom yalnız tasarım/akış benchmark'ıdır; onun domaini, API anahtarı, SMTP ayarı, veritabanı veya bildirim kuyruğu Lawroom'a bağlanmaz. Bu oturumda Resend anahtarı oluşturulmadı ve SMTP değiştirilmedi.

Auth e-postaları için Supabase SMTP: `smtp.resend.com`, port `465`, kullanıcı `resend`, parola Resend API anahtarı. Anahtar yalnız Supabase sunucu ayarında saklanır. Kendi doğrulanmış domaini olmadan `onboarding@resend.dev` yalnız Resend hesabının kendi adresine test gönderebilir; genel kullanıcı kayıtlarına hazır sayılmaz.

Bildirim worker'ı `supabase/functions/notification-worker/index.ts` içindedir. Varsayılan `NOTIFICATIONS_ENABLED=false`. Sunucu sırrı olmadan çağrı reddedilir. Worker her alıcıyı gönderimden hemen önce yeniden yetkilendirir; içerik dosya başlığı, kişi adı veya hukuki ayrıntı içermez. Sabit Resend idempotency anahtarı ve teslim denemeleri vardır. 24 saatlik sağlayıcı idempotency penceresi aşılmadan otomatik tekrarlar durdurulur.

Önce `functions/.env.example` değerleri sunucuya secret olarak yüklenmeli; test alıcısı ve doğrulanmış gönderen ile tek teslim denenmeli. Sonra worker etkinleştirilip bir dakikalık cron eklenmeli. Günlük özet ve takvim hatırlatıcıları henüz eklenmedi. Cron şu anda kurulmadı; gerçek gönderim yapılmadı. [Resend idempotency penceresi](https://resend.com/changelog/idempotency-keys) 24 saattir; kuyruk bu pencere dolmadan otomatik tekrarları durdurur.

Kaynaklar: [Resend–Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp), [resend.dev test sınırı](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

## Yayın ve domain geçişi

GitHub Pages yalnız statik arayüzü sunar. Auth, SQL ve Storage Supabase'de; e-posta sunucu tarafında çalışır. Pages üzerinde hiçbir Resend anahtarı bulunmaz.

Workflow `lawroom/` için kurulum, domain testleri, SQL erişim testleri ve üretim derlemesini çalıştırır. Yayın varsayılan olarak **demo** modundadır. Canlı moda ancak uzak migration, Auth ve e-posta akışı doğrulanınca geçilir.

Domain alındığında Pages custom domain/DNS, `VITE_BASE_PATH`, Supabase Site URL/dönüş adresleri, worker `APP_URL` ve Resend SPF/DKIM ayarları güncellenir. Kullanıcı ve dosya veritabanını yeniden kurmak gerekmez.
