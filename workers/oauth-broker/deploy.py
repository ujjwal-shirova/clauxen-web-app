"""Upload one auth Worker without publishing unrelated application changes or routes."""
import argparse
import json
import os
import subprocess
from pathlib import Path
from dotenv import dotenv_values

parser = argparse.ArgumentParser()
parser.add_argument("worker", choices=["oauth-broker", "supabase-proxy", "native-auth"])
parser.add_argument("--secrets", action="store_true", help="Upload that Worker's ignored .dev.vars through stdin")
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
os.chdir(root)
env = dict(os.environ)
token = dotenv_values(root / ".env.local").get("CLOUDFLARE_API_TOKEN")
if token:
    env["CLOUDFLARE_API_TOKEN"] = token.strip()
config = root / "workers" / args.worker / "wrangler.jsonc"
temporary = config.parent / ".deploy-config.json"
data = json.loads(config.read_text())
data.pop("routes", None)
temporary.write_text(json.dumps(data))
try:
    subprocess.run(["./node_modules/.bin/wrangler", "deploy", "--config", str(temporary)], env=env, check=True)
finally:
    temporary.unlink(missing_ok=True)
if args.secrets:
    values = dotenv_values(config.parent / ".dev.vars")
    if not values or not all(values.values()):
        raise RuntimeError("Expected configured ignored .dev.vars")
    subprocess.run(["./node_modules/.bin/wrangler", "secret", "bulk", "--config", str(config)], input=json.dumps(values), text=True, env=env, check=True)
