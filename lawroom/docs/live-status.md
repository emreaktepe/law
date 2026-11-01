# Canlı altyapı durumu — 1 Kasım 2026

Supabase eklentisi yetki hatası vermeye devam ediyor. Kullanıcının açık Supabase Dashboard oturumu üzerinden SQL Editor ile şema okundu ve foundation.sql uygulandı.

Mevcut altı site tablosu (profiles, blog_posts, legal_decisions, practice_areas, contact_messages, testimonials) değiştirilmedi. Dashboard bu eski tablolar için RLS uyarıları gösteriyor; eski sitenin erişim sözleşmesi araştırılmadan toplu politika değişikliği yapılmadı. Portal yetkilendirmesi eski profiles tablosuna güvenmez.

Yeni lr_ önekli 15 tablo ve lawroom_private içindeki dört erişim yardımcısı oluşturuldu. public işlevi veya role güncelleme API'si açılmadı. Tüm yeni tablolarda RLS etkin, anon erişimi kapalı. Admin iş içeriği göremez. İç notlar ayrı tabloda. Müvekkil görünürlüğü aktif avukat/büro, kabul edilmiş ilişki ve açık paylaşım gerektirir. İlişki iptali sonraki okumada uygulanır.

Bu aşamada dosyanın sorumlu avukatı yazabilir. Aynı bürodaki diğer avukatlara dosya görevlendirme, büro daveti, admin onay/atama RPC'leri, belge Storage politikaları ve Resend worker henüz eklenmedi. Yönetim tablolarına tarayıcı yazma yetkisi verilmedi; bunlar kontrollü sunucu işlemleri gelene kadar kapalıdır. Bildirim kuyruğu henüz tüketilmiyor. Arayüz demo modunda kalır; canlı kullanıcı açılışı yapılmadı.

SQL Dashboard üzerinden çalıştığı için Supabase migration geçmişine otomatik kayıt yazılmadı. foundation.sql uygulanmış şemanın kaynak kaydıdır ve ikinci kez çalıştırılmamalıdır. CLI ile şema çekilip ilk migration kaydı oluşturulmadan otomatik db push akışı açılmamalıdır.

## Canlı doğrulama sonucu

Dashboard SQL Editor üzerinde transaction içinde oluşturulan geçici kullanıcı/dosya örnekleriyle test edildi: sorumlu avukat dosya ve iç notu okuyabiliyor; müvekkil yalnız açık dosya ve paylaşılan olayı görüyor; iç notu göremiyor; admin ve ilişkisiz kullanıcı dosya okuyamıyor; kullanıcı role ve owner_id sütunlarını güncelleyemiyor; ilişkinin revoked olması müvekkil okumasını kesiyor. Bütün ASSERT kontrolleri geçti; transaction ROLLBACK ile sonlandı, örnek veriler kalıcılaştırılmadı.

Doğrulama çıktısı: portal_tables=15, rls_enabled=15, anonymous_grants=0. Toplam 23 erişim politikası var. Bu testler henüz belge deposu, gerçek oturum açılışı ve e-posta akışını kapsamaz.
