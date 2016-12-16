pragma solidity ^0.4.6;

contract Whalegame {
    address owner;
    Whale public whale;
    uint currentPool; //in wei
    CurrentGameRules public currentGameRules;
    uint blocksToElapse = 21; // 21 blocks ~5 min
    uint feePercent = 2;
    bool riskTimeAdvantage = true;
    uint minRisk = 5;
    uint myStash;
    bool killAfterRound = false;
    uint stepPercent = 10;
    
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
        uint minRisk;
        uint step;
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
    
    function updateWhale(uint riskPercent) private{
        whale = Whale(msg.sender, block.number, msg.value, riskPercent);
    }
    
    function forceRiskRange(uint riskPercent) private returns(uint){
        if (riskPercent > 100){
            return 100;
        }
        if(riskPercent < minRisk) {
            return minRisk;
        }
        return riskPercent;
    }
    
    function applyFee(uint amount) private returns (uint){
        myStash += amount / 100 * feePercent;
        return amount / 100 * (100 - feePercent);
    }
    
    function updateGame() private{
        currentGameRules = CurrentGameRules(blocksToElapse, feePercent, riskTimeAdvantage, minRisk, step);
        currentPool = applyFee(this.balance - myStash);
    }
    
    function () payable{
        if(!checkGameOver()){
            
        } else {
            redeem();
        }
    }
    
    function redeem(){
        if (checkGameOver()){
            bool redeemed = false;
            uint reward = applyFee(currentPool / 100 * whale.riskPercent);
            currentPool = 0; //safety
            if( !redeemed && !whale.whaleAddress.send(reward) ){
                throw;
            } //todo: check how to protect against recursive call attack 
            redeemed = true;
        }
    }
    
    function withdraw(uint amount) onlyOwner{
        if (amount > myStash){
            if(!msg.sender.send(myStash)){
                throw;
            }
        } else {
            if(!msg.sender.send(amount)){
                throw;
            }
        }
    }
    
    function killSign() onlyOwner{
        killAfterRound = true;
    }
    
    function kill() onlyOwner{
        suicide(owner);
    }
    
    function deposit() payable{
        currentPool += msg.value;
    }
    
    function setBlocksToElapse(uint _blocksToElapse) onlyOwner {
        blocksToElapse = _blocksToElapse;
    }
    function setFeePercent(uint _feePercent) onlyOwner {
        feePercent = _feePercent;
    }
    function setRiskTimeAdvantage(bool _riskTimeAdvantage) onlyOwner {
        riskTimeAdvantage = _riskTimeAdvantage;
    }
    function setMinRisk(uint _minRisk) onlyOwner {
        minRisk = _minRisk;
    }
    
    function setStep(uint _step) onlyOwner {
        step = _step;
    }
    
}
