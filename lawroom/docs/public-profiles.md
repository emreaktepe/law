# Avukat ve büro tanıtım sayfaları

İlk aşama: her avukat/büroya kendi tanıtımı, mesleki bilgiler, yazılar ve referanslı başvuru girişi. Müvekkil özel alanı ayrı kalır. Kullanıcı kapsamı avukat/büro olarak netleştirdi; müvekkillere herkese açık tanıtım sayfası verilmeyecek.

Demo avukatları: Alkım Azmioğlu ve Enes Can Yolcu. Bunlar gerçek hesap veya canlı profesyonel onayı değildir. Demo dosyaları gerçek müvekkil ilişkilerini temsil etmez.

Alkım: LinkedIn kamuya açık arama görünümünde Mizan Hukuk Bürosu Uşak bilgisi ve mesleki uyum eğitimi paylaşımı görüldü; profil sayfasının tamamı araçta açılamadı. TEİD Academy Next Gen mezun listesinde 2. dönem ve İstanbul Üniversitesi/Hukuk kaydı doğrulandı. Kaynaklar src/lawyers.js içinde. Büro bilgisi güncellik teyidi bekliyor. Uzmanlık alanı, sicil no, telefon ve fotoğraf uydurulmadı.

Enes: kullanıcının verdiği lawportal ve law örnekleri temel alındı. ES Avukatlık & Hukuki Danışmanlık ve İstanbul bilgisi bu kaynaklardan alındı. LinkedIn bağlantısı mevcut sitede bulundu; profilin tamamı açılamadı. Profil sahibi adına özgün blog yazısı yayımlanmadı.

Çalışan yerel akış: Avukat sayfaları → örnek avukat seçimi → Hakkında / Yazılar / Başvuru akışı. Başvuru önizlemesi seçilen avukatı taşır; form oturum belleğinde kalır, gerçek başvuru/e-posta göndermez. Blog boş durumu ve yayın süreci açıklaması var; gerçek CMS henüz yok. Canlı yayında profil sahibi onayı, içerik sorumluluğu ve yürürlükteki meslek kuralları ayrıca değerlendirilmelidir.

Kontrol: tarayıcıda Alkım ve Enes arasında geçiş, Enes'e bağlı örnek başvuru, doğru avukat adı ve gönderim yapılmadığı mesajı doğrulandı. Vite derlemesi ve dört alan testi başarılı.

## Tercihe bağlı görünürlük

Tanıtım/blog sayfası isteğe bağlıdır, varsayılan kapalıdır. Avukat kendi sayfasını, büro adına yetkili kullanıcı büro sayfasını açıp kapatabilir. Tanıtım sayfasını kullanmayanlar portalın dosya ve iletişim özelliklerini kullanmaya devam eder. Sayfanın açılması taslak yazıları otomatik yayımlamaz. Kapatma herkese açık sayfayı, dizin kaydını ve herkese açık API yanıtlarını da kapatmalıdır; yalnız arayüzde gizlemek yeterli değildir. Arama motorlarının eski kopyalarının anında silinmesi vaat edilmez. Müvekkil/dosya/mesaj yetkileri bu tercihten etkilenmez.

Demo anahtarı yalnız avukat rolünde görünür; her örnek profil için ayrı ve varsayılan kapalıdır. Tercih bu ekranın belleğindedir, gerçek yayın ya da kalıcı veritabanı güncellemesi yapmaz. Canlı görünürlük ve CMS henüz uygulanmamıştır.
