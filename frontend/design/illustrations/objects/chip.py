"""AI processor chip: dark package, silver lid with glowing «AI», pins on four sides and circuit traces."""

CAMERA = {'azimuth': -20, 'elevation': 44}


def build(r):
    board = r.plastic('board', '#1f8f57', rough=0.45, coat=0.2)
    trace = r.metal('trace', '#e9c46a', rough=0.3)
    package = r.plastic('package', '#2b2f36', rough=0.35)
    lid = r.metal('lid', '#d9dde3', rough=0.25)
    pin = r.metal('pin', '#e9c46a', rough=0.22)
    glow = r.glow('glow', r.PURPLE, 2.2)

    r.box('Board', (1.1, 1.1, 0.04), (0, 0, 0.02), mat=board, bevel=0.03, segments=4)
    for i in range(5):
        offset = -0.3 + i * 0.15
        for (x0, y0), (x1, y1) in ((((offset, 0.3), (offset, 0.52))), (((offset, -0.3), (offset, -0.52))),
                                   (((0.3, offset), (0.52, offset))), (((-0.3, offset), (-0.52, offset)))):
            r.tube(f'Trace{i}{x0}{y0}', [(x0, y0, 0.045), (x1, y1, 0.045)], 0.008, trace)
            r.cylinder(f'Pad{i}{x1}{y1}', 0.022, 0.01, (x1, y1, 0.045), mat=trace, bevel=0.003)
    r.box('Package', (0.56, 0.56, 0.08), (0, 0, 0.09), mat=package, bevel=0.025, segments=4)
    for i in range(7):
        offset = -0.21 + i * 0.07
        for x, y, size in ((offset, 0.3, (0.025, 0.06, 0.02)), (offset, -0.3, (0.025, 0.06, 0.02)),
                           (0.3, offset, (0.06, 0.025, 0.02)), (-0.3, offset, (0.06, 0.025, 0.02))):
            r.box(f'Pin{i}{x}{y}', size, (x, y, 0.06), mat=pin, bevel=0.006, segments=2)
    r.box('Lid', (0.42, 0.42, 0.04), (0, 0, 0.15), mat=lid, bevel=0.02, segments=4)
    r.text('AI', 'AI', 0.3, 0.04, (0, 0, 0.19), (0, 0, 0), mat=glow)
