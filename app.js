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
  SpeechToText = require('./speech-to-text'),
  extend = require('util')._extend;

// if bluemix credentials exists, then override local
var credentials = extend({
     "password": "kQ9yeF5iRRkv",
     "url": "https://gateway.watsonplatform.net:8443/speech-to-text-beta/api",
     "username": "e2e32f93-58aa-4ce5-b7a4-b8b3bc5e495b"
}, bluemix.getServiceCreds('speech_to_text')); // VCAP_SERVICES

// Save bluemix credentials
app.set('service',credentials);

// Create the service wrapper
var speechToText = new SpeechToText(credentials);

// Configure express
require('./config/express')(app,speechToText);

// Configure sockets
require('./config/socket')(io, speechToText);

var port = process.env.VCAP_APP_PORT || 3000;
server.listen(port);
console.log('listening at:', port);