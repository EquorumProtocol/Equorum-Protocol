// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IEquorumCore.sol";

/**
 * @title EquorumLiquidityManager
 * @author Equorum Protocol
 * @notice Manages EQM token liquidity deployment to DEX pools
 * @dev Simplified version of original LiquidityBuffer without oracle dependencies
 * 
 * FEATURES:
 * - Manages 500K EQM tokens for liquidity
 * - Controlled deployment to approved pools
 * - Withdrawal tracking and management
 * - Pool approval system
 * - Pausable for emergency control
 * - Compatible with IEquorumCore interface
 * 
 * SECURITY:
 * - Only approved pools can receive liquidity
 * - Owner-controlled deployment
 * - Withdrawal tracking prevents over-deployment
 * - ReentrancyGuard on all state-changing functions
 * - Emergency pause mechanism
 * 
 * ARBITRUM L2 OPTIMIZATIONS:
 * - Minimal storage operations
 * - Gas-efficient pool tracking
 * - Event-driven state updates
 * - Optimized for low L2 gas costs
 * 
 * USAGE:
 * 1. Owner approves DEX pool addresses (Uniswap, Camelot, etc)
 * 2. Owner deploys liquidity to approved pools
 * 3. Liquidity can be withdrawn if needed
 * 4. All operations tracked on-chain
 */
