# T0.4 — Repository veri sınırı ve demo kalıcılığı

1 Kasım 2026. Mevcut `data/demoRepository.js` dosya/ajanda localStorage okuma-yazmasını sarar; `data/supabaseRepository.js` satır, RPC ve belge Storage erişimini toplar. UI kaynaklarında doğrudan localStorage/sessionStorage veya Supabase satır/RPC/Storage çağrısı bulunmadığı statik sınır testiyle korunur. Auth SDK oturum yönetimi bu satır veri sınırından ayrıdır ve AuthContext/lib içinde kalır.

`tests/repository-boundary.test.js` beş sözleşme testi içerir: kayıt/yeniden okuma ve boş listenin korunması; bozuk veride güvenli seed kopyası ve seed izolasyonu; ajanda/dosya anahtarlarının ayrılığı; quota hatasının sessiz başarı sayılmaması; UI veri sınırı.

Bu testler yalnız geçici in-memory browser storage fixture'ı kullanır. Gerçek tarayıcı kaydı veya canlı Supabase okunmaz/değişmez. Demo uygulamanın mevcut davranışı değiştirilmedi. Form alanları ve modal seçimi gibi geçici view state UI içinde kalabilir; kalıcı dosya/ajanda ve sunucu verisi repository'den geçer.

Hedef mimarideki ortak `repository.js`/`useRepository.js` arayüzü ve yeni fazların yöntemleri henüz oluşturulmadı. Bu kayıt mevcut veri sınırı kabulünü kanıtlar; sonraki fazların bütün repository API'lerinin tamamlandığı anlamına gelmez.
