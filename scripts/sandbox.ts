import{Worker}from'near-workspaces';import{readFileSync,writeFileSync}from'node:fs';import{generateKeys,publicKeys,base64,makeIntent,signIntent,nearAmount}from'../sdk/index.ts';import assert from'node:assert/strict';
const worker=await Worker.init({homeDir:process.cwd()+'/.demo/sandbox',port:5592,rm:true});let count=0;const results:any[]=[];
try{const root=worker.rootAccount;const wallet=await root.createSubAccount('wallet',{initialBalance:10n**25n});const recipient=await root.createSubAccount('recipient');await wallet.deploy('target/near/magen_wallet.wasm');const k=generateKeys(),pk=publicKeys(k);await wallet.call(wallet,'new',{ed:base64.encode(pk.ed),pq:base64.encode(pk.pq)});const send={kind:'send' as const,receiver:recipient.accountId,amount:nearAmount('0.01')};
const sign=async(action:any=send)=>signIntent(makeIntent(wallet.accountId,(await wallet.view<any>('status',{})).nonce,action),k);
async function attempt(name:string,signed:any,error?:string){try{const r=await root.call(wallet,'execute',signed,{gas:100_000_000_000_000n});assert(!error,name+' should reject');assert.equal(r,true);}catch(e){if(!error||!String(e).includes(error))throw e;}count++;results.push({name,passed:true});console.log('PASS',name);}
await attempt('forged ed25519',{...await sign(),ed_sig:base64.encode(new Uint8Array(64))},'classical half invalid');
await attempt('forged ML-DSA',{...await sign(),pq_sig:base64.encode(new Uint8Array(3309))},'quantum half missing or invalid');
await attempt('missing quantum half',{...await sign(),pq_sig:''},'quantum half missing');
let signed=await sign();signed.intent=signed.intent.replace(recipient.accountId,root.accountId);await attempt('wrong message',signed,'classical half invalid');
await attempt('wrong wallet',signIntent(makeIntent(root.accountId,'0',send),k),'wrong wallet');
await attempt('expired intent',signIntent(makeIntent(wallet.accountId,'0',send,1),k),'expired');
await attempt('migration by non-owner',{...await sign({kind:'migrate'}),ed_sig:base64.encode(new Uint8Array(64))},'classical half invalid');
signed=await sign();await attempt('valid dual transfer',signed);await attempt('nonce replay',signed,'replay');
await attempt('self call blocked',await sign({kind:'call',receiver:wallet.accountId,method:'settle',args:'e30=',deposit:'0'}),'self calls forbidden');
try{await root.call(wallet,'settle',{migration:true,nonce:'1'});throw Error('public callback succeeded');}catch(e){assert(String(e).includes('private'));count++;results.push({name:'private callback',passed:true});}
await attempt('native migration',await sign({kind:'migrate'}));const s=await wallet.view<any>('status',{});assert(s.migrated);results.push({name:'migration status settled',passed:true});count++;
writeFileSync('deployments/sandbox-tests.json',JSON.stringify({count,results},null,2));console.log('SANDBOX_CASES',count);
}finally{await worker.tearDown();}
