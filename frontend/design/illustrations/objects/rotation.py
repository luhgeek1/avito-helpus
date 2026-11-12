"""Two glossy curved arrows chasing each other in a circle (internal rotation)."""
import math

CAMERA = {'azimuth': -20, 'elevation': 10}

RADIUS = 0.42
CENTER_Z = 0.55


def arc(start, end, steps=7):
    points = []
    for i in range(steps):
        a = math.radians(start + (end - start) * i / (steps - 1))
        points.append((RADIUS * math.cos(a), 0, CENTER_Z + RADIUS * math.sin(a)))
    return points


def build(r):
    for name, colour, start, end in (('Top', r.BLUE, 200, 340), ('Bottom', r.GREEN, 20, 160)):
        mat = r.plastic(name, colour, rough=0.28, coat=0.4)
        points = arc(start, end)
        r.tube(f'{name}Arc', points, 0.075, mat)
        a = math.radians(end)
        tangent = (-math.sin(a), 0, math.cos(a))
        tip = points[-1]
        r.cone(f'{name}Head', 0.15, 0.22, tip, tangent, mat=mat, bevel=0.01)
        r.sphere(f'{name}Cap', 0.075, points[0], mat=mat)
