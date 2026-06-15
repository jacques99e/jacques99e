// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Registre de traçabilité Wazo Digital sur Celo
/// @notice Ancre un hash SHA-256 d'actif (bytes32) sur la blockchain Celo
contract WazoTraceRegistry {
    event HashAnchored(bytes32 indexed hash, address indexed sender, uint256 timestamp);

    mapping(bytes32 => uint256) public anchors;

    function anchorHash(bytes32 hash) external {
        require(anchors[hash] == 0, "Wazo: deja ancre");
        anchors[hash] = block.timestamp;
        emit HashAnchored(hash, msg.sender, block.timestamp);
    }

    function isAnchored(bytes32 hash) external view returns (bool) {
        return anchors[hash] > 0;
    }
}
