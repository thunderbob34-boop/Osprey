#!/usr/bin/env python3
"""Generate self-contained 1024x1024 icon-variant HTML files from the real Ozzie geometry."""
import os

OZZIE = '''
  <g>
    <path d="M40 16 Q40 7 44 3 Q46 10 48 13 Q49 4 53 1 Q54 9 56 12 Q60 5 65 6 Q62 12 61 17 Z" fill="#0D1117" stroke="#2D4A5A" stroke-width="1.5"/>
    <path d="M25 66 Q15 80 21 96 Q30 90 33 75 Z" fill="#0D1117" stroke="#2D4A5A" stroke-width="2"/>
    <path d="M75 66 Q85 80 79 96 Q70 90 67 75 Z" fill="#0D1117" stroke="#2D4A5A" stroke-width="2"/>
    <ellipse cx="50" cy="83" rx="23" ry="16" fill="#0D1117" stroke="#2D4A5A" stroke-width="2"/>
    <ellipse cx="50" cy="86" rx="14" ry="12" fill="#F5F1E8"/>
    <circle cx="43" cy="79" r="1.4" fill="#0D1117"/>
    <circle cx="48" cy="81" r="1.4" fill="#0D1117"/>
    <circle cx="53" cy="81" r="1.4" fill="#0D1117"/>
    <circle cx="57" cy="79" r="1.4" fill="#0D1117"/>
    <circle cx="50" cy="40" r="30" fill="#F5F1E8" stroke="#2D4A5A" stroke-width="2.5"/>
    <path d="M45 41 Q33 36 20 38 Q17 42 20 46 Q33 50 45 46 Z" fill="#0D1117"/>
    <path d="M55 41 Q67 36 80 38 Q83 42 80 46 Q67 50 55 46 Z" fill="#0D1117"/>
    <path d="M45 41 Q33 36 20 38" stroke="#c8793a" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.85"/>
    <path d="M55 41 Q67 36 80 38" stroke="#c8793a" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.85"/>
    <circle cx="33" cy="43" r="8.5" fill="#3BA9E0" stroke="#0D1117" stroke-width="1.5"/>
    <circle cx="67" cy="43" r="8.5" fill="#3BA9E0" stroke="#0D1117" stroke-width="1.5"/>
    <circle cx="33" cy="43" r="4" fill="#0a0a0f"/>
    <circle cx="67" cy="43" r="4" fill="#0a0a0f"/>
    <circle cx="35.5" cy="40.5" r="2.1" fill="#ffffff"/>
    <circle cx="30" cy="44" r="1" fill="#ffffff" opacity="0.8"/>
    <circle cx="69.5" cy="40.5" r="2.1" fill="#ffffff"/>
    <circle cx="64" cy="44" r="1" fill="#ffffff" opacity="0.8"/>
    <path d="M25.8 47.5 Q33 44.5 40.2 47.5 Q33 55.3 25.8 47.5 Z" fill="#0D1117"/>
    <path d="M59.8 47.5 Q67 44.5 74.2 47.5 Q67 55.3 59.8 47.5 Z" fill="#0D1117"/>
    <circle cx="30" cy="57" r="3.5" fill="#FB9BA8" opacity="0.45"/>
    <circle cx="70" cy="57" r="3.5" fill="#FB9BA8" opacity="0.45"/>
    <path d="M45 49 Q50 46.5 55 49 Q55.5 54 51.5 57.5 Q50.5 59.5 49.2 57.8 Q44.8 53.5 45 49 Z" fill="#333D4D" stroke="#1B2A3A" stroke-width="1"/>
    <path d="M47 50 Q50 48.5 53 50" stroke="#8B9AAB" stroke-width="0.9" stroke-linecap="round" fill="none" opacity="0.7"/>
    <path d="M44.5 63 Q50 67.5 55.5 63" stroke="#2D4A5A" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.85"/>
  </g>
'''

def page(defs, bg, ozzie_transform, extra=''):
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0}}html,body{{width:1024px;height:1024px;overflow:hidden}}</style></head>
<body><svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
<defs>{defs}</defs>
{bg}
{extra}
<g transform="{ozzie_transform}">{OZZIE}</g>
</svg></body></html>'''

# V1 — HALO: ink ground, soft amber radial disc behind the character, full Ozzie centered.
v1 = page(
    defs='<radialGradient id="halo" cx="50%" cy="42%" r="42%"><stop offset="0%" stop-color="#c8793a" stop-opacity="0.9"/><stop offset="55%" stop-color="#a5602c" stop-opacity="0.55"/><stop offset="100%" stop-color="#c8793a" stop-opacity="0"/></radialGradient>',
    bg='<rect width="1024" height="1024" fill="#09090B"/><circle cx="512" cy="470" r="360" fill="url(#halo)"/>',
    # Ozzie 0..100 -> centered, scaled to ~7.2x (720px), nudged up a touch
    ozzie_transform='translate(152 150) scale(7.2)',
)

# V2 — AMBER FIELD: warm amber gradient ground, full Ozzie (dark body reads as silhouette, white head pops).
v2 = page(
    defs='<linearGradient id="amber" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#d98b4a"/><stop offset="100%" stop-color="#b4682f"/></linearGradient>',
    bg='<rect width="1024" height="1024" fill="url(#amber)"/>',
    ozzie_transform='translate(152 150) scale(7.2)',
)

# V3 — PORTRAIT: ink ground + amber ring, head-forward (bigger, body cropped by the frame), max legibility small.
v3 = page(
    defs='',
    bg='<rect width="1024" height="1024" fill="#09090B"/>'
       '<circle cx="512" cy="512" r="392" fill="none" stroke="#c8793a" stroke-width="26"/>'
       '<circle cx="512" cy="512" r="360" fill="#141019"/>',
    # zoom onto the head: head center is (50,40) in 0..100. Scale ~9.4, translate so head sits centered.
    ozzie_transform='translate(-40 62) scale(9.4)',
    extra='<clipPath id="ring"><circle cx="512" cy="512" r="360"/></clipPath>',
)
# apply the clip to V3's ozzie group by re-wrapping
v3 = v3.replace('<g transform="translate(-40 62) scale(9.4)">',
               '<g clip-path="url(#ring)"><g transform="translate(-40 62) scale(9.4)">')
v3 = v3.replace('</g>\n</svg>', '</g></g>\n</svg>')

here = os.path.dirname(os.path.abspath(__file__))
for name, html in [('v1-halo', v1), ('v2-amber', v2), ('v3-portrait', v3)]:
    with open(os.path.join(here, f'{name}.html'), 'w') as f:
        f.write(html)
    print('wrote', name)
