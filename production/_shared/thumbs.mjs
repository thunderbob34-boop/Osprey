import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'path'; import url from 'url';
const here = path.dirname(url.fileURLToPath(import.meta.url));
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{width:1280,height:720} });
for (const v of ['A','B']) { await p.goto(url.pathToFileURL(path.join(here,'thumb.html')).href+'?v='+v+'#'+v); await p.waitForSelector('body[data-ready="1"]'); await p.screenshot({path:path.join(here,'..','thumbnails',`thumb-${v}.png`)}); }
await b.close();
