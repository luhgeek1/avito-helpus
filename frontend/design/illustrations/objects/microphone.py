"""Conference microphone on a desk stand: mesh grille, blue band, black body and weighted base."""

CAMERA = {'azimuth': -24, 'elevation': 12}


def build(r):
    grille = r.material('grille', '#c3c9d1', metal=1.0, rough=0.4, bump=0.6, bump_scale=420)
    body = r.plastic('body', '#2a2e35', rough=0.3, coat=0.4)
    band = r.plastic('band', r.BLUE, rough=0.25, coat=0.5)
    steel = r.metal('steel', '#d6dbe2', rough=0.2)
    base = r.plastic('base', r.GRAPHITE, rough=0.35)

    parts = [r.sphere('Grille', 0.2, (0, 0, 0.62), mat=grille),
             r.lathe('Body', [(0.0, 0.0), (0.07, 0.0), (0.085, 0.1), (0.15, 0.4), (0.17, 0.46), (0.0, 0.46)], mat=body, subdiv=1),
             r.cylinder('Band', 0.178, 0.06, (0, 0, 0.47), mat=band, bevel=0.012),
             r.box('Switch', (0.05, 0.03, 0.08), (0, -0.14, 0.28), (-15, 0, 0), mat=band, bevel=0.01, segments=3)]
    r.group('Mic', parts, location=(0, 0, 0.35), rotation=(14, 0, 0))
    r.torus('Clip', 0.13, 0.025, (0, 0.03, 0.55), (0, 0, 0), mat=steel)
    r.cylinder('Rod', 0.022, 0.5, (0, 0.08, 0.3), mat=steel)
    r.cylinder('Base', 0.26, 0.06, (0, 0.08, 0.03), mat=base, bevel=0.025)
