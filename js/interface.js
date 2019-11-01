// Code that runs the client side based FiatDex gateway

var detectMetamask = false; // Default value is that metamask is not on the system
var metamaskConnected = false;
var userAddress = "";
var contractAddress = "0xa5a9B6a783D17C15822D3e70dbb1E59D736284eF";
var refreshTime = 0;
var gameOver = false; // Becomes true when time is out
var deadlineTime = 0;

var targetNetwork = "1"; // Use Rinkeby for now

// Contract function keccak hashes
var contract_lottoDetails = "178524e3";
var contract_addEntry = "a3db3500";
var contract_claim = "a6072328";

$( document ).ready(function() {
    // This is ran when the page has fully loaded
    checkMetaMaskExist();
    $("#contract_link").html(contractAddress);
    $("#contract_link").attr("href","https://etherscan.io/address/"+contractAddress);
});

function checkMetaMaskExist(){
	// This function checks if MetaMask is installed or not on the browser
	if (typeof window.ethereum !== 'undefined') {
		// Web3 exists, detect if metamask
		if(ethereum.isMetaMask == true){
			detectMetamask = true;
			$("#metamask_interactive").html("Connect MetaMask To Participate");
		}
	}
}

function metamaskButtonClick(){
	// Based on whether metamask is available or not, the button click will vary
	if(detectMetamask == false){
		var win = window.open('https://metamask.io/', '_blank');
	}else if(detectMetamask == true && metamaskConnected == false){
		// Try to connect to MetaMask
		ethereum.enable()
		// Remember to handle the case they reject the request:
		.catch(function (reason) {
			console.log(reason);
		})
		.then(function (accounts) {
			if (ethereum.networkVersion !== targetNetwork) {
				// Not equal to the mainnet, let user know to switch
				alert('This application requires the main network, please switch it in your MetaMask UI.')
			}
			userAddress = accounts[0]; // We have an account now (ETH address)
			metamaskConnected = true;
			updateLottoWindow(); // Update the Lotto Window immediately with blockchain info
			$("#metamask_interactive").html("MetaMask Connected");
			ethereum.on('accountsChanged', function (accounts) {
				userAddress = accounts[0]; // Update the userAddress when the account changes
			})
		})
	}
}

function padleftzero(str, max){
  str = str.toString();
  return str.length < max ? padleftzero("0" + str, max) : str;
}

function padrightzero(str, max){
  str = str.toString();
  return str.length < max ? padrightzero(str + "0", max) : str;
}

function updateLottoWindow(){
	// This is ran every second and will update certain windows when appropriate
	if(metamaskConnected == false){return;} // Do not try to load from blockchain if metamask is not connected
	if(gameOver == true){return;} // Game is over, no need to refresh it

	refreshTime = refreshTime - 1;
	if(refreshTime <= 0){
		// Time to refresh, query the blockchain
		// Obtain all the lottery information in one call: entry cost (ETH), potsize (ETH), last address (0x), deadline time (sec)
		refreshTime = 10; // The default refresh rate is every 10 seconds

		if (ethereum.networkVersion === targetNetwork) {
			// Only query network if on same network
			const callParameters = [{
			  to: contractAddress,
			  data: '0x'+contract_lottoDetails
			},"latest"];

			//Get data from blockchain
			ethereum.sendAsync({
			  method: 'eth_call',
			  params: callParameters,
			  id: "1",
			  jsonrpc: "2.0"
			}, function (err, result) {
				if(!err){
					if(!result["error"]){
						var lotto_data = result["result"].substring(2); // Remove the 0x

						// Break down the lotto data
						// entry cost (ETH), potsize (ETH), last address (0x), deadline time (sec)
						var entry_cost_wei = new BigNumber('0x'+lotto_data.substring(0,64));
						var pot_size_wei = new BigNumber('0x'+lotto_data.substring(64,64*2));
						var last_address = lotto_data.substring(64*2,64*3).toLowerCase();
						deadlineTime = new BigNumber('0x'+lotto_data.substring(64*3,64*4));

						// Based on the lotto data, we will determine what the user sees
						var formatted_userAddress = padleftzero(userAddress.substring(2),64).toLowerCase(); // Match case as well
						// Convert wei into eth
						var divfactor = new BigNumber('1000000000000000000'); // Divide factor to get ETH
						var entry_cost = entry_cost_wei.div(divfactor);
						var pot_size = pot_size_wei.div(divfactor);

						if($("#game_info").css('display') == 'none'){
							// Show the game window
							$("#game_info").show();
							$("#game_info_preview").hide();						
						}

						var current_time = Math.floor((new Date).getTime()/1000); // Get the current time in seconds
						var countdownTime = deadlineTime - current_time;

						if(formatted_userAddress == last_address){
							// Color the window to me
							$("#last_person").html("You");
							$("#last_person_container").css("color","rgb(82,249,11)");
							$("#last_person_container").css("border","1px solid rgb(82,249,11)");
						}else{
							$("#last_person").html("Not You");
							$("#last_person_container").css("color","red");
							$("#last_person_container").css("border","1px solid red");
						}

						$("#pot_size").html(pot_size.toString(10)); // Populate the pot size
						$("#current_cost").html(entry_cost.toString(10)); // Add the current cost
						
						if(countdownTime <= 0){
							// The lottery is over
							gameOver = true;
							$("#time_remain").html("Ended");
							$("#entry_container").hide(); // Game is over, prevent additional entries
							if(pot_size == 0){
								// Winner has taken out winnings
								$("#widthdraw_container").show();
								$("#claim_detail").html("Winner has already claimed the lottery");
								$("#claim_button").hide();
							}else{
								// Winner hasn't claimed yet
								if(formatted_userAddress == last_address){
									// I am the winner
									$("#widthdraw_container").show();
								}
							}
						}else{
							if(countdownTime < 10){
								refreshTime = countdownTime - 1;
								if(refreshTime < 1){refreshTime = 1;}
							}else{
								refreshTime = 10;
							}
							adjustCountDown();
						}

					}else{
						console.log("RPC error: "+result["error"]);
					}
				}else{
					console.log("An error occurred while pinging blockchain");
				}
			});
		}
	}

	$("#refresh_time").html(refreshTime);
	adjustCountDown();
	window.setTimeout(updateLottoWindow,1000);
}

