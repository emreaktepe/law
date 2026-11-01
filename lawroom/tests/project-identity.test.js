import test from 'node:test';
import assert from 'node:assert/strict';
import {isExpectedSupabaseUrl,isExpectedSupabaseConfiguration} from '../src/domain/project-identity.js';

test('LawRoom project permits its canonical HTTPS endpoint', () => {
  assert.equal(isExpectedSupabaseUrl('https://deezwydtiibbdtimxcxf.supabase.co'), true);
  assert.equal(isExpectedSupabaseUrl('https://deezwydtiibbdtimxcxf.supabase.co/'), true);
});

const expectedUrl = 'https://deezwydtiibbdtimxcxf.supabase.co';
const jwt = payload => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.fixture-signature`;
test('only public key types can initialize the client on the expected project', () => {
  assert.equal(isExpectedSupabaseConfiguration(expectedUrl,'sb_publishable_fixture'),true);
  for (const key of ['',null,undefined,'sb_publishable_','sb_secret_fixture','service_role'])
    assert.equal(isExpectedSupabaseConfiguration(expectedUrl,key),false);
  assert.equal(isExpectedSupabaseConfiguration('https://qxpgnhuwqamvybobmfjx.supabase.co','sb_publishable_fixture'),false);
});
test('legacy public JWT must name LawRoom and anon; client decoding grants no server access', () => {
  assert.equal(isExpectedSupabaseConfiguration(expectedUrl,jwt({role:'anon',ref:'deezwydtiibbdtimxcxf'})),true);
  assert.equal(isExpectedSupabaseConfiguration(expectedUrl,jwt({role:'anon',ref:'qxpgnhuwqamvybobmfjx'})),false);
  assert.equal(isExpectedSupabaseConfiguration(expectedUrl,jwt({role:'service_role',ref:'deezwydtiibbdtimxcxf'})),false);
  assert.equal(isExpectedSupabaseConfiguration(expectedUrl,jwt({role:'anon'})),false);
  assert.equal(isExpectedSupabaseConfiguration(expectedUrl,'eyJ.invalid.signature'),false);
});
test('DietApp and other valid Supabase projects cannot initialize LawRoom', () => {
  assert.equal(isExpectedSupabaseUrl('https://qxpgnhuwqamvybobmfjx.supabase.co'), false);
  assert.equal(isExpectedSupabaseUrl('https://aqqhgjadfsacwglxfzlj.supabase.co'), false);
});
test('host lookalikes, userinfo, paths, queries, fragments and HTTP are rejected', () => {
  for (const url of [
    'https://deezwydtiibbdtimxcxf.supabase.co.evil.example',
    'https://user@deezwydtiibbdtimxcxf.supabase.co',
    'https://deezwydtiibbdtimxcxf.supabase.co/rest/v1',
    'https://deezwydtiibbdtimxcxf.supabase.co/?project_ref=qxpgnhuwqamvybobmfjx',
    'https://deezwydtiibbdtimxcxf.supabase.co/#other',
    'http://deezwydtiibbdtimxcxf.supabase.co',
    '', 'not-a-url'
  ]) assert.equal(isExpectedSupabaseUrl(url), false, url);
});
