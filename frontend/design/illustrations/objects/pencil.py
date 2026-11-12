"""Hexagonal purple pencil: sharpened wood, graphite tip, metal ferrule and pink eraser, drawing a stroke."""

CAMERA = {'azimuth': -20, 'elevation': 24}


def build(r):
    paint = r.plastic('paint', r.PURPLE, rough=0.3, coat=0.5)
    wood = r.material('wood', '#f0c995', rough=0.6, bump=0.1, bump_scale=200)
    graphite = r.material('graphite', '#2b2f36', rough=0.3, metal=0.3)
    ferrule = r.metal('ferrule', '#d6dbe2', rough=0.2)
    eraser = r.material('eraser', '#ff9fb6', rough=0.7)
    stroke = r.plastic('stroke', r.BLUE, rough=0.3)
    parts = [r.cylinder('Body', 0.07, 0.9, (0, 0, 0), mat=paint, verts=6, bevel=0.008),
             r.cylinder('Wood', 0.07, 0.16, (0, 0, -0.53), mat=wood, radius2=0.022, verts=6, bevel=0.003),
             r.cylinder('Tip', 0.022, 0.05, (0, 0, -0.635), mat=graphite, radius2=0.004, verts=24, bevel=0.002),
             r.cylinder('Ferrule', 0.074, 0.1, (0, 0, 0.5), mat=ferrule, bevel=0.006)]
    for k in range(3):
        parts.append(r.torus(f'Ridge{k}', 0.075, 0.006, (0, 0, 0.47 + k * 0.03), mat=ferrule))
    parts.append(r.cylinder('Eraser', 0.068, 0.1, (0, 0, 0.6), mat=eraser, bevel=0.025))
    r.group('Pencil', parts, location=(0.08, 0, 0.5), rotation=(0, 48, 20))
    r.tube('Stroke', [(-0.55, -0.1, 0.01), (-0.4, -0.2, 0.01), (-0.25, -0.05, 0.01), (-0.12, -0.12, 0.01)], 0.018, stroke)
