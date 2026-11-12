"""Erlenmeyer flask with glowing green liquid, bubbles and a cork (prototype)."""

CAMERA = {'azimuth': -16, 'elevation': 10}


def build(r):
    glass = r.material('glass', '#e8f6ff', rough=0.02, coat=1.0, alpha=0.32)
    liquid = r.material('liquid', r.GREEN, rough=0.15, coat=0.6, emission='#2be37f', strength=0.5)
    bubble = r.material('bubble', '#c9ffe0', rough=0.1, coat=1.0)
    cork = r.material('cork', '#c8935a', rough=0.7, bump=0.3, bump_scale=200)
    mark = r.plastic('mark', '#ffffff', rough=0.3)
    r.lathe('Glass', [(0.0, 0.0), (0.38, 0.0), (0.4, 0.03), (0.4, 0.06), (0.14, 0.62), (0.13, 0.82), (0.16, 0.86),
                      (0.12, 0.86), (0.11, 0.82), (0.12, 0.62), (0.37, 0.06), (0.36, 0.03), (0.0, 0.03)], mat=glass, subdiv=1)
    r.lathe('Liquid', [(0.0, 0.035), (0.36, 0.035), (0.37, 0.06), (0.24, 0.34), (0.0, 0.34)], mat=liquid, subdiv=1)
    for i, (x, z, s) in enumerate(((0.05, 0.42, 0.04), (-0.03, 0.55, 0.03), (0.02, 0.68, 0.025), (-0.12, 0.2, 0.035), (0.14, 0.15, 0.03))):
        r.sphere(f'Bubble{i}', s, (x, -0.02, z), mat=bubble)
    r.cylinder('Cork', 0.13, 0.12, (0, 0, 0.9), mat=cork, radius2=0.115, bevel=0.015)
    for i, z in enumerate((0.16, 0.26)):
        r.box(f'Mark{i}', (0.08, 0.01, 0.012), (-0.2 + z * 0.3, -0.34 + z * 0.62, z), (0, 0, 0), mat=mark, bevel=0.003, segments=1)
