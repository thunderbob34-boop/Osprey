// Render every beat as an animated clip.
// Usage: node motion.mjs <timed.json> <clipdir> <posterdir> [workers] [ids...]
// timed.json: [{id, template, fields, source, frames, fps, img?}]. Writes <clipdir>/<id>.mp4 and <posterdir>/<id>.png
// (a still at 70% of the beat, used for contact sheets). Beats whose data and template haven't changed are skipped.
const { chromium } = await import(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
import fs from 'fs'; import path from 'path'; import url from 'url'; import crypto from 'crypto'; import { spawn } from 'child_process';
const here = path.dirname(url.fileURLToPath(import.meta.url));
const [,, timedPath, clipDir, posterDir, workersArg, ...only] = process.argv;
const beats = JSON.parse(fs.readFileSync(timedPath, 'utf8'));
fs.mkdirSync(clipDir, { recursive: true }); fs.mkdirSync(posterDir, { recursive: true });
const tplSrc = fs.readFileSync(path.join(here, 'motion.html'), 'utf8');
const tplHash = (tplSrc.match(/<!-- engine: (\w+)/) || [])[1] || crypto.createHash('md5').update(tplSrc).digest('hex');
const card = url.pathToFileURL(path.join(here, 'motion.html')).href;
const todo = beats.filter(b => {
  if (only.length && !only.includes(b.id)) return false;
  const key = crypto.createHash('md5').update(tplHash + JSON.stringify(b)).digest('hex');
  b._key = key;
  const kf = path.join(clipDir, b.id + '.key');
  return !(fs.existsSync(kf) && fs.readFileSync(kf, 'utf8') === key && fs.existsSync(path.join(clipDir, b.id + '.mp4')));
});
console.log(`clips to render: ${todo.length} of ${beats.length}`);
const browser = await chromium.launch({ ...(process.env.CHROME_PATH === 'default' ? {} : { executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }), args: ['--allow-file-access-from-files'] });
let n = 0, done = 0;
async function worker() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const cdp = await page.context().newCDPSession(page);
  while (todo.length) {
    const b = todo.shift(); const fps = b.fps || 30; const N = b.frames;
    const data = { ...b, dur: N / fps }; delete data._key;
    await page.goto(card + '?n=' + (n++) + '#' + Buffer.from(JSON.stringify(data), 'utf8').toString('base64'));
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
    const out = path.join(clipDir, b.id + '.mp4');
    if (b.static) {   // one still, held for the beat (placeholder for a beat finished elsewhere)
      await page.evaluate(s => window.drawAt(s), (N * 0.7) / fps);
      const png = path.join(posterDir, b.id + '.png'); await page.screenshot({ path: png });
      await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', String(fps), '-i', png, '-frames:v', String(N),
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p', out]).on('close', c => c ? rej(new Error('ffmpeg failed ' + b.id)) : res()));
      fs.writeFileSync(path.join(clipDir, b.id + '.key'), b._key); done++; continue;
    }
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(fps), out]);
    const posterAt = Math.floor(N * 0.7);
    for (let i = 0; i < N; i++) {
      await page.evaluate(s => window.drawAt(s), i / fps);
      const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 });
      const buf = Buffer.from(r.data, 'base64');
      if (!ff.stdin.write(buf)) await new Promise(res => ff.stdin.once('drain', res));
      if (i === posterAt) { const p = await cdp.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(posterDir, b.id + '.png'), Buffer.from(p.data, 'base64')); }
    }
    ff.stdin.end(); await new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg failed ' + b.id)) : res()));
    fs.writeFileSync(path.join(clipDir, b.id + '.key'), b._key);
    done++; if (done % 10 === 0) console.log(`  ${done} clips done`);
  }
  await page.close();
}
await Promise.all(Array.from({ length: +(workersArg || 3) }, worker));
await browser.close();
console.log('rendered');
