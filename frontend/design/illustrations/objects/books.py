"""Stack of three hardcover books with page blocks, spine bands and a ribbon bookmark."""

CAMERA = {'azimuth': -30, 'elevation': 22}


def book(r, name, size, location, rotation_z, colour):
    w, d, h = size
    cover = r.material(f'{name}Cover', colour, rough=0.45, coat=0.2, bump=0.05, bump_scale=300)
    pages = r.material(f'{name}Pages', '#fbf6ea', rough=0.85, bump=0.25, bump_scale=900)
    band = r.metal(f'{name}Band', '#f2d27c', rough=0.3)
    x, y, z = location
    parts = [
        r.box(f'{name}Front', (w, d, 0.018), (0, 0, h / 2 - 0.009), mat=cover, bevel=0.008, segments=3),
        r.box(f'{name}Back', (w, d, 0.018), (0, 0, -h / 2 + 0.009), mat=cover, bevel=0.008, segments=3),
        r.box(f'{name}Spine', (0.022, d, h), (-w / 2 + 0.011, 0, 0), mat=cover, bevel=0.01, segments=4),
        r.box(f'{name}Block', (w - 0.04, d - 0.03, h - 0.03), (0.005, 0, 0), mat=pages, bevel=0.004, segments=2),
    ]
    for dy in (-d * 0.3, d * 0.3):
        parts.append(r.box(f'{name}Band{dy}', (0.026, 0.018, h * 0.8), (-w / 2 + 0.008, dy, 0), mat=band, bevel=0.004, segments=2))
    return r.group(name, parts, location=(x, y, z), rotation=(0, 0, rotation_z)), parts


def build(r):
    book(r, 'Bottom', (0.78, 0.56, 0.14), (0, 0, 0.07), 0, r.BLUE)
    book(r, 'Middle', (0.7, 0.5, 0.12), (0.03, -0.02, 0.2), -9, r.GREEN)
    book(r, 'Top', (0.64, 0.46, 0.1), (-0.02, 0.0, 0.31), 7, r.RED)
    r.box('Bookmark', (0.03, 0.004, 0.16), (0.2, -0.27, 0.23), (0, 0, -9), mat=r.material('ribbon', r.YELLOW, rough=0.3, sheen=0.4), bevel=0.0015, segments=2)
