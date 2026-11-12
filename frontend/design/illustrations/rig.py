"""Shared studio rig for portal illustrations: scene, lights, camera, materials and primitives.

Units are metres, Z is up. Like Avito's category renders, objects float without a floor or shadow:
pearly near-white materials take their colour from coloured lights, dark parts are deep navy accents.
"""
import colorsys
import math
import os

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'portal', 'illustrations'))
FONT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'portal', 'fonts', 'inter-bold.ttf'))

# Avito brand hues, slightly softened for physically lit materials.
BLUE = '#1fa8ff'
GREEN = '#14cc66'
RED = '#ff4a5c'
PURPLE = '#9a64f0'
ORANGE = '#ffa21f'
YELLOW = '#ffcc33'
WHITE = '#f3f5f8'
GREY = '#c6ccd5'
GRAPHITE = '#3a3f48'
DARK = '#23262c'
NAVY = '#151b2e'


def srgb(hex_color):
    """Convert #rrggbb to a linear RGBA tuple for shader inputs."""
    h = hex_color.lstrip('#')
    channels = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return (*linear, 1.0)


def _set(node, names, value):
    for name in (names if isinstance(names, tuple) else (names,)):
        if name in node.inputs:
            node.inputs[name].default_value = value
            return


# ---------- Scene ----------

def clear():
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.lights,
                 bpy.data.cameras, bpy.data.images, bpy.data.worlds):
        for item in list(coll):
            coll.remove(item)


def setup(size=480, samples=256):
    clear()
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for device in prefs.devices:
            device.use = True
        scene.cycles.device = 'GPU'
    except Exception as error:  # CPU fallback keeps renders reproducible anywhere
        print('GPU unavailable:', error)
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    render = scene.render
    render.resolution_x = render.resolution_y = size
    render.resolution_percentage = 100
    render.film_transparent = True
    render.image_settings.file_format = 'WEBP'
    render.image_settings.color_mode = 'RGBA'
    render.image_settings.quality = 90
    view = scene.view_settings
    # Khronos PBR Neutral keeps base colours true, which suits product renders.
    try:
        view.view_transform = 'Khronos PBR Neutral'
    except TypeError:
        view.view_transform = 'AgX'
    _world()
    _lights()


def _world():
    world = bpy.data.worlds.new('World')
    bpy.context.scene.world = world
    try:
        world.use_nodes = True
    except AttributeError:
        pass
    nodes = world.node_tree.nodes
    background = nodes['Background']
    folder = bpy.utils.system_resource('DATAFILES', path='studiolights/world') or ''
    for file in ('studio.exr', 'interior.exr', 'city.exr'):
        path = os.path.join(folder, file)
        if os.path.exists(path):
            env = nodes.new('ShaderNodeTexEnvironment')
            env.image = bpy.data.images.load(path)
            # Lift the studio's dark zones so metal reflections stay bright without a floor.
            lift = nodes.new('ShaderNodeMix')
            lift.data_type = 'RGBA'
            lift.inputs['Factor'].default_value = 0.5
            lift.inputs['B'].default_value = (0.78, 0.8, 0.84, 1)
            world.node_tree.links.new(env.outputs['Color'], lift.inputs['A'])
            world.node_tree.links.new(lift.outputs['Result'], background.inputs['Color'])
            break
    else:
        background.inputs['Color'].default_value = (0.8, 0.8, 0.8, 1)
    # Bright studio in reflections keeps metal and gloss crisp; dim in diffuse keeps the shading contrasty.
    path = nodes.new('ShaderNodeLightPath')
    strength = nodes.new('ShaderNodeMath')
    strength.operation = 'MULTIPLY_ADD'
    strength.inputs[1].default_value = 1.1
    strength.inputs[2].default_value = 0.1
    world.node_tree.links.new(path.outputs['Is Glossy Ray'], strength.inputs[0])
    world.node_tree.links.new(strength.outputs['Value'], background.inputs['Strength'])


def area_light(name, location, size, energy, target=(0, 0, 0.4), color=(1, 1, 1)):
    data = bpy.data.lights.new(name, 'AREA')
    data.size = size
    data.energy = energy
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()
    return obj