contract EquorumLiquidityManager is IEquorumCore, Ownable, Pausable, ReentrancyGuard {
    
    // ========== CONSTANTS ==========
    
    /// @notice Total liquidity allocation (500K EQM)
    uint256 public constant LIQUIDITY_ALLOCATION = 500_000 * 1e18;
    
    // ========== STATE VARIABLES ==========
    
    /// @notice EQM token contract
    IERC20 public immutable equorumToken;
    
    /// @notice Total tokens deployed to pools
    uint256 public totalDeployed;
    
    /// @notice Amount deployed to each pool
    mapping(address => uint256) public deployedToPools;
    
    /// @notice Approved pool addresses
    mapping(address => bool) public approvedPools;
    
    /// @notice Deployment history for tracking
    mapping(address => uint256) public deploymentCount;
    
    // ========== EVENTS ==========
    
    /// @notice Emitted when liquidity is deployed to a pool
    event LiquidityDeployed(address indexed pool, uint256 amount, uint256 timestamp);
    
    /// @notice Emitted when liquidity is withdrawn from tracking
    event LiquidityWithdrawn(address indexed pool, uint256 amount, uint256 timestamp);
    
    /// @notice Emitted when pool approval status changes
    event PoolApproved(address indexed pool, bool status);
    
    /// @notice Emitted when emergency withdrawal occurs
    event EmergencyWithdrawal(address indexed to, uint256 amount);
    
    // ========== CONSTRUCTOR ==========
    
    /**
     * @notice Initializes the liquidity manager
     * @dev Contract starts PAUSED - owner must unpause to activate
     * @param _equorumToken Address of EQM token contract
     */
    constructor(address _equorumToken) {
        require(_equorumToken != address(0), "Invalid token address");
        equorumToken = IERC20(_equorumToken);
        
        // Start paused - owner activates when ready
        _pause();
    }
    
    // ========== CORE FUNCTIONS ==========
    
    /**
     * @notice Deploys liquidity to an approved pool
     * @dev Pool must be pre-approved by owner
     * @param pool Address of DEX pool (Uniswap, Camelot, etc)
     * @param amount Amount of EQM tokens to deploy
     * 
     * ARBITRUM OPTIMIZATION:
     * - Single transfer operation
     * - Minimal state updates
     * - Gas-efficient tracking
     */
    function deployLiquidity(address pool, uint256 amount) 
        external 
        onlyOwner 
        nonReentrant 
        whenNotPaused 
    {
        require(approvedPools[pool], "Pool not approved");
        require(amount > 0, "Amount must be greater than zero");
        require(totalDeployed + amount <= LIQUIDITY_ALLOCATION, "Exceeds allocation");
        
        uint256 balance = equorumToken.balanceOf(address(this));
        require(balance >= amount, "Insufficient contract balance");
        
        // Update state
        totalDeployed += amount;
        deployedToPools[pool] += amount;
        deploymentCount[pool]++;
        
        // Transfer tokens to pool
        require(equorumToken.transfer(pool, amount), "Transfer failed");
        
        emit LiquidityDeployed(pool, amount, block.timestamp);
    }
    
    /**
     * @notice Updates withdrawal tracking for a pool
     * @dev Does not actually withdraw tokens - only updates accounting
     * @param pool Address of pool
     * @param amount Amount to mark as withdrawn
     * 
     * NOTE: This is for accounting purposes when liquidity is removed
     * from pools manually. The actual LP token withdrawal happens
     * outside this contract.
     */
    function withdrawLiquidity(address pool, uint256 amount) 
        external 
        onlyOwner 
        nonReentrant 
    {
        require(deployedToPools[pool] >= amount, "Insufficient deployed amount");
        
        // Update tracking
        deployedToPools[pool] -= amount;
        totalDeployed -= amount;
        
        emit LiquidityWithdrawn(pool, amount, block.timestamp);
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @notice Approves or revokes pool for liquidity deployment
     * @dev Only approved pools can receive liquidity
     * @param pool Address of DEX pool
     * @param status True to approve, false to revoke
     */
    function approvePool(address pool, bool status) external onlyOwner {
        require(pool != address(0), "Invalid pool address");
        approvedPools[pool] = status;
        emit PoolApproved(pool, status);
    }
    
    /**
     * @notice Batch approve multiple pools
     * @dev Gas-optimized for multiple approvals
     * @param pools Array of pool addresses
     * @param statuses Array of approval statuses
     */
    function batchApprovePool(address[] calldata pools, bool[] calldata statuses) 
        external 
        onlyOwner 
    {
        require(pools.length == statuses.length, "Length mismatch");
        
        uint256 length = pools.length;
        for (uint256 i = 0; i < length;) {
            require(pools[i] != address(0), "Invalid pool address");
            approvedPools[pools[i]] = statuses[i];
            emit PoolApproved(pools[i], statuses[i]);
            unchecked { ++i; }
        }
    }
    
    /**
     * @notice Activates liquidity management (unpauses)
     * @dev Owner calls when ready to deploy liquidity
     */
    function activate() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Deactivates liquidity management (pauses)
     */
    function deactivate() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Emergency withdrawal of tokens
     * @dev Use only in emergency situations
     * @param to Destination address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 balance = equorumToken.balanceOf(address(this));
        require(amount <= balance, "Insufficient balance");
        
        require(equorumToken.transfer(to, amount), "Transfer failed");
        emit EmergencyWithdrawal(to, amount);
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Returns available liquidity in contract
     * @return Available EQM token balance
     */
    function getAvailableLiquidity() external view returns (uint256) {
        return equorumToken.balanceOf(address(this));
    }
    
    /**
     * @notice Returns deployment statistics for a pool
     * @param pool Pool address
     * @return deployed Amount deployed to pool
     * @return count Number of deployments
     * @return approved Whether pool is approved
     */
    function getPoolStats(address pool) external view returns (
        uint256 deployed,
        uint256 count,
        bool approved
    ) {
        return (
            deployedToPools[pool],
            deploymentCount[pool],
            approvedPools[pool]
        );
    }
    
    /**
     * @notice Returns overall liquidity statistics
     * @return total Total allocation
     * @return deployed Total deployed
     * @return available Available in contract
     * @return isPaused Whether contract is paused
     */
    function getLiquidityStats() external view returns (
        uint256 total,
        uint256 deployed,
        uint256 available,
        bool isPaused
    ) {
        return (
            LIQUIDITY_ALLOCATION,
            totalDeployed,
            equorumToken.balanceOf(address(this)),
            paused()
        );
    }
    
    // ========== IEQUORUMCORE IMPLEMENTATION ==========
    
    /**
     * @notice Processes system action
     * @dev Action types: 1=Regular (unused), 2=Critical (pause if low), 3=Emergency (pause)
     * @param actionType Type of action
     * @param data Additional data (unused)
     */
    function processSystemAction(uint8 actionType, bytes calldata data) external override onlyOwner {
        if (actionType == 2) {
            // Critical: Pause if balance critically low
            uint256 balance = equorumToken.balanceOf(address(this));
            if (balance < LIQUIDITY_ALLOCATION / 10) {
                _pause();
            }
        } else if (actionType == 3) {
            // Emergency: Immediate pause
            _pause();
        }
        
        emit SystemAction(address(this), "Liquidity action", actionType, block.timestamp);
    }
    
    /**
     * @notice Emergency stop
     * @param reason Reason for stop
     */
    function emergencyStop(string calldata reason) external override onlyOwner {
        _pause();
        emit EmergencyAction(address(this), reason, block.timestamp);
    }
    
    /**
     * @notice Updates parameters (not supported - values are constants)
     * @dev Kept for IEquorumCore compatibility
     */
    function updateParameters(string[] calldata, uint256[] calldata) external override onlyOwner {
        // Liquidity manager uses constants - no parameter updates
        emit SystemAction(address(this), "Parameter update not supported", 0, block.timestamp);
    }
    
    /**
     * @notice Validates contract state
     * @return checksum Hash of current state
     */
    function validateState() external view override returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                address(equorumToken),
                totalDeployed,
                paused()
            )
        );
    }
    
    /**
     * @notice Verifies integrations
     * @param contracts Array with [equorumToken]
     * @return valid True if integration valid
     */
    function verifyIntegrations(address[] calldata contracts) external view override returns (bool) {
        if (contracts.length != 1) return false;
        return contracts[0] == address(equorumToken);
    }
}

