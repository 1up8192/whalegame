var accounts;
var account;

function setStatus(message) {
  var status = document.getElementById("status");
  status.innerHTML = message;
};

function play() {
  var whalegame = Whalegame.deployed();

  var risk = parseInt(document.getElementById("risk").value);

  whalegame.play(risk, {from: account}).then(function() {
      setStatus("Transaction complete!");
    }).catch(function(e) {
      console.log(e);
      setStatus("Error; see log.");
    });
};

function redeem() {
  var whalegame = Whalegame.deployed();

  setStatus("Redeeming prize... (please wait)");

  whalegame.redeem({from: account}).then(function() {
    setStatus("Transaction complete!");
  }).catch(function(e) {
    console.log(e);
    setStatus("Error; see log.");
  });
};

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
