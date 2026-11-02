/** Explicit transport payloads. UI fields and credentials never become RPC arguments. */
const fields = {
  add_event: ['eventType','title','occurredOn','note','servedOn','serviceMethod','sourceReference','sourceDocumentId','correctsEventId','correctionReason','shared','clientSummary','taskIndexes','requestDeadlineReview','proposedDueAt'],
  add_task: ['title','dueOn','assigneeId','priority','kind','deadlineId','agendaItemId','sharedWithClient','requestedClientId','note'],
  add_agenda: ['title','kind','startsAt','endsAt','allDayDate','location','onlineUrl','sharedWithClient','ownerId'],
  complete_task: ['id'], cancel_task: ['id','reason'], postpone_task: ['id','dueOn','reason'],
  change_stage: ['stageKey','note'], add_number: ['value','kind','authority','isPrimary'],
  add_party: ['name','role','kind','isClientSide','contactNote'], add_note: ['body'], add_message: ['body'],
  add_expense: ['category','amount','currency','spentOn','paidBy','billableToClient','note'], reverse_expense: ['id','reason'],
  verify_deadline: ['id','dueOn','legalBasis','sourceReference','ruleVersion','note','confirmed'], resolve_deadline: ['id','status','note'],
  cancel_agenda: ['id','reason'], hearing_outcome: ['id','result','note','tasks','nextHearing','shared','clientSummary'],
  set_summary: ['summary'], finish_manual_target: [], set_sharing: ['shared'], set_event_sharing: ['id','shared','clientSummary'],
  archive: ['reason','closedOn'], reopen: ['reason'],
};
const forbidden = ['actorId','role','userId','user_id','organizationId','organization_id','owner_id','service_role','access_token'];
const inputError = message => Object.assign(new Error(message), {code:'TRACKING_INPUT'});
export const pickTrackingFields = (input, keys) => Object.fromEntries(keys.filter(key => input[key] !== undefined && input[key] !== '').map(key => [key,input[key]]));
export function trackingCommandPayload(type, input = {}) {
  if (!Object.hasOwn(fields,type) || !input || typeof input !== 'object' || Array.isArray(input)) throw inputError('Desteklenmeyen dosya işlemi.');
  if (forbidden.some(key => key in input && !(type === 'add_party' && key === 'role'))) throw inputError('İşlem yetkisi form alanlarından belirlenemez.');
  const p=pickTrackingFields(input,fields[type]);
  if(type==='hearing_outcome') {
    if(p.tasks!==undefined&&!Array.isArray(p.tasks))throw inputError('Ara karar görevlerini kontrol edin.');
    p.tasks=(p.tasks||[]).map(task=>pickTrackingFields(task,fields.add_task));
    if(p.nextHearing)p.nextHearing=pickTrackingFields(p.nextHearing,fields.add_agenda);
  }
  if(type==='add_task'&&p.kind==='client_document_request'&&!p.requestedClientId)throw inputError('Belge talebinin gönderileceği kabul edilmiş müvekkili seçin.');
  return p;
}
export function trackingCreatePayload(input, organizationId) {
  if (!organizationId) throw inputError('Etkin çalışma alanı seçilmedi.');
  if(forbidden.some(key=>key in input))throw inputError('Çalışma alanı formdan değiştirilemez.');
  return {...pickTrackingFields(input,['type','subtype','title','number','numberKind','court','stageKey','clientMode','clientId','partyName','nextAction','targetDate','internalRef']),organizationId};
}
export const trackingV2Enabled = env => env?.VITE_TRACKING_V2_ENABLED === 'true';