function adjustCountDown(){
	if(deadlineTime == 0){return;} // Time has expired
	var current_time = Math.floor((new Date).getTime()/1000); // Get the current time in seconds
	var countdownTime = deadlineTime - current_time;
	if(countdownTime < 0){countdownTime = 0;}

	var hours = Math.floor(countdownTime / (60 * 60));
	var minutes = Math.floor((countdownTime % (60 * 60)) / (60));
	var seconds = Math.floor(countdownTime % 60);

	$("#time_remain").html(padleftzero(hours,2)+":"+padleftzero(minutes,2)+":"+padleftzero(seconds,2));
}

function tryAddEntry(){
	// Person pressed to add a new entry to the lotto
	var entry_cost = new BigNumber($("#current_cost").html());

	var entry_cost_wei = entry_cost.multipliedBy("1000000000000000000"); // Get as wei
	if(entry_cost_wei == 0){return;}

	const transactionParameters = [{
	  to: contractAddress,
	  gasPrice: '0x218711A00',
	  gas: '0x30D40',
	  from: userAddress,
	  value: entry_cost_wei.toString(16), // Convert to Hex
	  data: '0x'+contract_addEntry
	}];

	sendETHTransaction(transactionParameters);
}

function tryClaim(){
	// The winner is trying to claim the lotto balance
	var current_time = Math.floor((new Date).getTime()/1000); // Get the current time in seconds
	var countdownTime = deadlineTime - current_time;
	if(countdownTime > -300){
		// The winner must wait at least 5 minutes before claiming the pool
		alert("You must wait at least 5 minutes from lottery end to claim prize.");
		return;
	}

	const transactionParameters = [{
	  to: contractAddress,
	  gasPrice: '0x218711A00',
	  gas: '0x30D40',
	  from: userAddress,
	  data: '0x'+contract_claim
	}];

	sendETHTransaction(transactionParameters);
}

function sendETHTransaction(transactionParameters){
	// This is a generic function to send ETH to the contract
	if (ethereum.networkVersion !== targetNetwork) {
		// Not equal to the mainnet, let user know to switch
		alert('This application requires the main network, please switch it in your MetaMask UI.')
		return;
	}

	ethereum.sendAsync({
	  method: 'eth_sendTransaction',
	  params: transactionParameters,
	  from: userAddress
	}, function (err, result) {
		if(!err){
			if(!result["error"]){
				console.log("Transaction hash: "+result["result"]);
				statusChanged = true; // Force update of status
			}else{
				console.log("RPC error: "+result["error"]);
			}
		}else{
			console.log("An error occurred while pinging blockchain");
		}
	});
}