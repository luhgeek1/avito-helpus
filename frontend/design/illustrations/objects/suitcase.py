"""Hard-shell cabin suitcase: ribs, zipper band, telescopic handle, spinner wheels, luggage tag."""

CAMERA = {'azimuth': -38, 'elevation': 16}


def build(r):
    shell = r.material('shell', '#ffae2b', rough=0.32, coat=0.4, bump=0.04, bump_scale=60)
    zip_band = r.material('zip', '#454a54', rough=0.85, bump=0.25, bump_scale=900)
    rubber = r.material('rubber', '#1f2228', rough=0.6)
    plastic = r.material('plastic', '#3a3f48', rough=0.45)
    alu = r.material('alu', '#c9ced6', metal=1.0, rough=0.25)
    leather = r.material('leather', '#965eeb', rough=0.55, bump=0.12, bump_scale=300)
    paper = r.material('paper', '#f6f7f9', rough=0.8)
    thread = r.material('thread', '#f2f2f2', rough=0.7)

    r.box('Shell', (0.78, 0.40, 1.00), (0, 0, 0.62), mat=shell, bevel=0.11, segments=12)
    r.box('ZipBand', (0.8, 0.032, 1.02), (0, 0.03, 0.62), mat=zip_band, bevel=0.115, segments=12)
    for i, x in enumerate((-0.21, -0.07, 0.07, 0.21)):
        r.box(f'Rib{i}', (0.055, 0.03, 0.74), (x, -0.205, 0.62), mat=shell, bevel=0.014, segments=5)

    # Zipper puller on the visible left side.
    r.box('Puller', (0.012, 0.03, 0.07), (-0.41, 0.03, 0.86), mat=alu, bevel=0.005, segments=3)
    r.box('PullerTab', (0.01, 0.022, 0.05), (-0.414, 0.03, 0.80), mat=rubber, bevel=0.005, segments=3)

    # Top carry handle.
    for side in (-1, 1):
        r.box(f'HandleMount{side}', (0.06, 0.08, 0.035), (0.12 * side, 0.03, 1.13), mat=plastic, bevel=0.014, segments=4)
    r.tube('Handle', [(-0.12, 0.03, 1.14), (-0.08, 0.03, 1.2), (0.08, 0.03, 1.2), (0.12, 0.03, 1.14)], 0.022, rubber)

    # Telescopic handle.
    for side in (-1, 1):
        r.box(f'RodHousing{side}', (0.075, 0.07, 0.03), (0.17 * side, 0.15, 1.13), mat=plastic, bevel=0.012, segments=4)
        r.cylinder(f'Rod{side}', 0.017, 0.33, (0.17 * side, 0.15, 1.29), mat=alu)
    r.box('Grip', (0.42, 0.07, 0.055), (0, 0.15, 1.46), mat=rubber, bevel=0.026, segments=6)

    # Spinner wheels.
    for x in (-0.3, 0.3):
        for y in (-0.13, 0.13):
            r.box(f'WheelHousing{x}{y}', (0.1, 0.085, 0.06), (x, y, 0.1), mat=plastic, bevel=0.022, segments=5)
            r.cylinder(f'Wheel{x}{y}', 0.046, 0.038, (x, y, 0.047), (0, 90, 0), mat=rubber, bevel=0.012)
            r.cylinder(f'Hub{x}{y}', 0.018, 0.044, (x, y, 0.047), (0, 90, 0), mat=alu, bevel=0.004)

    # Luggage tag hanging on the left side.
    r.tube('TagStrap', [(-0.12, 0.0, 1.15), (-0.3, -0.03, 1.16), (-0.415, -0.05, 1.02)], 0.007, leather)
    r.box('Tag', (0.014, 0.13, 0.19), (-0.42, -0.05, 0.92), (6, 0, 0), mat=leather, bevel=0.012, segments=5)
    r.box('TagCard', (0.004, 0.09, 0.11), (-0.428, -0.05, 0.91), (6, 0, 0), mat=paper, bevel=0.003, segments=2)
    r.dashes('TagStitch', (-0.43, -0.105, 0.995), (-0.43, -0.105, 0.84), thread, dash=0.012, gap=0.008, radius=0.0018)
