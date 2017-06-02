// Import the page's CSS. Webpack will know what to do with it.
import "../stylesheets/app.css";

// Import libraries we need.
import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'

// Import our contract artifacts and turn them into usable abstractions.
import whalegame_artifacts from '../../build/contracts/Whalegame.json'

// WhaleGame is our usable abstraction, which we'll use through the code below.
var Whalegame = contract(whalegame_artifacts);

// The following code is simple to show off interacting with your contracts.
// As your needs grow you will likely need to change its form and structure.
// For application bootstrapping, check out window.addEventListener below.
var accounts;
var account;

function createDataCell(content){
  var cell = document.createElement("td");
  cell.textContent = content;
  return cell;
}

function createHeaderCell(content){
  var cell = document.createElement("th");
  cell.textContent = content;
  return cell;
}

function addDataRow(table, columnList){
  var row = document.createElement("tr");
  columnList.map(createDataCell).forEach((cell) => {
    row.appendChild(cell);
  })
  table.appendChild(row);
}

function addHeaderRow(table, columnHeaderList){
  var row = document.createElement("tr");
  columnHeaderList.map(createHeaderCell).forEach((cell) => {
    row.appendChild(cell);
  })
  table.appendChild(row);
}

function limitRows(table, maxRows){
  if(table.rows.length > maxRows + 1){
    table.deleteRow(1);
  }
}


window.App = {
  start: function() {
    var self = this;

    // Bootstrap the WhaleGame abstraction for Use.
    Whalegame.setProvider(web3.currentProvider);

    // Get the initial account balance so it can be displayed.
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

    });
  },

  setStatus: function(message) {
    var status = document.getElementById("status");
    status.innerHTML = message;
  },

  play: function() {
    var self = this;

    var risk = parseInt(document.getElementById("risk").value);
    var amount = parseInt(document.getElementById("amount").value);

    var whalegame;
    Whalegame.deployed().then(function(instance) {
      whalegame = instance;
      return whalegame.play(risk, {from: account, value: amount, gas: 200000});
    }).then(function(reciept) {
      self.setStatus("Transaction complete!");
      console.log("Transaction recpept: \n");
      console.log(reciept);
    }).catch(function(e) {
      console.log(e);
      self.setStatus("Error; see log.");
    });
  },

  redeem: function() {
    var self = this;

    self.setStatus("Redeeming prize... (please wait)");

    var whalegame;
    Whalegame.deployed().then(function(instance) {
      whalegame = instance;
      return whalegame.redeem({from: account});
    }).then(function() {
      self.setStatus("Transaction complete!");
    }).catch(function(e) {
      console.log(e);
      self.setStatus("Error; see log.");
    });
  },

  watchEvent: function(){
    var changesTable = document.getElementById("changes")
    addHeaderRow(changesTable, ["Address", "Block nr.", "Amount", "Risk%"])

    var whalegame;
    Whalegame.deployed().then(function(instance) {
      whalegame = instance;
      var eventGreetingChanged = whalegame.newWhale();
      var maxRowNum = 10;

      // watch for changes
      eventGreetingChanged.watch(function(error, result){
        // result will contain various information
        // including the argumets given to the Deposit
        // call.
        if (!error){
          var whaleAddress = result.args.whaleAddress.valueOf();
          var blockNumber = result.args.blockNumber.valueOf();
          var amount = result.args.amount.valueOf();
          var riskPercent = result.args.riskPercent.valueOf();
          addDataRow(changesTable, [whaleAddress, blockNumber, amount, riskPercent])
          limitRows(changesTable, maxRowNum);
          //changes.innerHTML = "Old: " + oldGreeting + ", New: " + newGreeting + ", Changer: " + changerAddress;
          console.log(result);
        } else {
          console.log(error);
        }
      });
    });
  }
};

window.addEventListener('load', function() {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    console.warn("Using web3 detected from external source. If you find that your accounts don't appear or you have 0 WhaleGame, ensure you've configured that source properly. If using MetaMask, see the following link. Feel free to delete this warning. :) http://truffleframework.com/tutorials/truffle-and-metamask")
    // Use Mist/MetaMask's provider
    window.web3 = new Web3(web3.currentProvider);
  } else {
    console.warn("No web3 detected. Falling back to http://localhost:8545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask");
    // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
  }

  App.start();

  App.watchEvent();
});
