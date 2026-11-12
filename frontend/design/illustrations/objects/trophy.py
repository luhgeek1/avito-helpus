"""Gold trophy cup on a purple plinth with a star emblem and engraved plate."""

CAMERA = {'azimuth': -24, 'elevation': 12}


def build(r):
    gold = r.metal('gold', '#ffc23d', rough=0.2)
    plinth = r.plastic('plinth', r.PURPLE, rough=0.3)
    plate = r.metal('plate', '#f1d27a', rough=0.32)

    r.lathe('Cup', [(0.0, 0.62), (0.3, 0.62), (0.31, 0.66), (0.33, 1.08), (0.36, 1.12), (0.36, 1.14),
                     (0.31, 1.14), (0.29, 1.1), (0.27, 0.72), (0.0, 0.7)], mat=gold, subdiv=1)
    r.lathe('Stem', [(0.0, 0.3), (0.14, 0.3), (0.1, 0.36), (0.06, 0.45), (0.06, 0.56), (0.12, 0.62), (0.0, 0.64)], mat=gold, subdiv=1)
    for side in (-1, 1):
        r.tube(f'Handle{side}', [(0.31 * side, 0, 1.02), (0.5 * side, 0, 1.02), (0.52 * side, 0, 0.86),
                                 (0.4 * side, 0, 0.76), (0.29 * side, 0, 0.74)], 0.032, gold)
    star = [(0.0, 0.11), (0.032, 0.035), (0.11, 0.035), (0.05, -0.015), (0.07, -0.095), (0.0, -0.05),
            (-0.07, -0.095), (-0.05, -0.015), (-0.11, 0.035), (-0.032, 0.035)]
    r.shape('Star', star, 0.03, (0.0, -0.335, 0.9), (90, 0, 0), mat=plate, bevel=0.008)
    r.box('Plinth', (0.58, 0.58, 0.3), (0, 0, 0.15), mat=plinth, bevel=0.04, segments=6)
    r.box('Plate', (0.3, 0.012, 0.1), (0, -0.292, 0.15), mat=plate, bevel=0.005, segments=3)
