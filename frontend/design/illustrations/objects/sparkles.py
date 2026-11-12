"""Three puffy four-point stars in gold, purple and blue (AI magic)."""
import math

CAMERA = {'azimuth': -14, 'elevation': 8}


def star(size):
    return [(math.cos(math.radians(45 * k)) * (size if k % 2 == 0 else size * 0.3),
             math.sin(math.radians(45 * k)) * (size if k % 2 == 0 else size * 0.3), k % 2 == 1) for k in range(8)]


def build(r):
    for name, colour, size, location, tilt in (('Gold', r.YELLOW, 0.38, (-0.1, 0, 0.5), 0), ('Purple', r.PURPLE, 0.2, (0.38, 0.05, 0.86), 12),
                                               ('Blue', r.BLUE, 0.15, (0.36, -0.05, 0.22), -10)):
        r.shape(name, star(size), 0.08, location, (90, tilt, 0), mat=r.plastic(name, colour, rough=0.22, coat=0.7), bevel=0.04)
