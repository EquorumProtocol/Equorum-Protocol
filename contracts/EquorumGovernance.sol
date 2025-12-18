// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./TimeLock.sol";

/**
 * @title EquorumGovernance
 * @notice On-chain governance with QUADRATIC VOTING by LOCK (stake-to-vote)
 * @dev Optimized for Arbitrum L2 with efficient storage and gas patterns
 * 
 * FEATURES:
 * - Proposal threshold: 10,000 EQM (locked)
 * - Voting period: 7 days
 * - Quorum: 4% of total supply (quadratic) ≈ 1385 votes
 * - **QUADRATIC VOTING: sqrt(locked tokens) = votes** (protects against whales)
 * - Execution via TimeLock (48h delay)
 * 
 * ANTI-SYBIL PROTECTIONS:
 * - Vote by LOCK: tokens must be locked to vote (prevents flash loan attacks)
 * - Lock age requirement: 7 days minimum lock before voting
 * - Minimum lock: 100 EQM to participate
 * - unlockAfter tracking: user cannot unlock until ALL voted proposals end
 * 
 * QUADRATIC VOTING (NORMALIZED):
 * - Voting power = sqrt(lockedTokens / 1e18) in human-readable units
 * - Example: 10,000 EQM locked = sqrt(10000) = 100 votes
 * - Example: 1,000,000 EQM locked = sqrt(1000000) = 1000 votes
 * - Quorum = sqrt(4% of totalSupply / 1e18) ≈ 1385 votes
 * 
 * LOCK AGE TRADEOFF (DOCUMENTED):
 * - lockTime is set on FIRST lock only (not reset when adding more tokens)
 * - This means: user can lock 100 EQM, wait 7 days, then add 1M EQM and vote immediately
 * - Tradeoff: Better UX (can add tokens without resetting age) vs. slightly weaker anti-sybil
 * - Mitigation: The 7-day lock requirement still prevents flash attacks
 * 
 * GENESIS RESTRICTIONS:
 * - Genesis vesting contract CANNOT vote
 * - Genesis vesting contract CANNOT create proposals
 * 
 * ARBITRUM L2 OPTIMIZATIONS:
 * - Compact storage layout
 * - Efficient vote counting
 * - Gas-optimized square root calculation
 */
