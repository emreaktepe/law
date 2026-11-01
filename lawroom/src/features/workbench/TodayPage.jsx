import React, { useMemo, useState, useEffect } from 'react';
import { ArrowUpRight, Check, CalendarDays, Folder, MessageSquare } from 'lucide-react';
import { rankAttention } from '../../domain/attention.js';
import { matterViewRecord } from '../../domain/matter-views.js';
import './workbench.css';

const labels = ['Geçmiş süreler', 'Bugün ve yarın', 'Doğrulama bekleyenler', 'Duruşma hazırlığı', 'Gecikmiş görevler', 'Duruşma sonuçları', 'Yanıt bekleyenler', 'Yaklaşan işler', 'Sessiz dosyalar'];
const dates = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short' });
function formatDate(value) {
  if (!value) return 'Tarih belirtilmedi';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/u.test(value) ? value + 'T12:00:00+03:00' : value);
  return Number.isFinite(date.getTime()) ? dates.format(date) : 'Tarih kontrol edilmeli';
}

/** Caller supplies only authorized matters. Mutations go through the repository owner. */
export default function TodayPage({ matters, role, onOpenMatter, onCompleteTask, onCreateMatter, now }) {
  const [clock, setClock] = useState(() => new Date().toISOString());
  const [feedback, setFeedback] = useState('');
  useEffect(() => { if (now) return; const timer = setInterval(() => setClock(new Date().toISOString()), 60000); return () => clearInterval(timer); }, [now]);
  const ranked = useMemo(() => role === 'lawyer' ? rankAttention(matters.map(matterViewRecord), now || clock) : [], [matters, role, now, clock]);
  const byId = new Map(matters.map(matter => [matter.id, matter]));
  if (role !== 'lawyer') return <section className="panel"><h1>Bugün</h1><p>Bu çalışma görünümü avukat hesabına aittir.</p></section>;
  async function complete(matter, task) {
    try { const result = await onCompleteTask(matter, task); if (result === false) return; setFeedback('Görev tamamlandı. Öncelikler yeniden hesaplandı.'); }
    catch (error) { setFeedback(error.message || 'Görev kaydedilemedi.'); }
  }
  return <section className="wb-today" aria-labelledby="today-title">
    <div className="heading"><div><div className="eyebrow">BUGÜN ÖNCELİK SİZDE</div><h1 id="today-title">Bir sonraki adıma bakalım.</h1><p>{ranked.length} dosya dikkatinizi bekliyor. Her dosyada en önemli gerekçe gösterilir.</p></div><button className="primary" onClick={onCreateMatter}>Yeni dosya</button></div>
    <div className="wb-today-note"><CalendarDays size={18}/><p>Çalışma hedefleri hukuki süre değildir. Önerilen süreler, kaynak ve avukat doğrulaması olmadan kesinleşmez.</p></div>
    {feedback ? <p className="notice" role="status">{feedback}</p> : null}
    {!ranked.length ? <div className="ml-empty"><Check size={32}/><h2>Şu anda dikkat kartı yok.</h2><p>Dosyalarınıza ve takviminize göz atabilir, yeni bir dosya açabilirsiniz.</p></div> : labels.map((label, index) => {
      const items = ranked.filter(item => item.tier === index + 1);
      if (!items.length) return null;
      return <section key={label} className={'wb-tier wb-tier-' + (index + 1)} aria-label={label}><h2><span>{index + 1}</span>{label}<small>{items.length}</small></h2><div className="wb-cards">{items.map(item => {
        const matter = byId.get(item.matterId), record = matterViewRecord(matter);
        const task = record.tasks.find(task => task.id === item.sourceId && !task.done && (!task.status || task.status === 'open'));
        return <article key={item.matterId} className="wb-attention-card"><span className="wb-card-date">{formatDate(item.dueAt)}</span><h3>{matter.title}</h3><p className="wb-card-number">{matter.number || matter.reference || 'Numara henüz yok'}</p><p className="wb-reason">{item.reason}</p>{task ? <p className="wb-task-title">{task.title}</p> : null}<div className="wb-card-actions"><button className="secondary" onClick={() => onOpenMatter(matter, item.tier === 7 ? 'Mesajlar' : item.tier === 6 ? 'Safahat' : 'Genel bakış')}>{item.tier === 7 ? <MessageSquare size={15}/> : <Folder size={15}/>}Dosyayı incele<ArrowUpRight size={14}/></button>{task && onCompleteTask ? <button className="wb-complete" onClick={() => complete(matter, task)}><Check size={15}/>Görevi tamamla</button> : null}</div></article>;
      })}</div></section>;
    })}
  </section>;
}
