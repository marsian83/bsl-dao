# ZK DAO - Anonymous Voting with Zero-Knowledge Proofs

A decentralized autonomous organization (DAO) that enables anonymous voting using zero-knowledge proofs and Merkle tree membership verification.

## 🌟 Overview

This project implements a privacy-preserving voting system where:

- Members can vote anonymously without revealing their identity
- Double voting is cryptographically prevented through nullifiers
- Membership is tracked in a Merkle tree for efficient proof verification
- Proposals are locked to membership snapshots for fair governance

## 🏗️ Architecture

### Core Components

1. **MerkleTree.sol** - Manages membership registry using Merkle tree structure
2. **ZOrchestrator.sol** - Main governance contract handling proposals and voting
3. **ZkVerifier.sol** - Zero-knowledge proof verification (production implementation)
4. **MockVerifier.sol** - Simplified verifier for hackathon demo

### Key Features

- **Anonymous Membership**: Members insert Semaphore identity commitments into the Merkle tree
- **Snapshot Governance**: Proposals lock to specific membership roots at creation time
- **Nullifier Protection**: Prevents double voting while maintaining anonymity
- **ZK Proof Verification**: Validates voting eligibility without revealing voter identity

## 🔧 Technical Implementation

### Membership System

Members insert their **Semaphore identity commitments** (derived from secret trapdoors) into the Merkle tree:

```solidity
function insertMember(uint256 commitment) external onlyOwner {
    merkleTree.insert(commitment);
}
```

The commitment is computed as `poseidon(nullifier, trapdoor)` where:

- `trapdoor`: Secret random value known only to the user
- `nullifier`: Derived secret used to prevent double voting
- `commitment`: Public value inserted into the tree

### Voting Process

1. **Proposal Creation**: Admin creates proposal, locking it to current membership root
2. **Proof Generation**: Voter generates ZK proof showing they know a trapdoor for some commitment in the tree
3. **Vote Submission**: Proof verified, vote counted, nullifier recorded
4. **Double Vote Prevention**: Same nullifier cannot be used again

### Zero-Knowledge Proofs

**🚨 Hackathon Note**: Due to time constraints, we use `MockVerifier.sol` which accepts any proof. In production, this would be replaced with a proper ZK-SNARK verifier implementing circuits for:

- **Membership Proof**: Proves knowledge of trapdoor corresponding to a commitment in the Merkle tree
- **Nullifier Derivation**: Proves nullifier is correctly derived from the secret without revealing it
- **Vote Validity**: Ensures vote is within valid options and proposal constraints

**Production Implementation** would use:

- Circom circuits for ZK proof generation
- Groth16 or PLONK verifiers on-chain
- Poseidon hash functions for efficiency in ZK circuits
- Proper Semaphore protocol integration

## 🧪 Testing

We've implemented comprehensive tests in two styles:

### Universal Tests (`test/Universal.ts`)

Traditional unit tests covering all functionality:

- Contract deployment and initialization
- Member insertion and Merkle tree updates
- Proposal creation and validation
- Voting mechanics and security checks
- Double voting prevention
- Edge cases and error conditions

### Story Tests (`test/Story.ts`)

Narrative-style tests that tell the story of DAO usage:

- Alice, Bob, and Charlie join the DAO
- Admin creates a community garden proposal
- Members vote anonymously
- Security features prevent double voting
- New members join but can't vote on old proposals

Run tests with:

```bash
npx hardhat test
npx hardhat test test/Story.ts  # Just the story tests
```

## 🚀 What's Working

✅ **Merkle Tree Membership**: Efficient insertion and root calculation  
✅ **Proposal Management**: Creation, validation, and snapshot locking  
✅ **Vote Counting**: Separate tallies for different options  
✅ **Nullifier System**: Double vote prevention  
✅ **Access Control**: Admin-only proposal creation  
✅ **Time Windows**: Voting period enforcement  
✅ **Gas Optimization**: Efficient storage patterns

## 🔮 Production Roadmap

To deploy this in production, the following would be implemented:

### ZK Circuit Development

```
membership.circom:
- Verify Merkle path from commitment to root
- Derive nullifier from secret trapdoor
- Validate vote parameters

nullifier_check.circom:
- Ensure nullifier uniqueness
- Prevent double voting across proposals
```

### Semaphore Integration

- Replace manual commitment insertion with Semaphore group management
- Implement proper identity commitment generation
- Add signal verification for vote integrity

### Frontend Development

- Web interface for DAO interaction
- ZK proof generation in browser
- MetaMask integration for transactions
- Real-time voting results display

### Security Enhancements

- Multi-signature admin controls
- Proposal execution mechanisms
- Treasury management
- Upgrade patterns

## 📊 Gas Usage

Current deployment costs (Hardhat local network):

| Contract      | Deployment Gas | Key Operations   |
| ------------- | -------------- | ---------------- |
| MerkleTree    | 672,253        | insert: ~98k gas |
| ZOrchestrator | 1,597,477      | vote: ~78k gas   |
| MockVerifier  | 152,453        | verify: minimal  |

## 🛠️ Setup & Development

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy locally
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

## 🎯 Hackathon Achievements

In this half-day hackathon, we successfully implemented:

1. **Complete DAO Infrastructure** - All core contracts working
2. **Anonymous Voting System** - Privacy-preserving vote mechanics
3. **Comprehensive Testing** - Both technical and narrative test suites
4. **Gas Optimization** - Efficient Merkle tree operations
5. **Security Features** - Double voting prevention and access controls

## 📝 License

MIT License - See LICENSE file for details

---

_This project demonstrates the potential of zero-knowledge proofs in governance systems, providing a foundation for truly private and fair democratic processes on-chain._