contract EquorumGovernance is ReentrancyGuard {
    
    // ========== CUSTOM ERRORS ==========
    error InvalidAddress();
    error GenesisCannotParticipate();
    error BelowProposalThreshold();
    error MustProvideActions();
    error ArrayLengthMismatch();
    error EmptyDescription();
    error VotingClosed();
    error AlreadyVoted();
    error NoVotingPower();
    error ProposalNotSucceeded();
    error ProposalNotQueued();
    error OnlyProposerCanCancel();
    error CannotCancelExecuted();
    error InvalidProposal();
    error InsufficientLock();
    error LockTooNew();
    error NoLockFound();
    error LockStillActive();
    error TransferFailed();
    error BelowMinimumLock();
    error AlreadyQueued();
    error InvalidValue();
    
    // ========== CONSTANTS ==========
    uint256 public constant PROPOSAL_THRESHOLD = 10_000 * 1e18;  // 10K EQM locked
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant QUORUM_PERCENTAGE = 400;  // 4% (base 10000)
    uint256 public constant MIN_LOCK_AMOUNT = 100 * 1e18;  // 100 EQM minimum to vote
    uint256 public constant MIN_LOCK_AGE = 7 days;  // Must be locked 7 days before voting
    
    // ========== STATE VARIABLES ==========
    IERC20 public immutable equorumToken;
    TimeLock public immutable timeLock;
    address public immutable genesisVesting;
    
    uint256 public proposalCount;
    
    // ========== LOCK SYSTEM (stake-to-vote) ==========
    struct Lock {
        uint256 amount;
        uint256 lockTime;      // When tokens were locked
    }
    
    mapping(address => Lock) public locks;
    mapping(address => uint256) public unlockAfter;  // Timestamp when user can unlock (max endTime of voted proposals)
    uint256 public totalLocked;
    
    // ========== PROPOSAL SYSTEM ==========
    enum ProposalState {
        Pending,
        Active,
        Defeated,
        Succeeded,
        Queued,
        Executed,
        Canceled,
        Expired      // NEW: Proposal expired in timelock (past eta + GRACE_PERIOD)
    }
    
    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        address[] targets;
        uint256[] values;
        string[] signatures;
        bytes[] calldatas;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        bool canceled;
        bool queued;           // CRITICAL: Track if proposal is queued
        uint256 eta;           // CRITICAL: Store ETA for timelock execution
        mapping(address => bool) hasVoted;
        mapping(address => uint256) voteSnapshot;  // Snapshot of locked amount at vote time
    }
    
    mapping(uint256 => Proposal) public proposals;
    
    // ========== EVENTS ==========
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string description,
        uint256 startTime,
        uint256 endTime
    );
    
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );
    
    event ProposalQueued(uint256 indexed proposalId, uint256 eta);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);
    
    // Lock events
    event TokensLocked(address indexed user, uint256 amount, uint256 totalLocked);
    event TokensUnlocked(address indexed user, uint256 amount);
    
    // ========== CONSTRUCTOR ==========
    /**
     * @param _equorumToken Address of the EQM token
     * @param _timeLock Address of the TimeLock contract
     * @param _genesisVesting Address of Genesis vesting contract (excluded from voting)
     */
    constructor(address _equorumToken, address _timeLock, address _genesisVesting) {
        if (_equorumToken == address(0)) revert InvalidAddress();
        if (_timeLock == address(0)) revert InvalidAddress();
        if (_genesisVesting == address(0)) revert InvalidAddress();
        
        equorumToken = IERC20(_equorumToken);
        timeLock = TimeLock(payable(_timeLock));
        genesisVesting = _genesisVesting;
    }
    
    // ========== LOCK FUNCTIONS (stake-to-vote) ==========
    
    /**
     * @notice Lock tokens to participate in governance
     * @param amount Amount of EQM to lock
     * @dev Tokens must be locked for MIN_LOCK_AGE before voting
     * @dev Genesis vesting contract cannot lock
     */
    function lock(uint256 amount) external nonReentrant {
        if (msg.sender == genesisVesting) revert GenesisCannotParticipate();
        if (amount < MIN_LOCK_AMOUNT) revert BelowMinimumLock();
        
        Lock storage userLock = locks[msg.sender];
        
        // If first lock or adding to existing lock
        if (userLock.amount == 0) {
            userLock.lockTime = block.timestamp;
        }
        
        userLock.amount += amount;
        totalLocked += amount;
        
        // Transfer tokens to this contract
        if (!equorumToken.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        
        emit TokensLocked(msg.sender, amount, userLock.amount);
    }
    
    /**
     * @notice Unlock tokens after all voted proposals have ended
     * @dev Uses unlockAfter timestamp (max endTime of all voted proposals)
     */
    function unlock() external nonReentrant {
        Lock storage userLock = locks[msg.sender];
        if (userLock.amount == 0) revert NoLockFound();
        
        // CRITICAL: Check against unlockAfter (max endTime of all voted proposals)
        if (block.timestamp < unlockAfter[msg.sender]) revert LockStillActive();
        
        uint256 amount = userLock.amount;
        
        // Clear lock and unlockAfter
        userLock.amount = 0;
        userLock.lockTime = 0;
        unlockAfter[msg.sender] = 0;
        totalLocked -= amount;
        
        // Transfer tokens back
        if (!equorumToken.transfer(msg.sender, amount)) revert TransferFailed();
        
        emit TokensUnlocked(msg.sender, amount);
    }
    
    // ========== PROPOSAL FUNCTIONS ==========
    
    /**
     * @notice Creates a new proposal
     * @param targets Target contract addresses
     * @param values ETH values for each call
     * @param signatures Function signatures
     * @param calldatas Call data
     * @param description Proposal description
     * @dev Genesis vesting contract cannot create proposals
     * @dev Proposer must have PROPOSAL_THRESHOLD locked tokens
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    ) external nonReentrant returns (uint256) {
        if (msg.sender == genesisVesting) revert GenesisCannotParticipate();
        
        Lock storage userLock = locks[msg.sender];
        if (userLock.amount < PROPOSAL_THRESHOLD) revert BelowProposalThreshold();
        if (block.timestamp < userLock.lockTime + MIN_LOCK_AGE) revert LockTooNew();
        
        if (targets.length == 0) revert MustProvideActions();
        if (targets.length != values.length) revert ArrayLengthMismatch();
        if (targets.length != signatures.length) revert ArrayLengthMismatch();
        if (targets.length != calldatas.length) revert ArrayLengthMismatch();
        if (bytes(description).length == 0) revert EmptyDescription();
        
        uint256 proposalId = ++proposalCount;
        Proposal storage newProposal = proposals[proposalId];
        
        newProposal.id = proposalId;
        newProposal.proposer = msg.sender;
        newProposal.description = description;
        newProposal.targets = targets;
        newProposal.values = values;
        newProposal.signatures = signatures;
        newProposal.calldatas = calldatas;
        newProposal.startTime = block.timestamp;
        newProposal.endTime = block.timestamp + VOTING_PERIOD;
        
        emit ProposalCreated(
            proposalId,
            msg.sender,
            description,
            newProposal.startTime,
            newProposal.endTime
        );
        
        return proposalId;
    }
    
    /**
     * @notice Votes on a proposal with QUADRATIC VOTING by LOCK
     * @param proposalId Proposal ID
     * @param support true = for, false = against
     * @dev Genesis vesting contract cannot vote
     * @dev Voting power = sqrt(locked tokens) - QUADRATIC VOTING
     * @dev Tokens must be locked for MIN_LOCK_AGE before voting
     */
    function castVote(uint256 proposalId, bool support) external nonReentrant {
        if (state(proposalId) != ProposalState.Active) revert VotingClosed();
        if (msg.sender == genesisVesting) revert GenesisCannotParticipate();
        
        Proposal storage proposal = proposals[proposalId];
        if (proposal.hasVoted[msg.sender]) revert AlreadyVoted();
        
        Lock storage userLock = locks[msg.sender];
        if (userLock.amount == 0) revert NoVotingPower();
        if (userLock.amount < MIN_LOCK_AMOUNT) revert InsufficientLock();
        
        // ANTI-SYBIL: Lock must be old enough (prevents flash attacks)
        if (block.timestamp < userLock.lockTime + MIN_LOCK_AGE) revert LockTooNew();
        
        // QUADRATIC VOTING: sqrt(locked amount / 1e18) = voting power in human-readable units
        // Example: 10,000 locked tokens = sqrt(10000) = 100 votes
        uint256 weight = _sqrt(userLock.amount / 1e18);
        
        // Record vote
        proposal.hasVoted[msg.sender] = true;
        proposal.voteSnapshot[msg.sender] = userLock.amount;  // Snapshot for records
        
        // CRITICAL: Update unlockAfter to max(current, proposal.endTime)
        // This ensures user cannot unlock until ALL voted proposals have ended
        if (proposal.endTime > unlockAfter[msg.sender]) {
            unlockAfter[msg.sender] = proposal.endTime;
        }
        
        if (support) {
            proposal.forVotes += weight;
        } else {
            proposal.againstVotes += weight;
        }
        
        emit VoteCast(proposalId, msg.sender, support, weight);
    }
    
    /**
     * @notice Queue approved proposal to TimeLock
     * @param proposalId Proposal ID
     * @dev Stores ETA for later execution
     */
    function queue(uint256 proposalId) external nonReentrant {
        if (state(proposalId) != ProposalState.Succeeded) revert ProposalNotSucceeded();
        
        Proposal storage proposal = proposals[proposalId];
        
        // CRITICAL: Prevent double queue
        if (proposal.queued) revert AlreadyQueued();
        
        uint256 eta = block.timestamp + timeLock.DELAY();
        
        // CRITICAL: Store queued state and ETA
        proposal.queued = true;
        proposal.eta = eta;
        
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            timeLock.queueTransaction(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                eta
            );
        }
        
        emit ProposalQueued(proposalId, eta);
    }
    
    /**
     * @notice Execute proposal after TimeLock delay
     * @param proposalId Proposal ID
     * @dev Uses stored proposal.eta (not block.timestamp)
     * @dev Sets executed=true AFTER successful execution
     * @dev Requires msg.value == sum of all proposal values
     */
    function execute(uint256 proposalId) external payable nonReentrant {
        if (state(proposalId) != ProposalState.Queued) revert ProposalNotQueued();
        
        Proposal storage proposal = proposals[proposalId];
        
        // CRITICAL: Validate msg.value matches total required ETH
        // With overflow protection for malicious proposals
        uint256 totalValue = 0;
        for (uint256 i = 0; i < proposal.values.length; i++) {
            uint256 v = proposal.values[i];
            if (totalValue > type(uint256).max - v) revert InvalidValue();
            totalValue += v;
        }
        if (msg.value != totalValue) revert InvalidValue();
        
        // CRITICAL: Use stored ETA, not block.timestamp
        uint256 eta = proposal.eta;
        
        // Execute all transactions
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            timeLock.executeTransaction{value: proposal.values[i]}(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                eta
            );
        }
        
        // CRITICAL: Set executed AFTER successful execution (not before)
        proposal.executed = true;
        
        emit ProposalExecuted(proposalId);
    }
    
    /**
     * @notice Cancel a proposal
     * @param proposalId Proposal ID
     * @dev Also cancels queued transactions in timelock if queued
     */
    function cancel(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        if (msg.sender != proposal.proposer) revert OnlyProposerCanCancel();
        if (state(proposalId) == ProposalState.Executed) revert CannotCancelExecuted();
        
        // If queued, cancel transactions in timelock
        if (proposal.queued && !proposal.executed) {
            uint256 eta = proposal.eta;
            for (uint256 i = 0; i < proposal.targets.length; i++) {
                timeLock.cancelTransaction(
                    proposal.targets[i],
                    proposal.values[i],
                    proposal.signatures[i],
                    proposal.calldatas[i],
                    eta
                );
            }
            // CRITICAL: Clear queued state for hygiene
            proposal.queued = false;
            proposal.eta = 0;
        }
        
        proposal.canceled = true;
        
        emit ProposalCanceled(proposalId);
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Returns the current state of a proposal
     * @dev Integrates with TimeLock GRACE_PERIOD for Expired state
     */
    function state(uint256 proposalId) public view returns (ProposalState) {
        if (proposalId == 0 || proposalId > proposalCount) revert InvalidProposal();
        
        Proposal storage proposal = proposals[proposalId];
        
        // Check terminal states first
        if (proposal.canceled) {
            return ProposalState.Canceled;
        }
        
        if (proposal.executed) {
            return ProposalState.Executed;
        }
        
        // CRITICAL: Check if queued and handle timelock expiration
        if (proposal.queued) {
            // Check if proposal expired in timelock (past eta + GRACE_PERIOD)
            if (block.timestamp > proposal.eta + timeLock.GRACE_PERIOD()) {
                return ProposalState.Expired;
            }
            return ProposalState.Queued;
        }
        
        // Check if voting is still active
        if (block.timestamp < proposal.endTime) {
            return ProposalState.Active;
        }
        
        // Voting ended - check quorum and approval
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        
        // Quorum is quadratic: sqrt(4% of total supply / 1e18) in human-readable units
        // Example: 4% of 48M = 1.92M tokens, sqrt(1920000) ≈ 1385 votes
        uint256 linearQuorum = (equorumToken.totalSupply() * QUORUM_PERCENTAGE) / 10000;
        uint256 requiredQuorum = _sqrt(linearQuorum / 1e18);
        
        if (totalVotes < requiredQuorum) {
            return ProposalState.Defeated;
        }
        
        if (proposal.forVotes > proposal.againstVotes) {
            return ProposalState.Succeeded;
        }
        
        return ProposalState.Defeated;
    }
    
    /**
     * @notice Returns proposal information
     */
    function getProposalInfo(uint256 proposalId) external view returns (
        address proposer,
        string memory description,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 startTime,
        uint256 endTime,
        bool executed,
        bool canceled,
        ProposalState currentState
    ) {
        if (proposalId == 0 || proposalId > proposalCount) revert InvalidProposal();
        
        Proposal storage proposal = proposals[proposalId];
        
        return (
            proposal.proposer,
            proposal.description,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.startTime,
            proposal.endTime,
            proposal.executed,
            proposal.canceled,
            state(proposalId)
        );
    }
    
    /**
     * @notice Check if address has voted on proposal
     */
    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return proposals[proposalId].hasVoted[voter];
    }
    
    /**
     * @notice Returns proposal actions
     */
    function getActions(uint256 proposalId) external view returns (
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.targets,
            proposal.values,
            proposal.signatures,
            proposal.calldatas
        );
    }
    
    /**
     * @notice Calculate required quorum (quadratic, human-readable)
     * @dev With quadratic voting, quorum is sqrt(4% of supply / 1e18)
     * @return Required quorum in human-readable vote units (e.g., 1385 votes)
     */
    function quorum() public view returns (uint256) {
        uint256 linearQuorum = (equorumToken.totalSupply() * QUORUM_PERCENTAGE) / 10000;
        return _sqrt(linearQuorum / 1e18);
    }
    
    /**
     * @notice Calculate quadratic voting power for an address based on LOCKED tokens
     * @param account Address to check
     * @return votingPower Quadratic voting power in human-readable units (e.g., 100 votes for 10K tokens)
     * @return canVote Whether the user can currently vote (has lock, lock is old enough)
     */
    function getVotingPower(address account) external view returns (uint256 votingPower, bool canVote) {
        Lock storage userLock = locks[account];
        
        if (userLock.amount == 0) {
            return (0, false);
        }
        
        // Normalize by 1e18 for human-readable vote units
        votingPower = _sqrt(userLock.amount / 1e18);
        canVote = userLock.amount >= MIN_LOCK_AMOUNT && 
                  block.timestamp >= userLock.lockTime + MIN_LOCK_AGE;
    }
    
    /**
     * @notice Get lock information for an address
     * @param account Address to check
     */
    function getLockInfo(address account) external view returns (
        uint256 amount,
        uint256 lockTime,
        uint256 votingPower,
        bool canVote,
        bool canUnlock
    ) {
        Lock storage userLock = locks[account];
        
        amount = userLock.amount;
        lockTime = userLock.lockTime;
        // Normalize by 1e18 for human-readable vote units
        votingPower = userLock.amount > 0 ? _sqrt(userLock.amount / 1e18) : 0;
        canVote = userLock.amount >= MIN_LOCK_AMOUNT && 
                  block.timestamp >= userLock.lockTime + MIN_LOCK_AGE;
        
        // Check if can unlock using unlockAfter timestamp
        canUnlock = userLock.amount > 0 && block.timestamp >= unlockAfter[account];
    }
    
    /**
     * @notice Get proposal ETA (for queued proposals)
     */
    function getProposalEta(uint256 proposalId) external view returns (uint256) {
        return proposals[proposalId].eta;
    }
    
    /**
     * @notice Get unlock timestamp for an address
     * @param account Address to check
     * @return Timestamp when user can unlock (0 if no active votes)
     */
    function getUnlockAfter(address account) external view returns (uint256) {
        return unlockAfter[account];
    }
    
    /**
     * @notice Check if a queued proposal is executable (ETA reached but not expired)
     * @param proposalId Proposal ID
     * @return True if proposal can be executed now
     */
    function isExecutable(uint256 proposalId) external view returns (bool) {
        if (proposalId == 0 || proposalId > proposalCount) return false;
        
        Proposal storage proposal = proposals[proposalId];
        
        // Must be queued, not executed, not canceled
        if (!proposal.queued || proposal.executed || proposal.canceled) return false;
        
        // Must be past ETA but within grace period
        uint256 eta = proposal.eta;
        return block.timestamp >= eta && block.timestamp <= eta + timeLock.GRACE_PERIOD();
    }
    
    /**
     * @notice Mark an expired proposal as no longer queued (cleanup function)
     * @param proposalId Proposal ID
     * @dev Anyone can call this to clean up expired proposals
     */
    function markExpired(uint256 proposalId) external {
        if (state(proposalId) != ProposalState.Expired) revert ProposalNotQueued();
        
        Proposal storage proposal = proposals[proposalId];
        proposal.queued = false;
        proposal.eta = 0;
    }
    
    // ========== INTERNAL FUNCTIONS ==========
    
    /**
     * @notice Efficient square root calculation (Babylonian method)
     * @dev Optimized for Arbitrum L2
     * @param x Number to calculate square root of
     * @return y Square root of x
     */
    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        
        // Initial guess (using bit shifting for efficiency)
        uint256 z = (x + 1) / 2;
        y = x;
        
        // Babylonian method (Newton's method for square roots)
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
