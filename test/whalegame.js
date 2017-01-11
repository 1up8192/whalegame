contract('Whalegame', function(accounts){
  it("deployer should become owner", function(){
    var wg = Whalegame.deployed();
    var owner;
    wg.owner.call().then(function(_owner){
      owner = _owner;
      assert.equal(account[0].toString, owner.toString, "addresses should be equal");
    });
  });
  it("should become the new whale", function(){
    var wg = Whalegame.deployed();
    var lastAmount;
    var step;

    wg.whale.amount.call().then(function(amount){
      lastAmount = amount.toNumber();
      return wg.stepPercent.call();
    }).then(function(_step){
      step = _step.toNumber();
      wg.play({from: accounts[0], value: lastAmount + step + 1});
    }).then(function(){
      return wg.whale.whaleAddress.call();
    }).then(function(address){
      assert.equal(account[0].toString, address.toString, "addresses should be equal");
    });
  });
});
