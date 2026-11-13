// Quantum-gated Chain Signatures, live: magen-ana.testnet (wallet contract magen-2) asks NEAR's testnet MPC
// signer (v1.signer-prod.testnet) for an Ethereum signature. The attempt without the ML-DSA-65 half is refused
// on NEAR; the dual-signed one returns an ECDSA signature that we broadcast on a local Anvil chain (public
// testnets need faucet gas that requires a login or CAPTCHA). Secrets stay in .demo/.
import { readFileSync, writeFileSync } from 'node:fs';
import { allAddresses, gatedSign, ethSigningHash, ethAssemble, evm, toHex, derivedKey, addressFor, type EthTx } from '../sdk/chains.ts';

const ANVIL = process.env.ANVIL || 'http://127.0.0.1:5349';
const st = JSON.parse(readFileSync('.demo/guardians-live.json', 'utf8'));
const wallet = st.account, keys = st.newKeys, fee = { account: wallet, seed: keys.ed };
const out: any = { network: 'NEAR testnet + local Anvil (chain 31337)', wallet, mpc: 'v1.signer-prod.testnet', at: new Date().toISOString() };
out.addresses = (await allAddresses(wallet)).map(a => ({ chain: a.name, network: a.network, path: a.path, domain: a.domain, address: a.address }));
console.log(out.addresses);
const eth = out.addresses.find((a: any) => a.chain === 'Ethereum').address;
const to = addressFor('ethereum', await derivedKey(wallet, 'magen/eth-savings', 0));
await evm(ANVIL, 'anvil_setBalance', [eth, '0xDE0B6B3A7640000']); // 1 ETH on the local chain only
const tx: EthTx = { chainId: 31337n, nonce: BigInt(await evm(ANVIL, 'eth_getTransactionCount', [eth, 'latest'])), maxPriorityFeePerGas: 1_000_000_000n, maxFeePerGas: 3_000_000_000n, gas: 21000n, to, value: 50_000_000_000_000_000n };
const payload = { Ecdsa: toHex(ethSigningHash(tx)) };
const attack = await gatedSign(fee, wallet, keys, payload, 'magen/eth', 0, { dropPq: true });
out.refused_without_ml_dsa = { hash: attack.hash, success: attack.success, error: attack.error.match(/quantum half[^"\\]*/)?.[0] ?? attack.error.slice(0, 120) };
console.log('attack', attack.hash, attack.success, out.refused_without_ml_dsa.error);
const ok = await gatedSign(fee, wallet, keys, payload, 'magen/eth', 0);
if (!ok.signature) throw Error('no MPC signature: ' + ok.error);
out.gated_sign = { hash: ok.hash, success: ok.success, scheme: ok.signature.scheme };
const raw = ethAssemble(tx, ok.signature, eth);
const ethHash = await evm(ANVIL, 'eth_sendRawTransaction', [raw]);
let receipt: any = null;
for (let i = 0; i < 20 && !receipt; i++) { receipt = await evm(ANVIL, 'eth_getTransactionReceipt', [ethHash]); if (!receipt) await new Promise(r => setTimeout(r, 500)); }
out.ethereum_local = { from: eth, to, value_eth: '0.05', tx: ethHash, status: receipt?.status, block: receipt?.blockNumber };
out.sepolia = { address: eth, note: 'The same MPC flow works on Sepolia once this address holds Sepolia ETH for gas; public faucets need a login or CAPTCHA, so this build broadcasts on local Anvil.' };
console.log('eth', ethHash, receipt?.status);
writeFileSync('deployments/chains-live.json', JSON.stringify(out, null, 2));
