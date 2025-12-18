// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title EquorumGenesisVesting
 * @notice IMMUTABLE vesting contract for Genesis allocation
 * @dev Optimized for Arbitrum L2 with efficient storage and gas patterns
 * 
 * SECURITY & IMMUTABILITY:
 * - 100% IMMUTABLE - Cannot be changed after deployment
 * - NO admin functions - No one can stop or modify vesting
 * - NO ownership transfer - Genesis address is fixed forever
 * - NO emergency withdrawal - True vesting guarantee
 * - Automatic vesting schedule - Guaranteed 72-month release
 * - Protected against fraud - All parameters are immutable constants
 * 
 * GENESIS RESTRICTIONS (ANTI-MANIPULATION):
 * - Genesis CANNOT vote in governance
 * - Genesis CANNOT stake tokens
 * - Genesis ONLY receives vested tokens as payment for development
 * 
 * FEATURES:
 * - 3M tokens vested over 72 months (6 years)
 * - Monthly release: 41,666.66 EQM (automatic)
 * - Automatic catch-up if months are missed
 * - Works seamlessly after vesting completion (72+ months)
 * - isFunded() view to verify contract has tokens before release
 * 
 * RECOMMENDED SETUP:
 * - Use Gnosis Safe multisig (2/3 or 3/5) as genesisAddress
 * - Store keys in hardware wallets (Ledger/Trezor)
 * - Distribute signers across different locations
 * - This eliminates single point of failure
 * 
 * ARBITRUM L2 OPTIMIZATIONS:
 * - Immutable variables for gas savings
 * - Compact storage layout
 * - Efficient timestamp calculations
 */
