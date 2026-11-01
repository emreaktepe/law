# Lawroom — Geliştirme ve Mimari Hazırlık Belgesi

> **Sürüm:** 1.0 · 1 Kasım 2026
> **Amaç:** Bu belge, Lawroom avukat–müvekkil portalının bugüne kadarki geçmişini, mevcut kod ve veritabanı durumunu, ürün ilkelerini ve özellikle **dosya takibinin** ayrıntılı tasarımını tek yerde toplar. ChatGPT / Codex ile geliştirme ve tasarım yapılırken **tek doğru kaynak** olarak kullanılmalıdır.
> **Kural:** Sıfırdan kurulum yok. Mevcut `lawroom/` uygulaması ve canlı Supabase şeması (`lr_` tabloları) üzerine geliştirilir.

> **Uygulama güncellemesi — 1 Kasım 2026:** Kullanıcının ek talebiyle giriş, kayıt, ilk kurulum, Supabase/Storage ve GitHub Pages/Resend hazırlığı kapsama alındı. T0.1 tarayıcı kontrolü ve T0.2 bağımsız kurulum tamamlandı. Giriş dosyası/demo ayrıldı, repository sınırı eklendi. Yeni Auth/onboarding ekranları ve SQL/Storage/bildirim migration'ları yerelde doğrulandı; canlıya henüz uygulanmadı. MCP/CLI hesabı `lawportal` projesine erişemediği için T0.5 baseline bekliyor. Eski site RLS planı yazıldı; eski tablolara dokunulmadı. Yayın demosundaki gerçek avukat profilleri, Bölüm 4.11–12 gereği kurgusal örneklerle değiştirildi. Güncel ayrıntılar: `docs/changelog.md`, `docs/release-setup.md`. Aşağıdaki envanter ve yol haritası önceki durumu da içerir; tamamlanmamış fazlar tamamlandı sayılmamalıdır.

---

## 0. Bu belge nasıl kullanılır? (ChatGPT / Codex için)

**Son kullanıcı kararı — 1 Kasım 2026:** İlk yayın GitHub Pages ile yapılacak. Resend için Lawroom'un kendi domaini beklenecek. Dietroom yalnız benchmark'tır; onun domaini, anahtarları, SMTP'si, veri deposu veya bildirim akışı bu projeye bağlanmaz.

**Yayın durumu:** https://emreaktepe.github.io/law/ üzerinde demo yayınlandı (PR #2, CI/Pages başarılı). Giriş/kayıt/ilk kurulum ekranları önizlemedir. 37 domain/repository + 8 yerel SQL testi başarılı. Canlı Supabase uygulaması bekliyor: yeniden bağlantı bu oturumdaki araçlara yansımadı; doğru proje erişimi/baseline doğrulanmadan migration çalıştırma. Resend domain bekler, anahtar oluşturulmadı.

1. Bu dosyayı repoda `lawroom/AGENTS.md` (veya `lawroom/docs/plan.md` + kısa bir `AGENTS.md` yönlendirmesi) olarak tut. Codex her oturumda önce bunu okumalı.
2. Her çalışma oturumu **tek bir ticket** (Bölüm 15) ile başlar. Ticket'ın kabul ölçütleri sağlanmadan sonraki ticket'a geçilmez.
3. **Bölüm 4 (Değişmez ilkeler)** hiçbir ticket'ta esnetilmez. Çelişki varsa kodlamayı durdur, soruyu yaz.
4. Veritabanı değişiklikleri yalnız **yeni migration dosyalarıyla** yapılır. `supabase/foundation.sql` **asla ikinci kez çalıştırılmaz** (zaten uygulanmıştır).
5. Hukuki süre, prosedür veya mevzuat içeren her içerik **"doğrulanmamış örnek"** olarak işaretlenir; hukukçu onayı olmadan "kesin" gösterilmez.
6. Her ticket sonunda: `npm test`, `npm run build`, varsa SQL erişim testleri ve kısa bir değişiklik notu (`docs/changelog.md`).

---

## 1. Proje özeti

**Lawroom**, avukatların (bireysel veya büro olarak) birden çok hukuk dosyasını kolayca takip ettiği, müvekkillerin ise avukatlarının paylaştığı gelişmeleri anlaşılır biçimde izlediği bir portaldır.

- **Benchmark:** Dietroom (DietApp) — diyetisyen/danışan yapısı, rol bazlı çalışma alanı, uzman başvurusu ve admin onayı, danışan kabulü, takvim, mesajlaşma, asistan. Aynı akış ve UX hissi hukuk bağlamına taşınır.
- **Ton:** Minimalist, güven veren, hukuk dünyasına uygun; ama içinde küçük bir **muzırlık** (Kâtip maskotu — bilge baykuş, kısa esprili notlar, sıcak mikro metinler).
- **Slogan:** "Hukukun ciddiyeti, iletişimin sıcaklığı." · "Dosyalar yerli yerinde. İletişim hep açık."
- **En kritik hedef:** Avukatın dosyalarına **hızlı erişmesi** ve her dosyada **"Sıradaki iş ne, ne zamana kadar, neden?"** sorusunun cevabını saniyeler içinde görmesi.

### Sağlayıcılar
| Alan | Sağlayıcı | Durum |
|---|---|---|
| Veritabanı / Auth / Storage | Supabase — proje `deezwydtiibbdtimxcxf` (`lawportal`), bölge Seul (ap-northeast-2), Nano | 15 `lr_` tablosu kurulu, RLS açık |
| Kod deposu | GitHub `emreaktepe/law` (public) | Yerelde klonlandı; Lawroom **henüz push edilmedi** |
| E-posta | Resend | Gönderen alan adı ve API anahtarı **henüz yok** |
| Tasarım | pen.dev (`design/lawroom.pen`) | Dosya yerelde script ile üretildi; editörde görsel doğrulama yapılamadı |

---

## 2. Geçmiş — bugüne kadar ne yapıldı?

### 2.1 Kullanıcının ilk talepleri (özet)
- Avukatlar/bürolar başvurur → **admin onaylar**. Bürolar kendi avukatlarını ekler; büro avukatlarının özellikleri bireysel avukatla aynıdır.
- Müvekkiller başvurur:
  - Referanslı avukatla geldiyse → **avukatın onayıyla** müvekkil olur.
  - Avukat ataması isterse → **admin atar** → **avukat kabul eder**.
