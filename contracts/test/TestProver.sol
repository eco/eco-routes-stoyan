/* -*- c-basic-offset: 4 -*- */
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseProver} from "../prover/BaseProver.sol";

contract TestProver is BaseProver {
    struct ArgsCheck {
        address sender;
        uint256 sourceChainId;
        bytes data;
        uint256 value;
    }

    ArgsCheck public args;
    bytes32[] public argIntentHashes;
    address[] public argClaimants;

    constructor(address _inbox) BaseProver(_inbox) {}

    function version() external pure returns (string memory) { return "2.0.1-beta.0-32c46008"; }

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
        args = ArgsCheck({
            sender: _sender,
            sourceChainId: _sourceChainId,
            data: _data,
            value: msg.value
        });
        argIntentHashes = _intentHashes;
        argClaimants = _claimants;
    }
}
