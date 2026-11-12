"""Stethoscope: metal binaurals with ear tips, purple tubing and a chest piece with a blue diaphragm."""

CAMERA = {'azimuth': -18, 'elevation': 10}


def build(r):
    steel = r.metal('steel', '#d3d8df', rough=0.18)
    tubing = r.material('tubing', r.PURPLE, rough=0.38, coat=0.3)
    tips = r.rubber('tips', '#2c3038')
    diaphragm = r.plastic('diaphragm', '#8fd2ff', rough=0.25)

    for side, x in ((-1, -0.22), (1, 0.18)):
        r.sphere(f'Tip{side}', 0.05, (x, 0, 1.0), scale=(1, 1, 1.15), mat=tips)
        r.tube(f'Binaural{side}', [(x, 0, 0.96), (x + 0.05 * side, 0, 0.8), (x - 0.03 * side, 0, 0.62), (-0.02, 0, 0.5)], 0.018, steel)
    r.sphere('Joint', 0.04, (-0.02, 0, 0.5), mat=steel)
    r.tube('Tubing', [(-0.02, 0, 0.47), (-0.07, 0, 0.28), (0.0, 0, 0.1), (0.15, 0, 0.07), (0.26, 0, 0.19)], 0.042, tubing)
    r.cylinder('Stem', 0.026, 0.12, (0.3, 0, 0.21), (0, 90, 0), mat=steel)
    r.cylinder('ChestPiece', 0.2, 0.09, (0.52, 0, 0.21), (90, 0, 0), mat=steel, bevel=0.025)
    r.cylinder('Diaphragm', 0.165, 0.012, (0.52, -0.046, 0.21), (90, 0, 0), mat=diaphragm, bevel=0.004)
    r.torus('Rim', 0.172, 0.014, (0.52, -0.048, 0.21), (90, 0, 0), mat=steel)
