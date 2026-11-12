"""Cardboard parcel with blue tape, flap seams and a shipping label with a barcode (delivery)."""

CAMERA = {'azimuth': -34, 'elevation': 22}
VIVID = True


def build(r):
    kraft = r.material('kraft', '#d8a96f', rough=0.8, bump=0.12, bump_scale=250)
    seam = r.material('seam', '#b98a52', rough=0.85)
    tape = r.material('tape', '#7fc9ff', rough=0.25, coat=0.4)
    label = r.paper('label')
    ink = r.matte('ink', '#22252b')
    accent = r.plastic('accent', r.RED, rough=0.4)

    r.box('Box', (0.9, 0.7, 0.6), (0, 0, 0.3), mat=kraft, bevel=0.015, segments=3)
    r.box('Seam', (0.008, 0.704, 0.004), (0, 0, 0.6), mat=seam, bevel=0.001, segments=1)
    r.box('TapeTop', (0.16, 0.71, 0.006), (0, 0, 0.602), mat=tape, bevel=0.002, segments=1)
    r.box('TapeFront', (0.16, 0.006, 0.2), (0, -0.352, 0.5), mat=tape, bevel=0.002, segments=1)
    r.box('TapeSide', (0.006, 0.16, 0.2), (0.452, 0, 0.5), mat=tape, bevel=0.002, segments=1)
    r.box('Label', (0.34, 0.006, 0.22), (-0.2, -0.353, 0.24), mat=label, bevel=0.004, segments=2)
    r.box('LabelBar', (0.3, 0.007, 0.035), (-0.2, -0.355, 0.32), mat=accent, bevel=0.003, segments=1)
    for i, w in enumerate((0.012, 0.006, 0.018, 0.006, 0.012, 0.024, 0.006, 0.012, 0.018, 0.006, 0.012, 0.006)):
        r.box(f'Bar{i}', (w, 0.007, 0.1), (-0.33 + i * 0.024, -0.356, 0.21), mat=ink, bevel=0.0, segments=1)
    for i, w in enumerate((0.2, 0.14)):
        r.box(f'Text{i}', (w, 0.007, 0.012), (-0.35 + w / 2, -0.356, 0.15 - i * 0.025), mat=ink, bevel=0.0, segments=1)