- Admin yalnız sistemsel yönetim, onay ve izleme yapar (Dietroom'daki gibi). **Dosya içeriğini görmez.**
- Avukatlar sistemi müvekkilsiz dosyalar için de kullanabilir.
- Avukat çok sayıda dosya açar; müvekkil sistemdeyse dosyaya bağlar ve dosya müvekkil ekranında izlenebilir olur.
- Dosya türleri (icra, idari, boşanma vb.) olmalı; takip **çok kullanışlı, basit, anlaşılır** olmalı.
- Link, karar, belge görüntüleme gibi kolaylaştırıcılar.
- Hukuk danışman asistanı (önce avukatlar için, sonra müvekkiller).
- Hazır hukuk AI araçlarının değerlendirilmesi (Yargı MCP, Mizan-27B vb.), UYAP ve Adalet Bakanlığı kaynaklarının kullanılması — sıfırdan üretmek yerine kurulu enstrümanlar.
- Benchmark: Günce, HUKY, UYAP Vatandaş.

### 2.2 Sonradan eklenen kararlar
| Tarih (1 Kas 2026) | Karar |
|---|---|
| Tanıtım sayfası | Her **avukat ve büro** için herkese açık tanıtım/blog sayfası. **Müvekkillere herkese açık sayfa yok.** |
| Görünürlük | Tanıtım sayfası **isteğe bağlı, varsayılan kapalı**. Dosya/mesaj gizliliğini etkilemez. |
| Demo avukatlar | **Alkım Azmioğlu** ve **Enes Can Yolcu**. Bilgiler kaynaklı; uydurma uzmanlık/sicil/başarı iddiası yok. |
| Takvim | Çok amaçlı aktif takvim: **duruşmalar, dosya takipleri, müvekkil görüşmeleri**; renk + yazılı rozet (badge). |
| Ana ekran | Uygulama doğrudan demoya değil, **tanıtım ana sayfasına** açılır; demo ayrı düğmeyle. |
| Supabase | Proje için ayrı hesapla erişim. Supabase eklentisi hâlâ "yetki yok" verdiği için şema **Dashboard SQL Editor** üzerinden kuruldu. |

### 2.3 Teknik kronoloji
1. DietApp incelendi: `src/App.jsx` (rol bazlı alan), `src/role-pages.js` (rol erişim matrisi), `src/components.jsx` (form/modal/uyarı/boş durum), `src/styles.css` (DM Sans + Manrope, sakin yeşil, açık zemin), `src/clinic.jsx` (DailyBoard / takvim), `src/landing.jsx` (karşılama).
2. `emreaktepe/law` klonlandı (`D:/projeler/LawPortal/portal`). Mevcut `es-avukatlik` sitesi korundu; yeni uygulama `portal/lawroom/` alt dizininde.
3. Yerel prototip (React + Vite + lucide-react): dosya listesi, filtre, türe göre aşamalar, görevler, safahat, iç notlar, paylaşım, demo mesajlar, admin başvuru akışı, kaynak bağlantıları.
4. `docs/product.md`, `docs/research.md` yazıldı.
5. `design/lawroom.pen` script ile üretildi (4 ekran + 2 profil ekranı). pen.dev `execute` çağrıları zaman aşımına uğradığı için editörde doğrulanamadı; Kâtip maskotu üretilemedi.
6. Supabase'de mevcut 6 site tablosu tespit edildi (aşağıda). Dokunulmadan, `lr_` önekli 15 tablo + `lawroom_private` şeması kuruldu. Erişim testleri geçti.
7. Avukat tanıtım sayfaları (`LawyerProfiles.jsx`, `lawyers.js`) + görünürlük anahtarı.
8. Takvim (`Calendar.jsx`, `calendar-domain.js`, `calendar.css`) ve tanıtım ana sayfası (`Welcome.jsx`, `welcome.css`) eklendi; hash tabanlı giriş (`#demo?role=…&page=…`). **Bu son adımın test/derleme sonucu kayıtta görünmüyor — Faz 0'da ilk iş doğrulanmalı.**

---

## 3. Mevcut durum envanteri

### 3.1 Dosya yapısı (`portal/lawroom/`)
```
lawroom/
├─ index.html
├─ package.json               # bağımlılıklar DietApp node_modules junction'ından geliyor (!)
├─ .env.example / .gitignore
├─ README.md
├─ design/lawroom.pen         # 6 ekran (script ile üretildi)
├─ docs/
│  ├─ product.md              # roller, akışlar, dosya modeli, kabul testleri
│  ├─ research.md             # benchmark, hukuk AI değerlendirmesi
│  ├─ live-status.md          # Supabase canlı durum ve test sonuçları
│  └─ public-profiles.md      # tanıtım sayfaları, kaynaklar, görünürlük
├─ scripts/
│  ├─ create-design.mjs
│  └─ add-profile-designs.mjs
├─ supabase/foundation.sql    # UYGULANDI — tekrar çalıştırma
├─ src/
│  ├─ main.jsx                # tek büyük App bileşeni + Root (hash router)  ← bölünmeli
│  ├─ domain.js               # seed, types, flow(), resources, visibleCases, urgency, transition
│  ├─ Calendar.jsx / calendar-domain.js / calendar.css
│  ├─ Welcome.jsx / welcome.css
│  ├─ LawyerProfiles.jsx / lawyers.js
│  └─ style.css
└─ tests/
   ├─ domain.test.js          # 4 test (görünürlük + başvuru durum makinesi)
   └─ calendar.test.js        # 4 test (hafta başı, çakışma, doğrulama, müvekkil görünürlüğü)
```

### 3.2 Prototipte çalışan özellikler (hepsi demo, localStorage / bellek)
- Avukat / müvekkil / admin demo rolleri (rol seçici **güvenlik sınırı değildir**).
- Dosya oluşturma (müvekkilsiz de), arama, tür ve "yaklaşan süreler" filtresi.
- Türe göre aşama yol haritası, aşama güncelleme.
- Sıradaki işlem + hedef tarih + "doğrulandı / kontrol bekliyor".
- Görevler (checkbox), safahat (paylaşım işaretli), iç notlar, müvekkile açık özet, paylaşım anahtarı.
- Dosyaya bağlı demo mesajlar.
- Admin başvuruları: onay, atama → avukat kabulü.
- Kaynaklar sayfası (UYAP, mevzuat, Yargıtay, Resmî Gazete bağlantıları).
- Avukat tanıtım sayfaları (Hakkında / Yazılar / Başvuru), görünürlük anahtarı.
- Takvim: ay/hafta/ajanda; Duruşma (mor), Dosya takibi (turuncu), Müvekkil görüşmesi (mavi) rozetleri; çakışma uyarısı; iptal/tamamlandı; dosyadan türetilen hedef tarihler; müvekkil yalnız paylaşılanları görür.
- Tanıtım ana sayfası, rol bazlı demo girişi.

### 3.3 Canlı Supabase şeması
**Eski site tabloları (dokunulmadı):** `profiles`, `blog_posts`, `legal_decisions`, `practice_areas`, `contact_messages`, `testimonials`.
> ⚠️ Advisor bu tablolarda **RLS kapalı** (kritik) uyarısı veriyor. Eski sitenin erişim ihtiyacı incelenmeden toplu değişiklik yapılmadı. Ayrı bir ticket ile ele alınmalı (T0.6).

**Lawroom tabloları (foundation.sql):**
| Tablo | İçerik | Not |
|---|---|---|
| `lr_accounts` | user_id, display_name, role (admin/lawyer/client), status | Rol/durum yalnız sunucu tarafından yazılır |
| `lr_organizations` | büro/bireysel, status | |
| `lr_memberships` | organization_id, user_id, role (owner/lawyer), active | |
| `lr_applications` | avukat/büro/müvekkil başvurusu, referred_lawyer_id, status | Kullanıcı yalnız kendi başvurusunu ekler |
| `lr_relationships` | avukat–müvekkil ilişkisi, status (lawyer_review/accepted/rejected/revoked) | |
| `lr_matters` | dosya: title, matter_type, reference, court, stage, next_action, target_date, client_summary, archived_at | owner_id = tek sorumlu |
| `lr_matter_clients` | dosya ↔ ilişki, shared | |
| `lr_events` | safahat: title, occurred_on, shared | |
| `lr_tasks` | title, due_on, completed_at | |
| `lr_internal_notes` | body | Müvekkile asla açılmaz |
| `lr_messages` | dosyaya bağlı mesaj | |
| `lr_deadlines` | trigger_date, service_method, legal_basis, source_reference, proposed/verified due, verified_by, rule_version | Doğrulama için CHECK kısıtı var |
| `lr_documents` | name, object_path, media_type, shared | Storage politikası yok |
| `lr_audit_events` | actor, action, entity | |
| `lr_notification_outbox` | event_key unique, status, attempts | Worker yok |

**Yardımcı fonksiyonlar (`lawroom_private`, security definer, search_path=''):** `has_role`, `is_member`, `can_write(matter)` (yalnız owner), `can_read(matter)` (yazar veya kabul edilmiş ilişki + paylaşılmış dosya + aktif avukat/büro).

**Doğrulanmış güvenlik testleri (rollback'li):** avukat dosyasını ve iç notunu okur; müvekkil yalnız paylaşılan dosyayı ve paylaşılan safahatı görür, iç notu göremez; admin ve ilişkisiz kullanıcı dosya okuyamaz; `role` ve `owner_id` güncellenemez; ilişki `revoked` olunca müvekkil erişimi kesilir. Sonuç: 15 tablo, 15 RLS, anon grant = 0, 23 politika.

### 3.4 Bilinen eksikler / borçlar
- `main.jsx` tek dev bileşen; özellik klasörlerine bölünmeli.
- `node_modules` DietApp'ten junction → kendi `npm install` ile bağımsızlaştırılmalı.
- Migration geçmişi yok (Dashboard üzerinden uygulandı) → `supabase db pull` ile baseline alınmalı.
- `can_write` yalnız dosya sahibine izin veriyor → büro içi ekip çalışması yok.
- `can_read` müvekkil için `r.lawyer_id = m.owner_id` şartı → dosya başka avukata devredilirse müvekkil erişimi kopar.
- `lr_matter_clients`, `lr_documents`, `lr_deadlines` için insert/update politikası yok.
- Takvim tablosu yok (prototipte localStorage).
- Admin onay/atama RPC'leri, büro daveti, auth akışı yok.
- Storage bucket ve politikaları yok. Resend worker yok.
- Arayüz canlı veriye bağlı değil.
- Kâtip maskotu çizilmedi.

---

## 4. Değişmez ilkeler (guardrails)

1. **Admin dosya içeriği görmez.** Admin yalnız başvuru, üyelik, atama ve sistem sağlığı görür. Destek erişimi gerekirse ayrı, gerekçeli, süreli ve kayıtlı bir süreç tasarlanır.
2. **Atama ≠ kabul.** Admin ataması müvekkillik ilişkisi oluşturmaz; avukat kabulü gerekir.
3. **İlişki kabulü ≠ dosya erişimi.** Müvekkil bir dosyayı yalnız avukat o dosyaya bağlayıp **paylaştığında** görür; ayrıca her safahat/belge/takvim kaydı tek tek paylaşılır.
4. **İç notlar ayrı tabloda** ve hiçbir koşulda müvekkil ağ yanıtına girmez.
5. **Büro üyeliği tüm dosyalara otomatik erişim vermez.** Dosya erişimi `lr_matter_members` ile açıkça verilir.
6. **Hedef tarih ≠ hukuki süre.** Hukuki süre; tetikleyici olay, tebliğ tarihi/yöntemi, dayanak, kural sürümü ve **doğrulayan avukat** olmadan "kesin" gösterilmez. AI tek başına son gün üretmez.
7. **UYAP bağlantısı = link, senkronizasyon değil.** Yetkili, sözleşmeli bir yöntem doğrulanmadan otomatik eşitleme vaat edilmez.
8. **Yetki kararları yalnız sunucu verisine dayanır** (`lr_accounts`, `lr_memberships`, `lr_matter_members`), kullanıcı metadata'sına değil.
9. **Silme yerine arşiv / iptal.** Safahat, belge sürümü ve süre kayıtları değiştirilmez; düzeltme yeni kayıt + audit ile yapılır.
10. **Renk tek başına anlam taşımaz.** Her renkli öğede yazılı etiket/ikon bulunur (erişilebilirlik).
11. **Demo ile canlı ayrımı her zaman görünür.** Demo verisi gerçek kişi/dosya içermez.
12. **Tanıtım sayfası isteğe bağlı ve varsayılan kapalı.** Gerçek kişilerin bilgileri profil sahibinin onayı olmadan yayınlanmaz.

---

## 5. Roller ve akışlar (özet)

```
Avukat/Büro başvurusu ──► Admin incelemesi ──► onay ──► aktif çalışma alanı
                                         └─► gerekçeli red

Büro sahibi ──► avukat davet eder ──► davetli kimlik doğrular ──► üyelik aktif

Müvekkil (referanslı) ──► ilgili avukat ──► kabul ──► ilişki "accepted"
Müvekkil (atama ister) ──► admin kuyruğu ──► avukata atama ──► avukat kabul/red
                                                          └─► red → yeniden atama kuyruğu

Avukat dosya açar (müvekkilsiz olabilir) ──► müvekkil bağlar ──► paylaşır ──► müvekkil görür
```

| Rol | Görür | Yapar |
|---|---|---|
| Admin | Başvurular, atamalar, bürolar, sistem sağlığı | Onay, red, atama, askıya alma |
| Büro sahibi | Kendi dosyaları + üyesi olduğu dosyalar, büro üyeleri | Davet, dosya görevlendirme, büro sayfası |
| Avukat | Üyesi olduğu dosyalar | Dosya takibi, takvim, müvekkil kabulü, paylaşım |
| Müvekkil | Kendisiyle paylaşılan dosya/olay/belge/takvim | Mesaj, belge yükleme (talep edilirse) |

---

## 6. DOSYA TAKİBİ — ayrıntılı tasarım

> Ürünün kalbi burası. Her tasarım kararı şu üç soruya hizmet eder:
> 1. **Bugün neye bakmalıyım?**
> 2. **Bu dosyada sıradaki iş ne, ne zamana kadar ve neden?**
> 3. **Bir şey olduğunda (tebligat geldi, duruşma bitti) bunu 30 saniyede nasıl kaydederim ve doğru takipleri nasıl oluştururum?**

### 6.1 Avukatın gerçek işleri (jobs to be done)
| # | Durum | Ürünün cevabı |
|---|---|---|
| J1 | Sabah 40 dosya arasında acil olanı bulmak | **Bugün** ekranı + dikkat sıralaması |
| J2 | Telefonda müvekkil "dosyam ne oldu?" diye soruyor | Komut paleti (Ctrl+K) → isim/esas no → kokpit 2 saniyede |
| J3 | Adliyede/UYAP'ta yeni tebligat gördü | **Safahat ekle** hızlı formu → süre önerisi + görev + takvim tek adımda |
| J4 | Duruşmadan çıktı, ara karar var | Duruşma kaydında "Sonucu gir" → ara karar maddeleri görev olur, sonraki duruşma takvime düşer |
| J5 | Hafta planı | Takvim (duruşma/takip/görüşme rozetleri) + hafta görünümü |
| J6 | Unutulan, sessiz kalan dosyayı fark etmek | "Sessiz dosyalar" (X gündür hareket yok) |
| J7 | Aynı esas no farklı yazılmış | Numara normalizasyonu ile arama |
| J8 | Dosya icraya dönüştü / istinafa gitti | Bağlı dosyalar + çoklu numara geçmişi |
| J9 | Büroda dosyayı stajyer/meslektaşla paylaşmak | Dosya üyeleri (sorumlu / ekip / görüntüleyici) |
| J10 | Eski dosyalarını sisteme taşımak | CSV/Excel içe aktarma |

### 6.2 Kavram modeli
```
Dosya (matter)
 ├─ Tür + alt tür + şablon sürümü  → aşamalar, olay türleri, önerilen görevler
 ├─ Numaralar (esas, karar, icra takip, soruşturma, istinaf, temyiz…) — birincil olan listede görünür
 ├─ Taraflar (kişi/kurum) + rolleri; müvekkil bağlantıları (ilişki üzerinden)
 ├─ Üyeler (sorumlu avukat, ekip, görüntüleyici)
 ├─ Aşama + aşama geçmişi
 ├─ Safahat (olaylar) ──► üretebilir ──► Görev, Süre önerisi, Takvim kaydı
 ├─ Görevler (atanan, öncelik, son tarih, kaynak olay/süre)
 ├─ Süreler (önerilen → doğrulanmış → karşılandı/kaçırıldı/geçersiz)
 ├─ Takvim kayıtları (duruşma, keşif, bilirkişi, görüşme, arabuluculuk, takip…)
 ├─ Belgeler + sürümler (+ kaynak olay bağlantısı)
 ├─ Masraflar
 ├─ Mesajlar (müvekkil ile)
 ├─ İç notlar
 ├─ Bağlı dosyalar (arabuluculuk → dava → icra; dava → istinaf)
 └─ Denetim geçmişi
```

**"Sıradaki iş" tek bir alan değil, hesaplanan bir değerdir:** açık görevler, açık süreler ve planlanmış takvim kayıtları arasından en erken/en kritik olan. Mevcut `next_action/target_date` alanları geçiş döneminde "manuel sıradaki iş" olarak kalır; kokpit hesaplanan değeri öncelikli gösterir.

### 6.3 Dosya türleri, alt türler ve aşama şablonları

> ⚠️ Aşağıdaki şablonlar **ürün iskeletidir**, prosedürün eksiksiz modeli değildir. Hukukçu ile doğrulanıp **sürümlenerek** (`template_version`) yayınlanır. Her aşamada müvekkile gösterilecek **sade dil karşılığı** (`client_label`) bulunur.

| Tür | Alt türler (örnek) | Aşamalar (avukat etiketi → müvekkil etiketi) |
|---|---|---|
| **İcra** | İlamsız takip, ilamlı takip, kambiyo senetlerine dayalı takip, kira/tahliye, rehin | Hazırlık → Takip açıldı → Ödeme emri/tebligat → İtiraz süreci → Kesinleşme → Haciz → Satış → Tahsilat → Kapanış *(müvekkil: "Takip başlatıldı", "Borçluya bildirim", "Tahsilat aşaması"…)* |
| **Aile** | Anlaşmalı boşanma, çekişmeli boşanma, velayet, nafaka, mal rejimi, koruma tedbiri | Hazırlık → Dava açıldı → Dilekçeler → Ön inceleme → Tahkikat → Karar → Kanun yolu → Kesinleşme |
| **İş** | İşe iade, işçilik alacağı, iş kazası | Arabuluculuk → Dava açıldı → Dilekçeler → Ön inceleme → Tahkikat (bilirkişi) → Karar → Kanun yolu |
| **İdari / Vergi** | İptal, tam yargı, vergi | İşlem/öğrenme → (Ön başvuru) → Dava açıldı → YD talebi → Savunmalar → Karar → Kanun yolu |
| **Ceza** | Soruşturma (şüpheli/müşteki), kovuşturma (sanık/katılan) | Soruşturma → İddianame/KYOK → Kovuşturma → Duruşmalar → Hüküm → Kanun yolu → İnfaz |
| **Ticaret** | Alacak, şirketler, haksız rekabet | Arabuluculuk → Dava → Dilekçeler → Ön inceleme → Tahkikat → Karar → Kanun yolu |
| **Tüketici** | Ayıplı mal/hizmet, hakem heyeti | Hakem heyeti/arabuluculuk → Dava → … → Karar |
| **Miras** | Mirasçılık belgesi, tenkis, ortaklığın giderilmesi | Hazırlık → Dava → … → Karar → Satış/paylaştırma |
| **Gayrimenkul** | Tapu iptal-tescil, kira tespit, tahliye, kamulaştırma | Hazırlık → Dava → Keşif → Bilirkişi → Karar → Kanun yolu |
| **Arabuluculuk** | Dava şartı / ihtiyari | Başvuru → Toplantılar → Anlaşma / Anlaşamama → (bağlı dava açılır) |
| **Danışmanlık** | Sözleşme, görüş, uyum | Talep → İnceleme → Taslak → Teslim → Kapanış |
| **Diğer** | Serbest | Avukatın tanımladığı aşamalar |

Kurallar:
- Aşama değişikliği **aşama geçmişine** yazılır (kim, ne zaman, not).
- Avukat şablon dışı aşama ekleyebilir (dosya bazında), şablonu bozmaz.
- Şablon sürümü dosyaya kilitlenir; yeni sürüm eski dosyaları değiştirmez (isteğe bağlı yükseltme).

### 6.4 Dosya numaraları
Bir dosyanın ömrü boyunca birden çok numarası olur. Tek `reference` alanı yetmez.

- Türler: `esas`, `karar`, `icra_takip`, `sorusturma`, `istinaf_esas`, `temyiz_esas`, `arabuluculuk`, `diger`.
- Her numaranın **makamı** (ör. "İstanbul 14. İş Mahkemesi", "İstanbul 5. İcra Dairesi") ve geçerlilik tarihi var.
- Bir tanesi **birincil**: listede ve başlıkta görünür.
- **Normalizasyon** (arama için): `"2026 / 184 E."`, `"2026/184"`, `"2026-184 esas"` → `2026/184`. Fonksiyon: rakam grupları + yıl/sıra çıkarımı, harf ekleri ayrı alan. Domain fonksiyonu + test zorunlu.
- Başlıkta **"Kopyala"** düğmesi (UYAP'ta aramak için en sık yapılan iş).

### 6.5 Safahat (olaylar) ve "Safahat ekle" akışı

**Olay türü kataloğu (ilk sürüm):**
`dava_acildi`, `takip_baslatildi`, `dilekce_verildi`, `dilekce_alindi`, `tebligat_yapildi`, `tebligat_alindi`, `durusma_yapildi`, `ara_karar`, `bilirkisi_raporu`, `kesif_yapildi`, `tanik_dinlendi`, `karar_verildi`, `karar_teblig`, `kanun_yolu_basvurusu`, `itiraz`, `kesinlesme`, `haciz`, `satis`, `tahsilat`, `arabuluculuk_toplantisi`, `anlasma`, `belge_eklendi`, `muvekkil_gorusmesi`, `diger`.

Her olay türünün tanımı (kod içi katalog, sonra DB):
```js
{
  key: 'tebligat_alindi',
  label: 'Tebligat alındı',
  clientLabel: 'Size/avukatınıza resmî bildirim ulaştı',
  fields: ['occurred_on', 'served_on', 'service_method', 'source_document'],
  suggests: {
    deadlines: ['rule:cevap_dilekcesi', 'rule:itiraz_icra'],   // türe göre filtrelenir
    tasks: ['Tebliğ edilen evrakı incele', 'Müvekkile bilgi ver'],
    agenda: []
  },
  defaultShared: false
}
```

**Akış — tek ekran, tek kayıt (atomik):**
1. Avukat dosyada veya her yerden (Ctrl+K → "Safahat ekle") formu açar.
2. Olay türünü seçer → form alanları türe göre değişir.
3. Sağ tarafta **öneriler** belirir (checkbox'lı, düzenlenebilir):
   - ☑ Süre önerisi: "Cevap süresi — önerilen son gün 18 Kas · **doğrulama bekliyor**"
   - ☑ Görev: "Cevap dilekçesini hazırla (son tarih: 15 Kas)"
   - ☐ Takvim: "Dilekçe çalışma bloğu"
   - ☐ Müvekkille paylaş + sade özet önerisi
4. "Kaydet" → tek RPC (`lr_add_proceeding`) ile olay + seçilen görevler + süre önerileri + takvim kayıtları **aynı transaction'da** oluşur.
5. Toast: "Kaydedildi. 1 süre doğrulama bekliyor." + "Şimdi doğrula" linki.

**Duruşma döngüsü:**
- Takvimde duruşma kaydı geçmiş tarihe düşünce **Bugün** ekranında "Duruşma sonucunu gir" kartı çıkar.
- Form: sonuç (ertelendi / karar / ara karar), ara karar maddeleri (her biri → görev, sorumlu, son tarih), sonraki duruşma tarihi (→ takvim), müvekkile paylaşılacak özet.
- Kaydedince duruşma kaydı `done`, safahata `durusma_yapildi` olayı eklenir.

### 6.6 Görevler
- Alanlar: başlık, dosya, **atanan kişi** (dosya üyeleri), öncelik (normal/yüksek/kritik), son tarih, durum (açık/tamamlandı/iptal), kaynak olay, bağlı süre, notlar.
- Görev bir süreye bağlıysa son tarihi varsayılan olarak süreden **N gün önce** önerilir (avukat ayarı, varsayılan 2 iş günü).
- Gecikmiş görev; tamamlanana veya **gerekçeli ertelenene** kadar Bugün ekranında kalır. Ertelemeler audit'e yazılır.
- "Müvekkilden belge iste" özel görev tipi: müvekkil ekranında "Sizden beklenen" olarak görünür, müvekkil belge yükleyince görev otomatik "inceleme bekliyor"a geçer (Faz 4).

### 6.7 Süreler (hukuki son günler)

**Yaşam döngüsü:**
```
proposed (öneri) ──avukat doğrular──► verified ──► met (karşılandı)
     │                                   ├──────► missed (kaçırıldı)
     │                                   └──────► waived (gerekçeli vazgeçildi)
     └── kaynak belge/tebliğ tarihi değişirse ──► invalidated (yeniden doğrulama gerekir)
```
- **proposed**: Kural kataloğundan hesaplanan veya elle girilen tarih. Arayüzde kesik çerçeve + "Doğrulama bekliyor" rozeti.
- **verified**: Avukat tetikleyici olayı, tebliğ tarihini/yöntemini, dayanağı ve son günü onaylar. `verified_by`, `verified_at`, `rule_version` zorunlu (foundation'daki CHECK kısıtı bunu zaten zorluyor).
- Doğrulama ekranı hesaplama girdilerini gösterir: tetikleyici tarih, eklenen süre, tatil/hafta sonu kaydırmaları, adli tatil etkisi, sonuç. Avukat farklı tarih seçerse gerekçe ister.

**Kural kataloğu (`lr_deadline_rules`) yapısı:**
| Alan | Açıklama |
|---|---|
| key, version | `itiraz_icra@1` |
| matter_types | Geçerli türler |
| trigger_event | Hangi olay türünden başlar (ör. `tebligat_alindi`) |
| offset_value / offset_unit | 7 / gün, 2 / hafta, 60 / gün … |
| end_on_non_business_day | Sonraki iş gününe kaydır / kaydırma |
| judicial_recess | Adli tatil etkisi uygulanır mı + nasıl |
| legal_basis | Kanun/madde metni referansı |
| verified_by_lawyer / verified_at | **Kural** hukukçu tarafından doğrulandı mı |
| effective_from / to | Mevzuat değişikliği için geçerlilik |

> 🔴 **DOĞRULANMAMIŞ ÖRNEKLER** — yalnız şema örneğidir, hukukçu onayı olmadan `verified_by_lawyer=true` yapılamaz:
> - İcra ödeme emrine itiraz → tebliğden itibaren 7 gün (İİK m.62)
> - HMK istinaf → kararın tebliğinden itibaren 2 hafta (HMK m.345)
> - İdari dava açma → tebliğden itibaren 60 gün, vergi mahkemesinde 30 gün (İYUK m.7)
> - Adli tatil 20 Temmuz–31 Ağustos; bazı süreler tatil bitiminden itibaren 1 hafta uzar (HMK m.102–104) — istisnaları ayrıca modellenmeli.

**Tatil takvimi (`lr_holidays`):** resmî tatiller, yarım gün arifeler, adli tatil aralığı; yıl yıl admin tarafından girilir, kaynak belirtilir. Hesap motoru **saf fonksiyon** (`domain/deadlines.js`) olarak yazılır ve kapsamlı test edilir; belirsiz girdi → `hesaplanamaz` döner, tahmin üretmez.

### 6.8 Dikkat sıralaması (attention ranking)

Bugün ekranı ve "Dikkat" filtresi için saf fonksiyon: `rankAttention(matters, now) → [{matterId, tier, reason, dueAt}]`.

| Kademe | Koşul | Rozet / renk | "Neden burada?" metni |
|---|---|---|---|
| 1 | Doğrulanmış süre geçmiş, karşılanmamış | 🔴 Kritik | "Süre 2 gün önce doldu" |
| 2 | Doğrulanmış süre bugün/yarın | 🔴 Bugün/Yarın | "Son gün yarın" |
| 3 | Süre önerisi doğrulanmamış | 🟠 Doğrula | "Tebliğ girildi, süre doğrulanmadı" |
| 4 | 48 saat içinde duruşma + açık hazırlık görevi | 🟣 Duruşma | "Perşembe 10:00 duruşma, 2 açık görev" |
| 5 | Gecikmiş görev | 🟠 Gecikti | "3 gün gecikti" |
| 6 | Geçmiş duruşmanın sonucu girilmedi | 🟣 Sonuç | "Duruşma sonucu bekleniyor" |
| 7 | Müvekkil mesajı 24 saattir yanıtsız | 🔵 Mesaj | "Müvekkil 1 gündür yanıt bekliyor" |
| 8 | 7 gün içinde işlem | ⚪ Yaklaşıyor | "5 gün kaldı" |
| 9 | Aktif dosyada 30+ gündür hareket yok | ⚪ Sessiz | "34 gündür hareket yok" |

Kademe içinde tarih sırası. Her satırda **yazılı neden** zorunlu. Eşik değerleri kullanıcı ayarı (varsayılanlar yukarıdaki gibi).

### 6.9 Ekranlar

#### A. Bugün (avukatın açılış ekranı)
Dietroom'un DailyBoard yapısının hukuk karşılığı. Sırasıyla:
1. **Kaçırılmaması gerekenler** (kademe 1–3) — her kartta: dosya, neden, tarih, `[Doğrula] [Tamamla] [Ertele…] [Dosyayı aç]`.
2. **Bugünün takvimi** — saat sıralı; duruşmalarda adliye/salon, görüşmelerde çevrim içi link.
3. **Sonuç bekleyen duruşmalar** (kademe 6).
4. **Yanıt bekleyen mesajlar** (kademe 7).
5. **Bu hafta yaklaşanlar** (kademe 4, 5, 8) — katlanabilir.
6. **Sessiz dosyalar** — "Bir göz atın" tonuyla.
7. Sağ kolonda Kâtip notu + "Günün özeti" (X kritik, Y duruşma, Z görev).

Boş durum: "Bugün kaçırılacak bir şey yok. Kâtip çayını tazeledi." ☕

#### B. Dosyalarım (liste)
- **Varsayılan görünüm: yoğun liste** (kanban ikincil). Satır yüksekliği: rahat / yoğun anahtarı.
- Kolonlar: Dosya (başlık + tür rozeti + alt tür) · Birincil no (kopyala ikonu) · Müvekkil(ler) · Mahkeme/daire · Aşama (nokta ilerleme çubuğu + aşama adı) · **Sıradaki iş** (metin + tarih + kademe rozeti) · Son hareket · Sorumlu (avatar).
- Arama: başlık, **tüm numaralar (normalize)**, taraf adları, mahkeme, müvekkil. Sonuçta eşleşen alan vurgulanır ("esas no eşleşti").
- Filtreler (chip + açılır panel): tür, alt tür, aşama, mahkeme, sorumlu, müvekkil, durum (aktif/beklemede/kapalı/arşiv), dikkat kademesi, paylaşılmış mı, doğrulanmamış süre var mı.
- **Kayıtlı görünümler**: "Bu hafta duruşmalı", "İcra – tahsilat aşaması", "Doğrulama bekleyenler"… kullanıcı kaydeder, sabitler, varsayılan yapar. URL'ye yansır (paylaşılabilir).
- Gruplama: mahkeme / müvekkil / tür / aşama.
- Sıralama: dikkat (varsayılan), sıradaki iş tarihi, son hareket, oluşturulma, başlık.
- **Toplu işlemler** (çoklu seçim): sorumlu ata, etiket ekle, aşama değiştir (aynı türdekiler), arşivle, CSV dışa aktar.
- Sayfalama: sanal liste / sonsuz kaydırma; 500 dosyada akıcı.
- Klavye: `/` arama, `J/K` satır gezinme, `Enter` aç, `X` seç, `N` yeni dosya.

#### C. Dosya kokpiti (detay)
```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Dosyalarım   İŞ HUKUKU · İşe iade                       [Aktif ▾]  │
│ İşe iade talebi                                                      │
│ 2026/184 E. [⧉] ▾ (+2 numara) · İstanbul 14. İş Mahkemesi            │
│ Müvekkil: Deniz Yılmaz · Sorumlu: Av. Alkım Azmioğlu  · UYAP'a git ↗ │
│ ●──●──●──◉──○──○  Tahkikat                                           │
├──────────────────────────────────────────────┬───────────────────────┤
│ [Genel] [Safahat] [Süre & görev] [Takvim]    │ SIRADAKİ İŞ           │
│ [Belgeler] [Taraflar] [Masraf] [Mesajlar]    │ Beyan dilekçesi       │
│ [İç notlar] [Paylaşım] [Geçmiş]              │ 3 Kas · Doğrulandı ✓  │
│                                              │ Kaynak: bilirkişi rap.│
│  …sekme içeriği…                             │───────────────────────│
│                                              │ YAKLAŞANLAR (3)       │
│                                              │ • 6 Kas Duruşma 10:00 │
│                                              │ • 9 Kas Görev …       │
│                                              │───────────────────────│
│                                              │ HIZLI İŞLEM           │
│                                              │ + Safahat  + Görev    │
│                                              │ + Duruşma  + Belge    │
│                                              │ ✉ Müvekkile yaz       │
└──────────────────────────────────────────────┴───────────────────────┘
```
- **Genel**: aşama yol haritası, müvekkile açık özet (önizleme: "Müvekkil böyle görüyor"), son 5 safahat, açık görevler, doğrulama bekleyen süreler.
- **Safahat**: dikey zaman çizelgesi; filtre (tür, paylaşılan/iç); her olayda kaynak belge, oluşturan, görünürlük anahtarı, bağlı görev/süreler. Düzeltme = "düzeltme kaydı" (orijinal görünür kalır).
- **Süre & görev**: süreler tablosu (durum rozetleri, doğrula düğmesi, hesaplama girdileri) + görev listesi (atanan, öncelik, sürükle-bırak sıralama).
- **Takvim**: dosyaya ait takvim kayıtları (mini ajanda) + "Duruşma ekle".
- **Belgeler**: klasör/kategori (dilekçe, karar, tebligat, bilirkişi, sözleşme, makbuz, diğer), sürümler, PDF önizleme, paylaşım anahtarı, kaynak olay bağlantısı.
- **Taraflar**: kişi/kurum, rol, vekil bilgisi, iletişim (yalnız büro içi).
- **Masraf**: kalem, tutar, tarih, kim ödedi, müvekkile yansıtılacak mı, makbuz belgesi; toplam.
- **Mesajlar**: müvekkil yazışması (dosyaya bağlı).
- **İç notlar**: yalnız büro; zaman damgalı not akışı (tek textarea değil).
- **Paylaşım**: bağlı müvekkiller, dosya paylaşımı açık/kapalı, "müvekkil görünümünü önizle", paylaşılan öğe sayıları.
- **Geçmiş**: audit (kim neyi ne zaman değiştirdi).
- Mobilde sağ panel üste "Sıradaki iş" kartı olarak taşınır; hızlı işlemler sabit alt çubukta.

#### D. Komut paleti (Ctrl/Cmd + K)
- Dosya ara (başlık/numara/müvekkil) → aç.
- "2026/184" yazınca doğrudan numara eşleşmesi en üstte.
- Eylemler: "Safahat ekle…", "Görev ekle…", "Duruşma ekle…", "Yeni dosya", "Takvime git", "Bugün".
- Son açılan 5 dosya varsayılan liste.

#### E. Yeni dosya sihirbazı (≤ 60 saniye)
1. Tür + alt tür (kartlarla, ikonlu).
2. Başlık, birincil numara (opsiyonel — "henüz yok"), makam.
3. Müvekkil: sistemdeki kabul edilmiş müvekkillerden seç / "henüz yok" / taraf olarak isim gir.
4. Başlangıç aşaması (şablondan) + ilk sıradaki iş (opsiyonel).
5. Oluştur → kokpit açılır, "İlk safahatı ekleyin" ipucu.

#### F. İçe aktarma (onboarding)
- CSV/XLSX şablonu indir → doldur → yükle → **eşleştirme ekranı** (kolon ↔ alan) → önizleme + hata satırları → onayla.
- Alanlar: başlık, tür, alt tür, numaralar, makam, müvekkil adı, aşama, sıradaki iş, tarih, notlar.
- UYAP'tan alınabilecek liste formatları ayrıca incelenir (format doğrulanmadan otomatik eşleme vaat edilmez).

### 6.10 Belgeler
- Supabase Storage **private** bucket `lr-matter-files`; yol: `{organization_id}/{matter_id}/{document_id}/{version}-{dosyaadi}`.
- Her yükleme yeni **sürüm**; eski sürüm silinmez. SHA-256 hash tutulur.
- İndirme/önizleme: kısa ömürlü signed URL, her istekte güncel yetki kontrolü (Edge Function veya RPC ile).
- PDF önizleme (pdf.js). **UDF** dosyaları orijinal haliyle saklanır, resmî editöre yönlendirilir; güvenli dönüştürme doğrulanana kadar UDF önizleme vaat edilmez.
- Belge ↔ safahat olayı ↔ süre bağlantısı: "Bu süre şu tebligata dayanıyor" tek tıkla açılır.
- Müvekkil yükleme: yalnız "belge talebi" görevi varsa ve o talebe bağlı olarak.

### 6.11 Taraflar ve bağlı dosyalar
- Taraf rolleri: davacı, davalı, alacaklı, borçlu, şüpheli, sanık, müşteki, katılan, üçüncü kişi, karşı vekil, bilirkişi, arabulucu.
- Müvekkil tarafı işaretlenir; portal kullanıcısı varsa ilişki üzerinden bağlanır.
- **Çakışma kontrolü (ileri faz):** yeni dosyada karşı taraf, büronun mevcut müvekkili mi? Uyarı (yalnız büro içi, yetkiye göre).
- Bağlı dosya türleri: `derived_from` (arabuluculuk → dava), `enforcement_of` (dava → icra), `appeal_of` (istinaf/temyiz), `related`. Kokpitte "Bağlı dosyalar" şeridi.

### 6.12 Masraflar
- Kalem (harç, tebligat, bilirkişi, keşif, yol, diğer), tutar, para birimi, tarih, ödeyen (büro/müvekkil), müvekkile yansıtılacak mı, makbuz belgesi.
- Dosya toplamı + müvekkile yansıtılacak toplam. Muhasebe/fatura **kapsam dışı** (ilk sürüm).
- Faiz/alacak hesaplama ayrı, doğrulanmış ve sürümlü modül olarak ileri faza bırakılır.

### 6.13 Müvekkil görünümü
- **Dosyalarım**: her dosya için sade dil aşaması ("Şu anda: deliller değerlendiriliyor"), avukatın paylaştığı özet, son paylaşılan gelişmeler, yaklaşan paylaşılan takvim kayıtları (ör. görüşme, duruşma), paylaşılan belgeler.
- **Sizden beklenen**: belge talepleri, görüşme onayı.
- **Mesajlar**: dosyaya bağlı yazılı iletişim.
- Müvekkil **hiçbir zaman** görmez: iç notlar, paylaşılmamış olaylar/belgeler, süre hesaplamaları, ekip üyelerinin iç görevleri, diğer müvekkiller.
- Ton: "Sizin için, daha anlaşılır." Hukuki terimlerde küçük açıklama balonları (sözlük).

### 6.14 Kapanış ve arşiv
- Kapanış: gerekçe (karar kesinleşti, tahsil edildi, feragat, sulh, vekâlet sona erdi…) + kapanış tarihi + açık görev/süre kontrolü ("2 açık görev var, iptal edilsin mi?").
- Arşiv dosyası listede varsayılan gizli, aranabilir, salt okunur; yeniden açılabilir (audit'li).

### 6.15 Mikro metin ve ton rehberi
| Durum | Metin |
|---|---|
| Boş liste | "Burada henüz bir dosya yok. İlkini birlikte açalım." |
| Bugün boş | "Bugün kaçırılacak bir şey yok. Kâtip çayını tazeledi." |
| Doğrulanmamış süre | "Bu tarih bir öneri. Tebliğ ve dayanağı kontrol edip onaylayın." |
| Sessiz dosya | "Bu dosya bir süredir sessiz. Bir göz atmak ister misiniz?" |
| Kaydedildi | "Kaydedildi. Dosya bir adım daha net." |
| Hata | "Kaydedemedik. Bağlantınızı kontrol edip tekrar deneyin; girdiğiniz bilgiler duruyor." |

Kural: espri yalnız boş/başarı durumlarında; **süre, hata ve uyarı metinlerinde espri yok.**

---

## 7. Takvim (çok amaçlı)

### 7.1 Kayıt türleri ve görsel dil
| Tür (`kind`) | Etiket | Renk | Kaynak |
|---|---|---|---|
| `hearing` | Duruşma | Mor | Manuel / duruşma sonucu formu |
| `discovery` | Keşif | Mor (açık ton) + ikon | Manuel |
| `expert` | Bilirkişi | Mor (açık ton) + ikon | Manuel |
| `client_meeting` | Müvekkil görüşmesi | Mavi | Manuel |
| `mediation` | Arabuluculuk | Turkuaz | Manuel |
| `followup` | Dosya takibi | Turuncu | Görev son tarihi / manuel |
| `deadline` | Son gün | Kırmızı (doğrulanmış) / kesik çerçeve (öneri) | `lr_deadlines`'tan türetilir, takvimde düzenlenemez |
| `internal` | Büro içi | Gri | Manuel |

- Her kayıtta **yazılı rozet** + saat + dosya kısa adı. Renk tek başına bilgi taşımaz.
- Süre kayıtları "tüm gün" ve en üstte; doğrulanmamışlar kesik çerçeveli.
- Durum: planlandı / tamamlandı (kesik sol çizgi) / ertelendi / iptal (üstü çizili, gizlenebilir).

### 7.2 Görünümler
- **Ay** (hücrede en fazla 3 kayıt + "+N"), **Hafta** (saat ızgarası), **Gün/Ajanda**, sağda **Günün akışı** paneli (mevcut prototipteki yapı korunur).
- Filtreler: tür rozetleri (tıkla-filtrele, mevcut), sorumlu (büro takvimi), dosya, yalnız benim.
- Büro görünümü: avukat başına renkli kenar veya sütun (ileri faz).

### 7.3 Kurallar
- Zaman dilimi: `Europe/Istanbul`; DB'de `timestamptz`, tüm gün kayıtlar ayrıca `all_day_date`.
- Çakışma: aynı avukat, aynı zaman, planlanmış kayıtlar → uyarı (engel değil). Mevcut `conflicts()` fonksiyonu korunur.
- Duruşma tarihi geçince "Sonucu gir" Bugün'e düşer (6.5).
- Müvekkil yalnız `shared_with_client = true` ve dosyası paylaşılmış kayıtları görür (mevcut test bunu doğruluyor).
- Dışa aktarma: kişisel **ICS abonelik linki** (Faz 3+, imzalı token, yalnız başlık + saat; dosya içeriği yok, müvekkil adı opsiyonel).
- Hatırlatıcılar: Resend ile (Faz 5) — duruşmadan 1 gün önce, süre son gününden 3 gün ve 1 gün önce.

---

## 8. Veri modeli genişletmesi — Migration 002 (TASLAK)

> Uygulama öncesi: (1) `supabase db pull` ile mevcut şemayı **baseline migration** olarak al, (2) bu taslağı `supabase/migrations/<timestamp>_002_matter_tracking.sql` olarak yaz, (3) önce **Supabase branch**'te veya yerel `supabase start` ortamında çalıştır, (4) Bölüm 14'teki SQL erişim testlerini geçir, (5) sonra üretime.

```sql
begin;

-- 8.1 Dosya üyeleri (ekip çalışması)
create table public.lr_matter_members (
  matter_id uuid not null,
  organization_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('responsible','collaborator','viewer')),
  added_by uuid references public.lr_accounts(user_id),
  created_at timestamptz not null default now(),
  primary key (matter_id, user_id),
  foreign key (matter_id, organization_id) references public.lr_matters(id, organization_id),
  foreign key (organization_id, user_id) references public.lr_memberships(organization_id, user_id)
);
insert into public.lr_matter_members (matter_id, organization_id, user_id, role)
  select id, organization_id, owner_id, 'responsible' from public.lr_matters;

-- 8.2 Dosya alanları
alter table public.lr_matters
  add column subtype text,
  add column status text not null default 'active'
    check (status in ('active','on_hold','closed','archived')),
  add column priority text not null default 'normal'
    check (priority in ('normal','high','critical')),
  add column stage_key text,
  add column template_version text,
  add column internal_ref text,
  add column closed_reason text,
  add column closed_on date,
  add column last_activity_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

-- 8.3 Numaralar
create table public.lr_matter_numbers (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.lr_matters(id),
  kind text not null check (kind in ('esas','karar','icra_takip','sorusturma',
        'istinaf_esas','temyiz_esas','arabuluculuk','diger')),
  value text not null,
  normalized text not null,           -- uygulama tarafında normalize edilip yazılır
  authority text,                     -- mahkeme / daire / icra dairesi
  is_primary boolean not null default false,
  valid_from date,
  created_at timestamptz not null default now()
);
create unique index lr_matter_numbers_primary on public.lr_matter_numbers(matter_id) where is_primary;
create index lr_matter_numbers_norm on public.lr_matter_numbers(normalized);

-- 8.4 Aşama geçmişi
create table public.lr_stage_history (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.lr_matters(id),
  from_stage text, to_stage text not null,
  changed_by uuid not null references public.lr_accounts(user_id),
  note text, changed_at timestamptz not null default now()
);

-- 8.5 Safahat zenginleştirme
alter table public.lr_events
  add column event_type text not null default 'diger',
  add column note text,
  add column served_on date,
  add column service_method text,
  add column source_document_id uuid references public.lr_documents(id),
  add column created_by uuid references public.lr_accounts(user_id),
  add column corrects_event_id uuid references public.lr_events(id),
  add column details jsonb not null default '{}'::jsonb;

-- 8.6 Görev zenginleştirme
alter table public.lr_tasks
  add column assignee_id uuid references public.lr_accounts(user_id),
  add column priority text not null default 'normal' check (priority in ('normal','high','critical')),
  add column status text not null default 'open' check (status in ('open','done','cancelled')),
  add column kind text not null default 'work' check (kind in ('work','client_document_request')),
  add column source_event_id uuid references public.lr_events(id),
  add column deadline_id uuid references public.lr_deadlines(id),
  add column shared_with_client boolean not null default false,
  add column created_by uuid references public.lr_accounts(user_id),
  add column postponed_reason text;

-- 8.7 Süre yaşam döngüsü
alter table public.lr_deadlines
  add column status text not null default 'proposed'
    check (status in ('proposed','verified','invalidated','met','missed','waived')),
  add column rule_key text,
  add column source_event_id uuid references public.lr_events(id),
  add column calculation jsonb not null default '{}'::jsonb,   -- girdiler ve kaydırmalar
  add column resolution_note text,
  add column created_at timestamptz not null default now();

-- 8.8 Takvim
create table public.lr_agenda_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.lr_organizations(id),
  matter_id uuid references public.lr_matters(id),
  owner_id uuid not null references public.lr_accounts(user_id),
  kind text not null check (kind in ('hearing','discovery','expert','client_meeting',
        'mediation','followup','internal')),
  title text not null check (length(trim(title)) between 1 and 200),
  starts_at timestamptz, ends_at timestamptz,
  all_day boolean not null default false, all_day_date date,
  location text, online_url text,
  status text not null default 'planned' check (status in ('planned','done','postponed','cancelled')),
  shared_with_client boolean not null default false,
  outcome_event_id uuid references public.lr_events(id),
  created_at timestamptz not null default now(),
  check ((all_day and all_day_date is not null) or (not all_day and starts_at is not null and ends_at > starts_at))
);
create index lr_agenda_owner_time on public.lr_agenda_items(owner_id, starts_at);
create index lr_agenda_matter on public.lr_agenda_items(matter_id);

-- 8.9 Taraflar ve bağlı dosyalar
create table public.lr_parties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.lr_organizations(id),
  kind text not null check (kind in ('person','institution')),
  display_name text not null, identifier_note text, contact_note text,
  created_at timestamptz not null default now()
);
create table public.lr_matter_parties (
  matter_id uuid not null references public.lr_matters(id),
  party_id uuid not null references public.lr_parties(id),
  role text not null, is_client_side boolean not null default false,
  primary key (matter_id, party_id, role)
);
create table public.lr_matter_links (
  from_matter uuid not null references public.lr_matters(id),
  to_matter uuid not null references public.lr_matters(id),
  kind text not null check (kind in ('derived_from','enforcement_of','appeal_of','related')),
  primary key (from_matter, to_matter, kind), check (from_matter <> to_matter)
);

-- 8.10 Belge sürümleri ve masraflar
alter table public.lr_documents
  add column category text not null default 'diger',
  add column source_event_id uuid references public.lr_events(id),
  add column uploaded_by uuid references public.lr_accounts(user_id);
create table public.lr_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.lr_documents(id),
  version integer not null, object_path text not null unique,
  sha256 text not null, size_bytes bigint, uploaded_by uuid references public.lr_accounts(user_id),
  created_at timestamptz not null default now(), unique (document_id, version)
);
create table public.lr_expenses (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.lr_matters(id),
  category text not null, amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'TRY', spent_on date not null,
  paid_by text not null check (paid_by in ('office','client')),
  billable_to_client boolean not null default false,
  receipt_document_id uuid references public.lr_documents(id),
  shared_with_client boolean not null default false,
  created_by uuid references public.lr_accounts(user_id),
  created_at timestamptz not null default now()
);

-- 8.11 Kayıtlı görünümler
create table public.lr_saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.lr_accounts(user_id),
  name text not null, filters jsonb not null default '{}'::jsonb,
  sort text, is_default boolean not null default false, pinned boolean not null default false
);

-- 8.12 Kural kataloğu ve tatiller (yalnız okuma; yazma admin RPC ile)
create table public.lr_deadline_rules (
  key text not null, version integer not null,
  title text not null, matter_types text[] not null, trigger_event text not null,
  offset_value integer not null, offset_unit text not null check (offset_unit in ('day','week','month')),
  end_on_non_business_day text not null default 'next_business_day',
  judicial_recess text not null default 'unknown',
  legal_basis text not null,
  verified_by_lawyer boolean not null default false, verified_note text,
  effective_from date not null, effective_to date,
  primary key (key, version)
);
create table public.lr_holidays (
  day date not null, kind text not null check (kind in ('official','half_day','judicial_recess')),
  source text not null, primary key (day, kind)
);

commit;
```

**Ayrıca bu migration'da (ayrı bölümler halinde):**
- `updated_at` ve `last_activity_at` tetikleyicileri (olay, görev, belge, mesaj, takvim eklenince dosyanın `last_activity_at` güncellenir).
- Tüm yeni tablolarda `enable row level security`, `revoke all … from public, anon, authenticated`, sonra yalnız gereken kolon bazlı grant'ler (foundation'daki desen).
- Gerekli indeksler (`matter_id`, `assignee_id`, `status`, `due_on`).

### 8.13 Kokpit görünümü
```sql
create view public.lr_matter_cockpit with (security_invoker = true) as
select m.id, m.title, m.matter_type, m.subtype, m.stage, m.status, m.priority,
       m.last_activity_at,
       (select value from public.lr_matter_numbers n where n.matter_id = m.id and n.is_primary) as primary_number,
       (select min(d) from (
          select t.due_on::timestamptz as d from public.lr_tasks t where t.matter_id = m.id and t.status = 'open' and t.due_on is not null
          union all
          select coalesce(dl.verified_due_at, dl.proposed_due_at) from public.lr_deadlines dl
            where dl.matter_id = m.id and dl.status in ('proposed','verified')
          union all
          select coalesce(a.starts_at, a.all_day_date::timestamptz) from public.lr_agenda_items a
            where a.matter_id = m.id and a.status = 'planned'
       ) x) as next_due_at,
       (select count(*) from public.lr_deadlines dl where dl.matter_id = m.id and dl.status = 'proposed') as unverified_deadlines,
       (select count(*) from public.lr_tasks t where t.matter_id = m.id and t.status = 'open' and t.due_on < current_date) as overdue_tasks
from public.lr_matters m;
```
> Dikkat kademesi ve "neden" metni **frontend domain fonksiyonunda** hesaplanır (test edilebilirlik). View yalnız ham sayıları verir. 500+ dosyada performans ölçülür; gerekirse materialized özet tablo + tetikleyici.

### 8.14 Atomik RPC'ler (security invoker — RLS geçerli kalır)
| RPC | İş |
|---|---|
| `lr_add_proceeding(p_matter, p_event jsonb, p_tasks jsonb, p_deadlines jsonb, p_agenda jsonb)` | Olay + görevler + süre önerileri + takvim tek transaction |
| `lr_record_hearing_outcome(p_agenda, p_outcome jsonb)` | Duruşmayı kapatır, safahat + görevler + sonraki duruşma |
| `lr_verify_deadline(p_deadline, p_due, p_basis, p_source, p_note)` | Doğrulama (yalnız sorumlu/ekip) |
| `lr_change_stage(p_matter, p_stage, p_note)` | Aşama + geçmiş |
| `lr_create_matter(p jsonb)` | Dosya + birincil numara + sorumlu üyeliği + taraflar |
| `lr_close_matter(p_matter, p_reason, p_open_items_action)` | Kapanış kontrolleri |

**Yönetim RPC'leri (security definer, `lawroom_private`'ta; public wrapper yalnız gerekli rol kontrolüyle):** `approve_application`, `reject_application`, `assign_client_to_lawyer`, `accept_relationship`, `reject_relationship`, `invite_firm_member`, `accept_invite`, `set_profile_visibility`. Her biri `lr_audit_events`'e yazar ve gerekirse `lr_notification_outbox`'a kayıt ekler.

---

## 9. Yetki modeli değişiklikleri

```sql
-- Yazma: dosya üyesi (responsible/collaborator) + aktif büro üyesi
create or replace function lawroom_private.can_write(mid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.lr_matter_members mm
    join public.lr_matters m on m.id = mm.matter_id
    where mm.matter_id = mid and mm.user_id = auth.uid()
      and mm.role in ('responsible','collaborator')
      and lawroom_private.is_member(m.organization_id));
$$;

-- İç görünüm (iç notlar vb.): viewer dahil dosya üyeleri
create function lawroom_private.can_view_internal(mid uuid) returns boolean ...;

-- Müvekkil okuma: ilişkinin avukatı dosyanın aktif üyesi olmalı (owner şartı kalkar)
create or replace function lawroom_private.can_read(mid uuid) returns boolean ...
  -- r.lawyer_id = m.owner_id  →  exists(lr_matter_members where user_id = r.lawyer_id)
```

Politika matrisi (özet):
| Tablo | Avukat (üye) | Müvekkil | Admin |
|---|---|---|---|
| matters, numbers, stage_history | okur/yazar | okur (paylaşılmışsa; numara/aşama) | — |
| events | okur/yazar | `shared` olanları okur | — |
| tasks | okur/yazar | `shared_with_client` olanları okur | — |
| deadlines | okur/yazar | — | — |
| agenda_items | okur/yazar | `shared_with_client` olanları okur | — |
| internal_notes | okur/yazar (viewer okur) | — | — |
| documents / versions | okur/yazar | `shared` olanları okur; talep varsa ekler | — |
| expenses | okur/yazar | `shared_with_client` olanları okur | — |
| parties, matter_parties, links | okur/yazar | — | — |
| messages | okur/yazar | okur/yazar | — |
| applications | kendi | kendi | okur (RPC ile yazar) |
| deadline_rules, holidays | okur | — | RPC ile yazar |

---

## 10. Frontend mimarisi (mevcut koddan evrim)

### 10.1 Hedef klasör yapısı
```
src/
├─ app/            Root.jsx (hash router — mevcut), Shell.jsx (sidebar/header), nav.js (rol → menü)
├─ lib/            supabase.js, dates.js (Europe/Istanbul), ids.js, normalize.js (numara)
├─ data/           repository.js (arayüz), demoRepository.js (localStorage — mevcut davranış),
│                  supabaseRepository.js, useRepository.js
├─ domain/         matters.js, stages.js (şablonlar), events.js (olay kataloğu),
│                  attention.js, deadlines.js (hesap motoru), calendar-domain.js (taşınır)
├─ features/
│  ├─ today/       TodayPage.jsx
│  ├─ matters/     MatterList, MatterRow, FilterBar, SavedViews, BulkBar, NewMatterWizard, ImportWizard
│  ├─ matter/      Cockpit, Header, NextStepRail, tabs/{Overview,Timeline,TasksDeadlines,Agenda,
│  │               Documents,Parties,Expenses,Messages,InternalNotes,Sharing,History}
│  ├─ proceeding/  AddProceedingSheet, HearingOutcomeSheet, VerifyDeadlineDialog
│  ├─ calendar/    Calendar.jsx (mevcut, taşınır)
│  ├─ palette/     CommandPalette.jsx
│  ├─ client/      ClientHome, ClientMatter
│  ├─ admin/       Applications, Assignments, Firms, SystemHealth
│  ├─ profiles/    LawyerProfiles.jsx (mevcut)
│  ├─ welcome/     Welcome.jsx (mevcut)
│  └─ assistant/   Katip (Faz 6)
├─ components/     Badge, Button, Panel, Drawer, Modal, Toast, EmptyState, DateField,
│                  StageDots, Avatar, Kbd, CopyButton
└─ styles/         tokens.css, base.css (+ mevcut style/calendar/welcome css bölünür)
```

### 10.2 Kurallar
- **Repository deseni:** Arayüz yalnız `repository` fonksiyonlarını çağırır (`listMatters`, `getCockpit`, `addProceeding`…). `VITE_DATA_MODE=demo|live` ile seçilir. Demo sitesi her zaman çalışır kalmalı.
- **Domain fonksiyonları saf** (React/Supabase bağımsız) ve `node --test` ile test edilir.
- Durum yönetimi: React state + küçük context'ler. Sunucu verisi için `@tanstack/react-query` önerilir (önbellek, yeniden deneme, optimistic update). Yeni ağır bağımlılık eklemeden önce gerekçe yaz.
- Bağımlılıklar: `react`, `react-dom`, `lucide-react`, `@supabase/supabase-js`, (öneri) `@tanstack/react-query`, `pdfjs-dist` (Faz 4). DietApp junction **kaldırılır**, `npm install` ile kendi `node_modules`.
- Dil: JSX kalabilir; yeni domain dosyalarında JSDoc tipleri + `supabase gen types` çıktısı referans.
- Ortam: `.env.example` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_DATA_MODE`. Service role / Resend anahtarı **asla** frontend'e girmez.
- Router: mevcut hash yapısı korunur, rotalar genişletilir: `#/bugun`, `#/dosyalar?view=…`, `#/dosya/:id/:tab`, `#/takvim`, `#/demo?...`.

---

## 11. Bildirimler (Resend)

- Akış: DB işlemi → aynı transaction'da `lr_notification_outbox` kaydı → **Edge Function worker** (cron, 1 dk) → Resend → `delivery_attempts`.
- `event_key` ile idempotent; alıcı gönderim anında yeniden yetkilendirilir.
- İçerik **nötr**: "Lawroom'da yeni bir gelişme var" + uygulama linki. Dosya başlığı, müvekkil adı, belge içeriği e-postaya yazılmaz (ayar ile avukat kendi e-postasında dosya başlığını açabilir).
- Avukat için **günlük özet** (07:30, Europe/Istanbul): X kritik, Y duruşma, Z doğrulama bekleyen — tıklayınca Bugün ekranı.
- Hatırlatıcılar: duruşma −1 gün; doğrulanmış süre −3 ve −1 gün.
- Önkoşul: doğrulanmış gönderen alan (SPF/DKIM), API anahtarı yalnız Edge Function secret'ında, test alıcısı. Bunlar hazır olmadan gerçek gönderim kapalı.

---

## 12. Kâtip — hukuk asistanı ve AI entegrasyonları

**Konumlandırma:** "İkinci bir göz, son söz yine sizde." Önce avukatlar; müvekkil sürümü sonra, sınırlı kapsam + insan eskalasyonu ile.

**İlk değerli işler (dosya takibine hizmet eden sırayla):**
1. **Belgeden safahat taslağı:** Yüklenen tebligat/karar PDF'inden olay türü, tarih, tebliğ bilgisi **önerisi** → Safahat ekle formunu ön doldurur (avukat onaylar). Süre üretmez, yalnız işaretler.
2. **Dosya özeti:** taraflar, talepler, olay sırası, eksik belgeler; her cümle belge/sayfa kaynağına bağlı.
3. **Duruşma hazırlık paketi:** son safahat, açık görevler, soru listesi taslağı.
4. **Müvekkil bilgilendirme taslağı:** yalnız paylaşılabilir olaylardan sade metin; avukat onayı olmadan gönderilmez.
5. **İçtihat araştırması:** kişisel veriden arındırılmış sorgu; karar no/tarih/daire + tam kaynak linki; getirilmemiş karar üretilmez.

**Sağlayıcılar (araştırma notları):**
- Yargı MCP: eski ücretsiz endpoint kapanmış, proje Yargı PRO'ya (`app.yargipro.com/mcp`) taşınmış — kullanım koşulları, lisans, kota, veri saklama incelenmeden bağlanmaz. `researchProvider` adaptörü arkasında.
- Mizan-27B: model kartı, lisans ve kullanılabilirlik doğrulanamadı; seçilmiş sağlayıcı değil.
- Resmî kaynaklar: Adalet Bakanlığı mevzuat/içtihat, Yargıtay karar arama, Resmî Gazete — link + ileride yetkili erişim.

**Güvenlik:** RAG erişim filtresi getirmeden önce (yetkisiz belge modele hiç gitmez); belge içindeki talimatlar veri sayılır; büro izolasyonu testleri; her atfın açılabilirliği ölçülür.

---

## 13. Tasarım sistemi

- **Renk tokenları** (mevcut `style.css`'ten): zemin `#f6f7f2`, kenar `#e3e8df`, ana yeşil `#356859`, adaçayı panel `#e7eddf`, metin `#263e35`, ikincil `#6b7b70`, vurgu terracotta `#8b542d` / `#a45e39`.
- **Takvim/rozet renkleri:** Duruşma `#ede7f5/#654783`, Görüşme `#e1eff7/#27627f`, Takip `#fbeddc/#88541e`; eklenecek: Son gün kırmızı (`#fbe4e1/#9b2c22` öneri), Arabuluculuk turkuaz, İç gri. Kontrast WCAG AA kontrol edilir.
- **Tipografi:** Manrope (başlık), DM Sans (gövde).
- **Bileşen ilkeleri (Dietroom'dan):** yumuşak köşe (8–14px), bol boşluk, ince çizgiler, tek birincil eylem, boş durumlarda sıcak metin.
- **Kâtip maskotu:** bilge baykuş, krem dosya tutuyor, adaçayı/koyu yeşil, küçük terracotta gaga, düz editoryal vektör. Kullanım: boş durumlar, Bugün sağ kolon, asistan sayfası. Ciddi uyarı ekranlarında yok.
- **pen.dev ekran listesi (öncelik sırası):** Bugün · Dosyalarım (yoğun liste + filtre paneli) · Dosya kokpiti · Safahat ekle paneli (öneriler dahil) · Duruşma sonucu · Süre doğrulama · Takvim (ay/hafta) · Komut paleti · Yeni dosya sihirbazı · İçe aktarma eşleştirme · Müvekkil dosya ekranı · Admin başvurular · Tanıtım ana sayfası · Avukat tanıtım sayfası. Her ekranın **mobil** varyantı.

---

## 14. Test stratejisi

| Katman | Araç | Kapsam |
|---|---|---|
| Domain | `node --test` | numara normalizasyonu, aşama şablonları, olay → öneri üretimi, dikkat sıralaması, süre hesap motoru (tatil, hafta sonu, adli tatil, yıl geçişi, belirsiz girdi), takvim (mevcut 4 test) |
| Veritabanı | SQL assertion betiği (foundation testindeki desen, transaction + rollback) veya pgTAP | Her yeni tablo için: avukat üye/üye değil, ekip rolleri, müvekkil paylaşılan/paylaşılmayan, admin, ilişkisiz kullanıcı, iptal edilmiş ilişki, kolon grant'leri, RPC atomikliği (hata olursa hiçbir kayıt kalmaz) |
| Uçtan uca | Playwright | Bugün → dosya aç → safahat ekle → süre doğrula → takvimde gör → müvekkil olarak giriş → yalnız paylaşılanı gör |
| Performans | Seed betiği (500 dosya, 10k olay) | Liste < 300 ms, kokpit < 500 ms |
| Erişilebilirlik | axe + klavye ile tam gezinme | Rozetlerde metin, odak halkaları, kontrast |

**Kalıcı kabul testleri (her sürümde):** farklı bürodan tahmin edilen dosya ID'siyle erişim reddedilir; müvekkil başka müvekkilin belgesini göremez; iç notlar ağ yanıtında yok; admin dosya okuyamaz; rol yükseltme reddedilir; ilişki iptali sonrası Storage/Realtime erişimi kesilir; outbox tekrar çalışınca çift e-posta yok; doğrulanmamış süre "kesin" gösterilmez.

---

## 15. Yol haritası ve ticket'lar

> Format: **ID — başlık** · kapsam · ✅ kabul ölçütü. Faz 2 en büyük ve en önemli fazdır.

### Faz 0 — Temel hijyen (1–2 gün)
- **T0.1 — Son durumu doğrula.** `npm test`, `npm run build`; takvim ve Welcome ekranlarını tarayıcıda kontrol et. ✅ 8 test geçer, build başarılı, ekran görüntüleri `docs/screens/`.
- **T0.2 — Bağımsız bağımlılıklar.** DietApp junction'ını kaldır, `package.json`'a gerçek bağımlılıklar, `npm install`, lock dosyası. ✅ Temiz klonda `npm ci && npm run build` çalışır.
- **T0.3 — `main.jsx`'i böl.** Bölüm 10.1 yapısına taşı; davranış değişmez. ✅ Görsel/işlevsel fark yok, testler geçer, `main.jsx` < 40 satır.
- **T0.4 — Repository katmanı.** `demoRepository` mevcut localStorage davranışını sarar. ✅ Tüm bileşenler veriyi yalnız repository üzerinden okur.
- **T0.5 — Migration baseline.** Supabase CLI ile `db pull`, `supabase/migrations/` başlat; `foundation.sql` arşiv notu. ✅ `supabase db diff` boş.
- **T0.6 — Eski site tabloları RLS planı.** `es-avukatlik` sitesinin hangi tabloları anon okuduğunu çıkar, öneri yaz (uygulamadan önce onay). ✅ `docs/legacy-rls.md`.
- **T0.7 — GitHub.** `feature/lawroom` branch, push, PR şablonu. ✅ CI (test + build) yeşil.

### Faz 1 — Kimlik ve onay akışları
- **T1.1** Supabase Auth (e-posta + magic link), oturum, rol bazlı yönlendirme. ✅ Rolü olmayan kullanıcı "başvuru" ekranına düşer.
- **T1.2** Başvuru formları (avukat/büro/müvekkil, referans kodu/linki). ✅ `lr_applications` kaydı, kendi başvurusunu görür.
- **T1.3** Admin RPC'leri + Admin ekranları (onay, red, atama). ✅ SQL testleri: admin dosya okuyamaz; atama ilişkiyi `lawyer_review` yapar.
- **T1.4** Avukat "Kabul bekleyenler". ✅ Kabul → `accepted`, red → admin kuyruğuna döner (atama ise).
- **T1.5** Büro daveti ve üyelik. ✅ Davetli kabul edince `lr_memberships.active=true`; büro üyeliği dosya erişimi vermez (test).

### Faz 2 — Dosya takibi çekirdeği ⭐
- **T2.1 — Migration 002** (Bölüm 8) + yetki fonksiyonları (Bölüm 9) + SQL erişim testleri. ✅ Tüm matris testleri geçer, mevcut veriler korunur, sahipler `responsible` olarak geldi.
- **T2.2 — Domain katalogları:** `stages.js` (tür/alt tür/aşama + client_label), `events.js` (olay türleri + öneriler), `normalize.js`. ✅ Birim testleri; şablonlarda "doğrulanmamış" bayrağı.
- **T2.3 — Yeni dosya sihirbazı + `lr_create_matter`.** ✅ ≤ 5 adım, müvekkilsiz dosya açılabilir, birincil numara normalize kaydedilir.
- **T2.4 — Dosyalarım listesi:** kolonlar, arama (normalize numara + taraf), filtreler, gruplama, sıralama, yoğunluk. ✅ "2026 184" araması "2026/184 E."yi bulur; 500 dosyada < 300 ms.
- **T2.5 — Kayıtlı görünümler + URL durumu.** ✅ Görünüm kaydedilir, sabitlenir, link ile aynı filtre açılır.
- **T2.6 — Dosya kokpiti** (başlık, numaralar, kopyala, aşama noktaları, sağ panel, sekme iskeleti). ✅ Sıradaki iş hesaplanan değerden gelir; mobil düzen çalışır.
- **T2.7 — Safahat sekmesi** (zaman çizelgesi, filtre, görünürlük, düzeltme kaydı). ✅ Düzeltme orijinali silmez; müvekkil yalnız `shared` olanı görür.
- **T2.8 — Safahat ekle + öneriler + `lr_add_proceeding`.** ✅ Tebligat girişi süre önerisi + görev üretir; RPC hatasında hiçbir kayıt oluşmaz (test).
- **T2.9 — Görevler** (atanan, öncelik, gerekçeli erteleme). ✅ Erteleme gerekçesiz kaydedilemez, audit'e düşer.
- **T2.10 — Taraflar + bağlı dosyalar.** ✅ Dosyadan icra dosyası türetilince iki yönlü bağlantı görünür.
- **T2.11 — Aşama değiştirme + geçmiş.** ✅ Geçmiş sekmesinde kim/ne zaman/not.
- **T2.12 — Dikkat sıralaması (`attention.js`) + Bugün ekranı.** ✅ 9 kademe birim testli; her kartta yazılı neden; tek tık eylemler.
- **T2.13 — Komut paleti.** ✅ Ctrl+K, numara ile doğrudan dosya, eylemler, klavye ile tam kullanım.
- **T2.14 — Toplu işlemler.** ✅ Çoklu seçimle sorumlu atama ve arşivleme, audit kayıtlı.
- **T2.15 — CSV/XLSX içe aktarma.** ✅ Kolon eşleştirme, hatalı satır raporu, önizleme, geri alınabilir toplu kayıt.
- **T2.16 — Kapanış/arşiv.** ✅ Açık öğe kontrolü, arşiv salt okunur, yeniden açma audit'li.

### Faz 3 — Süreler ve takvim (canlı)
- **T3.1** `deadlines.js` hesap motoru + `lr_holidays` + kural kataloğu (doğrulanmamış örneklerle). ✅ Hafta sonu/tatil/adli tatil/yıl geçişi testleri; belirsiz girdi → "hesaplanamaz".
- **T3.2** Süre doğrulama diyaloğu + `lr_verify_deadline`. ✅ Dayanak ve kaynak olmadan doğrulanamaz; kaynak değişince `invalidated`.
- **T3.3** Takvimi `lr_agenda_items`'a bağla (mevcut `Calendar.jsx`), türetilmiş süre/görev kayıtları. ✅ Prototipteki tüm davranışlar canlıda; müvekkil filtresi testli.
- **T3.4** Duruşma sonucu akışı + `lr_record_hearing_outcome`. ✅ Geçmiş duruşma Bugün'e düşer; sonuç girilince sonraki duruşma takvimde.
- **T3.5** Büro takvimi (sorumlu filtresi) + ICS abonelik linki. ✅ ICS'de dosya içeriği yok, token iptal edilebilir.

### Faz 4 — Belgeler, müvekkil, mesajlar
- **T4.1** Storage bucket + politikalar + signed URL. ✅ Erişimi kaldırılan kullanıcı eski linkle indiremez.
- **T4.2** Belgeler sekmesi, sürümler, PDF önizleme, kaynak olay bağı.
- **T4.3** Müvekkil ana ekranı ve dosya ekranı (sade dil aşamaları, Sizden beklenen). ✅ İç veri ağ yanıtında yok (test).
- **T4.4** Belge talebi görevi + müvekkil yüklemesi.
- **T4.5** Mesajlar canlı (Realtime, aynı erişim sınırları). ✅ Yanıtsız mesaj kademesi Bugün'de.
- **T4.6** Masraflar sekmesi.

### Faz 5 — Bildirimler
- **T5.1** Outbox worker (Edge Function) + Resend + teslimat kaydı. ✅ Tekrar çalışınca çift gönderim yok.
- **T5.2** Günlük özet + duruşma/süre hatırlatıcıları + bildirim tercihleri.

### Faz 6 — Kâtip
- **T6.1** Provider adaptörü, kullanım kaydı, maliyet limiti.
- **T6.2** Belgeden safahat taslağı (yalnız öneri). **T6.3** Kaynaklı dosya özeti. **T6.4** Müvekkil bilgilendirme taslağı. **T6.5** İçtihat araştırması (sağlayıcı kararı sonrası).

### Faz 7 — Tanıtım sayfaları canlı
- **T7.1** Görünürlük ayarı DB'de (`set_profile_visibility`), herkese açık okuma yalnız açık profillerde. **T7.2** Blog CMS (taslak → onay → yayın). **T7.3** Profilden referanslı başvuru linki. ✅ Kapatılan profil API'de de 404.

### Tamamlanma tanımı (her ticket)
Testler + build yeşil · yeni tablolar için RLS testi · demo modu bozulmadı · mobil kontrol · erişilebilirlik (klavye + metinli rozet) · `docs/changelog.md` notu · ilkeler (Bölüm 4) ihlal edilmedi.

---

## 16. Açık sorular ve riskler

| # | Konu | Neden önemli | Sahibi |
|---|---|---|---|
| Q1 | Resend gönderen alan adı (ör. `bildirim@…`) | Bildirimler açılamaz | Emre |
| Q2 | Pilot kullanıcı: tek avukat mı, büro mu? Hangi dosya türleri önce? | Şablon doğrulama önceliği | Emre + pilot avukat |
| Q3 | Aşama şablonları ve süre kurallarını kim doğrulayacak? | Bölüm 6.3 / 6.7 ilk sürüm şartı | Pilot avukat |
| Q4 | Supabase bölgesi Seul — kişisel/hukuki veri için **KVKK yurt dışı aktarım** değerlendirmesi | Canlıya geçiş öncesi hukuki uygunluk; gerekirse AB bölgesine taşıma | Emre + hukukçu |
| Q5 | Eski site tablolarında RLS kapalı (profiles, blog_posts, legal_decisions, practice_areas…) | Kritik güvenlik uyarısı | T0.6 |
| Q6 | Supabase eklentisinin yetki hatası | Agent'ın migration uygulayamaması; şimdilik CLI veya Dashboard | Emre |
| Q7 | Alkım Azmioğlu ve Enes Can Yolcu'nun bilgilerinin yayını | Kişilerin onayı olmadan yayın yok; şimdilik demo taslak | Emre |
| Q8 | UYAP / UETS entegrasyonu | Yetkili yöntem olmadan link dışında bir şey vaat edilmez | Araştırma |
| Q9 | Yargı PRO lisans ve koşulları | Kâtip araştırma sağlayıcısı | Faz 6 öncesi |
| Q10 | Fiyatlandırma / plan sınırları | Büro üye sayısı, depolama, AI kotası | Ürün |
| Q11 | Meslek kuralları (avukatlık reklam yasağı vb.) ve tanıtım sayfaları | Sayfa içeriği ve dil kuralları | Hukukçu |

---

## 17. ChatGPT / Codex için hazır başlangıç komutları

**Genel oturum açılışı**
```
lawroom/AGENTS.md (bu belge) dosyasını tamamen oku. Bölüm 4'teki ilkeleri ihlal etme.
Bugün yalnız <TİCKET-ID> üzerinde çalışacağız. Önce kısa bir uygulama planı yaz,
etkilenecek dosyaları listele, sonra uygula. foundation.sql'i çalıştırma; DB değişikliği
gerekiyorsa yeni migration yaz ve RLS testlerini ekle. Sonunda npm test ve npm run build
çıktısını, değişiklik özetini ve docs/changelog.md notunu ver.
```

**Faz 0 başlangıcı**
```
T0.1 ve T0.2'yi uygula: mevcut testleri ve build'i çalıştır, takvim ve Welcome ekranlarını
kontrol et; DietApp node_modules junction'ını kaldırıp bağımsız bağımlılıkları kur.
Davranış değişikliği yapma.
```

**Dosya takibi çekirdeği**
```
Bölüm 6 ve 8'e göre T2.1'i uygula. Migration 002 taslağını gözden geçir, eksik RLS
politikalarını ve kolon grant'lerini ekle, Bölüm 9'daki can_write/can_read değişikliklerini
yap. Bölüm 14'teki matrisle transaction+rollback SQL testleri yaz. Önce yerel Supabase'de
çalıştır; üretime uygulamadan önce bana özet ver.
```

**Tasarım (pen.dev)**
```
Bölüm 13'teki tokenlarla ve Bölüm 6.9'daki yerleşimlerle pen.dev'de şu ekranları tasarla:
Bugün, Dosyalarım, Dosya kokpiti, Safahat ekle paneli. Her ekranın masaüstü (1440) ve mobil
(390) varyantı olsun. Renkli her öğede yazılı etiket bulunsun. Kâtip maskotunu yalnız boş
durum ve Bugün sağ kolonunda kullan.
```

---

*Bu belge yaşayan bir dokümandır. Her faz sonunda "Mevcut durum envanteri" (Bölüm 3) ve "Açık sorular" (Bölüm 16) güncellenmelidir.*
