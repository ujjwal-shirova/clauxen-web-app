import { escapeHtml } from "./security";
const style = `:root{color-scheme:light;font:15px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#19212b;background:#fafbfc}*{box-sizing:border-box}body{margin:0;padding:48px 20px}main{max-width:680px;margin:auto;background:white;border:1px solid #e7eaf0;border-radius:24px;padding:36px}h1{font-size:28px;letter-spacing:-1px;margin:8px 0 12px}p{line-height:1.65;color:#626b77}button,.button{font:inherit;display:inline-flex;align-items:center;justify-content:center;border:1px solid #dfe4ec;border-radius:12px;padding:12px 18px;background:#fff;color:#19212b;cursor:pointer;text-decoration:none;margin:6px 8px 6px 0}button.primary,.button.primary{background:#3568df;border-color:#3568df;color:#fff}button:disabled{opacity:.5}small{color:#737c88}.row{padding:14px 0;border-bottom:1px solid #edf0f4}.row a{color:#3568df;text-decoration:none}.error{color:#b82737}#message{white-space:pre-wrap}header{font-size:15px;font-weight:650;letter-spacing:-.3px}.pill{font-size:12px;padding:5px 9px;border-radius:20px;background:#edf3ff;color:#42639c}code{font-size:13px}@media(max-width:480px){body{padding:20px 12px}main{padding:24px}}`;
export function page(title: string, body: string, script = "") {
  const nonce = crypto.randomUUID();
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Clauxen</title><style nonce="${nonce}">${style}</style><main><header>Clauxen <span class="pill">GitHub</span></header>${body}</main>${script ? `<script nonce="${nonce}">${script}</script>` : ""}</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action https://github.com; base-uri 'none'; frame-ancestors 'none'`,
      },
    },
  );
}
export function setupPage() {
  return page(
    "Set up Clauxen Agent",
    `<h1>Clauxen Agent</h1><p>Register the GitHub App owned by <strong>shirova-ai</strong>. The private key and webhook secret will be encrypted and stored on the Clauxen backend. You can add the logo in GitHub afterward.</p><p>Requested access: repository contents and pull requests, read and write; repository metadata, read only. Users choose repositories during installation.</p><button id="register" class="primary">Prepare organization registration</button><p id="message"></p><a class="button" href="/github">Back to GitHub connection</a>`,
    `
let token=location.hash.slice(1);history.replaceState(null,'',location.pathname);
document.querySelector('#register').onclick=async()=>{const b=document.querySelector('#register');b.disabled=true;try{
const r=await fetch('/api/v1/github/manifest/start',{method:'POST',headers:{Authorization:'Bearer '+token}});const v=await r.json();if(!r.ok)throw Error(v.error.message);
const form=document.createElement('form');form.method='POST';form.action=v.data.registration_url;
const input=document.createElement('input');input.type='hidden';input.name='manifest';input.value=JSON.stringify(v.data.manifest);form.append(input);document.body.append(form);form.submit();
}catch(e){document.querySelector('#message').textContent=e.message;b.disabled=false;}};`,
  );
}
export function connectionPage() {
  return page(
    "GitHub connection",
    `<h1>Your repositories, connected.</h1><p>Use Clauxen Agent from web or Android to read your code, prepare commits, and open draft pull requests under your GitHub permissions.</p><p id="message">Checking your connection…</p><div id="actions"></div><div id="repos"></div><p><small>New branches use <code>clauxen/</code>. Clauxen never force-pushes or merges a pull request through this integration.</small></p><a class="button" href="/new">Back to Clauxen</a>`,
    `
const message=document.querySelector('#message'),actions=document.querySelector('#actions'),repos=document.querySelector('#repos');
async function api(path,body){const r=await fetch('/api/v1/github/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const v=await r.json();if(!r.ok)throw Object.assign(Error(v.error.message),{status:r.status});return v.data;}
function button(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){message.textContent=e.message;}finally{b.disabled=false;}};actions.append(b);return b;}
async function load(){try{
if(location.hash.startsWith('#launch=')){const launch=location.hash.slice(8);history.replaceState(null,'',location.pathname);await api('browser-session',{launch});}
const status=await api('status');actions.replaceChildren();
if(!status.configured){message.textContent='Clauxen Agent is being configured. Please check back shortly.';return;}
if(!status.connected){message.textContent='Connect your GitHub account, then choose repositories for Clauxen Agent.';button('Connect GitHub',async()=>{location.href=(await api('oauth/start',{})).url;}).className='primary';return;}
message.textContent='Connected as '+status.login+'.';
const install=document.createElement('a');install.className='button primary';install.textContent='Choose repositories';install.href=status.install_url;actions.append(install);
button('Refresh repositories',load);
button('Disconnect',async()=>{await api('disconnect',{});repos.replaceChildren();await load();});
const result=await api('repositories');repos.replaceChildren();for(const installation of result.installations){for(const repo of installation.repositories){const row=document.createElement('div');row.className='row';const a=document.createElement('a');a.textContent=repo.full_name;a.href=repo.html_url;a.target='_blank';a.rel='noopener noreferrer';row.append(a);repos.append(row);}}
if(!repos.children.length){const p=document.createElement('p');p.textContent='No repositories are available yet. Choose repositories above, then refresh.';repos.append(p);}
}catch(e){message.textContent=e.message;message.className='error';if(e.status===401){const a=document.createElement('a');a.href='/login';a.className='button primary';a.textContent='Sign in to Clauxen';actions.replaceChildren(a);}}}
load();`,
  );
}
