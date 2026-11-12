"""Ergonomic office chair: fabric seat and backrest, armrests, gas lift, five-star base with casters."""
import math

CAMERA = {'azimuth': -34, 'elevation': 14}


def build(r):
    cloth = r.fabric('cloth', r.BLUE)
    frame = r.plastic('frame', r.GRAPHITE, rough=0.4)
    chrome = r.metal('chrome', '#d9dde3', rough=0.15)
    wheel = r.rubber('wheel')

    r.box('Seat', (0.62, 0.58, 0.11), (0, 0, 0.62), mat=cloth, bevel=0.045, segments=7)
    r.box('SeatShell', (0.58, 0.54, 0.04), (0, 0, 0.555), mat=frame, bevel=0.015, segments=3)
    r.box('Back', (0.58, 0.1, 0.66), (0, 0.33, 1.07), (-10, 0, 0), mat=cloth, bevel=0.05, segments=7)
    r.box('Spine', (0.1, 0.05, 0.42), (0, 0.33, 0.74), (-12, 0, 0), mat=frame, bevel=0.02, segments=3)
    for side in (-1, 1):
        r.box(f'ArmPost{side}', (0.05, 0.06, 0.2), (0.34 * side, 0.02, 0.7), mat=frame, bevel=0.015, segments=3)
        r.box(f'ArmPad{side}', (0.09, 0.32, 0.045), (0.34 * side, 0.0, 0.81), mat=frame, bevel=0.02, segments=4)
    r.cylinder('Lift', 0.035, 0.36, (0, 0, 0.36), mat=chrome)
    r.cylinder('LiftCover', 0.05, 0.14, (0, 0, 0.22), mat=frame, bevel=0.01)
    r.cylinder('Hub', 0.075, 0.07, (0, 0, 0.13), mat=frame, bevel=0.02)
    for i in range(5):
        angle = math.radians(90 + i * 72)
        x, y = math.cos(angle), math.sin(angle)
        r.box(f'Leg{i}', (0.36, 0.06, 0.05), (0.18 * x, 0.18 * y, 0.12), (0, 0, math.degrees(angle)), mat=frame, bevel=0.02, segments=4)
        r.cylinder(f'Caster{i}', 0.045, 0.04, (0.34 * x, 0.34 * y, 0.05), (0, 90, math.degrees(angle) + 90), mat=wheel, bevel=0.012)
        r.box(f'Fork{i}', (0.04, 0.05, 0.06), (0.34 * x, 0.34 * y, 0.1), mat=frame, bevel=0.012, segments=3)
