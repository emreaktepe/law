# T0.1 — Son durum doğrulaması

Tarih: 1 Kasım 2026. Çalışma dizini: `portal/lawroom/`.

Durum: **T0.1 tamamlandı.** Giriş/kurulum paketinin canlı Supabase uygulaması ayrıca bekliyor.

## Kontrol edilen akış

Tanıtım ana sayfası → demo girişi → avukat/müvekkil çalışma alanı → takvim. Mevcut uygulama React state ve localStorage kullanıyor; bu ticket kapsamında canlı API veya Supabase erişimi sınanmadı.

## Test sonucu

Komut: `npm test`

```text
✔ Pazartesi başlangıcı ve yıl geçişi
✔ çakışma yalnız aynı avukatın aktif ve kesişen saatlerinde
✔ tarih, süre ve paylaşım doğrulama
✔ müvekkil yalnız erişebildiği dosyanın paylaşılan etkinliğini görür
✔ admin dosya içeriği görmez, müvekkil sadece paylaşılan kendi dosyasını görür
✔ admin ataması avukat kabulü yerine geçmez
✔ süreler İstanbul takvim gününe göre karşılaştırılır
✔ icra ve idari süreçler dava şablonundan ayrılır
tests 8
pass 8
fail 0
duration_ms 291.2241
```

Bunlar mevcut domain testleridir; canlı RLS veya tarayıcı doğrulaması yerine geçmez.

## Üretim derlemesi

Komut: `npm run build`

```text
vite v8.3.5 building client environment for production...
✓ 1575 modules transformed.
dist/index.html                   0.41 kB │ gzip:  0.29 kB
dist/assets/index-BF3ETrd0.css   28.41 kB │ gzip:  6.69 kB
dist/assets/index-DZswtmpv.js   281.18 kB │ gzip: 86.47 kB
✓ built in 1.64s
```

## Çalıştırma

Komut: `npm run dev -- --port 5178 --strictPort`

```text
VITE v8.3.5 ready in 599 ms
Local: http://127.0.0.1:5178/
```

Sunucu başlangıcı doğrulandı. HTTP/modül isteklerini kontrol eden ek PowerShell komutu sonuç vermedi ve durduruldu; HTTP 200 sonucu doğrulanmış sayılmadı. Kontrol sonunda geliştirme sunucusu da durduruldu.

## Tarayıcı doğrulaması — erişim açıldıktan sonra

İlk denemede tarayıcı şu yanıtı verdi; sonraki oturumda erişim açıldı ve aşağıdaki kontroller tamamlandı:

```text
Local browser use is disabled in Work settings
```

Tamamlanan kontroller:

- Welcome ekranının varsayılan açılışı, demo girişleri ve tanıtıma dönüş.
- Takvimde ay/hafta/ajanda, dönem gezinmesi, tür filtreleri, gün seçimi ve metinli rozetler.
- Demo etkinliği oluşturma, çakışma uyarısı, tamamlandı/iptal durumları ve yeniden yüklemede yerel kayıt.
- Müvekkil takviminde yalnız paylaşılan dosyaların paylaşılan etkinlikleri; admin menüsünde dosya içeriği bulunmaması.
- Masaüstü ve mobil yerleşim, klavye ile gezinme ve odak görünürlüğü.
- Gerçek ekran görüntülerinin `docs/screens/` altında kaydedilmesi.

Kurgusal `T0.1 demo kontrolü` etkinliği oluşturuldu; çakışma uyarısı, yeniden yüklemede kalıcılık, müvekkil paylaşımı, tamamlandı ve iptal durumları denendi. İptal edilen test kaydı varsayılan listede gizlidir. Admin menüsünde yalnız Başvurular/Sistem durumu görüldü. Bunlar demo kontrolleridir.

Yeni giriş, kayıt ve büro ilk kurulumunun seçim → bilgi → kontrol → bekleme akışı 1440×1000 ve 390×844 görünümde kontrol edildi. Mobil sayfada yatay taşma görülmedi; takvim kendi kaydırma alanını kullanır. Tarayıcı hata kaydı boştu. Ekran görüntüleri `docs/screens/` içindedir.

## Paket doğrulaması

- `npm ci --os=win32`: başarılı; bu makinenin genel npm hedefi Linux olarak ayarlı, genel ayar değiştirilmedi.
- Son paket: **37/37 domain/repository testi**, **8/8 SQL testi**, `npm run build` ve `/law/` için `npm run build:pages` başarılı.
- Repo-local `.npmrc` sonrasında standart `npm ci` ve Pages derlemesi de başarılı; yedek junction kaldırıldı.
- Üretim paketi `http://127.0.0.1:5180/law/` altında açıldı. Giriş rotası ve Kâtip görseli doğru alt yoldan yüklendi; klavyede Tab ile giriş düğmesine odak ve görünür odak halkası doğrulandı. Console error/warning kaydı boştu.
- SQL matrisi: **8 test geçti**. PGlite geçici PostgreSQL üzerinde gerçek roller/RLS ile çalıştı. Yetkisiz erişim, rol yükseltme, atama/kabul/paylaşım ayrımı, eksik yükleme, iptal sonrası Storage erişimi, anonim RPC reddi, outbox tekrarları ve alıcı yeniden yetkilendirmesi sınandı.
- `deno check supabase/functions/notification-worker/index.ts`: başarılı.

Uzak migration, Auth magic link dönüşü, gerçek Storage HTTP işlemleri ve Resend teslimi henüz test edilmedi. Test ortamındaki Auth/Storage şeması fixture'dır; canlı hizmet doğrulaması yerine geçmez. Uzak `db pull`/`db diff` doğru hesap erişimini bekliyor.
