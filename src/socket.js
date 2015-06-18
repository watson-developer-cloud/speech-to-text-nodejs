/**
 * Copyright 2014 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/*global $:false */


var utils = require('./utils');
var Microphone = require('./Microphone');

// Mini WS callback API, so we can initialize
// with model and token in URI, plus
// start message
exports.initSocket = function(options, onopen, onlistening, onmessage, onerror) {
  var listening = false;
  function withDefault(val, defaultVal) {
    return typeof val === 'undefined' ? defaultVal : val;
  }
  var token = options.token;
  var model = options.model || 'en-US_BroadbandModel';
  var message = options.message || {'action': 'start'};
  var sessionPermissions = withDefault(options.sessionPermissions, JSON.parse(localStorage.getItem('sessionPermissions')));
  var sessionPermissionsQueryParam = sessionPermissions ? '0' : '1';
  var url = options.serviceURI || 'wss://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/recognize?watson-token='
    + token
    + '&X-WDC-PL-OPT-OUT=' + sessionPermissionsQueryParam
    + '&model=' + model;
  console.log('URL model', model);
  var socket = new WebSocket(url);
  socket.onopen = function(evt) {
    console.log('ws opened');
    socket.send(JSON.stringify(message));
    onopen(socket);
  };
  socket.onmessage = function(evt) {
    var msg = JSON.parse(evt.data);
    console.log('evt', evt);
    if (msg.state === 'listening') {
      if (!listening) {
        onlistening(socket);
        listening = true;
      } else {
        console.log('closing socket');
        // Cannot close socket since state is reported here as 'CLOSING' or 'CLOSED'
        // Despite this, it's possible to send from this 'CLOSING' socket with no issue
        // Could be a browser bug, still investigating
        // Could also be a proxy/gateway issue
        // socket.close();
      }
    }
    onmessage(msg, socket);
  };
  socket.onerror = function(evt) {
    var err = evt.data;
    onerror(err, socket);
  };
}

