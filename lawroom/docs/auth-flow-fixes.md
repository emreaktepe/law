# Oturum akışı kırılmaları — 2 Kasım 2026

Kullanıcı “Neden tamamlamıyoruz kırılmaları” dediğinde Docker engelinden bağımsız uygulama akışı incelendi. Amaç: giriş bağlantısı → sunucuda doğrulanmış kullanıcı → o hesaba ait kimlik → uygun ekran; çıkış ve hesap değişiminde önceki kimliğin dönmemesi.

## Düzeltilen davranışlar

1. **PKCE dönüşü:** kod URL'den kaldırıldıktan sonra boş hash'te Welcome öncelik alıyordu. Kök rota artık Auth yüklenmesini bekler; geçerli oturumda çalışma alanı/ilk kurulum akışını açar.
2. **Yüklenirken çıkış:** önceki kimlik isteği iptal edilince `loading` true kalabiliyordu. Oturum ve kimlik tek store snapshot'ında güncellenir; çıkış hemen boş kimlik ve loading=false üretir.
3. **Geç gelen yanıtlar:** başlangıç getSession, kimlik yüklemesi veya refresh yanıtı yeni hesabı/eski çıkış sonucunu ezemez. getUser sonucu oturum ID'siyle, repository kimliği de aynı ID ile eşleşir. Auth callback'i içinde kilidi tutan ağ çağrısı yapılmaz; StrictMode yeniden başlatması tek abonelik bırakır.
4. **Süresi dolmuş bağlantı:** callback hatası sessizce normal giriş ekranına düşüyordu. Sabit, anlaşılır hata ve yeni bağlantı isteme eylemi vardır; retry eski code/error parametrelerini temizler. Sağlayıcı hata açıklaması ekrana yansıtılmaz.
5. **Migration sonrası eski API'ye dönüş:** yeni UI kapalıyken etkin nonadmin kullanıcı eski LiveWorkspace ham tablo çağrılarına gidiyordu; bu grant'ler 002'de kaldırıldı. Artık hazırlık ekranı açılır, eski sorgular denenmez. Admin yönetim ekranında kalır; yeni UI yalnız açık gate ile seçilir.

## Kanıt

- `tests/auth-session.test.js`: 10 anlamlı regresyon; stale initial session, yüklemede çıkış, hesap değişimi, stale refresh, getUser/identity uyuşmazlığı, StrictMode, kod temizlenmesi, expired callback, kapalı gate/legacy çağrı sınırı.
- Gerçek tarayıcı + sentetik Auth: kod temizlendikten sonra pending hesabın ilk kurulumu açıldı; bekleyen kimlik sırasında çıkış giriş ekranına döndü; yeni müvekkil geldikten sonra eski avukat yanıtı kimliği değiştirmedi. Expired callback kurtarma eylemi temiz giriş URL'sine döndü. Console error/warn yok.
- [Hesap değişimi kanıtı](screens/auth-stale-session-fixed.png), [süresi dolan bağlantı](screens/auth-expired-link-fixed.png).
- Son tam yerel suite **138/138 unit/entegrasyon**, SQL **34/34**, Pages build **1731 modül/1.23 sn** başarılı. Son 500 dosya/10 bin olay benchmark'ı kabul eşiğinin altında kaldı. Önceki 128/34 veya önceki yayın 105/8, bu ek regresyonların sonucu değildir. Yeni UI gate kapalı ve Pages build demo modundadır.

## Gerçek servis kabulü

`tests/live/auth-storage.mjs` ayrı, açık opt-in betiğidir; normal `npm test` veya Pages CI içinde çalışmaz. Sabit lawportal hedefini, boş hesap/dosya/Auth başlangıcını ve mevcut server anahtarının proje/rol claim'ini doğrular. Dört sentetik Auth hesabı için sağlayıcıdan gerçek tek kullanımlık oturum üretimi, RPC/DTO erişimi, yetkili/yetkisiz Storage baytları, sürüm/üzerine yazma/silme sınırı, belge talebi ve ilişki/üyelik iptalini sınar. Yalnız bu run'da kaydedilen UUID ve yollar temizlenir; silme öncesinde Auth kullanıcı metadata'sındaki run sahipliği kontrol edilir. Anahtar VITE değişkenine veya repoya girmez; geçici server aktarım dosyası test başlarken silinir.

**Bu gerçek servis testi henüz çalıştırılmadı.** Mevcut service_role anahtarını açma eylemi otomatik incelemede reddedildi; bu hassas anahtarın yalnız lawportal testi için kullanılması konusunda açık kullanıcı onayı bekleniyor. Ret, başka araç veya dolaylı yolla aşılmadı. Yeni secret/API key, test hesabı veya canlı DML bu turda oluşturulmadı. SMTP teslimi, gerçek tarayıcı PKCE exchange ve uygulamaya ait Realtime teslimi ayrıca açık; betik bunları tamamlandı diye sunmaz.
