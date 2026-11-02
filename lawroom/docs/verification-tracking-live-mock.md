# Varsayılan kapalı tracking UI — sentetik kabul

Bu kayıt mevcut T2/T3/T4 arayüzlerinin server DTO/adapter ile **yerel geçiş hazırlığını** doğrular. Yeni ürün özelliği veya canlı kabul değildir. Migration002 uygulanmadı; gerçek Supabase bağlantısı, credential kurulumu, Docker kurulumu, bucket/Auth/Realtime/SMTP değişikliği veya yayın yapılmadı.

## Sahiplik ve giriş

Kaynak LawRoom oturumu `TrackingLiveWorkspace`, controller/payload sözleşmesi, document bridge ve mevcut tracking bileşenlerinin dependency injection refactor'ını sahiplendi. Bu görev bu dosyalara paralel yazmadı; bağımsız fixture, adapter/controller entegrasyon testi, üç SQL pipeline testi ve browser harness'i hazırladı. Kullanılmayan ikinci controller taslağı repoya eklenmedi.

- `VITE_TRACKING_V2_ENABLED=false` varsayılandır. Yalnız literal `true`, etkin nonadmin akışında lazy v2 ekranını seçer. Hash/query ile açılmaz; admin eski yönetim ekranında kalır. Normal demo/live varsayılanı değişmedi.
- `TrackingWorkspaceView({repository,session,identity,onSignOut})` named export'üne yalnız sentetik repo/kimlik enjekte edildi. Gerçek Auth wrapper mount edilmedi.
- `tests/ui/serve-tracking-workspace.mjs`: configFile=false, ayrı boş envDir, yalnız LAWROOM_UI_TEST_ prefix; gerçek VITE_SUPABASE_* değerleri yüklenmez. Harness CSP'si dış bağlantıları kapatır. Yalnız 127.0.0.1:5198 dinler.
- Fixture test ağacındadır; src/public runtime tarafından import edilmez. In-memory RPC kayıtları ve sentetik DTO'lar kullanır, gerçek kullanıcı/dosya/hukuk verisi içermez.

Tekrar çalıştırma: mevcut bağımlılıklarla `node tests/ui/serve-tracking-workspace.mjs`, ardından `http://127.0.0.1:5198/tests/ui/tracking-workspace.html`. İş bitince Ctrl+C. Yeni bağımlılık kurulmadı.

## Otomatik kanıt

`tests/tracking-workspace-integration.test.js`: **9/9**. Controller → gerçek Supabase adapter → sentetik RPC zincirinde rol DTO'su; kayıp commit/create yanıtında aynı UUID ve tek kayıt; erişim/audience reddinde cache temizliği; eksik RPC'de setup-required; eski open yanıtı/dispose; müvekkil yazım sınırı; HTML suggestion alanının atomik RPC payload'ından çıkarılması; yanlış dosya ID'si, mükerrer liste ID'si ve nested iç alan sızıntısının reddi.

`tests/sql/tracking-access.test.js` içindeki üç yeni uç senaryo **başarılı**: gerçek controller → gerçek adapter → sentetik auth.uid()/PGlite named RPC; gerçek client DTO ve iç not yazımının engellenmesi; SQL rezervasyonu → Storage policy fixture → finalize → taze indirme yetkisi. Önceki 31 SQL ile ortak sonuç **34/34** oldu. Controller'dan SQL'e tarih/saat ve hearing transport alanları doğru ayıklandı. Bu SQL sonuçları Storage HTTP veya gerçek JWT kanıtı değildir.

Kaynak oturumun son komut çıktısı salt okunur okunarak doğrulandı: **128/128 unit**, 34/34 SQL ve **Pages build1729 modül/1.24sn**, exit0. Son unit çalışması 1.97sn; yeni UI lazy chunk16.34kB. Bu görev ayrıca kendi 9 adapter/controller entegrasyon testini ve 34 SQL suite çalışmasını başarıyla çalıştırdı; kaynak ajanın final unit/build çalışmasını kendi komutu olarak sunmaz.

## Gerçek tarayıcı, sentetik backend

