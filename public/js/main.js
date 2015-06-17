(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Copyright 2014 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var utils = require('./utils');
/**
 * Captures microphone input from the browser.
 * Works at least on latest versions of Firefox and Chrome
 */
function Microphone(_options) {
  var options = _options || {};

  // we record in mono because the speech recognition service
  // does not support stereo.
  this.bufferSize = options.bufferSize || 2048;
  this.inputChannels = options.inputChannels || 1;
  this.outputChannels = options.outputChannels || 1;
  this.recording = false;
  this.requestedAccess = false;
  this.sampleRate = 16000;
  // auxiliar buffer to keep unused samples (used when doing downsampling)
  this.bufferUnusedSamples = new Float32Array(0);

  // Chrome or Firefox or IE User media
  if (!navigator.getUserMedia) {
    navigator.getUserMedia = navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia || navigator.msGetUserMedia;
  }

}

/**
 * Called when the user reject the use of the michrophone
 * @param  error The error
 */
Microphone.prototype.onPermissionRejected = function() {
  console.log('Microphone.onPermissionRejected()');
  this.requestedAccess = false;
  this.onError('Permission to access the microphone rejeted.');
};

Microphone.prototype.onError = function(error) {
  console.log('Microphone.onError():', error);
};

/**
 * Called when the user authorizes the use of the microphone.
 * @param  {Object} stream The Stream to connect to
 *
 */
Microphone.prototype.onMediaStream =  function(stream) {
  var AudioCtx = window.AudioContext || window.webkitAudioContext;

  if (!AudioCtx)
    throw new Error('AudioContext not available');

  if (!this.audioContext)
    this.audioContext = new AudioCtx();

  var gain = this.audioContext.createGain();
  var audioInput = this.audioContext.createMediaStreamSource(stream);

  audioInput.connect(gain);

  this.mic = this.audioContext.createScriptProcessor(this.bufferSize,
    this.inputChannels, this.outputChannels);

  // uncomment the following line if you want to use your microphone sample rate
  //this.sampleRate = this.audioContext.sampleRate;
  console.log('Microphone.onMediaStream(): sampling rate is:', this.sampleRate);

  this.mic.onaudioprocess = this._onaudioprocess.bind(this);
  this.stream = stream;

  gain.connect(this.mic);
  this.mic.connect(this.audioContext.destination);
  this.recording = true;
  this.requestedAccess = false;
  this.onStartRecording();
};

/**
 * callback that is being used by the microphone
 * to send audio chunks.
 * @param  {object} data audio
 */
Microphone.prototype._onaudioprocess = function(data) {
  if (!this.recording) {
    // We speak but we are not recording
    return;
  }

  // Check the data to see if we're just getting 0s
  // (the user isn't saying anything)
  var chan = data.inputBuffer.getChannelData(0);

  this.onAudio(this._exportDataBufferTo16Khz(new Float32Array(chan)));

  //export with microphone mhz, remember to update the this.sampleRate
  // with the sample rate from your microphone
  //this.onAudio(this._exportDataBuffer(new Float32Array(chan)));

};

/**
 * Start the audio recording
 */
Microphone.prototype.record = function() {
  if (!navigator.getUserMedia){
    this.onError('Browser doesn\'t support microphone input');
    return;
  }
  if (this.requestedAccess) {
    return;
  }

  this.requestedAccess = true;
  navigator.getUserMedia({ audio: true },
    this.onMediaStream.bind(this), // Microphone permission granted
    this.onPermissionRejected.bind(this)); // Microphone permission rejected
};

/**
 * Stop the audio recording
 */
Microphone.prototype.stop = function() {
  if (!this.recording)
    return;
  this.recording = false;
  this.stream.stop();
  this.requestedAccess = false;
  this.mic.disconnect(0);
  this.mic = null;
  this.onStopRecording();
};

/**
 * Creates a Blob type: 'audio/l16' with the chunk and downsampling to 16 kHz
 * coming from the microphone.
 * Explanation for the math: The raw values captured from the Web Audio API are
 * in 32-bit Floating Point, between -1 and 1 (per the specification).
 * The values for 16-bit PCM range between -32768 and +32767 (16-bit signed integer).
 * Multiply to control the volume of the output. We store in little endian.
 * @param  {Object} buffer Microphone audio chunk
 * @return {Blob} 'audio/l16' chunk
 * @deprecated This method is depracated
 */
Microphone.prototype._exportDataBufferTo16Khz = function(bufferNewSamples) {
  var buffer = null,
    newSamples = bufferNewSamples.length,
    unusedSamples = this.bufferUnusedSamples.length;

  if (unusedSamples > 0) {
    buffer = new Float32Array(unusedSamples + newSamples);
    for (var i = 0; i < unusedSamples; ++i) {
      buffer[i] = this.bufferUnusedSamples[i];
    }
    for (i = 0; i < newSamples; ++i) {
      buffer[unusedSamples + i] = bufferNewSamples[i];
    }
  } else {
    buffer = bufferNewSamples;
  }

  // downsampling variables
  var filter = [
      -0.037935, -0.00089024, 0.040173, 0.019989, 0.0047792, -0.058675, -0.056487,
      -0.0040653, 0.14527, 0.26927, 0.33913, 0.26927, 0.14527, -0.0040653, -0.056487,
      -0.058675, 0.0047792, 0.019989, 0.040173, -0.00089024, -0.037935
    ],
    samplingRateRatio = this.audioContext.sampleRate / 16000,
    nOutputSamples = Math.floor((buffer.length - filter.length) / (samplingRateRatio)) + 1,
    pcmEncodedBuffer16k = new ArrayBuffer(nOutputSamples * 2),
    dataView16k = new DataView(pcmEncodedBuffer16k),
    index = 0,
    volume = 0x7FFF, //range from 0 to 0x7FFF to control the volume
    nOut = 0;

  for (var i = 0; i + filter.length - 1 < buffer.length; i = Math.round(samplingRateRatio * nOut)) {
    var sample = 0;
    for (var j = 0; j < filter.length; ++j) {
      sample += buffer[i + j] * filter[j];
    }
    sample *= volume;
    dataView16k.setInt16(index, sample, true); // 'true' -> means little endian
    index += 2;
    nOut++;
  }

  var indexSampleAfterLastUsed = Math.round(samplingRateRatio * nOut);
  var remaining = buffer.length - indexSampleAfterLastUsed;
  if (remaining > 0) {
    this.bufferUnusedSamples = new Float32Array(remaining);
    for (i = 0; i < remaining; ++i) {
      this.bufferUnusedSamples[i] = buffer[indexSampleAfterLastUsed + i];
    }
  } else {
    this.bufferUnusedSamples = new Float32Array(0);
  }

  return new Blob([dataView16k], {
    type: 'audio/l16'
  });
  };

/**
 * Creates a Blob type: 'audio/l16' with the
 * chunk coming from the microphone.
 */
var exportDataBuffer = function(buffer, bufferSize) {
  var pcmEncodedBuffer = null,
    dataView = null,
    index = 0,
    volume = 0x7FFF; //range from 0 to 0x7FFF to control the volume

  pcmEncodedBuffer = new ArrayBuffer(bufferSize * 2);
  dataView = new DataView(pcmEncodedBuffer);

  /* Explanation for the math: The raw values captured from the Web Audio API are
   * in 32-bit Floating Point, between -1 and 1 (per the specification).
   * The values for 16-bit PCM range between -32768 and +32767 (16-bit signed integer).
   * Multiply to control the volume of the output. We store in little endian.
   */
  for (var i = 0; i < buffer.length; i++) {
    dataView.setInt16(index, buffer[i] * volume, true);
    index += 2;
  }

  // l16 is the MIME type for 16-bit PCM
  return new Blob([dataView], { type: 'audio/l16' });
};

Microphone.prototype._exportDataBuffer = function(buffer){
  utils.exportDataBuffer(buffer, this.bufferSize);
}; 


// Functions used to control Microphone events listeners.
Microphone.prototype.onStartRecording =  function() {};
Microphone.prototype.onStopRecording =  function() {};
Microphone.prototype.onAudio =  function() {};

module.exports = Microphone;


},{"./utils":2}],2:[function(require,module,exports){

/**
 * Creates a Blob type: 'audio/l16' with the
 * chunk coming from the microphone.
 */
exports.exportDataBuffer = function(buffer, bufferSize) {
  var pcmEncodedBuffer = null,
    dataView = null,
    index = 0,
    volume = 0x7FFF; //range from 0 to 0x7FFF to control the volume

  pcmEncodedBuffer = new ArrayBuffer(bufferSize * 2);
  dataView = new DataView(pcmEncodedBuffer);

  /* Explanation for the math: The raw values captured from the Web Audio API are
   * in 32-bit Floating Point, between -1 and 1 (per the specification).
   * The values for 16-bit PCM range between -32768 and +32767 (16-bit signed integer).
   * Multiply to control the volume of the output. We store in little endian.
   */
  for (var i = 0; i < buffer.length; i++) {
    dataView.setInt16(index, buffer[i] * volume, true);
    index += 2;
  }

  // l16 is the MIME type for 16-bit PCM
  return new Blob([dataView], { type: 'audio/l16' });
};

},{}],3:[function(require,module,exports){
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


var utils = require('./utils');
var Microphone = require('./Microphone');

'use strict';

// From alediaferia's SO response
// http://stackoverflow.com/questions/14438187/javascript-filereader-parsing-long-file-in-chunks
function parseFile(file, callback) {
    var fileSize   = file.size;
    var chunkSize  = 2048 * 16; // bytes
    var offset     = 44;
    var self       = this; // we need a reference to the current object
    var block      = null;
    var count      = 0;
    var foo = function(evt) {
        if (offset >= fileSize) {
            console.log("Done reading file");
            return;
        }
        if (evt.target.error == null) {
            var buffer = evt.target.result;
            var len = buffer.byteLength;
            offset += len;
            var finalBlob = utils.exportDataBuffer(buffer, len);
            setTimeout(function() {
              callback(buffer); // callback for handling read chunk
            }, count * 100);
            count++;
        } else {
            console.log("Read error: " + evt.target.error);
            return;
        }
        block(offset, chunkSize, file);
    }
    block = function(_offset, length, _file) {
        var r = new FileReader();
        var blob = _file.slice(_offset, length + _offset);
        r.onload = foo;
        r.readAsArrayBuffer(blob);
    }
    block(offset, chunkSize, file);
}

// Mini WS callback API, so we can initialize
// with model and token in URI, plus
// start message
function getSocket(options, onlistening, onmessage, onerror) {
  var model = options.model || 'en-US_BroadbandModel';
  var token = options.token;
  var message = options.message || {'action': 'start'};
  console.log('URL model', model);
  // var wsUrl = 'wss://stream-d.watsonplatform.net/speech-to-text-beta/api/v1/recognize?watson-token='
  //   + token
  //   + '&model=' + model;
  var wsUrl = 'ws://127.0.0.1:8020/speech-to-text-beta/api/v1/recognize';
  var socket = new WebSocket(wsUrl);
  socket.onopen = function(evt) {
    console.log('ws opened');
    socket.send(JSON.stringify(message));
  };
  socket.onmessage = function(evt) {
    var msg = JSON.parse(evt.data);
    console.log('evt', evt);
    if (msg.state === 'listening') {
      onlistening(socket);
    }
    onmessage(msg);
  };
  socket.onerror = function(evt) {
    onerror(evt);
  };
}

function getModels(token, callback) {
  // var modelUrl = 'https://stream-d.watsonplatform.net/speech-to-text-beta/api/v1/models';
  var modelUrl = '/api/models';
  var sttRequest = new XMLHttpRequest();
  sttRequest.open("GET", modelUrl, true);
  sttRequest.withCredentials = true;
  sttRequest.setRequestHeader('Accept', 'application/json');
  sttRequest.setRequestHeader('X-Watson-Authorization-Token', token);
  sttRequest.onload = function(evt) {
    // We wait until we've given this request a chance to load and (ideally) set the cookie
    // But we get a net::ERR_CONNECTION_REFUSED, apparantly because no cookie is set
    var response = JSON.parse(sttRequest.responseText);
    callback(response.models);
  };
  sttRequest.send();
}

$(document).ready(function() {

  // Only works on Chrome
  if (!$('body').hasClass('chrome')) {
    $('.unsupported-overlay').show();
  }

  // UI
  var micButton = $('.micButton'),
  micText = $('.micText'),
  transcript = $('#text'),
  errorMsg = $('.errorMsg');


  function displayError(error) {
    var message = error;
    try {
      var errorJson = JSON.parse(error);
      message = JSON.stringify(errorJson, null, 2);
    } catch (e) {
      message = error;
    }

    errorMsg.text(message);
    errorMsg.show();
    transcript.hide();
  }

  //Sample audios
  var audio1 = 'audio/sample1.wav',
      audio2 = 'audio/sample2.wav';

  function _error(xhr) {
    $('.loading').hide();
    displayError('Error processing the request, please try again.');
  }


  // function stopSounds() {
  //   $('.sample2').get(0).pause();
  //   $('.sample2').get(0).currentTime = 0;
  //   $('.sample1').get(0).pause();
  //   $('.sample1').get(0).currentTime = 0;
  // }
  //
  // $('.audio1').click(function() {
  //   $('.audio-staged audio').attr('src', audio1);
  //   stopSounds();
  //   $('.sample1').get(0).play();
  // });
  //
  // $('.audio2').click(function() {
  //   $('.audio-staged audio').attr('src', audio2);
  //   stopSounds();
  //   $('.sample2').get(0).play();
  // });
  //
  // $('.send-api-audio1').click(function() {
  //   transcriptAudio(audio1);
  // });
  //
  // $('.send-api-audio2').click(function() {
  //   transcriptAudio(audio2);
  // });
  //
  // function showAudioResult(data){
  //   $('.loading').hide();
  //   transcript.empty();
  //   $('<p></p>').appendTo(transcript);
  //   showResult(data);
  // }
  //
  var sockets = {};

  function showMetaData(timestamps) {
    timestamps.forEach(function(timestamp) {
      var word = timestamp[0],
        t0 = timestamp[1],
        t1 = timestamp[2];
      var timelength = t1 - t0;
      $('.table-header-row').append('<th>' + word + '</th>');
      $('.time-length-row').append('<td>' + timelength.toString().slice(0, 3) + ' s</td>');
    });
  }

  function showAlternatives(alternatives) {
    var $hypotheses = $('.hypotheses ul');
    alternatives.forEach(function(alternative, idx) {
      $hypotheses.append('<li data-hypothesis-index=' + idx + ' >' + alternative.transcript + '</li>');
    });
    $hypotheses.on('click', "li", function () {
      console.log("showing metadata");
      var idx = + $(this).data('hypothesis-index');
      var timestamps = alternatives[idx].timestamps;
      showMetaData(timestamps);
    });
  }

 
  function showJSON(json, baseJSON) {
    baseJSON += json;
    $('#resultsJSON').val(baseJSON);
  }

  // TODO: Convert to closure approach
  function showResult(data, baseString) {
    //if there are transcripts
    if (data.results && data.results.length > 0) {

      // showMetaData(data.results[0].alternatives[0].timestamps);

      var text = data.results[0].alternatives[0].transcript || '';

      //if is a partial transcripts
      if (data.results.length === 1 ) {

        //Capitalize first word
        // if final results, append a new paragraph
        if (data.results[0].final){
          console.log('final res:', text);
          baseString += text;
          baseString = baseString.charAt(0).toUpperCase() + baseString.substring(1);
          baseString = baseString.trim() + '.';
          $('#resultsText').val(baseString);
        } else {
          console.log('interimResult res:', text);
          var temp = baseString + text;
          $('#resultsText').val(temp);
        }
      }
    }
  }

  function initFileUpload(token, model) {

    var baseString = '';
    var baseJSON = '';

    var options = {};
    options.token = token;
    options.message = {
      'action': 'start',
      'content-type': 'audio/l16;rate=44100',
      'interim_results': true,
      'continuous': true,
      'word_confidence': true,
      'timestamps': true,
      'max_alternatives': 3
    };
    options.model = model.name;

    getSocket(options, function(socket) {

        function handleFileUploadEvent(evt) {
          console.log('Uploading file');
          var file = evt.dataTransfer.files[0];
          var blob = new Blob([file], {type: 'audio/l16;rate=44100'});
          parseFile(blob, function(chunk) {
            console.log('Handling chunk', chunk);
            socket.send(chunk);
          });
        }

        console.log('setting target');

        var target = $("#fileUploadTarget");
        target.on('dragenter', function (e) {
          console.log('dragenter');
          e.stopPropagation();
          e.preventDefault();
        });

        target.on('dragover', function (e) {
          console.log('dragover');
          e.stopPropagation();
          e.preventDefault();
        });

        target.on('drop', function (e) {
          console.log('File dropped');
          e.preventDefault();
          var evt = e.originalEvent;
          // Handle dragged file event
          handleFileUploadEvent(evt);
        });

      }, function(msg) {
        console.log('ws msg', msg);
        if (msg.results) {
          showResult(msg, baseString);
          showJSON(JSON.stringify(msg.results), baseJSON);
        }
      }, function(err) {
        console.log('err', err);
      }
    );

  }


  function initMicrophone(token, model, mic, callback) {
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
    options.model = model.name;
    getSocket(options, function(socket) {

      mic.onAudio = function(blob) {
        socket.send(blob)
      };

      callback(socket);

      sockets[model.name] = socket;

    }, function(msg) {
      console.log('ws msg', msg);
      if (msg.results) {
        showResult(msg, baseString);
        showJSON(JSON.stringify(msg.results), baseJSON);
      }
    }, function(err) {
      console.log('err', err);
    });

    function onError(err) {
      console.log('audio error: ', err);
    }

  }

  function stopMicrophone(socket, callback) {
    socket.send(JSON.stringify({'action': 'stop'}));
    callback(socket);
  }

  function setMicrophoneListener(modelObject, token, callback) {

    // recordButton.unbind('click');

  }

  function getModelObject(models, modelName) {
    var result = null;
    models.forEach(function(model) {
      if (model.name === modelName) {
        result = model;
      }
    });
    return result;
  }

  // Make call to API to try and get cookie
  // var url = '/token';
  // var tokenRequest = new XMLHttpRequest();
  // tokenRequest.open("GET", url, true);
  // tokenRequest.onload = function(evt) {
    // var token = tokenRequest.responseText;
    // console.log('Token ', decodeURIComponent(token));
  function init() {
    // Get available speech recognition models
    // And display them in drop-down
    var token = 'blah';
    getModels(token, function(models) {

      console.log('STT Models ', models);
      models.forEach(function(model) {
        $("select#dropdownMenu1").append( $("<option>")
          .val(model.name)
          .html(model.description)
          );
      });
      // Initialize UI with default model
      // TODO: need to wait to send start message
      var modelObject = getModelObject(models, 'en-US_BroadbandModel');
      var modelObject = {name: 'en-US_BroadbandModel'};

      var running = false;
      var recordButton = $('#recordButton');

      recordButton.click($.proxy(function(evt) {

        var mic = new Microphone();

        console.log('click!');

        evt.preventDefault();
        // evt.stopPropagation();

        console.log('running state', running);

        if (!running) {
          console.log('not running, initMicrophone');
          initMicrophone(token, modelObject, mic, function(result) {
            recordButton.css('background-color', '#d74108');
            recordButton.find('img').attr('src', 'img/stop.svg');
            console.log('starting mic');
            mic.record();
          });
        } else {
          console.log('stopping mic');
          recordButton.removeAttr('style');
          recordButton.find('img').attr('src', 'img/microphone.svg');
          mic.stop();
          sockets[modelObject.name].send(JSON.stringify({'action': 'stop'}));
        }

        running = !running;

      }, this));

      // Re-initialize event listener with appropriate model when model changes
      $("select#dropdownMenu1").change(function(evt) {
        var modelName = $("select#dropdownMenu1").val();
        var newModelObject = getModelObject(models, modelName);
        setMicrophoneListener(mic, modelObject, token);
      });

    });
  }
  init();
  // tokenRequest.send();

});

},{"./Microphone":1,"./utils":2}]},{},[3]);
