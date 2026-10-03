#!/usr/bin/env python3
"""Build one episode package from <ep>/shotlist.json + <ep>/vo/vo-manifest.json + <ep>/episode.json.

Steps: check the shot list against the script, time every beat from the real
narration durations, render graphics, build PREVIEW.mp4 (animatic) and the
Resolve timeline (.fcpxml), validate, and write SHOT-LIST.md + PENDING-ASSETS.md.

Usage: python3 production/_shared/build.py --ep production/ep00X-... [--base /Users/gus/.../ep-folder] [--skip-render]
"""
import json, os, re, subprocess, sys, html
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
args = sys.argv[1:]
EP = Path(args[args.index('--ep') + 1]).resolve() if '--ep' in args else HERE.parent
REPO = HERE.parent.parent
FPS = 30

base = Path(args[args.index('--base') + 1]) if '--base' in args else EP
skip_render = '--skip-render' in args

SL = Path(os.environ.get('SHOTLIST', EP / 'shotlist.json'))
beats = json.load(open(SL))
vo = json.load(open(EP / 'vo' / 'vo-manifest.json'))
vo_by = {s['num']: s for s in vo['sections']}
problems = []

# 1. partition check: beat texts must equal the script, section by section
meta = json.load(open(EP / 'episode.json'))
script = open(REPO / meta['script']).read()
TITLE = re.search(r'^# (.+)$', script, re.M).group(1).strip()
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

# 3. render: every beat becomes an animated clip (clips/<id>.mp4) plus a poster still (graphics/<id>.png)
gdir = EP / 'graphics'; cdir = EP / 'clips'
def asset_path(b):
    a = (b.get('fields') or {}).get('asset')
    for e in ('jpg', 'jpeg', 'png', 'webp'):
        if a and (EP / 'assets' / f'{a}.{e}').exists(): return (EP / 'assets' / f'{a}.{e}').as_uri()
TB = meta.get('timebar'); prev_year = None; timed = []
for b in beats:
    tb = None
    if TB:
        year = b.get('year', prev_year)
        tb = {**TB, 'from': prev_year if prev_year is not None else year, 'to': year}; prev_year = year
        if b.get('year_label'): tb['label'] = b['year_label']   # hedged marker text, e.g. 'late 1800s'
    timed.append({'id': b['id'], 'template': b['template'], 'fields': b.get('fields') or {}, 'source': b.get('source') or {},
                  'frames': b['frames'], 'fps': FPS, **({'timebar': tb} if tb else {}), **({'img': asset_path(b)} if asset_path(b) else {})})
(EP / 'build').mkdir(exist_ok=True)
IMK = set(json.load(open(EP / 'images.json'))) if (EP / 'images.json').exists() else set()
# Photo beats that the sandbox re-renders with the real image only need a still placeholder here.
local = [{**t, 'static': True} if (t['template'] == 'archival' and t['fields'].get('asset') in IMK) else t for t in timed]
(EP / 'build' / 'timed.json').write_text(json.dumps(local))
if (EP / 'images.json').exists():   # photo beats are finished in the Higgsfield sandbox, which can reach the image hosts
    IM = json.load(open(EP / 'images.json'))
    rb = [{**t, 'start_frame': b['start_frame']} for t, b in zip(timed, beats) if t['template'] == 'archival' and (t['fields'].get('asset') in IM)]
    (EP / 'remote-beats.json').write_text(json.dumps({'images': {k: IM[k] for k in {r['fields']['asset'] for r in rb}}, 'beats': rb, 'fps': FPS, 'total_frames': TOTAL}, indent=0))
if not skip_render:
    subprocess.run(['node', str(HERE / 'motion.mjs'), str(EP / 'build' / 'timed.json'), str(cdir), str(gdir), os.environ.get('WORKERS', '3')], check=True)
    subprocess.run(['node', str(HERE / 'render.mjs'), str(SL), str(gdir)], check=True, env={**os.environ, 'LABELS_ONLY': '1'})
ids = {b['id'] for b in beats}
for d, ext in ((gdir, '.png'), (cdir, '.mp4'), (cdir, '.key')):
    for p in d.glob('*' + ext):
        if p.stem not in ids: p.unlink()
for b in beats:
    im = Image.open(gdir / f"{b['id']}.png")
    if im.size != (1920, 1080):
        problems.append(f"{b['id']}.png is {im.size}")
    fr = int(subprocess.check_output(['ffprobe', '-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', str(cdir / f"{b['id']}.mp4")]).decode().strip().rstrip(','))
    if fr != b['frames']:
        problems.append(f"{b['id']}.mp4 has {fr} frames, expected {b['frames']}")

# 4. animatic: clips in order, section label burned in, narration if the MP3s are in vo/
lst = EP / 'build' / 'concat.txt'
lst.write_text(''.join(f"file '{cdir / (b['id'] + '.mp4')}'\n" for b in beats))
joined = EP / 'build' / 'joined.mp4'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(joined)], check=True)
picture = EP / f'{TITLE} - PICTURE.mp4'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(joined), '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-pix_fmt', 'yuv420p', '-r', str(FPS), str(picture)], check=True)
inputs = ['-i', str(joined)]; filt = []; last = '0:v'
for k, s_ in enumerate(order):
    v = vo_by[s_]; a0 = v['start_frame'] / FPS; a1 = (v['start_frame'] + v['frames']) / FPS
    inputs += ['-i', str(EP / 'labels' / f'{s_}.png')]
    filt.append(f"[{last}][{k + 1}:v]overlay=0:0:enable='between(t,{a0:.3f},{a1 - 0.001:.3f})'[v{k}]"); last = f'v{k}'
