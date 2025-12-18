// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title EquorumICO
 * @notice ICO contract for Equorum token with private and public sale phases
 * @dev Optimized for Arbitrum L2 with vesting and security features
 * 
 * FEATURES:
 * - Two-phase sale: Private (20%) and Public (80%)
 * - Vesting schedules for both phases
 * - Whitelist for private sale
 * - Per-user purchase limits
 * - Soft/Hard caps
 * - Emergency pause functionality
 * - Refund mechanism if soft cap not reached
 * 
 * ARBITRUM L2 OPTIMIZATIONS:
 * - Compact storage layout
 * - Minimal SLOAD operations
 * - Gas-efficient vesting calculations
 */
contract EquorumICO is Ownable, Pausable, ReentrancyGuard {
    
    // ========== CONSTANTS ==========
    
    /// @notice Total ICO allocation (received from EquorumToken)
    uint256 public constant TOTAL_ALLOCATION = 4_000_000 * 1e18;
    
    /// @notice Private sale allocation (20% of ICO)
    uint256 public constant PRIVATE_SALE_ALLOCATION = 800_000 * 1e18;
    
    /// @notice Public sale allocation (80% of ICO)
    uint256 public constant PUBLIC_SALE_ALLOCATION = 3_200_000 * 1e18;
    
    /// @notice Private sale price: $0.20 per token (0.0001 ETH @ $2000 ETH)
    uint256 public constant PRIVATE_SALE_PRICE = 0.0001 ether;
    
    /// @notice Public sale price: $0.30 per token (50% premium)
    uint256 public constant PUBLIC_SALE_PRICE = 0.00015 ether;
    
    /// @notice Private sale vesting: 3 months cliff + 12 months linear
    uint256 public constant PRIVATE_CLIFF = 90 days;
    uint256 public constant PRIVATE_VESTING_DURATION = 365 days;
    
    /// @notice Public sale vesting: 1 month cliff + 6 months linear
    uint256 public constant PUBLIC_CLIFF = 30 days;
    uint256 public constant PUBLIC_VESTING_DURATION = 180 days;
    
    /// @notice Purchase limits for private sale
    uint256 public constant PRIVATE_MIN_PURCHASE = 0.1 ether;   // ~$200
    uint256 public constant PRIVATE_MAX_PURCHASE = 5 ether;     // ~$10K
    
    /// @notice Purchase limits for public sale
    uint256 public constant PUBLIC_MIN_PURCHASE = 0.01 ether;   // ~$20
    uint256 public constant PUBLIC_MAX_PURCHASE = 1 ether;      // ~$2K
    
    /// @notice Soft and hard caps for public sale
    uint256 public constant SOFT_CAP = 100 ether;   // ~$200K
    uint256 public constant HARD_CAP = 500 ether;   // ~$1M
    
    // ========== ENUMS ==========
    
    enum SalePhase { NOT_STARTED, PRIVATE, PUBLIC, ENDED }
    
    // ========== STRUCTS ==========
    
    /// @notice Vesting information for each investor
    struct VestingInfo {
        uint256 totalAmount;        // Total tokens purchased
        uint256 claimedAmount;      // Tokens already claimed
        uint256 startTime;          // Vesting start time
        uint256 cliffDuration;      // Cliff period
        uint256 vestingDuration;    // Total vesting duration
        bool isPrivateSale;         // True if private sale investor
    }
    
    // ========== STATE VARIABLES ==========
    
    /// @notice EQM token contract
    IERC20 public immutable equorumToken;
    
    /// @notice Current sale phase
    SalePhase public currentPhase;
    
    /// @notice Whitelist for private sale
    mapping(address => bool) public whitelisted;
    
    /// @notice ETH contributed by each investor
    mapping(address => uint256) public contributions;
    
    /// @notice Vesting information for each investor
    mapping(address => VestingInfo) public vestingInfo;
    
    /// @notice Total ETH raised
    uint256 public totalRaised;
    
    /// @notice Total tokens sold
    uint256 public totalTokensSold;
    
    /// @notice Private sale tokens sold
    uint256 public privateSaleTokensSold;
    
    /// @notice Public sale tokens sold
    uint256 public publicSaleTokensSold;
    
    /// @notice Sale start times
    uint256 public privateSaleStartTime;
    uint256 public publicSaleStartTime;
    
    /// @notice Refund enabled if soft cap not reached
    bool public refundEnabled;
    
    // ========== EVENTS ==========
    
    event PrivateSaleStarted(uint256 timestamp);
    event PublicSaleStarted(uint256 timestamp);
    event SaleEnded(uint256 timestamp, uint256 totalRaised, uint256 totalTokensSold);
    event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount, bool isPrivateSale);
    event TokensClaimed(address indexed investor, uint256 amount);
    event WhitelistAdded(address indexed investor);
    event WhitelistRemoved(address indexed investor);
    event RefundClaimed(address indexed investor, uint256 amount);
    event FundsWithdrawn(address indexed owner, uint256 amount);
    
    // ========== CONSTRUCTOR ==========
    
    /**
     * @notice Initialize ICO contract
     * @param _equorumToken Address of EQM token contract
     * @dev Contract starts in NOT_STARTED phase
     */
    constructor(address _equorumToken) {
        require(_equorumToken != address(0), "Invalid token address");
        equorumToken = IERC20(_equorumToken);
        currentPhase = SalePhase.NOT_STARTED;
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @notice Start private sale phase
     * @dev Can only be called once, requires tokens in contract
     */
    function startPrivateSale() external onlyOwner {
        require(currentPhase == SalePhase.NOT_STARTED, "Sale already started");
        require(equorumToken.balanceOf(address(this)) >= TOTAL_ALLOCATION, "Insufficient tokens");
        
        currentPhase = SalePhase.PRIVATE;
        privateSaleStartTime = block.timestamp;
        
        emit PrivateSaleStarted(block.timestamp);
    }
    
    /**
     * @notice Start public sale phase
     * @dev Transitions from private to public sale
     */
    function startPublicSale() external onlyOwner {
        require(currentPhase == SalePhase.PRIVATE, "Private sale not active");
        
        currentPhase = SalePhase.PUBLIC;
        publicSaleStartTime = block.timestamp;
        
        emit PublicSaleStarted(block.timestamp);
    }
    
    /**
     * @notice End the sale
     * @dev Can be called by owner at any time
     */
    function endSale() external onlyOwner {
        require(currentPhase != SalePhase.ENDED, "Sale already ended");
        require(currentPhase != SalePhase.NOT_STARTED, "Sale not started");
        
        currentPhase = SalePhase.ENDED;
        
        // Enable refunds if soft cap not reached
        if (totalRaised < SOFT_CAP) {
            refundEnabled = true;
        }
        
        emit SaleEnded(block.timestamp, totalRaised, totalTokensSold);
    }
    
    /**
     * @notice Add address to private sale whitelist
     * @param investor Address to whitelist
     */
    function addToWhitelist(address investor) external onlyOwner {
        require(investor != address(0), "Invalid address");
        require(!whitelisted[investor], "Already whitelisted");
        
        whitelisted[investor] = true;
        emit WhitelistAdded(investor);
    }
    
    /**
     * @notice Add multiple addresses to whitelist
     * @param investors Array of addresses to whitelist
     */
    function batchAddToWhitelist(address[] calldata investors) external onlyOwner {
        for (uint256 i = 0; i < investors.length; i++) {
            if (investors[i] != address(0) && !whitelisted[investors[i]]) {
                whitelisted[investors[i]] = true;
                emit WhitelistAdded(investors[i]);
            }
        }
    }
    
    /**
     * @notice Remove address from whitelist
     * @param investor Address to remove
     */
    function removeFromWhitelist(address investor) external onlyOwner {
        require(whitelisted[investor], "Not whitelisted");
        
        whitelisted[investor] = false;
        emit WhitelistRemoved(investor);
    }
    
    /**
     * @notice Withdraw raised funds
     * @dev Only available after sale ends and soft cap reached
     */
    function withdrawFunds() external onlyOwner nonReentrant {
        require(currentPhase == SalePhase.ENDED, "Sale not ended");
        require(!refundEnabled, "Refunds enabled");
        require(totalRaised >= SOFT_CAP, "Soft cap not reached");
        
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Transfer failed");
        
        emit FundsWithdrawn(owner(), balance);
    }
    
    /**
     * @notice Withdraw unsold tokens
     * @dev Only available after sale ends
     */
    function withdrawUnsoldTokens() external onlyOwner {
        require(currentPhase == SalePhase.ENDED, "Sale not ended");
        
        uint256 unsold = equorumToken.balanceOf(address(this));
        require(unsold > 0, "No unsold tokens");
        
        // Keep tokens for vesting, withdraw only truly unsold
        uint256 vestedTokens = totalTokensSold;
        uint256 toWithdraw = unsold > vestedTokens ? unsold - vestedTokens : 0;
        
        if (toWithdraw > 0) {
            require(equorumToken.transfer(owner(), toWithdraw), "Transfer failed");
        }
    }
    
    /**
     * @notice Pause purchases (emergency only)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Resume purchases
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ========== PUBLIC FUNCTIONS ==========
    
    /**
     * @notice Purchase tokens with ETH
     * @dev Automatically determines phase and applies limits
     */
    function buyTokens() external payable nonReentrant whenNotPaused {
        require(currentPhase == SalePhase.PRIVATE || currentPhase == SalePhase.PUBLIC, "Sale not active");
        require(msg.value > 0, "Must send ETH");
        
        bool isPrivate = currentPhase == SalePhase.PRIVATE;
        
        // Check whitelist for private sale
        if (isPrivate) {
            require(whitelisted[msg.sender], "Not whitelisted");
        }
        
        // Check purchase limits
        uint256 minPurchase = isPrivate ? PRIVATE_MIN_PURCHASE : PUBLIC_MIN_PURCHASE;
        uint256 maxPurchase = isPrivate ? PRIVATE_MAX_PURCHASE : PUBLIC_MAX_PURCHASE;
        
        require(msg.value >= minPurchase, "Below minimum purchase");
        require(contributions[msg.sender] + msg.value <= maxPurchase, "Exceeds maximum purchase");
        
        // Calculate tokens
        uint256 price = isPrivate ? PRIVATE_SALE_PRICE : PUBLIC_SALE_PRICE;
        uint256 tokenAmount = (msg.value * 1e18) / price;
        
        // Check allocation limits
        if (isPrivate) {
            require(privateSaleTokensSold + tokenAmount <= PRIVATE_SALE_ALLOCATION, "Private sale sold out");
            privateSaleTokensSold += tokenAmount;
        } else {
            require(publicSaleTokensSold + tokenAmount <= PUBLIC_SALE_ALLOCATION, "Public sale sold out");
            require(totalRaised + msg.value <= HARD_CAP, "Hard cap reached");
            publicSaleTokensSold += tokenAmount;
        }
        
        // Update state
        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;
        totalTokensSold += tokenAmount;
        
        // Setup vesting
        VestingInfo storage vesting = vestingInfo[msg.sender];
        if (vesting.totalAmount == 0) {
            // First purchase - initialize vesting
            vesting.startTime = block.timestamp;
            vesting.cliffDuration = isPrivate ? PRIVATE_CLIFF : PUBLIC_CLIFF;
            vesting.vestingDuration = isPrivate ? PRIVATE_VESTING_DURATION : PUBLIC_VESTING_DURATION;
            vesting.isPrivateSale = isPrivate;
        }
        vesting.totalAmount += tokenAmount;
        
        emit TokensPurchased(msg.sender, msg.value, tokenAmount, isPrivate);
    }
    
    /**
     * @notice Claim vested tokens
     * @dev Calculates and transfers available vested tokens
     */
    function claimTokens() external nonReentrant {
        VestingInfo storage vesting = vestingInfo[msg.sender];
        require(vesting.totalAmount > 0, "No tokens to claim");
        
        uint256 claimable = calculateClaimableTokens(msg.sender);
        require(claimable > 0, "No tokens available");
        
        vesting.claimedAmount += claimable;
        require(equorumToken.transfer(msg.sender, claimable), "Transfer failed");
        
        emit TokensClaimed(msg.sender, claimable);
    }
    
    /**
     * @notice Claim refund if soft cap not reached
     * @dev Only available if refunds are enabled
     */
    function claimRefund() external nonReentrant {
        require(refundEnabled, "Refunds not enabled");
        require(contributions[msg.sender] > 0, "No contribution");
        
        uint256 refundAmount = contributions[msg.sender];
        contributions[msg.sender] = 0;
        
        // Clear vesting info
        delete vestingInfo[msg.sender];
        
        (bool success, ) = msg.sender.call{value: refundAmount}("");
        require(success, "Refund failed");
        
        emit RefundClaimed(msg.sender, refundAmount);
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Calculate claimable tokens for an investor
     * @param investor Address to check
     * @return claimable Amount of tokens that can be claimed
     */
    function calculateClaimableTokens(address investor) public view returns (uint256 claimable) {
        VestingInfo memory vesting = vestingInfo[investor];
        
        if (vesting.totalAmount == 0) {
            return 0;
        }
        
        uint256 elapsed = block.timestamp - vesting.startTime;
        
        // Check if cliff has passed
        if (elapsed < vesting.cliffDuration) {
            return 0;
        }
        
        // Calculate vested amount
        uint256 vestedAmount;
        if (elapsed >= vesting.cliffDuration + vesting.vestingDuration) {
            // Fully vested
            vestedAmount = vesting.totalAmount;
        } else {
            // Partially vested (linear)
            uint256 vestingElapsed = elapsed - vesting.cliffDuration;
            vestedAmount = (vesting.totalAmount * vestingElapsed) / vesting.vestingDuration;
        }
        
        // Subtract already claimed
        claimable = vestedAmount > vesting.claimedAmount ? vestedAmount - vesting.claimedAmount : 0;
    }
    
    /**
     * @notice Get investor information
     * @param investor Address to check
     * @return contribution ETH contributed
     * @return totalTokens Total tokens purchased
     * @return claimedTokens Tokens already claimed
     * @return claimableTokens Tokens available to claim
     * @return isWhitelisted Whitelist status
     */
    function getInvestorInfo(address investor) external view returns (
        uint256 contribution,
        uint256 totalTokens,
        uint256 claimedTokens,
        uint256 claimableTokens,
        bool isWhitelisted
    ) {
        contribution = contributions[investor];
        totalTokens = vestingInfo[investor].totalAmount;
        claimedTokens = vestingInfo[investor].claimedAmount;
        claimableTokens = calculateClaimableTokens(investor);
        isWhitelisted = whitelisted[investor];
    }
    
    /**
     * @notice Get sale statistics
     * @return phase Current sale phase
     * @return raised Total ETH raised
     * @return tokensSold Total tokens sold
     * @return privateTokensSold Private sale tokens sold
     * @return publicTokensSold Public sale tokens sold
     */
    function getSaleStats() external view returns (
        SalePhase phase,
        uint256 raised,
        uint256 tokensSold,
        uint256 privateTokensSold,
        uint256 publicTokensSold
    ) {
        phase = currentPhase;
        raised = totalRaised;
        tokensSold = totalTokensSold;
        privateTokensSold = privateSaleTokensSold;
        publicTokensSold = publicSaleTokensSold;
    }
}
