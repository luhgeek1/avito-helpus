"""Brass key on a ring with a blue rubber key fob."""

CAMERA = {'azimuth': -12, 'elevation': 52}


def build(r):
    brass = r.metal('brass', '#e8c25a', rough=0.22)
    steel = r.metal('steel', '#cfd4db', rough=0.2)
    fob = r.plastic('fob', r.BLUE, rough=0.45, coat=0.1)
    white = r.plastic('white', '#ffffff')

    parts = [r.shape('Bow', r.circle(-0.32, 0, 0.17, 20), 0.045, (0, 0, 0.03), (0, 0, 0), mat=brass, bevel=0.012,
                     holes=[r.circle(-0.36, 0, 0.055, 14)])]
    parts.append(r.box('Shoulder', (0.08, 0.13, 0.05), (-0.13, 0, 0.03), mat=brass, bevel=0.012, segments=3))
    parts.append(r.box('Blade', (0.5, 0.085, 0.04), (0.14, 0.02, 0.03), mat=brass, bevel=0.01, segments=3))
    parts.append(r.box('Groove', (0.44, 0.012, 0.01), (0.15, 0.03, 0.052), mat=brass, bevel=0.003, segments=2))
    for i, (x, depth) in enumerate(((0.06, 0.07), (0.13, 0.05), (0.2, 0.08), (0.27, 0.045), (0.33, 0.06))):
        parts.append(r.box(f'Tooth{i}', (0.045, depth, 0.04), (x, -0.02 - depth / 2, 0.03), (0, 0, 45 if i % 2 else 0), mat=brass, bevel=0.008, segments=2))
    parts.append(r.torus('Ring', 0.13, 0.014, (-0.45, 0.07, 0.03), (0, 0, 0), mat=steel))
    parts.append(r.shape('Fob', [(-0.1, 0.0, True), (0.1, 0.0, True), (0.13, 0.26, True), (0.0, 0.33, True), (-0.13, 0.26, True)],
                         0.05, (-0.6, 0.15, 0.035), (0, 0, 40), mat=fob, bevel=0.018, holes=[r.circle(0.0, 0.25, 0.035, 12)]))
    parts.append(r.text('FobText', '24', 0.1, 0.012, (-0.66, 0.22, 0.076), (0, 0, 40), mat=white))
    r.group('Key', parts, rotation=(0, 0, -30))
