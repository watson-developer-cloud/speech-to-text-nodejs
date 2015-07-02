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

  var startTime,
      allowedMicTime = 45;

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
    startTime = new Date();
    console.log('Mic socket: opened');
    callback(null, socket);
  }

  function onListening(socket) {

    mic.onAudio = function(blob) {
      var now = new Date();
      if ((now - startTime) > allowedMicTime * 1000) {
        $.publish('stopmic');
        $.publish('socketstop');
        return;
      }

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
  if(el.attr('src') === 'images/' + name + '.svg') {
    el.attr("src", 'images/stop-red.svg');
  } else {
    el.attr('src', 'images/stop.svg');
  }
}

var restoreImage = exports.restoreImage = function(el, name) {
  el.attr('src', 'images/' + name + '.svg');
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
var showNotice = require('./showerror').showNotice;

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

      $.subscribe('stopmic', function(data) {
        mic.stop();
        showNotice('Only 45 seconds or less of recorded audio are currently permitted in the demonstration');
        recordButton.removeAttr('style');
        recordButton.find('img').attr('src', 'images/microphone.svg');
        running = false;
      });

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
            recordButton.find('img').attr('src', 'images/stop.svg');
            console.log('starting mic');
            mic.record();
            running = true;
          }
        });
      } else {
        console.log('Stopping microphone, sending stop action message');
        recordButton.removeAttr('style');
        recordButton.find('img').attr('src', 'images/microphone.svg');
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
    localStorage.setItem('micRunning', 'false');


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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5ucG0vbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwicGFja2FnZS5qc29uIiwic3JjL01pY3JvcGhvbmUuanMiLCJzcmMvZGF0YS9tb2RlbHMuanNvbiIsInNyYy9oYW5kbGVmaWxldXBsb2FkLmpzIiwic3JjL2hhbmRsZW1pY3JvcGhvbmUuanMiLCJzcmMvc29ja2V0LmpzIiwic3JjL3V0aWxzLmpzIiwic3JjL3ZpZXdzL2FuaW1hdGVwYW5lbC5qcyIsInNyYy92aWV3cy9kaXNwbGF5bWV0YWRhdGEuanMiLCJzcmMvdmlld3MvZHJhZ2Ryb3AuanMiLCJzcmMvdmlld3MvZWZmZWN0cy5qcyIsInNyYy92aWV3cy9maWxldXBsb2FkLmpzIiwic3JjL3ZpZXdzL2luZGV4LmpzIiwic3JjL3ZpZXdzL3BsYXlzYW1wbGUuanMiLCJzcmMvdmlld3MvcmVjb3JkYnV0dG9uLmpzIiwic3JjL3ZpZXdzL3NlbGVjdG1vZGVsLmpzIiwic3JjL3ZpZXdzL3Nlc3Npb25wZXJtaXNzaW9ucy5qcyIsInNyYy92aWV3cy9zaG93ZXJyb3IuanMiLCJzcmMvdmlld3Mvc2hvd3RhYi5qcyIsInNyYy9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDL0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDMUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNqS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cz17XG4gIFwibmFtZVwiOiBcIlNwZWVjaFRvVGV4dEJyb3dzZXJTdGFydGVyQXBwXCIsXG4gIFwidmVyc2lvblwiOiBcIjAuMi4xXCIsXG4gIFwiZGVzY3JpcHRpb25cIjogXCJBIHNhbXBsZSBicm93c2VyIGFwcCBmb3IgQmx1ZW1peCB0aGF0IHVzZSB0aGUgc3BlZWNoLXRvLXRleHQgc2VydmljZSwgZmV0Y2hpbmcgYSB0b2tlbiB2aWEgTm9kZS5qc1wiLFxuICBcImRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJib2R5LXBhcnNlclwiOiBcIn4xLjEwLjJcIixcbiAgICBcImNvbm5lY3RcIjogXCJeMy4zLjVcIixcbiAgICBcImVycm9yaGFuZGxlclwiOiBcIn4xLjIuNFwiLFxuICAgIFwiZXhwcmVzc1wiOiBcIn40LjEwLjhcIixcbiAgICBcImhhcm1vblwiOiBcIl4xLjMuMVwiLFxuICAgIFwiaHR0cC1wcm94eVwiOiBcIl4xLjExLjFcIixcbiAgICBcInJlcXVlc3RcIjogXCJ+Mi41My4wXCIsXG4gICAgXCJ0cmFuc2Zvcm1lci1wcm94eVwiOiBcIl4wLjMuMVwiXG4gIH0sXG4gIFwiZW5naW5lc1wiOiB7XG4gICAgXCJub2RlXCI6IFwiPj0wLjEwXCJcbiAgfSxcbiAgXCJyZXBvc2l0b3J5XCI6IHtcbiAgICBcInR5cGVcIjogXCJnaXRcIixcbiAgICBcInVybFwiOiBcImh0dHBzOi8vZ2l0aHViLmNvbS93YXRzb24tZGV2ZWxvcGVyLWNsb3VkL3NwZWVjaC10by10ZXh0LWJyb3dzZXIuZ2l0XCJcbiAgfSxcbiAgXCJhdXRob3JcIjogXCJJQk0gQ29ycC5cIixcbiAgXCJicm93c2VyaWZ5LXNoaW1cIjoge1xuICAgIFwianF1ZXJ5XCI6IFwiZ2xvYmFsOmpRdWVyeVwiXG4gIH0sXG4gIFwiYnJvd3NlcmlmeVwiOiB7XG4gICAgXCJ0cmFuc2Zvcm1cIjogW1xuICAgICAgXCJicm93c2VyaWZ5LXNoaW1cIlxuICAgIF1cbiAgfSxcbiAgXCJjb250cmlidXRvcnNcIjogW1xuICAgIHtcbiAgICAgIFwibmFtZVwiOiBcIkdlcm1hbiBBdHRhbmFzaW8gUnVpelwiLFxuICAgICAgXCJlbWFpbFwiOiBcImdlcm1hbmF0dEB1cy5pYm0uY29tXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwibmFtZVwiOiBcIkRhbmllbCBCb2xhbm9cIixcbiAgICAgIFwiZW1haWxcIjogXCJkYm9sYW5vQHVzLmlibS5jb21cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJuYW1lXCI6IFwiQnJpdGFueSBMLiBQb252ZWxsZVwiLFxuICAgICAgXCJlbWFpbFwiOiBcImJscG9udmVsbGVAdXMuaWJtLmNvbVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcIm5hbWVcIjogXCJFcmljIFMuIEJ1bGxpbmd0b25cIixcbiAgICAgIFwiZW1haWxcIjogXCJlc2J1bGxpbkB1cy5pYm0uY29tXCJcbiAgICB9XG4gIF0sXG4gIFwibGljZW5zZVwiOiBcIkFwYWNoZS0yLjBcIixcbiAgXCJidWdzXCI6IHtcbiAgICBcInVybFwiOiBcImh0dHBzOi8vZ2l0aHViLmNvbS93YXRzb24tZGV2ZWxvcGVyLWNsb3VkL3NwZWVjaC10by10ZXh0LWJyb3dzZXIvaXNzdWVzXCJcbiAgfSxcbiAgXCJzY3JpcHRzXCI6IHtcbiAgICBcInN0YXJ0XCI6IFwibm9kZSBhcHAuanNcIixcbiAgICBcImJ1aWxkXCI6IFwiYnJvd3NlcmlmeSAtbyBwdWJsaWMvanMvbWFpbi5qcyBzcmMvaW5kZXguanNcIixcbiAgICBcIndhdGNoXCI6IFwid2F0Y2hpZnkgLXYgLWQgLW8gcHVibGljL2pzL21haW4uanMgc3JjL2luZGV4LmpzXCJcbiAgfSxcbiAgXCJkZXZEZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiYnJvd3NlcmlmeVwiOiBcIl4xMC4yLjRcIixcbiAgICBcImJyb3dzZXJpZnktc2hpbVwiOiBcIl4zLjguOVwiLFxuICAgIFwid2F0Y2hpZnlcIjogXCJeMy4yLjNcIlxuICB9XG59XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDE0IElCTSBDb3JwLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSAnTGljZW5zZScpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiAnQVMgSVMnIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbi8qKlxuICogQ2FwdHVyZXMgbWljcm9waG9uZSBpbnB1dCBmcm9tIHRoZSBicm93c2VyLlxuICogV29ya3MgYXQgbGVhc3Qgb24gbGF0ZXN0IHZlcnNpb25zIG9mIEZpcmVmb3ggYW5kIENocm9tZVxuICovXG5mdW5jdGlvbiBNaWNyb3Bob25lKF9vcHRpb25zKSB7XG4gIHZhciBvcHRpb25zID0gX29wdGlvbnMgfHwge307XG5cbiAgLy8gd2UgcmVjb3JkIGluIG1vbm8gYmVjYXVzZSB0aGUgc3BlZWNoIHJlY29nbml0aW9uIHNlcnZpY2VcbiAgLy8gZG9lcyBub3Qgc3VwcG9ydCBzdGVyZW8uXG4gIHRoaXMuYnVmZmVyU2l6ZSA9IG9wdGlvbnMuYnVmZmVyU2l6ZSB8fCA4MTkyO1xuICB0aGlzLmlucHV0Q2hhbm5lbHMgPSBvcHRpb25zLmlucHV0Q2hhbm5lbHMgfHwgMTtcbiAgdGhpcy5vdXRwdXRDaGFubmVscyA9IG9wdGlvbnMub3V0cHV0Q2hhbm5lbHMgfHwgMTtcbiAgdGhpcy5yZWNvcmRpbmcgPSBmYWxzZTtcbiAgdGhpcy5yZXF1ZXN0ZWRBY2Nlc3MgPSBmYWxzZTtcbiAgdGhpcy5zYW1wbGVSYXRlID0gMTYwMDA7XG4gIC8vIGF1eGlsaWFyIGJ1ZmZlciB0byBrZWVwIHVudXNlZCBzYW1wbGVzICh1c2VkIHdoZW4gZG9pbmcgZG93bnNhbXBsaW5nKVxuICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXMgPSBuZXcgRmxvYXQzMkFycmF5KDApO1xuXG4gIC8vIENocm9tZSBvciBGaXJlZm94IG9yIElFIFVzZXIgbWVkaWFcbiAgaWYgKCFuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKSB7XG4gICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSA9IG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEgfHxcbiAgICBuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tc0dldFVzZXJNZWRpYTtcbiAgfVxuXG59XG5cbi8qKlxuICogQ2FsbGVkIHdoZW4gdGhlIHVzZXIgcmVqZWN0IHRoZSB1c2Ugb2YgdGhlIG1pY2hyb3Bob25lXG4gKiBAcGFyYW0gIGVycm9yIFRoZSBlcnJvclxuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5vblBlcm1pc3Npb25SZWplY3RlZCA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnTWljcm9waG9uZS5vblBlcm1pc3Npb25SZWplY3RlZCgpJyk7XG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gZmFsc2U7XG4gIHRoaXMub25FcnJvcignUGVybWlzc2lvbiB0byBhY2Nlc3MgdGhlIG1pY3JvcGhvbmUgcmVqZXRlZC4nKTtcbn07XG5cbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uRXJyb3IgPSBmdW5jdGlvbihlcnJvcikge1xuICBjb25zb2xlLmxvZygnTWljcm9waG9uZS5vbkVycm9yKCk6JywgZXJyb3IpO1xufTtcblxuLyoqXG4gKiBDYWxsZWQgd2hlbiB0aGUgdXNlciBhdXRob3JpemVzIHRoZSB1c2Ugb2YgdGhlIG1pY3JvcGhvbmUuXG4gKiBAcGFyYW0gIHtPYmplY3R9IHN0cmVhbSBUaGUgU3RyZWFtIHRvIGNvbm5lY3QgdG9cbiAqXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uTWVkaWFTdHJlYW0gPSAgZnVuY3Rpb24oc3RyZWFtKSB7XG4gIHZhciBBdWRpb0N0eCA9IHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dDtcblxuICBpZiAoIUF1ZGlvQ3R4KVxuICAgIHRocm93IG5ldyBFcnJvcignQXVkaW9Db250ZXh0IG5vdCBhdmFpbGFibGUnKTtcblxuICBpZiAoIXRoaXMuYXVkaW9Db250ZXh0KVxuICAgIHRoaXMuYXVkaW9Db250ZXh0ID0gbmV3IEF1ZGlvQ3R4KCk7XG5cbiAgdmFyIGdhaW4gPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gIHZhciBhdWRpb0lucHV0ID0gdGhpcy5hdWRpb0NvbnRleHQuY3JlYXRlTWVkaWFTdHJlYW1Tb3VyY2Uoc3RyZWFtKTtcblxuICBhdWRpb0lucHV0LmNvbm5lY3QoZ2Fpbik7XG5cbiAgdGhpcy5taWMgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IodGhpcy5idWZmZXJTaXplLFxuICAgIHRoaXMuaW5wdXRDaGFubmVscywgdGhpcy5vdXRwdXRDaGFubmVscyk7XG5cbiAgLy8gdW5jb21tZW50IHRoZSBmb2xsb3dpbmcgbGluZSBpZiB5b3Ugd2FudCB0byB1c2UgeW91ciBtaWNyb3Bob25lIHNhbXBsZSByYXRlXG4gIC8vdGhpcy5zYW1wbGVSYXRlID0gdGhpcy5hdWRpb0NvbnRleHQuc2FtcGxlUmF0ZTtcbiAgY29uc29sZS5sb2coJ01pY3JvcGhvbmUub25NZWRpYVN0cmVhbSgpOiBzYW1wbGluZyByYXRlIGlzOicsIHRoaXMuc2FtcGxlUmF0ZSk7XG5cbiAgdGhpcy5taWMub25hdWRpb3Byb2Nlc3MgPSB0aGlzLl9vbmF1ZGlvcHJvY2Vzcy5iaW5kKHRoaXMpO1xuICB0aGlzLnN0cmVhbSA9IHN0cmVhbTtcblxuICBnYWluLmNvbm5lY3QodGhpcy5taWMpO1xuICB0aGlzLm1pYy5jb25uZWN0KHRoaXMuYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgdGhpcy5yZWNvcmRpbmcgPSB0cnVlO1xuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IGZhbHNlO1xuICB0aGlzLm9uU3RhcnRSZWNvcmRpbmcoKTtcbn07XG5cbi8qKlxuICogY2FsbGJhY2sgdGhhdCBpcyBiZWluZyB1c2VkIGJ5IHRoZSBtaWNyb3Bob25lXG4gKiB0byBzZW5kIGF1ZGlvIGNodW5rcy5cbiAqIEBwYXJhbSAge29iamVjdH0gZGF0YSBhdWRpb1xuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5fb25hdWRpb3Byb2Nlc3MgPSBmdW5jdGlvbihkYXRhKSB7XG4gIGlmICghdGhpcy5yZWNvcmRpbmcpIHtcbiAgICAvLyBXZSBzcGVhayBidXQgd2UgYXJlIG5vdCByZWNvcmRpbmdcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBTaW5nbGUgY2hhbm5lbFxuICB2YXIgY2hhbiA9IGRhdGEuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCk7XG5cbiAgdGhpcy5vbkF1ZGlvKHRoaXMuX2V4cG9ydERhdGFCdWZmZXJUbzE2S2h6KG5ldyBGbG9hdDMyQXJyYXkoY2hhbikpKTtcblxuICAvL2V4cG9ydCB3aXRoIG1pY3JvcGhvbmUgbWh6LCByZW1lbWJlciB0byB1cGRhdGUgdGhlIHRoaXMuc2FtcGxlUmF0ZVxuICAvLyB3aXRoIHRoZSBzYW1wbGUgcmF0ZSBmcm9tIHlvdXIgbWljcm9waG9uZVxuICAvLyB0aGlzLm9uQXVkaW8odGhpcy5fZXhwb3J0RGF0YUJ1ZmZlcihuZXcgRmxvYXQzMkFycmF5KGNoYW4pKSk7XG5cbn07XG5cbi8qKlxuICogU3RhcnQgdGhlIGF1ZGlvIHJlY29yZGluZ1xuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5yZWNvcmQgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCFuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKXtcbiAgICB0aGlzLm9uRXJyb3IoJ0Jyb3dzZXIgZG9lc25cXCd0IHN1cHBvcnQgbWljcm9waG9uZSBpbnB1dCcpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAodGhpcy5yZXF1ZXN0ZWRBY2Nlc3MpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IHRydWU7XG4gIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEoeyBhdWRpbzogdHJ1ZSB9LFxuICAgIHRoaXMub25NZWRpYVN0cmVhbS5iaW5kKHRoaXMpLCAvLyBNaWNyb3Bob25lIHBlcm1pc3Npb24gZ3JhbnRlZFxuICAgIHRoaXMub25QZXJtaXNzaW9uUmVqZWN0ZWQuYmluZCh0aGlzKSk7IC8vIE1pY3JvcGhvbmUgcGVybWlzc2lvbiByZWplY3RlZFxufTtcblxuLyoqXG4gKiBTdG9wIHRoZSBhdWRpbyByZWNvcmRpbmdcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMucmVjb3JkaW5nKVxuICAgIHJldHVybjtcbiAgdGhpcy5yZWNvcmRpbmcgPSBmYWxzZTtcbiAgdGhpcy5zdHJlYW0uc3RvcCgpO1xuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IGZhbHNlO1xuICB0aGlzLm1pYy5kaXNjb25uZWN0KDApO1xuICB0aGlzLm1pYyA9IG51bGw7XG4gIHRoaXMub25TdG9wUmVjb3JkaW5nKCk7XG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYSBCbG9iIHR5cGU6ICdhdWRpby9sMTYnIHdpdGggdGhlIGNodW5rIGFuZCBkb3duc2FtcGxpbmcgdG8gMTYga0h6XG4gKiBjb21pbmcgZnJvbSB0aGUgbWljcm9waG9uZS5cbiAqIEV4cGxhbmF0aW9uIGZvciB0aGUgbWF0aDogVGhlIHJhdyB2YWx1ZXMgY2FwdHVyZWQgZnJvbSB0aGUgV2ViIEF1ZGlvIEFQSSBhcmVcbiAqIGluIDMyLWJpdCBGbG9hdGluZyBQb2ludCwgYmV0d2VlbiAtMSBhbmQgMSAocGVyIHRoZSBzcGVjaWZpY2F0aW9uKS5cbiAqIFRoZSB2YWx1ZXMgZm9yIDE2LWJpdCBQQ00gcmFuZ2UgYmV0d2VlbiAtMzI3NjggYW5kICszMjc2NyAoMTYtYml0IHNpZ25lZCBpbnRlZ2VyKS5cbiAqIE11bHRpcGx5IHRvIGNvbnRyb2wgdGhlIHZvbHVtZSBvZiB0aGUgb3V0cHV0LiBXZSBzdG9yZSBpbiBsaXR0bGUgZW5kaWFuLlxuICogQHBhcmFtICB7T2JqZWN0fSBidWZmZXIgTWljcm9waG9uZSBhdWRpbyBjaHVua1xuICogQHJldHVybiB7QmxvYn0gJ2F1ZGlvL2wxNicgY2h1bmtcbiAqIEBkZXByZWNhdGVkIFRoaXMgbWV0aG9kIGlzIGRlcHJhY2F0ZWRcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUuX2V4cG9ydERhdGFCdWZmZXJUbzE2S2h6ID0gZnVuY3Rpb24oYnVmZmVyTmV3U2FtcGxlcykge1xuICB2YXIgYnVmZmVyID0gbnVsbCxcbiAgICBuZXdTYW1wbGVzID0gYnVmZmVyTmV3U2FtcGxlcy5sZW5ndGgsXG4gICAgdW51c2VkU2FtcGxlcyA9IHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlcy5sZW5ndGg7XG5cbiAgaWYgKHVudXNlZFNhbXBsZXMgPiAwKSB7XG4gICAgYnVmZmVyID0gbmV3IEZsb2F0MzJBcnJheSh1bnVzZWRTYW1wbGVzICsgbmV3U2FtcGxlcyk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bnVzZWRTYW1wbGVzOyArK2kpIHtcbiAgICAgIGJ1ZmZlcltpXSA9IHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlc1tpXTtcbiAgICB9XG4gICAgZm9yIChpID0gMDsgaSA8IG5ld1NhbXBsZXM7ICsraSkge1xuICAgICAgYnVmZmVyW3VudXNlZFNhbXBsZXMgKyBpXSA9IGJ1ZmZlck5ld1NhbXBsZXNbaV07XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGJ1ZmZlciA9IGJ1ZmZlck5ld1NhbXBsZXM7XG4gIH1cblxuICAvLyBkb3duc2FtcGxpbmcgdmFyaWFibGVzXG4gIHZhciBmaWx0ZXIgPSBbXG4gICAgICAtMC4wMzc5MzUsIC0wLjAwMDg5MDI0LCAwLjA0MDE3MywgMC4wMTk5ODksIDAuMDA0Nzc5MiwgLTAuMDU4Njc1LCAtMC4wNTY0ODcsXG4gICAgICAtMC4wMDQwNjUzLCAwLjE0NTI3LCAwLjI2OTI3LCAwLjMzOTEzLCAwLjI2OTI3LCAwLjE0NTI3LCAtMC4wMDQwNjUzLCAtMC4wNTY0ODcsXG4gICAgICAtMC4wNTg2NzUsIDAuMDA0Nzc5MiwgMC4wMTk5ODksIDAuMDQwMTczLCAtMC4wMDA4OTAyNCwgLTAuMDM3OTM1XG4gICAgXSxcbiAgICBzYW1wbGluZ1JhdGVSYXRpbyA9IHRoaXMuYXVkaW9Db250ZXh0LnNhbXBsZVJhdGUgLyAxNjAwMCxcbiAgICBuT3V0cHV0U2FtcGxlcyA9IE1hdGguZmxvb3IoKGJ1ZmZlci5sZW5ndGggLSBmaWx0ZXIubGVuZ3RoKSAvIChzYW1wbGluZ1JhdGVSYXRpbykpICsgMSxcbiAgICBwY21FbmNvZGVkQnVmZmVyMTZrID0gbmV3IEFycmF5QnVmZmVyKG5PdXRwdXRTYW1wbGVzICogMiksXG4gICAgZGF0YVZpZXcxNmsgPSBuZXcgRGF0YVZpZXcocGNtRW5jb2RlZEJ1ZmZlcjE2ayksXG4gICAgaW5kZXggPSAwLFxuICAgIHZvbHVtZSA9IDB4N0ZGRiwgLy9yYW5nZSBmcm9tIDAgdG8gMHg3RkZGIHRvIGNvbnRyb2wgdGhlIHZvbHVtZVxuICAgIG5PdXQgPSAwO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpICsgZmlsdGVyLmxlbmd0aCAtIDEgPCBidWZmZXIubGVuZ3RoOyBpID0gTWF0aC5yb3VuZChzYW1wbGluZ1JhdGVSYXRpbyAqIG5PdXQpKSB7XG4gICAgdmFyIHNhbXBsZSA9IDA7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBmaWx0ZXIubGVuZ3RoOyArK2opIHtcbiAgICAgIHNhbXBsZSArPSBidWZmZXJbaSArIGpdICogZmlsdGVyW2pdO1xuICAgIH1cbiAgICBzYW1wbGUgKj0gdm9sdW1lO1xuICAgIGRhdGFWaWV3MTZrLnNldEludDE2KGluZGV4LCBzYW1wbGUsIHRydWUpOyAvLyAndHJ1ZScgLT4gbWVhbnMgbGl0dGxlIGVuZGlhblxuICAgIGluZGV4ICs9IDI7XG4gICAgbk91dCsrO1xuICB9XG5cbiAgdmFyIGluZGV4U2FtcGxlQWZ0ZXJMYXN0VXNlZCA9IE1hdGgucm91bmQoc2FtcGxpbmdSYXRlUmF0aW8gKiBuT3V0KTtcbiAgdmFyIHJlbWFpbmluZyA9IGJ1ZmZlci5sZW5ndGggLSBpbmRleFNhbXBsZUFmdGVyTGFzdFVzZWQ7XG4gIGlmIChyZW1haW5pbmcgPiAwKSB7XG4gICAgdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzID0gbmV3IEZsb2F0MzJBcnJheShyZW1haW5pbmcpO1xuICAgIGZvciAoaSA9IDA7IGkgPCByZW1haW5pbmc7ICsraSkge1xuICAgICAgdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzW2ldID0gYnVmZmVyW2luZGV4U2FtcGxlQWZ0ZXJMYXN0VXNlZCArIGldO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXMgPSBuZXcgRmxvYXQzMkFycmF5KDApO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBCbG9iKFtkYXRhVmlldzE2a10sIHtcbiAgICB0eXBlOiAnYXVkaW8vbDE2J1xuICB9KTtcbiAgfTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgQmxvYiB0eXBlOiAnYXVkaW8vbDE2JyB3aXRoIHRoZVxuICogY2h1bmsgY29taW5nIGZyb20gdGhlIG1pY3JvcGhvbmUuXG4gKi9cbnZhciBleHBvcnREYXRhQnVmZmVyID0gZnVuY3Rpb24oYnVmZmVyLCBidWZmZXJTaXplKSB7XG4gIHZhciBwY21FbmNvZGVkQnVmZmVyID0gbnVsbCxcbiAgICBkYXRhVmlldyA9IG51bGwsXG4gICAgaW5kZXggPSAwLFxuICAgIHZvbHVtZSA9IDB4N0ZGRjsgLy9yYW5nZSBmcm9tIDAgdG8gMHg3RkZGIHRvIGNvbnRyb2wgdGhlIHZvbHVtZVxuXG4gIHBjbUVuY29kZWRCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoYnVmZmVyU2l6ZSAqIDIpO1xuICBkYXRhVmlldyA9IG5ldyBEYXRhVmlldyhwY21FbmNvZGVkQnVmZmVyKTtcblxuICAvKiBFeHBsYW5hdGlvbiBmb3IgdGhlIG1hdGg6IFRoZSByYXcgdmFsdWVzIGNhcHR1cmVkIGZyb20gdGhlIFdlYiBBdWRpbyBBUEkgYXJlXG4gICAqIGluIDMyLWJpdCBGbG9hdGluZyBQb2ludCwgYmV0d2VlbiAtMSBhbmQgMSAocGVyIHRoZSBzcGVjaWZpY2F0aW9uKS5cbiAgICogVGhlIHZhbHVlcyBmb3IgMTYtYml0IFBDTSByYW5nZSBiZXR3ZWVuIC0zMjc2OCBhbmQgKzMyNzY3ICgxNi1iaXQgc2lnbmVkIGludGVnZXIpLlxuICAgKiBNdWx0aXBseSB0byBjb250cm9sIHRoZSB2b2x1bWUgb2YgdGhlIG91dHB1dC4gV2Ugc3RvcmUgaW4gbGl0dGxlIGVuZGlhbi5cbiAgICovXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyLmxlbmd0aDsgaSsrKSB7XG4gICAgZGF0YVZpZXcuc2V0SW50MTYoaW5kZXgsIGJ1ZmZlcltpXSAqIHZvbHVtZSwgdHJ1ZSk7XG4gICAgaW5kZXggKz0gMjtcbiAgfVxuXG4gIC8vIGwxNiBpcyB0aGUgTUlNRSB0eXBlIGZvciAxNi1iaXQgUENNXG4gIHJldHVybiBuZXcgQmxvYihbZGF0YVZpZXddLCB7IHR5cGU6ICdhdWRpby9sMTYnIH0pO1xufTtcblxuTWljcm9waG9uZS5wcm90b3R5cGUuX2V4cG9ydERhdGFCdWZmZXIgPSBmdW5jdGlvbihidWZmZXIpe1xuICB1dGlscy5leHBvcnREYXRhQnVmZmVyKGJ1ZmZlciwgdGhpcy5idWZmZXJTaXplKTtcbn07IFxuXG5cbi8vIEZ1bmN0aW9ucyB1c2VkIHRvIGNvbnRyb2wgTWljcm9waG9uZSBldmVudHMgbGlzdGVuZXJzLlxuTWljcm9waG9uZS5wcm90b3R5cGUub25TdGFydFJlY29yZGluZyA9ICBmdW5jdGlvbigpIHt9O1xuTWljcm9waG9uZS5wcm90b3R5cGUub25TdG9wUmVjb3JkaW5nID0gIGZ1bmN0aW9uKCkge307XG5NaWNyb3Bob25lLnByb3RvdHlwZS5vbkF1ZGlvID0gIGZ1bmN0aW9uKCkge307XG5cbm1vZHVsZS5leHBvcnRzID0gTWljcm9waG9uZTtcblxuIiwibW9kdWxlLmV4cG9ydHM9e1xuICAgXCJtb2RlbHNcIjogW1xuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL21vZGVscy9lbi1VU19Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiAxNjAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJlbi1VU19Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJlbi1VU1wiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJVUyBFbmdsaXNoIGJyb2FkYmFuZCBtb2RlbCAoMTZLSHopXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL21vZGVscy9lbi1VU19OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogODAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJlbi1VU19OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiZW4tVVNcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiVVMgRW5nbGlzaCBuYXJyb3diYW5kIG1vZGVsICg4S0h6KVwiXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL21vZGVscy9lcy1FU19Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiAxNjAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJlcy1FU19Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJlcy1FU1wiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJTcGFuaXNoIGJyb2FkYmFuZCBtb2RlbCAoMTZLSHopXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL21vZGVscy9lcy1FU19OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogODAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJlcy1FU19OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiZXMtRVNcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiU3BhbmlzaCBuYXJyb3diYW5kIG1vZGVsICg4S0h6KVwiXG4gICAgICB9LCBcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0ud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0L2FwaS92MS9tb2RlbHMvamEtSlBfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogMTYwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiamEtSlBfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiamEtSlBcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiSmFwYW5lc2UgYnJvYWRiYW5kIG1vZGVsICgxNktIeilcIlxuICAgICAgfSwgXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC9hcGkvdjEvbW9kZWxzL2phLUpQX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiA4MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcImphLUpQX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJqYS1KUFwiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJKYXBhbmVzZSBuYXJyb3diYW5kIG1vZGVsICg4S0h6KVwiXG4gICAgICB9XG4gICBdXG59XG4iLCJcbnZhciBlZmZlY3RzID0gcmVxdWlyZSgnLi92aWV3cy9lZmZlY3RzJyk7XG52YXIgZGlzcGxheSA9IHJlcXVpcmUoJy4vdmlld3MvZGlzcGxheW1ldGFkYXRhJyk7XG52YXIgaGlkZUVycm9yID0gcmVxdWlyZSgnLi92aWV3cy9zaG93ZXJyb3InKS5oaWRlRXJyb3I7XG52YXIgaW5pdFNvY2tldCA9IHJlcXVpcmUoJy4vc29ja2V0JykuaW5pdFNvY2tldDtcblxuZXhwb3J0cy5oYW5kbGVGaWxlVXBsb2FkID0gZnVuY3Rpb24odG9rZW4sIG1vZGVsLCBmaWxlLCBjb250ZW50VHlwZSwgY2FsbGJhY2ssIG9uZW5kKSB7XG5cbiAgICAvLyBTZXQgY3VycmVudGx5RGlzcGxheWluZyB0byBwcmV2ZW50IG90aGVyIHNvY2tldHMgZnJvbSBvcGVuaW5nXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCB0cnVlKTtcblxuICAgIC8vICQoJyNwcm9ncmVzc0luZGljYXRvcicpLmNzcygndmlzaWJpbGl0eScsICd2aXNpYmxlJyk7XG5cbiAgICAkLnN1YnNjcmliZSgncHJvZ3Jlc3MnLCBmdW5jdGlvbihldnQsIGRhdGEpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdwcm9ncmVzczogJywgZGF0YSk7XG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygnY29udGVudFR5cGUnLCBjb250ZW50VHlwZSk7XG5cbiAgICB2YXIgYmFzZVN0cmluZyA9ICcnO1xuICAgIHZhciBiYXNlSlNPTiA9ICcnO1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcbiAgICBvcHRpb25zLnRva2VuID0gdG9rZW47XG4gICAgb3B0aW9ucy5tZXNzYWdlID0ge1xuICAgICAgJ2FjdGlvbic6ICdzdGFydCcsXG4gICAgICAnY29udGVudC10eXBlJzogY29udGVudFR5cGUsXG4gICAgICAnaW50ZXJpbV9yZXN1bHRzJzogdHJ1ZSxcbiAgICAgICdjb250aW51b3VzJzogdHJ1ZSxcbiAgICAgICd3b3JkX2NvbmZpZGVuY2UnOiB0cnVlLFxuICAgICAgJ3RpbWVzdGFtcHMnOiB0cnVlLFxuICAgICAgJ21heF9hbHRlcm5hdGl2ZXMnOiAzXG4gICAgfTtcbiAgICBvcHRpb25zLm1vZGVsID0gbW9kZWw7XG5cbiAgICBmdW5jdGlvbiBvbk9wZW4oc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZygnU29ja2V0IG9wZW5lZCcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uTGlzdGVuaW5nKHNvY2tldCkge1xuICAgICAgY29uc29sZS5sb2coJ1NvY2tldCBsaXN0ZW5pbmcnKTtcbiAgICAgIGNhbGxiYWNrKHNvY2tldCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25NZXNzYWdlKG1zZykge1xuICAgICAgaWYgKG1zZy5yZXN1bHRzKSB7XG4gICAgICAgIC8vIENvbnZlcnQgdG8gY2xvc3VyZSBhcHByb2FjaFxuICAgICAgICBiYXNlU3RyaW5nID0gZGlzcGxheS5zaG93UmVzdWx0KG1zZywgYmFzZVN0cmluZyk7XG4gICAgICAgIGJhc2VKU09OID0gZGlzcGxheS5zaG93SlNPTihtc2csIGJhc2VKU09OKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkVycm9yKGV2dCkge1xuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG4gICAgICBvbmVuZChldnQpO1xuICAgICAgY29uc29sZS5sb2coJ1NvY2tldCBlcnI6ICcsIGV2dC5jb2RlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkNsb3NlKGV2dCkge1xuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG4gICAgICBvbmVuZChldnQpO1xuICAgICAgY29uc29sZS5sb2coJ1NvY2tldCBjbG9zaW5nOiAnLCBldnQpO1xuICAgIH1cblxuICAgIGluaXRTb2NrZXQob3B0aW9ucywgb25PcGVuLCBvbkxpc3RlbmluZywgb25NZXNzYWdlLCBvbkVycm9yLCBvbkNsb3NlKTtcblxuICB9XG4iLCJcbid1c2Ugc3RyaWN0JztcblxudmFyIGluaXRTb2NrZXQgPSByZXF1aXJlKCcuL3NvY2tldCcpLmluaXRTb2NrZXQ7XG52YXIgZGlzcGxheSA9IHJlcXVpcmUoJy4vdmlld3MvZGlzcGxheW1ldGFkYXRhJyk7XG5cbmV4cG9ydHMuaGFuZGxlTWljcm9waG9uZSA9IGZ1bmN0aW9uKHRva2VuLCBtb2RlbCwgbWljLCBjYWxsYmFjaykge1xuXG4gIHZhciBzdGFydFRpbWUsXG4gICAgICBhbGxvd2VkTWljVGltZSA9IDQ1O1xuXG4gIGlmIChtb2RlbC5pbmRleE9mKCdOYXJyb3diYW5kJykgPiAtMSkge1xuICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoJ01pY3JvcGhvbmUgdHJhbnNjcmlwdGlvbiBjYW5ub3QgYWNjb21vZGF0ZSBuYXJyb3diYW5kIG1vZGVscywgcGxlYXNlIHNlbGVjdCBhbm90aGVyJyk7XG4gICAgY2FsbGJhY2soZXJyLCBudWxsKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAkLnB1Ymxpc2goJ2NsZWFyc2NyZWVuJyk7XG5cbiAgLy8gVGVzdCBvdXQgd2Vic29ja2V0XG4gIHZhciBiYXNlU3RyaW5nID0gJyc7XG4gIHZhciBiYXNlSlNPTiA9ICcnO1xuXG4gIHZhciBvcHRpb25zID0ge307XG4gIG9wdGlvbnMudG9rZW4gPSB0b2tlbjtcbiAgb3B0aW9ucy5tZXNzYWdlID0ge1xuICAgICdhY3Rpb24nOiAnc3RhcnQnLFxuICAgICdjb250ZW50LXR5cGUnOiAnYXVkaW8vbDE2O3JhdGU9MTYwMDAnLFxuICAgICdpbnRlcmltX3Jlc3VsdHMnOiB0cnVlLFxuICAgICdjb250aW51b3VzJzogdHJ1ZSxcbiAgICAnd29yZF9jb25maWRlbmNlJzogdHJ1ZSxcbiAgICAndGltZXN0YW1wcyc6IHRydWUsXG4gICAgJ21heF9hbHRlcm5hdGl2ZXMnOiAzXG4gIH07XG4gIG9wdGlvbnMubW9kZWwgPSBtb2RlbDtcblxuICBmdW5jdGlvbiBvbk9wZW4oc29ja2V0KSB7XG4gICAgc3RhcnRUaW1lID0gbmV3IERhdGUoKTtcbiAgICBjb25zb2xlLmxvZygnTWljIHNvY2tldDogb3BlbmVkJyk7XG4gICAgY2FsbGJhY2sobnVsbCwgc29ja2V0KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uTGlzdGVuaW5nKHNvY2tldCkge1xuXG4gICAgbWljLm9uQXVkaW8gPSBmdW5jdGlvbihibG9iKSB7XG4gICAgICB2YXIgbm93ID0gbmV3IERhdGUoKTtcbiAgICAgIGlmICgobm93IC0gc3RhcnRUaW1lKSA+IGFsbG93ZWRNaWNUaW1lICogMTAwMCkge1xuICAgICAgICAkLnB1Ymxpc2goJ3N0b3BtaWMnKTtcbiAgICAgICAgJC5wdWJsaXNoKCdzb2NrZXRzdG9wJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHNvY2tldC5yZWFkeVN0YXRlIDwgMikge1xuICAgICAgICBzb2NrZXQuc2VuZChibG9iKVxuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBvbk1lc3NhZ2UobXNnLCBzb2NrZXQpIHtcbiAgICBjb25zb2xlLmxvZygnTWljIHNvY2tldCBtc2c6ICcsIG1zZyk7XG4gICAgaWYgKG1zZy5yZXN1bHRzKSB7XG4gICAgICAvLyBDb252ZXJ0IHRvIGNsb3N1cmUgYXBwcm9hY2hcbiAgICAgIGJhc2VTdHJpbmcgPSBkaXNwbGF5LnNob3dSZXN1bHQobXNnLCBiYXNlU3RyaW5nKTtcbiAgICAgIGJhc2VKU09OID0gZGlzcGxheS5zaG93SlNPTihtc2csIGJhc2VKU09OKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBvbkVycm9yKHIsIHNvY2tldCkge1xuICAgIGNvbnNvbGUubG9nKCdNaWMgc29ja2V0IGVycjogJywgZXJyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uQ2xvc2UoZXZ0KSB7XG4gICAgY29uc29sZS5sb2coJ01pYyBzb2NrZXQgY2xvc2U6ICcsIGV2dCk7XG4gIH1cblxuICBpbml0U29ja2V0KG9wdGlvbnMsIG9uT3Blbiwgb25MaXN0ZW5pbmcsIG9uTWVzc2FnZSwgb25FcnJvciwgb25DbG9zZSk7XG5cbn0iLCIvKipcbiAqIENvcHlyaWdodCAyMDE0IElCTSBDb3JwLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbi8qZ2xvYmFsICQ6ZmFsc2UgKi9cblxuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG52YXIgTWljcm9waG9uZSA9IHJlcXVpcmUoJy4vTWljcm9waG9uZScpO1xudmFyIHNob3dlcnJvciA9IHJlcXVpcmUoJy4vdmlld3Mvc2hvd2Vycm9yJyk7XG52YXIgc2hvd0Vycm9yID0gc2hvd2Vycm9yLnNob3dFcnJvcjtcbnZhciBoaWRlRXJyb3IgPSBzaG93ZXJyb3IuaGlkZUVycm9yO1xuXG4vLyBNaW5pIFdTIGNhbGxiYWNrIEFQSSwgc28gd2UgY2FuIGluaXRpYWxpemVcbi8vIHdpdGggbW9kZWwgYW5kIHRva2VuIGluIFVSSSwgcGx1c1xuLy8gc3RhcnQgbWVzc2FnZVxuXG4vLyBJbml0aWFsaXplIGNsb3N1cmUsIHdoaWNoIGhvbGRzIG1heGltdW0gZ2V0VG9rZW4gY2FsbCBjb3VudFxudmFyIHRva2VuR2VuZXJhdG9yID0gdXRpbHMuY3JlYXRlVG9rZW5HZW5lcmF0b3IoKTtcblxudmFyIGluaXRTb2NrZXQgPSBleHBvcnRzLmluaXRTb2NrZXQgPSBmdW5jdGlvbihvcHRpb25zLCBvbm9wZW4sIG9ubGlzdGVuaW5nLCBvbm1lc3NhZ2UsIG9uZXJyb3IsIG9uY2xvc2UpIHtcbiAgdmFyIGxpc3RlbmluZztcbiAgZnVuY3Rpb24gd2l0aERlZmF1bHQodmFsLCBkZWZhdWx0VmFsKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWwgPT09ICd1bmRlZmluZWQnID8gZGVmYXVsdFZhbCA6IHZhbDtcbiAgfVxuICB2YXIgc29ja2V0O1xuICB2YXIgdG9rZW4gPSBvcHRpb25zLnRva2VuO1xuICB2YXIgbW9kZWwgPSBvcHRpb25zLm1vZGVsIHx8IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50TW9kZWwnKTtcbiAgdmFyIG1lc3NhZ2UgPSBvcHRpb25zLm1lc3NhZ2UgfHwgeydhY3Rpb24nOiAnc3RhcnQnfTtcbiAgdmFyIHNlc3Npb25QZXJtaXNzaW9ucyA9IHdpdGhEZWZhdWx0KG9wdGlvbnMuc2Vzc2lvblBlcm1pc3Npb25zLCBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdzZXNzaW9uUGVybWlzc2lvbnMnKSkpO1xuICB2YXIgc2Vzc2lvblBlcm1pc3Npb25zUXVlcnlQYXJhbSA9IHNlc3Npb25QZXJtaXNzaW9ucyA/ICcwJyA6ICcxJztcbiAgdmFyIHVybCA9IG9wdGlvbnMuc2VydmljZVVSSSB8fCAnd3NzOi8vc3RyZWFtLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC9hcGkvdjEvcmVjb2duaXplP3dhdHNvbi10b2tlbj0nXG4gICAgKyB0b2tlblxuICAgICsgJyZYLVdEQy1QTC1PUFQtT1VUPScgKyBzZXNzaW9uUGVybWlzc2lvbnNRdWVyeVBhcmFtXG4gICAgKyAnJm1vZGVsPScgKyBtb2RlbDtcbiAgY29uc29sZS5sb2coJ1VSTCBtb2RlbCcsIG1vZGVsKTtcbiAgdHJ5IHtcbiAgICBzb2NrZXQgPSBuZXcgV2ViU29ja2V0KHVybCk7XG4gIH0gY2F0Y2goZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcignV1MgY29ubmVjdGlvbiBlcnJvcjogJywgZXJyKTtcbiAgfVxuICBzb2NrZXQub25vcGVuID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgbGlzdGVuaW5nID0gZmFsc2U7XG4gICAgJC5zdWJzY3JpYmUoJ2hhcmRzb2NrZXRzdG9wJywgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgY29uc29sZS5sb2coJ01JQ1JPUEhPTkU6IGNsb3NlLicpO1xuICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe2FjdGlvbjonc3RvcCd9KSk7XG4gICAgfSk7XG4gICAgJC5zdWJzY3JpYmUoJ3NvY2tldHN0b3AnLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICBjb25zb2xlLmxvZygnTUlDUk9QSE9ORTogY2xvc2UuJyk7XG4gICAgICBzb2NrZXQuY2xvc2UoKTtcbiAgICB9KTtcbiAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeShtZXNzYWdlKSk7XG4gICAgb25vcGVuKHNvY2tldCk7XG4gIH07XG4gIHNvY2tldC5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgbXNnID0gSlNPTi5wYXJzZShldnQuZGF0YSk7XG4gICAgaWYgKG1zZy5lcnJvcikge1xuICAgICAgc2hvd0Vycm9yKG1zZy5lcnJvcik7XG4gICAgICAkLnB1Ymxpc2goJ2hhcmRzb2NrZXRzdG9wJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChtc2cuc3RhdGUgPT09ICdsaXN0ZW5pbmcnKSB7XG4gICAgICAvLyBFYXJseSBjdXQgb2ZmLCB3aXRob3V0IG5vdGlmaWNhdGlvblxuICAgICAgaWYgKCFsaXN0ZW5pbmcpIHtcbiAgICAgICAgb25saXN0ZW5pbmcoc29ja2V0KTtcbiAgICAgICAgbGlzdGVuaW5nID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdNSUNST1BIT05FOiBDbG9zaW5nIHNvY2tldC4nKTtcbiAgICAgICAgc29ja2V0LmNsb3NlKCk7XG4gICAgICB9XG4gICAgfVxuICAgIG9ubWVzc2FnZShtc2csIHNvY2tldCk7XG4gIH07XG5cbiAgc29ja2V0Lm9uZXJyb3IgPSBmdW5jdGlvbihldnQpIHtcbiAgICBjb25zb2xlLmxvZygnV1Mgb25lcnJvcjogJywgZXZ0KTtcbiAgICBzaG93RXJyb3IoJ0FwcGxpY2F0aW9uIGVycm9yICcgKyBldnQuY29kZSArICc6IHBsZWFzZSByZWZyZXNoIHlvdXIgYnJvd3NlciBhbmQgdHJ5IGFnYWluJyk7XG4gICAgJC5wdWJsaXNoKCdjbGVhcnNjcmVlbicpO1xuICAgIG9uZXJyb3IoZXZ0KTtcbiAgfTtcblxuICBzb2NrZXQub25jbG9zZSA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIGNvbnNvbGUubG9nKCdXUyBvbmNsb3NlOiAnLCBldnQpO1xuICAgIGlmIChldnQuY29kZSA9PT0gMTAwNikge1xuICAgICAgLy8gQXV0aGVudGljYXRpb24gZXJyb3IsIHRyeSB0byByZWNvbm5lY3RcbiAgICAgIGNvbnNvbGUubG9nKCdnZW5lcmF0b3IgY291bnQnLCB0b2tlbkdlbmVyYXRvci5nZXRDb3VudCgpKTtcbiAgICAgIGlmICh0b2tlbkdlbmVyYXRvci5nZXRDb3VudCgpID4gMSkge1xuICAgICAgICAkLnB1Ymxpc2goJ2hhcmRzb2NrZXRzdG9wJyk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIGF1dGhvcml6YXRpb24gdG9rZW4gaXMgY3VycmVudGx5IGF2YWlsYWJsZVwiKTtcbiAgICAgIH1cbiAgICAgIHRva2VuR2VuZXJhdG9yLmdldFRva2VuKGZ1bmN0aW9uKHRva2VuLCBlcnIpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICQucHVibGlzaCgnaGFyZHNvY2tldHN0b3AnKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS5sb2coJ0ZldGNoaW5nIGFkZGl0aW9uYWwgdG9rZW4uLi4nKTtcbiAgICAgICAgb3B0aW9ucy50b2tlbiA9IHRva2VuO1xuICAgICAgICBpbml0U29ja2V0KG9wdGlvbnMsIG9ub3Blbiwgb25saXN0ZW5pbmcsIG9ubWVzc2FnZSwgb25lcnJvciwgb25jbG9zZSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGV2dC5jb2RlID09PSAxMDExKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdTZXJ2ZXIgZXJyb3IgJyArIGV2dC5jb2RlICsgJzogcGxlYXNlIHJlZnJlc2ggeW91ciBicm93c2VyIGFuZCB0cnkgYWdhaW4nKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGV2dC5jb2RlID4gMTAwMCkge1xuICAgICAgY29uc29sZS5lcnJvcignU2VydmVyIGVycm9yICcgKyBldnQuY29kZSArICc6IHBsZWFzZSByZWZyZXNoIHlvdXIgYnJvd3NlciBhbmQgdHJ5IGFnYWluJyk7XG4gICAgICAvLyBzaG93RXJyb3IoJ1NlcnZlciBlcnJvciAnICsgZXZ0LmNvZGUgKyAnOiBwbGVhc2UgcmVmcmVzaCB5b3VyIGJyb3dzZXIgYW5kIHRyeSBhZ2FpbicpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBNYWRlIGl0IHRocm91Z2gsIG5vcm1hbCBjbG9zZVxuICAgICQudW5zdWJzY3JpYmUoJ2hhcmRzb2NrZXRzdG9wJyk7XG4gICAgJC51bnN1YnNjcmliZSgnc29ja2V0c3RvcCcpO1xuICAgIG9uY2xvc2UoZXZ0KTtcbiAgfTtcblxufSIsIlxuLy8gRm9yIG5vbi12aWV3IGxvZ2ljXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93LmpRdWVyeSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwualF1ZXJ5IDogbnVsbCk7XG5cbnZhciBmaWxlQmxvY2sgPSBmdW5jdGlvbihfb2Zmc2V0LCBsZW5ndGgsIF9maWxlLCByZWFkQ2h1bmspIHtcbiAgdmFyIHIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICB2YXIgYmxvYiA9IF9maWxlLnNsaWNlKF9vZmZzZXQsIGxlbmd0aCArIF9vZmZzZXQpO1xuICByLm9ubG9hZCA9IHJlYWRDaHVuaztcbiAgci5yZWFkQXNBcnJheUJ1ZmZlcihibG9iKTtcbn1cblxuLy8gQmFzZWQgb24gYWxlZGlhZmVyaWEncyBTTyByZXNwb25zZVxuLy8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xNDQzODE4Ny9qYXZhc2NyaXB0LWZpbGVyZWFkZXItcGFyc2luZy1sb25nLWZpbGUtaW4tY2h1bmtzXG5leHBvcnRzLm9uRmlsZVByb2dyZXNzID0gZnVuY3Rpb24ob3B0aW9ucywgb25kYXRhLCBvbmVycm9yLCBvbmVuZCkge1xuICB2YXIgZmlsZSAgICAgICA9IG9wdGlvbnMuZmlsZTtcbiAgdmFyIGZpbGVTaXplICAgPSBmaWxlLnNpemU7XG4gIHZhciBjaHVua1NpemUgID0gb3B0aW9ucy5idWZmZXJTaXplIHx8IDgxOTI7XG4gIHZhciBvZmZzZXQgICAgID0gMDtcbiAgdmFyIHJlYWRDaHVuayA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIGlmIChvZmZzZXQgPj0gZmlsZVNpemUpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiRG9uZSByZWFkaW5nIGZpbGVcIik7XG4gICAgICBvbmVuZCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoZXZ0LnRhcmdldC5lcnJvciA9PSBudWxsKSB7XG4gICAgICB2YXIgYnVmZmVyID0gZXZ0LnRhcmdldC5yZXN1bHQ7XG4gICAgICB2YXIgbGVuID0gYnVmZmVyLmJ5dGVMZW5ndGg7XG4gICAgICBvZmZzZXQgKz0gbGVuO1xuICAgICAgb25kYXRhKGJ1ZmZlcik7IC8vIGNhbGxiYWNrIGZvciBoYW5kbGluZyByZWFkIGNodW5rXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBlcnJvck1lc3NhZ2UgPSBldnQudGFyZ2V0LmVycm9yO1xuICAgICAgY29uc29sZS5sb2coXCJSZWFkIGVycm9yOiBcIiArIGVycm9yTWVzc2FnZSk7XG4gICAgICBvbmVycm9yKGVycm9yTWVzc2FnZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGZpbGVCbG9jayhvZmZzZXQsIGNodW5rU2l6ZSwgZmlsZSwgcmVhZENodW5rKTtcbiAgfVxuICBmaWxlQmxvY2sob2Zmc2V0LCBjaHVua1NpemUsIGZpbGUsIHJlYWRDaHVuayk7XG59XG5cbmV4cG9ydHMuY3JlYXRlVG9rZW5HZW5lcmF0b3IgPSBmdW5jdGlvbigpIHtcbiAgLy8gTWFrZSBjYWxsIHRvIEFQSSB0byB0cnkgYW5kIGdldCB0b2tlblxuICB2YXIgaGFzQmVlblJ1blRpbWVzID0gMDtcbiAgcmV0dXJuIHtcbiAgICBnZXRUb2tlbjogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICArK2hhc0JlZW5SdW5UaW1lcztcbiAgICBpZiAoaGFzQmVlblJ1blRpbWVzID4gNSkge1xuICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignQ2Fubm90IHJlYWNoIHNlcnZlcicpO1xuICAgICAgY2FsbGJhY2sobnVsbCwgZXJyKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHVybCA9ICcvdG9rZW4nO1xuICAgIHZhciB0b2tlblJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB0b2tlblJlcXVlc3Qub3BlbihcIkdFVFwiLCB1cmwsIHRydWUpO1xuICAgIHRva2VuUmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbihldnQpIHtcbiAgICAgIHZhciB0b2tlbiA9IHRva2VuUmVxdWVzdC5yZXNwb25zZVRleHQ7XG4gICAgICBjYWxsYmFjayh0b2tlbik7XG4gICAgfTtcbiAgICB0b2tlblJlcXVlc3Quc2VuZCgpO1xuICAgIH0sXG4gICAgZ2V0Q291bnQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gaGFzQmVlblJ1blRpbWVzOyB9XG4gIH1cbn07XG5cbmV4cG9ydHMuZ2V0VG9rZW4gPSAoZnVuY3Rpb24oKSB7XG4gIC8vIE1ha2UgY2FsbCB0byBBUEkgdG8gdHJ5IGFuZCBnZXQgdG9rZW5cbiAgdmFyIGhhc0JlZW5SdW5UaW1lcyA9IDA7XG4gIHJldHVybiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIGhhc0JlZW5SdW5UaW1lcysrXG4gICAgaWYgKGhhc0JlZW5SdW5UaW1lcyA+IDUpIHtcbiAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoJ0Nhbm5vdCByZWFjaCBzZXJ2ZXInKTtcbiAgICAgIGNhbGxiYWNrKG51bGwsIGVycik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB1cmwgPSAnL3Rva2VuJztcbiAgICB2YXIgdG9rZW5SZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgdG9rZW5SZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgdXJsLCB0cnVlKTtcbiAgICB0b2tlblJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgICB2YXIgdG9rZW4gPSB0b2tlblJlcXVlc3QucmVzcG9uc2VUZXh0O1xuICAgICAgY2FsbGJhY2sodG9rZW4pO1xuICAgIH07XG4gICAgdG9rZW5SZXF1ZXN0LnNlbmQoKTtcbiAgfVxufSkoKTtcblxuZXhwb3J0cy5pbml0UHViU3ViID0gZnVuY3Rpb24oKSB7XG4gIHZhciBvICAgICAgICAgPSAkKHt9KTtcbiAgJC5zdWJzY3JpYmUgICA9IG8ub24uYmluZChvKTtcbiAgJC51bnN1YnNjcmliZSA9IG8ub2ZmLmJpbmQobyk7XG4gICQucHVibGlzaCAgICAgPSBvLnRyaWdnZXIuYmluZChvKTtcbn0iLCJcblxuZXhwb3J0cy5pbml0QW5pbWF0ZVBhbmVsID0gZnVuY3Rpb24oKSB7XG4gICQoJy5wYW5lbC1oZWFkaW5nIHNwYW4uY2xpY2thYmxlJykub24oXCJjbGlja1wiLCBmdW5jdGlvbiAoZSkge1xuICAgIGlmICgkKHRoaXMpLmhhc0NsYXNzKCdwYW5lbC1jb2xsYXBzZWQnKSkge1xuICAgICAgLy8gZXhwYW5kIHRoZSBwYW5lbFxuICAgICAgJCh0aGlzKS5wYXJlbnRzKCcucGFuZWwnKS5maW5kKCcucGFuZWwtYm9keScpLnNsaWRlRG93bigpO1xuICAgICAgJCh0aGlzKS5yZW1vdmVDbGFzcygncGFuZWwtY29sbGFwc2VkJyk7XG4gICAgICAkKHRoaXMpLmZpbmQoJ2knKS5yZW1vdmVDbGFzcygnY2FyZXQtZG93bicpLmFkZENsYXNzKCdjYXJldC11cCcpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIGNvbGxhcHNlIHRoZSBwYW5lbFxuICAgICAgJCh0aGlzKS5wYXJlbnRzKCcucGFuZWwnKS5maW5kKCcucGFuZWwtYm9keScpLnNsaWRlVXAoKTtcbiAgICAgICQodGhpcykuYWRkQ2xhc3MoJ3BhbmVsLWNvbGxhcHNlZCcpO1xuICAgICAgJCh0aGlzKS5maW5kKCdpJykucmVtb3ZlQ2xhc3MoJ2NhcmV0LXVwJykuYWRkQ2xhc3MoJ2NhcmV0LWRvd24nKTtcbiAgICB9XG4gIH0pO1xufVxuXG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cualF1ZXJ5IDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbC5qUXVlcnkgOiBudWxsKTtcbnZhciBzY3JvbGxlZCA9IGZhbHNlO1xuXG52YXIgc2hvd1RpbWVzdGFtcCA9IGZ1bmN0aW9uKHRpbWVzdGFtcHMsIGNvbmZpZGVuY2VzKSB7XG4gIHZhciB3b3JkID0gdGltZXN0YW1wc1swXSxcbiAgICAgIHQwID0gdGltZXN0YW1wc1sxXSxcbiAgICAgIHQxID0gdGltZXN0YW1wc1syXTtcbiAgdmFyIHRpbWVsZW5ndGggPSB0MSAtIHQwO1xuICAvLyBTaG93IGNvbmZpZGVuY2UgaWYgZGVmaW5lZCwgZWxzZSAnbi9hJ1xuICB2YXIgZGlzcGxheUNvbmZpZGVuY2UgPSBjb25maWRlbmNlcyA/IGNvbmZpZGVuY2VzWzFdLnRvU3RyaW5nKCkuc3Vic3RyaW5nKDAsIDMpIDogJ24vYSc7XG4gICQoJyNtZXRhZGF0YVRhYmxlID4gdGJvZHk6bGFzdC1jaGlsZCcpLmFwcGVuZChcbiAgICAgICc8dHI+J1xuICAgICAgKyAnPHRkPicgKyB3b3JkICsgJzwvdGQ+J1xuICAgICAgKyAnPHRkPicgKyB0MCArICc8L3RkPidcbiAgICAgICsgJzx0ZD4nICsgdDEgKyAnPC90ZD4nXG4gICAgICArICc8dGQ+JyArIGRpc3BsYXlDb25maWRlbmNlICsgJzwvdGQ+J1xuICAgICAgKyAnPC90cj4nXG4gICAgICApO1xufVxuXG5cbnZhciBzaG93TWV0YURhdGEgPSBmdW5jdGlvbihhbHRlcm5hdGl2ZSkge1xuICB2YXIgY29uZmlkZW5jZU5lc3RlZEFycmF5ID0gYWx0ZXJuYXRpdmUud29yZF9jb25maWRlbmNlOztcbiAgdmFyIHRpbWVzdGFtcE5lc3RlZEFycmF5ID0gYWx0ZXJuYXRpdmUudGltZXN0YW1wcztcbiAgaWYgKGNvbmZpZGVuY2VOZXN0ZWRBcnJheSAmJiBjb25maWRlbmNlTmVzdGVkQXJyYXkubGVuZ3RoID4gMCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29uZmlkZW5jZU5lc3RlZEFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgdGltZXN0YW1wcyA9IHRpbWVzdGFtcE5lc3RlZEFycmF5W2ldO1xuICAgICAgdmFyIGNvbmZpZGVuY2VzID0gY29uZmlkZW5jZU5lc3RlZEFycmF5W2ldO1xuICAgICAgc2hvd1RpbWVzdGFtcCh0aW1lc3RhbXBzLCBjb25maWRlbmNlcyk7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfSBlbHNlIHtcbiAgICBpZiAodGltZXN0YW1wTmVzdGVkQXJyYXkgJiYgdGltZXN0YW1wTmVzdGVkQXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgdGltZXN0YW1wTmVzdGVkQXJyYXkuZm9yRWFjaChmdW5jdGlvbih0aW1lc3RhbXApIHtcbiAgICAgICAgc2hvd1RpbWVzdGFtcCh0aW1lc3RhbXApO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5cbnZhciBBbHRlcm5hdGl2ZXMgPSBmdW5jdGlvbigpe1xuXG4gIHZhciBzdHJpbmdPbmUgPSAnJyxcbiAgICBzdHJpbmdUd28gPSAnJyxcbiAgICBzdHJpbmdUaHJlZSA9ICcnO1xuXG4gIHRoaXMuY2xlYXJTdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICBzdHJpbmdPbmUgPSAnJztcbiAgICBzdHJpbmdUd28gPSAnJztcbiAgICBzdHJpbmdUaHJlZSA9ICcnO1xuICB9O1xuXG4gIHRoaXMuc2hvd0FsdGVybmF0aXZlcyA9IGZ1bmN0aW9uKGFsdGVybmF0aXZlcywgaXNGaW5hbCwgdGVzdGluZykge1xuICAgIHZhciAkaHlwb3RoZXNlcyA9ICQoJy5oeXBvdGhlc2VzIG9sJyk7XG4gICAgJGh5cG90aGVzZXMuZW1wdHkoKTtcbiAgICAvLyAkaHlwb3RoZXNlcy5hcHBlbmQoJCgnPC9icj4nKSk7XG4gICAgYWx0ZXJuYXRpdmVzLmZvckVhY2goZnVuY3Rpb24oYWx0ZXJuYXRpdmUsIGlkeCkge1xuICAgICAgdmFyICRhbHRlcm5hdGl2ZTtcbiAgICAgIGlmIChhbHRlcm5hdGl2ZS50cmFuc2NyaXB0KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdBTFRFUk5BVElWRVMgSU5ERVgnLCBpZHgpO1xuICAgICAgICB2YXIgdHJhbnNjcmlwdCA9IGFsdGVybmF0aXZlLnRyYW5zY3JpcHQucmVwbGFjZSgvJUhFU0lUQVRJT05cXHMvZywgJycpO1xuICAgICAgICB0cmFuc2NyaXB0ID0gdHJhbnNjcmlwdC5yZXBsYWNlKC8oLilcXDF7Mix9L2csICcnKTtcbiAgICAgICAgc3dpdGNoIChpZHgpIHtcbiAgICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICBzdHJpbmdPbmUgPSBzdHJpbmdPbmUgKyB0cmFuc2NyaXB0O1xuICAgICAgICAgICAgJGFsdGVybmF0aXZlID0gJCgnPGxpIGRhdGEtaHlwb3RoZXNpcy1pbmRleD0nICsgaWR4ICsgJyA+JyArIHN0cmluZ09uZSArICc8L2xpPicpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgc3RyaW5nVHdvID0gc3RyaW5nVHdvICsgdHJhbnNjcmlwdDtcbiAgICAgICAgICAgICRhbHRlcm5hdGl2ZSA9ICQoJzxsaSBkYXRhLWh5cG90aGVzaXMtaW5kZXg9JyArIGlkeCArICcgPicgKyBzdHJpbmdUd28gKyAnPC9saT4nKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgIHN0cmluZ1RocmVlID0gc3RyaW5nVGhyZWUgKyB0cmFuc2NyaXB0O1xuICAgICAgICAgICAgJGFsdGVybmF0aXZlID0gJCgnPGxpIGRhdGEtaHlwb3RoZXNpcy1pbmRleD0nICsgaWR4ICsgJyA+JyArIHN0cmluZ1RocmVlICsgJzwvbGk+Jyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAkaHlwb3RoZXNlcy5hcHBlbmQoJGFsdGVybmF0aXZlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcbn1cblxudmFyIGFsdGVybmF0aXZlUHJvdG90eXBlID0gbmV3IEFsdGVybmF0aXZlcygpO1xuXG4vLyBUT0RPOiBDb252ZXJ0IHRvIGNsb3N1cmUgYXBwcm9hY2hcbnZhciBwcm9jZXNzU3RyaW5nID0gZnVuY3Rpb24oYmFzZVN0cmluZywgaXNGaW5pc2hlZCkge1xuXG4gIGlmIChpc0ZpbmlzaGVkKSB7XG4gICAgdmFyIGZvcm1hdHRlZFN0cmluZyA9IGJhc2VTdHJpbmcuc2xpY2UoMCwgLTEpO1xuICAgIGZvcm1hdHRlZFN0cmluZyA9IGZvcm1hdHRlZFN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIGZvcm1hdHRlZFN0cmluZy5zdWJzdHJpbmcoMSk7XG4gICAgZm9ybWF0dGVkU3RyaW5nID0gZm9ybWF0dGVkU3RyaW5nLnRyaW0oKSArICcuJztcbiAgICAkKCcjcmVzdWx0c1RleHQnKS52YWwoZm9ybWF0dGVkU3RyaW5nKTtcbiAgfSBlbHNlIHtcbiAgICAkKCcjcmVzdWx0c1RleHQnKS52YWwoYmFzZVN0cmluZyk7XG4gIH1cblxufVxuXG5leHBvcnRzLnNob3dKU09OID0gZnVuY3Rpb24obXNnLCBiYXNlSlNPTikge1xuICB2YXIganNvbiA9IEpTT04uc3RyaW5naWZ5KG1zZywgbnVsbCwgMik7XG4gIGJhc2VKU09OICs9IGpzb247XG4gIGJhc2VKU09OICs9ICdcXG4nO1xuICAkKCcjcmVzdWx0c0pTT04nKS52YWwoYmFzZUpTT04pO1xuICByZXR1cm4gYmFzZUpTT047XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVNjcm9sbCgpe1xuICAgIGlmKCFzY3JvbGxlZCl7XG4gICAgICAgIHZhciBlbGVtZW50ID0gJCgnLnRhYmxlLXNjcm9sbCcpLmdldCgwKTtcbiAgICAgICAgZWxlbWVudC5zY3JvbGxUb3AgPSBlbGVtZW50LnNjcm9sbEhlaWdodDtcbiAgICB9XG59XG5cbnZhciBpbml0U2Nyb2xsID0gZnVuY3Rpb24oKSB7XG4gICQoJy50YWJsZS1zY3JvbGwnKS5vbignc2Nyb2xsJywgZnVuY3Rpb24oKXtcbiAgICAgIHNjcm9sbGVkPXRydWU7XG4gIH0pO1xufVxuXG5cbmV4cG9ydHMuc2hvd1Jlc3VsdCA9IGZ1bmN0aW9uKG1zZywgYmFzZVN0cmluZywgY2FsbGJhY2spIHtcblxuICB2YXIgaWR4ID0gK21zZy5yZXN1bHRfaW5kZXg7XG5cbiAgaWYgKG1zZy5yZXN1bHRzICYmIG1zZy5yZXN1bHRzLmxlbmd0aCA+IDApIHtcblxuICAgIHZhciBhbHRlcm5hdGl2ZXMgPSBtc2cucmVzdWx0c1swXS5hbHRlcm5hdGl2ZXM7XG4gICAgdmFyIHRleHQgPSBtc2cucmVzdWx0c1swXS5hbHRlcm5hdGl2ZXNbMF0udHJhbnNjcmlwdCB8fCAnJztcblxuICAgIC8vQ2FwaXRhbGl6ZSBmaXJzdCB3b3JkXG4gICAgLy8gaWYgZmluYWwgcmVzdWx0cywgYXBwZW5kIGEgbmV3IHBhcmFncmFwaFxuICAgIGlmIChtc2cucmVzdWx0cyAmJiBtc2cucmVzdWx0c1swXSAmJiBtc2cucmVzdWx0c1swXS5maW5hbCkge1xuICAgICAgYmFzZVN0cmluZyArPSB0ZXh0O1xuICAgICAgdmFyIGRpc3BsYXlGaW5hbFN0cmluZyA9IGJhc2VTdHJpbmc7XG4gICAgICBkaXNwbGF5RmluYWxTdHJpbmcgPSBkaXNwbGF5RmluYWxTdHJpbmcucmVwbGFjZSgvJUhFU0lUQVRJT05cXHMvZywgJycpO1xuICAgICAgZGlzcGxheUZpbmFsU3RyaW5nID0gZGlzcGxheUZpbmFsU3RyaW5nLnJlcGxhY2UoLyguKVxcMXsyLH0vZywgJycpO1xuICAgICAgcHJvY2Vzc1N0cmluZyhkaXNwbGF5RmluYWxTdHJpbmcsIHRydWUpO1xuICAgICAgc2hvd01ldGFEYXRhKGFsdGVybmF0aXZlc1swXSk7XG4gICAgICAvLyBPbmx5IHNob3cgYWx0ZXJuYXRpdmVzIGlmIHdlJ3JlIGZpbmFsXG4gICAgICBhbHRlcm5hdGl2ZVByb3RvdHlwZS5zaG93QWx0ZXJuYXRpdmVzKGFsdGVybmF0aXZlcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciB0ZW1wU3RyaW5nID0gYmFzZVN0cmluZyArIHRleHQ7XG4gICAgICB0ZW1wU3RyaW5nID0gdGVtcFN0cmluZy5yZXBsYWNlKC8lSEVTSVRBVElPTlxccy9nLCAnJyk7XG4gICAgICB0ZW1wU3RyaW5nID0gdGVtcFN0cmluZy5yZXBsYWNlKC8oLilcXDF7Mix9L2csICcnKTtcbiAgICAgIHByb2Nlc3NTdHJpbmcodGVtcFN0cmluZywgZmFsc2UpO1xuICAgIH1cbiAgfVxuXG4gIHVwZGF0ZVNjcm9sbCgpO1xuXG4gIHJldHVybiBiYXNlU3RyaW5nO1xuXG59O1xuXG4kLnN1YnNjcmliZSgnY2xlYXJzY3JlZW4nLCBmdW5jdGlvbigpIHtcbiAgdmFyICRoeXBvdGhlc2VzID0gJCgnLmh5cG90aGVzZXMgdWwnKTtcbiAgc2Nyb2xsZWQgPSBmYWxzZTtcbiAgJGh5cG90aGVzZXMuZW1wdHkoKTtcbiAgYWx0ZXJuYXRpdmVQcm90b3R5cGUuY2xlYXJTdHJpbmcoKTtcbn0pOyIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgaGFuZGxlU2VsZWN0ZWRGaWxlID0gcmVxdWlyZSgnLi9maWxldXBsb2FkJykuaGFuZGxlU2VsZWN0ZWRGaWxlO1xuXG5leHBvcnRzLmluaXREcmFnRHJvcCA9IGZ1bmN0aW9uKGN0eCkge1xuXG4gIHZhciBkcmFnQW5kRHJvcFRhcmdldCA9ICQoZG9jdW1lbnQpO1xuXG4gIGRyYWdBbmREcm9wVGFyZ2V0Lm9uKCdkcmFnZW50ZXInLCBmdW5jdGlvbiAoZSkge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICB9KTtcblxuICBkcmFnQW5kRHJvcFRhcmdldC5vbignZHJhZ292ZXInLCBmdW5jdGlvbiAoZSkge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICB9KTtcblxuICBkcmFnQW5kRHJvcFRhcmdldC5vbignZHJvcCcsIGZ1bmN0aW9uIChlKSB7XG4gICAgY29uc29sZS5sb2coJ0ZpbGUgZHJvcHBlZCcpO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB2YXIgZXZ0ID0gZS5vcmlnaW5hbEV2ZW50O1xuICAgIC8vIEhhbmRsZSBkcmFnZ2VkIGZpbGUgZXZlbnRcbiAgICBoYW5kbGVGaWxlVXBsb2FkRXZlbnQoZXZ0KTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gaGFuZGxlRmlsZVVwbG9hZEV2ZW50KGV2dCkge1xuICAgIC8vIEluaXQgZmlsZSB1cGxvYWQgd2l0aCBkZWZhdWx0IG1vZGVsXG4gICAgdmFyIGZpbGUgPSBldnQuZGF0YVRyYW5zZmVyLmZpbGVzWzBdO1xuICAgIGhhbmRsZVNlbGVjdGVkRmlsZShjdHgudG9rZW4sIGZpbGUpO1xuICB9XG5cbn1cbiIsIlxuXG5cbmV4cG9ydHMuZmxhc2hTVkcgPSBmdW5jdGlvbihlbCkge1xuICBlbC5jc3MoeyBmaWxsOiAnI0E1MzcyNScgfSk7XG4gIGZ1bmN0aW9uIGxvb3AoKSB7XG4gICAgZWwuYW5pbWF0ZSh7IGZpbGw6ICcjQTUzNzI1JyB9LFxuICAgICAgICAxMDAwLCAnbGluZWFyJylcbiAgICAgIC5hbmltYXRlKHsgZmlsbDogJ3doaXRlJyB9LFxuICAgICAgICAgIDEwMDAsICdsaW5lYXInKTtcbiAgfVxuICAvLyByZXR1cm4gdGltZXJcbiAgdmFyIHRpbWVyID0gc2V0VGltZW91dChsb29wLCAyMDAwKTtcbiAgcmV0dXJuIHRpbWVyO1xufTtcblxuZXhwb3J0cy5zdG9wRmxhc2hTVkcgPSBmdW5jdGlvbih0aW1lcikge1xuICBlbC5jc3MoeyBmaWxsOiAnd2hpdGUnIH0gKTtcbiAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG59XG5cbmV4cG9ydHMudG9nZ2xlSW1hZ2UgPSBmdW5jdGlvbihlbCwgbmFtZSkge1xuICBpZihlbC5hdHRyKCdzcmMnKSA9PT0gJ2ltYWdlcy8nICsgbmFtZSArICcuc3ZnJykge1xuICAgIGVsLmF0dHIoXCJzcmNcIiwgJ2ltYWdlcy9zdG9wLXJlZC5zdmcnKTtcbiAgfSBlbHNlIHtcbiAgICBlbC5hdHRyKCdzcmMnLCAnaW1hZ2VzL3N0b3Auc3ZnJyk7XG4gIH1cbn1cblxudmFyIHJlc3RvcmVJbWFnZSA9IGV4cG9ydHMucmVzdG9yZUltYWdlID0gZnVuY3Rpb24oZWwsIG5hbWUpIHtcbiAgZWwuYXR0cignc3JjJywgJ2ltYWdlcy8nICsgbmFtZSArICcuc3ZnJyk7XG59XG5cbmV4cG9ydHMuc3RvcFRvZ2dsZUltYWdlID0gZnVuY3Rpb24odGltZXIsIGVsLCBuYW1lKSB7XG4gIGNsZWFySW50ZXJ2YWwodGltZXIpO1xuICByZXN0b3JlSW1hZ2UoZWwsIG5hbWUpO1xufVxuIiwiXG4ndXNlIHN0cmljdCc7XG5cbnZhciBzaG93RXJyb3IgPSByZXF1aXJlKCcuL3Nob3dlcnJvcicpLnNob3dFcnJvcjtcbnZhciBzaG93Tm90aWNlID0gcmVxdWlyZSgnLi9zaG93ZXJyb3InKS5zaG93Tm90aWNlO1xudmFyIGhhbmRsZUZpbGVVcGxvYWQgPSByZXF1aXJlKCcuLi9oYW5kbGVmaWxldXBsb2FkJykuaGFuZGxlRmlsZVVwbG9hZDtcbnZhciBlZmZlY3RzID0gcmVxdWlyZSgnLi9lZmZlY3RzJyk7XG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xuXG4vLyBOZWVkIHRvIHJlbW92ZSB0aGUgdmlldyBsb2dpYyBoZXJlIGFuZCBtb3ZlIHRoaXMgb3V0IHRvIHRoZSBoYW5kbGVmaWxldXBsb2FkIGNvbnRyb2xsZXJcbnZhciBoYW5kbGVTZWxlY3RlZEZpbGUgPSBleHBvcnRzLmhhbmRsZVNlbGVjdGVkRmlsZSA9IChmdW5jdGlvbigpIHtcblxuICAgIHZhciBydW5uaW5nID0gZmFsc2U7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24odG9rZW4sIGZpbGUpIHtcblxuICAgIHZhciBjdXJyZW50bHlEaXNwbGF5aW5nID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycpKTtcblxuICAgIC8vIGlmIChjdXJyZW50bHlEaXNwbGF5aW5nKSB7XG4gICAgLy8gICBzaG93RXJyb3IoJ0N1cnJlbnRseSBhbm90aGVyIGZpbGUgaXMgcGxheWluZywgcGxlYXNlIHN0b3AgdGhlIGZpbGUgb3Igd2FpdCB1bnRpbCBpdCBmaW5pc2hlcycpO1xuICAgIC8vICAgcmV0dXJuO1xuICAgIC8vIH1cblxuICAgICQucHVibGlzaCgnY2xlYXJzY3JlZW4nKTtcblxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgdHJ1ZSk7XG4gICAgcnVubmluZyA9IHRydWU7XG5cbiAgICAvLyBWaXN1YWwgZWZmZWN0c1xuICAgIHZhciB1cGxvYWRJbWFnZVRhZyA9ICQoJyNmaWxlVXBsb2FkVGFyZ2V0ID4gaW1nJyk7XG4gICAgdmFyIHRpbWVyID0gc2V0SW50ZXJ2YWwoZWZmZWN0cy50b2dnbGVJbWFnZSwgNzUwLCB1cGxvYWRJbWFnZVRhZywgJ3N0b3AnKTtcbiAgICB2YXIgdXBsb2FkVGV4dCA9ICQoJyNmaWxlVXBsb2FkVGFyZ2V0ID4gc3BhbicpO1xuICAgIHVwbG9hZFRleHQudGV4dCgnU3RvcCBUcmFuc2NyaWJpbmcnKTtcblxuICAgIGZ1bmN0aW9uIHJlc3RvcmVVcGxvYWRUYWIoKSB7XG4gICAgICBjbGVhckludGVydmFsKHRpbWVyKTtcbiAgICAgIGVmZmVjdHMucmVzdG9yZUltYWdlKHVwbG9hZEltYWdlVGFnLCAndXBsb2FkJyk7XG4gICAgICB1cGxvYWRUZXh0LnRleHQoJ1NlbGVjdCBGaWxlJyk7XG4gICAgfVxuXG4gICAgLy8gQ2xlYXIgZmxhc2hpbmcgaWYgc29ja2V0IHVwbG9hZCBpcyBzdG9wcGVkXG4gICAgJC5zdWJzY3JpYmUoJ2hhcmRzb2NrZXRzdG9wJywgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgcmVzdG9yZVVwbG9hZFRhYigpO1xuICAgIH0pO1xuXG5cbiAgICAvLyBHZXQgY3VycmVudCBtb2RlbFxuICAgIHZhciBjdXJyZW50TW9kZWwgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudE1vZGVsJyk7XG4gICAgY29uc29sZS5sb2coJ2N1cnJlbnRNb2RlbCcsIGN1cnJlbnRNb2RlbCk7XG5cbiAgICAvLyBSZWFkIGZpcnN0IDQgYnl0ZXMgdG8gZGV0ZXJtaW5lIGhlYWRlclxuICAgIHZhciBibG9iVG9UZXh0ID0gbmV3IEJsb2IoW2ZpbGVdKS5zbGljZSgwLCA0KTtcbiAgICB2YXIgciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgci5yZWFkQXNUZXh0KGJsb2JUb1RleHQpO1xuICAgIHIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY29udGVudFR5cGU7XG4gICAgICBpZiAoci5yZXN1bHQgPT09ICdmTGFDJykge1xuICAgICAgICBjb250ZW50VHlwZSA9ICdhdWRpby9mbGFjJztcbiAgICAgICAgc2hvd05vdGljZSgnTm90aWNlOiBicm93c2VycyBkbyBub3Qgc3VwcG9ydCBwbGF5aW5nIEZMQUMgYXVkaW8sIHNvIG5vIGF1ZGlvIHdpbGwgYWNjb21wYW55IHRoZSB0cmFuc2NyaXB0aW9uJyk7XG4gICAgICB9IGVsc2UgaWYgKHIucmVzdWx0ID09PSAnUklGRicpIHtcbiAgICAgICAgY29udGVudFR5cGUgPSAnYXVkaW8vd2F2JztcbiAgICAgICAgdmFyIGF1ZGlvID0gbmV3IEF1ZGlvKCk7XG4gICAgICAgIHZhciB3YXZCbG9iID0gbmV3IEJsb2IoW2ZpbGVdLCB7dHlwZTogJ2F1ZGlvL3dhdid9KTtcbiAgICAgICAgdmFyIHdhdlVSTCA9IFVSTC5jcmVhdGVPYmplY3RVUkwod2F2QmxvYik7XG4gICAgICAgIGF1ZGlvLnNyYyA9IHdhdlVSTDtcbiAgICAgICAgYXVkaW8ucGxheSgpO1xuICAgICAgICAkLnN1YnNjcmliZSgnaGFyZHNvY2tldHN0b3AnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBhdWRpby5wYXVzZSgpO1xuICAgICAgICAgIGF1ZGlvLmN1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN0b3JlVXBsb2FkVGFiKCk7XG4gICAgICAgIHNob3dFcnJvcignT25seSBXQVYgb3IgRkxBQyBmaWxlcyBjYW4gYmUgdHJhbnNjcmliZWQsIHBsZWFzZSB0cnkgYW5vdGhlciBmaWxlIGZvcm1hdCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBoYW5kbGVGaWxlVXBsb2FkKHRva2VuLCBjdXJyZW50TW9kZWwsIGZpbGUsIGNvbnRlbnRUeXBlLCBmdW5jdGlvbihzb2NrZXQpIHtcbiAgICAgICAgdmFyIGJsb2IgPSBuZXcgQmxvYihbZmlsZV0pO1xuICAgICAgICB2YXIgcGFyc2VPcHRpb25zID0ge1xuICAgICAgICAgIGZpbGU6IGJsb2JcbiAgICAgICAgfTtcbiAgICAgICAgdXRpbHMub25GaWxlUHJvZ3Jlc3MocGFyc2VPcHRpb25zLFxuICAgICAgICAgIC8vIE9uIGRhdGEgY2h1bmtcbiAgICAgICAgICBmdW5jdGlvbihjaHVuaykge1xuICAgICAgICAgICAgc29ja2V0LnNlbmQoY2h1bmspO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgLy8gT24gZmlsZSByZWFkIGVycm9yXG4gICAgICAgICAgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnRXJyb3IgcmVhZGluZyBmaWxlOiAnLCBldnQubWVzc2FnZSk7XG4gICAgICAgICAgICBzaG93RXJyb3IoJ0Vycm9yOiAnICsgZXZ0Lm1lc3NhZ2UpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgLy8gT24gbG9hZCBlbmRcbiAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHsnYWN0aW9uJzogJ3N0b3AnfSkpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSwgXG4gICAgICAgIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgIGVmZmVjdHMuc3RvcFRvZ2dsZUltYWdlKHRpbWVyLCB1cGxvYWRJbWFnZVRhZywgJ3VwbG9hZCcpO1xuICAgICAgICAgIHVwbG9hZFRleHQudGV4dCgnU2VsZWN0IEZpbGUnKTtcbiAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIGZhbHNlKTtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9O1xuICB9XG59KSgpO1xuXG5cbmV4cG9ydHMuaW5pdEZpbGVVcGxvYWQgPSBmdW5jdGlvbihjdHgpIHtcblxuICB2YXIgZmlsZVVwbG9hZERpYWxvZyA9ICQoXCIjZmlsZVVwbG9hZERpYWxvZ1wiKTtcblxuICBmaWxlVXBsb2FkRGlhbG9nLmNoYW5nZShmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgZmlsZSA9IGZpbGVVcGxvYWREaWFsb2cuZ2V0KDApLmZpbGVzWzBdO1xuICAgIGhhbmRsZVNlbGVjdGVkRmlsZShjdHgudG9rZW4sIGZpbGUpO1xuICB9KTtcblxuICAkKFwiI2ZpbGVVcGxvYWRUYXJnZXRcIikuY2xpY2soZnVuY3Rpb24oZXZ0KSB7XG5cbiAgICB2YXIgY3VycmVudGx5RGlzcGxheWluZyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnKSk7XG5cbiAgICBpZiAoY3VycmVudGx5RGlzcGxheWluZykge1xuICAgICAgY29uc29sZS5sb2coJ0hBUkQgU09DS0VUIFNUT1AnKTtcbiAgICAgICQucHVibGlzaCgnaGFyZHNvY2tldHN0b3AnKTtcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZpbGVVcGxvYWREaWFsb2cudmFsKG51bGwpO1xuXG4gICAgZmlsZVVwbG9hZERpYWxvZ1xuICAgIC50cmlnZ2VyKCdjbGljaycpO1xuXG4gIH0pO1xuXG59IiwiXG52YXIgaW5pdFNlc3Npb25QZXJtaXNzaW9ucyA9IHJlcXVpcmUoJy4vc2Vzc2lvbnBlcm1pc3Npb25zJykuaW5pdFNlc3Npb25QZXJtaXNzaW9ucztcbnZhciBpbml0U2VsZWN0TW9kZWwgPSByZXF1aXJlKCcuL3NlbGVjdG1vZGVsJykuaW5pdFNlbGVjdE1vZGVsO1xudmFyIGluaXRBbmltYXRlUGFuZWwgPSByZXF1aXJlKCcuL2FuaW1hdGVwYW5lbCcpLmluaXRBbmltYXRlUGFuZWw7XG52YXIgaW5pdFNob3dUYWIgPSByZXF1aXJlKCcuL3Nob3d0YWInKS5pbml0U2hvd1RhYjtcbnZhciBpbml0RHJhZ0Ryb3AgPSByZXF1aXJlKCcuL2RyYWdkcm9wJykuaW5pdERyYWdEcm9wO1xudmFyIGluaXRQbGF5U2FtcGxlID0gcmVxdWlyZSgnLi9wbGF5c2FtcGxlJykuaW5pdFBsYXlTYW1wbGU7XG52YXIgaW5pdFJlY29yZEJ1dHRvbiA9IHJlcXVpcmUoJy4vcmVjb3JkYnV0dG9uJykuaW5pdFJlY29yZEJ1dHRvbjtcbnZhciBpbml0RmlsZVVwbG9hZCA9IHJlcXVpcmUoJy4vZmlsZXVwbG9hZCcpLmluaXRGaWxlVXBsb2FkO1xuXG5cbmV4cG9ydHMuaW5pdFZpZXdzID0gZnVuY3Rpb24oY3R4KSB7XG4gIGNvbnNvbGUubG9nKCdJbml0aWFsaXppbmcgdmlld3MuLi4nKTtcbiAgaW5pdFNlbGVjdE1vZGVsKGN0eCk7XG4gIGluaXRQbGF5U2FtcGxlKGN0eCk7XG4gIGluaXREcmFnRHJvcChjdHgpO1xuICBpbml0UmVjb3JkQnV0dG9uKGN0eCk7XG4gIGluaXRGaWxlVXBsb2FkKGN0eCk7XG4gIGluaXRTZXNzaW9uUGVybWlzc2lvbnMoKTtcbiAgaW5pdFNob3dUYWIoKTtcbiAgaW5pdEFuaW1hdGVQYW5lbCgpO1xuICBpbml0U2hvd1RhYigpO1xufSIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xudmFyIG9uRmlsZVByb2dyZXNzID0gdXRpbHMub25GaWxlUHJvZ3Jlc3M7XG52YXIgaGFuZGxlRmlsZVVwbG9hZCA9IHJlcXVpcmUoJy4uL2hhbmRsZWZpbGV1cGxvYWQnKS5oYW5kbGVGaWxlVXBsb2FkO1xudmFyIGluaXRTb2NrZXQgPSByZXF1aXJlKCcuLi9zb2NrZXQnKS5pbml0U29ja2V0O1xudmFyIHNob3dFcnJvciA9IHJlcXVpcmUoJy4vc2hvd2Vycm9yJykuc2hvd0Vycm9yO1xudmFyIGVmZmVjdHMgPSByZXF1aXJlKCcuL2VmZmVjdHMnKTtcblxuXG52YXIgTE9PS1VQX1RBQkxFID0ge1xuICAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnOiBbJ1VzX0VuZ2xpc2hfQnJvYWRiYW5kX1NhbXBsZV8xLndhdicsICdVc19FbmdsaXNoX0Jyb2FkYmFuZF9TYW1wbGVfMi53YXYnXSxcbiAgJ2VuLVVTX05hcnJvd2JhbmRNb2RlbCc6IFsnVXNfRW5nbGlzaF9OYXJyb3diYW5kX1NhbXBsZV8xLndhdicsICdVc19FbmdsaXNoX05hcnJvd2JhbmRfU2FtcGxlXzIud2F2J10sXG4gICdlcy1FU19Ccm9hZGJhbmRNb2RlbCc6IFsnRXNfRVNfc3BrMjRfMTZraHoud2F2JywgJ0VzX0VTX3NwazE5XzE2a2h6LndhdiddLFxuICAnZXMtRVNfTmFycm93YmFuZE1vZGVsJzogWydFc19FU19zcGsyNF84a2h6LndhdicsICdFc19FU19zcGsxOV84a2h6LndhdiddLFxuICAnamEtSlBfQnJvYWRiYW5kTW9kZWwnOiBbJ3NhbXBsZS1KYV9KUC13aWRlMS53YXYnLCAnc2FtcGxlLUphX0pQLXdpZGUyLndhdiddLFxuICAnamEtSlBfTmFycm93YmFuZE1vZGVsJzogWydzYW1wbGUtSmFfSlAtbmFycm93My53YXYnLCAnc2FtcGxlLUphX0pQLW5hcnJvdzQud2F2J11cbn07XG5cbnZhciBwbGF5U2FtcGxlID0gKGZ1bmN0aW9uKCkge1xuXG4gIHZhciBydW5uaW5nID0gZmFsc2U7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuXG4gIHJldHVybiBmdW5jdGlvbih0b2tlbiwgaW1hZ2VUYWcsIGljb25OYW1lLCB1cmwsIGNhbGxiYWNrKSB7XG5cbiAgICAkLnB1Ymxpc2goJ2NsZWFyc2NyZWVuJyk7XG5cbiAgICB2YXIgY3VycmVudGx5RGlzcGxheWluZyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnKSk7XG5cbiAgICBjb25zb2xlLmxvZygnQ1VSUkVOVExZIERJU1BMQVlJTkcnLCBjdXJyZW50bHlEaXNwbGF5aW5nKTtcblxuICAgIC8vIFRoaXMgZXJyb3IgaGFuZGxpbmcgbmVlZHMgdG8gYmUgZXhwYW5kZWQgdG8gYWNjb21vZGF0ZVxuICAgIC8vIHRoZSB0d28gZGlmZmVyZW50IHBsYXkgc2FtcGxlcyBmaWxlc1xuICAgIGlmIChjdXJyZW50bHlEaXNwbGF5aW5nKSB7XG4gICAgICBjb25zb2xlLmxvZygnSEFSRCBTT0NLRVQgU1RPUCcpO1xuICAgICAgJC5wdWJsaXNoKCdzb2NrZXRzdG9wJyk7XG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIGZhbHNlKTtcbiAgICAgIGVmZmVjdHMuc3RvcFRvZ2dsZUltYWdlKHRpbWVyLCBpbWFnZVRhZywgaWNvbk5hbWUpO1xuICAgICAgZWZmZWN0cy5yZXN0b3JlSW1hZ2UoaW1hZ2VUYWcsIGljb25OYW1lKTtcbiAgICAgIHJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoY3VycmVudGx5RGlzcGxheWluZyAmJiBydW5uaW5nKSB7XG4gICAgICBzaG93RXJyb3IoJ0N1cnJlbnRseSBhbm90aGVyIGZpbGUgaXMgcGxheWluZywgcGxlYXNlIHN0b3AgdGhlIGZpbGUgb3Igd2FpdCB1bnRpbCBpdCBmaW5pc2hlcycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgdHJ1ZSk7XG4gICAgcnVubmluZyA9IHRydWU7XG5cbiAgICB2YXIgdGltZXIgPSBzZXRJbnRlcnZhbChlZmZlY3RzLnRvZ2dsZUltYWdlLCA3NTAsIGltYWdlVGFnLCBpY29uTmFtZSk7XG5cbiAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgeGhyLm9wZW4oJ0dFVCcsIHVybCwgdHJ1ZSk7XG4gICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdibG9iJztcbiAgICB4aHIub25sb2FkID0gZnVuY3Rpb24oZSkge1xuICAgICAgdmFyIGJsb2IgPSB4aHIucmVzcG9uc2U7XG4gICAgICB2YXIgY3VycmVudE1vZGVsID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRNb2RlbCcpIHx8ICdlbi1VU19Ccm9hZGJhbmRNb2RlbCc7XG4gICAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgIHZhciBibG9iVG9UZXh0ID0gbmV3IEJsb2IoW2Jsb2JdKS5zbGljZSgwLCA0KTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGJsb2JUb1RleHQpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgY29udGVudFR5cGUgPSByZWFkZXIucmVzdWx0ID09PSAnZkxhQycgPyAnYXVkaW8vZmxhYycgOiAnYXVkaW8vd2F2JztcbiAgICAgICAgY29uc29sZS5sb2coJ1VwbG9hZGluZyBmaWxlJywgcmVhZGVyLnJlc3VsdCk7XG4gICAgICAgIHZhciBtZWRpYVNvdXJjZVVSTCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XG4gICAgICAgIHZhciBhdWRpbyA9IG5ldyBBdWRpbygpO1xuICAgICAgICBhdWRpby5zcmMgPSBtZWRpYVNvdXJjZVVSTDtcbiAgICAgICAgYXVkaW8ucGxheSgpO1xuICAgICAgICAkLnN1YnNjcmliZSgnaGFyZHNvY2tldHN0b3AnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBhdWRpby5wYXVzZSgpO1xuICAgICAgICAgIGF1ZGlvLmN1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgfSk7XG4gICAgICAgICQuc3Vic2NyaWJlKCdzb2NrZXRzdG9wJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgYXVkaW8ucGF1c2UoKTtcbiAgICAgICAgICBhdWRpby5jdXJyZW50VGltZSA9IDA7XG4gICAgICAgIH0pO1xuICAgICAgICBoYW5kbGVGaWxlVXBsb2FkKHRva2VuLCBjdXJyZW50TW9kZWwsIGJsb2IsIGNvbnRlbnRUeXBlLCBmdW5jdGlvbihzb2NrZXQpIHtcbiAgICAgICAgICB2YXIgcGFyc2VPcHRpb25zID0ge1xuICAgICAgICAgICAgZmlsZTogYmxvYlxuICAgICAgICAgIH07XG4gICAgICAgICAgb25GaWxlUHJvZ3Jlc3MocGFyc2VPcHRpb25zLFxuICAgICAgICAgICAgLy8gT24gZGF0YSBjaHVua1xuICAgICAgICAgICAgZnVuY3Rpb24oY2h1bmspIHtcbiAgICAgICAgICAgICAgc29ja2V0LnNlbmQoY2h1bmspO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIC8vIE9uIGZpbGUgcmVhZCBlcnJvclxuICAgICAgICAgICAgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdFcnJvciByZWFkaW5nIGZpbGU6ICcsIGV2dC5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgLy8gc2hvd0Vycm9yKGV2dC5tZXNzYWdlKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyBPbiBsb2FkIGVuZFxuICAgICAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHsnYWN0aW9uJzogJ3N0b3AnfSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIFxuICAgICAgICAvLyBPbiBjb25uZWN0aW9uIGVuZFxuICAgICAgICAgIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgICAgZWZmZWN0cy5zdG9wVG9nZ2xlSW1hZ2UodGltZXIsIGltYWdlVGFnLCBpY29uTmFtZSk7XG4gICAgICAgICAgICBlZmZlY3RzLnJlc3RvcmVJbWFnZShpbWFnZVRhZywgaWNvbk5hbWUpO1xuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgfTtcbiAgICB9O1xuICAgIHhoci5zZW5kKCk7XG4gIH07XG59KSgpO1xuXG5cbmV4cG9ydHMuaW5pdFBsYXlTYW1wbGUgPSBmdW5jdGlvbihjdHgpIHtcblxuICAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIGZpbGVOYW1lID0gJ2F1ZGlvLycgKyBMT09LVVBfVEFCTEVbY3R4LmN1cnJlbnRNb2RlbF1bMF07XG4gICAgdmFyIGVsID0gJCgnLnBsYXktc2FtcGxlLTEnKTtcbiAgICBlbC5vZmYoJ2NsaWNrJyk7XG4gICAgdmFyIGljb25OYW1lID0gJ3BsYXknO1xuICAgIHZhciBpbWFnZVRhZyA9IGVsLmZpbmQoJ2ltZycpO1xuICAgIGVsLmNsaWNrKCBmdW5jdGlvbihldnQpIHtcbiAgICAgIHBsYXlTYW1wbGUoY3R4LnRva2VuLCBpbWFnZVRhZywgaWNvbk5hbWUsIGZpbGVOYW1lLCBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1BsYXkgc2FtcGxlIHJlc3VsdCcsIHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSkoY3R4LCBMT09LVVBfVEFCTEUpO1xuXG4gIChmdW5jdGlvbigpIHtcbiAgICB2YXIgZmlsZU5hbWUgPSAnYXVkaW8vJyArIExPT0tVUF9UQUJMRVtjdHguY3VycmVudE1vZGVsXVsxXTtcbiAgICB2YXIgZWwgPSAkKCcucGxheS1zYW1wbGUtMicpO1xuICAgIGVsLm9mZignY2xpY2snKTtcbiAgICB2YXIgaWNvbk5hbWUgPSAncGxheSc7XG4gICAgdmFyIGltYWdlVGFnID0gZWwuZmluZCgnaW1nJyk7XG4gICAgZWwuY2xpY2soIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgcGxheVNhbXBsZShjdHgudG9rZW4sIGltYWdlVGFnLCBpY29uTmFtZSwgZmlsZU5hbWUsIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBjb25zb2xlLmxvZygnUGxheSBzYW1wbGUgcmVzdWx0JywgcmVzdWx0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KShjdHgsIExPT0tVUF9UQUJMRSk7XG5cbn07IiwiXG4ndXNlIHN0cmljdCc7XG5cbnZhciBNaWNyb3Bob25lID0gcmVxdWlyZSgnLi4vTWljcm9waG9uZScpO1xudmFyIGhhbmRsZU1pY3JvcGhvbmUgPSByZXF1aXJlKCcuLi9oYW5kbGVtaWNyb3Bob25lJykuaGFuZGxlTWljcm9waG9uZTtcbnZhciBzaG93RXJyb3IgPSByZXF1aXJlKCcuL3Nob3dlcnJvcicpLnNob3dFcnJvcjtcbnZhciBzaG93Tm90aWNlID0gcmVxdWlyZSgnLi9zaG93ZXJyb3InKS5zaG93Tm90aWNlO1xuXG5leHBvcnRzLmluaXRSZWNvcmRCdXR0b24gPSBmdW5jdGlvbihjdHgpIHtcblxuICB2YXIgcmVjb3JkQnV0dG9uID0gJCgnI3JlY29yZEJ1dHRvbicpO1xuXG4gIHJlY29yZEJ1dHRvbi5jbGljaygoZnVuY3Rpb24oKSB7XG5cbiAgICB2YXIgcnVubmluZyA9IGZhbHNlO1xuICAgIHZhciB0b2tlbiA9IGN0eC50b2tlbjtcbiAgICB2YXIgbWljT3B0aW9ucyA9IHtcbiAgICAgIGJ1ZmZlclNpemU6IGN0eC5idWZmZXJzaXplXG4gICAgfTtcbiAgICB2YXIgbWljID0gbmV3IE1pY3JvcGhvbmUobWljT3B0aW9ucyk7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAvLyBQcmV2ZW50IGRlZmF1bHQgYW5jaG9yIGJlaGF2aW9yXG4gICAgICBldnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgdmFyIGN1cnJlbnRNb2RlbCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50TW9kZWwnKTtcbiAgICAgIHZhciBjdXJyZW50bHlEaXNwbGF5aW5nID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycpKTtcblxuICAgICAgaWYgKGN1cnJlbnRseURpc3BsYXlpbmcpIHtcbiAgICAgICAgc2hvd0Vycm9yKCdDdXJyZW50bHkgYW5vdGhlciBmaWxlIGlzIHBsYXlpbmcsIHBsZWFzZSBzdG9wIHRoZSBmaWxlIG9yIHdhaXQgdW50aWwgaXQgZmluaXNoZXMnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAkLnN1YnNjcmliZSgnc3RvcG1pYycsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgbWljLnN0b3AoKTtcbiAgICAgICAgc2hvd05vdGljZSgnT25seSA0NSBzZWNvbmRzIG9yIGxlc3Mgb2YgcmVjb3JkZWQgYXVkaW8gYXJlIGN1cnJlbnRseSBwZXJtaXR0ZWQgaW4gdGhlIGRlbW9uc3RyYXRpb24nKTtcbiAgICAgICAgcmVjb3JkQnV0dG9uLnJlbW92ZUF0dHIoJ3N0eWxlJyk7XG4gICAgICAgIHJlY29yZEJ1dHRvbi5maW5kKCdpbWcnKS5hdHRyKCdzcmMnLCAnaW1hZ2VzL21pY3JvcGhvbmUuc3ZnJyk7XG4gICAgICAgIHJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXJ1bm5pbmcpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ05vdCBydW5uaW5nLCBoYW5kbGVNaWNyb3Bob25lKCknKTtcbiAgICAgICAgaGFuZGxlTWljcm9waG9uZSh0b2tlbiwgY3VycmVudE1vZGVsLCBtaWMsIGZ1bmN0aW9uKGVyciwgc29ja2V0KSB7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgdmFyIG1zZyA9ICdFcnJvcjogJyArIGVyci5tZXNzYWdlO1xuICAgICAgICAgICAgY29uc29sZS5sb2cobXNnKTtcbiAgICAgICAgICAgIHNob3dFcnJvcihtc2cpO1xuICAgICAgICAgICAgcnVubmluZyA9IGZhbHNlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWNvcmRCdXR0b24uY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJyNkNzQxMDgnKTtcbiAgICAgICAgICAgIHJlY29yZEJ1dHRvbi5maW5kKCdpbWcnKS5hdHRyKCdzcmMnLCAnaW1hZ2VzL3N0b3Auc3ZnJyk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnc3RhcnRpbmcgbWljJyk7XG4gICAgICAgICAgICBtaWMucmVjb3JkKCk7XG4gICAgICAgICAgICBydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1N0b3BwaW5nIG1pY3JvcGhvbmUsIHNlbmRpbmcgc3RvcCBhY3Rpb24gbWVzc2FnZScpO1xuICAgICAgICByZWNvcmRCdXR0b24ucmVtb3ZlQXR0cignc3R5bGUnKTtcbiAgICAgICAgcmVjb3JkQnV0dG9uLmZpbmQoJ2ltZycpLmF0dHIoJ3NyYycsICdpbWFnZXMvbWljcm9waG9uZS5zdmcnKTtcbiAgICAgICAgJC5wdWJsaXNoKCdoYXJkc29ja2V0c3RvcCcpO1xuICAgICAgICBtaWMuc3RvcCgpO1xuICAgICAgICBydW5uaW5nID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICB9KSgpKTtcbn0iLCJcbnZhciBpbml0UGxheVNhbXBsZSA9IHJlcXVpcmUoJy4vcGxheXNhbXBsZScpLmluaXRQbGF5U2FtcGxlO1xuXG5leHBvcnRzLmluaXRTZWxlY3RNb2RlbCA9IGZ1bmN0aW9uKGN0eCkge1xuXG4gIGZ1bmN0aW9uIGlzRGVmYXVsdChtb2RlbCkge1xuICAgIHJldHVybiBtb2RlbCA9PT0gJ2VuLVVTX0Jyb2FkYmFuZE1vZGVsJztcbiAgfVxuXG4gIGN0eC5tb2RlbHMuZm9yRWFjaChmdW5jdGlvbihtb2RlbCkge1xuICAgICQoXCIjZHJvcGRvd25NZW51TGlzdFwiKS5hcHBlbmQoXG4gICAgICAkKFwiPGxpPlwiKVxuICAgICAgICAuYXR0cigncm9sZScsICdwcmVzZW50YXRpb24nKVxuICAgICAgICAuYXBwZW5kKFxuICAgICAgICAgICQoJzxhPicpLmF0dHIoJ3JvbGUnLCAnbWVudS1pdGVtJylcbiAgICAgICAgICAgIC5hdHRyKCdocmVmJywgJy8nKVxuICAgICAgICAgICAgLmF0dHIoJ2RhdGEtbW9kZWwnLCBtb2RlbC5uYW1lKVxuICAgICAgICAgICAgLmFwcGVuZChtb2RlbC5kZXNjcmlwdGlvbilcbiAgICAgICAgICApXG4gICAgICApXG4gIH0pO1xuXG4gICQoXCIjZHJvcGRvd25NZW51TGlzdFwiKS5jbGljayhmdW5jdGlvbihldnQpIHtcbiAgICBldnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgY29uc29sZS5sb2coJ0NoYW5nZSB2aWV3JywgJChldnQudGFyZ2V0KS50ZXh0KCkpO1xuICAgIHZhciBuZXdNb2RlbERlc2NyaXB0aW9uID0gJChldnQudGFyZ2V0KS50ZXh0KCk7XG4gICAgdmFyIG5ld01vZGVsID0gJChldnQudGFyZ2V0KS5kYXRhKCdtb2RlbCcpO1xuICAgICQoJyNkcm9wZG93bk1lbnVEZWZhdWx0JykuZW1wdHkoKS50ZXh0KG5ld01vZGVsRGVzY3JpcHRpb24pO1xuICAgICQoJyNkcm9wZG93bk1lbnUxJykuZHJvcGRvd24oJ3RvZ2dsZScpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50TW9kZWwnLCBuZXdNb2RlbCk7XG4gICAgY3R4LmN1cnJlbnRNb2RlbCA9IG5ld01vZGVsO1xuICAgIGluaXRQbGF5U2FtcGxlKGN0eCk7XG4gICAgJC5wdWJsaXNoKCdjbGVhcnNjcmVlbicpO1xuICB9KTtcblxufSIsIlxuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLmluaXRTZXNzaW9uUGVybWlzc2lvbnMgPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJ0luaXRpYWxpemluZyBzZXNzaW9uIHBlcm1pc3Npb25zIGhhbmRsZXInKTtcbiAgLy8gUmFkaW8gYnV0dG9uc1xuICB2YXIgc2Vzc2lvblBlcm1pc3Npb25zUmFkaW8gPSAkKFwiI3Nlc3Npb25QZXJtaXNzaW9uc1JhZGlvR3JvdXAgaW5wdXRbdHlwZT0ncmFkaW8nXVwiKTtcbiAgc2Vzc2lvblBlcm1pc3Npb25zUmFkaW8uY2xpY2soZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIGNoZWNrZWRWYWx1ZSA9IHNlc3Npb25QZXJtaXNzaW9uc1JhZGlvLmZpbHRlcignOmNoZWNrZWQnKS52YWwoKTtcbiAgICBjb25zb2xlLmxvZygnY2hlY2tlZFZhbHVlJywgY2hlY2tlZFZhbHVlKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnc2Vzc2lvblBlcm1pc3Npb25zJywgY2hlY2tlZFZhbHVlKTtcbiAgfSk7XG59XG4iLCJcbid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5zaG93RXJyb3IgPSBmdW5jdGlvbihtc2cpIHtcbiAgY29uc29sZS5sb2coJ0Vycm9yOiAnLCBtc2cpO1xuICB2YXIgZXJyb3JBbGVydCA9ICQoJy5lcnJvci1yb3cnKTtcbiAgZXJyb3JBbGVydC5oaWRlKCk7XG4gIGVycm9yQWxlcnQuY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJyNkNzQxMDgnKTtcbiAgZXJyb3JBbGVydC5jc3MoJ2NvbG9yJywgJ3doaXRlJyk7XG4gIHZhciBlcnJvck1lc3NhZ2UgPSAkKCcjZXJyb3JNZXNzYWdlJyk7XG4gIGVycm9yTWVzc2FnZS50ZXh0KG1zZyk7XG4gIGVycm9yQWxlcnQuc2hvdygpO1xuICAkKCcjZXJyb3JDbG9zZScpLmNsaWNrKGZ1bmN0aW9uKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXJyb3JBbGVydC5oaWRlKCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9KTtcbn1cblxuZXhwb3J0cy5zaG93Tm90aWNlID0gZnVuY3Rpb24obXNnKSB7XG4gIGNvbnNvbGUubG9nKCdOb3RpY2U6ICcsIG1zZyk7XG4gIHZhciBub3RpY2VBbGVydCA9ICQoJy5ub3RpZmljYXRpb24tcm93Jyk7XG4gIG5vdGljZUFsZXJ0LmhpZGUoKTtcbiAgbm90aWNlQWxlcnQuY3NzKCdib3JkZXInLCAnMnB4IHNvbGlkICNlY2VjZWMnKTtcbiAgbm90aWNlQWxlcnQuY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJyNmNGY0ZjQnKTtcbiAgbm90aWNlQWxlcnQuY3NzKCdjb2xvcicsICdibGFjaycpO1xuICB2YXIgbm90aWNlTWVzc2FnZSA9ICQoJyNub3RpZmljYXRpb25NZXNzYWdlJyk7XG4gIG5vdGljZU1lc3NhZ2UudGV4dChtc2cpO1xuICBub3RpY2VBbGVydC5zaG93KCk7XG4gICQoJyNub3RpZmljYXRpb25DbG9zZScpLmNsaWNrKGZ1bmN0aW9uKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgbm90aWNlQWxlcnQuaGlkZSgpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSk7XG59XG5cbmV4cG9ydHMuaGlkZUVycm9yID0gZnVuY3Rpb24oKSB7XG4gIHZhciBlcnJvckFsZXJ0ID0gJCgnLmVycm9yLXJvdycpO1xuICBlcnJvckFsZXJ0LmhpZGUoKTtcbn0iLCJcblxuZXhwb3J0cy5pbml0U2hvd1RhYiA9IGZ1bmN0aW9uKCkge1xuICAkKCcjbmF2LXRhYnMgYScpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAkKHRoaXMpLnRhYignc2hvdycpXG4gIH0pO1xufVxuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4vKmdsb2JhbCAkOmZhbHNlICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIE1pY3JvcGhvbmUgPSByZXF1aXJlKCcuL01pY3JvcGhvbmUnKTtcbnZhciBtb2RlbHMgPSByZXF1aXJlKCcuL2RhdGEvbW9kZWxzLmpzb24nKS5tb2RlbHM7XG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG51dGlscy5pbml0UHViU3ViKCk7XG52YXIgaW5pdFZpZXdzID0gcmVxdWlyZSgnLi92aWV3cycpLmluaXRWaWV3cztcbnZhciBwa2cgPSByZXF1aXJlKCcuLi9wYWNrYWdlLmpzb24nKTtcblxud2luZG93LkJVRkZFUlNJWkUgPSA4MTkyO1xuXG4kKGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpIHtcblxuICAvLyBUZW1wb3JhcnkgYXBwIGRhdGFcbiAgJCgnI2FwcFNldHRpbmdzJylcbiAgICAuaHRtbChcbiAgICAgICc8cD5WZXJzaW9uOiAnICsgcGtnLnZlcnNpb24gKyAnPC9wPidcbiAgICAgICsgJzxwPkJ1ZmZlciBTaXplOiAnICsgQlVGRkVSU0laRSArICc8L3A+J1xuICAgICk7XG5cblxuICAvLyBNYWtlIGNhbGwgdG8gQVBJIHRvIHRyeSBhbmQgZ2V0IHRva2VuXG4gIHV0aWxzLmdldFRva2VuKGZ1bmN0aW9uKHRva2VuKSB7XG5cbiAgICB3aW5kb3cub25iZWZvcmV1bmxvYWQgPSBmdW5jdGlvbihlKSB7XG4gICAgICBsb2NhbFN0b3JhZ2UuY2xlYXIoKTtcbiAgICB9O1xuXG4gICAgaWYgKCF0b2tlbikge1xuICAgICAgY29uc29sZS5lcnJvcignTm8gYXV0aG9yaXphdGlvbiB0b2tlbiBhdmFpbGFibGUnKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0F0dGVtcHRpbmcgdG8gcmVjb25uZWN0Li4uJyk7XG4gICAgfVxuXG4gICAgdmFyIHZpZXdDb250ZXh0ID0ge1xuICAgICAgY3VycmVudE1vZGVsOiAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnLFxuICAgICAgbW9kZWxzOiBtb2RlbHMsXG4gICAgICB0b2tlbjogdG9rZW4sXG4gICAgICBidWZmZXJTaXplOiBCVUZGRVJTSVpFXG4gICAgfTtcblxuICAgIGluaXRWaWV3cyh2aWV3Q29udGV4dCk7XG5cbiAgICAvLyBTYXZlIG1vZGVscyB0byBsb2NhbHN0b3JhZ2VcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbW9kZWxzJywgSlNPTi5zdHJpbmdpZnkobW9kZWxzKSk7XG5cbiAgICAvLyBTZXQgZGVmYXVsdCBjdXJyZW50IG1vZGVsXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRNb2RlbCcsICdlbi1VU19Ccm9hZGJhbmRNb2RlbCcpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzZXNzaW9uUGVybWlzc2lvbnMnLCAndHJ1ZScpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtaWNSdW5uaW5nJywgJ2ZhbHNlJyk7XG5cblxuICAgICQuc3Vic2NyaWJlKCdjbGVhcnNjcmVlbicsIGZ1bmN0aW9uKCkge1xuICAgICAgJCgnI3Jlc3VsdHNUZXh0JykudGV4dCgnJyk7XG4gICAgICAkKCcjcmVzdWx0c0pTT04nKS50ZXh0KCcnKTtcbiAgICAgICQoJy5lcnJvci1yb3cnKS5oaWRlKCk7XG4gICAgICAkKCcubm90aWZpY2F0aW9uLXJvdycpLmhpZGUoKTtcbiAgICAgICQoJy5oeXBvdGhlc2VzID4gdWwnKS5lbXB0eSgpO1xuICAgICAgJCgnI21ldGFkYXRhVGFibGVCb2R5JykuZW1wdHkoKTtcbiAgICB9KTtcblxuICB9KTtcblxufSk7Il19
