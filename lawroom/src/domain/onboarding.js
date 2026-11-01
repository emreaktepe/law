/** Public form values are requests only; roles come from lr_accounts. */
export const applicationKinds = {
  lawyer: "Bireysel avukat",
  firm: "Hukuk bürosu",
  client: "Müvekkil",
};
export function validateApplication(value) {
  if (!applicationKinds[value.kind]) return "Bir hesap türü seçin.";
  if (!value.display_name?.trim() || value.display_name.trim().length > 120)
    return "Ad soyad 1–120 karakter olmalı.";
  if (["lawyer", "firm"].includes(value.kind) && !value.bar_number?.trim())
    return "Baro ve sicil bilginizi ekleyin.";
  if (value.kind === "firm" && !value.organization_name?.trim())
    return "Büronuzun adını ekleyin.";
  if (value.referral_code && !/^[A-Z0-9-]{4,32}$/i.test(value.referral_code))
    return "Referans kodunu kontrol edin.";
  if (!value.acknowledged)
    return "Başvuru ve erişim sürecini okuduğunuzu işaretleyin.";
  return "";
}
export function accessState(account, application) {
  if (account?.status === "suspended") return "suspended";
  if (
    account?.status === "active" &&
    ["lawyer", "client", "admin"].includes(account.role)
  )
    return "active";
  if (application)
    return application.status === "rejected" ? "rejected" : "pending";
  return "onboarding";
}
