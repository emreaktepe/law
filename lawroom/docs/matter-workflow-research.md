# Avukatın dosya takibi — araştırma ve uygulama kararı

2 Kasım 2026. Bu çalışma ürün araştırmasıdır; mevzuat veya kesin hukuki süre rehberi değildir. Aşağıdaki senaryolar kaynaklardan çıkarılan ürün hipotezleridir; avukatlarla saha görüşmesi yapılmış gibi sunulmaz. Süre ve aşama şablonları pilot hukukçu incelemesi bekler.

## Okunan kaynaklar ve sınırları

- [Lawyers Mutual — Do right by your Docket, 26 Ocak 2016](https://lawyersmutualnc.com/article/do-right-by-your-docket/): Takvime tarih girmekle işin tamamlandığını izlemek ayrı ihtiyaçlardır. Yazı, erken hatırlatma, takip tarihi, sorumlu kişi ve düzenli kontrolü vurgular. ABD mesleki risk yönetimi kaynağıdır; Türk usul kurallarına dayanak olarak kullanılmadı.
- [Clio blog — A Guide to Better Law Firm Client Communication](https://www.clio.com/blog/law-firm-client-communication/): Sade dil, proaktif durum açıklaması ve güvenli iletişim kanalları önerir. Çıkarımımız: büro içi değerlendirmeden ayrı, avukatın seçtiği müvekkil özeti ve belge beklentisi görünümü. Sağlayıcının kendi ürününü tanıttığı kaynak olarak değerlendirildi.
- [TeamWork — Dava Dosya Takibi](https://www.teamwork.com.tr/hukuk/dava-dosya-takibi/): Dosya kapağı, taraflar, farklı mahkeme numaraları, evrak, aşamalar, tarihler, atanmış işler ve masrafları aynı dosyada ele alır. Lawroom kararı: tek kokpit içinde bölümler, bütün numaralarla arama ve icra/kanun yolu dosyalarını birbirine bağlama. Ürün iddiaları bağımsız başarı ölçümü sayılmadı.
- [Günce — İlişkilerimiz](https://www.gunce.com/platform/iliskilerimiz/): Müvekkil iletişimi, dosya ve belge bağlamını ilişkilendirir. Çıkarımımız: kişinin sisteme eklenmesi, avukatın müvekkili kabul etmesi ve dosyanın paylaşılması ayrı işlemler olmalı. Kaynak ürün incelemesi değildir.
- [UYAP — Sunulan Hizmetler](https://www.uyap.gov.tr/Hizmetler): Resmî portalda yetki dahilinde dosya, safahat, evrak ve duruşma takibi bulunur. Lawroom'un UYAP düğmesi resmî portala gider; eşitleme, evrak gönderme ve e-Duruşma talebi yapmış sayılmaz.

## Avukatın zihnindeki dosya kapağı

Dosya açıldığında şu sorular sırayla yanıtlanmalı: Bu hangi iş? Kimin dosyası ve ben hangi taraftayım? Son somut gelişme ne? Sıradaki eylem ne, kim yapacak, hangi tarihte ve neden? Hangi tarih çalışma planı, hangisi avukatın doğruladığı hukuki son gün? Kimden ne bekliyoruz? Hangi belgeye dayanıyoruz? Müvekkile ne söyledik? Dosyayı kapatmadan açık bir yükümlülük kaldı mı?

Kokpitin sağındaki kart, açık görev/süre/takvim üzerinden hesaplanır. Eski `next`/`due` alanları yalnız manuel çalışma hedefi olarak kalır. Kaynaksız `verified: true` bayrağı hukuki süre oluşturmaz. “Doğrulama bekliyor” durumu, öneri tarihi boş olsa bile görünür.

## Kullanım senaryoları ve kabul davranışı

| Senaryo | Girdi / gerçek ihtiyaç | Tasarlanan akış ve başarı ölçütü | Bağlı ticket |
|---|---|---|---|
| Sabah iş planı | Birçok dosya arasında riski kaçırmamak | Bugün kartları yazılı gerekçeyle sıralanır; kaynağa tek tıkla gidilir; görev tamamlanınca kart yeniden hesaplanır. | T2.12 |
| Müvekkil telefonda | Ad veya farklı yazılmış esas numarasından hızlı bağlam | Ctrl/Cmd+K; tüm numaralar ve taraf adıyla arama; son 5 dosya; kokpitte paylaşılan açıklama. | T2.4, T2.13 |
| Yeni dosya, henüz esas no yok | Dosya açmayı ertelememek | En fazla 5 adım; numarasız/müvekkilsiz özel dosya; ilk iş opsiyonel; portal bağlantısı ayrıca kurulur. | T2.3 |
| Tebligat geldi | Evrakı okumak, süreyi değerlendirmek, takip başlatmak | Kaynak/sayfa, olay ve tebliğ bilgisi → seçilen görevler + isteğe bağlı süre incelemesi → tek kayıt. Tarih kendiliğinden üretilmez. | T2.8 |
| Tebliğ tarihi yanlış girildi | Önceki değerlendirmeyi kaybetmeden düzeltmek | Gerekçeli yeni safahat orijinale bağlanır; eski kayıt kalır; kaynağa bağlı açık süre invalidated olur. | T2.7, T3.2 |
| Duruşmadan çıkıldı | Tutanaktaki işleri unutmamak | Sonuç + ara karar maddeleri → görevler; sonraki duruşma → ajanda; eski duruşma sonuçlandı; hepsi aynı aggregate kaydı. | T3.4 |
| Görev gecikiyor | “Yarın bakarım” ile görünmez olmaması | Ertelemede yeni hedef ve gerekçe zorunlu; eski tarih/kişi/zaman korunur. Tamamlanmış görev ertelenemez. | T2.9 |
| Belge veya kurum yanıtı bekleniyor | Beklemekle takip yapmayı ayırmak | Beklenen belgeyi bir görev sonucu olarak yaz; sorumlu ve kontrol tarihi belirle. “Bekliyoruz” diye dosya dikkat listesinden çıkmaz. | T2.9, T2.12 |
| Bilirkişi raporu geldi | Belgeyi, gelişmeyi ve inceleme işini bağlamak | Rapor safahatı → inceleme görevi önerisi; seçilmeden görev ve süre oluşmaz; kaynak referansı korunur. | T2.8 |
| Dosya istinafa / icraya geçti | Eski numarayı da arayabilmek | Yeni numara ekle, gerekiyorsa birincil yap; eskiyi koru; ayrı dosyaları iki yönlü bağla; erişim aktarma yapma. | T2.10 |
| Avukat dosyayı devralıyor | Kim neyi neden değiştirdi? | Aşama ve işlem geçmişi; notlar ayrı kayıtlar; çoklu sorumlu atama önce tüm seçimi kontrol eder. | T2.11, T2.14 |
| Müvekkilden bordro istenecek | Beklenen eylemi açık göstermek | Belge talebi görev türü + paylaşım; “Sizden beklenen” önizlemesi. Gerçek yükleme canlı talep/RLS/Storage testine bağlıdır. | T4.4 |
| Müvekkil durum soruyor | Hukuk dili ve özel stratejiyi karıştırmamak | Sade açıklama, tek tek paylaşılan gelişmeler/takvim; önizleme allow-list'inden iç not, iç görev, taraf iletişimi ve süre hesabı çıkmaz. | T4.3 |
| Harç ve bilirkişi masrafı | Dosyaya ne harcandı, kim ödedi? | Kuruş hassasiyeti; para birimine göre ayrı toplam; müvekkile yansıtılacak tutar; hata silinmez, ters kayıt eklenir. | T4.6 |
| Eski tabloyu taşımak | Mükerrer veya hatalı yüzlerce dosya açmamak | CSV/XLSX kolon eşleme → satır hataları → önizleme → tek toplu kayıt; aynı makam+normalize numara kontrolü; değişmemiş batch geri alınabilir. | T2.15 |
| Dosya kapanıyor | Açık süreyi yanlışlıkla arşive gömmemek | Açık görev/süre/ajanda listelenir; sonuçlandırılmadan arşiv engellenir; arşiv salt okunur; gerekçeli açma paylaşımı otomatik açmaz. | T2.16 |
| Sessiz dosya | Dış gelişme olmasa da düzenli kontrol | Son hareket eşiği ve yazılı neden; inceleme/kurum kontrolü görevi; yapılan kontrol yeni safahat olarak kaydedilebilir. | T2.12 |

## Etkileşim ve veri kararları

1. Gelişme kaydı, önerileri sessizce çalıştırmaz. Avukat görevleri seçer. Öneri motoru son gün hesaplamaz. Elektronik iletim / okunma kaydı tebliğ tarihine otomatik çevrilmez.
2. Görevler bir sonuç tarif eder; serbest notta kontrol listesi tutulabilir. Öncelik, sorumlu, çalışma hedefi ve kaynak safahat birlikte görünür. İç hedef müvekkil takvimine otomatik girmez.
3. Aynı olayın düzeltilmesi güncelleme değil, bağlı yeni kayıttır. Süre sonuçlandırılırken gönderim alındısı veya gerekçe istenir. Kaynak değişmiş inceleme yeni kaynakla tekrar açılır.
4. Kapama işlemi “açık işleri de iptal et” varsayımı yapmaz. Avukat her açık öğeyi sonuçlandırır veya gerekçesiyle iptal eder. Toplu işlemler kısmi başarı üretmez.
5. Demo aggregate transaction'ı tek yerel yazma ile saklanır. Bu, canlı PostgreSQL transaction/RLS testi yerine geçmez. Yeni UI canlı kuruldu diye raporlanmaz.
6. Bağlı dosya ID'si sadece erişilebilir dosyalardan seçilir. Canlıda bu kontrol RPC+RLS ile yapılmalıdır. Büro üyeliği dosya erişimi vermez.

## Pilot ölçümü

Üç avukatla (tek çalışan, küçük büro, yüksek dosya hacmi) kurgusal aynı dosya üzerinden test: doğru dosyaya erişme süresi, yeni dosya açma süresi, tebligat sonrası atlanan zorunlu alan, duruşma sonucu sonrası eksik takip, yanlışlıkla paylaşım ve dosya kapanışında atlanan açık öğe sayısı. Hedefler: dosyaya erişim 5 saniye içinde, yeni dosya 60 saniye içinde, tebligat kaydı 30–60 saniye; kaynak doğrulamasını hız hedefi için atlamak yok. Bunlar ölçülmüş sonuç değil, pilot hedefleridir.

## Tamamlanma sınırı

Yerel demo kabulü ile canlı ticket kapanışı ayrı tutulur. Canlı ekip yetkileri, RPC atomikliği, RLS, Storage, Realtime ve gerçek e-posta teslimatı canlı/yerel Postgres servis entegrasyonlarıyla ayrıca doğrulanmalıdır. Lawroom domaini gelene kadar Resend kapalı kalır. Tam ticket durumu `docs/tracking-status.md` ve `agents.md` güncellemesinde tutulur.
