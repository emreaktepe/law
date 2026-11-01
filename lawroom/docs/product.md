# Ürün ve mimari kararları

## Temel ilke

Bir dosya tek bir müvekkil hesabına bağımlı değildir. Avukat dosyayı önce açabilir, tarafları kişi/kurum olarak kaydedebilir, onaylanmış portal kullanıcılarını daha sonra bağlayabilir. Bir müvekkilin çok dosyası, bir dosyanın çok müvekkili ve birden fazla sorumlu avukatı olabilir. Büro hesapları aynı ürün yeteneklerini kullanır; ek özellikleri üyelik/davet ve sorumlu atamasıdır.

## Dietroom'dan taşınacak yapı

İncelenen kaynaklar: src/App.jsx (rol bazlı çalışma alanı ve onboarding), src/role-pages.js (rol erişim matrisi), src/components.jsx (form/modal/uyarı/boş durum), src/styles.css (DM Sans/Manrope, sakin yeşil, açık zemin). Avukat çalışma alanı clinic kurgusunun; müvekkil dosya ekranı danışan takip kurgusunun karşılığıdır. Auth ve store modülleri sağlık verisi ve mevcut proje varsayımları taşıdığı için doğrudan kopyalanmaz. Tasarım tokenları ve küçük bileşen ilkeleri yeniden kullanılır. Büyük App bileşeni canlı aşamada ayrı modüllere bölünmelidir.

## Kabul akışları

1. Bireysel avukat veya büro başvurusu → kimlik/sicil/yetki kontrolü → admin onayı veya gerekçeli red → aktif çalışma alanı.
2. Onaylı büro sahibi avukat davet eder → davetli kimliğini doğrular → üyelik aktif olur. Yetki atama sunucuda kontrol edilir. Büro üyeliği tüm dosyalara otomatik erişim sağlamaz.
3. Referanslı müvekkil → referansın ilgili avukatı → avukat kabul/red → aktif ilişki.
4. Atama isteyen müvekkil → admin kuyruğu → uygun avukata atama → avukat kabul/red. Red halinde yeniden atama kuyruğu; atama tek başına aktif müvekkillik oluşturmaz.
5. İlişki kabulü dosya erişimi değildir. Avukat dosyaya üyelik ve paylaşım yetkisi ayrıca verir. İlişki/dosya erişimi iptali anında yeni okumaları keser.
6. Admin yalnız başvuru, üyelik ve sistemsel denetimi görür. Belge metni, iç not ve dosya mesajı görmez. Destek erişimi gerekirse ayrı, gerekçeli, süreli ve kayıtlı süreç tasarlanır.

## Dosya türleri ve alanlar

Ortak: dahili referans, başlık, tür/alt tür, yetki alanı, mahkeme/daire, esas/karar/takip no, bağlı üst-alt dosyalar, sorumlu avukatlar, taraflar/rolleri, durum, aşama, sıradaki işlem, son aktivite ve arşiv gerekçesi.

- İcra: takip türü, alacak kalemleri, takip/tebligat, itiraz, kesinleşme, haciz, satış ve tahsilat. Faiz hesabı ayrı, doğrulanmış ve sürümlü modül olmalı.
- Aile/boşanma: anlaşmalı/çekişmeli alt tür, protokol, tedbirler, duruşmalar, karar ve kanun yolu. Hassas belgelerde özel paylaşım.
- İdari/vergi: işlem ve öğrenme/tebliğ bilgileri, ön başvuru, yürütmenin durdurulması talebi, savunmalar, karar ve kanun yolu.
- Ceza: soruşturma/kovuşturma ayrımı, savcılık ve mahkeme numaraları, taraf sıfatı, tedbirler, duruşma, hüküm ve kanun yolu.
- İş, ticaret, tüketici, miras, gayrimenkul: ayrı alt türler; gerektiğinde arabuluculuk ön dosyası ve bağlı dava.
- Arabuluculuk/danışmanlık: mahkeme numarası zorunlu değil; toplantı, belge teslimi, görüş, anlaşma/sonuç teslimi.

Ekran akışı şablonları hukuki prosedürün eksiksiz modeli değildir. Hukukçu ile doğrulanıp sürümlenmelidir.

## Kritik deneyim: dosya listesi ve detay

Liste görünümü: esas no veya kişiyle arama; avukat/tür/aşama/mahkeme/işlem tarihi filtreleri; kayıtlı görünümler; geç kalmış/hedef tarihi yakın/işlemsiz dosya sıralaması. Her satırda tek net sonraki adım. Gecikmiş görev tamamlanana ya da gerekçeli ertelenene kadar görünür kalır.

