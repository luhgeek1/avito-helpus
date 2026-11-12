"""Green merch T-shirt with ribbed collar, stitched hems and a four-dot print."""

CAMERA = {'azimuth': -16, 'elevation': 10}

OUTLINE = [(-0.17, 0.62), (-0.42, 0.53, True), (-0.63, 0.3), (-0.49, 0.15), (-0.37, 0.24), (-0.37, -0.44),
           (0.37, -0.44), (0.37, 0.24), (0.49, 0.15), (0.63, 0.3), (0.42, 0.53, True), (0.17, 0.62),
           (0.1, 0.53, True), (0.0, 0.5, True), (-0.1, 0.53, True)]


def build(r):
    cotton = r.fabric('cotton', r.GREEN, bump=0.25)
    rib = r.fabric('rib', '#0fae57', bump=0.35)
    thread = r.matte('thread', '#0b9a4c')
    dots = [r.plastic(f'dot{i}', c, rough=0.5, coat=0) for i, c in enumerate((r.BLUE, r.RED, r.PURPLE, '#ffffff'))]

    parts = [r.shape('Shirt', OUTLINE, 0.12, (0, 0, 0), mat=cotton, bevel=0.035)]
    parts.append(r.tube('Collar', [(-0.17, -0.09, 0.62), (-0.1, -0.09, 0.53), (0.0, -0.09, 0.5), (0.1, -0.09, 0.53), (0.17, -0.09, 0.62)], 0.022, rib))
    for x0, x1, z in ((-0.33, 0.33, -0.39), (-0.6, -0.47, 0.25), (0.47, 0.6, 0.25)):
        parts.append(r.tube(f'Hem{x0}', [(x0, -0.098, z), (x1, -0.098, z)], 0.006, thread))
    for i, (x, z) in enumerate(((-0.06, 0.18), (0.06, 0.18), (-0.06, 0.06), (0.06, 0.06))):
        parts.append(r.cylinder(f'Dot{i}', 0.045, 0.01, (x, -0.096, z), (90, 0, 0), mat=dots[i], bevel=0.003))
    r.group('Tee', parts, location=(0, 0, 0.5), rotation=(-6, 0, 0))
