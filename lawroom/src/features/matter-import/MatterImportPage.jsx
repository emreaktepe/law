import React, { useRef, useState } from 'react';
import { Upload, ArrowLeft, Download, Check } from 'lucide-react';
import { guessImportMapping, importFields, importErrorCsv, matterImportTemplate } from '../../domain/matter-import.js';
import { readMatterImportFile, importMatterRepository } from '../../data/importMatterRepository.js';
import { getMatterTemplate } from '../../domain/stages.js';
import './matter-import.css';

function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' })), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function MatterImportPage({ actorId, actorName, role, onChanged, onBack }) {
  const [table, setTable] = useState(null), [mapping, setMapping] = useState({}), [preview, setPreview] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false), [receipt, setReceipt] = useState(null), [batches, setBatches] = useState(() => importMatterRepository.batches({ actorId })), [undoId, setUndoId] = useState(null);
  const lock = useRef(false), load = useRef(0), context = { actorId, actorName, role };
  if (role !== 'lawyer') return <section className="panel"><h1>İçe aktarma</h1><p>Avukat hesabı gerekir.</p></section>;
  async function selectFile(event) {
    const file = event.target.files?.[0]; if (!file) return;
    const token = ++load.current; setBusy(true); setError(''); setNotice(''); setPreview(null); setReceipt(null); setConfirmed(false);
    try { const data = await readMatterImportFile(file); if (token === load.current) { setTable(data); setMapping(guessImportMapping(data[0])); } }
    catch (failure) { if (token === load.current) { setTable(null); setError(failure.message || 'Dosya okunamadı.'); } }
    finally { if (token === load.current) setBusy(false); }
  }
  function inspect() {
    setError(''); setConfirmed(false); setReceipt(null);
    try { setPreview(importMatterRepository.preview(table, mapping)); } catch (failure) { setPreview(null); setError(failure.message); }
  }
  async function commit() {
    if (lock.current || !confirmed || !preview?.valid.length || preview.errors.length) return;
    lock.current = true; setBusy(true); setError('');
    try { const result = await importMatterRepository.commit(table, mapping, context); onChanged(result.matters); setReceipt(result); setPreview(null); setTable(null); setConfirmed(false); setBatches(importMatterRepository.batches(context)); setNotice(`${result.count} dosya paylaşım kapalı olarak aktarıldı.`); }
    catch (failure) { setError(failure.message || 'Aktarım tamamlanamadı.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function undo() {
    if (lock.current || !undoId) return; lock.current = true; setBusy(true); setError('');
    try { onChanged(await importMatterRepository.undo(undoId, context)); setUndoId(null); setReceipt(null); setBatches(importMatterRepository.batches(context)); setNotice('Aktarım geri alındı. Dosyalar denetim kaydıyla arşivlendi.'); }
    catch (failure) { setError(failure.message || 'Geri alma tamamlanamadı.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="mi-page"><button className="text" onClick={onBack} disabled={busy}><ArrowLeft size={15}/>Dosyalarıma dön</button><div className="heading"><div><div className="eyebrow">DOSYALARINIZI BİRLİKTE TAŞIYALIM</div><h1>İçe aktarma</h1><p>Dosya seçin, kolonları eşleyin ve kayıttan önce tüm satırları kontrol edin.</p></div><button className="secondary" onClick={() => download('lawroom-dosya-sablonu.csv', matterImportTemplate)}><Download size={15}/>CSV şablonu indir</button></div>
    <p className="mi-info">CSV ve XLSX bu tarayıcıda okunur. Aktarım yeni ve paylaşımı kapalı demo dosyaları oluşturur. Yazılan müvekkil adları yalnız taraf kaydıdır; hesap veya paylaşım açılmaz. Aşama şablonları doğrulanmamış örnektir.</p>
    {error ? <p className="mi-error" role="alert">{error}</p> : null}{notice ? <p className="notice" role="status">{notice}</p> : null}
    <section className="mi-card"><h2>1. Dosyanızı seçin</h2><label className="mi-file"><Upload size={24}/><span>CSV veya XLSX · En fazla 5 MB / 500 dosya</span><input type="file" accept=".csv,.xlsx" aria-label="İçe aktarılacak dosya" disabled={busy} onChange={selectFile}/></label>{busy ? <p role="status">İşlem sürüyor…</p> : null}<p className="hint">Excel'de ilk sayfa okunur. Tarihleri YYYY-AA-GG biçiminde girin. Makrolar ve eski XLS biçimi desteklenmez.</p></section>
    {table ? <section className="mi-card"><h2>2. Kolonları eşleyin</h2><p>{table.length - 1} veri satırı bulundu. Alt tür ve aşama boşsa seçilen türün ilk örneği kullanılır; önizlemede kontrol edin.</p><div className="mi-mapping">{Object.entries(importFields).map(([field, label]) => <label key={field}>{label}{['title', 'type'].includes(field) ? ' *' : ''}<select value={mapping[field] ?? -1} disabled={busy} onChange={event => { setMapping(previous => ({ ...previous, [field]: Number(event.target.value) })); setPreview(null); setConfirmed(false); }}><option value={-1}>Aktarma</option>{table[0].map((header, index) => <option key={index} value={index}>{index + 1}. {header || 'Başlıksız kolon'}</option>)}</select></label>)}</div><button className="primary" disabled={busy} onClick={inspect}>Önizlemeyi hazırla</button></section> : null}
    {preview ? <section className="mi-card"><h2>3. Önizleme ve hata kontrolü</h2><p>{preview.valid.length} geçerli dosya · {preview.errors.length} hata</p>{preview.errors.length ? <div className="mi-error"><strong>Hatalar düzeltilmeden hiçbir dosya kaydedilmez.</strong><ul>{preview.errors.slice(0, 20).map((failure, index) => <li key={index}>Satır {failure.row} · {importFields[failure.field] || failure.field}: {failure.message}</li>)}</ul><button className="secondary" onClick={() => download('lawroom-aktarim-hatalari.csv', importErrorCsv(preview.errors))}>Tüm hata satırlarını indir</button></div> : null}
      <div className="mi-table"><table><caption>İlk {Math.min(25, preview.valid.length)} geçerli satır; tüm satırlar doğrulandı.</caption><thead><tr><th>Satır</th><th>Dosya</th><th>Numara / makam</th><th>Tür / aşama</th><th>İlk iş</th></tr></thead><tbody>{preview.valid.slice(0, 25).map(row => <tr key={row.row}><td>{row.row}</td><td>{row.draft.title}<small>{row.draft.partyName ? 'Taraf: ' + row.draft.partyName : 'Müvekkilsiz'}</small></td><td>{row.draft.number || 'Numara yok'}<small>{row.draft.court}</small></td><td>{getMatterTemplate(row.draft.type)?.label || row.draft.type} · {row.draft.subtype}<small>{getMatterTemplate(row.draft.type)?.stages.find(stage => stage.key === row.draft.stageKey)?.label || 'Aşama belirtilmedi'}</small></td><td>{row.draft.nextAction || 'Daha sonra'}<small>{row.draft.targetDate}</small></td></tr>)}</tbody></table></div>
      <label className="mi-confirm"><input type="checkbox" disabled={busy || Boolean(preview.errors.length) || !preview.valid.length} checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>{preview.valid.length} dosyayı paylaşım kapalı olarak oluşturmak istiyorum.</label><button className="primary" disabled={busy || !confirmed || Boolean(preview.errors.length)} onClick={commit}><Check size={15}/>{preview.valid.length} dosyayı aktar</button>
    </section> : null}
    {receipt ? <section className="mi-card"><h2>Aktarım tamamlandı</h2><p>{receipt.count} dosya eklendi. Sonradan değiştirilmeyen bu aktarımı aşağıdan geri alabilirsiniz.</p><button className="primary" onClick={onBack}>Dosyaları gör</button></section> : null}
    {batches.length ? <section className="mi-card"><h2>Aktarım geçmişi ve geri alma</h2><p>Geri alma, değişmemiş aktarım dosyalarını paylaşım kapalı olarak arşivler. Hiçbir dosyayı kalıcı silmez. Bir dosya sonradan değiştiyse toplu geri alma durur.</p>{batches.slice(0, 10).map(batch => <div className="mi-batch" key={batch.id}><span>{new Date(batch.importedAt).toLocaleString('tr-TR')} · {batch.count} dosya</span><button className="secondary" disabled={busy} onClick={() => { setUndoId(batch.id); setError(''); }}>Geri almayı incele</button></div>)}{undoId ? <div className="mi-info"><p>Bu aktarımın değişmemiş dosyaları denetim kaydıyla arşive taşınacak.</p><div className="mi-actions"><button className="secondary" disabled={busy} onClick={() => setUndoId(null)}>Vazgeç</button><button className="primary" disabled={busy} onClick={undo}>Aktarımı geri al ve arşivle</button></div></div> : null}</section> : null}
  </section>;
}
