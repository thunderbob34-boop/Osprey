#!/bin/bash
# Runs INSIDE the Higgsfield sandbox. Renders one still (at 70%) of every photo beat with the real image, and prints a
# small labelled contact sheet as base64 so the framing can be checked from a workspace that can't reach the image hosts.
# Usage: EP=<episode folder> bash framecheck-in-sandbox.sh [cols] [thumb width]
set -e
R="https://raw.githubusercontent.com/thunderbob34-boop/osprey/research/somebody-did-it-first/production"
rm -rf fc && mkdir -p fc/_shared fc/assets fc/st && cd fc
curl -sfL "$R/_shared/motion.html" -o _shared/motion.html
curl -sfL "$R/$EP/remote-beats.json" -o rb.json
python3 - <<'PY'
import json,subprocess,os
rb=json.load(open('rb.json'))
for k,v in rb['images'].items():
    out=f'assets/{k}.jpg'
    if not os.path.exists(out):
        subprocess.run(['curl','-sfL','-A','SomebodyDidItFirstBot/0.1 (research)','-o',out,v['url'].replace('width=2400','width=1600')],check=True)
PY
cat > shot.mjs <<'JS'
const { chromium } = await import(process.env.PW);
import fs from 'fs'; import path from 'path';
const rb = JSON.parse(fs.readFileSync('rb.json','utf8'));
const b = await chromium.launch({ args:['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport:{ width:1920, height:1080 } });
const card = 'file://' + path.resolve('_shared/motion.html');
let n=0;
for (const x of rb.beats) {
  const d = { ...x, dur: x.frames/(x.fps||30), img: 'file://'+path.resolve(`assets/${x.fields.asset}.jpg`) }; delete d.start_frame;
  await p.goto(card+'?n='+(n++)+'#'+Buffer.from(JSON.stringify(d),'utf8').toString('base64'));
  await p.waitForSelector('body[data-ready="1"]',{timeout:30000});
  await p.evaluate(s=>window.drawAt(s), d.dur*0.7);
  await p.screenshot({ path:`st/${x.id}.jpg`, type:'jpeg', quality:70 });
}
await b.close();
JS
PW="$(npm root -g)/playwright/index.mjs" node shot.mjs
python3 - "$@" <<'PY'
import sys,glob,base64,io
from PIL import Image,ImageDraw
cols=int(sys.argv[1]) if len(sys.argv)>1 else 6; tw=int(sys.argv[2]) if len(sys.argv)>2 else 300; th=tw*9//16
fs=sorted(glob.glob('st/*.jpg')); rows=(len(fs)+cols-1)//cols
S=Image.new('RGB',(cols*tw,rows*th),'white'); d=ImageDraw.Draw(S)
for i,f in enumerate(fs):
    im=Image.open(f).resize((tw,th)); x,y=(i%cols)*tw,(i//cols)*th; S.paste(im,(x,y)); d.rectangle([x,y,x+46,y+14],fill='black'); d.text((x+2,y+1),f[3:-4],fill='yellow')
b=io.BytesIO(); S.save(b,'JPEG',quality=55); open('sheet.jpg','wb').write(b.getvalue())
print('SHEET', len(fs), S.size, len(b.getvalue()))
PY
