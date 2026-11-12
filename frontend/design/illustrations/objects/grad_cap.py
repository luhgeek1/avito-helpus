"""Graduation cap: navy mortarboard, crown, button and a golden tassel."""

CAMERA = {'azimuth': -28, 'elevation': 24}


def build(r):
    cloth = r.fabric('cloth', '#2b3346', bump=0.12)
    trim = r.material('trim', '#3a4560', rough=0.6)
    gold = r.material('gold', r.YELLOW, rough=0.45, sheen=0.5)

    r.lathe('Crown', [(0.0, 0.0), (0.34, 0.0), (0.36, 0.04), (0.37, 0.3), (0.0, 0.3)], mat=cloth, subdiv=1)
    r.box('Board', (0.95, 0.95, 0.05), (0, 0, 0.33), (6, 0, 45), mat=cloth, bevel=0.012, segments=4)
    r.cylinder('Button', 0.05, 0.035, (0, 0, 0.375), mat=trim, bevel=0.012)
    r.tube('Cord', [(0, 0, 0.385), (0.25, -0.12, 0.38), (0.5, -0.2, 0.33), (0.55, -0.22, 0.2)], 0.012, gold)
    r.cylinder('TasselCap', 0.035, 0.05, (0.55, -0.22, 0.18), mat=gold, bevel=0.012)
    for i in range(7):
        dx, dy = (i % 3 - 1) * 0.018, (i // 3 - 1) * 0.018
        r.cylinder(f'Thread{i}', 0.012, 0.18, (0.55 + dx, -0.22 + dy, 0.07), mat=gold, bevel=0.006, radius2=0.009)
