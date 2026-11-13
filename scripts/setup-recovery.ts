// Recover only unfinished local testnet setup using the encrypted browser backup.
// Reads password from a file path, never logs secret material. Does not retry the faucet.
import{readFileSync}from'node:fs';import{openVault,query,view,actions,submit,outcome,publicKeys,base64,signerPublic,accessKeys,type Signer}from'../sdk/index.ts';
const [file,passwordFile]=process.argv.slice(2);if(!file||!passwordFile)throw Error('Usage: tsx scripts/setup-recovery.ts encrypted-backup.json password-file');
const v:any=await openVault(JSON.parse(readFileSync(file,'utf8')),readFileSync(passwordFile,'utf8').trim());
try{const s=await view(v.wallet);console.log('Already initialized; no transaction sent',v.wallet,s.version);process.exit(0);}catch(e){if(!String(e).includes('CONTRACT_CODE_EMPTY')&&!String(e).includes('does not exist')&&!String(e).includes('UNKNOWN_ACCOUNT')&&!String(e).includes('not deployed'))throw e;}
if(!v.deploy)throw Error('BLOCKED: this older backup has no encrypted setup key. Need the original setup device.');
const pk=publicKeys(v.keys);let exists=false;try{await query('view_account',v.wallet);exists=true;}catch(e){if(!String(e).includes('UNKNOWN_ACCOUNT')&&!String(e).includes('does not exist'))throw e;}
if(!exists){await query('view_account',v.relay.account);const r=outcome(await submit(v.relay,v.wallet,[actions.create(),actions.transfer(6n*10n**24n),actions.addKey(signerPublic(v.deploy))]));if(!r.success)throw Error(r.error);console.log('Account created',r.hash);}
const r=outcome(await submit(v.deploy,v.wallet,[actions.deploy(new Uint8Array(readFileSync('web/public/wallet.wasm'))),actions.call('new',{ed:base64.encode(pk.ed),pq:base64.encode(pk.pq)},30_000_000_000_000n),actions.deleteKey(signerPublic(v.deploy))]));if(!r.success)throw Error(r.error);console.log('Deployed and locked',v.wallet,r.hash);if((await accessKeys(v.wallet)).keys.length)throw Error('Inspect keys before declaring locked');
