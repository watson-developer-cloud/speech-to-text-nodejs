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
var handleSelectedFile = require('./views/handlefile').handleSelectedFile;
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

  // Make call to API to try and get token
  var url = '/token';
  var tokenRequest = new XMLHttpRequest();
  tokenRequest.open("GET", url, true);
  tokenRequest.onload = function(evt) {

    window.onbeforeunload = function(e) {
      localStorage.clear();
    };

    var token = tokenRequest.responseText;
    if (!token) {
      console.error('No authorization token available');
      console.error('Attempting to reconnect...');
    }

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
      token: token,
      bufferSize: BUFFERSIZE
    };
    initViews(viewContext);
    utils.initPubSub();

    $.subscribe('clearscreen', function() {
      $('#resultsText').text('');
      $('#resultsJSON').text('');
      $('.hypotheses > ul').empty();
      $('#metadataTableBody').empty();
    });

    console.log('setting target');

    var fileUploadDialog = $("#fileUploadDialog");

    fileUploadDialog.change(function(evt) {
      var file = fileUploadDialog.get(0).files[0];
      console.log('file upload!', file);
      handleSelectedFile(token, file);
    });

    $("#fileUploadTarget").click(function(evt) {
      var currentlyDisplaying = JSON.parse(localStorage.getItem('currentlyDisplaying'));
      console.log('CURRENTLY DISPLAYING', currentlyDisplaying);
      if (currentlyDisplaying) {
        $.publish('socketstop');
        localStorage.setItem('currentlyDisplaying', false);
        return;
      }

      fileUploadDialog.val(null);

      fileUploadDialog
      .trigger('click');

    });


  }
  tokenRequest.send();

});

