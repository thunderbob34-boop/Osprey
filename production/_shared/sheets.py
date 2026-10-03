#!/usr/bin/env python3
"""Contact sheets for review: python3 sheets.py <ep folder> <out prefix>. 24 frames per sheet, beat id top right."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ep = Path(sys.argv[1]); out = sys.argv[2]
beats = json.load(open(ep / 'shotlist.json'))
f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
W, H, C, R = 480, 270, 4, 6
for k in range(0, len(beats), C * R):
    S = Image.new('RGB', (C * W + (C + 1) * 8, R * H + (R + 1) * 8), '#666')
    for j, b in enumerate(beats[k:k + C * R]):
        im = Image.open(ep / 'graphics' / f"{b['id']}.png").convert('RGB').resize((W, H))
        d = ImageDraw.Draw(im); tw = d.textlength(b['id'], font=f)
        d.rectangle([W - tw - 14, 0, W, 30], fill='#FFE14D'); d.text((W - tw - 7, 3), b['id'], fill='black', font=f)
        S.paste(im, (8 + (j % C) * (W + 8), 8 + (j // C) * (H + 8)))
    p = f'{out}-{k // (C * R) + 1}.png'; S.save(p); print(p)
