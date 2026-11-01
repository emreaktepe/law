# Araştırma ve entegrasyon kararları — 1 Kasım 2026

## Benchmark

[Günce](https://www.gunce.com/) dosya, evrak, finans ve araştırmayı birlikte sunuyor. Lawroom için çıkarım: dosyayı merkez al; belge, görev, iletişim ve masrafı aynı bağlama bağla. İlk sürümde kapsamlı muhasebe/İK yerine sıradaki işlem ve müvekkile anlaşılır ilerleme öncelikli.

[HUKY](https://huky.ai/) takvim, meslektaş işbirliği, mevzuat ve içtihat akışlarını öne çıkarıyor. Lawroom için çıkarım: sıcak yardımcı karakter ve anlaşılır yazılı iletişim; tevkil/ilan/topluluk ilk dosya takibi sürümünün önüne geçmemeli. Verilen blog URL'si araçta açılamadı; ana ürün sayfası incelendi.

[UYAP Vatandaş](https://vatandas.uyap.gov.tr/main/vatandas/index.jsp?v=3785) dosya/evrak/safahat görüntüleme, belge doğrulama, harç ve ödeme hizmetlerini listeliyor. Lawroom için çıkarım: esas numarası, safahat, kaynak evrak ve resmî portal bağlantıları bir arada olmalı. Kamuya açık portal tanıtımı incelendi; oturum gerektiren dosya ekranlarına erişilmedi. Portal sayfası, üçüncü taraflara açık bir entegrasyon API'sini kanıtlamaz. İlk aşama bağlantı + kullanıcının yetkili dışa aktardığı evrak. Otomatik senkronizasyon için yetkili yöntem/sözleşme/teknik erişim ayrıca doğrulanmalı.

## Hazır hukuk AI araçları

[Yargı MCP resmî deposu](https://github.com/saidsurucu/yargi-mcp) projenin Yargı PRO'ya taşındığını ve eski ücretsiz endpoint'in kapandığını bildiriyor. Yeni MCP adresi app.yargipro.com/mcp. Kullanım koşulları, hesap/kimlik doğrulama, lisans, kota ve saklama koşulları değerlendirilmeden bağlanmamalı. Entegrasyon bir research-provider adaptörü arkasında tutulmalı; kullanıcı dosyaları topluca sağlayıcıya gönderilmemeli. Lisanslı, denetlenmiş yerel sürüm alternatifi ayrıca incelenebilir; eski açık kaynak lisansını bugünkü servise otomatik uygulamayın.

[Mizan-27B karar modeli](https://huggingface.co/spaces/AlicanKiraz0/Mizan-27B-Turkish-Legal-Decision-Model): verilen Space ve README/app kaynaklarına bu oturumda güvenilir erişim sağlanamadı. Lisans, model ağırlıkları, eğitim kapsamı, API, benchmark veya üretim kullanılabilirliği doğrulanmadı. Bu nedenle henüz seçilmiş sağlayıcı değildir. Değerlendirme adayı: anonimleştirilmiş belgeleri sınıflandırma/önceliklendirme. Dosya kazanma olasılığı veya kesin sonuç iddiası için kullanılmamalı. Model kartı ve lisans görülmeden dağıtıma alınmaz.

Resmî araştırma başlangıçları: [Adalet Bakanlığı mevzuat ve içtihat](https://mevzuat.adalet.gov.tr/), [Yargıtay karar arama](https://karararama.yargitay.gov.tr/), [Resmî Gazete](https://www.resmigazete.gov.tr/). Mevzuat uygulaması metin görünümünde okunamadı; Yargıtay sayfası zaman aşımı verdi. Bağlantı kısayolları sunulur; bu oturumda mevzuat maddesi doğrulanmış veya hukuki süre kuralı çıkarılmış değildir.

## Asistanın en değerli ilk işleri

1. Dosya hazırlık özeti: taraflar, talepler, olay sırası, eksik belgeler; her cümle belge/sayfa kaynağına bağlı.
2. Duruşma hazırlık paketi: son safahat, beklenen işlem, açık görevler, avukatın soru listesi. Hukuki strateji önerisi açıkça taslak.
3. İçtihat araştırması: sorguyu kişisel veriden arındırma, tarih/daire filtreleri, karar no ve tarih, destekleyen/ayıran olgular, tam kaynak bağlantısı. Getirilmemiş kararı üretme yok.
4. Dilekçe veya sözleşme karşılaştırma: değişiklik ve eksik unsur listesi; asıl belgeyi değiştirmeyen öneriler.
5. Müvekkil bilgilendirme taslağı: yalnız paylaşıma uygun gelişmelerden sade özet; avukat onayı olmadan gönderim yok.
6. Süre adaylarını çıkarma: belge içindeki tarih/tebliğ ifadelerine işaretle; kesin tarih için doğrulanmış kural ve avukat kontrolü şart.

## Değerlendirme ve veri sınırı

Anonimleştirilmiş, izinli bir örnek set üzerinde belge atfı doğruluğu, uydurma karar oranı, güncel/eski mevzuat ayrımı, eksik bilgi karşısında durabilme, bürolar arası veri izolasyonu, gecikme ve maliyet ölçülmeli. RAG erişim filtresi getirmenin öncesinde uygulanmalı; yalnız son yanıtta maskeleme yeterli değil. Belge içindeki talimatlar veri kabul edilmeli, araç yetkisine dönüşmemeli. Hukuki AI önce avukat iş akışına girer; müvekkil sürümünde kapsam ve insan eskalasyonu ayrıca tasarlanır.

Bu belgeler ürün araştırmasıdır; tamamlanmış entegrasyon veya hukuki görüş değildir.
