/* -*- c-basic-offset: 4 -*- */
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseProver} from "./BaseProver.sol";

/**
 * @title MessageBridgeProver
 * @notice Abstract contract for cross-chain message-based proving mechanisms
 * @dev Extends BaseProver with functionality for message bridge provers like Hyperlane and Metalayer
 */
abstract contract MessageBridgeProver is BaseProver {
    /**
     * @notice Emitted when attempting to prove an already-proven intent
     * @dev Event instead of error to allow batch processing to continue
     * @param _intentHash Hash of the already proven intent
     */
    event IntentAlreadyProven(bytes32 _intentHash);

    /**
     * @notice Emitted when a batch of fulfilled intents is sent to be relayed to the source chain
     * @param _hashes the intent hashes sent in the batch
     * @param _sourceChainID ID of the source chain
     */
    event BatchSent(bytes32[] indexed _hashes, uint256 indexed _sourceChainID);

    /**
     * @notice Insufficient fee provided for cross-chain message dispatch
     * @param _requiredFee Amount of fee required
     */
    error InsufficientFee(uint256 _requiredFee);

    /**
     * @notice Native token transfer failed
     */
    error NativeTransferFailed();

    /**
     * @notice Unauthorized call to handle() detected
     * @param _sender Address that attempted the call
     */
    error UnauthorizedHandle(address _sender);

    /**
     * @notice Unauthorized call to initiate proving
     * @param _sender Address that initiated
     */
    error UnauthorizedDestinationProve(address _sender);

    /**
     * @notice Mapping of addresses to their prover whitelist status
     * @dev Used to authorize cross-chain message senders
     */
    mapping(address => bool) public proverWhitelist;

    /**
     * @notice Initializes the MessageBridgeProver contract
     * @param _inbox Address of the Inbox contract
     * @param _provers Array of trusted prover addresses to whitelist
     */
    constructor(address _inbox, address[] memory _provers) BaseProver(_inbox) {
        proverWhitelist[address(this)] = true;
        for (uint256 i = 0; i < _provers.length; i++) {
            proverWhitelist[_provers[i]] = true;
        }
    }

    /**
     * @notice Validates that the message sender is authorized
     * @dev Template method for authorization check
     * @param _messageSender Address attempting to call handle()
     * @param _expectedSender Address that should be authorized
     */
    function _validateMessageSender(
        address _messageSender,
        address _expectedSender
    ) internal view {
        if (_expectedSender != _messageSender) {
            revert UnauthorizedHandle(_messageSender);
        }
    }

    /**
     * @notice Validates that the proving request is authorized
     * @param _sender Address that sent the proving request
     */
    function _validateProvingRequest(address _sender) internal view {
        if (_sender != INBOX) {
            revert UnauthorizedDestinationProve(_sender);
        }
    }

    /**
     * @notice Process intent proofs from a cross-chain message
     * @param _hashes Array of intent hashes
     * @param _claimants Array of claimant addresses
     */
    function _processIntentProofs(
        bytes32[] memory _hashes,
        address[] memory _claimants
    ) internal {
        // If arrays are empty, just return early
        if (_hashes.length == 0) return;

        // Note: For now we don't check array lengths match, but ideally this would
        // include a check like: require(_hashes.length == _claimants.length, "Array length mismatch");

        for (uint256 i = 0; i < _hashes.length; i++) {
            (bytes32 intentHash, address claimant) = (
                _hashes[i],
                _claimants[i]
            );
            if (provenIntents[intentHash] != address(0)) {
                emit IntentAlreadyProven(intentHash);
            } else {
                provenIntents[intentHash] = claimant;
                emit IntentProven(intentHash, claimant);
            }
        }
    }

    /**
     * @notice Process payment and refund excess fees
     * @param _fee Required fee amount
     * @param _sender Address to refund excess fee to
     */
    function _processPayment(uint256 _fee, address _sender) internal {
        if (msg.value < _fee) {
            revert InsufficientFee(_fee);
        }
        if (msg.value > _fee) {
            (bool success, ) = payable(_sender).call{value: msg.value - _fee}(
                ""
            );
            if (!success) {
                revert NativeTransferFailed();
            }
        }
    }

    /**
     * @notice Calculates the fee required for cross-chain message dispatch
     * @param _sourceChainId Chain ID of the source chain
     * @param _intentHashes Array of intent hashes to prove
     * @param _claimants Array of claimant addresses
     * @param _data Additional data for message formatting
     * @return Fee amount in native tokens
     */
    function fetchFee(
        uint256 _sourceChainId,
        bytes32[] calldata _intentHashes,
        address[] calldata _claimants,
        bytes calldata _data
    ) public view virtual returns (uint256);

    /**
     * @notice Returns the proof type used by this prover
     * @return String indicating the proving mechanism
     */
    function getProofType() external pure virtual returns (string memory);
}
