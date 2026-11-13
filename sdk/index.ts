import { ed25519 } from '@noble/curves/ed25519.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { sha3_256 } from '@noble/hashes/sha3.js';
import { base58, base64 } from '@scure/base';
export { base64, base58, ed25519, ml_dsa65, sha256 };
export let RPC='https://test.rpc.fastnear.com';
/** Point every helper at another RPC (the local sandbox in tests). */
export function useRpc(url:string){RPC=url;}
export const utf8=(s:string)=>new TextEncoder().encode(s);
export const decode=(b:Uint8Array)=>new TextDecoder().decode(b);
export const concat=(...v:Uint8Array[])=>{const out=new Uint8Array(v.reduce((n,x)=>n+x.length,0));let p=0; for(const x of v){out.set(x,p);p+=x.length;}return out;};
export const random=()=>crypto.getRandomValues(new Uint8Array(32));
export type Keys={ed:string;pq:string};
export const generateKeys=():Keys=>({ed:base64.encode(random()),pq:base64.encode(random())});
export function publicKeys(k:Keys){return {ed:ed25519.getPublicKey(base64.decode(k.ed)),pq:ml_dsa65.keygen(base64.decode(k.pq)).publicKey};}
export const pqHandle=(pk:Uint8Array)=>'ml-dsa-65-hash:'+base58.encode(sha3_256(concat(utf8('near:ml-dsa-65-pubkey-hash:v1'),pk)));
export type Action={kind:'send';receiver:string;amount:string}|{kind:'call';receiver:string;method:string;args:string;deposit:string}|{kind:'migrate'};
export function makeIntent(wallet:string,nonce:string,action:Action,expires=Date.now()+300000){return JSON.stringify({network:'testnet',wallet,nonce,expires:String(expires),action});}
export const digest=(intent:string)=>sha256(utf8('magen:v1:'+intent));
export function signIntent(intent:string,k:Keys){const m=digest(intent);return {intent,ed_sig:base64.encode(ed25519.sign(m,base64.decode(k.ed))),pq_sig:base64.encode(ml_dsa65.sign(m,ml_dsa65.keygen(base64.decode(k.pq)).secretKey))};}
export function verifyIntent(s:ReturnType<typeof signIntent>,pk:ReturnType<typeof publicKeys>){try{return ed25519.verify(base64.decode(s.ed_sig),digest(s.intent),pk.ed)&&ml_dsa65.verify(base64.decode(s.pq_sig),digest(s.intent),pk.pq);}catch{return false;}}
export async function rpc(method:string,params:any,endpoint=RPC):Promise<any>{const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'magen',method,params}),signal:AbortSignal.timeout(30000)});const j=await res.json();if(!res.ok||j.error||j.result?.error)throw new Error(JSON.stringify(j.error||j.result?.error||{http:res.status}));return j.result;}
export const query=(request_type:string,account_id:string,rest={})=>rpc('query',{request_type,account_id,finality:'optimistic',...rest});
export async function view(account:string,method='status',args={}){const r=await query('call_function',account,{method_name:method,args_base64:base64.encode(utf8(JSON.stringify(args)))});return JSON.parse(decode(new Uint8Array(r.result)));}
export const accessKeys=(account:string)=>query('view_access_key_list',account);
export function nearAmount(s:string){if(!/^(0|[1-9]\d*)(\.\d{1,24})?$/.test(s))throw Error('Enter a positive NEAR amount, up to 24 decimal places.');const [a,b='']=s.split('.');return (BigInt(a)*10n**24n+BigInt(b.padEnd(24,'0'))).toString();}
export const formatNear=(s:string,places=4)=>{const n=BigInt(s);const a=n/10n**24n;return a.toLocaleString('en-US')+'.'+(n%10n**24n).toString().padStart(24,'0').slice(0,places);};
const le=(n:bigint|number,size:number)=>{let v=BigInt(n);const a=new Uint8Array(size);for(let i=0;i<size;i++){a[i]=Number(v&255n);v>>=8n;}if(v)throw Error('integer overflow');return a;};
const vec=(b:Uint8Array)=>concat(le(b.length,4),b);
const str=(s:string)=>vec(utf8(s));
export const actions={create:()=>new Uint8Array([0]),deploy:(wasm:Uint8Array)=>concat(new Uint8Array([1]),vec(wasm)),call:(method:string,args:any,gas=100_000_000_000_000n,deposit=0n)=>concat(new Uint8Array([2]),str(method),vec(utf8(JSON.stringify(args))),le(gas,8),le(deposit,16)),transfer:(amount:bigint)=>concat(new Uint8Array([3]),le(amount,16)),addKey:(pk:Uint8Array,tag=0)=>concat(new Uint8Array([5,tag]),pk,le(0,8),new Uint8Array([1])),deleteKey:(pk:Uint8Array)=>concat(new Uint8Array([6,0]),pk),
 /** AddKey with a FunctionCall permission: the key may only call `methods` on `receiver`, spending at most `allowance` yocto on fees. */
 addFnKey:(pk:Uint8Array,receiver:string,methods:string[],allowance:bigint)=>concat(new Uint8Array([5,0]),pk,le(0,8),new Uint8Array([0,1]),le(allowance,16),str(receiver),le(methods.length,4),...methods.map(str)),
 deleteAccount:(beneficiary:string)=>concat(new Uint8Array([7]),str(beneficiary))};
