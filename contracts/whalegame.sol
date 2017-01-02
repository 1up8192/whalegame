pragma solidity ^0.4.6;

contract Whalegame {
    address owner;
    Whale public whale;
    uint curentPool;
    CurrentGameRules public currentGameRules;
    uint blocksToElapse = 21; // 21 blocks ~5 min
    uint feePercent = 2;
    bool riskTimeAdvantage = true;
    
    struct Whale {
        address whaleAddress;
        uint blockNumber;
        uint amount;
        uint riskPercent;
    }
    
    struct CurrentGameRules{
        uint blocksToElapse;
        uint feePercent;
        bool riskTimeAdvantage;
    }
    
    modifier onlyOwner{
        if(msg.sender != owner){
            throw;
        }
        _;
    }
    
    function  checkGameOver() returns (bool){
        if (block.number >= whale.blockNumber + currentGameRules.blocksToElapse){
            return true;
        } else {
            return false;
        }
    }
    
    function updateWhale() private{
        //TODO
    }
    
    function updateGame() private{
        //TODO
    }
    
    function () payable{
        
    }
    
    function redeem(){
        
    }
}
