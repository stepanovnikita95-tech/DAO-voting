// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";

contract Timelock is TimelockController {
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executers,
        address admin
    ) TimelockController (minDelay, proposers, executers, admin) {}
}