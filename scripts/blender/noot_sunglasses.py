"""Blender-authored acetate sunglasses, baked into three lightweight web meshes."""
import bpy, bmesh, math, os, sys, json, base64, struct
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
sys.path.insert(0,os.path.dirname(__file__))
import noot_asset as n

def xyz(p): return (p[0],-p[2],p[1])
def web(p): return (p[0],p[2],-p[1])
def front(x,y): return -n.front(x,y)
def power(v,p): return math.copysign(abs(v)**p,v)
def outline(a,rx=.282,ry=.271): return rx*power(math.cos(a),.70),ry*power(math.sin(a),.78)

def build():
    old=bpy.data.scenes.get('Noot Sunglasses Atelier')
    if old:
        for o in list(old.objects): bpy.data.objects.remove(o,do_unlink=True)
        bpy.data.scenes.remove(old)
    scene=bpy.data.scenes.new('Noot Sunglasses Atelier')
    frame=n.mat('Noot_SunglassesAcetate','#293431',.26)
    frame.node_tree.nodes['Principled BSDF'].inputs['Coat Weight'].default_value=.5
    lens=n.mat('Noot_SmokeLenses','#172f32',.14,.1)
    lens.node_tree.nodes['Principled BSDF'].inputs['Coat Weight'].default_value=1
    groups={'frame':[],'lenses':[],'temples':[]}
    def mesh(name,verts,faces,material,kind):
        data=bpy.data.meshes.new(name); data.from_pydata([xyz(p) for p in verts],[],faces); data.update()
        bm=bmesh.new(); bm.from_mesh(data); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(data); bm.free()
        o=bpy.data.objects.new(name,data); scene.collection.objects.link(o); data.materials.append(material)
        for f in data.polygons: f.use_smooth=True
        groups[kind].append(o); return o
    def curve(name,coords,thickness,kind='frame'):
        data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=8
        data.bevel_depth=thickness;data.bevel_resolution=2;data.use_fill_caps=True
        s=data.splines.new('BEZIER');s.bezier_points.add(len(coords)-1)
        for p,co in zip(s.bezier_points,coords): p.co=xyz(co);p.handle_left_type=p.handle_right_type='AUTO'
        o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);data.materials.append(frame);groups[kind].append(o)
        return o
    for sign in [-1,1]:
        cx=sign*.42; verts=[];faces=[];segments=48;section=8
        for i in range(segments):
            a=i/segments*math.tau;dx,dy=outline(a);norm=math.hypot(dx,dy)
            for j in range(section):
                b=j/section*math.tau
                x=cx+dx+dx/norm*.030*math.cos(b);y=2.015+dy+dy/norm*.030*math.cos(b)
                verts.append((x,y,front(x,y)+.077+.034*math.sin(b)))
        for i in range(segments):
            for j in range(section):
                faces.append((i*section+j,((i+1)%segments)*section+j,((i+1)%segments)*section+(j+1)%section,i*section+(j+1)%section))
        mesh('Sunglasses_Rim_'+str(sign),verts,faces,frame,'frame')
        # A curved solid lens, seated inside the rim, with a real edge thickness.
        verts=[];faces=[];rings=4
        for back in [False,True]:
            for r in range(rings+1):
                t=r/rings
                for i in range(segments):
                    dx,dy=outline(i/segments*math.tau,.263,.252);x=cx+dx*t;y=2.015+dy*t
                    z=front(x,y)+.077+.014*(1-t*t)-(.018 if back else 0)
                    verts.append((x,y,z))
        half=(rings+1)*segments
        for side in range(2):
            for r in range(rings):
                for i in range(segments):
                    a=side*half+r*segments+i;b=side*half+r*segments+(i+1)%segments
                    faces.append((a,b,b+segments,a+segments))
        for i in range(segments):
            a=rings*segments+i;b=rings*segments+(i+1)%segments
            faces.append((a,b,b+half,a+half))
        o=mesh('Sunglasses_Lens_'+str(sign),verts,faces,lens,'lenses')
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
        arm=curve('Sunglasses_Temple_'+str(sign),[(sign*.697,2.12,front(.697,2.12)+.083),(sign*.77,2.15,.43),(sign*.88,2.16,.23),(sign*.87,2.08,-.12)],.018,'temples')
        arm['headphones_fit']='Shortened between face and ear cushion in the runtime'
        # A solid, rounded hinge at the rim/temple join.
        curve('Sunglasses_Hinge_'+str(sign),[(sign*.694,2.10,front(.694,2.10)+.092),(sign*.733,2.14,front(.733,2.14)+.098)],.027)
    curve('Sunglasses_Bridge',[(-.16,2.12,front(-.16,2.12)+.083),(-.07,2.155,front(-.07,2.155)+.093),(.07,2.155,front(.07,2.155)+.093),(.16,2.12,front(.16,2.12)+.083)],.027)
    def pack(values,integer=False):
        values=values if integer else [round(v*10000) for v in values]
        return base64.b64encode(struct.pack('<'+('H' if integer else 'h')*len(values),*values)).decode()
    result={};counts={}
    with bpy.context.temp_override(scene=scene,view_layer=scene.view_layers[0]):
        graph=bpy.context.evaluated_depsgraph_get()
        for name,objects in groups.items():
            position=[];normal=[];index=[];fit=[]
            for o in objects:
                ev=o.evaluated_get(graph);m=ev.to_mesh();m.calc_loop_triangles();base=len(position)//3
                for v in m.vertices:
                    x,y,z=web(v.co);position.extend((x,y,z));normal.extend(web(v.normal))
                    if name=='temples':
                        # Smoothly compress only the rear arm into the gap ahead of the pads.
                        t=max(0,min(1,(.44-z)/.58))
                        fit.extend((-math.copysign(.04*t,x),.02*t,.51*t))
                for tri in m.loop_triangles:index.extend(base+i for i in tri.vertices)
                ev.to_mesh_clear()
            result[name]={'position':pack(position),'normal':pack(normal),'index':pack(index,True)}
            if fit:result[name]['fit']=pack(fit)
            counts[name]={'vertices':len(position)//3,'triangles':len(index)//3}
    with open(os.path.join(ROOT,'src/lib/noot/sunglasses-data.ts'),'w') as f:
        f.write('// Generated through Blender MCP by scripts/blender/noot_sunglasses.py.\nexport default '+json.dumps(result,separators=(',',':'))+'\n')
    bpy.data.libraries.write(os.path.join(ROOT,'assets/noot/sunglasses.blend'),{scene},fake_user=True,compress=True)
    print(json.dumps(counts))

if __name__=='__main__':build()
