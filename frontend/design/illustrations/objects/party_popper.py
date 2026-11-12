"""Party popper: striped cone bursting with confetti and curly streamers in brand colours."""
import math
import random

CAMERA = {'azimuth': -18, 'elevation': 10}
VIVID = True

COLOURS = ('#1fa8ff', '#14cc66', '#ff4a5c', '#9a64f0', '#ffcc33')


def build(r):
    random.seed(7)
    stripes = [r.plastic('stripeA', r.PURPLE, rough=0.3, coat=0.5), r.plastic('stripeB', r.YELLOW, rough=0.3, coat=0.5)]
    mats = [r.plastic(f'c{i}', c, rough=0.3, coat=0.4) for i, c in enumerate(COLOURS)]
    cone = r.lathe('Cone', [(0.0, 0.0), (0.06, 0.0), (0.3, 0.7), (0.31, 0.74), (0.0, 0.72)])
    r.stripes(cone, stripes, 10)
    rim = r.torus('Rim', 0.305, 0.026, (0, 0, 0.73), mat=stripes[1])
    r.group('Popper', [cone, rim], location=(-0.32, 0, 0.12), rotation=(0, 38, 0))

    mouth = (0.13, 0.0, 0.7)
    for i in range(40):
        a = math.radians(random.uniform(10, 80))
        b = math.radians(random.uniform(-60, 60))
        dist = random.uniform(0.12, 0.5)
        pos = (mouth[0] + dist * math.cos(a) * math.cos(b), dist * math.sin(b) * 0.6, mouth[2] + dist * math.sin(a) * 0.9)
        rot = (random.uniform(0, 180), random.uniform(0, 180), random.uniform(0, 180))
        if i % 3:
            r.box(f'Confetti{i}', (0.09, 0.05, 0.012), pos, rot, mat=mats[i % len(mats)], bevel=0.003, segments=2)
        else:
            r.sphere(f'Dot{i}', 0.034, pos, mat=mats[i % len(mats)])
    for i in range(4):
        a = math.radians(20 + i * 18)
        points = []
        for k in range(14):
            t = k / 13
            radius = 0.05 + t * 0.45
            points.append((mouth[0] + radius * math.cos(a), 0.05 * math.sin(t * 12) + (i - 1.5) * 0.06,
                           mouth[2] + radius * math.sin(a) + 0.04 * math.cos(t * 12)))
        r.tube(f'Streamer{i}', points, 0.02, mats[(i + 1) % len(mats)])
