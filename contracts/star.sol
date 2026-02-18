// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Star is Ownable, ReentrancyGuard {
    uint256 myVal;

    constructor (address initialOwner) payable Ownable(initialOwner) {}

    error Failed();
    event Stored (uint256 newVal);
    event MoneySent(address to, uint256 amount);

    function store(uint256 _newVal) external onlyOwner {
        myVal = _newVal;
        emit Stored(myVal);
    }

    function sendMoney(address _to, uint256 _amount) external nonReentrant {
        (bool success, ) = payable(_to).call{value: _amount}("");
        require(success, Failed());
        emit MoneySent(_to, _amount);
    }
    function read() external view returns(uint256) {
        return myVal;
    }
}