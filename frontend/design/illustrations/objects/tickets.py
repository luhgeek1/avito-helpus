"""Two show tickets with side notches, perforation and «БИЛЕТ» print (culture, events)."""
import math

CAMERA = {'azimuth': -16, 'elevation': 14}
VIVID = True


def outline(width=0.8, height=0.42, notch=0.06):
    hw, hh = width / 2, height / 2
    points = [(-hw, -hh), (hw, -hh)]
    for i in range(9):
        a = math.radians(-90 + 180 * i / 8)
        points.append((hw - notch * math.cos(a), notch * math.sin(a)))
    points += [(hw, hh), (-hw, hh)]
    for i in range(9):
        a = math.radians(90 - 180 * i / 8)
        points.append((-hw + notch * math.cos(a), notch * math.sin(a)))
    return points


def ticket(r, name, colour, location, rotation):
    paper = r.material(f'{name}Paper', colour, rough=0.5, coat=0.2)
    white = r.plastic(f'{name}White', r.DARK, rough=0.4)
    parts = [r.shape(f'{name}Body', outline(), 0.03, (0, 0, 0), mat=paper, bevel=0.012),
             r.text(f'{name}Text', 'БИЛЕТ', 0.11, 0.012, (-0.06, -0.024, 0.03), mat=white),
             r.box(f'{name}Line', (0.34, 0.008, 0.02), (-0.06, -0.022, -0.09), mat=white, bevel=0.005, segments=2)]
    for i in range(7):
        parts.append(r.cylinder(f'{name}Perf{i}', 0.012, 0.01, (0.24, -0.02, -0.15 + i * 0.05), (90, 0, 0), mat=white, bevel=0.002))
    parts.append(r.text(f'{name}Seat', '7', 0.12, 0.012, (0.32, -0.024, 0.0), mat=white))
    return r.group(name, parts, location=location, rotation=rotation)


def build(r):
    ticket(r, 'Back', r.YELLOW, (0.08, 0.1, 0.42), (0, -14, 10))
    ticket(r, 'Front', r.RED, (-0.06, -0.1, 0.3), (0, 10, -6))
