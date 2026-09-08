"""Adapt CC0 Mesh2Motion clips to Noot without changing his deformation rig.

Run prepare() once in Blender, then noot_asset.animate(list(CLIPS)). Source
joint trajectories drive the pose; bounded motion preserves the mascot silhouette.
The source is isolated in its own collection and never selected for GLB export.
"""
import bpy, math, json, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLIPS={'Groove':(4,True),'BodyRoll':(8,True),'Charleston':(4,True),'HipSway':(4,True),'VictoryPump':(2.4,False),'FriendlyWave':(3.2,False)}
SOURCES={'Groove':'Idle Listening','BodyRoll':'Dance Body Roll','Charleston':'Dance Charleston','HipSway':'Dance Reach Hip','VictoryPump':'Victory Fist Pump','FriendlyWave':'Greeting'}
CACHE=os.path.join(ROOT,'assets/noot/motions/retarget-samples.json')
DATA=None

def clamp(x,a,b): return max(a,min(b,x))
def smooth(x):
    x=clamp(x,0,1); return x*x*(3-2*x)

def prepare():
    source=bpy.data.objects.get('Motion_Source')
    if not source:
        before=set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'assets/noot/motions/mesh2motion-human.glb'))
        source=next(o for o in set(bpy.data.objects)-before if o.type=='ARMATURE');source.name='Motion_Source'
    collection=bpy.data.collections.get('Motion Reference') or bpy.data.collections.new('Motion Reference')
    if collection.name not in bpy.context.scene.collection.children: bpy.context.scene.collection.children.link(collection)
    collection.hide_viewport=False
    for o in [source]+list(source.children_recursive):
        for c in list(o.users_collection): c.objects.unlink(o)
        collection.objects.link(o);o.hide_render=True;o.select_set(False)
    scene=bpy.context.scene;scene.render.fps=30
    source.animation_data.action=None
    for t in source.animation_data.nla_tracks:t.mute=True
    names=['pelvis','spine_03','head','upperarm_l','lowerarm_l','hand_l','upperarm_r','lowerarm_r','hand_r','foot_l','foot_r']
    rest={n:list(source.data.bones[n].head_local) for n in names}
    output={'source':'Mesh2Motion CC0','rest':rest,'clips':{}}
    for name,(duration,loop) in CLIPS.items():
        track=next(t for t in source.animation_data.nla_tracks if t.name==SOURCES[name]);track.mute=False
        strip=track.strips[0];frames=[];count=round(duration*30)
        for i in range(count+1):
            f=strip.frame_start+(strip.frame_end-strip.frame_start)*i/count
            scene.frame_set(int(f),subframe=f-int(f));bpy.context.view_layer.update()
            frames.append({n:list(source.pose.bones[n].head) for n in names})
        # Close the final 12% smoothly onto the beginning; no abrupt last-frame snap.
        if loop:
            for i in range(count+1):
                w=smooth((i/count-.88)/.12)
                if w:
                    for n in names:frames[i][n]=list(Vector(frames[i][n]).lerp(Vector(frames[0][n]),w))
        output['clips'][name]=frames;track.mute=True
    with open(CACHE,'w') as f:json.dump(output,f,separators=(',',':'))
    collection.hide_viewport=True
    print('Sampled',len(output['clips']),'CC0 source clips into',CACHE)

