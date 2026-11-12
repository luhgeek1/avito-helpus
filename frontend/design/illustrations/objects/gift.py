"""Gift box: red wrapping, lid, crossed satin ribbon, big bow with tails."""

CAMERA = {'azimuth': -32, 'elevation': 20}


def build(r):
    wrap = r.material('wrap', r.RED, rough=0.42, coat=0.15)
    ribbon = r.material('ribbon', r.YELLOW, rough=0.28, sheen=0.4, coat=0.2)

    r.box('Box', (0.8, 0.8, 0.62), (0, 0, 0.31), mat=wrap, bevel=0.02, segments=5)
    r.box('Lid', (0.86, 0.86, 0.17), (0, 0, 0.67), mat=wrap, bevel=0.025, segments=5)
    for axis in ((0.16, 0.808, 0.625), (0.808, 0.16, 0.625)):
        r.box(f'Band{axis[0]}', axis, (0, 0, 0.31), mat=ribbon, bevel=0.006, segments=3)
    for axis in ((0.16, 0.868, 0.176), (0.868, 0.16, 0.176)):
        r.box(f'LidBand{axis[0]}', axis, (0, 0, 0.67), mat=ribbon, bevel=0.008, segments=3)

    for side in (-1, 1):
        r.torus(f'Loop{side}', 0.15, 0.045, (0.15 * side, 0, 0.86), (0, 32 * side, 90), mat=ribbon).scale = (1, 0.55, 1)
        tail = [(0, 0), (0.07 * side, 0), (0.12 * side, -0.24), (0.075 * side, -0.2), (0.04 * side, -0.25)]
        r.shape(f'Tail{side}', tail, 0.018, (0.02 * side, -0.07, 0.82), (90, 0, 0), mat=ribbon, bevel=0.006)
    r.sphere('Knot', 0.075, (0, 0, 0.8), scale=(1, 0.9, 0.85), mat=ribbon)
