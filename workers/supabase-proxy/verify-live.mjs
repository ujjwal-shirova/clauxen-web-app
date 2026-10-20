import assert from 'node:assert/strict';
const origin = 'https://auth.clauxen.com';
const canonicalCallback = 'https://ntplcfsbcyhiqklkbldk.supabase.co/auth/v1/callback';
const brandedCallback = `${origin}/auth/v1/callback`;
const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
async function check(path, init, status) {
  const headers = new Headers(init.headers);
  if (apiKey) headers.set('apikey', apiKey);
  const response = await fetch(origin + path, { ...init, headers, redirect: 'manual' });
  assert.equal(response.status, status, `${path}: HTTP ${response.status}`);
  assert.equal(response.headers.get('x-clauxen-proxy'), '1');
  assert.match(response.headers.get('cache-control'), /no-store/);
  return response;
}
await check('/health', {}, 200);
await check('/auth/v1/user', {}, 401);
await check('/auth/v1/admin/users', {}, 404);
await check('/auth/v1/token?grant_type=refresh_token', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refresh_token: 'invalid-clauxen-proxy-verification' }),
}, apiKey ? 400 : 401);
await check('/auth/v1/callback?error=access_denied&error_description=proxy-check', {}, 303);
const preflight = await check('/auth/v1/token', {
  method: 'OPTIONS', headers: { Origin: 'https://www.clauxen.com',
    'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'apikey,authorization,content-type' },
}, 200);
assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), '*');
for (const provider of ['github', 'gitlab']) {
  const response = await check(`/auth/v1/authorize?provider=${provider}`, {}, 302);
  const brokerUrl = new URL(response.headers.get('Location'));
  assert.equal(brokerUrl.origin, origin);
  assert.equal(brokerUrl.pathname, `/oauth/${provider}/authorize`);
  assert.equal(brokerUrl.searchParams.get('redirect_uri'), canonicalCallback);
  const broker = await fetch(brokerUrl, { redirect: 'manual' });
  assert.equal(broker.status, 302);
  const location = new URL(broker.headers.get('Location'));
  assert.equal(location.hostname, `${provider}.com`);
  assert.equal(location.searchParams.get('redirect_uri'), brandedCallback);
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  const state = location.searchParams.get('state');
  const cookie = broker.headers.get('Set-Cookie').split(';')[0];
  const cancel = await fetch(`${brandedCallback}?${new URLSearchParams({ state, error: 'access_denied' })}`, { redirect: 'manual', headers: { Cookie: cookie } });
  assert.equal(cancel.status, 302);
  const outer = new URL(cancel.headers.get('Location'));
  assert.equal(outer.origin + outer.pathname, canonicalCallback);
  assert.equal(outer.searchParams.get('error'), 'access_denied');
  console.log(`${provider}: branded provider callback, S256 PKCE, browser cookie and cancellation verified`);
}
console.log('Proxy and broker live transport checks passed. Successful account sign-in requires user participation.');
