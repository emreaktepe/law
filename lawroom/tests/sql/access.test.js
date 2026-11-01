import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
before(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb default '{}',unique(bucket_id,name));
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated,anon,service_role;grant select,insert,update,delete on storage.objects to authenticated,anon;
 create function storage.allow_only_operation(op text) returns boolean language sql stable as $$select current_setting('storage.operation',true)=op$$;
 `);
  // foundation is a fixture only in this disposable Postgres instance, never reapplied remotely.
  await db.exec(
    await readFile(
      new URL("../../supabase/foundation.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const file of (
    await readdir(new URL("../../supabase/migrations/", import.meta.url))
  ).sort())
    await db.exec(
      await readFile(
        new URL("../../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  for (let n = 1; n <= 7; n++)
    await db.query("insert into auth.users values($1,$2,now())", [
      id(n),
      `fixture${n}@example.invalid`,
    ]);
  await db.exec(`insert into lr_accounts(user_id,display_name,role,status) values('${id(1)}','Admin','admin','active'),('${id(2)}','Avukat A','lawyer','active'),('${id(4)}','Müvekkil A','client','active'),('${id(5)}','Müvekkil B','client','active'),('${id(7)}','Avukat B','lawyer','active');
 insert into lr_organizations(id,name,kind,status) values('${id(8)}','A','individual','active'),('${id(9)}','B','individual','active');
 insert into lr_memberships values('${id(8)}','${id(2)}','owner',true),('${id(9)}','${id(7)}','owner',true);
 insert into lr_relationships(id,organization_id,lawyer_id,client_id,status) values('${id(10)}','${id(8)}','${id(2)}','${id(4)}','accepted');
 insert into lr_matters(id,organization_id,owner_id,title,matter_type) values('${id(11)}','${id(8)}','${id(2)}','Test dosyası','Diğer');
 insert into lr_matter_clients values('${id(11)}','${id(8)}','${id(10)}',true);
 insert into lr_internal_notes(matter_id,body) values('${id(11)}','Yalnız avukat');
 insert into lr_documents(id,matter_id,name,object_path,shared,upload_status,uploaded_by,size_bytes) values('${id(12)}','${id(11)}','test.pdf','${id(8)}/${id(11)}/${id(12)}/1-test.pdf',true,'ready','${id(2)}',100);
 insert into storage.objects(bucket_id,name,metadata) select 'lr-matter-files',object_path,'{"size":100}' from lr_documents;
 `);
});
after(() => db.close());
async function actor(n) {
  await db.exec(
    `reset role;set local role authenticated;select set_config('request.jwt.claim.sub','${id(n)}',true);select set_config('storage.operation','storage.object.get_authenticated',true);`,
  );
}
async function rows(sql, args = []) {
  return (await db.query(sql, args)).rows;
}
async function rejected(fn) {
  await db.exec("savepoint denied");
  await assert.rejects(fn);
  await db.exec("rollback to savepoint denied");
}
async function isolated(fn) {
  await db.exec("begin");
  try {
    await fn();
  } finally {
    await db.exec("rollback");
  }
}
test("admin, ilgisiz avukat ve başka müvekkil dosya/belge/iç not okuyamaz", () =>
  isolated(async () => {
    for (const user of [1, 5, 7]) {
      await actor(user);
      for (const table of ["lr_matters", "lr_documents", "lr_internal_notes"])
        assert.equal((await rows(`select * from ${table}`)).length, 0);
      assert.equal((await rows("select * from storage.objects")).length, 0);
    }
    await actor(4);
    assert.equal((await rows("select * from lr_matters")).length, 1);
    assert.equal((await rows("select * from lr_internal_notes")).length, 0);
    await rejected(() => db.exec("update lr_accounts set role='admin'"));
  }));
test("ilişki veya belge paylaşımı kaldırılınca bilinen Storage yoluna erişim kesilir; imzalı URL üretimi kapalı", () =>
  isolated(async () => {
    await actor(4);
    assert.equal((await rows("select * from storage.objects")).length, 1);
    await db.exec(
      "select set_config('storage.operation','storage.object.sign',true)",
    );
    assert.equal((await rows("select * from storage.objects")).length, 0);
    await db.exec(
      "select set_config('storage.operation','storage.object.get_authenticated',true)",
    );
    await db.exec(
      `reset role;update lr_relationships set status='revoked' where id='${id(10)}'`,
    );
    await actor(4);
    assert.equal((await rows("select * from storage.objects")).length, 0);
    assert.equal((await rows("select * from lr_matters")).length, 0);
  }));
test("başvuru rolü metadata ile yükseltilemez; avukat hesabını yalnız admin açar", () =>
  isolated(async () => {
    await actor(3);
    await db.exec(
      `select set_config('request.jwt.claims','{"user_metadata":{"role":"admin"}}',true)`,
    );
    const [{ aid }] = await rows(
      "select lr_submit_application('lawyer','Yeni Avukat','Örnek 123',null,null) as aid",
    );
    assert.equal(
      (await rows("select status from lr_accounts"))[0].status,
      "pending",
    );
    await rejected(() =>
      db.query("select lr_review_application($1,true,null)", [aid]),
    );
    await actor(1);
    await db.query("select lr_review_application($1,true,null)", [aid]);
    await actor(3);
    assert.equal(
      (await rows("select status from lr_accounts"))[0].status,
      "active",
    );
    assert.equal((await rows("select * from lr_memberships")).length, 1);
  }));
test("atama kabul değildir; kabul de dosya paylaşımı değildir", () =>
  isolated(async () => {
    await actor(6);
    const [{ aid }] = await rows(
      "select lr_submit_application('client','Yeni Müvekkil',null,null,null) as aid",
    );
    await actor(1);
    await db.query("select lr_assign_client($1,$2)", [aid, id(2)]);
    await db.exec("reset role");
    const [{ id: relationship }] = await rows(
      "select id from lr_relationships where client_id=$1",
      [id(6)],
    );
    await actor(6);
    assert.equal((await rows("select * from lr_matters")).length, 0);
    assert.equal(
      (await rows("select status from lr_accounts"))[0].status,
      "pending",
    );
    await actor(2);
    await db.query("select lr_review_relationship($1,true)", [relationship]);
    await actor(6);
    assert.equal(
      (await rows("select status from lr_accounts"))[0].status,
      "active",
    );
    assert.equal((await rows("select * from lr_matters")).length, 0);
    await actor(2);
    await db.query("select lr_share_matter($1,$2,true)", [
      id(11),
      relationship,
    ]);
    await actor(6);
    assert.equal((await rows("select * from lr_matters")).length, 1);
  }));
test("belge yalnız yetkili avukatça, yeni yol ile yüklenir; eksik yükleme yayımlanmaz", () =>
  isolated(async () => {
    await actor(4);
    await rejected(() =>
      db.query(
        "select lr_reserve_document($1,'test.pdf','application/pdf',100)",
        [id(11)],
      ),
    );
    await actor(2);
    const [{ value }] = await rows(
      "select lr_reserve_document($1,'yeni.pdf','application/pdf',100) as value",
      [id(11)],
    );
    assert.match(value.object_path, /\/1-yeni.pdf$/);
    await rejected(() =>
      db.query("select lr_finalize_document($1)", [value.id]),
    );
    await db.query(
      "insert into storage.objects(bucket_id,name,metadata) values('lr-matter-files',$1,'{\"size\":100}')",
      [value.object_path],
    );
    await db.query("select lr_finalize_document($1)", [value.id]);
    await actor(4);
    assert.equal(
      (await rows("select * from lr_documents where id=$1", [value.id])).length,
      0,
    );
    await actor(2);
    await db.query("select lr_share_document($1,true)", [value.id]);
    await actor(4);
    assert.equal(
      (await rows("select * from lr_documents where id=$1", [value.id])).length,
      1,
    );
  }));
test("anon yeni RPC çalıştıramaz; hatalı başvuru atomik olarak geri alınır", () =>
  isolated(async () => {
    await actor(6);
    await rejected(() =>
      db.exec(
        "select lr_submit_application('firm','Eksik Büro',null,null,null)",
      ),
    );
    assert.equal((await rows("select * from lr_applications")).length, 0);
    await db.exec("reset role;set local role anon");
    await rejected(() => db.exec("select lr_assignable_lawyers()"));
  }));
test("bildirim kuyruğu yalnız yetkili alıcıyı alır; servis dışından çalıştırılamaz ve tekrar teslim kaydı oluşmaz", () =>
  isolated(async () => {
    await actor(2);
    await db.query(
      "insert into lr_messages(matter_id,sender_id,body) values($1,$2,$3)",
      [id(11), id(2), "Örnek mesaj"],
    );
    await rejected(() => db.exec("select * from lr_claim_notifications(10)"));
    await db.exec("reset role");
    const queued = await rows(
      "select recipient_id from lr_notification_outbox",
    );
    assert.deepEqual(queued, [{ recipient_id: id(4) }]);
    await db.exec("set local role service_role");
    const [job] = await rows("select * from lr_claim_notifications(10)");
    assert.ok(job.id);
    const [{ email }] = await rows(
      "select lr_authorize_delivery($1,$2) as email",
      [job.id, job.lease_token],
    );
    assert.equal(email, "fixture4@example.invalid");
    await db.query("select lr_finish_delivery($1,$2,true,200)", [
      job.id,
      job.lease_token,
    ]);
    await db.query("select lr_finish_delivery($1,$2,true,200)", [
      job.id,
      job.lease_token,
    ]);
    assert.equal(
      (await rows("select * from lr_claim_notifications(10)")).length,
      0,
    );
    await db.exec("reset role");
    assert.equal((await rows("select * from lr_delivery_attempts")).length, 1);
  }));
test("bildirim alıcısı gönderimden hemen önce yeniden yetkilendirilir", () =>
  isolated(async () => {
    await actor(2);
    await db.query(
      "insert into lr_messages(matter_id,sender_id,body) values($1,$2,$3)",
      [id(11), id(2), "Örnek mesaj"],
    );
    await db.exec("reset role;set local role service_role");
    const [job] = await rows("select * from lr_claim_notifications(10)");
    await db.exec(
      `reset role;update lr_relationships set status='revoked' where id='${id(10)}';set local role service_role`,
    );
    const [{ email }] = await rows(
      "select lr_authorize_delivery($1,$2) as email",
      [job.id, job.lease_token],
    );
    assert.equal(email, null);
    await db.exec("reset role");
    assert.equal(
      (await rows("select status from lr_notification_outbox"))[0].status,
      "cancelled",
    );
  }));
