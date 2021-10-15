/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. 
*/
var alertIsActivate = false;
var isFadeEffectAct = false;
function log(message) { console.log("[LBNG] " + message); }
function warn(message) { console.warn("[LBNG] " + message); }

// save options to local storage
function saveOptions(options){
	browser.storage.local.set(options);
	// Notify extension that options have been updated
	browser.runtime.sendMessage({ condition: "options" }).catch(function (error) {});

	if (!isFadeEffectAct){
		isFadeEffectAct = true;
		$("#form").hide({ effect: "fade", complete: retrieveOptions });
		$("#form").show({ effect: "fade" });
	}
	
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

function checkInputs(n, values){
	let message = (!checkPosIntFormat(values.mins))
				? `(blokset ${n}) enter a valid mins number`
				: (values.weekend.length <= 0)
				? `(blokset ${n}) must select a week day`
				: (values.sites['block'] == '')
				? `(blokset ${n}) must introduce site(s) to block`
				: (values.sites['allow'] == '')
				? `(blokset ${n}) must introduce based productivity site(s) to unblock sites`
				: ''
	;

	if (message == ''){
		return true;
	} else{
		alertStatus(message);
		return false;
	}
}

function setSites(n, sites){
	if(sites.block.length > 0 && sites.allow.length > 0){
		let parsedSites = {'block':[],'allow':[]};

		for(let condition of ['block','allow']){
			for (let site of sites[condition]) {
				parsedSites[condition].push(((condition == 'block') ? '-':'') + regexURL(site,true));
			}
		}
		
		document.querySelector(`#sites${n}`).value = parsedSites['block'].join(' ') + ' ' + parsedSites['allow'].join(' ');
	}
}

function preSaveOptions() {
	let options = checkOptionsStructure({});
	alertIsActivate = false;

	// Check format for text fields
	for (let n = 0; n <= NUM_SETS; n++) {
		// get field values
		let mins = document.querySelector(`#mins${n}`).value;
		let sites = document.querySelector(`#sites${n}`).value.split(/\s+/);
		if(sites.length > 1){
			sites = getParsedSites(sites);
			console.log(sites);
			if(checkSites(n,sites.invalid,false)){
				sites = sites.sites;
				if(checkSites(n,checkRepeatSites(options['sites'], sites),true)){

					let weekend = [];
					for (let i = 0; i < 7; i++) {
						weekend[i] = document.querySelector(`#day${i}${n}`).checked;
					}
					
					if(checkInputs(n,{sites:sites, weekend: weekend, mins: mins})){
						
						for (let condition of ['block','allow']){
							// set regular expressions to match sites
							options['sites'][n][condition] = sites[condition];
						}
						
						options['weekends'][n]= weekend;
						options['secs'][n] = mins * 60;

						saveOptions(options);
					}
				}
			}
		} else if(mins !== ''){alertStatus('first, must introduce the sites')}
	}
	isFadeEffectAct = false;
}

// Retrieve options from local storage
//
function retrieveOptions() {
	//log("retrieveOptions");

	browser.storage.local.get().then(onGot, onError);

	function onGot(options) {
		checkOptionsStructure(options);
		
		for (let n = 0; n <= NUM_SETS; n++) {
			
			setSites(n,options['sites'][n]);

			let weekend = options['weekends'][n];
			for (let i = 0; i < 7; i++) {
				document.querySelector(`#day${i}${n}`).checked = weekend[i];
			}

			let mins = options['secs'][n];
			document.querySelector(`#mins${n}`).value = (mins == '') ? '' : mins / 60;
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

$("#saveOptions").button();
$("#saveOptions").click(preSaveOptions);

$("#form").show();
document.addEventListener("DOMContentLoaded", retrieveOptions);