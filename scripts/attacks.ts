import {readFileSync,writeFileSync}from'node:fs';import{view,accessKeys,makeIntent,signIntent,execute,base64,nearAmount,submit,actions,outcome,pqHandle,publicKeys}from'../sdk/index.ts';
const d=JSON.parse(readFileSync('.demo/live.json','utf8'));const file='deployments/attacks.json';let records:any[]=[];try{records=JSON.parse(readFileSync(file,'utf8'));}catch{}
async function run(name:string,action:any,change:(s:any)=>void=()=>{},expected=true){if(records.some(r=>r.name===name)){console.log('SKIP',name);return;}const s=await view(d.wallet);const signed=signIntent(makeIntent(d.wallet,s.nonce,action),d.keys);change(signed);const r=await execute(d.relay,d.wallet,signed);if(r.success!==expected)throw Error(name+' unexpected '+JSON.stringify(r));records.push({name,...r});writeFileSync(file,JSON.stringify(records,null,2));console.log(name,r.hash,r.success);return signed;}
const send={kind:'send',receiver:d.relay.account,amount:nearAmount('0.001')};
await run('forged classical signature',send,s=>s.ed_sig=base64.encode(new Uint8Array(64)),false);
await run('forged quantum signature',send,s=>s.pq_sig=base64.encode(new Uint8Array(3309)),false);
await run('missing quantum half',send,s=>s.pq_sig='',false);
await run('wrong message',send,s=>s.intent=s.intent.replace('0.001','0.002').replace('1000000000000000000000','2000000000000000000000'),false);
await run('wrong wallet',send,s=>s.intent=s.intent.replace(d.wallet,d.relay.account),false);
await run('expired message',send,s=>{const i=JSON.parse(s.intent);i.expires='1';Object.assign(s,signIntent(JSON.stringify(i),d.keys));},false);
await run('migration by non-owner',{kind:'migrate'},s=>s.ed_sig=base64.encode(new Uint8Array(64)),false);
await run('self call forbidden',{kind:'call',receiver:d.wallet,method:'settle',args:'e30=',deposit:'0'},()=>{},false);
const signed=await run('valid dual transfer',send);
if(signed&&!records.some(r=>r.name==='replayed transfer')){const r=await execute(d.relay,d.wallet,signed);if(r.success)throw Error('Replay succeeded');records.push({name:'replayed transfer',...r});writeFileSync(file,JSON.stringify(records,null,2));console.log('replayed transfer',r.hash,r.success);}
const pub=JSON.parse(readFileSync('web/public/live.json','utf8'));pub.transactions=[...records,...pub.transactions];writeFileSync('web/public/live.json',JSON.stringify(pub,null,2));
