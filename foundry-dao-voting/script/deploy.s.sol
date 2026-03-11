// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import "../src/Governance.sol";
import "../src/GoverToken.sol";
import "../src/star.sol";
import "../src/Timelock.sol";

contract Deploy is Script {
    NikGover public gover;
    GoverToken public token;
    Star public star;
    Timelock public timelock;

function run() public {
    
}

}