#!/usr/bin/env python3
"""Fast shot-list check, no rendering: python3 check.py <ep folder>. Partition vs script, ids, templates, scene names."""
import json, re, sys
from pathlib import Path
EP = Path(sys.argv[1]).resolve(); REPO = EP.parent.parent
meta = json.load(open(EP / 'episode.json')); beats = json.load(open(EP / 'shotlist.json'))
script = open(REPO / meta['script']).read()
parts = re.split(r'^## (\d\d) (.+)$', script, flags=re.M)
sec = {parts[i]: ' '.join(l.strip() for l in parts[i + 2].strip().split('\n') if l.strip()) for i in range(1, len(parts), 3)}
names = {parts[i]: parts[i + 1].strip() for i in range(1, len(parts), 3)}
bad = []
for s in sec:
    a = ' '.join(b['text'].strip() for b in beats if b['section'] == s).split(); c = sec[s].split()
    if a != c:
        k = next((j for j in range(min(len(a), len(c))) if a[j] != c[j]), min(len(a), len(c)))
        bad.append(f"section {s}: mismatch at word {k}: beats={' '.join(a[k:k+6])!r} script={' '.join(c[k:k+6])!r}")
ids = [b['id'] for b in beats]
if len(ids) != len(set(ids)): bad.append('duplicate ids')
OK = {'title','text','date','stat','quote','compare','datecard','flow','timeline','pinmap','archival','illustration','scene','endcard'}
SC = {'tram_run','plateway','rail_crack','calendar','pizza','letter','toilet_cistern','pipe_straight','sbend','ballcock','knossos_drain','ripple','anesthesia','herbal'}
for b in beats:
    if b['template'] not in OK: bad.append(f"{b['id']}: unknown template {b['template']}")
    if b['template'] == 'scene' and b['fields'].get('scene') not in SC: bad.append(f"{b['id']}: unknown scene {b['fields'].get('scene')}")
    if b.get('section_name') != names.get(b['section']): bad.append(f"{b['id']}: section_name should be {names.get(b['section'])!r}")
    if b['template'] == 'pinmap':
        for p in b['fields'].get('pins', []):
            if not isinstance(p.get('lat'), (int, float)) or not isinstance(p.get('lon'), (int, float)): bad.append(f"{b['id']}: pin without lat/lon")
print('\n'.join(bad) if bad else f'OK: {len(beats)} beats, partition matches the script')
sys.exit(1 if bad else 0)
