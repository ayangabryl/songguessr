"""Render the existing Noot source for social artwork; run in background Blender.
blender -b assets/noot/noot.blend --python scripts/blender/noot_og.py
"""
import bpy, os, sys, math
from mathutils import Vector
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts/blender'))
import noot_asset
scene = bpy.data.scenes['Noot Studio']
bpy.context.window.scene = scene
for o in scene.objects:
    if o.type in {'MESH','ARMATURE'}:
        o.hide_render = not o.get('noot_asset', False) or bool(o.get('wardrobe'))
noot_asset.select_clip('Idle')
scene.frame_set(1)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.resolution_x = 1200
scene.render.resolution_y = 1200
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.exposure = -.35
cam = scene.camera
cam.location = (-1.0, -9, 2.05)
cam.rotation_euler = (Vector((0,0,1.87))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 4.10
scene.render.filepath = os.path.join(ROOT, 'assets/og/noot-render.png')
bpy.ops.render.render(write_still=True, scene=scene.name)
