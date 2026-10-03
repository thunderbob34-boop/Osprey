#!/bin/bash
# Runs INSIDE the Higgsfield sandbox (it can reach the image hosts and the narration CDN; this workspace can't).
# Usage: EP=<episode folder> TITLE_ENC=<url-encoded title> PUT=<presigned upload url> bash finish-in-sandbox.sh
set -e
# Images are fetched at 1920px, one of Wikimedia's standard thumbnail sizes (other sizes get throttled).
# Re-runs reuse fin/ep/assets and fin/clips (clips whose data is unchanged are skipped). Delete fin/ for a clean run.
R="https://raw.githubusercontent.com/thunderbob34-boop/osprey/research/somebody-did-it-first/production"
D="${FIN:-fin}"; mkdir -p "$D/_shared" "$D/ep/assets" "$D/ep/vo" && cd "$D"
for f in motion.html motion.mjs; do curl -sfL "$R/_shared/$f" -o _shared/$f; done
curl -sfL "$R/$EP/remote-beats.json" -o rb.json
curl -sfL "$R/$EP/vo/vo-manifest.json" -o vo.json
curl -sfL "$R/$EP/${TITLE_ENC}%20-%20PICTURE.mp4" -o picture.mp4
python3 - <<'PY'
import json,subprocess,os,time
rb=json.load(open('rb.json'))
for k,v in rb['images'].items():
    out=f'ep/assets/{k}.jpg'
    if os.path.exists(out) and os.path.getsize(out)>10000: continue   # already fetched (Wikimedia rate-limits repeat fetches)
    subprocess.run(['curl','-sfL','--retry','3','--retry-delay','20','--retry-max-time','120','-A','SomebodyDidItFirstBot/0.1 (https://github.com/thunderbob34-boop/osprey; history research)','-o',out,(v['url'].split('?')[0] if v.get('w',9999)<=1920 else v['url'].replace('width=2400','width=1920'))],check=True); time.sleep(1)
    subprocess.run(['ffmpeg','-loglevel','error','-y','-i',out,'-vf','scale=min(2400\\,iw):-2',out+'.tmp.jpg'],check=True); os.replace(out+'.tmp.jpg',out)
beats=[]
for b in rb['beats']:
    b=dict(b); sf=b.pop('start_frame'); b['img']='file://'+os.path.abspath(f"ep/assets/{b['fields']['asset']}.jpg"); b['source']={**b.get('source',{}),'credit':rb['images'][b['fields']['asset']]['credit']}; beats.append(b)
json.dump(beats,open('timed.json','w'))
m=json.load(open('vo.json')); L=[]
for i,s in enumerate(m['sections']):
    f=f'ep/vo/s{i:02d}.mp3'; subprocess.run(['curl','-sfL','-o',f,s['url']],check=True); L.append(f"file '{f}'")
open('vo.txt','w').write('\n'.join(L)+'\n')
print('images',len(rb['images']),'photo beats',len(beats))
PY
PW_MODULE="$(npm root -g)/playwright/index.mjs" CHROME_PATH=default node _shared/motion.mjs timed.json clips posters ${WORKERS:-6} | tail -1
python3 - <<'PY'
import json,subprocess
rb=json.load(open('rb.json')); fps=rb['fps']
inp=['-i','picture.mp4']; fc=[]; last='0:v'
for i,b in enumerate(rb['beats']):
    s=b['start_frame']/fps; e=(b['start_frame']+b['frames'])/fps
    inp+=['-i',f"clips/{b['id']}.mp4"]
    fc.append(f"[{i+1}:v]setpts=PTS-STARTPTS+{s:.4f}/TB[c{i}]"); fc.append(f"[{last}][c{i}]overlay=0:0:enable='between(t,{s:.4f},{e-0.001:.4f})':eof_action=pass[v{i}]"); last=f'v{i}'
subprocess.run(['ffmpeg','-loglevel','error','-y',*inp,'-f','concat','-safe','0','-i','vo.txt','-filter_complex',';'.join(fc),'-map',f'[{last}]','-map',f"{len(rb['beats'])+1}:a",
  '-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart','final.mp4'],check=True)
PY
echo "final $(ffprobe -v error -show_entries format=duration -of csv=p=0 final.mp4) $(stat -c %s final.mp4)"
curl -sf -o /dev/null -w "put %{http_code}\n" -X PUT -H "Content-Type: video/mp4" --upload-file final.mp4 "$PUT"
