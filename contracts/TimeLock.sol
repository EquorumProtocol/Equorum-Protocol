// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title TimeLock
 * @author Equorum Protocol
 * @notice Secure timelock contract for delayed transaction execution
 * @dev Optimized for Arbitrum L2 with minimal storage operations
 * 
 * FEATURES:
 * - Fixed delay: 48 hours (prevents rushed malicious proposals)
 * - Grace period: 7 days (window to execute after delay)
 * - Queue → Execute pattern (standard timelock flow)
 * - Cancellation support (admin can cancel queued transactions)
 * - Single admin (should be EquorumGovernance contract)
 * 
 * SECURITY MODEL:
 * - All transactions must wait 48h before execution
 * - Transactions expire after 7 days grace period
 * - Only admin (governance) can queue/execute/cancel
 * - ETH can be received for proposal execution
 * 
 * DEPLOYMENT FLOW:
 * 1. Deploy TimeLock with admin = deployer (temporary)
 * 2. Deploy EquorumGovernance pointing to TimeLock
 * 3. Call changeAdmin(governanceAddress) to transfer control
 * 4. TimeLock is now controlled by governance
 * 
 * ARBITRUM L2 OPTIMIZATIONS:
 * - Custom errors for gas savings (~200 gas per revert)
 * - Minimal storage writes
 * - Efficient hash computation
 * 
 * IMPORTANT: Proposals with ETH values require the executor to provide
 * the ETH via msg.value. For zero-value proposals, no ETH is needed.
 */
