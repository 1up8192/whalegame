var Whalegame = artifacts.require("./Whalegame.sol");

contract('Whalegame', function(accounts){
  it("deployer should become owner", function() {
    return Whalegame.deployed().then(function(instance) {
        var wg = instance;
        return wg.owner.call(accounts[0]);
    }).then(function(owner) {
      assert.equal(owner, accounts[0], "deployer should be owner");
    });
  });

  it("valid first player is whale", function() {
    var wg;
    return Whalegame.deployed().then(function(instance) {
        wg = instance;
        wg.play.sendTransaction({from: accounts[0], value: 1000000000});
    }).then(function(){
        console.log("hi1")
        return wg.whale.call(accounts[0]);
    }).then(function(whale) {
      console.log("hi2");

      console.log(JSON.stringify(whale));
      assert.equal(whaleAddress, accounts[0], "valid first player should be new whale");
    });
  });

  /*it("should become the new whale", function(){
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
      assert.equal(address.toString, accounts[0].toString, "addresses should be equal");
    });
  });*/
});
