import test from 'node:test';import assert from 'node:assert/strict';
import {monthDays,weekStart,moveMonth,conflicts,validateEvent,calendarEvents} from '../src/calendar-domain.js';
test('Pazartesi başlangıcı ve yıl geçişi',()=>{assert.equal(weekStart('2026-11-01'),'2026-10-26');assert.equal(monthDays('2026-11-01').length,42);assert.equal(moveMonth('2026-12-31',1),'2027-01-01');assert.equal(moveMonth('2026-03-31',-1),'2026-02-01')});
const base={id:'a',title:'Test',kind:'hearing',date:'2026-11-03',start:'09:00',end:'10:00',status:'planned',lawyer:'a'};
test('çakışma yalnız aynı avukatın aktif ve kesişen saatlerinde',()=>{assert.ok(conflicts(base,{...base,id:'b',start:'09:30'}));assert.ok(!conflicts(base,{...base,id:'b',start:'10:00',end:'11:00'}));assert.ok(!conflicts(base,{...base,id:'b',lawyer:'b'}));assert.ok(!conflicts(base,{...base,id:'b',status:'cancelled'}));assert.ok(!conflicts(base,{...base,id:'b',allDay:true}))});
test('tarih, süre ve paylaşım doğrulama',()=>{assert.equal(validateEvent(base),'');assert.ok(validateEvent({...base,end:'08:00'}));assert.ok(validateEvent({...base,date:'2026-02-30'}));assert.ok(validateEvent({...base,shared:true}));assert.equal(validateEvent({...base,allDay:true,start:'',end:''}),'')});
test('müvekkil yalnız erişebildiği dosyanın paylaşılan etkinliğini görür; iç hedefi göremez',()=>{const saved=[{...base,matterId:'1',shared:true},{...base,id:'private',matterId:'1',shared:false},{...base,id:'other',matterId:'2',shared:true}];const cases=[{id:'1',due:'2026-11-04',next:'Beyan',shared:true}];assert.deepEqual(calendarEvents(saved,cases,'client','a').map(e=>e.id),['a']);assert.deepEqual(calendarEvents(saved,cases,'admin','a'),[])});
test('kokpit ajandası İstanbul saatine dönüşür; görevler ve öneri süreler ayrı türetilir',()=>{
  const cases=[{id:'m',shared:true,tasks:[{id:'t',title:'İç iş',dueOn:'2026-11-03'}],deadlines:[{id:'d',title:'İncele',status:'proposed',proposedDueAt:'2026-11-04'}],agendaItems:[{id:'h',kind:'hearing',title:'Duruşma',startsAt:'2026-11-03T07:00:00Z',endsAt:'2026-11-03T08:00:00Z',sharedWithClient:true,ownerId:'a',status:'planned'}]}];
  const lawyer=calendarEvents([],cases,'lawyer','a');assert.equal(lawyer.find(e=>e.id==='agenda-h').start,'10:00');assert.equal(lawyer.find(e=>e.id==='task-t').shared,false);assert.equal(lawyer.find(e=>e.id==='deadline-d').verified,false);
  assert.deepEqual(calendarEvents([],cases,'client','a').map(e=>e.id),['agenda-h']);
  assert.deepEqual(calendarEvents([],[{...cases[0],shared:false}],'client','a'),[]);
});
