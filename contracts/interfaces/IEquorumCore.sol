// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IEquorumCore
 * @author Equorum Protocol
 * @notice Unified interface for Equorum Protocol core contracts
 * @dev All main contracts implement this interface for standardization and interoperability
 * 
 * ARBITRUM L2 OPTIMIZATIONS:
 * - Minimal calldata usage
 * - Event-driven architecture for off-chain indexing
 * - Gas-efficient parameter updates
 */
interface IEquorumCore {
    /**
     * @notice Processes a system action
     * @dev Action types: 1=Regular, 2=Critical, 3=Emergency
     * @param actionType Type of action to process
     * @param data Additional action data (ABI encoded)
     */
    function processSystemAction(uint8 actionType, bytes calldata data) external;

    /**
     * @notice Stops the contract in case of emergency
     * @dev Should pause all critical functions
     * @param reason Reason for emergency stop
     */
    function emergencyStop(string calldata reason) external;

    /**
     * @notice Updates contract parameters
     * @dev Arrays must have matching lengths
     * @param params Array of parameter names to update
     * @param values Array of corresponding values
     */
    function updateParameters(string[] calldata params, uint256[] calldata values) external;

    /**
     * @notice Validates current contract state
     * @dev Returns hash of critical state variables for verification
     * @return checksum Hash of current state
     */
    function validateState() external view returns (bytes32 checksum);

    /**
     * @notice Verifies integration with other contracts
     * @dev Checks if contract addresses are valid and accessible
     * @param contracts Array of contract addresses to verify
     * @return valid True if all integrations are valid
     */
    function verifyIntegrations(address[] calldata contracts) external view returns (bool valid);

    // ========== EVENTS ==========
    
    /**
     * @notice Emitted when a system action is processed
     * @param contractAddress Address of contract processing action
     * @param action Description of action
     * @param value Numeric value associated with action
     * @param timestamp Block timestamp of action
     */
    event SystemAction(
        address indexed contractAddress,
        string action,
        uint256 value,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a parameter is updated
     * @param contractAddress Address of contract being updated
     * @param parameter Name of parameter updated
     * @param oldValue Previous value
     * @param newValue New value
     * @param timestamp Block timestamp of update
     */
    event ParameterUpdate(
        address indexed contractAddress,
        string indexed parameter,
        uint256 oldValue,
        uint256 newValue,
        uint256 timestamp
    );

    /**
     * @notice Emitted when emergency action is taken
     * @param contractAddress Address of contract in emergency
     * @param reason Reason for emergency action
     * @param timestamp Block timestamp of emergency
     */
    event EmergencyAction(
        address indexed contractAddress,
        string reason,
        uint256 timestamp
    );

    /**
     * @notice Emitted when integration validation is performed
     * @param contractAddress Address of contract validating
     * @param contracts Array of contracts validated
     * @param success True if validation passed
     * @param timestamp Block timestamp of validation
     */
    event IntegrationValidation(
        address indexed contractAddress,
        address[] contracts,
        bool success,
        uint256 timestamp
    );
}
