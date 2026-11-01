# T2.2 — Sürümlü domain katalogları ve numara normalizasyonu

1 Kasım 2026. Bu ticket yalnız saf domain katmanını ekler; mevcut UI veya canlı DB değişmez.

- `src/lib/normalize.js`: yıl/sıra çiftini normalleştirir. `2026 / 184 E.`, `2026-184 esas` ve `2026 184` aynı `2026/184` anahtarını verir. Belirsiz çoklu sayıları tahmin etmez. Görüntülenecek seri/sonek ve baştaki sıfırlar korunur. Türkçe arama normalizasyonu yalnız arama içindir.
- `src/domain/stages.js`: AGENTS.md Bölüm 6.3'teki 12 dosya türü, alt türleri ve sade müvekkil aşama etiketleri. Her şablon `draft-2026-11-01`, `unverified=true`, `verifiedByLawyer=false` ve görünür uyarı içerir. Snapshot, dosyaya özel değişikliğin ortak şablonu etkilemesini önler; otomatik sürüm yükseltmez.
- `src/domain/events.js`: Bölüm 6.5'teki 24 safahat türü. Paylaşım varsayılan kapalı. Tebligat için tür bazlı süre inceleme adayları ve görev taslakları üretir; kesin tarih, süre uzunluğu veya otomatik kayıt üretmez. Duruşma taslağı kendiliğinden takvim zamanı veya paylaşım açmaz.
- `tests/matter-catalogs.test.js`: 8 anlamlı test; normalizasyon/aramanın gerçek varyantları, belirsiz girdiler, Türkçe, şablon izolasyonu, varsayılan gizlilik ve hukuki tarih üretmeme.

İzole saf domain testi: **8/8 geçti**, 0 hata. Son uygulama snapshotinda `.env` veya mevcut node_modules kopyalanmadan `npm ci`, **19/19 birim testi**, **8/8 yerel SQL testi** ve Vite build gecti (1633 modul, 1.10 sn). Lockfile degismedi. Mevcut kullanıcı arayüzü bu yeni katalogları henüz tüketmez; ilgili T2.3 ve sonraki UI ticket'ları ayrıca uygulanmalıdır. Hukukçu doğrulaması yapılmış sayılmaz.
