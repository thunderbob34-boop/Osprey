// Usage: node render.mjs <shotlist.json> <outdir> [ids...]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import url from 'url';
const here = path.dirname(url.fileURLToPath(import.meta.url));
const [,, slPath, outDir, ...only] = process.argv;
const beats = JSON.parse(fs.readFileSync(slPath,'utf8'));
fs.mkdirSync(outDir,{recursive:true});
const b64 = o => Buffer.from(JSON.stringify(o),'utf8').toString('base64');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport:{width:1920,height:1080} });
const card = url.pathToFileURL(path.join(here,'card.html')).href;
let n=0;
for (const b of (process.env.LABELS_ONLY ? [] : beats)) {
  if (only.length && !only.includes(b.id)) continue;
  const a = b.fields && b.fields.asset;
  const hit = a && ['jpg','jpeg','png','webp'].map(e=>path.join(process.env.ASSETS || path.join(here,'..','assets'),a+'.'+e)).find(f=>fs.existsSync(f));
  const data = hit ? {...b, img: url.pathToFileURL(hit).href} : b;
  await page.goto(card + '?n=' + (n++) + '#' + b64(data));
  await page.waitForSelector('body[data-ready="1"]', {timeout:20000});
  await page.screenshot({ path: path.join(outDir, b.id + '.png') });
}
// section labels (transparent) for the animatic
const label = url.pathToFileURL(path.join(here,'label.html')).href;
const secs = [...new Map(beats.map(b=>[b.section,b.section_name])).entries()];
fs.mkdirSync(path.join(outDir,'..','labels'),{recursive:true});
for (const [num,name] of secs) {
  await page.goto(label + '?n=' + (n++) + '#' + b64({num,name}));
  await page.waitForSelector('body[data-ready="1"]');
  await page.screenshot({ path: path.join(outDir,'..','labels',num+'.png'), omitBackground:true });
}
await browser.close();
console.log('rendered');
