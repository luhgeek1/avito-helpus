"""Glowing light bulb with a frosted warm glass, filament, threaded base and light rays (idea)."""
import math

CAMERA = {'azimuth': -16, 'elevation': 8}


def build(r):
    glass = r.material('glass', '#ffe27a', rough=0.25, coat=0.8, emission='#ffd54a', strength=0.8)
    filament = r.glow('filament', '#fff3c4', 6.0)
    metal = r.metal('metal', '#cfd4db', rough=0.25)
    base = r.plastic('base', '#2b2f36', rough=0.4)
    ray = r.plastic('ray', r.YELLOW, rough=0.3, coat=0.4)
    r.lathe('Glass', [(0.0, 1.06), (0.16, 1.04), (0.3, 0.94), (0.36, 0.78), (0.33, 0.62), (0.22, 0.48), (0.16, 0.38),
                      (0.15, 0.32), (0.0, 0.32)], mat=glass, subdiv=2)
    r.tube('Filament', [(-0.08, -0.0, 0.5), (-0.06, 0, 0.7), (-0.03, 0, 0.66), (0.0, 0, 0.72), (0.03, 0, 0.66),
                        (0.06, 0, 0.7), (0.08, 0, 0.5)], 0.008, filament)
    for k in range(4):
        r.torus(f'Thread{k}', 0.15, 0.02, (0, 0, 0.27 - k * 0.05), mat=metal)
    r.cylinder('Collar', 0.15, 0.2, (0, 0, 0.2), mat=metal, bevel=0.01)
    r.cylinder('Contact', 0.08, 0.06, (0, 0, 0.07), mat=base, radius2=0.05, bevel=0.015)
    for i, angle in enumerate((-60, -30, 0, 30, 60)):
        a = math.radians(90 + angle)
        r.box(f'Ray{i}', (0.05, 0.05, 0.14), (0.5 * math.cos(a), 0, 0.78 + 0.5 * math.sin(a) - 0.06), (0, -angle, 0), mat=ray, bevel=0.022, segments=4)
