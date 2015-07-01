(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports={
  "name": "SpeechToTextBrowserStarterApp",
  "version": "0.2.1",
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
    "watch": "watchify -v -d -o public/js/main.js src/index.js"
  },
  "devDependencies": {
    "browserify": "^10.2.4",
    "browserify-shim": "^3.8.9",
    "watchify": "^3.2.3"
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
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/en-US_BroadbandModel", 
         "rate": 16000, 
         "name": "en-US_BroadbandModel", 
         "language": "en-US", 
         "description": "US English broadband model (16KHz)"
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/en-US_NarrowbandModel", 
         "rate": 8000, 
         "name": "en-US_NarrowbandModel", 
         "language": "en-US", 
         "description": "US English narrowband model (8KHz)"
      },
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/es-ES_BroadbandModel", 
         "rate": 16000, 
         "name": "es-ES_BroadbandModel", 
         "language": "es-ES", 
         "description": "Spanish broadband model (16KHz)"
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/es-ES_NarrowbandModel", 
         "rate": 8000, 
         "name": "es-ES_NarrowbandModel", 
         "language": "es-ES", 
         "description": "Spanish narrowband model (8KHz)"
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/ja-JP_BroadbandModel", 
         "rate": 16000, 
         "name": "ja-JP_BroadbandModel", 
         "language": "ja-JP", 
         "description": "Japanese broadband model (16KHz)"
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/ja-JP_NarrowbandModel", 
         "rate": 8000, 
         "name": "ja-JP_NarrowbandModel", 
         "language": "ja-JP", 
         "description": "Japanese narrowband model (8KHz)"
      }
   ]
}

},{}],4:[function(require,module,exports){

var effects = require('./views/effects');
var display = require('./views/displaymetadata');
var hideError = require('./views/showerror').hideError;
var initSocket = require('./socket').initSocket;

exports.handleFileUpload = function(token, model, file, contentType, callback, onend) {

    // Set currentlyDisplaying to prevent other sockets from opening
    localStorage.setItem('currentlyDisplaying', true);

    // $('#progressIndicator').css('visibility', 'visible');

    $.subscribe('progress', function(evt, data) {
      console.log('progress: ', data);
    });

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

},{"./socket":6,"./views/displaymetadata":9,"./views/effects":11,"./views/showerror":18}],5:[function(require,module,exports){

'use strict';

var initSocket = require('./socket').initSocket;
var display = require('./views/displaymetadata');

exports.handleMicrophone = function(token, model, mic, callback) {

  if (model.indexOf('Narrowband') > -1) {
    var err = new Error('Microphone transcription cannot accomodate narrowband models, please select another');
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
    console.log('Mic socket: opened');
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

},{"./socket":6,"./views/displaymetadata":9}],6:[function(require,module,exports){
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

// Initialize closure, which holds maximum getToken call count
var tokenGenerator = utils.createTokenGenerator();

var initSocket = exports.initSocket = function(options, onopen, onlistening, onmessage, onerror, onclose) {
  var listening;
  function withDefault(val, defaultVal) {
    return typeof val === 'undefined' ? defaultVal : val;
  }
  var socket;
  var token = options.token;
  var model = options.model || localStorage.getItem('currentModel');
  var message = options.message || {'action': 'start'};
  var sessionPermissions = withDefault(options.sessionPermissions, JSON.parse(localStorage.getItem('sessionPermissions')));
  var sessionPermissionsQueryParam = sessionPermissions ? '0' : '1';
  var url = options.serviceURI || 'wss://stream.watsonplatform.net/speech-to-text/api/v1/recognize?watson-token='
    + token
    + '&X-WDC-PL-OPT-OUT=' + sessionPermissionsQueryParam
    + '&model=' + model;
  console.log('URL model', model);
  try {
    socket = new WebSocket(url);
  } catch(err) {
    console.error('WS connection error: ', err);
  }
  socket.onopen = function(evt) {
    listening = false;
    $.subscribe('hardsocketstop', function(data) {
      console.log('MICROPHONE: close.');
      socket.send(JSON.stringify({action:'stop'}));
    });
    $.subscribe('socketstop', function(data) {
      console.log('MICROPHONE: close.');
      socket.close();
    });
    socket.send(JSON.stringify(message));
    onopen(socket);
  };
  socket.onmessage = function(evt) {
    var msg = JSON.parse(evt.data);
    if (msg.error) {
      showError(msg.error);
      $.publish('hardsocketstop');
      return;
    }
    if (msg.state === 'listening') {
      // Early cut off, without notification
      if (!listening) {
        onlistening(socket);
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
    $.publish('clearscreen');
    onerror(evt);
  };

  socket.onclose = function(evt) {
    console.log('WS onclose: ', evt);
    if (evt.code === 1006) {
      // Authentication error, try to reconnect
      console.log('generator count', tokenGenerator.getCount());
      if (tokenGenerator.getCount() > 1) {
        $.publish('hardsocketstop');
        throw new Error("No authorization token is currently available");
      }
      tokenGenerator.getToken(function(token, err) {
        if (err) {
          $.publish('hardsocketstop');
          return false;
        }
        console.log('Fetching additional token...');
        options.token = token;
        initSocket(options, onopen, onlistening, onmessage, onerror, onclose);
      });
      return false;
    }
    if (evt.code === 1011) {
      console.error('Server error ' + evt.code + ': please refresh your browser and try again');
      return false;
    }
    if (evt.code > 1000) {
      console.error('Server error ' + evt.code + ': please refresh your browser and try again');
      // showError('Server error ' + evt.code + ': please refresh your browser and try again');
      return false;
    }
    // Made it through, normal close
    $.unsubscribe('hardsocketstop');
    $.unsubscribe('socketstop');
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

exports.createTokenGenerator = function() {
  // Make call to API to try and get token
  var hasBeenRunTimes = 0;
  return {
    getToken: function(callback) {
    ++hasBeenRunTimes;
    if (hasBeenRunTimes > 5) {
      var err = new Error('Cannot reach server');
      callback(null, err);
      return;
    }
    var url = '/token';
    var tokenRequest = new XMLHttpRequest();
    tokenRequest.open("GET", url, true);
    tokenRequest.onload = function(evt) {
      var token = tokenRequest.responseText;
      callback(token);
    };
    tokenRequest.send();
    },
    getCount: function() { return hasBeenRunTimes; }
  }
};

exports.getToken = (function() {
  // Make call to API to try and get token
  var hasBeenRunTimes = 0;
  return function(callback) {
    hasBeenRunTimes++
    if (hasBeenRunTimes > 5) {
      var err = new Error('Cannot reach server');
      callback(null, err);
      return;
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
'use strict';

var $ = (typeof window !== "undefined" ? window.jQuery : typeof global !== "undefined" ? global.jQuery : null);
var scrolled = false;

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
      timestampNestedArray.forEach(function(timestamp) {
        showTimestamp(timestamp);
      });
    }
  }
}

var Alternatives = function(){

  var stringOne = '',
    stringTwo = '',
    stringThree = '';

  this.clearString = function() {
    stringOne = '';
    stringTwo = '';
    stringThree = '';
  };

  this.showAlternatives = function(alternatives, isFinal, testing) {
    var $hypotheses = $('.hypotheses ol');
    $hypotheses.empty();
    // $hypotheses.append($('</br>'));
    alternatives.forEach(function(alternative, idx) {
      var $alternative;
      if (alternative.transcript) {
        console.log('ALTERNATIVES INDEX', idx);
        var transcript = alternative.transcript.replace(/%HESITATION\s/g, '');
        transcript = transcript.replace(/(.)\1{2,}/g, '');
        switch (idx) {
          case 0:
            stringOne = stringOne + transcript;
            $alternative = $('<li data-hypothesis-index=' + idx + ' >' + stringOne + '</li>');
            break;
          case 1:
            stringTwo = stringTwo + transcript;
            $alternative = $('<li data-hypothesis-index=' + idx + ' >' + stringTwo + '</li>');
            break;
          case 2:
            stringThree = stringThree + transcript;
            $alternative = $('<li data-hypothesis-index=' + idx + ' >' + stringThree + '</li>');
            break;
        }
        $hypotheses.append($alternative);
      }
    });
  };
}

var alternativePrototype = new Alternatives();

// TODO: Convert to closure approach
var processString = function(baseString, isFinished) {

  if (isFinished) {
    var formattedString = baseString.slice(0, -1);
    formattedString = formattedString.charAt(0).toUpperCase() + formattedString.substring(1);
    formattedString = formattedString.trim() + '.';
    $('#resultsText').val(formattedString);
  } else {
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

function updateScroll(){
    if(!scrolled){
        var element = $('.table-scroll').get(0);
        element.scrollTop = element.scrollHeight;
    }
}

var initScroll = function() {
  $('.table-scroll').on('scroll', function(){
      scrolled=true;
  });
}


exports.showResult = function(msg, baseString, callback) {

  var idx = +msg.result_index;

  if (msg.results && msg.results.length > 0) {

    var alternatives = msg.results[0].alternatives;
    var text = msg.results[0].alternatives[0].transcript || '';

    //Capitalize first word
    // if final results, append a new paragraph
    if (msg.results && msg.results[0] && msg.results[0].final) {
      baseString += text;
      var displayFinalString = baseString;
      displayFinalString = displayFinalString.replace(/%HESITATION\s/g, '');
      displayFinalString = displayFinalString.replace(/(.)\1{2,}/g, '');
      processString(displayFinalString, true);
      showMetaData(alternatives[0]);
      // Only show alternatives if we're final
      alternativePrototype.showAlternatives(alternatives);
    } else {
      var tempString = baseString + text;
      tempString = tempString.replace(/%HESITATION\s/g, '');
      tempString = tempString.replace(/(.)\1{2,}/g, '');
      processString(tempString, false);
    }
  }

  updateScroll();

  return baseString;

};

$.subscribe('clearscreen', function() {
  var $hypotheses = $('.hypotheses ul');
  scrolled = false;
  $hypotheses.empty();
  alternativePrototype.clearString();
});
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],10:[function(require,module,exports){

'use strict';

var handleSelectedFile = require('./fileupload').handleSelectedFile;

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

},{"./fileupload":12}],11:[function(require,module,exports){



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
var showNotice = require('./showerror').showNotice;
var handleFileUpload = require('../handlefileupload').handleFileUpload;
var effects = require('./effects');
var utils = require('../utils');

// Need to remove the view logic here and move this out to the handlefileupload controller
var handleSelectedFile = exports.handleSelectedFile = (function() {

    var running = false;
    localStorage.setItem('currentlyDisplaying', false);

    return function(token, file) {

    var currentlyDisplaying = JSON.parse(localStorage.getItem('currentlyDisplaying'));

    // if (currentlyDisplaying) {
    //   showError('Currently another file is playing, please stop the file or wait until it finishes');
    //   return;
    // }

    $.publish('clearscreen');

    localStorage.setItem('currentlyDisplaying', true);
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
      } else {
        restoreUploadTab();
        showError('Only WAV or FLAC files can be transcribed, please try another file format');
        return;
      }
      handleFileUpload(token, currentModel, file, contentType, function(socket) {
        var blob = new Blob([file]);
        var parseOptions = {
          file: blob
        };
        utils.onFileProgress(parseOptions,
          // On data chunk
          function(chunk) {
            socket.send(chunk);
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
          localStorage.setItem('currentlyDisplaying', false);
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

    var currentlyDisplaying = JSON.parse(localStorage.getItem('currentlyDisplaying'));

    if (currentlyDisplaying) {
      console.log('HARD SOCKET STOP');
      $.publish('hardsocketstop');
      localStorage.setItem('currentlyDisplaying', false);
      return;
    }

    fileUploadDialog.val(null);

    fileUploadDialog
    .trigger('click');

  });

}
},{"../handlefileupload":4,"../utils":7,"./effects":11,"./showerror":18}],13:[function(require,module,exports){

var initSessionPermissions = require('./sessionpermissions').initSessionPermissions;
var initSelectModel = require('./selectmodel').initSelectModel;
var initAnimatePanel = require('./animatepanel').initAnimatePanel;
var initShowTab = require('./showtab').initShowTab;
var initDragDrop = require('./dragdrop').initDragDrop;
var initPlaySample = require('./playsample').initPlaySample;
var initRecordButton = require('./recordbutton').initRecordButton;
var initFileUpload = require('./fileupload').initFileUpload;


exports.initViews = function(ctx) {
  console.log('Initializing views...');
  initSelectModel(ctx);
  initPlaySample(ctx);
  initDragDrop(ctx);
  initRecordButton(ctx);
  initFileUpload(ctx);
  initSessionPermissions();
  initShowTab();
  initAnimatePanel();
  initShowTab();
}
},{"./animatepanel":8,"./dragdrop":10,"./fileupload":12,"./playsample":14,"./recordbutton":15,"./selectmodel":16,"./sessionpermissions":17,"./showtab":19}],14:[function(require,module,exports){

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
  'ja-JP_BroadbandModel': ['sample-Ja_JP-wide1.wav', 'sample-Ja_JP-wide2.wav'],
  'ja-JP_NarrowbandModel': ['sample-Ja_JP-narrow3.wav', 'sample-Ja_JP-narrow4.wav']
};

var playSample = (function() {

  var running = false;
  localStorage.setItem('currentlyDisplaying', false);

  return function(token, imageTag, iconName, url, callback) {

    $.publish('clearscreen');

    var currentlyDisplaying = JSON.parse(localStorage.getItem('currentlyDisplaying'));

    console.log('CURRENTLY DISPLAYING', currentlyDisplaying);

    // This error handling needs to be expanded to accomodate
    // the two different play samples files
    if (currentlyDisplaying) {
      console.log('HARD SOCKET STOP');
      $.publish('socketstop');
      localStorage.setItem('currentlyDisplaying', false);
      effects.stopToggleImage(timer, imageTag, iconName);
      effects.restoreImage(imageTag, iconName);
      running = false;
      return;
    }

    if (currentlyDisplaying && running) {
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
        $.subscribe('hardsocketstop', function() {
          audio.pause();
          audio.currentTime = 0;
        });
        $.subscribe('socketstop', function() {
          audio.pause();
          audio.currentTime = 0;
        });
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
              // showError(evt.message);
            },
            // On load end
            function() {
              socket.send(JSON.stringify({'action': 'stop'}));
            });
        }, 
        // On connection end
          function(evt) {
            effects.stopToggleImage(timer, imageTag, iconName);
            effects.restoreImage(imageTag, iconName);
            localStorage.getItem('currentlyDisplaying', false);
          }
        );
      };
    };
    xhr.send();
  };
})();


exports.initPlaySample = function(ctx) {

  (function() {
    var fileName = 'audio/' + LOOKUP_TABLE[ctx.currentModel][0];
    var el = $('.play-sample-1');
    el.off('click');
    var iconName = 'play';
    var imageTag = el.find('img');
    el.click( function(evt) {
      playSample(ctx.token, imageTag, iconName, fileName, function(result) {
        console.log('Play sample result', result);
      });
    });
  })(ctx, LOOKUP_TABLE);

  (function() {
    var fileName = 'audio/' + LOOKUP_TABLE[ctx.currentModel][1];
    var el = $('.play-sample-2');
    el.off('click');
    var iconName = 'play';
    var imageTag = el.find('img');
    el.click( function(evt) {
      playSample(ctx.token, imageTag, iconName, fileName, function(result) {
        console.log('Play sample result', result);
      });
    });
  })(ctx, LOOKUP_TABLE);

};
},{"../handlefileupload":4,"../socket":6,"../utils":7,"./effects":11,"./showerror":18}],15:[function(require,module,exports){

'use strict';

var Microphone = require('../Microphone');
var handleMicrophone = require('../handlemicrophone').handleMicrophone;
var showError = require('./showerror').showError;

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
      var currentlyDisplaying = JSON.parse(localStorage.getItem('currentlyDisplaying'));

      if (currentlyDisplaying) {
        showError('Currently another file is playing, please stop the file or wait until it finishes');
        return;
      }

      if (!running) {
        console.log('Not running, handleMicrophone()');
        handleMicrophone(token, currentModel, mic, function(err, socket) {
          if (err) {
            var msg = 'Error: ' + err.message;
            console.log(msg);
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
        $.publish('hardsocketstop');
        mic.stop();
        running = false;
      }
    }
  })());
}
},{"../Microphone":2,"../handlemicrophone":5,"./showerror":18}],16:[function(require,module,exports){

var initPlaySample = require('./playsample').initPlaySample;

exports.initSelectModel = function(ctx) {

  function isDefault(model) {
    return model === 'en-US_BroadbandModel';
  }

  ctx.models.forEach(function(model) {
    $("#dropdownMenuList").append(
      $("<li>")
        .attr('role', 'presentation')
        .append(
          $('<a>').attr('role', 'menu-item')
            .attr('href', '/')
            .attr('data-model', model.name)
            .append(model.description)
          )
      )
  });

  $("#dropdownMenuList").click(function(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    console.log('Change view', $(evt.target).text());
    var newModelDescription = $(evt.target).text();
    var newModel = $(evt.target).data('model');
    $('#dropdownMenuDefault').empty().text(newModelDescription);
    $('#dropdownMenu1').dropdown('toggle');
    localStorage.setItem('currentModel', newModel);
    ctx.currentModel = newModel;
    initPlaySample(ctx);
    $.publish('clearscreen');
  });

}
},{"./playsample":14}],17:[function(require,module,exports){

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

'use strict';

exports.showError = function(msg) {
  console.log('Error: ', msg);
  var errorAlert = $('.error-row');
  errorAlert.hide();
  errorAlert.css('background-color', '#d74108');
  errorAlert.css('color', 'white');
  var errorMessage = $('#errorMessage');
  errorMessage.text(msg);
  errorAlert.show();
  $('#errorClose').click(function(e) {
    e.preventDefault();
    errorAlert.hide();
    return false;
  });
}

exports.showNotice = function(msg) {
  console.log('Notice: ', msg);
  var noticeAlert = $('.notification-row');
  noticeAlert.hide();
  noticeAlert.css('border', '2px solid #ececec');
  noticeAlert.css('background-color', '#f4f4f4');
  noticeAlert.css('color', 'black');
  var noticeMessage = $('#notificationMessage');
  noticeMessage.text(msg);
  noticeAlert.show();
  $('#notificationClose').click(function(e) {
    e.preventDefault();
    noticeAlert.hide();
    return false;
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

var Microphone = require('./Microphone');
var models = require('./data/models.json').models;
var utils = require('./utils');
utils.initPubSub();
var initViews = require('./views').initViews;
var pkg = require('../package.json');

window.BUFFERSIZE = 8192;

$(document).ready(function() {

  // Temporary app data
  $('#appSettings')
    .html(
      '<p>Version: ' + pkg.version + '</p>'
      + '<p>Buffer Size: ' + BUFFERSIZE + '</p>'
    );


  // Make call to API to try and get token
  utils.getToken(function(token) {

    window.onbeforeunload = function(e) {
      localStorage.clear();
    };

    if (!token) {
      console.error('No authorization token available');
      console.error('Attempting to reconnect...');
    }

    var viewContext = {
      currentModel: 'en-US_BroadbandModel',
      models: models,
      token: token,
      bufferSize: BUFFERSIZE
    };

    initViews(viewContext);

    // Save models to localstorage
    localStorage.setItem('models', JSON.stringify(models));

    // Set default current model
    localStorage.setItem('currentModel', 'en-US_BroadbandModel');
    localStorage.setItem('sessionPermissions', 'true');


    $.subscribe('clearscreen', function() {
      $('#resultsText').text('');
      $('#resultsJSON').text('');
      $('.error-row').hide();
      $('.notification-row').hide();
      $('.hypotheses > ul').empty();
      $('#metadataTableBody').empty();
    });

  });

});
},{"../package.json":1,"./Microphone":2,"./data/models.json":3,"./utils":7,"./views":13}]},{},[20])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5ucG0vbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwicGFja2FnZS5qc29uIiwic3JjL01pY3JvcGhvbmUuanMiLCJzcmMvZGF0YS9tb2RlbHMuanNvbiIsInNyYy9oYW5kbGVmaWxldXBsb2FkLmpzIiwic3JjL2hhbmRsZW1pY3JvcGhvbmUuanMiLCJzcmMvc29ja2V0LmpzIiwic3JjL3V0aWxzLmpzIiwic3JjL3ZpZXdzL2FuaW1hdGVwYW5lbC5qcyIsInNyYy92aWV3cy9kaXNwbGF5bWV0YWRhdGEuanMiLCJzcmMvdmlld3MvZHJhZ2Ryb3AuanMiLCJzcmMvdmlld3MvZWZmZWN0cy5qcyIsInNyYy92aWV3cy9maWxldXBsb2FkLmpzIiwic3JjL3ZpZXdzL2luZGV4LmpzIiwic3JjL3ZpZXdzL3BsYXlzYW1wbGUuanMiLCJzcmMvdmlld3MvcmVjb3JkYnV0dG9uLmpzIiwic3JjL3ZpZXdzL3NlbGVjdG1vZGVsLmpzIiwic3JjL3ZpZXdzL3Nlc3Npb25wZXJtaXNzaW9ucy5qcyIsInNyYy92aWV3cy9zaG93ZXJyb3IuanMiLCJzcmMvdmlld3Mvc2hvd3RhYi5qcyIsInNyYy9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQy9IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHM9e1xuICBcIm5hbWVcIjogXCJTcGVlY2hUb1RleHRCcm93c2VyU3RhcnRlckFwcFwiLFxuICBcInZlcnNpb25cIjogXCIwLjIuMVwiLFxuICBcImRlc2NyaXB0aW9uXCI6IFwiQSBzYW1wbGUgYnJvd3NlciBhcHAgZm9yIEJsdWVtaXggdGhhdCB1c2UgdGhlIHNwZWVjaC10by10ZXh0IHNlcnZpY2UsIGZldGNoaW5nIGEgdG9rZW4gdmlhIE5vZGUuanNcIixcbiAgXCJkZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiYm9keS1wYXJzZXJcIjogXCJ+MS4xMC4yXCIsXG4gICAgXCJjb25uZWN0XCI6IFwiXjMuMy41XCIsXG4gICAgXCJlcnJvcmhhbmRsZXJcIjogXCJ+MS4yLjRcIixcbiAgICBcImV4cHJlc3NcIjogXCJ+NC4xMC44XCIsXG4gICAgXCJoYXJtb25cIjogXCJeMS4zLjFcIixcbiAgICBcImh0dHAtcHJveHlcIjogXCJeMS4xMS4xXCIsXG4gICAgXCJyZXF1ZXN0XCI6IFwifjIuNTMuMFwiLFxuICAgIFwidHJhbnNmb3JtZXItcHJveHlcIjogXCJeMC4zLjFcIlxuICB9LFxuICBcImVuZ2luZXNcIjoge1xuICAgIFwibm9kZVwiOiBcIj49MC4xMFwiXG4gIH0sXG4gIFwicmVwb3NpdG9yeVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiZ2l0XCIsXG4gICAgXCJ1cmxcIjogXCJodHRwczovL2dpdGh1Yi5jb20vd2F0c29uLWRldmVsb3Blci1jbG91ZC9zcGVlY2gtdG8tdGV4dC1icm93c2VyLmdpdFwiXG4gIH0sXG4gIFwiYXV0aG9yXCI6IFwiSUJNIENvcnAuXCIsXG4gIFwiYnJvd3NlcmlmeS1zaGltXCI6IHtcbiAgICBcImpxdWVyeVwiOiBcImdsb2JhbDpqUXVlcnlcIlxuICB9LFxuICBcImJyb3dzZXJpZnlcIjoge1xuICAgIFwidHJhbnNmb3JtXCI6IFtcbiAgICAgIFwiYnJvd3NlcmlmeS1zaGltXCJcbiAgICBdXG4gIH0sXG4gIFwiY29udHJpYnV0b3JzXCI6IFtcbiAgICB7XG4gICAgICBcIm5hbWVcIjogXCJHZXJtYW4gQXR0YW5hc2lvIFJ1aXpcIixcbiAgICAgIFwiZW1haWxcIjogXCJnZXJtYW5hdHRAdXMuaWJtLmNvbVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcIm5hbWVcIjogXCJEYW5pZWwgQm9sYW5vXCIsXG4gICAgICBcImVtYWlsXCI6IFwiZGJvbGFub0B1cy5pYm0uY29tXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwibmFtZVwiOiBcIkJyaXRhbnkgTC4gUG9udmVsbGVcIixcbiAgICAgIFwiZW1haWxcIjogXCJibHBvbnZlbGxlQHVzLmlibS5jb21cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJuYW1lXCI6IFwiRXJpYyBTLiBCdWxsaW5ndG9uXCIsXG4gICAgICBcImVtYWlsXCI6IFwiZXNidWxsaW5AdXMuaWJtLmNvbVwiXG4gICAgfVxuICBdLFxuICBcImxpY2Vuc2VcIjogXCJBcGFjaGUtMi4wXCIsXG4gIFwiYnVnc1wiOiB7XG4gICAgXCJ1cmxcIjogXCJodHRwczovL2dpdGh1Yi5jb20vd2F0c29uLWRldmVsb3Blci1jbG91ZC9zcGVlY2gtdG8tdGV4dC1icm93c2VyL2lzc3Vlc1wiXG4gIH0sXG4gIFwic2NyaXB0c1wiOiB7XG4gICAgXCJzdGFydFwiOiBcIm5vZGUgYXBwLmpzXCIsXG4gICAgXCJidWlsZFwiOiBcImJyb3dzZXJpZnkgLW8gcHVibGljL2pzL21haW4uanMgc3JjL2luZGV4LmpzXCIsXG4gICAgXCJ3YXRjaFwiOiBcIndhdGNoaWZ5IC12IC1kIC1vIHB1YmxpYy9qcy9tYWluLmpzIHNyYy9pbmRleC5qc1wiXG4gIH0sXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcImJyb3dzZXJpZnlcIjogXCJeMTAuMi40XCIsXG4gICAgXCJicm93c2VyaWZ5LXNoaW1cIjogXCJeMy44LjlcIixcbiAgICBcIndhdGNoaWZ5XCI6IFwiXjMuMi4zXCJcbiAgfVxufVxuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgJ0xpY2Vuc2UnKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gJ0FTIElTJyBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG4vKipcbiAqIENhcHR1cmVzIG1pY3JvcGhvbmUgaW5wdXQgZnJvbSB0aGUgYnJvd3Nlci5cbiAqIFdvcmtzIGF0IGxlYXN0IG9uIGxhdGVzdCB2ZXJzaW9ucyBvZiBGaXJlZm94IGFuZCBDaHJvbWVcbiAqL1xuZnVuY3Rpb24gTWljcm9waG9uZShfb3B0aW9ucykge1xuICB2YXIgb3B0aW9ucyA9IF9vcHRpb25zIHx8IHt9O1xuXG4gIC8vIHdlIHJlY29yZCBpbiBtb25vIGJlY2F1c2UgdGhlIHNwZWVjaCByZWNvZ25pdGlvbiBzZXJ2aWNlXG4gIC8vIGRvZXMgbm90IHN1cHBvcnQgc3RlcmVvLlxuICB0aGlzLmJ1ZmZlclNpemUgPSBvcHRpb25zLmJ1ZmZlclNpemUgfHwgODE5MjtcbiAgdGhpcy5pbnB1dENoYW5uZWxzID0gb3B0aW9ucy5pbnB1dENoYW5uZWxzIHx8IDE7XG4gIHRoaXMub3V0cHV0Q2hhbm5lbHMgPSBvcHRpb25zLm91dHB1dENoYW5uZWxzIHx8IDE7XG4gIHRoaXMucmVjb3JkaW5nID0gZmFsc2U7XG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gZmFsc2U7XG4gIHRoaXMuc2FtcGxlUmF0ZSA9IDE2MDAwO1xuICAvLyBhdXhpbGlhciBidWZmZXIgdG8ga2VlcCB1bnVzZWQgc2FtcGxlcyAodXNlZCB3aGVuIGRvaW5nIGRvd25zYW1wbGluZylcbiAgdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzID0gbmV3IEZsb2F0MzJBcnJheSgwKTtcblxuICAvLyBDaHJvbWUgb3IgRmlyZWZveCBvciBJRSBVc2VyIG1lZGlhXG4gIGlmICghbmF2aWdhdG9yLmdldFVzZXJNZWRpYSkge1xuICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgPSBuYXZpZ2F0b3Iud2Via2l0R2V0VXNlck1lZGlhIHx8XG4gICAgbmF2aWdhdG9yLm1vekdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3IubXNHZXRVc2VyTWVkaWE7XG4gIH1cblxufVxuXG4vKipcbiAqIENhbGxlZCB3aGVuIHRoZSB1c2VyIHJlamVjdCB0aGUgdXNlIG9mIHRoZSBtaWNocm9waG9uZVxuICogQHBhcmFtICBlcnJvciBUaGUgZXJyb3JcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUub25QZXJtaXNzaW9uUmVqZWN0ZWQgPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJ01pY3JvcGhvbmUub25QZXJtaXNzaW9uUmVqZWN0ZWQoKScpO1xuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IGZhbHNlO1xuICB0aGlzLm9uRXJyb3IoJ1Blcm1pc3Npb24gdG8gYWNjZXNzIHRoZSBtaWNyb3Bob25lIHJlamV0ZWQuJyk7XG59O1xuXG5NaWNyb3Bob25lLnByb3RvdHlwZS5vbkVycm9yID0gZnVuY3Rpb24oZXJyb3IpIHtcbiAgY29uc29sZS5sb2coJ01pY3JvcGhvbmUub25FcnJvcigpOicsIGVycm9yKTtcbn07XG5cbi8qKlxuICogQ2FsbGVkIHdoZW4gdGhlIHVzZXIgYXV0aG9yaXplcyB0aGUgdXNlIG9mIHRoZSBtaWNyb3Bob25lLlxuICogQHBhcmFtICB7T2JqZWN0fSBzdHJlYW0gVGhlIFN0cmVhbSB0byBjb25uZWN0IHRvXG4gKlxuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5vbk1lZGlhU3RyZWFtID0gIGZ1bmN0aW9uKHN0cmVhbSkge1xuICB2YXIgQXVkaW9DdHggPSB3aW5kb3cuQXVkaW9Db250ZXh0IHx8IHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQ7XG5cbiAgaWYgKCFBdWRpb0N0eClcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0F1ZGlvQ29udGV4dCBub3QgYXZhaWxhYmxlJyk7XG5cbiAgaWYgKCF0aGlzLmF1ZGlvQ29udGV4dClcbiAgICB0aGlzLmF1ZGlvQ29udGV4dCA9IG5ldyBBdWRpb0N0eCgpO1xuXG4gIHZhciBnYWluID0gdGhpcy5hdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xuICB2YXIgYXVkaW9JbnB1dCA9IHRoaXMuYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHN0cmVhbSk7XG5cbiAgYXVkaW9JbnB1dC5jb25uZWN0KGdhaW4pO1xuXG4gIHRoaXMubWljID0gdGhpcy5hdWRpb0NvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKHRoaXMuYnVmZmVyU2l6ZSxcbiAgICB0aGlzLmlucHV0Q2hhbm5lbHMsIHRoaXMub3V0cHV0Q2hhbm5lbHMpO1xuXG4gIC8vIHVuY29tbWVudCB0aGUgZm9sbG93aW5nIGxpbmUgaWYgeW91IHdhbnQgdG8gdXNlIHlvdXIgbWljcm9waG9uZSBzYW1wbGUgcmF0ZVxuICAvL3RoaXMuc2FtcGxlUmF0ZSA9IHRoaXMuYXVkaW9Db250ZXh0LnNhbXBsZVJhdGU7XG4gIGNvbnNvbGUubG9nKCdNaWNyb3Bob25lLm9uTWVkaWFTdHJlYW0oKTogc2FtcGxpbmcgcmF0ZSBpczonLCB0aGlzLnNhbXBsZVJhdGUpO1xuXG4gIHRoaXMubWljLm9uYXVkaW9wcm9jZXNzID0gdGhpcy5fb25hdWRpb3Byb2Nlc3MuYmluZCh0aGlzKTtcbiAgdGhpcy5zdHJlYW0gPSBzdHJlYW07XG5cbiAgZ2Fpbi5jb25uZWN0KHRoaXMubWljKTtcbiAgdGhpcy5taWMuY29ubmVjdCh0aGlzLmF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG4gIHRoaXMucmVjb3JkaW5nID0gdHJ1ZTtcbiAgdGhpcy5yZXF1ZXN0ZWRBY2Nlc3MgPSBmYWxzZTtcbiAgdGhpcy5vblN0YXJ0UmVjb3JkaW5nKCk7XG59O1xuXG4vKipcbiAqIGNhbGxiYWNrIHRoYXQgaXMgYmVpbmcgdXNlZCBieSB0aGUgbWljcm9waG9uZVxuICogdG8gc2VuZCBhdWRpbyBjaHVua3MuXG4gKiBAcGFyYW0gIHtvYmplY3R9IGRhdGEgYXVkaW9cbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUuX29uYXVkaW9wcm9jZXNzID0gZnVuY3Rpb24oZGF0YSkge1xuICBpZiAoIXRoaXMucmVjb3JkaW5nKSB7XG4gICAgLy8gV2Ugc3BlYWsgYnV0IHdlIGFyZSBub3QgcmVjb3JkaW5nXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gU2luZ2xlIGNoYW5uZWxcbiAgdmFyIGNoYW4gPSBkYXRhLmlucHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDApO1xuXG4gIHRoaXMub25BdWRpbyh0aGlzLl9leHBvcnREYXRhQnVmZmVyVG8xNktoeihuZXcgRmxvYXQzMkFycmF5KGNoYW4pKSk7XG5cbiAgLy9leHBvcnQgd2l0aCBtaWNyb3Bob25lIG1oeiwgcmVtZW1iZXIgdG8gdXBkYXRlIHRoZSB0aGlzLnNhbXBsZVJhdGVcbiAgLy8gd2l0aCB0aGUgc2FtcGxlIHJhdGUgZnJvbSB5b3VyIG1pY3JvcGhvbmVcbiAgLy8gdGhpcy5vbkF1ZGlvKHRoaXMuX2V4cG9ydERhdGFCdWZmZXIobmV3IEZsb2F0MzJBcnJheShjaGFuKSkpO1xuXG59O1xuXG4vKipcbiAqIFN0YXJ0IHRoZSBhdWRpbyByZWNvcmRpbmdcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUucmVjb3JkID0gZnVuY3Rpb24oKSB7XG4gIGlmICghbmF2aWdhdG9yLmdldFVzZXJNZWRpYSl7XG4gICAgdGhpcy5vbkVycm9yKCdCcm93c2VyIGRvZXNuXFwndCBzdXBwb3J0IG1pY3JvcGhvbmUgaW5wdXQnKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKHRoaXMucmVxdWVzdGVkQWNjZXNzKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhpcy5yZXF1ZXN0ZWRBY2Nlc3MgPSB0cnVlO1xuICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKHsgYXVkaW86IHRydWUgfSxcbiAgICB0aGlzLm9uTWVkaWFTdHJlYW0uYmluZCh0aGlzKSwgLy8gTWljcm9waG9uZSBwZXJtaXNzaW9uIGdyYW50ZWRcbiAgICB0aGlzLm9uUGVybWlzc2lvblJlamVjdGVkLmJpbmQodGhpcykpOyAvLyBNaWNyb3Bob25lIHBlcm1pc3Npb24gcmVqZWN0ZWRcbn07XG5cbi8qKlxuICogU3RvcCB0aGUgYXVkaW8gcmVjb3JkaW5nXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCF0aGlzLnJlY29yZGluZylcbiAgICByZXR1cm47XG4gIHRoaXMucmVjb3JkaW5nID0gZmFsc2U7XG4gIHRoaXMuc3RyZWFtLnN0b3AoKTtcbiAgdGhpcy5yZXF1ZXN0ZWRBY2Nlc3MgPSBmYWxzZTtcbiAgdGhpcy5taWMuZGlzY29ubmVjdCgwKTtcbiAgdGhpcy5taWMgPSBudWxsO1xuICB0aGlzLm9uU3RvcFJlY29yZGluZygpO1xufTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgQmxvYiB0eXBlOiAnYXVkaW8vbDE2JyB3aXRoIHRoZSBjaHVuayBhbmQgZG93bnNhbXBsaW5nIHRvIDE2IGtIelxuICogY29taW5nIGZyb20gdGhlIG1pY3JvcGhvbmUuXG4gKiBFeHBsYW5hdGlvbiBmb3IgdGhlIG1hdGg6IFRoZSByYXcgdmFsdWVzIGNhcHR1cmVkIGZyb20gdGhlIFdlYiBBdWRpbyBBUEkgYXJlXG4gKiBpbiAzMi1iaXQgRmxvYXRpbmcgUG9pbnQsIGJldHdlZW4gLTEgYW5kIDEgKHBlciB0aGUgc3BlY2lmaWNhdGlvbikuXG4gKiBUaGUgdmFsdWVzIGZvciAxNi1iaXQgUENNIHJhbmdlIGJldHdlZW4gLTMyNzY4IGFuZCArMzI3NjcgKDE2LWJpdCBzaWduZWQgaW50ZWdlcikuXG4gKiBNdWx0aXBseSB0byBjb250cm9sIHRoZSB2b2x1bWUgb2YgdGhlIG91dHB1dC4gV2Ugc3RvcmUgaW4gbGl0dGxlIGVuZGlhbi5cbiAqIEBwYXJhbSAge09iamVjdH0gYnVmZmVyIE1pY3JvcGhvbmUgYXVkaW8gY2h1bmtcbiAqIEByZXR1cm4ge0Jsb2J9ICdhdWRpby9sMTYnIGNodW5rXG4gKiBAZGVwcmVjYXRlZCBUaGlzIG1ldGhvZCBpcyBkZXByYWNhdGVkXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLl9leHBvcnREYXRhQnVmZmVyVG8xNktoeiA9IGZ1bmN0aW9uKGJ1ZmZlck5ld1NhbXBsZXMpIHtcbiAgdmFyIGJ1ZmZlciA9IG51bGwsXG4gICAgbmV3U2FtcGxlcyA9IGJ1ZmZlck5ld1NhbXBsZXMubGVuZ3RoLFxuICAgIHVudXNlZFNhbXBsZXMgPSB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXMubGVuZ3RoO1xuXG4gIGlmICh1bnVzZWRTYW1wbGVzID4gMCkge1xuICAgIGJ1ZmZlciA9IG5ldyBGbG9hdDMyQXJyYXkodW51c2VkU2FtcGxlcyArIG5ld1NhbXBsZXMpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdW51c2VkU2FtcGxlczsgKytpKSB7XG4gICAgICBidWZmZXJbaV0gPSB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXNbaV07XG4gICAgfVxuICAgIGZvciAoaSA9IDA7IGkgPCBuZXdTYW1wbGVzOyArK2kpIHtcbiAgICAgIGJ1ZmZlclt1bnVzZWRTYW1wbGVzICsgaV0gPSBidWZmZXJOZXdTYW1wbGVzW2ldO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBidWZmZXIgPSBidWZmZXJOZXdTYW1wbGVzO1xuICB9XG5cbiAgLy8gZG93bnNhbXBsaW5nIHZhcmlhYmxlc1xuICB2YXIgZmlsdGVyID0gW1xuICAgICAgLTAuMDM3OTM1LCAtMC4wMDA4OTAyNCwgMC4wNDAxNzMsIDAuMDE5OTg5LCAwLjAwNDc3OTIsIC0wLjA1ODY3NSwgLTAuMDU2NDg3LFxuICAgICAgLTAuMDA0MDY1MywgMC4xNDUyNywgMC4yNjkyNywgMC4zMzkxMywgMC4yNjkyNywgMC4xNDUyNywgLTAuMDA0MDY1MywgLTAuMDU2NDg3LFxuICAgICAgLTAuMDU4Njc1LCAwLjAwNDc3OTIsIDAuMDE5OTg5LCAwLjA0MDE3MywgLTAuMDAwODkwMjQsIC0wLjAzNzkzNVxuICAgIF0sXG4gICAgc2FtcGxpbmdSYXRlUmF0aW8gPSB0aGlzLmF1ZGlvQ29udGV4dC5zYW1wbGVSYXRlIC8gMTYwMDAsXG4gICAgbk91dHB1dFNhbXBsZXMgPSBNYXRoLmZsb29yKChidWZmZXIubGVuZ3RoIC0gZmlsdGVyLmxlbmd0aCkgLyAoc2FtcGxpbmdSYXRlUmF0aW8pKSArIDEsXG4gICAgcGNtRW5jb2RlZEJ1ZmZlcjE2ayA9IG5ldyBBcnJheUJ1ZmZlcihuT3V0cHV0U2FtcGxlcyAqIDIpLFxuICAgIGRhdGFWaWV3MTZrID0gbmV3IERhdGFWaWV3KHBjbUVuY29kZWRCdWZmZXIxNmspLFxuICAgIGluZGV4ID0gMCxcbiAgICB2b2x1bWUgPSAweDdGRkYsIC8vcmFuZ2UgZnJvbSAwIHRvIDB4N0ZGRiB0byBjb250cm9sIHRoZSB2b2x1bWVcbiAgICBuT3V0ID0gMDtcblxuICBmb3IgKHZhciBpID0gMDsgaSArIGZpbHRlci5sZW5ndGggLSAxIDwgYnVmZmVyLmxlbmd0aDsgaSA9IE1hdGgucm91bmQoc2FtcGxpbmdSYXRlUmF0aW8gKiBuT3V0KSkge1xuICAgIHZhciBzYW1wbGUgPSAwO1xuICAgIGZvciAodmFyIGogPSAwOyBqIDwgZmlsdGVyLmxlbmd0aDsgKytqKSB7XG4gICAgICBzYW1wbGUgKz0gYnVmZmVyW2kgKyBqXSAqIGZpbHRlcltqXTtcbiAgICB9XG4gICAgc2FtcGxlICo9IHZvbHVtZTtcbiAgICBkYXRhVmlldzE2ay5zZXRJbnQxNihpbmRleCwgc2FtcGxlLCB0cnVlKTsgLy8gJ3RydWUnIC0+IG1lYW5zIGxpdHRsZSBlbmRpYW5cbiAgICBpbmRleCArPSAyO1xuICAgIG5PdXQrKztcbiAgfVxuXG4gIHZhciBpbmRleFNhbXBsZUFmdGVyTGFzdFVzZWQgPSBNYXRoLnJvdW5kKHNhbXBsaW5nUmF0ZVJhdGlvICogbk91dCk7XG4gIHZhciByZW1haW5pbmcgPSBidWZmZXIubGVuZ3RoIC0gaW5kZXhTYW1wbGVBZnRlckxhc3RVc2VkO1xuICBpZiAocmVtYWluaW5nID4gMCkge1xuICAgIHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlcyA9IG5ldyBGbG9hdDMyQXJyYXkocmVtYWluaW5nKTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgcmVtYWluaW5nOyArK2kpIHtcbiAgICAgIHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlc1tpXSA9IGJ1ZmZlcltpbmRleFNhbXBsZUFmdGVyTGFzdFVzZWQgKyBpXTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzID0gbmV3IEZsb2F0MzJBcnJheSgwKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgQmxvYihbZGF0YVZpZXcxNmtdLCB7XG4gICAgdHlwZTogJ2F1ZGlvL2wxNidcbiAgfSk7XG4gIH07XG5cbi8qKlxuICogQ3JlYXRlcyBhIEJsb2IgdHlwZTogJ2F1ZGlvL2wxNicgd2l0aCB0aGVcbiAqIGNodW5rIGNvbWluZyBmcm9tIHRoZSBtaWNyb3Bob25lLlxuICovXG52YXIgZXhwb3J0RGF0YUJ1ZmZlciA9IGZ1bmN0aW9uKGJ1ZmZlciwgYnVmZmVyU2l6ZSkge1xuICB2YXIgcGNtRW5jb2RlZEJ1ZmZlciA9IG51bGwsXG4gICAgZGF0YVZpZXcgPSBudWxsLFxuICAgIGluZGV4ID0gMCxcbiAgICB2b2x1bWUgPSAweDdGRkY7IC8vcmFuZ2UgZnJvbSAwIHRvIDB4N0ZGRiB0byBjb250cm9sIHRoZSB2b2x1bWVcblxuICBwY21FbmNvZGVkQnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKGJ1ZmZlclNpemUgKiAyKTtcbiAgZGF0YVZpZXcgPSBuZXcgRGF0YVZpZXcocGNtRW5jb2RlZEJ1ZmZlcik7XG5cbiAgLyogRXhwbGFuYXRpb24gZm9yIHRoZSBtYXRoOiBUaGUgcmF3IHZhbHVlcyBjYXB0dXJlZCBmcm9tIHRoZSBXZWIgQXVkaW8gQVBJIGFyZVxuICAgKiBpbiAzMi1iaXQgRmxvYXRpbmcgUG9pbnQsIGJldHdlZW4gLTEgYW5kIDEgKHBlciB0aGUgc3BlY2lmaWNhdGlvbikuXG4gICAqIFRoZSB2YWx1ZXMgZm9yIDE2LWJpdCBQQ00gcmFuZ2UgYmV0d2VlbiAtMzI3NjggYW5kICszMjc2NyAoMTYtYml0IHNpZ25lZCBpbnRlZ2VyKS5cbiAgICogTXVsdGlwbHkgdG8gY29udHJvbCB0aGUgdm9sdW1lIG9mIHRoZSBvdXRwdXQuIFdlIHN0b3JlIGluIGxpdHRsZSBlbmRpYW4uXG4gICAqL1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlci5sZW5ndGg7IGkrKykge1xuICAgIGRhdGFWaWV3LnNldEludDE2KGluZGV4LCBidWZmZXJbaV0gKiB2b2x1bWUsIHRydWUpO1xuICAgIGluZGV4ICs9IDI7XG4gIH1cblxuICAvLyBsMTYgaXMgdGhlIE1JTUUgdHlwZSBmb3IgMTYtYml0IFBDTVxuICByZXR1cm4gbmV3IEJsb2IoW2RhdGFWaWV3XSwgeyB0eXBlOiAnYXVkaW8vbDE2JyB9KTtcbn07XG5cbk1pY3JvcGhvbmUucHJvdG90eXBlLl9leHBvcnREYXRhQnVmZmVyID0gZnVuY3Rpb24oYnVmZmVyKXtcbiAgdXRpbHMuZXhwb3J0RGF0YUJ1ZmZlcihidWZmZXIsIHRoaXMuYnVmZmVyU2l6ZSk7XG59OyBcblxuXG4vLyBGdW5jdGlvbnMgdXNlZCB0byBjb250cm9sIE1pY3JvcGhvbmUgZXZlbnRzIGxpc3RlbmVycy5cbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uU3RhcnRSZWNvcmRpbmcgPSAgZnVuY3Rpb24oKSB7fTtcbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uU3RvcFJlY29yZGluZyA9ICBmdW5jdGlvbigpIHt9O1xuTWljcm9waG9uZS5wcm90b3R5cGUub25BdWRpbyA9ICBmdW5jdGlvbigpIHt9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1pY3JvcGhvbmU7XG5cbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgIFwibW9kZWxzXCI6IFtcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0ud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0L2FwaS92MS9tb2RlbHMvZW4tVVNfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogMTYwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiZW4tVVNfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiZW4tVVNcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiVVMgRW5nbGlzaCBicm9hZGJhbmQgbW9kZWwgKDE2S0h6KVwiXG4gICAgICB9LCBcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0ud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0L2FwaS92MS9tb2RlbHMvZW4tVVNfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDgwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiZW4tVVNfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImVuLVVTXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlVTIEVuZ2xpc2ggbmFycm93YmFuZCBtb2RlbCAoOEtIeilcIlxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0ud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0L2FwaS92MS9tb2RlbHMvZXMtRVNfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogMTYwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiZXMtRVNfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiZXMtRVNcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiU3BhbmlzaCBicm9hZGJhbmQgbW9kZWwgKDE2S0h6KVwiXG4gICAgICB9LCBcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0ud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0L2FwaS92MS9tb2RlbHMvZXMtRVNfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDgwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiZXMtRVNfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImVzLUVTXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlNwYW5pc2ggbmFycm93YmFuZCBtb2RlbCAoOEtIeilcIlxuICAgICAgfSwgXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC9hcGkvdjEvbW9kZWxzL2phLUpQX0Jyb2FkYmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDE2MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcImphLUpQX0Jyb2FkYmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImphLUpQXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIkphcGFuZXNlIGJyb2FkYmFuZCBtb2RlbCAoMTZLSHopXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL21vZGVscy9qYS1KUF9OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogODAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJqYS1KUF9OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiamEtSlBcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiSmFwYW5lc2UgbmFycm93YmFuZCBtb2RlbCAoOEtIeilcIlxuICAgICAgfVxuICAgXVxufVxuIiwiXG52YXIgZWZmZWN0cyA9IHJlcXVpcmUoJy4vdmlld3MvZWZmZWN0cycpO1xudmFyIGRpc3BsYXkgPSByZXF1aXJlKCcuL3ZpZXdzL2Rpc3BsYXltZXRhZGF0YScpO1xudmFyIGhpZGVFcnJvciA9IHJlcXVpcmUoJy4vdmlld3Mvc2hvd2Vycm9yJykuaGlkZUVycm9yO1xudmFyIGluaXRTb2NrZXQgPSByZXF1aXJlKCcuL3NvY2tldCcpLmluaXRTb2NrZXQ7XG5cbmV4cG9ydHMuaGFuZGxlRmlsZVVwbG9hZCA9IGZ1bmN0aW9uKHRva2VuLCBtb2RlbCwgZmlsZSwgY29udGVudFR5cGUsIGNhbGxiYWNrLCBvbmVuZCkge1xuXG4gICAgLy8gU2V0IGN1cnJlbnRseURpc3BsYXlpbmcgdG8gcHJldmVudCBvdGhlciBzb2NrZXRzIGZyb20gb3BlbmluZ1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgdHJ1ZSk7XG5cbiAgICAvLyAkKCcjcHJvZ3Jlc3NJbmRpY2F0b3InKS5jc3MoJ3Zpc2liaWxpdHknLCAndmlzaWJsZScpO1xuXG4gICAgJC5zdWJzY3JpYmUoJ3Byb2dyZXNzJywgZnVuY3Rpb24oZXZ0LCBkYXRhKSB7XG4gICAgICBjb25zb2xlLmxvZygncHJvZ3Jlc3M6ICcsIGRhdGEpO1xuICAgIH0pO1xuXG4gICAgY29uc29sZS5sb2coJ2NvbnRlbnRUeXBlJywgY29udGVudFR5cGUpO1xuXG4gICAgdmFyIGJhc2VTdHJpbmcgPSAnJztcbiAgICB2YXIgYmFzZUpTT04gPSAnJztcblxuICAgIHZhciBvcHRpb25zID0ge307XG4gICAgb3B0aW9ucy50b2tlbiA9IHRva2VuO1xuICAgIG9wdGlvbnMubWVzc2FnZSA9IHtcbiAgICAgICdhY3Rpb24nOiAnc3RhcnQnLFxuICAgICAgJ2NvbnRlbnQtdHlwZSc6IGNvbnRlbnRUeXBlLFxuICAgICAgJ2ludGVyaW1fcmVzdWx0cyc6IHRydWUsXG4gICAgICAnY29udGludW91cyc6IHRydWUsXG4gICAgICAnd29yZF9jb25maWRlbmNlJzogdHJ1ZSxcbiAgICAgICd0aW1lc3RhbXBzJzogdHJ1ZSxcbiAgICAgICdtYXhfYWx0ZXJuYXRpdmVzJzogM1xuICAgIH07XG4gICAgb3B0aW9ucy5tb2RlbCA9IG1vZGVsO1xuXG4gICAgZnVuY3Rpb24gb25PcGVuKHNvY2tldCkge1xuICAgICAgY29uc29sZS5sb2coJ1NvY2tldCBvcGVuZWQnKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkxpc3RlbmluZyhzb2NrZXQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdTb2NrZXQgbGlzdGVuaW5nJyk7XG4gICAgICBjYWxsYmFjayhzb2NrZXQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uTWVzc2FnZShtc2cpIHtcbiAgICAgIGlmIChtc2cucmVzdWx0cykge1xuICAgICAgICAvLyBDb252ZXJ0IHRvIGNsb3N1cmUgYXBwcm9hY2hcbiAgICAgICAgYmFzZVN0cmluZyA9IGRpc3BsYXkuc2hvd1Jlc3VsdChtc2csIGJhc2VTdHJpbmcpO1xuICAgICAgICBiYXNlSlNPTiA9IGRpc3BsYXkuc2hvd0pTT04obXNnLCBiYXNlSlNPTik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25FcnJvcihldnQpIHtcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgb25lbmQoZXZ0KTtcbiAgICAgIGNvbnNvbGUubG9nKCdTb2NrZXQgZXJyOiAnLCBldnQuY29kZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25DbG9zZShldnQpIHtcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgb25lbmQoZXZ0KTtcbiAgICAgIGNvbnNvbGUubG9nKCdTb2NrZXQgY2xvc2luZzogJywgZXZ0KTtcbiAgICB9XG5cbiAgICBpbml0U29ja2V0KG9wdGlvbnMsIG9uT3Blbiwgb25MaXN0ZW5pbmcsIG9uTWVzc2FnZSwgb25FcnJvciwgb25DbG9zZSk7XG5cbiAgfVxuIiwiXG4ndXNlIHN0cmljdCc7XG5cbnZhciBpbml0U29ja2V0ID0gcmVxdWlyZSgnLi9zb2NrZXQnKS5pbml0U29ja2V0O1xudmFyIGRpc3BsYXkgPSByZXF1aXJlKCcuL3ZpZXdzL2Rpc3BsYXltZXRhZGF0YScpO1xuXG5leHBvcnRzLmhhbmRsZU1pY3JvcGhvbmUgPSBmdW5jdGlvbih0b2tlbiwgbW9kZWwsIG1pYywgY2FsbGJhY2spIHtcblxuICBpZiAobW9kZWwuaW5kZXhPZignTmFycm93YmFuZCcpID4gLTEpIHtcbiAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdNaWNyb3Bob25lIHRyYW5zY3JpcHRpb24gY2Fubm90IGFjY29tb2RhdGUgbmFycm93YmFuZCBtb2RlbHMsIHBsZWFzZSBzZWxlY3QgYW5vdGhlcicpO1xuICAgIGNhbGxiYWNrKGVyciwgbnVsbCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgJC5wdWJsaXNoKCdjbGVhcnNjcmVlbicpO1xuXG4gIC8vIFRlc3Qgb3V0IHdlYnNvY2tldFxuICB2YXIgYmFzZVN0cmluZyA9ICcnO1xuICB2YXIgYmFzZUpTT04gPSAnJztcblxuICB2YXIgb3B0aW9ucyA9IHt9O1xuICBvcHRpb25zLnRva2VuID0gdG9rZW47XG4gIG9wdGlvbnMubWVzc2FnZSA9IHtcbiAgICAnYWN0aW9uJzogJ3N0YXJ0JyxcbiAgICAnY29udGVudC10eXBlJzogJ2F1ZGlvL2wxNjtyYXRlPTE2MDAwJyxcbiAgICAnaW50ZXJpbV9yZXN1bHRzJzogdHJ1ZSxcbiAgICAnY29udGludW91cyc6IHRydWUsXG4gICAgJ3dvcmRfY29uZmlkZW5jZSc6IHRydWUsXG4gICAgJ3RpbWVzdGFtcHMnOiB0cnVlLFxuICAgICdtYXhfYWx0ZXJuYXRpdmVzJzogM1xuICB9O1xuICBvcHRpb25zLm1vZGVsID0gbW9kZWw7XG5cbiAgZnVuY3Rpb24gb25PcGVuKHNvY2tldCkge1xuICAgIGNvbnNvbGUubG9nKCdNaWMgc29ja2V0OiBvcGVuZWQnKTtcbiAgICBjYWxsYmFjayhudWxsLCBzb2NrZXQpO1xuICB9XG5cbiAgZnVuY3Rpb24gb25MaXN0ZW5pbmcoc29ja2V0KSB7XG5cbiAgICBtaWMub25BdWRpbyA9IGZ1bmN0aW9uKGJsb2IpIHtcbiAgICAgIGlmIChzb2NrZXQucmVhZHlTdGF0ZSA8IDIpIHtcbiAgICAgICAgc29ja2V0LnNlbmQoYmxvYilcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gb25NZXNzYWdlKG1zZywgc29ja2V0KSB7XG4gICAgY29uc29sZS5sb2coJ01pYyBzb2NrZXQgbXNnOiAnLCBtc2cpO1xuICAgIGlmIChtc2cucmVzdWx0cykge1xuICAgICAgLy8gQ29udmVydCB0byBjbG9zdXJlIGFwcHJvYWNoXG4gICAgICBiYXNlU3RyaW5nID0gZGlzcGxheS5zaG93UmVzdWx0KG1zZywgYmFzZVN0cmluZyk7XG4gICAgICBiYXNlSlNPTiA9IGRpc3BsYXkuc2hvd0pTT04obXNnLCBiYXNlSlNPTik7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb25FcnJvcihyLCBzb2NrZXQpIHtcbiAgICBjb25zb2xlLmxvZygnTWljIHNvY2tldCBlcnI6ICcsIGVycik7XG4gIH1cblxuICBmdW5jdGlvbiBvbkNsb3NlKGV2dCkge1xuICAgIGNvbnNvbGUubG9nKCdNaWMgc29ja2V0IGNsb3NlOiAnLCBldnQpO1xuICB9XG5cbiAgaW5pdFNvY2tldChvcHRpb25zLCBvbk9wZW4sIG9uTGlzdGVuaW5nLCBvbk1lc3NhZ2UsIG9uRXJyb3IsIG9uQ2xvc2UpO1xuXG59XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDE0IElCTSBDb3JwLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbi8qZ2xvYmFsICQ6ZmFsc2UgKi9cblxuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG52YXIgTWljcm9waG9uZSA9IHJlcXVpcmUoJy4vTWljcm9waG9uZScpO1xudmFyIHNob3dlcnJvciA9IHJlcXVpcmUoJy4vdmlld3Mvc2hvd2Vycm9yJyk7XG52YXIgc2hvd0Vycm9yID0gc2hvd2Vycm9yLnNob3dFcnJvcjtcbnZhciBoaWRlRXJyb3IgPSBzaG93ZXJyb3IuaGlkZUVycm9yO1xuXG4vLyBNaW5pIFdTIGNhbGxiYWNrIEFQSSwgc28gd2UgY2FuIGluaXRpYWxpemVcbi8vIHdpdGggbW9kZWwgYW5kIHRva2VuIGluIFVSSSwgcGx1c1xuLy8gc3RhcnQgbWVzc2FnZVxuXG4vLyBJbml0aWFsaXplIGNsb3N1cmUsIHdoaWNoIGhvbGRzIG1heGltdW0gZ2V0VG9rZW4gY2FsbCBjb3VudFxudmFyIHRva2VuR2VuZXJhdG9yID0gdXRpbHMuY3JlYXRlVG9rZW5HZW5lcmF0b3IoKTtcblxudmFyIGluaXRTb2NrZXQgPSBleHBvcnRzLmluaXRTb2NrZXQgPSBmdW5jdGlvbihvcHRpb25zLCBvbm9wZW4sIG9ubGlzdGVuaW5nLCBvbm1lc3NhZ2UsIG9uZXJyb3IsIG9uY2xvc2UpIHtcbiAgdmFyIGxpc3RlbmluZztcbiAgZnVuY3Rpb24gd2l0aERlZmF1bHQodmFsLCBkZWZhdWx0VmFsKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWwgPT09ICd1bmRlZmluZWQnID8gZGVmYXVsdFZhbCA6IHZhbDtcbiAgfVxuICB2YXIgc29ja2V0O1xuICB2YXIgdG9rZW4gPSBvcHRpb25zLnRva2VuO1xuICB2YXIgbW9kZWwgPSBvcHRpb25zLm1vZGVsIHx8IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50TW9kZWwnKTtcbiAgdmFyIG1lc3NhZ2UgPSBvcHRpb25zLm1lc3NhZ2UgfHwgeydhY3Rpb24nOiAnc3RhcnQnfTtcbiAgdmFyIHNlc3Npb25QZXJtaXNzaW9ucyA9IHdpdGhEZWZhdWx0KG9wdGlvbnMuc2Vzc2lvblBlcm1pc3Npb25zLCBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdzZXNzaW9uUGVybWlzc2lvbnMnKSkpO1xuICB2YXIgc2Vzc2lvblBlcm1pc3Npb25zUXVlcnlQYXJhbSA9IHNlc3Npb25QZXJtaXNzaW9ucyA/ICcwJyA6ICcxJztcbiAgdmFyIHVybCA9IG9wdGlvbnMuc2VydmljZVVSSSB8fCAnd3NzOi8vc3RyZWFtLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC9hcGkvdjEvcmVjb2duaXplP3dhdHNvbi10b2tlbj0nXG4gICAgKyB0b2tlblxuICAgICsgJyZYLVdEQy1QTC1PUFQtT1VUPScgKyBzZXNzaW9uUGVybWlzc2lvbnNRdWVyeVBhcmFtXG4gICAgKyAnJm1vZGVsPScgKyBtb2RlbDtcbiAgY29uc29sZS5sb2coJ1VSTCBtb2RlbCcsIG1vZGVsKTtcbiAgdHJ5IHtcbiAgICBzb2NrZXQgPSBuZXcgV2ViU29ja2V0KHVybCk7XG4gIH0gY2F0Y2goZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcignV1MgY29ubmVjdGlvbiBlcnJvcjogJywgZXJyKTtcbiAgfVxuICBzb2NrZXQub25vcGVuID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgbGlzdGVuaW5nID0gZmFsc2U7XG4gICAgJC5zdWJzY3JpYmUoJ2hhcmRzb2NrZXRzdG9wJywgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgY29uc29sZS5sb2coJ01JQ1JPUEhPTkU6IGNsb3NlLicpO1xuICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe2FjdGlvbjonc3RvcCd9KSk7XG4gICAgfSk7XG4gICAgJC5zdWJzY3JpYmUoJ3NvY2tldHN0b3AnLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICBjb25zb2xlLmxvZygnTUlDUk9QSE9ORTogY2xvc2UuJyk7XG4gICAgICBzb2NrZXQuY2xvc2UoKTtcbiAgICB9KTtcbiAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeShtZXNzYWdlKSk7XG4gICAgb25vcGVuKHNvY2tldCk7XG4gIH07XG4gIHNvY2tldC5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgbXNnID0gSlNPTi5wYXJzZShldnQuZGF0YSk7XG4gICAgaWYgKG1zZy5lcnJvcikge1xuICAgICAgc2hvd0Vycm9yKG1zZy5lcnJvcik7XG4gICAgICAkLnB1Ymxpc2goJ2hhcmRzb2NrZXRzdG9wJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChtc2cuc3RhdGUgPT09ICdsaXN0ZW5pbmcnKSB7XG4gICAgICAvLyBFYXJseSBjdXQgb2ZmLCB3aXRob3V0IG5vdGlmaWNhdGlvblxuICAgICAgaWYgKCFsaXN0ZW5pbmcpIHtcbiAgICAgICAgb25saXN0ZW5pbmcoc29ja2V0KTtcbiAgICAgICAgbGlzdGVuaW5nID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdNSUNST1BIT05FOiBDbG9zaW5nIHNvY2tldC4nKTtcbiAgICAgICAgc29ja2V0LmNsb3NlKCk7XG4gICAgICB9XG4gICAgfVxuICAgIG9ubWVzc2FnZShtc2csIHNvY2tldCk7XG4gIH07XG5cbiAgc29ja2V0Lm9uZXJyb3IgPSBmdW5jdGlvbihldnQpIHtcbiAgICBjb25zb2xlLmxvZygnV1Mgb25lcnJvcjogJywgZXZ0KTtcbiAgICBzaG93RXJyb3IoJ0FwcGxpY2F0aW9uIGVycm9yICcgKyBldnQuY29kZSArICc6IHBsZWFzZSByZWZyZXNoIHlvdXIgYnJvd3NlciBhbmQgdHJ5IGFnYWluJyk7XG4gICAgJC5wdWJsaXNoKCdjbGVhcnNjcmVlbicpO1xuICAgIG9uZXJyb3IoZXZ0KTtcbiAgfTtcblxuICBzb2NrZXQub25jbG9zZSA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIGNvbnNvbGUubG9nKCdXUyBvbmNsb3NlOiAnLCBldnQpO1xuICAgIGlmIChldnQuY29kZSA9PT0gMTAwNikge1xuICAgICAgLy8gQXV0aGVudGljYXRpb24gZXJyb3IsIHRyeSB0byByZWNvbm5lY3RcbiAgICAgIGNvbnNvbGUubG9nKCdnZW5lcmF0b3IgY291bnQnLCB0b2tlbkdlbmVyYXRvci5nZXRDb3VudCgpKTtcbiAgICAgIGlmICh0b2tlbkdlbmVyYXRvci5nZXRDb3VudCgpID4gMSkge1xuICAgICAgICAkLnB1Ymxpc2goJ2hhcmRzb2NrZXRzdG9wJyk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIGF1dGhvcml6YXRpb24gdG9rZW4gaXMgY3VycmVudGx5IGF2YWlsYWJsZVwiKTtcbiAgICAgIH1cbiAgICAgIHRva2VuR2VuZXJhdG9yLmdldFRva2VuKGZ1bmN0aW9uKHRva2VuLCBlcnIpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICQucHVibGlzaCgnaGFyZHNvY2tldHN0b3AnKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS5sb2coJ0ZldGNoaW5nIGFkZGl0aW9uYWwgdG9rZW4uLi4nKTtcbiAgICAgICAgb3B0aW9ucy50b2tlbiA9IHRva2VuO1xuICAgICAgICBpbml0U29ja2V0KG9wdGlvbnMsIG9ub3Blbiwgb25saXN0ZW5pbmcsIG9ubWVzc2FnZSwgb25lcnJvciwgb25jbG9zZSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGV2dC5jb2RlID09PSAxMDExKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdTZXJ2ZXIgZXJyb3IgJyArIGV2dC5jb2RlICsgJzogcGxlYXNlIHJlZnJlc2ggeW91ciBicm93c2VyIGFuZCB0cnkgYWdhaW4nKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGV2dC5jb2RlID4gMTAwMCkge1xuICAgICAgY29uc29sZS5lcnJvcignU2VydmVyIGVycm9yICcgKyBldnQuY29kZSArICc6IHBsZWFzZSByZWZyZXNoIHlvdXIgYnJvd3NlciBhbmQgdHJ5IGFnYWluJyk7XG4gICAgICAvLyBzaG93RXJyb3IoJ1NlcnZlciBlcnJvciAnICsgZXZ0LmNvZGUgKyAnOiBwbGVhc2UgcmVmcmVzaCB5b3VyIGJyb3dzZXIgYW5kIHRyeSBhZ2FpbicpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBNYWRlIGl0IHRocm91Z2gsIG5vcm1hbCBjbG9zZVxuICAgICQudW5zdWJzY3JpYmUoJ2hhcmRzb2NrZXRzdG9wJyk7XG4gICAgJC51bnN1YnNjcmliZSgnc29ja2V0c3RvcCcpO1xuICAgIG9uY2xvc2UoZXZ0KTtcbiAgfTtcblxufSIsIlxuLy8gRm9yIG5vbi12aWV3IGxvZ2ljXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93LmpRdWVyeSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwualF1ZXJ5IDogbnVsbCk7XG5cbnZhciBmaWxlQmxvY2sgPSBmdW5jdGlvbihfb2Zmc2V0LCBsZW5ndGgsIF9maWxlLCByZWFkQ2h1bmspIHtcbiAgdmFyIHIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICB2YXIgYmxvYiA9IF9maWxlLnNsaWNlKF9vZmZzZXQsIGxlbmd0aCArIF9vZmZzZXQpO1xuICByLm9ubG9hZCA9IHJlYWRDaHVuaztcbiAgci5yZWFkQXNBcnJheUJ1ZmZlcihibG9iKTtcbn1cblxuLy8gQmFzZWQgb24gYWxlZGlhZmVyaWEncyBTTyByZXNwb25zZVxuLy8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xNDQzODE4Ny9qYXZhc2NyaXB0LWZpbGVyZWFkZXItcGFyc2luZy1sb25nLWZpbGUtaW4tY2h1bmtzXG5leHBvcnRzLm9uRmlsZVByb2dyZXNzID0gZnVuY3Rpb24ob3B0aW9ucywgb25kYXRhLCBvbmVycm9yLCBvbmVuZCkge1xuICB2YXIgZmlsZSAgICAgICA9IG9wdGlvbnMuZmlsZTtcbiAgdmFyIGZpbGVTaXplICAgPSBmaWxlLnNpemU7XG4gIHZhciBjaHVua1NpemUgID0gb3B0aW9ucy5idWZmZXJTaXplIHx8IDgxOTI7XG4gIHZhciBvZmZzZXQgICAgID0gMDtcbiAgdmFyIHJlYWRDaHVuayA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIGlmIChvZmZzZXQgPj0gZmlsZVNpemUpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiRG9uZSByZWFkaW5nIGZpbGVcIik7XG4gICAgICBvbmVuZCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoZXZ0LnRhcmdldC5lcnJvciA9PSBudWxsKSB7XG4gICAgICB2YXIgYnVmZmVyID0gZXZ0LnRhcmdldC5yZXN1bHQ7XG4gICAgICB2YXIgbGVuID0gYnVmZmVyLmJ5dGVMZW5ndGg7XG4gICAgICBvZmZzZXQgKz0gbGVuO1xuICAgICAgb25kYXRhKGJ1ZmZlcik7IC8vIGNhbGxiYWNrIGZvciBoYW5kbGluZyByZWFkIGNodW5rXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBlcnJvck1lc3NhZ2UgPSBldnQudGFyZ2V0LmVycm9yO1xuICAgICAgY29uc29sZS5sb2coXCJSZWFkIGVycm9yOiBcIiArIGVycm9yTWVzc2FnZSk7XG4gICAgICBvbmVycm9yKGVycm9yTWVzc2FnZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGZpbGVCbG9jayhvZmZzZXQsIGNodW5rU2l6ZSwgZmlsZSwgcmVhZENodW5rKTtcbiAgfVxuICBmaWxlQmxvY2sob2Zmc2V0LCBjaHVua1NpemUsIGZpbGUsIHJlYWRDaHVuayk7XG59XG5cbmV4cG9ydHMuY3JlYXRlVG9rZW5HZW5lcmF0b3IgPSBmdW5jdGlvbigpIHtcbiAgLy8gTWFrZSBjYWxsIHRvIEFQSSB0byB0cnkgYW5kIGdldCB0b2tlblxuICB2YXIgaGFzQmVlblJ1blRpbWVzID0gMDtcbiAgcmV0dXJuIHtcbiAgICBnZXRUb2tlbjogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICArK2hhc0JlZW5SdW5UaW1lcztcbiAgICBpZiAoaGFzQmVlblJ1blRpbWVzID4gNSkge1xuICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignQ2Fubm90IHJlYWNoIHNlcnZlcicpO1xuICAgICAgY2FsbGJhY2sobnVsbCwgZXJyKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHVybCA9ICcvdG9rZW4nO1xuICAgIHZhciB0b2tlblJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB0b2tlblJlcXVlc3Qub3BlbihcIkdFVFwiLCB1cmwsIHRydWUpO1xuICAgIHRva2VuUmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbihldnQpIHtcbiAgICAgIHZhciB0b2tlbiA9IHRva2VuUmVxdWVzdC5yZXNwb25zZVRleHQ7XG4gICAgICBjYWxsYmFjayh0b2tlbik7XG4gICAgfTtcbiAgICB0b2tlblJlcXVlc3Quc2VuZCgpO1xuICAgIH0sXG4gICAgZ2V0Q291bnQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gaGFzQmVlblJ1blRpbWVzOyB9XG4gIH1cbn07XG5cbmV4cG9ydHMuZ2V0VG9rZW4gPSAoZnVuY3Rpb24oKSB7XG4gIC8vIE1ha2UgY2FsbCB0byBBUEkgdG8gdHJ5IGFuZCBnZXQgdG9rZW5cbiAgdmFyIGhhc0JlZW5SdW5UaW1lcyA9IDA7XG4gIHJldHVybiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIGhhc0JlZW5SdW5UaW1lcysrXG4gICAgaWYgKGhhc0JlZW5SdW5UaW1lcyA+IDUpIHtcbiAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoJ0Nhbm5vdCByZWFjaCBzZXJ2ZXInKTtcbiAgICAgIGNhbGxiYWNrKG51bGwsIGVycik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB1cmwgPSAnL3Rva2VuJztcbiAgICB2YXIgdG9rZW5SZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgdG9rZW5SZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgdXJsLCB0cnVlKTtcbiAgICB0b2tlblJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgICB2YXIgdG9rZW4gPSB0b2tlblJlcXVlc3QucmVzcG9uc2VUZXh0O1xuICAgICAgY2FsbGJhY2sodG9rZW4pO1xuICAgIH07XG4gICAgdG9rZW5SZXF1ZXN0LnNlbmQoKTtcbiAgfVxufSkoKTtcblxuZXhwb3J0cy5pbml0UHViU3ViID0gZnVuY3Rpb24oKSB7XG4gIHZhciBvICAgICAgICAgPSAkKHt9KTtcbiAgJC5zdWJzY3JpYmUgICA9IG8ub24uYmluZChvKTtcbiAgJC51bnN1YnNjcmliZSA9IG8ub2ZmLmJpbmQobyk7XG4gICQucHVibGlzaCAgICAgPSBvLnRyaWdnZXIuYmluZChvKTtcbn0iLCJcblxuZXhwb3J0cy5pbml0QW5pbWF0ZVBhbmVsID0gZnVuY3Rpb24oKSB7XG4gICQoJy5wYW5lbC1oZWFkaW5nIHNwYW4uY2xpY2thYmxlJykub24oXCJjbGlja1wiLCBmdW5jdGlvbiAoZSkge1xuICAgIGlmICgkKHRoaXMpLmhhc0NsYXNzKCdwYW5lbC1jb2xsYXBzZWQnKSkge1xuICAgICAgLy8gZXhwYW5kIHRoZSBwYW5lbFxuICAgICAgJCh0aGlzKS5wYXJlbnRzKCcucGFuZWwnKS5maW5kKCcucGFuZWwtYm9keScpLnNsaWRlRG93bigpO1xuICAgICAgJCh0aGlzKS5yZW1vdmVDbGFzcygncGFuZWwtY29sbGFwc2VkJyk7XG4gICAgICAkKHRoaXMpLmZpbmQoJ2knKS5yZW1vdmVDbGFzcygnY2FyZXQtZG93bicpLmFkZENsYXNzKCdjYXJldC11cCcpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIGNvbGxhcHNlIHRoZSBwYW5lbFxuICAgICAgJCh0aGlzKS5wYXJlbnRzKCcucGFuZWwnKS5maW5kKCcucGFuZWwtYm9keScpLnNsaWRlVXAoKTtcbiAgICAgICQodGhpcykuYWRkQ2xhc3MoJ3BhbmVsLWNvbGxhcHNlZCcpO1xuICAgICAgJCh0aGlzKS5maW5kKCdpJykucmVtb3ZlQ2xhc3MoJ2NhcmV0LXVwJykuYWRkQ2xhc3MoJ2NhcmV0LWRvd24nKTtcbiAgICB9XG4gIH0pO1xufVxuXG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cualF1ZXJ5IDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbC5qUXVlcnkgOiBudWxsKTtcbnZhciBzY3JvbGxlZCA9IGZhbHNlO1xuXG52YXIgc2hvd1RpbWVzdGFtcCA9IGZ1bmN0aW9uKHRpbWVzdGFtcHMsIGNvbmZpZGVuY2VzKSB7XG4gIHZhciB3b3JkID0gdGltZXN0YW1wc1swXSxcbiAgICAgIHQwID0gdGltZXN0YW1wc1sxXSxcbiAgICAgIHQxID0gdGltZXN0YW1wc1syXTtcbiAgdmFyIHRpbWVsZW5ndGggPSB0MSAtIHQwO1xuICAvLyBTaG93IGNvbmZpZGVuY2UgaWYgZGVmaW5lZCwgZWxzZSAnbi9hJ1xuICB2YXIgZGlzcGxheUNvbmZpZGVuY2UgPSBjb25maWRlbmNlcyA/IGNvbmZpZGVuY2VzWzFdLnRvU3RyaW5nKCkuc3Vic3RyaW5nKDAsIDMpIDogJ24vYSc7XG4gICQoJyNtZXRhZGF0YVRhYmxlID4gdGJvZHk6bGFzdC1jaGlsZCcpLmFwcGVuZChcbiAgICAgICc8dHI+J1xuICAgICAgKyAnPHRkPicgKyB3b3JkICsgJzwvdGQ+J1xuICAgICAgKyAnPHRkPicgKyB0MCArICc8L3RkPidcbiAgICAgICsgJzx0ZD4nICsgdDEgKyAnPC90ZD4nXG4gICAgICArICc8dGQ+JyArIGRpc3BsYXlDb25maWRlbmNlICsgJzwvdGQ+J1xuICAgICAgKyAnPC90cj4nXG4gICAgICApO1xufVxuXG5cbnZhciBzaG93TWV0YURhdGEgPSBmdW5jdGlvbihhbHRlcm5hdGl2ZSkge1xuICB2YXIgY29uZmlkZW5jZU5lc3RlZEFycmF5ID0gYWx0ZXJuYXRpdmUud29yZF9jb25maWRlbmNlOztcbiAgdmFyIHRpbWVzdGFtcE5lc3RlZEFycmF5ID0gYWx0ZXJuYXRpdmUudGltZXN0YW1wcztcbiAgaWYgKGNvbmZpZGVuY2VOZXN0ZWRBcnJheSAmJiBjb25maWRlbmNlTmVzdGVkQXJyYXkubGVuZ3RoID4gMCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29uZmlkZW5jZU5lc3RlZEFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgdGltZXN0YW1wcyA9IHRpbWVzdGFtcE5lc3RlZEFycmF5W2ldO1xuICAgICAgdmFyIGNvbmZpZGVuY2VzID0gY29uZmlkZW5jZU5lc3RlZEFycmF5W2ldO1xuICAgICAgc2hvd1RpbWVzdGFtcCh0aW1lc3RhbXBzLCBjb25maWRlbmNlcyk7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfSBlbHNlIHtcbiAgICBpZiAodGltZXN0YW1wTmVzdGVkQXJyYXkgJiYgdGltZXN0YW1wTmVzdGVkQXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgdGltZXN0YW1wTmVzdGVkQXJyYXkuZm9yRWFjaChmdW5jdGlvbih0aW1lc3RhbXApIHtcbiAgICAgICAgc2hvd1RpbWVzdGFtcCh0aW1lc3RhbXApO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5cbnZhciBBbHRlcm5hdGl2ZXMgPSBmdW5jdGlvbigpe1xuXG4gIHZhciBzdHJpbmdPbmUgPSAnJyxcbiAgICBzdHJpbmdUd28gPSAnJyxcbiAgICBzdHJpbmdUaHJlZSA9ICcnO1xuXG4gIHRoaXMuY2xlYXJTdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICBzdHJpbmdPbmUgPSAnJztcbiAgICBzdHJpbmdUd28gPSAnJztcbiAgICBzdHJpbmdUaHJlZSA9ICcnO1xuICB9O1xuXG4gIHRoaXMuc2hvd0FsdGVybmF0aXZlcyA9IGZ1bmN0aW9uKGFsdGVybmF0aXZlcywgaXNGaW5hbCwgdGVzdGluZykge1xuICAgIHZhciAkaHlwb3RoZXNlcyA9ICQoJy5oeXBvdGhlc2VzIG9sJyk7XG4gICAgJGh5cG90aGVzZXMuZW1wdHkoKTtcbiAgICAvLyAkaHlwb3RoZXNlcy5hcHBlbmQoJCgnPC9icj4nKSk7XG4gICAgYWx0ZXJuYXRpdmVzLmZvckVhY2goZnVuY3Rpb24oYWx0ZXJuYXRpdmUsIGlkeCkge1xuICAgICAgdmFyICRhbHRlcm5hdGl2ZTtcbiAgICAgIGlmIChhbHRlcm5hdGl2ZS50cmFuc2NyaXB0KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdBTFRFUk5BVElWRVMgSU5ERVgnLCBpZHgpO1xuICAgICAgICB2YXIgdHJhbnNjcmlwdCA9IGFsdGVybmF0aXZlLnRyYW5zY3JpcHQucmVwbGFjZSgvJUhFU0lUQVRJT05cXHMvZywgJycpO1xuICAgICAgICB0cmFuc2NyaXB0ID0gdHJhbnNjcmlwdC5yZXBsYWNlKC8oLilcXDF7Mix9L2csICcnKTtcbiAgICAgICAgc3dpdGNoIChpZHgpIHtcbiAgICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICBzdHJpbmdPbmUgPSBzdHJpbmdPbmUgKyB0cmFuc2NyaXB0O1xuICAgICAgICAgICAgJGFsdGVybmF0aXZlID0gJCgnPGxpIGRhdGEtaHlwb3RoZXNpcy1pbmRleD0nICsgaWR4ICsgJyA+JyArIHN0cmluZ09uZSArICc8L2xpPicpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgc3RyaW5nVHdvID0gc3RyaW5nVHdvICsgdHJhbnNjcmlwdDtcbiAgICAgICAgICAgICRhbHRlcm5hdGl2ZSA9ICQoJzxsaSBkYXRhLWh5cG90aGVzaXMtaW5kZXg9JyArIGlkeCArICcgPicgKyBzdHJpbmdUd28gKyAnPC9saT4nKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgIHN0cmluZ1RocmVlID0gc3RyaW5nVGhyZWUgKyB0cmFuc2NyaXB0O1xuICAgICAgICAgICAgJGFsdGVybmF0aXZlID0gJCgnPGxpIGRhdGEtaHlwb3RoZXNpcy1pbmRleD0nICsgaWR4ICsgJyA+JyArIHN0cmluZ1RocmVlICsgJzwvbGk+Jyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAkaHlwb3RoZXNlcy5hcHBlbmQoJGFsdGVybmF0aXZlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcbn1cblxudmFyIGFsdGVybmF0aXZlUHJvdG90eXBlID0gbmV3IEFsdGVybmF0aXZlcygpO1xuXG4vLyBUT0RPOiBDb252ZXJ0IHRvIGNsb3N1cmUgYXBwcm9hY2hcbnZhciBwcm9jZXNzU3RyaW5nID0gZnVuY3Rpb24oYmFzZVN0cmluZywgaXNGaW5pc2hlZCkge1xuXG4gIGlmIChpc0ZpbmlzaGVkKSB7XG4gICAgdmFyIGZvcm1hdHRlZFN0cmluZyA9IGJhc2VTdHJpbmcuc2xpY2UoMCwgLTEpO1xuICAgIGZvcm1hdHRlZFN0cmluZyA9IGZvcm1hdHRlZFN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIGZvcm1hdHRlZFN0cmluZy5zdWJzdHJpbmcoMSk7XG4gICAgZm9ybWF0dGVkU3RyaW5nID0gZm9ybWF0dGVkU3RyaW5nLnRyaW0oKSArICcuJztcbiAgICAkKCcjcmVzdWx0c1RleHQnKS52YWwoZm9ybWF0dGVkU3RyaW5nKTtcbiAgfSBlbHNlIHtcbiAgICAkKCcjcmVzdWx0c1RleHQnKS52YWwoYmFzZVN0cmluZyk7XG4gIH1cblxufVxuXG5leHBvcnRzLnNob3dKU09OID0gZnVuY3Rpb24obXNnLCBiYXNlSlNPTikge1xuICB2YXIganNvbiA9IEpTT04uc3RyaW5naWZ5KG1zZywgbnVsbCwgMik7XG4gIGJhc2VKU09OICs9IGpzb247XG4gIGJhc2VKU09OICs9ICdcXG4nO1xuICAkKCcjcmVzdWx0c0pTT04nKS52YWwoYmFzZUpTT04pO1xuICByZXR1cm4gYmFzZUpTT047XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVNjcm9sbCgpe1xuICAgIGlmKCFzY3JvbGxlZCl7XG4gICAgICAgIHZhciBlbGVtZW50ID0gJCgnLnRhYmxlLXNjcm9sbCcpLmdldCgwKTtcbiAgICAgICAgZWxlbWVudC5zY3JvbGxUb3AgPSBlbGVtZW50LnNjcm9sbEhlaWdodDtcbiAgICB9XG59XG5cbnZhciBpbml0U2Nyb2xsID0gZnVuY3Rpb24oKSB7XG4gICQoJy50YWJsZS1zY3JvbGwnKS5vbignc2Nyb2xsJywgZnVuY3Rpb24oKXtcbiAgICAgIHNjcm9sbGVkPXRydWU7XG4gIH0pO1xufVxuXG5cbmV4cG9ydHMuc2hvd1Jlc3VsdCA9IGZ1bmN0aW9uKG1zZywgYmFzZVN0cmluZywgY2FsbGJhY2spIHtcblxuICB2YXIgaWR4ID0gK21zZy5yZXN1bHRfaW5kZXg7XG5cbiAgaWYgKG1zZy5yZXN1bHRzICYmIG1zZy5yZXN1bHRzLmxlbmd0aCA+IDApIHtcblxuICAgIHZhciBhbHRlcm5hdGl2ZXMgPSBtc2cucmVzdWx0c1swXS5hbHRlcm5hdGl2ZXM7XG4gICAgdmFyIHRleHQgPSBtc2cucmVzdWx0c1swXS5hbHRlcm5hdGl2ZXNbMF0udHJhbnNjcmlwdCB8fCAnJztcblxuICAgIC8vQ2FwaXRhbGl6ZSBmaXJzdCB3b3JkXG4gICAgLy8gaWYgZmluYWwgcmVzdWx0cywgYXBwZW5kIGEgbmV3IHBhcmFncmFwaFxuICAgIGlmIChtc2cucmVzdWx0cyAmJiBtc2cucmVzdWx0c1swXSAmJiBtc2cucmVzdWx0c1swXS5maW5hbCkge1xuICAgICAgYmFzZVN0cmluZyArPSB0ZXh0O1xuICAgICAgdmFyIGRpc3BsYXlGaW5hbFN0cmluZyA9IGJhc2VTdHJpbmc7XG4gICAgICBkaXNwbGF5RmluYWxTdHJpbmcgPSBkaXNwbGF5RmluYWxTdHJpbmcucmVwbGFjZSgvJUhFU0lUQVRJT05cXHMvZywgJycpO1xuICAgICAgZGlzcGxheUZpbmFsU3RyaW5nID0gZGlzcGxheUZpbmFsU3RyaW5nLnJlcGxhY2UoLyguKVxcMXsyLH0vZywgJycpO1xuICAgICAgcHJvY2Vzc1N0cmluZyhkaXNwbGF5RmluYWxTdHJpbmcsIHRydWUpO1xuICAgICAgc2hvd01ldGFEYXRhKGFsdGVybmF0aXZlc1swXSk7XG4gICAgICAvLyBPbmx5IHNob3cgYWx0ZXJuYXRpdmVzIGlmIHdlJ3JlIGZpbmFsXG4gICAgICBhbHRlcm5hdGl2ZVByb3RvdHlwZS5zaG93QWx0ZXJuYXRpdmVzKGFsdGVybmF0aXZlcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciB0ZW1wU3RyaW5nID0gYmFzZVN0cmluZyArIHRleHQ7XG4gICAgICB0ZW1wU3RyaW5nID0gdGVtcFN0cmluZy5yZXBsYWNlKC8lSEVTSVRBVElPTlxccy9nLCAnJyk7XG4gICAgICB0ZW1wU3RyaW5nID0gdGVtcFN0cmluZy5yZXBsYWNlKC8oLilcXDF7Mix9L2csICcnKTtcbiAgICAgIHByb2Nlc3NTdHJpbmcodGVtcFN0cmluZywgZmFsc2UpO1xuICAgIH1cbiAgfVxuXG4gIHVwZGF0ZVNjcm9sbCgpO1xuXG4gIHJldHVybiBiYXNlU3RyaW5nO1xuXG59O1xuXG4kLnN1YnNjcmliZSgnY2xlYXJzY3JlZW4nLCBmdW5jdGlvbigpIHtcbiAgdmFyICRoeXBvdGhlc2VzID0gJCgnLmh5cG90aGVzZXMgdWwnKTtcbiAgc2Nyb2xsZWQgPSBmYWxzZTtcbiAgJGh5cG90aGVzZXMuZW1wdHkoKTtcbiAgYWx0ZXJuYXRpdmVQcm90b3R5cGUuY2xlYXJTdHJpbmcoKTtcbn0pOyIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgaGFuZGxlU2VsZWN0ZWRGaWxlID0gcmVxdWlyZSgnLi9maWxldXBsb2FkJykuaGFuZGxlU2VsZWN0ZWRGaWxlO1xuXG5leHBvcnRzLmluaXREcmFnRHJvcCA9IGZ1bmN0aW9uKGN0eCkge1xuXG4gIHZhciBkcmFnQW5kRHJvcFRhcmdldCA9ICQoZG9jdW1lbnQpO1xuXG4gIGRyYWdBbmREcm9wVGFyZ2V0Lm9uKCdkcmFnZW50ZXInLCBmdW5jdGlvbiAoZSkge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICB9KTtcblxuICBkcmFnQW5kRHJvcFRhcmdldC5vbignZHJhZ292ZXInLCBmdW5jdGlvbiAoZSkge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICB9KTtcblxuICBkcmFnQW5kRHJvcFRhcmdldC5vbignZHJvcCcsIGZ1bmN0aW9uIChlKSB7XG4gICAgY29uc29sZS5sb2coJ0ZpbGUgZHJvcHBlZCcpO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB2YXIgZXZ0ID0gZS5vcmlnaW5hbEV2ZW50O1xuICAgIC8vIEhhbmRsZSBkcmFnZ2VkIGZpbGUgZXZlbnRcbiAgICBoYW5kbGVGaWxlVXBsb2FkRXZlbnQoZXZ0KTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gaGFuZGxlRmlsZVVwbG9hZEV2ZW50KGV2dCkge1xuICAgIC8vIEluaXQgZmlsZSB1cGxvYWQgd2l0aCBkZWZhdWx0IG1vZGVsXG4gICAgdmFyIGZpbGUgPSBldnQuZGF0YVRyYW5zZmVyLmZpbGVzWzBdO1xuICAgIGhhbmRsZVNlbGVjdGVkRmlsZShjdHgudG9rZW4sIGZpbGUpO1xuICB9XG5cbn1cbiIsIlxuXG5cbmV4cG9ydHMuZmxhc2hTVkcgPSBmdW5jdGlvbihlbCkge1xuICBlbC5jc3MoeyBmaWxsOiAnI0E1MzcyNScgfSk7XG4gIGZ1bmN0aW9uIGxvb3AoKSB7XG4gICAgZWwuYW5pbWF0ZSh7IGZpbGw6ICcjQTUzNzI1JyB9LFxuICAgICAgICAxMDAwLCAnbGluZWFyJylcbiAgICAgIC5hbmltYXRlKHsgZmlsbDogJ3doaXRlJyB9LFxuICAgICAgICAgIDEwMDAsICdsaW5lYXInKTtcbiAgfVxuICAvLyByZXR1cm4gdGltZXJcbiAgdmFyIHRpbWVyID0gc2V0VGltZW91dChsb29wLCAyMDAwKTtcbiAgcmV0dXJuIHRpbWVyO1xufTtcblxuZXhwb3J0cy5zdG9wRmxhc2hTVkcgPSBmdW5jdGlvbih0aW1lcikge1xuICBlbC5jc3MoeyBmaWxsOiAnd2hpdGUnIH0gKTtcbiAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG59XG5cbmV4cG9ydHMudG9nZ2xlSW1hZ2UgPSBmdW5jdGlvbihlbCwgbmFtZSkge1xuICBpZihlbC5hdHRyKCdzcmMnKSA9PT0gJ2ltZy8nICsgbmFtZSArICcuc3ZnJykge1xuICAgIGVsLmF0dHIoXCJzcmNcIiwgJ2ltZy9zdG9wLXJlZC5zdmcnKTtcbiAgfSBlbHNlIHtcbiAgICBlbC5hdHRyKCdzcmMnLCAnaW1nL3N0b3Auc3ZnJyk7XG4gIH1cbn1cblxudmFyIHJlc3RvcmVJbWFnZSA9IGV4cG9ydHMucmVzdG9yZUltYWdlID0gZnVuY3Rpb24oZWwsIG5hbWUpIHtcbiAgZWwuYXR0cignc3JjJywgJ2ltZy8nICsgbmFtZSArICcuc3ZnJyk7XG59XG5cbmV4cG9ydHMuc3RvcFRvZ2dsZUltYWdlID0gZnVuY3Rpb24odGltZXIsIGVsLCBuYW1lKSB7XG4gIGNsZWFySW50ZXJ2YWwodGltZXIpO1xuICByZXN0b3JlSW1hZ2UoZWwsIG5hbWUpO1xufVxuXG4iLCJcbid1c2Ugc3RyaWN0JztcblxudmFyIHNob3dFcnJvciA9IHJlcXVpcmUoJy4vc2hvd2Vycm9yJykuc2hvd0Vycm9yO1xudmFyIHNob3dOb3RpY2UgPSByZXF1aXJlKCcuL3Nob3dlcnJvcicpLnNob3dOb3RpY2U7XG52YXIgaGFuZGxlRmlsZVVwbG9hZCA9IHJlcXVpcmUoJy4uL2hhbmRsZWZpbGV1cGxvYWQnKS5oYW5kbGVGaWxlVXBsb2FkO1xudmFyIGVmZmVjdHMgPSByZXF1aXJlKCcuL2VmZmVjdHMnKTtcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4uL3V0aWxzJyk7XG5cbi8vIE5lZWQgdG8gcmVtb3ZlIHRoZSB2aWV3IGxvZ2ljIGhlcmUgYW5kIG1vdmUgdGhpcyBvdXQgdG8gdGhlIGhhbmRsZWZpbGV1cGxvYWQgY29udHJvbGxlclxudmFyIGhhbmRsZVNlbGVjdGVkRmlsZSA9IGV4cG9ydHMuaGFuZGxlU2VsZWN0ZWRGaWxlID0gKGZ1bmN0aW9uKCkge1xuXG4gICAgdmFyIHJ1bm5pbmcgPSBmYWxzZTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIGZhbHNlKTtcblxuICAgIHJldHVybiBmdW5jdGlvbih0b2tlbiwgZmlsZSkge1xuXG4gICAgdmFyIGN1cnJlbnRseURpc3BsYXlpbmcgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJykpO1xuXG4gICAgLy8gaWYgKGN1cnJlbnRseURpc3BsYXlpbmcpIHtcbiAgICAvLyAgIHNob3dFcnJvcignQ3VycmVudGx5IGFub3RoZXIgZmlsZSBpcyBwbGF5aW5nLCBwbGVhc2Ugc3RvcCB0aGUgZmlsZSBvciB3YWl0IHVudGlsIGl0IGZpbmlzaGVzJyk7XG4gICAgLy8gICByZXR1cm47XG4gICAgLy8gfVxuXG4gICAgJC5wdWJsaXNoKCdjbGVhcnNjcmVlbicpO1xuXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCB0cnVlKTtcbiAgICBydW5uaW5nID0gdHJ1ZTtcblxuICAgIC8vIFZpc3VhbCBlZmZlY3RzXG4gICAgdmFyIHVwbG9hZEltYWdlVGFnID0gJCgnI2ZpbGVVcGxvYWRUYXJnZXQgPiBpbWcnKTtcbiAgICB2YXIgdGltZXIgPSBzZXRJbnRlcnZhbChlZmZlY3RzLnRvZ2dsZUltYWdlLCA3NTAsIHVwbG9hZEltYWdlVGFnLCAnc3RvcCcpO1xuICAgIHZhciB1cGxvYWRUZXh0ID0gJCgnI2ZpbGVVcGxvYWRUYXJnZXQgPiBzcGFuJyk7XG4gICAgdXBsb2FkVGV4dC50ZXh0KCdTdG9wIFRyYW5zY3JpYmluZycpO1xuXG4gICAgZnVuY3Rpb24gcmVzdG9yZVVwbG9hZFRhYigpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGltZXIpO1xuICAgICAgZWZmZWN0cy5yZXN0b3JlSW1hZ2UodXBsb2FkSW1hZ2VUYWcsICd1cGxvYWQnKTtcbiAgICAgIHVwbG9hZFRleHQudGV4dCgnU2VsZWN0IEZpbGUnKTtcbiAgICB9XG5cbiAgICAvLyBDbGVhciBmbGFzaGluZyBpZiBzb2NrZXQgdXBsb2FkIGlzIHN0b3BwZWRcbiAgICAkLnN1YnNjcmliZSgnaGFyZHNvY2tldHN0b3AnLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICByZXN0b3JlVXBsb2FkVGFiKCk7XG4gICAgfSk7XG5cblxuICAgIC8vIEdldCBjdXJyZW50IG1vZGVsXG4gICAgdmFyIGN1cnJlbnRNb2RlbCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50TW9kZWwnKTtcbiAgICBjb25zb2xlLmxvZygnY3VycmVudE1vZGVsJywgY3VycmVudE1vZGVsKTtcblxuICAgIC8vIFJlYWQgZmlyc3QgNCBieXRlcyB0byBkZXRlcm1pbmUgaGVhZGVyXG4gICAgdmFyIGJsb2JUb1RleHQgPSBuZXcgQmxvYihbZmlsZV0pLnNsaWNlKDAsIDQpO1xuICAgIHZhciByID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICByLnJlYWRBc1RleHQoYmxvYlRvVGV4dCk7XG4gICAgci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjb250ZW50VHlwZTtcbiAgICAgIGlmIChyLnJlc3VsdCA9PT0gJ2ZMYUMnKSB7XG4gICAgICAgIGNvbnRlbnRUeXBlID0gJ2F1ZGlvL2ZsYWMnO1xuICAgICAgICBzaG93Tm90aWNlKCdOb3RpY2U6IGJyb3dzZXJzIGRvIG5vdCBzdXBwb3J0IHBsYXlpbmcgRkxBQyBhdWRpbywgc28gbm8gYXVkaW8gd2lsbCBhY2NvbXBhbnkgdGhlIHRyYW5zY3JpcHRpb24nKTtcbiAgICAgIH0gZWxzZSBpZiAoci5yZXN1bHQgPT09ICdSSUZGJykge1xuICAgICAgICBjb250ZW50VHlwZSA9ICdhdWRpby93YXYnO1xuICAgICAgICB2YXIgYXVkaW8gPSBuZXcgQXVkaW8oKTtcbiAgICAgICAgdmFyIHdhdkJsb2IgPSBuZXcgQmxvYihbZmlsZV0sIHt0eXBlOiAnYXVkaW8vd2F2J30pO1xuICAgICAgICB2YXIgd2F2VVJMID0gVVJMLmNyZWF0ZU9iamVjdFVSTCh3YXZCbG9iKTtcbiAgICAgICAgYXVkaW8uc3JjID0gd2F2VVJMO1xuICAgICAgICBhdWRpby5wbGF5KCk7XG4gICAgICAgICQuc3Vic2NyaWJlKCdoYXJkc29ja2V0c3RvcCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGF1ZGlvLnBhdXNlKCk7XG4gICAgICAgICAgYXVkaW8uY3VycmVudFRpbWUgPSAwO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3RvcmVVcGxvYWRUYWIoKTtcbiAgICAgICAgc2hvd0Vycm9yKCdPbmx5IFdBViBvciBGTEFDIGZpbGVzIGNhbiBiZSB0cmFuc2NyaWJlZCwgcGxlYXNlIHRyeSBhbm90aGVyIGZpbGUgZm9ybWF0Jyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGhhbmRsZUZpbGVVcGxvYWQodG9rZW4sIGN1cnJlbnRNb2RlbCwgZmlsZSwgY29udGVudFR5cGUsIGZ1bmN0aW9uKHNvY2tldCkge1xuICAgICAgICB2YXIgYmxvYiA9IG5ldyBCbG9iKFtmaWxlXSk7XG4gICAgICAgIHZhciBwYXJzZU9wdGlvbnMgPSB7XG4gICAgICAgICAgZmlsZTogYmxvYlxuICAgICAgICB9O1xuICAgICAgICB1dGlscy5vbkZpbGVQcm9ncmVzcyhwYXJzZU9wdGlvbnMsXG4gICAgICAgICAgLy8gT24gZGF0YSBjaHVua1xuICAgICAgICAgIGZ1bmN0aW9uKGNodW5rKSB7XG4gICAgICAgICAgICBzb2NrZXQuc2VuZChjaHVuayk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICAvLyBPbiBmaWxlIHJlYWQgZXJyb3JcbiAgICAgICAgICBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdFcnJvciByZWFkaW5nIGZpbGU6ICcsIGV2dC5tZXNzYWdlKTtcbiAgICAgICAgICAgIHNob3dFcnJvcignRXJyb3I6ICcgKyBldnQubWVzc2FnZSk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICAvLyBPbiBsb2FkIGVuZFxuICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoeydhY3Rpb24nOiAnc3RvcCd9KSk7XG4gICAgICAgICAgfSk7XG4gICAgICB9LCBcbiAgICAgICAgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgZWZmZWN0cy5zdG9wVG9nZ2xlSW1hZ2UodGltZXIsIHVwbG9hZEltYWdlVGFnLCAndXBsb2FkJyk7XG4gICAgICAgICAgdXBsb2FkVGV4dC50ZXh0KCdTZWxlY3QgRmlsZScpO1xuICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgICB9XG4gICAgICApO1xuICAgIH07XG4gIH1cbn0pKCk7XG5cblxuZXhwb3J0cy5pbml0RmlsZVVwbG9hZCA9IGZ1bmN0aW9uKGN0eCkge1xuXG4gIHZhciBmaWxlVXBsb2FkRGlhbG9nID0gJChcIiNmaWxlVXBsb2FkRGlhbG9nXCIpO1xuXG4gIGZpbGVVcGxvYWREaWFsb2cuY2hhbmdlKGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciBmaWxlID0gZmlsZVVwbG9hZERpYWxvZy5nZXQoMCkuZmlsZXNbMF07XG4gICAgaGFuZGxlU2VsZWN0ZWRGaWxlKGN0eC50b2tlbiwgZmlsZSk7XG4gIH0pO1xuXG4gICQoXCIjZmlsZVVwbG9hZFRhcmdldFwiKS5jbGljayhmdW5jdGlvbihldnQpIHtcblxuICAgIHZhciBjdXJyZW50bHlEaXNwbGF5aW5nID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycpKTtcblxuICAgIGlmIChjdXJyZW50bHlEaXNwbGF5aW5nKSB7XG4gICAgICBjb25zb2xlLmxvZygnSEFSRCBTT0NLRVQgU1RPUCcpO1xuICAgICAgJC5wdWJsaXNoKCdoYXJkc29ja2V0c3RvcCcpO1xuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZmlsZVVwbG9hZERpYWxvZy52YWwobnVsbCk7XG5cbiAgICBmaWxlVXBsb2FkRGlhbG9nXG4gICAgLnRyaWdnZXIoJ2NsaWNrJyk7XG5cbiAgfSk7XG5cbn0iLCJcbnZhciBpbml0U2Vzc2lvblBlcm1pc3Npb25zID0gcmVxdWlyZSgnLi9zZXNzaW9ucGVybWlzc2lvbnMnKS5pbml0U2Vzc2lvblBlcm1pc3Npb25zO1xudmFyIGluaXRTZWxlY3RNb2RlbCA9IHJlcXVpcmUoJy4vc2VsZWN0bW9kZWwnKS5pbml0U2VsZWN0TW9kZWw7XG52YXIgaW5pdEFuaW1hdGVQYW5lbCA9IHJlcXVpcmUoJy4vYW5pbWF0ZXBhbmVsJykuaW5pdEFuaW1hdGVQYW5lbDtcbnZhciBpbml0U2hvd1RhYiA9IHJlcXVpcmUoJy4vc2hvd3RhYicpLmluaXRTaG93VGFiO1xudmFyIGluaXREcmFnRHJvcCA9IHJlcXVpcmUoJy4vZHJhZ2Ryb3AnKS5pbml0RHJhZ0Ryb3A7XG52YXIgaW5pdFBsYXlTYW1wbGUgPSByZXF1aXJlKCcuL3BsYXlzYW1wbGUnKS5pbml0UGxheVNhbXBsZTtcbnZhciBpbml0UmVjb3JkQnV0dG9uID0gcmVxdWlyZSgnLi9yZWNvcmRidXR0b24nKS5pbml0UmVjb3JkQnV0dG9uO1xudmFyIGluaXRGaWxlVXBsb2FkID0gcmVxdWlyZSgnLi9maWxldXBsb2FkJykuaW5pdEZpbGVVcGxvYWQ7XG5cblxuZXhwb3J0cy5pbml0Vmlld3MgPSBmdW5jdGlvbihjdHgpIHtcbiAgY29uc29sZS5sb2coJ0luaXRpYWxpemluZyB2aWV3cy4uLicpO1xuICBpbml0U2VsZWN0TW9kZWwoY3R4KTtcbiAgaW5pdFBsYXlTYW1wbGUoY3R4KTtcbiAgaW5pdERyYWdEcm9wKGN0eCk7XG4gIGluaXRSZWNvcmRCdXR0b24oY3R4KTtcbiAgaW5pdEZpbGVVcGxvYWQoY3R4KTtcbiAgaW5pdFNlc3Npb25QZXJtaXNzaW9ucygpO1xuICBpbml0U2hvd1RhYigpO1xuICBpbml0QW5pbWF0ZVBhbmVsKCk7XG4gIGluaXRTaG93VGFiKCk7XG59IiwiXG4ndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4uL3V0aWxzJyk7XG52YXIgb25GaWxlUHJvZ3Jlc3MgPSB1dGlscy5vbkZpbGVQcm9ncmVzcztcbnZhciBoYW5kbGVGaWxlVXBsb2FkID0gcmVxdWlyZSgnLi4vaGFuZGxlZmlsZXVwbG9hZCcpLmhhbmRsZUZpbGVVcGxvYWQ7XG52YXIgaW5pdFNvY2tldCA9IHJlcXVpcmUoJy4uL3NvY2tldCcpLmluaXRTb2NrZXQ7XG52YXIgc2hvd0Vycm9yID0gcmVxdWlyZSgnLi9zaG93ZXJyb3InKS5zaG93RXJyb3I7XG52YXIgZWZmZWN0cyA9IHJlcXVpcmUoJy4vZWZmZWN0cycpO1xuXG5cbnZhciBMT09LVVBfVEFCTEUgPSB7XG4gICdlbi1VU19Ccm9hZGJhbmRNb2RlbCc6IFsnVXNfRW5nbGlzaF9Ccm9hZGJhbmRfU2FtcGxlXzEud2F2JywgJ1VzX0VuZ2xpc2hfQnJvYWRiYW5kX1NhbXBsZV8yLndhdiddLFxuICAnZW4tVVNfTmFycm93YmFuZE1vZGVsJzogWydVc19FbmdsaXNoX05hcnJvd2JhbmRfU2FtcGxlXzEud2F2JywgJ1VzX0VuZ2xpc2hfTmFycm93YmFuZF9TYW1wbGVfMi53YXYnXSxcbiAgJ2VzLUVTX0Jyb2FkYmFuZE1vZGVsJzogWydFc19FU19zcGsyNF8xNmtoei53YXYnLCAnRXNfRVNfc3BrMTlfMTZraHoud2F2J10sXG4gICdlcy1FU19OYXJyb3diYW5kTW9kZWwnOiBbJ0VzX0VTX3NwazI0XzhraHoud2F2JywgJ0VzX0VTX3NwazE5XzhraHoud2F2J10sXG4gICdqYS1KUF9Ccm9hZGJhbmRNb2RlbCc6IFsnc2FtcGxlLUphX0pQLXdpZGUxLndhdicsICdzYW1wbGUtSmFfSlAtd2lkZTIud2F2J10sXG4gICdqYS1KUF9OYXJyb3diYW5kTW9kZWwnOiBbJ3NhbXBsZS1KYV9KUC1uYXJyb3czLndhdicsICdzYW1wbGUtSmFfSlAtbmFycm93NC53YXYnXVxufTtcblxudmFyIHBsYXlTYW1wbGUgPSAoZnVuY3Rpb24oKSB7XG5cbiAgdmFyIHJ1bm5pbmcgPSBmYWxzZTtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHRva2VuLCBpbWFnZVRhZywgaWNvbk5hbWUsIHVybCwgY2FsbGJhY2spIHtcblxuICAgICQucHVibGlzaCgnY2xlYXJzY3JlZW4nKTtcblxuICAgIHZhciBjdXJyZW50bHlEaXNwbGF5aW5nID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycpKTtcblxuICAgIGNvbnNvbGUubG9nKCdDVVJSRU5UTFkgRElTUExBWUlORycsIGN1cnJlbnRseURpc3BsYXlpbmcpO1xuXG4gICAgLy8gVGhpcyBlcnJvciBoYW5kbGluZyBuZWVkcyB0byBiZSBleHBhbmRlZCB0byBhY2NvbW9kYXRlXG4gICAgLy8gdGhlIHR3byBkaWZmZXJlbnQgcGxheSBzYW1wbGVzIGZpbGVzXG4gICAgaWYgKGN1cnJlbnRseURpc3BsYXlpbmcpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdIQVJEIFNPQ0tFVCBTVE9QJyk7XG4gICAgICAkLnB1Ymxpc2goJ3NvY2tldHN0b3AnKTtcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgZWZmZWN0cy5zdG9wVG9nZ2xlSW1hZ2UodGltZXIsIGltYWdlVGFnLCBpY29uTmFtZSk7XG4gICAgICBlZmZlY3RzLnJlc3RvcmVJbWFnZShpbWFnZVRhZywgaWNvbk5hbWUpO1xuICAgICAgcnVubmluZyA9IGZhbHNlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChjdXJyZW50bHlEaXNwbGF5aW5nICYmIHJ1bm5pbmcpIHtcbiAgICAgIHNob3dFcnJvcignQ3VycmVudGx5IGFub3RoZXIgZmlsZSBpcyBwbGF5aW5nLCBwbGVhc2Ugc3RvcCB0aGUgZmlsZSBvciB3YWl0IHVudGlsIGl0IGZpbmlzaGVzJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCB0cnVlKTtcbiAgICBydW5uaW5nID0gdHJ1ZTtcblxuICAgIHZhciB0aW1lciA9IHNldEludGVydmFsKGVmZmVjdHMudG9nZ2xlSW1hZ2UsIDc1MCwgaW1hZ2VUYWcsIGljb25OYW1lKTtcblxuICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB4aHIub3BlbignR0VUJywgdXJsLCB0cnVlKTtcbiAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2Jsb2InO1xuICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbihlKSB7XG4gICAgICB2YXIgYmxvYiA9IHhoci5yZXNwb25zZTtcbiAgICAgIHZhciBjdXJyZW50TW9kZWwgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudE1vZGVsJykgfHwgJ2VuLVVTX0Jyb2FkYmFuZE1vZGVsJztcbiAgICAgIHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgdmFyIGJsb2JUb1RleHQgPSBuZXcgQmxvYihbYmxvYl0pLnNsaWNlKDAsIDQpO1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoYmxvYlRvVGV4dCk7XG4gICAgICByZWFkZXIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBjb250ZW50VHlwZSA9IHJlYWRlci5yZXN1bHQgPT09ICdmTGFDJyA/ICdhdWRpby9mbGFjJyA6ICdhdWRpby93YXYnO1xuICAgICAgICBjb25zb2xlLmxvZygnVXBsb2FkaW5nIGZpbGUnLCByZWFkZXIucmVzdWx0KTtcbiAgICAgICAgdmFyIG1lZGlhU291cmNlVVJMID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgICAgICAgdmFyIGF1ZGlvID0gbmV3IEF1ZGlvKCk7XG4gICAgICAgIGF1ZGlvLnNyYyA9IG1lZGlhU291cmNlVVJMO1xuICAgICAgICBhdWRpby5wbGF5KCk7XG4gICAgICAgICQuc3Vic2NyaWJlKCdoYXJkc29ja2V0c3RvcCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGF1ZGlvLnBhdXNlKCk7XG4gICAgICAgICAgYXVkaW8uY3VycmVudFRpbWUgPSAwO1xuICAgICAgICB9KTtcbiAgICAgICAgJC5zdWJzY3JpYmUoJ3NvY2tldHN0b3AnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBhdWRpby5wYXVzZSgpO1xuICAgICAgICAgIGF1ZGlvLmN1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgfSk7XG4gICAgICAgIGhhbmRsZUZpbGVVcGxvYWQodG9rZW4sIGN1cnJlbnRNb2RlbCwgYmxvYiwgY29udGVudFR5cGUsIGZ1bmN0aW9uKHNvY2tldCkge1xuICAgICAgICAgIHZhciBwYXJzZU9wdGlvbnMgPSB7XG4gICAgICAgICAgICBmaWxlOiBibG9iXG4gICAgICAgICAgfTtcbiAgICAgICAgICBvbkZpbGVQcm9ncmVzcyhwYXJzZU9wdGlvbnMsXG4gICAgICAgICAgICAvLyBPbiBkYXRhIGNodW5rXG4gICAgICAgICAgICBmdW5jdGlvbihjaHVuaykge1xuICAgICAgICAgICAgICBzb2NrZXQuc2VuZChjaHVuayk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgLy8gT24gZmlsZSByZWFkIGVycm9yXG4gICAgICAgICAgICBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0Vycm9yIHJlYWRpbmcgZmlsZTogJywgZXZ0Lm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAvLyBzaG93RXJyb3IoZXZ0Lm1lc3NhZ2UpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIC8vIE9uIGxvYWQgZW5kXG4gICAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoeydhY3Rpb24nOiAnc3RvcCd9KSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgXG4gICAgICAgIC8vIE9uIGNvbm5lY3Rpb24gZW5kXG4gICAgICAgICAgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICBlZmZlY3RzLnN0b3BUb2dnbGVJbWFnZSh0aW1lciwgaW1hZ2VUYWcsIGljb25OYW1lKTtcbiAgICAgICAgICAgIGVmZmVjdHMucmVzdG9yZUltYWdlKGltYWdlVGFnLCBpY29uTmFtZSk7XG4gICAgICAgICAgICBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIGZhbHNlKTtcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9O1xuICAgIH07XG4gICAgeGhyLnNlbmQoKTtcbiAgfTtcbn0pKCk7XG5cblxuZXhwb3J0cy5pbml0UGxheVNhbXBsZSA9IGZ1bmN0aW9uKGN0eCkge1xuXG4gIChmdW5jdGlvbigpIHtcbiAgICB2YXIgZmlsZU5hbWUgPSAnYXVkaW8vJyArIExPT0tVUF9UQUJMRVtjdHguY3VycmVudE1vZGVsXVswXTtcbiAgICB2YXIgZWwgPSAkKCcucGxheS1zYW1wbGUtMScpO1xuICAgIGVsLm9mZignY2xpY2snKTtcbiAgICB2YXIgaWNvbk5hbWUgPSAncGxheSc7XG4gICAgdmFyIGltYWdlVGFnID0gZWwuZmluZCgnaW1nJyk7XG4gICAgZWwuY2xpY2soIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgcGxheVNhbXBsZShjdHgudG9rZW4sIGltYWdlVGFnLCBpY29uTmFtZSwgZmlsZU5hbWUsIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBjb25zb2xlLmxvZygnUGxheSBzYW1wbGUgcmVzdWx0JywgcmVzdWx0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KShjdHgsIExPT0tVUF9UQUJMRSk7XG5cbiAgKGZ1bmN0aW9uKCkge1xuICAgIHZhciBmaWxlTmFtZSA9ICdhdWRpby8nICsgTE9PS1VQX1RBQkxFW2N0eC5jdXJyZW50TW9kZWxdWzFdO1xuICAgIHZhciBlbCA9ICQoJy5wbGF5LXNhbXBsZS0yJyk7XG4gICAgZWwub2ZmKCdjbGljaycpO1xuICAgIHZhciBpY29uTmFtZSA9ICdwbGF5JztcbiAgICB2YXIgaW1hZ2VUYWcgPSBlbC5maW5kKCdpbWcnKTtcbiAgICBlbC5jbGljayggZnVuY3Rpb24oZXZ0KSB7XG4gICAgICBwbGF5U2FtcGxlKGN0eC50b2tlbiwgaW1hZ2VUYWcsIGljb25OYW1lLCBmaWxlTmFtZSwgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdQbGF5IHNhbXBsZSByZXN1bHQnLCByZXN1bHQpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pKGN0eCwgTE9PS1VQX1RBQkxFKTtcblxufTsiLCJcbid1c2Ugc3RyaWN0JztcblxudmFyIE1pY3JvcGhvbmUgPSByZXF1aXJlKCcuLi9NaWNyb3Bob25lJyk7XG52YXIgaGFuZGxlTWljcm9waG9uZSA9IHJlcXVpcmUoJy4uL2hhbmRsZW1pY3JvcGhvbmUnKS5oYW5kbGVNaWNyb3Bob25lO1xudmFyIHNob3dFcnJvciA9IHJlcXVpcmUoJy4vc2hvd2Vycm9yJykuc2hvd0Vycm9yO1xuXG5leHBvcnRzLmluaXRSZWNvcmRCdXR0b24gPSBmdW5jdGlvbihjdHgpIHtcblxuICB2YXIgcmVjb3JkQnV0dG9uID0gJCgnI3JlY29yZEJ1dHRvbicpO1xuXG4gIHJlY29yZEJ1dHRvbi5jbGljaygoZnVuY3Rpb24oKSB7XG5cbiAgICB2YXIgcnVubmluZyA9IGZhbHNlO1xuICAgIHZhciB0b2tlbiA9IGN0eC50b2tlbjtcbiAgICB2YXIgbWljT3B0aW9ucyA9IHtcbiAgICAgIGJ1ZmZlclNpemU6IGN0eC5idWZmZXJzaXplXG4gICAgfTtcbiAgICB2YXIgbWljID0gbmV3IE1pY3JvcGhvbmUobWljT3B0aW9ucyk7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAvLyBQcmV2ZW50IGRlZmF1bHQgYW5jaG9yIGJlaGF2aW9yXG4gICAgICBldnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgdmFyIGN1cnJlbnRNb2RlbCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50TW9kZWwnKTtcbiAgICAgIHZhciBjdXJyZW50bHlEaXNwbGF5aW5nID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycpKTtcblxuICAgICAgaWYgKGN1cnJlbnRseURpc3BsYXlpbmcpIHtcbiAgICAgICAgc2hvd0Vycm9yKCdDdXJyZW50bHkgYW5vdGhlciBmaWxlIGlzIHBsYXlpbmcsIHBsZWFzZSBzdG9wIHRoZSBmaWxlIG9yIHdhaXQgdW50aWwgaXQgZmluaXNoZXMnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXJ1bm5pbmcpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ05vdCBydW5uaW5nLCBoYW5kbGVNaWNyb3Bob25lKCknKTtcbiAgICAgICAgaGFuZGxlTWljcm9waG9uZSh0b2tlbiwgY3VycmVudE1vZGVsLCBtaWMsIGZ1bmN0aW9uKGVyciwgc29ja2V0KSB7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgdmFyIG1zZyA9ICdFcnJvcjogJyArIGVyci5tZXNzYWdlO1xuICAgICAgICAgICAgY29uc29sZS5sb2cobXNnKTtcbiAgICAgICAgICAgIHNob3dFcnJvcihtc2cpO1xuICAgICAgICAgICAgcnVubmluZyA9IGZhbHNlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWNvcmRCdXR0b24uY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJyNkNzQxMDgnKTtcbiAgICAgICAgICAgIHJlY29yZEJ1dHRvbi5maW5kKCdpbWcnKS5hdHRyKCdzcmMnLCAnaW1nL3N0b3Auc3ZnJyk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnc3RhcnRpbmcgbWljJyk7XG4gICAgICAgICAgICBtaWMucmVjb3JkKCk7XG4gICAgICAgICAgICBydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1N0b3BwaW5nIG1pY3JvcGhvbmUsIHNlbmRpbmcgc3RvcCBhY3Rpb24gbWVzc2FnZScpO1xuICAgICAgICByZWNvcmRCdXR0b24ucmVtb3ZlQXR0cignc3R5bGUnKTtcbiAgICAgICAgcmVjb3JkQnV0dG9uLmZpbmQoJ2ltZycpLmF0dHIoJ3NyYycsICdpbWcvbWljcm9waG9uZS5zdmcnKTtcbiAgICAgICAgJC5wdWJsaXNoKCdoYXJkc29ja2V0c3RvcCcpO1xuICAgICAgICBtaWMuc3RvcCgpO1xuICAgICAgICBydW5uaW5nID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICB9KSgpKTtcbn0iLCJcbnZhciBpbml0UGxheVNhbXBsZSA9IHJlcXVpcmUoJy4vcGxheXNhbXBsZScpLmluaXRQbGF5U2FtcGxlO1xuXG5leHBvcnRzLmluaXRTZWxlY3RNb2RlbCA9IGZ1bmN0aW9uKGN0eCkge1xuXG4gIGZ1bmN0aW9uIGlzRGVmYXVsdChtb2RlbCkge1xuICAgIHJldHVybiBtb2RlbCA9PT0gJ2VuLVVTX0Jyb2FkYmFuZE1vZGVsJztcbiAgfVxuXG4gIGN0eC5tb2RlbHMuZm9yRWFjaChmdW5jdGlvbihtb2RlbCkge1xuICAgICQoXCIjZHJvcGRvd25NZW51TGlzdFwiKS5hcHBlbmQoXG4gICAgICAkKFwiPGxpPlwiKVxuICAgICAgICAuYXR0cigncm9sZScsICdwcmVzZW50YXRpb24nKVxuICAgICAgICAuYXBwZW5kKFxuICAgICAgICAgICQoJzxhPicpLmF0dHIoJ3JvbGUnLCAnbWVudS1pdGVtJylcbiAgICAgICAgICAgIC5hdHRyKCdocmVmJywgJy8nKVxuICAgICAgICAgICAgLmF0dHIoJ2RhdGEtbW9kZWwnLCBtb2RlbC5uYW1lKVxuICAgICAgICAgICAgLmFwcGVuZChtb2RlbC5kZXNjcmlwdGlvbilcbiAgICAgICAgICApXG4gICAgICApXG4gIH0pO1xuXG4gICQoXCIjZHJvcGRvd25NZW51TGlzdFwiKS5jbGljayhmdW5jdGlvbihldnQpIHtcbiAgICBldnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgY29uc29sZS5sb2coJ0NoYW5nZSB2aWV3JywgJChldnQudGFyZ2V0KS50ZXh0KCkpO1xuICAgIHZhciBuZXdNb2RlbERlc2NyaXB0aW9uID0gJChldnQudGFyZ2V0KS50ZXh0KCk7XG4gICAgdmFyIG5ld01vZGVsID0gJChldnQudGFyZ2V0KS5kYXRhKCdtb2RlbCcpO1xuICAgICQoJyNkcm9wZG93bk1lbnVEZWZhdWx0JykuZW1wdHkoKS50ZXh0KG5ld01vZGVsRGVzY3JpcHRpb24pO1xuICAgICQoJyNkcm9wZG93bk1lbnUxJykuZHJvcGRvd24oJ3RvZ2dsZScpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50TW9kZWwnLCBuZXdNb2RlbCk7XG4gICAgY3R4LmN1cnJlbnRNb2RlbCA9IG5ld01vZGVsO1xuICAgIGluaXRQbGF5U2FtcGxlKGN0eCk7XG4gICAgJC5wdWJsaXNoKCdjbGVhcnNjcmVlbicpO1xuICB9KTtcblxufSIsIlxuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLmluaXRTZXNzaW9uUGVybWlzc2lvbnMgPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJ0luaXRpYWxpemluZyBzZXNzaW9uIHBlcm1pc3Npb25zIGhhbmRsZXInKTtcbiAgLy8gUmFkaW8gYnV0dG9uc1xuICB2YXIgc2Vzc2lvblBlcm1pc3Npb25zUmFkaW8gPSAkKFwiI3Nlc3Npb25QZXJtaXNzaW9uc1JhZGlvR3JvdXAgaW5wdXRbdHlwZT0ncmFkaW8nXVwiKTtcbiAgc2Vzc2lvblBlcm1pc3Npb25zUmFkaW8uY2xpY2soZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIGNoZWNrZWRWYWx1ZSA9IHNlc3Npb25QZXJtaXNzaW9uc1JhZGlvLmZpbHRlcignOmNoZWNrZWQnKS52YWwoKTtcbiAgICBjb25zb2xlLmxvZygnY2hlY2tlZFZhbHVlJywgY2hlY2tlZFZhbHVlKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnc2Vzc2lvblBlcm1pc3Npb25zJywgY2hlY2tlZFZhbHVlKTtcbiAgfSk7XG59XG4iLCJcbid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5zaG93RXJyb3IgPSBmdW5jdGlvbihtc2cpIHtcbiAgY29uc29sZS5sb2coJ0Vycm9yOiAnLCBtc2cpO1xuICB2YXIgZXJyb3JBbGVydCA9ICQoJy5lcnJvci1yb3cnKTtcbiAgZXJyb3JBbGVydC5oaWRlKCk7XG4gIGVycm9yQWxlcnQuY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJyNkNzQxMDgnKTtcbiAgZXJyb3JBbGVydC5jc3MoJ2NvbG9yJywgJ3doaXRlJyk7XG4gIHZhciBlcnJvck1lc3NhZ2UgPSAkKCcjZXJyb3JNZXNzYWdlJyk7XG4gIGVycm9yTWVzc2FnZS50ZXh0KG1zZyk7XG4gIGVycm9yQWxlcnQuc2hvdygpO1xuICAkKCcjZXJyb3JDbG9zZScpLmNsaWNrKGZ1bmN0aW9uKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXJyb3JBbGVydC5oaWRlKCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9KTtcbn1cblxuZXhwb3J0cy5zaG93Tm90aWNlID0gZnVuY3Rpb24obXNnKSB7XG4gIGNvbnNvbGUubG9nKCdOb3RpY2U6ICcsIG1zZyk7XG4gIHZhciBub3RpY2VBbGVydCA9ICQoJy5ub3RpZmljYXRpb24tcm93Jyk7XG4gIG5vdGljZUFsZXJ0LmhpZGUoKTtcbiAgbm90aWNlQWxlcnQuY3NzKCdib3JkZXInLCAnMnB4IHNvbGlkICNlY2VjZWMnKTtcbiAgbm90aWNlQWxlcnQuY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJyNmNGY0ZjQnKTtcbiAgbm90aWNlQWxlcnQuY3NzKCdjb2xvcicsICdibGFjaycpO1xuICB2YXIgbm90aWNlTWVzc2FnZSA9ICQoJyNub3RpZmljYXRpb25NZXNzYWdlJyk7XG4gIG5vdGljZU1lc3NhZ2UudGV4dChtc2cpO1xuICBub3RpY2VBbGVydC5zaG93KCk7XG4gICQoJyNub3RpZmljYXRpb25DbG9zZScpLmNsaWNrKGZ1bmN0aW9uKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgbm90aWNlQWxlcnQuaGlkZSgpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSk7XG59XG5cbmV4cG9ydHMuaGlkZUVycm9yID0gZnVuY3Rpb24oKSB7XG4gIHZhciBlcnJvckFsZXJ0ID0gJCgnLmVycm9yLXJvdycpO1xuICBlcnJvckFsZXJ0LmhpZGUoKTtcbn0iLCJcblxuZXhwb3J0cy5pbml0U2hvd1RhYiA9IGZ1bmN0aW9uKCkge1xuICAkKCcjbmF2LXRhYnMgYScpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAkKHRoaXMpLnRhYignc2hvdycpXG4gIH0pO1xufVxuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4vKmdsb2JhbCAkOmZhbHNlICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIE1pY3JvcGhvbmUgPSByZXF1aXJlKCcuL01pY3JvcGhvbmUnKTtcbnZhciBtb2RlbHMgPSByZXF1aXJlKCcuL2RhdGEvbW9kZWxzLmpzb24nKS5tb2RlbHM7XG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG51dGlscy5pbml0UHViU3ViKCk7XG52YXIgaW5pdFZpZXdzID0gcmVxdWlyZSgnLi92aWV3cycpLmluaXRWaWV3cztcbnZhciBwa2cgPSByZXF1aXJlKCcuLi9wYWNrYWdlLmpzb24nKTtcblxud2luZG93LkJVRkZFUlNJWkUgPSA4MTkyO1xuXG4kKGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpIHtcblxuICAvLyBUZW1wb3JhcnkgYXBwIGRhdGFcbiAgJCgnI2FwcFNldHRpbmdzJylcbiAgICAuaHRtbChcbiAgICAgICc8cD5WZXJzaW9uOiAnICsgcGtnLnZlcnNpb24gKyAnPC9wPidcbiAgICAgICsgJzxwPkJ1ZmZlciBTaXplOiAnICsgQlVGRkVSU0laRSArICc8L3A+J1xuICAgICk7XG5cblxuICAvLyBNYWtlIGNhbGwgdG8gQVBJIHRvIHRyeSBhbmQgZ2V0IHRva2VuXG4gIHV0aWxzLmdldFRva2VuKGZ1bmN0aW9uKHRva2VuKSB7XG5cbiAgICB3aW5kb3cub25iZWZvcmV1bmxvYWQgPSBmdW5jdGlvbihlKSB7XG4gICAgICBsb2NhbFN0b3JhZ2UuY2xlYXIoKTtcbiAgICB9O1xuXG4gICAgaWYgKCF0b2tlbikge1xuICAgICAgY29uc29sZS5lcnJvcignTm8gYXV0aG9yaXphdGlvbiB0b2tlbiBhdmFpbGFibGUnKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0F0dGVtcHRpbmcgdG8gcmVjb25uZWN0Li4uJyk7XG4gICAgfVxuXG4gICAgdmFyIHZpZXdDb250ZXh0ID0ge1xuICAgICAgY3VycmVudE1vZGVsOiAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnLFxuICAgICAgbW9kZWxzOiBtb2RlbHMsXG4gICAgICB0b2tlbjogdG9rZW4sXG4gICAgICBidWZmZXJTaXplOiBCVUZGRVJTSVpFXG4gICAgfTtcblxuICAgIGluaXRWaWV3cyh2aWV3Q29udGV4dCk7XG5cbiAgICAvLyBTYXZlIG1vZGVscyB0byBsb2NhbHN0b3JhZ2VcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbW9kZWxzJywgSlNPTi5zdHJpbmdpZnkobW9kZWxzKSk7XG5cbiAgICAvLyBTZXQgZGVmYXVsdCBjdXJyZW50IG1vZGVsXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRNb2RlbCcsICdlbi1VU19Ccm9hZGJhbmRNb2RlbCcpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzZXNzaW9uUGVybWlzc2lvbnMnLCAndHJ1ZScpO1xuXG5cbiAgICAkLnN1YnNjcmliZSgnY2xlYXJzY3JlZW4nLCBmdW5jdGlvbigpIHtcbiAgICAgICQoJyNyZXN1bHRzVGV4dCcpLnRleHQoJycpO1xuICAgICAgJCgnI3Jlc3VsdHNKU09OJykudGV4dCgnJyk7XG4gICAgICAkKCcuZXJyb3Itcm93JykuaGlkZSgpO1xuICAgICAgJCgnLm5vdGlmaWNhdGlvbi1yb3cnKS5oaWRlKCk7XG4gICAgICAkKCcuaHlwb3RoZXNlcyA+IHVsJykuZW1wdHkoKTtcbiAgICAgICQoJyNtZXRhZGF0YVRhYmxlQm9keScpLmVtcHR5KCk7XG4gICAgfSk7XG5cbiAgfSk7XG5cbn0pOyJdfQ==
