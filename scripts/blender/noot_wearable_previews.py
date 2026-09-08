"""Render the actual Blender wearable meshes into lightweight inventory thumbnails."""
import bpy,math,os
from mathutils import Vector
import noot_fashion as fashion
STYLES=['sneakers','boots','high-tops','mary-janes','loafers','sandals','slippers','ballet-flats','cap','beret','visor','crown','party-hat','flower-crown','round','square','cat-eye','aviator','heart','star','sport']

def render(styles=STYLES):
    source=bpy.data.scenes['Noot Fashion Atelier']
    scene=bpy.data.scenes.new('Noot wearable thumbnails')
    scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
    scene.render.resolution_x=160;scene.render.resolution_y=160;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
    world=bpy.data.worlds.new('Wearable photo world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.8,.85,.9,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6;scene.world=world
    camdata=bpy.data.cameras.new('Wearable camera');camera=bpy.data.objects.new('Wearable camera',camdata);scene.collection.objects.link(camera);camdata.type='ORTHO';scene.camera=camera
    lights=[]
    for name,pos,power,size in [('Key',(-3,-4,6),450,4),('Fill',(4,-2,3),200,3),('Rim',(2,3,4),400,3)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
        light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=pos;lights.append(light)
    out=os.path.join(fashion.ROOT,'public/mascot/wardrobe');os.makedirs(out,exist_ok=True)
    try:
        for style in styles:
            objects=[o for o in source.objects if o.get('fashion')==style]
            for o in objects:scene.collection.objects.link(o)
            with bpy.context.temp_override(scene=scene,view_layer=scene.view_layers[0]):
                graph=bpy.context.evaluated_depsgraph_get();points=[]
                for o in objects:
                    ev=o.evaluated_get(graph);m=ev.to_mesh();points.extend(v.co.copy() for v in m.vertices);ev.to_mesh_clear()
                lo=Vector(tuple(min(p[k] for p in points) for k in range(3)));hi=Vector(tuple(max(p[k] for p in points) for k in range(3)));center=(lo+hi)*.5
                direction=Vector((.32,-1,.45)).normalized();camera.location=center+direction*6;camera.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
                rot=camera.rotation_euler.to_matrix().inverted();projected=[rot@(p-center) for p in points]
                camdata.ortho_scale=max(max(p[k] for p in projected)-min(p[k] for p in projected) for k in [0,1])*1.18
                for light in lights:light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
                scene.render.filepath=os.path.join(out,style+'.png');bpy.ops.render.render(write_still=True,scene=scene.name)
            for o in objects:scene.collection.objects.unlink(o)
    finally:
        for o in list(scene.objects):bpy.data.objects.remove(o,do_unlink=True)
        bpy.data.scenes.remove(scene);bpy.data.worlds.remove(world)
    print('Rendered inventory models: '+', '.join(styles))
