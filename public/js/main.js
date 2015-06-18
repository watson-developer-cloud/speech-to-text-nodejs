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

  // Single channel
  var chan = data.inputBuffer.getChannelData(0);

  this.onAudio(this._exportDataBufferTo16Khz(new Float32Array(chan)));

  //export with microphone mhz, remember to update the this.sampleRate
  // with the sample rate from your microphone
  // this.onAudio(this._exportDataBuffer(new Float32Array(chan)));

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


},{"./utils":4}],2:[function(require,module,exports){

exports.getModels = function(options, callback) {
  var token = options.token;
  var modelUrl = options.url || 'https://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/models';
  var sttRequest = new XMLHttpRequest();
  sttRequest.open("GET", modelUrl, true);
  sttRequest.withCredentials = true;
  sttRequest.setRequestHeader('Accept', 'application/json');
  sttRequest.setRequestHeader('X-Watson-Authorization-Token', token);
  sttRequest.onload = function(evt) {
    var response = JSON.parse(sttRequest.responseText);
    callback(response.models);
  };
  sttRequest.send();
}

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

// Mini WS callback API, so we can initialize
// with model and token in URI, plus
// start message
exports.initSocket = function(options, onopen, onlistening, onmessage, onerror) {
  var listening = false;
  function withDefault(val, defaultVal) {
    return typeof val === 'undefined' ? defaultVal : val;
  }
  var token = options.token;
  var model = options.model || 'en-US_BroadbandModel';
  var message = options.message || {'action': 'start'};
  var sessionPermissions = withDefault(options.sessionPermissions, JSON.parse(localStorage.getItem('sessionPermissions')));
  var sessionPermissionsQueryParam = sessionPermissions ? '0' : '1';
  var url = options.serviceURI || 'wss://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/recognize?watson-token='
    + token
    + '&X-WDC-PL-OPT-OUT=' + sessionPermissionsQueryParam
    + '&model=' + model;
  console.log('URL model', model);
  var socket = new WebSocket(url);
  socket.onopen = function(evt) {
    console.log('ws opened');
    socket.send(JSON.stringify(message));
    onopen(socket);
  };
  socket.onmessage = function(evt) {
    var msg = JSON.parse(evt.data);
    console.log('evt', evt);
    if (msg.state === 'listening') {
      console.log('***********SOCKET LISTENING*************');
      console.log('listening state: ', listening);
      if (!listening) {
        onlistening(socket);
        listening = true;
      } if (listening) {
        console.log('closing socket');
        console.log('socket state: ', socket.readyState);
        socket.close();
        // var buf = new ArrayBuffer(2);
        // var bufView = new Uint16Array(buf);
        // bufView[0] = 0x88;
        // socket.send(bufView)
        // socket.close();
      }
    }
    onmessage(msg, socket);
  };
  socket.onerror = function(evt) {
    var err = evt.data;
    onerror(err, socket);
  };
}


},{"./Microphone":1,"./utils":4}],4:[function(require,module,exports){

/**
 * Creates a Blob type: 'audio/l16' with the
 * chunk coming from the microphone.
 */
var exportDataBuffer = exports.exportDataBuffer = function(buffer, bufferSize) {
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

// From alediaferia's SO response
// http://stackoverflow.com/questions/14438187/javascript-filereader-parsing-long-file-in-chunks
exports.parseFile = function(file, callback) {
    var fileSize   = file.size;
    var chunkSize  = 2048 * 4; // bytes
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
            var finalBlob = exportDataBuffer(buffer, len);
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



},{}],5:[function(require,module,exports){

var showTimestamps = function(timestamps) {
  timestamps.forEach(function(timestamp) {
    var word = timestamp[0],
      t0 = timestamp[1],
      t1 = timestamp[2];
    var timelength = t1 - t0;
    $('.table-header-row').append('<th>' + word + '</th>');
    $('.time-length-row').append('<td>' + timelength.toString().substring(0, 3) + ' s</td>');
  });
}

var showWordConfidence = function(confidences) {
  console.log('confidences', confidences);
  confidences.forEach(function(confidence) {
    var displayConfidence = confidence[1].toString().substring(0, 3);
    $('.confidence-score-row').append('<td>' + displayConfidence + ' </td>');
  });
}

exports.showMetaData = function(alternative) {
  var timestamps = alternative.timestamps;
  if (timestamps && timestamps.length > 0) {
    showTimestamps(timestamps);
  }
  var confidences = alternative.word_confidence;;
  if (confidences && confidences.length > 0) {
    showWordConfidence(confidences);
  }
}

exports.showAlternatives = function(alternatives) {
  var $hypotheses = $('.hypotheses ul');
  $hypotheses.html('');
  alternatives.forEach(function(alternative, idx) {
    $hypotheses.append('<li data-hypothesis-index=' + idx + ' >' + alternative.transcript + '</li>');
  });
  $hypotheses.on('click', "li", function () {
    console.log("showing metadata");
    var idx = + $(this).data('hypothesis-index');
    var alternative = alternatives[idx];
    showMetaData(alternative);
  });
}


exports.showJSON = function(msg, baseJSON) {
  var json = JSON.stringify(msg);
  baseJSON += json;
  baseJSON += '\n';
  $('#resultsJSON').val(baseJSON);
  return baseJSON;
}

// TODO: Convert to closure approach
exports.showResult = function(baseString, isFinished) {

  if (isFinished) {
    var formattedString = baseString.slice(0, -1);
    formattedString = formattedString.charAt(0).toUpperCase() + formattedString.substring(1);
    formattedString = formattedString.trim() + '.';
    console.log('formatted final res:', formattedString);
    $('#resultsText').val(formattedString);
  } else {
    console.log('interimResult res:', baseString);
    $('#resultsText').val(baseString);
  }

}

},{}],6:[function(require,module,exports){

var initSessionPermissions = require('./sessionpermissions').initSessionPermissions;
var initSelectModel = require('./selectmodel').initSelectModel;


exports.initViews = function(ctx) {
  console.log('Initializing views...');
  initSelectModel(ctx);
  initSessionPermissions();
}

},{"./selectmodel":7,"./sessionpermissions":8}],7:[function(require,module,exports){

exports.initSelectModel = function(ctx) {

  ctx.models.forEach(function(model) {
    $("select#dropdownMenu1").append( $("<option>")
      .val(model.name)
      .html(model.description)
      );
  });

  $("select#dropdownMenu1").change(function(evt) {
    var modelName = $("select#dropdownMenu1").val();
    localStorage.setItem('currentModel', modelName);
  });

}

},{}],8:[function(require,module,exports){


exports.initSessionPermissions = function() {
  console.log('Initializing session permissions handler');
  // Radio buttons
  sessionPermissionsRadio = $("#sessionPermissionsRadioGroup input[type='radio']");
  sessionPermissionsRadio.click(function(evt) {
    var checkedValue = sessionPermissionsRadio.filter(':checked').val();
    console.log('checkedValue', checkedValue);
    localStorage.setItem('sessionPermissions', checkedValue);
  });
}

},{}],9:[function(require,module,exports){
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

var utils = require('./utils');
var initSocket = require('./socket').initSocket;
var Microphone = require('./Microphone');
var models = require('./models');
var initViews = require('./views').initViews;
var display = require('./views/display');

var micSocket;

$(document).ready(function() {


  function processString(msg, baseString, callback) {
    //if there are transcripts
    var idx = +msg.result_index;
    var running = JSON.parse(localStorage.getItem('running'));

    if (msg.results && msg.results.length > 0) {

      var alternatives = msg.results[0].alternatives;
      var text = msg.results[0].alternatives[0].transcript || '';

      //Capitalize first word
      // if final results, append a new paragraph
      if (msg.results && msg.results[0] && msg.results[0].final) {
        baseString += text;
        console.log('final res:', baseString);
        display.showResult(baseString, true);
        display.showMetaData(alternatives[0]);
      } else {
        var tempString = baseString + text;
        console.log('interimResult res:', tempString);
        display.showResult(tempString, false);
      }
    }
    if (alternatives) {
      display.showAlternatives(alternatives);
    }
    return baseString;
  }

  function initFileUpload(token, model, file, callback) {

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

    function onOpen(socket) {
      console.log('socket opened');
    }

    function onListening(socket) {
      console.log('connection listening');
      callback(socket);
    }

    function onMessage(msg) {
      console.log('ws msg', msg);
      if (msg.results) {
        baseString = processString(msg, baseString);
        baseJSON = display.showJSON(msg, baseJSON);
      }
    }

    function onError(err) {
      console.log('err', err);
    }

    initSocket(options, onOpen, onListening, onMessage, onError);

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
    options.model = model;

    function onOpen(socket) {
      console.log('socket opened');
      callback(socket);
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
      console.log('ws msg', msg);
      if (msg.results) {
        baseString = processString(msg, baseString);
        baseJSON = display.showJSON(msg, baseJSON);
      }
      // var running = JSON.parse(localStorage.getItem('running'));
      // var resultIndex = msg.result_index;
      // if (msg.results && msg.results.length > 0 && msg.results[0].final && !running) {
      //   stopMicrophone(socket, function(result) {
      //     console.log('mic stopped: ', result);
      //   });
      // }
    }

    function onError(err, socket) {
      console.log('err', err);
    }

    initSocket(options, onOpen, onListening, onMessage, onError);

  }

  // function stopMicrophone(socket, callback) {
  //   socket.send(JSON.stringify({'action': 'stop'}));
  //   callback(true);
  // }


  // Make call to API to try and get token
  var url = '/token';
  var tokenRequest = new XMLHttpRequest();
  tokenRequest.open("GET", url, true);
  tokenRequest.onload = function(evt) {

    var token = tokenRequest.responseText;
    console.log('Token ', decodeURIComponent(token));

    var mic = new Microphone();

    var modelOptions = {
      token: token
      // Uncomment in case of server CORS failure
      // url: '/api/models'
    };

    // Get available speech recognition models
    // Set them in storage
    // And display them in drop-down
    models.getModels(modelOptions, function(models) {

      console.log('STT Models ', models);

      // Save models to localstorage
      localStorage.setItem('models', JSON.stringify(models));

      // Set default current model
      localStorage.setItem('currentModel', 'en-US_BroadbandModel');


      // Send models and other
      // view context to views
      var viewContext = {
        models: models
      };


      // This stuff will be moved out to views
      function handleFileUploadEvent(evt) {
        console.log('handling file drop event');
        // Init file upload with default model
        var file = evt.dataTransfer.files[0];
        var currentModel = localStorage.getItem('currentModel');
        initFileUpload(token, currentModel, file, function(socket) {
          console.log('Uploading file', file);
          var blob = new Blob([file], {type: 'audio/l16;rate=44100'});
          utils.parseFile(blob, function(chunk) {
            console.log('Handling chunk', chunk);
            socket.send(chunk);
          });
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

      initViews(viewContext);


      // Set microphone state to not running
      localStorage.setItem('running', false);

      // This will be moved to views
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
          console.log('Not running, initMicrophone()');
          recordButton.css('background-color', '#d74108');
          recordButton.find('img').attr('src', 'img/stop.svg');
          initMicrophone(token, currentModel, mic, function(result) {
            recordButton.css('background-color', '#d74108');
            recordButton.find('img').attr('src', 'img/stop.svg');
            console.log('starting mic');
            mic.record();
          });
        } else {
          console.log('Stopping microphone, sending stop action message');
          recordButton.removeAttr('style');
          recordButton.find('img').attr('src', 'img/microphone.svg');
          // micSocket.send(JSON.stringify({'action': 'stop'}));
          var emptyBuffer = new ArrayBuffer(0);
          micSocket.send(emptyBuffer);
          mic.stop();
        }

      }, this));

    });
  }
  tokenRequest.send();

});

},{"./Microphone":1,"./models":2,"./socket":3,"./utils":4,"./views":6,"./views/display":5}]},{},[9])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5ucG0vbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwic3JjL01pY3JvcGhvbmUuanMiLCJzcmMvbW9kZWxzLmpzIiwic3JjL3NvY2tldC5qcyIsInNyYy91dGlscy5qcyIsInNyYy92aWV3cy9kaXNwbGF5LmpzIiwic3JjL3ZpZXdzL2luZGV4LmpzIiwic3JjL3ZpZXdzL3NlbGVjdG1vZGVsLmpzIiwic3JjL3ZpZXdzL3Nlc3Npb25wZXJtaXNzaW9ucy5qcyIsInNyYy9pbmRleCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKipcbiAqIENvcHlyaWdodCAyMDE0IElCTSBDb3JwLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSAnTGljZW5zZScpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiAnQVMgSVMnIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbi8qKlxuICogQ2FwdHVyZXMgbWljcm9waG9uZSBpbnB1dCBmcm9tIHRoZSBicm93c2VyLlxuICogV29ya3MgYXQgbGVhc3Qgb24gbGF0ZXN0IHZlcnNpb25zIG9mIEZpcmVmb3ggYW5kIENocm9tZVxuICovXG5mdW5jdGlvbiBNaWNyb3Bob25lKF9vcHRpb25zKSB7XG4gIHZhciBvcHRpb25zID0gX29wdGlvbnMgfHwge307XG5cbiAgLy8gd2UgcmVjb3JkIGluIG1vbm8gYmVjYXVzZSB0aGUgc3BlZWNoIHJlY29nbml0aW9uIHNlcnZpY2VcbiAgLy8gZG9lcyBub3Qgc3VwcG9ydCBzdGVyZW8uXG4gIHRoaXMuYnVmZmVyU2l6ZSA9IG9wdGlvbnMuYnVmZmVyU2l6ZSB8fCAyMDQ4O1xuICB0aGlzLmlucHV0Q2hhbm5lbHMgPSBvcHRpb25zLmlucHV0Q2hhbm5lbHMgfHwgMTtcbiAgdGhpcy5vdXRwdXRDaGFubmVscyA9IG9wdGlvbnMub3V0cHV0Q2hhbm5lbHMgfHwgMTtcbiAgdGhpcy5yZWNvcmRpbmcgPSBmYWxzZTtcbiAgdGhpcy5yZXF1ZXN0ZWRBY2Nlc3MgPSBmYWxzZTtcbiAgdGhpcy5zYW1wbGVSYXRlID0gMTYwMDA7XG4gIC8vIGF1eGlsaWFyIGJ1ZmZlciB0byBrZWVwIHVudXNlZCBzYW1wbGVzICh1c2VkIHdoZW4gZG9pbmcgZG93bnNhbXBsaW5nKVxuICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXMgPSBuZXcgRmxvYXQzMkFycmF5KDApO1xuXG4gIC8vIENocm9tZSBvciBGaXJlZm94IG9yIElFIFVzZXIgbWVkaWFcbiAgaWYgKCFuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKSB7XG4gICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSA9IG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEgfHxcbiAgICBuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tc0dldFVzZXJNZWRpYTtcbiAgfVxuXG59XG5cbi8qKlxuICogQ2FsbGVkIHdoZW4gdGhlIHVzZXIgcmVqZWN0IHRoZSB1c2Ugb2YgdGhlIG1pY2hyb3Bob25lXG4gKiBAcGFyYW0gIGVycm9yIFRoZSBlcnJvclxuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5vblBlcm1pc3Npb25SZWplY3RlZCA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnTWljcm9waG9uZS5vblBlcm1pc3Npb25SZWplY3RlZCgpJyk7XG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gZmFsc2U7XG4gIHRoaXMub25FcnJvcignUGVybWlzc2lvbiB0byBhY2Nlc3MgdGhlIG1pY3JvcGhvbmUgcmVqZXRlZC4nKTtcbn07XG5cbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uRXJyb3IgPSBmdW5jdGlvbihlcnJvcikge1xuICBjb25zb2xlLmxvZygnTWljcm9waG9uZS5vbkVycm9yKCk6JywgZXJyb3IpO1xufTtcblxuLyoqXG4gKiBDYWxsZWQgd2hlbiB0aGUgdXNlciBhdXRob3JpemVzIHRoZSB1c2Ugb2YgdGhlIG1pY3JvcGhvbmUuXG4gKiBAcGFyYW0gIHtPYmplY3R9IHN0cmVhbSBUaGUgU3RyZWFtIHRvIGNvbm5lY3QgdG9cbiAqXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uTWVkaWFTdHJlYW0gPSAgZnVuY3Rpb24oc3RyZWFtKSB7XG4gIHZhciBBdWRpb0N0eCA9IHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dDtcblxuICBpZiAoIUF1ZGlvQ3R4KVxuICAgIHRocm93IG5ldyBFcnJvcignQXVkaW9Db250ZXh0IG5vdCBhdmFpbGFibGUnKTtcblxuICBpZiAoIXRoaXMuYXVkaW9Db250ZXh0KVxuICAgIHRoaXMuYXVkaW9Db250ZXh0ID0gbmV3IEF1ZGlvQ3R4KCk7XG5cbiAgdmFyIGdhaW4gPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gIHZhciBhdWRpb0lucHV0ID0gdGhpcy5hdWRpb0NvbnRleHQuY3JlYXRlTWVkaWFTdHJlYW1Tb3VyY2Uoc3RyZWFtKTtcblxuICBhdWRpb0lucHV0LmNvbm5lY3QoZ2Fpbik7XG5cbiAgdGhpcy5taWMgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IodGhpcy5idWZmZXJTaXplLFxuICAgIHRoaXMuaW5wdXRDaGFubmVscywgdGhpcy5vdXRwdXRDaGFubmVscyk7XG5cbiAgLy8gdW5jb21tZW50IHRoZSBmb2xsb3dpbmcgbGluZSBpZiB5b3Ugd2FudCB0byB1c2UgeW91ciBtaWNyb3Bob25lIHNhbXBsZSByYXRlXG4gIC8vdGhpcy5zYW1wbGVSYXRlID0gdGhpcy5hdWRpb0NvbnRleHQuc2FtcGxlUmF0ZTtcbiAgY29uc29sZS5sb2coJ01pY3JvcGhvbmUub25NZWRpYVN0cmVhbSgpOiBzYW1wbGluZyByYXRlIGlzOicsIHRoaXMuc2FtcGxlUmF0ZSk7XG5cbiAgdGhpcy5taWMub25hdWRpb3Byb2Nlc3MgPSB0aGlzLl9vbmF1ZGlvcHJvY2Vzcy5iaW5kKHRoaXMpO1xuICB0aGlzLnN0cmVhbSA9IHN0cmVhbTtcblxuICBnYWluLmNvbm5lY3QodGhpcy5taWMpO1xuICB0aGlzLm1pYy5jb25uZWN0KHRoaXMuYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgdGhpcy5yZWNvcmRpbmcgPSB0cnVlO1xuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IGZhbHNlO1xuICB0aGlzLm9uU3RhcnRSZWNvcmRpbmcoKTtcbn07XG5cbi8qKlxuICogY2FsbGJhY2sgdGhhdCBpcyBiZWluZyB1c2VkIGJ5IHRoZSBtaWNyb3Bob25lXG4gKiB0byBzZW5kIGF1ZGlvIGNodW5rcy5cbiAqIEBwYXJhbSAge29iamVjdH0gZGF0YSBhdWRpb1xuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5fb25hdWRpb3Byb2Nlc3MgPSBmdW5jdGlvbihkYXRhKSB7XG4gIGlmICghdGhpcy5yZWNvcmRpbmcpIHtcbiAgICAvLyBXZSBzcGVhayBidXQgd2UgYXJlIG5vdCByZWNvcmRpbmdcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBTaW5nbGUgY2hhbm5lbFxuICB2YXIgY2hhbiA9IGRhdGEuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCk7XG5cbiAgdGhpcy5vbkF1ZGlvKHRoaXMuX2V4cG9ydERhdGFCdWZmZXJUbzE2S2h6KG5ldyBGbG9hdDMyQXJyYXkoY2hhbikpKTtcblxuICAvL2V4cG9ydCB3aXRoIG1pY3JvcGhvbmUgbWh6LCByZW1lbWJlciB0byB1cGRhdGUgdGhlIHRoaXMuc2FtcGxlUmF0ZVxuICAvLyB3aXRoIHRoZSBzYW1wbGUgcmF0ZSBmcm9tIHlvdXIgbWljcm9waG9uZVxuICAvLyB0aGlzLm9uQXVkaW8odGhpcy5fZXhwb3J0RGF0YUJ1ZmZlcihuZXcgRmxvYXQzMkFycmF5KGNoYW4pKSk7XG5cbn07XG5cbi8qKlxuICogU3RhcnQgdGhlIGF1ZGlvIHJlY29yZGluZ1xuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5yZWNvcmQgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCFuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKXtcbiAgICB0aGlzLm9uRXJyb3IoJ0Jyb3dzZXIgZG9lc25cXCd0IHN1cHBvcnQgbWljcm9waG9uZSBpbnB1dCcpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAodGhpcy5yZXF1ZXN0ZWRBY2Nlc3MpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IHRydWU7XG4gIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEoeyBhdWRpbzogdHJ1ZSB9LFxuICAgIHRoaXMub25NZWRpYVN0cmVhbS5iaW5kKHRoaXMpLCAvLyBNaWNyb3Bob25lIHBlcm1pc3Npb24gZ3JhbnRlZFxuICAgIHRoaXMub25QZXJtaXNzaW9uUmVqZWN0ZWQuYmluZCh0aGlzKSk7IC8vIE1pY3JvcGhvbmUgcGVybWlzc2lvbiByZWplY3RlZFxufTtcblxuLyoqXG4gKiBTdG9wIHRoZSBhdWRpbyByZWNvcmRpbmdcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMucmVjb3JkaW5nKVxuICAgIHJldHVybjtcbiAgdGhpcy5yZWNvcmRpbmcgPSBmYWxzZTtcbiAgdGhpcy5zdHJlYW0uc3RvcCgpO1xuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IGZhbHNlO1xuICB0aGlzLm1pYy5kaXNjb25uZWN0KDApO1xuICB0aGlzLm1pYyA9IG51bGw7XG4gIHRoaXMub25TdG9wUmVjb3JkaW5nKCk7XG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYSBCbG9iIHR5cGU6ICdhdWRpby9sMTYnIHdpdGggdGhlIGNodW5rIGFuZCBkb3duc2FtcGxpbmcgdG8gMTYga0h6XG4gKiBjb21pbmcgZnJvbSB0aGUgbWljcm9waG9uZS5cbiAqIEV4cGxhbmF0aW9uIGZvciB0aGUgbWF0aDogVGhlIHJhdyB2YWx1ZXMgY2FwdHVyZWQgZnJvbSB0aGUgV2ViIEF1ZGlvIEFQSSBhcmVcbiAqIGluIDMyLWJpdCBGbG9hdGluZyBQb2ludCwgYmV0d2VlbiAtMSBhbmQgMSAocGVyIHRoZSBzcGVjaWZpY2F0aW9uKS5cbiAqIFRoZSB2YWx1ZXMgZm9yIDE2LWJpdCBQQ00gcmFuZ2UgYmV0d2VlbiAtMzI3NjggYW5kICszMjc2NyAoMTYtYml0IHNpZ25lZCBpbnRlZ2VyKS5cbiAqIE11bHRpcGx5IHRvIGNvbnRyb2wgdGhlIHZvbHVtZSBvZiB0aGUgb3V0cHV0LiBXZSBzdG9yZSBpbiBsaXR0bGUgZW5kaWFuLlxuICogQHBhcmFtICB7T2JqZWN0fSBidWZmZXIgTWljcm9waG9uZSBhdWRpbyBjaHVua1xuICogQHJldHVybiB7QmxvYn0gJ2F1ZGlvL2wxNicgY2h1bmtcbiAqIEBkZXByZWNhdGVkIFRoaXMgbWV0aG9kIGlzIGRlcHJhY2F0ZWRcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUuX2V4cG9ydERhdGFCdWZmZXJUbzE2S2h6ID0gZnVuY3Rpb24oYnVmZmVyTmV3U2FtcGxlcykge1xuICB2YXIgYnVmZmVyID0gbnVsbCxcbiAgICBuZXdTYW1wbGVzID0gYnVmZmVyTmV3U2FtcGxlcy5sZW5ndGgsXG4gICAgdW51c2VkU2FtcGxlcyA9IHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlcy5sZW5ndGg7XG5cbiAgaWYgKHVudXNlZFNhbXBsZXMgPiAwKSB7XG4gICAgYnVmZmVyID0gbmV3IEZsb2F0MzJBcnJheSh1bnVzZWRTYW1wbGVzICsgbmV3U2FtcGxlcyk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bnVzZWRTYW1wbGVzOyArK2kpIHtcbiAgICAgIGJ1ZmZlcltpXSA9IHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlc1tpXTtcbiAgICB9XG4gICAgZm9yIChpID0gMDsgaSA8IG5ld1NhbXBsZXM7ICsraSkge1xuICAgICAgYnVmZmVyW3VudXNlZFNhbXBsZXMgKyBpXSA9IGJ1ZmZlck5ld1NhbXBsZXNbaV07XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGJ1ZmZlciA9IGJ1ZmZlck5ld1NhbXBsZXM7XG4gIH1cblxuICAvLyBkb3duc2FtcGxpbmcgdmFyaWFibGVzXG4gIHZhciBmaWx0ZXIgPSBbXG4gICAgICAtMC4wMzc5MzUsIC0wLjAwMDg5MDI0LCAwLjA0MDE3MywgMC4wMTk5ODksIDAuMDA0Nzc5MiwgLTAuMDU4Njc1LCAtMC4wNTY0ODcsXG4gICAgICAtMC4wMDQwNjUzLCAwLjE0NTI3LCAwLjI2OTI3LCAwLjMzOTEzLCAwLjI2OTI3LCAwLjE0NTI3LCAtMC4wMDQwNjUzLCAtMC4wNTY0ODcsXG4gICAgICAtMC4wNTg2NzUsIDAuMDA0Nzc5MiwgMC4wMTk5ODksIDAuMDQwMTczLCAtMC4wMDA4OTAyNCwgLTAuMDM3OTM1XG4gICAgXSxcbiAgICBzYW1wbGluZ1JhdGVSYXRpbyA9IHRoaXMuYXVkaW9Db250ZXh0LnNhbXBsZVJhdGUgLyAxNjAwMCxcbiAgICBuT3V0cHV0U2FtcGxlcyA9IE1hdGguZmxvb3IoKGJ1ZmZlci5sZW5ndGggLSBmaWx0ZXIubGVuZ3RoKSAvIChzYW1wbGluZ1JhdGVSYXRpbykpICsgMSxcbiAgICBwY21FbmNvZGVkQnVmZmVyMTZrID0gbmV3IEFycmF5QnVmZmVyKG5PdXRwdXRTYW1wbGVzICogMiksXG4gICAgZGF0YVZpZXcxNmsgPSBuZXcgRGF0YVZpZXcocGNtRW5jb2RlZEJ1ZmZlcjE2ayksXG4gICAgaW5kZXggPSAwLFxuICAgIHZvbHVtZSA9IDB4N0ZGRiwgLy9yYW5nZSBmcm9tIDAgdG8gMHg3RkZGIHRvIGNvbnRyb2wgdGhlIHZvbHVtZVxuICAgIG5PdXQgPSAwO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpICsgZmlsdGVyLmxlbmd0aCAtIDEgPCBidWZmZXIubGVuZ3RoOyBpID0gTWF0aC5yb3VuZChzYW1wbGluZ1JhdGVSYXRpbyAqIG5PdXQpKSB7XG4gICAgdmFyIHNhbXBsZSA9IDA7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBmaWx0ZXIubGVuZ3RoOyArK2opIHtcbiAgICAgIHNhbXBsZSArPSBidWZmZXJbaSArIGpdICogZmlsdGVyW2pdO1xuICAgIH1cbiAgICBzYW1wbGUgKj0gdm9sdW1lO1xuICAgIGRhdGFWaWV3MTZrLnNldEludDE2KGluZGV4LCBzYW1wbGUsIHRydWUpOyAvLyAndHJ1ZScgLT4gbWVhbnMgbGl0dGxlIGVuZGlhblxuICAgIGluZGV4ICs9IDI7XG4gICAgbk91dCsrO1xuICB9XG5cbiAgdmFyIGluZGV4U2FtcGxlQWZ0ZXJMYXN0VXNlZCA9IE1hdGgucm91bmQoc2FtcGxpbmdSYXRlUmF0aW8gKiBuT3V0KTtcbiAgdmFyIHJlbWFpbmluZyA9IGJ1ZmZlci5sZW5ndGggLSBpbmRleFNhbXBsZUFmdGVyTGFzdFVzZWQ7XG4gIGlmIChyZW1haW5pbmcgPiAwKSB7XG4gICAgdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzID0gbmV3IEZsb2F0MzJBcnJheShyZW1haW5pbmcpO1xuICAgIGZvciAoaSA9IDA7IGkgPCByZW1haW5pbmc7ICsraSkge1xuICAgICAgdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzW2ldID0gYnVmZmVyW2luZGV4U2FtcGxlQWZ0ZXJMYXN0VXNlZCArIGldO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXMgPSBuZXcgRmxvYXQzMkFycmF5KDApO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBCbG9iKFtkYXRhVmlldzE2a10sIHtcbiAgICB0eXBlOiAnYXVkaW8vbDE2J1xuICB9KTtcbiAgfTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgQmxvYiB0eXBlOiAnYXVkaW8vbDE2JyB3aXRoIHRoZVxuICogY2h1bmsgY29taW5nIGZyb20gdGhlIG1pY3JvcGhvbmUuXG4gKi9cbnZhciBleHBvcnREYXRhQnVmZmVyID0gZnVuY3Rpb24oYnVmZmVyLCBidWZmZXJTaXplKSB7XG4gIHZhciBwY21FbmNvZGVkQnVmZmVyID0gbnVsbCxcbiAgICBkYXRhVmlldyA9IG51bGwsXG4gICAgaW5kZXggPSAwLFxuICAgIHZvbHVtZSA9IDB4N0ZGRjsgLy9yYW5nZSBmcm9tIDAgdG8gMHg3RkZGIHRvIGNvbnRyb2wgdGhlIHZvbHVtZVxuXG4gIHBjbUVuY29kZWRCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoYnVmZmVyU2l6ZSAqIDIpO1xuICBkYXRhVmlldyA9IG5ldyBEYXRhVmlldyhwY21FbmNvZGVkQnVmZmVyKTtcblxuICAvKiBFeHBsYW5hdGlvbiBmb3IgdGhlIG1hdGg6IFRoZSByYXcgdmFsdWVzIGNhcHR1cmVkIGZyb20gdGhlIFdlYiBBdWRpbyBBUEkgYXJlXG4gICAqIGluIDMyLWJpdCBGbG9hdGluZyBQb2ludCwgYmV0d2VlbiAtMSBhbmQgMSAocGVyIHRoZSBzcGVjaWZpY2F0aW9uKS5cbiAgICogVGhlIHZhbHVlcyBmb3IgMTYtYml0IFBDTSByYW5nZSBiZXR3ZWVuIC0zMjc2OCBhbmQgKzMyNzY3ICgxNi1iaXQgc2lnbmVkIGludGVnZXIpLlxuICAgKiBNdWx0aXBseSB0byBjb250cm9sIHRoZSB2b2x1bWUgb2YgdGhlIG91dHB1dC4gV2Ugc3RvcmUgaW4gbGl0dGxlIGVuZGlhbi5cbiAgICovXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyLmxlbmd0aDsgaSsrKSB7XG4gICAgZGF0YVZpZXcuc2V0SW50MTYoaW5kZXgsIGJ1ZmZlcltpXSAqIHZvbHVtZSwgdHJ1ZSk7XG4gICAgaW5kZXggKz0gMjtcbiAgfVxuXG4gIC8vIGwxNiBpcyB0aGUgTUlNRSB0eXBlIGZvciAxNi1iaXQgUENNXG4gIHJldHVybiBuZXcgQmxvYihbZGF0YVZpZXddLCB7IHR5cGU6ICdhdWRpby9sMTYnIH0pO1xufTtcblxuTWljcm9waG9uZS5wcm90b3R5cGUuX2V4cG9ydERhdGFCdWZmZXIgPSBmdW5jdGlvbihidWZmZXIpe1xuICB1dGlscy5leHBvcnREYXRhQnVmZmVyKGJ1ZmZlciwgdGhpcy5idWZmZXJTaXplKTtcbn07IFxuXG5cbi8vIEZ1bmN0aW9ucyB1c2VkIHRvIGNvbnRyb2wgTWljcm9waG9uZSBldmVudHMgbGlzdGVuZXJzLlxuTWljcm9waG9uZS5wcm90b3R5cGUub25TdGFydFJlY29yZGluZyA9ICBmdW5jdGlvbigpIHt9O1xuTWljcm9waG9uZS5wcm90b3R5cGUub25TdG9wUmVjb3JkaW5nID0gIGZ1bmN0aW9uKCkge307XG5NaWNyb3Bob25lLnByb3RvdHlwZS5vbkF1ZGlvID0gIGZ1bmN0aW9uKCkge307XG5cbm1vZHVsZS5leHBvcnRzID0gTWljcm9waG9uZTtcblxuIiwiXG5leHBvcnRzLmdldE1vZGVscyA9IGZ1bmN0aW9uKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciB0b2tlbiA9IG9wdGlvbnMudG9rZW47XG4gIHZhciBtb2RlbFVybCA9IG9wdGlvbnMudXJsIHx8ICdodHRwczovL3N0cmVhbS1zLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC1iZXRhL2FwaS92MS9tb2RlbHMnO1xuICB2YXIgc3R0UmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICBzdHRSZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgbW9kZWxVcmwsIHRydWUpO1xuICBzdHRSZXF1ZXN0LndpdGhDcmVkZW50aWFscyA9IHRydWU7XG4gIHN0dFJlcXVlc3Quc2V0UmVxdWVzdEhlYWRlcignQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgc3R0UmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKCdYLVdhdHNvbi1BdXRob3JpemF0aW9uLVRva2VuJywgdG9rZW4pO1xuICBzdHRSZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciByZXNwb25zZSA9IEpTT04ucGFyc2Uoc3R0UmVxdWVzdC5yZXNwb25zZVRleHQpO1xuICAgIGNhbGxiYWNrKHJlc3BvbnNlLm1vZGVscyk7XG4gIH07XG4gIHN0dFJlcXVlc3Quc2VuZCgpO1xufVxuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4vKmdsb2JhbCAkOmZhbHNlICovXG5cblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xudmFyIE1pY3JvcGhvbmUgPSByZXF1aXJlKCcuL01pY3JvcGhvbmUnKTtcblxuLy8gTWluaSBXUyBjYWxsYmFjayBBUEksIHNvIHdlIGNhbiBpbml0aWFsaXplXG4vLyB3aXRoIG1vZGVsIGFuZCB0b2tlbiBpbiBVUkksIHBsdXNcbi8vIHN0YXJ0IG1lc3NhZ2VcbmV4cG9ydHMuaW5pdFNvY2tldCA9IGZ1bmN0aW9uKG9wdGlvbnMsIG9ub3Blbiwgb25saXN0ZW5pbmcsIG9ubWVzc2FnZSwgb25lcnJvcikge1xuICB2YXIgbGlzdGVuaW5nID0gZmFsc2U7XG4gIGZ1bmN0aW9uIHdpdGhEZWZhdWx0KHZhbCwgZGVmYXVsdFZhbCkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsID09PSAndW5kZWZpbmVkJyA/IGRlZmF1bHRWYWwgOiB2YWw7XG4gIH1cbiAgdmFyIHRva2VuID0gb3B0aW9ucy50b2tlbjtcbiAgdmFyIG1vZGVsID0gb3B0aW9ucy5tb2RlbCB8fCAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnO1xuICB2YXIgbWVzc2FnZSA9IG9wdGlvbnMubWVzc2FnZSB8fCB7J2FjdGlvbic6ICdzdGFydCd9O1xuICB2YXIgc2Vzc2lvblBlcm1pc3Npb25zID0gd2l0aERlZmF1bHQob3B0aW9ucy5zZXNzaW9uUGVybWlzc2lvbnMsIEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3Nlc3Npb25QZXJtaXNzaW9ucycpKSk7XG4gIHZhciBzZXNzaW9uUGVybWlzc2lvbnNRdWVyeVBhcmFtID0gc2Vzc2lvblBlcm1pc3Npb25zID8gJzAnIDogJzEnO1xuICB2YXIgdXJsID0gb3B0aW9ucy5zZXJ2aWNlVVJJIHx8ICd3c3M6Ly9zdHJlYW0tcy53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQtYmV0YS9hcGkvdjEvcmVjb2duaXplP3dhdHNvbi10b2tlbj0nXG4gICAgKyB0b2tlblxuICAgICsgJyZYLVdEQy1QTC1PUFQtT1VUPScgKyBzZXNzaW9uUGVybWlzc2lvbnNRdWVyeVBhcmFtXG4gICAgKyAnJm1vZGVsPScgKyBtb2RlbDtcbiAgY29uc29sZS5sb2coJ1VSTCBtb2RlbCcsIG1vZGVsKTtcbiAgdmFyIHNvY2tldCA9IG5ldyBXZWJTb2NrZXQodXJsKTtcbiAgc29ja2V0Lm9ub3BlbiA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIGNvbnNvbGUubG9nKCd3cyBvcGVuZWQnKTtcbiAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeShtZXNzYWdlKSk7XG4gICAgb25vcGVuKHNvY2tldCk7XG4gIH07XG4gIHNvY2tldC5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgbXNnID0gSlNPTi5wYXJzZShldnQuZGF0YSk7XG4gICAgY29uc29sZS5sb2coJ2V2dCcsIGV2dCk7XG4gICAgaWYgKG1zZy5zdGF0ZSA9PT0gJ2xpc3RlbmluZycpIHtcbiAgICAgIGNvbnNvbGUubG9nKCcqKioqKioqKioqKlNPQ0tFVCBMSVNURU5JTkcqKioqKioqKioqKioqJyk7XG4gICAgICBjb25zb2xlLmxvZygnbGlzdGVuaW5nIHN0YXRlOiAnLCBsaXN0ZW5pbmcpO1xuICAgICAgaWYgKCFsaXN0ZW5pbmcpIHtcbiAgICAgICAgb25saXN0ZW5pbmcoc29ja2V0KTtcbiAgICAgICAgbGlzdGVuaW5nID0gdHJ1ZTtcbiAgICAgIH0gaWYgKGxpc3RlbmluZykge1xuICAgICAgICBjb25zb2xlLmxvZygnY2xvc2luZyBzb2NrZXQnKTtcbiAgICAgICAgY29uc29sZS5sb2coJ3NvY2tldCBzdGF0ZTogJywgc29ja2V0LnJlYWR5U3RhdGUpO1xuICAgICAgICBzb2NrZXQuY2xvc2UoKTtcbiAgICAgICAgLy8gdmFyIGJ1ZiA9IG5ldyBBcnJheUJ1ZmZlcigyKTtcbiAgICAgICAgLy8gdmFyIGJ1ZlZpZXcgPSBuZXcgVWludDE2QXJyYXkoYnVmKTtcbiAgICAgICAgLy8gYnVmVmlld1swXSA9IDB4ODg7XG4gICAgICAgIC8vIHNvY2tldC5zZW5kKGJ1ZlZpZXcpXG4gICAgICAgIC8vIHNvY2tldC5jbG9zZSgpO1xuICAgICAgfVxuICAgIH1cbiAgICBvbm1lc3NhZ2UobXNnLCBzb2NrZXQpO1xuICB9O1xuICBzb2NrZXQub25lcnJvciA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciBlcnIgPSBldnQuZGF0YTtcbiAgICBvbmVycm9yKGVyciwgc29ja2V0KTtcbiAgfTtcbn1cblxuIiwiXG4vKipcbiAqIENyZWF0ZXMgYSBCbG9iIHR5cGU6ICdhdWRpby9sMTYnIHdpdGggdGhlXG4gKiBjaHVuayBjb21pbmcgZnJvbSB0aGUgbWljcm9waG9uZS5cbiAqL1xudmFyIGV4cG9ydERhdGFCdWZmZXIgPSBleHBvcnRzLmV4cG9ydERhdGFCdWZmZXIgPSBmdW5jdGlvbihidWZmZXIsIGJ1ZmZlclNpemUpIHtcbiAgdmFyIHBjbUVuY29kZWRCdWZmZXIgPSBudWxsLFxuICAgIGRhdGFWaWV3ID0gbnVsbCxcbiAgICBpbmRleCA9IDAsXG4gICAgdm9sdW1lID0gMHg3RkZGOyAvL3JhbmdlIGZyb20gMCB0byAweDdGRkYgdG8gY29udHJvbCB0aGUgdm9sdW1lXG5cbiAgcGNtRW5jb2RlZEJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihidWZmZXJTaXplICogMik7XG4gIGRhdGFWaWV3ID0gbmV3IERhdGFWaWV3KHBjbUVuY29kZWRCdWZmZXIpO1xuXG4gIC8qIEV4cGxhbmF0aW9uIGZvciB0aGUgbWF0aDogVGhlIHJhdyB2YWx1ZXMgY2FwdHVyZWQgZnJvbSB0aGUgV2ViIEF1ZGlvIEFQSSBhcmVcbiAgICogaW4gMzItYml0IEZsb2F0aW5nIFBvaW50LCBiZXR3ZWVuIC0xIGFuZCAxIChwZXIgdGhlIHNwZWNpZmljYXRpb24pLlxuICAgKiBUaGUgdmFsdWVzIGZvciAxNi1iaXQgUENNIHJhbmdlIGJldHdlZW4gLTMyNzY4IGFuZCArMzI3NjcgKDE2LWJpdCBzaWduZWQgaW50ZWdlcikuXG4gICAqIE11bHRpcGx5IHRvIGNvbnRyb2wgdGhlIHZvbHVtZSBvZiB0aGUgb3V0cHV0LiBXZSBzdG9yZSBpbiBsaXR0bGUgZW5kaWFuLlxuICAgKi9cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXIubGVuZ3RoOyBpKyspIHtcbiAgICBkYXRhVmlldy5zZXRJbnQxNihpbmRleCwgYnVmZmVyW2ldICogdm9sdW1lLCB0cnVlKTtcbiAgICBpbmRleCArPSAyO1xuICB9XG5cbiAgLy8gbDE2IGlzIHRoZSBNSU1FIHR5cGUgZm9yIDE2LWJpdCBQQ01cbiAgcmV0dXJuIG5ldyBCbG9iKFtkYXRhVmlld10sIHsgdHlwZTogJ2F1ZGlvL2wxNicgfSk7XG59O1xuXG4vLyBGcm9tIGFsZWRpYWZlcmlhJ3MgU08gcmVzcG9uc2Vcbi8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTQ0MzgxODcvamF2YXNjcmlwdC1maWxlcmVhZGVyLXBhcnNpbmctbG9uZy1maWxlLWluLWNodW5rc1xuZXhwb3J0cy5wYXJzZUZpbGUgPSBmdW5jdGlvbihmaWxlLCBjYWxsYmFjaykge1xuICAgIHZhciBmaWxlU2l6ZSAgID0gZmlsZS5zaXplO1xuICAgIHZhciBjaHVua1NpemUgID0gMjA0OCAqIDQ7IC8vIGJ5dGVzXG4gICAgdmFyIG9mZnNldCAgICAgPSA0NDtcbiAgICB2YXIgc2VsZiAgICAgICA9IHRoaXM7IC8vIHdlIG5lZWQgYSByZWZlcmVuY2UgdG8gdGhlIGN1cnJlbnQgb2JqZWN0XG4gICAgdmFyIGJsb2NrICAgICAgPSBudWxsO1xuICAgIHZhciBjb3VudCAgICAgID0gMDtcbiAgICB2YXIgZm9vID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgIGlmIChvZmZzZXQgPj0gZmlsZVNpemUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiRG9uZSByZWFkaW5nIGZpbGVcIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV2dC50YXJnZXQuZXJyb3IgPT0gbnVsbCkge1xuICAgICAgICAgICAgdmFyIGJ1ZmZlciA9IGV2dC50YXJnZXQucmVzdWx0O1xuICAgICAgICAgICAgdmFyIGxlbiA9IGJ1ZmZlci5ieXRlTGVuZ3RoO1xuICAgICAgICAgICAgb2Zmc2V0ICs9IGxlbjtcbiAgICAgICAgICAgIHZhciBmaW5hbEJsb2IgPSBleHBvcnREYXRhQnVmZmVyKGJ1ZmZlciwgbGVuKTtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIGNhbGxiYWNrKGJ1ZmZlcik7IC8vIGNhbGxiYWNrIGZvciBoYW5kbGluZyByZWFkIGNodW5rXG4gICAgICAgICAgICB9LCBjb3VudCAqIDEwMCk7XG4gICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJSZWFkIGVycm9yOiBcIiArIGV2dC50YXJnZXQuZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGJsb2NrKG9mZnNldCwgY2h1bmtTaXplLCBmaWxlKTtcbiAgICB9XG4gICAgYmxvY2sgPSBmdW5jdGlvbihfb2Zmc2V0LCBsZW5ndGgsIF9maWxlKSB7XG4gICAgICAgIHZhciByID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgICAgdmFyIGJsb2IgPSBfZmlsZS5zbGljZShfb2Zmc2V0LCBsZW5ndGggKyBfb2Zmc2V0KTtcbiAgICAgICAgci5vbmxvYWQgPSBmb287XG4gICAgICAgIHIucmVhZEFzQXJyYXlCdWZmZXIoYmxvYik7XG4gICAgfVxuICAgIGJsb2NrKG9mZnNldCwgY2h1bmtTaXplLCBmaWxlKTtcbn1cblxuXG4iLCJcbnZhciBzaG93VGltZXN0YW1wcyA9IGZ1bmN0aW9uKHRpbWVzdGFtcHMpIHtcbiAgdGltZXN0YW1wcy5mb3JFYWNoKGZ1bmN0aW9uKHRpbWVzdGFtcCkge1xuICAgIHZhciB3b3JkID0gdGltZXN0YW1wWzBdLFxuICAgICAgdDAgPSB0aW1lc3RhbXBbMV0sXG4gICAgICB0MSA9IHRpbWVzdGFtcFsyXTtcbiAgICB2YXIgdGltZWxlbmd0aCA9IHQxIC0gdDA7XG4gICAgJCgnLnRhYmxlLWhlYWRlci1yb3cnKS5hcHBlbmQoJzx0aD4nICsgd29yZCArICc8L3RoPicpO1xuICAgICQoJy50aW1lLWxlbmd0aC1yb3cnKS5hcHBlbmQoJzx0ZD4nICsgdGltZWxlbmd0aC50b1N0cmluZygpLnN1YnN0cmluZygwLCAzKSArICcgczwvdGQ+Jyk7XG4gIH0pO1xufVxuXG52YXIgc2hvd1dvcmRDb25maWRlbmNlID0gZnVuY3Rpb24oY29uZmlkZW5jZXMpIHtcbiAgY29uc29sZS5sb2coJ2NvbmZpZGVuY2VzJywgY29uZmlkZW5jZXMpO1xuICBjb25maWRlbmNlcy5mb3JFYWNoKGZ1bmN0aW9uKGNvbmZpZGVuY2UpIHtcbiAgICB2YXIgZGlzcGxheUNvbmZpZGVuY2UgPSBjb25maWRlbmNlWzFdLnRvU3RyaW5nKCkuc3Vic3RyaW5nKDAsIDMpO1xuICAgICQoJy5jb25maWRlbmNlLXNjb3JlLXJvdycpLmFwcGVuZCgnPHRkPicgKyBkaXNwbGF5Q29uZmlkZW5jZSArICcgPC90ZD4nKTtcbiAgfSk7XG59XG5cbmV4cG9ydHMuc2hvd01ldGFEYXRhID0gZnVuY3Rpb24oYWx0ZXJuYXRpdmUpIHtcbiAgdmFyIHRpbWVzdGFtcHMgPSBhbHRlcm5hdGl2ZS50aW1lc3RhbXBzO1xuICBpZiAodGltZXN0YW1wcyAmJiB0aW1lc3RhbXBzLmxlbmd0aCA+IDApIHtcbiAgICBzaG93VGltZXN0YW1wcyh0aW1lc3RhbXBzKTtcbiAgfVxuICB2YXIgY29uZmlkZW5jZXMgPSBhbHRlcm5hdGl2ZS53b3JkX2NvbmZpZGVuY2U7O1xuICBpZiAoY29uZmlkZW5jZXMgJiYgY29uZmlkZW5jZXMubGVuZ3RoID4gMCkge1xuICAgIHNob3dXb3JkQ29uZmlkZW5jZShjb25maWRlbmNlcyk7XG4gIH1cbn1cblxuZXhwb3J0cy5zaG93QWx0ZXJuYXRpdmVzID0gZnVuY3Rpb24oYWx0ZXJuYXRpdmVzKSB7XG4gIHZhciAkaHlwb3RoZXNlcyA9ICQoJy5oeXBvdGhlc2VzIHVsJyk7XG4gICRoeXBvdGhlc2VzLmh0bWwoJycpO1xuICBhbHRlcm5hdGl2ZXMuZm9yRWFjaChmdW5jdGlvbihhbHRlcm5hdGl2ZSwgaWR4KSB7XG4gICAgJGh5cG90aGVzZXMuYXBwZW5kKCc8bGkgZGF0YS1oeXBvdGhlc2lzLWluZGV4PScgKyBpZHggKyAnID4nICsgYWx0ZXJuYXRpdmUudHJhbnNjcmlwdCArICc8L2xpPicpO1xuICB9KTtcbiAgJGh5cG90aGVzZXMub24oJ2NsaWNrJywgXCJsaVwiLCBmdW5jdGlvbiAoKSB7XG4gICAgY29uc29sZS5sb2coXCJzaG93aW5nIG1ldGFkYXRhXCIpO1xuICAgIHZhciBpZHggPSArICQodGhpcykuZGF0YSgnaHlwb3RoZXNpcy1pbmRleCcpO1xuICAgIHZhciBhbHRlcm5hdGl2ZSA9IGFsdGVybmF0aXZlc1tpZHhdO1xuICAgIHNob3dNZXRhRGF0YShhbHRlcm5hdGl2ZSk7XG4gIH0pO1xufVxuXG5cbmV4cG9ydHMuc2hvd0pTT04gPSBmdW5jdGlvbihtc2csIGJhc2VKU09OKSB7XG4gIHZhciBqc29uID0gSlNPTi5zdHJpbmdpZnkobXNnKTtcbiAgYmFzZUpTT04gKz0ganNvbjtcbiAgYmFzZUpTT04gKz0gJ1xcbic7XG4gICQoJyNyZXN1bHRzSlNPTicpLnZhbChiYXNlSlNPTik7XG4gIHJldHVybiBiYXNlSlNPTjtcbn1cblxuLy8gVE9ETzogQ29udmVydCB0byBjbG9zdXJlIGFwcHJvYWNoXG5leHBvcnRzLnNob3dSZXN1bHQgPSBmdW5jdGlvbihiYXNlU3RyaW5nLCBpc0ZpbmlzaGVkKSB7XG5cbiAgaWYgKGlzRmluaXNoZWQpIHtcbiAgICB2YXIgZm9ybWF0dGVkU3RyaW5nID0gYmFzZVN0cmluZy5zbGljZSgwLCAtMSk7XG4gICAgZm9ybWF0dGVkU3RyaW5nID0gZm9ybWF0dGVkU3RyaW5nLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgZm9ybWF0dGVkU3RyaW5nLnN1YnN0cmluZygxKTtcbiAgICBmb3JtYXR0ZWRTdHJpbmcgPSBmb3JtYXR0ZWRTdHJpbmcudHJpbSgpICsgJy4nO1xuICAgIGNvbnNvbGUubG9nKCdmb3JtYXR0ZWQgZmluYWwgcmVzOicsIGZvcm1hdHRlZFN0cmluZyk7XG4gICAgJCgnI3Jlc3VsdHNUZXh0JykudmFsKGZvcm1hdHRlZFN0cmluZyk7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS5sb2coJ2ludGVyaW1SZXN1bHQgcmVzOicsIGJhc2VTdHJpbmcpO1xuICAgICQoJyNyZXN1bHRzVGV4dCcpLnZhbChiYXNlU3RyaW5nKTtcbiAgfVxuXG59XG4iLCJcbnZhciBpbml0U2Vzc2lvblBlcm1pc3Npb25zID0gcmVxdWlyZSgnLi9zZXNzaW9ucGVybWlzc2lvbnMnKS5pbml0U2Vzc2lvblBlcm1pc3Npb25zO1xudmFyIGluaXRTZWxlY3RNb2RlbCA9IHJlcXVpcmUoJy4vc2VsZWN0bW9kZWwnKS5pbml0U2VsZWN0TW9kZWw7XG5cblxuZXhwb3J0cy5pbml0Vmlld3MgPSBmdW5jdGlvbihjdHgpIHtcbiAgY29uc29sZS5sb2coJ0luaXRpYWxpemluZyB2aWV3cy4uLicpO1xuICBpbml0U2VsZWN0TW9kZWwoY3R4KTtcbiAgaW5pdFNlc3Npb25QZXJtaXNzaW9ucygpO1xufVxuIiwiXG5leHBvcnRzLmluaXRTZWxlY3RNb2RlbCA9IGZ1bmN0aW9uKGN0eCkge1xuXG4gIGN0eC5tb2RlbHMuZm9yRWFjaChmdW5jdGlvbihtb2RlbCkge1xuICAgICQoXCJzZWxlY3QjZHJvcGRvd25NZW51MVwiKS5hcHBlbmQoICQoXCI8b3B0aW9uPlwiKVxuICAgICAgLnZhbChtb2RlbC5uYW1lKVxuICAgICAgLmh0bWwobW9kZWwuZGVzY3JpcHRpb24pXG4gICAgICApO1xuICB9KTtcblxuICAkKFwic2VsZWN0I2Ryb3Bkb3duTWVudTFcIikuY2hhbmdlKGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciBtb2RlbE5hbWUgPSAkKFwic2VsZWN0I2Ryb3Bkb3duTWVudTFcIikudmFsKCk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRNb2RlbCcsIG1vZGVsTmFtZSk7XG4gIH0pO1xuXG59XG4iLCJcblxuZXhwb3J0cy5pbml0U2Vzc2lvblBlcm1pc3Npb25zID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUubG9nKCdJbml0aWFsaXppbmcgc2Vzc2lvbiBwZXJtaXNzaW9ucyBoYW5kbGVyJyk7XG4gIC8vIFJhZGlvIGJ1dHRvbnNcbiAgc2Vzc2lvblBlcm1pc3Npb25zUmFkaW8gPSAkKFwiI3Nlc3Npb25QZXJtaXNzaW9uc1JhZGlvR3JvdXAgaW5wdXRbdHlwZT0ncmFkaW8nXVwiKTtcbiAgc2Vzc2lvblBlcm1pc3Npb25zUmFkaW8uY2xpY2soZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIGNoZWNrZWRWYWx1ZSA9IHNlc3Npb25QZXJtaXNzaW9uc1JhZGlvLmZpbHRlcignOmNoZWNrZWQnKS52YWwoKTtcbiAgICBjb25zb2xlLmxvZygnY2hlY2tlZFZhbHVlJywgY2hlY2tlZFZhbHVlKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnc2Vzc2lvblBlcm1pc3Npb25zJywgY2hlY2tlZFZhbHVlKTtcbiAgfSk7XG59XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDE0IElCTSBDb3JwLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbi8qZ2xvYmFsICQ6ZmFsc2UgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vLyBUT0RPOiByZWZhY3RvciB0aGlzIGludG8gbXVsdGlwbGUgc21hbGxlciBtb2R1bGVzXG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnZhciBpbml0U29ja2V0ID0gcmVxdWlyZSgnLi9zb2NrZXQnKS5pbml0U29ja2V0O1xudmFyIE1pY3JvcGhvbmUgPSByZXF1aXJlKCcuL01pY3JvcGhvbmUnKTtcbnZhciBtb2RlbHMgPSByZXF1aXJlKCcuL21vZGVscycpO1xudmFyIGluaXRWaWV3cyA9IHJlcXVpcmUoJy4vdmlld3MnKS5pbml0Vmlld3M7XG52YXIgZGlzcGxheSA9IHJlcXVpcmUoJy4vdmlld3MvZGlzcGxheScpO1xuXG52YXIgbWljU29ja2V0O1xuXG4kKGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpIHtcblxuXG4gIGZ1bmN0aW9uIHByb2Nlc3NTdHJpbmcobXNnLCBiYXNlU3RyaW5nLCBjYWxsYmFjaykge1xuICAgIC8vaWYgdGhlcmUgYXJlIHRyYW5zY3JpcHRzXG4gICAgdmFyIGlkeCA9ICttc2cucmVzdWx0X2luZGV4O1xuICAgIHZhciBydW5uaW5nID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgncnVubmluZycpKTtcblxuICAgIGlmIChtc2cucmVzdWx0cyAmJiBtc2cucmVzdWx0cy5sZW5ndGggPiAwKSB7XG5cbiAgICAgIHZhciBhbHRlcm5hdGl2ZXMgPSBtc2cucmVzdWx0c1swXS5hbHRlcm5hdGl2ZXM7XG4gICAgICB2YXIgdGV4dCA9IG1zZy5yZXN1bHRzWzBdLmFsdGVybmF0aXZlc1swXS50cmFuc2NyaXB0IHx8ICcnO1xuXG4gICAgICAvL0NhcGl0YWxpemUgZmlyc3Qgd29yZFxuICAgICAgLy8gaWYgZmluYWwgcmVzdWx0cywgYXBwZW5kIGEgbmV3IHBhcmFncmFwaFxuICAgICAgaWYgKG1zZy5yZXN1bHRzICYmIG1zZy5yZXN1bHRzWzBdICYmIG1zZy5yZXN1bHRzWzBdLmZpbmFsKSB7XG4gICAgICAgIGJhc2VTdHJpbmcgKz0gdGV4dDtcbiAgICAgICAgY29uc29sZS5sb2coJ2ZpbmFsIHJlczonLCBiYXNlU3RyaW5nKTtcbiAgICAgICAgZGlzcGxheS5zaG93UmVzdWx0KGJhc2VTdHJpbmcsIHRydWUpO1xuICAgICAgICBkaXNwbGF5LnNob3dNZXRhRGF0YShhbHRlcm5hdGl2ZXNbMF0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHRlbXBTdHJpbmcgPSBiYXNlU3RyaW5nICsgdGV4dDtcbiAgICAgICAgY29uc29sZS5sb2coJ2ludGVyaW1SZXN1bHQgcmVzOicsIHRlbXBTdHJpbmcpO1xuICAgICAgICBkaXNwbGF5LnNob3dSZXN1bHQodGVtcFN0cmluZywgZmFsc2UpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoYWx0ZXJuYXRpdmVzKSB7XG4gICAgICBkaXNwbGF5LnNob3dBbHRlcm5hdGl2ZXMoYWx0ZXJuYXRpdmVzKTtcbiAgICB9XG4gICAgcmV0dXJuIGJhc2VTdHJpbmc7XG4gIH1cblxuICBmdW5jdGlvbiBpbml0RmlsZVVwbG9hZCh0b2tlbiwgbW9kZWwsIGZpbGUsIGNhbGxiYWNrKSB7XG5cbiAgICB2YXIgYmFzZVN0cmluZyA9ICcnO1xuICAgIHZhciBiYXNlSlNPTiA9ICcnO1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcbiAgICBvcHRpb25zLnRva2VuID0gdG9rZW47XG4gICAgb3B0aW9ucy5tZXNzYWdlID0ge1xuICAgICAgJ2FjdGlvbic6ICdzdGFydCcsXG4gICAgICAnY29udGVudC10eXBlJzogJ2F1ZGlvL2wxNjtyYXRlPTQ0MTAwJyxcbiAgICAgICdpbnRlcmltX3Jlc3VsdHMnOiB0cnVlLFxuICAgICAgJ2NvbnRpbnVvdXMnOiB0cnVlLFxuICAgICAgJ3dvcmRfY29uZmlkZW5jZSc6IHRydWUsXG4gICAgICAndGltZXN0YW1wcyc6IHRydWUsXG4gICAgICAnbWF4X2FsdGVybmF0aXZlcyc6IDNcbiAgICB9O1xuICAgIG9wdGlvbnMubW9kZWwgPSBtb2RlbC5uYW1lO1xuXG4gICAgZnVuY3Rpb24gb25PcGVuKHNvY2tldCkge1xuICAgICAgY29uc29sZS5sb2coJ3NvY2tldCBvcGVuZWQnKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkxpc3RlbmluZyhzb2NrZXQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdjb25uZWN0aW9uIGxpc3RlbmluZycpO1xuICAgICAgY2FsbGJhY2soc29ja2V0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbk1lc3NhZ2UobXNnKSB7XG4gICAgICBjb25zb2xlLmxvZygnd3MgbXNnJywgbXNnKTtcbiAgICAgIGlmIChtc2cucmVzdWx0cykge1xuICAgICAgICBiYXNlU3RyaW5nID0gcHJvY2Vzc1N0cmluZyhtc2csIGJhc2VTdHJpbmcpO1xuICAgICAgICBiYXNlSlNPTiA9IGRpc3BsYXkuc2hvd0pTT04obXNnLCBiYXNlSlNPTik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25FcnJvcihlcnIpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdlcnInLCBlcnIpO1xuICAgIH1cblxuICAgIGluaXRTb2NrZXQob3B0aW9ucywgb25PcGVuLCBvbkxpc3RlbmluZywgb25NZXNzYWdlLCBvbkVycm9yKTtcblxuICB9XG5cbiAgZnVuY3Rpb24gaW5pdE1pY3JvcGhvbmUodG9rZW4sIG1vZGVsLCBtaWMsIGNhbGxiYWNrKSB7XG4gICAgLy8gVGVzdCBvdXQgd2Vic29ja2V0XG4gICAgdmFyIGJhc2VTdHJpbmcgPSAnJztcbiAgICB2YXIgYmFzZUpTT04gPSAnJztcblxuICAgIHZhciBvcHRpb25zID0ge307XG4gICAgb3B0aW9ucy50b2tlbiA9IHRva2VuO1xuICAgIG9wdGlvbnMubWVzc2FnZSA9IHtcbiAgICAgICdhY3Rpb24nOiAnc3RhcnQnLFxuICAgICAgJ2NvbnRlbnQtdHlwZSc6ICdhdWRpby9sMTY7cmF0ZT0xNjAwMCcsXG4gICAgICAnaW50ZXJpbV9yZXN1bHRzJzogdHJ1ZSxcbiAgICAgICdjb250aW51b3VzJzogdHJ1ZSxcbiAgICAgICd3b3JkX2NvbmZpZGVuY2UnOiB0cnVlLFxuICAgICAgJ3RpbWVzdGFtcHMnOiB0cnVlLFxuICAgICAgJ21heF9hbHRlcm5hdGl2ZXMnOiAzXG4gICAgfTtcbiAgICBvcHRpb25zLm1vZGVsID0gbW9kZWw7XG5cbiAgICBmdW5jdGlvbiBvbk9wZW4oc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZygnc29ja2V0IG9wZW5lZCcpO1xuICAgICAgY2FsbGJhY2soc29ja2V0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkxpc3RlbmluZyhzb2NrZXQpIHtcblxuICAgICAgbWljU29ja2V0ID0gc29ja2V0O1xuXG4gICAgICBtaWMub25BdWRpbyA9IGZ1bmN0aW9uKGJsb2IpIHtcbiAgICAgICAgaWYgKHNvY2tldC5yZWFkeVN0YXRlIDwgMikge1xuICAgICAgICAgIHNvY2tldC5zZW5kKGJsb2IpXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25NZXNzYWdlKG1zZywgc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZygnd3MgbXNnJywgbXNnKTtcbiAgICAgIGlmIChtc2cucmVzdWx0cykge1xuICAgICAgICBiYXNlU3RyaW5nID0gcHJvY2Vzc1N0cmluZyhtc2csIGJhc2VTdHJpbmcpO1xuICAgICAgICBiYXNlSlNPTiA9IGRpc3BsYXkuc2hvd0pTT04obXNnLCBiYXNlSlNPTik7XG4gICAgICB9XG4gICAgICAvLyB2YXIgcnVubmluZyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3J1bm5pbmcnKSk7XG4gICAgICAvLyB2YXIgcmVzdWx0SW5kZXggPSBtc2cucmVzdWx0X2luZGV4O1xuICAgICAgLy8gaWYgKG1zZy5yZXN1bHRzICYmIG1zZy5yZXN1bHRzLmxlbmd0aCA+IDAgJiYgbXNnLnJlc3VsdHNbMF0uZmluYWwgJiYgIXJ1bm5pbmcpIHtcbiAgICAgIC8vICAgc3RvcE1pY3JvcGhvbmUoc29ja2V0LCBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgIC8vICAgICBjb25zb2xlLmxvZygnbWljIHN0b3BwZWQ6ICcsIHJlc3VsdCk7XG4gICAgICAvLyAgIH0pO1xuICAgICAgLy8gfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uRXJyb3IoZXJyLCBzb2NrZXQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdlcnInLCBlcnIpO1xuICAgIH1cblxuICAgIGluaXRTb2NrZXQob3B0aW9ucywgb25PcGVuLCBvbkxpc3RlbmluZywgb25NZXNzYWdlLCBvbkVycm9yKTtcblxuICB9XG5cbiAgLy8gZnVuY3Rpb24gc3RvcE1pY3JvcGhvbmUoc29ja2V0LCBjYWxsYmFjaykge1xuICAvLyAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHsnYWN0aW9uJzogJ3N0b3AnfSkpO1xuICAvLyAgIGNhbGxiYWNrKHRydWUpO1xuICAvLyB9XG5cblxuICAvLyBNYWtlIGNhbGwgdG8gQVBJIHRvIHRyeSBhbmQgZ2V0IHRva2VuXG4gIHZhciB1cmwgPSAnL3Rva2VuJztcbiAgdmFyIHRva2VuUmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICB0b2tlblJlcXVlc3Qub3BlbihcIkdFVFwiLCB1cmwsIHRydWUpO1xuICB0b2tlblJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24oZXZ0KSB7XG5cbiAgICB2YXIgdG9rZW4gPSB0b2tlblJlcXVlc3QucmVzcG9uc2VUZXh0O1xuICAgIGNvbnNvbGUubG9nKCdUb2tlbiAnLCBkZWNvZGVVUklDb21wb25lbnQodG9rZW4pKTtcblxuICAgIHZhciBtaWMgPSBuZXcgTWljcm9waG9uZSgpO1xuXG4gICAgdmFyIG1vZGVsT3B0aW9ucyA9IHtcbiAgICAgIHRva2VuOiB0b2tlblxuICAgICAgLy8gVW5jb21tZW50IGluIGNhc2Ugb2Ygc2VydmVyIENPUlMgZmFpbHVyZVxuICAgICAgLy8gdXJsOiAnL2FwaS9tb2RlbHMnXG4gICAgfTtcblxuICAgIC8vIEdldCBhdmFpbGFibGUgc3BlZWNoIHJlY29nbml0aW9uIG1vZGVsc1xuICAgIC8vIFNldCB0aGVtIGluIHN0b3JhZ2VcbiAgICAvLyBBbmQgZGlzcGxheSB0aGVtIGluIGRyb3AtZG93blxuICAgIG1vZGVscy5nZXRNb2RlbHMobW9kZWxPcHRpb25zLCBmdW5jdGlvbihtb2RlbHMpIHtcblxuICAgICAgY29uc29sZS5sb2coJ1NUVCBNb2RlbHMgJywgbW9kZWxzKTtcblxuICAgICAgLy8gU2F2ZSBtb2RlbHMgdG8gbG9jYWxzdG9yYWdlXG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbW9kZWxzJywgSlNPTi5zdHJpbmdpZnkobW9kZWxzKSk7XG5cbiAgICAgIC8vIFNldCBkZWZhdWx0IGN1cnJlbnQgbW9kZWxcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50TW9kZWwnLCAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnKTtcblxuXG4gICAgICAvLyBTZW5kIG1vZGVscyBhbmQgb3RoZXJcbiAgICAgIC8vIHZpZXcgY29udGV4dCB0byB2aWV3c1xuICAgICAgdmFyIHZpZXdDb250ZXh0ID0ge1xuICAgICAgICBtb2RlbHM6IG1vZGVsc1xuICAgICAgfTtcblxuXG4gICAgICAvLyBUaGlzIHN0dWZmIHdpbGwgYmUgbW92ZWQgb3V0IHRvIHZpZXdzXG4gICAgICBmdW5jdGlvbiBoYW5kbGVGaWxlVXBsb2FkRXZlbnQoZXZ0KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdoYW5kbGluZyBmaWxlIGRyb3AgZXZlbnQnKTtcbiAgICAgICAgLy8gSW5pdCBmaWxlIHVwbG9hZCB3aXRoIGRlZmF1bHQgbW9kZWxcbiAgICAgICAgdmFyIGZpbGUgPSBldnQuZGF0YVRyYW5zZmVyLmZpbGVzWzBdO1xuICAgICAgICB2YXIgY3VycmVudE1vZGVsID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRNb2RlbCcpO1xuICAgICAgICBpbml0RmlsZVVwbG9hZCh0b2tlbiwgY3VycmVudE1vZGVsLCBmaWxlLCBmdW5jdGlvbihzb2NrZXQpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnVXBsb2FkaW5nIGZpbGUnLCBmaWxlKTtcbiAgICAgICAgICB2YXIgYmxvYiA9IG5ldyBCbG9iKFtmaWxlXSwge3R5cGU6ICdhdWRpby9sMTY7cmF0ZT00NDEwMCd9KTtcbiAgICAgICAgICB1dGlscy5wYXJzZUZpbGUoYmxvYiwgZnVuY3Rpb24oY2h1bmspIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdIYW5kbGluZyBjaHVuaycsIGNodW5rKTtcbiAgICAgICAgICAgIHNvY2tldC5zZW5kKGNodW5rKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnNvbGUubG9nKCdzZXR0aW5nIHRhcmdldCcpO1xuXG4gICAgICB2YXIgdGFyZ2V0ID0gJChcIiNmaWxlVXBsb2FkVGFyZ2V0XCIpO1xuICAgICAgdGFyZ2V0Lm9uKCdkcmFnZW50ZXInLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICBjb25zb2xlLmxvZygnZHJhZ2VudGVyJyk7XG4gICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIH0pO1xuXG4gICAgICB0YXJnZXQub24oJ2RyYWdvdmVyJywgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ2RyYWdvdmVyJyk7XG4gICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIH0pO1xuXG4gICAgICB0YXJnZXQub24oJ2Ryb3AnLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICBjb25zb2xlLmxvZygnRmlsZSBkcm9wcGVkJyk7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgdmFyIGV2dCA9IGUub3JpZ2luYWxFdmVudDtcbiAgICAgICAgLy8gSGFuZGxlIGRyYWdnZWQgZmlsZSBldmVudFxuICAgICAgICBoYW5kbGVGaWxlVXBsb2FkRXZlbnQoZXZ0KTtcbiAgICAgIH0pO1xuXG4gICAgICBpbml0Vmlld3Modmlld0NvbnRleHQpO1xuXG5cbiAgICAgIC8vIFNldCBtaWNyb3Bob25lIHN0YXRlIHRvIG5vdCBydW5uaW5nXG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgncnVubmluZycsIGZhbHNlKTtcblxuICAgICAgLy8gVGhpcyB3aWxsIGJlIG1vdmVkIHRvIHZpZXdzXG4gICAgICB2YXIgcmVjb3JkQnV0dG9uID0gJCgnI3JlY29yZEJ1dHRvbicpO1xuICAgICAgcmVjb3JkQnV0dG9uLmNsaWNrKCQucHJveHkoZnVuY3Rpb24oZXZ0KSB7XG5cbiAgICAgICAgLy8gUHJldmVudCBkZWZhdWx0IGFuY2hvciBiZWhhdmlvclxuICAgICAgICBldnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICB2YXIgcnVubmluZyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3J1bm5pbmcnKSk7XG5cbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3J1bm5pbmcnLCAhcnVubmluZyk7XG5cbiAgICAgICAgY29uc29sZS5sb2coJ2NsaWNrIScpO1xuXG4gICAgICAgIHZhciBjdXJyZW50TW9kZWwgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudE1vZGVsJyk7XG5cbiAgICAgICAgY29uc29sZS5sb2coJ3J1bm5pbmcgc3RhdGUnLCBydW5uaW5nKTtcblxuICAgICAgICBpZiAoIXJ1bm5pbmcpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnTm90IHJ1bm5pbmcsIGluaXRNaWNyb3Bob25lKCknKTtcbiAgICAgICAgICByZWNvcmRCdXR0b24uY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJyNkNzQxMDgnKTtcbiAgICAgICAgICByZWNvcmRCdXR0b24uZmluZCgnaW1nJykuYXR0cignc3JjJywgJ2ltZy9zdG9wLnN2ZycpO1xuICAgICAgICAgIGluaXRNaWNyb3Bob25lKHRva2VuLCBjdXJyZW50TW9kZWwsIG1pYywgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICAgICByZWNvcmRCdXR0b24uY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJyNkNzQxMDgnKTtcbiAgICAgICAgICAgIHJlY29yZEJ1dHRvbi5maW5kKCdpbWcnKS5hdHRyKCdzcmMnLCAnaW1nL3N0b3Auc3ZnJyk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnc3RhcnRpbmcgbWljJyk7XG4gICAgICAgICAgICBtaWMucmVjb3JkKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1N0b3BwaW5nIG1pY3JvcGhvbmUsIHNlbmRpbmcgc3RvcCBhY3Rpb24gbWVzc2FnZScpO1xuICAgICAgICAgIHJlY29yZEJ1dHRvbi5yZW1vdmVBdHRyKCdzdHlsZScpO1xuICAgICAgICAgIHJlY29yZEJ1dHRvbi5maW5kKCdpbWcnKS5hdHRyKCdzcmMnLCAnaW1nL21pY3JvcGhvbmUuc3ZnJyk7XG4gICAgICAgICAgLy8gbWljU29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoeydhY3Rpb24nOiAnc3RvcCd9KSk7XG4gICAgICAgICAgdmFyIGVtcHR5QnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKDApO1xuICAgICAgICAgIG1pY1NvY2tldC5zZW5kKGVtcHR5QnVmZmVyKTtcbiAgICAgICAgICBtaWMuc3RvcCgpO1xuICAgICAgICB9XG5cbiAgICAgIH0sIHRoaXMpKTtcblxuICAgIH0pO1xuICB9XG4gIHRva2VuUmVxdWVzdC5zZW5kKCk7XG5cbn0pO1xuIl19
