# Dosya takibi kabul kaydı — 2 Kasım 2026

## Son doğrulama

- Ortak `npm test`: **105/105**, hata yok.
- `npm run test:sql`: **8/8**, hata yok. Bu testler PGlite/PostgreSQL rollerini kullanır; gerçek Supabase Auth/Storage HTTP testi değildir.
- `npm run build:pages`: başarılı, 1722 modül, 1,78 sn; iki JS chunk (ana paket 490,62 kB, XLSX parser 66,21 kB).
- 500 dosya / 10 bin olay indeksleme+arama+sıralama medyanı kabul sınırı **300 ms altında**. Eşzamanlı yüklü testte önce 412 ms hatası görüldü; toplu dikkat sonucunun satır başına tekrar hesaplanması kaldırıldı. Aynı sonuç/girdi korunması için regresyon testi eklendi. Düzeltme turunda 135,6 ms ölçüldü; eşik değiştirilmedi. Son ortak suite tekrar geçti.
- Statik React kontrolü: hook sırası korunur; timer/Blob URL/klavye dinleyicilerinin temizliği var; formlarda alan adları ve hata durumları, diyalogda odak çevrimi/Escape, sekmelerde ok/Home/End ve seçili tabIndex mevcut.

## Gerçek tarayıcı akışları

Yerel demo, `http://127.0.0.1:5181/`; sunucu ve arayüz gerçek React/Vite uygulamasıdır. Kurgusal örnekler/QA kayıtları kullanıldı; canlı hukuk dosyası, kullanıcı veya e-posta işlemi yapılmadı.

1. Liste → Ticari alacak → kokpit. Hesaplanan sıradaki iş görünür. Numara ve eski şablon aşaması doğru görüntülenir.
2. Safahat → Tebligat alındı → tarih/yöntem/kaynak → iki görev önerisi + tarihsiz süre incelemesi → kaydet. İki görev ile öneri birlikte oluştu; öneri kendiliğinden kesin tarihe dönüşmedi.
3. Süre kontrolü → sentetik QA dayanağı, kaynak, inceleme sürümü, son gün ve açık avukat onayı → audit'te kişi/zaman göründü.
4. Aşama → gerekçeli değişiklik → yeni aşama ve geçmiş. Görev → yeni tarih + erteleme gerekçesi → eski tarih ve gerekçe korundu.
5. Kapanış kontrolü → açık görev ve süreler listelendi; arşiv düğmesi kapalı kaldı. Domain/repository testleri ayrıca kapalı dosyada mutasyon reddini ve gerekçeli yeniden açmayı doğrular.
6. Dosya ajandası → geçmiş QA duruşması → sonuç + iki ara karar görevi + sonraki duruşma → kaydet. Ortak takvim/ajandada eski kayıt tamamlandı, yeni duruşma 20 Kasım 10:00 göründü. Tarihler sentetik test verisidir.
7. Belgeler → uygulamanın kurgusal Welcome ekran görüntüsünü gerçek file chooser ile yükle → IndexedDB Blob, sürüm 1 ve SHA-256 kaydı → resim önizlemesi görüntülendi. Saf repository testleri iki gerçek byte sürümünü, eski sürümün korunmasını, paylaşım kapatılınca yeni indirme reddini, hata temizliğini ve yalnız açık belge talebine müvekkil yüklemesini doğrular.
8. Müvekkil rolü → paylaşılan İşe iade dosyası: sade aşama, yalnız paylaşılan rapor ve özet, mesaj alanı. İç not, özel safahat, çalışma hedefi ve avukat süre hesabı ekranda yok. Canlı ağ DTO kabulü ayrıca bekler.
9. Dosya URL'sine `matter` ID'si yazıldı; yenilemede aynı yetkili demo dosya açıldı. Geri/listede parametre temizlenir.
10. Sekmede ArrowRight ile Safahat seçildi (`aria-selected=true`). 390×844 mobil görünümde içerik genişliği 375, viewport 390; yatay sayfa taşması yok. Sıradaki iş üstte, hızlı işlemler altta. Modal/form mobilde kaydırılabilir.
11. Tarayıcı hata/uyarı günlüğü: boş.

Liste/sihirbaz, gerçek CSV/XLSX aktarımı, geri alma, çoklu sorumlu/arşiv ve bağlamsal komut paleti için ek kabul: [workbench kaydı](verification-workbench-local.md).

## Ekran kanıtları

- [Masaüstü kokpit](screens/tracking-cockpit-desktop.jpg)
- [390px mobil kokpit](screens/tracking-cockpit-mobile.jpg)
- [Süre ve görevler](screens/tracking-deadlines-desktop.jpg)
- [Açık iş varken kapanış reddi](screens/tracking-close-blocked.jpg)
- [Gerçek belge önizleme](screens/tracking-document-preview.jpg)
- [Duruşma döngüsü ortak takvim](screens/tracking-hearing-calendar.jpg)
- [Sade müvekkil ekranı](screens/tracking-client-desktop.jpg)

## Açık kalan kabul

Yeni aggregate işlemleri demo repository'sindedir. Canlı ekip/RLS/RPC/Realtime, bucket ve gerçek Auth kullanıcılarıyla E2E kabulü yapılmadı. PDF için tarayıcı görüntüleyicisi kullanılıyor; çok sayfalı pdf.js kabulü ayrı. Hukukçu onaylı kural/tatil kataloğu, ICS token iptali, büro davetleri, AI sağlayıcısı ve canlı blog yayın akışı açık. [49 ticket'ın gerçek durumu](tracking-status.md).
