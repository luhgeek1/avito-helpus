"""Server rack: graphite cabinet with four units, vents, handles and status LEDs (data, data centre)."""

CAMERA = {'azimuth': -30, 'elevation': 14}


def build(r):
    cabinet = r.plastic('cabinet', '#30343c', rough=0.35)
    unit = r.plastic('unit', '#454a54', rough=0.3, coat=0.2)
    vent = r.matte('vent', '#1c1f24')
    handle = r.metal('handle', '#cdd2da', rough=0.2)
    leds = [r.glow(f'led{i}', c, 3.0) for i, c in enumerate((r.GREEN, r.BLUE, r.GREEN, r.PURPLE))]
    accent = r.plastic('accent', r.BLUE, rough=0.3, coat=0.3)

    r.box('Cabinet', (0.62, 0.56, 1.1), (0, 0, 0.57), mat=cabinet, bevel=0.04, segments=5)
    r.box('Top', (0.6, 0.54, 0.03), (0, 0, 1.13), mat=accent, bevel=0.012, segments=3)
    for i in range(4):
        z = 0.24 + i * 0.24
        r.box(f'Unit{i}', (0.54, 0.03, 0.2), (0, -0.285, z), mat=unit, bevel=0.015, segments=3)
        for k in range(6):
            r.box(f'Vent{i}{k}', (0.012, 0.01, 0.12), (-0.04 + k * 0.035, -0.302, z), mat=vent, bevel=0.003, segments=1)
        for k, colour in enumerate(leds[:3]):
            r.cylinder(f'Led{i}{k}', 0.014, 0.012, (0.16 + k * 0.04, -0.302, z + 0.05), (90, 0, 0), mat=leds[(i + k) % 4], bevel=0.003)
        r.box(f'Bay{i}', (0.14, 0.012, 0.05), (0.2, -0.302, z - 0.04), mat=vent, bevel=0.006, segments=2)
        for x in (-0.24, 0.24):
            r.box(f'Handle{i}{x}', (0.02, 0.03, 0.12), (x, -0.31, z), mat=handle, bevel=0.008, segments=2)
    for x in (-0.24, 0.24):
        for y in (-0.22, 0.22):
            r.cylinder(f'Foot{x}{y}', 0.03, 0.04, (x, y, 0.02), mat=vent)
