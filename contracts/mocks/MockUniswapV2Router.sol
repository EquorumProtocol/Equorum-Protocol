// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockUniswapV2Router
 * @notice Mock Uniswap V2 Router for testing buybacks
 */
contract MockUniswapV2Router {
    
    uint256 public swapRate = 1000; // 1 ETH = 1000 tokens by default
    bool public shouldFail = false;
    
    event SwapExecuted(
        uint256 amountIn,
        uint256 amountOut,
        address[] path,
        address to
    );
    
    function setSwapRate(uint256 rate) external {
        swapRate = rate;
    }
    
    function setShouldFail(bool fail) external {
        shouldFail = fail;
    }
    
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 /* deadline */
    ) external payable returns (uint256[] memory amounts) {
        require(!shouldFail, "Mock: Swap failed");
        require(msg.value > 0, "Mock: No ETH sent");
        require(path.length == 2, "Mock: Invalid path");
        
        uint256 tokenAmount = (msg.value * swapRate) / 1 ether;
        require(tokenAmount >= amountOutMin, "Mock: Insufficient output");
        
        // Mint tokens to recipient
        IERC20 token = IERC20(path[1]);
        // Note: This assumes the token is a mock that allows minting
        // In real tests, we'd need to pre-fund this contract
        
        amounts = new uint256[](2);
        amounts[0] = msg.value;
        amounts[1] = tokenAmount;
        
        emit SwapExecuted(msg.value, tokenAmount, path, to);
        
        return amounts;
    }
    
    function getAmountsOut(
        uint256 amountIn,
        address[] calldata /* path */
    ) external view returns (uint256[] memory amounts) {
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = (amountIn * swapRate) / 1 ether;
        return amounts;
    }
    
    receive() external payable {}
}
