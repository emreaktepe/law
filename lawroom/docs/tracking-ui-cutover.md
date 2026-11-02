# Dosya takibi — yerel Supabase arayüz geçişi

> **Sonraki canlı işlem — 2 Kasım:** SQL paketi ve private bucket artık lawportal'da kurulu; Auth dönüş adresleri ayarlandı. UI geçişi/flag ve web yayını bu işlemde değiştirilmedi. Bu belgedeki “SQL canlıya uygulanmadı” ifadeleri önceki checkpoint'tir. [Güncel canlı kayıt](supabase-live-rollout.md).

2 Kasım 2026. Bu kayıt, yayınlanmış kurgusal demo ile sonraki **yerel, varsayılan kapalı** geçiş hazırlığını ayırır. Yeni SQL/UI değişiklikleri stage edilmedi, yayınlanmadı ve canlı Supabase'e uygulanmadı.

## Tamamlanan hazırlık

- `TrackingLiveWorkspace` ve repository/controller bağlantısı: avukat listesi, beş adımlı dosya oluşturma, kokpit komutları, müvekkilin sunucuda seçilen özeti, mesaj ve sürümlü belge işlemleri. Admin mevcut yönetim ekranında kalır.
- `VITE_TRACKING_V2_ENABLED=false` varsayılandır. Yalnız literal `true` yeni etkin nonadmin girişini seçer. Eksik RPC veya yanlış DTO'da eski ham tablo/demo verisine dönüş yapılmaz.
- Form verileri sunucunun açık payload sözleşmesine dönüştürülür. Yetki aktörü tarayıcı girdisinden alınmaz; tarafın meşru `role` alanı kimlik rolünden ayrılır. Belge talebinde kabul edilmiş müvekkil açıkça seçilir.
- Hesap değişiminde eski yanıtlar gösterilmez; yetki/DTO reddi listeyi ve detayı temizler. Ağ hatasında aynı işlem UUID'si korunur. Kayıp not/dosya oluşturma yanıtını tekrar denemek ikinci kayıt oluşturmaz.
- Belge rezervasyonu ve yükleme yeniden denemesi aynı sürümü korur. İndirme açık DTO'daki sürümle eşleşir ve sunucudan taze yetki kontrolü ister. Canlı hash henüz doğrulanmış sayılmaz; tarayıcı hash iddiası olarak gösterilir.
- Salt okunur ekip üyesi ile arşiv ayrı sunulur. Müvekkil ekranı avukat aggregate'inden türetilmez; sunucunun client DTO'sunu tüketir. Yeni UI lazy yüklenir; sentetik fixture üretim paketine girmez.

## Son doğrulama

| Kontrol | Sonuç |
|---|---|
| Birim/repository/entegrasyon | **128/128 başarılı** |
| SQL erişim ve transaction fixture'ları | **34/34 başarılı** |
| Pages build | **1729 modül, 1.24 sn, başarılı** |
| Son güvenlik regresyonları | 5/5; yanlış dosya/sürüm, aynı rezervasyon, erişim reddi, müvekkil sınırı |
| Tarayıcı | Avukat, müvekkil, viewer, arşiv, boş liste, eksik RPC, erişim reddi, loading, hesap değişimi, kayıp not/create yanıtı |
| Mobil | 390px viewport; clientWidth/scrollWidth 375/375; özel alan sızıntısı ve console error/warn yok |

Tarayıcı backend'i **sentetiktir**. PGlite sentetik `auth.uid()` ve Storage metadata fixture'ı kullanır. Bunlar gerçek JWT, PostgREST, Storage HTTP, Realtime veya çok bağlantılı eşzamanlılık kabulü değildir. Ayrıntılı senaryolar ve tekrar çalıştırma: [sentetik UI kabulü](verification-tracking-live-mock.md).

Kaydedilen sentetik ekranlar: [avukat masaüstü](screens/tracking-v2-mock-desktop.jpg), [müvekkil mobil](screens/tracking-v2-mock-client-mobile.jpg). İki dosya da görsel olarak açılarak kontrol edildi.

Migration002 SHA-256: `B35D100ABB68C39B78060A1C4EAA17EAA120F887282ABF00C381161ED06A6F7A`. SQL/adapter aşamasının önceki 111/31 kaydı tarihsel checkpoint'tir; son birleşik sonuç yukarıdaki 128/34'tür. [Migration kapsamı, sıralama ve geri alma](migration-002-local.md).

## Canlı kabul için kalanlar

1. Doğru Lawroom projesinde baseline/history uzlaştırması, db pull ve boş diff; foundation tekrar çalıştırılmaz.
2. İzole gerçek Supabase ortamında migration sırası, Auth/JWT, PostgREST, Storage baytları ve HTTP yetkileri, ilişki iptali, Realtime ve eşzamanlı transaction kabulü.
3. Migration002 ham tablo grant'lerini kapattığı için migration ve yeni UI birlikte geçirilir. Flag bu kabulden önce açılmaz; eski LiveWorkspace'e kör dönüş güvenli değildir.
4. Kayıtlı görünüm/toplu işlem/import RPC'leri SQL testlidir; mevcut özellikli liste/Bugün/komut paleti ve bu işlemlerin UI'leri hâlâ demo kapsamındadır. Yeni canlı çalışma alanına bütün bu ekranlar bağlanmış sayılmaz. Gerçek liste projection/pagination ve servis performansı ayrıca kabul edilir; 500 dosya/10 bin olay yerel benchmark'ı ağ/DB performansı kanıtı değildir.
5. Büro daveti, ICS aboneliği, gerçek hukukçu onaylı kural/tatil kataloğu, AI sağlayıcısı ve diğer açık ticket'lar [durum tablosunda](tracking-status.md) kalır. Resend Lawroom'un kendi domainini bekler; Dietroom ile servis/veri/anahtar bağlantısı kurulmaz.

## Yayın ayrımı

[Yayınlanmış demo](https://emreaktepe.github.io/law/) PR #3 / `ecb5b68090bc2d563558a81e70f6a72fe4641731` kapsamıdır; son yayın testi **105 birim + 8 SQL** idi ve [Pages dağıtımı](https://github.com/emreaktepe/law/actions/runs/41355370033) başarılıdır. Bu belgedeki 128/34 yerel hazırlık testidir. 49 ticket'ın canlı kabulü kapanmadı; diğer oturumun ve kullanıcının kapsam dışı dosyaları değiştirilmedi.
