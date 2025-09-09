// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract MockVerifier {
    function verifyProof(
        uint256[8] calldata,
        uint256[] calldata
    ) external pure returns (bool) {
        return true;
    }
}
