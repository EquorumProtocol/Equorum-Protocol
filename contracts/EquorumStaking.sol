// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title EquorumStaking
 * @notice Staking contract with DYNAMIC APY rewards (like central bank)
 * @dev Optimized for Arbitrum L2 with efficient storage and gas patterns
 * 
 * FEATURES:
 * - Dynamic APY: 1.0% - 3.5% (auto-regulated)
 * - APY adjusts every 30 days based on utilization
 * - Low utilization (<25%) → Higher APY (3.5%) to incentivize
 * - High utilization (>75%) → Lower APY (1.0%) to control inflation
 * - Medium utilization (25-75%) → Base APY (2.5%)
 * - Cooldown: 7 days for unstake
 * - Rewards calculated per second
 * - Emergency withdrawal functionality
 * - Graceful reward payout (pays available if insufficient)
 * 
 * INNOVATION:
 * - Works like FED/ECB regulating interest rates
 * - Sustainable tokenomics (no 1000% APY scams)
 * - Predictable adjustments (30-day periods)
 * - Transparent and automatic
 * 
 * ARBITRUM L2 OPTIMIZATIONS:
 * - Compact struct packing
 * - Minimal storage writes
 * - Efficient reward calculations
 * - Gas-optimized operations
 */
contract EquorumStaking is Ownable, ReentrancyGuard, Pausable {
    
    // ========== CUSTOM ERRORS ==========
    error InvalidAddress();
    error AmountMustBeGreaterThanZero();
    error GenesisCannotStake();
    error StakingCapExceeded();
    error NoStakeFound();
    error CooldownAlreadyStarted();
    error CooldownNotStarted();
    error CooldownNotFinished();
    error AmountExceedsStake();
    error TransferFailed();
    error AdjustmentPeriodNotElapsed();
    
    // ========== CONSTANTS ==========
    /// @notice Base APY rate (2.5% = 250 basis points)
    uint256 public constant APY_BASE = 250; // 2.5% (base 10000)
    /// @notice Minimum APY rate (1.0% = 100 basis points)
    uint256 public constant APY_MIN = 100; // 1.0%
    /// @notice Maximum APY rate (3.5% = 350 basis points)
    uint256 public constant APY_MAX = 350; // 3.5%
    /// @notice Denominator for APY calculations
    uint256 public constant APY_DENOMINATOR = 10000;
    /// @notice Cooldown period before unstaking (7 days)
    uint256 public constant COOLDOWN_PERIOD = 7 days;
    /// @notice Seconds in a year for reward calculations
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    /// @notice APY adjustment period (30 days)
    uint256 public constant ADJUSTMENT_PERIOD = 30 days;
    /// @notice Maximum staking cap (38M tokens = 79.17% of supply)
    uint256 public constant STAKING_CAP = 38_000_000 * 1e18;
    /// @notice Low utilization threshold (25%)
    uint256 public constant LOW_UTIL_THRESHOLD = 2500; // 25% (base 10000)
    /// @notice High utilization threshold (75%)
    uint256 public constant HIGH_UTIL_THRESHOLD = 7500; // 75% (base 10000)
    
    // ========== STATE VARIABLES ==========
    /// @notice Equorum token contract (immutable for gas savings)
    IERC20 public immutable equorumToken;
    
    /// @notice Genesis vesting contract (excluded from staking)
    address public immutable genesisVesting;
    
    /// @notice Total amount of tokens currently staked
    uint256 public totalStaked;
    /// @notice Total rewards paid out to all users
    uint256 public totalRewardsPaid;
    /// @notice Current APY rate (dynamic)
    uint256 public currentAPY;
    /// @notice Last APY adjustment timestamp
    uint256 public lastAdjustment;
    
    /// @notice Stake information for each user
    /// @dev Optimized struct layout for Arbitrum L2
    struct Stake {
        uint256 amount;           // Amount staked
        uint256 startTime;        // Timestamp when stake started
        uint256 lastClaimTime;    // Last time rewards were claimed
        uint256 cooldownStart;    // Cooldown start timestamp (0 if not started)
    }
    
    mapping(address => Stake) public stakes;
    
    // ========== EVENTS ==========
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event CooldownStarted(address indexed user, uint256 timestamp);
    event EmergencyWithdraw(address indexed user, uint256 amount);
    event APYAdjusted(uint256 newAPY, uint256 utilization, uint256 timestamp);
    
    // ========== CONSTRUCTOR ==========
    /**
     * @notice Initializes the staking contract
     * @param _equorumToken Address of the Equorum token
     * @param _genesisVesting Address of Genesis vesting contract (excluded from staking)
     * @dev Sets addresses as immutable for gas efficiency
     * @dev Genesis cannot stake to prevent voting power manipulation
     */
    constructor(address _equorumToken, address _genesisVesting) {
        if (_equorumToken == address(0)) revert InvalidAddress();
        if (_genesisVesting == address(0)) revert InvalidAddress();
        equorumToken = IERC20(_equorumToken);
        genesisVesting = _genesisVesting;
        currentAPY = APY_BASE; // Start with 2.5%
        lastAdjustment = block.timestamp;
    }
    
    // ========== STAKING FUNCTIONS ==========
    
    /**
     * @notice Stakes tokens to earn rewards
     * @param amount Amount of tokens to stake
     * @dev Claims pending rewards before updating stake
     * @dev Resets cooldown if user was in cooldown period
     * @dev Genesis vesting contract cannot stake
     * @dev Enforces STAKING_CAP to prevent exceeding pool capacity
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert AmountMustBeGreaterThanZero();
        if (msg.sender == genesisVesting) revert GenesisCannotStake();
        if (totalStaked + amount > STAKING_CAP) revert StakingCapExceeded();
        
        Stake storage userStake = stakes[msg.sender];
        
        // Calculate pending rewards BEFORE any state changes (critical fix)
        uint256 pendingRewards = 0;
        if (userStake.amount > 0) {
            pendingRewards = calculateRewards(msg.sender);
            // Graceful payout: pay what's available if insufficient
            if (pendingRewards > 0) {
                uint256 availableRewards = equorumToken.balanceOf(address(this)) - totalStaked;
                if (pendingRewards > availableRewards) {
                    pendingRewards = availableRewards; // Pay what we have
                }
            }
        }
        
        // EFFECTS: Update all state variables BEFORE interactions
        if (userStake.amount == 0) {
            userStake.startTime = block.timestamp;
        }
        userStake.amount += amount;
        userStake.lastClaimTime = block.timestamp;
        userStake.cooldownStart = 0;
        totalStaked += amount;
        
        // Track rewards paid
        if (pendingRewards > 0) {
            totalRewardsPaid += pendingRewards;
        }
        
        // INTERACTIONS: External calls LAST
        if (!equorumToken.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        
        // Transfer pending rewards (using saved value, not recalculated)
        if (pendingRewards > 0) {
            if (!equorumToken.transfer(msg.sender, pendingRewards)) revert TransferFailed();
            emit RewardsClaimed(msg.sender, pendingRewards);
        }
        
        emit Staked(msg.sender, amount);
    }
    
    /**
     * @notice Starts the cooldown period before unstaking
     * @dev Must wait COOLDOWN_PERIOD (7 days) before unstaking
     * @dev Claims pending rewards before starting cooldown
     */
    function startCooldown() external nonReentrant {
        Stake storage userStake = stakes[msg.sender];
        
        if (userStake.amount == 0) revert NoStakeFound();
        if (userStake.cooldownStart != 0) revert CooldownAlreadyStarted();
        
        // Calculate rewards BEFORE state changes
        uint256 pendingRewards = calculateRewards(msg.sender);
        
        // Graceful payout: pay what's available if insufficient
        if (pendingRewards > 0) {
            uint256 availableRewards = equorumToken.balanceOf(address(this)) - totalStaked;
            if (pendingRewards > availableRewards) {
                pendingRewards = availableRewards;
            }
        }
        
        // EFFECTS: Update state BEFORE interactions
        userStake.lastClaimTime = block.timestamp;
        userStake.cooldownStart = block.timestamp;
        
        if (pendingRewards > 0) {
            totalRewardsPaid += pendingRewards;
        }
        
        // INTERACTIONS: External call LAST
        if (pendingRewards > 0) {
            if (!equorumToken.transfer(msg.sender, pendingRewards)) revert TransferFailed();
            emit RewardsClaimed(msg.sender, pendingRewards);
        }
        
        emit CooldownStarted(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Unstakes tokens after cooldown period
     * @param amount Amount to unstake (0 = withdraw all)
     * @dev Requires cooldown to be started and completed
     * @dev Claims final rewards before unstaking
     */
    function unstake(uint256 amount) external nonReentrant {
        Stake storage userStake = stakes[msg.sender];
        
        if (userStake.amount == 0) revert NoStakeFound();
        if (userStake.cooldownStart == 0) revert CooldownNotStarted();
        if (block.timestamp < userStake.cooldownStart + COOLDOWN_PERIOD) revert CooldownNotFinished();
        
        // If amount is 0, unstake all
        if (amount == 0) {
            amount = userStake.amount;
        }
        
        if (amount > userStake.amount) revert AmountExceedsStake();
        
        // Calculate rewards BEFORE state changes
        uint256 pendingRewards = calculateRewards(msg.sender);
        
        // Graceful payout: pay what's available if insufficient
        if (pendingRewards > 0) {
            uint256 availableRewards = equorumToken.balanceOf(address(this)) - totalStaked;
            if (pendingRewards > availableRewards) {
                pendingRewards = availableRewards;
            }
        }
        
        // EFFECTS: Update all state BEFORE interactions
        userStake.lastClaimTime = block.timestamp;
        userStake.amount -= amount;
        totalStaked -= amount;
        
        if (pendingRewards > 0) {
            totalRewardsPaid += pendingRewards;
        }
        
        // If fully unstaked, clear stake data
        if (userStake.amount == 0) {
            delete stakes[msg.sender];
        } else {
            userStake.cooldownStart = 0;
        }
        
        // INTERACTIONS: External calls LAST
        if (!equorumToken.transfer(msg.sender, amount)) revert TransferFailed();
        
        if (pendingRewards > 0) {
            if (!equorumToken.transfer(msg.sender, pendingRewards)) revert TransferFailed();
            emit RewardsClaimed(msg.sender, pendingRewards);
        }
        
        emit Unstaked(msg.sender, amount);
    }
    
    /**
     * @notice Claims accumulated staking rewards
     * @dev Can be called anytime while staking
     */
    function claimRewards() external nonReentrant whenNotPaused {
        if (stakes[msg.sender].amount == 0) revert NoStakeFound();
        _claimRewards(msg.sender);
    }
    
    /**
     * @notice Internal function to claim rewards
     * @param user Address of the user claiming rewards
     * @dev Graceful payout: pays available rewards if insufficient funds
     */
    function _claimRewards(address user) private {
        Stake storage userStake = stakes[user];
        
        uint256 pendingRewards = calculateRewards(user);
        
        if (pendingRewards > 0) {
            // Graceful payout: pay what's available if insufficient
            uint256 availableRewards = equorumToken.balanceOf(address(this)) - totalStaked;
            if (pendingRewards > availableRewards) {
                pendingRewards = availableRewards;
            }
            
            // EFFECTS: Update state BEFORE interaction
            userStake.lastClaimTime = block.timestamp;
            totalRewardsPaid += pendingRewards;
            
            // INTERACTIONS: External call LAST
            if (pendingRewards > 0) {
                if (!equorumToken.transfer(user, pendingRewards)) revert TransferFailed();
                emit RewardsClaimed(user, pendingRewards);
            }
        }
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Calculates pending rewards for a user
     * @param user Address of the user
     * @return uint256 Amount of pending rewards
     * @dev Rewards = (amount * APY * duration) / (denominator * seconds_per_year)
     */
    function calculateRewards(address user) public view returns (uint256) {
        Stake memory userStake = stakes[user];
        
        if (userStake.amount == 0) {
            return 0;
        }
        
        uint256 stakingDuration = block.timestamp - userStake.lastClaimTime;
        
        // Rewards = (amount * currentAPY * duration) / (denominator * seconds_per_year)
        uint256 rewards = (userStake.amount * currentAPY * stakingDuration) / 
                         (APY_DENOMINATOR * SECONDS_PER_YEAR);
        
        return rewards;
    }
    
    /**
     * @notice Returns complete stake information for a user
     * @param user Address of the user
     * @return amount Amount staked
     * @return startTime When the stake started
     * @return lastClaimTime Last reward claim time
     * @return cooldownStart Cooldown start time (0 if not started)
     * @return pendingRewards Pending rewards to claim
     * @return canUnstake Whether user can unstake now
     */
    function getStakeInfo(address user) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 lastClaimTime,
        uint256 cooldownStart,
        uint256 pendingRewards,
        bool canUnstake
    ) {
        Stake memory userStake = stakes[user];
        
        amount = userStake.amount;
        startTime = userStake.startTime;
        lastClaimTime = userStake.lastClaimTime;
        cooldownStart = userStake.cooldownStart;
        pendingRewards = calculateRewards(user);
        canUnstake = cooldownStart > 0 && 
                     block.timestamp >= cooldownStart + COOLDOWN_PERIOD;
    }
    
    /**
     * @notice Returns general staking statistics
     * @return _totalStaked Total amount staked by all users
     * @return _totalRewardsPaid Total rewards paid out
     * @return _availableRewards Available rewards in contract
     * @return _apy Current APY rate
     */
    function getStats() external view returns (
        uint256 _totalStaked,
        uint256 _totalRewardsPaid,
        uint256 _availableRewards,
        uint256 _apy
    ) {
        _totalStaked = totalStaked;
        _totalRewardsPaid = totalRewardsPaid;
        _availableRewards = equorumToken.balanceOf(address(this)) - totalStaked;
        _apy = currentAPY;
    }
    
    /**
     * @notice Returns current utilization and next adjustment time
     * @return utilization Current pool utilization (base 10000)
     * @return nextAdjustment Timestamp of next APY adjustment
     * @return canAdjust Whether APY can be adjusted now
     */
    function getUtilizationInfo() external view returns (
        uint256 utilization,
        uint256 nextAdjustment,
        bool canAdjust
    ) {
        utilization = totalStaked > 0 ? (totalStaked * APY_DENOMINATOR) / STAKING_CAP : 0;
        nextAdjustment = lastAdjustment + ADJUSTMENT_PERIOD;
        canAdjust = block.timestamp >= nextAdjustment;
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @notice Adjusts APY based on current utilization (like central bank)
     * @dev Can be called by anyone after 30-day period
     * @dev APY increases when utilization is low (incentivize staking)
     * @dev APY decreases when utilization is high (control inflation)
     */
    function adjustAPY() external {
        if (block.timestamp < lastAdjustment + ADJUSTMENT_PERIOD) revert AdjustmentPeriodNotElapsed();
        
        // Calculate utilization (base 10000)
        uint256 utilization = totalStaked > 0 ? (totalStaked * APY_DENOMINATOR) / STAKING_CAP : 0;
        
        // Adjust APY based on utilization (like central bank regulating interest rates)
        if (utilization <= LOW_UTIL_THRESHOLD) {
            // Low utilization (<25%): Increase APY to incentivize staking
            currentAPY = APY_MAX; // 3.5%
        } else if (utilization >= HIGH_UTIL_THRESHOLD) {
            // High utilization (>75%): Decrease APY to control inflation
            currentAPY = APY_MIN; // 1.0%
        } else {
            // Medium utilization (25-75%): Use base APY
            currentAPY = APY_BASE; // 2.5%
        }
        
        lastAdjustment = block.timestamp;
        
        emit APYAdjusted(currentAPY, utilization, block.timestamp);
    }
    
    /**
     * @notice Pauses staking operations (emergency only)
     * @dev Only owner can pause
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Resumes staking operations
     * @dev Only owner can unpause
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Emergency withdrawal (no cooldown, no rewards)
     * @dev Only available when contract is paused
     * @dev Use only in critical emergency situations
     */
    function emergencyWithdraw() external nonReentrant whenPaused {
        Stake storage userStake = stakes[msg.sender];
        
        if (userStake.amount == 0) revert NoStakeFound();
        
        uint256 amount = userStake.amount;
        
        // EFFECTS: Update state BEFORE interaction
        delete stakes[msg.sender];
        totalStaked -= amount;
        
        // INTERACTIONS: External call LAST
        if (!equorumToken.transfer(msg.sender, amount)) revert TransferFailed();
        
        emit EmergencyWithdraw(msg.sender, amount);
    }
}
