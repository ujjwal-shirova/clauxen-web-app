import assert from 'node:assert/strict';
const origin = 'https://www.clauxen.com';
for (const [path, method, expected] of [
  ['/github', 'GET', 200],
  ['/api/v1/github/health', 'GET', 200],
  ['/api/v1/github/status', 'GET', 401],
  ['/api/v1/github/manifest/start', 'POST', 403],
  ['/api/v1/github/internal/execute', 'POST', 403],
]) {
  const response = await fetch(origin + path, {method, redirect:'manual',headers:{'User-Agent':'Clauxen-Agent-Verification/1.0'}});
  assert.equal(response.status,expected,`${method} ${path}`);
  await response.body?.cancel();
  console.log(`${method} ${path}: ${response.status}`);
}
console.log('Public and unauthorized boundaries verified; this does not prove an authorized GitHub commit.');
