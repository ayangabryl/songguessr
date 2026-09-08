"""Distinct fitted headwear, eyewear and footwear; called by noot_fashion through MCP.
Coordinates are Noot's web rest space (Y up, +Z front). All parts bind to the existing rig.
"""
import math
import noot_asset as n
T=math.tau

def build(mesh,tube,sphere):
    def loop(cx,y,cz,rx,rz,count=40,power=2):
        def shaped(v):return math.copysign(abs(v)**(2/power),v)
        return [(cx+rx*shaped(math.cos(j/count*T)),y,cz+rz*shaped(math.sin(j/count*T))) for j in range(count)]
    def loft(name,rings,style,role='base',weight='head',thick=.012):
        # Every ring has the same count; open cuffs have actual inner fabric thickness.
        count=len(rings[0]);v=[p for ring in rings for p in ring];f=[]
        for i in range(len(rings)-1):
            for j in range(count):a=i*count+j;b=i*count+(j+1)%count;f.append((a,b,b+count,a+count))
        return mesh(name,v,f,style,role,weight,thick)
    def rim(name,points,r,style,role='trim',weight='head'):return tube(name,points,r,style,role,weight,True)
    # Eight different uppers: height, toe profile, opening, sole and construction vary.
    for style in ['sneakers','boots','high-tops','mary-janes','loafers','sandals','slippers','ballet-flats']:
        for sign,side in [(-1,'L'),(1,'R')]:
            cx=sign*.45;weight='foot_'+side;prefix=style+'_'+side
            boot=style=='boots';high=style=='high-tops';flat=style in ['mary-janes','ballet-flats','loafers'];sandal=style=='sandals'
            power=3.1 if style in ['loafers','boots'] else 2.2
            toe=.34 if style=='slippers' else .32;depth=.355 if boot or high else .34
            sole=.045 if style=='ballet-flats' else .055 if flat or sandal else .085
            rings=[loop(cx,y,.095,toe*r,depth*r,power=power) for y,r in [(0,.93),(.012,1),(sole-.01,1),(sole,.97)]]
            sole_role='sole' if boot or style=='loafers' else 'trim'
            loft(prefix+'_sole',rings,style,sole_role,weight,0)
            mesh(prefix+'_bottom',rings[0],[tuple(reversed(range(40)))],style,sole_role,weight)
            if sandal:
                # Open toes and heel; two broad curved straps, not a solid shoe blob.
                for k,z in enumerate([.22,-.07]):
                    rings=[];v=[];f=[]
                    for i in range(21):
                        a=math.pi*i/20
                        for offset in [-.055,.055]:v.append((cx+.31*math.cos(a),sole+.24*math.sin(a),z+offset))
                    for i in range(20):f.append((2*i,2*i+1,2*i+3,2*i+2))
                    mesh(prefix+'_strap_'+str(k),v,f,style,'base',weight,.018)
                sphere(prefix+'_buckle',(cx+sign*.30,.16,-.07),(.024,.032,.045),style,'detail',weight)
                continue
            if style=='slippers':
                # Open-backed, broad toe with a visibly rolled fuzzy opening.
                rings=[]
                for t in [0,.2,.45,.7,1]:
                    rings.append(loop(cx,sole+.23*t,.105+.04*t,toe*(1-.19*t),depth*(1-.45*t),power=2.1))
                loft(prefix+'_mule',rings,style,'base',weight,.018)
                rim(prefix+'_fleece',rings[-1],.037,style,'trim',weight)
                for j in [-1,1]:sphere(prefix+'_pom',(cx+j*.065,.34,.17),(.070,.045,.067),style,'trim',weight)
                continue
            height=.44 if boot else .39 if high else .285 if style=='ballet-flats' else .30 if flat else .33
            # A toe dome covers the original foot before rolling back into the ankle
            # opening. A cone loft exposed green toes through closed shoes.
            profile=[(sole,toe,depth,.095),(.14,toe,.345,.095),(.225,.30,.32,.085),(.30,.265,.27,.065),
                     (max(.33,height-.065),.235,.22,.02),(max(.32,height-.025),.215,.19,-.025),(height,.20,.17,-.055)]
            rings=[loop(cx,y,cz,rx,rz,power=power) for y,rx,rz,cz in profile]
            loft(prefix+'_upper',rings,style,'base',weight,.016)
            rim(prefix+'_opening',rings[-1],.018 if flat else .023,style,'base' if flat else 'trim',weight)
            if boot:
                # Leather ankle shaft and a back pull loop distinguish boots from trainers.
                rim(prefix+'_welt',rings[1],.010,style,'detail',weight)
                tube(prefix+'_pull',[(cx-.04,.33,-.235),(cx-.04,.48,-.235),(cx+.04,.48,-.235),(cx+.04,.33,-.235)],.012,style,'base',weight)
                for k in range(3):
                    y=.30+k*.042
                    tube(prefix+'_laces_'+str(k),[(cx-.11,y,.145),(cx+.11,y+.02,.145)],.010,style,'detail',weight)
            elif style in ['sneakers','high-tops']:
                # Real contrasting toe cap on sneakers; high tops have a taller tongue.
                if not high:
                    v=[];f=[]
                    for i in range(7):
                        a=math.pi*.18+i/6*math.pi*.64
                        for t in [0,1]:v.append((cx+.26*math.cos(a),sole+.025+.095*t,.10+(.25+.06*(1-t))*math.sin(a)))
                    for i in range(6):f.append((i*2,i*2+1,i*2+3,i*2+2))
                    mesh(prefix+'_toe_cap',v,f,style,'trim',weight,.008)
                for k in range(4 if high else 3):
                    y=.22+k*(.04 if high else .025);z=.255-k*.045
                    tube(prefix+'_lace_'+str(k),[(cx-.095,y,z),(cx,y+.02,z-.008),(cx+.095,y,z)],.010,style,'trim',weight)
                if high:
                    tube(prefix+'_ankle_stripe',[(cx+sign*.21,.18,.12),(cx+sign*.215,.31,.03),(cx+sign*.19,.34,-.13)],.017,style,'trim',weight)
            elif style=='mary-janes':
                tube(prefix+'_instep_strap',[(cx-.235,.20,.075),(cx-.16,.30,.075),(cx,.33,.075),(cx+.16,.30,.075),(cx+.235,.20,.075)],.026,style,'base',weight)
                sphere(prefix+'_buckle',(cx+sign*.235,.245,.079),(.033,.027,.018),style,'detail',weight)
            elif style=='loafers':
                tube(prefix+'_penny_band',[(cx-.255,.18,.17),(cx-.13,.29,.18),(cx+.13,.29,.18),(cx+.255,.18,.17)],.032,style,'base',weight)
                tube(prefix+'_penny_slot',[(cx-.07,.316,.185),(cx+.07,.316,.185)],.010,style,'detail',weight)
            else:
                for d in [-1,1]:
                    rim(prefix+'_ribbon',[(cx+d*.05+.052*math.cos(j/20*T),.272,.185+.031*math.sin(j/20*T)) for j in range(20)],.009,style,'trim',weight)
    # New hats all leave the music-note stem clear and fit the upper pear.
    for style in ['cap','beret','visor','crown','party-hat','flower-crown']:
        if style in ['cap','beret']:
            rings=[]
            for i in range(13):
                t=i/12
                if style=='cap':y=2.59+.40*math.sin(t*math.pi/2);r=.14+.51*math.cos(t*math.pi/2);dx=0
                else:y=2.59+.25*math.sin(t*math.pi/2);r=.18+.46*math.cos(t*math.pi/2)+.14*math.sin(t*math.pi);dx=-.12*math.sin(math.pi*t)
                rings.append(loop(dx,y,0,r,r*.84,count=48))
            loft(style+'_crown',rings,style)
            rim(style+'_band',rings[0],.025,style)
            rim(style+'_stem_opening',rings[-1],.013,style,'base')
        if style in ['cap','visor']:
            if style=='visor':loft('Visor_band',[loop(0,y,0,r,r*.84,48) for y,r in [(2.55,.69),(2.63,.65)]],style)
            v=[];f=[];cols=32;rows=7
            for i in range(rows+1):
                t=i/rows
                for j in range(cols+1):
                    a=.1+(math.pi-.2)*j/cols
                    r=.64+.37*t*math.sin(a)**.6
                    v.append((r*math.cos(a),2.59-.09*t*t,.84*r*math.sin(a)))
            for i in range(rows):
                for j in range(cols):a=i*(cols+1)+j;f.append((a,a+1,a+cols+2,a+cols+1))
            loftname=style+'_curved_bill';mesh(loftname,v,f,style,'base','head',.025)
            tube(style+'_bill_stitch',v[-cols-1:],.007,style,'trim','head')
        if style=='crown':
            rings=[loop(0,2.57,0,.68,.57,60),loop(0,2.72,0,.64,.54,60),[(.64*math.cos(j/60*T),2.80+.23*max(0,math.cos(j/60*T*5))**4,.54*math.sin(j/60*T)) for j in range(60)]]
            loft('Crown_satin_points',rings,style,'base',thick=.024)
            rim('Crown_lower_band',rings[0],.026,style,'detail')
            for j in range(5):
                a=(j+.25)/5*T;sphere('Crown_jewel',(.66*math.cos(a),2.73,.56*math.sin(a)),(.045,.056,.04),style,'detail','head')
        if style=='party-hat':
            rings=[loop(-.48,2.60+t*.55,.04,.24*(1-t)+.012,.21*(1-t)+.012,40) for t in [0,.15,.4,.65,.85,1]]
            loft('Party_cone',rings,style,thick=.016);rim('Party_soft_rim',rings[0],.028,style)
            sphere('Party_pom',(-.48,3.18,.04),(.06,.06,.06),style,'trim','head')
            for t in [.3,.6]:rim('Party_ribbon',[(-.48+(.24*(1-t)+.015)*math.cos(j/40*T),2.6+t*.55,.04+(.21*(1-t)+.015)*math.sin(j/40*T)) for j in range(40)],.019,style,'trim')
        if style=='flower-crown':
            rim('Flower_wreath',loop(0,2.60,0,.68,.57,48),.032,style,'base')
            for j in range(7):
                a=.1+j/6*(math.pi-.2);cx=.66*math.cos(a);cy=2.66+.025*math.cos(a*3);cz=.58*math.sin(a)
                for k in range(5):
                    b=k/5*T;sphere('Wreath_petal',(cx+.065*math.cos(b),cy+.065*math.sin(b),cz+.01),(.056,.046,.025),style,'trim','head')
                sphere('Wreath_heart',(cx,cy,cz+.04),(.033,.033,.025),style,'detail','head')
    # Curved rings, bridges, hinges and temples. Smoked lenses sit in their frames.
    def shape(style,a):
        c=math.cos(a);s=math.sin(a)
        if style=='round':return (.25*c,.285*s)
        if style=='square':return (.27*math.copysign(abs(c)**.5,c),.245*math.copysign(abs(s)**.5,s))
        if style=='cat-eye':return (.28*c,.235*s+.07*max(0,c)**2)
        if style=='aviator':return (.27*c*(1+.12*s),.29*s-.025*(1-s))
        if style=='heart':return (.017*16*math.sin(a)**3,.018*(13*math.cos(a)-5*math.cos(2*a)-2*math.cos(3*a)-math.cos(4*a)))
        if style=='star':
            r=.235+.065*math.cos(5*(a-math.pi/2));return (r*c,r*s)
        return (.29*c,.17*s)
    for style in ['round','square','cat-eye','aviator','heart','star','sport']:
        smoked=style in ['aviator','heart','star','sport']
        for sign in [-1,1]:
            pts=[];count=64
            for j in range(count):
                dx,dy=shape(style,j/count*T)
                x=sign*.42+dx*(sign if style=='cat-eye' else 1);y=2.015+dy
                pts.append((x,y,-n.front(x,y)+.105))
            rim(style+'_frame',pts,.020 if style in ['round','aviator'] else .030,style,'base')
            # Convex lens fan with a small rim inset, rather than a flat sticker.
            v=[(sign*.42,2.015,-n.front(sign*.42,2.015)+.11)]+[(sign*.42+(x-sign*.42)*.96,2.015+(y-2.015)*.96,z-.003) for x,y,z in pts]
            mesh(style+'_lens',v,[(0,j+1,(j+1)%count+1) for j in range(count)],style,'lens' if smoked else 'glass','head',.008)
            outer=sign*.70;y=2.10;z=-n.front(outer,y)+.11
            # Temples end in front of the earcup envelope and hook around the cheek.
            tube(style+'_temple',[(outer,y,z),(sign*.79,y,.52),(sign*.86,y-.015,.36),(sign*.86,y-.08,.34)],.017,style,'base','head')
            sphere(style+'_hinge',(outer,y,z),(.029,.032,.025),style,'detail','head')
        tube(style+'_bridge',[(-.16,2.055,-n.front(-.16,2.055)+.105),(0,2.10,-n.front(0,2.10)+.105),(.16,2.055,-n.front(.16,2.055)+.105)],.019,style,'base','head')
