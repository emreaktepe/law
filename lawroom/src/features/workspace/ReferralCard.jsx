import React, { useEffect, useState } from "react";
import { liveRepository } from "../../data/supabaseRepository.js";
export default function ReferralCard({ userId }) {
  const [code, setCode] = useState("");
  useEffect(() => {
    let alive = true;
    liveRepository
      .getReferralCode(userId)
      .then((value) => {
        if (alive) setCode(value?.code || "");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);
  return code ? (
    <div className="notice">
      <span>
        Müvekkil referans kodunuz: <strong>{code}</strong>. Kabul ve dosya
        paylaşımı ayrıca yapılır.
      </span>
    </div>
  ) : null;
}
