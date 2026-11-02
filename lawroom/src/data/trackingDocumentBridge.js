/** The same document presentation can use this live controller or the isolated demo repository. */
export function createTrackingDocumentBridge(controller){
 const current=id=>{if(controller.getSnapshot().selected?.matter.id!==id)throw new Error('Açık dosya değişti. Yeniden deneyin.');};
 const finish=ok=>{if(!ok)throw new Error(controller.getSnapshot().error?.message||'Belge işlemi tamamlanamadı.');return controller.getSnapshot().items.map(dto=>dto.matter);};
 return Object.freeze({
  async upload(matterId,file,input){current(matterId);return finish(await controller.upload(file,input));},
  async share(matterId,documentId,shared){current(matterId);return finish(await controller.shareDocument(documentId,shared));},
  async download(matterId,_documentId,versionId){current(matterId);const blob=await controller.download(versionId);if(!blob)throw new Error('Belge erişimi değişti.');return blob;},
 });
}
