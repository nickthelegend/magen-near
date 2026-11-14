# v17 edit list: (id, take, a, b, voice, vat). Landing take, then the iPhone takes recorded on the v17 build.
import json
L='raw/L-landing.mp4'; T=lambda n: f'raw/cfr/{n}.mp4'
P0,P1,P2,P3a,P3b,P4,P5,P6=(T(n) for n in ('P0-install','P1-recv-send','P2-swap','P3a-home-base','P3b-base-arrive','P4-eth','P5-attack','P6-private-lock'))
S=[('landing',L,0.0,22.0,'landing',0.4,'web'),
 ('install',P0,2.0,9.0,'install',2.5),('name',P0,17.0,23.0,'create',0.3),('words',P0,24.0,28.0,None,0),
 ('chains',P0,30.0,40.0,'chains',0.3),('create',P0,40.5,56.0,'create-sign',2.0),('ready',P0,57.0,62.0,None,0),
 ('home',P3a,0.0,3.6,'home',0.2),
 ('recv',P1,2.2,9.8,'receive',0.3),('send-sheet',P1,38.0,56.0,'send',0.2),
 ('send-x',P1,58.0,66.0,'send-explorer',0.3),('send-rcv',P1,78.0,88.0,None,0),
 ('swap-0',P2,4.2,15.0,'swap',0.3),('swap-sheet',P2,16.0,19.5,None,0),('swap-run',P2,20.0,34.0,None,0),
 ('swap-x',P2,38.0,48.0,'swap-done',0.3),('swap-home',P2,74.0,82.0,None,0),
 ('br-pick',P3a,6.0,11.0,'out',0.3),('br-base',P3a,12.0,14.5,None,0),('br-sheet',P3a,18.5,23.0,None,0),('br-run',P3a,24.0,38.4,None,0),
 ('base-done',P3b,0.0,4.0,'out-done',0.3),('base-x',P3b,22.0,34.0,None,0),
 ('sol-pick',P3b,40.0,46.0,None,0),('sol-form',P3b,53.0,59.0,None,0),('sol-run',P3b,60.0,66.0,None,0),('sol-done',P3b,80.0,86.0,None,0),('sol-x',P3b,238.4,241.6,None,0),
 ('eth-to',P4,21.0,27.0,'eth',0.2),('eth-sheet',P4,28.0,33.0,None,0),('eth-run',P4,38.0,52.0,None,0),('eth-done',P4,56.0,60.0,'eth-done',0.3),
 ('eth-x',P4,72.0,82.0,None,0),('eth-rcv',P4,84.0,96.0,None,0),
 ('atk-0',P5,4.0,9.0,'attack',0.3),('atk-sheet',P5,10.0,13.0,None,0),('atk-run',P5,24.0,37.0,None,0),('atk-x',P5,38.0,47.0,None,0),('atk-err',P5,50.0,57.0,None,0),
 ('priv-0',P6,31.6,33.4,'private',0.2),('priv-sheet',P6,34.0,38.5,None,0),('priv-run',P6,40.0,48.0,None,0),('priv-x',P6,50.0,60.0,None,0),
 ('guard-0',P5,62.0,66.0,'guardians',0.3),('guard-sheet',P5,70.0,73.5,None,0),('guard-done',P5,80.0,89.0,None,0),
 ('qday-0',P5,90.0,96.0,'qday',0.3),('qday-c',P5,98.0,101.5,None,0),('qday-sheet',P5,104.0,106.0,None,0),('qday-run',P5,106.0,120.0,None,0),('qday-keys',P5,124.0,136.0,None,0),
 ('activity',P5,142.0,151.0,'activity',0.3),
 ('lock',P6,64.0,79.0,'lock',3.0),
 ('card',None,0,6.5,'close',0.6,'card')]
segs=[]
for r in S:
    i,src,a,b,v,vat=r[:6]; kind=r[6] if len(r)>6 else 'phone'
    d={'id':i,'src':src,'a':a,'b':b,'kind':kind}
    if v: d.update(voice=v,vat=vat)
    segs.append(d)
json.dump({'segments':segs},open('edit.json','w'),indent=1)
print(len(segs),'segments',round(sum(s['b']-s['a'] for s in segs),1),'s')
