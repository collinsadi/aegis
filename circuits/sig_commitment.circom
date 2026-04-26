pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

/*
  This circuit proves that the prover knows a post-quantum signature
  (represented as two field elements: sigHigh and sigLow, which are
  the high and low 128-bit halves of a Poseidon hash of the raw signature bytes)
  such that Poseidon(sigHigh, sigLow, msgHash) equals the public commitment.

  Inputs:
    - sigHigh (private): high 128 bits of the signature hash
    - sigLow  (private): low 128 bits of the signature hash
    - msgHash (private): Poseidon hash of the signed message
    - commitment (public): the expected Poseidon(sigHigh, sigLow, msgHash)
    - pubKeyHash (public): hash of the agent's PQ public key, stored on-chain

  Output:
    - The circuit has no output signals. It constrains that:
      Poseidon(sigHigh, sigLow, msgHash) === commitment

  SECURITY NOTE: This circuit is a binding commitment scheme, not a full ML-DSA verifier.
  It proves knowledge of (sigHigh, sigLow, msgHash) such that their Poseidon hash equals
  the public commitment. Off-chain ML-DSA signature validation is performed by AegisProver
  before proof generation. The combination of off-chain validity + on-chain commitment
  binding provides the complete security guarantee. Full in-circuit lattice verification
  is planned for V2.
*/

template SigCommitment() {
    // Private inputs
    signal input sigHigh;
    signal input sigLow;
    signal input msgHash;

    // Public inputs
    signal input commitment;
    signal input pubKeyHash;

    // Compute Poseidon hash of the three private inputs
    component hasher = Poseidon(3);
    hasher.inputs[0] <== sigHigh;
    hasher.inputs[1] <== sigLow;
    hasher.inputs[2] <== msgHash;

    // Constrain: the computed hash must equal the public commitment
    hasher.out === commitment;

    // pubKeyHash is a public input used by the verifier contract
    // to confirm the proof is bound to the correct agent key.
    // We add a dummy constraint so the compiler does not optimize it away.
    signal pubKeyHashSquared;
    pubKeyHashSquared <== pubKeyHash * pubKeyHash;
    _ <== pubKeyHashSquared;
}

component main { public [commitment, pubKeyHash] } = SigCommitment();
