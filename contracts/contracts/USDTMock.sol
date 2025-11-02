// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title USDTMock
 * @dev Mock USDT contract voor development/testing
 * In productie zou dit vervangen worden door het echte USDT contract address
 */
contract USDTMock is ERC20, Ownable {
    uint8 private _decimals = 6; // USDT gebruikt 6 decimals
    
    constructor() ERC20("Tether USD", "USDT") Ownable() {
        // Mint initial supply voor testing (1 miljoen USDT)
        _mint(msg.sender, 1000000 * 10**_decimals);
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Mint functie voor testing (alleen owner)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @dev Faucet functie voor testing - geef 1000 USDT aan caller
     */
    function faucet() external {
        require(balanceOf(msg.sender) < 10000 * 10**_decimals, "Al genoeg USDT");
        _mint(msg.sender, 1000 * 10**_decimals);
    }
}
