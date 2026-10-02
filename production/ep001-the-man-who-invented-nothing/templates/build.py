#!/usr/bin/env python3
"""Build the Episode 1 package from shotlist.json + vo/vo-manifest.json.

Steps: check the shot list against the script, time every beat from the real
narration durations, render graphics, build PREVIEW.mp4 (animatic) and the
Resolve timeline (.fcpxml), validate, and write SHOT-LIST.md + PENDING-ASSETS.md.

Usage: python3 templates/build.py [--base /Users/gus/.../ep001-folder] [--skip-render]
"""
import json, os, re, subprocess, sys, html
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
EP = HERE.parent
REPO = EP.parent.parent
FPS = 30
TITLE = "The Man Who Invented Nothing"

args = sys.argv[1:]
base = Path(args[args.index('--base') + 1]) if '--base' in args else EP
skip_render = '--skip-render' in args

SL = Path(os.environ.get('SHOTLIST', EP / 'shotlist.json'))
beats = json.load(open(SL))
vo = json.load(open(EP / 'vo' / 'vo-manifest.json'))
vo_by = {s['num']: s for s in vo['sections']}
problems = []

# 1. partition check: beat texts must equal the script, section by section
script = open(REPO / 'launch-episode-script.md').read()
parts = re.split(r'^## (\d\d) (.+)$', script, flags=re.M)
sec_text = {}
for i in range(1, len(parts), 3):
    sec_text[parts[i]] = ' '.join(l.strip() for l in parts[i + 2].strip().split('\n') if l.strip())
order = list(sec_text)
for s in order:
    joined = ' '.join(b['text'].strip() for b in beats if b['section'] == s)
    if joined != sec_text[s]:
        a, b2 = joined.split(), sec_text[s].split()
        k = next((j for j in range(min(len(a), len(b2))) if a[j] != b2[j]), min(len(a), len(b2)))
        problems.append(f"section {s}: beats don't match script near word {k}: beat={' '.join(a[k:k+6])!r} script={' '.join(b2[k:k+6])!r}")
ids = [b['id'] for b in beats]
if len(ids) != len(set(ids)):
    problems.append('duplicate beat ids')
if problems:
    print('\n'.join(problems)); sys.exit(1)

# 2. timing: each section's frames split by word count, from the real VO duration
t = 0
for s in order:
    sb = [b for b in beats if b['section'] == s]
    total_frames = round(vo_by[s]['duration'] * FPS)
    words = [len(b['text'].split()) for b in sb]
    W = sum(words); acc = 0; prev = 0
    for b, w in zip(sb, words):
        acc += w
        edge = round(total_frames * acc / W)
        b['frames'] = edge - prev; prev = edge
        b['start_frame'] = t; t += b['frames']
    vo_by[s]['start_frame'] = sb[0]['start_frame']; vo_by[s]['frames'] = total_frames
TOTAL = t
short = [b['id'] for b in beats if b['frames'] < 2 * FPS]

# 3. render graphics
gdir = EP / 'graphics'
if not skip_render:
    subprocess.run(['node', str(HERE / 'render.mjs'), str(SL), str(gdir)], check=True)
for b in beats:
    im = Image.open(gdir / f"{b['id']}.png")
    if im.size != (1920, 1080):
        problems.append(f"{b['id']}.png is {im.size}")

# 4. animatic frames: graphic + burned-in section label
fdir = EP / 'build' / 'frames'; fdir.mkdir(parents=True, exist_ok=True)
for b in beats:
    g = Image.open(gdir / f"{b['id']}.png").convert('RGBA')
    lab = Image.open(EP / 'labels' / f"{b['section']}.png").convert('RGBA')
    Image.alpha_composite(g, lab).convert('RGB').save(fdir / f"{b['id']}.png")
lst = EP / 'build' / 'concat.txt'
with open(lst, 'w') as f:
    for b in beats:
        f.write(f"file '{fdir / (b['id'] + '.png')}'\nduration {b['frames'] / FPS:.6f}\n")
    f.write(f"file '{fdir / (beats[-1]['id'] + '.png')}'\n")
out = EP / f'{TITLE} - PREVIEW.mp4'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(lst),
                '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
                '-vf', f'fps={FPS},format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
                '-c:a', 'aac', '-t', f'{TOTAL / FPS:.3f}', '-shortest', str(out)], check=True)
dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(out)]).decode())
if abs(dur - TOTAL / FPS) > 0.2:
    problems.append(f'animatic is {dur:.2f}s, expected {TOTAL / FPS:.2f}s')

# 5. FCPXML timeline
def ft(n): return f"{n}/{FPS}s" if n % FPS else f"{n // FPS}s"
def url(p): return 'file://' + str(p).replace(' ', '%20')
q = html.escape
res = ['<format id="r1" name="FFVideoFormat1080p30" frameDuration="1/30s" width="1920" height="1080"/>',
       '<format id="r2" name="FFVideoFormatRateUndefined" width="1920" height="1080"/>']