have_vo = all((EP / v['file']).exists() for v in vo['sections'])
if have_vo:
    for v in vo['sections']: inputs += ['-i', str(EP / v['file'])]
    na = len(order) + 1
    filt.append(''.join(f'[{na + i}:a]' for i in range(len(order))) + f'concat=n={len(order)}:v=0:a=1[aud]')
    amap = ['-map', '[aud]']
else:
    inputs += ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']; amap = ['-map', f'{len(order) + 1}:a']
out = EP / f'{TITLE} - PREVIEW.mp4'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filt), '-map', f'[{last}]', *amap,
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-t', f'{TOTAL / FPS:.3f}', str(out)], check=True)
dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(out)]).decode())
if abs(dur - TOTAL / FPS) > 0.2:
    problems.append(f'animatic is {dur:.2f}s, expected {TOTAL / FPS:.2f}s')

# 5. FCPXML timeline
def ft(n): return f"{n}/{FPS}s" if n % FPS else f"{n // FPS}s"
def url(p): return 'file://' + str(p).replace(' ', '%20')
q = html.escape
res = ['<format id="r1" name="FFVideoFormat1080p30" frameDuration="1/30s" width="1920" height="1080"/>',
       '<format id="r2" name="FFVideoFormatRateUndefined" width="1920" height="1080"/>']
res.append(f'<asset id="pic" name="{q(TITLE)} - PICTURE" start="0s" duration="{ft(TOTAL)}" hasVideo="1" format="r1" videoSources="1">'
           f'<media-rep kind="original-media" src="{url(base / (TITLE + " - PICTURE.mp4"))}"/></asset>')
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
        inner = (f'<asset-clip ref="vo_{s}" lane="-1" offset="{ft(b["start_frame"])}" start="0s" duration="{ft(vo_by[s]["frames"])}" name="VO {s}" audioRole="dialogue"/>'
                 f'<marker start="{ft(b["start_frame"])}" duration="1/30s" value="{q(s + " " + names[s])}"/>')
    spine.append(f'<asset-clip ref="pic" offset="{ft(b["start_frame"])}" name="{q(b["id"])}" start="{ft(b["start_frame"])}" duration="{ft(b["frames"])}">{inner}</asset-clip>')
xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.10">\n<resources>\n' + '\n'.join(res) +
       f'\n</resources>\n<library>\n<event name="Somebody Did It First">\n<project name="{q(TITLE)}">\n'
       f'<sequence format="r1" duration="{ft(TOTAL)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">\n<spine>\n'
       + '\n'.join(spine) + '\n</spine>\n</sequence>\n</project>\n</event>\n</library>\n</fcpxml>\n')
fx = EP / f'{TITLE} - TIMELINE.fcpxml'
fx.write_text(xml)
r = subprocess.run(['xmllint', '--noout', '--dtdvalid', str(HERE / 'FCPXMLv1_10.dtd'), str(fx)], capture_output=True, text=True)
if r.returncode:
    problems.append('FCPXML failed DTD validation: ' + r.stderr[:800])
n_clips = xml.count('<asset-clip ref="pic"'); n_markers = xml.count('<marker ')
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
    route = {'archival': 'archival (fetch)', 'illustration': 'AI illustration', 'scene': 'illustrated scene (code)', 'pinmap': 'animated map'}.get(b['template'], 'motion graphic')
    cred = (src.get('credit') or src.get('institution') or '') + ('' if not src else (' ✅' if src.get('verified') else ' ⚠️ unconfirmed'))
    words = b['text'].split()
    md.append(f"| {b['id']} | {tc(b['start_frame'])} | {b['frames'] / FPS:.1f}s | {q(' '.join(words[:9]))}{'…' if len(words) > 9 else ''} | {q(b.get('visual', ''))} | {route} | {q(cred)} |")
(EP / 'SHOT-LIST.md').write_text('\n'.join(md) + '\n')
import os.path as _p
have = lambda a: any(_p.exists(EP / 'assets' / f'{a}.{e}') for e in ('jpg','jpeg','png','webp'))
pend = [b for b in beats if b['template'] in ('archival', 'illustration') and not have((b.get('fields') or {}).get('asset',''))]
pm = ['# Assets still to fetch', '',
      'These beats show a dark placeholder card until the real image is saved in `assets/` under the file name below (any size; it is fitted to the frame automatically, with the lower-third and credit added). Then re-run `python3 production/_shared/build.py --ep <this folder>`. One image can serve several beats.', '',
      '| Beat | Save as | What | Institution / item | Rights | URL | Status |', '|---|---|---|---|---|---|---|']
for b in pend:
    s = b.get('source') or {}
    pm.append(f"| {b['id']} | assets/{(b.get('fields') or {}).get('asset', '')}.jpg | {q((b.get('fields') or {}).get('label', ''))} | {q(s.get('institution', ''))}: {q(s.get('item', ''))} | {q(s.get('rights', ''))} | {s.get('url', '')} | {'confirmed' if s.get('verified') else 'needs a source'} |")
(EP / 'PENDING-ASSETS.md').write_text('\n'.join(pm) + '\n')

print(f'beats={len(beats)} runtime={tc(TOTAL)} animatic={dur:.2f}s clips={n_clips} markers={n_markers} pending_assets={len(pend)}')
print('beats under 2s:', short or 'none')
print('PROBLEMS:' if problems else 'all checks passed', *problems, sep='\n')
sys.exit(1 if problems else 0)
