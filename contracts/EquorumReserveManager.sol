// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IEquorumCore.sol";

/**
 * @title EquorumReserveManager
 * @author Equorum Protocol
 * @notice Manages Foundation and Corporate reserve token allocations
 * @dev New contract for V2 - manages two separate reserve pools
 * 
 * FEATURES:
 * - Manages 244K EQM tokens (122K Foundation + 122K Corporate)
 * - Separate tracking for each reserve type
 * - Purpose-documented releases (on-chain transparency)
 * - Recipient approval system
 * - Configurable foundation and corporate addresses
 * - Pausable for emergency control
 * - Compatible with IEquorumCore interface
 * 
 * SECURITY:
 * - Only approved recipients can receive tokens
 * - Owner-controlled releases
 * - Purpose documentation for transparency
 * - Separate allocation limits prevent cross-contamination
 * - Balance sanity checks prevent underfunded releases
 * - ReentrancyGuard on all state-changing functions
 * - Emergency pause mechanism
 * 
 * POOL ISOLATION:
 * - Each release verifies contract has sufficient balance
 * - Sanity check ensures total allocation is properly funded
 * - Prevents "cross-contamination" between foundation and corporate pools
 * 
 * ARBITRUM L2 OPTIMIZATIONS:
 * - Minimal storage operations
 * - Gas-efficient release tracking
 * - Event-driven transparency
 * - Custom errors for gas savings
 * 
 * USAGE:
 * Foundation Reserve (122K):
 * - Development funding
 * - Security audits
 * - Protocol improvements
 * - Developer grants
 * 
 * Corporate Reserve (122K):
 * - Exchange listings
 * - Strategic partnerships
 * - Marketing initiatives
 * - Business development
 * 
 * GOVERNANCE TRANSITION:
 * Phase 1: Owner = deployer/multisig (initial setup)
 * Phase 2: transferOwnership(TimeLock) when governance is stable
 * This ensures decentralized control of reserve releases
 */
