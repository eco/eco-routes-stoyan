// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IMetalayerRecipient, ReadOperation} from "@metalayer/contracts/src/interfaces/IMetalayerRecipient.sol";
import {FinalityState} from "@metalayer/contracts/src/lib/MetalayerMessage.sol";
import {TypeCasts} from "@hyperlane-xyz/core/contracts/libs/TypeCasts.sol";
import {MessageBridgeProver} from "./MessageBridgeProver.sol";
import {Semver} from "../libs/Semver.sol";
import {IMetalayerRouter} from "@metalayer/contracts/src/interfaces/IMetalayerRouter.sol";

/**
 * @title MetaProver
 * @notice Prover implementation using Caldera Metalayer's cross-chain messaging system
 * @dev Processes proof messages from Metalayer router and records proven intents
 */
contract MetaProver is IMetalayerRecipient, MessageBridgeProver, Semver {
    using TypeCasts for bytes32;
    using TypeCasts for address;

    /**
     * @notice Constant indicating this contract uses Metalayer for proving
     */
    string public constant PROOF_TYPE = "Metalayer";

    /**
     * @notice Emitted when attempting to prove an already-proven intent
     * @dev Event instead of error to allow batch processing to continue
     * @param _intentHash Hash of the already proven intent
     */
    event IntentAlreadyProven(bytes32 _intentHash);

    /**
     * @notice Emitted when a batch of fulfilled intents is sent to the Metalayer router to be relayed to the source chain
     * @param _hashes the intent hashes sent in the batch
     * @param _sourceChainID ID of the source chain
     */
    event BatchSent(bytes32[] indexed _hashes, uint256 indexed _sourceChainID);

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
     * @notice Address of local Metalayer router
     */
    address public immutable ROUTER;

    /**
     * @notice Initializes the MetaProver contract
     * @param _router Address of local Metalayer router
     * @param _inbox Address of Inbox contract
     * @param _provers Array of trusted provers to whitelist
     */
    constructor(
        address _router,
        address _inbox,
        address[] memory _provers
    ) MessageBridgeProver(_inbox, _provers) {
        ROUTER = _router;
    }

    /**
     * @notice Handles incoming Metalayer messages containing proof data
     * @dev Processes batch updates to proven intents from valid sources
     * @param _sender Address that dispatched the message on source chain
     * @param _message Encoded array of intent hashes and claimants
     */
    function handle(
        uint32,
        bytes32 _sender,
        bytes calldata _message,
        ReadOperation[] calldata,
        bytes[] calldata
    ) external payable {
        // Verify message is from authorized router
        if (ROUTER != msg.sender) {
            revert UnauthorizedHandle(msg.sender);
        }

        // Verify dispatch originated from valid destinationChain prover
        address sender = _sender.bytes32ToAddress();

        if (!proverWhitelist[sender]) {
            revert UnauthorizedDestinationProve(sender);
        }

        // Decode message containing intent hashes and claimants
        (bytes32[] memory hashes, address[] memory claimants) = abi.decode(
            _message,
            (bytes32[], address[])
        );

        // Process each intent proof
        for (uint256 i = 0; i < hashes.length; i++) {
            (bytes32 intentHash, address claimant) = (hashes[i], claimants[i]);
            if (provenIntents[intentHash] != address(0)) {
                emit IntentAlreadyProven(intentHash);
            } else {
                provenIntents[intentHash] = claimant;
                emit IntentProven(intentHash, claimant);
            }
        }
    }

    /**
     * @notice Initiates proving of intents via Metalayer
     * @dev Sends message to source chain prover with intent data
     * @param _sourceChainId Chain ID of source chain
     * @param _intentHashes Array of intent hashes to prove
     * @param _claimants Array of claimant addresses
     * @param _data Additional data for message formatting
     */
    function destinationProve(
        address _sender,
        uint256 _sourceChainId,
        bytes32[] calldata _intentHashes,
        address[] calldata _claimants,
        bytes calldata _data
    ) external payable override {
        if (msg.sender != INBOX) {
            revert UnauthorizedDestinationProve(msg.sender);
        }

        uint256 fee = fetchFee(
            _sourceChainId,
            _intentHashes,
            _claimants,
            _data
        );
        if (msg.value < fee) {
            revert InsufficientFee(fee);
        }
        (bool success, ) = payable(_sender).call{value: msg.value - fee}("");
        if (!success) {
            revert NativeTransferFailed();
        }

        (
            uint32 domain,
            bytes32 recipient,
            bytes memory message
        ) = processAndFormat(_sourceChainId, _intentHashes, _claimants, _data);

        emit BatchSent(_intentHashes, _sourceChainId);

        // Call Metalayer router's send message function
        IMetalayerRouter(ROUTER).dispatch{value: msg.value}(
            domain,
            recipient,
            new ReadOperation[](0),
            message,
            FinalityState.INSTANT,
            200_000
        );
    }

    /**
     * @notice Fetches fee required for message dispatch
     * @dev Queries Metalayer router for fee information
     * @param _sourceChainId Chain ID of source chain
     * @param _intentHashes Array of intent hashes to prove
     * @param _claimants Array of claimant addresses
     * @param _data Additional data for message formatting
     * @return Fee amount required for message dispatch
     */
    function fetchFee(
        uint256 _sourceChainId,
        bytes32[] calldata _intentHashes,
        address[] calldata _claimants,
        bytes calldata _data
    ) public view override returns (uint256) {
        (
            uint32 domain,
            bytes32 recipient,
            bytes memory message
        ) = processAndFormat(_sourceChainId, _intentHashes, _claimants, _data);

        return
            IMetalayerRouter(ROUTER).quoteDispatch(domain, recipient, message);
    }

    /**
     * @notice Returns the proof type used by this prover
     * @return ProofType indicating Metalayer proving mechanism
     */
    function getProofType() external pure override returns (string memory) {
        return PROOF_TYPE;
    }

    function processAndFormat(
        uint256 _sourceChainId,
        bytes32[] calldata hashes,
        address[] calldata claimants,
        bytes calldata _data
    )
        internal
        pure
        returns (uint32 domain, bytes32 recipient, bytes memory message)
    {
        domain = uint32(_sourceChainId);
        recipient = abi.decode(_data, (bytes32));
        message = abi.encode(hashes, claimants);
    }
}
