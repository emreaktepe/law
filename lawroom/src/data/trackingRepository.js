import { demoRepository } from './demoRepository.js';
import { applyTrackingCommand } from '../domain/tracking-workflow.js';
import { trackingMatter, isArchived } from '../domain/tracking-model.js';
import { buildMatterFromDraft } from '../domain/matter-create.js';

export function createTrackingRepository(storage = demoRepository) {
  return {
    derive(matterId, input, context) {
      const matters = storage.listMatters(), original = matters.find(m => m.id === matterId);
      if (context.role !== 'lawyer' || !context.actorId || !original || isArchived(original)) throw new Error('Açık kaynak dosya ve avukat çalışma alanı gereklidir.');
      if (!['enforcement_of', 'appeal_of', 'derived_from', 'related'].includes(input.linkKind)) throw new Error('Bağlantı türü seçin.');
      const now = context.now || new Date().toISOString(), linked = buildMatterFromDraft({ ...input, clientMode: 'none' }, { actorId: context.actorId, now });
      const linkId = crypto.randomUUID(), m = trackingMatter(original);
      linked.links = [{ id: linkId, matterId, kind: input.linkKind, direction: 'outgoing' }];
      linked.auditHistory.push({ id: crypto.randomUUID(), action: 'link_matter', entityId: matterId, actorId: context.actorId, occurredAt: now });
      const parent = { ...m, links: [...m.links, { id: linkId, matterId: linked.id, kind: input.linkKind, direction: 'incoming' }], lastActivityAt: now,
        auditHistory: [...m.auditHistory, { id: crypto.randomUUID(), action: 'derive_matter', entityId: linked.id, actorId: context.actorId, occurredAt: now }] };
      const next = [...matters.map(item => item.id === matterId ? parent : item), linked]; storage.saveMatters(next);
      return { matters: next, matter: linked };
    },
    /** Load fresh before each command; save the complete aggregate once after validation. */
    commit(matterId, command, context) {
      const matters = storage.listMatters();
      const original = matters.find(m => m.id === matterId);
      if (!original) throw new Error('Dosya bulunamadı.');
      const updated = applyTrackingCommand(original, command, context);
      if (updated === original) return matters;
      const next = matters.map(m => m.id === matterId ? updated : m);
      storage.saveMatters(next);
      return next;
    },
    link(fromId, toId, kind, context) {
      if (context.role !== 'lawyer' || !context.actorId) throw new Error('Avukat çalışma alanı gereklidir.');
      if (fromId === toId || !['derived_from', 'enforcement_of', 'appeal_of', 'related'].includes(kind)) throw new Error('Geçerli iki dosya ve bağlantı türü seçin.');
      const matters = storage.listMatters(), from = matters.find(m => m.id === fromId), to = matters.find(m => m.id === toId);
      if (!from || !to || isArchived(from) || isArchived(to)) throw new Error('İki dosya da açık ve erişilebilir olmalı.');
      const now = context.now || new Date().toISOString(), id = crypto.randomUUID();
      const next = matters.map(m => {
        if (![fromId, toId].includes(m.id)) return m;
        const p = trackingMatter(m), otherId = m.id === fromId ? toId : fromId;
        if (p.links.some(l => l.matterId === otherId && l.kind === kind)) throw new Error('Dosyalar zaten bağlantılı.');
        return { ...p, links: [...p.links, { id, matterId: otherId, kind, direction: m.id === fromId ? 'outgoing' : 'incoming' }],
          lastActivityAt: now, auditHistory: [...p.auditHistory, { id: crypto.randomUUID(), action: 'link_matter', entityId: otherId, actorId: context.actorId, occurredAt: now }] };
      });
      storage.saveMatters(next); return next;
    },
  };
}
export const trackingRepository = createTrackingRepository();
