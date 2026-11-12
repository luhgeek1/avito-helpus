"""Clipboard checklist: blue board, steel clip, paper with two ticked boxes and one empty."""

CAMERA = {'azimuth': -22, 'elevation': 14}


def build(r):
    board = r.plastic('board', r.BLUE, rough=0.35)
    steel = r.metal('steel', '#d5dae1', rough=0.2)
    sheet = r.paper('sheet')
    box_mat = r.plastic('box', '#eef1f5', rough=0.4)
    tick = r.plastic('tick', r.GREEN, rough=0.3, coat=0.3, vivid=True)
    line = r.matte('line', '#cfd6df')

    parts = [r.box('Board', (0.68, 0.04, 0.9), (0, 0, 0.45), mat=board, bevel=0.035, segments=6),
             r.box('Paper', (0.58, 0.008, 0.76), (0, -0.024, 0.41), mat=sheet, bevel=0.004, segments=2),
             r.box('ClipBase', (0.3, 0.05, 0.08), (0, -0.03, 0.86), mat=steel, bevel=0.02, segments=4),
             r.cylinder('ClipRoll', 0.03, 0.26, (0, -0.06, 0.82), (0, 90, 0), mat=steel),
             r.torus('ClipLoop', 0.06, 0.012, (0, -0.02, 0.92), (90, 0, 0), mat=steel)]
    for i, done in enumerate((True, True, False)):
        z = 0.64 - i * 0.2
        parts.append(r.box(f'Check{i}', (0.1, 0.02, 0.1), (-0.19, -0.034, z), mat=box_mat, bevel=0.02, segments=3))
        parts.append(r.box(f'Line{i}', (0.26, 0.006, 0.03), (0.07, -0.03, z + 0.02), mat=line, bevel=0.006, segments=2))
        parts.append(r.box(f'LineShort{i}', (0.16, 0.006, 0.03), (0.02, -0.03, z - 0.03), mat=line, bevel=0.006, segments=2))
        if done:
            parts.append(r.tube(f'Tick{i}', [(-0.23, -0.06, z + 0.01), (-0.2, -0.06, z - 0.03), (-0.13, -0.06, z + 0.06)], 0.016, tick))
    r.group('Clipboard', parts, rotation=(-10, 0, 0))
