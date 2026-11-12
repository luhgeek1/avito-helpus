"""Green price tag with a percent sign, metal eyelet and a looped string (partner discounts)."""

CAMERA = {'azimuth': -18, 'elevation': 16}

OUTLINE = [(-0.42, -0.24), (0.2, -0.24), (0.44, 0.0), (0.2, 0.24), (-0.42, 0.24)]


def build(r):
    card = r.plastic('card', r.GREEN, rough=0.35, coat=0.3)
    white = r.plastic('white', '#ffffff', rough=0.3)
    eyelet = r.metal('eyelet', '#d9dde3', rough=0.2)
    string = r.material('string', '#f2e3c6', rough=0.8, bump=0.3, bump_scale=600)
    parts = [r.shape('Tag', OUTLINE, 0.05, (0, 0, 0), mat=card, bevel=0.03, holes=[r.circle(0.25, 0.0, 0.05, 14)]),
             r.torus('Eyelet', 0.06, 0.014, (0.25, 0, 0), (90, 0, 0), mat=eyelet),
             r.text('Percent', '%', 0.36, 0.04, (-0.1, -0.05, 0.0), mat=white),
             r.tube('String', [(0.25, 0.0, 0.0), (0.36, -0.1, 0.06), (0.5, -0.08, 0.2), (0.42, 0.02, 0.38), (0.3, 0.06, 0.42)], 0.01, string)]
    r.group('PriceTag', parts, location=(0, 0, 0.45), rotation=(0, -18, 0))
