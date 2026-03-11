// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/Governance.sol";
import "../src/GoverToken.sol";
import "../src/star.sol";
import "../src/Timelock.sol";

contract MainTest is Test {
    NikGover public gover;
    GoverToken public token;
    Star public star;
    Timelock public timelock;

    address public admin;
    address public user1;
    address public user2;
    address public nonVoter;
    
    function setUp() public {
        admin = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        nonVoter = makeAddr("nonVoter");

        token = new GoverToken();
        
        address[] memory proposers = new address[](1);
        proposers[0] = address(gover);
        address[] memory executers = new address[](1);
        executers[0] = address(0);

        timelock = new Timelock(3500, proposers, executers, admin);

        gover = new NikGover(token, timelock);
        star = new Star(address(this));

        vm.prank(admin);
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(gover));
        timelock.grantRole(timelock.EXECUTOR_ROLE(), address(gover));
        timelock.renounceRole(timelock.DEFAULT_ADMIN_ROLE(), address(admin));
    }

    function _createProposal() internal returns (
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
        ) 
        {
        targets = new address[](1);
        targets[0] = address(0);
        values = new uint256[](1);
        values[0] = 0;
        calldatas = new bytes[](1);
        calldatas[0] = " ";
        string memory description = "Test";
        descriptionHash = keccak256(bytes(description));

        proposalId = gover.propose(
            targets,
            values,
            calldatas,
            description
        );
        return (proposalId, targets, values, calldatas, descriptionHash);
    }
    function _getTokenAndDelegate(address _user, uint256 _amount, uint256 _amountTokens) internal {
        vm.deal(_user, _amount);
        vm.prank(admin);
        token.transfer(_user, _amountTokens);
        vm.prank(_user);
        token.delegate(_user);
        
        vm.roll(block.number + 2); 
    }
    function test_CreateProposal()  public {
        _getTokenAndDelegate(user1, 100 ether, 100_000 ether);

        vm.roll(block.number + 2); 
        
        vm.prank(user1);
        (uint256 proposalId, , , , ) = _createProposal();

        assertEq(uint8(gover.state(proposalId)), 0, "New proposal should be in Pending state" );
    }
    
    function testFuzz_ProposeAndVote(
            uint256 voterBalance,
            uint8 supportType,
            uint256 warpBlocks
        ) public {
        voterBalance = bound(voterBalance, 1, 1_000_000 ether);
        supportType  = uint8(bound(supportType, 0, 2)); // 0=Against, 1=For, 2=Abstain
        warpBlocks   = bound(warpBlocks, 1, gover.votingDelay() + gover.votingPeriod() + 100);

        vm.deal(user1, voterBalance);
        vm.prank(admin);
        token.transfer(user1, voterBalance);

        vm.prank(user1);
        token.delegate(user1);

        vm.roll(block.number + 1); 

        vm.prank(user1);
        (uint256 proposalId, , , , ) = _createProposal();

        vm.roll(block.number + gover.votingDelay() + 1);

        vm.prank(user1);
        gover.castVote(proposalId, supportType);

        (uint256 against, uint256 forVotes, uint256 abstain) = gover.proposalVotes(proposalId);

        if (supportType == 0) assertEq(against,   voterBalance);
        if (supportType == 1) assertEq(forVotes,  voterBalance);
        if (supportType == 2) assertEq(abstain,   voterBalance);
    }
    function test_FlashLoan_VotingPowerSnapshot() public {
        _getTokenAndDelegate(user1, 100 ether, 100_000 ether);
        vm.roll(block.number + 1); 

        vm.prank(user1);
        (uint256 proposalId, , , , ) = _createProposal();

        vm.prank(admin);
        token.transfer(user2, 1000 ether);

        vm.prank(user2);
        token.delegate(user2);
        
        vm.roll(block.number + 1); 

        vm.expectRevert();
        vm.prank(user2);
        gover.castVote(proposalId, 1);
    }
    function test_CancelOnlyProposer() public {
        _getTokenAndDelegate(user1, 100 ether, 100_000 ether);

        vm.roll(block.number + 2); 
        vm.prank(user1);

        (,
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas,
            bytes32 descriptionHash
        ) = _createProposal();        

        vm.prank(user2);
        vm.expectRevert();
        gover.cancel(targets, values, calldatas, descriptionHash);

        vm.prank(user1);
        gover.cancel(targets, values, calldatas, descriptionHash);
    }

    function test_Execute_OnlyAfterTimelockDelay() public {
        _getTokenAndDelegate(user1, 100 ether, 100_000 ether);
        vm.roll(block.number + 1); 
        
        vm.prank(user1);
        (uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash) = _createProposal();
        
        vm.roll(block.number + gover.votingDelay() + 1);

        vm.prank(user1);
        gover.castVote(proposalId, 1);
        vm.roll(block.number + gover.votingPeriod() + 1);

        vm.prank(user1);
        gover.queue(
            targets,
            values,
            calldatas,
            descriptionHash
        );
        vm.warp(block.timestamp + timelock.getMinDelay() + 1);

        vm.prank(user1);
        gover.execute(
            targets,
            values,
            calldatas,
            descriptionHash
        );
    }

    function invariant_VotingPowerNonNegative() public view {
        assertGe(token.getVotes(address(this)), 0);
        assertGe(token.getVotes(user1),         0);
        assertGe(token.getVotes(user2),         0);
        assertGe(token.getVotes(nonVoter),      0);
    }
    function invariant_TotalSupplyEqualsSumOfBalances() public view {
        uint256 totalSupply = token.totalSupply();

        uint256 sum = token.balanceOf(address(this))
                + token.balanceOf(user1)
                + token.balanceOf(user2)
                + token.balanceOf(nonVoter);
        assertEq(totalSupply, sum);
    }

    function test_Full_cycle_propose_vote_queue_execute() public {
        _getTokenAndDelegate(user1, 100 ether, 100_000 ether);
        _getTokenAndDelegate(user2, 100 ether, 100_000 ether);

        vm.deal(address(star), 100 ether);

        vm.roll(block.number + 1); 
        
        address[] memory targets = new address[](2);
        targets[0] = address(star);
        targets[1] = address(star);
        uint256[] memory values = new uint256[](2);
        values[0] = 0;
        values[1] = 0;
        bytes[] memory calldatas = new bytes[](2);
        calldatas[0] = abi.encodeWithSignature("storeTest(uint256)", 22);
        calldatas[1] = abi.encodeWithSignature("sendMoney(address,uint256)", user1, 12 ether);
        string memory description = "Test";
        bytes32 descriptionHash = keccak256(bytes(description));
        vm.prank(user1);
        uint256 proposalId = gover.propose(
            targets,
            values,
            calldatas,
            description
        );
        assertEq(uint8(gover.state(proposalId)), 0); // Pending
        
        vm.roll(block.number + gover.votingDelay() + 1);

        vm.prank(user1);
        gover.castVote(proposalId, 1);
        vm.prank(user2);
        gover.castVote(proposalId, 1);

        vm.roll(block.number + gover.votingPeriod() + 1);
        vm.prank(user1);
        gover.queue(
            targets,
            values,
            calldatas,
            descriptionHash
        );
        
        vm.warp(block.timestamp + timelock.getMinDelay() + 10 seconds);
        
        gover.execute(
            targets,
            values,
            calldatas,
            descriptionHash
        );

        assertEq(uint8(gover.state(proposalId)), 7, "Executed");
        assertEq(star.read(), 22, "storeTest done");
        console.log("Balance Star", address(star).balance);
        console.log("Balance user1", user1.balance);
        assertEq(address(star).balance, 100 ether - 12 ether, "sendMoney done");
    }
}