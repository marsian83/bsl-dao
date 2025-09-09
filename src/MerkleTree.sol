// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract MerkleTree {
    uint8 public immutable depth;
    uint256 public immutable zeroValue;
    uint256 public nextIndex;
    uint256[] public filledSubtrees;
    uint256 public root;

    event LeafInserted(uint256 indexed index, uint256 leaf, uint256 newRoot);

    constructor(uint8 _depth, uint256 _zeroValue) {
        require(_depth > 0 && _depth <= 32, "depth out of range");
        depth = _depth;
        zeroValue = _zeroValue;
        filledSubtrees = new uint256[](_depth);

        uint256 current = _zeroValue;
        for (uint8 i = 0; i < _depth; i++) {
            filledSubtrees[i] = current;
            current = _hash(current, current);
        }

        root = current;
        nextIndex = 0;
    }

    function insert(
        uint256 leaf
    ) external returns (uint256 index, uint256 newRoot) {
        uint256 currentIndex = nextIndex;
        require(currentIndex < (1 << depth), "tree full");

        uint256 currentHash = leaf;
        uint256 left;
        uint256 right;

        for (uint8 level = 0; level < depth; level++) {
            if (currentIndex % 2 == 0) {
                left = currentHash;
                right = zeroValue;
                filledSubtrees[level] = currentHash;
            } else {
                left = filledSubtrees[level];
                right = currentHash;
            }
            currentHash = _hash(left, right);
            currentIndex /= 2;
        }

        root = currentHash;
        index = nextIndex;
        nextIndex++;
        newRoot = root;

        emit LeafInserted(index, leaf, newRoot);
    }

    function getRoot() external view returns (uint256) {
        return root;
    }

    function _hash(
        uint256 left,
        uint256 right
    ) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(left, right)));
    }
}
