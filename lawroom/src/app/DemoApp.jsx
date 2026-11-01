import { demoRepository } from "../data/demoRepository.js";
import Katip from "../Katip.jsx";
import React, { useState, useEffect } from "react";

import {
  Scale,
  Folder,
  CalendarDays,
  Users,
  MessagesSquare,
  Sparkles,
  ArrowUpRight,
  Plus,
  Search,
  ShieldCheck,
  ChevronRight,
  Check,
  Home,
  BookOpen,
  Upload,
} from "lucide-react";
import {
  types,
  flow,
  resources,
  visibleCases,
  urgency,
  transition,
} from "../domain.js";

import MatterCreateWizard from "../features/matter-create/MatterCreateWizard.jsx";
import { buildMatterFromDraft } from "../domain/matter-create.js";
import TodayPage from "../features/workbench/TodayPage.jsx";
import CommandPalette from "../features/workbench/CommandPalette.jsx";
import { completeMatterTask } from "../domain/matter-actions.js";
import MatterListPage from "../features/matters/MatterListPage.jsx";
import MatterCockpit from "../features/tracking/MatterCockpit.jsx";
import ClientMatterView, { ClientMatterHome } from "../features/tracking/ClientMatterView.jsx";
import BulkMatterActions from "../features/matter-bulk/BulkMatterActions.jsx";
import MatterImportPage from "../features/matter-import/MatterImportPage.jsx";
import { browserRecentMatterRepository } from "../data/recentMatterRepository.js";
import Calendar from "../Calendar.jsx";
import Welcome from "../Welcome.jsx";
import LawyerProfiles from "../LawyerProfiles.jsx";
import { lawyers } from "../lawyers.js";
const date = (d) =>
  d
    ? new Date(d + "T12:00:00").toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "short",
      })
    : "Tarih yok";
