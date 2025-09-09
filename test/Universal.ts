import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { encodePacked, getAddress, keccak256, parseGwei } from "viem";

async function deployFixture() {
  const [deployer, acc1, acc2] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  const merkleTree = await hre.viem.deployContract("MerkleTree", [8, 0]);
  const verifier = await hre.viem.deployContract("MockVerifier");
  const zOrchestrator = await hre.viem.deployContract("ZOrchestrator", [
    merkleTree.address,
    verifier.address,
  ]);

  return {
    deployer,
    acc1,
    acc2,
    publicClient,
    zOrchestrator,
    merkleTree,
    verifier,
  };
}

describe("ZKDao", function () {
  describe("Constructor", function () {
    it("sets admin, merkleTree, and verifier addresses correctly", async function () {
      const { deployer, zOrchestrator, merkleTree, verifier } =
        await loadFixture(deployFixture);

      expect(getAddress(await zOrchestrator.read.admin())).to.equal(
        getAddress(deployer.account.address)
      );
      expect(getAddress(await zOrchestrator.read.merkleTree())).to.equal(
        getAddress(merkleTree.address)
      );
      expect(getAddress(await zOrchestrator.read.verifier())).to.equal(
        getAddress(verifier.address)
      );
    });
  });

  describe("insertMember", function () {
    it("emits MemberInserted and updates merkle root snapshot", async function () {
      const { zOrchestrator, merkleTree, publicClient } = await loadFixture(
        deployFixture
      );

      const commitment = 12345n;
      const rootBefore = await merkleTree.read.getRoot();

      const hash = await zOrchestrator.write.insertMember([commitment]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      const rootAfter = await merkleTree.read.getRoot();

      expect(rootAfter).to.not.equal(rootBefore);

      const memberInsertedEvent = receipt.logs.find(
        (log) =>
          log.topics[0] ===
          keccak256(
            encodePacked(
              ["string"],
              ["MemberInserted(uint256,uint256,uint256)"]
            )
          )
      );
      expect(memberInsertedEvent).to.not.be.undefined;

      const result = await zOrchestrator.simulate.insertMember([
        commitment + 1n,
      ]);
      expect(result.result).to.be.an("array");
      expect(result.result[0]).to.be.a("bigint");
      expect(result.result[1]).to.be.a("bigint");
    });

    it("returns correct index and newRoot", async function () {
      const { zOrchestrator, merkleTree } = await loadFixture(deployFixture);

      const commitment1 = 111n;
      const commitment2 = 222n;

      const result1 = await zOrchestrator.simulate.insertMember([commitment1]);
      expect(result1.result[0]).to.equal(0n);

      await zOrchestrator.write.insertMember([commitment1]);

      const result2 = await zOrchestrator.simulate.insertMember([commitment2]);
      expect(result2.result[0]).to.equal(1n);

      const currentRoot = await merkleTree.read.getRoot();
      expect(result2.result[1]).to.not.equal(currentRoot);
    });
  });

  describe("createProposal", function () {
    it("snapshots current root and emits event", async function () {
      const { zOrchestrator, merkleTree, publicClient, deployer } =
        await loadFixture(deployFixture);

      await zOrchestrator.write.insertMember([111n]);
      await zOrchestrator.write.insertMember([222n]);

      const currentRoot = await merkleTree.read.getRoot();
      const start = BigInt(Math.floor(Date.now() / 1000)) + 100n;
      const end = start + 86400n;
      const proposalId = 1n;
      const title = "Test Proposal";

      const hash = await zOrchestrator.write.createProposal([
        proposalId,
        title,
        start,
        end,
      ]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      const proposalCreatedEvent = receipt.logs.find(
        (log) =>
          log.topics[0] ===
          keccak256(
            encodePacked(
              ["string"],
              ["ProposalCreated(uint256,string,uint256,uint256,uint256)"]
            )
          )
      );
      expect(proposalCreatedEvent).to.not.be.undefined;

      const proposal = await zOrchestrator.read.getProposal([proposalId]);
      expect(proposal[0]).to.equal(currentRoot);
      expect(proposal[1]).to.equal(start);
      expect(proposal[2]).to.equal(end);
      expect(proposal[3]).to.equal(title);
    });

    it("rejects reuse of id", async function () {
      const { zOrchestrator } = await loadFixture(deployFixture);

      const start = BigInt(Math.floor(Date.now() / 1000)) + 100n;
      const end = start + 86400n;
      const proposalId = 1n;
      const title = "Test Proposal";

      await zOrchestrator.write.createProposal([proposalId, title, start, end]);

      await expect(
        zOrchestrator.write.createProposal([
          proposalId,
          "Another Proposal",
          start + 1000n,
          end + 1000n,
        ])
      ).to.be.rejectedWith("proposal exists");
    });

    it("rejects bad time window", async function () {
      const { zOrchestrator } = await loadFixture(deployFixture);

      const start = BigInt(Math.floor(Date.now() / 1000)) + 100n;
      const end = start - 100n;
      const proposalId = 1n;
      const title = "Test Proposal";

      await expect(
        zOrchestrator.write.createProposal([proposalId, title, start, end])
      ).to.be.rejectedWith("bad times");
    });

    it("rejects equal start and end times", async function () {
      const { zOrchestrator } = await loadFixture(deployFixture);

      const time = BigInt(Math.floor(Date.now() / 1000)) + 100n;
      const proposalId = 1n;
      const title = "Test Proposal";

      await expect(
        zOrchestrator.write.createProposal([proposalId, title, time, time])
      ).to.be.rejectedWith("bad times");
    });

    it("requires admin access", async function () {
      const { zOrchestrator, acc1 } = await loadFixture(deployFixture);

      const start = BigInt(Math.floor(Date.now() / 1000)) + 100n;
      const end = start + 86400n;
      const proposalId = 1n;
      const title = "Test Proposal";

      await expect(
        zOrchestrator.write.createProposal([proposalId, title, start, end], {
          account: acc1.account,
        })
      ).to.be.rejectedWith("only admin");
    });
  });

  describe("getCount", function () {
    it("returns 0 by default", async function () {
      const { zOrchestrator } = await loadFixture(deployFixture);

      const start = BigInt(Math.floor(Date.now() / 1000)) + 100n;
      const end = start + 86400n;
      const proposalId = 1n;
      const title = "Test Proposal";

      await zOrchestrator.write.createProposal([proposalId, title, start, end]);

      const count = await zOrchestrator.read.getCount([proposalId, 0]);
      expect(count).to.equal(0n);

      const count1 = await zOrchestrator.read.getCount([proposalId, 1]);
      expect(count1).to.equal(0n);

      const count2 = await zOrchestrator.read.getCount([proposalId, 255]);
      expect(count2).to.equal(0n);
    });

    it("reverts for non-existent proposal", async function () {
      const { zOrchestrator } = await loadFixture(deployFixture);

      await expect(zOrchestrator.read.getCount([999n, 0])).to.be.rejectedWith(
        "no proposal"
      );
    });
  });

  describe("Voting with MockVerifier", function () {
    async function createActiveProposal() {
      const { zOrchestrator, merkleTree, publicClient } = await loadFixture(
        deployFixture
      );

      await zOrchestrator.write.insertMember([111n]);
      await zOrchestrator.write.insertMember([222n]);

      const currentRoot = await merkleTree.read.getRoot();
      const currentTime = BigInt(Math.floor(Date.now() / 1000));
      const start = currentTime - 100n;
      const end = currentTime + 86400n;
      const proposalId = 1n;
      const title = "Test Proposal";

      await zOrchestrator.write.createProposal([proposalId, title, start, end]);

      return {
        zOrchestrator,
        merkleTree,
        publicClient,
        proposalId,
        currentRoot,
        start,
        end,
      };
    }

    it("vote happy path increments tally & emits Voted", async function () {
      const { zOrchestrator, publicClient, currentRoot, proposalId } =
        await createActiveProposal();

      const nullifierHash = 12345n;
      const option = 1;
      const proof = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as const;

      const countBefore = await zOrchestrator.read.getCount([
        proposalId,
        option,
      ]);
      expect(countBefore).to.equal(0n);

      const hash = await zOrchestrator.write.vote([
        proposalId,
        currentRoot,
        nullifierHash,
        option,
        proof,
      ]);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      const votedEvent = receipt.logs.find(
        (log) =>
          log.topics[0] ===
          keccak256(encodePacked(["string"], ["Voted(uint256,uint8,bytes32)"]))
      );
      expect(votedEvent).to.not.be.undefined;

      const countAfter = await zOrchestrator.read.getCount([
        proposalId,
        option,
      ]);
      expect(countAfter).to.equal(1n);
    });

    it("vote rejects if proposal doesn't exist", async function () {
      const { zOrchestrator } = await loadFixture(deployFixture);

      const nullifierHash = 12345n;
      const option = 1;
      const proof = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as const;
      const fakeRoot = 999n;
      const nonExistentProposal = 999n;

      await expect(
        zOrchestrator.write.vote([
          nonExistentProposal,
          fakeRoot,
          nullifierHash,
          option,
          proof,
        ])
      ).to.be.rejectedWith("no proposal");
    });

    it("vote rejects before start", async function () {
      const { zOrchestrator, merkleTree } = await loadFixture(deployFixture);

      await zOrchestrator.write.insertMember([111n]);
      const currentRoot = await merkleTree.read.getRoot();

      const currentTime = BigInt(Math.floor(Date.now() / 1000));
      const start = currentTime + 3600n;
      const end = start + 86400n;
      const proposalId = 1n;
      const title = "Future Proposal";

      await zOrchestrator.write.createProposal([proposalId, title, start, end]);

      const nullifierHash = 12345n;
      const option = 1;
      const proof = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as const;

      await expect(
        zOrchestrator.write.vote([
          proposalId,
          currentRoot,
          nullifierHash,
          option,
          proof,
        ])
      ).to.be.rejectedWith("voting closed");
    });

    it("vote rejects after end", async function () {
      const { zOrchestrator, merkleTree } = await loadFixture(deployFixture);

      await zOrchestrator.write.insertMember([111n]);
      const currentRoot = await merkleTree.read.getRoot();

      const currentTime = BigInt(Math.floor(Date.now() / 1000));
      const start = currentTime - 86400n;
      const end = currentTime - 3600n;
      const proposalId = 1n;
      const title = "Past Proposal";

      await zOrchestrator.write.createProposal([proposalId, title, start, end]);

      const nullifierHash = 12345n;
      const option = 1;
      const proof = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as const;

      await expect(
        zOrchestrator.write.vote([
          proposalId,
          currentRoot,
          nullifierHash,
          option,
          proof,
        ])
      ).to.be.rejectedWith("voting closed");
    });

    it("vote rejects root mismatch", async function () {
      const { zOrchestrator, proposalId } = await createActiveProposal();

      const wrongRoot = 999999n;
      const nullifierHash = 12345n;
      const option = 1;
      const proof = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as const;

      await expect(
        zOrchestrator.write.vote([
          proposalId,
          wrongRoot,
          nullifierHash,
          option,
          proof,
        ])
      ).to.be.rejectedWith("root mismatch");
    });

    it("double-vote prevention by nullifier", async function () {
      const { zOrchestrator, currentRoot, proposalId } =
        await createActiveProposal();

      const nullifierHash = 12345n;
      const option = 1;
      const proof = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as const;

      await zOrchestrator.write.vote([
        proposalId,
        currentRoot,
        nullifierHash,
        option,
        proof,
      ]);

      await expect(
        zOrchestrator.write.vote([
          proposalId,
          currentRoot,
          nullifierHash,
          option,
          proof,
        ])
      ).to.be.rejectedWith("double vote");
    });

    it("nullifier uniqueness across proposals", async function () {
      const { zOrchestrator, merkleTree } = await loadFixture(deployFixture);

      await zOrchestrator.write.insertMember([111n]);
      const currentRoot = await merkleTree.read.getRoot();

      const currentTime = BigInt(Math.floor(Date.now() / 1000));
      const start = currentTime - 100n;
      const end = currentTime + 86400n;

      await zOrchestrator.write.createProposal([1n, "Proposal 1", start, end]);
      await zOrchestrator.write.createProposal([2n, "Proposal 2", start, end]);

      const nullifierHash = 12345n;
      const option = 1;
      const proof = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as const;

      await zOrchestrator.write.vote([
        1n,
        currentRoot,
        nullifierHash,
        option,
        proof,
      ]);

      await expect(
        zOrchestrator.write.vote([
          2n,
          currentRoot,
          nullifierHash,
          option,
          proof,
        ])
      ).to.be.rejectedWith("double vote");
    });

    it("different nullifiers can vote on same proposal", async function () {
      const { zOrchestrator, currentRoot, proposalId } =
        await createActiveProposal();

      const nullifierHash1 = 11111n;
      const nullifierHash2 = 22222n;
      const option = 1;
      const proof = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as const;

      await zOrchestrator.write.vote([
        proposalId,
        currentRoot,
        nullifierHash1,
        option,
        proof,
      ]);

      await zOrchestrator.write.vote([
        proposalId,
        currentRoot,
        nullifierHash2,
        option,
        proof,
      ]);

      const count = await zOrchestrator.read.getCount([proposalId, option]);
      expect(count).to.equal(2n);
    });

    it("votes for different options are counted separately", async function () {
      const { zOrchestrator, currentRoot, proposalId } =
        await createActiveProposal();

      const nullifierHash1 = 11111n;
      const nullifierHash2 = 22222n;
      const proof = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as const;

      await zOrchestrator.write.vote([
        proposalId,
        currentRoot,
        nullifierHash1,
        1,
        proof,
      ]);

      await zOrchestrator.write.vote([
        proposalId,
        currentRoot,
        nullifierHash2,
        2,
        proof,
      ]);

      const count1 = await zOrchestrator.read.getCount([proposalId, 1]);
      const count2 = await zOrchestrator.read.getCount([proposalId, 2]);
      const count0 = await zOrchestrator.read.getCount([proposalId, 0]);

      expect(count1).to.equal(1n);
      expect(count2).to.equal(1n);
      expect(count0).to.equal(0n);
    });
  });

  describe("Integration Tests", function () {
    it("complete workflow: members, proposal, vote counts", async function () {
      const { zOrchestrator, merkleTree } = await loadFixture(deployFixture);

      await zOrchestrator.write.insertMember([111n]);
      await zOrchestrator.write.insertMember([222n]);
      await zOrchestrator.write.insertMember([333n]);

      const rootAfterInserts = await merkleTree.read.getRoot();

      const start = BigInt(Math.floor(Date.now() / 1000)) + 100n;
      const end = start + 86400n;
      const proposalId = 1n;
      const title = "Integration Test Proposal";

      await zOrchestrator.write.createProposal([proposalId, title, start, end]);

      const proposal = await zOrchestrator.read.getProposal([proposalId]);
      expect(proposal[0]).to.equal(rootAfterInserts);
      expect(proposal[3]).to.equal(title);

      const countBefore = await zOrchestrator.read.getCount([proposalId, 1]);
      expect(countBefore).to.equal(0n);

      await zOrchestrator.write.insertMember([444n]);
      const rootAfterNewInsert = await merkleTree.read.getRoot();
      expect(rootAfterNewInsert).to.not.equal(rootAfterInserts);

      const proposalAfterNewInsert = await zOrchestrator.read.getProposal([
        proposalId,
      ]);
      expect(proposalAfterNewInsert[0]).to.equal(rootAfterInserts);
    });
  });
});

describe("Voting with Real Verifier Integration", function () {
  async function deployWithRealVerifier() {
    const [deployer, acc1, acc2] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const merkleTree = await hre.viem.deployContract("MerkleTree", [8, 0]);
    const realVerifier = await hre.viem.deployContract("ZkVerifier");
    const zOrchestrator = await hre.viem.deployContract("ZOrchestrator", [
      merkleTree.address,
      realVerifier.address,
    ]);

    return {
      deployer,
      acc1,
      acc2,
      publicClient,
      zOrchestrator,
      merkleTree,
      realVerifier,
    };
  }

  it("invalid proof causes revert when using real verifier", async function () {
    const { zOrchestrator, merkleTree } = await deployWithRealVerifier();

    await zOrchestrator.write.insertMember([111n]);
    const currentRoot = await merkleTree.read.getRoot();

    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const start = currentTime - 100n;
    const end = currentTime + 86400n;
    const proposalId = 1n;
    const title = "Test Proposal";

    await zOrchestrator.write.createProposal([proposalId, title, start, end]);

    const nullifierHash = 12345n;
    const option = 1;
    const invalidProof = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as const;

    await expect(
      zOrchestrator.write.vote([
        proposalId,
        currentRoot,
        nullifierHash,
        option,
        invalidProof,
      ])
    ).to.be.rejectedWith("invalid proof");
  });

  it("valid proof succeeds with real verifier", async function () {
    const { zOrchestrator, merkleTree } = await deployWithRealVerifier();

    await zOrchestrator.write.insertMember([111n]);
    const currentRoot = await merkleTree.read.getRoot();

    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const start = currentTime - 100n;
    const end = currentTime + 86400n;
    const proposalId = 1n;
    const title = "Test Proposal";

    await zOrchestrator.write.createProposal([proposalId, title, start, end]);

    const nullifierHash = 12345n;
    const option = 1;
    const validProof = [999n, 888n, 0n, 0n, 0n, 0n, 0n, 0n] as const;

    const countBefore = await zOrchestrator.read.getCount([proposalId, option]);
    expect(countBefore).to.equal(0n);

    await zOrchestrator.write.vote([
      proposalId,
      currentRoot,
      nullifierHash,
      option,
      validProof,
    ]);

    const countAfter = await zOrchestrator.read.getCount([proposalId, option]);
    expect(countAfter).to.equal(1n);
  });
});

describe("MerkleTree", function () {
  it("should deploy", async function () {
    await loadFixture(deployFixture);
  });

  it("deploys with correct empty root", async function () {
    const { merkleTree } = await loadFixture(deployFixture);
    const root = await merkleTree.read.getRoot();

    let current = 0n;
    for (let i = 0; i < 8; i++) {
      current = BigInt(
        keccak256(encodePacked(["uint256", "uint256"], [current, current]))
      );
    }

    expect(root).to.equal(current);
  });

  it("insert single leaf updates root", async function () {
    const { merkleTree, publicClient } = await loadFixture(deployFixture);

    const rootBefore = await merkleTree.read.getRoot();

    await merkleTree.write.insert([1n]);

    const rootAfter = await merkleTree.read.getRoot();

    expect(rootAfter).to.not.equal(rootBefore);
  });
});
