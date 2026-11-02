# Supabase canlı geçiş kaydı — 2 Kasım 2026

Hedef yalnız `lawyer` organizasyonu (`tvggccajnkjplhalnmhj`) / `lawportal` (`deezwydtiibbdtimxcxf`). Kullanıcı canlı uygulamayı ve proje kapsamındaki devam işlemlerini açıkça onayladı. Resend için önceki Lawroom domainini bekleme kararı geçerlidir.

## Erişim ve başlangıç

- Bu sohbetin Supabase eklentisi hâlâ eski hesabı seçiyor; hedef proje çağrısı permission denied. Ayrı CLI `lawroom` profili `Unsupported Config Type ""` hatası veriyor.
- Supabase Dashboard oturumunda doğru organizasyon/proje **Healthy** olarak açıldı. SQL Editor üzerinden gerçek sunucuda salt okunur sorgular başarılıdır. Bu yüzden “canlı projeye hiç erişim yok” ifadesi artık doğru değildir.
- Sunucu PostgreSQL 17.6; 15 foundation `lr_` tablosu, 99 kolon. Auth kullanıcıları, Lawroom hesapları ve hukuk dosyaları **0**; mükerrer başvuru **0**; bucket ve Realtime yayın üyelikleri boş. Migration history tablosu yok.
- Şema metadata snapshot'ı `.supabase/live/catalog-before.json` içinde yalnız yerelde, gitignore kapsamındadır; müşteri/kullanıcı satırı veya credential içermez. Kolon, kısıt, indeks, RLS/policy, fonksiyon, grant ve trigger metadata'sını kapsar.
- Foundation fixture'ı ile karşılaştırma: **99 kolon, 53 kısıt, 30 indeks, 23 policy, 4 helper fonksiyon eşleşti**. PostgreSQL sürümleri arasındaki NOT NULL katalog temsili farkı kolon nullability'si üzerinden kontrol edildi; fonksiyon metinlerinin yalnız whitespace farkı normalize edildi. Foundation uzakta tekrar çalıştırılmadı. Bu katalog karşılaştırması CLI `db pull` / `db diff` komutlarının çalıştığı anlamına gelmez.

## Uygulama paketi

Mevcut dört migration sırasıyla: `20261101191736_identity_onboarding`, `20261101191740_private_documents`, `20261101191742_notification_delivery`, `20261101221002_002_matter_tracking`. Kaynak dosyalar değiştirilmedi. Sonuncunun SHA-256'sı `B35D100ABB68C39B78060A1C4EAA17EAA120F887282ABF00C381161ED06A6F7A`.

Yerel deployment wrapper `.supabase/live/` içinde: tek transaction, lock/statement timeout, başlangıçta boş hesap/dosya/Auth ve 99 kolon guard'ı, sonda 32 tablo/299 kolon/tam RLS/özel 20MB bucket/ham tablo grant reddi kontrolleri. Migration içindeki dinamik RLS döngüsüne ek olarak bütün yeni tablolar için açık ENABLE RLS komutları vardır. Legacy altı site tablosu kapsam dışıdır.

Dashboard ilk denemede dinamik RLS döngüsünü statik olarak göremedi. “Run without RLS” eylemi otomatik incelemede reddedildi. Daha güvenli “Run and enable RLS” seçildi; Dashboard'ın ek RLS işlemleri rollback sonrasında artık bulunmayan tabloyu arayınca deneme hata verdi. Sonraki salt okunur sorgu başlangıcın korunduğunu doğruladı: **99 kolon, tracking tablosu yok, bucket 0**. Wrapper'a açık ENABLE RLS komutları eklenerek gerçek RLS koruması ayrıca sağlandı; uyarı bastırılmadı.

## Kalıcı uygulama ve doğrulama

Geri alınan deneme `dry_run_rolled_back / true / true` ile tamamlandı. Aynı dört dosya, açık RLS komutları ve postflight guard'larıyla **tek transaction'da COMMIT edildi**. Sonuç: `release_committed / 32 / 299`.

