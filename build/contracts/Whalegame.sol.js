var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("Whalegame error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("Whalegame error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("Whalegame contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of Whalegame: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to Whalegame.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: Whalegame not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "default": {
    "abi": [
      {
        "constant": false,
        "inputs": [
          {
            "name": "_blocksToElapse",
            "type": "uint256"
          }
        ],
        "name": "setBlocksToElapse",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_riskTimeAdvantage",
            "type": "bool"
          }
        ],
        "name": "setRiskTimeAdvantage",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "withdraw",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "kill",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "riskPercent",
            "type": "uint256"
          }
        ],
        "name": "play",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_feePercent",
            "type": "uint256"
          }
        ],
        "name": "setFeePercent",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "currentGameRules",
        "outputs": [
          {
            "name": "blocksToElapse",
            "type": "uint256"
          },
          {
            "name": "feePercent",
            "type": "uint256"
          },
          {
            "name": "riskTimeAdvantage",
            "type": "bool"
          },
          {
            "name": "minRisk",
            "type": "uint256"
          },
          {
            "name": "stepPercent",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "whale",
        "outputs": [
          {
            "name": "whaleAddress",
            "type": "address"
          },
          {
            "name": "blockNumber",
            "type": "uint256"
          },
          {
            "name": "amount",
            "type": "uint256"
          },
          {
            "name": "riskPercent",
            "type": "uint256"
          },
          {
            "name": "redeemed",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "checkGameOver",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "redeem",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "killSign",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "deposit",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_minRisk",
            "type": "uint256"
          }
        ],
        "name": "setMinRisk",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_stepPercent",
            "type": "uint256"
          }
        ],
        "name": "setStep",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "payable": false,
        "type": "fallback"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "whaleAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "blockNumber",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "amount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "riskPercent",
            "type": "uint256"
          }
        ],
        "name": "newWhale",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "whaleAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "blockNumber",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "amount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "riskPercent",
            "type": "uint256"
          }
        ],
        "name": "whaleHasWon",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x60606040526015600c556002600d55600e805460ff199081166001179091556005600f55601180549091169055600a60125534610000575b610715806100466000396000f300606060405236156100b45763ffffffff60e060020a6000350416631a69e91481146100ca578063278b0ad9146100dc5780632e1a7d4d146100f057806341c0e1b5146101025780636898f82b146101115780637ce3489b1461011e57806397d0d0fe14610130578063a6a1858f14610168578063aaecc9cf146101ac578063be040fb0146101cd578063cefeef34146101dc578063d0e30db0146101eb578063df720a45146101f5578063f8dcbddb14610207575b34610000576100c85b6100c5610219565b5b565b005b34610000576100c86004356102ae565b005b34610000576100c860043515156102d3565b005b34610000576100c8600435610301565b005b34610000576100c8610392565b005b6100c86004356103be565b005b34610000576100c86004356104c1565b005b346100005761013d6104e6565b6040805195865260208601949094529115158484015260608401526080830152519081900360a00190f35b34610000576101756104fe565b60408051600160a060020a039096168652602086019490945284840192909252606084015215156080830152519081900360a00190f35b34610000576101b961051f565b604080519115158252519081900360200190f35b34610000576100c8610219565b005b34610000576100c861053f565b005b6100c861056b565b005b34610000576100c8600435610576565b005b34610000576100c860043561059b565b005b600061022361051f565b8015610232575060055460ff16155b156102a95760045460065461024c919060649004026105c0565b60006006819055600154604051929350600160a060020a03169183156108fc0291849190818181858888f19350505050158061028a575060055460ff165b1561029457610000565b6005805460ff191660011790556102a96105f0565b5b5b50565b60005433600160a060020a039081169116146102c957610000565b600c8190555b5b50565b60005433600160a060020a039081169116146102ee57610000565b600e805460ff19168215151790555b5b50565b60005433600160a060020a0390811691161461031c57610000565b60105481111561035c57601054604051600160a060020a0333169180156108fc02916000818181858888f19350505050151561035757610000565b6102a9565b604051600160a060020a0333169082156108fc029083906000818181858888f1935050505015156102a957610000565b5b5b5b50565b60005433600160a060020a039081169116146103ad57610000565b600054600160a060020a0316ff5b5b565b60006103c861051f565b1515610449576103df60016002015460125461066b565b6003540134111561043f576103f382610678565b6103fd348361066b565b6006805482019055604051909150600160a060020a033316903483900380156108fc02916000818181858888f19350505050151561043a57610000565b610444565b610000565b6104ba565b610451610219565b61045f60065460125461066b565b600654013411156104ba5761047382610678565b61047d348361066b565b6006805482019055604051909150600160a060020a033316903483900380156108fc02916000818181858888f1935050505015156104ba57610000565b5b5b5b5050565b60005433600160a060020a039081169116146104dc57610000565b600d8190555b5b50565b600754600854600954600a54600b5460ff9092169185565b600154600254600354600454600554600160a060020a039094169360ff1685565b6007546002546000910143106105375750600161053b565b5060005b5b90565b60005433600160a060020a0390811691161461055a57610000565b6011805460ff191660011790555b5b565b60068054340190555b565b60005433600160a060020a0390811691161461059157610000565b600f8190555b5b50565b60005433600160a060020a039081169116146105b657610000565b60128190555b5b50565b60006105ce82600d5461066b565b601080549091019055600d546105e890839060640361066b565b90505b919050565b6040805160a081018252600c54808252600d5460208301819052600e5460ff161515938301849052600f546060840181905260125460809094018490526007929092556008556009805460ff1916909317909255600a91909155600b5560105461066590600160a060020a03301631036105c0565b6006555b565b6064820481025b92915050565b6040805160a081018252600160a060020a0333168082524360208301819052349383018490526060830185905260006080909301929092526001805473ffffffffffffffffffffffffffffffffffffffff1916909117905560025560035560048190556005805460ff191690555b505600a165627a7a723058206f1028cf0091c656ef7f675426de57f203e4805546400670f8755626760fdbf20029",
    "events": {
      "0xba4d9021056133648ae10acdda9028f460a9c83faf0588070ce139862319b178": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "whaleAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "blockNumber",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "amount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "riskPercent",
            "type": "uint256"
          }
        ],
        "name": "newWhale",
        "type": "event"
      },
      "0x7399081cbd70f699d2954cf1c836bfb806666a0bf1c28bd11774f1d8f962afd9": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "whaleAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "blockNumber",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "amount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "riskPercent",
            "type": "uint256"
          }
        ],
        "name": "whaleHasWon",
        "type": "event"
      }
    },
    "updated_at": 1483611205003,
    "links": {},
    "address": "0x3b7fbf33ab309a9ff2ba279481d34bc2161ae83a"
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "Whalegame";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.Whalegame = Contract;
  }
})();
