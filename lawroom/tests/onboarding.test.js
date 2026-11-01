import test from "node:test";
import assert from "node:assert/strict";
import { validateApplication, accessState } from "../src/domain/onboarding.js";
test("avukat ve büro başvurusunda mesleki bilgiler gerekir", () => {
  const base = {
    kind: "lawyer",
    display_name: "Örnek Avukat",
    acknowledged: true,
  };
  assert.match(validateApplication(base), /Baro/);
  assert.equal(
    validateApplication({ ...base, bar_number: "Örnek Barosu 123" }),
    "",
  );
  assert.match(
    validateApplication({ ...base, kind: "firm", bar_number: "123" }),
    /Büronuzun/,
  );
});
test("müvekkil referanssız başvurabilir; geçersiz kod reddedilir", () => {
  const base = {
    kind: "client",
    display_name: "Örnek Müvekkil",
    acknowledged: true,
  };
  assert.equal(validateApplication(base), "");
  assert.match(
    validateApplication({ ...base, referral_code: "../../admin" }),
    /Referans/,
  );
  assert.match(
    validateApplication({ ...base, acknowledged: false }),
    /işaretleyin/,
  );
});
test("rol isteği erişim açmaz; yalnız sunucu hesabı aktif rol verir", () => {
  assert.equal(
    accessState(null, { kind: "lawyer", status: "pending" }),
    "pending",
  );
  assert.equal(
    accessState({ role: "lawyer", status: "pending" }, null),
    "onboarding",
  );
  assert.equal(
    accessState({ role: "admin", status: "suspended" }, null),
    "suspended",
  );
  assert.equal(
    accessState({ role: "lawyer", status: "active" }, null),
    "active",
  );
  assert.equal(
    accessState({ role: "unknown", status: "active" }, null),
    "onboarding",
  );
});
