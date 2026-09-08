"""Editable Noot source. Run build(), animate(), export() separately via Blender MCP.

Coordinates: Blender Z up, -Y forward. Export converts to Three.js Y up, +Z forward.
No external generation service or texture dependency is used.
"""
import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
TAU = math.tau
DEPTH = .84
PROFILE = [(.24, .015), (.28,.40), (.40,.69), (.60,.86), (.85,.97),
           (1.10,.99),(1.40,.94),(1.70,.90),(2.00,.845),(2.20,.81),
           (2.40,.74),(2.60,.58),(2.75,.34),(2.90,.16),(3.03,.105),(3.14,.095)]

def smooth(t):
    t = min(1, max(0, t))
    return t*t*(3-2*t)

def radius(z):
    for i in range(len(PROFILE)-1):
        a,b=PROFILE[i:i+2]
        if z <= b[0]:
            p,n=PROFILE[max(0,i-1)],PROFILE[min(len(PROFILE)-1,i+2)]
            t=(z-a[0])/(b[0]-a[0]); t2=t*t; t3=t2*t
            m0=(b[1]-p[1])/(b[0]-p[0])*(b[0]-a[0])
            m1=(n[1]-a[1])/(n[0]-a[0])*(b[0]-a[0])
            return max(.001,(2*t3-3*t2+1)*a[1]+(t3-2*t2+t)*m0+(-2*t3+3*t2)*b[1]+(t3-t2)*m1)
    return .001

def front(x,z):
    return -DEPTH*math.sqrt(max(.0001,radius(z)**2-x*x))

def mat(name, color, rough=.55, metal=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    # Hex inputs are sRGB. glTF PBR factors must be linear.
    rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)]
    linear=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb]
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*linear,1)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    m.diffuse_color=(*linear,1)
    return m

def mesh(name, verts, faces, material):
    data=bpy.data.meshes.new(name); data.from_pydata(verts,[],faces); data.update()
    o=bpy.data.objects.new(name,data); bpy.context.scene.collection.objects.link(o)
    if material: data.materials.append(material)
    for p in data.polygons: p.use_smooth=True
    return o