def pose(name,index,rig,shape):
    global DATA
    if DATA is None:
        with open(CACHE) as f:DATA=json.load(f)
    rows=DATA['clips'][name];row=rows[index];rest=DATA['rest'];q=math.tau*index/(len(rows)-1)
    # Human anatomical left is Noot's screen-right: retain geometry, swap labels.
    def p(n):return Vector(row[n])
    def rot(n,x=0,y=0,z=0):rig.pose.bones[n].rotation_euler=(x,y,z)
    def move(n,x=0,y=0,z=0):rig.pose.bones[n].location=(x,z,-y)
    energy=.5 if name=='Groove' else 1
    t=index/30;duration=CLIPS[name][0]
    envelope=1 if CLIPS[name][1] else smooth(t/.28)*(1-smooth((t-duration+.42)/.42))
    hip=p('pelvis');resthip=Vector(rest['pelvis']);delta=hip-resthip
    move('pelvis',x=clamp(delta.x*.65,-.075,.075)*energy*envelope,z=clamp(delta.z*.25,-.045,.025)*energy*envelope)
    torso=(p('spine_03')-hip).normalized()
    lean=clamp(-math.atan2(torso.y,torso.z)*.55,-.16,.16)*energy*envelope
    sway=clamp(-math.atan2(torso.x,torso.z)*.55,-.15,.15)*energy*envelope
    rot('chest',x=lean,z=sway)
    rot('head',x=-lean*.35,z=-sway*.5)
    for side,s,src in [('L',-1,'r'),('R',1,'l')]:
        upper=(p('lowerarm_'+src)-p('upperarm_'+src)).normalized()
        lower=(p('hand_'+src)-p('lowerarm_'+src)).normalized()
        # Aim soft arms along sampled directions, attenuating extreme human poses.
        outward=clamp(s*upper.x,0,1)
        lift=clamp(math.atan2(outward,-upper.z),0,2.2)*.65
        forward=clamp(-upper.y,-.55,.85)
        rot('upper_arm_'+side,x=-forward*.65*envelope,z=s*(.06+lift*energy)*envelope)
        bend=math.acos(clamp(upper.dot(lower),-1,1))
        rot('forearm_'+side,x=-clamp(bend*.38,0,.62)*energy*envelope,z=s*.08*envelope)
        rot('hand_'+side,x=clamp(-lower.y*.12,-.12,.12)*envelope)
        foot=p('foot_'+src);rf=Vector(rest['foot_'+src]);offset=foot-rf
        # Independent planted feet: Noot has no human thigh/shin chain to copy.
        lift=clamp((foot.z-rf.z)*.40,0,.12)*energy*envelope
        other=p('foot_'+('l' if src=='r' else 'r'));otherrest=Vector(rest['foot_'+('l' if src=='r' else 'r')])
        lift=max(0,lift-clamp((other.z-otherrest.z)*.40,0,.12)*energy*envelope)
        move('foot_'+side,x=clamp((offset.x-delta.x)*.40,-.09,.09)*energy*envelope,y=clamp((offset.y-delta.y)*.40,-.13,.13)*energy*envelope,z=lift)
    # Stage-sized choreography: the sampled human motion supplies nuance, while
    # explicit accents stay readable when a Noot is only 100–180 pixels tall.
    if name in {'Groove','BodyRoll','Charleston','HipSway'}:
        beat=q*(8 if name=='BodyRoll' else 4)
        weight=math.sin(beat*.5)
        bounce=(1-math.cos(beat*2))*.5
        if name=='Groove':
            lean=.045*math.sin(beat-.3);sway=-.115*weight
            move('pelvis',x=.115*weight,z=-.035*bounce)
            rot('chest',x=lean,z=sway,y=.065*math.sin(beat*.5-.3))
        elif name=='BodyRoll':
            roll=q*2
            lean=.23*math.sin(roll)+lean*.2;sway=.11*math.cos(roll)
            move('pelvis',x=.15*math.sin(roll-.5),z=-.055*(1-math.cos(roll))* .5)
            rot('chest',x=lean,z=sway,y=.14*math.sin(roll-.8))
        elif name=='Charleston':
            lean=-.10+.045*math.cos(beat);sway=.10*weight
            move('pelvis',x=.09*weight,z=-.045*bounce)
            rot('chest',x=lean,z=sway,y=.13*math.sin(beat*.5))
        else:
            lean=.04*math.sin(beat);sway=-.19*weight
            move('pelvis',x=.19*weight,z=-.04*bounce)
            rot('chest',x=lean,z=sway,y=.17*math.sin(beat*.5-.35))
        rot('head',x=-lean*.55,z=-sway*.55)
        for side,sign in [('L',-1),('R',1)]:
            phase=beat*.5+(0 if side=='L' else math.pi)
            step=max(0,math.sin(phase))
            if name=='BodyRoll':
                rot('upper_arm_'+side,x=-.35-.34*math.sin(q*2-.35+sign*.35),z=sign*(.70+.23*math.cos(q*2+sign*.45)))
                rot('forearm_'+side,x=-.35-.18*math.sin(q*2-.7),z=sign*.16)
                move('foot_'+side,x=sign*.06*step,y=.055*math.sin(phase),z=.08*step)
            elif name=='Charleston':
                rot('upper_arm_'+side,x=.50*math.sin(phase-.3),z=sign*(.50+.18*math.cos(beat)))
                rot('forearm_'+side,x=-.35,z=sign*.12)
                move('foot_'+side,x=sign*.11*math.sin(beat),y=.22*math.sin(phase),z=.15*step)
                rot('foot_'+side,x=.20*math.sin(phase),y=sign*.24*math.sin(beat))
            elif name=='HipSway':
                reach=max(0,math.sin(phase))
                rot('upper_arm_'+side,x=-.26-.20*math.sin(phase),z=sign*(.55+.65*reach))
                rot('forearm_'+side,x=-.48,z=sign*.18)
                move('foot_'+side,x=sign*.085*step,z=.095*step)
            else:
                rot('upper_arm_'+side,x=-.22+.42*math.sin(phase-.3),z=sign*(.48+.30*math.sin(phase)))
                rot('forearm_'+side,x=-.32,z=sign*.13)
                move('foot_'+side,x=sign*.09*step,y=.035*math.sin(phase),z=.11*step)
            rot('hand_'+side,x=.12*math.sin(phase-.7),z=sign*.07)
            # Toe turns may rotate the sole below zero. Bake its true rest-basis
            # clearance once here, not by scanning vertices in the browser.
            bone=rig.pose.bones['foot_'+side]
            restbone=rig.data.bones[bone.name]
            basis=restbone.matrix_local.to_3x3()
            rotation=basis@bone.rotation_euler.to_matrix()@basis.inverted()
            foot=bpy.data.objects['Noot_Foot_'+side]
            minimum=min((rotation@(v.co-restbone.head_local)+restbone.head_local).z for v in foot.data.vertices)
            bone.location.y-=minimum
    rot('note_stem',x=-lean*.42+math.sin(q-.5)*.04*energy,z=-sway*.50+math.sin(q-.7)*.055*energy)
    rot('note_tip',x=-lean*.50+math.sin(q-.9)*.045*energy,z=-sway*.65+math.sin(q-1.1)*.07*energy)
    shape('Noot_Mouth','Open',(.22 if name=='Groove' else .44 if name=='VictoryPump' else .34)*envelope)