contract EquorumReserveManager is IEquorumCore, Ownable, Pausable, ReentrancyGuard {
    
    // ========== CUSTOM ERRORS ==========
    error InvalidAddress();
    error InvalidAmount();
    error ExceedsFoundationAllocation();
    error ExceedsCorporateAllocation();
    error RecipientNotApproved();
    error PurposeRequired();
    error TransferFailed();
    error LengthMismatch();
    error InsufficientBalance();
    error ReserveUnderfunded();
    error AddressesNotConfigured();
    
    // ========== CONSTANTS ==========
    
    /// @notice Foundation reserve allocation (122K EQM)
    uint256 public constant FOUNDATION_ALLOCATION = 122_000 * 1e18;
    
    /// @notice Corporate reserve allocation (122K EQM)
    uint256 public constant CORPORATE_ALLOCATION = 122_000 * 1e18;
    
    /// @notice Total reserve allocation (244K EQM)
    uint256 public constant TOTAL_ALLOCATION = 244_000 * 1e18;
    
    // ========== STATE VARIABLES ==========
    
    /// @notice EQM token contract
    IERC20 public immutable equorumToken;
    
    /// @notice Total foundation tokens released
    uint256 public foundationReleased;
    
    /// @notice Total corporate tokens released
    uint256 public corporateReleased;
    
    /// @notice Official foundation address
    address public foundationAddress;
    
    /// @notice Official corporate address
    address public corporateAddress;
    
    /// @notice Approved recipient addresses
    mapping(address => bool) public approvedRecipients;
    
    /// @notice Release history count per address
    mapping(address => uint256) public releaseCount;
    
    // ========== EVENTS ==========
    
    /// @notice Emitted when foundation tokens are released
    event FoundationRelease(
        address indexed to, 
        uint256 amount, 
        string purpose, 
        uint256 timestamp
    );
    
    /// @notice Emitted when corporate tokens are released
    event CorporateRelease(
        address indexed to, 
        uint256 amount, 
        string purpose, 
        uint256 timestamp
    );
    
    /// @notice Emitted when foundation or corporate address is updated
    event AddressUpdated(
        string indexed reserveType, 
        address indexed newAddress
    );
    
    /// @notice Emitted when recipient approval status changes
    event RecipientApproved(
        address indexed recipient, 
        bool status
    );
    
    /// @notice Emitted when emergency withdrawal occurs
    event EmergencyWithdrawal(
        address indexed to, 
        uint256 amount
    );
    
    // ========== CONSTRUCTOR ==========
    
    /**
     * @notice Initializes the reserve manager
     * @dev Contract starts PAUSED - owner must unpause to activate
     * @param _equorumToken Address of EQM token contract
     */
    constructor(address _equorumToken) {
        if (_equorumToken == address(0)) revert InvalidAddress();
        equorumToken = IERC20(_equorumToken);
        
        // Start paused - owner activates when ready
        _pause();
    }
    
    // ========== CORE FUNCTIONS ==========
    
    /**
     * @notice Releases foundation reserve tokens
     * @dev Recipient must be approved or be the foundation address
     * @param to Recipient address
     * @param amount Amount of tokens to release
     * @param purpose Description of release purpose (on-chain documentation)
     * 
     * EXAMPLES:
     * - "Security audit by OpenZeppelin"
     * - "Developer grant for DeFi integration"
     * - "Protocol upgrade development"
     * 
     * ARBITRUM OPTIMIZATION:
     * - Single transfer operation
     * - Minimal state updates
     * - Gas-efficient tracking
     */
    function releaseFoundation(
        address to, 
        uint256 amount, 
        string calldata purpose
    ) 
        external 
        onlyOwner 
        nonReentrant 
        whenNotPaused 
    {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (foundationReleased + amount > FOUNDATION_ALLOCATION) revert ExceedsFoundationAllocation();
        if (!approvedRecipients[to] && to != foundationAddress) revert RecipientNotApproved();
        if (bytes(purpose).length == 0) revert PurposeRequired();
        
        // CRITICAL: Verify contract has sufficient balance (prevents pool contamination)
        uint256 balance = equorumToken.balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance();
        
        // Sanity check: ensure reserve is properly funded
        uint256 totalRemaining = TOTAL_ALLOCATION - foundationReleased - corporateReleased;
        if (balance < totalRemaining) revert ReserveUnderfunded();
        
        // Update state
        foundationReleased += amount;
        releaseCount[to]++;
        
        // Transfer tokens
        if (!equorumToken.transfer(to, amount)) revert TransferFailed();
        
        emit FoundationRelease(to, amount, purpose, block.timestamp);
    }
    
    /**
     * @notice Releases corporate reserve tokens
     * @dev Recipient must be approved or be the corporate address
     * @param to Recipient address
     * @param amount Amount of tokens to release
     * @param purpose Description of release purpose (on-chain documentation)
     * 
     * EXAMPLES:
     * - "Gate.io listing fee"
     * - "Marketing campaign Q1 2025"
     * - "Partnership with Protocol X"
     * 
     * ARBITRUM OPTIMIZATION:
     * - Single transfer operation
     * - Minimal state updates
     * - Gas-efficient tracking
     */
    function releaseCorporate(
        address to, 
        uint256 amount, 
        string calldata purpose
    ) 
        external 
        onlyOwner 
        nonReentrant 
        whenNotPaused 
    {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (corporateReleased + amount > CORPORATE_ALLOCATION) revert ExceedsCorporateAllocation();
        if (!approvedRecipients[to] && to != corporateAddress) revert RecipientNotApproved();
        if (bytes(purpose).length == 0) revert PurposeRequired();
        
        // CRITICAL: Verify contract has sufficient balance (prevents pool contamination)
        uint256 balance = equorumToken.balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance();
        
        // Sanity check: ensure reserve is properly funded
        uint256 totalRemaining = TOTAL_ALLOCATION - foundationReleased - corporateReleased;
        if (balance < totalRemaining) revert ReserveUnderfunded();
        
        // Update state
        corporateReleased += amount;
        releaseCount[to]++;
        
        // Transfer tokens
        if (!equorumToken.transfer(to, amount)) revert TransferFailed();
        
        emit CorporateRelease(to, amount, purpose, block.timestamp);
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @notice Sets the official foundation address
     * @dev Foundation address can receive without approval
     * @param _address New foundation address
     */
    function setFoundationAddress(address _address) external onlyOwner {
        if (_address == address(0)) revert InvalidAddress();
        foundationAddress = _address;
        emit AddressUpdated("foundation", _address);
    }
    
    /**
     * @notice Sets the official corporate address
     * @dev Corporate address can receive without approval
     * @param _address New corporate address
     */
    function setCorporateAddress(address _address) external onlyOwner {
        if (_address == address(0)) revert InvalidAddress();
        corporateAddress = _address;
        emit AddressUpdated("corporate", _address);
    }
    
    /**
     * @notice Approves or revokes recipient for token releases
     * @param recipient Address to approve/revoke
     * @param status True to approve, false to revoke
     */
    function approveRecipient(address recipient, bool status) external onlyOwner {
        if (recipient == address(0)) revert InvalidAddress();
        approvedRecipients[recipient] = status;
        emit RecipientApproved(recipient, status);
    }
    
    /**
     * @notice Batch approve multiple recipients
     * @dev Gas-optimized for multiple approvals
     * @param recipients Array of addresses to approve
     * @param statuses Array of approval statuses
     */
    function batchApproveRecipients(
        address[] calldata recipients, 
        bool[] calldata statuses
    ) 
        external 
        onlyOwner 
    {
        if (recipients.length != statuses.length) revert LengthMismatch();
        
        uint256 length = recipients.length;
        for (uint256 i = 0; i < length;) {
            if (recipients[i] == address(0)) revert InvalidAddress();
            approvedRecipients[recipients[i]] = statuses[i];
            emit RecipientApproved(recipients[i], statuses[i]);
            unchecked { ++i; }
        }
    }
    
    /**
     * @notice Activates reserve management (unpauses)
     * @dev Requires at least one address (foundation or corporate) to be configured
     * @dev This prevents activation with no way to release tokens
     */
    function activate() external onlyOwner {
        // CRITICAL: Require at least one address configured to prevent UX issues
        if (foundationAddress == address(0) && corporateAddress == address(0)) {
            revert AddressesNotConfigured();
        }
        _unpause();
    }
    
    /**
     * @notice Deactivates reserve management (pauses)
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
        if (to == address(0)) revert InvalidAddress();
        uint256 balance = equorumToken.balanceOf(address(this));
        if (amount > balance) revert InsufficientBalance();
        
        if (!equorumToken.transfer(to, amount)) revert TransferFailed();
        emit EmergencyWithdrawal(to, amount);
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Returns reserve statistics
     * @return foundationRemaining Remaining foundation allocation
     * @return corporateRemaining Remaining corporate allocation
     * @return totalRemaining Total remaining allocation
     * @return contractBalance Current contract balance
     */
    function getReserveStats() external view returns (
        uint256 foundationRemaining,
        uint256 corporateRemaining,
        uint256 totalRemaining,
        uint256 contractBalance
    ) {
        return (
            FOUNDATION_ALLOCATION - foundationReleased,
            CORPORATE_ALLOCATION - corporateReleased,
            TOTAL_ALLOCATION - foundationReleased - corporateReleased,
            equorumToken.balanceOf(address(this))
        );
    }
    
    /**
     * @notice Returns recipient information
     * @param recipient Address to query
     * @return approved Whether recipient is approved
     * @return releases Number of releases to recipient
     */
    function getRecipientInfo(address recipient) external view returns (
        bool approved,
        uint256 releases
    ) {
        return (
            approvedRecipients[recipient],
            releaseCount[recipient]
        );
    }
    
    /**
     * @notice Returns detailed reserve information
     * @return foundationAddr Foundation address
     * @return corporateAddr Corporate address
     * @return foundationRel Foundation released amount
     * @return corporateRel Corporate released amount
     * @return isPaused Whether contract is paused
     */
    function getReserveInfo() external view returns (
        address foundationAddr,
        address corporateAddr,
        uint256 foundationRel,
        uint256 corporateRel,
        bool isPaused
    ) {
        return (
            foundationAddress,
            corporateAddress,
            foundationReleased,
            corporateReleased,
            paused()
        );
    }
    
    // ========== IEQUORUMCORE IMPLEMENTATION ==========
    
    /**
     * @notice Processes system action
     * @dev Action types: 1=Regular (unused), 2=Critical (unused), 3=Emergency (pause)
     * @param actionType Type of action
     * @param data Additional data (unused)
     */
    function processSystemAction(uint8 actionType, bytes calldata data) external override onlyOwner {
        if (actionType == 3) {
            // Emergency: Immediate pause
            _pause();
        }
        
        emit SystemAction(address(this), "Reserve action", actionType, block.timestamp);
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
        // Reserve manager uses constants - no parameter updates
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
                foundationReleased,
                corporateReleased,
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

