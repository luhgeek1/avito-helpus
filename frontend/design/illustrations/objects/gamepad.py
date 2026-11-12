"""White gamepad with four brand-coloured face buttons, D-pad, analog sticks and shoulder buttons."""

CAMERA = {'azimuth': -16, 'elevation': 40}
VIVID = True

OUTLINE = [(-0.55, 0.05, True), (-0.5, 0.25, True), (-0.3, 0.3, True), (0, 0.27, True), (0.3, 0.3, True),
           (0.5, 0.25, True), (0.55, 0.05, True), (0.5, -0.25, True), (0.38, -0.37, True), (0.25, -0.31, True),
           (0.14, -0.16, True), (-0.14, -0.16, True), (-0.25, -0.31, True), (-0.38, -0.37, True), (-0.5, -0.25, True)]


def build(r):
    shell = r.plastic('shell', '#f4f6f9', rough=0.3)
    dark = r.plastic('dark', r.GRAPHITE, rough=0.4)
    stick = r.rubber('stick', '#2a2e35')
    r.shape('Body', OUTLINE, 0.14, (0, 0, 0.12), (0, 0, 0), mat=shell, bevel=0.05)
    top = 0.24
    for i, (dx, dy, colour) in enumerate(((0, 0.085, r.BLUE), (0.085, 0, r.RED), (0, -0.085, r.GREEN), (-0.085, 0, r.PURPLE))):
        r.cylinder(f'Button{i}', 0.042, 0.04, (0.33 + dx, 0.06 + dy, top), mat=r.plastic(f'b{i}', colour, rough=0.22), bevel=0.014)
    r.box('PadH', (0.2, 0.064, 0.03), (-0.33, 0.06, top), mat=dark, bevel=0.01, segments=3)
    r.box('PadV', (0.064, 0.2, 0.03), (-0.33, 0.06, top), mat=dark, bevel=0.01, segments=3)
    for x in (-0.15, 0.15):
        r.cylinder(f'StickBase{x}', 0.075, 0.03, (x, -0.08, top - 0.005), mat=dark, bevel=0.01)
        r.cylinder(f'StickCap{x}', 0.058, 0.05, (x, -0.08, top + 0.04), mat=stick, bevel=0.022)
    for x in (-0.05, 0.05):
        r.box(f'Menu{x}', (0.05, 0.022, 0.016), (x, 0.13, top - 0.005), mat=dark, bevel=0.007, segments=3)
    r.cylinder('Led', 0.018, 0.012, (0, 0.03, top - 0.005), mat=r.glow('led', r.BLUE, 2.0), bevel=0.004)
    for x in (-0.37, 0.37):
        r.box(f'Shoulder{x}', (0.22, 0.07, 0.07), (x, 0.27, 0.16), (0, 0, -8 if x < 0 else 8), mat=dark, bevel=0.03, segments=5)
