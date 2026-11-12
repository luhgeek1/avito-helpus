"""Canvas backpack: blue body, orange front pocket with stitching, zippers, pullers, top loop and straps."""

CAMERA = {'azimuth': -30, 'elevation': 10}


def build(r):
    canvas = r.fabric('canvas', r.BLUE, bump=0.22)
    pocket = r.fabric('pocket', r.ORANGE, bump=0.22)
    zipper = r.material('zipper', '#2b2f36', rough=0.6, bump=0.4, bump_scale=900)
    puller = r.metal('puller', '#d6dbe2', rough=0.22)
    strap = r.fabric('strap', '#1f6fd1', bump=0.3)
    thread = r.matte('thread', '#fff3df')
    leather = r.material('leather', '#8a5a3c', rough=0.5, bump=0.1, bump_scale=300)

    body = r.box('Body', (0.66, 0.34, 0.86), (0, 0, 0.47), mat=canvas, bevel=0.14, segments=8)
    r.subsurf(body, 1)
    r.tube('MainZip', [(-0.31, -0.03, 0.36), (-0.3, -0.05, 0.76), (0.0, -0.08, 0.88), (0.3, -0.05, 0.76), (0.31, -0.03, 0.36)], 0.012, zipper)
    r.box('Pocket', (0.48, 0.12, 0.34), (0, -0.19, 0.33), mat=pocket, bevel=0.06, segments=6)
    r.tube('PocketZip', [(-0.2, -0.255, 0.45), (0.2, -0.255, 0.45)], 0.01, zipper)
    r.dashes('StitchL', (-0.215, -0.258, 0.42), (-0.215, -0.258, 0.2), thread, dash=0.022, gap=0.014, radius=0.003)
    r.dashes('StitchR', (0.215, -0.258, 0.42), (0.215, -0.258, 0.2), thread, dash=0.022, gap=0.014, radius=0.003)
    r.dashes('StitchB', (-0.19, -0.258, 0.185), (0.19, -0.258, 0.185), thread, dash=0.022, gap=0.014, radius=0.003)
    for x, z in ((0.22, 0.45), (0.27, 0.8)):
        r.box(f'Puller{x}', (0.025, 0.012, 0.07), (x, -0.27 if z < 0.5 else -0.1, z - 0.04), mat=puller, bevel=0.005, segments=2)
    r.box('Patch', (0.14, 0.012, 0.09), (0, -0.258, 0.32), mat=leather, bevel=0.012, segments=3)
    r.tube('TopLoop', [(-0.07, 0.04, 0.88), (-0.05, 0.04, 0.97), (0.05, 0.04, 0.97), (0.07, 0.04, 0.88)], 0.018, strap)
    for x in (-0.22, 0.22):
        r.tube(f'Strap{x}', [(x * 0.6, 0.17, 0.84), (x, 0.26, 0.7), (x * 1.15, 0.26, 0.35), (x * 1.2, 0.18, 0.1)], 0.03, strap)
    for x in (-0.36, 0.36):
        r.box(f'SidePocket{x}', (0.06, 0.24, 0.26), (x, 0.0, 0.24), mat=canvas, bevel=0.03, segments=4)