Detay: genel bakış, safahat, süreler & görevler, belgeler, taraflar, mesajlar, masraflar, araştırma, iç notlar, paylaşım ve denetim geçmişi. Kanban ikincil görünüm; yoğun avukat için liste önceliklidir.

Safahat ekleme tek form: olay türü, gerçekleşme tarihi, kaynak belge, not, görünürlük ve sonraki görev. Aynı olaydan görev/hatırlatma üretimi atomik olmalı. Yeni belge eskiyi ezmemeli; dosya içindeki sürüm ve hash tutulmalı. PDF önizleme; UDF orijinalini koruma ve resmî editöre yönlendirme; güvenli dönüştürme doğrulanana kadar UDF önizleme sözü verilmemeli.

## Süre güvenilirliği

Hedef tarih ve hukuki süre ayrı alanlardır. Hukuki süre kaydı: tetikleyici olay, tebliğ/öğrenme tarihi, yöntem, dayanak mevzuat/madde, kural sürümü, hesaplama girdileri, önerilen tarih, doğrulayan avukat ve doğrulama zamanı. Belirsiz girdi → hesaplanamaz/kontrol bekliyor. Tatil, adli tatil ve istisnalar genel bir gün ekleme fonksiyonuna bırakılmaz. Kaynak belge değişirse önceki doğrulama geçersizleşir. AI tek başına kesin son gün üretmez.

## Planlanan Supabase veri modeli

organizations, profiles, organization_memberships, professional_applications, client_requests, lawyer_client_relationships, matters, matter_members, parties, matter_parties, matter_events, deadlines, tasks, documents, document_versions, document_grants, threads, messages, expenses, research_items, audit_events, notification_outbox, delivery_attempts.

Her iş tablosunda organization_id; ilişkilerde çapraz büro bağını engelleyen birleşik foreign key. matter_members açık dosya yetkisini taşır. İç notlar ayrı tabloda tutulur: satır görünürlüğüyle korunamayan hassas kolonları ortak kayda koymayın. Profil düzenleme rol/yetki yazamaz. Sunucu kontrollü üyelik ve onay durumları RLS kararına kaynak olur; kullanıcı metadata'sı olmaz.

RLS: varsayılan red; aktif büro üyesi + açık dosya görevlendirmesi; müvekkil için kabul edilmiş ilişki + dosya üyeliği + ilgili olay/belge paylaşımı. Admin için iş içeriği politikası yok. Storage private bucket ve kısa ömürlü signed URL; her indirmede güncel üyelik kontrolü. Realtime kanalları aynı erişim sınırlarını izler. Yedek geri yükleme, silme/saklama ve erişim iptali senaryoları test edilmelidir. Bu belge uygulanmış bir RLS güvencesi değildir.

## Resend

Veritabanı işlemiyle aynı transaction içinde outbox oluştur. Worker olay kimliğiyle idempotent gönderir. Alıcıyı olay anında yeniden yetkilendir; sabit uygulama origin'inden link üret. E-postaya dosya başlığı, belge veya hassas metin koymak yerine nötr bildirim kullan. Bildirim tercihi ve zorunlu sistem iletisi ayrımı. Başarısız gönderimde retry/backoff; webhook imzası doğrulaması ve tekrar olay engeli. SPF/DKIM, gönderen alanı, API gizlisi ve test alıcısı hazır olmadan gerçek gönderim açılmaz. API gizlisi yalnız sunucuda.

## Canlı kabul testleri

Farklı büroların tahmin edilen dosya kimliğiyle erişimi reddedilir; müvekkil diğer müvekkilin paylaşılmış belgesini göremez; iç notlar ağ yanıtında bulunmaz; admin dosya okuyamaz; rol düzenleme reddedilir; red/iptal sonrası Storage ve Realtime erişimi kesilir; iki kez kabul/atama ve eşzamanlı güncelleme kontrollüdür; outbox yeniden çalışınca çift e-posta üretmez; doğrulanmamış süre kesin gibi gösterilmez; kaynaklı AI cevabındaki her atıf gerçekten açılabilir.

## Sıralı uygulama

1. Prototip ve .pen incelemesi (mevcut çıktı).
2. Mevcut Supabase şemasını inceleme; auth, kuruluş üyelikleri, kabul durum makinesi ve RLS entegrasyon testleri.
3. Kalıcı dosya/safahat/görev ve özel Storage; belge önizleme ve paylaşım.
4. Takvim ve doğrulamalı süreler; Resend outbox ve teslimat gözlemi.
5. Avukat araştırma asistanı: kaynak getirme, redaksiyon, alıntı doğrulama, değerlendirme seti.
6. UYAP/UETS yetkili entegrasyon fizibilitesi; müvekkil asistanı daha sonra.
