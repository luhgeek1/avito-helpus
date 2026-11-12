"""Cosy lilac sofa with cushions, a yellow pillow and wooden legs (psychological support)."""

CAMERA = {'azimuth': -30, 'elevation': 16}


def build(r):
    cloth = r.fabric('cloth', '#b79cf5')
    cushion = r.fabric('cushion', '#c4adf8')
    pillow = r.fabric('pillow', r.YELLOW)
    wood = r.material('wood', '#c58b55', rough=0.45)

    r.box('Base', (1.3, 0.62, 0.22), (0, 0, 0.23), mat=cloth, bevel=0.05, segments=6)
    for x in (-0.31, 0.31):
        r.box(f'Seat{x}', (0.6, 0.56, 0.13), (x, -0.03, 0.4), mat=cushion, bevel=0.055, segments=7)
        r.box(f'BackCushion{x}', (0.6, 0.16, 0.42), (x, 0.24, 0.62), (-12, 0, 0), mat=cushion, bevel=0.07, segments=7)
    r.box('Back', (1.3, 0.14, 0.5), (0, 0.32, 0.5), mat=cloth, bevel=0.05, segments=6)
    for side in (-1, 1):
        r.box(f'Arm{side}', (0.17, 0.66, 0.44), (0.72 * side, 0, 0.33), mat=cloth, bevel=0.07, segments=7)
        for y in (-0.24, 0.24):
            r.cylinder(f'Leg{side}{y}', 0.03, 0.12, (0.68 * side, y, 0.06), mat=wood, radius2=0.022)
    p = r.box('Pillow', (0.3, 0.12, 0.3), (-0.4, 0.06, 0.62), (-18, 0, 14), mat=pillow, bevel=0.06, segments=6)
    r.subsurf(p, 2)
