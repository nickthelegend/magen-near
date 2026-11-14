/** Public transaction preview. No signing keys or raw signature bytes enter this object. */
export type Approval = { network:'NEAR testnet'; signer:string; receiver:string; method:string; title:string; amount:string; gas:string; details:string[]; dual:boolean };
export type Approver=(request:Approval)=>Promise<boolean>;
let approver:Approver|undefined;
export function setApprover(fn?:Approver){approver=fn;}
export async function approveTransaction(request:Approval){if(approver&&!await approver(request))throw Error('Transaction rejected. Nothing was broadcast.');}
const near=(n:bigint)=>{const a=n/10n**24n,b=(n%10n**24n).toString().padStart(24,'0').replace(/0+$/,'');return a.toString()+(b?'.'+b:'')+' NEAR';};
export function previewTransaction(signer:string,receiver:string,ops:Uint8Array[]):Approval{
 const r:Approval={network:'NEAR testnet',signer,receiver,method:'',title:'Approve transaction',amount:'0 NEAR',gas:'0 Tgas',details:[],dual:false};let gas=0n,deposit=0n;const methods:string[]=[];
 for(const op of ops){let p=1;const num=(n:number)=>{let v=0n;for(let i=0;i<n;i++)v|=BigInt(op[p++])<<BigInt(i*8);return v;};const bytes=()=>{const n=Number(num(4)),b=op.slice(p,p+n);p+=n;return b;};const text=()=>new TextDecoder().decode(bytes());
 switch(op[0]){
 case 0:methods.push('CreateAccount');break;
 case 1:methods.push('DeployContract');r.title='Upgrade account in place';r.details.push('Deploy the wallet contract; preserve the account name and balance.');break;
 case 2:{const method=text(),raw=new TextDecoder().decode(bytes());gas+=num(8);deposit+=num(16);methods.push(method);let a:any={};try{a=JSON.parse(raw);}catch{}
 if(method==='execute'&&typeof a.intent==='string'){const i=JSON.parse(a.intent),act=i.action;r.dual=true;r.details.push('Wallet: '+i.wallet,'Nonce: '+i.nonce,'Expires: '+new Date(Number(i.expires)).toISOString());
 if(act.kind==='send'){r.title='Send '+near(BigInt(act.amount));r.amount=near(BigInt(act.amount));r.details.unshift('Destination: '+act.receiver);}
 if(act.kind==='migrate'){r.title='Q-Day switch';r.details.unshift('Add your native ML-DSA-65 full-access key. It can control this account alone.');}
 if(act.kind==='guardians'){r.title='Set up guardians';r.details.unshift(`${act.threshold} of ${act.keys.length} ML-DSA-65 guardians can rotate both locks.`);}
 if(act.kind==='call'){r.title=act.method==='sign'?'Cross-chain signature request':'Contract call';r.details.unshift('Call: '+act.receiver+' → '+act.method,'Forwarded deposit: '+near(BigInt(act.deposit)));}
 if(!a.pq_sig)r.details.unshift('Deliberate rejection test: quantum half is missing.');
 }else if(method==='recover'){const i=JSON.parse(a.request);r.title='Guardian recovery';r.details.push('Rotate both locks on '+i.wallet,`${a.signatures?.length??0} guardian signatures; funds stay in the account.`);}
 else if(method==='create_account'){r.title='Create testnet account';r.details.push('New account: '+a.new_account_id);}
 break;}
 case 3:deposit+=num(16);methods.push('Transfer');r.title='Transfer NEAR';break;
 case 5:methods.push('AddKey');r.details.push('Add a protocol access key.');break;
 case 6:methods.push('DeleteKey');r.details.push('Remove an existing access key.');break;
 case 7:methods.push('DeleteAccount');r.details.push('Close the one-time account; send its balance to '+text());break;
 default:throw Error('Cannot preview this transaction action.');
 }}
 r.method=methods.join(' + ');r.gas=(Number(gas)/1e12).toFixed(0)+' Tgas attached + protocol fees';if(!r.dual)r.amount=near(deposit);return r;
}
