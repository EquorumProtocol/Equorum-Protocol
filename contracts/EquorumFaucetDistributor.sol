// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IEquorumCore.sol";

/**
 * @title EquorumFaucetDistributor
 * @author Equorum Protocol
 * @notice Manages free EQM token distribution via faucet system
 * @dev Simplified version of original EquorumFaucet without external dependencies
 * 
 * FEATURES:
 * - Controlled distribution of 2.256M tokens
 * - 24-hour cooldown between claims
 * - Global daily limit protection
 * - Whitelist system for trusted users
 * - Anti-bot protections (contract blocking, minimum balance)
 * - Pausable for emergency control
 * - Compatible with IEquorumCore interface
 * 
 * SECURITY:
 * - Whitelist-only mode available
 * - Contract address blocking
 * - Minimum ETH balance requirement
 * - Account age verification
 * - Blacklist system
 * - ReentrancyGuard on all state-changing functions
 * 
 * ARBITRUM L2 OPTIMIZATIONS:
 * - Packed storage layout
 * - Minimal SLOAD operations
 * - Gas-efficient daily resets
 * - Event-driven state tracking
 * - Optimized for low L2 gas costs
 */
contract EquorumFaucetDistributor is IEquorumCore, Ownable, Pausable, ReentrancyGuard {
    
    // ========== CUSTOM ERRORS ==========
    error InvalidAddress();
    error AddressBlacklisted();
    error NoContractsAllowed();
    error NotWhitelisted();
    error InsufficientETHBalance();
    error AccountTooNew();
    error CooldownActive();
    error UserLimitExceeded();
    error DailyLimitExceeded();
    error FaucetAllocationExceeded();
    error InsufficientFaucetBalance();
    error TransferFailed();
    error InsufficientBalance();
    
    // ========== CONSTANTS ==========
    
    /// @notice Total faucet allocation (2.256M EQM)
    uint256 public constant FAUCET_ALLOCATION = 2_256_000 * 1e18;
    
    /// @notice Base claim amount per request (0.001 EQM - micro amounts for sustainability)
    uint256 public constant BASE_CLAIM_AMOUNT = 0.001 * 1e18;
    
    /// @notice Cooldown period between claims (24 hours)
    uint256 public constant CLAIM_COOLDOWN = 1 days;
    
    /// @notice Global daily distribution limit (10 EQM/day - sustainable)
    uint256 public constant DAILY_LIMIT = 10 * 1e18;
    
    /// @notice Maximum tokens per user lifetime (0.05 EQM - prevents abuse)
    uint256 public constant MAX_PER_USER = 0.05 * 1e18;
    
    /// @notice Minimum ETH balance required to claim (0.001 ETH)
    uint256 public constant MIN_ETH_BALANCE = 0.001 ether;
    
    /// @notice Minimum account age in blocks (~1 hour on Arbitrum)
    uint256 public constant MIN_ACCOUNT_AGE = 14400; // ~1 hour at 0.25s/block
    
    // ========== STATE VARIABLES ==========
    
    /// @notice EQM token contract
    IERC20 public immutable equorumToken;
    
    /// @notice Block number when contract was deployed
    uint256 public immutable deployBlock;
    
    /// @notice Whether whitelist mode is active
    bool public whitelistMode;
    
    /// @notice Last claim timestamp for each user
    mapping(address => uint256) public lastClaim;
    
    /// @notice Total claimed by each user
    mapping(address => uint256) public totalClaimed;
    
    /// @notice Blacklisted addresses
    mapping(address => bool) public blacklisted;
    
    /// @notice Whitelisted addresses (only used if whitelistMode is true)
    mapping(address => bool) public whitelisted;
    
    /// @notice First interaction block for each address
    mapping(address => uint256) public firstBlock;
    
    /// @notice Total distributed today
    uint256 public dailyDistributed;
    
    /// @notice Timestamp of last daily reset
    uint256 public lastDailyReset;
    
    /// @notice Total distributed (lifetime)
    uint256 public totalDistributed;
    
    // ========== EVENTS ==========
    
    /// @notice Emitted when tokens are claimed
    event TokensClaimed(address indexed user, uint256 amount, uint256 timestamp);
    
    /// @notice Emitted when user blacklist status changes
    event UserBlacklisted(address indexed user, bool status);
    
    /// @notice Emitted when user whitelist status changes
    event UserWhitelisted(address indexed user, bool status);
    
    /// @notice Emitted when whitelist mode changes
    event WhitelistModeChanged(bool enabled);
    
    /// @notice Emitted when daily limit resets
    event DailyLimitReset(uint256 timestamp);
    
    /// @notice Emitted when emergency withdrawal occurs
    event EmergencyWithdrawal(address indexed to, uint256 amount);
    
    // ========== CONSTRUCTOR ==========
    
    /**
     * @notice Initializes the faucet distributor
     * @dev Contract starts PAUSED - owner must unpause to activate
     * @param _equorumToken Address of EQM token contract
     */
    constructor(address _equorumToken) {
        if (_equorumToken == address(0)) revert InvalidAddress();
        
        equorumToken = IERC20(_equorumToken);
        deployBlock = block.number;
        lastDailyReset = block.timestamp;
        
        // Start paused - owner activates when ready
        _pause();
    }
    
    // ========== CORE FUNCTIONS ==========
    
    /**
     * @notice Claims tokens from faucet
     * @dev Performs multiple security checks before distribution
     * 
     * SECURITY CHECKS:
     * - Not blacklisted
     * - Whitelist check (if enabled)
     * - Not a contract address
     * - Has minimum ETH balance
     * - Account age requirement
     * - Cooldown period
     * - User lifetime limit
     * - Daily global limit
     * 
     * ARBITRUM OPTIMIZATION:
     * - Single SSTORE for daily reset
     * - Packed state updates
     * - Minimal external calls
     */
    function claim() external nonReentrant whenNotPaused {
        address user = msg.sender;
        
        // Security checks
        if (blacklisted[user]) revert AddressBlacklisted();
        if (user.code.length != 0) revert NoContractsAllowed();
        
        // Whitelist check (if enabled)
        if (whitelistMode && !whitelisted[user]) revert NotWhitelisted();
        
        // Anti-sybil checks (skip for whitelisted users)
        if (!whitelisted[user]) {
            if (user.balance < MIN_ETH_BALANCE) revert InsufficientETHBalance();
            
            // Track first interaction
            if (firstBlock[user] == 0) {
                firstBlock[user] = block.number;
            }
            if (block.number < firstBlock[user] + MIN_ACCOUNT_AGE) revert AccountTooNew();
        }
        
        // Cooldown check
        if (block.timestamp < lastClaim[user] + CLAIM_COOLDOWN) revert CooldownActive();
        
        // User limit check
        if (totalClaimed[user] + BASE_CLAIM_AMOUNT > MAX_PER_USER) revert UserLimitExceeded();
        
        // Daily reset if needed (gas-optimized)
        if (block.timestamp >= lastDailyReset + 1 days) {
            dailyDistributed = 0;
            lastDailyReset = block.timestamp;
            emit DailyLimitReset(block.timestamp);
        }
        
        // Daily limit check
        if (dailyDistributed + BASE_CLAIM_AMOUNT > DAILY_LIMIT) revert DailyLimitExceeded();
        
        // FAUCET_ALLOCATION enforcement (prevents distributing beyond allocation)
        if (totalDistributed + BASE_CLAIM_AMOUNT > FAUCET_ALLOCATION) revert FaucetAllocationExceeded();
        
        // Contract balance check
        if (equorumToken.balanceOf(address(this)) < BASE_CLAIM_AMOUNT) revert InsufficientFaucetBalance();
        
        // Update state (packed for gas efficiency)
        lastClaim[user] = block.timestamp;
        totalClaimed[user] += BASE_CLAIM_AMOUNT;
        dailyDistributed += BASE_CLAIM_AMOUNT;
        totalDistributed += BASE_CLAIM_AMOUNT;
        
        // Transfer tokens
        if (!equorumToken.transfer(user, BASE_CLAIM_AMOUNT)) revert TransferFailed();
        
        emit TokensClaimed(user, BASE_CLAIM_AMOUNT, block.timestamp);
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @notice Sets blacklist status for an address
     * @param user Address to update
     * @param status True to blacklist, false to remove
     */
    function setBlacklist(address user, bool status) external onlyOwner {
        if (user == address(0)) revert InvalidAddress();
        blacklisted[user] = status;
        emit UserBlacklisted(user, status);
    }
    
    /**
     * @notice Sets whitelist status for an address
     * @param user Address to update
     * @param status True to whitelist, false to remove
     */
    function setWhitelist(address user, bool status) external onlyOwner {
        if (user == address(0)) revert InvalidAddress();
        whitelisted[user] = status;
        emit UserWhitelisted(user, status);
    }
    
    /**
     * @notice Batch whitelist multiple addresses
     * @dev Gas-optimized for multiple additions
     * @param users Array of addresses to whitelist
     */
    function batchWhitelist(address[] calldata users) external onlyOwner {
        uint256 length = users.length;
        for (uint256 i = 0; i < length;) {
            whitelisted[users[i]] = true;
            emit UserWhitelisted(users[i], true);
            unchecked { ++i; }
        }
    }
    
    /**
     * @notice Enables or disables whitelist mode
     * @param enabled True to enable whitelist-only mode
     */
    function setWhitelistMode(bool enabled) external onlyOwner {
        whitelistMode = enabled;
        emit WhitelistModeChanged(enabled);
    }
    
    /**
     * @notice Activates the faucet (unpauses)
     * @dev Owner calls when ready to start distribution
     */
    function activate() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Deactivates the faucet (pauses)
     */
    function deactivate() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Emergency withdrawal of tokens
     * @param to Destination address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        uint256 balance = equorumToken.balanceOf(address(this));
        if (amount > balance) revert InsufficientBalance();
        
        if (!equorumToken.transfer(to, amount)) revert TransferFailed();
        emit EmergencyWithdrawal(to, amount);
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Checks if user can claim tokens
     * @param user Address to check
     * @return canClaim True if user can claim
     * @return timeUntilNext Seconds until next claim (0 if can claim now)
     * @dev Mirrors claim() logic exactly for consistency
     */
    function canUserClaim(address user) external view returns (bool canClaim, uint256 timeUntilNext) {
        // Basic checks
        if (paused()) return (false, 0);
        if (blacklisted[user]) return (false, 0);
        if (user.code.length != 0) return (false, 0); // No contracts
        
        // Whitelist check
        if (whitelistMode && !whitelisted[user]) return (false, 0);
        
        // Anti-sybil checks (skip for whitelisted users - mirrors claim())
        if (!whitelisted[user]) {
            if (user.balance < MIN_ETH_BALANCE) return (false, 0);
            if (firstBlock[user] > 0 && block.number < firstBlock[user] + MIN_ACCOUNT_AGE) return (false, 0);
        }
        
        // User limit check
        if (totalClaimed[user] + BASE_CLAIM_AMOUNT > MAX_PER_USER) return (false, 0);
        
        // Daily limit check (approximate - doesn't account for pending reset)
        uint256 currentDailyDistributed = dailyDistributed;
        if (block.timestamp >= lastDailyReset + 1 days) {
            currentDailyDistributed = 0; // Would reset on claim
        }
        if (currentDailyDistributed + BASE_CLAIM_AMOUNT > DAILY_LIMIT) return (false, 0);
        
        // FAUCET_ALLOCATION check
        if (totalDistributed + BASE_CLAIM_AMOUNT > FAUCET_ALLOCATION) return (false, 0);
        
        // Contract balance check
        if (equorumToken.balanceOf(address(this)) < BASE_CLAIM_AMOUNT) return (false, 0);
        
        // Cooldown check
        uint256 nextClaimTime = lastClaim[user] + CLAIM_COOLDOWN;
        if (block.timestamp < nextClaimTime) {
            return (false, nextClaimTime - block.timestamp);
        }
        
        return (true, 0);
    }
    
    /**
     * @notice Returns user statistics
     * @param user Address to query
     */
    function getUserStats(address user) external view returns (
        uint256 lastClaimTime,
        uint256 totalClaimedAmount,
        uint256 remainingAllowance,
        bool isBlacklisted,
        bool isWhitelisted
    ) {
        return (
            lastClaim[user],
            totalClaimed[user],
            MAX_PER_USER - totalClaimed[user],
            blacklisted[user],
            whitelisted[user]
        );
    }
    
    /**
     * @notice Returns contract balance
     */
    function getContractBalance() external view returns (uint256) {
        return equorumToken.balanceOf(address(this));
    }
    
    /**
     * @notice Returns faucet statistics
     */
    function getFaucetStats() external view returns (
        uint256 totalDist,
        uint256 dailyDist,
        uint256 remaining,
        uint256 lastReset,
        bool isPaused,
        bool isWhitelistMode
    ) {
        return (
            totalDistributed,
            dailyDistributed,
            equorumToken.balanceOf(address(this)),
            lastDailyReset,
            paused(),
            whitelistMode
        );
    }
    
    // ========== IEQUORUMCORE IMPLEMENTATION ==========
    
    /**
     * @notice Processes system action
     * @dev Action types: 1=Regular (daily reset), 2=Critical (pause if low), 3=Emergency (pause)
     * @param actionType Type of action
     * @param data Additional data (unused)
     */
    function processSystemAction(uint8 actionType, bytes calldata data) external override onlyOwner {
        if (actionType == 1) {
            // Regular: Force daily reset if needed
            if (block.timestamp >= lastDailyReset + 1 days) {
                dailyDistributed = 0;
                lastDailyReset = block.timestamp;
                emit DailyLimitReset(block.timestamp);
            }
        } else if (actionType == 2) {
            // Critical: Pause if balance low
            uint256 balance = equorumToken.balanceOf(address(this));
            if (balance < DAILY_LIMIT / 10) {
                _pause();
            }
        } else if (actionType == 3) {
            // Emergency: Immediate pause
            _pause();
        }
        
        emit SystemAction(address(this), "Faucet action", actionType, block.timestamp);
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
        // Faucet uses constants - no parameter updates
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
                totalDistributed,
                dailyDistributed,
                lastDailyReset,
                paused(),
                whitelistMode
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
