"""3D pie chart: four slices of different heights, the red one pulled out."""
import math

CAMERA = {'azimuth': -20, 'elevation': 34}
VIVID = True


def sector(start, end, radius=0.5, steps=24):
    points = [(0.0, 0.0)]
    for i in range(steps + 1):
        a = math.radians(start + (end - start) * i / steps)
        points.append((radius * math.cos(a), radius * math.sin(a)))
    return points


def build(r):
    slices = ((0, 140, r.BLUE, 0.16), (140, 230, r.GREEN, 0.22), (230, 300, r.PURPLE, 0.28), (300, 360, r.RED, 0.34))
    for start, end, colour, height in slices:
        mid = math.radians((start + end) / 2)
        offset = 0.12 if colour == r.RED else 0.012
        r.shape(f'Slice{start}', sector(start, end), height, (offset * math.cos(mid), offset * math.sin(mid), height / 2 + 0.02),
                (0, 0, 0), mat=r.plastic(f's{start}', colour, rough=0.28, coat=0.4), bevel=0.02)
