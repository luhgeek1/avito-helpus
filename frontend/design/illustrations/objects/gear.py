"""Two meshing gears: a big blue one and a small chrome one (training, settings)."""
import math

CAMERA = {'azimuth': -18, 'elevation': 16}


def gear_outline(teeth, outer, inner):
    points = []
    step = 2 * math.pi / teeth
    for i in range(teeth):
        a = i * step
        for frac, radius in ((0.0, inner), (0.18, outer), (0.5, outer), (0.68, inner)):
            angle = a + frac * step
            points.append((radius * math.cos(angle), radius * math.sin(angle)))
    return points


def build(r):
    blue = r.plastic('blue', r.BLUE, rough=0.25, coat=0.6)
    chrome = r.metal('chrome', '#d9dde3', rough=0.2)
    hub = r.plastic('hub', '#2b2f36', rough=0.35)
    r.shape('Big', gear_outline(12, 0.42, 0.34), 0.14, (-0.1, 0, 0.46), mat=blue, bevel=0.025, holes=[r.circle(0, 0, 0.1, 16)])
    r.cylinder('BigHub', 0.1, 0.16, (-0.1, 0, 0.46), (90, 0, 0), mat=hub, bevel=0.02)
    r.shape('Small', gear_outline(9, 0.25, 0.19), 0.12, (0.47, -0.05, 0.27), (90, 0, 12), mat=chrome, bevel=0.02, holes=[r.circle(0, 0, 0.06, 14)])
    r.cylinder('SmallHub', 0.06, 0.14, (0.47, -0.05, 0.27), (90, 0, 12), mat=hub, bevel=0.015)
