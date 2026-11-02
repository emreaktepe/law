import React, { useState } from 'react';

export default function TrackingMessages({ matter, onSave, readonly, mode = 'demo' }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <section><h2>Müvekkille yazışma</h2><p className="tracking-subheading">{mode === 'demo' ? 'Dosyaya bağlı mesajlar · Demo kayıtları bu tarayıcıda tutulur.' : 'Bu dosyanın müvekkil yazışması.'}</p>{(matter.messages || []).map((message, i) => <article key={message.id || i} className="message"><small>{message.role === 'client' ? 'Müvekkiliniz' : 'Siz'}{message.createdAt ? ` · ${new Date(message.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}` : ''}</small><p>{message.body || message.text}</p></article>)}
    {!matter.messages?.length && <p>Henüz mesaj yok.</p>}
    {!readonly && <form className="tracking-form tracking-subheading" onSubmit={async event => {
      event.preventDefault(); const form = event.currentTarget; setBusy(true); setError('');
      const result = await onSave('add_message', { body: new FormData(form).get('body') });
      if (result) form.reset(); else setError('Mesaj kaydedilemedi. Metninizi koruduk.');
      setBusy(false);
    }}><label>Mesajınız<textarea name="body" required maxLength={8000}/></label><button className="primary" disabled={busy || !matter.client || !matter.shared}>Mesajı kaydet</button>{(!matter.client || !matter.shared) && <p>Önce dosyayı bağlı müvekkille paylaşın.</p>}{error && <p role="alert" className="tracking-error">{error}</p>}</form>}
  </section>;
}
