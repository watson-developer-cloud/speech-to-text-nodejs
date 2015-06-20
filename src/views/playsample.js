
'use strict';

var utils = require('../utils');
var onFileProgress = utils.onFileProgress;
var handleFileUpload = require('../fileupload').handleFileUpload;
var initSocket = require('../socket').initSocket;
var showError = require('./showerror').showError;
var effects = require('./effects');


var playSample = function(token, imageTag, iconName, url, callback) {

  var timer = setInterval(effects.toggleImage, 750, imageTag, iconName);

  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.responseType = 'blob';
  xhr.onload = function(e) {
    var blob = xhr.response;
    var currentModel = 'en-US_BroadbandModel';
    var reader = new FileReader();
    var blobToText = new Blob([blob]).slice(0, 4);
    console.log('TOKEN', token);
    console.log('URL', url);
    console.log('BLOB', blob);
    reader.readAsText(blobToText);
    reader.onload = function() {
      var contentType = reader.result === 'fLaC' ? 'audio/flac' : 'audio/wav';
      console.log('Uploading file', reader.result);
      handleFileUpload(token, currentModel, blob, contentType, function(socket) {
        var parseOptions = {
          file: blob
        };
        onFileProgress(parseOptions,
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
      // On connection end
        function(evt) {
          effects.stopToggleImage(timer, imageTag, iconName);
        }
      );
    };
  };
  xhr.send();
};


exports.initPlaySample = function(ctx) {

  (function() {
    var el = $('.play-sample-1');
    var iconName = 'play';
    var imageTag = el.find('img');
    var fileName = 'audio/sample1.wav';
    el.click( function(evt) {
      console.log('CLICK!');
      playSample(ctx.token, imageTag, iconName, fileName, function(result) {
        console.log('Play sample result', result);
      });
    });
  })(ctx);

  (function() {
    var el = $('.play-sample-2');
    var iconName = 'play';
    var imageTag = el.find('img');
    var fileName = 'audio/sample2.wav';
    el.click( function(evt) {
      console.log('CLICK!');
      playSample(ctx.token, imageTag, iconName, fileName, function(result) {
        console.log('Play sample result', result);
      });
    });
  })(ctx);

};