contract EquorumGenesisVesting is ReentrancyGuard {
    
    // ========== CUSTOM ERRORS ==========
    /// @notice Thrown when caller is not the genesis address
    error OnlyGenesis();
    /// @notice Thrown when there are no tokens available to release
    error NoTokensToRelease();
    /// @notice Thrown when token transfer fails
    error TransferFailed();
    /// @notice Thrown when address is zero
    error InvalidAddress();
    
    // ========== CONSTANTS ==========
    /// @notice Total Genesis allocation (3 million tokens)
    uint256 public constant GENESIS_ALLOCATION = 3_000_000 * 1e18;
    
    /// @notice Vesting duration in months
    uint256 public constant VESTING_DURATION = 72;
    
    /// @notice Monthly release amount (3M / 72 months)
    uint256 public constant MONTHLY_RELEASE = 41_666_666666666666666666; // 41,666.66 tokens
    
    /// @notice Seconds in a month (30 days)
    uint256 public constant SECONDS_PER_MONTH = 30 days;
    
    // ========== STATE VARIABLES ==========
    /// @notice Equorum token contract (immutable for gas savings)
    IERC20 public immutable equorumToken;
    
    /// @notice Genesis beneficiary address (immutable)
    address public immutable genesisAddress;
    
    /// @notice Vesting start timestamp (immutable)
    uint256 public immutable releaseStartTime;
    
    /// @notice Total tokens released so far
    uint256 public releasedTokens;
    
    /// @notice Last release timestamp (for tracking)
    uint256 public lastReleaseTimestamp;
    
    // ========== EVENTS ==========
    event TokensReleased(
        address indexed beneficiary,
        uint256 amount,
        uint256 monthsPassed,
        uint256 timestamp
    );
    
    // ========== MODIFIERS ==========
    modifier onlyGenesis() {
        if (msg.sender != genesisAddress) revert OnlyGenesis();
        _;
    }
    
    // ========== CONSTRUCTOR ==========
    /**
     * @notice Initializes the vesting contract
     * @param _equorumToken Address of the Equorum token
     * @param _genesisAddress Address of the Genesis beneficiary
     * @dev Does NOT require tokens at deploy time - use isFunded() to verify before release
     */
    constructor(address _equorumToken, address _genesisAddress) {
        if (_equorumToken == address(0)) revert InvalidAddress();
        if (_genesisAddress == address(0)) revert InvalidAddress();
        
        equorumToken = IERC20(_equorumToken);
        genesisAddress = _genesisAddress;
        releaseStartTime = block.timestamp;
    }
    
    // ========== VESTING FUNCTIONS ==========

    /**
     * @notice Releases all vested tokens available up to current time
     * @dev Can be called anytime by Genesis address
     * @dev Automatically catches up if multiple months were missed
     * @dev Protected against double claims by releasedTokens tracking
     */
    function release() external nonReentrant onlyGenesis {
        uint256 releasable = calculateReleasableAmount();
        if (releasable == 0) revert NoTokensToRelease();
        
        uint256 monthsPassed = (block.timestamp - releaseStartTime) / SECONDS_PER_MONTH;
        if (monthsPassed > VESTING_DURATION) {
            monthsPassed = VESTING_DURATION;
        }
        
        releasedTokens += releasable;
        lastReleaseTimestamp = block.timestamp;
        
        if (!equorumToken.transfer(genesisAddress, releasable)) revert TransferFailed();
        
        emit TokensReleased(genesisAddress, releasable, monthsPassed, block.timestamp);
    }
    
    /**
     * @notice Calculates the amount of tokens that can be released
     * @return uint256 Amount of releasable tokens
     * @dev Returns 0 if vesting hasn't started
     * @dev Ensures total released never exceeds GENESIS_ALLOCATION
     */
    function calculateReleasableAmount() public view returns (uint256) {
        if (block.timestamp < releaseStartTime) {
            return 0;
        }
        
        uint256 elapsedMonths = (block.timestamp - releaseStartTime) / SECONDS_PER_MONTH;
        
        // If vesting is complete, release remaining tokens
        if (elapsedMonths >= VESTING_DURATION) {
            return GENESIS_ALLOCATION - releasedTokens;
        }
        
        // Calculate total that should be released by now
        uint256 totalToRelease = elapsedMonths * MONTHLY_RELEASE;
        
        // Calculate claimable amount
        uint256 claimable = totalToRelease - releasedTokens;
        
        // Ensure we never exceed total allocation
        uint256 remaining = GENESIS_ALLOCATION - releasedTokens;
        return claimable > remaining ? remaining : claimable;
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Returns complete vesting information
     * @return total Total allocation
     * @return released Tokens already released
     * @return remaining Tokens still locked
     * @return monthlyAmount Monthly release amount
     * @return nextRelease Amount available for next release
     * @return monthsElapsed Months elapsed since start
     * @return monthsRemaining Months remaining in vesting
     */
    function getVestingInfo() external view returns (
        uint256 total,
        uint256 released,
        uint256 remaining,
        uint256 monthlyAmount,
        uint256 nextRelease,
        uint256 monthsElapsed,
        uint256 monthsRemaining
    ) {
        total = GENESIS_ALLOCATION;
        released = releasedTokens;
        remaining = GENESIS_ALLOCATION - releasedTokens;
        monthlyAmount = MONTHLY_RELEASE;
        nextRelease = calculateReleasableAmount();
        
        monthsElapsed = (block.timestamp - releaseStartTime) / SECONDS_PER_MONTH;
        if (monthsElapsed > VESTING_DURATION) {
            monthsElapsed = VESTING_DURATION;
        }
        
        monthsRemaining = monthsElapsed >= VESTING_DURATION 
            ? 0 
            : VESTING_DURATION - monthsElapsed;
    }
    
    /**
     * @notice Returns the current contract token balance
     * @return uint256 Current balance of tokens in contract
     * @dev Useful for monitoring and verification
     */
    function getContractBalance() external view returns (uint256) {
        return equorumToken.balanceOf(address(this));
    }
    
    /**
     * @notice Checks if contract has sufficient tokens for vesting
     * @return bool True if contract has at least GENESIS_ALLOCATION tokens
     * @dev Call this off-chain before first release to verify funding
     */
    function isFunded() external view returns (bool) {
        return equorumToken.balanceOf(address(this)) >= GENESIS_ALLOCATION - releasedTokens;
    }
}
