"""Package an explicit public allowlist; private demos and film footage are excluded."""
from pathlib import Path
import zipfile,json,hashlib
root=Path(__file__).resolve().parents[1]
files=['LICENSE','README.md','TESTING.md','FLOW-QA.md','PRODUCT.md','DESIGN.md','package.json','package-lock.json','rust-toolchain.toml','contracts/Cargo.toml','contracts/Cargo.lock','web/package.json','web/tsconfig.json','web/index.html','vercel.json']
for folder in ['contracts/src','sdk','web/src','deployments']:
 files += [str(p.relative_to(root)) for p in (root/folder).rglob('*') if p.is_file()]
files += ['web/public/'+n for n in ['commissioner.ttf','commissioner-OFL.txt','shield.svg','wallet.wasm','live.json']]
manifest=[]
with zipfile.ZipFile(root/'web/public/magen-source.zip','w',zipfile.ZIP_DEFLATED) as z:
 for name in sorted(set(files)):
  p=root/name
  assert p.is_file(),name
  assert '.demo' not in p.parts and '.env' not in name and '.loom' not in p.parts
  data=p.read_bytes();z.writestr('magen/'+name,data)
  manifest.append({'path':name,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
 z.writestr('magen/SOURCE-MANIFEST.json',json.dumps(manifest,indent=2))
print('Public source archive:',len(manifest),'allowlisted files')
