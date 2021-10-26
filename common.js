/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const NUM_SETS = 9;

function checkOptionsStructure(options){
	let sections = ['data','time','exchange','sites','secs','weekends'];

	for (let section of sections){

		if (options[section] == undefined){

			//log('checkOptionsStructure: ' + section);
			options[section] = (section == 'data') ? {} : [];

			if (section !== 'data'){
				for (let n = 0; n <= NUM_SETS; n++){
					let vars = ['0000',false,{'+':[],'-':[]},{'+':'','-':''},[false,true,true,true,true,true,false]];
					options[section].push(vars[(sections.indexOf(section) - 1)]);
				};
			}
		}
	}

	/*log(`													options
	data ${options['data']}
	exchange ${options['exchange']}
	sites ${options['sites']}
	secs ${options['secs']}
	weekends ${options['weekends']}
	time ${options['time']}
	`);
	*/
	return options;
}

function processDatetime(datetime){
	for (let regExp of [/[^\T]*$/g, /[0-9]*:.*?(\:)/g]){
		datetime = regExp.exec(datetime);
	}
	
	return datetime[0].replace(/:/g,'');
}

function checkTime(n, options, values){
	let day = values.day_of_year;
	
	if (options['time'] == undefined){
		options['time'] = [];

		for (let n = 0; n <= NUM_SETS; n++){
			options['time'].push('0000');
		}
	}

	if (options['date'] == undefined){
		options['date'] = day;
	}

	if (day > options['date'] && options['time'] >= processDatetime(values.datetime)){
		options['data'] = {};
	}
	
	return options;
}

async function gFetch(resource, options = {}) {
    const { timeout = 8000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(resource, {
        ...options,
        signal: controller.signal  
    });


    clearTimeout(id);
    return response;
}
  
async function awaitResponse(site) {
    try {
        const response = await gFetch(site, {timeout:8000});
        const json = await response.json();
        return json;
    } catch (error) {
        // timeouts if the request takes longer than 8 seconds
        log(error);
    }
}

// Return parsed URL (page address, arguments, and hash)
//
function getParsedURL(url){
	
	let parsedURL = /^((([\w-]+):\/*(\w+(?::\w+)?@)?([\w-\.]+)(?::(\d*))?)([^\?#]*))(\?[^#]*)?(#.*)?$/;
	let results = parsedURL.exec(url);

	if (results != null){
		let page = results[1];
		// let origin = results[2];
		// let protocol = results[3];
		// let userinfo = results[4];
		let host = results[5];
		// let port = results[6];
		let path = results[7];
		let query = results[8];
		let fragment = results[9];
		return {
			// pageNoArgs: page,
			page: (query == null) ? page : (page + query),
			// origin: origin,
			// protocol: protocol,
			host: host,
			path: path,
			// query: query,
			// args: (query == null) ? null : query.substring(1).split(/[;&]/),
			hash: (fragment == null) ? null : fragment.substring(1)
		};
	} else {
		warn("Cannot parse URL: " + url);
		return {
			// pageNoArgs: null,
			page: null,
			// origin: null,
			// protocol: null,
			host: null,
			path: null,
			// query: null,
			// args: null,
			hash: null
		};
	}
}

// create regular expressions for matching sites to block/allow
function getParsedSites(arary){
	let invalids = '';
	let allow = [];
	let block = [];

	for (let site of arary){
		if(site !== ''){
			if(site.charAt(0) == "+"){
				let parsedSite = getParsedURL(regexURL(site.substr(1),false)).host;
				if(parsedSite == null || isValidURL(parsedSite)){
					allow.push(parsedSite);
				} else {
					if (invalids == ''){
						invalids = site;
						break;
					}
				}
			} else {
				let parsedSite = getParsedURL(regexURL(site,false)).host;
				if(parsedSite == null || isValidURL(parsedSite)){
					block.push(parsedSite);
				} else {
					if (invalids == ''){
						invalids = site;
						break;
					}
				}
			}
		}
	}

	return {sites:{'+':allow,'-':block}, invalid:invalids};
}

function toFindDuplicates(arry){
    return arry.filter((item, index) => arry.indexOf(item) !== index);
}
  
function checkRepeatSites(database, sites){

	let invalid = '';
	for (let sign of ['-','+']){
		for (let site of sites[sign]){
			for (let n = 0; n <= 0; n++){
				if(database[n][sign].includes(site)){
					invalid = site;
					break;
				}
			}
			if(invalid == ''){
				let duplicatedItems = toFindDuplicates(sites[sign]);
				if(duplicatedItems.length > 0
				   || sites[(sign == '-')  ? '+' : '-' ].includes(site)){
					invalid = (duplicatedItems.length > 0) ? duplicatedItems[0] : site ;
					break;
				}
			}
		}
		if(invalid !== ''){break}
	}
	return invalid;
}

// convert site site to regular expression
function regexURL(site, dotCom){
	
	let includesDomain = /\.([\s\S]{3})$/.test(site);

	if (dotCom && (site.includes('.com') && includesDomain)){
		site = site.replace(/\.([\s\S]{3})$/g, '');
	} else{
		site = site.replace(/(^ +)|( +$)/g,'')	// remove existing first or last whitespace
				      .replace(/[w]{3}\./g,'') // remove 'www' prefix
		;
	}

	return (dotCom) ? site : ((/\w+:\/+/.test(site)) ? '' : 'https://')
							 + site
							 + ((/\.([\s\S]{2})$/.test(site) || includesDomain) ? '' : '.com');
}

function isValidURL(site){
	site.replace(/\w+:\/+/g,'');
	return (/.+?(?=\.)/.test(site)
				&& /^[A-Za-z0-9]*/.test(site)
					&& (/\.([\s\S]{2})$/.test(site) || /\.([\s\S]{3})$/.test(site)));
}

// Check positive integer format
//
function checkPosIntFormat(mins){
	return /^\d*$/.test(mins) && mins !== 00;
}

function checkTimePeriodsFormat(time) {
	time = time.replace(/:/g,'');
	return /^[0-2][0-3][0-5]\d*$/.test(time) && time !== 0000;
}

// Format a time in seconds to HH:MM:SS format
//
function formatTime(secs){
	let neg = (secs < 0);
	secs = Math.abs(secs);
	let h = Math.floor(secs / 3600);
	let m = Math.floor(secs / 60) % 60;
	let s = Math.round(Math.floor(secs) % 60);
	return (neg ? "-" : '') + ((h < 10) ? "0" + h : h)
			+ ":" + ((m < 10) ? "0" + m : m)
			+ ":" + ((s < 10) ? "0" + s : s);
}

// Determine whether all items in array evalate to true
//
function allTrue(array){
	if (Array.isArray(array)){
		for (let i = 0; i <= array.length; i++){
			if (!array[i]) return false;
		}
		return true;
	} else {
		return false;
	}
}