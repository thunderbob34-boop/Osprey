// Usage: node thumbs.mjs <episode folder>   (reads <ep>/thumbs.json {A:{...},B:{...}}, writes <ep>/thumbnails/thumb-A.png, thumb-B.png)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'path'; import url from 'url'; import fs from 'fs';
const here = path.dirname(url.fileURLToPath(import.meta.url));
const ep = path.resolve(process.argv[2]);
const spec = JSON.parse(fs.readFileSync(path.join(ep, 'thumbs.json'), 'utf8'));
const find = a => { for (const e of ['jpg','jpeg','png','webp']) { const f = path.join(ep, 'assets', `${a}.${e}`); if (fs.existsSync(f)) return url.pathToFileURL(f).href; } };
fs.mkdirSync(path.join(ep, 'thumbnails'), { recursive: true });
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport:{width:1280,height:720} });
let n = 0;
for (const [v, D] of Object.entries(spec)) {
  for (const side of ['left','right']) if (D[side]?.asset) D[side].img = find(D[side].asset);
  const h = Buffer.from(JSON.stringify(D), 'utf8').toString('base64');
  await p.goto(url.pathToFileURL(path.join(here,'thumb.html')).href + '?n=' + (n++) + '#' + h);
  await p.waitForSelector('body[data-ready="1"]');
  await p.screenshot({ path: path.join(ep, 'thumbnails', `thumb-${v}.png`) });
}
await b.close();
