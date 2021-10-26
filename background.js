/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

//const
const CLOCKABLE_URL = /^(http|file)/i;
const BLOCKABLE_URL = /^(http|file|about)/i;
const TICK_TIME = 1000; // update every second

// vars
var gTabs = [];
var gOptions = {};
// var gSetCounted = [];
var gFocusWindowId = 0;
var gAutosavingCount = 0;
var gGotOptions = false;

function log(message) {console.log("[LBNG] " + message)};
function warn(message) {console.warn("[LBNG] " + message)};

// initialize object to track tab (returns false if already initialized)
function initTab(id) {
	if (gTabs[id]) {
		return false;
	} else {
		gTabs[id] = {
			allowedHost: null,
			allowedPath: null,
			allowedSet: 0,
			url: "about:blank"
		};
		return true;
	}
}

// retrieve options from local storage
//
function gotOptions(options){
    let jsonIP = awaitResponse('http://ip-api.com/json');
  
    jsonIP.then(values => {
		if (values != undefined){
			let jsonTime = awaitResponse('http://worldtimeapi.org/api/timezone/' + values.timezone);
			
			jsonTime.then(values => {
				if (values != undefined){

					browser.storage.local.get().then(onGot, onError);

					function onGot(options) {
						//log(listObjectProperties(options, "options"));
						gGotOptions = true;
						
						for (let n = 0; n <= NUM_SETS; n++) {
							gOptions = checkOptionsStructure(checkTime(n, options, values));
						}
					}
				
					function onError(error) {
						gGotOptions = false;
						warn("Cannot get options: " + error);
					}
				}
			});
    	}
    });
}

// Save time data to local storage
//
function saveData(options) {
	//log("saveData");
	let lOptions = {};
	
	for (section of Object.keys(options)){
		if (options[section] !== undefined && options[section] !== [] && options[section] !== {}){
			lOptions[section] = options[section];
		}
	}

	if(lOptions !== {}){
		browser.storage.local.set(lOptions);
	}

}

// Update ID of focused window
//
function updategFocusWindowId() {
	browser.windows.getLastFocused().then(
		function (win) {gFocusWindowId = win.id;},
		function (error) {
			warn("Cannot get focused window: " + error); 
		}
	);
}

function isIn(n, host, sign) {
	return gOptions['weekends'][n][new Date().getDay()] && gOptions['sites'][n][sign].includes(host);
}

function blockSitesTimeSpend(n, remove = false) {
	let secs = 0;

	for (url in gOptions['data']) {
		if (isIn(n,url,'+')) {
	
			//log('blockSitesTimeSpend: ' + url + ' / ' + gOptions['data'][url]);
	
			if (remove){
				delete gOptions['data'][url];
			} else {
				secs = secs + gOptions['data'][url];
			}
		}
	}

	if (!remove){
		return secs;
	}
}

function isInIteration(host, sign){

	for (let n = 0; n <= NUM_SETS; n++) {
		let isInBool = isIn(n, host, sign);
		//log('isIn; ' + isInBool + ' n: ' + n + ' host: ' + host + ' | sign: ' + sign);
		
		if (isInBool) {
			return {'boolean':true,'n':n};
			break;
		}
	}

	return {'boolean':false};
}

function rotateValues(n){
	
	blockSitesTimeSpend(n, true);
	let options = {'data':gOptions['data'],'secs':gOptions['secs'],'sites':gOptions['sites']};

	for (option of ['secs','sites']){
		let allow = gOptions[option][n]['+'];
		let block = gOptions[option][n]['-'];
		
		for (section of ['+','-']){
			options[option][n][section] = (section == '+') ? block : allow;
		}
	}

	saveData(options);
}

