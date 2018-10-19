'use strict';

const HDWalletProvider = require("truffle-hdwallet-provider-privkey");
const privKeys = ['']; // private keys

module.exports = {
  networks: {
    local: {
      host: 'localhost',
      port: 9545,
      gas: 5000000,
      network_id: '*'
    },
    test: {
      host: 'localhost',
      port: 8545,
      gas: 5000000,
      network_id: '*'
    },
    rinkeby: {
      provider: () => new HDWalletProvider(privKeys, 'https://rinkeby.infura.io/yktiedHZ01xXSmrWNlVi'),
      network_id: 4,
      gas: 3000000,
      gasPrice: 4000000000
    }
  }
};
