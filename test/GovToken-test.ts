import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { GoverToken } from "../typechain-types";
import { deployFixture } from "./Deploy-test";

describe("Governance Token (ERC20Votes)", function() {
    let admin:SignerWithAddress;
    let user1:SignerWithAddress;
    let user2:SignerWithAddress;
    let token:GoverToken;

    beforeEach( async function() {
        const fixture = await deployFixture();
        admin = fixture.admin;
        user1 = fixture.user1;
        user2 = fixture.user2;
        token = fixture.token;
    })
    it("Minted corectly initial supply to owner", async function() {
        expect(await token.balanceOf(admin.address)).to.eq(ethers.parseEther("100000"));
        expect(await token.totalSupply()).to.eq(ethers.parseEther("100000"));
    })
    it("Delegate voting power correctly", async function() {
        await token.transfer(user1.address, ethers.parseEther("10000"));
        await token.connect(user1).delegate(user1.address);
        expect(await token.getVotes(user1.address)).to.eq(ethers.parseEther("10000"));
    })
    it("Checkpoining works (snapshot voting power)", async function() {
        await token.transfer(user1.address, ethers.parseEther("10000"));
        await token.transfer(user2.address, ethers.parseEther("20000"));

        await token.connect(user1).delegate(user1.address);
        await token.connect(user2).delegate(user2.address);
        await token.connect(admin).delegate(user1.address);

        expect(await token.numCheckpoints(user1)).to.eq(2n);
        expect(await token.numCheckpoints(user2)).to.eq(1n)
    })
    it("Can not delegate to zero address", async function() {
        await expect(token.connect(user1).delegate(ethers.ZeroAddress))
            .to.be.revertedWith("Cannot delegate to zero address");
    })
})