import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time, mine } from "@nomicfoundation/hardhat-network-helpers";
import { GoverToken, NikGover, Timelock } from "../typechain-types";
import { deployFixture } from "./Deploy-test";
import { BytesLike, EventLog } from "ethers";

describe("Timelocker", function() {
    let user1:SignerWithAddress;
    let user2:SignerWithAddress;
    let gover:NikGover;
    let token:GoverToken;
    let timelock:Timelock;
    let proposalId:bigint;
    let targets:string[];
    let values:number[];
    let calldatas:BytesLike[];
    let description:string;
    let descriptionHash:BytesLike;

    beforeEach(async function() {
        const fixture = await deployFixture();
        gover = fixture.gover;
        token = fixture.token;
        timelock = fixture.timelock;
        user1 = fixture.user1;
        user2 = fixture.user2;

        const tx1 = await token.transfer(user1.address, ethers.parseEther("50000"));
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

        await mine((await gover.votingDelay())+ 1n );

        const vote1 = await gover.connect(user1).castVoteWithReason(proposalId, 1, "Like It");
        await vote1.wait();
        const vote2 = await gover.connect(user2).castVoteWithReason(proposalId, 1, "Don't Like");
        await vote2.wait();
        
        await mine(await gover.votingPeriod() + 1n );
    })
    it("Proposal is queued after success", async function() {
        const state1 = await gover.state(proposalId)     
        expect(state1).to.eq(4);
        
        const queueTx = await gover.queue(
            targets,
            values,
            calldatas,
            descriptionHash
        );
        await queueTx.wait();    
        
        const state2 = await gover.state(proposalId)     
        expect(state2).to.eq(5);
    })
    it("Can not execute before timelock delay", async function() {
        const queueTx = await gover.queue(
            targets,
            values,
            calldatas,
            descriptionHash
        );
        await queueTx.wait(); 

        await expect(gover.connect(user1).execute(targets, values, calldatas, descriptionHash)
            ).to.be.revertedWithCustomError(timelock, "TimelockUnexpectedOperationState");
    })
    it("executes after delay and transfers ETH", async function() {
        const queueTx = await gover.queue(
            targets,
            values,
            calldatas,
            descriptionHash
        );
        await queueTx.wait(); 

        await time.increase(await timelock.getMinDelay() + 1n);

        const executeTx = await gover.connect(user1).execute(targets, values, calldatas, descriptionHash);
        await executeTx.wait();

        expect(await gover.state(proposalId)).to.eq(7) //Executed
    })
})