- Yeni canlı snapshot `.supabase/live/catalog-after.json`. Fixture ile **299 kolon, 155 kısıt, 68 indeks, 39 public policy, 100 public/private fonksiyon ve 17 trigger** eşleşti; iki Storage policy'si public policy sayısına dahil değildir. 32 Lawroom tablosunun tamamında RLS açık. Altı legacy tablonun kolon/kısıt/indeks/policy/trigger/grant metadata'sı başlangıçla aynı kaldı.
- Dashboard Storage: **`lr-matter-files`, private, 20 MB, 2 policy**. PDF/PNG/JPEG/DOCX/UDF için mevcut MIME listesi korundu. Üzerine yazma/silme açılmadı.
- Auth Site URL: `https://emreaktepe.github.io/law/`. Tam allow-list: aynı Pages adresi, `http://127.0.0.1:5178/`, `http://127.0.0.1:5173/`. Geniş wildcard yok. E-posta sağlayıcısı açık, e-posta doğrulaması gerekli; anonim sign-in ve manual linking kapalı kaldı.
- Yeni anahtar oluşturulmadı. Mevcut legacy **anon** anahtarının proje/rol claim'i doğrulanarak yalnız gitignore kapsamındaki yerel HTTP kontrol yapılandırmasına alındı; service_role/secret açılmadı veya kopyalanmadı.
- **6 gerçek HTTP kontrolü başarılı:** Auth settings 200 ve confirmation required; ham hesap/dosya tabloları ile iki tracking RPC anonim isteğe 401/42501; özel bucket metadata'sı anonimden görünmüyor. Bucket için NoSuchBucket yanıtı tek başına dosya baytları erişim kabulü sayılmadı.
- [Canlı rol/RPC testi](../supabase/live-acceptance.sql) gerçek sunucuda başarılı: owner create + aynı UUID ile tek dosya, özel not, müvekkil allow-list ve mesaj, viewer write reddi, admin/ilgisiz avukat read reddi, ilişki iptalinde read reddi. Sentetik Auth/account/matter kayıtlarının tamamı **ROLLBACK** edildi; kalan kullanıcı/hesap/dosya **0/0/0**. Bunlar gerçek DB rol/RPC testidir; gerçek Auth token issuance veya Storage bayt testi değildir.
- Health Advisor 0 hata; Security Advisor'ın 6 hatası önceki altı legacy tabloda RLS kapalı olmasına ait. 23 warning/4 info da incelendi; GraphQL şema keşfedilebilirliği uyarıları vardır. Uygulamanın kendi hesabı gibi RLS ile sınırlandırılan tablo erişimleri otomatik olarak kaldırılmadı. Legacy güvenlik işi [ayrı planda](legacy-rls.md) açık kalır; “bütün proje advisor'ları temiz” iddiası yoktur. [RLS rehberi](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Kalan sınırlar

Yeni UI flag'i kapalı; GitHub Pages yayını demo olarak kaldı. Canlı frontend yayını bu işlemle yapılmadı. Gerçek Auth oturumu, e-posta teslim/dönüşü, iki kullanıcıyla Storage HTTP baytları ve Realtime uçtan uca kabulü açık; SMTP, worker, cron veya Realtime yayın üyeliği etkinleştirilmedi. Resend Lawroom domainini bekler.

**Migration history uzlaştırması açık:** Dashboard SQL uygulaması CLI history kaydı oluşturmaz. Dört dosya artık gerçek şemaya uygulanmıştır; **tekrar çalıştırılmamalıdır**. Foundation da tekrar uygulanmaz. CLI erişimi düzeldiğinde mevcut şema db pull ile alınmalı, baseline ve bu dört dosyanın uygulanmış geçmişi gözden geçirilerek uzlaştırılmalı; kör `db push`/history repair yapılmamalıdır. Şema uygulanmışken geçmişi uygulanmamış gibi sunmak veya CLI baseline/boş diff tamamlandı demek doğru değildir. [Resmi history onarım rehberi](https://supabase.com/kb/troubleshooting/branch-in-migrations-failed-status).

Yerel otomatik suite'in önceki son sonucu 128 unit + 34 SQL + Pages build1729'dur; bu canlı çalışma kaynak UI/SQL migration dosyalarını değiştirmedi. Yeni canlı kanıtlar:

- [Kalıcı migration sonucu](screens/supabase-live-migrations.png)
- [Bucket](screens/supabase-live-bucket.png)
- [Auth dönüş adresleri](screens/supabase-live-auth-urls.png)
- [Geri alınan canlı rol testi](screens/supabase-live-role-tests.png)
