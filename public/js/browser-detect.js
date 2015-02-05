/* ***************************************************************** */
/*                                                                   */
/* Licensed Materials - Property of IBM                              */
/*                                                                   */
/* (C) Copyright IBM Corp. 2001, 2014. All Rights Reserved.          */
/*                                                                   */
/* US Government Users Restricted Rights - Use, duplication or       */
/* disclosure restricted by GSA ADP Schedule Contract with IBM Corp. */
/*                                                                   */
/* ***************************************************************** */

/*
This code is made by James Zhang.
This is a very basic browser sniffer.
*/

(function() {

	var userAgent = window.navigator.userAgent;
	// Browser User Agent Strings
	var ie = "MSIE";
	var ie9 = "MSIE 9.0";
	var ie10 = "MSIE 10.0";
	var chrome = "Chrome";
	var firefox = "Firefox/";
	var safari = "Safari";
	// OS User Agent Strings
	var windows = "Windows";
	var mac = "Macintosh";
	var linux = "Linux";

	// class names
	var ie_class = "ie";
	var ie9_class = "ie9";
	var ie10_class = "ie10";
	var ie11_class = "ie11";
	var chrome_class = "chrome";
	var firefox_class = "firefox";
	var safari_class = "safari";
	var windows_class = "windows";
	var mac_class = "mac";
	var linux_class = "linux";
	
	// All matching classes will be appended to classes
	var classes = "";

	// using UserAgent, checking to see which match
	if (userAgent.indexOf(ie) > -1) {
		classes += ie_class + " ";
	}
	if (userAgent.indexOf(ie9) > -1) {
		classes += ie9_class + " ";
	}
	if (userAgent.indexOf(ie10) > -1) {
		classes += ie10_class + " ";
	}
	if (!!navigator.userAgent.match(/Trident.*rv\:11\./)) {
		classes += ie_class + " " + ie11_class + " ";
	}
	if (userAgent.indexOf(safari) > -1 && userAgent.indexOf(chrome) == -1) {
		classes += safari_class + " ";
	}
	if (userAgent.indexOf(chrome) > -1) {
		classes += chrome_class + " ";
	}
	if (userAgent.indexOf(firefox) > -1) {
		classes += firefox_class + " ";
	}
	if (userAgent.indexOf(windows) > -1) {
		classes += windows_class + " ";
	}
	if (userAgent.indexOf(mac) > -1) {
		classes += mac_class + " ";
	}
	if (userAgent.indexOf(linux) > -1) {
		classes += linux_class + " ";
	}

	// trimming off additional space
	classes = classes.slice(0,-1);


	document.addEventListener('DOMContentLoaded', function() {
		// adding class names to body tag
		document.body.className += classes;
	});

	// exposing browser information globally
	window.browserInfo = classes;

	return classes;

})();