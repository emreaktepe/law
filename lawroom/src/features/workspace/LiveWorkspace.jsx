import SharingPanel from "./SharingPanel.jsx";
import ReferralCard from "./ReferralCard.jsx";
import React, { useEffect, useState } from "react";
import {
  Scale,
  Folder,
  Plus,
  LogOut,
  ArrowLeft,
  FileText,
  Download,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";
import { liveRepository as repository } from "../../data/supabaseRepository.js";
import "./workspace.css";
export default function LiveWorkspace() {
  const { session, identity, signOut } = useAuth(),
    account = identity.account;
  const [matters, setMatters] = useState([]),
    [selected, setSelected] = useState(null),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false),
    [applications, setApplications] = useState([]),
    [relationships, setRelationships] = useState([]),
    [lawyers, setLawyers] = useState([]),
    [notice, setNotice] = useState("");
  async function load() {
    setError("");
    setBusy(true);
    try {
      if (account.role === "admin") {
        const [a, l] = await Promise.all([
          repository.listApplications(),
          repository.listAssignableLawyers(),
        ]);
        setApplications(a);
        setLawyers(l);
      } else {
        setMatters(await repository.listMatters());
        if (account.role === "lawyer")
          setRelationships(await repository.listRelationships());
      }
    } catch {
      setError("Çalışma alanı yüklenemedi. Yeniden deneyin.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, [account.user_id]);
  useEffect(() => {
    if (!selected) {
      setData(null);
      return;
    }
    let alive = true;
    setData(null);
    setError("");
    Promise.all([
      repository.listEvents(selected.id),
      repository.listMessages(selected.id),
      repository.listDocuments(selected.id),
    ])
      .then(([events, messages, documents]) => {
        if (alive) setData({ events, messages, documents });
      })
      .catch(() => {
        if (alive) setError("Dosya yüklenemedi. Erişiminiz değişmiş olabilir.");
      });
    return () => {
      alive = false;
    };
  }, [selected]);
  async function action(fn, message) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setNotice(message);
      await load();
      if (selected) {
        const documents = await repository.listDocuments(selected.id);
        setData((old) => (old ? { ...old, documents } : old));
      }
    } catch {
      setError(
        "İşlem tamamlanamadı. Yetkinizi ve bağlantınızı kontrol edip yeniden deneyin.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function create(event) {
    event.preventDefault();
    const value = Object.fromEntries(new FormData(event.currentTarget));
    await action(async () => {
      await repository.createMatter(
        identity.memberships[0].organization_id,
        session.user.id,
        value,
      );
      setCreating(false);
    }, "Dosya oluşturuldu.");
  }
  return (
    <div className="live-page">
      <header className="live-header">
        <a className="brand" href="#">
          <Scale size={26} />
          lawroom<span>.</span>
        </a>
        <span className="live-badge">
          <ShieldCheck size={14} />
          Canlı çalışma alanı
        </span>
        <div>
          <span>{account.display_name}</span>
          <button
            className="text"
            onClick={() => signOut().catch(() => setError("Çıkış yapılamadı."))}
          >
            <LogOut size={15} />
            Çıkış yap
          </button>
        </div>
      </header>
      <main className="live-main">
        {error && (
          <div role="alert" className="auth-error">
            {error}
            <button className="text" onClick={load}>
              Yeniden dene
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="notice">
            {notice}
            <button onClick={() => setNotice("")}>Kapat</button>
          </div>
        )}
        {account.role === "admin" ? (
          <>
            <div className="heading">
              <div>
                <div className="eyebrow">SİSTEM YÖNETİMİ</div>
                <h1>Güvenli bir başlangıç.</h1>
                <p>
                  Başvurular ve atamalar. Dosya içeriklerine erişim verilmez.
                </p>
              </div>
            </div>
            <section className="panel">
              <h2>Bekleyen başvurular</h2>
              {!applications.length && <p>Bekleyen başvuru yok.</p>}
              {applications.map((a) => (
                <div className="application" key={a.id}>
                  <div>
                    <h3>{a.display_name}</h3>
                    <p>
                      {a.kind === "client"
                        ? "Müvekkil"
                        : a.kind === "firm"
                          ? "Hukuk bürosu"
                          : "Avukat"}{" "}
                      ·{" "}
                      {a.organization_name ||
                        a.bar_number ||
                        "Avukat ataması bekliyor"}
                    </p>
                  </div>
                  {a.kind === "client" ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const lawyer = new FormData(e.currentTarget).get(
                          "lawyer",
                        );
                        action(
                          () => repository.assignClient(a.id, lawyer),
                          "Atama yapıldı. Avukatın kabulü bekleniyor.",
                        );
                      }}
                    >
                      <label>
                        Atanacak avukat
                        <select name="lawyer" required>
                          <option value="">Avukat seçin</option>
                          {lawyers.map((l) => (
                            <option key={l.user_id} value={l.user_id}>
                              {l.display_name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="secondary"
                        disabled={busy || !lawyers.length}
                      >
                        Avukata yönlendir
                      </button>
                    </form>
                  ) : (
                    <div className="live-actions">
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          action(
                            () => repository.reviewApplication(a.id, true),
                            "Başvuru onaylandı.",
                          )
                        }
                      >
                        Onayla
                      </button>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          action(
                            () =>
                              repository.reviewApplication(
                                a.id,
                                false,
                                new FormData(e.currentTarget).get("reason"),
                              ),
                            "Başvuru reddedildi.",
                          );
                        }}
                      >
                        <label>
                          Red gerekçesi
                          <input name="reason" required maxLength={500} />
                        </label>
                        <button className="text" disabled={busy}>
                          Reddet
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </section>
          </>
        ) : (
          <>
            {account.role === "lawyer" && (
              <ReferralCard userId={session.user.id} />
            )}{" "}
            {relationships.length > 0 && (
              <section className="panel">
                <h2>
                  <Users size={18} /> Kabul bekleyen müvekkiller
                </h2>
                {relationships.map((r) => (
                  <div className="application" key={r.id}>
                    <p>Müvekkil başvurusu · {r.display_name}</p>
                    <div className="live-actions">
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          action(
                            () => repository.acceptRelationship(r.id, true),
                            "Müvekkil kabul edildi. Dosya erişimi ayrıca paylaşılır.",
                          )
                        }
                      >
                        Kabul et
                      </button>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          action(
                            () => repository.acceptRelationship(r.id, false),
                            "Başvuru yeniden atama kuyruğuna alındı.",
                          )
                        }
                      >
                        Reddet
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}
            {selected ? (
              <>
                <button className="text" onClick={() => setSelected(null)}>
                  <ArrowLeft size={14} />
                  Dosyalarım
                </button>
                <div className="heading">
                  <div>
                    <div className="eyebrow">
                      {selected.matter_type} ·{" "}
                      {selected.reference || "Numara bekleniyor"}
                    </div>
                    <h1>{selected.title}</h1>
                    <p>
                      {selected.court} · {selected.stage}
                    </p>
                  </div>
                </div>
                <section className="panel">
                  <h2>Dosyanızda son durum</h2>
                  <p>
                    {selected.client_summary || "Henüz bir özet paylaşılmadı."}
                  </p>
                  <h3>Sıradaki iş</h3>
                  <p>
                    {selected.next_action || "Henüz belirlenmedi."}{" "}
                    {selected.target_date && `· ${selected.target_date}`}
                  </p>
                  <p className="hint">
                    Çalışma hedefidir; doğrulanmış hukuki süre değildir.
                  </p>
                </section>
                {account.role === "lawyer" && (
                  <SharingPanel key={selected.id} matterId={selected.id} />
                )}{" "}
                {!data ? (
                  <p role="status">Dosya yükleniyor…</p>
                ) : (
                  <div className="live-columns">
                    <section className="panel">
                      <h2>Safahat</h2>
                      {!data.events.length && (
                        <p>Henüz paylaşılmış gelişme yok.</p>
                      )}
                      {data.events.map((e) => (
                        <div className="event" key={e.id}>
                          <span>{e.occurred_on}</span>
                          <strong>{e.title}</strong>
                        </div>
                      ))}
                      <h2>Belgeler</h2>
                      {!data.documents.length && <p>Henüz belge yok.</p>}
                      {data.documents.map((d) => (
                        <div className="live-document" key={d.id}>
                          <FileText size={18} />
                          <span>
                            {d.name}
                            <small>
                              {d.shared ? "Müvekkile açık" : "Yalnız avukat"}
                            </small>
                          </span>
                          <button
                            className="text"
                            disabled={busy}
                            aria-label={`${d.name} indir`}
                            onClick={() =>
                              action(async () => {
                                const blob = await repository.downloadDocument(
                                  d.id,
                                );
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.href = url;
                                link.download = d.name;
                                link.click();
                                setTimeout(
                                  () => URL.revokeObjectURL(url),
                                  60000,
                                );
                              }, "Belge indirildi.")
                            }
                          >
                            <Download size={17} />
                          </button>
                          {account.role === "lawyer" && (
                            <button
                              className="text"
                              disabled={busy}
                              onClick={() =>
                                action(
                                  () =>
                                    repository.setDocumentSharing(
                                      d.id,
                                      !d.shared,
                                    ),
                                  "Belge paylaşımı güncellendi.",
                                )
                              }
                            >
                              {d.shared ? "Paylaşımı kapat" : "Paylaş"}
                            </button>
                          )}
                        </div>
                      ))}
                      {account.role === "lawyer" && (
                        <form
                          className="auth-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const file = e.currentTarget.elements.file.files[0];
                            if (file)
                              action(
                                () =>
                                  repository.uploadDocument(selected.id, file),
                                "Belge kaydedildi. Varsayılan görünürlük: yalnız avukat.",
                              );
                          }}
                        >
                          <label>
                            Yeni belge
                            <input
                              type="file"
                              name="file"
                              accept=".pdf,.png,.jpg,.jpeg,.docx,.udf"
                              required
                            />
                          </label>
                          <p className="hint">
                            En fazla 20 MB. Her yükleme yeni kayıttır; mevcut
                            belge üzerine yazılmaz.
                          </p>
                          <button className="secondary" disabled={busy}>
                            Belgeyi yükle
                          </button>
                        </form>
                      )}
                    </section>
                    <section className="panel">
                      <h2>Mesajlar</h2>
                      {!data.messages.length && <p>Henüz mesaj yok.</p>}
                      {data.messages.map((m) => (
                        <div className="message" key={m.id}>
                          <small>
                            {m.sender_id === session.user.id
                              ? "Siz"
                              : "Dosya katılımcısı"}
                          </small>
                          <p>{m.body}</p>
                        </div>
                      ))}
                      <form
                        className="auth-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const body = new FormData(form).get("body");
                          action(async () => {
                            await repository.sendMessage(
                              selected.id,
                              session.user.id,
                              body,
                            );
                            setData((old) => ({
                              ...old,
                              messages: [
                                ...old.messages,
                                {
                                  id: crypto.randomUUID(),
                                  sender_id: session.user.id,
                                  body,
                                },
                              ],
                            }));
                            form.reset();
                          }, "Mesaj kaydedildi.");
                        }}
                      >
                        <label>
                          Mesajınız
                          <textarea name="body" required maxLength={8000} />
                        </label>
                        <button className="primary" disabled={busy}>
                          Mesajı gönder
                        </button>
                      </form>
                    </section>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="heading">
                  <div>
                    <div className="eyebrow">
                      {account.role === "lawyer"
                        ? "DOSYALAR YERLİ YERİNDE"
                        : "SİZİN İÇİN, DAHA ANLAŞILIR"}
                    </div>
                    <h1>
                      {account.role === "lawyer"
                        ? "Her dosya, bir sonraki adımıyla."
                        : "Süreciniz, tüm açıklığıyla."}
                    </h1>
                    <p>
                      {account.role === "lawyer"
                        ? "Dosyalarınızı ve yaklaşan işleri tek yerde takip edin."
                        : "Avukatınızın sizinle paylaştığı dosyalar burada görünür."}
                    </p>
                  </div>
                  {account.role === "lawyer" && (
                    <button
                      className="primary"
                      disabled={!identity.memberships.length}
                      onClick={() => setCreating(!creating)}
                    >
                      <Plus size={16} />
                      Yeni dosya
                    </button>
                  )}
                </div>
                {creating && (
                  <section className="panel">
                    <h2>Yeni bir dosya açalım.</h2>
                    <form className="auth-form" onSubmit={create}>
                      <label>
                        Başlık
                        <input name="title" required maxLength={160} />
                      </label>
                      <label>
                        Tür
                        <select name="matter_type">
                          {[
                            "İcra",
                            "Aile / Boşanma",
                            "İş",
                            "İdari",
                            "Ceza",
                            "Ticaret",
                            "Diğer",
                          ].map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      <div className="two">
                        <label>
                          Esas / takip numarası
                          <input name="reference" />
                        </label>
                        <label>
                          Mahkeme / daire
                          <input name="court" />
                        </label>
                        <label>
                          Sıradaki iş
                          <input name="next_action" />
                        </label>
                        <label>
                          Çalışma hedefi
                          <input name="target_date" type="date" />
                        </label>
                      </div>
                      <p className="hint">
                        Müvekkil bağlamadan oluşturulur. Hedef tarih hukuki süre
                        değildir.
                      </p>
                      <button className="primary" disabled={busy}>
                        Dosyayı oluştur
                      </button>
                    </form>
                  </section>
                )}
                <section className="panel">
                  {busy && <p role="status">Yükleniyor…</p>}
                  {!busy && !matters.length && (
                    <div className="empty">
                      <Folder />
                      <h2>Henüz bir dosya yok.</h2>
                      <p>
                        {account.role === "lawyer"
                          ? "İlk dosyanızı oluşturarak başlayın."
                          : "Avukatınız dosya paylaştığında burada görebileceksiniz."}
                      </p>
                    </div>
                  )}
                  {matters.map((m) => (
                    <button
                      className="file-row"
                      key={m.id}
                      onClick={() => setSelected(m)}
                    >
                      <Folder size={23} />
                      <div>
                        <h3>{m.title}</h3>
                        <p>
                          {m.reference || "Numara bekleniyor"} · {m.matter_type}
                        </p>
                      </div>
                      <span className="row-next">
                        {m.next_action || m.stage}
                      </span>
                    </button>
                  ))}
                </section>
              </>
            )}
          </>
        )}
        <footer>
          <span>lawroom.</span>
          <span>Hukukun ciddiyeti, iletişimin sıcaklığı.</span>
        </footer>
      </main>
    </div>
  );
}