def active(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.context.view_layer.objects.active=o

def apply(o, mod):
    active(o); bpy.ops.object.modifier_apply(modifier=mod.name)

def ellipsoid(name, center, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=center)
    o=bpy.context.object; o.name=name
    for v in o.data.vertices:
        v.co.x*=scale[0]; v.co.y*=scale[1]; v.co.z*=scale[2]
    o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth=True
    # Bake world coordinates, keeping every deforming mesh at identity.
    for v in o.data.vertices: v.co+=o.location
    o.location=(0,0,0)
    return o

def tube(name, points, r, material, resolution=3):
    curve=bpy.data.curves.new(name,'CURVE'); curve.dimensions='3D'
    curve.bevel_depth=r; curve.bevel_resolution=resolution; curve.use_fill_caps=True
    s=curve.splines.new('POLY'); s.points.add(len(points)-1)
    for i,(p,co) in enumerate(zip(s.points,points)):
        p.co=(*co,1)
        if 'Brow' in name: p.radius=min(1,.15+min(i,len(points)-1-i)*.52)
    o=bpy.data.objects.new(name,curve); bpy.context.scene.collection.objects.link(o)
    curve.materials.append(material); active(o); bpy.ops.object.convert(target='MESH')
    return bpy.context.object

def bind(o, weights):
    o.parent=rig
    groups={}
    for v in o.data.vertices:
        for name,w in weights(v.co).items():
            if w<1e-5: continue
            if name not in groups: groups[name]=o.vertex_groups.new(name=name)
            groups[name].add([v.index],w,'REPLACE')
    m=o.modifiers.new('Noot skin','ARMATURE'); m.object=rig
    o['noot_asset']=True
    return o

def rigid(o, bone='head'):
    return bind(o,lambda p:{bone:1})

def body_weights(p):
    head=smooth((p.z-1.08)/.48)
    stem=smooth((p.z-2.73)/.46)
    tip=smooth((p.z-3.23)/.43)
    chest=smooth((p.z-.45)/.95)
    return {'pelvis':(1-head)*(1-chest),'chest':(1-head)*chest,
            'head':head*(1-stem),'note_stem':head*stem*(1-tip),'note_tip':head*stem*tip}

def oval(name,cx,cz,rx,rz,material,offset=.008,bulge=0,eye=None):
    verts=[(cx,front(cx,cz)-offset-bulge,cz)]; faces=[]
    rings=10; sectors=48
    def coord(x,z,r):
        depth=front(x,z)-offset-bulge*(1-r*r)
        if eye:
            ex,ez,erx,erz=eye
            er=((x-ex)/erx)**2+((z-ez)/erz)**2
            depth=front(x,z)-.006-.008*max(0,1-er)-offset
        return (x,depth,z)
    verts[0]=coord(cx,cz,0)
    for i in range(1,rings+1):
        r=i/rings
        for j in range(sectors):
            a=j/sectors*TAU
            verts.append(coord(cx+rx*r*math.cos(a),cz+rz*r*math.sin(a),r))
    for j in range(sectors): faces.append((0,1+j,1+(j+1)%sectors))
    for i in range(rings-1):
        for j in range(sectors):
            a=1+i*sectors+j; b=1+i*sectors+(j+1)%sectors
            faces.append((a,a+sectors,b+sectors,b))
    return mesh(name,verts,faces,material)

def morph(o,name,coords):
    if not o.data.shape_keys: o.shape_key_add(name='Basis')
    key=o.shape_key_add(name=name)
    for p,co in zip(key.data,coords): p.co=co
    key.value=0
    return key

def axial_cup(name,sign,cx,cy,cz,ry,rz,depth,bevel,material):
    """Closed rounded cylinder along the ear axis, with a bevelled face."""
    seg=64
    rings=[(-depth/2,.77),(-depth/2+bevel*.20,.94),(-depth/2+bevel,.999),
           (depth/2-bevel,.999),(depth/2-bevel*.20,.94),(depth/2,.77)]
    verts=[]; faces=[]
    for x,r in rings:
        for j in range(seg):
            a=j/seg*TAU; verts.append((sign*(cx+x),cy+math.cos(a)*ry*r,cz+math.sin(a)*rz*r))
    for i in range(len(rings)-1):
        for j in range(seg):
            a=i*seg+j; b=i*seg+(j+1)%seg; faces.append((a,b,b+seg,a+seg))
    for index,end in [(0,False),(len(rings)-1,True)]:
        center=len(verts); verts.append((sign*(cx+rings[index][0]),cy,cz))
        for j in range(seg):
            a=index*seg+j; b=index*seg+(j+1)%seg
            faces.append((center,a,b) if end else (center,b,a))
    if sign<0: faces=[tuple(reversed(f)) for f in faces]
    o=rigid(mesh(name,verts,faces,material)); o['headgear']='headphones'
    return o

def vertex_tint(o,color_fn,alpha_fn=None):
    attr=o.data.color_attributes.new(name='Noot_Color',type='FLOAT_COLOR',domain='POINT')
    for v in o.data.vertices: attr.data[v.index].color=(*color_fn(v.co),alpha_fn(v.co) if alpha_fn else 1)
    material=o.data.materials[0]
    node=material.node_tree.nodes.get('Noot_Color')
    if not node:
        node=material.node_tree.nodes.new('ShaderNodeVertexColor'); node.name='Noot_Color'; node.layer_name='Noot_Color'
        material.node_tree.links.new(node.outputs['Color'],material.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    if alpha_fn:
        material.node_tree.links.new(node.outputs['Alpha'],material.node_tree.nodes['Principled BSDF'].inputs['Alpha'])
        material.surface_render_method='BLENDED'
        o.visible_shadow=False
    return o

def pillow_note(poly,material):
    """Round the entire volume: depth follows distance to the music-note contour.

    This creates curved front, back and side surfaces without an extruded slab.
    The final voxel union smooths the fine grid boundary into the body.
    """
    def distance(x,z):
        inside=False; closest=100
        for i,(ax,az) in enumerate(poly):
            bx,bz=poly[(i+1)%len(poly)]; dx=bx-ax; dz=bz-az
            t=max(0,min(1,((x-ax)*dx+(z-az)*dz)/max(1e-12,dx*dx+dz*dz)))
            closest=min(closest,math.hypot(x-ax-t*dx,z-az-t*dz))
            if (az>z)!=(bz>z) and x<ax+dx*(z-az)/(bz-az): inside=not inside
        return closest if inside else -closest
    step=.010; points={}; verts=[]; faces=[]
    nx=math.ceil((max(p[0] for p in poly)+.14)/step)
    nz=math.ceil((max(p[1] for p in poly)-2.76)/step)
    for i in range(nx+1):
        for j in range(nz+1):
            x=-.14+i*step; z=2.76+j*step; d=distance(x,z)
            if d>0:
                points[i,j]=len(verts); verts.append((x,-math.sqrt(d*.19),z))
    for i in range(nx):
        for j in range(nz):
            ids=[points.get(k) for k in [(i,j),(i+1,j),(i+1,j+1),(i,j+1)]]
            if all(v is not None for v in ids): faces.append(tuple(ids))
    # Drop unreferenced boundary samples and close every boundary edge.
    used=sorted({v for f in faces for v in f}); remap={old:i for i,old in enumerate(used)}
    verts=[verts[i] for i in used]; faces=[tuple(remap[i] for i in f) for f in faces]
    n=len(verts); verts += [(x,-y,z) for x,y,z in verts]
    edges={}
    for face in faces:
        for i,a in enumerate(face):
            b=face[(i+1)%4]; key=tuple(sorted((a,b)))
            if key in edges: edges[key]=None
            else: edges[key]=(a,b)
    back=[tuple(i+n for i in reversed(f)) for f in faces]
    walls=[(b,a,a+n,b+n) for edge in edges.values() if edge for a,b in [edge]]
    return mesh('Noot_Note',verts,faces+back+walls,material)

def organic_tube(name,controls,material,segments=20):
    """A round swept volume; no flat extrusion face or medial-axis ridge."""
    points=[]
    for i in range(len(controls)-1):
        p0=controls[max(0,i-1)]; p1=controls[i]; p2=controls[i+1]; p3=controls[min(len(controls)-1,i+2)]
        for j in range(8):
            t=j/8
            points.append(tuple(.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t) for k in range(5)))
    points.append(controls[-1]); vv=[]; ff=[]
    first=(Vector(controls[1][:3])-Vector(controls[0][:3])).normalized()
    reference=Vector((1,0,0)) if abs(first.y)>.7 else Vector((0,1,0))
    for i,p in enumerate(points):
        tangent=Vector(points[min(i+1,len(points)-1)][:3])-Vector(points[max(0,i-1)][:3])
        tangent.normalize(); sideways=tangent.cross(reference)
        if sideways.length<.01: sideways=tangent.cross(Vector((1,0,0)))
        sideways.normalize(); depth=tangent.cross(sideways).normalized()
        for j in range(segments):
            a=j/segments*TAU
            vv.append(Vector(p[:3])+sideways*math.cos(a)*max(.001,p[3])+depth*math.sin(a)*max(.001,p[4]))
    for i in range(len(points)-1):
        for j in range(segments):
            a=i*segments+j; b=i*segments+(j+1)%segments
            ff.append((a,b,b+segments,a+segments))
    ff.extend([tuple(reversed(range(segments))),tuple((len(points)-1)*segments+j for j in range(segments))])
    return mesh(name,vv,ff,material)

def eye_texture():
    """Paint iris/pupil/catchlight into an eye map so gaze cannot intersect the white."""
    size=256; pixels=[]
    for j in range(size):
        y=(j+.5)/size*2-1
        for i in range(size):
            x=(i+.5)/size*2-1; r=math.hypot(x,y); a=math.atan2(y,x)
            down=(1-y)*.5
            fibers=.028*math.sin(a*53+r*47)*math.sin(a*37-r*19)
            col=(.21+.32*down+fibers,.10+.18*down+fibers*.6,.026+.041*down)
            if r>.745: col=(1,.996,.985)
            elif r>.684: col=(.105,.061,.022)
            if r<.515: col=(.015,.009,.004)
            glint=math.hypot(x-.235,y-.34)
            if glint<.20:
                blend=1-smooth((glint-.175)/.025)
                col=tuple(c*(1-blend)+blend for c in col)
            pixels.extend((*col,1))
    image=bpy.data.images.new('Noot_EyePaint',width=size,height=size,alpha=False)
    image.colorspace_settings.name='sRGB'; image.pixels.foreach_set(pixels); image.pack()
    return image

def build():
    global rig, skin, belly, ink, pink, mouth, lids, brows
    scene=bpy.context.scene
    if scene.name!='Noot Studio':
        scene=bpy.data.scenes.new('Noot Studio'); bpy.context.window.scene=scene
    # Only generated objects in this scene are replaced on a rebuild.
    for o in list(scene.objects):
        if o.get('noot_asset') or o.name.startswith('Noot_'):
            bpy.data.objects.remove(o,do_unlink=True)
    skin=mat('Noot_Lime','#86c217',.52)
    belly=mat('Noot_Belly','#c6e982',.73)
    ink=mat('Noot_Ink','#235311',.7)
    pink=mat('Noot_Cheeks','#ffffff',.52)
    white=mat('Noot_EyeWhite','#fffefa',.38)
    brown=mat('Noot_Iris','#603604',.40)
    iris_dark=mat('Noot_IrisRim','#211305',.44)
    pupil=mat('Noot_Pupil','#030302',.31)
    glint=mat('Noot_Catchlight','#ffffff',.25)
    charcoal=mat('Noot_Headband','#4b5054',.63)
    pad=mat('Noot_Cushions','#d6d8d6',.76)
    silver=mat('Noot_Silver','#b8bdc1',.34,.50)
    shell=mat('Noot_Shell','#454b51',.48,.10)
    plate=mat('Noot_Plate','#50565e',.44,.08)
    paw=mat('Noot_PawPads','#b6df72',.78)
    tail_green=mat('Noot_TailTip','#a5d84a',.56)
    eye_image=eye_texture()
    for m in [brown,iris_dark,pupil]:
        m.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.06

    arm=bpy.data.armatures.new('Noot_Skeleton')
    rig=bpy.data.objects.new('Noot_Rig',arm); scene.collection.objects.link(rig)
    rig['noot_asset']=True; rig.show_in_front=True; active(rig)
    bpy.ops.object.mode_set(mode='EDIT')
    specs=[('root',(0,0,0),None),('pelvis',(0,0,.40),'root'),
           ('chest',(0,0,1.35),'pelvis'),('head',(0,0,1.70),'chest'),
           ('note_stem',(0,0,2.76),'head'),('note_tip',(0,0,3.30),'note_stem')]
    specs += [('tail_base',(0,.65,.60),'pelvis'),('tail_mid',(0,1.00,.64),'tail_base'),('tail_tip',(0,1.27,.88),'tail_mid')]
    for side,sign in [('L',-1),('R',1)]:
        specs += [('upper_arm_'+side,(sign*.86,0,1.55),'head'),
                  ('forearm_'+side,(sign*1.055,-.01,1.13),'upper_arm_'+side),
                  ('hand_'+side,(sign*1.10,-.015,1.005),'forearm_'+side),
                  ('foot_'+side,(sign*.45,-.075,.15),'root'),
                  ('gaze_'+side,(sign*.42,-.53,2.015),'head')]
    for name,head,parent in specs:
        b=arm.edit_bones.new(name); b.head=head; b.tail=Vector(head)+Vector((0,0,.22))
        if parent: b.parent=arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for b in rig.pose.bones: b.rotation_mode='XYZ'

    # Smooth pear volume; the note is fused into it with Blender voxel remeshing.
    verts=[]; faces=[]; rows=80; sides=64
    for i in range(rows+1):
        z=.24+(3.14-.24)*i/rows; r=radius(z)
        for j in range(sides):
            a=j/sides*TAU; verts.append((math.cos(a)*r,math.sin(a)*r*DEPTH,z))
    for i in range(rows):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces += [tuple(reversed(range(sides))),tuple(rows*sides+j for j in range(sides))]
    body=mesh('Noot_Body',verts,faces,skin)
    # Hand-shaped eighth-note hook, rounded in depth rather than a flat fin.
    segments=[((-.105,2.78),(-.105,3.04),(-.105,3.45),(-.085,3.63)),
              ((-.085,3.63),(-.075,3.77),(.025,3.80),(.17,3.72)),
              ((.17,3.72),(.30,3.65),(.54,3.56),(.56,3.43)),
              ((.56,3.43),(.59,3.26),(.46,3.29),(.32,3.38)),
              ((.32,3.38),(.20,3.46),(.12,3.49),(.11,3.36)),
              ((.11,3.36),(.105,3.16),(.105,2.98),(.105,2.78))]
    poly=[]
    for a,b,c,d in segments:
        for i in range(12):
            t=i/12; poly.append(tuple((1-t)**3*a[k]+3*(1-t)**2*t*b[k]+3*(1-t)*t*t*c[k]+t**3*d[k] for k in range(2)))
    note=organic_tube('Noot_Note',[(0,0,2.78,.15,.15),(0,0,3.10,.102,.112),
        (.005,0,3.40,.097,.115),(.035,0,3.64,.101,.125),(.11,0,3.665,.115,.135),
        (.235,0,3.59,.145,.155),(.40,0,3.50,.148,.15),(.49,0,3.46,.018,.025)],skin,32)
    active(body); note.select_set(True); bpy.ops.object.join()
    rem=body.modifiers.new('Fused pear and note','REMESH'); rem.mode='VOXEL'; rem.voxel_size=.016
    apply(body,rem)
    sm=body.modifiers.new('Soft surface','SMOOTH'); sm.factor=.7; sm.iterations=7; apply(body,sm)
    dec=body.modifiers.new('Web topology','DECIMATE'); dec.ratio=.20; apply(body,dec)
    for p in body.data.polygons: p.use_smooth=True
    bind(body,body_weights)
    bind(oval('Noot_BellyPatch',0,.90,.615,.56,belly,.013),body_weights)

    for side,sign in [('L',-1),('R',1)]:
        arm_profile=[(1.65,.855,.035),(1.51,.91,.094),(1.33,1.00,.102),
                     (1.10,1.085,.104),(.97,1.10,.126),(.86,1.10,.139),(.775,1.09,.085),(.75,1.08,.006)]
        vv=[]; ff=[]; seg=32
        for z,x,r in arm_profile:
            for j in range(seg):
                a=j/seg*TAU; vv.append((sign*x+r*math.cos(a),-.005+r*.90*math.sin(a),z))
        for i in range(len(arm_profile)-1):
            for j in range(seg):
                a=i*seg+j; b=i*seg+(j+1)%seg; ff.append((a,a+seg,b+seg,b))
        ff.extend([tuple(range(seg)),tuple(reversed([(len(arm_profile)-1)*seg+j for j in range(seg)]))])
        arm_mesh=mesh('Noot_Arm',vv,ff,skin)
        sub=arm_mesh.modifiers.new('Continuous soft arm','SUBSURF'); sub.levels=2; apply(arm_mesh,sub)
        parts=[arm_mesh,ellipsoid('Noot_Thumb',(sign*1.035,-.094,.885),(.045,.032,.082),skin)]
        active(parts[0])
        for o in parts: o.select_set(True)
        bpy.ops.object.join(); o=bpy.context.object; o.name='Noot_Arm_'+side
        rem=o.modifiers.new('Fused mitten','REMESH'); rem.mode='VOXEL'; rem.voxel_size=.018; apply(o,rem)
        sm=o.modifiers.new('Soft mitten','SMOOTH'); sm.factor=.65; sm.iterations=3; apply(o,sm)
        dec=o.modifiers.new('Web topology','DECIMATE'); dec.ratio=.5; apply(o,dec)
        def arm_weights(p,s=side):
            fore=smooth((1.32-p.z)/.35); hand=smooth((1.075-p.z)/.17)
            return {'upper_arm_'+s:1-fore,'forearm_'+s:fore*(1-hand),'hand_'+s:fore*hand}
        bind(o,arm_weights)
        from mathutils.bvhtree import BVHTree
        bpy.context.view_layer.update()
        arm_bvh=BVHTree.FromObject(o,bpy.context.evaluated_depsgraph_get())
        # Soft pads on the palm become visible when the wrist opens toward a friend.
        for label,dx,z,sx,sz in [('Palm',0,.925,.060,.042),('Bean1',-.048,.840,.023,.027),('Bean2',0,.807,.026,.025),('Bean3',.048,.840,.023,.027)]:
            vv=[]; ff=[]; ns=32
            for i in range(6):
                rr=max(.001,i/5)
                for j in range(ns):
                    a=j/ns*TAU; xx=sign*1.10+dx+sx*rr*math.cos(a); zz=z+sz*rr*math.sin(a)
                    hit=arm_bvh.ray_cast(Vector((xx,-1,zz)),Vector((0,1,0)))[0]
                    yy=hit.y if hit else -.025
                    vv.append((xx,yy-.001-.003*(1-rr*rr),zz))
            for i in range(5):
                for j in range(ns):
                    a=i*ns+j; b=i*ns+(j+1)%ns; ff.append((a,a+ns,b+ns,b))
            rigid(mesh('Noot_Hand'+label+'_'+side,vv,ff,paw),'hand_'+side)
        parts=[ellipsoid('Noot_Foot',(sign*.45,-.08,.145),(.305,.30,.145),skin),
               ellipsoid('Noot_Ankle',(sign*.45,.00,.285),(.235,.22,.22),skin)]
        active(parts[0]); parts[1].select_set(True); bpy.ops.object.join(); o=bpy.context.object; o.name='Noot_Foot_'+side
        rem=o.modifiers.new('Fused ankle','REMESH'); rem.mode='VOXEL'; rem.voxel_size=.020; apply(o,rem)
        sm=o.modifiers.new('Soft foot','SMOOTH'); sm.factor=.65; sm.iterations=3; apply(o,sm)
        dec=o.modifiers.new('Web topology','DECIMATE'); dec.ratio=.5; apply(o,dec)
        rigid(o,'foot_'+side)
        for label,dx,dy,rx,ry in [('Palm',0,.015,.133,.113),('Bean1',-.14,-.12,.055,.056),('Bean2',0,-.17,.057,.050),('Bean3',.14,-.12,.055,.056)]:
            vv=[]; ff=[]; rings=5; ns=32
            for i in range(rings+1):
                rr=max(.001,i/rings)
                for j in range(ns):
                    a=j/ns*TAU; x=dx+rx*rr*math.cos(a); y=dy+ry*rr*math.sin(a)
                    z=.145-.145*math.sqrt(max(.01,1-(x/.305)**2-(y/.30)**2))-.001
                    vv.append((sign*.45+x,-.08+y,z))
            for i in range(rings):
                for j in range(ns):
                    a=i*ns+j; b=i*ns+(j+1)%ns; ff.append((a,a+ns,b+ns,b))
            rigid(mesh('Noot_Sole'+label+'_'+side,vv,ff,paw),'foot_'+side)

    tail=organic_tube('Noot_Tail',[(0,.64,.60,.14,.14),(0,.91,.58,.135,.13),
        (0,1.18,.68,.12,.12),(0,1.32,.89,.11,.105),(0,1.27,1.075,.087,.087),
        (0,1.13,1.12,.055,.055),(0,1.075,1.055,.008,.008)],skin,24)
    def tail_weights(p):
        mid=smooth((p.y-.77)/.4); tip=smooth((p.z-.76)/.35)
        return {'tail_base':1-mid,'tail_mid':mid*(1-tip),'tail_tip':mid*tip}
    bind(tail,tail_weights)

    lids=[]; brows=[]
    for side,sign in [('L',-1),('R',1)]:
        cx=sign*.42; cz=2.015; rx=.224; rz=.256; eye=(cx,cz,rx,rz)
        eye_mat=mat('Noot_EyePaint_'+side,'#ffffff',.48)
        eye_mat.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.12
        eye_obj=rigid(oval('Noot_Eye_'+side,cx,cz,rx,rz,eye_mat,.006,.008))
        eye_obj['gaze_uv']=side
        uv=eye_obj.data.uv_layers.new(name='EyeUV')
        for loop in eye_obj.data.loops:
            p=eye_obj.data.vertices[loop.vertex_index].co
            uv.data[loop.index].uv=((p.x-cx)/rx*.5+.5,(p.z-cz)/rz*.5+.5)
        texture=eye_mat.node_tree.nodes.new('ShaderNodeTexImage'); texture.image=eye_image; texture.extension='EXTEND'
        uv_node=eye_mat.node_tree.nodes.new('ShaderNodeTexCoord')
        mapping=eye_mat.node_tree.nodes.new('ShaderNodeMapping'); mapping.vector_type='POINT'
        eye_mat.node_tree.links.new(uv_node.outputs['UV'],mapping.inputs['Vector'])
        eye_mat.node_tree.links.new(mapping.outputs['Vector'],texture.inputs['Vector'])
        for axis,factor in [(0,-1.8),(1,-1.7)]:
            driver=mapping.inputs['Location'].driver_add('default_value',axis).driver
            driver.expression=f'{factor}*gaze'
            variable=driver.variables.new(); variable.name='gaze'; variable.type='SINGLE_PROP'
            variable.targets[0].id=rig; variable.targets[0].data_path=f'pose.bones["gaze_{side}"].location[{axis}]'
        eye_mat.node_tree.links.new(texture.outputs['Color'],eye_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
        # Coplanar-looking curved iris layers, with a deep brown rim and warm lower iris.
        for label,r1,r2,material,off in [('IrisRim',.166,.188,iris_dark,.0015),('Iris',.154,.177,brown,.0025),('Pupil',.117,.137,pupil,.0035)]:
            obj=rigid(oval('Noot_'+label+'_'+side,cx-sign*.016,cz-.004,r1,r2,material,off,eye=eye),'gaze_'+side)
            if label=='Iris':
                def iris_color(p,cx=cx,cz=cz,sign=sign):
                    dx=(p.x-cx+sign*.016)/.154; dz=(p.z-cz+.004)/.177
                    a=math.atan2(dz,dx); r=math.hypot(dx,dz)
                    down=max(0,min(1,(1-dz)*.5))
                    fibers=(math.sin(a*31+r*16)*math.sin(a*47-r*13))*.14
                    v=(.14+.86*down**1.4)*(1+fibers)*(.8+.2*math.sin(r*math.pi))
                    return (.014+.19*v,.005+.078*v,.0015+.008*v)
                vertex_tint(obj,iris_color)
        rigid(oval('Noot_Glint_'+side,cx-sign*.016+.053,cz+.083,.047,.049,glint,.005,eye=eye),'gaze_'+side)
        # The painted eye carries the same detail without sliding layered geometry.
        for label in ['IrisRim','Iris','Pupil','Glint']:
            bpy.data.objects.remove(bpy.data.objects['Noot_'+label+'_'+side],do_unlink=True)
        cheek=rigid(oval('Noot_Cheek_'+side,sign*.61,1.68,.111,.082,pink,.007))
        blush=[.871,.352,.195]
        def blush_alpha(p,s=sign):
            r=math.hypot((p.x-s*.61)/.111,(p.z-1.68)/.082)
            return 1-smooth((r-.28)/.72)
        vertex_tint(cheek,lambda p:blush,blush_alpha)
        # An actual skin lid sweeps over the stable eye. Its open state folds to the rim.
        def lid_coords(amount,lower=False):
            out=[]
            for row in range(9):
                v=row/8
                for j in range(49):
                    u=-1+2*j/48; edge=math.sqrt(max(0,1-u*u))
                    rim=cz+(-1 if lower else 1)*rz*edge
                    seam=cz+edge*(-.045+.017*(1-u*u))
                    zz=rim+(seam-rim)*amount*v
                    xx=cx+rx*u; rr=u*u+((zz-cz)/rz)**2
                    out.append((xx,front(xx,zz)-.013-.008*max(0,1-rr),zz))
            return out
        fs=[]
        for i in range(8):
            for j in range(48):
                a=i*49+j; fs.append((a,a+49,a+50,a+1))
        lid=mesh('Noot_Lid_'+side,lid_coords(.001),fs,skin)
        lid.visible_shadow=False
        morph(lid,'Blink',lid_coords(1)); rigid(lid); lids.append(lid)
        lower=mesh('Noot_LowerLid_'+side,lid_coords(.001,True),[tuple(reversed(f)) for f in fs],skin)
        lower.visible_shadow=False
        morph(lower,'Blink',lid_coords(1,True)); rigid(lower)
        def crease_coords(width):
            vv=[]
            for j in range(49):
                u=-1+2*j/48; edge=math.sqrt(max(0,1-u*u)); x=cx+rx*u
                z=cz+edge*(-.045+.017*(1-u*u))
                for edge_sign in [-1,1]:
                    zz=z+edge_sign*width*edge; rr=u*u+((zz-cz)/rz)**2
                    vv.append((x,front(x,zz)-.014-.008*max(0,1-rr),zz))
            return vv
        crease=mesh('Noot_Lash_'+side,crease_coords(0),[(j*2,j*2+2,j*2+3,j*2+1) for j in range(48)],ink)
        morph(crease,'Close',crease_coords(.006)); rigid(crease)
        coords=[(sign*(.32+t*.21),2.45+math.sin(t*math.pi)*.038-t*.055) for t in [i/24 for i in range(25)]]
        brow=rigid(tube('Noot_Brow_'+side,[(x,front(x,z)-.018,z) for x,z in coords],.029,ink))
        base=[v.co.copy() for v in brow.data.vertices]
        morph(brow,'Concern',[(v.x,v.y,v.z+.07*(1-(abs(v.x)-.32)/.21)-.025) for v in base])
        morph(brow,'Lift',[(v.x,v.y,v.z+.055) for v in base]); brows.append(brow)
        morph(brow,'Angry',[(v.x,v.y,v.z-.065*(1-(abs(v.x)-.32)/.21)+.025) for v in base])

    def mouth_coords(expression):
        out=[]
        for i in range(49):
            raw=i/48*1.2-.1; t=max(0,min(1,raw))
            x=(raw-.5)*(.22 if expression!='Open' else .30)
            cap=math.sqrt(max(0,1-(raw/.1)**2)) if raw<0 else math.sqrt(max(0,1-((raw-1)/.1)**2)) if raw>1 else 1
            curve=math.sin(math.pi*t)
            z=1.775-(.064 if expression!='Frown' else -.035)*curve
            width=.022*cap + (.075*math.sqrt(max(0,1-(t*2-1)**2)) if expression=='Open' else 0)
            for edge in [-1,1]:
                zz=z+edge*width; out.append((x,front(x,zz)-.009,zz))
        return out
    fs=[(i*2,i*2+2,i*2+3,i*2+1) for i in range(48)]
    mouth=mesh('Noot_Mouth',mouth_coords('Smile'),fs,ink)
    morph(mouth,'Open',mouth_coords('Open')); morph(mouth,'Frown',mouth_coords('Frown')); rigid(mouth)

    # Broad, gently rounded rectangular headband section; it passes behind the note.
    verts=[]; faces=[]; ns=72; section=16
    for i in range(ns+1):
        a=math.pi*(.155+.69*i/ns)
        center=Vector((1.19*math.cos(a),.08+.29*math.sin(a)**6,2.02+1.09*math.sin(a)))
        radial=Vector((math.cos(a),0,math.sin(a)))
        for j in range(section):
            q=j/section*TAU
            # Superellipse cross section gives a padded band rather than a cable.
            c=math.copysign(abs(math.cos(q))**.55,math.cos(q))*.091
            d=math.copysign(abs(math.sin(q))**.55,math.sin(q))*.15
            verts.append(center+radial*c+Vector((0,d,0)))
    for i in range(ns):
        for j in range(section):
            a=i*section+j; b=i*section+(j+1)%section
            faces.append((a,b,b+section,a+section))
    faces += [tuple(reversed(range(section))),tuple(ns*section+j for j in range(section))]
    band=mesh('Noot_Headband',verts,faces,charcoal)
    bevel=band.modifiers.new('Rounded band ends','BEVEL'); bevel.width=.018; bevel.segments=3; bevel.limit_method='ANGLE'; apply(band,bevel)
    rigid(band); band['headgear']='headphones'
    for side,sign in [('L',-1),('R',1)]:
        for label,x,ry,rz,dep,bev,material in [
            ('Cushion',.90,.329,.415,.245,.065,pad),
            ('Shell',1.075,.309,.363,.185,.044,shell),
            ('SilverRim',1.175,.295,.334,.075,.022,silver),
            ('Plate',1.215,.262,.298,.065,.023,plate)]:
            cup=axial_cup('Noot_'+label+'_'+side,sign,x,0,2.015,ry,rz,dep,bev,material)
            if label=='Cushion':
                morph(cup,'Squish',[(sign*(.7775+(abs(v.co.x)-.7775)*.84),v.co.y*1.018,2.015+(v.co.z-2.015)*1.018) for v in cup.data.vertices])
        o=rigid(ellipsoid('Noot_Hinge_'+side,(sign*1.09,0,2.37),(.067,.082,.045),silver)); o['headgear']='headphones'
        # Wide flat telescoping rail, seated inside both headband end and cup hinge.
        p0=Vector((sign*1.052,.084,2.552)); p1=Vector((sign*1.09,0,2.37))
        bpy.ops.mesh.primitive_cube_add(size=1,location=(p0+p1)*.5)
        o=bpy.context.object; o.name='Noot_Rail_'+side; o.scale=(.075,.092,(p0-p1).length+.07)
        o.rotation_euler=(p0-p1).to_track_quat('Z','Y').to_euler()
        active(o); bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        o.data.materials.append(silver)
        bevel=o.modifiers.new('Soft metal edge','BEVEL'); bevel.width=.015; bevel.segments=3; apply(o,bevel)
        rigid(o); o['headgear']='headphones'
    for o in scene.objects:
        if o.type=='MESH':
            for p in o.data.polygons: p.use_smooth=True
    rig['description']='Noot: one shared deform skeleton, stable eyes with morph eyelids, removable headphones.'
    import noot_wardrobe,importlib
    importlib.reload(noot_wardrobe); noot_wardrobe.build()
    setup_preview()
    print('Built Noot:',len(scene.objects),'objects;',sum(len(o.data.polygons) for o in scene.objects if o.type=='MESH'),'polygons')

def setup_preview():
    scene=bpy.context.scene
    scene.render.engine='CYCLES'; scene.cycles.samples=32
    scene.render.resolution_x=900; scene.render.resolution_y=900; scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.world=bpy.data.worlds.new('Noot_WhiteStudio'); scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.8,.8,.8,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
    scene.view_settings.view_transform='Standard'
    scene.view_settings.exposure=-.5
    def light(name,pos,energy,size):
        d=bpy.data.lights.new(name,'AREA'); d.energy=energy; d.shape='DISK'; d.size=size
        o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=pos
        o.rotation_euler=(Vector((0,0,1.7))-o.location).to_track_quat('-Z','Y').to_euler()
    light('Noot_Key',(-3,-4,6),350,4)
    light('Noot_Fill',(3,-2,3.7),130,3)
    light('Noot_Rim',(1,3,5),280,3)
    d=bpy.data.cameras.new('Noot_Camera'); o=bpy.data.objects.new('Noot_Camera',d)
    scene.collection.objects.link(o); o.location=(0,-9,1.89)
    o.rotation_euler=(Vector((0,0,1.89))-o.location).to_track_quat('-Z','Y').to_euler()
    d.type='ORTHO'; d.ortho_scale=4.05; scene.camera=o
    scene.render.fps=30; scene.frame_start=1; scene.frame_end=121
    for area in bpy.context.screen.areas:
        if area.type in {'CONSOLE','VIEW_3D'}:
            area.type='VIEW_3D'
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.type='MATERIAL'
    active(rig)

def render(name='front',angle=0,frame=1):
    scene=bpy.context.scene; scene.frame_set(frame)
    cam=scene.camera; cam.location=(math.sin(angle)*9,-math.cos(angle)*9,1.89)
    cam.rotation_euler=(Vector((0,0,1.89))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.join(ROOT,'docs/noot/'+name+'.png')
    bpy.ops.render.render(write_still=True)
    print(scene.render.filepath)

CLIPS = {
    'Idle':(4,True), 'Walk':(1.2,True), 'Run':(.8,True),
    'Dance':(2,True), 'Happy':(2.4,True), 'Sad':(4,True),
    'Listen':(4,True), 'Sleepy':(4,True), 'Wave':(1.6,False),
    'Pet':(1.1,False), 'Celebrate':(1.4,False), 'Streak':(1.8,False),
    'Shrug':(2.4,False), 'Cheer':(1.8,False), 'Lose':(1.2,False),
    'Switch':(.9,False), 'Skip':(1.2,False),
    'LookAround':(5.2,False), 'Stretch':(3.2,False), 'Yawn':(3.4,False),
    'WaveSmall':(2.0,False), 'HighFive':(2.4,False), 'Boop':(2.0,False),
    'Laugh':(2.4,False), 'Angry':(2.8,False), 'Startled':(1.1,False),
    'Tumble':(2.8,False), 'Sit':(3.0,False), 'GetUp':(2.0,False),
    'Catch':(1.8,False), 'WalkSoft':(1.44,True), 'DanceB':(2.8,True),
    'HatTip':(2.8,False), 'FabricCheck':(2.6,False), 'TeeTug':(2.4,False), 'Samba':(3.2,True),
    'Jump':(1.5,False),
}

from noot_retarget import CLIPS as TEMPLATE_CLIPS, pose as template_pose
CLIPS.update(TEMPLATE_CLIPS)

def envelope(t,start,end):
    return math.sin(math.pi*(t-start)/(end-start))**2 if start<t<end else 0

def animate(only=None):
    global rig
    rig=bpy.data.objects['Noot_Rig']
    shaped=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.shape_keys]
    owners=[rig]+[o.data.shape_keys for o in shaped]
    for owner in owners:
        if only:
            if not owner.animation_data: owner.animation_data_create()
            owner.animation_data.action=None
            for track in list(owner.animation_data.nla_tracks):
                if track.name in only: owner.animation_data.nla_tracks.remove(track)
        else: owner.animation_data_clear(); owner.animation_data_create()
    for action in list(bpy.data.actions):
        generated=action.get('noot_asset') or any(action.name.startswith(n+'_Noot_Rig') or action.name.startswith(n+'_Key') for n in CLIPS)
        if generated and action.users<=int(action.use_fake_user): bpy.data.actions.remove(action)
    for name,(duration,loop) in CLIPS.items():
        if only and name not in only: continue
        count=round(duration*30)
        for owner in owners:
            a=bpy.data.actions.new(name+'_'+owner.name); a.use_fake_user=True
            a['noot_asset']=True
            owner.animation_data.action=a
        for frame in range(count+1):
            # Fractional frame-count loops must end at exactly the first phase.
            t=duration*frame/count if loop else frame/30; q=TAU*frame/count if loop else TAU*t/duration
            for b in rig.pose.bones:
                b.location=(0,0,0); b.rotation_euler=(0,0,0); b.scale=(1,1,1)
            for o in shaped:
                for key in o.data.shape_keys.key_blocks:
                    if key.name!='Basis': key.value=0
            def rot(b,x=0,y=0,z=0): rig.pose.bones[b].rotation_euler=(x,y,z)
            def move(b,x=0,y=0,z=0): rig.pose.bones[b].location=(x,z,-y)
            def shape(obj,key,value): bpy.data.objects[obj].data.shape_keys.key_blocks[key].value=value
            # Breathing is subtle and driven at the chest, so the floor never bobs.
            breathe=math.sin(q)*.008 if loop else 0
            rig.pose.bones['chest'].scale=(1-breathe*.25,1+breathe,1-breathe*.25)
            rot('head',x=math.sin(q-.3)*.012,z=math.sin(q)*.017 if loop else 0)
            rot('note_stem',x=math.sin(q-.65)*.023,z=math.sin(q-.50)*.025)
            rot('note_tip',x=math.sin(q-1.1)*.025,z=math.sin(q-.9)*.028)
            locomotion=name in {'Walk','WalkSoft','Run','Skip'}
            if locomotion:
                fast=name not in {'Walk','WalkSoft'}; gait=q if name!='Skip' else TAU*t/.72
                strength=1 if loop else smooth(t/.12)*(1-smooth((t-.94)/.26))
                move('pelvis',x=-math.sin(gait)*.035*strength,z=(-.026+.018*math.cos(gait*2))*strength)
                rot('chest',x=-.07*strength,z=math.sin(gait-.25)*.038*strength)
                rot('head',x=.03*strength,z=-math.sin(gait-.45)*.035*strength)
                rot('note_stem',x=math.sin(gait*2-.6)*.042*strength,z=-math.sin(gait-.5)*.09*strength)
                rot('note_tip',x=math.sin(gait*2-1.0)*.055*strength,z=-math.sin(gait-.9)*.10*strength)
                for side,sign in [('L',-1),('R',1)]:
                    phase=gait+(0 if side=='L' else math.pi); cycle=(phase/TAU)%1
                    # 60% planted stance, 40% smooth airborne return. Run has a shorter stance.
                    stance=.47 if fast else .60
                    travel=.23 if fast else .155
                    if cycle<stance:
                        f=cycle/stance; forward=travel*(1-2*f); lift=0
                        pitch=(-.07+.16*smooth((f-.58)/.42))*strength
                    else:
                        f=(cycle-stance)/(1-stance); forward=travel*(-1+2*smooth(f))
                        lift=math.sin(math.pi*f)**1.3*(.105 if fast else .072)*strength
                        pitch=(.09*math.cos(math.pi*f)-.10*math.sin(math.pi*f))*strength
                    b=rig.pose.bones['foot_'+side]; rot(b.name,x=pitch)
                    # Compensate the actual sole after heel/toe roll, including its rounded shape.
                    foot=bpy.data.objects['Noot_Foot_'+side]
                    pivot=rig.data.bones[b.name].head_local
                    m=b.rotation_euler.to_matrix()
                    minimum=min((m@(v.co-pivot)).z+pivot.z for v in foot.data.vertices)
                    move(b.name,y=-forward*strength,z=lift-minimum)
                    rot('upper_arm_'+side,x=math.sin(phase-.28)*(.31 if fast else .23)*strength,z=sign*.055)
                    rot('forearm_'+side,x=-.12*strength,z=sign*(.08+.045*math.sin(phase-.5))*strength)
                    rot('hand_'+side,x=.05*math.sin(phase-.8),z=sign*.03)
            if name in {'Dance','DanceB','Happy','Sad','Listen','Sleepy'}:
                sad=name=='Sad'; sleepy=name=='Sleepy'; beat=q*(2 if name=='Dance' else 1)
                amount=.078 if name in {'Dance','DanceB'} else .037 if name=='Happy' else .023
                rot('chest',z=math.sin(beat)*amount)
                rot('head',x=.065 if sad or sleepy else math.sin(beat-.4)*.025,z=-math.sin(beat-.35)*amount*.7)
                move('pelvis',x=math.sin(beat)*amount*.25,z=-abs(math.sin(beat))*.018)
                rot('note_stem',z=-math.sin(beat-.6)*amount*.8)
                rot('note_tip',z=-math.sin(beat-.95)*amount)
                for side,sign in [('L',-1),('R',1)]:
                    lift=.36 if name in {'Dance','DanceB'} else .14 if name=='Happy' else .035
                    rot('upper_arm_'+side,x=-.035+math.sin(beat-.25)*sign*.055,z=sign*(lift+math.sin(beat)*sign*amount))
                    rot('forearm_'+side,z=sign*.10)
                if name=='Listen':
                    hold=envelope(t,.4,3.6)
                    rot('upper_arm_L',x=-.65*hold,z=-2.30*hold)
                    rot('forearm_L',x=-.22*hold,z=-.24*hold)
                    rot('head',z=-.055*hold)
                if sad:
                    shape('Noot_Mouth','Frown',.75)
                    for s in ['L','R']: shape('Noot_Brow_'+s,'Concern',.65)
                if sleepy:
                    for s in ['L','R']: shape('Noot_Lid_'+s,'Blink',.72+.08*math.sin(q))
                if name in {'Dance','Happy'}: shape('Noot_Mouth','Open',.58 if name=='Dance' else .25)
                if name=='DanceB':
                    rot('head',y=math.sin(q)*.11,z=math.sin(q*2-.4)*.04)
                    rot('forearm_R',x=-.6-.2*math.sin(q),z=.2)
                    rot('hand_R',x=.18*math.sin(q*2))
                    shape('Noot_Mouth','Open',.32)
            if name in {'Wave','Pet','Celebrate','Streak','Shrug','Cheer','Lose','Switch'}:
                e=envelope(t,0,duration)
                if name=='Wave':
                    reach=smooth(t/.38)*(1-smooth((t-1.12)/.48))
                    rot('upper_arm_R',x=-.55*reach,z=(1.8+.12*math.sin(t*TAU*2.4))*reach)
                    rot('forearm_R',z=(.36+.20*math.sin(t*TAU*2.4-.5))*reach)
                    rot('head',z=-.05*reach); shape('Noot_Mouth','Open',.15*reach)
                if name=='Pet':
                    move('pelvis',z=-.045*e); rig.pose.bones['chest'].scale=(1+.025*e,1-.045*e,1+.025*e)
                    rot('head',x=.05*e,z=.045*e)
                    rot('note_stem',z=math.sin(t*12)*.08*e)
                    rot('note_tip',z=math.sin(t*12-.6)*.10*e)
                    for s in ['L','R']: shape('Noot_Lid_'+s,'Blink',.60*e)
                    shape('Noot_Mouth','Open',.30*e)
                if name in {'Celebrate','Streak','Cheer','Switch'}:
                    anticipate=envelope(t,0,.23)
                    jump=envelope(t,.22,.93)*(.20 if name!='Switch' else .065)
                    if name=='Streak': jump+=envelope(t,1.0,1.57)*.14
                    move('root',z=jump); move('pelvis',z=-.048*anticipate-.045*envelope(t,.87,1.12))
                    for side,sign in [('L',-1),('R',1)]:
                        lift=(2.0 if name=='Cheer' and side=='L' else .4 if name=='Cheer' else 1.5)*e
                        rot('upper_arm_'+side,x=-.42*e,z=sign*lift)
                        rot('forearm_'+side,z=sign*.22*e)
                    rot('note_stem',x=-jump*.28,z=math.sin(t*9-.5)*.065*e)
                    rot('note_tip',x=-jump*.32,z=math.sin(t*9-1.0)*.085*e)
                    shape('Noot_Mouth','Open',.8*e)
                if name=='Shrug':
                    for side,sign in [('L',-1),('R',1)]:
                        rot('upper_arm_'+side,x=-.5*e,z=sign*1.14*e)
                        rot('forearm_'+side,x=-.4*e,z=sign*.65*e)
                        shape('Noot_Brow_'+side,'Lift',e)
                    rot('head',z=.065*e); shape('Noot_Mouth','Open',.46*e)
                if name=='Lose':
                    hold=smooth(t/.55)
                    rot('head',x=.075*hold,z=.05*hold); move('pelvis',z=-.035*hold)
                    shape('Noot_Mouth','Frown',.85*hold)
                    for s in ['L','R']: shape('Noot_Brow_'+s,'Concern',.85*hold)
            e=envelope(t,0,duration)
            hold=smooth(t/.45)*(1-smooth((t-duration+.6)/.6))
            if name=='LookAround':
                glance=(smooth((t-.25)/.45)-smooth((t-1.7)/.6))*-.18+(smooth((t-2.5)/.45)-smooth((t-4.4)/.6))*.23
                rot('head',y=glance,z=math.sin(t*1.7)*.035*hold)
                rot('chest',y=glance*.24)
                for s in ['L','R']: shape('Noot_Brow_'+s,'Lift',abs(glance)*1.3)
            if name=='Stretch':
                stretch=smooth(t/.85)*(1-smooth((t-2.1)/1.1))
                move('pelvis',z=-.025*e)
                rig.pose.bones['chest'].scale=(1-.018*stretch,1+.03*stretch,1-.018*stretch)
                rot('head',x=-.09*stretch,z=.04*math.sin(t*2)*stretch)
                for s,sign in [('L',-1),('R',1)]:
                    rot('upper_arm_'+s,x=-.35*stretch,z=sign*2.65*stretch)
                    rot('forearm_'+s,z=sign*.15*stretch)
                    rot('hand_'+s,x=-.22*stretch)
                    shape('Noot_Lid_'+s,'Blink',.65*stretch)
            if name=='Yawn':
                rot('head',x=-.07*e); shape('Noot_Mouth','Open',.9*e)
                rot('upper_arm_R',x=-.9*hold,z=1.8*hold); rot('forearm_R',x=-.4*hold,z=.45*hold)
                for s in ['L','R']: shape('Noot_Lid_'+s,'Blink',.86*e)
            if name=='WaveSmall':
                rot('upper_arm_L',x=-.65*hold,z=-1.65*hold)
                rot('forearm_L',z=-.35*hold)
                rot('hand_L',x=.20*math.sin(t*TAU*2.3)*hold,z=.12*math.sin(t*TAU*2.3+.4)*hold)
                rot('head',z=.055*hold); shape('Noot_Mouth','Open',.2*hold)
            if name in {'HighFive','Catch','Boop'}:
                reach=smooth((t-.12)/.42)*(1-smooth((t-duration+.65)/.65))
                rot('chest',x=-.04*reach)
                for s,sign in [('L',-1),('R',1)]:
                    active_hand=1 if name!='Boop' or s=='R' else .15
                    rot('upper_arm_'+s,x=-1.1*reach*active_hand,z=sign*.40*reach*active_hand)
                    rot('forearm_'+s,x=-.55*reach*active_hand,z=sign*.10*reach)
                    rot('hand_'+s,x=.48*reach)
                    rig.pose.bones['hand_'+s].scale=(1+.13*reach,1,1+.08*reach)
                shape('Noot_Mouth','Open',.36*reach)
                if name=='Catch':
                    move('pelvis',z=-.085*reach)
                    for s in ['L','R']: shape('Noot_Brow_'+s,'Lift',.65*reach)
            if name=='Laugh':
                chuckle=math.sin(t*TAU*3.1)*e
                move('pelvis',z=-.022*abs(chuckle)); rot('head',x=-.07*e+.035*chuckle,z=.04*e)
                shape('Noot_Mouth','Open',.76*e)
                for s,sign in [('L',-1),('R',1)]:
                    shape('Noot_Lid_'+s,'Blink',.50*e)
                    rot('upper_arm_'+s,x=-.16*e,z=sign*.30*e)
            if name=='Angry':
                rot('head',x=.085*hold,y=math.sin(t*8)*.023*e)
                move('pelvis',z=-.035*hold)
                shape('Noot_Mouth','Frown',.86*hold)
                for s,sign in [('L',-1),('R',1)]:
                    shape('Noot_Brow_'+s,'Angry',hold); shape('Noot_Lid_'+s,'Blink',.16*hold)
                    rot('upper_arm_'+s,x=-.2*hold,z=sign*.26*hold)
                    rot('forearm_'+s,x=-.4*hold)
                rot('note_tip',x=.12*math.sin(t*7)*e)
            if name=='Startled':
                recoil=envelope(t,0,.65)
                move('pelvis',z=-.04*recoil); rot('head',x=-.11*recoil)
                shape('Noot_Mouth','Open',.85*recoil)
                for s,sign in [('L',-1),('R',1)]:
                    shape('Noot_Brow_'+s,'Lift',recoil)
                    rot('upper_arm_'+s,x=-.45*recoil,z=sign*.75*recoil)
            if name=='Jump':
                # Translation belongs to the shared stage's gravity. This clip
                # supplies anticipation, tucked feet, lifted hands and a landing.
                crouch=envelope(t,0,.22)
                airborne=smooth((t-.20)/.16)*(1-smooth((t-.84)/.22))
                settle=envelope(t,1.04,1.42)
                rot('chest',x=.055*crouch-.035*airborne+.045*settle)
                rot('head',x=-.065*airborne+.025*settle)
                for s,sign in [('L',-1),('R',1)]:
                    reach=smooth((t-.12)/.27)*(1-smooth((t-.82)/.45))
                    rot('upper_arm_'+s,x=.20*crouch-.32*reach,z=sign*(.68+.08*sign)*reach)
                    rot('forearm_'+s,x=-.22*airborne,z=sign*.22*reach)
                    rot('hand_'+s,x=.14*airborne,z=sign*.08*reach)
                    move('foot_'+s,z=.085*airborne,y=.022*airborne)
                    rot('foot_'+s,x=.18*airborne)
                    shape('Noot_Brow_'+s,'Lift',.40*airborne)
                    shape('Noot_Lid_'+s,'Blink',.22*crouch+.28*settle)
                rot('note_stem',x=.10*crouch-.10*airborne+.055*settle)
                rot('note_tip',x=.14*envelope(t,.07,.40)-.12*envelope(t,.4,1.15)+.065*settle)
                shape('Noot_Mouth','Open',.55*airborne+.14*settle)
            if name in {'Sit','GetUp','Tumble'}:
                sit=hold if name=='Sit' else (1-smooth(t/1.8)) if name=='GetUp' else smooth(t/.55)*(1-smooth((t-1.5)/1.2))
                move('pelvis',z=-.16*sit)
                rot('chest',x=.12*sit); rot('head',x=-.10*sit)
                for s,sign in [('L',-1),('R',1)]:
                    move('foot_'+s,y=-.33*sit,z=.06*sit); rot('foot_'+s,x=-.68*sit,y=sign*.12*sit)
                    rot('upper_arm_'+s,x=-.75*sit,z=sign*.42*sit)
                    rot('forearm_'+s,x=-.35*sit); rot('hand_'+s,x=.28*sit)
                if name=='Tumble':
                    landing=smooth(t/.24)*(1-smooth((t-.70)/.95))
                    rot('root',x=.12*landing,z=math.sin(t*9)*.025*landing)
                    move('pelvis',z=-.18*landing)
                    rig.pose.bones['chest'].scale=(1+.03*landing,1-.06*landing,1+.03*landing)
                    rot('chest',x=.03*landing); rot('head',x=-.045*landing,y=.14*envelope(t,1.2,2.7))
                    for s,sign in [('L',-1),('R',1)]:
                        move('foot_'+s,y=(-.12 if s=='L' else .04)*landing,z=.01*landing)
                        rot('foot_'+s,x=-.1*landing)
                        rot('upper_arm_'+s,x=-.65*landing,z=sign*.45*landing)
                        rot('forearm_'+s,x=-.35*landing); rot('hand_'+s,x=.2*landing)
                        shape('Noot_Brow_'+s,'Lift',.55*landing)
                    shape('Noot_Mouth','Open',.55*landing)
            if name=='HatTip':
                reach=smooth((t-.18)/.6)*(1-smooth((t-1.75)/.85))
                rot('head',x=.14*reach,z=-.13*reach)
                move('head',z=-.055*reach)
                rot('upper_arm_L',x=-.30*reach,z=-3.03*reach)
                for joint in ['upper_arm_L','forearm_L']: rig.pose.bones[joint].scale=(1-.06*reach,1+.14*reach,1-.06*reach)
                rot('forearm_L',x=-.10*reach,z=-.13*reach)
                rot('hand_L',x=.17*reach,z=.14*envelope(t,.95,1.65))
                for side in ['L','R']: shape('Noot_Lid_'+side,'Blink',.25*reach)
                shape('Noot_Mouth','Open',.17*reach)
            if name in {'FabricCheck','TeeTug'}:
                reach=smooth((t-.15)/.5)*(1-smooth((t-duration+.7)/.7))
                rot('head',x=.11*reach)
                for side,sign in [('L',-1),('R',1)]:
                    rot('upper_arm_'+side,x=(-.85 if name=='FabricCheck' else -.42)*reach,z=sign*(.12 if name=='FabricCheck' else -.08)*reach)
                    rot('forearm_'+side,x=-.43*reach,z=-sign*.34*reach)
                    rot('hand_'+side,x=.22*reach,z=sign*.10*math.sin(t*8)*reach)
                shape('Noot_Mouth','Open',.12*reach)
            if name=='Samba':
                beat=q*4
                weight=math.sin(beat)
                move('pelvis',x=.063*weight,z=-.026+.022*math.cos(beat*2))
                rot('chest',x=-.025,z=-.10*math.sin(beat-.28),y=.055*math.sin(beat-.5))
                rot('head',z=.075*math.sin(beat-.55),y=.06*math.sin(q))
                for side,sign in [('L',-1),('R',1)]:
                    phase=beat+(0 if side=='L' else math.pi)
                    lift=max(0,math.sin(phase))*.046
                    move('foot_'+side,x=sign*.025*max(0,math.sin(phase)),y=.038*math.sin(phase),z=lift)
                    rot('upper_arm_'+side,x=-.30+.22*math.sin(phase-.4),z=sign*(.6+.14*math.sin(phase-.3)))
                    rot('forearm_'+side,x=-.4-.15*math.cos(phase),z=sign*.24)
                    rot('hand_'+side,x=.16*math.sin(phase-.8),z=sign*.09)
                rot('note_stem',z=.08*math.sin(beat-.8))
                rot('note_tip',z=.11*math.sin(beat-1.15))
                shape('Noot_Mouth','Open',.45)
            if name in TEMPLATE_CLIPS:
                template_pose(name,frame,rig,shape)
            # The short tail carries a delayed response, rather than a metronomic wag.
            rot('tail_base',x=math.sin(q-.8)*.06,y=math.sin(q-.3)*(.11 if name in {'Dance','DanceB','Samba','Laugh','Happy'} else .045))
            rot('tail_mid',x=math.sin(q-1.1)*.08,y=math.sin(q-.7)*.07)
            rot('tail_tip',x=math.sin(q-1.4)*.09,y=math.sin(q-1.0)*.075)
            # A quick close and slower opening, with a tiny left/right offset.
            if loop and duration>=2.4 and name!='Sleepy':
                for s,offset in [('L',0),('R',.018)]:
                    age=t-duration*.63-offset
                    blink=smooth(age/.065) if 0<=age<.065 else 1 if .065<=age<.09 else 1-smooth((age-.09)/.16) if .09<=age<.25 else 0
                    shape('Noot_Lid_'+s,'Blink',blink)
            # Exact loop seam, including lagging secondary motion and sole compensation.
            for s in ['L','R']:
                blink=bpy.data.objects['Noot_Lid_'+s].data.shape_keys.key_blocks['Blink'].value
                shape('Noot_LowerLid_'+s,'Blink',blink)
                shape('Noot_Lash_'+s,'Close',smooth((blink-.83)/.17))
            if name in {'Sit','GetUp','Tumble'}:
                # Bake floor clearance from the deformed character, including a
                # tipped torso and bracing hands, rather than guessing a root height.
                bpy.context.view_layer.update(); deps=bpy.context.evaluated_depsgraph_get()
                minimum=100
                for object_name in ['Noot_Body','Noot_Arm_L','Noot_Arm_R','Noot_Foot_L','Noot_Foot_R']:
                    evaluated=bpy.data.objects[object_name].evaluated_get(deps)
                    minimum=min(minimum,min(v.co.z for v in evaluated.data.vertices))
                rig.pose.bones['root'].location.y-=minimum
            for b in rig.pose.bones:
                for prop in ['location','rotation_euler','scale']: b.keyframe_insert(data_path=prop,frame=frame+1,group=b.name)
            for o in shaped:
                for key in o.data.shape_keys.key_blocks:
                    if key.name!='Basis': key.keyframe_insert(data_path='value',frame=frame+1,group=o.name)
        for owner in owners:
            action=owner.animation_data.action
            track=owner.animation_data.nla_tracks.new(); track.name=name
            strip=track.strips.new(name,1,action); strip.name=name
            strip.action_frame_start=1; strip.action_frame_end=count+1
            # NLA track names merge armature and facial actions into one GLB clip.
            owner.animation_data.action=None
            track.mute=True
    select_clip('Idle')
    print('Authored',len(only) if only else len(CLIPS),'clips with skeletal and facial animation')

def select_clip(name):
    scene=bpy.context.scene
    owners=[bpy.data.objects['Noot_Rig']]+[o.data.shape_keys for o in scene.objects if o.type=='MESH' and o.data.shape_keys]
    for owner in owners:
        for track in (owner.animation_data.nla_tracks if owner.animation_data else []): track.mute=track.name!=name
    scene.frame_end=round(CLIPS[name][0]*30)+1; scene.frame_set(1)

def export():
    scene=bpy.context.scene
    owners=[bpy.data.objects['Noot_Rig']]+[o.data.shape_keys for o in scene.objects if o.type=='MESH' and o.data.shape_keys]
    # glTF exports muted NLA tracks only when unmuted; use solo preview only after export.
    for owner in owners:
        for track in (owner.animation_data.nla_tracks if owner.animation_data else []): track.mute=False
    active(bpy.data.objects['Noot_Rig'])
    for o in scene.objects:
        if o.get('noot_asset'): o.hide_set(False); o.select_set(True)
    out=os.path.join(ROOT,'public/mascot/noot.glb')
    bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,
        export_animations=True,export_animation_mode='NLA_TRACKS',export_morph=True,
        export_morph_animation=True,export_skins=True,export_extras=True,
        export_force_sampling=True,export_optimize_animation_size=True,
        export_anim_slide_to_zero=True,export_yup=True,export_apply=False)
    select_clip('Idle')
    for o in scene.objects:
        if o.get('wardrobe'): o.hide_render=True; o.hide_set(True)
        if o.get('headgear'): o.hide_render=False; o.hide_set(False)
    scene.camera.location=(0,-9,1.89)
    scene.camera.rotation_euler=(Vector((0,0,1.89))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/noot/noot.blend'))
    print('Saved editable .blend and',out,os.path.getsize(out),'bytes')

def render_walk_preview():
    """Render one loop incrementally so Blender MCP stays responsive between frames."""
    scene=bpy.context.scene
    select_clip('Walk')
    scene.render.resolution_x=512; scene.render.resolution_y=512
    scene.cycles.samples=12
    scene.camera.location=(4.0,-8.0,2.05)
    scene.camera.rotation_euler=(Vector((0,0,1.85))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    folder='/tmp/noot-reference/walk'; os.makedirs(folder,exist_ok=True)
    current=[1]
    def tick():
        f=current[0]
        if f>36:
            select_clip('Idle')
            scene.render.resolution_x=900; scene.render.resolution_y=900; scene.cycles.samples=32
            print('Noot walk preview finished')
            return None
        scene.frame_set(f)
        scene.render.filepath=os.path.join(folder,f'{f:04d}.png')
        bpy.ops.render.render(write_still=True)
        current[0]+=1
        return .05
    bpy.app.timers.register(tick,first_interval=.1)
    print('Rendering 36 walk frames to',folder)
