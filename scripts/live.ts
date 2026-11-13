import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {generateKeys,random,base64,base58,signerPublic,publicKeys,keyString,submit,actions,outcome,view,query,accessKeys,makeIntent,signIntent,execute,nearAmount,pqHandle,rpc,type Vault,type Signer} from '../sdk/index.ts';
mkdirSync('.demo',{recursive:true});mkdirSync('deployments',{recursive:true});
const path='.demo/live.json';
let d:any=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
if(!d){const suffix=Date.now().toString(36);const relay={account:`magen-${suffix}.testnet`,seed:base64.encode(random())};d={relay,wallet:`shield.${relay.account}`,deploySeed:base64.encode(random()),keys:generateKeys(),steps:{}};writeFileSync(path,JSON.stringify(d),{mode:0o600});}
const save=()=>writeFileSync(path,JSON.stringify(d),{mode:0o600});
const record=(name:string,result:any)=>{d.steps[name]=result;save();const pub={created:new Date().toISOString(),network:'testnet',account:d.wallet,relay:d.relay.account,steps:d.steps};writeFileSync('deployments/testnet.json',JSON.stringify(pub,null,2));console.log(name,JSON.stringify(result));};
async function step(name:string,fn:()=>Promise<any>){if(d.steps[name]){console.log('SKIP',name);return;}record(name,await fn());}
await step('network',async()=>({testnet:(await rpc('status',[])).protocol_version,mainnet:(await rpc('status',[],'https://rpc.mainnet.near.org')).protocol_version}));
await step('relay',async()=>{try{const a=await query('view_account',d.relay.account);return {exists:true,amount:a.amount};}catch{}
 const stamp='.demo/helper-last';if(existsSync(stamp)&&Date.now()-Number(readFileSync(stamp,'utf8'))<60000)throw Error('Helper cooldown; wait 60 seconds');writeFileSync(stamp,String(Date.now()));
 const r=await fetch('https://helper.nearprotocol.com/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({newAccountId:d.relay.account,newAccountPublicKey:keyString(d.relay)})});if(r.status===429)throw Error('BLOCKED helper HTTP 429; no retries');if(!r.ok)throw Error('Helper failed '+r.status);await r.json();const a=await query('view_account',d.relay.account);return {account:d.relay.account,amount:a.amount};});
const deploy:Signer={account:d.wallet,seed:d.deploySeed};
await step('create',async()=>{try{await query('view_account',d.wallet);return {exists:true};}catch{}const r=outcome(await submit(d.relay,d.wallet,[actions.create(),actions.transfer(BigInt(nearAmount('6'))),actions.addKey(signerPublic(deploy))]));if(!r.success)throw Error(r.error);return r;});
await step('deploy_and_lock',async()=>{const pk=publicKeys(d.keys);const wasm=new Uint8Array(readFileSync('target/near/magen_wallet.wasm'));const r=outcome(await submit(deploy,d.wallet,[actions.deploy(wasm),actions.call('new',{ed:base64.encode(pk.ed),pq:base64.encode(pk.pq)},30_000_000_000_000n),actions.deleteKey(signerPublic(deploy))]));if(!r.success)throw Error(r.error);return r;});
await step('locked_keys',async()=>({keys:(await accessKeys(d.wallet)).keys}));
writeFileSync('web/public/live.json',JSON.stringify({wallet:d.wallet,relay:d.relay.account,transactions:Object.entries(d.steps).filter(([_,s]:any)=>s.hash).map(([name,s]:any)=>({name,...s})),created:new Date().toISOString()},null,2));
writeFileSync('.demo/vault.json',JSON.stringify({wallet:d.wallet,keys:d.keys,relay:d.relay}),{mode:0o600});
console.log('LIVE_WALLET',d.wallet);
