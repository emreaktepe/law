# Lawroom — Giriş, ilk kurulum ve yayın paketi

Güncel kurulum ve canlıya geçiş sırası: [release-setup.md](docs/release-setup.md). Ürün planı: [agents.md](agents.md). Aşağıdaki eski prototip notları arşivdir.

## Güncel çalıştırma

Node 22.12+ (önerilen 24), `lawroom/` dizininde `npm ci`, `npm run dev -- --port 5178`. Kontroller: `npm test`, `npm run test:sql`, `npm run build`.

Bağımlılıklar bağımsızdır; DietApp junction'ı kaldırıldı. Bu bilgisayarın genel npm hedefi `os=linux` olduğu için repo-local `.npmrc` gerçek host platformunu kullanacak şekilde ayarlandı. Genel ayar değiştirilmedi. Son kaynakta standart `npm ci && npm run build:pages` başarılıdır.

## Güncel kapsam

- Giriş, kayıt, üç adımlı ilk kurulum ve onay bekleme ekranları; masaüstü ve mobil düzen.
- Supabase PKCE magic link, sunucu hesabından rol/durum okuma; ayrı demo ve canlı repository'leri.
- Canlı çalışma alanı kodu: dosya oluşturma/listeleme, avukat kabulü, dosya/belge paylaşımı, mesaj, özel belge yükleme/indirme.
- Yeni SQL migration'ları: başvuru/onay RPC'leri, özel 20 MB bucket ve Storage RLS, bildirim kuyruğu/teslim kayıtları.
- Varsayılan kapalı Resend worker'ı; Auth e-posta şablonu, SQL erişim testleri ve Pages workflow'u.

`.env.example` içindeki `VITE_DATA_MODE=demo` varsayılandır. Giriş ekranlarında e-posta gönderilmez; ilk kurulum önizlemesi kalıcı başvuru oluşturmaz. İstemciye yalnız publishable/anon anahtarı verilir; service role ve Resend anahtarı sunucuda kalır.

Rotalar: `#/giris`, `#/kayit`, `#/ilk-kurulum`, `#/oturum`; eski `#demo?...` bağlantıları korunur. Pages `/law/` alt yolunu destekler. Yayın demo modunda başlar; gerçek kişi profilleri yerine kurgusal örnekler kullanılır.

## Canlıda bekleyenler

Dashboard envanteri okundu; MCP/CLI hesabı doğru `lawportal` projesine erişemedi. Uzak migration'lar ve bucket **henüz uygulanmadı**, gerçek Auth/Storage HTTP akışı sınanmadı. Önce baseline alınmalı; `foundation.sql` tekrar çalıştırılmamalı.

Resend gönderen domaini ve sunucu anahtarı henüz yapılandırılmadı. Gerçek e-posta gönderilmedi. Büro davetleri, canlı takvim, belge sürümleri/PDF önizleme, günlük özet ve Kâtip AI yol haritasında devam ediyor. Bütün ürünün canlıya hazır olduğu iddia edilmez.

---

## Önceki prototip notları — arşiv

1 Kasım 2026 tarihli ilk etkileşimli prototip. Mevcut `es-avukatlik` sitesi korunmuştur; yeni uygulama bu alt dizindedir.

## Çalıştırma

Node 22.12+ ile `npm install`, `npm run dev`. Kontroller: `npm test` ve `npm run build`.
Bu çalışma bilgisayarında kurulu DietApp bağımlılıkları node_modules junction ile kullanılmıştır; kaynak depoya dahil değildir. Temiz bir bilgisayarda npm install gerekir.

## Çalışan kapsam

Avukat, müvekkil ve admin demo görünümleri; dosya oluşturma; arama/tür/öncelik filtresi; türe göre aşamalar; görevler; tarihli safahat; iç notlar; açık özet ve dosya paylaşımı; yerel örnek yazışmalar; admin ataması ve ayrı avukat kabulü; resmî kaynak bağlantıları. Dosya verileri localStorage içinde, başvurular oturum belleğinde saklanır. Tüm isimler örnektir.

## Henüz canlı olmayan kapsam

Kimlik doğrulama, çok kiracılı veritabanı/RLS, büro avukat davetleri, gerçek müvekkil ilişkilendirme, belge yükleme/önizleme, Resend gönderimi, otomatik bildirimler ve AI/MCP entegrasyonu henüz uygulanmadı. Rol seçici bir demo kontrolüdür, güvenlik sınırı değildir. Gerçek veri girilmemelidir.

Supabase eklentisi yetki hatası vermeye devam ediyor; açık Dashboard üzerinden şema incelendi ve erişim korumalı 15 portal tablosu oluşturuldu. Arayüz henüz canlı verilere bağlanmadı. Ayrıntılar docs/live-status.md içinde. Resend gönderen alanı ve sunucu gizlisi sağlanmadı. UYAP linkleri bağlantıdır, senkronizasyon değildir. Yasal süre hesaplama motoru yoktur; tarih karşılaştırmaları yalnız kayıtlı çalışma hedeflerini sınıflandırır.

## Tasarım ve ürün kararları

- `design/lawroom.pen`: dört düzenlenebilir ekran; avukat listesi, dosya detayı, müvekkil görünümü, admin başvuruları.
- pen.dev açma çağrıları başarılı görünse de execute çağrıları zaman aşımına uğradı. Bu yüzden .pen, belgelenmiş şemaya göre yerelde üretildi. Editörde görsel doğrulama tamamlanamadı; özel maskot üretimi doğrulanmadı. Arayüzde şimdilik standart yardım simgesi var.
- `docs/product.md`: roller, dosya modeli, akışlar, kabul ölçütleri.
- `docs/research.md`: kaynaklı benchmark ve entegrasyon değerlendirmesi.

Doğrulama: dört alan testi ve Vite üretim derlemesi başarılı; önizleme HTTP 200. Tarayıcı otomasyonu zaman aşımı nedeniyle görsel/etkileşimli uçtan uca test tamamlanamadı. GitHub'a gönderilmedi, canlı yayın yapılmadı.


## Tanıtım sayfaları

Demo menüsündeki Avukat sayfaları bölümü Alkım Azmioğlu ve Enes Can Yolcu profillerini içerir. Kaynak ve kapsam notları docs/public-profiles.md içindedir. Son çalışmada tarayıcı erişimi sağlandı; iki profil ve başvuru önizlemesi etkileşimli olarak doğrulandı.
