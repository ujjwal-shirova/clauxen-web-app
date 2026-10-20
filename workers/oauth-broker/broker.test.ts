import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { fileURLToPath } from "node:url";
import { CALLBACK, SUPABASE_CALLBACK, hash } from "./src/protocol";

const secret = "test-broker-secret-".repeat(3);
const origin = "https://auth.clauxen.com";
const fixture = `
import {handleBroker} from './src/broker';
import {hash, CALLBACK} from './src/protocol';
export {OAuthFlow} from './src/flow';
export default {fetch(request, env) {
  return handleBroker(request, {
    secret: ${JSON.stringify(secret)},
    credentials: p => ({id:p+'-client',secret:'provider-secret'}),
    flow: id => env.OAUTH_FLOWS.getByName(id),
    canonicalEmail: async (provider,subject,email) => {
      if(subject !== '1234') throw Error('incorrect subject');
      return 'existing-account@example.test';
    },
    fetcher: async (input,init) => {
      const url = String(input);
      if(url.includes('/token') || url.includes('/access_token')) {
        const p = new URLSearchParams(init.body);
        if(p.get('redirect_uri')!==CALLBACK || await hash(p.get('code_verifier'))!==p.get('code'))
          return Response.json({error:'invalid_grant'},{status:400});
        return Response.json({access_token:'provider-token',token_type:'bearer'});
      }
      if(new Headers(init.headers).get('Authorization')!=='Bearer provider-token') return new Response(null,{status:401});
      if(url.includes('/user/emails')) return Response.json([{email:'current-provider-email@example.test',primary:true,verified:true}]);
      return Response.json({id:1234,name:'Test account',login:'fixture',username:'fixture',email:'current-provider-email@example.test',confirmed_at:'2026-01-01T00:00:00Z'});
    }
  });
}};
`;
async function runtime() {
  const bundle = await build({ stdin: { contents: fixture, resolveDir: fileURLToPath(new URL('.', import.meta.url)) }, bundle: true, write: false, format: 'esm', platform: 'browser', external: ['cloudflare:workers'], target: 'es2022' });
  // The bundled local workerd currently supports dates through 2026-10-13.
  return new Miniflare(convertV4MiniflareOptions({ name: 'broker-test', modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-13', durableObjects: { OAUTH_FLOWS: { className: 'OAuthFlow', useSQLite: true } } }));
}
const send = (mf: Miniflare, url: string, init: RequestInit = {}) => mf.dispatchFetch(url, { ...init, redirect: 'manual' });
async function begin(mf: Miniflare, provider: string, verifier: string) {
  const params = new URLSearchParams({ client_id: `clauxen-${provider}`, redirect_uri: SUPABASE_CALLBACK, response_type: 'code', state: 'supabase-signed-state-fixture-123456', code_challenge: await hash(verifier), code_challenge_method: 'S256' });
  const response = await send(mf, `${origin}/oauth/${provider}/authorize?${params}`);
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('Location')!);
  assert.equal(location.searchParams.get('redirect_uri'), CALLBACK);
  assert.equal(location.searchParams.get('scope'), provider === 'github' ? 'user:email' : 'read_user');
  const cookie = response.headers.get('Set-Cookie')!.split(';')[0];
  assert.match(response.headers.get('Set-Cookie')!, /Secure; HttpOnly; SameSite=Lax/);
  const callback = new URL(CALLBACK);
  callback.searchParams.set('state', location.searchParams.get('state')!);
  callback.searchParams.set('code', location.searchParams.get('code_challenge')!);
  return { callback, cookie };
}
test('GitHub and GitLab complete both PKCE exchanges, preserve canonical account, reject replay', async () => {
  const mf = await runtime();
  try {
    for (const provider of ['github', 'gitlab']) {
      const verifier = 'v'.repeat(43);
      const { callback, cookie } = await begin(mf, provider, verifier);
      const missingCookie = await send(mf, callback.href);
      assert.equal(missingCookie.status, 400);
      const callbacks = await Promise.all([send(mf, callback.href, { headers: { Cookie: cookie } }), send(mf, callback.href, { headers: { Cookie: cookie } })]);
      assert.deepEqual(callbacks.map(r => r.status).sort(), [302, 400]);
      const response = callbacks.find(r => r.status === 302)!;
      const outer = new URL(response.headers.get('Location')!);
      assert.equal(outer.origin + outer.pathname, SUPABASE_CALLBACK);
      assert.equal(outer.searchParams.get('state'), 'supabase-signed-state-fixture-123456');
      assert.ok(outer.searchParams.get('code'));
      assert.equal(outer.searchParams.has('error'), false);
      const form = (codeVerifier: string) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`clauxen-${provider}:${secret}`)}` }, body: new URLSearchParams({ grant_type: 'authorization_code', redirect_uri: SUPABASE_CALLBACK, code: outer.searchParams.get('code')!, code_verifier: codeVerifier }).toString() });
      const badPkce = await send(mf, `${origin}/oauth/${provider}/token`, form('x'.repeat(43)));
      assert.equal(badPkce.status, 400);
      const tokenResponse = await send(mf, `${origin}/oauth/${provider}/token`, form(verifier));
      assert.equal(tokenResponse.status, 200);
      const token = await tokenResponse.json() as { access_token: string };
      assert.doesNotMatch(token.access_token, /provider-token/);
      const replay = await send(mf, `${origin}/oauth/${provider}/token`, form(verifier));
      assert.equal(replay.status, 400);
      const userinfo = await send(mf, `${origin}/oauth/${provider}/userinfo`, { headers: { Authorization: `Bearer ${token.access_token}` } });
      assert.equal(userinfo.status, 200);
      const user = await userinfo.json() as { sub: string; email: string; email_verified: boolean };
      assert.equal(user.sub, '1234');
      assert.equal(user.email, 'existing-account@example.test');
      assert.equal(user.email_verified, true);
      const other = provider === 'github' ? 'gitlab' : 'github';
      assert.equal((await send(mf, `${origin}/oauth/${other}/userinfo`, { headers: { Authorization: `Bearer ${token.access_token}` } })).status, 401);
    }
  } finally { await mf.dispose(); }
});
test('callback cancellation, untrusted redirects, duplicate params and missing client credentials fail closed', async () => {
  const mf = await runtime();
  try {
    assert.equal((await send(mf, `${origin}/oauth/github/authorize?redirect_uri=https://evil.example`)).status, 400);
    assert.equal((await send(mf, `${origin}/oauth/github/authorize?state=one&state=two`)).status, 400);
    assert.equal((await send(mf, `${origin}/oauth/github/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'client_id=clauxen-github' })).status, 401);
    const { callback, cookie } = await begin(mf, 'github', 'v'.repeat(43));
    callback.searchParams.delete('code'); callback.searchParams.set('error', 'access_denied');
    const cancelled = await send(mf, callback.href, { headers: { Cookie: cookie } });
    const location = new URL(cancelled.headers.get('Location')!);
    assert.equal(location.searchParams.get('error'), 'access_denied');
    assert.equal(location.searchParams.has('code'), false);
  } finally { await mf.dispose(); }
});
