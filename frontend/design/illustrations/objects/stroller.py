"""Baby stroller: purple bassinet with a folding hood, chrome frame, handle and four wheels (family)."""

CAMERA = {'azimuth': -34, 'elevation': 12}


def build(r):
    shell = r.fabric('shell', r.PURPLE, bump=0.1)
    hood = r.fabric('hood', '#b58bff', bump=0.1)
    trim = r.plastic('trim', '#ffffff', rough=0.3)
    chrome = r.metal('chrome', '#d9dde3', rough=0.16)
    tyre = r.rubber('tyre')
    grip = r.rubber('grip', '#2c3038')

    r.sphere('Bassinet', 0.36, (0, 0, 0.56), scale=(1.25, 0.85, 0.62), mat=shell)
    r.half_sphere('Hood', 0.34, (0.22, 0, 0.62), scale=(0.9, 0.9, 1.0), rotation=(0, -35, 0), mat=hood)
    for i in range(3):
        r.torus(f'Rib{i}', 0.3, 0.012, (0.22, 0, 0.62), (90, 0, -55 + i * 25), mat=trim).scale = (1, 1, 1)
    r.torus('Rim', 0.43, 0.02, (0, 0, 0.7), mat=trim).scale = (1.02, 0.7, 1)
    for y in (-0.22, 0.22):
        r.tube(f'Frame{y}', [(0.36, y, 0.08), (0.1, y, 0.34), (-0.25, y, 0.08)], 0.016, chrome)
        r.tube(f'HandleBar{y}', [(0.0, y, 0.38), (-0.35, y, 0.7), (-0.52, y, 0.96)], 0.016, chrome)
        for x in (0.36, -0.25):
            r.cylinder(f'Wheel{x}{y}', 0.09, 0.05, (x, y * 1.15, 0.09), (90, 0, 0), mat=tyre, bevel=0.018)
            r.cylinder(f'Hub{x}{y}', 0.04, 0.056, (x, y * 1.15, 0.09), (90, 0, 0), mat=chrome, bevel=0.008)
    r.cylinder('Handle', 0.03, 0.5, (-0.52, 0, 0.96), (90, 0, 0), mat=grip, bevel=0.012)
