"""Two overlapping speech bubbles: purple «Aa» behind, blue typing dots in front (language, support)."""

CAMERA = {'azimuth': -16, 'elevation': 10}


def build(r):
    purple = r.plastic('purple', r.PURPLE, rough=0.25, coat=0.6)
    blue = r.plastic('blue', r.BLUE, rough=0.25, coat=0.6)
    white = r.plastic('white', '#ffffff', rough=0.3)

    r.shape('Back', r.rounded_rect(0.14, 0.72, 0.84, 0.5, 0.2), 0.14, (0, 0.2, 0.08), mat=purple, bevel=0.05)
    r.shape('BackTail', [(0.3, 0.5), (0.48, 0.5), (0.52, 0.36)], 0.14, (0, 0.2, 0.08), mat=purple, bevel=0.05)
    r.text('Aa', 'Aa', 0.22, 0.03, (0.2, 0.06, 0.8), mat=white)

    r.shape('Front', r.rounded_rect(-0.16, 0.36, 0.86, 0.5, 0.2), 0.14, (0, -0.1, 0.0), mat=blue, bevel=0.05)
    r.shape('FrontTail', [(-0.44, 0.14), (-0.26, 0.14), (-0.5, -0.04)], 0.14, (0, -0.1, 0.0), mat=blue, bevel=0.05)
    for i in range(3):
        r.sphere(f'Dot{i}', 0.045, (-0.32 + i * 0.16, -0.24, 0.36), scale=(1, 0.5, 1), mat=white)
