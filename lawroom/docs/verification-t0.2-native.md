# T0.2 — Temiz kurulum ve native paket seçimi

1 Kasım 2026. Kullanıcı npm ayarında `os=linux` bulundu; çalışan Node platformu `win32`, mimarisi `x64`. Bu nedenle boş klasörde `npm ci` başarılı görünmesine rağmen Windows native Rolldown paketi kurulmadı ve Vite build başarısız oldu. Var olan node_modules ile build geçmesi temiz kurulum kanıtı değildi.

Repo-local `.npmrc` içindeki boş `os=` değeri üst kapsamın çapraz platform seçimini sıfırlar. Npm native paket çözümlemesi host `process.platform` değerine döner. Windows'a sabit bir `os=win32` yazılmaz; Linux/macOS CI da kendi platformunu kullanır. Global/kullanıcı npm ayarı değiştirilmedi; credential veya registry ayarı eklenmedi.

İzole snapshot'ta mevcut node_modules ve `.env` kopyalanmadan, lockfile'dan temiz kurulum yapıldı. Önce varsayılan ayarla native-binding eksikliği üretildi. Sonra yalnız `.npmrc` değişikliğiyle `npm ci`, 11 birim testi, 8 PGlite SQL erişim testi ve Vite build geçti. Lockfile SHA256: `B22F70491BBB08BA3D917C73DD8A9944D246322C26D27FD3C65AB83E4359D4C9`; build 1633 modül, 1.36 sn. Bu kanıt o snapshot'a aittir; kaynak ajanın devam eden package.json/lockfile düzenlemesinden sonra son uygulama sürümünde yeniden doğrulanmalıdır.

Eski `node_modules.dietapp-junction` yedek bağlantısının kaldırılması ve son temiz CI kanıtı ayrıca kaydedilmeden T0.2 tamamen kapatılmaz.

Son paket doğrulaması: yedek junction yalnız bağlantı olarak kaldırıldı; hedef klasör silinmedi. Güncel lockfile ile **standart `npm ci` ve `npm run build:pages` başarılı** (37 paket eklendi, 0 vulnerability; 1634 modül, 1.38 sn). Son lockfile SHA256: `708b3d8aedf27db2d505bbbafa094085f8eb082dacf5a9b25e812fc7cc77f527`. Güncel testler 37 domain/repository + 8 PostgreSQL erişim testidir. GitHub CI sonucu ayrıca yayın kaydına eklenir.

Resmî npm referansları: https://docs.npmjs.com/cli/v11/commands/npm-ci/ ve https://docs.npmjs.com/cli/v11/using-npm/config/#os .

Son kaynak surumu (T2.2 modulleri dahil) 19:45 UTC saatinde yeni bos snapshot ile yeniden dogrulandi: npm ci, 19 birim testi, 8 SQL testi ve build basarili; .env ve mevcut node_modules kopyalanmadi, lockfile ayni kaldi. Kaynak gorevin package/lock duzenlemesi devam ettigi icin yedek junction ve son notlarin birlestirilmesi bekliyor.
