"""Pizza slice: golden crust, melted cheese, pepperoni, olives and basil."""
import math

CAMERA = {'azimuth': -24, 'elevation': 34}
VIVID = True


def build(r):
    dough = r.material('dough', '#f2b766', rough=0.6, bump=0.25, bump_scale=60)
    crust = r.material('crust', '#d98c3f', rough=0.55, bump=0.3, bump_scale=80)
    cheese = r.material('cheese', '#ffd25c', rough=0.35, coat=0.3, bump=0.15, bump_scale=40)
    pepperoni = r.material('pepperoni', '#e2453b', rough=0.4, coat=0.3)
    olive = r.material('olive', '#2b2d33', rough=0.3, coat=0.5)
    basil = r.material('basil', '#2fbf5a', rough=0.4, coat=0.2)

    arc = [(0.0, 0.0)]
    for i in range(25):
        a = math.radians(-26 + 52 * i / 24)
        arc.append((0.8 * math.cos(a), 0.8 * math.sin(a)))
    r.shape('Base', arc, 0.05, (0, 0, 0.03), (0, 0, 0), mat=dough, bevel=0.015)
    cheese_arc = [(0.06, 0.0)] + [(0.74 * math.cos(math.radians(a)), 0.74 * math.sin(math.radians(a))) for a in range(-23, 24, 2)]
    r.shape('Cheese', cheese_arc, 0.02, (0, 0, 0.07), (0, 0, 0), mat=cheese, bevel=0.012)
    r.tube('Crust', [(0.8 * math.cos(math.radians(a)), 0.8 * math.sin(math.radians(a)), 0.07) for a in range(-26, 27, 4)], 0.06, crust)
    for i, (d, a) in enumerate(((0.3, 4), (0.5, -12), (0.55, 13), (0.66, -2))):
        x, y = d * math.cos(math.radians(a)), d * math.sin(math.radians(a))
        r.cylinder(f'Pepperoni{i}', 0.07, 0.022, (x, y, 0.09), mat=pepperoni, bevel=0.008)
    for i, (d, a) in enumerate(((0.42, -6), (0.62, 8))):
        x, y = d * math.cos(math.radians(a)), d * math.sin(math.radians(a))
        r.torus(f'Olive{i}', 0.025, 0.014, (x, y, 0.095), mat=olive)
    for i, (d, a, rot) in enumerate(((0.2, -3, 20), (0.47, 6, -30))):
        x, y = d * math.cos(math.radians(a)), d * math.sin(math.radians(a))
        r.sphere(f'Basil{i}', 0.045, (x, y, 0.095), scale=(1.3, 0.7, 0.25), rotation=(0, 0, rot), mat=basil)