def _lights():
    # Coloured, fairly small lights give crisp highlights and the pearly blue-violet-mint gradients.
    area_light('Key', (-3.0, -3.2, 3.6), 1.8, 1050, color=(0.55, 0.68, 1.0))
    area_light('Rim', (3.6, 1.2, 1.6), 1.6, 1300, color=(0.35, 1.0, 0.6))
    area_light('Back', (-2.6, 3.4, 2.8), 2.0, 1000, color=(0.72, 0.45, 1.0))
    area_light('Top', (0.4, -0.6, 5.5), 3.0, 140)


# Objects recognised by their colour (heart, tree, food) set VIVID = True in their module.
VIVID = False


def tone(hex_color, vivid=False):
    """Map a design colour to the Avito render palette: pearly pastels and deep navy darks."""
    h = hex_color.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hue, sat, val = colorsys.rgb_to_hsv(r, g, b)
    if val < 0.32:
        return NAVY
    if vivid or VIVID:
        sat *= 0.82
        val += (1 - val) * 0.2
    else:
        sat *= 0.32 if hue < 0.16 or hue > 0.9 else 0.45
        val += (1 - val) * 0.5
    return '#%02x%02x%02x' % tuple(round(c * 255) for c in colorsys.hsv_to_rgb(hue, sat, val))


# ---------- Materials ----------

