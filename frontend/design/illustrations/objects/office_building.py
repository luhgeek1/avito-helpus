"""Office building: white tower with glass window grid, lower wing, blue entrance canopy, rooftop units, tree."""

CAMERA = {'azimuth': -36, 'elevation': 16}


def build(r):
    wall = r.plastic('wall', '#f2f4f7', rough=0.5, coat=0.1)
    glass = r.material('glass', '#5bbcff', rough=0.08, coat=1.0)
    frame = r.plastic('frame', '#d5dbe3', rough=0.4)
    accent = r.plastic('accent', r.BLUE, rough=0.3, coat=0.4)
    unit = r.metal('unit', '#c9ced6', rough=0.35)
    leaf = r.material('leaf', '#2bc565', rough=0.5, bump=0.3, bump_scale=60)
    trunk = r.material('trunk', '#9b6a43', rough=0.6)

    r.box('Tower', (0.56, 0.5, 1.1), (0, 0.05, 0.55), mat=wall, bevel=0.04, segments=5)
    for row in range(6):
        for col in range(3):
            r.box(f'WinF{row}{col}', (0.12, 0.02, 0.11), (-0.16 + col * 0.16, -0.205, 0.22 + row * 0.15), mat=glass, bevel=0.012, segments=2)
        for col in range(3):
            r.box(f'WinS{row}{col}', (0.02, 0.11, 0.11), (-0.285, 0.21 - col * 0.15, 0.22 + row * 0.15), mat=glass, bevel=0.012, segments=2)
    r.box('Wing', (0.5, 0.46, 0.42), (0.5, -0.02, 0.21), mat=wall, bevel=0.035, segments=5)
    for col in range(2):
        r.box(f'WinW{col}', (0.16, 0.02, 0.13), (0.42 + col * 0.18, -0.255, 0.26), mat=glass, bevel=0.012, segments=2)
    r.box('Door', (0.16, 0.02, 0.2), (0.0, -0.205, 0.1), mat=glass, bevel=0.01, segments=2)
    r.box('Canopy', (0.3, 0.12, 0.03), (0.0, -0.25, 0.22), mat=accent, bevel=0.012, segments=3)
    r.box('Sign', (0.26, 0.02, 0.05), (0.0, -0.207, 1.0), mat=accent, bevel=0.01, segments=2)
    r.box('Parapet', (0.58, 0.52, 0.03), (0, 0.05, 1.115), mat=frame, bevel=0.01, segments=2)
    for i, (x, y) in enumerate(((-0.12, 0.12), (0.1, 0.0))):
        r.box(f'Unit{i}', (0.14, 0.12, 0.08), (x, y, 1.17), mat=unit, bevel=0.015, segments=3)
    r.cylinder('Trunk', 0.025, 0.2, (-0.42, -0.28, 0.1), mat=trunk)
    r.sphere('Crown', 0.13, (-0.42, -0.28, 0.3), scale=(1, 1, 1.15), mat=leaf)
