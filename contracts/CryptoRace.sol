pragma solidity 0.4.24;

import "zos-lib/contracts/migrations/Migratable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract CryptoRace is Ownable, Migratable {
    uint constant MAX_PLAYERS = 6;
    
    struct Track {
        uint duration;
        uint betAmount;
        uint maxPlayers;
        uint numPlayers;
    }
    
    struct Rate {
        bytes32 name;
        uint amount;
    }
    
    struct Portfolio {
        bytes32 name;
        uint value;
    }
    
    mapping(bytes32 => Track) public tracks;
    mapping(bytes32 => uint) public start;
    
    mapping(bytes32 => mapping(uint => address)) public playerAddresses;
    mapping(bytes32 => mapping(address => bool)) public playersInTrack;
    mapping(bytes32 => mapping(address => Portfolio[])) public portfolios;
    
    mapping(uint => mapping(bytes32 => uint)) public rates;
    
    event CreateTrack(bytes32 _id, uint _maxPlayers, uint _betAmount, uint _duration);
    event Transfer(address addr, uint amount);

    modifier nonExistsTrack(bytes32 _id) {
        require(tracks[_id].duration == 0);
        _;
    }
    
    modifier existsTrack(bytes32 _id) {
        require(tracks[_id].duration != 0);
        _;
    }
    
    modifier joinAllowed(bytes32 _id) {
        require(tracks[_id].maxPlayers != tracks[_id].numPlayers);
        _;
    }
    
    modifier validDuration(uint _duration) {
        require(_duration > 0);
        _;
    }
    
    modifier validMaxPlayers(uint _maxPlayers) {
        require(_maxPlayers >= 2);
        _;
    }
    
    modifier validBetAmount(uint _betAmount) {
        require(_betAmount > 0);
        _;
    }
    
    modifier validDeposite(bytes32 _id, uint _deposite) {
        require(tracks[_id].betAmount == _deposite);
        _;
    }
    
    modifier validPortfolio(bytes32[] _names, uint[] _amounts) {
        require(_names.length == _amounts.length, "Non equal length names and amounts");
        require(_names.length == 5, "Required 5 element of portfilio");
        _;
    }

    function initialize() isInitializer("CryptoRace", "0") public {}
    
    function getName() public view returns(string) {
        return "CryptoRace";
    }

    // track section
    function createTrack(bytes32 _id, uint _maxPlayers, uint _betAmount, uint _duration) 
        external
        nonExistsTrack(_id)
        validDuration(_duration)
        validMaxPlayers(_maxPlayers)
    {
        tracks[_id] = Track(_duration, _betAmount, _maxPlayers, 0);
        emit CreateTrack(_id, _maxPlayers, _betAmount, _duration);
    }
    
    function joinToTrack(bytes32 _id, bytes32[] _names, uint[] _amounts, uint _start)
        external payable
        existsTrack(_id)
        validDeposite(_id, msg.value)
        validPortfolio(_names, _amounts)
        joinAllowed(_id)
    {
        bytes32 trackId = _id;
        require(!playersInTrack[trackId][msg.sender]);

        uint numPlayers = tracks[trackId].numPlayers;
        playerAddresses[trackId][numPlayers] = msg.sender;
        playersInTrack[trackId][msg.sender] = true;
        
        _setPortfolio(_id, msg.sender, _names, _amounts);
        
        tracks[trackId].numPlayers++;
        
        if (_start > 0) {
            start[trackId] = _start;
        }
    }
    
    function finishTrack(bytes32 _id, bytes32[] _names, uint[] _startRates, uint[] _endRates) external {
        for (uint i = 0; i < _names.length; i++) {
            rates[start[_id]][_names[i]] = _startRates[i];
            rates[start[_id] + tracks[_id].duration][_names[i]] = _endRates[i];
        }
        
        address[] memory winners = getWinners(_id);
        
        uint reward = (tracks[_id].betAmount * tracks[_id].numPlayers) / winners.length;
        
        for (i = 0; i < winners.length; i++) {
            winners[i].transfer(reward);
            emit Transfer(winners[i], reward);
        }
    }
    
    function getPortfolio(bytes32 _trackId, address _addr) public view returns (bytes32[], uint[]) {
        bytes32[] memory n = new bytes32[](5);
        uint[] memory v = new uint[](5);
          
        for (uint i = 0; i < 5; i++) {
          n[i] = portfolios[_trackId][_addr][i].name;
          v[i] = portfolios[_trackId][_addr][i].value;
        }
          
        return(n, v);
    }
    
    function _setPortfolio(bytes32 _id, address _player, bytes32[] _names, uint[] _amounts) internal {
        for (uint i = 0; i < _names.length; i++) {
            portfolios[_id][_player].push(Portfolio(_names[i], _amounts[i]));
        }
    }
    
    
    function getWinners(bytes32 _trackId) public view returns (address[]) {
        (address[] memory players, int[] memory points) = getStats(_trackId);
    
        uint i = 0;
        uint w_min = 0;
        int tmpI;
        address tmpA;
    
        for(uint pos = 0; pos < points.length - 1; pos++) {
          w_min = pos;
          for(i = pos; i < points.length; i++) {
            if(points[i] < points[w_min]) {
              w_min = i;
            }
          }
          if(w_min == pos) continue;
          tmpI = points[pos];
          points[pos] = points[w_min];
          points[w_min] = tmpI;
    
          tmpA = players[pos];
          players[pos] = players[w_min];
          players[w_min] = tmpA;
        }
    
        // i = 0;
        uint count = countWinners(points);
        address[] memory winners = new address[](count);
    
        // for (pos = players.length - 1; pos >= players.length - count; pos--) {
        //   winners[i++] = players[pos];
        // }
        uint ind = points.length - 1;

        for (pos = 0; pos < count; pos++) {
            winners[pos] = players[ind--];
        }
    
        return winners;
    }
    
    function getStats(bytes32 _trackId) public view returns (address[], int[]) {
        Track memory t = tracks[_trackId];
        address[] memory players = new address[](t.numPlayers);
        int[] memory points = new int[](t.numPlayers);
    
        for (uint i = 0; i < t.numPlayers; i++) {
           players[i] = playerAddresses[_trackId][i];
           points[i] = getStat(_trackId, players[i]);
        }
    
        return (players, points);
    }
    
    function getStat(bytes32 _id, address _player) public view returns (int) {
        int points = 0;
        uint startTime = start[_id];
        uint endTime = start[_id] + tracks[_id].duration;
        (bytes32[] memory names, uint[] memory amounts) = getPortfolio(_id, _player);
        
        uint[] memory ratesAtStart = getRates(names, startTime);
        uint[] memory ratesAtEnd = getRates(names, endTime);
    
        for (uint i = 0; i < names.length; i++) {
          points += int(ratesAtEnd[i] / ratesAtStart[i] * 100000 * amounts[i]);
        }
    
        return points;
    }
    
    function getRates(bytes32[] _names, uint _time) view public returns (uint[]) {
        uint[] memory r = new uint[](_names.length);
        for (uint i = 0; i < _names.length; i++) {
            r[i] = rates[_time][_names[i]];
        }
        
        return r;
    }
    
    function countWinners(int[] memory _points) internal returns (uint) {
        uint count = _points.length;
        for (uint i = 0; i < _points.length; i++) {
            if (_points[i] == _points[_points.length - 1]) {
                return count;
            } else {
                count--;
            }
        }
    
        return count;
    }
}
