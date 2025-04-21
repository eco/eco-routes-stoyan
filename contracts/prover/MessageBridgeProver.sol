/* -*- c-basic-offset: 4 -*- */
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseProver} from "./BaseProver.sol";

abstract contract MessageBridgeProver is BaseProver {
    mapping(address => bool) public proverWhitelist;

    constructor(address _inbox, address[] memory _provers) BaseProver(_inbox) {
        proverWhitelist[address(this)] = true;
        for (uint256 i = 0; i < _provers.length; i++) {
            proverWhitelist[_provers[i]] = true;
        }
    }

    function fetchFee(
        uint256 _sourceChainId,
        bytes32[] calldata _intentHashes,
        address[] calldata _claimants,
        bytes calldata _data
    ) external view virtual returns (uint256);
}
