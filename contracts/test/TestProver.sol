/* -*- c-basic-offset: 4 -*- */
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseProver} from "../prover/BaseProver.sol";

contract TestProver is BaseProver {
    struct argsCheck {
        address sender;
        uint256 sourceChainId;
        bytes32[] intentHashes;
        address[] claimants;
        bytes data;
        uint256 value;
    }

    argsCheck public args;

    constructor(address _inbox) BaseProver(_inbox) {}

    function version() external pure returns (string memory) {
        return "1.8.14-e2c12e7";
    }

    function addProvenIntent(bytes32 _hash, address _claimant) public {
        provenIntents[_hash] = _claimant;
    }

    function getProofType() external pure override returns (string memory) {
        return "storage";
    }

    function destinationProve(
        address _sender,
        uint256 _sourceChainId,
        bytes32[] calldata _intentHashes,
        address[] calldata _claimants,
        bytes calldata _data
    ) external payable override {
        args = argsCheck({
            sender: _sender,
            sourceChainId: _sourceChainId,
            intentHashes: _intentHashes,
            claimants: _claimants,
            data: _data,
            value: msg.value
        });
    }
}
