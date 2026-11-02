"""List upstream PRs (first-parent commits) in a range that touch watched folders.
Usage: python3 -I upstream_changes.py <upstream-clone> <base> <head> <watched.txt> <fork-ref> > out.tsv
Columns: sha date pr kind packages conflict_files subject"""
import subprocess, sys, re
repo, base, head, watched, fork = sys.argv[1:6]
def g(*a): return subprocess.run(['git','-C',repo,*a],capture_output=True,text=True).stdout
W=[l.strip() for l in open(watched) if l.strip() and not l.startswith('#')]
forkchanged=set(g('diff','--name-only',base,fork).split())
def kind(s, body):
    s2=s.lower()
    if 'breaking change' in body.lower() or re.match(r'^\w+(\(.+\))?!:',s): return 'breaking?'
    m=re.match(r'^(\w+)(\(.+?\))?:',s)
    t=m.group(1) if m else ''
    if not t:
        b=re.search(r'from [\w-]+/([\w-]+)/',s)
        t=b.group(1) if b else ''
    return {'fix':'fix','feat':'feature','refactor':'refactor','perf':'perf','chore':'chore','docs':'docs','ci':'ci','test':'test','release':'release','revert':'revert','design':'feature','cleanup':'refactor','worktree':'?','turtle':'fix?','xtr':'?'}.get(t,t or '?')
for line in g('log','--first-parent','--format=%H%x09%cI%x09%s',f'{base}..{head}').splitlines():
    sha,date,subj=line.split('\t',2)
    body=g('log','-1','--format=%b',sha)
    title=subj
    if subj.startswith('Merge pull request'):
        t=body.strip().splitlines()
        if t: title=t[0]
    pr=(re.search(r'#(\d+)',subj) or re.search(r'#(\d+)',body))
    files=g('diff','--name-only',sha+'^1',sha).split()
    pk=sorted({w for w in W for f in files if f==w or f.startswith(w+'/')})
    if not pk: continue
    cf=sorted(f for f in files if f in forkchanged)
    print('\t'.join([sha[:10],date[:10],pr.group(1) if pr else '',kind(title,body),','.join(pk),','.join(cf),title]))
