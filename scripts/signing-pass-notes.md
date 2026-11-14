# Signing pass

Read orchestration/signing-pass.md twice. Studied current Kotoba, Seter, Otzar, Xorv and Noren frames at960px sheets. Approval pattern: explicit wallet summary, Reject/Approve, then immediate matching explorer result3–6s. Existing v12 remains preserved. New pass uses separate persisted records; confirmed old transactions are never replayed. New small testnet transactions are explicitly authorized by signing-pass step3.

SDK submission gate previews public fields only and awaits approval before nonce lookup, signing and broadcast. Reject test proves no RPC or signing occurs. Web uses the extension's two-lock visual pattern. Phone uses a native Modal bottom sheet and a plain Approve; no biometric claim. The actual in-app wallet is a testnet product signer, so the approval is included in that product bundle, not a hidden QA override. The extension's existing approval window is preserved.
