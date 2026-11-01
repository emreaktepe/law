import {normalizeSearchText} from '../lib/normalize.js';

/** @typedef {{key:string,label:string,clientLabel:string}} StageDefinition */
/** @typedef {{key:string,label:string,version:string,unverified:boolean,verifiedByLawyer:boolean,notice:string,subtypes:readonly string[],stages:readonly StageDefinition[]}} MatterTemplate */

export const TEMPLATE_VERSION = 'draft-2026-11-01';
export const TEMPLATE_NOTICE = 'Doğrulanmamış örnek. Hukukçu incelemesi olmadan kesin prosedür olarak kullanılmaz.';

function template(key, label, subtypes, stages) {
  return Object.freeze({key, label, version: TEMPLATE_VERSION, unverified: true,
    verifiedByLawyer: false, notice: TEMPLATE_NOTICE,
    subtypes: Object.freeze(subtypes),
    stages: Object.freeze(stages.map(([key, label, clientLabel]) => Object.freeze({key, label, clientLabel}))) });
}

export const matterTemplates = Object.freeze([
  template('icra','İcra',['İlamsız takip','İlamlı takip','Kambiyo','Kira / tahliye','Rehin'],[
    ['hazirlik','Hazırlık','Takibe hazırlanılıyor'],['takip','Takip açıldı','Takip başlatıldı'],
    ['tebligat','Ödeme emri / tebligat','Resmî bildirim aşaması'],['itiraz','İtiraz süreci','İtirazlar değerlendiriliyor'],
    ['kesinlesme','Kesinleşme','Takibin durumu kontrol ediliyor'],['haciz','Haciz','Tahsilat işlemleri izleniyor'],
    ['satis','Satış','Satış işlemleri izleniyor'],['tahsilat','Tahsilat','Ödeme durumu izleniyor'],['kapanis','Kapanış','Takip tamamlanıyor']]),
  template('aile','Aile',['Anlaşmalı boşanma','Çekişmeli boşanma','Velayet','Nafaka','Mal rejimi','Koruma tedbiri'],[
    ['hazirlik','Hazırlık','Dosya hazırlanıyor'],['dava','Dava açıldı','Süreç başlatıldı'],['dilekceler','Dilekçeler','Yazılı açıklamalar sunuluyor'],
    ['on_inceleme','Ön inceleme','İlk inceleme yapılıyor'],['tahkikat','Tahkikat','Deliller değerlendiriliyor'],
    ['karar','Karar','Karar aşaması izleniyor'],['kanun_yolu','Kanun yolu','Kararın incelenmesi izleniyor'],['kesinlesme','Kesinleşme','Kararın son durumu kontrol ediliyor']]),
  template('is','İş',['İşe iade','İşçilik alacağı','İş kazası'],[
    ['arabuluculuk','Arabuluculuk','Uzlaşma görüşmeleri izleniyor'],['dava','Dava açıldı','Süreç başlatıldı'],['dilekceler','Dilekçeler','Yazılı açıklamalar sunuluyor'],
    ['on_inceleme','Ön inceleme','İlk inceleme yapılıyor'],['tahkikat','Tahkikat / bilirkişi','Deliller değerlendiriliyor'],
    ['karar','Karar','Karar aşaması izleniyor'],['kanun_yolu','Kanun yolu','Kararın incelenmesi izleniyor']]),
  template('idari_vergi','İdari / Vergi',['İptal','Tam yargı','Vergi'],[
    ['islem','İşlem / öğrenme','İşlem bilgileri inceleniyor'],['on_basvuru','Ön başvuru','Başvuru gereksinimi inceleniyor'],
    ['dava','Dava açıldı','Süreç başlatıldı'],['yd','Yürütmenin durdurulması talebi','Geçici koruma talebi izleniyor'],
    ['savunmalar','Savunmalar','Yazılı açıklamalar değerlendiriliyor'],['karar','Karar','Karar aşaması izleniyor'],['kanun_yolu','Kanun yolu','Kararın incelenmesi izleniyor']]),
  template('ceza','Ceza',['Soruşturma','Kovuşturma'],[
    ['sorusturma','Soruşturma','İlk inceleme süreci izleniyor'],['iddianame','İddianame / KYOK','Soruşturma sonucu izleniyor'],
    ['kovusturma','Kovuşturma','Mahkeme süreci izleniyor'],['durusmalar','Duruşmalar','Duruşmalar takip ediliyor'],
    ['hukum','Hüküm','Karar aşaması izleniyor'],['kanun_yolu','Kanun yolu','Kararın incelenmesi izleniyor'],['infaz','İnfaz','Kararın uygulanması izleniyor']]),
  template('ticaret','Ticaret',['Alacak','Şirketler','Haksız rekabet'],[
    ['arabuluculuk','Arabuluculuk','Uzlaşma görüşmeleri izleniyor'],['dava','Dava','Mahkeme süreci izleniyor'],
    ['dilekceler','Dilekçeler','Yazılı açıklamalar sunuluyor'],['on_inceleme','Ön inceleme','İlk inceleme yapılıyor'],
    ['tahkikat','Tahkikat','Deliller değerlendiriliyor'],['karar','Karar','Karar aşaması izleniyor'],['kanun_yolu','Kanun yolu','Kararın incelenmesi izleniyor']]),
  template('tuketici','Tüketici',['Ayıplı mal / hizmet','Hakem heyeti'],[
    ['basvuru','Hakem heyeti / arabuluculuk','Başvuru ve görüşmeler izleniyor'],['dava','Dava','Mahkeme süreci izleniyor'],['karar','Karar','Karar aşaması izleniyor']]),
  template('miras','Miras',['Mirasçılık belgesi','Tenkis','Ortaklığın giderilmesi'],[
    ['hazirlik','Hazırlık','Dosya hazırlanıyor'],['dava','Dava','Mahkeme süreci izleniyor'],['karar','Karar','Karar aşaması izleniyor'],['paylastirma','Satış / paylaştırma','Paylaşım işlemleri izleniyor']]),
  template('gayrimenkul','Gayrimenkul',['Tapu iptal / tescil','Kira tespit','Tahliye','Kamulaştırma'],[
    ['hazirlik','Hazırlık','Dosya hazırlanıyor'],['dava','Dava','Mahkeme süreci izleniyor'],['kesif','Keşif','Yerinde inceleme izleniyor'],
    ['bilirkisi','Bilirkişi','Uzman incelemesi izleniyor'],['karar','Karar','Karar aşaması izleniyor'],['kanun_yolu','Kanun yolu','Kararın incelenmesi izleniyor']]),
  template('arabuluculuk','Arabuluculuk',['Dava şartı','İhtiyari'],[
    ['basvuru','Başvuru','Başvuru yapılıyor'],['toplantilar','Toplantılar','Görüşmeler sürüyor'],['sonuc','Anlaşma / anlaşamama','Görüşme sonucu kaydediliyor']]),
  template('danismanlik','Danışmanlık',['Sözleşme','Görüş','Uyum'],[
    ['talep','Talep','Talebiniz alındı'],['inceleme','İnceleme','Talebiniz inceleniyor'],['taslak','Taslak','Çalışma hazırlanıyor'],
    ['teslim','Teslim','Çalışma paylaşılıyor'],['kapanis','Kapanış','Çalışma tamamlanıyor']]),
  template('diger','Diğer',['Serbest'],[['hazirlik','Hazırlık','Dosya hazırlanıyor'],['takip','Takip','Gelişmeler izleniyor'],['kapanis','Kapanış','Dosya tamamlanıyor']]),
]);

const aliases = new Map(matterTemplates.flatMap(t => [[normalizeSearchText(t.key),t],[normalizeSearchText(t.label),t]]));
for (const alias of ['idari','vergi','idari vergi']) aliases.set(alias,matterTemplates.find(t=>t.key==='idari_vergi'));
for (const [alias,key] of [['is hukuku','is'],['aile bosanma','aile']]) aliases.set(alias,matterTemplates.find(t=>t.key===key));

/** @param {string} type @returns {Readonly<MatterTemplate>|null} Unknown types require explicit selection. */
export function getMatterTemplate(type) { return aliases.get(normalizeSearchText(type)) ?? null; }

/** @param {string} type Existing matters keep their saved version; no silent upgrade. */
export function createMatterStageSnapshot(type) {
  const selected=getMatterTemplate(type);
  return selected ? structuredClone(selected) : null;
}
