"""Original fitted clothing and shoes. Run through Blender MCP; preserve the active Noot scene."""
import bpy, bmesh, math, os, sys, json, struct, base64
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
sys.path.insert(0,os.path.dirname(__file__))
import noot_asset as n

def xyz(p): return (p[0],-p[2],p[1])
def web(p): return (p[0],p[2],-p[1])
def front(x,y,offset=.045): return -n.front(x,y)+offset

def build():
    old=bpy.data.scenes.get('Noot Fashion Atelier')
    if old:
        for o in list(old.objects): bpy.data.objects.remove(o,do_unlink=True)
        bpy.data.scenes.remove(old)
    scene=bpy.data.scenes.new('Noot Fashion Atelier')
    materials={k:n.mat('Noot_Fashion_'+k,c,r) for k,c,r in [('base','#7893ab',.88),('trim','#eee7d7',.9),('detail','#b7a77f',.44),('lining','#f3eddf',.8),('lens','#17323a',.14),('glass','#d9eeee',.10),('sole','#35302a',.85)]}
    groups={}; bone_names=['pelvis','chest','head','upper_arm_L','forearm_L','upper_arm_R','forearm_R','foot_L','foot_R']
    def add(o,style,role,weight='body'):
        o['fashion']=style;o['material_role']=role;o['weight_mode']=weight
        o.data.materials.append(materials[role]);scene.collection.objects.link(o)
        groups.setdefault((style,role),[]).append(o); return o
    def mesh(name,verts,faces,style,role='base',weight='body',thick=0):
        data=bpy.data.meshes.new(name);data.from_pydata([xyz(p) for p in verts],[],faces);data.update()
        bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
        for p in data.polygons:p.use_smooth=True
        o=add(bpy.data.objects.new(name,data),style,role,weight)
        if thick:
            m=o.modifiers.new('Soft fabric thickness','SOLIDIFY');m.thickness=thick;m.offset=0
        return o
    def tube(name,points,r,style,role='base',weight='body',closed=False):
        data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=3;data.bevel_depth=r;data.bevel_resolution=1;data.use_fill_caps=True
        s=data.splines.new('POLY');s.points.add(len(points)-1);s.use_cyclic_u=closed
        for p,co in zip(s.points,points):p.co=(*xyz(co),1)
        return add(bpy.data.objects.new(name,data),style,role,weight)
    def sphere(name,c,scale,style,role='base',weight='body'):
        seg=10 if name.startswith('Wreath') else 16;rows=6 if name.startswith('Wreath') else 8;v=[];f=[]
        for i in range(rows+1):
            p=i/rows*math.pi
            for j in range(seg):
                a=j/seg*math.tau;v.append((c[0]+scale[0]*math.sin(p)*math.cos(a),c[1]+scale[1]*math.cos(p),c[2]+scale[2]*math.sin(p)*math.sin(a)))
        for i in range(rows):
            for j in range(seg):a=i*seg+j;b=i*seg+(j+1)%seg;f.append((a,b,b+seg,a+seg))
        return mesh(name,v,f,style,role,weight)
    def jacket(style):
        seg=48;rows=18;verts=[];faces=[]
        def top(a):
            forward=max(0,math.sin(a))
            return 1.68-(.44*forward**10 if style in ['cardigan','suit'] else .07*forward**6)
        def point(a,t):
            y=.40+(top(a)-.40)*t
            r=n.radius(y)+.042+.004*math.cos(12*a)*math.sin(t*math.pi)**2
            return (math.cos(a)*r,y,math.sin(a)*r*.84)
        for i in range(rows+1):
            for j in range(seg):verts.append(point(j/seg*math.tau,i/rows))
        for i in range(rows):
            for j in range(seg):a=i*seg+j;b=i*seg+(j+1)%seg;faces.append((a,b,b+seg,a+seg))
        mesh(style+'_body',verts,faces,style,thick=.012)
        tube(style+'_hem',[point(j/seg*math.tau,0) for j in range(seg)],.022,style,'trim',closed=True)
        tube(style+'_collar',[point(j/seg*math.tau,1) for j in range(seg)],.027,style,'trim',closed=True)
        # A narrow rounded placket reads as cloth, with real buttons and pocket piping.
        tube(style+'_placket',[(0,.42+i/24*(top(math.pi/2)-.42),front(0,.42+i/24*(top(math.pi/2)-.42),.068)) for i in range(25)],.026,style,'trim')
        for y in [.60,.83,1.06]+([1.29,1.48] if style=='varsity' else []):
            sphere(style+'_button',(0,y,front(0,y,.095)),(.021,.021,.010),style,'detail')
        for sign,side in [(-1,'L'),(1,'R')]:
            # Drop shoulder with a gently tapered sleeve; no inflated bicep silhouette.
            profiles=[(1.63,.86,.072),(1.55,.90,.118),(1.40,.96,.138),(1.25,1.00,.129),(1.10,1.04,.105)]
            v=[];f=[];sectors=24
            for y,x,r in profiles:
                for j in range(sectors):
                    a=j/sectors*math.tau;v.append((sign*x+r*math.cos(a),y,.005+r*.92*math.sin(a)))
            for i in range(len(profiles)-1):
                for j in range(sectors):a=i*sectors+j;b=i*sectors+(j+1)%sectors;f.append((a,b,b+sectors,a+sectors))
            role='trim' if style=='varsity' else 'base'
            mesh(style+'_sleeve_'+side,v,f,style,role,'arm_'+side,.012)
            tube(style+'_cuff_'+side,[(sign*1.04+.105*math.cos(j/sectors*math.tau),1.10,.005+.097*math.sin(j/sectors*math.tau)) for j in range(sectors)],.018,style,'trim','arm_'+side,True)
            tube(style+'_pocket_'+side,[(sign*(.39+i/12*.23),.73+i/12*.11,front(sign*(.39+i/12*.23),.73+i/12*.11,.066)) for i in range(13)],.014,style,'trim')
    jacket('cardigan');jacket('varsity')
    # Rounded dungarees: a low body, raised front bib, seam, and wraparound straps.
    style='overalls';seg=48;rows=16;v=[];f=[]
    for i in range(rows+1):
        for j in range(seg):
            a=j/seg*math.tau;top=.98+.45*n.smooth((math.sin(a)-.79)/.14);y=.32+(top-.32)*i/rows;r=n.radius(y)+.038
            v.append((r*math.cos(a),y,r*.84*math.sin(a)))
    for i in range(rows):
        for j in range(seg):a=i*seg+j;b=i*seg+(j+1)%seg;f.append((a,b,b+seg,a+seg))
    mesh('Overalls_body',v,f,style,thick=.014)
    for sign in [-1,1]:
        # Straps are real flat ribbons over the upper torso, not lines painted on.
        verts=[];faces=[];count=40
        for i in range(count+1):
            t=i/count;a=1.22*(1-2*t);y=1.33*(1-t)+1.02*t+.46*math.sin(math.pi*t);r=n.radius(y)+.058
            for offset in [-.062,.062]:
                angle=a+offset
                verts.append((sign*r*math.cos(angle),y,r*.84*math.sin(angle)))
        for i in range(count):faces.append((i*2,i*2+1,i*2+3,i*2+2))
        mesh('Overall_strap',verts,faces,style,thick=.016)
        sphere('Overall_buckle',(sign*.34,1.33,front(sign*.34,1.33,.077)),(.029,.038,.012),style,'detail')
    # Curved bib-pocket seam.
    tube('Overall_pocket',[(-.19,1.22,front(-.19,1.22,.071)),(-.18,1.05,front(-.18,1.05,.071)),(0,1.01,front(0,1.01,.071)),(.18,1.05,front(.18,1.05,.071)),(.19,1.22,front(.19,1.22,.071))],.009,style,'trim')
    import noot_accessories
    noot_accessories.build(mesh,tube,sphere)
    def surface_patch(name, corners, style, role='base', depth=.07):
        # Subdivide each panel onto the pear surface before giving it thickness.
        verts=[];faces=[];steps=8
        for row in range(steps+1):
            t=row/steps
            for col in range(steps+1):
                u=col/steps
                x=(1-t)*((1-u)*corners[0][0]+u*corners[1][0])+t*((1-u)*corners[3][0]+u*corners[2][0])
                y=(1-t)*((1-u)*corners[0][1]+u*corners[1][1])+t*((1-u)*corners[3][1]+u*corners[2][1])
                verts.append((x,y,front(x,y,depth)))
        for row in range(steps):
            for col in range(steps):
                a=row*(steps+1)+col;faces.append((a,a+1,a+steps+2,a+steps+1))
        return mesh(name,verts,faces,style,role,thick=.012)
    def bow(name,y,style,role='trim',back=False):
        z=front(0,y,.115)*(-1 if back else 1)
        for sign in [-1,1]:sphere(name+'_loop',(sign*.10,y,z),(.13,.077,.046),style,role)
        sphere(name+'_knot',(0,y,z+.012),(.049,.052,.053),style,role)
    def dress(style):
        segments=48;rows=20;v=[];f=[];ballet=style=='ballet'
        def point(a,t):
            bottom=.36+(.024*math.cos(12*a) if ballet else .012*math.cos(10*a))
            top=1.55-.20*max(0,math.sin(a))**6
            y=bottom+(top-bottom)*t
            skirt=max(0,min(1,(1.08-y)/.72))
            fitted=n.radius(y)+.045
            r=max(fitted,1.015+skirt*(.28 if ballet else .20)) if y<1.08 else fitted
            r+=.024*math.cos((12 if ballet else 10)*a)*skirt
            return (r*math.cos(a),y,r*.84*math.sin(a))
        for i in range(rows+1):
            for j in range(segments):v.append(point(j/segments*math.tau,i/rows))
        for i in range(rows):
            for j in range(segments):a=i*segments+j;b=i*segments+(j+1)%segments;f.append((a,b,b+segments,a+segments))
        mesh(style+'_silhouette',v,f,style,thick=.012)
        tube(style+'_neckline',[point(j/segments*math.tau,1) for j in range(segments)],.017,style,'trim',closed=True)
        tube(style+'_hem',[point(j/segments*math.tau,0) for j in range(segments)],.018,style,'trim',closed=True)
        tube(style+'_waist',[(1.052*math.cos(j/segments*math.tau),1.1,1.052*.84*math.sin(j/segments*math.tau)) for j in range(segments)],.022,style,'trim',closed=True)
        for sign in [-1,1]:
            verts=[];faces=[];steps=40
            for i in range(steps+1):
                t=i/steps;a=1.18*(1-2*t);y=1.42+.06*t+.18*math.sin(math.pi*t);r=n.radius(y)+.034
                for offset in [-.048,.048]:
                    angle=a+offset
                    verts.append((sign*r*math.cos(angle),y,r*.84*math.sin(angle)))
            for i in range(steps):faces.append((i*2,i*2+1,i*2+3,i*2+2))
            mesh(style+'_shoulder_ribbon',verts,faces,style,'trim',thick=.014)
        bow(style+'_ribbon',1.11,style)
        for sign in [-1,1]:
            surface_patch(style+'_ribbon_tail',[(sign*.03,1.1),(sign*.10,1.1),(sign*.22,.90),(sign*.10,.93)],style,'trim',.13)
        if ballet:
            # An opaque second ruffle keeps depth sorting reliable for group scenes.
            v=[];f=[];rows=8
            for i in range(rows+1):
                t=i/rows
                for j in range(segments):
                    a=j/segments*math.tau;y=1.07-.48*t+.025*math.cos(12*a)*t
                    r=1.055+.20*t+.025*math.cos(12*a)*t
                    v.append((r*math.cos(a),y,r*.84*math.sin(a)))
            for i in range(rows):
                for j in range(segments):a=i*segments+j;b=i*segments+(j+1)%segments;f.append((a,b,b+segments,a+segments))
            mesh('Ballet_upper_ruffle',v,f,style,'trim',thick=.008)
            bow('Ballet_back_bow',1.11,style,back=True)
    dress('dress');dress('ballet')
    jacket('suit')
    surface_patch('Suit_shirt',[(-.31,1.65),(.31,1.65),(.02,1.19),(-.02,1.19)],'suit','lining',.058)
    for sign in [-1,1]:
        surface_patch('Suit_lapel',[(sign*.43,1.65),(sign*.26,1.69),(sign*.055,1.19),(sign*.30,1.39)],'suit','trim',.09)
    bow('Suit_bow_tie',1.55,'suit','base')
    for y in [1.37,1.44]:sphere('Suit_shirt_button',(0,y,front(0,y,.083)),(.012,.013,.010),'suit','detail')
    def street_top(style):
        rain=style=='raincoat';track=style=='tracksuit';segments=48;rows=18;v=[];f=[]
        def point(a,t):
            top=1.64-.19*max(0,math.sin(a))**6
            y=(.37 if rain else .44)+(top-(.37 if rain else .44))*t
            r=n.radius(y)+(.065 if rain else .06)+.004*math.cos(10*a)*math.sin(t*math.pi)
            if rain and y<.9:r=max(r,1.045-.04*t)
            return (r*math.cos(a),y,r*.84*math.sin(a))
        for i in range(rows+1):
            for j in range(segments):v.append(point(j/segments*math.tau,i/rows))
        for i in range(rows):
            for j in range(segments):a=i*segments+j;b=i*segments+(j+1)%segments;f.append((a,b,b+segments,a+segments))
        mesh(style+'_body',v,f,style,thick=.012)
        tube(style+'_hem',[point(j/segments*math.tau,0) for j in range(segments)],.023,style,'trim',closed=True)
        tube(style+'_neck',[point(j/segments*math.tau,1) for j in range(segments)],.028,style,'trim',closed=True)
        for sign,side in [(-1,'L'),(1,'R')]:
            profiles=[(1.65,.88,.07),(1.51,.93,.12),(1.37,.98,.147),(1.23,1.025,.14),(1.07,1.065,.103)]
            v=[];f=[];ns=20
            for y,x,r in profiles:
                for j in range(ns):a=j/ns*math.tau;v.append((sign*x+r*math.cos(a),y,r*.95*math.sin(a)))
            for i in range(len(profiles)-1):
                for j in range(ns):a=i*ns+j;b=i*ns+(j+1)%ns;f.append((a,b,b+ns,a+ns))
            mesh(style+'_sleeve_'+side,v,f,style,'base','arm_'+side,.012)
            tube(style+'_cuff_'+side,[(sign*1.065+.103*math.cos(j/ns*math.tau),1.07,.098*math.sin(j/ns*math.tau)) for j in range(ns)],.021,style,'trim','arm_'+side,True)
            if track:
                for offset in [-.026,.026]:tube('Track_sleeve_stripe_'+side,[(sign*x+offset,y,r*.95+.008) for y,x,r in profiles[1:]],.012,style,'trim','arm_'+side)
        if not track:
            # A folded fabric pouch behind the neck, with a rolled open rim.
            # It sits below the cups, rather than forming a rigid collar ring.
            verts=[];faces=[];coords=[];cols=32;rows=10
            for row in range(rows+1):
                t=row/rows
                for col in range(cols+1):
                    u=-1+2*col/cols;x=.68*u
                    top=1.72+.07*(1-u*u);bottom=1.43+.27*u*u
                    y=bottom+(top-bottom)*t
                    z=-front(x,y,.09+.065*math.sin(math.pi*t)*(1-u*u))
                    verts.append((x,y,z))
                    if row==rows:coords.append((x,y,z))
            for row in range(rows):
                for col in range(cols):
                    a=row*(cols+1)+col;faces.append((a,a+1,a+cols+2,a+cols+1))
            mesh(style+'_folded_hood',verts,faces,style,'trim',thick=.018)
            tube(style+'_hood_rim',coords,.027,style,'trim')
        if style=='hoodie':
            surface_patch('Hoodie_kangaroo_pocket',[(-.40,1.00),(.40,1.00),(.33,.70),(-.33,.70)],style,'base',.096)
            for sign in [-1,1]:tube('Hoodie_pocket_seam',[(sign*.40,1.00,front(sign*.40,1.00,.106)),(sign*.29,.91,front(sign*.29,.91,.106)),(sign*.33,.70,front(sign*.33,.70,.106))],.012,style,'trim')
            coords=[]
            for j in range(33):
                x=-.47+j/32*.94;y=1.22+.22*(abs(x)/.47)**1.5;coords.append((x,y,front(x,y,.10)))
            tube('Hoodie_chain',coords,.012,style,'detail')
            sphere('Hoodie_note',(0,1.16,front(0,1.16,.119)),(.045,.032,.018),style,'detail')
            tube('Hoodie_note_stem',[(.033,1.17,front(.033,1.17,.12)),(.033,1.26,front(.033,1.26,.12)),(.075,1.245,front(.075,1.245,.12))],.011,style,'detail')
        else:
            tube(style+'_zip',[(0,.43+j/28*1.0,front(0,.43+j/28*1.0,.086)) for j in range(29)],.016,style,'trim')
            if track:
                surface_patch('Track_chest_band',[(-.73,1.33),(.73,1.33),(.75,1.24),(-.75,1.24)],style,'trim',.09)
            else:
                for sign in [-1,1]:
                    surface_patch('Rain_pocket',[(sign*.28,.87),(sign*.59,.91),(sign*.57,.77),(sign*.29,.73)],style,'trim',.09)
                    for y in [.66,.91,1.16,1.39]:sphere('Rain_snap',(sign*.12,y,front(sign*.12,y,.092)),(.021,.023,.014),style,'detail')
    for style in ['hoodie','tracksuit','raincoat']:street_top(style)
    def weights(p,mode):
        if mode=='head':return {'head':1}
        if mode.startswith('foot'):return {mode:1}
        if mode.startswith('arm'):
            t=n.smooth((1.39-p[1])/.27);s=mode[-1]
            return {'upper_arm_'+s:1-t,'forearm_'+s:t}
        return n.body_weights(n.Vector(xyz(p)))
    def pack(vals,kind='h'):
        return base64.b64encode(struct.pack('<'+kind*len(vals),*vals)).decode()
    result=[];counts={}
    with bpy.context.temp_override(scene=scene,view_layer=scene.view_layers[0]):
        graph=bpy.context.evaluated_depsgraph_get()
        for (style,role),objects in groups.items():
            pos=[];norm=[];index=[];joints=[];skin=[];sway=[]
            for o in objects:
                ev=o.evaluated_get(graph);m=ev.to_mesh();m.calc_loop_triangles();base=len(pos)//3
                for vertex in m.vertices:
                    p=web(vertex.co);pos.extend(round(x*10000) for x in p);norm.extend(round(x*10000) for x in web(vertex.normal))
                    if style in ['dress','ballet']:
                        hem=max(0,min(1,(1.10-p[1])/.75))**2
                        sway.extend(round(x*10000) for x in (.044*hem,.009*hem*math.sin(math.atan2(p[2],p[0])),.016*hem))
                    w=sorted([(bone_names.index(k),v) for k,v in weights(p,o['weight_mode']).items() if v>1e-6],key=lambda x:-x[1])[:4]
                    w += [(0,0)]*(4-len(w));joints.extend(k for k,v in w);skin.extend(round(v*10000) for k,v in w)
                for tri in m.loop_triangles:index.extend(base+i for i in tri.vertices)
                ev.to_mesh_clear()
            result.append({'style':style,'role':role,'position':pack(pos),'normal':pack(norm),'index':pack(index,'H'),'joints':pack(joints,'B'),'weights':pack(skin,'H')})
            if sway:result[-1]['sway']=pack(sway)
            counts[style]=counts.get(style,0)+len(index)//3
    target=os.path.join(ROOT,'src/lib/noot/fashion-meshes');os.makedirs(target,exist_ok=True)
    for style in counts:
        with open(os.path.join(target,style+'.ts'),'w') as f:
            f.write('// Generated through Blender MCP.\nexport default '+json.dumps([part for part in result if part['style']==style],separators=(',',':'))+'\n')
    with open(os.path.join(ROOT,'src/lib/noot/fashion-data.ts'),'w') as f:
        f.write('// Generated through Blender MCP by scripts/blender/noot_fashion.py.\nexport const fashionBones='+json.dumps(bone_names)+'\n')
        f.write('export const fashionStyles = {\n'+''.join(json.dumps(style)+': () => import(\'./fashion-meshes/'+style+'.ts\'),\n' for style in counts)+'}\n')
    bpy.data.libraries.write(os.path.join(ROOT,'assets/noot/fashion.blend'),{scene},fake_user=True,compress=True)
    print(json.dumps({'triangles':counts,'draw_groups':len(result)}))

if __name__=='__main__':build()
