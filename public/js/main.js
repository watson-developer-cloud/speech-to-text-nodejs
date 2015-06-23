(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports={
  "name": "SpeechToTextBrowserStarterApp",
  "version": "0.0.6",
  "description": "A sample browser app for Bluemix that use the speech-to-text service, fetching a token via Node.js",
  "dependencies": {
    "body-parser": "~1.10.2",
    "connect": "^3.3.5",
    "errorhandler": "~1.2.4",
    "express": "~4.10.8",
    "harmon": "^1.3.1",
    "http-proxy": "^1.11.1",
    "request": "~2.53.0",
    "transformer-proxy": "^0.3.1"
  },
  "engines": {
    "node": ">=0.10"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/watson-developer-cloud/speech-to-text-browser.git"
  },
  "author": "IBM Corp.",
  "browserify-shim": {
    "jquery": "global:jQuery"
  },
  "browserify": {
    "transform": [
      "browserify-shim"
    ]
  },
  "contributors": [
    {
      "name": "German Attanasio Ruiz",
      "email": "germanatt@us.ibm.com"
    },
    {
      "name": "Daniel Bolano",
      "email": "dbolano@us.ibm.com"
    },
    {
      "name": "Britany L. Ponvelle",
      "email": "blponvelle@us.ibm.com"
    },
    {
      "name": "Eric S. Bullington",
      "email": "esbullin@us.ibm.com"
    }
  ],
  "license": "Apache-2.0",
  "bugs": {
    "url": "https://github.com/watson-developer-cloud/speech-to-text-browser/issues"
  },
  "scripts": {
    "start": "node app.js",
    "build": "browserify -o public/js/main.js src/index.js",
    "watch": "watchify -d -o public/js/main.js src/index.js"
  },
  "devDependencies": {
    "browserify": "^10.2.4",
    "browserify-shim": "^3.8.9"
  }
}

},{}],2:[function(require,module,exports){
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
  this.bufferSize = options.bufferSize || 8192;
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


},{"./utils":7}],3:[function(require,module,exports){
module.exports={
   "models": [
      {
         "url": "https://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/models/en-US_BroadbandModel", 
         "rate": 16000, 
         "name": "en-US_BroadbandModel", 
         "language": "en-US", 
         "description": "US English broadband model (16KHz)"
      }, 
      {
         "url": "https://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/models/en-US_NarrowbandModel", 
         "rate": 8000, 
         "name": "en-US_NarrowbandModel", 
         "language": "en-US", 
         "description": "US English narrowband model (8KHz)"
      },
      {
         "url": "https://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/models/es-ES_BroadbandModel", 
         "rate": 16000, 
         "name": "es-ES_BroadbandModel", 
         "language": "es-ES", 
         "description": "Spanish broadband model (16KHz)"
      }, 
      {
         "url": "https://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/models/es-ES_NarrowbandModel", 
         "rate": 8000, 
         "name": "es-ES_NarrowbandModel", 
         "language": "es-ES", 
         "description": "Spanish narrowband model (8KHz)"
      }, 
      {
         "url": "https://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/models/ja-JP_BroadbandModel", 
         "rate": 16000, 
         "name": "ja-JP_BroadbandModel", 
         "language": "ja-JP", 
         "description": "Japanese broadband model (16KHz)"
      }, 
      {
         "url": "https://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/models/ja-JP_NarrowbandModel", 
         "rate": 8000, 
         "name": "ja-JP_NarrowbandModel", 
         "language": "ja-JP", 
         "description": "Japanese narrowband model (8KHz)"
      }
   ]
}

},{}],4:[function(require,module,exports){

var effects = require('./views/effects');
var display = require('./views/display');
var hideError = require('./views/showerror').hideError;
var initSocket = require('./socket').initSocket;

exports.handleFileUpload = function(token, model, file, contentType, callback, onend) {


    console.log('setting image');
    // $('#progressIndicator').css('visibility', 'visible');
    hideError();

    $.subscribe('progress', function(evt, data) {
      console.log('progress: ', data);
    });

    var micIcon = $('#microphoneIcon');

    console.log('contentType', contentType);

    var baseString = '';
    var baseJSON = '';

    var options = {};
    options.token = token;
    options.message = {
      'action': 'start',
      'content-type': contentType,
      'interim_results': true,
      'continuous': true,
      'word_confidence': true,
      'timestamps': true,
      'max_alternatives': 3
    };
    options.model = model;

    function onOpen(socket) {
      console.log('Socket opened');
    }

    function onListening(socket) {
      console.log('Socket listening');
      callback(socket);
    }

    function onMessage(msg) {
      console.log('Socket msg: ', msg);
      if (msg.results) {
        // Convert to closure approach
        baseString = display.showResult(msg, baseString);
        baseJSON = display.showJSON(msg, baseJSON);
      }
    }

    function onError(evt) {
      localStorage.setItem('currentlyDisplaying', false);
      onend(evt);
      console.log('Socket err: ', evt.code);
    }

    function onClose(evt) {
      localStorage.setItem('currentlyDisplaying', false);
      onend(evt);
      console.log('Socket closing: ', evt);
    }

    initSocket(options, onOpen, onListening, onMessage, onError, onClose);

  }

},{"./socket":6,"./views/display":9,"./views/effects":11,"./views/showerror":18}],5:[function(require,module,exports){

'use strict';

var initSocket = require('./socket').initSocket;
var display = require('./views/display');

exports.handleMicrophone = function(token, model, mic, callback) {

  var currentModel = localStorage.getItem('currentModel');

  if (currentModel.indexOf('Narrowband') > -1) {
    var err = new Error('Microphone cannot accomodate narrow band models, please select another');
    callback(err, null);
    return false;
  }

  $.publish('clearscreen');

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

},{"./socket":6,"./views/display":9}],6:[function(require,module,exports){
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
var showerror = require('./views/showerror');
var showError = showerror.showError;
var hideError = showerror.hideError;

// Mini WS callback API, so we can initialize
// with model and token in URI, plus
// start message
//

var initSocket = exports.initSocket = function(options, onopen, onlistening, onmessage, onerror, onclose, retryCountDown) {
  var listening = false;
  function withDefault(val, defaultVal) {
    return typeof val === 'undefined' ? defaultVal : val;
  }
  var socket, count;
  var token = options.token;
  var model = options.model || localStorage.getItem('currentModel');
  var message = options.message || {'action': 'start'};
  var sessionPermissions = withDefault(options.sessionPermissions, JSON.parse(localStorage.getItem('sessionPermissions')));
  var sessionPermissionsQueryParam = sessionPermissions ? '0' : '1';
  var url = options.serviceURI || 'wss://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/recognize?watson-token='
    + token
    + '&X-WDC-PL-OPT-OUT=' + sessionPermissionsQueryParam
    + '&model=' + model;
  console.log('URL model', model);
  try {
    socket = new WebSocket(url);
  } catch(err) {
    console.log('websocketerr', err);
    showError(err.message);
  }
  socket.onopen = function(evt) {
    console.log('ws opened');
    socket.send(JSON.stringify(message));
    onopen(socket);
  };
  socket.onmessage = function(evt) {
    var msg = JSON.parse(evt.data);
    if (msg.state === 'listening') {
      // Early cut off, without notification
      if (!listening) {
        $.subscribe('socketstop', function(data) {
          console.log('MICROPHONE: Sending stop listen message.');
          socket.send(JSON.stringify({action:'stop'}));
        });
        onlistening(socket);
        hideError();
        listening = true;
      } else {
        console.log('MICROPHONE: Closing socket.');
        socket.close();
      }
    }
    onmessage(msg, socket);
  };

  socket.onerror = function(evt) {
    console.log('WS onerror: ', evt);
    showError('Application error ' + evt.code + ': please refresh your browser and try again');
    onerror(evt);
  };

  socket.onclose = function(evt) {
    console.log('WS onclose: ', evt);
    if (evt.code === 1006) {
      // Authentication error, try to reconnect
      count = utils.getToken(function(token, err) {
        if (err) {
          showError(err.message);
          return false;
        }
        console.log('Fetching additional token...');
        options.token = token;
        initSocket(options, onopen, onlistening, onmessage, onerror);
      });
    }
    if (evt.code > 1000) {
      showError('Server error ' + evt.code + ': please refresh your browser and try again');
    }
    // Made it through, normal close
    onclose(evt);
  };

}


},{"./Microphone":2,"./utils":7,"./views/showerror":18}],7:[function(require,module,exports){
(function (global){

// For non-view logic
var $ = (typeof window !== "undefined" ? window.jQuery : typeof global !== "undefined" ? global.jQuery : null);

var fileBlock = function(_offset, length, _file, readChunk) {
  var r = new FileReader();
  var blob = _file.slice(_offset, length + _offset);
  r.onload = readChunk;
  r.readAsArrayBuffer(blob);
}

// Based on alediaferia's SO response
// http://stackoverflow.com/questions/14438187/javascript-filereader-parsing-long-file-in-chunks
exports.onFileProgress = function(options, ondata, onerror, onend) {
  var file       = options.file;
  var fileSize   = file.size;
  var chunkSize  = options.bufferSize || 8192;
  var offset     = 0;
  var readChunk = function(evt) {
    if (offset >= fileSize) {
      console.log("Done reading file");
      onend();
      return;
    }
    if (evt.target.error == null) {
      var buffer = evt.target.result;
      var len = buffer.byteLength;
      offset += len;
      ondata(buffer); // callback for handling read chunk
    } else {
      var errorMessage = evt.target.error;
      console.log("Read error: " + errorMessage);
      onerror(errorMessage);
      return;
    }
    fileBlock(offset, chunkSize, file, readChunk);
  }
  fileBlock(offset, chunkSize, file, readChunk);
}

exports.getToken = (function() {
  // Make call to API to try and get token
  var hasBeenRunTimes = 2;
  return function(callback) {
    hasBeenRunTimes--;
    if (hasBeenRunTimes === 0) {
      var err = new Error('Cannot reach server');
      callback(null, err);
    }
    var url = '/token';
    var tokenRequest = new XMLHttpRequest();
    tokenRequest.open("GET", url, true);
    tokenRequest.onload = function(evt) {
      var token = tokenRequest.responseText;
      callback(token);
    };
    tokenRequest.send();
  }
})();

exports.initPubSub = function() {
  var o         = $({});
  $.subscribe   = o.on.bind(o);
  $.unsubscribe = o.off.bind(o);
  $.publish     = o.trigger.bind(o);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],8:[function(require,module,exports){


exports.initAnimatePanel = function() {
  $('.panel-heading span.clickable').on("click", function (e) {
    if ($(this).hasClass('panel-collapsed')) {
      // expand the panel
      $(this).parents('.panel').find('.panel-body').slideDown();
      $(this).removeClass('panel-collapsed');
      $(this).find('i').removeClass('caret-down').addClass('caret-up');
    }
    else {
      // collapse the panel
      $(this).parents('.panel').find('.panel-body').slideUp();
      $(this).addClass('panel-collapsed');
      $(this).find('i').removeClass('caret-up').addClass('caret-down');
    }
  });
}


},{}],9:[function(require,module,exports){
(function (global){
var $ = (typeof window !== "undefined" ? window.jQuery : typeof global !== "undefined" ? global.jQuery : null);

var showTimestamp = function(timestamps, confidences) {
  var word = timestamps[0],
      t0 = timestamps[1],
      t1 = timestamps[2];
  var timelength = t1 - t0;
  // Show confidence if defined, else 'n/a'
  var displayConfidence = confidences ? confidences[1].toString().substring(0, 3) : 'n/a';
  $('#metadataTable > tbody:last-child').append(
      '<tr>'
      + '<td>' + word + '</td>'
      + '<td>' + t0 + '</td>'
      + '<td>' + t1 + '</td>'
      + '<td>' + displayConfidence + '</td>'
      + '</tr>'
      );
}

var showMetaData = function(alternative) {
  $('#metadataTable > tbody').empty();
  var confidenceNestedArray = alternative.word_confidence;;
  var timestampNestedArray = alternative.timestamps;
  if (confidenceNestedArray && confidenceNestedArray.length > 0) {
    for (var i = 0; i < confidenceNestedArray.length; i++) {
      var timestamps = timestampNestedArray[i];
      var confidences = confidenceNestedArray[i];
      showTimestamp(timestamps, confidences);
    }
    return;
  } else {
    if (timestampNestedArray && timestampNestedArray.length > 0) {
      console.log('SHOWING TIMESTAMPS');
      timestampNestedArray.forEach(function(timestamp) {
        showTimestamp(timestamp);
      });
    }
  }
}

var showAlternatives = function(alternatives) {
  var $hypotheses = $('.hypotheses ul');
  alternatives.forEach(function(alternative, idx) {
    $hypotheses.append('<li data-hypothesis-index=' + idx + ' >' + alternative.transcript + '</li>');
  });
  $hypotheses.on('click', "li", function (alternatives) {
    return function() {
      console.log("showing metadata");
      var idx = + $(this).data('hypothesis-index');
      var alternative = alternatives[idx];
      showMetaData(alternative);
    }
  });
}

// TODO: Convert to closure approach
var processString = function(baseString, isFinished) {

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

exports.showJSON = function(msg, baseJSON) {
  var json = JSON.stringify(msg, null, 2);
  baseJSON += json;
  baseJSON += '\n';
  $('#resultsJSON').val(baseJSON);
  return baseJSON;
}

exports.showResult = function(msg, baseString, callback) {

  var idx = +msg.result_index;

  if (msg.results && msg.results.length > 0) {

    var alternatives = msg.results[0].alternatives;
    var text = msg.results[0].alternatives[0].transcript || '';

    showMetaData(alternatives[0]);
    //Capitalize first word
    // if final results, append a new paragraph
    if (msg.results && msg.results[0] && msg.results[0].final) {
      baseString += text;
      var displayFinalString = baseString;
      displayFinalString = displayFinalString.replace(/%HESITATION\s/g, '');
      displayFinalString = displayFinalString.replace(/^((n)\3+)$/g, '');
      processString(displayFinalString, true);
    } else {
      var tempString = baseString + text;
      tempString = tempString.replace(/%HESITATION\s/g, '');
      tempString = tempString.replace(/^((n)\3+)$/g, '');
      processString(tempString, false);
    }
  }
  if (alternatives) {
    showAlternatives(alternatives);
  }

  return baseString;

};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],10:[function(require,module,exports){

'use strict';

var handleSelectedFile = require('./handlefile').handleSelectedFile;

exports.initDragDrop = function(ctx) {

  var dragAndDropTarget = $(document);

  dragAndDropTarget.on('dragenter', function (e) {
    e.stopPropagation();
    e.preventDefault();
  });

  dragAndDropTarget.on('dragover', function (e) {
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
    // Init file upload with default model
    var file = evt.dataTransfer.files[0];
    handleSelectedFile(ctx.token, file);
  }

}

},{"./handlefile":12}],11:[function(require,module,exports){



exports.flashSVG = function(el) {
  el.css({ fill: '#A53725' });
  function loop() {
    el.animate({ fill: '#A53725' },
        1000, 'linear')
      .animate({ fill: 'white' },
          1000, 'linear');
  }
  // return timer
  var timer = setTimeout(loop, 2000);
  return timer;
};

exports.stopFlashSVG = function(timer) {
  el.css({ fill: 'white' } );
  clearInterval(timer);
}

exports.toggleImage = function(el, name) {
  if(el.attr('src') === 'img/' + name + '.svg') {
    el.attr("src", 'img/stop-red.svg');
  } else {
    el.attr('src', 'img/stop.svg');
  }
}

var restoreImage = exports.restoreImage = function(el, name) {
  el.attr('src', 'img/' + name + '.svg');
}

exports.stopToggleImage = function(timer, el, name) {
  clearInterval(timer);
  restoreImage(el, name);
}


},{}],12:[function(require,module,exports){

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
  $.subscribe('socketstop', function(data) {
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


},{"../fileupload":4,"../utils":7,"./effects":11,"./showerror":18}],13:[function(require,module,exports){

var initSessionPermissions = require('./sessionpermissions').initSessionPermissions;
var initSelectModel = require('./selectmodel').initSelectModel;
var initAnimatePanel = require('./animatepanel').initAnimatePanel;
var initShowTab = require('./showtab').initShowTab;
var initDragDrop = require('./dragdrop').initDragDrop;
var initPlaySample = require('./playsample').initPlaySample;
var initRecordButton = require('./recordbutton').initRecordButton;


exports.initViews = function(ctx) {
  console.log('Initializing views...');
  initSelectModel(ctx);
  initPlaySample(ctx);
  initDragDrop(ctx);
  initRecordButton(ctx);
  initSessionPermissions();
  initShowTab();
  initAnimatePanel();
  initShowTab();
}

},{"./animatepanel":8,"./dragdrop":10,"./playsample":14,"./recordbutton":15,"./selectmodel":16,"./sessionpermissions":17,"./showtab":19}],14:[function(require,module,exports){

'use strict';

var utils = require('../utils');
var onFileProgress = utils.onFileProgress;
var handleFileUpload = require('../fileupload').handleFileUpload;
var initSocket = require('../socket').initSocket;
var showError = require('./showerror').showError;
var effects = require('./effects');


var playSample = function(token, imageTag, iconName, url, callback) {

  var currentlyDisplaying = JSON.parse(localStorage.getItem('currentlyDisplaying'));

  if (currentlyDisplaying) {
    showError('Currently displaying another file, please wait until complete');
    return;
  }

  $.publish('clearscreen');

  localStorage.setItem('currentlyDisplaying', true);

  var timer = setInterval(effects.toggleImage, 750, imageTag, iconName);

  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.responseType = 'blob';
  xhr.onload = function(e) {
    var blob = xhr.response;
    var currentModel = 'en-US_BroadbandModel';
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
            localStorage.getItem('currentlyDisplaying', false);
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


},{"../fileupload":4,"../socket":6,"../utils":7,"./effects":11,"./showerror":18}],15:[function(require,module,exports){

'use strict';

var Microphone = require('../Microphone');
var handleMicrophone = require('../handlemicrophone').handleMicrophone;

exports.initRecordButton = function(ctx) {

  var recordButton = $('#recordButton');

  recordButton.click((function() {

    var running = false;
    var token = ctx.token;
    var micOptions = {
      bufferSize: ctx.buffersize
    };
    var mic = new Microphone(micOptions);

    return function(evt) {
      // Prevent default anchor behavior
      evt.preventDefault();

      var currentModel = localStorage.getItem('currentModel');

      console.log('running state', running);

      if (!running) {
        console.log('Not running, handleMicrophone()');
        handleMicrophone(token, currentModel, mic, function(err, socket) {
          if (err) {
            var msg = err.message;
            console.log('Error: ', msg);
            showError(msg);
            running = false;
          } else {
            recordButton.css('background-color', '#d74108');
            recordButton.find('img').attr('src', 'img/stop.svg');
            console.log('starting mic');
            mic.record();
            running = true;
          }
        });
      } else {
        console.log('Stopping microphone, sending stop action message');
        recordButton.removeAttr('style');
        recordButton.find('img').attr('src', 'img/microphone.svg');
        $.publish('socketstop');
        mic.stop();
        running = false;
      }
    }
  })());
}

},{"../Microphone":2,"../handlemicrophone":5}],16:[function(require,module,exports){

exports.initSelectModel = function(ctx) {

  function isDefault(model) {
    return model === 'en-US_BroadbandModel';
  }

  ctx.models.forEach(function(model) {
    $("select#dropdownMenu1").append( $("<option>")
      .val(model.name)
      .html(model.description)
      .prop('selected', isDefault(model.name))
      );
  });

  $("select#dropdownMenu1").change(function(evt) {
    var modelName = $("select#dropdownMenu1").val();
    localStorage.setItem('currentModel', modelName);
  });

}

},{}],17:[function(require,module,exports){

'use strict';

exports.initSessionPermissions = function() {
  console.log('Initializing session permissions handler');
  // Radio buttons
  var sessionPermissionsRadio = $("#sessionPermissionsRadioGroup input[type='radio']");
  sessionPermissionsRadio.click(function(evt) {
    var checkedValue = sessionPermissionsRadio.filter(':checked').val();
    console.log('checkedValue', checkedValue);
    localStorage.setItem('sessionPermissions', checkedValue);
  });
}

},{}],18:[function(require,module,exports){


exports.showError = function(msg) {
  console.log('showing error');
  var errorAlert = $('.error-row');
  errorAlert.hide();
  var errorMessage = $('#errorMessage');
  errorMessage.text(msg);
  errorAlert.show();
  $('#errorClose').click(function(e) {
    e.preventDefault();
    errorAlert.hide();
  });
}

exports.hideError = function() {
  var errorAlert = $('.error-row');
  errorAlert.hide();
}

},{}],19:[function(require,module,exports){


exports.initShowTab = function() {
  $('#nav-tabs a').on("click", function (e) {
    e.preventDefault()
    $(this).tab('show')
  });
}

},{}],20:[function(require,module,exports){
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


},{"../package":1,"./Microphone":2,"./data/models.json":3,"./fileupload":4,"./socket":6,"./utils":7,"./views":13,"./views/display":9,"./views/effects":11,"./views/handlefile":12,"./views/showerror":18}]},{},[20])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5ucG0vbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwicGFja2FnZS5qc29uIiwic3JjL01pY3JvcGhvbmUuanMiLCJzcmMvZGF0YS9tb2RlbHMuanNvbiIsInNyYy9maWxldXBsb2FkLmpzIiwic3JjL2hhbmRsZW1pY3JvcGhvbmUuanMiLCJzcmMvc29ja2V0LmpzIiwic3JjL3V0aWxzLmpzIiwic3JjL3ZpZXdzL2FuaW1hdGVwYW5lbC5qcyIsInNyYy92aWV3cy9kaXNwbGF5LmpzIiwic3JjL3ZpZXdzL2RyYWdkcm9wLmpzIiwic3JjL3ZpZXdzL2VmZmVjdHMuanMiLCJzcmMvdmlld3MvaGFuZGxlZmlsZS5qcyIsInNyYy92aWV3cy9pbmRleC5qcyIsInNyYy92aWV3cy9wbGF5c2FtcGxlLmpzIiwic3JjL3ZpZXdzL3JlY29yZGJ1dHRvbi5qcyIsInNyYy92aWV3cy9zZWxlY3Rtb2RlbC5qcyIsInNyYy92aWV3cy9zZXNzaW9ucGVybWlzc2lvbnMuanMiLCJzcmMvdmlld3Mvc2hvd2Vycm9yLmpzIiwic3JjL3ZpZXdzL3Nob3d0YWIuanMiLCJzcmMvaW5kZXgiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN6R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHM9e1xuICBcIm5hbWVcIjogXCJTcGVlY2hUb1RleHRCcm93c2VyU3RhcnRlckFwcFwiLFxuICBcInZlcnNpb25cIjogXCIwLjAuNlwiLFxuICBcImRlc2NyaXB0aW9uXCI6IFwiQSBzYW1wbGUgYnJvd3NlciBhcHAgZm9yIEJsdWVtaXggdGhhdCB1c2UgdGhlIHNwZWVjaC10by10ZXh0IHNlcnZpY2UsIGZldGNoaW5nIGEgdG9rZW4gdmlhIE5vZGUuanNcIixcbiAgXCJkZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiYm9keS1wYXJzZXJcIjogXCJ+MS4xMC4yXCIsXG4gICAgXCJjb25uZWN0XCI6IFwiXjMuMy41XCIsXG4gICAgXCJlcnJvcmhhbmRsZXJcIjogXCJ+MS4yLjRcIixcbiAgICBcImV4cHJlc3NcIjogXCJ+NC4xMC44XCIsXG4gICAgXCJoYXJtb25cIjogXCJeMS4zLjFcIixcbiAgICBcImh0dHAtcHJveHlcIjogXCJeMS4xMS4xXCIsXG4gICAgXCJyZXF1ZXN0XCI6IFwifjIuNTMuMFwiLFxuICAgIFwidHJhbnNmb3JtZXItcHJveHlcIjogXCJeMC4zLjFcIlxuICB9LFxuICBcImVuZ2luZXNcIjoge1xuICAgIFwibm9kZVwiOiBcIj49MC4xMFwiXG4gIH0sXG4gIFwicmVwb3NpdG9yeVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiZ2l0XCIsXG4gICAgXCJ1cmxcIjogXCJodHRwczovL2dpdGh1Yi5jb20vd2F0c29uLWRldmVsb3Blci1jbG91ZC9zcGVlY2gtdG8tdGV4dC1icm93c2VyLmdpdFwiXG4gIH0sXG4gIFwiYXV0aG9yXCI6IFwiSUJNIENvcnAuXCIsXG4gIFwiYnJvd3NlcmlmeS1zaGltXCI6IHtcbiAgICBcImpxdWVyeVwiOiBcImdsb2JhbDpqUXVlcnlcIlxuICB9LFxuICBcImJyb3dzZXJpZnlcIjoge1xuICAgIFwidHJhbnNmb3JtXCI6IFtcbiAgICAgIFwiYnJvd3NlcmlmeS1zaGltXCJcbiAgICBdXG4gIH0sXG4gIFwiY29udHJpYnV0b3JzXCI6IFtcbiAgICB7XG4gICAgICBcIm5hbWVcIjogXCJHZXJtYW4gQXR0YW5hc2lvIFJ1aXpcIixcbiAgICAgIFwiZW1haWxcIjogXCJnZXJtYW5hdHRAdXMuaWJtLmNvbVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcIm5hbWVcIjogXCJEYW5pZWwgQm9sYW5vXCIsXG4gICAgICBcImVtYWlsXCI6IFwiZGJvbGFub0B1cy5pYm0uY29tXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwibmFtZVwiOiBcIkJyaXRhbnkgTC4gUG9udmVsbGVcIixcbiAgICAgIFwiZW1haWxcIjogXCJibHBvbnZlbGxlQHVzLmlibS5jb21cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJuYW1lXCI6IFwiRXJpYyBTLiBCdWxsaW5ndG9uXCIsXG4gICAgICBcImVtYWlsXCI6IFwiZXNidWxsaW5AdXMuaWJtLmNvbVwiXG4gICAgfVxuICBdLFxuICBcImxpY2Vuc2VcIjogXCJBcGFjaGUtMi4wXCIsXG4gIFwiYnVnc1wiOiB7XG4gICAgXCJ1cmxcIjogXCJodHRwczovL2dpdGh1Yi5jb20vd2F0c29uLWRldmVsb3Blci1jbG91ZC9zcGVlY2gtdG8tdGV4dC1icm93c2VyL2lzc3Vlc1wiXG4gIH0sXG4gIFwic2NyaXB0c1wiOiB7XG4gICAgXCJzdGFydFwiOiBcIm5vZGUgYXBwLmpzXCIsXG4gICAgXCJidWlsZFwiOiBcImJyb3dzZXJpZnkgLW8gcHVibGljL2pzL21haW4uanMgc3JjL2luZGV4LmpzXCIsXG4gICAgXCJ3YXRjaFwiOiBcIndhdGNoaWZ5IC1kIC1vIHB1YmxpYy9qcy9tYWluLmpzIHNyYy9pbmRleC5qc1wiXG4gIH0sXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcImJyb3dzZXJpZnlcIjogXCJeMTAuMi40XCIsXG4gICAgXCJicm93c2VyaWZ5LXNoaW1cIjogXCJeMy44LjlcIlxuICB9XG59XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDE0IElCTSBDb3JwLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSAnTGljZW5zZScpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiAnQVMgSVMnIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbi8qKlxuICogQ2FwdHVyZXMgbWljcm9waG9uZSBpbnB1dCBmcm9tIHRoZSBicm93c2VyLlxuICogV29ya3MgYXQgbGVhc3Qgb24gbGF0ZXN0IHZlcnNpb25zIG9mIEZpcmVmb3ggYW5kIENocm9tZVxuICovXG5mdW5jdGlvbiBNaWNyb3Bob25lKF9vcHRpb25zKSB7XG4gIHZhciBvcHRpb25zID0gX29wdGlvbnMgfHwge307XG5cbiAgLy8gd2UgcmVjb3JkIGluIG1vbm8gYmVjYXVzZSB0aGUgc3BlZWNoIHJlY29nbml0aW9uIHNlcnZpY2VcbiAgLy8gZG9lcyBub3Qgc3VwcG9ydCBzdGVyZW8uXG4gIHRoaXMuYnVmZmVyU2l6ZSA9IG9wdGlvbnMuYnVmZmVyU2l6ZSB8fCA4MTkyO1xuICB0aGlzLmlucHV0Q2hhbm5lbHMgPSBvcHRpb25zLmlucHV0Q2hhbm5lbHMgfHwgMTtcbiAgdGhpcy5vdXRwdXRDaGFubmVscyA9IG9wdGlvbnMub3V0cHV0Q2hhbm5lbHMgfHwgMTtcbiAgdGhpcy5yZWNvcmRpbmcgPSBmYWxzZTtcbiAgdGhpcy5yZXF1ZXN0ZWRBY2Nlc3MgPSBmYWxzZTtcbiAgdGhpcy5zYW1wbGVSYXRlID0gMTYwMDA7XG4gIC8vIGF1eGlsaWFyIGJ1ZmZlciB0byBrZWVwIHVudXNlZCBzYW1wbGVzICh1c2VkIHdoZW4gZG9pbmcgZG93bnNhbXBsaW5nKVxuICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXMgPSBuZXcgRmxvYXQzMkFycmF5KDApO1xuXG4gIC8vIENocm9tZSBvciBGaXJlZm94IG9yIElFIFVzZXIgbWVkaWFcbiAgaWYgKCFuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKSB7XG4gICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSA9IG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEgfHxcbiAgICBuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tc0dldFVzZXJNZWRpYTtcbiAgfVxuXG59XG5cbi8qKlxuICogQ2FsbGVkIHdoZW4gdGhlIHVzZXIgcmVqZWN0IHRoZSB1c2Ugb2YgdGhlIG1pY2hyb3Bob25lXG4gKiBAcGFyYW0gIGVycm9yIFRoZSBlcnJvclxuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5vblBlcm1pc3Npb25SZWplY3RlZCA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnTWljcm9waG9uZS5vblBlcm1pc3Npb25SZWplY3RlZCgpJyk7XG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gZmFsc2U7XG4gIHRoaXMub25FcnJvcignUGVybWlzc2lvbiB0byBhY2Nlc3MgdGhlIG1pY3JvcGhvbmUgcmVqZXRlZC4nKTtcbn07XG5cbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uRXJyb3IgPSBmdW5jdGlvbihlcnJvcikge1xuICBjb25zb2xlLmxvZygnTWljcm9waG9uZS5vbkVycm9yKCk6JywgZXJyb3IpO1xufTtcblxuLyoqXG4gKiBDYWxsZWQgd2hlbiB0aGUgdXNlciBhdXRob3JpemVzIHRoZSB1c2Ugb2YgdGhlIG1pY3JvcGhvbmUuXG4gKiBAcGFyYW0gIHtPYmplY3R9IHN0cmVhbSBUaGUgU3RyZWFtIHRvIGNvbm5lY3QgdG9cbiAqXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uTWVkaWFTdHJlYW0gPSAgZnVuY3Rpb24oc3RyZWFtKSB7XG4gIHZhciBBdWRpb0N0eCA9IHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dDtcblxuICBpZiAoIUF1ZGlvQ3R4KVxuICAgIHRocm93IG5ldyBFcnJvcignQXVkaW9Db250ZXh0IG5vdCBhdmFpbGFibGUnKTtcblxuICBpZiAoIXRoaXMuYXVkaW9Db250ZXh0KVxuICAgIHRoaXMuYXVkaW9Db250ZXh0ID0gbmV3IEF1ZGlvQ3R4KCk7XG5cbiAgdmFyIGdhaW4gPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gIHZhciBhdWRpb0lucHV0ID0gdGhpcy5hdWRpb0NvbnRleHQuY3JlYXRlTWVkaWFTdHJlYW1Tb3VyY2Uoc3RyZWFtKTtcblxuICBhdWRpb0lucHV0LmNvbm5lY3QoZ2Fpbik7XG5cbiAgdGhpcy5taWMgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IodGhpcy5idWZmZXJTaXplLFxuICAgIHRoaXMuaW5wdXRDaGFubmVscywgdGhpcy5vdXRwdXRDaGFubmVscyk7XG5cbiAgLy8gdW5jb21tZW50IHRoZSBmb2xsb3dpbmcgbGluZSBpZiB5b3Ugd2FudCB0byB1c2UgeW91ciBtaWNyb3Bob25lIHNhbXBsZSByYXRlXG4gIC8vdGhpcy5zYW1wbGVSYXRlID0gdGhpcy5hdWRpb0NvbnRleHQuc2FtcGxlUmF0ZTtcbiAgY29uc29sZS5sb2coJ01pY3JvcGhvbmUub25NZWRpYVN0cmVhbSgpOiBzYW1wbGluZyByYXRlIGlzOicsIHRoaXMuc2FtcGxlUmF0ZSk7XG5cbiAgdGhpcy5taWMub25hdWRpb3Byb2Nlc3MgPSB0aGlzLl9vbmF1ZGlvcHJvY2Vzcy5iaW5kKHRoaXMpO1xuICB0aGlzLnN0cmVhbSA9IHN0cmVhbTtcblxuICBnYWluLmNvbm5lY3QodGhpcy5taWMpO1xuICB0aGlzLm1pYy5jb25uZWN0KHRoaXMuYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgdGhpcy5yZWNvcmRpbmcgPSB0cnVlO1xuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IGZhbHNlO1xuICB0aGlzLm9uU3RhcnRSZWNvcmRpbmcoKTtcbn07XG5cbi8qKlxuICogY2FsbGJhY2sgdGhhdCBpcyBiZWluZyB1c2VkIGJ5IHRoZSBtaWNyb3Bob25lXG4gKiB0byBzZW5kIGF1ZGlvIGNodW5rcy5cbiAqIEBwYXJhbSAge29iamVjdH0gZGF0YSBhdWRpb1xuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5fb25hdWRpb3Byb2Nlc3MgPSBmdW5jdGlvbihkYXRhKSB7XG4gIGlmICghdGhpcy5yZWNvcmRpbmcpIHtcbiAgICAvLyBXZSBzcGVhayBidXQgd2UgYXJlIG5vdCByZWNvcmRpbmdcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBTaW5nbGUgY2hhbm5lbFxuICB2YXIgY2hhbiA9IGRhdGEuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCk7XG5cbiAgdGhpcy5vbkF1ZGlvKHRoaXMuX2V4cG9ydERhdGFCdWZmZXJUbzE2S2h6KG5ldyBGbG9hdDMyQXJyYXkoY2hhbikpKTtcblxuICAvL2V4cG9ydCB3aXRoIG1pY3JvcGhvbmUgbWh6LCByZW1lbWJlciB0byB1cGRhdGUgdGhlIHRoaXMuc2FtcGxlUmF0ZVxuICAvLyB3aXRoIHRoZSBzYW1wbGUgcmF0ZSBmcm9tIHlvdXIgbWljcm9waG9uZVxuICAvLyB0aGlzLm9uQXVkaW8odGhpcy5fZXhwb3J0RGF0YUJ1ZmZlcihuZXcgRmxvYXQzMkFycmF5KGNoYW4pKSk7XG5cbn07XG5cbi8qKlxuICogU3RhcnQgdGhlIGF1ZGlvIHJlY29yZGluZ1xuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5yZWNvcmQgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCFuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKXtcbiAgICB0aGlzLm9uRXJyb3IoJ0Jyb3dzZXIgZG9lc25cXCd0IHN1cHBvcnQgbWljcm9waG9uZSBpbnB1dCcpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAodGhpcy5yZXF1ZXN0ZWRBY2Nlc3MpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IHRydWU7XG4gIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEoeyBhdWRpbzogdHJ1ZSB9LFxuICAgIHRoaXMub25NZWRpYVN0cmVhbS5iaW5kKHRoaXMpLCAvLyBNaWNyb3Bob25lIHBlcm1pc3Npb24gZ3JhbnRlZFxuICAgIHRoaXMub25QZXJtaXNzaW9uUmVqZWN0ZWQuYmluZCh0aGlzKSk7IC8vIE1pY3JvcGhvbmUgcGVybWlzc2lvbiByZWplY3RlZFxufTtcblxuLyoqXG4gKiBTdG9wIHRoZSBhdWRpbyByZWNvcmRpbmdcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMucmVjb3JkaW5nKVxuICAgIHJldHVybjtcbiAgdGhpcy5yZWNvcmRpbmcgPSBmYWxzZTtcbiAgdGhpcy5zdHJlYW0uc3RvcCgpO1xuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IGZhbHNlO1xuICB0aGlzLm1pYy5kaXNjb25uZWN0KDApO1xuICB0aGlzLm1pYyA9IG51bGw7XG4gIHRoaXMub25TdG9wUmVjb3JkaW5nKCk7XG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYSBCbG9iIHR5cGU6ICdhdWRpby9sMTYnIHdpdGggdGhlIGNodW5rIGFuZCBkb3duc2FtcGxpbmcgdG8gMTYga0h6XG4gKiBjb21pbmcgZnJvbSB0aGUgbWljcm9waG9uZS5cbiAqIEV4cGxhbmF0aW9uIGZvciB0aGUgbWF0aDogVGhlIHJhdyB2YWx1ZXMgY2FwdHVyZWQgZnJvbSB0aGUgV2ViIEF1ZGlvIEFQSSBhcmVcbiAqIGluIDMyLWJpdCBGbG9hdGluZyBQb2ludCwgYmV0d2VlbiAtMSBhbmQgMSAocGVyIHRoZSBzcGVjaWZpY2F0aW9uKS5cbiAqIFRoZSB2YWx1ZXMgZm9yIDE2LWJpdCBQQ00gcmFuZ2UgYmV0d2VlbiAtMzI3NjggYW5kICszMjc2NyAoMTYtYml0IHNpZ25lZCBpbnRlZ2VyKS5cbiAqIE11bHRpcGx5IHRvIGNvbnRyb2wgdGhlIHZvbHVtZSBvZiB0aGUgb3V0cHV0LiBXZSBzdG9yZSBpbiBsaXR0bGUgZW5kaWFuLlxuICogQHBhcmFtICB7T2JqZWN0fSBidWZmZXIgTWljcm9waG9uZSBhdWRpbyBjaHVua1xuICogQHJldHVybiB7QmxvYn0gJ2F1ZGlvL2wxNicgY2h1bmtcbiAqIEBkZXByZWNhdGVkIFRoaXMgbWV0aG9kIGlzIGRlcHJhY2F0ZWRcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUuX2V4cG9ydERhdGFCdWZmZXJUbzE2S2h6ID0gZnVuY3Rpb24oYnVmZmVyTmV3U2FtcGxlcykge1xuICB2YXIgYnVmZmVyID0gbnVsbCxcbiAgICBuZXdTYW1wbGVzID0gYnVmZmVyTmV3U2FtcGxlcy5sZW5ndGgsXG4gICAgdW51c2VkU2FtcGxlcyA9IHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlcy5sZW5ndGg7XG5cbiAgaWYgKHVudXNlZFNhbXBsZXMgPiAwKSB7XG4gICAgYnVmZmVyID0gbmV3IEZsb2F0MzJBcnJheSh1bnVzZWRTYW1wbGVzICsgbmV3U2FtcGxlcyk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bnVzZWRTYW1wbGVzOyArK2kpIHtcbiAgICAgIGJ1ZmZlcltpXSA9IHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlc1tpXTtcbiAgICB9XG4gICAgZm9yIChpID0gMDsgaSA8IG5ld1NhbXBsZXM7ICsraSkge1xuICAgICAgYnVmZmVyW3VudXNlZFNhbXBsZXMgKyBpXSA9IGJ1ZmZlck5ld1NhbXBsZXNbaV07XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGJ1ZmZlciA9IGJ1ZmZlck5ld1NhbXBsZXM7XG4gIH1cblxuICAvLyBkb3duc2FtcGxpbmcgdmFyaWFibGVzXG4gIHZhciBmaWx0ZXIgPSBbXG4gICAgICAtMC4wMzc5MzUsIC0wLjAwMDg5MDI0LCAwLjA0MDE3MywgMC4wMTk5ODksIDAuMDA0Nzc5MiwgLTAuMDU4Njc1LCAtMC4wNTY0ODcsXG4gICAgICAtMC4wMDQwNjUzLCAwLjE0NTI3LCAwLjI2OTI3LCAwLjMzOTEzLCAwLjI2OTI3LCAwLjE0NTI3LCAtMC4wMDQwNjUzLCAtMC4wNTY0ODcsXG4gICAgICAtMC4wNTg2NzUsIDAuMDA0Nzc5MiwgMC4wMTk5ODksIDAuMDQwMTczLCAtMC4wMDA4OTAyNCwgLTAuMDM3OTM1XG4gICAgXSxcbiAgICBzYW1wbGluZ1JhdGVSYXRpbyA9IHRoaXMuYXVkaW9Db250ZXh0LnNhbXBsZVJhdGUgLyAxNjAwMCxcbiAgICBuT3V0cHV0U2FtcGxlcyA9IE1hdGguZmxvb3IoKGJ1ZmZlci5sZW5ndGggLSBmaWx0ZXIubGVuZ3RoKSAvIChzYW1wbGluZ1JhdGVSYXRpbykpICsgMSxcbiAgICBwY21FbmNvZGVkQnVmZmVyMTZrID0gbmV3IEFycmF5QnVmZmVyKG5PdXRwdXRTYW1wbGVzICogMiksXG4gICAgZGF0YVZpZXcxNmsgPSBuZXcgRGF0YVZpZXcocGNtRW5jb2RlZEJ1ZmZlcjE2ayksXG4gICAgaW5kZXggPSAwLFxuICAgIHZvbHVtZSA9IDB4N0ZGRiwgLy9yYW5nZSBmcm9tIDAgdG8gMHg3RkZGIHRvIGNvbnRyb2wgdGhlIHZvbHVtZVxuICAgIG5PdXQgPSAwO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpICsgZmlsdGVyLmxlbmd0aCAtIDEgPCBidWZmZXIubGVuZ3RoOyBpID0gTWF0aC5yb3VuZChzYW1wbGluZ1JhdGVSYXRpbyAqIG5PdXQpKSB7XG4gICAgdmFyIHNhbXBsZSA9IDA7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBmaWx0ZXIubGVuZ3RoOyArK2opIHtcbiAgICAgIHNhbXBsZSArPSBidWZmZXJbaSArIGpdICogZmlsdGVyW2pdO1xuICAgIH1cbiAgICBzYW1wbGUgKj0gdm9sdW1lO1xuICAgIGRhdGFWaWV3MTZrLnNldEludDE2KGluZGV4LCBzYW1wbGUsIHRydWUpOyAvLyAndHJ1ZScgLT4gbWVhbnMgbGl0dGxlIGVuZGlhblxuICAgIGluZGV4ICs9IDI7XG4gICAgbk91dCsrO1xuICB9XG5cbiAgdmFyIGluZGV4U2FtcGxlQWZ0ZXJMYXN0VXNlZCA9IE1hdGgucm91bmQoc2FtcGxpbmdSYXRlUmF0aW8gKiBuT3V0KTtcbiAgdmFyIHJlbWFpbmluZyA9IGJ1ZmZlci5sZW5ndGggLSBpbmRleFNhbXBsZUFmdGVyTGFzdFVzZWQ7XG4gIGlmIChyZW1haW5pbmcgPiAwKSB7XG4gICAgdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzID0gbmV3IEZsb2F0MzJBcnJheShyZW1haW5pbmcpO1xuICAgIGZvciAoaSA9IDA7IGkgPCByZW1haW5pbmc7ICsraSkge1xuICAgICAgdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzW2ldID0gYnVmZmVyW2luZGV4U2FtcGxlQWZ0ZXJMYXN0VXNlZCArIGldO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXMgPSBuZXcgRmxvYXQzMkFycmF5KDApO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBCbG9iKFtkYXRhVmlldzE2a10sIHtcbiAgICB0eXBlOiAnYXVkaW8vbDE2J1xuICB9KTtcbiAgfTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgQmxvYiB0eXBlOiAnYXVkaW8vbDE2JyB3aXRoIHRoZVxuICogY2h1bmsgY29taW5nIGZyb20gdGhlIG1pY3JvcGhvbmUuXG4gKi9cbnZhciBleHBvcnREYXRhQnVmZmVyID0gZnVuY3Rpb24oYnVmZmVyLCBidWZmZXJTaXplKSB7XG4gIHZhciBwY21FbmNvZGVkQnVmZmVyID0gbnVsbCxcbiAgICBkYXRhVmlldyA9IG51bGwsXG4gICAgaW5kZXggPSAwLFxuICAgIHZvbHVtZSA9IDB4N0ZGRjsgLy9yYW5nZSBmcm9tIDAgdG8gMHg3RkZGIHRvIGNvbnRyb2wgdGhlIHZvbHVtZVxuXG4gIHBjbUVuY29kZWRCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoYnVmZmVyU2l6ZSAqIDIpO1xuICBkYXRhVmlldyA9IG5ldyBEYXRhVmlldyhwY21FbmNvZGVkQnVmZmVyKTtcblxuICAvKiBFeHBsYW5hdGlvbiBmb3IgdGhlIG1hdGg6IFRoZSByYXcgdmFsdWVzIGNhcHR1cmVkIGZyb20gdGhlIFdlYiBBdWRpbyBBUEkgYXJlXG4gICAqIGluIDMyLWJpdCBGbG9hdGluZyBQb2ludCwgYmV0d2VlbiAtMSBhbmQgMSAocGVyIHRoZSBzcGVjaWZpY2F0aW9uKS5cbiAgICogVGhlIHZhbHVlcyBmb3IgMTYtYml0IFBDTSByYW5nZSBiZXR3ZWVuIC0zMjc2OCBhbmQgKzMyNzY3ICgxNi1iaXQgc2lnbmVkIGludGVnZXIpLlxuICAgKiBNdWx0aXBseSB0byBjb250cm9sIHRoZSB2b2x1bWUgb2YgdGhlIG91dHB1dC4gV2Ugc3RvcmUgaW4gbGl0dGxlIGVuZGlhbi5cbiAgICovXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyLmxlbmd0aDsgaSsrKSB7XG4gICAgZGF0YVZpZXcuc2V0SW50MTYoaW5kZXgsIGJ1ZmZlcltpXSAqIHZvbHVtZSwgdHJ1ZSk7XG4gICAgaW5kZXggKz0gMjtcbiAgfVxuXG4gIC8vIGwxNiBpcyB0aGUgTUlNRSB0eXBlIGZvciAxNi1iaXQgUENNXG4gIHJldHVybiBuZXcgQmxvYihbZGF0YVZpZXddLCB7IHR5cGU6ICdhdWRpby9sMTYnIH0pO1xufTtcblxuTWljcm9waG9uZS5wcm90b3R5cGUuX2V4cG9ydERhdGFCdWZmZXIgPSBmdW5jdGlvbihidWZmZXIpe1xuICB1dGlscy5leHBvcnREYXRhQnVmZmVyKGJ1ZmZlciwgdGhpcy5idWZmZXJTaXplKTtcbn07IFxuXG5cbi8vIEZ1bmN0aW9ucyB1c2VkIHRvIGNvbnRyb2wgTWljcm9waG9uZSBldmVudHMgbGlzdGVuZXJzLlxuTWljcm9waG9uZS5wcm90b3R5cGUub25TdGFydFJlY29yZGluZyA9ICBmdW5jdGlvbigpIHt9O1xuTWljcm9waG9uZS5wcm90b3R5cGUub25TdG9wUmVjb3JkaW5nID0gIGZ1bmN0aW9uKCkge307XG5NaWNyb3Bob25lLnByb3RvdHlwZS5vbkF1ZGlvID0gIGZ1bmN0aW9uKCkge307XG5cbm1vZHVsZS5leHBvcnRzID0gTWljcm9waG9uZTtcblxuIiwibW9kdWxlLmV4cG9ydHM9e1xuICAgXCJtb2RlbHNcIjogW1xuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS1zLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC1iZXRhL2FwaS92MS9tb2RlbHMvZW4tVVNfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogMTYwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiZW4tVVNfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiZW4tVVNcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiVVMgRW5nbGlzaCBicm9hZGJhbmQgbW9kZWwgKDE2S0h6KVwiXG4gICAgICB9LCBcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0tcy53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQtYmV0YS9hcGkvdjEvbW9kZWxzL2VuLVVTX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiA4MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcImVuLVVTX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJlbi1VU1wiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJVUyBFbmdsaXNoIG5hcnJvd2JhbmQgbW9kZWwgKDhLSHopXCJcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLXMud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0LWJldGEvYXBpL3YxL21vZGVscy9lcy1FU19Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiAxNjAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJlcy1FU19Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJlcy1FU1wiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJTcGFuaXNoIGJyb2FkYmFuZCBtb2RlbCAoMTZLSHopXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS1zLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC1iZXRhL2FwaS92MS9tb2RlbHMvZXMtRVNfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDgwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiZXMtRVNfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImVzLUVTXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlNwYW5pc2ggbmFycm93YmFuZCBtb2RlbCAoOEtIeilcIlxuICAgICAgfSwgXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLXMud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0LWJldGEvYXBpL3YxL21vZGVscy9qYS1KUF9Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiAxNjAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJqYS1KUF9Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJqYS1KUFwiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJKYXBhbmVzZSBicm9hZGJhbmQgbW9kZWwgKDE2S0h6KVwiXG4gICAgICB9LCBcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0tcy53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQtYmV0YS9hcGkvdjEvbW9kZWxzL2phLUpQX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiA4MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcImphLUpQX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJqYS1KUFwiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJKYXBhbmVzZSBuYXJyb3diYW5kIG1vZGVsICg4S0h6KVwiXG4gICAgICB9XG4gICBdXG59XG4iLCJcbnZhciBlZmZlY3RzID0gcmVxdWlyZSgnLi92aWV3cy9lZmZlY3RzJyk7XG52YXIgZGlzcGxheSA9IHJlcXVpcmUoJy4vdmlld3MvZGlzcGxheScpO1xudmFyIGhpZGVFcnJvciA9IHJlcXVpcmUoJy4vdmlld3Mvc2hvd2Vycm9yJykuaGlkZUVycm9yO1xudmFyIGluaXRTb2NrZXQgPSByZXF1aXJlKCcuL3NvY2tldCcpLmluaXRTb2NrZXQ7XG5cbmV4cG9ydHMuaGFuZGxlRmlsZVVwbG9hZCA9IGZ1bmN0aW9uKHRva2VuLCBtb2RlbCwgZmlsZSwgY29udGVudFR5cGUsIGNhbGxiYWNrLCBvbmVuZCkge1xuXG5cbiAgICBjb25zb2xlLmxvZygnc2V0dGluZyBpbWFnZScpO1xuICAgIC8vICQoJyNwcm9ncmVzc0luZGljYXRvcicpLmNzcygndmlzaWJpbGl0eScsICd2aXNpYmxlJyk7XG4gICAgaGlkZUVycm9yKCk7XG5cbiAgICAkLnN1YnNjcmliZSgncHJvZ3Jlc3MnLCBmdW5jdGlvbihldnQsIGRhdGEpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdwcm9ncmVzczogJywgZGF0YSk7XG4gICAgfSk7XG5cbiAgICB2YXIgbWljSWNvbiA9ICQoJyNtaWNyb3Bob25lSWNvbicpO1xuXG4gICAgY29uc29sZS5sb2coJ2NvbnRlbnRUeXBlJywgY29udGVudFR5cGUpO1xuXG4gICAgdmFyIGJhc2VTdHJpbmcgPSAnJztcbiAgICB2YXIgYmFzZUpTT04gPSAnJztcblxuICAgIHZhciBvcHRpb25zID0ge307XG4gICAgb3B0aW9ucy50b2tlbiA9IHRva2VuO1xuICAgIG9wdGlvbnMubWVzc2FnZSA9IHtcbiAgICAgICdhY3Rpb24nOiAnc3RhcnQnLFxuICAgICAgJ2NvbnRlbnQtdHlwZSc6IGNvbnRlbnRUeXBlLFxuICAgICAgJ2ludGVyaW1fcmVzdWx0cyc6IHRydWUsXG4gICAgICAnY29udGludW91cyc6IHRydWUsXG4gICAgICAnd29yZF9jb25maWRlbmNlJzogdHJ1ZSxcbiAgICAgICd0aW1lc3RhbXBzJzogdHJ1ZSxcbiAgICAgICdtYXhfYWx0ZXJuYXRpdmVzJzogM1xuICAgIH07XG4gICAgb3B0aW9ucy5tb2RlbCA9IG1vZGVsO1xuXG4gICAgZnVuY3Rpb24gb25PcGVuKHNvY2tldCkge1xuICAgICAgY29uc29sZS5sb2coJ1NvY2tldCBvcGVuZWQnKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkxpc3RlbmluZyhzb2NrZXQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdTb2NrZXQgbGlzdGVuaW5nJyk7XG4gICAgICBjYWxsYmFjayhzb2NrZXQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uTWVzc2FnZShtc2cpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdTb2NrZXQgbXNnOiAnLCBtc2cpO1xuICAgICAgaWYgKG1zZy5yZXN1bHRzKSB7XG4gICAgICAgIC8vIENvbnZlcnQgdG8gY2xvc3VyZSBhcHByb2FjaFxuICAgICAgICBiYXNlU3RyaW5nID0gZGlzcGxheS5zaG93UmVzdWx0KG1zZywgYmFzZVN0cmluZyk7XG4gICAgICAgIGJhc2VKU09OID0gZGlzcGxheS5zaG93SlNPTihtc2csIGJhc2VKU09OKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkVycm9yKGV2dCkge1xuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG4gICAgICBvbmVuZChldnQpO1xuICAgICAgY29uc29sZS5sb2coJ1NvY2tldCBlcnI6ICcsIGV2dC5jb2RlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkNsb3NlKGV2dCkge1xuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG4gICAgICBvbmVuZChldnQpO1xuICAgICAgY29uc29sZS5sb2coJ1NvY2tldCBjbG9zaW5nOiAnLCBldnQpO1xuICAgIH1cblxuICAgIGluaXRTb2NrZXQob3B0aW9ucywgb25PcGVuLCBvbkxpc3RlbmluZywgb25NZXNzYWdlLCBvbkVycm9yLCBvbkNsb3NlKTtcblxuICB9XG4iLCJcbid1c2Ugc3RyaWN0JztcblxudmFyIGluaXRTb2NrZXQgPSByZXF1aXJlKCcuL3NvY2tldCcpLmluaXRTb2NrZXQ7XG52YXIgZGlzcGxheSA9IHJlcXVpcmUoJy4vdmlld3MvZGlzcGxheScpO1xuXG5leHBvcnRzLmhhbmRsZU1pY3JvcGhvbmUgPSBmdW5jdGlvbih0b2tlbiwgbW9kZWwsIG1pYywgY2FsbGJhY2spIHtcblxuICB2YXIgY3VycmVudE1vZGVsID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRNb2RlbCcpO1xuXG4gIGlmIChjdXJyZW50TW9kZWwuaW5kZXhPZignTmFycm93YmFuZCcpID4gLTEpIHtcbiAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdNaWNyb3Bob25lIGNhbm5vdCBhY2NvbW9kYXRlIG5hcnJvdyBiYW5kIG1vZGVscywgcGxlYXNlIHNlbGVjdCBhbm90aGVyJyk7XG4gICAgY2FsbGJhY2soZXJyLCBudWxsKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAkLnB1Ymxpc2goJ2NsZWFyc2NyZWVuJyk7XG5cbiAgLy8gVGVzdCBvdXQgd2Vic29ja2V0XG4gIHZhciBiYXNlU3RyaW5nID0gJyc7XG4gIHZhciBiYXNlSlNPTiA9ICcnO1xuXG4gIHZhciBvcHRpb25zID0ge307XG4gIG9wdGlvbnMudG9rZW4gPSB0b2tlbjtcbiAgb3B0aW9ucy5tZXNzYWdlID0ge1xuICAgICdhY3Rpb24nOiAnc3RhcnQnLFxuICAgICdjb250ZW50LXR5cGUnOiAnYXVkaW8vbDE2O3JhdGU9MTYwMDAnLFxuICAgICdpbnRlcmltX3Jlc3VsdHMnOiB0cnVlLFxuICAgICdjb250aW51b3VzJzogdHJ1ZSxcbiAgICAnd29yZF9jb25maWRlbmNlJzogdHJ1ZSxcbiAgICAndGltZXN0YW1wcyc6IHRydWUsXG4gICAgJ21heF9hbHRlcm5hdGl2ZXMnOiAzXG4gIH07XG4gIG9wdGlvbnMubW9kZWwgPSBtb2RlbDtcblxuICBmdW5jdGlvbiBvbk9wZW4oc29ja2V0KSB7XG4gICAgY29uc29sZS5sb2coJ3NvY2tldCBvcGVuZWQnKTtcbiAgICBjYWxsYmFjayhudWxsLCBzb2NrZXQpO1xuICB9XG5cbiAgZnVuY3Rpb24gb25MaXN0ZW5pbmcoc29ja2V0KSB7XG5cbiAgICBtaWMub25BdWRpbyA9IGZ1bmN0aW9uKGJsb2IpIHtcbiAgICAgIGlmIChzb2NrZXQucmVhZHlTdGF0ZSA8IDIpIHtcbiAgICAgICAgc29ja2V0LnNlbmQoYmxvYilcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gb25NZXNzYWdlKG1zZywgc29ja2V0KSB7XG4gICAgY29uc29sZS5sb2coJ01pYyBzb2NrZXQgbXNnOiAnLCBtc2cpO1xuICAgIGlmIChtc2cucmVzdWx0cykge1xuICAgICAgLy8gQ29udmVydCB0byBjbG9zdXJlIGFwcHJvYWNoXG4gICAgICBiYXNlU3RyaW5nID0gZGlzcGxheS5zaG93UmVzdWx0KG1zZywgYmFzZVN0cmluZyk7XG4gICAgICBiYXNlSlNPTiA9IGRpc3BsYXkuc2hvd0pTT04obXNnLCBiYXNlSlNPTik7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb25FcnJvcihyLCBzb2NrZXQpIHtcbiAgICBjb25zb2xlLmxvZygnTWljIHNvY2tldCBlcnI6ICcsIGVycik7XG4gIH1cblxuICBmdW5jdGlvbiBvbkNsb3NlKGV2dCkge1xuICAgIGNvbnNvbGUubG9nKCdNaWMgc29ja2V0IGNsb3NlOiAnLCBldnQpO1xuICB9XG5cbiAgaW5pdFNvY2tldChvcHRpb25zLCBvbk9wZW4sIG9uTGlzdGVuaW5nLCBvbk1lc3NhZ2UsIG9uRXJyb3IsIG9uQ2xvc2UpO1xuXG59XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDE0IElCTSBDb3JwLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbi8qZ2xvYmFsICQ6ZmFsc2UgKi9cblxuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG52YXIgTWljcm9waG9uZSA9IHJlcXVpcmUoJy4vTWljcm9waG9uZScpO1xudmFyIHNob3dlcnJvciA9IHJlcXVpcmUoJy4vdmlld3Mvc2hvd2Vycm9yJyk7XG52YXIgc2hvd0Vycm9yID0gc2hvd2Vycm9yLnNob3dFcnJvcjtcbnZhciBoaWRlRXJyb3IgPSBzaG93ZXJyb3IuaGlkZUVycm9yO1xuXG4vLyBNaW5pIFdTIGNhbGxiYWNrIEFQSSwgc28gd2UgY2FuIGluaXRpYWxpemVcbi8vIHdpdGggbW9kZWwgYW5kIHRva2VuIGluIFVSSSwgcGx1c1xuLy8gc3RhcnQgbWVzc2FnZVxuLy9cblxudmFyIGluaXRTb2NrZXQgPSBleHBvcnRzLmluaXRTb2NrZXQgPSBmdW5jdGlvbihvcHRpb25zLCBvbm9wZW4sIG9ubGlzdGVuaW5nLCBvbm1lc3NhZ2UsIG9uZXJyb3IsIG9uY2xvc2UsIHJldHJ5Q291bnREb3duKSB7XG4gIHZhciBsaXN0ZW5pbmcgPSBmYWxzZTtcbiAgZnVuY3Rpb24gd2l0aERlZmF1bHQodmFsLCBkZWZhdWx0VmFsKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWwgPT09ICd1bmRlZmluZWQnID8gZGVmYXVsdFZhbCA6IHZhbDtcbiAgfVxuICB2YXIgc29ja2V0LCBjb3VudDtcbiAgdmFyIHRva2VuID0gb3B0aW9ucy50b2tlbjtcbiAgdmFyIG1vZGVsID0gb3B0aW9ucy5tb2RlbCB8fCBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudE1vZGVsJyk7XG4gIHZhciBtZXNzYWdlID0gb3B0aW9ucy5tZXNzYWdlIHx8IHsnYWN0aW9uJzogJ3N0YXJ0J307XG4gIHZhciBzZXNzaW9uUGVybWlzc2lvbnMgPSB3aXRoRGVmYXVsdChvcHRpb25zLnNlc3Npb25QZXJtaXNzaW9ucywgSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnc2Vzc2lvblBlcm1pc3Npb25zJykpKTtcbiAgdmFyIHNlc3Npb25QZXJtaXNzaW9uc1F1ZXJ5UGFyYW0gPSBzZXNzaW9uUGVybWlzc2lvbnMgPyAnMCcgOiAnMSc7XG4gIHZhciB1cmwgPSBvcHRpb25zLnNlcnZpY2VVUkkgfHwgJ3dzczovL3N0cmVhbS1zLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC1iZXRhL2FwaS92MS9yZWNvZ25pemU/d2F0c29uLXRva2VuPSdcbiAgICArIHRva2VuXG4gICAgKyAnJlgtV0RDLVBMLU9QVC1PVVQ9JyArIHNlc3Npb25QZXJtaXNzaW9uc1F1ZXJ5UGFyYW1cbiAgICArICcmbW9kZWw9JyArIG1vZGVsO1xuICBjb25zb2xlLmxvZygnVVJMIG1vZGVsJywgbW9kZWwpO1xuICB0cnkge1xuICAgIHNvY2tldCA9IG5ldyBXZWJTb2NrZXQodXJsKTtcbiAgfSBjYXRjaChlcnIpIHtcbiAgICBjb25zb2xlLmxvZygnd2Vic29ja2V0ZXJyJywgZXJyKTtcbiAgICBzaG93RXJyb3IoZXJyLm1lc3NhZ2UpO1xuICB9XG4gIHNvY2tldC5vbm9wZW4gPSBmdW5jdGlvbihldnQpIHtcbiAgICBjb25zb2xlLmxvZygnd3Mgb3BlbmVkJyk7XG4gICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkpO1xuICAgIG9ub3Blbihzb2NrZXQpO1xuICB9O1xuICBzb2NrZXQub25tZXNzYWdlID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIG1zZyA9IEpTT04ucGFyc2UoZXZ0LmRhdGEpO1xuICAgIGlmIChtc2cuc3RhdGUgPT09ICdsaXN0ZW5pbmcnKSB7XG4gICAgICAvLyBFYXJseSBjdXQgb2ZmLCB3aXRob3V0IG5vdGlmaWNhdGlvblxuICAgICAgaWYgKCFsaXN0ZW5pbmcpIHtcbiAgICAgICAgJC5zdWJzY3JpYmUoJ3NvY2tldHN0b3AnLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ01JQ1JPUEhPTkU6IFNlbmRpbmcgc3RvcCBsaXN0ZW4gbWVzc2FnZS4nKTtcbiAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7YWN0aW9uOidzdG9wJ30pKTtcbiAgICAgICAgfSk7XG4gICAgICAgIG9ubGlzdGVuaW5nKHNvY2tldCk7XG4gICAgICAgIGhpZGVFcnJvcigpO1xuICAgICAgICBsaXN0ZW5pbmcgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ01JQ1JPUEhPTkU6IENsb3Npbmcgc29ja2V0LicpO1xuICAgICAgICBzb2NrZXQuY2xvc2UoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgb25tZXNzYWdlKG1zZywgc29ja2V0KTtcbiAgfTtcblxuICBzb2NrZXQub25lcnJvciA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIGNvbnNvbGUubG9nKCdXUyBvbmVycm9yOiAnLCBldnQpO1xuICAgIHNob3dFcnJvcignQXBwbGljYXRpb24gZXJyb3IgJyArIGV2dC5jb2RlICsgJzogcGxlYXNlIHJlZnJlc2ggeW91ciBicm93c2VyIGFuZCB0cnkgYWdhaW4nKTtcbiAgICBvbmVycm9yKGV2dCk7XG4gIH07XG5cbiAgc29ja2V0Lm9uY2xvc2UgPSBmdW5jdGlvbihldnQpIHtcbiAgICBjb25zb2xlLmxvZygnV1Mgb25jbG9zZTogJywgZXZ0KTtcbiAgICBpZiAoZXZ0LmNvZGUgPT09IDEwMDYpIHtcbiAgICAgIC8vIEF1dGhlbnRpY2F0aW9uIGVycm9yLCB0cnkgdG8gcmVjb25uZWN0XG4gICAgICBjb3VudCA9IHV0aWxzLmdldFRva2VuKGZ1bmN0aW9uKHRva2VuLCBlcnIpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHNob3dFcnJvcihlcnIubWVzc2FnZSk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnNvbGUubG9nKCdGZXRjaGluZyBhZGRpdGlvbmFsIHRva2VuLi4uJyk7XG4gICAgICAgIG9wdGlvbnMudG9rZW4gPSB0b2tlbjtcbiAgICAgICAgaW5pdFNvY2tldChvcHRpb25zLCBvbm9wZW4sIG9ubGlzdGVuaW5nLCBvbm1lc3NhZ2UsIG9uZXJyb3IpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIGlmIChldnQuY29kZSA+IDEwMDApIHtcbiAgICAgIHNob3dFcnJvcignU2VydmVyIGVycm9yICcgKyBldnQuY29kZSArICc6IHBsZWFzZSByZWZyZXNoIHlvdXIgYnJvd3NlciBhbmQgdHJ5IGFnYWluJyk7XG4gICAgfVxuICAgIC8vIE1hZGUgaXQgdGhyb3VnaCwgbm9ybWFsIGNsb3NlXG4gICAgb25jbG9zZShldnQpO1xuICB9O1xuXG59XG5cbiIsIlxuLy8gRm9yIG5vbi12aWV3IGxvZ2ljXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93LmpRdWVyeSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwualF1ZXJ5IDogbnVsbCk7XG5cbnZhciBmaWxlQmxvY2sgPSBmdW5jdGlvbihfb2Zmc2V0LCBsZW5ndGgsIF9maWxlLCByZWFkQ2h1bmspIHtcbiAgdmFyIHIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICB2YXIgYmxvYiA9IF9maWxlLnNsaWNlKF9vZmZzZXQsIGxlbmd0aCArIF9vZmZzZXQpO1xuICByLm9ubG9hZCA9IHJlYWRDaHVuaztcbiAgci5yZWFkQXNBcnJheUJ1ZmZlcihibG9iKTtcbn1cblxuLy8gQmFzZWQgb24gYWxlZGlhZmVyaWEncyBTTyByZXNwb25zZVxuLy8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xNDQzODE4Ny9qYXZhc2NyaXB0LWZpbGVyZWFkZXItcGFyc2luZy1sb25nLWZpbGUtaW4tY2h1bmtzXG5leHBvcnRzLm9uRmlsZVByb2dyZXNzID0gZnVuY3Rpb24ob3B0aW9ucywgb25kYXRhLCBvbmVycm9yLCBvbmVuZCkge1xuICB2YXIgZmlsZSAgICAgICA9IG9wdGlvbnMuZmlsZTtcbiAgdmFyIGZpbGVTaXplICAgPSBmaWxlLnNpemU7XG4gIHZhciBjaHVua1NpemUgID0gb3B0aW9ucy5idWZmZXJTaXplIHx8IDgxOTI7XG4gIHZhciBvZmZzZXQgICAgID0gMDtcbiAgdmFyIHJlYWRDaHVuayA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIGlmIChvZmZzZXQgPj0gZmlsZVNpemUpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiRG9uZSByZWFkaW5nIGZpbGVcIik7XG4gICAgICBvbmVuZCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoZXZ0LnRhcmdldC5lcnJvciA9PSBudWxsKSB7XG4gICAgICB2YXIgYnVmZmVyID0gZXZ0LnRhcmdldC5yZXN1bHQ7XG4gICAgICB2YXIgbGVuID0gYnVmZmVyLmJ5dGVMZW5ndGg7XG4gICAgICBvZmZzZXQgKz0gbGVuO1xuICAgICAgb25kYXRhKGJ1ZmZlcik7IC8vIGNhbGxiYWNrIGZvciBoYW5kbGluZyByZWFkIGNodW5rXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBlcnJvck1lc3NhZ2UgPSBldnQudGFyZ2V0LmVycm9yO1xuICAgICAgY29uc29sZS5sb2coXCJSZWFkIGVycm9yOiBcIiArIGVycm9yTWVzc2FnZSk7XG4gICAgICBvbmVycm9yKGVycm9yTWVzc2FnZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGZpbGVCbG9jayhvZmZzZXQsIGNodW5rU2l6ZSwgZmlsZSwgcmVhZENodW5rKTtcbiAgfVxuICBmaWxlQmxvY2sob2Zmc2V0LCBjaHVua1NpemUsIGZpbGUsIHJlYWRDaHVuayk7XG59XG5cbmV4cG9ydHMuZ2V0VG9rZW4gPSAoZnVuY3Rpb24oKSB7XG4gIC8vIE1ha2UgY2FsbCB0byBBUEkgdG8gdHJ5IGFuZCBnZXQgdG9rZW5cbiAgdmFyIGhhc0JlZW5SdW5UaW1lcyA9IDI7XG4gIHJldHVybiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIGhhc0JlZW5SdW5UaW1lcy0tO1xuICAgIGlmIChoYXNCZWVuUnVuVGltZXMgPT09IDApIHtcbiAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoJ0Nhbm5vdCByZWFjaCBzZXJ2ZXInKTtcbiAgICAgIGNhbGxiYWNrKG51bGwsIGVycik7XG4gICAgfVxuICAgIHZhciB1cmwgPSAnL3Rva2VuJztcbiAgICB2YXIgdG9rZW5SZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgdG9rZW5SZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgdXJsLCB0cnVlKTtcbiAgICB0b2tlblJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgICB2YXIgdG9rZW4gPSB0b2tlblJlcXVlc3QucmVzcG9uc2VUZXh0O1xuICAgICAgY2FsbGJhY2sodG9rZW4pO1xuICAgIH07XG4gICAgdG9rZW5SZXF1ZXN0LnNlbmQoKTtcbiAgfVxufSkoKTtcblxuZXhwb3J0cy5pbml0UHViU3ViID0gZnVuY3Rpb24oKSB7XG4gIHZhciBvICAgICAgICAgPSAkKHt9KTtcbiAgJC5zdWJzY3JpYmUgICA9IG8ub24uYmluZChvKTtcbiAgJC51bnN1YnNjcmliZSA9IG8ub2ZmLmJpbmQobyk7XG4gICQucHVibGlzaCAgICAgPSBvLnRyaWdnZXIuYmluZChvKTtcbn1cbiIsIlxuXG5leHBvcnRzLmluaXRBbmltYXRlUGFuZWwgPSBmdW5jdGlvbigpIHtcbiAgJCgnLnBhbmVsLWhlYWRpbmcgc3Bhbi5jbGlja2FibGUnKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uIChlKSB7XG4gICAgaWYgKCQodGhpcykuaGFzQ2xhc3MoJ3BhbmVsLWNvbGxhcHNlZCcpKSB7XG4gICAgICAvLyBleHBhbmQgdGhlIHBhbmVsXG4gICAgICAkKHRoaXMpLnBhcmVudHMoJy5wYW5lbCcpLmZpbmQoJy5wYW5lbC1ib2R5Jykuc2xpZGVEb3duKCk7XG4gICAgICAkKHRoaXMpLnJlbW92ZUNsYXNzKCdwYW5lbC1jb2xsYXBzZWQnKTtcbiAgICAgICQodGhpcykuZmluZCgnaScpLnJlbW92ZUNsYXNzKCdjYXJldC1kb3duJykuYWRkQ2xhc3MoJ2NhcmV0LXVwJyk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgLy8gY29sbGFwc2UgdGhlIHBhbmVsXG4gICAgICAkKHRoaXMpLnBhcmVudHMoJy5wYW5lbCcpLmZpbmQoJy5wYW5lbC1ib2R5Jykuc2xpZGVVcCgpO1xuICAgICAgJCh0aGlzKS5hZGRDbGFzcygncGFuZWwtY29sbGFwc2VkJyk7XG4gICAgICAkKHRoaXMpLmZpbmQoJ2knKS5yZW1vdmVDbGFzcygnY2FyZXQtdXAnKS5hZGRDbGFzcygnY2FyZXQtZG93bicpO1xuICAgIH1cbiAgfSk7XG59XG5cbiIsInZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cualF1ZXJ5IDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbC5qUXVlcnkgOiBudWxsKTtcblxudmFyIHNob3dUaW1lc3RhbXAgPSBmdW5jdGlvbih0aW1lc3RhbXBzLCBjb25maWRlbmNlcykge1xuICB2YXIgd29yZCA9IHRpbWVzdGFtcHNbMF0sXG4gICAgICB0MCA9IHRpbWVzdGFtcHNbMV0sXG4gICAgICB0MSA9IHRpbWVzdGFtcHNbMl07XG4gIHZhciB0aW1lbGVuZ3RoID0gdDEgLSB0MDtcbiAgLy8gU2hvdyBjb25maWRlbmNlIGlmIGRlZmluZWQsIGVsc2UgJ24vYSdcbiAgdmFyIGRpc3BsYXlDb25maWRlbmNlID0gY29uZmlkZW5jZXMgPyBjb25maWRlbmNlc1sxXS50b1N0cmluZygpLnN1YnN0cmluZygwLCAzKSA6ICduL2EnO1xuICAkKCcjbWV0YWRhdGFUYWJsZSA+IHRib2R5Omxhc3QtY2hpbGQnKS5hcHBlbmQoXG4gICAgICAnPHRyPidcbiAgICAgICsgJzx0ZD4nICsgd29yZCArICc8L3RkPidcbiAgICAgICsgJzx0ZD4nICsgdDAgKyAnPC90ZD4nXG4gICAgICArICc8dGQ+JyArIHQxICsgJzwvdGQ+J1xuICAgICAgKyAnPHRkPicgKyBkaXNwbGF5Q29uZmlkZW5jZSArICc8L3RkPidcbiAgICAgICsgJzwvdHI+J1xuICAgICAgKTtcbn1cblxudmFyIHNob3dNZXRhRGF0YSA9IGZ1bmN0aW9uKGFsdGVybmF0aXZlKSB7XG4gICQoJyNtZXRhZGF0YVRhYmxlID4gdGJvZHknKS5lbXB0eSgpO1xuICB2YXIgY29uZmlkZW5jZU5lc3RlZEFycmF5ID0gYWx0ZXJuYXRpdmUud29yZF9jb25maWRlbmNlOztcbiAgdmFyIHRpbWVzdGFtcE5lc3RlZEFycmF5ID0gYWx0ZXJuYXRpdmUudGltZXN0YW1wcztcbiAgaWYgKGNvbmZpZGVuY2VOZXN0ZWRBcnJheSAmJiBjb25maWRlbmNlTmVzdGVkQXJyYXkubGVuZ3RoID4gMCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29uZmlkZW5jZU5lc3RlZEFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgdGltZXN0YW1wcyA9IHRpbWVzdGFtcE5lc3RlZEFycmF5W2ldO1xuICAgICAgdmFyIGNvbmZpZGVuY2VzID0gY29uZmlkZW5jZU5lc3RlZEFycmF5W2ldO1xuICAgICAgc2hvd1RpbWVzdGFtcCh0aW1lc3RhbXBzLCBjb25maWRlbmNlcyk7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfSBlbHNlIHtcbiAgICBpZiAodGltZXN0YW1wTmVzdGVkQXJyYXkgJiYgdGltZXN0YW1wTmVzdGVkQXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgY29uc29sZS5sb2coJ1NIT1dJTkcgVElNRVNUQU1QUycpO1xuICAgICAgdGltZXN0YW1wTmVzdGVkQXJyYXkuZm9yRWFjaChmdW5jdGlvbih0aW1lc3RhbXApIHtcbiAgICAgICAgc2hvd1RpbWVzdGFtcCh0aW1lc3RhbXApO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5cbnZhciBzaG93QWx0ZXJuYXRpdmVzID0gZnVuY3Rpb24oYWx0ZXJuYXRpdmVzKSB7XG4gIHZhciAkaHlwb3RoZXNlcyA9ICQoJy5oeXBvdGhlc2VzIHVsJyk7XG4gIGFsdGVybmF0aXZlcy5mb3JFYWNoKGZ1bmN0aW9uKGFsdGVybmF0aXZlLCBpZHgpIHtcbiAgICAkaHlwb3RoZXNlcy5hcHBlbmQoJzxsaSBkYXRhLWh5cG90aGVzaXMtaW5kZXg9JyArIGlkeCArICcgPicgKyBhbHRlcm5hdGl2ZS50cmFuc2NyaXB0ICsgJzwvbGk+Jyk7XG4gIH0pO1xuICAkaHlwb3RoZXNlcy5vbignY2xpY2snLCBcImxpXCIsIGZ1bmN0aW9uIChhbHRlcm5hdGl2ZXMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBjb25zb2xlLmxvZyhcInNob3dpbmcgbWV0YWRhdGFcIik7XG4gICAgICB2YXIgaWR4ID0gKyAkKHRoaXMpLmRhdGEoJ2h5cG90aGVzaXMtaW5kZXgnKTtcbiAgICAgIHZhciBhbHRlcm5hdGl2ZSA9IGFsdGVybmF0aXZlc1tpZHhdO1xuICAgICAgc2hvd01ldGFEYXRhKGFsdGVybmF0aXZlKTtcbiAgICB9XG4gIH0pO1xufVxuXG4vLyBUT0RPOiBDb252ZXJ0IHRvIGNsb3N1cmUgYXBwcm9hY2hcbnZhciBwcm9jZXNzU3RyaW5nID0gZnVuY3Rpb24oYmFzZVN0cmluZywgaXNGaW5pc2hlZCkge1xuXG4gIGlmIChpc0ZpbmlzaGVkKSB7XG4gICAgdmFyIGZvcm1hdHRlZFN0cmluZyA9IGJhc2VTdHJpbmcuc2xpY2UoMCwgLTEpO1xuICAgIGZvcm1hdHRlZFN0cmluZyA9IGZvcm1hdHRlZFN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIGZvcm1hdHRlZFN0cmluZy5zdWJzdHJpbmcoMSk7XG4gICAgZm9ybWF0dGVkU3RyaW5nID0gZm9ybWF0dGVkU3RyaW5nLnRyaW0oKSArICcuJztcbiAgICBjb25zb2xlLmxvZygnZm9ybWF0dGVkIGZpbmFsIHJlczonLCBmb3JtYXR0ZWRTdHJpbmcpO1xuICAgICQoJyNyZXN1bHRzVGV4dCcpLnZhbChmb3JtYXR0ZWRTdHJpbmcpO1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUubG9nKCdpbnRlcmltUmVzdWx0IHJlczonLCBiYXNlU3RyaW5nKTtcbiAgICAkKCcjcmVzdWx0c1RleHQnKS52YWwoYmFzZVN0cmluZyk7XG4gIH1cblxufVxuXG5leHBvcnRzLnNob3dKU09OID0gZnVuY3Rpb24obXNnLCBiYXNlSlNPTikge1xuICB2YXIganNvbiA9IEpTT04uc3RyaW5naWZ5KG1zZywgbnVsbCwgMik7XG4gIGJhc2VKU09OICs9IGpzb247XG4gIGJhc2VKU09OICs9ICdcXG4nO1xuICAkKCcjcmVzdWx0c0pTT04nKS52YWwoYmFzZUpTT04pO1xuICByZXR1cm4gYmFzZUpTT047XG59XG5cbmV4cG9ydHMuc2hvd1Jlc3VsdCA9IGZ1bmN0aW9uKG1zZywgYmFzZVN0cmluZywgY2FsbGJhY2spIHtcblxuICB2YXIgaWR4ID0gK21zZy5yZXN1bHRfaW5kZXg7XG5cbiAgaWYgKG1zZy5yZXN1bHRzICYmIG1zZy5yZXN1bHRzLmxlbmd0aCA+IDApIHtcblxuICAgIHZhciBhbHRlcm5hdGl2ZXMgPSBtc2cucmVzdWx0c1swXS5hbHRlcm5hdGl2ZXM7XG4gICAgdmFyIHRleHQgPSBtc2cucmVzdWx0c1swXS5hbHRlcm5hdGl2ZXNbMF0udHJhbnNjcmlwdCB8fCAnJztcblxuICAgIHNob3dNZXRhRGF0YShhbHRlcm5hdGl2ZXNbMF0pO1xuICAgIC8vQ2FwaXRhbGl6ZSBmaXJzdCB3b3JkXG4gICAgLy8gaWYgZmluYWwgcmVzdWx0cywgYXBwZW5kIGEgbmV3IHBhcmFncmFwaFxuICAgIGlmIChtc2cucmVzdWx0cyAmJiBtc2cucmVzdWx0c1swXSAmJiBtc2cucmVzdWx0c1swXS5maW5hbCkge1xuICAgICAgYmFzZVN0cmluZyArPSB0ZXh0O1xuICAgICAgdmFyIGRpc3BsYXlGaW5hbFN0cmluZyA9IGJhc2VTdHJpbmc7XG4gICAgICBkaXNwbGF5RmluYWxTdHJpbmcgPSBkaXNwbGF5RmluYWxTdHJpbmcucmVwbGFjZSgvJUhFU0lUQVRJT05cXHMvZywgJycpO1xuICAgICAgZGlzcGxheUZpbmFsU3RyaW5nID0gZGlzcGxheUZpbmFsU3RyaW5nLnJlcGxhY2UoL14oKG4pXFwzKykkL2csICcnKTtcbiAgICAgIHByb2Nlc3NTdHJpbmcoZGlzcGxheUZpbmFsU3RyaW5nLCB0cnVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHRlbXBTdHJpbmcgPSBiYXNlU3RyaW5nICsgdGV4dDtcbiAgICAgIHRlbXBTdHJpbmcgPSB0ZW1wU3RyaW5nLnJlcGxhY2UoLyVIRVNJVEFUSU9OXFxzL2csICcnKTtcbiAgICAgIHRlbXBTdHJpbmcgPSB0ZW1wU3RyaW5nLnJlcGxhY2UoL14oKG4pXFwzKykkL2csICcnKTtcbiAgICAgIHByb2Nlc3NTdHJpbmcodGVtcFN0cmluZywgZmFsc2UpO1xuICAgIH1cbiAgfVxuICBpZiAoYWx0ZXJuYXRpdmVzKSB7XG4gICAgc2hvd0FsdGVybmF0aXZlcyhhbHRlcm5hdGl2ZXMpO1xuICB9XG5cbiAgcmV0dXJuIGJhc2VTdHJpbmc7XG5cbn07XG4iLCJcbid1c2Ugc3RyaWN0JztcblxudmFyIGhhbmRsZVNlbGVjdGVkRmlsZSA9IHJlcXVpcmUoJy4vaGFuZGxlZmlsZScpLmhhbmRsZVNlbGVjdGVkRmlsZTtcblxuZXhwb3J0cy5pbml0RHJhZ0Ryb3AgPSBmdW5jdGlvbihjdHgpIHtcblxuICB2YXIgZHJhZ0FuZERyb3BUYXJnZXQgPSAkKGRvY3VtZW50KTtcblxuICBkcmFnQW5kRHJvcFRhcmdldC5vbignZHJhZ2VudGVyJywgZnVuY3Rpb24gKGUpIHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgfSk7XG5cbiAgZHJhZ0FuZERyb3BUYXJnZXQub24oJ2RyYWdvdmVyJywgZnVuY3Rpb24gKGUpIHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgfSk7XG5cbiAgZHJhZ0FuZERyb3BUYXJnZXQub24oJ2Ryb3AnLCBmdW5jdGlvbiAoZSkge1xuICAgIGNvbnNvbGUubG9nKCdGaWxlIGRyb3BwZWQnKTtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgdmFyIGV2dCA9IGUub3JpZ2luYWxFdmVudDtcbiAgICAvLyBIYW5kbGUgZHJhZ2dlZCBmaWxlIGV2ZW50XG4gICAgaGFuZGxlRmlsZVVwbG9hZEV2ZW50KGV2dCk7XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIGhhbmRsZUZpbGVVcGxvYWRFdmVudChldnQpIHtcbiAgICAvLyBJbml0IGZpbGUgdXBsb2FkIHdpdGggZGVmYXVsdCBtb2RlbFxuICAgIHZhciBmaWxlID0gZXZ0LmRhdGFUcmFuc2Zlci5maWxlc1swXTtcbiAgICBoYW5kbGVTZWxlY3RlZEZpbGUoY3R4LnRva2VuLCBmaWxlKTtcbiAgfVxuXG59XG4iLCJcblxuXG5leHBvcnRzLmZsYXNoU1ZHID0gZnVuY3Rpb24oZWwpIHtcbiAgZWwuY3NzKHsgZmlsbDogJyNBNTM3MjUnIH0pO1xuICBmdW5jdGlvbiBsb29wKCkge1xuICAgIGVsLmFuaW1hdGUoeyBmaWxsOiAnI0E1MzcyNScgfSxcbiAgICAgICAgMTAwMCwgJ2xpbmVhcicpXG4gICAgICAuYW5pbWF0ZSh7IGZpbGw6ICd3aGl0ZScgfSxcbiAgICAgICAgICAxMDAwLCAnbGluZWFyJyk7XG4gIH1cbiAgLy8gcmV0dXJuIHRpbWVyXG4gIHZhciB0aW1lciA9IHNldFRpbWVvdXQobG9vcCwgMjAwMCk7XG4gIHJldHVybiB0aW1lcjtcbn07XG5cbmV4cG9ydHMuc3RvcEZsYXNoU1ZHID0gZnVuY3Rpb24odGltZXIpIHtcbiAgZWwuY3NzKHsgZmlsbDogJ3doaXRlJyB9ICk7XG4gIGNsZWFySW50ZXJ2YWwodGltZXIpO1xufVxuXG5leHBvcnRzLnRvZ2dsZUltYWdlID0gZnVuY3Rpb24oZWwsIG5hbWUpIHtcbiAgaWYoZWwuYXR0cignc3JjJykgPT09ICdpbWcvJyArIG5hbWUgKyAnLnN2ZycpIHtcbiAgICBlbC5hdHRyKFwic3JjXCIsICdpbWcvc3RvcC1yZWQuc3ZnJyk7XG4gIH0gZWxzZSB7XG4gICAgZWwuYXR0cignc3JjJywgJ2ltZy9zdG9wLnN2ZycpO1xuICB9XG59XG5cbnZhciByZXN0b3JlSW1hZ2UgPSBleHBvcnRzLnJlc3RvcmVJbWFnZSA9IGZ1bmN0aW9uKGVsLCBuYW1lKSB7XG4gIGVsLmF0dHIoJ3NyYycsICdpbWcvJyArIG5hbWUgKyAnLnN2ZycpO1xufVxuXG5leHBvcnRzLnN0b3BUb2dnbGVJbWFnZSA9IGZ1bmN0aW9uKHRpbWVyLCBlbCwgbmFtZSkge1xuICBjbGVhckludGVydmFsKHRpbWVyKTtcbiAgcmVzdG9yZUltYWdlKGVsLCBuYW1lKTtcbn1cblxuIiwiXG4ndXNlIHN0cmljdCc7XG5cbnZhciBzaG93RXJyb3IgPSByZXF1aXJlKCcuL3Nob3dlcnJvcicpLnNob3dFcnJvcjtcbnZhciBoaWRlRXJyb3IgPSByZXF1aXJlKCcuL3Nob3dlcnJvcicpLmhpZGVFcnJvcjtcbnZhciBoYW5kbGVGaWxlVXBsb2FkID0gcmVxdWlyZSgnLi4vZmlsZXVwbG9hZCcpLmhhbmRsZUZpbGVVcGxvYWQ7XG52YXIgZWZmZWN0cyA9IHJlcXVpcmUoJy4vZWZmZWN0cycpO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKTtcblxuZXhwb3J0cy5oYW5kbGVTZWxlY3RlZEZpbGUgPSBmdW5jdGlvbih0b2tlbiwgZmlsZSkge1xuXG4gIHZhciBjdXJyZW50bHlEaXNwbGF5aW5nID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycpKTtcblxuICBpZiAoY3VycmVudGx5RGlzcGxheWluZykge1xuICAgIHNob3dFcnJvcignVHJhbnNjcmlwdGlvbiB1bmRlcndheSwgcGxlYXNlIGNsaWNrIHN0b3Agb3Igd2FpdCB1bnRpbCBmaW5pc2hlZCB0byB1cGxvYWQgYW5vdGhlciBmaWxlJyk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgJC5wdWJsaXNoKCdjbGVhcnNjcmVlbicpO1xuXG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgdHJ1ZSk7XG4gIGhpZGVFcnJvcigpO1xuXG4gIC8vIFZpc3VhbCBlZmZlY3RzXG4gIHZhciB1cGxvYWRJbWFnZVRhZyA9ICQoJyNmaWxlVXBsb2FkVGFyZ2V0ID4gaW1nJyk7XG4gIHZhciB0aW1lciA9IHNldEludGVydmFsKGVmZmVjdHMudG9nZ2xlSW1hZ2UsIDc1MCwgdXBsb2FkSW1hZ2VUYWcsICdzdG9wJyk7XG4gIHZhciB1cGxvYWRUZXh0ID0gJCgnI2ZpbGVVcGxvYWRUYXJnZXQgPiBzcGFuJyk7XG4gIHVwbG9hZFRleHQudGV4dCgnU3RvcCBUcmFuc2NyaWJpbmcnKTtcblxuICBmdW5jdGlvbiByZXN0b3JlVXBsb2FkVGFiKCkge1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgIGNsZWFySW50ZXJ2YWwodGltZXIpO1xuICAgIGVmZmVjdHMucmVzdG9yZUltYWdlKHVwbG9hZEltYWdlVGFnLCAndXBsb2FkJyk7XG4gICAgdXBsb2FkVGV4dC50ZXh0KCdTZWxlY3QgRmlsZScpO1xuICB9XG5cbiAgLy8gQ2xlYXIgZmxhc2hpbmcgaWYgc29ja2V0IHVwbG9hZCBpcyBzdG9wcGVkXG4gICQuc3Vic2NyaWJlKCdzb2NrZXRzdG9wJywgZnVuY3Rpb24oZGF0YSkge1xuICAgIHJlc3RvcmVVcGxvYWRUYWIoKTtcbiAgfSk7XG5cblxuICAvLyBHZXQgY3VycmVudCBtb2RlbFxuICB2YXIgY3VycmVudE1vZGVsID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRNb2RlbCcpO1xuICBjb25zb2xlLmxvZygnY3VycmVudE1vZGVsJywgY3VycmVudE1vZGVsKTtcblxuICAvLyBSZWFkIGZpcnN0IDQgYnl0ZXMgdG8gZGV0ZXJtaW5lIGhlYWRlclxuICB2YXIgYmxvYlRvVGV4dCA9IG5ldyBCbG9iKFtmaWxlXSkuc2xpY2UoMCwgNCk7XG4gIHZhciByID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgci5yZWFkQXNUZXh0KGJsb2JUb1RleHQpO1xuICByLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjb250ZW50VHlwZTtcbiAgICBpZiAoci5yZXN1bHQgPT09ICdmTGFDJykge1xuICAgICAgY29udGVudFR5cGUgPSAnYXVkaW8vZmxhYyc7XG4gICAgfSBlbHNlIGlmIChyLnJlc3VsdCA9PT0gJ1JJRkYnKSB7XG4gICAgICBjb250ZW50VHlwZSA9ICdhdWRpby93YXYnO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN0b3JlVXBsb2FkVGFiKCk7XG4gICAgICBzaG93RXJyb3IoJ09ubHkgV0FWIG9yIEZMQUMgZmlsZXMgY2FuIGJlIHRyYW5zY3JpYmVkLCBwbGVhc2UgdHJ5IGFub3RoZXIgZmlsZSBmb3JtYXQnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc29sZS5sb2coJ1VwbG9hZGluZyBmaWxlJywgci5yZXN1bHQpO1xuICAgIGhhbmRsZUZpbGVVcGxvYWQodG9rZW4sIGN1cnJlbnRNb2RlbCwgZmlsZSwgY29udGVudFR5cGUsIGZ1bmN0aW9uKHNvY2tldCkge1xuICAgICAgY29uc29sZS5sb2coJ3JlYWRpbmcgZmlsZScpO1xuXG4gICAgICB2YXIgYmxvYiA9IG5ldyBCbG9iKFtmaWxlXSk7XG4gICAgICB2YXIgcGFyc2VPcHRpb25zID0ge1xuICAgICAgICBmaWxlOiBibG9iXG4gICAgICB9O1xuICAgICAgdXRpbHMub25GaWxlUHJvZ3Jlc3MocGFyc2VPcHRpb25zLFxuICAgICAgICAvLyBPbiBkYXRhIGNodW5rXG4gICAgICAgIGZ1bmN0aW9uKGNodW5rKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ0hhbmRsaW5nIGNodW5rJywgY2h1bmspO1xuICAgICAgICAgIHNvY2tldC5zZW5kKGNodW5rKTtcbiAgICAgICAgfSxcbiAgICAgICAgLy8gT24gZmlsZSByZWFkIGVycm9yXG4gICAgICAgIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdFcnJvciByZWFkaW5nIGZpbGU6ICcsIGV2dC5tZXNzYWdlKTtcbiAgICAgICAgICBzaG93RXJyb3IoZXZ0Lm1lc3NhZ2UpO1xuICAgICAgICB9LFxuICAgICAgICAvLyBPbiBsb2FkIGVuZFxuICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7J2FjdGlvbic6ICdzdG9wJ30pKTtcbiAgICAgICAgfSk7XG4gICAgfSwgXG4gICAgICBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgZWZmZWN0cy5zdG9wVG9nZ2xlSW1hZ2UodGltZXIsIHVwbG9hZEltYWdlVGFnLCAndXBsb2FkJyk7XG4gICAgICAgIHVwbG9hZFRleHQudGV4dCgnU2VsZWN0IEZpbGUnKTtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG4gICAgICB9XG4gICAgKTtcbiAgfTtcbn1cblxuIiwiXG52YXIgaW5pdFNlc3Npb25QZXJtaXNzaW9ucyA9IHJlcXVpcmUoJy4vc2Vzc2lvbnBlcm1pc3Npb25zJykuaW5pdFNlc3Npb25QZXJtaXNzaW9ucztcbnZhciBpbml0U2VsZWN0TW9kZWwgPSByZXF1aXJlKCcuL3NlbGVjdG1vZGVsJykuaW5pdFNlbGVjdE1vZGVsO1xudmFyIGluaXRBbmltYXRlUGFuZWwgPSByZXF1aXJlKCcuL2FuaW1hdGVwYW5lbCcpLmluaXRBbmltYXRlUGFuZWw7XG52YXIgaW5pdFNob3dUYWIgPSByZXF1aXJlKCcuL3Nob3d0YWInKS5pbml0U2hvd1RhYjtcbnZhciBpbml0RHJhZ0Ryb3AgPSByZXF1aXJlKCcuL2RyYWdkcm9wJykuaW5pdERyYWdEcm9wO1xudmFyIGluaXRQbGF5U2FtcGxlID0gcmVxdWlyZSgnLi9wbGF5c2FtcGxlJykuaW5pdFBsYXlTYW1wbGU7XG52YXIgaW5pdFJlY29yZEJ1dHRvbiA9IHJlcXVpcmUoJy4vcmVjb3JkYnV0dG9uJykuaW5pdFJlY29yZEJ1dHRvbjtcblxuXG5leHBvcnRzLmluaXRWaWV3cyA9IGZ1bmN0aW9uKGN0eCkge1xuICBjb25zb2xlLmxvZygnSW5pdGlhbGl6aW5nIHZpZXdzLi4uJyk7XG4gIGluaXRTZWxlY3RNb2RlbChjdHgpO1xuICBpbml0UGxheVNhbXBsZShjdHgpO1xuICBpbml0RHJhZ0Ryb3AoY3R4KTtcbiAgaW5pdFJlY29yZEJ1dHRvbihjdHgpO1xuICBpbml0U2Vzc2lvblBlcm1pc3Npb25zKCk7XG4gIGluaXRTaG93VGFiKCk7XG4gIGluaXRBbmltYXRlUGFuZWwoKTtcbiAgaW5pdFNob3dUYWIoKTtcbn1cbiIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xudmFyIG9uRmlsZVByb2dyZXNzID0gdXRpbHMub25GaWxlUHJvZ3Jlc3M7XG52YXIgaGFuZGxlRmlsZVVwbG9hZCA9IHJlcXVpcmUoJy4uL2ZpbGV1cGxvYWQnKS5oYW5kbGVGaWxlVXBsb2FkO1xudmFyIGluaXRTb2NrZXQgPSByZXF1aXJlKCcuLi9zb2NrZXQnKS5pbml0U29ja2V0O1xudmFyIHNob3dFcnJvciA9IHJlcXVpcmUoJy4vc2hvd2Vycm9yJykuc2hvd0Vycm9yO1xudmFyIGVmZmVjdHMgPSByZXF1aXJlKCcuL2VmZmVjdHMnKTtcblxuXG52YXIgcGxheVNhbXBsZSA9IGZ1bmN0aW9uKHRva2VuLCBpbWFnZVRhZywgaWNvbk5hbWUsIHVybCwgY2FsbGJhY2spIHtcblxuICB2YXIgY3VycmVudGx5RGlzcGxheWluZyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnKSk7XG5cbiAgaWYgKGN1cnJlbnRseURpc3BsYXlpbmcpIHtcbiAgICBzaG93RXJyb3IoJ0N1cnJlbnRseSBkaXNwbGF5aW5nIGFub3RoZXIgZmlsZSwgcGxlYXNlIHdhaXQgdW50aWwgY29tcGxldGUnKTtcbiAgICByZXR1cm47XG4gIH1cblxuICAkLnB1Ymxpc2goJ2NsZWFyc2NyZWVuJyk7XG5cbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCB0cnVlKTtcblxuICB2YXIgdGltZXIgPSBzZXRJbnRlcnZhbChlZmZlY3RzLnRvZ2dsZUltYWdlLCA3NTAsIGltYWdlVGFnLCBpY29uTmFtZSk7XG5cbiAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICB4aHIub3BlbignR0VUJywgdXJsLCB0cnVlKTtcbiAgeGhyLnJlc3BvbnNlVHlwZSA9ICdibG9iJztcbiAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uKGUpIHtcbiAgICB2YXIgYmxvYiA9IHhoci5yZXNwb25zZTtcbiAgICB2YXIgY3VycmVudE1vZGVsID0gJ2VuLVVTX0Jyb2FkYmFuZE1vZGVsJztcbiAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICB2YXIgYmxvYlRvVGV4dCA9IG5ldyBCbG9iKFtibG9iXSkuc2xpY2UoMCwgNCk7XG4gICAgcmVhZGVyLnJlYWRBc1RleHQoYmxvYlRvVGV4dCk7XG4gICAgcmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGNvbnRlbnRUeXBlID0gcmVhZGVyLnJlc3VsdCA9PT0gJ2ZMYUMnID8gJ2F1ZGlvL2ZsYWMnIDogJ2F1ZGlvL3dhdic7XG4gICAgICBjb25zb2xlLmxvZygnVXBsb2FkaW5nIGZpbGUnLCByZWFkZXIucmVzdWx0KTtcbiAgICAgIHZhciBtZWRpYVNvdXJjZVVSTCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XG4gICAgICB2YXIgYXVkaW8gPSBuZXcgQXVkaW8oKTtcbiAgICAgIGF1ZGlvLnNyYyA9IG1lZGlhU291cmNlVVJMO1xuICAgICAgYXVkaW8ucGxheSgpO1xuICAgICAgaGFuZGxlRmlsZVVwbG9hZCh0b2tlbiwgY3VycmVudE1vZGVsLCBibG9iLCBjb250ZW50VHlwZSwgZnVuY3Rpb24oc29ja2V0KSB7XG4gICAgICAgIHZhciBwYXJzZU9wdGlvbnMgPSB7XG4gICAgICAgICAgZmlsZTogYmxvYlxuICAgICAgICB9O1xuICAgICAgICBvbkZpbGVQcm9ncmVzcyhwYXJzZU9wdGlvbnMsXG4gICAgICAgICAgLy8gT24gZGF0YSBjaHVua1xuICAgICAgICAgIGZ1bmN0aW9uKGNodW5rKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnSGFuZGxpbmcgY2h1bmsnLCBjaHVuayk7XG4gICAgICAgICAgICBzb2NrZXQuc2VuZChjaHVuayk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICAvLyBPbiBmaWxlIHJlYWQgZXJyb3JcbiAgICAgICAgICBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdFcnJvciByZWFkaW5nIGZpbGU6ICcsIGV2dC5tZXNzYWdlKTtcbiAgICAgICAgICAgIHNob3dFcnJvcihldnQubWVzc2FnZSk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICAvLyBPbiBsb2FkIGVuZFxuICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoeydhY3Rpb24nOiAnc3RvcCd9KSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgfSwgXG4gICAgICAgICAgLy8gT24gY29ubmVjdGlvbiBlbmRcbiAgICAgICAgICBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgICAgIGVmZmVjdHMuc3RvcFRvZ2dsZUltYWdlKHRpbWVyLCBpbWFnZVRhZywgaWNvbk5hbWUpO1xuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG4gICAgICAgICAgfVxuICAgICAgKTtcbiAgICB9O1xuICB9O1xuICB4aHIuc2VuZCgpO1xufTtcblxuXG5leHBvcnRzLmluaXRQbGF5U2FtcGxlID0gZnVuY3Rpb24oY3R4KSB7XG5cbiAgKGZ1bmN0aW9uKCkge1xuICAgIHZhciBlbCA9ICQoJy5wbGF5LXNhbXBsZS0xJyk7XG4gICAgdmFyIGljb25OYW1lID0gJ3BsYXknO1xuICAgIHZhciBpbWFnZVRhZyA9IGVsLmZpbmQoJ2ltZycpO1xuICAgIHZhciBmaWxlTmFtZSA9ICdhdWRpby9zYW1wbGUxLndhdic7XG4gICAgZWwuY2xpY2soIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgY29uc29sZS5sb2coJ0NMSUNLIScpO1xuICAgICAgcGxheVNhbXBsZShjdHgudG9rZW4sIGltYWdlVGFnLCBpY29uTmFtZSwgZmlsZU5hbWUsIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBjb25zb2xlLmxvZygnUGxheSBzYW1wbGUgcmVzdWx0JywgcmVzdWx0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KShjdHgpO1xuXG4gIChmdW5jdGlvbigpIHtcbiAgICB2YXIgZWwgPSAkKCcucGxheS1zYW1wbGUtMicpO1xuICAgIHZhciBpY29uTmFtZSA9ICdwbGF5JztcbiAgICB2YXIgaW1hZ2VUYWcgPSBlbC5maW5kKCdpbWcnKTtcbiAgICB2YXIgZmlsZU5hbWUgPSAnYXVkaW8vc2FtcGxlMi53YXYnO1xuICAgIGVsLmNsaWNrKCBmdW5jdGlvbihldnQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdDTElDSyEnKTtcbiAgICAgIHBsYXlTYW1wbGUoY3R4LnRva2VuLCBpbWFnZVRhZywgaWNvbk5hbWUsIGZpbGVOYW1lLCBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1BsYXkgc2FtcGxlIHJlc3VsdCcsIHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSkoY3R4KTtcblxufTtcblxuIiwiXG4ndXNlIHN0cmljdCc7XG5cbnZhciBNaWNyb3Bob25lID0gcmVxdWlyZSgnLi4vTWljcm9waG9uZScpO1xudmFyIGhhbmRsZU1pY3JvcGhvbmUgPSByZXF1aXJlKCcuLi9oYW5kbGVtaWNyb3Bob25lJykuaGFuZGxlTWljcm9waG9uZTtcblxuZXhwb3J0cy5pbml0UmVjb3JkQnV0dG9uID0gZnVuY3Rpb24oY3R4KSB7XG5cbiAgdmFyIHJlY29yZEJ1dHRvbiA9ICQoJyNyZWNvcmRCdXR0b24nKTtcblxuICByZWNvcmRCdXR0b24uY2xpY2soKGZ1bmN0aW9uKCkge1xuXG4gICAgdmFyIHJ1bm5pbmcgPSBmYWxzZTtcbiAgICB2YXIgdG9rZW4gPSBjdHgudG9rZW47XG4gICAgdmFyIG1pY09wdGlvbnMgPSB7XG4gICAgICBidWZmZXJTaXplOiBjdHguYnVmZmVyc2l6ZVxuICAgIH07XG4gICAgdmFyIG1pYyA9IG5ldyBNaWNyb3Bob25lKG1pY09wdGlvbnMpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgLy8gUHJldmVudCBkZWZhdWx0IGFuY2hvciBiZWhhdmlvclxuICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgIHZhciBjdXJyZW50TW9kZWwgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudE1vZGVsJyk7XG5cbiAgICAgIGNvbnNvbGUubG9nKCdydW5uaW5nIHN0YXRlJywgcnVubmluZyk7XG5cbiAgICAgIGlmICghcnVubmluZykge1xuICAgICAgICBjb25zb2xlLmxvZygnTm90IHJ1bm5pbmcsIGhhbmRsZU1pY3JvcGhvbmUoKScpO1xuICAgICAgICBoYW5kbGVNaWNyb3Bob25lKHRva2VuLCBjdXJyZW50TW9kZWwsIG1pYywgZnVuY3Rpb24oZXJyLCBzb2NrZXQpIHtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICB2YXIgbXNnID0gZXJyLm1lc3NhZ2U7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnRXJyb3I6ICcsIG1zZyk7XG4gICAgICAgICAgICBzaG93RXJyb3IobXNnKTtcbiAgICAgICAgICAgIHJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVjb3JkQnV0dG9uLmNzcygnYmFja2dyb3VuZC1jb2xvcicsICcjZDc0MTA4Jyk7XG4gICAgICAgICAgICByZWNvcmRCdXR0b24uZmluZCgnaW1nJykuYXR0cignc3JjJywgJ2ltZy9zdG9wLnN2ZycpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ3N0YXJ0aW5nIG1pYycpO1xuICAgICAgICAgICAgbWljLnJlY29yZCgpO1xuICAgICAgICAgICAgcnVubmluZyA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdTdG9wcGluZyBtaWNyb3Bob25lLCBzZW5kaW5nIHN0b3AgYWN0aW9uIG1lc3NhZ2UnKTtcbiAgICAgICAgcmVjb3JkQnV0dG9uLnJlbW92ZUF0dHIoJ3N0eWxlJyk7XG4gICAgICAgIHJlY29yZEJ1dHRvbi5maW5kKCdpbWcnKS5hdHRyKCdzcmMnLCAnaW1nL21pY3JvcGhvbmUuc3ZnJyk7XG4gICAgICAgICQucHVibGlzaCgnc29ja2V0c3RvcCcpO1xuICAgICAgICBtaWMuc3RvcCgpO1xuICAgICAgICBydW5uaW5nID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICB9KSgpKTtcbn1cbiIsIlxuZXhwb3J0cy5pbml0U2VsZWN0TW9kZWwgPSBmdW5jdGlvbihjdHgpIHtcblxuICBmdW5jdGlvbiBpc0RlZmF1bHQobW9kZWwpIHtcbiAgICByZXR1cm4gbW9kZWwgPT09ICdlbi1VU19Ccm9hZGJhbmRNb2RlbCc7XG4gIH1cblxuICBjdHgubW9kZWxzLmZvckVhY2goZnVuY3Rpb24obW9kZWwpIHtcbiAgICAkKFwic2VsZWN0I2Ryb3Bkb3duTWVudTFcIikuYXBwZW5kKCAkKFwiPG9wdGlvbj5cIilcbiAgICAgIC52YWwobW9kZWwubmFtZSlcbiAgICAgIC5odG1sKG1vZGVsLmRlc2NyaXB0aW9uKVxuICAgICAgLnByb3AoJ3NlbGVjdGVkJywgaXNEZWZhdWx0KG1vZGVsLm5hbWUpKVxuICAgICAgKTtcbiAgfSk7XG5cbiAgJChcInNlbGVjdCNkcm9wZG93bk1lbnUxXCIpLmNoYW5nZShmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgbW9kZWxOYW1lID0gJChcInNlbGVjdCNkcm9wZG93bk1lbnUxXCIpLnZhbCgpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50TW9kZWwnLCBtb2RlbE5hbWUpO1xuICB9KTtcblxufVxuIiwiXG4ndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuaW5pdFNlc3Npb25QZXJtaXNzaW9ucyA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnSW5pdGlhbGl6aW5nIHNlc3Npb24gcGVybWlzc2lvbnMgaGFuZGxlcicpO1xuICAvLyBSYWRpbyBidXR0b25zXG4gIHZhciBzZXNzaW9uUGVybWlzc2lvbnNSYWRpbyA9ICQoXCIjc2Vzc2lvblBlcm1pc3Npb25zUmFkaW9Hcm91cCBpbnB1dFt0eXBlPSdyYWRpbyddXCIpO1xuICBzZXNzaW9uUGVybWlzc2lvbnNSYWRpby5jbGljayhmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgY2hlY2tlZFZhbHVlID0gc2Vzc2lvblBlcm1pc3Npb25zUmFkaW8uZmlsdGVyKCc6Y2hlY2tlZCcpLnZhbCgpO1xuICAgIGNvbnNvbGUubG9nKCdjaGVja2VkVmFsdWUnLCBjaGVja2VkVmFsdWUpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzZXNzaW9uUGVybWlzc2lvbnMnLCBjaGVja2VkVmFsdWUpO1xuICB9KTtcbn1cbiIsIlxuXG5leHBvcnRzLnNob3dFcnJvciA9IGZ1bmN0aW9uKG1zZykge1xuICBjb25zb2xlLmxvZygnc2hvd2luZyBlcnJvcicpO1xuICB2YXIgZXJyb3JBbGVydCA9ICQoJy5lcnJvci1yb3cnKTtcbiAgZXJyb3JBbGVydC5oaWRlKCk7XG4gIHZhciBlcnJvck1lc3NhZ2UgPSAkKCcjZXJyb3JNZXNzYWdlJyk7XG4gIGVycm9yTWVzc2FnZS50ZXh0KG1zZyk7XG4gIGVycm9yQWxlcnQuc2hvdygpO1xuICAkKCcjZXJyb3JDbG9zZScpLmNsaWNrKGZ1bmN0aW9uKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXJyb3JBbGVydC5oaWRlKCk7XG4gIH0pO1xufVxuXG5leHBvcnRzLmhpZGVFcnJvciA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZXJyb3JBbGVydCA9ICQoJy5lcnJvci1yb3cnKTtcbiAgZXJyb3JBbGVydC5oaWRlKCk7XG59XG4iLCJcblxuZXhwb3J0cy5pbml0U2hvd1RhYiA9IGZ1bmN0aW9uKCkge1xuICAkKCcjbmF2LXRhYnMgYScpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAkKHRoaXMpLnRhYignc2hvdycpXG4gIH0pO1xufVxuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4vKmdsb2JhbCAkOmZhbHNlICovXG5cbid1c2Ugc3RyaWN0JztcblxuLy8gVE9ETzogcmVmYWN0b3IgdGhpcyBpbnRvIG11bHRpcGxlIHNtYWxsZXIgbW9kdWxlc1xuXG52YXIgTWljcm9waG9uZSA9IHJlcXVpcmUoJy4vTWljcm9waG9uZScpO1xudmFyIG1vZGVscyA9IHJlcXVpcmUoJy4vZGF0YS9tb2RlbHMuanNvbicpLm1vZGVscztcbnZhciBpbml0Vmlld3MgPSByZXF1aXJlKCcuL3ZpZXdzJykuaW5pdFZpZXdzO1xudmFyIHNob3dFcnJvciA9IHJlcXVpcmUoJy4vdmlld3Mvc2hvd2Vycm9yJykuc2hvd0Vycm9yO1xudmFyIGhpZGVFcnJvciA9IHJlcXVpcmUoJy4vdmlld3Mvc2hvd2Vycm9yJykuaGlkZUVycm9yO1xudmFyIGluaXRTb2NrZXQgPSByZXF1aXJlKCcuL3NvY2tldCcpLmluaXRTb2NrZXQ7XG52YXIgaGFuZGxlRmlsZVVwbG9hZCA9IHJlcXVpcmUoJy4vZmlsZXVwbG9hZCcpLmhhbmRsZUZpbGVVcGxvYWQ7XG52YXIgaGFuZGxlU2VsZWN0ZWRGaWxlID0gcmVxdWlyZSgnLi92aWV3cy9oYW5kbGVmaWxlJykuaGFuZGxlU2VsZWN0ZWRGaWxlO1xudmFyIGRpc3BsYXkgPSByZXF1aXJlKCcuL3ZpZXdzL2Rpc3BsYXknKTtcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnZhciBlZmZlY3RzID0gcmVxdWlyZSgnLi92aWV3cy9lZmZlY3RzJyk7XG52YXIgcGtnID0gcmVxdWlyZSgnLi4vcGFja2FnZScpO1xuXG52YXIgQlVGRkVSU0laRSA9IDgxOTI7XG5cblxuJChkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKSB7XG5cbiAgLy8gVGVtcG9yYXJ5IGFwcCBkYXRhXG4gICQoJyNhcHBTZXR0aW5ncycpXG4gICAgLmh0bWwoXG4gICAgICAnPHA+VmVyc2lvbjogJyArIHBrZy52ZXJzaW9uICsgJzwvcD4nXG4gICAgICArICc8cD5CdWZmZXIgU2l6ZTogJyArIEJVRkZFUlNJWkUgKyAnPC9wPidcbiAgICApO1xuXG4gIC8vIE1ha2UgY2FsbCB0byBBUEkgdG8gdHJ5IGFuZCBnZXQgdG9rZW5cbiAgdmFyIHVybCA9ICcvdG9rZW4nO1xuICB2YXIgdG9rZW5SZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gIHRva2VuUmVxdWVzdC5vcGVuKFwiR0VUXCIsIHVybCwgdHJ1ZSk7XG4gIHRva2VuUmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbihldnQpIHtcblxuICAgIHdpbmRvdy5vbmJlZm9yZXVubG9hZCA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgIGxvY2FsU3RvcmFnZS5jbGVhcigpO1xuICAgIH07XG5cbiAgICB2YXIgdG9rZW4gPSB0b2tlblJlcXVlc3QucmVzcG9uc2VUZXh0O1xuICAgIGlmICghdG9rZW4pIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIGF1dGhvcml6YXRpb24gdG9rZW4gYXZhaWxhYmxlJyk7XG4gICAgICBjb25zb2xlLmVycm9yKCdBdHRlbXB0aW5nIHRvIHJlY29ubmVjdC4uLicpO1xuICAgIH1cblxuICAgIHZhciBtb2RlbE9wdGlvbnMgPSB7XG4gICAgICB0b2tlbjogdG9rZW5cbiAgICAgICAgLy8gVW5jb21tZW50IGluIGNhc2Ugb2Ygc2VydmVyIENPUlMgZmFpbHVyZVxuICAgICAgICAvLyB1cmw6ICcvYXBpL21vZGVscydcbiAgICB9O1xuXG4gICAgLy8gR2V0IGF2YWlsYWJsZSBzcGVlY2ggcmVjb2duaXRpb24gbW9kZWxzXG4gICAgLy8gU2V0IHRoZW0gaW4gc3RvcmFnZVxuICAgIC8vIEFuZCBkaXNwbGF5IHRoZW0gaW4gZHJvcC1kb3duXG4gICAgY29uc29sZS5sb2coJ1NUVCBNb2RlbHMgJywgbW9kZWxzKTtcblxuICAgIC8vIFNhdmUgbW9kZWxzIHRvIGxvY2Fsc3RvcmFnZVxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtb2RlbHMnLCBKU09OLnN0cmluZ2lmeShtb2RlbHMpKTtcblxuICAgIC8vIFNldCBkZWZhdWx0IGN1cnJlbnQgbW9kZWxcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudE1vZGVsJywgJ2VuLVVTX0Jyb2FkYmFuZE1vZGVsJyk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3Nlc3Npb25QZXJtaXNzaW9ucycsICd0cnVlJyk7XG5cblxuICAgIC8vIElOSVRJQUxJWkFUSU9OXG4gICAgLy8gU2VuZCBtb2RlbHMgYW5kIG90aGVyXG4gICAgLy8gdmlldyBjb250ZXh0IHRvIHZpZXdzXG4gICAgdmFyIHZpZXdDb250ZXh0ID0ge1xuICAgICAgbW9kZWxzOiBtb2RlbHMsXG4gICAgICB0b2tlbjogdG9rZW4sXG4gICAgICBidWZmZXJTaXplOiBCVUZGRVJTSVpFXG4gICAgfTtcbiAgICBpbml0Vmlld3Modmlld0NvbnRleHQpO1xuICAgIHV0aWxzLmluaXRQdWJTdWIoKTtcblxuICAgICQuc3Vic2NyaWJlKCdjbGVhcnNjcmVlbicsIGZ1bmN0aW9uKCkge1xuICAgICAgJCgnI3Jlc3VsdHNUZXh0JykudGV4dCgnJyk7XG4gICAgICAkKCcjcmVzdWx0c0pTT04nKS50ZXh0KCcnKTtcbiAgICAgICQoJy5oeXBvdGhlc2VzID4gdWwnKS5lbXB0eSgpO1xuICAgICAgJCgnI21ldGFkYXRhVGFibGVCb2R5JykuZW1wdHkoKTtcbiAgICB9KTtcblxuICAgIGNvbnNvbGUubG9nKCdzZXR0aW5nIHRhcmdldCcpO1xuXG4gICAgdmFyIGZpbGVVcGxvYWREaWFsb2cgPSAkKFwiI2ZpbGVVcGxvYWREaWFsb2dcIik7XG5cbiAgICBmaWxlVXBsb2FkRGlhbG9nLmNoYW5nZShmdW5jdGlvbihldnQpIHtcbiAgICAgIHZhciBmaWxlID0gZmlsZVVwbG9hZERpYWxvZy5nZXQoMCkuZmlsZXNbMF07XG4gICAgICBjb25zb2xlLmxvZygnZmlsZSB1cGxvYWQhJywgZmlsZSk7XG4gICAgICBoYW5kbGVTZWxlY3RlZEZpbGUodG9rZW4sIGZpbGUpO1xuICAgIH0pO1xuXG4gICAgJChcIiNmaWxlVXBsb2FkVGFyZ2V0XCIpLmNsaWNrKGZ1bmN0aW9uKGV2dCkge1xuICAgICAgdmFyIGN1cnJlbnRseURpc3BsYXlpbmcgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJykpO1xuICAgICAgY29uc29sZS5sb2coJ0NVUlJFTlRMWSBESVNQTEFZSU5HJywgY3VycmVudGx5RGlzcGxheWluZyk7XG4gICAgICBpZiAoY3VycmVudGx5RGlzcGxheWluZykge1xuICAgICAgICAkLnB1Ymxpc2goJ3NvY2tldHN0b3AnKTtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgZmlsZVVwbG9hZERpYWxvZy52YWwobnVsbCk7XG5cbiAgICAgIGZpbGVVcGxvYWREaWFsb2dcbiAgICAgIC50cmlnZ2VyKCdjbGljaycpO1xuXG4gICAgfSk7XG5cblxuICB9XG4gIHRva2VuUmVxdWVzdC5zZW5kKCk7XG5cbn0pO1xuXG4iXX0=