// Check the URL of a tab and applies block if necessary (returns true if blocked)
//
function checkTab(id, isRepeat) {
	
	function isSameHost(host1, host2) {
		return (host1 == host2)
				|| (host1 == "www." + host2)
				|| (host2 == "www." + host1);
	}

	let url = gTabs[id].url;
	//log("checkTab: " + id + " " + url + " " + isRepeat);
	
	gTabs[id].blockable = BLOCKABLE_URL.test(url);
	gTabs[id].clockable = CLOCKABLE_URL.test(url);

	// Quick exit for about:blank
	if (!gTabs[id].blockable || url == "about:blank") {
		return false; // not blocked
	}

	// Get parsed URL for this page
	let parsedURL = getParsedURL(regexURL(url,false));

	if (!gTabs[id]) {
		// Create object to track this tab
		gTabs[id] = {allowedHost: null, allowedPath: null};
	}

	let allowHost = isSameHost(gTabs[id].allowedHost, parsedURL.host);
	let allowPath = !gTabs[id].allowedPath || (gTabs[id].allowedPath == parsedURL.path);
	let allowSet = gTabs[id].allowedSet;

	if (!allowHost || !allowPath) {
		// Allowing delayed site/page no longer applies
		gTabs[id].allowedHost = null;
		gTabs[id].allowedPath = null;
		gTabs[id].allowedSet = 0;
	}
	
	let host = parsedURL.host;;
	if (gOptions['data'][host] == undefined || isNaN(gOptions['data'][host])){gOptions['data'][host] = 0};
	
	let isIn = isInIteration(host,'-');
	
	if (isIn['boolean']){
		if(blockSitesTimeSpend(isIn['n']) < gOptions['secs'][isIn['n']]['+']){
			browser.tabs.update(id, {url: 'about:blank'});
			return false;
		}
	}else {
		let isIn = isInIteration(host,'+');
		
		if (isIn['boolean']){
			let n = isIn['n'];

			if(blockSitesTimeSpend(n) >= gOptions['secs'][n]['+']){
				// log(gOptions['exchange'][n]);

				if (gOptions['exchange'][n]){
					rotateValues(n);
					return false;
				}
			}
		}
	}
	
	return true;
}

// clock time spent on page
function clockPageTime(id, focus) {
	if (!gTabs[id]) {
		return;
	}

	if (!gTabs[id].clockable) {
		gTabs[id].focusTime = undefined;
		return;
	}

	// Get current time in milliseconds
	let time = Date.now();

	// Clock time during which page has been focused
	let secsFocus = 0;
	if (focus) {
		if (gTabs[id].focusTime == undefined) {
			// Set focus time for this page
			gTabs[id].focusTime = time;
		}
	} else {
		if (gTabs[id].focusTime != undefined) {
			// Calculate seconds spent on this page (while focused)
			secsFocus = ((time - gTabs[id].focusTime) / 1000);

			gTabs[id].focusTime = undefined;
		}
	}

	// Update time data if necessary
	if (secsFocus > 0) {
		updateTimeData(gTabs[id].url, secsFocus);
	}
}

// update time data for specified page
function updateTimeData(url, secsFocus) {
	//log("updateTimeData: " + url + " " + secsFocus);
	
	let host = getParsedURL(regexURL(url,false)).host;
	let isIn = isInIteration(host,'+');
	
	if (isIn['boolean']){
		// get number of seconds spent on page (focused)
		gOptions['data'][host] = +gOptions['data'][host] + secsFocus;
	}
}

function updateTimer(id){

	if (!gTabs[id] || !gTabs[id].clockable) {
		return;
	}

	let host = getParsedURL(regexURL(gTabs[id].url,false)).host;
	let isIn = isInIteration(host,'+');

	if (isIn['boolean']){
		let message = {type: "timeleft"};
		let secs = gOptions['data'][host];

		if (secs == undefined || blockSitesTimeSpend(isIn['n']) > gOptions['secs'][isIn['n']]['+']) {
			message.content = null; // hide widget
		} else {
			message.content = formatTime(secs); // show widget with time left
			browser.tabs.sendMessage(id, message).catch(function (error) {});
		}
	}
}

