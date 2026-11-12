"""Two table tennis paddles (red and blue rubber, wooden handles) and a ball."""

CAMERA = {'azimuth': -20, 'elevation': 30}
VIVID = True


def paddle(r, name, colour, location, rotation):
    rubber = r.material(f'{name}Rubber', colour, rough=0.55, bump=0.12, bump_scale=500)
    wood = r.material(f'{name}Wood', '#e4b57e', rough=0.5, bump=0.1, bump_scale=120)
    grip = r.material(f'{name}Grip', '#9b6a43', rough=0.45)
    parts = [r.cylinder(f'{name}Blade', 0.3, 0.02, (0, 0, 0), mat=wood, bevel=0.006),
             r.cylinder(f'{name}Top', 0.29, 0.012, (0, 0, 0.016), mat=rubber, bevel=0.004),
             r.cylinder(f'{name}Bottom', 0.29, 0.012, (0, 0, -0.016), mat=rubber, bevel=0.004),
             r.box(f'{name}Neck', (0.12, 0.1, 0.05), (0.3, 0, 0), mat=wood, bevel=0.02, segments=3),
             r.box(f'{name}Handle', (0.3, 0.09, 0.07), (0.48, 0, 0), mat=grip, bevel=0.03, segments=5)]
    return r.group(name, parts, location=location, rotation=rotation)


def build(r):
    paddle(r, 'Blue', r.BLUE, (-0.1, 0.12, 0.05), (0, 0, 150))
    paddle(r, 'Red', r.RED, (0.02, -0.05, 0.12), (0, -8, 30))
    r.sphere('Ball', 0.07, (0.36, -0.36, 0.07), mat=r.plastic('ball', '#ffffff', rough=0.3, coat=0.3))
