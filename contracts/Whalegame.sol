pragma solidity ^0.4.7;

contract Whalegame {
    address public owner;
    Whale public whale;
    uint public currentPool; //in wei
    CurrentGameRules public currentGameRules;
    uint public blocksToElapse = 21; // 21 blocks ~5 min
    uint public feePercent = 2;
    bool public riskTimeAdvantage = true; //TODO
    uint public minRisk = 5;
    uint public maxRisk = 90;
    uint public myStash;
    bool public killAfterRound = false;
    uint public stepPercent = 10;

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
        uint maxRisk;
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

    function Whalegame (){
        owner = msg.sender;
    }

    function  checkGameOver() constant returns (bool){
        if (whale.blockNumber != 0 && block.number >= whale.blockNumber + currentGameRules.blocksToElapse){
            return true;
        } else {
            return false;
        }
    }

    function getWhaleAddress() constant returns (address){
      return whale.whaleAddress;
    }

    function updateWhale(uint riskPercent) private{
        whale = Whale(msg.sender, block.number, msg.value, riskPercent, false);
    }

    function forceRiskRange(uint riskPercent) constant private returns(uint){
        if (riskPercent > maxRisk){
            return maxRisk;
        }
        if(riskPercent < minRisk) {
            return minRisk;
        }
        return riskPercent;
    }

    function percent(uint amount, uint percent) constant private returns (uint){
        return amount / 100 * percent;
    }

    function applyFee(uint amount) private returns (uint){
        myStash += percent(amount, feePercent);
        return percent(amount, (100 - feePercent));
    }

    function updateGame() private{
        currentGameRules = CurrentGameRules(blocksToElapse, feePercent, riskTimeAdvantage, minRisk, maxRisk, stepPercent);
        currentPool = applyFee(this.balance - myStash);
    }

    function takeRiskedAmountAndRefundRest (uint riskPercent) private {
      uint risk = percent(msg.value, riskPercent);
      currentPool += risk;
      if(!msg.sender.send(msg.value-risk)){
          throw;
      }
    }

    function play (uint riskPercent) payable{
        uint forcedRiskPercent = forceRiskRange(riskPercent);
        if(!checkGameOver()){
            if (msg.value > whale.amount + percent(whale.amount, stepPercent)){
                updateWhale(forcedRiskPercent);
                takeRiskedAmountAndRefundRest (forcedRiskPercent);
            } else {
                throw;
            }
        } else {
            redeem();
            if (msg.value > currentPool + percent(currentPool, stepPercent)){
                updateWhale(forcedRiskPercent);
                takeRiskedAmountAndRefundRest (forcedRiskPercent);
            } else {
                throw;
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

    function setMaxRisk(uint _maxRisk) onlyOwner {
        minRisk = _maxRisk;
    }

    function setStep(uint _stepPercent) onlyOwner {
        stepPercent = _stepPercent;
    }

}
