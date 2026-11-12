"""Poke bowl: ceramic bowl with blue rim, rice, salmon, egg, greens, edamame and chopsticks."""
import math

CAMERA = {'azimuth': -24, 'elevation': 26}
VIVID = True


def build(r):
    ceramic = r.material('ceramic', '#fbfbfb', rough=0.22, coat=0.6)
    rim = r.material('rim', r.BLUE, rough=0.25, coat=0.6)
    rice = r.material('rice', '#fbf6ea', rough=0.75, bump=0.6, bump_scale=160)
    salmon = r.material('salmon', '#ff8a65', rough=0.4, coat=0.3)
    yolk = r.material('yolk', '#ffb31f', rough=0.3, coat=0.4)
    white = r.material('egg', '#ffffff', rough=0.35)
    leaf = r.material('leaf', '#3cc96a', rough=0.45)
    bean = r.material('bean', '#8ad15a', rough=0.4, coat=0.2)
    wood = r.material('wood', '#d9a86c', rough=0.5, bump=0.1, bump_scale=200)

    r.lathe('Bowl', [(0.0, 0.0), (0.2, 0.0), (0.22, 0.03), (0.38, 0.14), (0.47, 0.32), (0.5, 0.44), (0.52, 0.46),
                     (0.48, 0.46), (0.45, 0.42), (0.36, 0.2), (0.0, 0.12)], mat=ceramic, subdiv=1)
    r.torus('Rim', 0.495, 0.02, (0, 0, 0.455), mat=rim)
    r.sphere('Rice', 0.46, (0, 0, 0.36), scale=(1, 1, 0.3), mat=rice)
    for i in range(4):
        a = math.radians(-150 + i * 22)
        r.box(f'Salmon{i}', (0.21, 0.09, 0.055), (0.24 * math.cos(a), 0.24 * math.sin(a) + 0.05, 0.5), (0, 8, math.degrees(a) + 90), mat=salmon, bevel=0.02, segments=4)
    r.sphere('EggWhite', 0.14, (0.18, 0.16, 0.48), scale=(1, 1, 0.45), mat=white)
    r.sphere('Yolk', 0.08, (0.18, 0.16, 0.52), scale=(1, 1, 0.55), mat=yolk)
    for i in range(6):
        a = math.radians(140 + i * 18)
        r.sphere(f'Bean{i}', 0.045, (0.28 * math.cos(a), 0.28 * math.sin(a), 0.48), scale=(1.3, 1, 0.8), rotation=(0, 0, math.degrees(a)), mat=bean)
    for i in range(5):
        a = math.radians(40 + i * 25)
        r.box(f'Leaf{i}', (0.13, 0.06, 0.014), (0.12 * math.cos(a) - 0.12, 0.12 * math.sin(a) - 0.02, 0.5), (12, 0, math.degrees(a)), mat=leaf, bevel=0.01, segments=2)
    for dy in (-0.035, 0.035):
        r.cylinder(f'Chopstick{dy}', 0.014, 0.95, (0.05, -0.32 + dy, 0.52), (0, 84, 12), mat=wood, radius2=0.008, bevel=0.004)
