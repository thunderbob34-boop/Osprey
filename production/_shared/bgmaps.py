#!/usr/bin/env python3
"""Give every text-style card a faint drifting map of where that section happens.
Usage: python3 bgmaps.py <ep folder> '<json: {"01": [lat, lon, span], ...}>'  (sections not listed are left alone)"""
import json, sys
from pathlib import Path
EP = Path(sys.argv[1]); cfg = json.loads(sys.argv[2])
TEXTISH = {'text', 'date', 'stat', 'quote', 'compare', 'datecard', 'flow', 'timeline'}
p = EP / 'shotlist.json'; B = json.load(open(p)); n = 0
for b in B:
    c = cfg.get(b['section'])
    if c and b['template'] in TEXTISH and 'bgmap' not in b['fields']:
        b['fields']['bgmap'] = {'lat': c[0], 'lon': c[1], 'span': c[2]}; n += 1
json.dump(B, open(p, 'w'), indent=1, ensure_ascii=False); print(f'{n} cards given a map backdrop')
