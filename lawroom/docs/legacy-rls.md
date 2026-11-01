# T0.6 — Eski site tabloları için RLS planı

1 Kasım 2026. Bu belge öneridir; eski tablolarda değişiklik uygulanmadı.

## İnceleme

Canlı envanterde `profiles`, `blog_posts`, `legal_decisions`, `practice_areas`, `contact_messages`, `testimonials` tablolarında RLS kapalı. Envanter: `supabase-inventory.json`.

Deponun HEAD sürümündeki `es-avukatlik/server.js`, `public/main.js` ve `.env.example` incelendi. Bu sürüm Supabase istemcisi kullanmıyor: iletişim formu Express `/api/contact` endpoint'ine gidiyor, sunucu girdiyi konsola yazıyor. Dolayısıyla bu kodda anon Supabase okuması bulunmadı. Canlıda başka bir sürüm bulunup bulunmadığı ayrıca doğrulanmalı.

Çalışma ağacında `es-avukatlik/` için silinmiş dosyalar görünüyor. Bu çalışma yalnız `lawroom/` ve yeni `.github/` dosyalarını kapsar; mevcut silmeler commit'e dahil edilmemelidir.

## Öneri

| Tablo | Anon erişimi | Yazma |
|---|---|---|
| profiles | Varsayılan kapalı; gerekiyorsa ayrı, kişisel alanları dışlayan herkese açık profil görünümü | Eski sitenin doğrulanmış yönetici mekanizması |
| contact_messages | Okuma kapalı | Sunucu doğrulaması ve kötüye kullanım sınırı olan endpoint |
| blog_posts | Yalnız yayınlanmış kayıtlar; mevcut kolonlar doğrulandıktan sonra politika | Yetkili editör |
| legal_decisions | Yalnız yayınlanmış kayıtlar | Yetkili editör |
| practice_areas | Yayınlanmış tanıtım içeriği | Yetkili editör |
| testimonials | Yayın onayı bulunan kayıtlar | Yetkili editör |

`lr_accounts` yöneticisi eski sitenin yöneticisi sayılmamalı. İki ürünün yetkileri kendiliğinden birleştirilmemeli.

Uygulama öncesinde kolonlar, mevcut grant'ler ve canlı site istekleri incelenmeli; yedek/snapshot alınmalı; anonim okuma ve iletişim formu testleri hazırlanmalı. Ayrı migration taslağı sunulup onay alındıktan sonra RLS açılmalı. Bu paket eski tablolara grant veya politika eklemez.
