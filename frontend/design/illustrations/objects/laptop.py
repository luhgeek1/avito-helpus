"""Aluminium laptop with keyboard, trackpad and a colourful code editor on screen."""
import math

import bpy

CAMERA = {'azimuth': -30, 'elevation': 24}

KEY = 0.074
GAP = 0.012
COLS = 13
CODE_LINES = [
    # (indent, width, colour) on a 1.0-wide editor
    (0.00, 0.22, '#965eeb'), (0.24, 0.30, '#ffffff'),
    (0.06, 0.18, '#00aaff'), (0.26, 0.24, '#02d15c'),
    (0.06, 0.34, '#ffffff'),
    (0.12, 0.20, '#f79900'), (0.34, 0.16, '#ffffff'),
    (0.12, 0.28, '#00aaff'),
    (0.06, 0.12, '#ff4053'),
    (0.00, 0.30, '#02d15c'),
]


def build(r):
    alu = r.material('alu', '#d5dae1', metal=1.0, rough=0.3)
    alu_dark = r.material('aluDark', '#b8bfc9', metal=1.0, rough=0.22)
    keys = r.material('keys', '#2c3038', rough=0.55)
    glass = r.material('glass', '#0b0d10', rough=0.12, coat=1.0)
    screen = r.material('screen', '#0e1a2e', rough=0.3, emission='#13233d', strength=1.0)
    panel = r.material('panel', '#16243c', rough=0.3, emission='#1b2d4b', strength=1.0)

    # Base with keyboard and trackpad.
    r.box('Base', (1.30, 0.90, 0.045), (0, 0, 0.0225), mat=alu, bevel=0.02, segments=8)
    r.box('KeyWell', (1.16, 0.44, 0.004), (0, 0.13, 0.045), mat=alu_dark, bevel=0.012, segments=4)
    width = COLS * KEY + (COLS - 1) * GAP
    for row in range(5):
        y = 0.31 - row * (KEY + GAP)
        if row == 4:
            sizes = [KEY * 1.4, KEY, KEY * 5.6 + GAP * 4, KEY, KEY * 1.4]
            sizes.append(width - sum(sizes) - GAP * len(sizes))
        else:
            sizes = [KEY] * COLS
        x = -width / 2
        for col, w in enumerate(sizes):
            r.box(f'Key{row}.{col}', (w, KEY * 0.92, 0.012), (x + w / 2, y, 0.052), mat=keys, bevel=0.007, segments=3)
            x += w + GAP
    r.box('Trackpad', (0.44, 0.27, 0.003), (0, -0.25, 0.0455), mat=alu_dark, bevel=0.016, segments=5)

    # Lid built closed, then rotated open around the hinge.
    hinge = bpy.data.objects.new('Hinge', None)
    bpy.context.collection.objects.link(hinge)
    hinge.location = (0, 0.45, 0.05)
    parts = [
        r.box('Lid', (1.30, 0.86, 0.028), (0, -0.43, 0.014), mat=alu, bevel=0.018, segments=8),
        r.box('Bezel', (1.27, 0.83, 0.004), (0, -0.43, -0.001), mat=glass, bevel=0.016, segments=5),
        r.box('Display', (1.18, 0.73, 0.002), (0, -0.45, -0.0035), mat=screen, bevel=0.004, segments=2),
        r.box('Sidebar', (0.2, 0.66, 0.001), (-0.47, -0.43, -0.0048), mat=panel, bevel=0.01, segments=2),
        r.cylinder('Webcam', 0.008, 0.002, (0, -0.84, -0.003), mat=keys),
    ]
    for i in range(6):
        colour = ('#00aaff', '#ffffff', '#ffffff', '#02d15c', '#ffffff', '#965eeb')[i]
        mat = r.material(f'side{i}', colour, emission=colour, strength=0.9)
        parts.append(r.box(f'SideItem{i}', (0.12 if i else 0.08, 0.026, 0.001), (-0.48, -0.74 + i * 0.07, -0.0056), mat=mat, bevel=0.012, segments=3))
    for i, (indent, w, colour) in enumerate(CODE_LINES):
        mat = r.material(f'code{i}', colour, emission=colour, strength=1.2)
        left = -0.31 + indent * 0.8
        parts.append(r.box(f'Code{i}', (w * 0.8, 0.026, 0.001), (left + w * 0.4, -0.76 + i * 0.062, -0.0056), mat=mat, bevel=0.012, segments=3))
    for obj in parts:
        obj.parent = hinge
    hinge.rotation_euler = (math.radians(-108), 0, 0)
