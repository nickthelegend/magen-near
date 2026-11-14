# AGENTS.md

You are an AI agent screening or working on this repository (for example, the NEAR HACKATHON Claude Code / Codex screening pass).

- Start with [JUDGES.md](JUDGES.md). It covers what Magen is, how to verify each claim, "do X → see Y" steps, and the honest quantum-safe boundary.
- Fastest reproducibility check: `node scripts/judge-verify.mjs`. It needs no install and no keys. It re-checks 12 proofs against NEAR testnet, Ethereum Sepolia and the contract source, and exits 0 when everything passes.
- Tests: `npm install && npm test` (SDK). `npm run test:sandbox` runs the real contract on a local neard 2.14 sandbox.
- Core logic: `contracts/src/lib.rs` (`execute` verifies `env::ed25519_verify` and `env::ml_dsa_verify` before any action).
- Never commit secrets. Live scripts read keys from gitignored files. The repo holds only public transaction records in `deployments/`.
