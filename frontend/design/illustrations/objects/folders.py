"""Two file folders with tabs and papers sticking out (certificates and leave requests)."""

CAMERA = {'azimuth': -22, 'elevation': 14}


def folder(r, name, colour, location, rotation):
    cover = r.material(f'{name}Cover', colour, rough=0.45, coat=0.15)
    back_outline = [(-0.42, 0), (0.42, 0), (0.42, 0.62), (-0.04, 0.62), (-0.1, 0.7, True), (-0.38, 0.7, True), (-0.42, 0.64)]
    parts = [r.shape(f'{name}Back', back_outline, 0.02, (0, 0.04, 0), mat=cover, bevel=0.012)]
    for i, (dx, h) in enumerate(((-0.03, 0.66), (0.04, 0.6))):
        parts.append(r.box(f'{name}Paper{i}', (0.7, 0.008, h), (dx, 0.0 - i * 0.012, h / 2 + 0.02), (0, 3 - i * 5, 0), mat=r.paper(f'{name}p{i}'), bevel=0.004, segments=2))
        parts.append(r.box(f'{name}Line{i}', (0.36, 0.006, 0.02), (dx - 0.1, -0.006 - i * 0.012, h - 0.06), (0, 3 - i * 5, 0), mat=r.matte(f'{name}l{i}', '#c9d1db'), bevel=0.004, segments=2))
    parts.append(r.box(f'{name}Front', (0.86, 0.02, 0.5), (0, -0.05, 0.25), (-8, 0, 0), mat=cover, bevel=0.014, segments=3))
    parts.append(r.box(f'{name}Label', (0.22, 0.006, 0.07), (0.22, -0.09, 0.36), (-8, 0, 0), mat=r.paper(f'{name}lab'), bevel=0.006, segments=2))
    return r.group(name, parts, location=location, rotation=rotation)


def build(r):
    folder(r, 'BackFolder', r.BLUE, (0.1, 0.18, 0.0), (0, 0, 6))
    folder(r, 'FrontFolder', r.ORANGE, (-0.05, -0.08, 0.0), (0, 0, -4))
