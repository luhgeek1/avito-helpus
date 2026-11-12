"""Classic football: truncated icosahedron with black pentagons, white hexagons and stitched seams."""
import bmesh
import bpy

CAMERA = {'azimuth': -20, 'elevation': 14}


def build(r):
    white = r.material('white', '#fbfbfb', rough=0.35, coat=0.4)
    black = r.material('black', '#24272d', rough=0.35, coat=0.4)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.4)
    bmesh.ops.bevel(bm, geom=bm.verts[:], offset=33.33, offset_type='PERCENT', affect='VERTICES', segments=1)
    for face in bm.faces:
        face.material_index = 1 if len(face.verts) == 5 else 0
    bmesh.ops.inset_individual(bm, faces=bm.faces[:], thickness=0.012, depth=-0.012)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
    ball = r._mesh_object('Ball', bm)
    ball.data.materials.append(white)
    ball.data.materials.append(black)
    for poly in ball.data.polygons:
        poly.use_smooth = True
    cast = ball.modifiers.new('Cast', 'CAST')
    cast.factor = 1.0
    r.subsurf(ball, 1)
    ball.location = (0, 0, 0.4)
    ball.rotation_euler = (0.3, 0.2, 0.1)
    bpy.context.view_layer.update()
