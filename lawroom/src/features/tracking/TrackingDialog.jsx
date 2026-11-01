import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function TrackingDialog({ title, children, onClose, error, busy }) {
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const elements = () => [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')];
    elements()[1]?.focus();
    const key = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const list = elements(), first = list[0], last = list.at(-1);
      if (!list.length) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); if (previous?.isConnected) previous.focus(); };
  }, [onClose]);
  return <div className="tracking-overlay"><section className="tracking-dialog" ref={panel} role="dialog" aria-modal="true" aria-labelledby="tracking-dialog-title" aria-busy={busy}>
    <div className="tracking-dialog-head"><div><span className="eyebrow">DOSYAYA BİR ADIM EKLE</span><h2 id="tracking-dialog-title">{title}</h2></div><button className="tracking-icon" aria-label="Paneli kapat" onClick={onClose}><X size={20}/></button></div>
    {error && <p className="tracking-error" role="alert">{error}</p>}
    {children}
  </section></div>;
}
