"""Puffy glossy red heart with a small white plaster (care)."""

CAMERA = {'azimuth': -18, 'elevation': 10}
VIVID = True

OUTLINE = [(0.0, -0.5), (0.36, -0.12, True), (0.5, 0.18, True), (0.4, 0.4, True), (0.2, 0.44, True),
           (0.0, 0.3), (-0.2, 0.44, True), (-0.4, 0.4, True), (-0.5, 0.18, True), (-0.36, -0.12, True)]


def build(r):
    red = r.plastic('red', r.RED, rough=0.2, coat=0.8)
    plaster = r.material('plaster', '#fff4e6', rough=0.6, bump=0.2, bump_scale=400)
    pad = r.material('pad', '#f2d8bd', rough=0.7)
    r.shape('Heart', OUTLINE, 0.18, (0, 0, 0.6), mat=red, bevel=0.12)
    r.box('Plaster', (0.36, 0.02, 0.11), (0.18, -0.215, 0.82), (0, 35, 0), mat=plaster, bevel=0.03, segments=4)
    r.box('Pad', (0.11, 0.022, 0.07), (0.18, -0.222, 0.82), (0, 35, 0), mat=pad, bevel=0.012, segments=3)
