# Değişiklik günlüğü

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
