"""Deploy only the GitHub integration. Credentials stay in ignored local files/stdin."""
import json, os, subprocess
from pathlib import Path
from dotenv import dotenv_values
root=Path(__file__).resolve().parents[2]
os.chdir(root)
values=dotenv_values(root/'.env.local')
env=dict(os.environ)
if values.get('CLOUDFLARE_API_TOKEN'):
    env['CLOUDFLARE_API_TOKEN']=values['CLOUDFLARE_API_TOKEN'].strip()
command=['./node_modules/.bin/wrangler']
config=['--config','workers/github-agent/wrangler.jsonc']
deploy_config=root/'workers/github-agent/.deploy-config.json'
configuration=json.loads((root/'workers/github-agent/wrangler.jsonc').read_text())
configuration.pop('routes',None)
deploy_config.write_text(json.dumps(configuration))
try:
    subprocess.run(command+['deploy','--config',str(deploy_config)],env=env,check=True)
finally:
    deploy_config.unlink(missing_ok=True)
secrets=dotenv_values(root/'workers/github-agent/.dev.vars')
subprocess.run(command+['secret','bulk']+config,input=json.dumps(secrets),text=True,env=env,check=True)
