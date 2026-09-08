"""Author a draped scarf in an isolated Blender scene, then bake one runtime mesh.

Run through Blender MCP. The main Noot scene and its animation actions are untouched.
Coordinates in the generated module are Three.js Y-up; Blender uses Z-up.
"""
import bpy, bmesh, json, math, os, base64, struct

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROFILE = [(.24,0),(.28,.40),(.40,.69),(.60,.86),(.85,.97),(1.10,.99),(1.40,.94),(1.70,.90),(2,.845),(2.20,.81),(2.40,.74),(2.60,.58),(2.75,.35),(2.90,.12),(2.96,0)]

def radius(y):
    for i in range(len(PROFILE)-1):
        a,b=PROFILE[i:i+2]
        if y>b[0]: continue
        prev,nxt=PROFILE[max(0,i-1)],PROFILE[min(len(PROFILE)-1,i+2)]
        t=(y-a[0])/(b[0]-a[0]); t2=t*t; t3=t2*t
        m0=(b[1]-prev[1])/(b[0]-prev[0])*(b[0]-a[0])
        m1=(nxt[1]-a[1])/(nxt[0]-a[0])*(b[0]-a[0])
        return (2*t3-3*t2+1)*a[1]+(t3-2*t2+t)*m0+(-2*t3+3*t2)*b[1]+(t3-t2)*m1
    return 0

def front(x,y): return .84*math.sqrt(max(0,radius(y)**2-x*x))
def xyz(p): return (p[0],-p[2],p[1])
def web(p): return (round(p[0],5),round(p[2],5),round(-p[1],5))

def build():
    old=bpy.data.scenes.get('Noot Scarf Atelier')
    if old:
        for o in list(old.objects): bpy.data.objects.remove(o,do_unlink=True)
        bpy.data.scenes.remove(old)
    scene=bpy.data.scenes.new('Noot Scarf Atelier')
    fabric=bpy.data.materials.get('Noot_ScarfFabric') or bpy.data.materials.new('Noot_ScarfFabric')
    fabric.diffuse_color=(.25,.39,.48,1); fabric.use_nodes=True
    p=fabric.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=fabric.diffuse_color
    p.inputs['Roughness'].default_value=.91; p.inputs['Sheen Weight'].default_value=.28
    objects=[]
    def panel(name,rows,cols,sample,wrap=False):
        verts=[xyz(sample(i/rows,j/cols)) for i in range(rows+1) for j in range(cols+1)]
        faces=[]
        for i in range(rows):
            for j in range(cols):
                a=i*(cols+1)+j; b=a+cols+1
                faces.append((a,b,b+1,a+1))
        mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
        o=bpy.data.objects.new(name,mesh); scene.collection.objects.link(o)
        bm=bmesh.new(); bm.from_mesh(mesh)
        if wrap: bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
        mesh.materials.append(fabric)
        sub=o.modifiers.new('Soft woven folds','SUBSURF'); sub.levels=1
        solid=o.modifiers.new('Turned cloth edge','SOLIDIFY'); solid.thickness=.012; solid.offset=0
        for f in mesh.polygons: f.use_smooth=True
        o['source']='Blender-authored draped scarf'; objects.append(o)
        return o

    def wrap(t,v):
        angle=t*math.tau; s=v*2-1
        y=1.59-.13*math.cos(angle)+.025*math.sin(angle*2)+s*.095
        r=radius(y)+.030+.015*math.cos(v*math.tau*1.3+math.sin(angle)*.8)
        return (math.sin(angle)*r,y,math.cos(angle)*r*.84)
    panel('Scarf_Wrap',24,4,wrap,True)
    def tail(t,v,short=False):
        u=v*2-1
        length=.31 if short else .48
        center=(.40 if short else .23)+(.10 if short else -.06)*t+.025*math.sin(t*math.pi)
        width=(.078 if short else .10)*(1-.16*t)
        x=center+u*width
        y=1.56-length*t+.018*math.cos(u*math.pi/2)*t**8
        fold=.009*math.cos(v*math.tau*1.6+t*1.5)*math.sin(math.pi*t)
        z=front(x,y)+(.053 if short else .041)+fold+.024*t**3
        return x,y,z
    panel('Scarf_LongEnd',8,4,lambda t,v:tail(t,v))
    panel('Scarf_ShortEnd',6,4,lambda t,v:tail(t,v,True))
    # A folded overlap connects both drapes to the wrap, without a spherical knot.
    def overlap(t,v):
        x=.19+t*.31; y=1.535+(v-.5)*.14+.025*math.sin(t*math.pi)
        z=front(x,y)+.069+.018*math.sin(t*math.pi)*math.sin(v*math.pi)
        return x,y,z
    panel('Scarf_Fold',4,4,overlap)
    positions=[]; normals=[]; indices=[]; flutter=[]
    with bpy.context.temp_override(scene=scene,view_layer=scene.view_layers[0]):
        graph=bpy.context.evaluated_depsgraph_get()
        for o in objects:
            evaluated=o.evaluated_get(graph); mesh=evaluated.to_mesh(); mesh.calc_loop_triangles()
            base=len(positions)//3
            for vertex in mesh.vertices:
                x,y,z=web(vertex.co); positions.extend((x,y,z)); normals.extend(web(vertex.normal))
                w=max(0,min(1,(1.51-y)/.46))**2 if 'End' in o.name else 0
                flutter.extend((round(.052*w,5),round(.014*w,5),round(.026*w,5)))
            for tri in mesh.loop_triangles: indices.extend(base+i for i in tri.vertices)
            evaluated.to_mesh_clear()
    def pack(values,integer=False):
        values=values if integer else [round(v*10000) for v in values]
        return base64.b64encode(struct.pack('<'+('H' if integer else 'h')*len(values),*values)).decode()
    data={'position':pack(positions),'normal':pack(normals),'index':pack(indices,True),'flutter':pack(flutter)}
    dest=os.path.join(ROOT,'src/lib/noot/scarf-data.ts')
    with open(dest,'w') as f:
        f.write('// Generated by scripts/blender/noot_scarf.py through Blender MCP.\nexport default '+json.dumps(data,separators=(',',':'))+'\n')
    bpy.data.libraries.write(os.path.join(ROOT,'assets/noot/scarf.blend'),{scene},fake_user=True,compress=True)
    print(json.dumps({'mesh_vertices':len(positions)//3,'triangles':len(indices)//3,'source':dest,'scene':scene.name}))

if __name__=='__main__': build()
