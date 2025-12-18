// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title EquorumToken
 * @notice Main ERC20 token for the Equorum ecosystem
 * @dev Optimized for Arbitrum L2 with efficient storage and gas patterns
 * 
 * FEATURES:
 * - Fixed supply: 48,000,000 EQM
 * - Automatic distribution on deployment
 * - Pausable for emergencies (circuit breaker)
 * - Blacklist functionality for security
 * - Non-upgradeable (no proxy pattern)
 * 
 * ADMIN CONTROLS (TRANSPARENCY):
 * - Owner can pause/unpause transfers (emergency only)
 * - Owner can blacklist/unblacklist addresses (malicious actors)
 * - Owner should be a Gnosis Safe multisig (2/3 or 3/5)
 * - After full configuration, owner can renounceOwnership() for true immutability
 * - All admin actions emit events for transparency
 * 
 * RECOMMENDED SETUP:
 * - Deploy with owner = Gnosis Safe multisig
 * - Configure all contracts via setters
 * - Optionally renounceOwnership() after configuration
 * 
 * ARBITRUM L2 OPTIMIZATIONS:
 * - Compact storage layout
 * - Minimal cross-contract calls
 * - Efficient event emission
 * - Gas-optimized transfers
 */
contract EquorumToken is ERC20, Ownable, Pausable {
    
    // ========== CUSTOM ERRORS ==========
    /// @notice Thrown when address is zero or invalid
    error InvalidAddress();
    /// @notice Thrown when contract address is already set
    error AlreadySet();
    /// @notice Thrown when address is already blacklisted
    error AlreadyBlacklisted();
    /// @notice Thrown when address is not blacklisted
    error NotBlacklisted();
    /// @notice Thrown when sender is blacklisted
    error SenderBlacklisted();
    /// @notice Thrown when recipient is blacklisted
    error RecipientBlacklisted();
    /// @notice Thrown when trying to blacklist a protected address
    error CannotBlacklistProtected();
    
    // ========== CONSTANTS ==========
    /// @notice Total fixed supply - 48 million tokens
    uint256 public constant TOTAL_SUPPLY = 48_000_000 * 1e18;
    
    /// @notice Token allocations (percentages of total supply)
    /// @dev These constants are used for one-time distribution only
    uint256 public constant STAKING_ALLOCATION = 38_000_000 * 1e18;  // 79.17% - Staking rewards
    uint256 public constant ICO_ALLOCATION = 4_000_000 * 1e18;       // 8.33%  - Initial Coin Offering
    uint256 public constant GENESIS_ALLOCATION = 3_000_000 * 1e18;   // 6.25%  - Genesis vesting (72 months)
    uint256 public constant FAUCET_ALLOCATION = 2_256_000 * 1e18;    // 4.70%  - Faucet distribution
    uint256 public constant LIQUIDITY_ALLOCATION = 500_000 * 1e18;   // 1.04%  - Initial liquidity
    uint256 public constant FOUNDATION_ALLOCATION = 122_000 * 1e18;  // 0.25%  - Foundation reserve
    uint256 public constant CORPORATE_ALLOCATION = 122_000 * 1e18;   // 0.25%  - Corporate reserve
    
    // ========== STATE VARIABLES ==========
    /// @notice Blacklist mapping for blocked addresses
    /// @dev Used for emergency blocking of malicious actors
    mapping(address => bool) public blacklisted;
    
    /// @notice Contract addresses for token distribution
    /// @dev Set once during initialization, cannot be changed after
    address public stakingContract;      // Staking rewards contract
    address public faucetContract;       // Faucet distribution contract
    address public reserveManager;       // Reserve management contract (Foundation + Corporate)
    address public genesisVesting;       // Genesis vesting contract
    address public icoContract;          // ICO contract (set later when ready)
    
    // ========== EVENTS ==========
    event Blacklisted(address indexed account);
    event Unblacklisted(address indexed account);
    event StakingContractSet(address indexed stakingContract);
    event FaucetContractSet(address indexed faucetContract);
    event ReserveManagerSet(address indexed reserveManager);
    event GenesisVestingSet(address indexed genesisVesting);
    event ICOContractSet(address indexed icoContract);
    
    // ========== CONSTRUCTOR ==========
    /**
     * @notice Initializes the token and distributes the supply
     * @param _liquidityAddress Address for initial liquidity
     * @dev Mints total supply and performs immediate distribution of liquidity only
     * @dev Remaining tokens stay in contract for later allocation via setter functions
     * @dev ICO allocation (4M tokens) remains in contract until setICOContract is called
     */
    constructor(
        address _liquidityAddress
    ) ERC20("Equorum", "EQM") {
        if (_liquidityAddress == address(0)) revert InvalidAddress();
        
        // Mint total supply to contract
        _mint(address(this), TOTAL_SUPPLY);
        
        // Immediate distribution (liquidity only)
        _transfer(address(this), _liquidityAddress, LIQUIDITY_ALLOCATION);
        
        // Remaining tokens stay in contract for allocation:
        // - Staking: 38M (via setStakingContract)
        // - Faucet: 2.256M (via setFaucetContract)
        // - Reserve: 244K (via setReserveManager - includes Foundation + Corporate)
        // - Genesis: 3M (via setGenesisVesting)
        // - ICO: 4M (via setICOContract - when ready to launch ICO)
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @notice Sets the staking contract address (one-time only)
     * @param _stakingContract Address of the staking contract
     * @dev Transfers STAKING_ALLOCATION tokens to the staking contract
     * @dev Can only be called once, cannot be changed after
     */
    function setStakingContract(address _stakingContract) external onlyOwner {
        if (_stakingContract == address(0)) revert InvalidAddress();
        if (stakingContract != address(0)) revert AlreadySet();
        
        stakingContract = _stakingContract;
        _transfer(address(this), _stakingContract, STAKING_ALLOCATION);
        
        emit StakingContractSet(_stakingContract);
    }
    
    /**
     * @notice Sets the faucet contract address (one-time only)
     * @param _faucetContract Address of the faucet contract
     * @dev Transfers FAUCET_ALLOCATION tokens to the faucet contract
     * @dev Can only be called once, cannot be changed after
     */
    function setFaucetContract(address _faucetContract) external onlyOwner {
        if (_faucetContract == address(0)) revert InvalidAddress();
        if (faucetContract != address(0)) revert AlreadySet();
        
        faucetContract = _faucetContract;
        _transfer(address(this), _faucetContract, FAUCET_ALLOCATION);
        
        emit FaucetContractSet(_faucetContract);
    }
    
    /**
     * @notice Sets the reserve manager contract (one-time only)
     * @param _reserveManager Address of the reserve manager contract
     * @dev Transfers FOUNDATION_ALLOCATION + CORPORATE_ALLOCATION tokens (244K total)
     * @dev Can only be called once, cannot be changed after
     */
    function setReserveManager(address _reserveManager) external onlyOwner {
        if (_reserveManager == address(0)) revert InvalidAddress();
        if (reserveManager != address(0)) revert AlreadySet();
        
        reserveManager = _reserveManager;
        uint256 totalReserve = FOUNDATION_ALLOCATION + CORPORATE_ALLOCATION;
        _transfer(address(this), _reserveManager, totalReserve);
        
        emit ReserveManagerSet(_reserveManager);
    }
    
    /**
     * @notice Sets the Genesis vesting contract address (one-time only)
     * @param _genesisVesting Address of the Genesis vesting contract
     * @dev Transfers GENESIS_ALLOCATION tokens to the vesting contract
     * @dev Can only be called once, cannot be changed after
     */
    function setGenesisVesting(address _genesisVesting) external onlyOwner {
        if (_genesisVesting == address(0)) revert InvalidAddress();
        if (genesisVesting != address(0)) revert AlreadySet();
        
        genesisVesting = _genesisVesting;
        _transfer(address(this), _genesisVesting, GENESIS_ALLOCATION);
        
        emit GenesisVestingSet(_genesisVesting);
    }
    
    /**
     * @notice Sets the ICO contract address (one-time only)
     * @param _icoContract Address of the ICO contract
     * @dev Transfers ICO_ALLOCATION tokens (4M) to the ICO contract
     * @dev Can only be called once, cannot be changed after
     * @dev Should only be called when ready to launch ICO (Phase 2/3)
     */
    function setICOContract(address _icoContract) external onlyOwner {
        if (_icoContract == address(0)) revert InvalidAddress();
        if (icoContract != address(0)) revert AlreadySet();
        
        icoContract = _icoContract;
        _transfer(address(this), _icoContract, ICO_ALLOCATION);
        
        emit ICOContractSet(_icoContract);
    }
    
    /**
     * @notice Adds an address to the blacklist
     * @param account Address to be blacklisted
     * @dev Blacklisted addresses cannot send or receive tokens
     * @dev Use only for emergency situations (e.g., malicious actors)
     * @dev Cannot blacklist this contract or zero address
     */
    function blacklist(address account) external onlyOwner {
        if (account == address(0)) revert InvalidAddress();
        if (account == address(this)) revert CannotBlacklistProtected();
        if (blacklisted[account]) revert AlreadyBlacklisted();
        
        blacklisted[account] = true;
        emit Blacklisted(account);
    }
    
    /**
     * @notice Removes an address from the blacklist
     * @param account Address to be unblacklisted
     * @dev Restores transfer capabilities for the address
     */
    function unblacklist(address account) external onlyOwner {
        if (!blacklisted[account]) revert NotBlacklisted();
        
        blacklisted[account] = false;
        emit Unblacklisted(account);
    }
    
    /**
     * @notice Pauses all token transfers (emergency only)
     * @dev Use in case of critical security issues
     * @dev Only owner can pause
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Resumes token transfers
     * @dev Only owner can unpause
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ========== OVERRIDES ==========
    
    /**
     * @notice Hook that is called before any token transfer
     * @dev Checks for paused state and blacklisted addresses
     * @dev Optimized for Arbitrum L2 with minimal gas overhead
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        if (blacklisted[from]) revert SenderBlacklisted();
        if (blacklisted[to]) revert RecipientBlacklisted();
        
        super._beforeTokenTransfer(from, to, amount);
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Checks if all contracts have been configured
     * @return bool True if all distribution addresses are set
     * @dev Used to verify complete initialization before launch
     */
    function isFullyConfigured() external view returns (bool) {
        return stakingContract != address(0) &&
               faucetContract != address(0) &&
               reserveManager != address(0) &&
               genesisVesting != address(0);
        // Note: icoContract is NOT required for initial configuration
        // It will be set later when ready to launch ICO
    }
    
    /**
     * @notice Returns distribution information for all allocations
     * @return stakingBalance Balance in staking contract
     * @return faucetBalance Balance in faucet contract
     * @return reserveBalance Balance in reserve manager (Foundation + Corporate)
     * @return genesisBalance Balance in genesis vesting
     * @return remainingInContract Balance remaining in token contract
     * @dev Useful for monitoring token distribution status
     */
    function getDistributionInfo() external view returns (
        uint256 stakingBalance,
        uint256 faucetBalance,
        uint256 reserveBalance,
        uint256 genesisBalance,
        uint256 remainingInContract
    ) {
        stakingBalance = stakingContract != address(0) ? balanceOf(stakingContract) : 0;
        faucetBalance = faucetContract != address(0) ? balanceOf(faucetContract) : 0;
        reserveBalance = reserveManager != address(0) ? balanceOf(reserveManager) : 0;
        genesisBalance = genesisVesting != address(0) ? balanceOf(genesisVesting) : 0;
        remainingInContract = balanceOf(address(this));
    }
}
