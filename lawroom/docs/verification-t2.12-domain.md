# T2.12 — Dikkat sıralaması domain katmanı

1 Kasım 2026. `src/domain/attention.js` AGENTS.md Bölüm 6.8'deki dokuz kademeyi uygular: geçmiş doğrulanmış süre; bugün/yarın doğrulanmış süre; doğrulama bekleyen öneri; 48 saat içindeki hazırlık görevli duruşma; gecikmiş görev; sonucu beklenen geçmiş duruşma; 24 saat yanıtsız müvekkil mesajı; 7 gün içindeki işlem; 30 gün sessiz aktif dosya.

Her dosya için en yüksek tek kademe, yazılı neden, tarih ve kaynak kimliği döner. Eşit kademede tarihe göre sıralar. Arşiv/kapalı dosyaları dışarıda tutar; eşikler seçenekle değişebilir. Saat dilimi Europe/Istanbul; tarih-only ve açık offsetli timestamp desteklenir; geçersiz takvim günleri veya offsetsiz saatler tahmin edilmez.

Bir süre yalnız `status=verified` olduğu için kesin kabul edilmez: doğrulayan, doğrulama zamanı, dayanak, kaynak referansı, kural sürümü, tetikleyici tarih ve teblig yöntemi gerekir. Eksikse doğrulama bekleyen kademe 3'e döner. Manuel targetDate çalışma hedefidir ve hukuki süre olarak etiketlenmez.

Fonksiyon yetki filtresi yerine geçmez; caller yalnız kullanıcının yetkili dosyalarını vermelidir. Çıktı özel notları veya mesaj gövdesini taşımaz. Girdi değişmez. Başlamış ama henüz bitmemiş duruşma sonuç bekliyor sayılmaz; yeni müvekkil mesajı eski yanıtsız mesajın bekleme süresini sıfırlamaz.

`tests/attention.test.js`: 11/11 test geçti; dokuz kademe, İstanbul yıl/gün sınırı, kapalı arşiv, invalid date, metadata eksiği, eşik, girdi değişmezliği ve özel alanların çıkmaması kapsanır.

Bu yalnız T2.12'nin domain bölümüdür. Bugün ekranı, repository adaptörü ve tek tık eylemler henüz bağlanmadığı için ticket tamamlanmış sayılmaz. Yeni bir UI veya canlı DB değişikliği yapılmadı.
