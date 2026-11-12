"""Film clapperboard: dark slate with chalk lines and an open striped clapper (film club)."""

CAMERA = {'azimuth': -22, 'elevation': 14}


def stripes_bar(r, name, width, location, rotation, mats):
    parts = [r.box(f'{name}Bar', (width, 0.06, 0.14), (0, 0, 0), mat=mats[0], bevel=0.015, segments=3)]
    count = 6
    for i in range(count):
        x = -width / 2 + (i + 0.5) * width / count
        parts.append(r.box(f'{name}Stripe{i}', (0.07, 0.065, 0.16), (x, 0, 0), (0, 35, 0), mat=mats[1], bevel=0.004, segments=1))
    return r.group(name, parts, location=location, rotation=rotation)


def build(r):
    slate = r.plastic('slate', '#2b2f36', rough=0.45)
    white = r.plastic('white', '#f6f7fa', rough=0.4)
    chalk = r.matte('chalk', '#e9ecf1')
    hinge = r.metal('hinge', '#d6dbe2', rough=0.2)
    r.box('Slate', (0.86, 0.06, 0.62), (0, 0, 0.31), mat=slate, bevel=0.02, segments=4)
    stripes_bar(r, 'Base', 0.86, (0, 0, 0.69), (0, 0, 0), (white, slate))
    stripes_bar(r, 'Clapper', 0.86, (0.0, 0, 0.88), (0, -14, 0), (white, slate)).location = (0.0, 0, 0.88)
    r.cylinder('Hinge', 0.04, 0.08, (-0.42, 0, 0.77), (90, 0, 0), mat=hinge, bevel=0.01)
    for i, z in enumerate((0.48, 0.3, 0.14)):
        r.box(f'Row{i}', (0.8, 0.065, 0.012), (0, 0, z + 0.07), mat=chalk, bevel=0.002, segments=1)
    r.box('Divider', (0.012, 0.065, 0.36), (0.0, 0, 0.29), mat=chalk, bevel=0.002, segments=1)
    r.text('Take', 'КИНО', 0.11, 0.012, (-0.2, -0.034, 0.47), mat=chalk)
    r.text('Number', '12', 0.11, 0.012, (0.2, -0.034, 0.25), mat=chalk)
