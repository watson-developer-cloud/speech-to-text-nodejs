
'use strict';

var showError = require('./showerror').showError;
var showNotice = require('./showerror').showNotice;
var handleFileUpload = require('../handlefileupload').handleFileUpload;
var effects = require('./effects');
var utils = require('../utils');

// Need to remove the view logic here and move this out to the handlefileupload controller
var handleSelectedFile = exports.handleSelectedFile = (function() {

    var running = false;
    localStorage.setItem('currentlyDisplaying', 'false');

    return function(token, file) {
        
    var currentlyDisplaying = localStorage.getItem('currentlyDisplaying');
    if (currentlyDisplaying==='sample') {
       showError('Currently, another file is playing, so please stop the file or wait until it finishes');
       return;
    } else if(currentlyDisplaying==='record') {
       showError('Currently, audio is being recorded, please stop recording first');
       return;
    }

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
    $.subscribe('hardsocketstop', function(data) {
      restoreUploadTab();
      running = false;
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
        showNotice('Notice: browsers do not support playing FLAC audio, so no audio will accompany the transcription');
      } else if (r.result === 'RIFF') {
        contentType = 'audio/wav';
        var audio = new Audio();
        var wavBlob = new Blob([file], {type: 'audio/wav'});
        var wavURL = URL.createObjectURL(wavBlob);
        audio.src = wavURL;
        audio.play();
        $.subscribe('hardsocketstop', function() {
          audio.pause();
          audio.currentTime = 0;
        });
      } else if (r.result === 'OggS') {
          contentType = 'audio/ogg; codecs=opus';
          var audio = new Audio();
          var opusBlob = new Blob([file], {type: 'audio/ogg; codecs=opus'});
          var opusURL = URL.createObjectURL(opusBlob);
          audio.src=opusURL;
          audio.play();
          $.subscribe('hardsocketstop', function() {
            audio.pause();
            audio.currentTime = 0;
          });
      }
        else {
        restoreUploadTab();
        showError('Only WAV, OPUS or FLAC files can be transcribed, please try another file format');
        localStorage.setItem('currentlyDisplaying', 'false');
        return;
      }
      handleFileUpload('fileupload', token, currentModel, file, contentType, function(socket) {
        var blob = new Blob([file]);
        var parseOptions = {
          file: blob
        };
        utils.onFileProgress(parseOptions,
          // On data chunk
          function(chunk) {
            socket.send(chunk);
          },
          function(isRunning) {
            if(running)
                return true;
            else
                return false;
          },
          // On file read error
          function(evt) {
            console.log('Error reading file: ', evt.message);
            showError('Error: ' + evt.message);
          },
          // On load end
          function() {
            socket.send(JSON.stringify({'action': 'stop'}));
          });
      }, 
        function(evt) {
          effects.stopToggleImage(timer, uploadImageTag, 'upload');
          uploadText.text('Select File');
          localStorage.setItem('currentlyDisplaying', 'false');
        }
      );
    };
  }
})();


exports.initFileUpload = function(ctx) {

  var fileUploadDialog = $("#fileUploadDialog");

  fileUploadDialog.change(function(evt) {
    var file = fileUploadDialog.get(0).files[0];
    handleSelectedFile(ctx.token, file);
  });

  $("#fileUploadTarget").click(function(evt) {

    var currentlyDisplaying = localStorage.getItem('currentlyDisplaying');

    if (currentlyDisplaying==='fileupload') {
      console.log('HARD SOCKET STOP');
      $.publish('hardsocketstop');
      localStorage.setItem('currentlyDisplaying', 'false');
      return;
    }

    fileUploadDialog.val(null);

    fileUploadDialog
    .trigger('click');

  });

}
