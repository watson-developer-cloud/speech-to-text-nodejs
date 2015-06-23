
'use strict';

var showError = require('./showerror').showError;
var hideError = require('./showerror').hideError;
var handleFileUpload = require('../fileupload').handleFileUpload;
var effects = require('./effects');
var utils = require('../utils');

exports.handleSelectedFile = function(token, file) {

  var currentlyDisplaying = JSON.parse(localStorage.getItem('currentlyDisplaying'));

  if (currentlyDisplaying) {
    showError('Transcription underway, please click stop or wait until finished to upload another file');
    return;
  }

  $.publish('clearscreen');

  localStorage.setItem('currentlyDisplaying', true);
  hideError();

  // Visual effects
  var uploadImageTag = $('#fileUploadTarget > img');
  var timer = setInterval(effects.toggleImage, 750, uploadImageTag, 'stop');
  var uploadText = $('#fileUploadTarget > span');
  uploadText.text('Stop Transcribing');

  function restoreUploadTab() {
    localStorage.setItem('currentlyDisplaying', false);
    clearInterval(timer);
    effects.restoreImage(uploadImageTag, 'upload');
    uploadText.text('Select File');
  }

  // Clear flashing if socket upload is stopped
  $.subscribe('stopsocket', function(data) {
    restoreUploadTab();
  });


  // Get current model
  var currentModel = localStorage.getItem('currentModel');
  console.log('currentModel', currentModel);

  // Read first 4 bytes to determine header
  var blobToText = new Blob([file]).slice(0, 4);
  var r = new FileReader();
  r.readAsText(blobToText);
  r.onload = function() {
    var contentType;
    if (r.result === 'fLaC') {
      contentType = 'audio/flac';
    } else if (r.result === 'RIFF') {
      contentType = 'audio/wav';
    } else {
      restoreUploadTab();
      showError('Only WAV or FLAC files can be transcribed, please try another file format');
      return;
    }
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
        uploadText.text('Select File');
        localStorage.setItem('currentlyDisplaying', false);
      }
    );
  };
}

