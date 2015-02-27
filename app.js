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

'use strict';

var app = require('express')(),
  server = require('http').Server(app),
  io = require('socket.io')(server),
  bluemix = require('./config/bluemix'),
  watson = require('watson-developer-cloud'),
  extend = require('util')._extend;

// if bluemix credentials exists, then override local
var credentials = extend({
  version:'v1',
	username: '<username>',
	password: '<password>'
}, bluemix.getServiceCreds('speech_to_text')); // VCAP_SERVICES

// Create the service wrapper
var speechToText = watson.speech_to_text(credentials);

// Configure express
require('./config/express')(app, speechToText);

// Configure sockets
require('./config/socket')(io, speechToText);

var port = process.env.VCAP_APP_PORT || 3000;
server.listen(port);
console.log('listening at:', port);
