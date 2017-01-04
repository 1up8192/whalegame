pragma solidity ^0.4.7;

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
        bool redeemed;
    }
    
    struct CurrentGameRules{
        uint blocksToElapse;
        uint feePercent;
        bool riskTimeAdvantage;
        uint minRisk;
        uint stepPercent;
    }
    
    modifier onlyOwner{
        if(msg.sender != owner){
            throw;
        }
        _;
    }
    
    event newWhale(address whaleAddress, uint blockNumber, uint amount, uint riskPercent);
    event whaleHasWon(address whaleAddress, uint blockNumber, uint amount, uint riskPercent);
    
    function  checkGameOver() returns (bool){
        if (block.number >= whale.blockNumber + currentGameRules.blocksToElapse){
            return true;
        } else {
            return false;
        }
    }
    
    function updateWhale(uint riskPercent) private{
        whale = Whale(msg.sender, block.number, msg.value, riskPercent, false);
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
    
    function percent(uint amount, uint percent) private returns (uint){
        return amount / 100 * percent;
    }
    
    function applyFee(uint amount) private returns (uint){
        myStash += percent(amount, feePercent);
        return percent(amount, (100 - feePercent));
    }
    
    function updateGame() private{
        currentGameRules = CurrentGameRules(blocksToElapse, feePercent, riskTimeAdvantage, minRisk, stepPercent);
        currentPool = applyFee(this.balance - myStash);
    }
    
    function play (uint riskPercent) payable{
        uint risk;
        if(!checkGameOver()){
            if (msg.value > whale.amount + percent(whale.amount, stepPercent)){
                updateWhale(riskPercent);
                risk = percent(msg.value, riskPercent);
                currentPool += risk;
                if(!msg.sender.send(msg.value-risk)){
                    throw;
                }
            } else {
                throw;
            }
        } else {
            redeem();
            if (msg.value > currentPool + percent(currentPool, stepPercent)){
                updateWhale(riskPercent);
                risk = percent(msg.value, riskPercent);
                currentPool += risk;
                if(!msg.sender.send(msg.value-risk)){
                    throw;
                }
            } 
        }
    }
    
    function (){
        redeem();
    }
    
    function redeem(){
        if (checkGameOver() && !whale.redeemed){
            uint reward = applyFee(currentPool / 100 * whale.riskPercent);
            currentPool = 0; //safety
            if( !whale.whaleAddress.send(reward) || whale.redeemed ){
                throw;
            } //todo: check how to protect against recursive call attack 
            whale.redeemed = true;
            updateGame();
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
    
    function setStep(uint _stepPercent) onlyOwner {
        stepPercent = _stepPercent;
    }
    
}
