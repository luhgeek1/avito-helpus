"""Compact camera: white body, blue lens ring, glass lens, viewfinder, flash and a red shutter button."""

CAMERA = {'azimuth': -26, 'elevation': 12}


def build(r):
    body = r.plastic('body', '#f6f7fa', rough=0.28, coat=0.5)
    grip = r.material('grip', '#2b2f36', rough=0.7, bump=0.3, bump_scale=600)
    ring = r.plastic('ring', r.BLUE, rough=0.25, coat=0.6)
    barrel = r.plastic('barrel', '#23262c', rough=0.3)
    glass = r.material('glass', '#16324f', rough=0.03, coat=1.0)
    shine = r.material('shine', '#9fdcff', rough=0.05, coat=1.0)
    red = r.plastic('red', r.RED, rough=0.25, coat=0.5)
    flash = r.material('flash', '#fff8e6', rough=0.1, coat=1.0)

    r.box('Body', (0.9, 0.32, 0.56), (0, 0, 0.3), mat=body, bevel=0.08, segments=8)
    r.box('Grip', (0.16, 0.34, 0.46), (-0.34, -0.005, 0.3), mat=grip, bevel=0.06, segments=6)
    r.box('Top', (0.34, 0.24, 0.1), (0.12, 0.02, 0.62), mat=body, bevel=0.04, segments=5)
    r.cylinder('Ring', 0.2, 0.08, (0.06, -0.19, 0.3), (90, 0, 0), mat=ring, bevel=0.02)
    r.cylinder('Barrel', 0.16, 0.1, (0.06, -0.26, 0.3), (90, 0, 0), mat=barrel, bevel=0.02)
    r.cylinder('Lens', 0.115, 0.03, (0.06, -0.31, 0.3), (90, 0, 0), mat=glass, bevel=0.01)
    r.sphere('Shine', 0.03, (0.02, -0.325, 0.34), scale=(1, 0.3, 1), mat=shine)
    r.cylinder('Shutter', 0.05, 0.04, (-0.28, 0.0, 0.6), mat=red, bevel=0.012)
    r.box('Flash', (0.14, 0.02, 0.07), (0.3, -0.165, 0.5), mat=flash, bevel=0.012, segments=3)
    r.box('Viewfinder', (0.1, 0.02, 0.06), (0.12, -0.105, 0.63), mat=glass, bevel=0.01, segments=2)
