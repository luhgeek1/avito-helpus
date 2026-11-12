"""Striped beach umbrella over a beach ball (vacation)."""

CAMERA = {'azimuth': -26, 'elevation': 14}
VIVID = True


def build(r):
    white = r.fabric('white', '#fbfbfb', bump=0.08)
    orange = r.fabric('orange', r.ORANGE, bump=0.08)
    pole = r.plastic('pole', r.WHITE, rough=0.4)
    ball_mats = [r.plastic(f'ball{i}', c, rough=0.25, coat=0.5) for i, c in enumerate((r.BLUE, '#ffffff', r.RED, '#ffffff', r.GREEN, '#ffffff'))]

    canopy = r.lathe('Canopy', [(0.0, 0.3), (0.2, 0.26), (0.45, 0.14), (0.62, 0.0), (0.6, -0.02), (0.0, 0.26)], steps=96)
    r.stripes(canopy, [white, orange], 8)
    r.subsurf(canopy, 1)
    finial = r.sphere('Finial', 0.035, (0, 0, 0.32), mat=pole)
    shaft = r.cylinder('Pole', 0.02, 1.1, (0, 0, -0.5), mat=pole)
    r.group('Umbrella', [canopy, finial, shaft], location=(-0.12, 0.05, 1.05), rotation=(0, -12, 0))

    ball = r.sphere('Ball', 0.2, (0.36, -0.22, 0.2), mat=None)
    r.stripes(ball, ball_mats, 6)
