"""Three glossy puzzle pieces in brand colours (agents and integrations)."""
import math

CAMERA = {'azimuth': -16, 'elevation': 40}


def knob(cx, cy, radius, start, end, steps=10):
    return [(cx + radius * math.cos(math.radians(start + (end - start) * i / steps)),
             cy + radius * math.sin(math.radians(start + (end - start) * i / steps))) for i in range(steps + 1)]


def piece():
    s = 0.25
    points = [(-s, -s), (s, -s), (s, -0.06)]
    points += knob(s + 0.08, 0, 0.1, -130, 130)
    points += [(s, 0.06), (s, s), (0.06, s)]
    points += knob(0, s + 0.08, 0.1, -40, 220)
    points += [(-0.06, s), (-s, s)]
    return points


def build(r):
    for name, colour, location, rotation in (('Blue', r.BLUE, (-0.28, 0.12, 0.05), 8), ('Green', r.GREEN, (0.34, 0.1, 0.05), -12),
                                             ('Purple', r.PURPLE, (0.0, -0.36, 0.05), 25)):
        r.shape(name, piece(), 0.08, location, (0, 0, rotation), mat=r.plastic(name, colour, rough=0.28, coat=0.5), bevel=0.025)
