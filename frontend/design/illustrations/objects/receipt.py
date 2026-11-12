"""Paper receipt with a zigzag edge and a stack of gold coins (tax refund)."""

CAMERA = {'azimuth': -22, 'elevation': 14}


def zigzag_outline(width=0.5, height=0.9, teeth=8):
    half = width / 2
    points = [(-half, height), (half, height)]
    step = width / teeth
    for i in range(teeth * 2 + 1):
        x = half - i * step / 2
        points.append((x, 0.04 if i % 2 == 0 else 0.0))
    return points


def build(r):
    paper = r.paper('paper')
    ink = r.matte('ink', '#9aa3ae')
    total = r.matte('total', '#2b2f36')
    green = r.plastic('green', r.GREEN, rough=0.3)
    gold = r.metal('gold', '#ffc93f', rough=0.22)

    parts = [r.shape('Receipt', zigzag_outline(), 0.01, (0, 0, 0), mat=paper, bevel=0.004)]
    for i, (w, x) in enumerate(((0.3, -0.06), (0.22, -0.1), (0.34, -0.04), (0.18, -0.12), (0.28, -0.07))):
        parts.append(r.box(f'Line{i}', (w, 0.004, 0.022), (x, -0.008, 0.76 - i * 0.08), mat=ink, bevel=0.004, segments=2))
        parts.append(r.box(f'Price{i}', (0.06, 0.004, 0.022), (0.17, -0.008, 0.76 - i * 0.08), mat=ink, bevel=0.004, segments=2))
    parts.append(r.box('Divider', (0.4, 0.004, 0.008), (0, -0.008, 0.33), mat=total, bevel=0.002, segments=1))
    parts.append(r.box('Total', (0.16, 0.004, 0.04), (-0.12, -0.008, 0.25), mat=total, bevel=0.006, segments=2))
    parts.append(r.box('Refund', (0.14, 0.006, 0.06), (0.13, -0.01, 0.25), mat=green, bevel=0.012, segments=3))
    r.group('Paper', parts, location=(-0.12, 0.05, 0.02), rotation=(-10, 0, 6))
    for i in range(4):
        r.cylinder(f'Coin{i}', 0.15, 0.05, (0.3 + (i % 2) * 0.012, -0.12, 0.03 + i * 0.054), mat=gold, bevel=0.012)
    r.text('Ruble', '₽', 0.13, 0.012, (0.31, -0.12, 0.215), (0, 0, 0), mat=r.metal('emboss', '#f0b52a', rough=0.3))
