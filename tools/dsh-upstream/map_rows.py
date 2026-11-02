import re, json, os, sys, glob, subprocess
root = sys.argv[1]
# package name -> folder
pk = {}
out = subprocess.run(['git','-C',root,'ls-files','*package.json'],capture_output=True,text=True).stdout.split()
for f in out:
    if 'node_modules' in f or '/fixtures/' in f or '/tests/' in f: continue
    try: n = json.load(open(os.path.join(root,f))).get('name')
    except Exception: continue
    if n: pk.setdefault(n, os.path.dirname(f))
# row id -> (name, layer)
rows = {}
layers = [root+'/packages/bundle/base/cordis.patch.yml', root+'/packages/bundle/web-app/cordis.patch.yml'] + sorted(glob.glob(root+'/packages/bundle/web-app/presets/*.patch.yml')) + sorted(glob.glob(root+'/deepwidgets/*/cordis.patch.yml'))
for L in layers:
    cur=None
    for line in open(L):
        m = re.match(r"\s*-\s*id:\s*['\"]?([\w@/.-]+)", line)
        if m: cur=m.group(1); continue
        m = re.match(r"\s*name:\s*['\"]?([\w@/.-]+)", line)
        if m and cur:
            rows.setdefault(cur, []).append((m.group(1), os.path.relpath(L,root))); cur=None
def folder(name):
    if name in pk: return pk[name]
    base = '/'.join(name.split('/')[:2]) if name.startswith('@') else name.split('/')[0]
    return pk.get(base,'?')+ ('  (subpath '+name[len(base):]+')' if base!=name else '')
for kind in ['host','client']:
    for line in open(f'{root}/deepwidgets/trim/rows.{kind}.txt'):
        line=line.split('#')[0].strip()
        if not line: continue
        key=line.split()[0]
        if kind=='host':
            r = rows.get(key)
            if r: name,layer=r[-1]; print(f"host\t{key}\t{name}\t{folder(name)}\t{layer}\t{'pending' if 'pending' in line else 'loaded'}")
            else: print(f"host\t{key}\t?\t?\t?")
        else:
            print(f"client\t{key}\t{key}\t{folder(key)}\t-\tloaded")
