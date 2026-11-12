"""Two glossy cartoon eyeballs glancing to the side (something new)."""

CAMERA = {'azimuth': -12, 'elevation': 8}


def build(r):
    white = r.material('white', '#fbfbfb', rough=0.12, coat=1.0)
    iris = r.material('iris', r.BLUE, rough=0.15, coat=1.0)
    pupil = r.material('pupil', '#111317', rough=0.08, coat=1.0)
    shine = r.glow('shine', '#ffffff', 3.0)
    for x in (-0.25, 0.25):
        r.sphere(f'Eye{x}', 0.24, (x, 0, 0.3), scale=(0.92, 0.9, 1.1), mat=white)
        r.sphere(f'Iris{x}', 0.11, (x + 0.08, -0.19, 0.31), scale=(1, 0.38, 1.1), rotation=(0, 0, 18), mat=iris)
        r.sphere(f'Pupil{x}', 0.06, (x + 0.095, -0.225, 0.31), scale=(1, 0.3, 1.1), rotation=(0, 0, 18), mat=pupil)
        r.sphere(f'Shine{x}', 0.02, (x + 0.06, -0.245, 0.36), mat=shine)
