/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const NUM_SETS = 9;

function checkOptionsStructure(options){
	for (let n = 0; n <= 2; n++){
		let vars = [['dataset','date'],['secs','weekends'],['sites']][n];
		
		for (let i = 0; i <= vars.length-1; i++){
			let section = vars[i];
           
			if (options[section] == undefined){
				options[section] = (n == 0) ? [{},getDateString()][i]: [];
                
				if (n > 0){
                    for (let x = 0; x <= NUM_SETS; x++){
						let localIndex = n-1;
                        values = [['',[false,true,true,true,true,true,false]],[{'allow':[],'block':[]}]];      
                        options[section].push(values[localIndex][i]);
                    };
                };
            }
		}
	}
	return options;
}

function getDateString(){
	return new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
}

function redefinedTimesVars(options){
	if (options['date'] == undefined || getDateString() > options['date'] || getDateString() < options['date']){

		options['date'] = undefined;
		options['dataset'] = undefined;

	}
	
	return options;
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
	let allows = [];
	let blocks = [];

	for (let site of arary){
		if(site !== ''){
			if(site.charAt(0) == "-"){
				let parsedSite = getParsedURL(regexURL(site.substr(1),false)).host;
				if(parsedSite == null || isValidURL(parsedSite)){
					blocks.push(parsedSite);
				} else {
					if (invalids == ''){
						invalids = site;
						break;
					}
				}
			} else {
				let parsedSite = getParsedURL(regexURL(site,false)).host;
				if(parsedSite == null || isValidURL(parsedSite)){
					allows.push(parsedSite);
				} else {
					if (invalids == ''){
						invalids = site;
						break;
					}
				}
			}
		}
	}

	return {
		sites:{block:blocks,allow:allows},
		invalid:invalids
	};
}

function toFindDuplicates(arry){
    return arry.filter((item, index) => arry.indexOf(item) !== index);
}
  
function checkRepeatSites(database, sites){
	let invalid = '';
	for (let condition of ['block','allow']){
		for (let site of sites[condition]){
			for (let n = 0; n <= 0; n++){
				if(database[n][condition].includes(site)){
					invalid = site;
					break;		
				}
			}
			if(invalid == ''){
				let duplicatedItems = toFindDuplicates(sites[condition]);
				if(duplicatedItems.length > 0
				   || sites[(condition == 'block')  ? 'allow' : 'block' ].includes(site)){
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
				&& /^[A-Za-z][A-Za-z0-9]*/.test(site)
					&& (/\.([\s\S]{2})$/.test(site) || /\.([\s\S]{3})$/.test(site)));
}

// Check positive integer format
//
function checkPosIntFormat(value){
	return /^[1-9][0-9]*$/.test(value);
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