def material(name, color, rough=0.45, metal=0.0, coat=0.0, sheen=0.0, bump=0.0, bump_scale=140.0,
             emission=None, strength=1.0, alpha=1.0, vivid=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes['Principled BSDF']
    if not emission:
        color = tone(color, vivid=vivid or metal > 0)
        if not sheen and bump < 0.2 and rough < 0.6:
            rough *= 0.8
            coat = max(coat, 0.35)
    _set(bsdf, 'Base Color', srgb(color))
    _set(bsdf, 'Roughness', rough)
    _set(bsdf, 'Metallic', metal)
    _set(bsdf, ('Coat Weight', 'Clearcoat'), coat)
    _set(bsdf, ('Sheen Weight', 'Sheen'), sheen)
    _set(bsdf, 'Alpha', alpha)
    if emission:
        _set(bsdf, ('Emission Color', 'Emission'), srgb(emission))
        _set(bsdf, 'Emission Strength', strength)
    if bump:
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = bump_scale
        noise.inputs['Detail'].default_value = 10
        bump_node = nodes.new('ShaderNodeBump')
        bump_node.inputs['Strength'].default_value = bump
        links.new(noise.outputs['Fac'], bump_node.inputs['Height'])
        links.new(bump_node.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def plastic(name, color, rough=0.34, coat=0.25, vivid=False):
    return material(name, color, rough=rough, coat=coat, vivid=vivid)


def matte(name, color, rough=0.72):
    return material(name, color, rough=rough)


def metal(name, color='#cdd2da', rough=0.24):
    # Satin metal reads evenly without a floor or bright surroundings to reflect.
    return material(name, color, rough=max(rough, 0.32), metal=1.0)


def rubber(name, color=DARK):
    return material(name, color, rough=0.62)


def fabric(name, color, bump=0.18):
    return material(name, color, rough=0.88, sheen=0.6, bump=bump, bump_scale=700)


def paper(name, color='#fbfbfa'):
    return material(name, color, rough=0.82, bump=0.03, bump_scale=400)


def glow(name, color, strength=1.4):
    return material(name, color, emission=color, strength=strength)


def glass(name, color='#ffffff', rough=0.03):
    mat = material(name, color, rough=rough)
    bsdf = mat.node_tree.nodes['Principled BSDF']
    _set(bsdf, ('Transmission Weight', 'Transmission'), 1.0)
    _set(bsdf, 'IOR', 1.45)
    return mat


# ---------- Primitives ----------

def _mesh_object(name, bm):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


BEVEL_SCALE = 0.7  # crisper edges read as stricter, more product-like forms


def _finish(obj, mat, location, rotation, bevel, segments, angle=None):
    obj.location = location
    obj.rotation_euler = Euler([math.radians(a) for a in rotation])
    if mat:
        obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if bevel:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel * BEVEL_SCALE
        mod.segments = segments
        if angle is None:
            mod.limit_method = 'NONE'
        else:
            mod.limit_method = 'ANGLE'
            mod.angle_limit = math.radians(angle)
        mod.harden_normals = True
    return obj


def box(name, size, location=(0, 0, 0), rotation=(0, 0, 0), mat=None, bevel=0.02, segments=6):
    """Rounded box; rotation in degrees."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    return _finish(_mesh_object(name, bm), mat, location, rotation, bevel, segments)


def cylinder(name, radius, depth, location=(0, 0, 0), rotation=(0, 0, 0), mat=None, bevel=0.005,
             segments=4, verts=64, radius2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=radius,
                          radius2=radius if radius2 is None else radius2, depth=depth)
    return _finish(_mesh_object(name, bm), mat, location, rotation, bevel, segments, angle=50)


def sphere(name, radius, location=(0, 0, 0), scale=(1, 1, 1), rotation=(0, 0, 0), mat=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=72, v_segments=36, radius=radius)
    obj = _finish(_mesh_object(name, bm), mat, location, rotation, 0, 0)
    obj.scale = scale
    return obj


def torus(name, major, minor, location=(0, 0, 0), rotation=(0, 0, 0), mat=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=96, minor_segments=32)
    obj = bpy.context.active_object
    obj.name = name
    return _finish(obj, mat, location, rotation, 0, 0)


def tube(name, points, radius, mat=None, closed=False, caps=True):
    """Smooth tube along bezier points with auto handles."""
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 10
    curve.resolution_u = 32
    curve.use_fill_caps = caps
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for bp, point in zip(spline.bezier_points, points):
        bp.co = point
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    spline.use_cyclic_u = closed
    spline.use_smooth = True
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    if mat:
        curve.materials.append(mat)
    return obj


def dashes(name, start, end, mat, dash=0.03, gap=0.018, radius=0.004):
    """Row of short capsules along a straight line, e.g. stitching."""
    start, end = Vector(start), Vector(end)
    direction = end - start
    length = direction.length
    step = dash + gap
    rotation = direction.to_track_quat('Z', 'Y').to_euler()
    count = max(1, int(length // step))
    for i in range(count):
        center = start + direction.normalized() * (i * step + dash / 2)
        obj = cylinder(f'{name}.{i}', radius, dash, center, mat=mat, bevel=radius * 0.9, segments=3, verts=12)
        obj.rotation_euler = rotation


def cone(name, radius, height, base, direction, mat=None, radius2=0.0, bevel=0.004):
    """Cone (or frustum) whose base centre sits at `base`, pointing along `direction`."""
    direction = Vector(direction).normalized()
    obj = cylinder(name, radius, height, mat=mat, radius2=radius2, bevel=bevel, segments=3)
    obj.location = Vector(base) + direction * (height / 2)
    obj.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    return obj


def lathe(name, profile, location=(0, 0, 0), rotation=(0, 0, 0), mat=None, steps=96, subdiv=0):
    """Surface of revolution around Z from (radius, z) profile points."""
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=2 * math.pi, steps=steps,
                   use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = _finish(_mesh_object(name, bm), mat, location, rotation, 0, 0)
    if subdiv:
        mod = obj.modifiers.new('Subdivision', 'SUBSURF')
        mod.levels = mod.render_levels = subdiv
    return obj


def shape(name, points, depth, location=(0, 0, 0), rotation=(90, 0, 0), mat=None, bevel=0.01, holes=()):
    """Extruded 2D outline. Points are (x, y) for sharp corners or (x, y, True) for smooth ones.

    The default rotation stands the outline upright, facing the camera (-Y).
    """
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '2D'
    curve.fill_mode = 'BOTH'
    curve.extrude = depth / 2
    curve.bevel_depth = bevel * BEVEL_SCALE
    curve.bevel_resolution = 6
    curve.resolution_u = 28
    for outline in (points, *holes):
        spline = curve.splines.new('BEZIER')
        spline.bezier_points.add(len(outline) - 1)
        for bp, point in zip(spline.bezier_points, outline):
            bp.co = (point[0], point[1], 0)
            kind = 'AUTO' if len(point) > 2 and point[2] else 'VECTOR'
            bp.handle_left_type = bp.handle_right_type = kind
        spline.use_cyclic_u = True
        spline.use_smooth = True
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = Euler([math.radians(a) for a in rotation])
    if mat:
        curve.materials.append(mat)
    return obj


def circle(cx, cy, radius, count=16):
    """Smooth circular outline for shape()."""
    return [(cx + radius * math.cos(2 * math.pi * i / count), cy + radius * math.sin(2 * math.pi * i / count), True)
            for i in range(count)]


def text(name, body, size, depth, location, rotation=(90, 0, 0), mat=None, align='CENTER'):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = body
    curve.size = size
    curve.extrude = depth / 2
    curve.bevel_depth = depth * 0.12
    curve.align_x = align
    curve.align_y = 'CENTER'
    curve.font = bpy.data.fonts.load(FONT, check_existing=True)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = Euler([math.radians(a) for a in rotation])
    if mat:
        curve.materials.append(mat)
    return obj


def stripes(obj, mats, count, axis='Z'):
    """Alternate materials by azimuth around the object's local axis (umbrella panels, beach ball)."""
    offset = len(obj.data.materials)
    for mat in mats:
        obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        c = poly.center
        angle = math.atan2(c.y, c.x) if axis == 'Z' else math.atan2(c.z, c.y)
        poly.material_index = offset + int(((angle + math.pi) / (2 * math.pi)) * count) % len(mats)


def half_sphere(name, radius, location=(0, 0, 0), scale=(1, 1, 1), rotation=(0, 0, 0), mat=None):
    """Upper hemisphere (open at the bottom), useful for hoods, domes and bowls."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=72, v_segments=36, radius=radius)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0), plane_no=(0, 0, 1),
                           clear_inner=True)
    obj = _finish(_mesh_object(name, bm), mat, location, rotation, 0, 0)
    obj.scale = scale
    solid = obj.modifiers.new('Solidify', 'SOLIDIFY')
    solid.thickness = radius * 0.04
    return obj


def rounded_rect(cx, cy, width, height, radius, steps=5):
    """Outline points of a rounded rectangle for shape()."""
    points = []
    corners = ((cx + width / 2 - radius, cy + height / 2 - radius, 0), (cx - width / 2 + radius, cy + height / 2 - radius, 90),
               (cx - width / 2 + radius, cy - height / 2 + radius, 180), (cx + width / 2 - radius, cy - height / 2 + radius, 270))
    for x, y, start in corners:
        for i in range(steps + 1):
            a = math.radians(start + 90 * i / steps)
            points.append((x + radius * math.cos(a), y + radius * math.sin(a)))
    return points


def group(name, objects, location=(0, 0, 0), rotation=(0, 0, 0)):
    """Parent objects to an empty so the assembly can be moved and rotated as one."""
    empty = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(empty)
    empty.location = location
    empty.rotation_euler = Euler([math.radians(a) for a in rotation])
    for obj in objects:
        obj.parent = empty
    return empty


def subsurf(obj, levels=2):
    mod = obj.modifiers.new('Subdivision', 'SUBSURF')
    mod.levels = mod.render_levels = levels
    return obj


# ---------- Camera and render ----------

def _corners():
    bpy.context.view_layer.update()
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type in {'MESH', 'CURVE', 'FONT'}:
            points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    return points


def render(name, azimuth=-36, elevation=20, focal=85, fill=0.94):
    """Frame all objects from the given angle so they fill `fill` of the square, then render to OUT_DIR."""
    scene = bpy.context.scene
    data = bpy.data.cameras.new('Camera')
    data.lens = focal
    data.sensor_width = 36
    camera = bpy.data.objects.new('Camera', data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera

    points = _corners()
    center = sum(points, Vector()) / len(points)
    az, el = math.radians(azimuth), math.radians(elevation)
    direction = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    distance = 6.0
    for _ in range(6):
        camera.location = center + direction * distance
        camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        projected = [world_to_camera_view(scene, camera, p) for p in points]
        xs, ys = [p.x for p in projected], [p.y for p in projected]
        span = max(max(xs) - min(xs), max(ys) - min(ys))
        data.shift_x += (max(xs) + min(xs)) / 2 - 0.5
        data.shift_y += (max(ys) + min(ys)) / 2 - 0.5
        distance *= span / fill

    os.makedirs(OUT_DIR, exist_ok=True)
    scene.render.filepath = os.path.join(OUT_DIR, f'{name}.webp')
    bpy.ops.render.render(write_still=True)
