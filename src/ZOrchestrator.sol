// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./MerkleTree.sol";
import "./MockVerifier.sol";

interface IMerkleTree {
    function insert(
        uint256 leaf
    ) external returns (uint256 index, uint256 newRoot);

    function getRoot() external view returns (uint256);
}

interface IZKVerifier {
    function verifyProof(
        uint256[8] calldata proof,
        uint256[] calldata publicSignals
    ) external view returns (bool);
}

contract ZOrchestrator {
    IMerkleTree public merkleTree;
    IZKVerifier public verifier;
    address public admin;

    struct Proposal {
        uint256 id;
        string title;
        uint256 root;
        uint256 start;
        uint256 end;
        mapping(uint8 => uint256) counts;
    }

    mapping(uint256 => Proposal) private proposals;

    mapping(bytes32 => bool) public nullifierUsed;

    event ProposalCreated(
        uint256 indexed id,
        string title,
        uint256 root,
        uint256 start,
        uint256 end
    );
    event MemberInserted(uint256 indexed index, uint256 leaf, uint256 newRoot);
    event Voted(uint256 indexed proposalId, uint8 option, bytes32 nullifier);

    constructor(address _merkleTree, address _verifier) {
        merkleTree = IMerkleTree(_merkleTree);
        verifier = IZKVerifier(_verifier);
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

    function insertMember(
        uint256 commitment
    ) external returns (uint256 index, uint256 newRoot) {
        (index, newRoot) = merkleTree.insert(commitment);
        emit MemberInserted(index, commitment, newRoot);
        return (index, newRoot);
    }

    function createProposal(
        uint256 id,
        string calldata title,
        uint256 start,
        uint256 end
    ) external onlyAdmin {
        require(id > 0, "id>0");
        require(start < end, "bad times");
        Proposal storage p = proposals[id];
        require(p.start == 0, "proposal exists");

        p.id = id;
        p.title = title;
        p.start = start;
        p.end = end;
        p.root = merkleTree.getRoot();

        emit ProposalCreated(id, title, p.root, start, end);
    }

    function getProposal(
        uint256 id
    )
        external
        view
        returns (uint256 root, uint256 start, uint256 end, string memory title)
    {
        Proposal storage p = proposals[id];
        require(p.start != 0, "no proposal");
        return (p.root, p.start, p.end, p.title);
    }

    function getCount(
        uint256 id,
        uint8 option
    ) external view returns (uint256) {
        Proposal storage p = proposals[id];
        require(p.start != 0, "no proposal");
        return p.counts[option];
    }

    function vote(
        uint256 proposalId,
        uint256 root,
        uint256 nullifierHash,
        uint8 option,
        uint256[8] calldata proof
    ) external {
        Proposal storage p = proposals[proposalId];
        require(p.start != 0, "no proposal");
        require(
            block.timestamp >= p.start && block.timestamp <= p.end,
            "voting closed"
        );
        require(root == p.root, "root mismatch");

        bytes32 n = bytes32(nullifierHash);
        require(!nullifierUsed[n], "double vote");

        uint256[] memory publicSignals = new uint256[](3);
        publicSignals[0] = root;
        publicSignals[1] = nullifierHash;
        publicSignals[2] = proposalId;

        bool ok = verifier.verifyProof(proof, publicSignals);
        require(ok, "invalid proof");

        nullifierUsed[n] = true;
        p.counts[option] += 1;

        emit Voted(proposalId, option, n);
    }
}
