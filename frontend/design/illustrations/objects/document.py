"""Signed document: two sheets, folded corner, text lines, ink signature and a green seal with a tick."""

CAMERA = {'azimuth': -24, 'elevation': 14}

OUTLINE = [(-0.31, 0), (0.31, 0), (0.31, 0.68), (0.14, 0.86), (-0.31, 0.86)]


def build(r):
    sheet = r.paper('sheet')
    back = r.paper('back', '#d8efff')
    fold = r.paper('fold', '#bfe5ff')
    line = r.matte('line', '#cfd6df')
    title = r.matte('title', r.BLUE, rough=0.5)
    ink = r.material('ink', '#1f5fd6', rough=0.3)
    seal = r.plastic('seal', r.GREEN)
    tick = r.plastic('tick', '#ffffff')

    back_sheet = r.shape('Back', OUTLINE, 0.012, (0.1, 0.05, 0.02), (90, 0, 7), mat=back, bevel=0.005)
    parts = [r.shape('Sheet', OUTLINE, 0.014, (0, 0, 0), mat=sheet, bevel=0.006)]
    parts.append(r.shape('Fold', [(0.14, 0.86), (0.31, 0.68), (0.16, 0.68)], 0.006, (0, -0.012, 0), mat=fold, bevel=0.004))
    parts.append(r.box('Title', (0.2, 0.006, 0.04), (-0.12, -0.014, 0.74), mat=title, bevel=0.008, segments=3))
    for i, width in enumerate((0.42, 0.36, 0.4, 0.26)):
        parts.append(r.box(f'Line{i}', (width, 0.006, 0.024), (-0.22 + width / 2, -0.014, 0.6 - i * 0.085), mat=line, bevel=0.005, segments=3))
    parts.append(r.tube('Signature', [(-0.22, -0.016, 0.13), (-0.17, -0.016, 0.21), (-0.13, -0.016, 0.12),
                                      (-0.08, -0.016, 0.2), (-0.03, -0.016, 0.14), (0.04, -0.016, 0.17)], 0.006, ink))
    r.group('Sheets', parts + [back_sheet], rotation=(-9, 0, 0))

    r.cylinder('Seal', 0.14, 0.05, (0.27, -0.12, 0.17), (90, 0, 0), mat=seal, bevel=0.018)
    r.tube('Tick', [(0.2, -0.152, 0.17), (0.25, -0.152, 0.12), (0.34, -0.152, 0.23)], 0.016, tick)
