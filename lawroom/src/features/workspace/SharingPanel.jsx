import React, { useEffect, useState } from "react";
import { liveRepository as repository } from "../../data/supabaseRepository.js";

export default function SharingPanel({ matterId }) {
  const [clients, setClients] = useState([]),
    [sharing, setSharing] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    Promise.all([
      repository.listClients(),
      repository.listMatterSharing(matterId),
    ])
      .then(([clients, sharing]) => {
        if (alive) {
          setClients(clients);
          setSharing(sharing);
        }
      })
      .catch(() => {
        if (alive) setError("Paylaşım bilgileri yüklenemedi.");
      });
    return () => {
      alive = false;
    };
  }, [matterId]);
  async function toggle(id, shared) {
    setBusy(true);
    setError("");
    try {
      await repository.shareMatter(matterId, id, shared);
      setSharing(await repository.listMatterSharing(matterId));
      setMessage(
        shared
          ? "Dosya müvekkille paylaşıldı. Belgeler ayrıca paylaşılır."
          : "Dosya paylaşımı kapatıldı.",
      );
    } catch {
      setError(
        "Paylaşım güncellenemedi. İlişki durumunu ve bağlantınızı kontrol edin.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Dosya paylaşımı</h2>
      <p>Yalnız kabul ettiğiniz müvekkiller. Her belge ayrıca paylaşılır.</p>
      {!clients.length && (
        <p className="hint">Henüz kabul edilmiş müvekkil yok.</p>
      )}
      {clients.map((client) => (
        <label className="task" key={client.relationship_id}>
          <input
            type="checkbox"
            checked={sharing.some(
              (s) => s.relationship_id === client.relationship_id && s.shared,
            )}
            disabled={busy}
            onChange={(event) =>
              toggle(client.relationship_id, event.target.checked)
            }
          />
          {client.display_name}
        </label>
      ))}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