export type Signer={account:string;seed:string;pq?:boolean};
export function signerPublic(s:Signer){return s.pq?ml_dsa65.keygen(base64.decode(s.seed)).publicKey:ed25519.getPublicKey(base64.decode(s.seed));}
export const keyString=(s:Signer)=>(s.pq?'ml-dsa-65:':'ed25519:')+base58.encode(signerPublic(s));
export function encodeTransaction(s:Signer,receiver:string,nonce:bigint,blockHash:string,ops:Uint8Array[]){const tag=s.pq?2:0;const tx=concat(str(s.account),new Uint8Array([tag]),signerPublic(s),le(nonce,8),str(receiver),base58.decode(blockHash),le(ops.length,4),...ops);const h=sha256(tx);const sig=s.pq?ml_dsa65.sign(h,ml_dsa65.keygen(base64.decode(s.seed)).secretKey):ed25519.sign(h,base64.decode(s.seed));return {hash:base58.encode(h),bytes:concat(tx,new Uint8Array([tag]),sig)};}
export async function submit(s:Signer,receiver:string,ops:Uint8Array[],onSigned?:(hash:string)=>void){const ak=await query('view_access_key',s.account,{public_key:keyString(s),finality:'optimistic'});const tx=encodeTransaction(s,receiver,BigInt(ak.nonce)+1n,ak.block_hash,ops);onSigned?.(tx.hash);return rpc('broadcast_tx_commit',[base64.encode(tx.bytes)]);}
export function outcome(r:any){const failures=[r.transaction_outcome,...(r.receipts_outcome||[])].filter(Boolean).filter(o=>o.outcome?.status?.Failure).map(o=>JSON.stringify(o.outcome.status.Failure));const value=r.status?.SuccessValue;const settled=value!==undefined?decode(base64.decode(value)):'';return {hash:r.transaction.hash,success:!failures.length&&settled!=='false',error:failures.join('; ')||(settled==='false'?'Action failed on the receiving account.':''),logs:(r.receipts_outcome||[]).flatMap(o=>o.outcome.logs||[])};}
export async function execute(s:Signer,wallet:string,signed:ReturnType<typeof signIntent>,onSigned?:(h:string)=>void){return outcome(await submit(s,wallet,[actions.call('execute',signed)],onSigned));}
export type Vault={wallet:string;keys:Keys;relay:Signer};
async function vaultKey(password:string,salt:Uint8Array){const material=await crypto.subtle.importKey('raw',utf8(password) as BufferSource,'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt as BufferSource,iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function sealVault(v:Vault,password:string){if(password.length<10)throw Error('Use at least 10 characters.');const salt=random(),iv=crypto.getRandomValues(new Uint8Array(12));const key=await vaultKey(password,salt);const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,utf8(JSON.stringify(v)) as BufferSource);return {version:1,salt:base64.encode(salt),iv:base64.encode(iv),data:base64.encode(new Uint8Array(data))};}
export async function openVault(v:any,password:string):Promise<Vault>{if(v.version!==1)throw Error('Unsupported backup version');try{const key=await vaultKey(password,base64.decode(v.salt));const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:base64.decode(v.iv) as BufferSource},key,base64.decode(v.data) as BufferSource);return JSON.parse(decode(new Uint8Array(data)));}catch{throw Error('Could not unlock. Check your password and backup file.');}}