for b in beats:
    res.append(f'<asset id="g_{b["id"]}" name="{q(b["id"])}" start="0s" duration="0s" hasVideo="1" format="r2">'
               f'<media-rep kind="original-media" src="{url(base / "graphics" / (b["id"] + ".png"))}"/></asset>')
for s in order:
    v = vo_by[s]
    res.append(f'<asset id="vo_{s}" name="VO {s}" start="0s" duration="{ft(v["frames"])}" hasAudio="1" audioSources="1" audioChannels="1" audioRate="48000">'
               f'<media-rep kind="original-media" src="{url(base / v["file"])}"/></asset>')
spine = []
first_of = {s: next(b['id'] for b in beats if b['section'] == s) for s in order}
names = {b['section']: b['section_name'] for b in beats}
for b in beats:
    inner = ''
    if first_of[b['section']] == b['id']:
        s = b['section']
        inner = (f'<asset-clip ref="vo_{s}" lane="-1" offset="0s" start="0s" duration="{ft(vo_by[s]["frames"])}" name="VO {s}" audioRole="dialogue"/>'
                 f'<marker start="0s" duration="1/30s" value="{q(s + " " + names[s])}"/>')
    spine.append(f'<video ref="g_{b["id"]}" offset="{ft(b["start_frame"])}" name="{q(b["id"])}" start="0s" duration="{ft(b["frames"])}">{inner}</video>')
xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.10">\n<resources>\n' + '\n'.join(res) +
       f'\n</resources>\n<library>\n<event name="Somebody Did It First">\n<project name="{q(TITLE)}">\n'
       f'<sequence format="r1" duration="{ft(TOTAL)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">\n<spine>\n'
       + '\n'.join(spine) + '\n</spine>\n</sequence>\n</project>\n</event>\n</library>\n</fcpxml>\n')
fx = EP / f'{TITLE} - TIMELINE.fcpxml'
fx.write_text(xml)
r = subprocess.run(['xmllint', '--noout', '--dtdvalid', str(HERE / 'FCPXMLv1_10.dtd'), str(fx)], capture_output=True, text=True)
if r.returncode:
    problems.append('FCPXML failed DTD validation: ' + r.stderr[:800])
n_clips = xml.count('<video '); n_markers = xml.count('<marker ')
if n_clips != len(beats) or n_markers != len(order):
    problems.append(f'timeline has {n_clips} clips / {n_markers} markers, expected {len(beats)} / {len(order)}')

# 6. human-readable shot list + pending assets
def tc(n): s = n / FPS; return f"{int(s // 60)}:{s % 60:04.1f}"
md = [f'# {TITLE}: shot list', '',
      f'Total runtime {tc(TOTAL)} ({len(beats)} beats). Narration: {vo["voice"]}, {vo["engine"]}. '
      'Each beat is timed from the real narration length of its section, split by word count.', '',
      '| Beat | In | Dur | Narration (start) | On screen | Route | Source / credit |', '|---|---|---|---|---|---|---|']
for b in beats:
    src = b.get('source') or {}
    route = {'archival': 'archival (fetch)', 'illustration': 'AI illustration'}.get(b['template'], 'code graphic')
    cred = (src.get('credit') or src.get('institution') or '') + ('' if not src else (' ✅' if src.get('verified') else ' ⚠️ unconfirmed'))
    words = b['text'].split()
    md.append(f"| {b['id']} | {tc(b['start_frame'])} | {b['frames'] / FPS:.1f}s | {q(' '.join(words[:9]))}{'…' if len(words) > 9 else ''} | {q(b.get('visual', ''))} | {route} | {q(cred)} |")
(EP / 'SHOT-LIST.md').write_text('\n'.join(md) + '\n')
import os.path as _p
have = lambda a: any(_p.exists(EP / 'assets' / f'{a}.{e}') for e in ('jpg','jpeg','png','webp'))
pend = [b for b in beats if b['template'] in ('archival', 'illustration') and not have((b.get('fields') or {}).get('asset',''))]
pm = ['# Assets still to fetch', '',
      'These beats show a dark placeholder card until the real image is saved in `assets/` under the file name below (any size; it is fitted to the frame automatically, with the lower-third and credit added). Then re-run `python3 templates/build.py`. One image can serve several beats.', '',
      '| Beat | Save as | What | Institution / item | Rights | URL | Status |', '|---|---|---|---|---|---|---|']
for b in pend:
    s = b.get('source') or {}
    pm.append(f"| {b['id']} | assets/{(b.get('fields') or {}).get('asset', '')}.jpg | {q((b.get('fields') or {}).get('label', ''))} | {q(s.get('institution', ''))}: {q(s.get('item', ''))} | {q(s.get('rights', ''))} | {s.get('url', '')} | {'confirmed' if s.get('verified') else 'needs a source'} |")
(EP / 'PENDING-ASSETS.md').write_text('\n'.join(pm) + '\n')

print(f'beats={len(beats)} runtime={tc(TOTAL)} animatic={dur:.2f}s clips={n_clips} markers={n_markers} pending_assets={len(pend)}')
print('beats under 2s:', short or 'none')
print('PROBLEMS:' if problems else 'all checks passed', *problems, sep='\n')
sys.exit(1 if problems else 0)
