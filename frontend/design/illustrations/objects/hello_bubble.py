"""Glossy white speech bubble with a flush navy «Привет!» print (welcome banner, invite a friend)."""

CAMERA = {'azimuth': -20, 'elevation': 10}


def outline():
    """Rounded bubble with the tail built into the bottom edge, so it reads as one soft shape."""
    points = []
    for x, y in rig_rect():
        points.append((x, y))
        if (round(x, 3), round(y, 3)) == (-0.36, 0.11):
            points += [(-0.33, 0.11), (-0.44, -0.08), (-0.12, 0.11)]
    return points


def rig_rect():
    import rig
    return rig.rounded_rect(0, 0.42, 1.2, 0.62, 0.24, steps=8)


def build(r):
    bubble_mat = r.plastic('bubble', '#fbfcfe', rough=0.22, coat=0.6)
    # Flush, thin and dark: raised light-blue letters cast shadows and blended into the pale bubble.
    ink = r.material('ink', r.NAVY, rough=0.5)
    r.shape('Bubble', outline(), 0.16, (0, 0, 0.08), mat=bubble_mat, bevel=0.06)
    front = -0.08 - 0.06 * r.BEVEL_SCALE
    r.text('Hello', 'Привет!', 0.27, 0.012, (0, front - 0.002, 0.42), mat=ink)
