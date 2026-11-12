"""Stopwatch: green case, chrome crown and pusher, white dial with ticks and a red hand (corporate run)."""
import math

CAMERA = {'azimuth': -18, 'elevation': 10}


def build(r):
    case = r.plastic('case', r.GREEN, rough=0.25, coat=0.6)
    chrome = r.metal('chrome', '#d9dde3', rough=0.15)
    face = r.plastic('face', '#fbfbfb', rough=0.3)
    tick = r.matte('tick', '#2b2f36')
    hand = r.plastic('hand', r.RED, rough=0.3, coat=0.4)
    center = (0, 0, 0.48)
    r.cylinder('Case', 0.42, 0.16, center, (90, 0, 0), mat=case, bevel=0.06)
    r.cylinder('Face', 0.34, 0.02, (0, -0.075, 0.48), (90, 0, 0), mat=face, bevel=0.006)
    r.torus('Bezel', 0.36, 0.025, (0, -0.07, 0.48), (90, 0, 0), mat=chrome)
    for i in range(12):
        a = math.radians(i * 30)
        length = 0.06 if i % 3 == 0 else 0.035
        rad = 0.28 - length / 2
        r.box(f'Tick{i}', (0.018, 0.008, length), (rad * math.sin(a), -0.088, 0.48 + rad * math.cos(a)), (0, a * 180 / math.pi, 0), mat=tick, bevel=0.003, segments=1)
    r.box('Hand', (0.024, 0.01, 0.24), (0.06, -0.095, 0.58), (0, 28, 0), mat=hand, bevel=0.006, segments=2)
    r.box('HandShort', (0.026, 0.01, 0.14), (-0.05, -0.095, 0.5), (0, -60, 0), mat=tick, bevel=0.006, segments=2)
    r.cylinder('Pin', 0.03, 0.03, (0, -0.1, 0.48), (90, 0, 0), mat=chrome, bevel=0.008)
    r.cylinder('Stem', 0.04, 0.08, (0, 0, 0.94), mat=chrome)
    r.cylinder('Crown', 0.08, 0.06, (0, 0, 1.0), mat=chrome, bevel=0.02)
    r.torus('Loop', 0.06, 0.016, (0, 0, 1.1), (90, 0, 0), mat=chrome)
    r.box('Pusher', (0.06, 0.06, 0.08), (0.3, 0, 0.84), (0, 38, 0), mat=chrome, bevel=0.02, segments=3)