function processTabs(active) {
	// gSetCounted = []; // reset
	
	browser.tabs.query({}).then(onGot, onError);

	function onGot(tabs) {
		for (let tab of tabs) {
			initTab(tab.id);

			let focus = tab.active && (!gFocusWindowId || tab.windowId == gFocusWindowId);

			// Force update of time spent on this page
			clockPageTime(tab.id, false);
			clockPageTime(tab.id, focus);

			if (checkTab(tab.id, true) && tab.active) {
				updateTimer(tab.id);
			}
		}
	}

	function onError(error) {
		warn("Cannot get tabs: " + error);
	}
}

/*** EVENT HANDLERS BEGIN HERE ***/

function handleClick(tab) {
	//log("handleClick: " + tab.id);
	browser.runtime.openOptionsPage();	
}

function handleMenuClick(info, tab) {
	let id = info.menuItemId;
	if (id == "options") {
		browser.runtime.openOptionsPage();
	}
}

function handleTabCreated(tab) {
	//log("handleTabCreated: " + tab.id);

	initTab(tab.id);

	if (tab.openerTabId) {
		// Inherit properties from opener tab
		gTabs[tab.id].allowedHost = gTabs[tab.openerTabId].allowedHost;
		gTabs[tab.id].allowedPath = gTabs[tab.openerTabId].allowedPath;
		gTabs[tab.id].allowedSet = gTabs[tab.openerTabId].allowedSet;
	}
}

function handleTabUpdated(tabId, changeInfo, tab) {
	//log("handleTabUpdated: " + tabId);

	initTab(tabId);

	if (!gGotOptions) {
		return;
	}

	let focus = tab.active && (!gFocusWindowId || tab.windowId == gFocusWindowId);

	if (changeInfo.url) {
		gTabs[tabId].url = changeInfo.url;
	}

	if (changeInfo.status && changeInfo.status == "complete") {
		clockPageTime(tab.id, focus);

		if (checkTab(tab.id, false) && tab.active) {
			updateTimer(tab.id);
		}
	}
}

function handleTabActivated(activeInfo) {
	let tabId = activeInfo.tabId;
	//log("handleTabActivated: " + tabId);

	initTab(tabId);

	if (!gGotOptions) {
		return;
	}

	//process all tabs to ensure time counted correctly
	processTabs(false);
}

function handleTabRemoved(tabId, removeInfo) {
	//log("handleTabRemoved: " + tabId);

	if (!gGotOptions) {
		return;
	}

	clockPageTime(tabId, false);
}

function handleBeforeNavigate(navDetails) {
	let tabId = navDetails.tabId;
	//log("handleBeforeNavigate: " + tabId);

	initTab(tabId);

	if (!gGotOptions) {
		return;
	}

	clockPageTime(tabId, false);

	if (navDetails.frameId == 0) {
		gTabs[tabId].url = navDetails.url;
		let blocked = checkTab(tabId, false);
	}
}

function handleWinFocused(winId) {
	//log("handleWinFocused: " + winId);
	gFocusWindowId = winId;
}

function onInterval() {
	//log("onInterval");

	if (!gGotOptions) {
		gotOptions();
	} else {
		processTabs(true);

		if (++gAutosavingCount >= 10) {
			saveData({'data':gOptions['data']});
			gAutosavingCount = 0;
		}
	}
}

/*** STARTUP CODE BEGINS HERE ***/

browser.browserAction.onClicked.addListener(handleClick);

browser.menus.onClicked.addListener(handleMenuClick);

//browser.tabs.onCreated.addListener(handleTabCreated);
browser.tabs.onUpdated.addListener(handleTabUpdated);
browser.tabs.onActivated.addListener(handleTabActivated);
browser.tabs.onRemoved.addListener(handleTabRemoved);

browser.webNavigation.onBeforeNavigate.addListener(handleBeforeNavigate);

browser.windows.onFocusChanged.addListener(handleWinFocused);

window.setInterval(onInterval, TICK_TIME);