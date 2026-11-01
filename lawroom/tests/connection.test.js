import test from 'node:test';
import assert from 'node:assert/strict';
import {isPublicApiKey,isSupportedApiUrl} from '../src/domain/connection.js';
test('istemci service role ve secret anahtarını kabul etmez',()=>{
 const jwt=role=>'header.'+btoa(JSON.stringify({role}))+'.signature';
 assert.equal(isPublicApiKey(jwt('anon')),true);
 assert.equal(isPublicApiKey(jwt('service_role')),false);
 assert.equal(isPublicApiKey('sb_secret_not-for-browser'),false);
 assert.equal(isPublicApiKey('sb_publishable_abcdefghijklmnopqrst'),true);
 assert.equal(isPublicApiKey(''),false);
});
test('yalnız proje HTTPS adresi veya yerel Supabase geliştirme adresi kullanılır',()=>{
 assert.equal(isSupportedApiUrl('https://deezwydtiibbdtimxcxf.supabase.co'),true);
 assert.equal(isSupportedApiUrl('http://127.0.0.1:54321'),true);
 assert.equal(isSupportedApiUrl('https://example.com'),false);
 assert.equal(isSupportedApiUrl('https://secret@example.supabase.co'),false);
 assert.equal(isSupportedApiUrl('https://example.supabase.co/?key=secret'),false);
});
