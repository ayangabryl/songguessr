"""Fitted, skinned clothing and hats for Noot. Built through Blender MCP."""
import bpy, math, os
from mathutils import Vector
import noot_asset as n

def build():
    for o in list(bpy.context.scene.objects):
        if o.get('wardrobe'): bpy.data.objects.remove(o,do_unlink=True)
    fabric=n.mat('Noot_Fabric','#7893ab',.83)
    seam=n.mat('Noot_Seam','#61798d',.9)
    knit=n.mat('Noot_Knit','#d09e78',.9)
    # Small reusable knitted normal texture, embedded into the exported GLB.
    image=bpy.data.images.get('Noot_KnitNormal')
    if not image:
        image=bpy.data.images.new('Noot_KnitNormal',width=128,height=128,alpha=True)
        image.colorspace_settings.name='Non-Color'; pixels=[]
        for y in range(128):
            v=y/128*8
            for x in range(128):
                u=x/128*8; stitch=n.TAU*(u+.35*abs((v%1)-.5))
                nx=.19*math.sin(stitch);ny=.12*math.sin(n.TAU*v)+.045*math.sin(stitch)
                nz=math.sqrt(max(.1,1-nx*nx-ny*ny))
                pixels.extend((nx*.5+.5,ny*.5+.5,nz*.5+.5,1))
        image.pixels.foreach_set(pixels)
        image.filepath_raw=os.path.join(n.ROOT,'assets/noot/knit-normal.png');image.file_format='PNG';image.save();image.pack()
    tex=knit.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.extension='REPEAT'
    normal=knit.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.55
    knit.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color'])
    knit.node_tree.links.new(normal.outputs['Normal'],knit.node_tree.nodes['Principled BSDF'].inputs['Normal'])
    p=fabric.node_tree.nodes['Principled BSDF']
    p.inputs['Sheen Weight'].default_value=.22
    p.inputs['Sheen Roughness'].default_value=.65
    def thickness(o,amount=.008):
        mod=o.modifiers.new('Stitched cloth thickness','SOLIDIFY');mod.thickness=amount;mod.offset=-1
        n.apply(o,mod)
        return o
    def tagged(o,choice,bone=None):
        if choice=='beanie' and not o.data.uv_layers:
            uv=o.data.uv_layers.new(name='Knit UV')
            for loop in o.data.loops:
                co=o.data.vertices[loop.vertex_index].co
                uv.data[loop.index].uv=((math.atan2(co.y/n.DEPTH,co.x)/n.TAU+.5)*3,co.z*3)
        if bone: n.rigid(o,bone)
        elif not o.get('noot_asset'): n.bind(o,n.body_weights)
        o['wardrobe']=choice; o.hide_render=True; o.hide_set(True)
        return o
    def panel(name,verts,faces,choice,material=fabric,flutter=None):
        o=thickness(n.mesh(name,verts,faces,material))
        if flutter: n.morph(o,'Flutter',[flutter(v.co) for v in o.data.vertices])
        tagged(o,choice)
        return o
    # A little kerchief: rounded drape, a gathered top, and a continuous neck wrap.
    # The hem shares the cloth's deformation, so its stitching never floats away.
    def flutter_cloth(p):
        tip=max(0,min(1,(1.55-p.z)/.34))**2
        return (p.x+.012*tip,p.y-.024*tip,p.z+.007*tip)
    rows=24; cols=40; vv=[]; ff=[]
    for row in range(rows+1):
        t=row/rows; width=.335*math.cos(t*math.pi/2)+.025
        for col in range(cols+1):
            u=col/cols*2-1; x=u*width+.055*t*t
            z=1.54-.29*t+.035*u*u*(1-t)+.018*u*t
            y=n.front(x,z)-.035-.040*math.sin(math.pi*t)*(1-u*u)-.012*math.cos(u*math.pi*2.5+.6*t)*math.sin(math.pi*t)
            vv.append((x,y,z))
    for row in range(rows):
        for col in range(cols):
            a=row*(cols+1)+col; ff.append((a,a+cols+1,a+cols+2,a+1))
    bandana=panel('Noot_Bandana',vv,ff,'bandana',flutter=flutter_cloth)
    boundary=[vv[row*(cols+1)] for row in range(rows+1)]+vv[rows*(cols+1)+1:(rows+1)*(cols+1)]+[vv[row*(cols+1)+cols] for row in range(rows-1,-1,-1)]
    hem=n.tube('Noot_BandanaHem',boundary,.005,seam)
    n.morph(hem,'Flutter',[flutter_cloth(v.co) for v in hem.data.vertices]); tagged(hem,'bandana')
    wrap=[]; faces=[]; seg=96
    for i in range(7):
        v=i/6
        for j in range(seg):
            a=j/seg*n.TAU
            z=1.57+.028*math.sin(a)+.075*(v-.5)
            r=n.radius(z)+.030+.012*math.sin(math.pi*v)
            wrap.append((r*math.cos(a),r*n.DEPTH*math.sin(a),z))
    for i in range(6):
        for j in range(seg):
            a=i*seg+j;b=i*seg+(j+1)%seg;faces.append((a,b,b+seg,a+seg))
    panel('Noot_BandanaWrap',wrap,faces,'bandana')
    for label,points in [('Top',wrap[-seg:]),('Bottom',wrap[:seg])]:
        tagged(n.tube('Noot_BandanaWrap'+label,points+[points[0]],.006,fabric),'bandana')
    tagged(n.ellipsoid('Noot_BandanaKnot',(.20,.80,1.57),(.105,.055,.065),fabric),'bandana')
    for side in [-1,1]:
        pts=[(.20+side*.02,.80,1.56),(.20+side*.08,.83,1.47),(.20+side*.12,.82,1.37)]
        tagged(n.organic_tube('Noot_BandanaTie',[(x,y,z,.045,.022) for x,y,z in pts],fabric),'bandana')
    # A short tee follows the body's weights. Sleeve weights follow the actual arm.
    vv=[];ff=[]; rows=26; seg=64
    for i in range(rows+1):
        t=i/rows
        for j in range(seg):
            a=j/seg*n.TAU; top=1.62-.075*max(0,-math.sin(a))
            z=.40+(top-.40)*t; r=n.radius(z)+.026
            fold=.004*math.sin(a*8)*(1-t)**2
            vv.append(((r+fold)*math.cos(a),(r+fold)*n.DEPTH*math.sin(a),z))
    for i in range(rows):
        for j in range(seg):
            a=i*seg+j;b=i*seg+(j+1)%seg;ff.append((a,b,b+seg,a+seg))
    panel('Noot_Tee',vv,ff,'shirt',flutter=lambda p:(p.x*(1+.007*max(0,(.72-p.z)/.32)),p.y*(1+.012*max(0,(.72-p.z)/.32)),p.z+.01*math.sin(math.atan2(p.y,p.x)*5)*max(0,(.72-p.z)/.32)))
    for label,indices in [('Hem',range(seg)),('Collar',range(rows*seg,(rows+1)*seg))]:
        pts=[vv[i] for i in indices]; pts.append(pts[0]); tagged(n.tube('Noot_Tee'+label,pts,.014,seam),'shirt')
    for side,sign in [('L',-1),('R',1)]:
        vv=[];ff=[];profile=[(1.61,.875,.069),(1.52,.91,.113),(1.40,.96,.121),(1.35,.985,.120)]
        for z,x,r in profile:
            for j in range(32):
                a=j/32*n.TAU;vv.append((sign*x+r*math.cos(a),-.005+r*.90*math.sin(a),z))
        for i in range(3):
            for j in range(32):
                a=i*32+j;b=i*32+(j+1)%32;ff.append((a,a+32,b+32,b))
        o=thickness(n.mesh('Noot_TeeSleeve_'+side,vv,ff,fabric))
        n.bind(o,lambda p,s=side:{'upper_arm_'+s:1-n.smooth((1.32-p.z)/.35),'forearm_'+s:n.smooth((1.32-p.z)/.35)})
        tagged(o,'shirt')
        pts=vv[-32:]+[vv[-32]]; tagged(n.tube('Noot_TeeCuff_'+side,pts,.01,seam),'shirt','upper_arm_'+side)
    # A ribbed beanie leaves a fitted opening for Noot's note stem.
    vv=[];ff=[]; rows=20;seg=80
    for i in range(rows+1):
        t=i/rows;z=2.53+.54*math.sin(t*math.pi/2);r=.13+.56*math.cos(t*math.pi/2)
        for j in range(seg):
            a=j/seg*n.TAU;rib=.004*(.5+.5*math.cos(a*40))
            vv.append(((r+rib)*math.cos(a),(r+rib)*n.DEPTH*math.sin(a),z))
    for i in range(rows):
        for j in range(seg):
            a=i*seg+j;b=i*seg+(j+1)%seg;ff.append((a,b,b+seg,a+seg))
    tagged(thickness(n.mesh('Noot_Beanie',vv,ff,knit),.012),'beanie','head')
    pts=[((.69)*math.cos(j/80*n.TAU),(.69)*n.DEPTH*math.sin(j/80*n.TAU),2.55) for j in range(81)]
    tagged(n.tube('Noot_BeanieCuff',pts,.043,knit),'beanie','head')
    # The bucket hat has a soft, curved brim and a crown with a stem opening.
    vv=[];ff=[];rows=12;seg=64
    for i in range(rows+1):
        t=i/rows;r=.59+.24*t
        for j in range(seg):
            a=j/seg*n.TAU;z=2.62-.065*t*t+.008*math.sin(a*3)*t
            vv.append((r*math.cos(a),r*.84*math.sin(a),z))
    for i in range(rows):
        for j in range(seg):
            a=i*seg+j;b=i*seg+(j+1)%seg;ff.append((a,b,b+seg,a+seg))
    hat=thickness(n.mesh('Noot_BucketBrim',vv,ff,fabric),.012)
    n.morph(hat,'Flutter',[(v.co.x,v.co.y,v.co.z+.025*math.sin(math.atan2(v.co.y,v.co.x)*2)*max(0,(math.hypot(v.co.x,v.co.y/.84)-.59)/.24)) for v in hat.data.vertices])
    tagged(hat,'bucket','head')
    vv=[];ff=[]
    for i in range(17):
        t=i/16
        if t<=.75: z=2.62+.36*t/.75;r=.63-.06*t/.75
        else: u=(t-.75)/.25;z=2.98+.05*u;r=.57-.44*n.smooth(u)
        for j in range(64):
            a=j/64*n.TAU;vv.append((r*math.cos(a),r*.84*math.sin(a),z))
    for i in range(16):
        for j in range(64):
            a=i*64+j;b=i*64+(j+1)%64;ff.append((a,b,b+64,a+64))
    tagged(thickness(n.mesh('Noot_BucketCrown',vv,ff,fabric)),'bucket','head')
    print('Built fitted bandana, short-sleeve tee, ribbed beanie and soft bucket hat')
