contract('Whalegame', function(accounts){
  it("should become the new whale", function(){
    var wg = Whalegame.deployed();
    var amount;
    var step;

    wg.whale.amount.call().then(function(_amount){
      amount = _amount.toNumber();
      return wg.stepPercent.call();
    }).then(function(_step){
      step = _step.toNumber();
      return wg.play({from: accounts[0], value: amount + step + 1});
    }).then(function(){

    });
  });
});
