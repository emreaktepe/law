import React from "react";
import { Scale, ArrowUpRight, ShieldCheck } from "lucide-react";
import Katip from "../../Katip.jsx";
import "./auth.css";
export default function AuthLayout({ children, step = "01 / BAŞLANGIÇ" }) {
  return (
    <div className="auth-page">
      <header className="auth-nav">
        <a className="brand" href="#">
          <Scale size={28} />
          lawroom<span>.</span>
        </a>
        <a href="#demo?role=lawyer&page=Dosyalar%C4%B1m">
          Demoya göz at <ArrowUpRight size={14} />
        </a>
      </header>
      <main className="auth-layout">
        <section className="auth-story">
          <div className="eyebrow">AYNI SAYFADA BULUŞALIM</div>
          <h1>
            Bir sonraki adım,
            <br />
            <em>birlikte daha net.</em>
          </h1>
          <p>
            Dosyalarınıza düzen, iletişiminize açıklık.
            <br />
            Size ait çalışma alanına hoş geldiniz.
          </p>
          <div className="auth-story-card">
            <ShieldCheck size={22} />
            <div>
              <strong>Paylaşımın sınırları belli.</strong>
              <p>
                Her dosya yalnız yetkili kişilerle paylaşılır.
                <br />
                İç notlarınız çalışma alanınızda kalır.
              </p>
            </div>
          </div>
          <div className="auth-katip">
            <Katip decorative />
            <p>
              “Ben dosyaları beklerim.
              <br />
              Siz bir çay alın.”<span>— Kâtip</span>
            </p>
          </div>
          <small>Hukukun ciddiyeti, iletişimin sıcaklığı.</small>
        </section>
        <section className="auth-panel">
          <div className="auth-step">
            {step}
            <span>LAWROOM’A HOŞ GELDİNİZ</span>
          </div>
          {children}
        </section>
      </main>
      <footer className="auth-footer">
        <span>lawroom.</span>
        <span>Birlikte, güvenle.</span>
        <a href="#/gizlilik">Gizlilik ve erişim</a>
      </footer>
    </div>
  );
}
