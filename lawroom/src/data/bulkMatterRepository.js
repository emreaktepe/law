import { demoRepository } from './demoRepository.js';
import { applyMatterBulk } from '../domain/matter-bulk.js';
export function createBulkMatterRepository(repository = demoRepository) {
  return {
    preview(ids, command, context) { return applyMatterBulk(repository.listMatters(), ids, command, context).filter(matter => ids.includes(matter.id)); },
    commit(ids, command, context) { const next = applyMatterBulk(repository.listMatters(), ids, command, context); repository.saveMatters(next); return next; },
  };
}
export const bulkMatterRepository = createBulkMatterRepository();
