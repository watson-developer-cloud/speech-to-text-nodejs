
'use strict';

var utils = require('../utils');
var onFileProgress = utils.onFileProgress;
var handleFileUpload = require('../handlefileupload').handleFileUpload;
var initSocket = require('../socket').initSocket;
var showError = require('./showerror').showError;
var effects = require('./effects');


var LOOKUP_TABLE = {
  'en-US_BroadbandModel': ['Us_English_Broadband_Sample_1.wav', 'Us_English_Broadband_Sample_2.wav'],
  'en-US_NarrowbandModel': ['Us_English_Narrowband_Sample_1.wav', 'Us_English_Narrowband_Sample_2.wav'],
  'es-ES_BroadbandModel': ['Es_ES_spk24_16khz.wav', 'Es_ES_spk19_16khz.wav'],
  'es-ES_NarrowbandModel': ['Es_ES_spk24_8khz.wav', 'Es_ES_spk19_8khz.wav'],
  'ja-JP_BroadbandModel': ['sample-Ja_JP-wide1.wav', 'sample-JA_JP-wide2.wav'],
  'ja-JP_NarrowbandModel': ['sample-Ja_JP-narrow1.wav', 'sample-JA_JP-narrow2.wav']
};

var playSample = (function() {

  var running = false;

  return function(token, imageTag, iconName, url, callback) {

    $.publish('clearscreen');

    var currentlyDisplaying = JSON.parse(localStorage.getItem('currentlyDisplaying'));

    // This error handling needs to be expanded to accomodate
    // the two different play samples files
    // if (currentlyDisplaying && running) {
    //   console.log('HARD SOCKET STOP');
    //   $.publish('hardsocketstop');
    //   localStorage.setItem('currentlyDisplaying', false);
    //   running = false;
    //   return;
    // }

    if (currentlyDisplaying) {
      showError('Currently another file is playing, please stop the file or wait until it finishes');
      return;
    }

    localStorage.setItem('currentlyDisplaying', true);
    running = true;

    var timer = setInterval(effects.toggleImage, 750, imageTag, iconName);

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = function(e) {
      var blob = xhr.response;
      var currentModel = localStorage.getItem('currentModel') || 'en-US_BroadbandModel';
      var reader = new FileReader();
      var blobToText = new Blob([blob]).slice(0, 4);
      reader.readAsText(blobToText);
      reader.onload = function() {
        var contentType = reader.result === 'fLaC' ? 'audio/flac' : 'audio/wav';
        console.log('Uploading file', reader.result);
        var mediaSourceURL = URL.createObjectURL(blob);
        var audio = new Audio();
        audio.src = mediaSourceURL;
        audio.play();
        handleFileUpload(token, currentModel, blob, contentType, function(socket) {
          var parseOptions = {
            file: blob
          };
          onFileProgress(parseOptions,
            // On data chunk
            function(chunk) {
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
        // On connection end
          function(evt) {
            effects.stopToggleImage(timer, imageTag, iconName);
            localStorage.getItem('currentlyDisplaying', false);
          }
        );
      };
    };
    xhr.send();
  };
})();


exports.initPlaySample = function(ctx) {

  var currentModel = localStorage.getItem('currentModel') || 'en-US_BroadbandModel';

  console.log('current model', currentModel);

  (function() {
    var el = $('.play-sample-1');
    var iconName = 'play';
    var imageTag = el.find('img');
    el.click( function(evt) {
      currentModel = localStorage.getItem('currentModel') || currentModel;
      var fileName = 'audio/' + LOOKUP_TABLE[currentModel][0];
      playSample(ctx.token, imageTag, iconName, fileName, function(result) {
        console.log('Play sample result', result);
      });
    });
  })(ctx, LOOKUP_TABLE, currentModel);

  (function() {
    var fileName = 'audio/' + LOOKUP_TABLE[currentModel][1];
    var el = $('.play-sample-2');
    var iconName = 'play';
    var imageTag = el.find('img');
    el.click( function(evt) {
      currentModel = localStorage.getItem('currentModel') || currentModel;
      var fileName = 'audio/' + LOOKUP_TABLE[currentModel][1];
      playSample(ctx.token, imageTag, iconName, fileName, function(result) {
        console.log('Play sample result', result);
      });
    });
  })(ctx, LOOKUP_TABLE, currentModel);

};

