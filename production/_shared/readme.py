#!/usr/bin/env python3
"""Write <ep>/README.md from the built package. Usage: python3 readme.py <ep folder>  (episode-specific notes come from <ep>/episode.json "notes")."""
import json, re, sys, os
from pathlib import Path
from collections import Counter
EP = Path(sys.argv[1]).resolve(); REPO = EP.parent.parent
meta = json.load(open(EP / 'episode.json')); beats = json.load(open(EP / 'shotlist.json'))
vo = json.load(open(EP / 'vo' / 'vo-manifest.json'))
script = open(REPO / meta['script']).read(); TITLE = re.search(r'^# (.+)$', script, re.M).group(1)
secs = re.findall(r'^## (\d\d) (.+)$', script, re.M)
words = sum(len(b['text'].split()) for b in beats)
dur = sum(s['duration'] for s in vo['sections']); rt = f"{int(dur // 60)}:{round(dur % 60):02d}"
have = lambda a: any((EP / 'assets' / f'{a}.{e}').exists() for e in ('jpg', 'jpeg', 'png', 'webp'))
arch = [b for b in beats if b['template'] in ('archival', 'illustration')]
pend = [b for b in arch if not have(b['fields'].get('asset', ''))]
items = {}
for b in arch: items.setdefault(b['fields'].get('asset', ''), b)
ver = [a for a, b in items.items() if (b.get('source') or {}).get('verified')]
ver_beats = sum(1 for b in arch if (b.get('source') or {}).get('verified'))
code = len(beats) - len(arch)
C = Counter(b['template'] for b in beats)
n = meta.get('notes', {})
L = [f'# Episode {meta["num"]}: "{TITLE}"', '', 'Built 2026-10-03 with the shared production kit in `production/_shared/` (same system as the Episode 1 pilot).', '',
     "## What's in this folder", '', '| File | What it is |', '|---|---|',
     f'| `{TITLE} - PREVIEW.mp4` | The animatic: every visual in order at its real timing ({rt}), with the section name in the corner. It has no sound (see Narration). Watch this to approve the cut. |',
     f'| `{TITLE} - TIMELINE.fcpxml` | The Resolve timeline: {len(beats)} stills on the video track, the narration on a dialogue track, and a marker at each of the {len(secs)} sections. It validates against Apple\'s FCPXML 1.10 DTD. |',
     '| `SHOT-LIST.md` / `shotlist.json` | One row per beat: start time, duration, the words being spoken, what\'s on screen, and the source and credit. |',
     f'| `PENDING-ASSETS.md` | The {len(pend)} archival beats still showing a placeholder card, with the file name to save each image under. |',
     f'| `graphics/` | Every frame at 1920×1080: {code} finished code graphics plus {len(pend)} placeholders. |',
     '| `thumbnails/` | Two A/B thumbnail layouts (`thumbs.json` drives them; the portrait boxes fill in automatically once `assets/thumb-left.jpg` and `thumb-right.jpg` exist). |',
     '| `vo/vo-manifest.json` | The narration: Holden on Seed Speech, one file per section, with its exact length and Higgsfield link. |', '',
     '## How it was built and checked', '',
     f'1. **Narration first.** Holden read each section in Higgsfield ({words} words). The real audio lengths set the timing of every beat.' + (f' {n["vo"]}' if n.get('vo') else ''),
     f'2. **Shot list.** It has {len(beats)} beats, about one new visual every {dur / len(beats):.0f} seconds. The beat texts match the script word for word, which the build checks every time.',
     '3. **Graphics.** These are code-built in the channel\'s archive-paper style: ' + ', '.join(f'{v} {k}' for k, v in C.most_common()) + '. Maps use Natural Earth coastlines. Nothing is AI-generated.',
     '4. **Blind review.** A reviewer with no context checked the cut for places where a viewer gets lost or bored, where the picture doesn\'t match the words, and where on-screen text overstates the narration or drops a hedge. ' + n.get('review', ''),
     f'5. **Mechanical checks** run on every build: every frame is 1920×1080; the animatic length equals the narration length; the timeline has {len(beats)} clips and {len(secs)} markers; the timeline passes DTD validation.', '',
     '## What\'s left before it can be uploaded', '',
     f'1. **Archival images ({len(pend)} beats, from {len(items)} distinct items).** Rights are stated for {len(ver)} items, covering {ver_beats} beats. The others need their rights checked on the item page. `PENDING-ASSETS.md` lists each one.',
     '   - The cloud workspace\'s network blocks the museum and library sites, so these couldn\'t be downloaded here. You can allow those hosts and I\'ll fetch them, or save each image in `assets/` under the name in `PENDING-ASSETS.md`.',
     f'   - Then run `python3 production/_shared/build.py --ep production/{EP.name}`. Each image is fitted to the frame automatically, with its lower-third and credit.']
for g in n.get('gaps', []): L.append(f'   - {g}')
L += ['2. **Narration files.** The section MP3s are in your Higgsfield library, and the links are in `vo/vo-manifest.json`. Put them in `vo/` under the names in the manifest; the timeline already points to them.',
      '3. **Resolve.** File > Import > Timeline and pick the `.fcpxml`. If the media shows offline, use Relink Media and point it at this folder.',
      '4. **Upload checklist.** Mark "altered or synthetic content: Yes", because the voice is synthetic. Credit every archival image in the description. Pick a thumbnail.']
for k, x in enumerate(n.get('preair', []), 5): L.append(f'{k}. **Before this airs:** {x}')
L += ['', '## Cost', '', f'- **Higgsfield:** {n.get("credits", "?")} credits, all narration. No images or video clips were needed.', '']
(EP / 'README.md').write_text('\n'.join(L)); print(EP / 'README.md')
