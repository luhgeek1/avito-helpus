"""Dumbbell with purple rubber plates, chrome collars and a knurled grip."""

CAMERA = {'azimuth': -30, 'elevation': 22}


def build(r):
    plate = r.material('plate', r.PURPLE, rough=0.5, coat=0.15)
    inner = r.material('inner', '#7b45d6', rough=0.55)
    chrome = r.metal('chrome', '#dfe3e8', rough=0.14)
    grip = r.material('grip', '#aeb5bf', metal=1.0, rough=0.45, bump=0.35, bump_scale=900)

    parts = [r.cylinder('Grip', 0.05, 0.56, (0, 0, 0), (0, 90, 0), mat=grip, bevel=0.01)]
    for side in (-1, 1):
        parts.append(r.cylinder(f'PlateBig{side}', 0.27, 0.11, (0.36 * side, 0, 0), (0, 90, 0), mat=plate, bevel=0.035))
        parts.append(r.cylinder(f'PlateSmall{side}', 0.2, 0.08, (0.46 * side, 0, 0), (0, 90, 0), mat=inner, bevel=0.03))
        parts.append(r.cylinder(f'Collar{side}', 0.075, 0.06, (0.27 * side, 0, 0), (0, 90, 0), mat=chrome, bevel=0.012))
        parts.append(r.cylinder(f'End{side}', 0.06, 0.05, (0.52 * side, 0, 0), (0, 90, 0), mat=chrome, bevel=0.012))
    r.group('Dumbbell', parts, location=(0, 0, 0.27), rotation=(0, 0, 18))
