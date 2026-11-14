// Quantum-gated Chain Signatures on a public testnet: magen-ana.testnet asks NEAR's testnet MPC signer
// (v1.signer-prod.testnet) for an Ethereum signature through its Magen wallet contract, which verifies ed25519 and
// ML-DSA-65 first. The ECDSA answer is assembled into an EIP-1559 tx and broadcast on Sepolia.
// `tsx scripts/live-sepolia-mpc.ts addresses` only prints the derived Ethereum addresses. Secrets stay in .demo/.
import { readFileSync, writeFileSync } from 'node:fs';
import { gatedSign, ethSigningHash, ethAssemble, evm, toHex, derivedKey, addressFor, type EthTx } from '../sdk/chains.ts';

const RPC = process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com';
const TO = '0x4B2ACf80Bc6E07bbF5690f0710e25C528cb63F80'; // Nick's Noren operator wallet, which funded the derived addresses
const ethOf = async (w: string) => addressFor('ethereum', await derivedKey(w, 'magen/eth', 0));

if (process.argv[2] === 'addresses') {
  for (const w of ['magen-ana.testnet', 'dana-magen.testnet']) console.log(w, await ethOf(w));
  process.exit(0);
}

const st = JSON.parse(readFileSync('.demo/guardians-live.json', 'utf8'));
const wallet = st.account, keys = st.newKeys, fee = { account: wallet, seed: keys.ed };
const eth = await ethOf(wallet);
const [nonce, gp, bal] = await Promise.all([evm(RPC, 'eth_getTransactionCount', [eth, 'latest']), evm(RPC, 'eth_gasPrice', []), evm(RPC, 'eth_getBalance', [eth, 'latest'])]);
const tx: EthTx = { chainId: 11155111n, nonce: BigInt(nonce), maxPriorityFeePerGas: 1_000_000_000n, maxFeePerGas: BigInt(gp) * 2n + 1_000_000_000n, gas: 21000n, to: TO, value: 1_000_000_000_000_000n };
if (BigInt(bal) < tx.gas * tx.maxFeePerGas + tx.value) throw Error(`${eth} holds ${BigInt(bal)} wei on Sepolia: not enough for 0.001 ETH plus gas`);
const payload = { Ecdsa: toHex(ethSigningHash(tx)) };
const out: any = { network: 'NEAR testnet + Ethereum Sepolia (chain 11155111)', wallet, mpc: 'v1.signer-prod.testnet', at: new Date().toISOString(), from: eth, to: TO, value_eth: '0.001' };

const attack = await gatedSign(fee, wallet, keys, payload, 'magen/eth', 0, { dropPq: true });
out.refused_without_ml_dsa = { near_tx: attack.hash, success: attack.success, error: attack.error?.match(/quantum half[^"\\]*/)?.[0] ?? String(attack.error).slice(0, 120) };
console.log('refused without ML-DSA:', attack.hash, attack.success);

const ok = await gatedSign(fee, wallet, keys, payload, 'magen/eth', 0);
if (!ok.signature) throw Error('no MPC signature: ' + ok.error);
out.gated_sign = { near_tx: ok.hash, success: ok.success, scheme: ok.signature.scheme, explorer: `https://testnet.nearblocks.io/txns/${ok.hash}` };
const raw = ethAssemble(tx, ok.signature, eth);
const hash = await evm(RPC, 'eth_sendRawTransaction', [raw]);
let receipt: any = null;
for (let i = 0; i < 60 && !receipt; i++) { receipt = await evm(RPC, 'eth_getTransactionReceipt', [hash]); if (!receipt) await new Promise(r => setTimeout(r, 2000)); }
if (!receipt) throw Error(`Sepolia tx ${hash} not mined after 120 s`);
out.sepolia = { tx: hash, status: receipt.status, block: parseInt(receipt.blockNumber, 16), from: receipt.from, explorer: `https://sepolia.etherscan.io/tx/${hash}` };
console.log('sepolia', hash, receipt.status);
writeFileSync('deployments/sepolia-mpc-live.json', JSON.stringify(out, null, 2) + '\n');
