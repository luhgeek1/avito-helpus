"""Growth chart: rounded base, four rising bars and an orange arrow shooting up."""

CAMERA = {'azimuth': -30, 'elevation': 20}


def build(r):
    base = r.plastic('base', r.WHITE, rough=0.35)
    colours = ('#9fdcff', '#5cc2ff', r.BLUE, '#0b87e6')
    arrow = r.plastic('arrow', r.ORANGE, rough=0.3, coat=0.35)

    r.box('Base', (1.05, 0.5, 0.08), (0, 0, 0.04), mat=base, bevel=0.035, segments=6)
    for i, colour in enumerate(colours):
        height = 0.22 + i * 0.17
        r.box(f'Bar{i}', (0.17, 0.26, height), (-0.36 + i * 0.24, 0, 0.08 + height / 2), mat=r.plastic(f'bar{i}', colour, rough=0.3),
              bevel=0.04, segments=6)
    points = [(-0.44, -0.2, 0.42), (-0.2, -0.2, 0.55), (0.0, -0.2, 0.62), (0.2, -0.2, 0.84)]
    r.tube('ArrowShaft', points, 0.035, arrow)
    r.cone('ArrowHead', 0.09, 0.17, (0.2, -0.2, 0.84), (1, 0, 1.1), mat=arrow)
    r.sphere('ArrowTail', 0.035, points[0], mat=arrow)
