const should = require('chai').should();

const { decodeLogs, Logger, App, AppDeployer, Contracts } = require('zos-lib')

const CryptoRace = Contracts.getFromLocal('CryptoRace');
const CryptoRaceSC = artifacts.require('CryptoRace');

contract('App', ([_, owner, aWallet, someone, anotherone]) => {

  const initialVersion = '0.1.0';
  const contractName = 'CryptoRace';

  const txParams = {
    from: owner
  };

  describe('setup', function() {

    beforeEach(async function() {
      this.app = await App.deploy(initialVersion, txParams);
    });

    describe('package', function() {

      describe('when queried for the initial version', function() {

        it('claims to have it', async function() {
          (await this.app.package.hasVersion(initialVersion)).should.be.true;
        });
      });

      // describe('when queried for the updated version', function() {

      //   it('doesnt claim to have it', async function() {
      //     (await this.app.package.hasVersion(updatedVersion)).should.be.false;
      //   });
      // });
    });
  });

  describe('version 0.1.0', function() {

    beforeEach(async function() {
      this.app = await App.deploy(initialVersion, txParams);
      await this.app.setImplementation(CryptoRace, contractName);
      this.cryptoRace = await this.app.createProxy(CryptoRace, contractName, 'initialize');
      this.cryptoRaceSC = await CryptoRaceSC.new();
    });

    it('returns valid name', async function () {
      const name = await this.cryptoRaceSC.getName();
      expect(name).to.equal('CryptoRace');
    });

    it('create track', async function () {
      const id = web3.toHex(web3.sha3('6e58599f-80b0-448f-a1a4-6a6fe629a52b'));
      const maxPlayers = web3.toBigNumber(2);
      const betAmount = web3.toBigNumber(1000);
      const duration = web3.toBigNumber(100);

      await this.cryptoRaceSC.createTrack(id, maxPlayers, betAmount, duration);
      const track = await this.cryptoRaceSC.tracks(id);

      expect(track[0].eq(web3.toBigNumber(100)));
      expect(track[1].eq(web3.toBigNumber(1000)));
      expect(track[2].eq(web3.toBigNumber(2)));
      expect(track[3].eq(web3.toBigNumber(0)));
    });

    it('join to track', async function () {
      const id = web3.toHex(web3.sha3(Date.now()));
      const maxPlayers = web3.toBigNumber(2);
      const betAmount = web3.toBigNumber(1000);
      const duration = web3.toBigNumber(100);

      await this.cryptoRaceSC.createTrack(id, maxPlayers, betAmount, duration, {from: aWallet});

      const names = [web3.fromAscii('btc'), web3.fromAscii('eth'), web3.fromAscii('bch'), web3.fromAscii('ltc'), web3.fromAscii('xrp')];
      const amounts1 = [web3.toBigNumber(20), web3.toBigNumber(30), web3.toBigNumber(10), web3.toBigNumber(20), web3.toBigNumber(20)];
      const amounts2 = [web3.toBigNumber(10), web3.toBigNumber(40), web3.toBigNumber(10), web3.toBigNumber(20), web3.toBigNumber(20)];
      await this.cryptoRaceSC.joinToTrack(id, names, amounts2, web3.toBigNumber(0), {from: aWallet, value: web3.toBigNumber(1000)});
      await this.cryptoRaceSC.joinToTrack(id, names, amounts1, web3.toBigNumber(100), {from: someone, value: web3.toBigNumber(1000)});

      const address1 = await this.cryptoRaceSC.playerAddresses(id, web3.toBigNumber(0));
      const address2 = await this.cryptoRaceSC.playerAddresses(id, web3.toBigNumber(0));
      const start = await this.cryptoRaceSC.start(id);
      
      expect(address1 === aWallet);
      expect(address2 === someone);
      expect(start.eq(web3.toBigNumber(100)));
    });

    it('finish track', async function () {
      const id = web3.toHex(web3.sha3(Date.now()));
      const maxPlayers = web3.toBigNumber(2);
      const betAmount = web3.toBigNumber(1000);
      const duration = web3.toBigNumber(100);

      await this.cryptoRaceSC.createTrack(id, maxPlayers, betAmount, duration, {from: aWallet});

      const names = [web3.fromAscii('btc'), web3.fromAscii('eth'), web3.fromAscii('bch'), web3.fromAscii('ltc'), web3.fromAscii('xrp')];
      const amounts1 = [web3.toBigNumber(20), web3.toBigNumber(30), web3.toBigNumber(10), web3.toBigNumber(20), web3.toBigNumber(20)];
      const amounts2 = [web3.toBigNumber(0), web3.toBigNumber(50), web3.toBigNumber(10), web3.toBigNumber(20), web3.toBigNumber(20)];
      await this.cryptoRaceSC.joinToTrack(id, names, amounts2, web3.toBigNumber(0), {from: aWallet, value: web3.toBigNumber(1000)});
      await this.cryptoRaceSC.joinToTrack(id, names, amounts1, web3.toBigNumber(100), {from: someone, value: web3.toBigNumber(1000)});

      const startRates = [web3.toBigNumber(5000), web3.toBigNumber(100), web3.toBigNumber(300), web3.toBigNumber(100), web3.toBigNumber(100)];
      const endRates = [web3.toBigNumber(6000), web3.toBigNumber(250), web3.toBigNumber(200), web3.toBigNumber(150), web3.toBigNumber(220)];

      const balance1Before = await web3.eth.getBalance(aWallet);
      const balance2Before = await web3.eth.getBalance(someone);

      await this.cryptoRaceSC.finishTrack(id, names, startRates, endRates, {from: anotherone});

      const balance1After = await web3.eth.getBalance(aWallet);
      const balance2After = await web3.eth.getBalance(someone);

      console.log(balance1Before.minus(balance1After).toNumber());
      console.log(balance2Before.minus(balance2After).toNumber());

      console.dir(await this.cryptoRaceSC.getPortfolio(id, web3.toHex('0x41abfd975e6e38e890ba3f37ebefa99e731962e4')));
      console.dir(await this.cryptoRaceSC.getPortfolio(id, web3.toHex('0x8c945430d2e6b497dee5aa1c1c967bc135346c20')));

      console.dir(await this.cryptoRaceSC.getStat(id, web3.toHex('0x41abfd975e6e38e890ba3f37ebefa99e731962e4')));
      console.dir(await this.cryptoRaceSC.getStat(id, web3.toHex('0x8c945430d2e6b497dee5aa1c1c967bc135346c20')));
    });

    // describe('directory', function() {

    //   describe('when queried for the implementation', function() {

    //     it('returns a valid address', async function() {
    //       validateAddress(await this.app.directories[initialVersion].getImplementation(contractName)).should.be.true;
    //     });
    //   });
    // });

    // describe('implementation', function() {
    //   shouldBehaveLikeBasil(owner, aWallet, someone, anotherone);
    // });
  });

});
