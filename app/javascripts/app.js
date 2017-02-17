var accounts;
var account;

var whalegame = Whalegame.deployed();

function setStatus(message) {
  var status = document.getElementById("status");
  status.innerHTML = message;
};

function play() {

  var risk = parseInt(document.getElementById("risk").value);
  var amount = parseInt(document.getElementById("amount").value);


  whalegame.play(risk, {from: account, value: amount}).then(function() {
      setStatus("Transaction complete!");
    }).catch(function(e) {
      console.log(e);
      setStatus("Error; see log.");
    });
};

function redeem() {
  setStatus("Redeeming prize... (please wait)");

  whalegame.redeem({from: account}).then(function() {
    setStatus("Transaction complete!");
  }).catch(function(e) {
    console.log(e);
    setStatus("Error; see log.");
  });
};

var event = whalegame.newWhale();

// watch for changes
event.watch(function(error, result){
    // result will contain various information
    // including the argumets given to the Deposit
    // call.
    if (!error)
        console.log(result);
});


window.onload = function() {
  web3.eth.getAccounts(function(err, accs) {
    if (err != null) {
      alert("There was an error fetching your accounts.");
      return;
    }

    if (accs.length == 0) {
      alert("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
      return;
    }

    accounts = accs;
    account = accounts[0];

    refreshBalance();
  });
}
