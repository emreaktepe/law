import React, { useState } from "react";
import {
  Scale,
  Building2,
  UserRound,
  ArrowRight,
  ArrowLeft,
  Clock,
  CheckCircle2,
} from "lucide-react";
import AuthLayout from "../auth/AuthLayout.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import {
  applicationKinds,
  validateApplication,
  accessState,
} from "../../domain/onboarding.js";
import { liveRepository } from "../../data/supabaseRepository.js";
const choices = [
  [
    "lawyer",
    Scale,
    "Kendi dosyalarım için",
    "Bireysel avukat olarak başvurun.",
  ],
  [
    "firm",
    Building2,
    "Büromla birlikte",
    "Büronuz için ortak bir çalışma alanı.",
  ],
  [
    "client",
    UserRound,
    "Sürecimi takip etmek için",
    "Avukatınızın paylaştığı gelişmeler burada.",
  ],
];
export default function OnboardingPage({ preview = false }) {
  const auth = useAuth(),
    [step, setStep] = useState(0),
    [form, setForm] = useState({
      kind: "lawyer",
      display_name: "",
      bar_number: "",
      organization_name: "",
      referral_code: "",
      acknowledged: false,
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [finished, setFinished] = useState(false);
  const state = accessState(auth.identity?.account, auth.identity?.application);
  const pending =
    finished ||
    (!preview && ["pending", "rejected", "suspended"].includes(state));
  function change(key, value) {
    setForm({ ...form, [key]: value });
    setError("");
  }
  function next(event) {
    event?.preventDefault();
    if (step === 1) {
      const problem = validateApplication({ ...form, acknowledged: true });
      if (problem) {
        setError(problem);
        return;
      }
    }
    setStep(step + 1);
  }
  async function submit(event) {
    event.preventDefault();
    const problem = validateApplication(form);
    if (problem) {
      setError(problem);
      return;
    }
    if (preview) {
      setFinished(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await liveRepository.submitApplication(form);
      await auth.refresh();
      setFinished(true);
    } catch {
      setError(
        "Başvuru kaydedilemedi. Bilgileriniz bu ekranda duruyor; bağlantınızı kontrol edip tekrar deneyin.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout
      step={`${String(Math.min(step + 1, 3)).padStart(2, "0")} / İLK KURULUM`}
    >
      {preview && (
        <div className="auth-preview" role="status">
          <strong>İlk kurulum önizlemesi</strong>
          <p>
            Örnek bilgiler kullanın. Başvuru oluşturulmaz, e-posta gönderilmez.
          </p>
        </div>
      )}
      {pending ? (
        <>
          <div className="auth-icon">
            {state === "rejected" || state === "suspended" ? (
              <Clock />
            ) : (
              <CheckCircle2 />
            )}
          </div>
          <div className="eyebrow">
            {preview ? "ÖRNEK BAŞVURU DURUMU" : "BAŞVURU DURUMUNUZ"}
          </div>
          <h2>
            {state === "suspended"
              ? "Hesabınız askıda."
              : state === "rejected"
                ? "Başvurunuz incelendi."
                : "İlk adım tamam."}
          </h2>
          <p>
            {state === "suspended"
              ? "Çalışma alanı erişiminiz durdurulmuş. Durum değiştiğinde burada görünecek."
              : state === "rejected"
                ? "Başvurunuz şu anda onaylanmadı. Yeniden değerlendirme için sistem yöneticisiyle iletişime geçin."
                : "Başvurunuz alındı. İlgili onay tamamlandığında çalışma alanınız burada açılacak."}
          </p>
          <div className="onboard-status">
            <h3>Sırada ne var?</h3>
            <ol>
              {(auth.identity?.application?.kind || form.kind) === "client" ? (
                <>
                  <li>Referans varsa ilgili avukat inceleyecek.</li>
                  <li>Referans yoksa yönetici avukat atayacak.</li>
                  <li>
                    Avukat kabulünden sonra paylaşılan dosyalarınız görünecek.
                  </li>
                </>
              ) : (
                <>
                  <li>Başvurunuz yönetici tarafından incelenecek.</li>
                  <li>Onayla birlikte çalışma alanınız açılacak.</li>
                  <li>İlk dosyanızı müvekkilsiz de oluşturabileceksiniz.</li>
                </>
              )}
            </ol>
          </div>
          {preview ? (
            <button
              className="primary"
              onClick={() => {
                setFinished(false);
                setStep(0);
              }}
            >
              Önizlemeye yeniden başla
            </button>
          ) : (
            <div className="onboard-actions">
              <button
                className="text"
                onClick={() =>
                  auth
                    .signOut()
                    .catch(() => setError("Çıkış yapılamadı. Yeniden deneyin."))
                }
              >
                Çıkış yap
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await auth.refresh();
                  } catch {
                    setError("Durum güncellenemedi.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Durumu yenile
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="onboard-progress" aria-label={`Adım ${step + 1} / 3`}>
            {[0, 1, 2].map((n) => (
              <span key={n} className={step >= n ? "current" : ""} />
            ))}
          </div>
          <div className="eyebrow">
            {["SİZE UYGUN ALAN", "KÜÇÜK BİR TANIŞMA", "SON BİR KONTROL"][step]}
          </div>
          <h2>
            {[
              "Hangi taraftan\nkatılıyorsunuz?",
              "Önce sizi\ntanıyalım.",
              "Her şey\nyerinde mi?",
            ][step]
              .split("\n")
              .map((line, i) => (
                <React.Fragment key={line}>
                  {i > 0 && <br />}
                  {line}
                </React.Fragment>
              ))}
          </h2>
          <p>
            {
              [
                "Seçiminize göre size uygun başvuru adımlarını göstereceğiz.",
                "Yalnız başvuruyu incelemek için gereken bilgiler. Belgelerinizi henüz istemiyoruz.",
                "Bilgilerinizi kontrol edin. Dosya erişimi, başvuru ve ilişki onayından ayrı yönetilir.",
              ][step]
            }
          </p>
          {step === 0 ? (
            <>
              <div className="onboard-options">
                {choices.map(([kind, Icon, title, description]) => (
                  <button
                    className="onboard-option"
                    key={kind}
                    aria-pressed={form.kind === kind}
                    onClick={() => change("kind", kind)}
                  >
                    <Icon size={23} />
                    <div>
                      <strong>{title}</strong>
                      <p>{description}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="onboard-actions">
                <a href="#/kayit">← Kayıt ekranı</a>
                <button className="primary" onClick={next}>
                  Devam et
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : step === 1 ? (
            <form className="auth-form" onSubmit={next}>
              <label>
                Ad soyad
                <input
                  value={form.display_name}
                  onChange={(e) => change("display_name", e.target.value)}
                  autoComplete="name"
                  maxLength={120}
                  required
                  placeholder={preview ? "Örnek Avukat" : ""}
                />
              </label>
              {form.kind !== "client" && (
                <label>
                  Baro / sicil numarası
                  <input
                    value={form.bar_number}
                    onChange={(e) => change("bar_number", e.target.value)}
                    required
                    maxLength={120}
                    placeholder="Baro adı ve sicil numaranız"
                  />
                </label>
              )}
              {form.kind === "firm" && (
                <label>
                  Büro adı
                  <input
                    value={form.organization_name}
                    onChange={(e) =>
                      change("organization_name", e.target.value)
                    }
                    required
                    maxLength={160}
                  />
                </label>
              )}
              {form.kind === "client" && (
                <label>
                  Avukat referans kodu{" "}
                  <span className="hint">(isteğe bağlı)</span>
                  <input
                    value={form.referral_code}
                    onChange={(e) =>
                      change("referral_code", e.target.value.toUpperCase())
                    }
                    maxLength={32}
                    placeholder="Örn. LR-AB12CD34"
                  />
                  <p className="hint">
                    Kodunuz yoksa yönetici atamasıyla ilerleyebilirsiniz.
                  </p>
                </label>
              )}
              <div className="onboard-actions">
                <button
                  className="text"
                  type="button"
                  onClick={() => setStep(0)}
                >
                  <ArrowLeft size={14} />
                  Geri
                </button>
                <button className="primary">
                  Bilgileri kontrol et
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={submit}>
              <dl className="onboard-review">
                <div>
                  <dt>Hesap türü</dt>
                  <dd>{applicationKinds[form.kind]}</dd>
                </div>
                <div>
                  <dt>Ad soyad</dt>
                  <dd>{form.display_name}</dd>
                </div>
                {form.kind !== "client" && (
                  <div>
                    <dt>Baro / sicil</dt>
                    <dd>{form.bar_number}</dd>
                  </div>
                )}
                {form.kind === "firm" && (
                  <div>
                    <dt>Büro</dt>
                    <dd>{form.organization_name}</dd>
                  </div>
                )}
                {form.kind === "client" && (
                  <div>
                    <dt>Yönlendirme</dt>
                    <dd>{form.referral_code || "Yönetici ataması"}</dd>
                  </div>
                )}
              </dl>
              <label className="task">
                <input
                  type="checkbox"
                  checked={form.acknowledged}
                  onChange={(e) => change("acknowledged", e.target.checked)}
                  required
                />
                <span>
                  Başvurunun ilgili onaya tabi olduğunu ve dosyaları yalnız
                  ayrıca paylaşıldığında görebileceğimi okudum.{" "}
                  <a href="#/gizlilik" target="_blank" rel="noreferrer">
                    Erişim açıklaması
                  </a>
                </span>
              </label>
              <div className="onboard-actions">
                <button
                  className="text"
                  type="button"
                  onClick={() => setStep(1)}
                >
                  ← Düzenle
                </button>
                <button className="primary" disabled={busy}>
                  {busy
                    ? "Kaydediliyor…"
                    : preview
                      ? "Örnek sonucu gör"
                      : "Başvuruyu tamamla"}
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
    </AuthLayout>
  );
}
