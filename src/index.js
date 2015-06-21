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

'use strict';

// TODO: refactor this into multiple smaller modules

var Microphone = require('./Microphone');
var models = require('./data/models.json').models;
var initViews = require('./views').initViews;
var showError = require('./views/showerror').showError;
var hideError = require('./views/showerror').hideError;
var initSocket = require('./socket').initSocket;
var handleFileUpload = require('./fileupload').handleFileUpload;
var display = require('./views/display');
var utils = require('./utils');
var effects = require('./views/effects');
var pkg = require('../package');

var BUFFERSIZE = 8192;

$(document).ready(function() {

  // Temporary app data
  $('#appSettings')
    .html(
      '<p>Version: ' + pkg.version + '</p>'
      + '<p>Buffer Size: ' + BUFFERSIZE + '</p>'
    );

  // Temporary top-scope variable
  var micSocket;

  function handleMicrophone(token, model, mic, callback) {

    var currentModel = localStorage.getItem('currentModel');
    if (currentModel.indexOf('Narrowband') > -1) {
      var err = new Error('Microphone cannot accomodate narrow band models, please select another');
      callback(err, null);
      return false;
    }
    // Test out websocket
    var baseString = '';
    var baseJSON = '';

    var options = {};
    options.token = token;
    options.message = {
      'action': 'start',
      'content-type': 'audio/l16;rate=16000',
      'interim_results': true,
      'continuous': true,
      'word_confidence': true,
      'timestamps': true,
      'max_alternatives': 3
    };
    options.model = model;

    function onOpen(socket) {
      console.log('socket opened');
      callback(null, socket);
    }

    function onListening(socket) {

      micSocket = socket;

      mic.onAudio = function(blob) {
        if (socket.readyState < 2) {
          socket.send(blob)
        }
      };
    }

    function onMessage(msg, socket) {
      console.log('Mic socket msg: ', msg);
      if (msg.results) {
        // Convert to closure approach
        baseString = display.showResult(msg, baseString);
        baseJSON = display.showJSON(msg, baseJSON);
      }
    }

    function onError(r, socket) {
      console.log('Mic socket err: ', err);
    }

    function onClose(evt) {
      console.log('Mic socket close: ', evt);
    }

    initSocket(options, onOpen, onListening, onMessage, onError, onClose);

  }

  // Make call to API to try and get token
  var url = '/token';
  var tokenRequest = new XMLHttpRequest();
  tokenRequest.open("GET", url, true);
  tokenRequest.onload = function(evt) {

    window.onbeforeunload = function(e) {
      localStorage.clear();
    };

    var token = tokenRequest.responseText;
    console.log('Token ', decodeURIComponent(token));

    var micOptions = {
      bufferSize: BUFFERSIZE
    };
    var mic = new Microphone(micOptions);

    var modelOptions = {
      token: token
        // Uncomment in case of server CORS failure
        // url: '/api/models'
    };

    // Get available speech recognition models
    // Set them in storage
    // And display them in drop-down
    console.log('STT Models ', models);

    // Save models to localstorage
    localStorage.setItem('models', JSON.stringify(models));

    // Set default current model
    localStorage.setItem('currentModel', 'en-US_BroadbandModel');
    localStorage.setItem('sessionPermissions', 'true');


    // INITIALIZATION
    // Send models and other
    // view context to views
    var viewContext = {
      models: models,
      token: token
    };
    initViews(viewContext);
    utils.initPubSub();


    function handleSelectedFile(file) {

      var currentlyDisplaying = JSON.parse(localStorage.getItem('currentlyDisplaying'));

      if (currentlyDisplaying) {
        showError('Currently displaying another file, please wait until complete');
        return;
      }

      localStorage.getItem('currentlyDisplaying', true);
      hideError();

      // Visual effects
      var uploadImageTag = $('#fileUploadTarget > img');
      var timer = setInterval(effects.toggleImage, 750, uploadImageTag, 'upload');

      // Get current model
      var currentModel = localStorage.getItem('currentModel');
      console.log('currentModel', currentModel);

      // Read first 4 bytes to determine header
      var blobToText = new Blob([file]).slice(0, 4);
      var r = new FileReader();
      r.readAsText(blobToText);
      r.onload = function() {
        var contentType = r.result === 'fLaC' ? 'audio/flac' : 'audio/wav';
        console.log('Uploading file', r.result);
        handleFileUpload(token, currentModel, file, contentType, function(socket) {
          console.log('reading file');

            var blob = new Blob([file]);
            var parseOptions = {
              file: blob
            };
            utils.onFileProgress(parseOptions,
              // On data chunk
                function(chunk) {
                console.log('Handling chunk', chunk);
                socket.send(chunk);
              },
              // On file read error
              function(evt) {
                console.log('Error reading file: ', evt.message);
                showError(evt.message);
              },
              // On load end
              function() {
                socket.send(JSON.stringify({'action': 'stop'}));
            });
        }, 
          function(evt) {
            effects.stopToggleImage(timer, uploadImageTag, 'upload');
            localStorage.setItem('currentlyDisplaying', false);
          }
        );
      };
    }

    console.log('setting target');

    var dragAndDropTarget = $(document);
    dragAndDropTarget.on('dragenter', function (e) {
      console.log('dragenter');
      e.stopPropagation();
      e.preventDefault();
    });

    dragAndDropTarget.on('dragover', function (e) {
      console.log('dragover');
      e.stopPropagation();
      e.preventDefault();
    });

    dragAndDropTarget.on('drop', function (e) {
      console.log('File dropped');
      e.preventDefault();
      var evt = e.originalEvent;
      // Handle dragged file event
      handleFileUploadEvent(evt);
    });

    function handleFileUploadEvent(evt) {
      console.log('handling file drop event');
      // Init file upload with default model
      var file = evt.dataTransfer.files[0];
      handleSelectedFile(file);
    }

    var fileUploadDialog = $("#fileUploadDialog");

    fileUploadDialog.change(function(evt) {
      var file = fileUploadDialog.get(0).files[0];
      console.log('file upload!', file);
      handleSelectedFile(file);
    });

    $("#fileUploadTarget").click(function(evt) {
      fileUploadDialog
      .trigger('click');
    });


    // Set microphone state to not running
    localStorage.setItem('running', false);

    var recordButton = $('#recordButton');
    recordButton.click($.proxy(function(evt) {

      // Prevent default anchor behavior
      evt.preventDefault();

      var running = JSON.parse(localStorage.getItem('running'));
      localStorage.setItem('running', !running);

      console.log('click!');

      var currentModel = localStorage.getItem('currentModel');

      console.log('running state', running);

      if (!running) {
        console.log('Not running, handleMicrophone()');
        handleMicrophone(token, currentModel, mic, function(err, socket) {
          if (err) {
            var msg = err.message;
            console.log('Error: ', msg);
            showError(msg);
            localStorage.setItem('running', false);
          } else {
            recordButton.css('background-color', '#d74108');
            recordButton.find('img').attr('src', 'img/stop.svg');
            console.log('starting mic');
            mic.record();
            localStorage.setItem('running', true);
          }
        });
      } else {
        console.log('Stopping microphone, sending stop action message');
        recordButton.removeAttr('style');
        recordButton.find('img').attr('src', 'img/microphone.svg');
        micSocket.send(JSON.stringify({'action': 'stop'}));
        // Can also send empty buffer to signal end
        // var emptyBuffer = new ArrayBuffer(0);
        // micSocket.send(emptyBuffer);
        mic.stop();
        localStorage.setItem('running', false);
      }


    }, this));
  }
  tokenRequest.send();

});