contract TimeLock {
    
    // ========== CUSTOM ERRORS ==========
    error NotAdmin();
    error InvalidAddress();
    error ETANotReached();
    error ETATooSoon();
    error TransactionExpired();
    error TransactionNotQueued();
    error TransactionAlreadyQueued();
    error ExecutionFailed();
    error NotPendingAdmin();
    
    // ========== CONSTANTS ==========
    /// @notice Minimum delay before a queued transaction can be executed
    uint256 public constant DELAY = 48 hours;
    
    /// @notice Time window after ETA during which transaction can be executed
    uint256 public constant GRACE_PERIOD = 7 days;
    
    // ========== STATE VARIABLES ==========
    /// @notice Current admin address (should be EquorumGovernance)
    address public admin;
    
    /// @notice Pending admin for two-step transfer (optional)
    address public pendingAdmin;
    
    /// @notice Mapping of transaction hash to queued status
    mapping(bytes32 => bool) public queuedTransactions;
    
    // ========== EVENTS ==========
    event TransactionQueued(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );
    
    event TransactionExecuted(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data
    );
    
    event TransactionCanceled(bytes32 indexed txHash);
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event NewPendingAdmin(address indexed newPendingAdmin);
    
    // ========== MODIFIERS ==========
    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }
    
    // ========== CONSTRUCTOR ==========
    /**
     * @notice Initializes the TimeLock contract
     * @param _admin Initial admin address (typically deployer, then changed to governance)
     */
    constructor(address _admin) {
        if (_admin == address(0)) revert InvalidAddress();
        admin = _admin;
        emit AdminChanged(address(0), _admin);
    }
    
    // ========== TIMELOCK FUNCTIONS ==========
    
    /**
     * @notice Queue a transaction for delayed execution
     * @param target Target contract address
     * @param value ETH value to send with the call
     * @param signature Function signature (e.g., "transfer(address,uint256)")
     * @param data Encoded function parameters
     * @param eta Execution timestamp (must be >= block.timestamp + DELAY)
     * @return txHash The unique hash identifying this transaction
     */
    function queueTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) external onlyAdmin returns (bytes32) {
        if (eta < block.timestamp + DELAY) revert ETATooSoon();
        
        bytes32 txHash = keccak256(
            abi.encode(target, value, signature, data, eta)
        );
        
        if (queuedTransactions[txHash]) revert TransactionAlreadyQueued();
        
        queuedTransactions[txHash] = true;
        
        emit TransactionQueued(txHash, target, value, signature, data, eta);
        
        return txHash;
    }
    
    /**
     * @notice Execute a queued transaction after the delay has passed
     * @param target Target contract address
     * @param value ETH value to send (must match msg.value from governance)
     * @param signature Function signature
     * @param data Encoded function parameters
     * @param eta Execution timestamp (must match the queued ETA)
     * @return returnData The return data from the executed call
     * @dev Transaction must be within the execution window: [eta, eta + GRACE_PERIOD]
     */
    function executeTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) external payable onlyAdmin returns (bytes memory) {
        if (target == address(0)) revert InvalidAddress();
        
        bytes32 txHash = keccak256(
            abi.encode(target, value, signature, data, eta)
        );
        
        if (!queuedTransactions[txHash]) revert TransactionNotQueued();
        if (block.timestamp < eta) revert ETANotReached();
        if (block.timestamp > eta + GRACE_PERIOD) revert TransactionExpired();
        
        // Clear from queue before execution (reentrancy protection)
        queuedTransactions[txHash] = false;
        
        // Build call data
        bytes memory callData;
        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(
                bytes4(keccak256(bytes(signature))),
                data
            );
        }
        
        // Execute the call
        (bool success, bytes memory returnData) = target.call{value: value}(
            callData
        );
        
        if (!success) revert ExecutionFailed();
        
        emit TransactionExecuted(txHash, target, value, signature, data);
        
        return returnData;
    }
    
    /**
     * @notice Cancel a queued transaction
     * @param target Target contract address
     * @param value ETH value
     * @param signature Function signature
     * @param data Encoded function parameters
     * @param eta Execution timestamp
     */
    function cancelTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) external onlyAdmin {
        bytes32 txHash = keccak256(
            abi.encode(target, value, signature, data, eta)
        );
        
        if (!queuedTransactions[txHash]) revert TransactionNotQueued();
        
        queuedTransactions[txHash] = false;
        
        emit TransactionCanceled(txHash);
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @notice Immediately change admin to a new address (one-step transfer)
     * @param newAdmin New admin address (typically EquorumGovernance)
     * @dev CRITICAL: Use this after deploying governance to transfer control
     * @dev This is the recommended way to set governance as admin
     */
    function changeAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        
        address previousAdmin = admin;
        admin = newAdmin;
        pendingAdmin = address(0);  // Clear any pending admin
        
        emit AdminChanged(previousAdmin, newAdmin);
    }
    
    /**
     * @notice Propose a new admin (two-step transfer, optional)
     * @param newAdmin Address of the proposed new admin
     * @dev Use changeAdmin() for immediate transfer to governance
     */
    function setPendingAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        pendingAdmin = newAdmin;
        emit NewPendingAdmin(newAdmin);
    }
    
    /**
     * @notice Accept admin role (must be called by pendingAdmin)
     * @dev Part of two-step admin transfer process
     */
    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert NotPendingAdmin();
        
        address previousAdmin = admin;
        admin = pendingAdmin;
        pendingAdmin = address(0);
        
        emit AdminChanged(previousAdmin, admin);
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Check if a transaction is queued
     * @param target Target contract address
     * @param value ETH value
     * @param signature Function signature
     * @param data Encoded function parameters
     * @param eta Execution timestamp
     * @return True if transaction is queued
     */
    function isQueued(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) external view returns (bool) {
        bytes32 txHash = keccak256(
            abi.encode(target, value, signature, data, eta)
        );
        return queuedTransactions[txHash];
    }
    
    /**
     * @notice Calculate the hash of a transaction
     * @param target Target contract address
     * @param value ETH value
     * @param signature Function signature
     * @param data Encoded function parameters
     * @param eta Execution timestamp
     * @return Transaction hash
     */
    function getTransactionHash(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) external pure returns (bytes32) {
        return keccak256(
            abi.encode(target, value, signature, data, eta)
        );
    }
    
    /**
     * @notice Check if a queued transaction is ready to execute
     * @param target Target contract address
     * @param value ETH value
     * @param signature Function signature
     * @param data Encoded function parameters
     * @param eta Execution timestamp
     * @return ready True if transaction can be executed now
     * @return reason Status message
     */
    function canExecute(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) external view returns (bool ready, string memory reason) {
        bytes32 txHash = keccak256(
            abi.encode(target, value, signature, data, eta)
        );
        
        if (!queuedTransactions[txHash]) {
            return (false, "Not queued");
        }
        if (block.timestamp < eta) {
            return (false, "ETA not reached");
        }
        if (block.timestamp > eta + GRACE_PERIOD) {
            return (false, "Expired");
        }
        return (true, "Ready");
    }
    
    // ========== RECEIVE ==========
    
    /// @notice Receive ETH for proposal execution
    receive() external payable {}
}
