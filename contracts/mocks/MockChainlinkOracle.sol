// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title MockChainlinkOracle
 * @notice Mock Chainlink oracle for testing
 * @dev Allows manual price setting for test scenarios
 */
contract MockChainlinkOracle is AggregatorV3Interface {
    
    uint8 public decimals;
    string public description;
    uint256 public version;
    
    int256 private _price;
    uint256 private _updatedAt;
    uint80 private _roundId;
    
    constructor(uint8 _decimals, string memory _description) {
        decimals = _decimals;
        description = _description;
        version = 1;
        _price = 0;
        _updatedAt = block.timestamp;
        _roundId = 1;
    }
    
    /**
     * @notice Sets the price for testing
     * @param price New price (with decimals)
     */
    function setPrice(int256 price) external {
        _price = price;
        _updatedAt = block.timestamp;
        _roundId++;
    }
    
    /**
     * @notice Sets stale price (old timestamp)
     * @param price Price to set
     * @param timestamp Old timestamp
     */
    function setStalePrice(int256 price, uint256 timestamp) external {
        _price = price;
        _updatedAt = timestamp;
        _roundId++;
    }
    
    /**
     * @notice Simulates oracle failure
     */
    function simulateFailure() external {
        _price = -1; // Invalid price
    }
    
    function getRoundData(uint80 /* _roundId */) external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (_roundId, _price, _updatedAt, _updatedAt, _roundId);
    }
    
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (_roundId, _price, _updatedAt, _updatedAt, _roundId);
    }
}
