/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
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
/* global $ */
'use strict';

var initSocket = require('./socket').initSocket;
var display = require('./views/displaymetadata');

exports.handleMicrophone = function(token, model, mic, callback) {

  if (model.indexOf('Narrowband') > -1) {
    var err = new Error('Microphone transcription cannot accommodate narrowband models, ' +
      'please select another');
    callback(err, null);
    return false;
  }

  $.publish('clearscreen');

  var output = display.output;

  $.subscribe('showtext', function() {
    var $results = $('#resultsText');
    $results.html(output.transcript);
  });

  $.subscribe('showspeakers', function() {
    var $results = $('#resultsText');
    $results.html(output.speakers);
  });

  $.subscribe('showjson', function() {
    var $resultsJSON = $('#resultsJSON');
    $resultsJSON.text(output.json);
  });

  var options = {};
  options.token = token;
  options.message = {
    'action': 'start',
    'content-type': 'audio/l16;rate=16000',
    'interim_results': true,
    'continuous': true,
    'word_confidence': true,
    'timestamps': true,
    'max_alternatives': 3,
    'inactivity_timeout': 600,
    'word_alternatives_threshold': 0.001,
    'smart_formatting': true,
  };

  var keywords = display.getKeywordsToSearch();
  if (keywords.length > 0) {
    var keywords_threshold = 0.01;
    options.message.keywords_threshold = keywords_threshold;
    options.message.keywords = keywords;
  }
  options.message.speaker_labels = $('#diarization > input[type="checkbox"]').prop('checked');

  options.model = model;

  function onOpen(socket) {
    console.log('Mic socket: opened');
    callback(null, socket);
  }

  function onListening(socket) {
    mic.onAudio = function(blob) {
      if (socket.readyState < 2) {
        socket.send(blob);
      }
    };
  }

  function onMessage(msg) {
    if (msg.results || msg.speaker_labels) {
      output.json = JSON.stringify(msg, null, 2);
      display.showResult(msg, model);
    }
  }

  function onError() {
    console.log('Mic socket err: ', err);
  }

  function onClose(evt) {
    console.log('Mic socket close: ', evt);
  }

  initSocket(options, onOpen, onListening, onMessage, onError, onClose);
};
