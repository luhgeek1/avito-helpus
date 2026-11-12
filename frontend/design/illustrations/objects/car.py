"""Compact hatchback in Avito blue: tinted windows, wheels with alloy hubs, headlights and mirrors."""

CAMERA = {'azimuth': -42, 'elevation': 16}

PROFILE = [(-0.66, 0.14), (0.66, 0.14), (0.7, 0.22, True), (0.68, 0.36, True), (0.44, 0.4, True), (0.24, 0.63, True),
           (-0.32, 0.65, True), (-0.56, 0.44, True), (-0.68, 0.38, True), (-0.7, 0.22, True)]
WINDOW = [(0.38, 0.41), (0.21, 0.6, True), (-0.3, 0.61, True), (-0.5, 0.43)]


def build(r):
    paint = r.material('paint', r.BLUE, rough=0.22, coat=1.0)
    glass = r.material('glass', '#1e2a3a', rough=0.08, coat=1.0)
    tyre = r.rubber('tyre', '#202328')
    alloy = r.metal('alloy', '#d6dbe2', rough=0.2)
    lamp = r.glow('lamp', '#fff6d8', 2.0)
    tail = r.glow('tail', r.RED, 1.6)
    trim = r.plastic('trim', r.GRAPHITE, rough=0.5)

    r.shape('Body', PROFILE, 0.58, (0, 0, 0), mat=paint, bevel=0.07)
    for y in (-0.37, 0.37):
        r.shape(f'Window{y}', WINDOW, 0.01, (0, y, 0), mat=glass, bevel=0.012)
        for x in (-0.42, 0.42):
            r.cylinder(f'Tyre{x}{y}', 0.16, 0.13, (x, y * 1.03, 0.16), (90, 0, 0), mat=tyre, bevel=0.035)
            r.cylinder(f'Hub{x}{y}', 0.095, 0.02, (x, y * 1.22, 0.16), (90, 0, 0), mat=alloy, bevel=0.01)
        r.box(f'Mirror{y}', (0.08, 0.07, 0.05), (0.33, y * 1.05, 0.44), mat=paint, bevel=0.02, segments=3)
    r.box('Windshield', (0.28, 0.56, 0.012), (0.39, 0, 0.56), (0, -49, 0), mat=glass, bevel=0.02, segments=3)
    for y in (-0.2, 0.2):
        r.sphere(f'Headlight{y}', 0.06, (0.69, y, 0.3), scale=(0.5, 1.2, 0.8), mat=lamp)
        r.box(f'Taillight{y}', (0.03, 0.12, 0.06), (-0.71, y, 0.33), mat=tail, bevel=0.012, segments=2)
    r.box('Grille', (0.03, 0.26, 0.06), (0.71, 0, 0.22), mat=trim, bevel=0.015, segments=3)
    r.box('Bumper', (1.42, 0.6, 0.06), (0, 0, 0.17), mat=trim, bevel=0.03, segments=4)
