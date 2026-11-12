"""Toy rocket: white body, red nose and fins, porthole, nozzle and a glowing flame (launch)."""
import math

CAMERA = {'azimuth': -20, 'elevation': 8}
VIVID = True


def build(r):
    body = r.plastic('body', '#f6f7fa', rough=0.25, coat=0.6)
    red = r.plastic('red', r.RED, rough=0.25, coat=0.6)
    window = r.material('window', '#5cc4ff', rough=0.05, coat=1.0)
    rim = r.metal('rim', '#d6dbe2', rough=0.2)
    nozzle = r.metal('nozzle', '#8c96a3', rough=0.35)
    flame_outer = r.glow('flameOuter', '#ffa21f', 2.5)
    flame_inner = r.glow('flameInner', '#fff1a8', 4.0)
    parts = [r.lathe('Body', [(0.0, 0.0), (0.2, 0.0), (0.24, 0.15), (0.25, 0.5), (0.22, 0.75), (0.0, 0.76)], mat=body, subdiv=1),
             r.lathe('Nose', [(0.0, 0.74), (0.225, 0.74), (0.18, 0.88), (0.1, 0.98), (0.0, 1.02)], mat=red, subdiv=1),
             r.cylinder('Band', 0.248, 0.05, (0, 0, 0.18), mat=red, bevel=0.01),
             r.cylinder('Window', 0.09, 0.04, (0, -0.235, 0.5), (90, 0, 0), mat=window, bevel=0.012),
             r.torus('WindowRim', 0.095, 0.018, (0, -0.245, 0.5), (90, 0, 0), mat=rim),
             r.lathe('Nozzle', [(0.0, 0.0), (0.12, 0.0), (0.16, -0.1), (0.0, -0.1)], mat=nozzle, subdiv=0),
             r.lathe('FlameOuter', [(0.0, -0.08), (0.14, -0.1), (0.1, -0.3), (0.0, -0.46)], mat=flame_outer, subdiv=2),
             r.lathe('FlameInner', [(0.0, -0.08), (0.08, -0.1), (0.05, -0.24), (0.0, -0.34)], mat=flame_inner, subdiv=2)]
    for i in range(3):
        a = 90 + i * 120
        fin = r.shape(f'Fin{i}', [(0.0, 0.0), (0.2, -0.08), (0.2, 0.06, True), (0.0, 0.3)], 0.04, (0, 0, 0.05), (90, 0, 0), mat=red, bevel=0.015)
        fin.location = (0.2 * math.cos(math.radians(a)), 0.2 * math.sin(math.radians(a)), 0.05)
        fin.rotation_euler = (math.radians(90), 0, math.radians(a))
        parts.append(fin)
    r.group('Rocket', parts, location=(0, 0, 0.52), rotation=(0, 30, 0))
