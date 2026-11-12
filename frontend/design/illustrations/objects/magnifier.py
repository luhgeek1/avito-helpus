"""Magnifying glass: blue rim, clear lens with a reflection and a graphite handle (search)."""

CAMERA = {'azimuth': -16, 'elevation': 12}


def build(r):
    rim = r.plastic('rim', r.BLUE, rough=0.25, coat=0.6)
    lens = r.material('lens', '#dff3ff', rough=0.02, coat=1.0, alpha=0.35)
    shine = r.material('shine', '#ffffff', rough=0.1, alpha=0.7)
    handle = r.plastic('handle', '#2b2f36', rough=0.35, coat=0.3)
    collar = r.metal('collar', '#d6dbe2', rough=0.2)
    parts = [r.torus('Rim', 0.3, 0.05, (0, 0, 0), (90, 0, 0), mat=rim),
             r.cylinder('Lens', 0.29, 0.03, (0, 0, 0), (90, 0, 0), mat=lens, bevel=0.012),
             r.box('Shine', (0.06, 0.004, 0.24), (-0.1, -0.03, 0.06), (0, 35, 0), mat=shine, bevel=0.02, segments=3),
             r.cylinder('Collar', 0.065, 0.1, (0, 0, -0.39), mat=collar, bevel=0.01),
             r.cylinder('Handle', 0.06, 0.42, (0, 0, -0.64), mat=handle, bevel=0.02, radius2=0.07),
             r.sphere('Cap', 0.07, (0, 0, -0.85), scale=(1, 1, 0.5), mat=handle)]
    r.group('Magnifier', parts, location=(0, 0, 0.75), rotation=(0, -35, 0))
