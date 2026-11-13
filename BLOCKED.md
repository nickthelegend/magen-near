# BLOCKED (exact needs)

| Item | Status | What unblocks it |
|---|---|---|
| Global contract for the wallet (NEP-591): publish magen-2 once, upgrades `UseGlobalContract(hash)` so each account stakes ~1 kB instead of ~1.7 NEAR | Not built | About 17–19 testnet NEAR to burn for the publish (189 kB × 10× storage price). Our testnet accounts hold < 1 NEAR spare and `helper.nearprotocol.com` answers HTTP 429. |
| `0u` universal accounts "born quantum-safe" (NEP-655) | Not built | Depends on the global contract above (StateInit references code by global hash). |
| Broadcasting quantum-gated MPC transactions on public testnets (Sepolia, Solana devnet, Bitcoin testnet4, Cosmos theta) | Signed on NEAR testnet; broadcast proven on local Anvil only | Testnet gas at the derived addresses shown on the Chains screen. Solana's RPC faucets are closed (HTTP 410, "faucet.solana.com" needs a login); Sepolia faucets need a login or CAPTCHA, which this build does not solve. |
| Swaps and bridges (NEAR Intents / 1Click) | Live dry quotes only ("Quote only — mainnet funding required") | A funded NEAR mainnet account; 1Click has no testnet. Cosmos (ATOM) is not in 1Click's token list. |
| Hosted demo (magen-near.vercel.app) | Still serves the Nov 13 build | Nick runs `vercel --prod` from projects/magen. |
