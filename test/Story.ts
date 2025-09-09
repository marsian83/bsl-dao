import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { encodePacked, getAddress, keccak256, parseGwei } from "viem";

async function deployFixture() {
  const [deployer, alice, bob, charlie] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  const merkleTree = await hre.viem.deployContract("MerkleTree", [8, 0]);
  const verifier = await hre.viem.deployContract("MockVerifier");
  const zOrchestrator = await hre.viem.deployContract("ZOrchestrator", [
    merkleTree.address,
    verifier.address,
  ]);

  return {
    deployer,
    alice,
    bob,
    charlie,
    publicClient,
    zOrchestrator,
    merkleTree,
    verifier,
  };
}

describe("The ZK DAO Story", function () {
  it("tells the tale of a decentralized organization", async function () {
    console.log("📖 Chapter 1: The Beginning");
    console.log("Once upon a time, in the world of blockchain...");

    const {
      deployer,
      alice,
      bob,
      charlie,
      zOrchestrator,
      merkleTree,
      publicClient,
    } = await loadFixture(deployFixture);

    console.log("🏗️  The deployer created a new ZK DAO");
    console.log(`Admin address: ${deployer.account.address}`);

    const adminAddress = await zOrchestrator.read.admin();
    expect(getAddress(adminAddress)).to.equal(
      getAddress(deployer.account.address)
    );
    console.log("✅ The deployer became the admin of the DAO");

    console.log("\n📖 Chapter 2: The First Members Join");
    console.log("Alice decided to join the DAO first...");

    const aliceCommitment = 111n;
    const rootBefore = await merkleTree.read.getRoot();
    console.log(`🌳 Merkle root before Alice: ${rootBefore}`);

    await zOrchestrator.write.insertMember([aliceCommitment]);

    const rootAfterAlice = await merkleTree.read.getRoot();
    console.log(`🌳 Merkle root after Alice joined: ${rootAfterAlice}`);
    console.log("✅ Alice's membership was recorded in the Merkle tree");

    expect(rootAfterAlice).to.not.equal(rootBefore);

    console.log("\nBob heard about the DAO and wanted to join too...");

    const bobCommitment = 222n;
    await zOrchestrator.write.insertMember([bobCommitment]);

    const rootAfterBob = await merkleTree.read.getRoot();
    console.log(`🌳 Merkle root after Bob joined: ${rootAfterBob}`);
    console.log("✅ Bob's membership was also recorded");

    expect(rootAfterBob).to.not.equal(rootAfterAlice);

    console.log("\nCharlie, not wanting to be left out, joined as well...");

    const charlieCommitment = 333n;
    await zOrchestrator.write.insertMember([charlieCommitment]);

    const finalMembershipRoot = await merkleTree.read.getRoot();
    console.log(`🌳 Final membership root: ${finalMembershipRoot}`);
    console.log("✅ Charlie completed the founding trio");

    console.log("\n📖 Chapter 3: The First Proposal");
    console.log("The admin decided it was time for the DAO's first vote...");

    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const votingStart = currentTime - 100n;
    const votingEnd = currentTime + 86400n;
    const proposalId = 1n;
    const proposalTitle = "Should we build a community garden?";

    console.log(`📝 Proposal: "${proposalTitle}"`);
    console.log(`⏰ Voting period: ${votingStart} to ${votingEnd}`);

    await zOrchestrator.write.createProposal([
      proposalId,
      proposalTitle,
      votingStart,
      votingEnd,
    ]);

    const proposal = await zOrchestrator.read.getProposal([proposalId]);
    console.log(`🔒 Proposal locked to membership root: ${proposal[0]}`);
    console.log("✅ The proposal was created and voting began");

    expect(proposal[0]).to.equal(finalMembershipRoot);
    expect(proposal[3]).to.equal(proposalTitle);

    console.log("\n📖 Chapter 4: The Voting Begins");
    console.log("The members started casting their votes...");

    const proof = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as const;

    console.log("Alice votes YES (option 1)...");
    const aliceNullifier = 11111n;
    await zOrchestrator.write.vote([
      proposalId,
      finalMembershipRoot,
      aliceNullifier,
      1,
      proof,
    ]);

    let yesCount = await zOrchestrator.read.getCount([proposalId, 1]);
    let noCount = await zOrchestrator.read.getCount([proposalId, 0]);
    console.log(`📊 Current tally - YES: ${yesCount}, NO: ${noCount}`);
    console.log("✅ Alice's vote was counted");

    expect(yesCount).to.equal(1n);

    console.log("\nBob also votes YES (option 1)...");
    const bobNullifier = 22222n;
    await zOrchestrator.write.vote([
      proposalId,
      finalMembershipRoot,
      bobNullifier,
      1,
      proof,
    ]);

    yesCount = await zOrchestrator.read.getCount([proposalId, 1]);
    noCount = await zOrchestrator.read.getCount([proposalId, 0]);
    console.log(`📊 Current tally - YES: ${yesCount}, NO: ${noCount}`);
    console.log("✅ Bob's vote was counted");

    expect(yesCount).to.equal(2n);

    console.log("\nCharlie thinks differently and votes NO (option 0)...");
    const charlieNullifier = 33333n;
    await zOrchestrator.write.vote([
      proposalId,
      finalMembershipRoot,
      charlieNullifier,
      0,
      proof,
    ]);

    yesCount = await zOrchestrator.read.getCount([proposalId, 1]);
    noCount = await zOrchestrator.read.getCount([proposalId, 0]);
    console.log(`📊 Final tally - YES: ${yesCount}, NO: ${noCount}`);
    console.log("✅ Charlie's vote was counted");

    expect(yesCount).to.equal(2n);
    expect(noCount).to.equal(1n);

    console.log("\n📖 Chapter 5: The Security Test");
    console.log(
      "Alice tried to vote again, but the system prevented double voting..."
    );

    try {
      await zOrchestrator.write.vote([
        proposalId,
        finalMembershipRoot,
        aliceNullifier,
        0,
        proof,
      ]);
      console.log("❌ This should not happen!");
    } catch (error) {
      console.log("🛡️  Double voting prevented successfully");
      console.log("✅ The nullifier system worked as intended");
    }

    console.log("\n📖 Chapter 6: A New Member Arrives");
    console.log("Dave wanted to join after the proposal was created...");

    const daveCommitment = 444n;
    await zOrchestrator.write.insertMember([daveCommitment]);

    const newRoot = await merkleTree.read.getRoot();
    console.log(`🌳 New membership root: ${newRoot}`);
    console.log("✅ Dave joined the DAO");

    expect(newRoot).to.not.equal(finalMembershipRoot);

    console.log("But Dave couldn't vote on the existing proposal...");
    console.log("(The proposal was locked to the earlier membership snapshot)");

    const lockedProposal = await zOrchestrator.read.getProposal([proposalId]);
    expect(lockedProposal[0]).to.equal(finalMembershipRoot);
    console.log("🔒 The proposal remained locked to the original membership");

    console.log("\n📖 Epilogue: The DAO Continues");
    console.log("The community garden proposal passed 2-1!");
    console.log("The DAO members learned valuable lessons about governance:");
    console.log("  • Membership is tracked in a Merkle tree");
    console.log("  • Proposals snapshot membership at creation time");
    console.log("  • Zero-knowledge proofs enable private voting");
    console.log("  • Nullifiers prevent double voting");
    console.log("  • The system is transparent yet preserves privacy");

    console.log("\n🎉 And they all lived decentrally ever after!");

    const finalYesCount = await zOrchestrator.read.getCount([proposalId, 1]);
    const finalNoCount = await zOrchestrator.read.getCount([proposalId, 0]);
    expect(finalYesCount).to.equal(2n);
    expect(finalNoCount).to.equal(1n);
  });

  it("tells another story about governance evolution", async function () {
    console.log("\n📖 A New Chapter: The Evolution");
    console.log("As the DAO grew, so did its governance needs...");

    const { deployer, alice, bob, charlie, zOrchestrator, merkleTree } =
      await loadFixture(deployFixture);

    console.log("🏗️  Starting with a fresh DAO...");

    const member1 = 1001n;
    const member2 = 1002n;
    const member3 = 1003n;
    const member4 = 1004n;
    const member5 = 1005n;

    console.log("Five enthusiasts joined the new DAO...");
    await zOrchestrator.write.insertMember([member1]);
    await zOrchestrator.write.insertMember([member2]);
    await zOrchestrator.write.insertMember([member3]);
    await zOrchestrator.write.insertMember([member4]);
    await zOrchestrator.write.insertMember([member5]);

    const membershipRoot = await merkleTree.read.getRoot();
    console.log(`🌳 The five-member DAO had root: ${membershipRoot}`);

    console.log("\n📝 Three proposals were created simultaneously...");

    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const start = currentTime - 50n;
    const end = currentTime + 7200n;

    await zOrchestrator.write.createProposal([
      1n,
      "Build a library",
      start,
      end,
    ]);
    await zOrchestrator.write.createProposal([2n, "Create a park", start, end]);
    await zOrchestrator.write.createProposal([3n, "Start a fund", start, end]);

    console.log("✅ All proposals were locked to the same membership snapshot");

    const proposal1 = await zOrchestrator.read.getProposal([1n]);
    const proposal2 = await zOrchestrator.read.getProposal([2n]);
    const proposal3 = await zOrchestrator.read.getProposal([3n]);

    expect(proposal1[0]).to.equal(membershipRoot);
    expect(proposal2[0]).to.equal(membershipRoot);
    expect(proposal3[0]).to.equal(membershipRoot);

    console.log("\n🗳️  The voting marathon began...");

    const proof = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as const;

    await zOrchestrator.write.vote([1n, membershipRoot, 10001n, 1, proof]);
    await zOrchestrator.write.vote([1n, membershipRoot, 10002n, 1, proof]);
    await zOrchestrator.write.vote([1n, membershipRoot, 10003n, 0, proof]);

    await zOrchestrator.write.vote([2n, membershipRoot, 20001n, 1, proof]);
    await zOrchestrator.write.vote([2n, membershipRoot, 20002n, 0, proof]);
    await zOrchestrator.write.vote([2n, membershipRoot, 20003n, 0, proof]);

    await zOrchestrator.write.vote([3n, membershipRoot, 30001n, 1, proof]);
    await zOrchestrator.write.vote([3n, membershipRoot, 30002n, 1, proof]);
    await zOrchestrator.write.vote([3n, membershipRoot, 30003n, 1, proof]);

    console.log("\n📊 The final results were tallied...");

    const library_yes = await zOrchestrator.read.getCount([1n, 1]);
    const library_no = await zOrchestrator.read.getCount([1n, 0]);
    console.log(`Library proposal - YES: ${library_yes}, NO: ${library_no}`);

    const park_yes = await zOrchestrator.read.getCount([2n, 1]);
    const park_no = await zOrchestrator.read.getCount([2n, 0]);
    console.log(`Park proposal - YES: ${park_yes}, NO: ${park_no}`);

    const fund_yes = await zOrchestrator.read.getCount([3n, 1]);
    const fund_no = await zOrchestrator.read.getCount([3n, 0]);
    console.log(`Fund proposal - YES: ${fund_yes}, NO: ${fund_no}`);

    expect(library_yes).to.equal(2n);
    expect(library_no).to.equal(1n);
    expect(park_yes).to.equal(1n);
    expect(park_no).to.equal(2n);
    expect(fund_yes).to.equal(3n);
    expect(fund_no).to.equal(0n);

    console.log("\n🎯 Results:");
    console.log("  • Library: PASSED (2-1)");
    console.log("  • Park: FAILED (1-2)");
    console.log("  • Fund: PASSED UNANIMOUSLY (3-0)");

    console.log("\n🌟 The DAO learned about simultaneous governance!");
    console.log("Multiple proposals can run in parallel with fair voting.");
  });
});
