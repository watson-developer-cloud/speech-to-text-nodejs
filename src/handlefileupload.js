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

var display = require('./views/displaymetadata');
var initSocket = require('./socket').initSocket;

exports.handleFileUpload = function(type, token, model, file, contentType, callback, onend) {
  // Set currentlyDisplaying to prevent other sockets from opening
  localStorage.setItem('currentlyDisplaying', type);
  
  $.subscribe('progress', function(evt, data) {
    console.log('progress: ', data);
  });

  console.log('contentType', contentType);

  var result = {};
  result.transcript = '';
  result.showSpeakers = false;
  result.speakers = '';
  var baseJSON = '';

  $.subscribe('showtext', function() {
    var $resultsText = $('#resultsText');
    $resultsText.html(result.transcript);
  });
  
  $.subscribe('showspeakers', function() {
    var $resultsSpeakers = $('#resultsSpeakers');
    $resultsSpeakers.html(result.speakers);
  });
  
  $.subscribe('showjson', function() {
    var $resultsJSON = $('#resultsJSON');
    $resultsJSON.text(baseJSON);
  });

  var options = {};
  options.token = token;
  options.message = {
    'action': 'start',
    'content-type': contentType,
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
  if(keywords.length > 0) {
    var keywords_threshold = 0.01;
    options.message.keywords_threshold = keywords_threshold;
    options.message.keywords = keywords;
  }
  var speaker_labels = $('li.speakersTab').is(':visible');
  options.message.speaker_labels = speaker_labels;
 
  options.model = model;

  function onOpen() {
    console.log('Socket opened');
  }

  function onListening(socket) {
    console.log('Socket listening');
    callback(socket);
  }

  function onMessage(msg) {
    result.showSpeakers = options.message.speaker_labels;
    if (msg.results || msg.speaker_labels) {
      display.showResult(msg, result, model);
      baseJSON = JSON.stringify(msg, null, 2);
      display.showJSON(baseJSON);
    }
  }

  function onError(evt) {
    localStorage.setItem('currentlyDisplaying', 'false');
    onend(evt);
    console.log('Socket err: ', evt.code);
  }

  function onClose(evt) {
    localStorage.setItem('currentlyDisplaying', 'false');
    onend(evt);
    console.log('Socket closing: ', evt);
  }

  initSocket(options, onOpen, onListening, onMessage, onError, onClose);
};
