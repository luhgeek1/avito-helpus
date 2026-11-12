"""Security shield: silver rim, Avito-blue face and a white tick (moderation)."""

CAMERA = {'azimuth': -18, 'elevation': 10}

OUTLINE = [(0.0, -0.5), (0.3, -0.3, True), (0.42, 0.05, True), (0.42, 0.4), (0.0, 0.5), (-0.42, 0.4), (-0.42, 0.05, True),
           (-0.3, -0.3, True)]


def scaled(points, k):
    return [(p[0] * k, p[1] * k, *p[2:]) for p in points]


def build(r):
    rim = r.metal('rim', '#d9dde3', rough=0.18)
    face = r.plastic('face', r.BLUE, rough=0.25, coat=0.6)
    tick = r.plastic('tick', '#ffffff', rough=0.3)
    r.shape('Rim', OUTLINE, 0.12, (0, 0.03, 0.55), mat=rim, bevel=0.04)
    r.shape('Face', scaled(OUTLINE, 0.84), 0.1, (0, -0.02, 0.55), mat=face, bevel=0.04)
    r.tube('Tick', [(-0.16, -0.1, 0.56), (-0.04, -0.1, 0.44), (0.18, -0.1, 0.7)], 0.04, tick)
