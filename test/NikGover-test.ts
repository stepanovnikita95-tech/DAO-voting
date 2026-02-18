import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { GoverToken, NikGover } from "../typechain-types";
import { deployFixture } from "./Deploy-test";
import { BytesLike, EventLog } from "ethers";

let admin:SignerWithAddress;
let user1:SignerWithAddress;
let user2:SignerWithAddress;
let user3:SignerWithAddress;
let nonVoter:SignerWithAddress;
let gover:NikGover;
let token:GoverToken;
let proposalId:bigint;
let targets:string[];
let values:number[];
let calldatas:BytesLike[];
let description:string;
let descriptionHash:BytesLike;
describe("NikGover Governance ", function() {

    beforeEach( async function() {
        const fixture = await deployFixture();
        gover = fixture.gover;
        token = fixture.token;
        admin = fixture.admin;
        user1 = fixture.user1;
        user2 = fixture.user2;
        user3 = fixture.user3;
        nonVoter = fixture.nonVoter;
        
        const tx1 = await token.transfer(user1.address, ethers.parseEther("10000"));
        await tx1.wait();
        const tx2 = await token.transfer(user2.address, ethers.parseEther("20000"));
        await tx2.wait();
        const tx3 = await token.transfer(user3.address, ethers.parseEther("200"));
        await tx3.wait();
        

        const del1 = await token.connect(user1).delegate(user1.address);
        await del1.wait();
        const del2 = await token.connect(user2).delegate(user2.address);
        await del2.wait();
        const del3 = await token.connect(user3).delegate(user3.address);
        await del3.wait();
   

        targets = [ethers.ZeroAddress];
        values = [0];
        calldatas = ["0x"];
        description = "Test proposal #1";
        descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description));

        const proposeTx = await gover.connect(user1).propose(
            targets,
            values,
            calldatas,
            description
        );
        const proposalReceipt = await proposeTx.wait();
        
        proposalId = (proposalReceipt?.logs[0] as EventLog).args[0];

        await mine((await gover.votingDelay())+ 1n );
    })
    it("Create proposal correctly", async function() {
        const state = await gover.state(proposalId);
        expect(state).to.eq(1n);
    })
    it("Allow voting and counts correctly", async function() {
        await gover.connect(user1).castVoteWithReason(proposalId, 1, "Like it" );
        await gover.connect(user2).castVoteWithReason(proposalId, 1, "Like it");
        await gover.connect(user3).castVoteWithReason(proposalId, 0, "Dont like");

        const votes = await gover.proposalVotes(proposalId);
        expect(votes.forVotes).to.be.gt(votes.againstVotes);
        expect(votes.abstainVotes).to.eq(0);
    })
    it("Proposal succeeded if quorum and majority", async function() {
        await gover.connect(user1).castVote(proposalId, 1);
        await gover.connect(user2).castVote(proposalId, 1);
        await gover.connect(user3).castVote(proposalId, 2);

        await mine((await gover.votingPeriod()) + 1n);
        expect(await gover.state(proposalId)).to.eq(4); //Succeeded
    })
    it("Proposal failed without quorum", async function() {
        await gover.connect(user3).castVote(proposalId, 1);
        await mine((await gover.votingPeriod()) + 1n);
        expect(await gover.state(proposalId)).to.eq(3); //QuorumNotReach
    })
    it("NonVoter can not affect to total voices", async function() {
        expect(await token.getVotes(nonVoter.address)).to.equal(0n);
        await expect(
                gover.connect(nonVoter).castVote(proposalId, 1) 
            ).to.not.be.reverted;

        await gover.connect(user1).castVote(proposalId, 1);        
        await gover.connect(user2).castVote(proposalId, 1);

        const votes = await gover.proposalVotes(proposalId);
        expect(votes.forVotes).to.eq(ethers.parseEther("30000"));
    })
    it("Can not vote twice", async function() {
        await gover.connect(user1).castVote(proposalId, 1);
        await expect(
                gover.connect(user1).castVote(proposalId, 1)
            ).to.be.revertedWithCustomError(gover, "GovernorAlreadyCastVote");
    })
    it("Can not create proposal with insufficient tokens", async function () {
        await expect(
            gover.connect(nonVoter).propose([ethers.ZeroAddress], [0], ["0x"], "Test")
        ).to.be.revertedWithCustomError(gover, "GovernorInsufficientProposerVotes");
    })
})
describe("NikGover - cancel proposal", function() {
    beforeEach(async function() {
        const fixture = await deployFixture();
        gover = fixture.gover;
        token = fixture.token;
        admin = fixture.admin;
        user1 = fixture.user1;
        user2 = fixture.user2;
        
        const tx1 = await token.transfer(user1.address, ethers.parseEther("10000"));
        await tx1.wait();
        const tx2 = await token.transfer(user2.address, ethers.parseEther("20000"));
        await tx2.wait();

        const del1 = await token.connect(user1).delegate(user1.address);
        await del1.wait();
        const del2 = await token.connect(user2).delegate(user2.address);
        await del2.wait();

        targets = [ethers.ZeroAddress];
        values = [0];
        calldatas = ["0x"];
        description = "Test proposal #1";
        descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description));

        const proposeTx = await gover.connect(user1).propose(
            targets,
            values,
            calldatas,
            description
        );
        const proposalReceipt = await proposeTx.wait();
        
        proposalId = (proposalReceipt?.logs[0] as EventLog).args[0];
    })
    it("Proposal can be canceled their own proposal in Pending", async function() {
        expect(await gover.state(proposalId)).to.equal(0); // Pending

        await expect(
            gover.connect(user1).cancel(
                targets,
                values,
                calldatas,
                descriptionHash)).to.not.be.reverted;
        expect(await gover.state(proposalId)).to.eq(2); //Canceled
    })
    it("Proposer can not cancel proposal during voting period", async function() {
        await mine((await gover.votingDelay())+ 1n );
        expect(await gover.state(proposalId)).to.equal(1); // Active

        await expect(gover.connect(user1).cancel(
                targets,
                values,
                calldatas,
                descriptionHash)).to.be.revertedWithCustomError(gover, "GovernorUnableToCancel")
        expect(await gover.state(proposalId)).to.eq(1); //Active
    })
})
   