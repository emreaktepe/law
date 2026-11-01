import React, { useEffect, useState } from "react";
import DemoApp from "./DemoApp.jsx";
import Welcome from "../Welcome.jsx";
import { AuthProvider, useAuth } from "../features/auth/AuthContext.jsx";
import AuthPage from "../features/auth/AuthPage.jsx";
import AuthLayout from "../features/auth/AuthLayout.jsx";
import OnboardingPage from "../features/onboarding/OnboardingPage.jsx";
import LiveWorkspace from "../features/workspace/LiveWorkspace.jsx";
import { accessState } from "../domain/onboarding.js";
function Routes() {
  const [hash, setHash] = useState(location.hash),
    auth = useAuth();
  useEffect(() => {
    const change = () => {
      setHash(location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const route = hash.replace(/^#\/?/, "").split("?")[0];
  const enter = (role, page) => {
    location.hash = "demo?" + new URLSearchParams({ role, page });
  };
  if (route === "demo") {
    const params = new URLSearchParams(hash.split("?")[1] || "");
    return (
      <DemoApp
        key={hash}
        initialRole={
          ["lawyer", "client"].includes(params.get("role"))
            ? params.get("role")
            : "lawyer"
        }
        initialPage={
          ["Dosyalarım", "Takvim & süreler", "Avukat sayfaları"].includes(
            params.get("page"),
          )
            ? params.get("page")
            : "Dosyalarım"
        }
      />
    );
  }
  if (route === "gizlilik")
    return (
      <AuthLayout>
        <div className="privacy-copy">
          <div className="eyebrow">GİZLİLİK VE ERİŞİM</div>
          <h2>Paylaşımın sınırları belli.</h2>
          <p>
            Yönetici başvuruları ve üyelikleri yönetir; dosya içeriğini göremez.
            Müvekkil yalnız avukatının kendisine ayrıca paylaştığı dosya ve
            belgeleri görür.
          </p>
          <ul>
            <li>
              Başvuru için ad, hesap türü ve gerekiyorsa baro/büro bilgisi
              alınır.
            </li>
            <li>İç notlar ve paylaşılmamış belgeler müvekkile açılmaz.</li>
            <li>
              Tanıtım sayfası isteğe bağlıdır; varsayılan olarak kapalıdır.
            </li>
          </ul>
          <p>
            Bu ekran ürünün erişim açıklamasıdır. Canlı hizmete özgü aydınlatma
            metni ve veri sorumlusu iletişim bilgileri yayın öncesinde hukukçu
            tarafından tamamlanmalıdır.
          </p>
          <a href="#/kayit">Kayıt ekranına dön →</a>
        </div>
      </AuthLayout>
    );
  const callback = new URLSearchParams(location.search).has("code");
  if (!route && !callback)
    return (
      <Welcome
        onDemo={enter}
        onAccess={(kind) => {
          location.hash = kind === "login" ? "/giris" : "/kayit";
        }}
      />
    );
  if (auth.loading)
    return (
      <AuthLayout>
        <p role="status">Çalışma alanınız hazırlanıyor…</p>
      </AuthLayout>
    );
  if (auth.error)
    return (
      <AuthLayout>
        <h2>Bağlantıyı kontrol edelim.</h2>
        <p role="alert">{auth.error}</p>
        <button className="primary" onClick={() => location.reload()}>
          Yeniden dene
        </button>
        <a className="text" href="#">
          Tanıtıma dön
        </a>
      </AuthLayout>
    );
  if (auth.session) {
    const state = accessState(
      auth.identity?.account,
      auth.identity?.application,
    );
    return state === "active" ? <LiveWorkspace /> : <OnboardingPage />;
  }
  if (route === "ilk-kurulum" && auth.dataMode === "demo")
    return <OnboardingPage preview />;
  return <AuthPage key={route} signup={route === "kayit"} />;
}
export default function Root() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
