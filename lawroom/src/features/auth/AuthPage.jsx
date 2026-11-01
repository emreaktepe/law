import React, { useState } from "react";
import { ArrowRight, Mail, Check, ArrowLeft } from "lucide-react";
import { supabase, authRedirect } from "../../lib/supabase.js";
import { useAuth } from "./AuthContext.jsx";
import AuthLayout from "./AuthLayout.jsx";
export default function AuthPage({ signup = false }) {
  const { configured, dataMode } = useAuth();
  const [email, setEmail] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!configured) {
      setPreview(true);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: signup, emailRedirectTo: authRedirect() },
      });
      if (error) throw error;
      setSent(true);
    } catch {
      setError(
        "Bağlantı gönderilemedi. E-posta adresini ve bağlantınızı kontrol edip yeniden deneyin.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      {sent ? (
        <div className="auth-sent">
          <div className="auth-icon">
            <Mail />
          </div>
          <div className="eyebrow">E-POSTANIZI KONTROL EDİN</div>
          <h2>
            Size bir bağlantı
            <br />
            gönderdik.
          </h2>
          <p>
            <strong>{email}</strong> adresine gelen tek kullanımlık bağlantıyı
            bu tarayıcıda açın. Gelen kutusu ve gereksiz klasörünü kontrol edin.
          </p>
          <p>
            Hesabınız mevcutsa veya kayıt isteğiniz kabul edildiyse e-posta
            ulaşacaktır.
          </p>
          <button className="secondary" onClick={() => setSent(false)}>
            <ArrowLeft size={16} />
            Başka adres kullan
          </button>
        </div>
      ) : (
        <>
          <div className="eyebrow">
            {signup ? "TANIŞARAK BAŞLAYALIM" : "TEKRAR HOŞ GELDİNİZ"}
          </div>
          <h2>
            {signup ? (
              <>
                Burada size de
                <br />
                yer var.
              </>
            ) : (
              <>
                Çalışma alanınıza
                <br />
                hoş geldiniz.
              </>
            )}
          </h2>
          <p className="auth-intro">
            {signup
              ? "Avukat, hukuk bürosu veya müvekkil olarak katılın. İlk adım, e-posta adresinizi doğrulamak."
              : "E-posta adresinize güvenli bir giriş bağlantısı gönderelim. Şifre hatırlamanız gerekmez."}
          </p>
          <div className="auth-method">
            <Mail size={16} />
            E-posta ile {signup ? "kayıt" : "giriş"}
            <span>Şifresiz ve güvenli</span>
          </div>
          <form className="auth-form" onSubmit={submit}>
            <label>
              E-posta adresiniz
              <input
                type="email"
                autoComplete="email"
                name="email"
                required
                maxLength={254}
                placeholder="ornek@eposta.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <p className="hint">
              Tek kullanımlık bağlantıyı aynı tarayıcıda açın.
            </p>
            {error && (
              <p role="alert" className="auth-error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? "Gönderiliyor…"
                : signup
                  ? "Kayıt bağlantısı gönder"
                  : "Giriş bağlantısı gönder"}
              <ArrowRight size={16} />
            </button>
          </form>
          {!configured && (
            <div className="auth-preview">
              <strong>
                {dataMode === "demo"
                  ? "Tasarım önizlemesi"
                  : "Bağlantı hazırlanıyor"}
              </strong>
              <p>
                {dataMode === "demo"
                  ? "Bu ekranda e-posta gönderilmez. Örnek bilgilerle ilk kurulum adımlarını inceleyebilirsiniz."
                  : "Canlı kimlik servisi henüz yapılandırılmadı. E-posta gönderimi kapalı."}
              </p>
              {(preview || signup) && (
                <a href="#/ilk-kurulum?preview=1">İlk kurulumu incele →</a>
              )}
            </div>
          )}
          <div className="auth-divider" />
          <p className="auth-switch">
            {signup ? "Zaten bir hesabınız var mı?" : "Henüz tanışmadık mı?"}{" "}
            <a href={signup ? "#/giris" : "#/kayit"}>
              {signup ? "Giriş yapın" : "Aramıza katılın"}
            </a>
          </p>
          <p className="auth-legal">
            <Check size={14} />
            Başvuru sonrasında erişim, ilgili onaylarla açılır.
          </p>
        </>
      )}
    </AuthLayout>
  );
}
