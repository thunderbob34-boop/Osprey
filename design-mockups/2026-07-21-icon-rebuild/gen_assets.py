#!/usr/bin/env python3
"""Generate the full Halo-style asset set at each target dimension from the real Ozzie geometry."""
import os

OZZIE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '_ozzie_svg.txt')).read()

HALO_GRAD = ('<radialGradient id="halo" cx="50%" cy="50%" r="50%">'
             '<stop offset="0%" stop-color="#c8793a" stop-opacity="0.9"/>'
             '<stop offset="55%" stop-color="#a5602c" stop-opacity="0.5"/>'
             '<stop offset="100%" stop-color="#c8793a" stop-opacity="0"/></radialGradient>')

def asset(W, H, s, center_frac):
    """Halo comp: ink ground, amber glow behind the head, Ozzie centred at scale s."""
    ox = W/2 - 50*s
    oy = H*center_frac - 48*s        # 48 ~= Ozzie's vertical visual centroid
    hx = ox + 50*s                   # halo over the head (head centre = 50,40)
    hy = oy + 40*s
    hr = 51*s                        # halo extends ~1.7x the head radius (30*s)
    return (f'<!doctype html><html><head><meta charset="utf-8"><style>'
            f'*{{margin:0;padding:0}}html,body{{width:{W}px;height:{H}px;overflow:hidden}}</style></head>'
            f'<body><svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">'
            f'<defs>{HALO_GRAD}</defs>'
            f'<rect width="{W}" height="{H}" fill="#09090B"/>'
            f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="{hr:.1f}" fill="url(#halo)"/>'
            f'<g transform="translate({ox:.1f} {oy:.1f}) scale({s})">{OZZIE}</g>'
            f'</svg></body></html>')

# (name, W, H, ozzie-scale, vertical-centre-fraction)
ASSETS = [
    ('icon-1024',     1024, 1024, 7.2, 0.484),   # iOS app icon — full square
    ('adaptive-icon', 1024, 1024, 6.0, 0.500),   # Android foreground — smaller, inside the 66% safe zone
    ('splash',        1284, 2778, 7.0, 0.420),   # launch screen — centred, breathing room
    ('favicon',        196,  196, 1.35, 0.500),  # web
]

here = os.path.dirname(os.path.abspath(__file__))
for name, W, H, s, cf in ASSETS:
    with open(os.path.join(here, f'asset-{name}.html'), 'w') as f:
        f.write(asset(W, H, s, cf))
    print(f'wrote asset-{name}.html  ({W}x{H}, scale {s})')
