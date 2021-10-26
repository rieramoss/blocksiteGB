/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. 
*/
var alertIsActivate = false;

function log(message) {console.log("[LBNG] " + message);}
function warn(message) {console.warn("[LBNG] " + message);}

// save options to local storage
function saveOptions(options){

	browser.storage.local.set(options);
	// Notify extension that options have been updated
	browser.runtime.sendMessage({condition: "options"}).catch(function (error) {});
	
	$("#form").hide({effect: "fade", complete: retrieveOptions});
	$("#form").show({effect: "fade"});
}

function alertStatus(message){
	if(!alertIsActivate){
		alertIsActivate = true;
		alert(message);
	}
};

function checkSites(n, site, duplicated){
	let message = (site !== '' && !duplicated)
				? `(blokset ${n}) '${site}' is a invalid site URL/path`
				: (site !== '' && duplicated)
				? `(blokset ${n}) '${site}' is duplicated, check the block(s)`
				: ''
	;

	if (message == ''){
		return true;
	} else{
		alertStatus(message);
		return false;
	}
}

function checkInputs(n, values, exchange){

	function checkExchange(){
		return (exchange['checked'])
			? (!checkPosIntFormat(exchange['mins']))
				? `(blokset ${n}) enter a valid mins number for blocked sites`
				: (exchange['mins'] > values['mins'])
					? `(blokset ${n}) block mins cannot be major of mins for productive sites`
					: ''
			: ''
		;
	};

	let message = (!checkPosIntFormat(values.time))
				? `(blokset ${n}) enter a valid 24-hour format for day start`
				: (!checkPosIntFormat(values['mins']))
				? `(blokset ${n}) enter a valid mins number for productive sites`
				: (values.weekend.length <= 0)
				? `(blokset ${n}) must select a week day`
				: (values.sites['-'] == '')
				? `(blokset ${n}) must introduce site(s) to block`
				: (values.sites['+'] == '')
				? `(blokset ${n}) must introduce based productivity site(s) to unblock sites`
				: checkExchange();
	;

	if (message == ''){
		return true;
	} else{
		alertStatus(message);
		return false;
	}
}

function preSaveOptions() {
	alertIsActivate = false;
	let AreValidOpts = false;
	let options = checkOptionsStructure({});

	// Check format for text fields
	for (let n = 0; n <= NUM_SETS; n++) {
		
		let aMins = document.querySelector(`#aMins${n}`).value;
		let sites = document.querySelector(`#sites${n}`).value.split(/\s+/);

		if(sites.length > 1){
			sites = getParsedSites(sites);
			
			if(checkSites(n,sites.invalid,false)){
				sites = sites.sites;
				
				if(checkSites(n,checkRepeatSites(options['sites'], sites),true)){

					let weekend = [];
					for (let i = 0; i < 7; i++) {
						weekend[i] = document.querySelector(`#day${i}${n}`).checked;
					}
					
					let time = document.querySelector(`#time${n}`).value;
					let bMins = document.querySelector(`#bMins${n}`).value;
					let exchange = document.querySelector(`#exchange${n}`).checked;

					if(checkInputs(n,{sites:sites,weekend:weekend,'mins':aMins,time:time},{'checked':exchange,'mins':bMins})){

						options['weekends'][n] = weekend;
						options['exchange'][n] = exchange;

						options['time'][n] = time;

						for (let sign of ['-','+']){
							options['sites'][n][sign] = sites[sign];
						}

						for (sign of ['+','-']){
							options['secs'][n][sign] = (sign == '+') ? aMins * 60 :
																				(exchange)
																				? bMins * 60 
																				: (checkPosIntFormat(bMins))
																					? bMins * 60
																					: ''
							;
						}

						if (!AreValidOpts){
							AreValidOpts = true;
						}
					}
				}
			}
		} else if(aMins !== ''){
			alertStatus('first, must introduce the sites')
		}
	}

	if (AreValidOpts){
		saveOptions(options);
	}
}

function setSites(n, sites){
	if(sites['-'].length > 0){
		let parsedSites = {'-':[],'+':[]};

		for(let sign of ['-','+']){
			for (let site of sites[sign]) {
				parsedSites[sign].push(((sign == '+') ? '+':'') + regexURL(site,true));
			}
		}
		
		document.querySelector(`#sites${n}`).value = parsedSites['-'].join(' ') + ' ' + parsedSites['+'].join(' ');
	}
}

// retrieve options from local storage
function retrieveOptions() {
	//log("retrieveOptions");
	browser.storage.local.get().then(onGot, onError);

	function onGot(options) {

		options = checkOptionsStructure(options);

		function checkMinutes(mins){
			return (mins == '') ? '' : mins / 60;
		}

		for (let n = 0; n <= NUM_SETS; n++) {

			setSites(n,options['sites'][n]);

			for (sign of ['+','-']){
				document.querySelector(`#${(sign == '+') ? 'a' : 'b'}Mins${n}`).value = checkMinutes(options['secs'][n][sign]);
			}

			document.querySelector(`#exchange${n}`).checked  = options['exchange'][n];
			document.querySelector(`#time${n}`).value  = options['time'][n];

			let weekend = options['weekends'][n];
			for (let i = 0; i < 7; i++) {
				document.querySelector(`#day${i}${n}`).checked = weekend[i];
			}
		}
	}

	function onError(error) {
		warn("Cannot get options: " + error);
	}
}

/*** STARTUP CODE BEGINS HERE ***/

// Use HTML for first block n to create other block sets
let blockSetHTML = $("#panes").html();
for (let n = 1; n <= NUM_SETS; n++) {
	let nextBlockSetHTML = blockSetHTML
			.replace(/b0/g, `b${n}`)
			.replace(/(id|for)="(\w+)0"/g, `$1="$2${n}"`);

	$("#panes").append(nextBlockSetHTML);
}

// Set up JQuery UI widgets
$("#panes").accordion({
	collapsible: false,
	heightStyle: "content"
});

for (let n = 0; n <= NUM_SETS; n++) {
	$(`#showAdvOpts${n}`).click(function (e) {
		$(`#showAdvOpts${n}`).css("display", "none");
		$(`#advOpts${n}`).css("display", "block");
	});
}

$("#saveOptions").button();
$("#saveOptions").click(preSaveOptions);

$("#form").show();
document.addEventListener("DOMContentLoaded", retrieveOptions);