Kendi IAB tabı ve 5198 portu kullanıldı; kaynak ajanın tabı/sunucusu kullanılmadı. Root React.StrictMode açıktı.

| Senaryo | Gözlenen sonuç |
|---|---|
| Avukat | DTO listesi ve yeni kokpit açıldı; private alanlar yalnız avukat görünümünde. |
| Müvekkil | Hesap değişiminde önceki avukat içeriği yok; yalnız shared DTO; mesaj sentetik RPC'ye kaydoldu. |
| Viewer | “Görüntüleme yetkisi · salt okunur”; yazma, kapanış ve yeniden açma eylemi yok. Arşiv diye etiketlenmedi. |
| Arşiv responsible | Salt okunur; gerekçeli yeniden açma formu çalıştı, aktif çalışma görünümüne geçti. |
| Boş | Boş liste açıklaması ve yeni dosya eylemi; sahte dosya/fallback yok. |
| Eksik v2 RPC | setup-required; “Çalışma alanı hazırlanıyor”, eski tablo veya demo fallback yok. |
| Erişim reddi | İçerik kapandı, “Dosya erişimi kapalı”; önceki liste/detay gösterilmedi. |
| Loading | Yanıt bekletilirken “Dosyalarınız yükleniyor”; eski liste kaldırıldı. |
| Açık client dosyasında revoke | Mesaj işlemine 42501 döndüğünde detay/form dahil içerik kapandı. |
| Kayıp not yanıtı | Modal metni korundu. Global aynı işlemi retry modalı kapattı; İç notlar'da sentetik not tek kez göründü. |
| Kayıp create yanıtı | Gerçek beş adımlı wizard'da özel/müvekkilsiz dosya. İlk yanıtta hata ve girilen başlık/özet korundu. Aynı işlemi retry sonrası wizard kapandı, yeni kokpit açıldı; created h1 sayısı1, wizardVisible=false. Mock RPC sayısı3→4; fixture/otomatik test aynı UUID ile tek dosyayı doğrular. |
| Mobil | 390px viewport override'da client içerik clientWidth375/scrollWidth375; yatay taşma, private sentinel ve iç tab yok. Override iş sonunda sıfırlandı. |

Son sayfanın console error/warn listesi boştu. Mobil client ve masaüstü kokpit ekran görüntüleri gerçek JPEG dosyası olarak kaydedildi: [sentetik masaüstü](screens/tracking-v2-mock-desktop.jpg), [sentetik mobil client](screens/tracking-v2-mock-client-mobile.jpg). Create-retry kokpit görüntüsü ayrıca tarayıcı çıktısında alındı; repoya gerçek müşteri görseli veya veri eklenmedi. İlk harness `aside` öğesi uygulamanın global aside stiliyle çakıştığı için yalnız test öğesi div/region'a çevrildi; üretim stiline müdahale edilmedi. QA ortasında geliştirme reload'u senaryoyu sıfırladı; kaynak UI dondurulduktan sonra ilgili kontroller sabit içerikte tamamlandı.

## Açık kabul ve geri alma

Yeni ürün kararı gerekmedi. 49 ticket sınıflaması değişmedi: 20 yerel teslim/plan kanıtı, 16 kısmi/yerel hazırlık, 13 açık/parça/karar. Canlı kabul kapanmadı. Baseline ve boş diff, onaylı Docker/izole Supabase ortamı, gerçek Auth/PostgREST/Storage/Realtime, hesap değişimi ve ilişki iptalinde HTTP/ağ E2E bekler. Gerçek dünya eşzamanlılığı PGlite/mock testinden çıkarılamaz.

Migration SHA-256 değişmedi: `B35D100ABB68C39B78060A1C4EAA17EAA120F887282ABF00C381161ED06A6F7A`. UI geçişi ayrı flag ile kapalı tutulur; 002 tek başına uygulanmaz. Yerel UI/test dosyalarının seçici diff'i geri alınabilir. Canlı migration rollback/backup/PITR yaklaşımı [Migration002 hazırlığında](migration-002-local.md) açıklanmıştır. Bu görev stage/push/merge/publish yapmadı; mevcut es-avukatlik silinmelerine ve asıl DietApp'e dokunmadı.
