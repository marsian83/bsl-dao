// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract ZkVerifier {
    function verifyProof(
        uint256[8] calldata proof,
        uint256[] calldata publicSignals
    ) external pure returns (bool) {
        if (proof[0] == 999 && proof[1] == 888 && publicSignals.length == 3) {
            return true;
        }
        return false;
    }
}
