"""Friendly robot: white helmet head with dark visor and glowing eyes, antenna, purple ears, small body."""

CAMERA = {'azimuth': -22, 'elevation': 10}


def build(r):
    shell = r.plastic('shell', '#f6f7fa', rough=0.25, coat=0.5)
    visor = r.material('visor', '#14181f', rough=0.1, coat=1.0)
    eye = r.glow('eye', '#5cd0ff', 3.0)
    accent = r.plastic('accent', r.PURPLE, rough=0.3)
    red = r.plastic('red', r.RED, rough=0.2, coat=0.5)
    joint = r.plastic('joint', r.GRAPHITE, rough=0.4)

    r.box('Head', (0.62, 0.5, 0.48), (0, 0, 0.82), mat=shell, bevel=0.17, segments=10)
    r.box('Visor', (0.5, 0.06, 0.3), (0, -0.23, 0.83), mat=visor, bevel=0.1, segments=8)
    for x in (-0.11, 0.11):
        r.box(f'Eye{x}', (0.08, 0.02, 0.1), (x, -0.27, 0.86), mat=eye, bevel=0.035, segments=5)
    r.tube('Smile', [(-0.07, -0.27, 0.75), (0, -0.275, 0.73), (0.07, -0.27, 0.75)], 0.012, eye)
    for x in (-0.33, 0.33):
        r.cylinder(f'Ear{x}', 0.09, 0.08, (x, 0, 0.83), (0, 90, 0), mat=accent, bevel=0.025)
    r.cylinder('Antenna', 0.014, 0.14, (0, 0, 1.12), mat=joint)
    r.sphere('AntennaTip', 0.045, (0, 0, 1.21), mat=red)
    r.cylinder('Neck', 0.08, 0.08, (0, 0, 0.56), mat=joint)
    r.box('Body', (0.5, 0.38, 0.42), (0, 0, 0.3), mat=shell, bevel=0.13, segments=8)
    r.box('Panel', (0.24, 0.03, 0.12), (0, -0.19, 0.34), mat=visor, bevel=0.03, segments=4)
    for i, colour in enumerate((r.GREEN, r.YELLOW, r.BLUE)):
        r.cylinder(f'Light{i}', 0.018, 0.02, (-0.06 + i * 0.06, -0.21, 0.34), (90, 0, 0), mat=r.glow(f'l{i}', colour, 2.0))
    for x in (-0.31, 0.31):
        r.sphere(f'Shoulder{x}', 0.07, (x, 0, 0.42), mat=joint)
        r.box(f'Arm{x}', (0.1, 0.12, 0.26), (x * 1.08, -0.02, 0.27), (0, 0, 0), mat=accent, bevel=0.05, segments=6)