const initial = () => demoRepository.listMatters();
export default function DemoApp({
  initialRole = "lawyer",
  initialPage = "Dosyalarım",
}) {
  const [demoLawyer, setDemoLawyer] = useState(lawyers[0].id);
  const lawyer = lawyers.find((l) => l.id === demoLawyer);
  const [cases, setCases] = useState(initial),
    [role, setRole] = useState(initialRole),
    [page, setPage] = useState(initialPage),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("Tümü"),
    [selected, setSelected] = useState(() => new URLSearchParams(location.hash.split('?')[1] || '').get('matter')),
    [cockpitRequest, setCockpitRequest] = useState(null),
    [tab, setTab] = useState("Genel bakış"),
    [create, setCreate] = useState(false),
    [notice, setNotice] = useState(""),
    [applications, setApplications] = useState([
      {
        id: 1,
        name: "Ada Hukuk Bürosu",
        kind: "Büro başvurusu",
        status: "admin_review",
      },
      {
        id: 2,
        name: "Elif Arslan",
        kind: "Avukat ataması istiyor",
        status: "assignment",
      },
      {
        id: 3,
        name: "Mert Akın",
        kind: "Referansla geldi",
        status: "lawyer_review",
      },
    ]);
  const current = cases.find((c) => c.id === selected);
  const allowed = visibleCases(cases, role);
  const filtered = allowed.filter(
    (c) =>
      (filter === "Tümü" ||
        c.type === filter ||
        (filter === "Yaklaşan süreler" &&
          ["Bugün", "Yaklaşıyor", "Gecikti"].includes(urgency(c.due)))) &&
      `${c.title} ${c.number} ${c.client} ${c.court}`
        .toLocaleLowerCase("tr")
        .includes(query.toLocaleLowerCase("tr")),
  );
  function save(next) {
    setCases(next);
    try {
      demoRepository.saveMatters(next);
    } catch {
      setNotice(
        "Tarayıcı kaydı yapılamadı. Değişiklikler yalnız bu oturumda tutuluyor.",
      );
    }
  }
  function completeDemoTask(matter, task) {
    if (role !== "lawyer" || !allowed.some(item => item.id === matter.id)) return false;
    try {
      const existing = cases.find(item => item.id === matter.id);
      const updated = completeMatterTask(existing, task.id, demoLawyer);
      const next = cases.map(item => item.id === existing.id ? updated : item);
      demoRepository.saveMatters(next);
      setCases(next);
      setNotice("Görev tamamlandı; demo denetim kaydı eklendi.");
      return true;
    } catch (error) { setNotice(error.message || "Görev kaydedilemedi."); return false; }
  }
  function update(patch) {
    save(cases.map((c) => (c.id === selected ? { ...c, ...patch } : c)));
  }
  function go(p) {
    setPage(p);
    setSelected(null);
    setCreate(false);
    setQuery("");
    const params = new URLSearchParams(location.hash.split('?')[1] || ''); params.delete('matter');
    history.replaceState(null, '', location.pathname + location.search + '#demo?' + params);
  }
  function open(c) {
    setSelected(c.id);
    setTab("Genel bakış");
    setCreate(false);
    setCockpitRequest(null);
    const params = new URLSearchParams(location.hash.split('?')[1] || ''); params.set('matter', c.id);
    history.replaceState(null, '', location.pathname + location.search + '#demo?' + params);
    if (role === 'lawyer') { try { browserRecentMatterRepository('lawyer:' + demoLawyer).visit(String(c.id)); } catch {} }
  }
  function changeRole(r) {
    setRole(r);
    go(r === "admin" ? "Başvurular" : "Dosyalarım");
  }
  function createDemoMatter(input) {
    if (role !== "lawyer") throw new Error("Dosya oluşturmak için avukat hesabı gerekir.");
    const matter = { ...buildMatterFromDraft(input, { actorId: demoLawyer }), responsibleName: lawyer.name };
    const next = [...cases, matter];
    demoRepository.saveMatters(next);
    setCases(next);
    setCreate(false);
    open(matter);
    setNotice("Dosya oluşturuldu. İlk safahatınızı ekleyebilirsiniz. Paylaşım kapalıdır.");
    return matter;
  }
  function sendClientMessage(id, body) {
    const source = cases.find(m => m.id === id);
    if (role !== 'client' || !source?.shared || source.client !== 'Deniz Yılmaz' || !String(body).trim()) throw new Error('Dosya paylaşımı kapalı.');
    const next = cases.map(m => m.id === id ? { ...m, messages: [...m.messages, { id: crypto.randomUUID(), body: String(body).trim(), role: 'client', createdAt: new Date().toISOString() }] } : m);
    demoRepository.saveMatters(next); setCases(next);
  }
  const nav =
    role === "admin"
      ? [
          ["Başvurular", ShieldCheck],
          ["Sistem durumu", Home],
        ]
      : [
          ...(role === "lawyer" ? [["Bugün", Home]] : []),
          ["Dosyalarım", Folder],
          ...(role === 'lawyer' ? [["İçe aktarma", Upload]] : []),
          ["Takvim & süreler", CalendarDays],
          ["Müvekkiller", Users],
          ["Mesajlar", MessagesSquare],
          ...(role === "lawyer"
            ? [
                ["Hukuk asistanı", Sparkles],
                ["Kabul bekleyenler", ShieldCheck],
              ]
            : []),
          ["Avukat sayfaları", Users],
          ["Kaynaklar", BookOpen],
        ];
  return (
    <div className="shell">
      <aside>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("Dosyalarım");
          }}
        >
          <Scale size={28} />
          lawroom<span>.</span>
        </a>
        <small>Av. {lawyer.name}</small>
        <label className="demo-lawyer">
          Demo avukatı
          <select
            value={demoLawyer}
            onChange={(e) => setDemoLawyer(e.target.value)}
          >
            {lawyers.map((l) => (
              <option value={l.id} key={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <nav>
          {nav.map(([n, I]) => (
            <button
              key={n}
              className={page === n ? "active" : ""}
              onClick={() => go(n)}
            >
              <I size={18} />
              {n}
            </button>
          ))}
        </nav>
        <button
          className="text"
          onClick={() => {
            location.hash = "";
          }}
        >
          ← Tanıtım sayfası
        </button>
        <div className="sidebar-bottom">
          <ShieldCheck size={20} />
          <p>
            Birlikte, güvenle.
            <br />
            <small>Her dosyanın bir hikâyesi var.</small>
          </p>
        </div>
      </aside>
      <main>
        <header>
          <span>
            Çalışma alanı <ChevronRight size={13} /> {page}
          </span>
          <CommandPalette
            ownerId={demoLawyer}
            currentMatter={current}
            onMatterAction={(matter, kind) => { setSelected(matter.id); setTab('Genel bakış'); setCreate(false); setCockpitRequest({ kind, key: crypto.randomUUID() }); }}
            matters={allowed}
            role={role}
            onOpenMatter={open}
            onCreateMatter={() => { go("Dosyalarım"); setCreate(true); }}
            onNavigate={go}
          />
          <label className="role">
            Demo rolü{" "}
            <select value={role} onChange={(e) => changeRole(e.target.value)}>
              <option value="lawyer">Avukat</option>
              <option value="client">Müvekkil</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </header>
        <div className="demo">
          Etkileşimli prototip · Örnek veriler yalnız bu tarayıcıda saklanır.
          Gerçek dosya veya kişisel veri girmeyin.
        </div>
        <div className="content">
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button onClick={() => setNotice("")}>Kapat</button>
            </div>
          )}
          {page === 'İçe aktarma' && !current && !create && role === 'lawyer' ? (
            <MatterImportPage actorId={demoLawyer} actorName={lawyer.name} role={role} onChanged={setCases} onBack={() => go('Dosyalarım')}/>
          ) : page === "Bugün" && !current && !create && role === "lawyer" ? (
            <TodayPage
              matters={allowed}
              role={role}
              onCreateMatter={() => setCreate(true)}
              onOpenMatter={(matter, targetTab) => { open(matter); setTab(targetTab); }}
              onCompleteTask={completeDemoTask}
            />
          ) : page === "Takvim & süreler" && !current && !create ? (
            <Calendar
              key={role + demoLawyer}
              cases={allowed}
              role={role}
              lawyer={demoLawyer}
              onOpenCase={open}
            />
          ) : page === "Avukat sayfaları" ? (
            <LawyerProfiles canManage={role === "lawyer"} />
          ) : create ? (
            <MatterCreateWizard
              role={role}
              onCreate={createDemoMatter}
              onCancel={() => setCreate(false)}
            />
          ) : current && allowed.some(c => c.id === current.id) && role === 'client' ? (
            <ClientMatterView key={current.id} matter={current} onBack={() => go('Dosyalarım')} onSendMessage={sendClientMessage} onChanged={setCases}/>
          ) : current && allowed.some(c => c.id === current.id) && role === 'lawyer' ? (
            <MatterCockpit key={current.id + ':' + (cockpitRequest?.key || tab)} matter={current} matters={allowed} actorId={demoLawyer} actorName={lawyer.name} onChanged={setCases} onBack={() => go('Dosyalarım')} onOpenMatter={open} initialTab={tab === 'Genel bakış' ? 'Genel' : tab} initialAction={cockpitRequest?.kind}/>
          ) : current && allowed.some((c) => c.id === current.id) ? (
            <>
              <button className="text" onClick={() => setSelected(null)}>
                ← Tüm dosyalar
              </button>
              <div className="heading">
                <div>
                  <div className="eyebrow">
                    {current.type} /{" "}
                    {current.number || "Esas numarası bekleniyor"}
                  </div>
                  <h1>{current.title}</h1>
                  <p>
                    {current.court} · {current.client || "Müvekkil bağlanmadı"}
                  </p>
                </div>
                <a
                  className="secondary"
                  href={role === "client" ? resources[1][1] : resources[0][1]}
                  target="_blank"
                  rel="noreferrer"
                >
                  UYAP'a git <ArrowUpRight size={15} />
                </a>
              </div>
              <div className="tabs">
                {[
                  "Genel bakış",
                  "Safahat",
                  "Belgeler",
                  "Mesajlar",
                  ...(role === "lawyer" ? ["İç notlar", "Paylaşım"] : []),
                ].map((t) => (
                  <button
                    className={tab === t ? "selected" : ""}
                    onClick={() => setTab(t)}
                    key={t}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {tab === "Genel bakış" && (
                <div className="detail-grid">
                  <section className="panel">
                    <div className="eyebrow">DOSYANIN YOL HARİTASI</div>
                    <div className="steps">
                      {flow(current.type).map((s, i) => (
                        <div
                          className={s === current.stage ? "now" : ""}
                          key={s}
                        >
                          <span>{i + 1}</span>
                          {s}
                        </div>
                      ))}
                    </div>
                    {role === "lawyer" && (
                      <label>
                        Aşamayı güncelle
                        <select
                          value={current.stage}
                          onChange={(e) => update({ stage: e.target.value })}
                        >
                          {flow(current.type).map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <h2>
                      {role === "client"
                        ? "Dosyanızda son durum"
                        : "Müvekkile açık özet"}
                    </h2>
                    <p>{current.summary || "Henüz bir özet paylaşılmadı."}</p>
                    <h2>Sıradaki adım</h2>
                    <div className="next">
                      <CalendarDays />
                      <div>
                        <strong>{current.next}</strong>
                        <p>
                          {date(current.due)} ·{" "}
                          {current.verified
                            ? "Avukat tarafından doğrulandı"
                            : "Tarih kontrol bekliyor"}
                        </p>
                      </div>
                    </div>
                    {role === "lawyer" && (
                      <form
                        className="inline-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const d = Object.fromEntries(
                            new FormData(e.currentTarget),
                          );
                          update({ next: d.next, due: d.due, verified: false });
                          setNotice(
                            "İşlem güncellendi. Tarih yeniden kontrol bekliyor.",
                          );
                        }}
                      >
                        <label>
                          İşlem
                          <input
                            name="next"
                            defaultValue={current.next}
                            required
                          />
                        </label>
                        <label>
                          Tarih
                          <input
                            type="date"
                            name="due"
                            defaultValue={current.due}
                          />
                        </label>
                        <button className="secondary">Güncelle</button>
                      </form>
                    )}
                  </section>
                  <section className="panel sage">
                    <h2>
                      {role === "client"
                        ? "Avukatınızla iletişim"
                        : "Yapılacaklar"}
                    </h2>
                    {role === "client" ? (
                      <>
                        <p>Dosyanızla ilgili sorularınız tek yerde.</p>
                        <button
                          className="primary"
                          onClick={() => setTab("Mesajlar")}
                        >
                          Mesaj yaz
                        </button>
                      </>
                    ) : (
                      <>
                        {current.tasks.map((t) => (
                          <label className="task" key={t.id}>
                            <input
                              type="checkbox"
                              checked={t.done}
                              onChange={() =>
                                update({
                                  tasks: current.tasks.map((x) =>
                                    x.id === t.id ? { ...x, done: !x.done } : x,
                                  ),
                                })
                              }
                            />
                            <span className={t.done ? "done" : ""}>
                              {t.title}
                            </span>
                          </label>
                        ))}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = e.currentTarget;
                            update({
                              tasks: [
                                ...current.tasks,
                                {
                                  id: crypto.randomUUID(),
                                  title: new FormData(f).get("task"),
                                  done: false,
                                },
                              ],
                            });
                            f.reset();
                          }}
                        >
                          <label>
                            Yeni görev
                            <input
                              required
                              name="task"
                              placeholder="Bir sonraki küçük adım…"
                            />
                          </label>
                          <button className="secondary">Görev ekle</button>
                        </form>
                        <hr />
                        <h3>Kâtip'in notu</h3>
                        <p>
                          Dosyalar kabarabilir. Yapılacaklar listesi kabarmasın.
                        </p>
                      </>
                    )}
                  </section>
                </div>
              )}
              {tab === "Safahat" && (
                <section className="panel">
                  <h2>Dosyanın hikâyesi</h2>
                  {current.events
                    .filter((e) => role === "lawyer" || e.shared)
                    .map((e, i) => (
                      <div className="event" key={i}>
                        <span>{date(e.date)}</span>
                        <div>
                          <strong>{e.title}</strong>
                          <p>{e.shared ? "Müvekkile açık" : "Yalnız büro"}</p>
                        </div>
                      </div>
                    ))}
                  {!current.events.length && <p>Henüz gelişme eklenmedi.</p>}
                  {role === "lawyer" && (
                    <form
                      className="form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = e.currentTarget,
                          d = Object.fromEntries(new FormData(f));
                        update({
                          events: [
                            ...current.events,
                            { ...d, shared: d.shared === "on" },
                          ],
                        });
                        f.reset();
                      }}
                    >
                      <label>
                        Gelişme
                        <input name="title" required />
                      </label>
                      <label>
                        Tarih
                        <input name="date" type="date" required />
                      </label>
                      <label className="task">
                        <input type="checkbox" name="shared" />
                        Müvekkille paylaş
                      </label>
                      <button className="primary">Gelişme ekle</button>
                    </form>
                  )}
                </section>
              )}
              {tab === "Belgeler" && (
                <section className="panel">
                  <h2>Belgeler, kaynağıyla birlikte.</h2>
                  <p>
                    Canlı belge deposu henüz bağlı değil. Prototip gerçek belge
                    yüklemez.
                  </p>
                  <div className="next">
                    <Folder />
                    <p>
                      Planlanan: sürüm geçmişi, PDF önizleme, avukata özel ve
                      müvekkile açık erişim, kaynak evrak ile süre ilişkisi.
                    </p>
                  </div>
                  <a href={resources[0][1]} target="_blank" rel="noreferrer">
                    UYAP üzerinden yetkili olduğunuz evraklara erişin ↗
                  </a>
                </section>
              )}
              {tab === "İç notlar" && (
                <section className="panel">
                  <h2>Yalnız büro içinde.</h2>
                  <label>
                    İç değerlendirme
                    <textarea
                      value={current.notes}
                      onChange={(e) => update({ notes: e.target.value })}
                      rows={8}
                    />
                  </label>
                  <p className="hint">
                    Bu alan müvekkil görünümüne dahil edilmez.
                  </p>
                </section>
              )}
              {tab === "Paylaşım" && (
                <section className="panel">
                  <h2>Ne paylaşılacağı sizde.</h2>
                  <label>
                    Müvekkil adı
                    <input
                      value={current.client}
                      onChange={(e) =>
                        update({ client: e.target.value, shared: false })
                      }
                    />
                  </label>
                  <p className="hint">
                    Demo müvekkil hesabı: Deniz Yılmaz. Canlı sistemde isim
                    yerine onaylanmış kullanıcı ilişkisi kullanılacak.
                  </p>
                  <label className="task">
                    <input
                      type="checkbox"
                      disabled={!current.client}
                      checked={current.shared}
                      onChange={(e) => update({ shared: e.target.checked })}
                    />
                    Dosyayı müvekkil ekranında göster
                  </label>
                  <label>
                    Müvekkile açık özet
                    <textarea
                      rows={5}
                      value={current.summary}
                      onChange={(e) => update({ summary: e.target.value })}
                    />
                  </label>
                </section>
              )}
              {tab === "Mesajlar" && (
                <section className="panel">
                  <h2>Dosya hakkında konuşalım.</h2>
                  <p className="hint">
                    Demo yazışmasıdır; karşı tarafa iletilmez.
                  </p>
                  {current.messages.map((m, i) => (
                    <div className="message" key={i}>
                      <small>
                        {m.role === "lawyer" ? "Avukat" : "Müvekkil"}
                      </small>
                      <p>{m.text}</p>
                    </div>
                  ))}
                  <form
                    className="form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = e.currentTarget;
                      update({
                        messages: [
                          ...current.messages,
                          { text: new FormData(f).get("message"), role },
                        ],
                      });
                      f.reset();
                    }}
                  >
                    <label>
                      Mesajınız
                      <textarea name="message" required maxLength={4000} />
                    </label>
                    <button className="primary">Demo mesaja ekle</button>
                  </form>
                </section>
              )}
            </>
          ) : ["Başvurular", "Kabul bekleyenler"].includes(page) ? (
            <>
              <div className="heading">
                <div>
                  <div className="eyebrow">GÜVENLİ BİR BAŞLANGIÇ</div>
                  <h1>{page}</h1>
                  <p>
                    {role === "admin"
                      ? "Sistem yönetimi. Dosya içerikleri bu alanda görünmez."
                      : "Yeni bir müvekkillik ilişkisi, sizin kabulünüzle başlar."}
                  </p>
                </div>
              </div>
              <section className="panel">
                {applications
                  .filter((a) =>
                    role === "admin"
                      ? ["admin_review", "assignment", "approved"].includes(
                          a.status,
                        )
                      : ["lawyer_review", "accepted", "rejected"].includes(
                          a.status,
                        ),
                  )
                  .map((a) => (
                    <div className="application" key={a.id}>
                      <div>
                        <h3>{a.name}</h3>
                        <p>
                          {a.kind} ·{" "}
                          {
                            {
                              admin_review: "Admin onayı bekliyor",
                              assignment: "Atama bekliyor",
                              lawyer_review: "Avukat kabulü bekliyor",
                              approved: "Onaylandı",
                              accepted: "Kabul edildi",
                              rejected: "Reddedildi",
                            }[a.status]
                          }
                        </p>
                      </div>
                      {["assignment", "admin_review", "lawyer_review"].includes(
                        a.status,
                      ) && (
                        <button
                          className="primary"
                          onClick={() => {
                            const action =
                              a.status === "assignment"
                                ? "assign"
                                : a.status === "admin_review"
                                  ? "approve"
                                  : "accept";
                            setApplications(
                              applications.map((x) =>
                                x.id === a.id ? transition(x, action, role) : x,
                              ),
                            );
                          }}
                        >
                          {a.status === "assignment"
                            ? "Demo avukata ata"
                            : a.status === "admin_review"
                              ? "Onayla"
                              : "Müvekkil olarak kabul et"}
                        </button>
                      )}
                    </div>
                  ))}
              </section>
            </>
          ) : page === "Sistem durumu" ? (
            <section className="panel">
              <h1>Bağlantı durumu</h1>
              <p>
                Supabase: 15 portal tablosu kuruldu; canlı arayüz bağlantısı
                hazırlanıyor.
              </p>
              <p>
                Resend: gönderen alan adı ve sunucu anahtarı yapılandırılmadı.
              </p>
              <p>GitHub: emreaktepe/law deposu yerelde hazır.</p>
              <p>Canlı kullanıcı veya dosya alınmıyor.</p>
            </section>
          ) : page === "Hukuk asistanı" ? (
            <section className="panel assistant">
              <Katip />
              <div className="eyebrow">KÂTİP / AVUKAT ÇALIŞMA ARKADAŞI</div>
              <h1>
                İkinci bir göz,
                <br />
                son söz yine sizde.
              </h1>
              <p>
                Önce dosyayı seçin. Kâtip, eldeki bilgileri araştırma için
                düzenlesin.
              </p>
              <div className="card-grid">
                {allowed.map((c) => (
                  <button
                    className="file-card"
                    key={c.id}
                    onClick={() => {
                      open(c);
                      setNotice(
                        "Bu prototipte yapay zekâ sağlayıcısı bağlı değil. Dosyadaki kayıtlı bilgileri inceleyebilirsiniz.",
                      );
                    }}
                  >
                    <Folder />
                    <h3>{c.title}</h3>
                    <p>Dosya bilgilerini aç →</p>
                  </button>
                ))}
              </div>
              <div className="next">
                <ShieldCheck />
                <p>
                  Planlanan: kaynaklı içtihat araştırması, belge karşılaştırma,
                  duruşma hazırlığı ve avukat onaylı müvekkil özeti. Model
                  çıktısı doğrulanmış karar olarak sunulmayacak.
                </p>
              </div>
            </section>
          ) : page === "Kaynaklar" ? (
            <section className="panel">
              <h1>Doğru kaynağa, kısa yoldan.</h1>
              <p>
                Resmî portallara bağlantılar. Otomatik veri eşitlemesi yapılmaz.
              </p>
              {resources.map(([n, url]) => (
                <a
                  className="resource"
                  key={n}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {n}
                  <ArrowUpRight size={18} />
                </a>
              ))}
            </section>
          ) : page === "Müvekkiller" ? (
            <section className="panel">
              <h1>Müvekkiller</h1>
              {[...new Set(allowed.map((c) => c.client).filter(Boolean))].map(
                (n) => (
                  <div className="application" key={n}>
                    <h3>{n}</h3>
                    <span>
                      {allowed.filter((c) => c.client === n).length} dosya
                    </span>
                    <button
                      className="secondary"
                      onClick={() => {
                        go("Dosyalarım");
                        setQuery(n);
                      }}
                    >
                      Dosyaları gör
                    </button>
                  </div>
                ),
              )}
            </section>
          ) : page === "Mesajlar" ? (
            <section className="panel">
              <h1>Dosyaya bağlı iletişim.</h1>
              <p>Yazışmak istediğiniz dosyayı seçin.</p>
              {allowed.map((c) => (
                <button
                  className="resource"
                  key={c.id}
                  onClick={() => {
                    open(c);
                    setTab("Mesajlar");
                  }}
                >
                  {c.title}
                  <span>{c.messages.length} mesaj →</span>
                </button>
              ))}
            </section>
          ) : role === 'client' ? (
            <ClientMatterHome matters={allowed} onOpen={open}/>
          ) : role === "lawyer" ? (
            <MatterListPage
              key={demoLawyer + ':' + query}
              ownerId={demoLawyer}
              role={role}
              renderSelectionActions={(selectedMatters) => <BulkMatterActions selectedMatters={selectedMatters} actorId={demoLawyer} actorName={lawyer.name} role={role} onChanged={setCases}/>}
              initialQuery={query}
              matters={allowed.map((matter) => ({
                ...matter,
                responsibleId: matter.responsibleId || demoLawyer,
                responsibleName: matter.responsibleName || lawyer.name,
              }))}
              onOpenMatter={open}
              onCreateMatter={() => setCreate(true)}
            />
          ) : (
            <>
              <div className="heading">
                <div>
                  <div className="eyebrow">
                    {role === "client"
                      ? "SİZİN İÇİN, DAHA ANLAŞILIR"
                      : "DOSYALAR YERLİ YERİNDE"}
                  </div>
                  <h1>
                    {page === "Takvim & süreler"
                      ? "Hiçbir adım arada kalmasın."
                      : role === "client"
                        ? "Süreciniz, tüm açıklığıyla."
                        : "Her dosya, bir sonraki adımıyla."}
                  </h1>
                  <p>
                    {role === "client"
                      ? "Avukatınızın paylaştığı gelişmeleri buradan takip edin."
                      : "Dağınık evraklar değil, net bir yol haritası. Bugün öncelik sende."}
                  </p>
                </div>
                {role === "lawyer" && (
                  <button className="primary" onClick={() => setCreate(true)}>
                    <Plus size={17} />
                    Yeni dosya
                  </button>
                )}
              </div>
              <div className="metrics">
                {[
                  [allowed.length, "Takip edilen dosya"],
                  [
                    allowed.filter((c) =>
                      ["Gecikti", "Bugün", "Yaklaşıyor"].includes(
                        urgency(c.due),
                      ),
                    ).length,
                    "Öncelikli işlem",
                  ],
                  [
                    allowed.filter((c) => !c.verified).length,
                    "Tarih kontrolü bekleyen",
                  ],
                  [
                    allowed.filter((c) => c.shared).length,
                    "Müvekkile açık dosya",
                  ],
                ].map(([v, l]) => (
                  <div key={l}>
                    <strong>{String(v).padStart(2, "0")}</strong>
                    <span>{l}</span>
                  </div>
                ))}
              </div>
              <div className="work-grid">
                <section className="panel files">
                  <div className="list-head">
                    <h2>
                      {page === "Takvim & süreler"
                        ? "Sıradaki işlemler"
                        : "Dosyalarım"}
                    </h2>
                    <span>{filtered.length} dosya</span>
                  </div>
                  <div className="search">
                    <Search size={17} />
                    <input
                      aria-label="Dosya ara"
                      placeholder="Dosya, esas no veya müvekkil ara…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <div className="filters">
                    {[
                      "Tümü",
                      "Yaklaşan süreler",
                      "İcra",
                      "Aile / Boşanma",
                      "İdari",
                    ].map((t) => (
                      <button
                        key={t}
                        className={filter === t ? "selected" : ""}
                        onClick={() => setFilter(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {(page === "Takvim & süreler"
                    ? [...filtered].sort((a, b) =>
                        (a.due || "9999").localeCompare(b.due || "9999"),
                      )
                    : filtered
                  ).map((c) => (
                    <button
                      className="file-row"
                      key={c.id}
                      onClick={() => open(c)}
                    >
                      <div className="file-icon">
                        <Folder size={21} />
                      </div>
                      <div>
                        <h3>{c.title}</h3>
                        <p>
                          {c.number || "Esas no bekleniyor"} ·{" "}
                          {c.client || "Müvekkilsiz dosya"}
                        </p>
                        <span className="tag">{c.type}</span>
                        <span className="stage">{c.stage}</span>
                      </div>
                      <div className="row-next">
                        <span
                          className={
                            ["Gecikti", "Bugün", "Yaklaşıyor"].includes(
                              urgency(c.due),
                            )
                              ? "deadline"
                              : "hint"
                          }
                        >
                          {date(c.due)} · {urgency(c.due)}
                        </span>
                        <p>{c.next}</p>
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                  {!filtered.length && (
                    <div className="empty">
                      <Folder />
                      <h3>Burada henüz bir dosya yok.</h3>
                      <p>Aramanızı değiştirin veya yeni bir dosya oluşturun.</p>
                    </div>
                  )}
                </section>
                <section className="focus">
                  <div className="eyebrow">KÜÇÜK ADIMLAR, NET SÜREÇLER</div>
                  <h2>
                    Önce bunlara
                    <br />
                    bakalım.
                  </h2>
                  {[...allowed]
                    .filter((c) => c.due)
                    .sort((a, b) => a.due.localeCompare(b.due))
                    .slice(0, 2)
                    .map((c) => (
                      <button
                        className="focus-item"
                        key={c.id}
                        onClick={() => open(c)}
                      >
                        <small>
                          {date(c.due)} ·{" "}
                          {c.verified ? "DOĞRULANDI" : "KONTROL BEKLİYOR"}
                        </small>
                        <h3>{c.client || c.title}</h3>
                        <p>{c.next}</p>
                        <span>Dosyaya git ↗</span>
                      </button>
                    ))}
                  <div className="katip">
                    <Katip decorative />
                    <h3>Kâtip'in küçük notu</h3>
                    <p>
                      “Dosyalar kabarabilir.
                      <br />
                      Kafan kabarmasın.”
                    </p>
                    <button
                      className="text"
                      onClick={() =>
                        go(role === "lawyer" ? "Hukuk asistanı" : "Kaynaklar")
                      }
                    >
                      Birlikte bakalım →
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}
          <footer>
            lawroom. <span>Hukukun ciddiyeti, iletişimin sıcaklığı.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
