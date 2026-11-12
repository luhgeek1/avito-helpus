"""Pink piggy bank with a gold ruble coin dropping into the slot (savings)."""

CAMERA = {'azimuth': -38, 'elevation': 14}


def build(r):
    pink = r.plastic('pink', '#ff9fb6', rough=0.3, coat=0.5)
    snout = r.plastic('snout', '#ff86a2', rough=0.3, coat=0.5)
    dark = r.plastic('dark', '#2b2328', rough=0.2, coat=0.8)
    gold = r.metal('gold', '#ffc93f', rough=0.2)

    r.sphere('Body', 0.42, (0, 0, 0.5), scale=(1.25, 1, 0.95), mat=pink)
    r.cylinder('Snout', 0.14, 0.12, (-0.53, 0, 0.5), (0, 90, 0), mat=snout, bevel=0.04)
    for y in (-0.045, 0.045):
        r.sphere(f'Nostril{y}', 0.025, (-0.595, y, 0.5), scale=(0.4, 1, 1.4), mat=dark)
    for y in (-0.15, 0.15):
        r.sphere(f'Eye{y}', 0.032, (-0.43, y * 1.25, 0.66), mat=dark)
        r.cone(f'Ear{y}', 0.09, 0.15, (-0.26, y * 1.3, 0.82), (-0.3, y * 2, 1), mat=snout, bevel=0.02)
    for x in (-0.28, 0.28):
        for y in (-0.2, 0.2):
            r.cylinder(f'Leg{x}{y}', 0.08, 0.16, (x, y, 0.08), mat=pink, bevel=0.03)
    r.tube('Tail', [(0.52, 0, 0.55), (0.62, 0.03, 0.6), (0.6, -0.06, 0.66), (0.66, -0.02, 0.7)], 0.018, snout)
    r.box('Slot', (0.2, 0.035, 0.03), (0.02, 0, 0.9), mat=dark, bevel=0.012, segments=3)
    r.cylinder('Coin', 0.14, 0.035, (0.02, 0, 1.0), (90, 0, 0), mat=gold, bevel=0.012)
    r.text('Ruble', '₽', 0.16, 0.012, (0.02, -0.024, 1.0), mat=r.metal('emboss', '#f0b52a', rough=0.3))
