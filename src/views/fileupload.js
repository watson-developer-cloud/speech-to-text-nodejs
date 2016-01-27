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
/* global $ */
'use strict';

var watson = require('watson-speech');
var showError = require('./showerror').showError;
var showNotice = require('./showerror').showNotice;
//var handleFileUpload = require('../handlefileupload').handleFileUpload;
var effects = require('./effects');
//var utils = require('../utils');
var display = require('./displaymetadata');

// Need to remove the view logic here and move this out to the handlefileupload controller
var handleSelectedFile = exports.handleSelectedFile = (function() {

    var running = false;
    localStorage.setItem('currentlyDisplaying', 'false');

    return function(token, file) {

    $.publish('clearscreen');

    
    localStorage.setItem('currentlyDisplaying', 'fileupload');
    running = true;

    // Visual effects
    var uploadImageTag = $('#fileUploadTarget > img');
    var timer = setInterval(effects.toggleImage, 750, uploadImageTag, 'stop');
    var uploadText = $('#fileUploadTarget > span');
    uploadText.text('Stop Transcribing');

    function restoreUploadTab() {
      clearInterval(timer);
      effects.restoreImage(uploadImageTag, 'upload');
      uploadText.text('Select File');
    }

    // Clear flashing if socket upload is stopped
    $.subscribe('hardsocketstop', function() {
      restoreUploadTab();
      running = false;
    });

    // Get current model
    var currentModel = localStorage.getItem('currentModel');
    console.log('currentModel', currentModel);

    var stream = watson.stream({
        token: token,
        source: file,
        playFile: true,
        model: currentModel
    });

    stream.on('playback-error', function(err) {
        if (err.name == 'UNSUPPORTED_FORMAT' && err.contentType.indexOf('flac') > -1) {
            showNotice('Notice: browsers do not support playing FLAC audio, so no audio will accompany the transcription');
        } else {
            restoreUploadTab();
            showError('Only WAV or FLAC or Opus files can be transcribed, please try another file format');
            localStorage.setItem('currentlyDisplaying', 'false');
            stream.stop();
        }
        console.log('playback-error', err);
    });

        function onEnd() {
            effects.stopToggleImage(timer, uploadImageTag, 'upload');
            uploadText.text('Select File');
            localStorage.setItem('currentlyDisplaying', 'false');
        }

    stream.on('close', function handleClose() {
        $.publish('hardsocketstop');
        onEnd();
    });

    stream.on('error', function handleError(err) {
        $.publish('hardsocketstop');
        console.log('error', err);
        showError('Error: ' + err.message);
        onEnd();
    });

    display.renderStream(stream, currentModel);


  };
})();


exports.initFileUpload = function(ctx) {

  var fileUploadDialog = $('#fileUploadDialog');

  fileUploadDialog.change(function() {
    var fileInput = fileUploadDialog.get(0).files[0];
    handleSelectedFile(ctx.token, fileInput);
  });

  $('#fileUploadTarget').click(function() {

    var currentlyDisplaying = localStorage.getItem('currentlyDisplaying');

    if (currentlyDisplaying=='fileupload') {
      console.log('HARD SOCKET STOP');
      $.publish('hardsocketstop');
      localStorage.setItem('currentlyDisplaying', 'false');
      return;
    } else if (currentlyDisplaying=='sample') {
      showError('Currently another file is playing, please stop the file or wait until it finishes'); 
      return;
    } else if (currentlyDisplaying=='record') {
      showError('Currently audio is being recorded, please stop recording before playing a sample');
      return;
    }
    fileUploadDialog.val(null);

    fileUploadDialog
    .trigger('click');

  });

};
