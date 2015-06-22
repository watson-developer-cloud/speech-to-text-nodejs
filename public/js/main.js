(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports={
  "name": "SpeechToTextBrowserStarterApp",
  "version": "0.0.5",
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


},{"./utils":6}],3:[function(require,module,exports){
module.exports={
   "models": [
      {
         "url": "https://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/models/es-ES_BroadbandModel", 
         "rate": 16000, 
         "name": "es-ES_BroadbandModel", 
         "language": "es-ES", 
         "description": "Spanish broadband model."
      }, 
      {
         "url": "https://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/models/ja-JP_BroadbandModel", 
         "rate": 16000, 
         "name": "ja-JP_BroadbandModel", 
         "language": "ja-JP", 
         "description": "Japanese broadband model."
      }, 
      {
         "url": "https://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/models/en-US_BroadbandModel", 
         "rate": 16000, 
         "name": "en-US_BroadbandModel", 
         "language": "en-US", 
         "description": "US English broadband model."
      }, 
      {
         "url": "https://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/models/ja-JP_NarrowbandModel", 
         "rate": 8000, 
         "name": "ja-JP_NarrowbandModel", 
         "language": "ja-JP", 
         "description": "Japanese narrowband model."
      }, 
      {
         "url": "https://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/models/es-ES_NarrowbandModel", 
         "rate": 8000, 
         "name": "es-ES_NarrowbandModel", 
         "language": "es-ES", 
         "description": "Spanish narrowband model."
      }, 
      {
         "url": "https://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/models/en-US_NarrowbandModel", 
         "rate": 8000, 
         "name": "en-US_NarrowbandModel", 
         "language": "en-US", 
         "description": "US English narrowband model."
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

    localStorage.setItem('currentlyDisplaying', true);
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

},{"./socket":5,"./views/display":8,"./views/effects":9,"./views/showerror":14}],5:[function(require,module,exports){
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
    console.log('evt', evt);
    if (msg.state === 'listening') {
      $.subscribe('socketstop', function(data) {
        console.log('Closing socket...');
        socket.send(JSON.stringify({'action': 'stop'}));
        socket.close();
      });
      if (!listening) {
        onlistening(socket);
        hideError();
        listening = true;
      } else {
        console.log('closing socket');
        // Cannot close socket since state is reported here as 'CLOSING' or 'CLOSED'
        // Despite this, it's possible to send from this 'CLOSING' socket with no issue
        // Could be a browser bug, still investigating
        // Could also be a proxy/gateway issue
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
        console.log('got token', token);
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


},{"./Microphone":2,"./utils":6,"./views/showerror":14}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){


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


},{}],8:[function(require,module,exports){
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
  var json = JSON.stringify(msg);
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
      console.log('final res:', baseString);
      processString(baseString, true);
    } else {
      var tempString = baseString + text;
      console.log('interimResult res:', tempString);
      processString(tempString, false);
    }
  }
  if (alternatives) {
    showAlternatives(alternatives);
  }

  var isNNN = /^((n)\3+)$/.test(baseString);
  if (isNNN) {
    baseString = '<unintelligible: please check selected language and bandwidth>';
  }
  return baseString;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],9:[function(require,module,exports){



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


},{}],10:[function(require,module,exports){

var initSessionPermissions = require('./sessionpermissions').initSessionPermissions;
var initSelectModel = require('./selectmodel').initSelectModel;
var initAnimatePanel = require('./animatepanel').initAnimatePanel;
var initShowTab = require('./showtab').initShowTab;
var initPlaySample = require('./playsample').initPlaySample;


exports.initViews = function(ctx) {
  console.log('Initializing views...');
  initSelectModel(ctx);
  initPlaySample(ctx);
  initSessionPermissions();
  initShowTab();
  initAnimatePanel();
  initShowTab();
}

},{"./animatepanel":7,"./playsample":11,"./selectmodel":12,"./sessionpermissions":13,"./showtab":15}],11:[function(require,module,exports){

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

  localStorage.getItem('currentlyDisplaying', true);

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
      var audio = $('.audio').get(0);
      $('.audio').show().attr('src', mediaSourceURL);
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


},{"../fileupload":4,"../socket":5,"../utils":6,"./effects":9,"./showerror":14}],12:[function(require,module,exports){

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

},{}],13:[function(require,module,exports){

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

},{}],14:[function(require,module,exports){


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

},{}],15:[function(require,module,exports){


exports.initShowTab = function() {
  $('#nav-tabs a').on("click", function (e) {
    e.preventDefault()
    $(this).tab('show')
  });
}

},{}],16:[function(require,module,exports){
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

  // Temporary top-scope variable
  var micSocket;

  function handleMicrophone(token, model, mic, callback) {

    var currentModel = localStorage.getItem('currentModel');
    if (currentModel.indexOf('Narrowband') > -1) {
      var err = new Error('Microphone cannot accomodate narrow band models, please select another');
      callback(err, null);
      return false;
    }
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

      micSocket = socket;

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

  // Make call to API to try and get token
  var url = '/token';
  var tokenRequest = new XMLHttpRequest();
  tokenRequest.open("GET", url, true);
  tokenRequest.onload = function(evt) {


    var testFunction = (function() {
      var count = 5;
      return function(callback) {
        count--;
        return count;
      }
    })();

    testFunction();
    testFunction();
    console.log('Result for t()', testFunction());

    window.onbeforeunload = function(e) {
      localStorage.clear();
    };

    var token = tokenRequest.responseText;
    console.log('Token ', decodeURIComponent(token));

    var micOptions = {
      bufferSize: BUFFERSIZE
    };
    var mic = new Microphone(micOptions);

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
      token: token
    };
    initViews(viewContext);
    utils.initPubSub();


    function handleSelectedFile(file) {

      var currentlyDisplaying = JSON.parse(localStorage.getItem('currentlyDisplaying'));
      
      if (currentlyDisplaying) {
        showError('Transcription underway, please click stop or wait until finished to upload another file');
        return;
      }

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

    console.log('setting target');

    var dragAndDropTarget = $(document);
    dragAndDropTarget.on('dragenter', function (e) {
      console.log('dragenter');
      e.stopPropagation();
      e.preventDefault();
    });

    dragAndDropTarget.on('dragover', function (e) {
      console.log('dragover');
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
      console.log('handling file drop event');
      // Init file upload with default model
      var file = evt.dataTransfer.files[0];
      handleSelectedFile(file);
    }

    var fileUploadDialog = $("#fileUploadDialog");

    fileUploadDialog.change(function(evt) {
      var file = fileUploadDialog.get(0).files[0];
      console.log('file upload!', file);
      handleSelectedFile(file);
    });

    $("#fileUploadTarget").click(function(evt) {
      var currentlyDisplaying = JSON.parse(localStorage.getItem('currentlyDisplaying'));
      if (currentlyDisplaying) {
        $.publish('stopsocket');
        return;
      }

      fileUploadDialog
      .trigger('click');
    });


    // Set microphone state to not running
    localStorage.setItem('running', false);

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
        console.log('Not running, handleMicrophone()');
        handleMicrophone(token, currentModel, mic, function(err, socket) {
          if (err) {
            var msg = err.message;
            console.log('Error: ', msg);
            showError(msg);
            localStorage.setItem('running', false);
          } else {
            recordButton.css('background-color', '#d74108');
            recordButton.find('img').attr('src', 'img/stop.svg');
            console.log('starting mic');
            mic.record();
            localStorage.setItem('running', true);
          }
        });
      } else {
        console.log('Stopping microphone, sending stop action message');
        recordButton.removeAttr('style');
        recordButton.find('img').attr('src', 'img/microphone.svg');
        micSocket.send(JSON.stringify({'action': 'stop'}));
        // Can also send empty buffer to signal end
        // var emptyBuffer = new ArrayBuffer(0);
        // micSocket.send(emptyBuffer);
        mic.stop();
        localStorage.setItem('running', false);
      }


    }, this));
  }
  tokenRequest.send();

});


},{"../package":1,"./Microphone":2,"./data/models.json":3,"./fileupload":4,"./socket":5,"./utils":6,"./views":10,"./views/display":8,"./views/effects":9,"./views/showerror":14}]},{},[16])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5ucG0vbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwicGFja2FnZS5qc29uIiwic3JjL01pY3JvcGhvbmUuanMiLCJzcmMvZGF0YS9tb2RlbHMuanNvbiIsInNyYy9maWxldXBsb2FkLmpzIiwic3JjL3NvY2tldC5qcyIsInNyYy91dGlscy5qcyIsInNyYy92aWV3cy9hbmltYXRlcGFuZWwuanMiLCJzcmMvdmlld3MvZGlzcGxheS5qcyIsInNyYy92aWV3cy9lZmZlY3RzLmpzIiwic3JjL3ZpZXdzL2luZGV4LmpzIiwic3JjL3ZpZXdzL3BsYXlzYW1wbGUuanMiLCJzcmMvdmlld3Mvc2VsZWN0bW9kZWwuanMiLCJzcmMvdmlld3Mvc2Vzc2lvbnBlcm1pc3Npb25zLmpzIiwic3JjL3ZpZXdzL3Nob3dlcnJvci5qcyIsInNyYy92aWV3cy9zaG93dGFiLmpzIiwic3JjL2luZGV4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzlHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDOUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cz17XG4gIFwibmFtZVwiOiBcIlNwZWVjaFRvVGV4dEJyb3dzZXJTdGFydGVyQXBwXCIsXG4gIFwidmVyc2lvblwiOiBcIjAuMC41XCIsXG4gIFwiZGVzY3JpcHRpb25cIjogXCJBIHNhbXBsZSBicm93c2VyIGFwcCBmb3IgQmx1ZW1peCB0aGF0IHVzZSB0aGUgc3BlZWNoLXRvLXRleHQgc2VydmljZSwgZmV0Y2hpbmcgYSB0b2tlbiB2aWEgTm9kZS5qc1wiLFxuICBcImRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJib2R5LXBhcnNlclwiOiBcIn4xLjEwLjJcIixcbiAgICBcImNvbm5lY3RcIjogXCJeMy4zLjVcIixcbiAgICBcImVycm9yaGFuZGxlclwiOiBcIn4xLjIuNFwiLFxuICAgIFwiZXhwcmVzc1wiOiBcIn40LjEwLjhcIixcbiAgICBcImhhcm1vblwiOiBcIl4xLjMuMVwiLFxuICAgIFwiaHR0cC1wcm94eVwiOiBcIl4xLjExLjFcIixcbiAgICBcInJlcXVlc3RcIjogXCJ+Mi41My4wXCIsXG4gICAgXCJ0cmFuc2Zvcm1lci1wcm94eVwiOiBcIl4wLjMuMVwiXG4gIH0sXG4gIFwiZW5naW5lc1wiOiB7XG4gICAgXCJub2RlXCI6IFwiPj0wLjEwXCJcbiAgfSxcbiAgXCJyZXBvc2l0b3J5XCI6IHtcbiAgICBcInR5cGVcIjogXCJnaXRcIixcbiAgICBcInVybFwiOiBcImh0dHBzOi8vZ2l0aHViLmNvbS93YXRzb24tZGV2ZWxvcGVyLWNsb3VkL3NwZWVjaC10by10ZXh0LWJyb3dzZXIuZ2l0XCJcbiAgfSxcbiAgXCJhdXRob3JcIjogXCJJQk0gQ29ycC5cIixcbiAgXCJicm93c2VyaWZ5LXNoaW1cIjoge1xuICAgIFwianF1ZXJ5XCI6IFwiZ2xvYmFsOmpRdWVyeVwiXG4gIH0sXG4gIFwiYnJvd3NlcmlmeVwiOiB7XG4gICAgXCJ0cmFuc2Zvcm1cIjogW1xuICAgICAgXCJicm93c2VyaWZ5LXNoaW1cIlxuICAgIF1cbiAgfSxcbiAgXCJjb250cmlidXRvcnNcIjogW1xuICAgIHtcbiAgICAgIFwibmFtZVwiOiBcIkdlcm1hbiBBdHRhbmFzaW8gUnVpelwiLFxuICAgICAgXCJlbWFpbFwiOiBcImdlcm1hbmF0dEB1cy5pYm0uY29tXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwibmFtZVwiOiBcIkRhbmllbCBCb2xhbm9cIixcbiAgICAgIFwiZW1haWxcIjogXCJkYm9sYW5vQHVzLmlibS5jb21cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJuYW1lXCI6IFwiQnJpdGFueSBMLiBQb252ZWxsZVwiLFxuICAgICAgXCJlbWFpbFwiOiBcImJscG9udmVsbGVAdXMuaWJtLmNvbVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcIm5hbWVcIjogXCJFcmljIFMuIEJ1bGxpbmd0b25cIixcbiAgICAgIFwiZW1haWxcIjogXCJlc2J1bGxpbkB1cy5pYm0uY29tXCJcbiAgICB9XG4gIF0sXG4gIFwibGljZW5zZVwiOiBcIkFwYWNoZS0yLjBcIixcbiAgXCJidWdzXCI6IHtcbiAgICBcInVybFwiOiBcImh0dHBzOi8vZ2l0aHViLmNvbS93YXRzb24tZGV2ZWxvcGVyLWNsb3VkL3NwZWVjaC10by10ZXh0LWJyb3dzZXIvaXNzdWVzXCJcbiAgfSxcbiAgXCJzY3JpcHRzXCI6IHtcbiAgICBcInN0YXJ0XCI6IFwibm9kZSBhcHAuanNcIixcbiAgICBcImJ1aWxkXCI6IFwiYnJvd3NlcmlmeSAtbyBwdWJsaWMvanMvbWFpbi5qcyBzcmMvaW5kZXguanNcIixcbiAgICBcIndhdGNoXCI6IFwid2F0Y2hpZnkgLWQgLW8gcHVibGljL2pzL21haW4uanMgc3JjL2luZGV4LmpzXCJcbiAgfSxcbiAgXCJkZXZEZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiYnJvd3NlcmlmeVwiOiBcIl4xMC4yLjRcIixcbiAgICBcImJyb3dzZXJpZnktc2hpbVwiOiBcIl4zLjguOVwiXG4gIH1cbn1cbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgSUJNIENvcnAuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlICdMaWNlbnNlJyk7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuICdBUyBJUycgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuLyoqXG4gKiBDYXB0dXJlcyBtaWNyb3Bob25lIGlucHV0IGZyb20gdGhlIGJyb3dzZXIuXG4gKiBXb3JrcyBhdCBsZWFzdCBvbiBsYXRlc3QgdmVyc2lvbnMgb2YgRmlyZWZveCBhbmQgQ2hyb21lXG4gKi9cbmZ1bmN0aW9uIE1pY3JvcGhvbmUoX29wdGlvbnMpIHtcbiAgdmFyIG9wdGlvbnMgPSBfb3B0aW9ucyB8fCB7fTtcblxuICAvLyB3ZSByZWNvcmQgaW4gbW9ubyBiZWNhdXNlIHRoZSBzcGVlY2ggcmVjb2duaXRpb24gc2VydmljZVxuICAvLyBkb2VzIG5vdCBzdXBwb3J0IHN0ZXJlby5cbiAgdGhpcy5idWZmZXJTaXplID0gb3B0aW9ucy5idWZmZXJTaXplIHx8IDgxOTI7XG4gIHRoaXMuaW5wdXRDaGFubmVscyA9IG9wdGlvbnMuaW5wdXRDaGFubmVscyB8fCAxO1xuICB0aGlzLm91dHB1dENoYW5uZWxzID0gb3B0aW9ucy5vdXRwdXRDaGFubmVscyB8fCAxO1xuICB0aGlzLnJlY29yZGluZyA9IGZhbHNlO1xuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IGZhbHNlO1xuICB0aGlzLnNhbXBsZVJhdGUgPSAxNjAwMDtcbiAgLy8gYXV4aWxpYXIgYnVmZmVyIHRvIGtlZXAgdW51c2VkIHNhbXBsZXMgKHVzZWQgd2hlbiBkb2luZyBkb3duc2FtcGxpbmcpXG4gIHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlcyA9IG5ldyBGbG9hdDMyQXJyYXkoMCk7XG5cbiAgLy8gQ2hyb21lIG9yIEZpcmVmb3ggb3IgSUUgVXNlciBtZWRpYVxuICBpZiAoIW5hdmlnYXRvci5nZXRVc2VyTWVkaWEpIHtcbiAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhID0gbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSB8fFxuICAgIG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhO1xuICB9XG5cbn1cblxuLyoqXG4gKiBDYWxsZWQgd2hlbiB0aGUgdXNlciByZWplY3QgdGhlIHVzZSBvZiB0aGUgbWljaHJvcGhvbmVcbiAqIEBwYXJhbSAgZXJyb3IgVGhlIGVycm9yXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uUGVybWlzc2lvblJlamVjdGVkID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUubG9nKCdNaWNyb3Bob25lLm9uUGVybWlzc2lvblJlamVjdGVkKCknKTtcbiAgdGhpcy5yZXF1ZXN0ZWRBY2Nlc3MgPSBmYWxzZTtcbiAgdGhpcy5vbkVycm9yKCdQZXJtaXNzaW9uIHRvIGFjY2VzcyB0aGUgbWljcm9waG9uZSByZWpldGVkLicpO1xufTtcblxuTWljcm9waG9uZS5wcm90b3R5cGUub25FcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XG4gIGNvbnNvbGUubG9nKCdNaWNyb3Bob25lLm9uRXJyb3IoKTonLCBlcnJvcik7XG59O1xuXG4vKipcbiAqIENhbGxlZCB3aGVuIHRoZSB1c2VyIGF1dGhvcml6ZXMgdGhlIHVzZSBvZiB0aGUgbWljcm9waG9uZS5cbiAqIEBwYXJhbSAge09iamVjdH0gc3RyZWFtIFRoZSBTdHJlYW0gdG8gY29ubmVjdCB0b1xuICpcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUub25NZWRpYVN0cmVhbSA9ICBmdW5jdGlvbihzdHJlYW0pIHtcbiAgdmFyIEF1ZGlvQ3R4ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xuXG4gIGlmICghQXVkaW9DdHgpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdBdWRpb0NvbnRleHQgbm90IGF2YWlsYWJsZScpO1xuXG4gIGlmICghdGhpcy5hdWRpb0NvbnRleHQpXG4gICAgdGhpcy5hdWRpb0NvbnRleHQgPSBuZXcgQXVkaW9DdHgoKTtcblxuICB2YXIgZ2FpbiA9IHRoaXMuYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgdmFyIGF1ZGlvSW5wdXQgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzdHJlYW0pO1xuXG4gIGF1ZGlvSW5wdXQuY29ubmVjdChnYWluKTtcblxuICB0aGlzLm1pYyA9IHRoaXMuYXVkaW9Db250ZXh0LmNyZWF0ZVNjcmlwdFByb2Nlc3Nvcih0aGlzLmJ1ZmZlclNpemUsXG4gICAgdGhpcy5pbnB1dENoYW5uZWxzLCB0aGlzLm91dHB1dENoYW5uZWxzKTtcblxuICAvLyB1bmNvbW1lbnQgdGhlIGZvbGxvd2luZyBsaW5lIGlmIHlvdSB3YW50IHRvIHVzZSB5b3VyIG1pY3JvcGhvbmUgc2FtcGxlIHJhdGVcbiAgLy90aGlzLnNhbXBsZVJhdGUgPSB0aGlzLmF1ZGlvQ29udGV4dC5zYW1wbGVSYXRlO1xuICBjb25zb2xlLmxvZygnTWljcm9waG9uZS5vbk1lZGlhU3RyZWFtKCk6IHNhbXBsaW5nIHJhdGUgaXM6JywgdGhpcy5zYW1wbGVSYXRlKTtcblxuICB0aGlzLm1pYy5vbmF1ZGlvcHJvY2VzcyA9IHRoaXMuX29uYXVkaW9wcm9jZXNzLmJpbmQodGhpcyk7XG4gIHRoaXMuc3RyZWFtID0gc3RyZWFtO1xuXG4gIGdhaW4uY29ubmVjdCh0aGlzLm1pYyk7XG4gIHRoaXMubWljLmNvbm5lY3QodGhpcy5hdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuICB0aGlzLnJlY29yZGluZyA9IHRydWU7XG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gZmFsc2U7XG4gIHRoaXMub25TdGFydFJlY29yZGluZygpO1xufTtcblxuLyoqXG4gKiBjYWxsYmFjayB0aGF0IGlzIGJlaW5nIHVzZWQgYnkgdGhlIG1pY3JvcGhvbmVcbiAqIHRvIHNlbmQgYXVkaW8gY2h1bmtzLlxuICogQHBhcmFtICB7b2JqZWN0fSBkYXRhIGF1ZGlvXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLl9vbmF1ZGlvcHJvY2VzcyA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgaWYgKCF0aGlzLnJlY29yZGluZykge1xuICAgIC8vIFdlIHNwZWFrIGJ1dCB3ZSBhcmUgbm90IHJlY29yZGluZ1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIFNpbmdsZSBjaGFubmVsXG4gIHZhciBjaGFuID0gZGF0YS5pbnB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKTtcblxuICB0aGlzLm9uQXVkaW8odGhpcy5fZXhwb3J0RGF0YUJ1ZmZlclRvMTZLaHoobmV3IEZsb2F0MzJBcnJheShjaGFuKSkpO1xuXG4gIC8vZXhwb3J0IHdpdGggbWljcm9waG9uZSBtaHosIHJlbWVtYmVyIHRvIHVwZGF0ZSB0aGUgdGhpcy5zYW1wbGVSYXRlXG4gIC8vIHdpdGggdGhlIHNhbXBsZSByYXRlIGZyb20geW91ciBtaWNyb3Bob25lXG4gIC8vIHRoaXMub25BdWRpbyh0aGlzLl9leHBvcnREYXRhQnVmZmVyKG5ldyBGbG9hdDMyQXJyYXkoY2hhbikpKTtcblxufTtcblxuLyoqXG4gKiBTdGFydCB0aGUgYXVkaW8gcmVjb3JkaW5nXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLnJlY29yZCA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIW5hdmlnYXRvci5nZXRVc2VyTWVkaWEpe1xuICAgIHRoaXMub25FcnJvcignQnJvd3NlciBkb2VzblxcJ3Qgc3VwcG9ydCBtaWNyb3Bob25lIGlucHV0Jyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICh0aGlzLnJlcXVlc3RlZEFjY2Vzcykge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gdHJ1ZTtcbiAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSh7IGF1ZGlvOiB0cnVlIH0sXG4gICAgdGhpcy5vbk1lZGlhU3RyZWFtLmJpbmQodGhpcyksIC8vIE1pY3JvcGhvbmUgcGVybWlzc2lvbiBncmFudGVkXG4gICAgdGhpcy5vblBlcm1pc3Npb25SZWplY3RlZC5iaW5kKHRoaXMpKTsgLy8gTWljcm9waG9uZSBwZXJtaXNzaW9uIHJlamVjdGVkXG59O1xuXG4vKipcbiAqIFN0b3AgdGhlIGF1ZGlvIHJlY29yZGluZ1xuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XG4gIGlmICghdGhpcy5yZWNvcmRpbmcpXG4gICAgcmV0dXJuO1xuICB0aGlzLnJlY29yZGluZyA9IGZhbHNlO1xuICB0aGlzLnN0cmVhbS5zdG9wKCk7XG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gZmFsc2U7XG4gIHRoaXMubWljLmRpc2Nvbm5lY3QoMCk7XG4gIHRoaXMubWljID0gbnVsbDtcbiAgdGhpcy5vblN0b3BSZWNvcmRpbmcoKTtcbn07XG5cbi8qKlxuICogQ3JlYXRlcyBhIEJsb2IgdHlwZTogJ2F1ZGlvL2wxNicgd2l0aCB0aGUgY2h1bmsgYW5kIGRvd25zYW1wbGluZyB0byAxNiBrSHpcbiAqIGNvbWluZyBmcm9tIHRoZSBtaWNyb3Bob25lLlxuICogRXhwbGFuYXRpb24gZm9yIHRoZSBtYXRoOiBUaGUgcmF3IHZhbHVlcyBjYXB0dXJlZCBmcm9tIHRoZSBXZWIgQXVkaW8gQVBJIGFyZVxuICogaW4gMzItYml0IEZsb2F0aW5nIFBvaW50LCBiZXR3ZWVuIC0xIGFuZCAxIChwZXIgdGhlIHNwZWNpZmljYXRpb24pLlxuICogVGhlIHZhbHVlcyBmb3IgMTYtYml0IFBDTSByYW5nZSBiZXR3ZWVuIC0zMjc2OCBhbmQgKzMyNzY3ICgxNi1iaXQgc2lnbmVkIGludGVnZXIpLlxuICogTXVsdGlwbHkgdG8gY29udHJvbCB0aGUgdm9sdW1lIG9mIHRoZSBvdXRwdXQuIFdlIHN0b3JlIGluIGxpdHRsZSBlbmRpYW4uXG4gKiBAcGFyYW0gIHtPYmplY3R9IGJ1ZmZlciBNaWNyb3Bob25lIGF1ZGlvIGNodW5rXG4gKiBAcmV0dXJuIHtCbG9ifSAnYXVkaW8vbDE2JyBjaHVua1xuICogQGRlcHJlY2F0ZWQgVGhpcyBtZXRob2QgaXMgZGVwcmFjYXRlZFxuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5fZXhwb3J0RGF0YUJ1ZmZlclRvMTZLaHogPSBmdW5jdGlvbihidWZmZXJOZXdTYW1wbGVzKSB7XG4gIHZhciBidWZmZXIgPSBudWxsLFxuICAgIG5ld1NhbXBsZXMgPSBidWZmZXJOZXdTYW1wbGVzLmxlbmd0aCxcbiAgICB1bnVzZWRTYW1wbGVzID0gdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzLmxlbmd0aDtcblxuICBpZiAodW51c2VkU2FtcGxlcyA+IDApIHtcbiAgICBidWZmZXIgPSBuZXcgRmxvYXQzMkFycmF5KHVudXNlZFNhbXBsZXMgKyBuZXdTYW1wbGVzKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHVudXNlZFNhbXBsZXM7ICsraSkge1xuICAgICAgYnVmZmVyW2ldID0gdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzW2ldO1xuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgbmV3U2FtcGxlczsgKytpKSB7XG4gICAgICBidWZmZXJbdW51c2VkU2FtcGxlcyArIGldID0gYnVmZmVyTmV3U2FtcGxlc1tpXTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgYnVmZmVyID0gYnVmZmVyTmV3U2FtcGxlcztcbiAgfVxuXG4gIC8vIGRvd25zYW1wbGluZyB2YXJpYWJsZXNcbiAgdmFyIGZpbHRlciA9IFtcbiAgICAgIC0wLjAzNzkzNSwgLTAuMDAwODkwMjQsIDAuMDQwMTczLCAwLjAxOTk4OSwgMC4wMDQ3NzkyLCAtMC4wNTg2NzUsIC0wLjA1NjQ4NyxcbiAgICAgIC0wLjAwNDA2NTMsIDAuMTQ1MjcsIDAuMjY5MjcsIDAuMzM5MTMsIDAuMjY5MjcsIDAuMTQ1MjcsIC0wLjAwNDA2NTMsIC0wLjA1NjQ4NyxcbiAgICAgIC0wLjA1ODY3NSwgMC4wMDQ3NzkyLCAwLjAxOTk4OSwgMC4wNDAxNzMsIC0wLjAwMDg5MDI0LCAtMC4wMzc5MzVcbiAgICBdLFxuICAgIHNhbXBsaW5nUmF0ZVJhdGlvID0gdGhpcy5hdWRpb0NvbnRleHQuc2FtcGxlUmF0ZSAvIDE2MDAwLFxuICAgIG5PdXRwdXRTYW1wbGVzID0gTWF0aC5mbG9vcigoYnVmZmVyLmxlbmd0aCAtIGZpbHRlci5sZW5ndGgpIC8gKHNhbXBsaW5nUmF0ZVJhdGlvKSkgKyAxLFxuICAgIHBjbUVuY29kZWRCdWZmZXIxNmsgPSBuZXcgQXJyYXlCdWZmZXIobk91dHB1dFNhbXBsZXMgKiAyKSxcbiAgICBkYXRhVmlldzE2ayA9IG5ldyBEYXRhVmlldyhwY21FbmNvZGVkQnVmZmVyMTZrKSxcbiAgICBpbmRleCA9IDAsXG4gICAgdm9sdW1lID0gMHg3RkZGLCAvL3JhbmdlIGZyb20gMCB0byAweDdGRkYgdG8gY29udHJvbCB0aGUgdm9sdW1lXG4gICAgbk91dCA9IDA7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgKyBmaWx0ZXIubGVuZ3RoIC0gMSA8IGJ1ZmZlci5sZW5ndGg7IGkgPSBNYXRoLnJvdW5kKHNhbXBsaW5nUmF0ZVJhdGlvICogbk91dCkpIHtcbiAgICB2YXIgc2FtcGxlID0gMDtcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGZpbHRlci5sZW5ndGg7ICsraikge1xuICAgICAgc2FtcGxlICs9IGJ1ZmZlcltpICsgal0gKiBmaWx0ZXJbal07XG4gICAgfVxuICAgIHNhbXBsZSAqPSB2b2x1bWU7XG4gICAgZGF0YVZpZXcxNmsuc2V0SW50MTYoaW5kZXgsIHNhbXBsZSwgdHJ1ZSk7IC8vICd0cnVlJyAtPiBtZWFucyBsaXR0bGUgZW5kaWFuXG4gICAgaW5kZXggKz0gMjtcbiAgICBuT3V0Kys7XG4gIH1cblxuICB2YXIgaW5kZXhTYW1wbGVBZnRlckxhc3RVc2VkID0gTWF0aC5yb3VuZChzYW1wbGluZ1JhdGVSYXRpbyAqIG5PdXQpO1xuICB2YXIgcmVtYWluaW5nID0gYnVmZmVyLmxlbmd0aCAtIGluZGV4U2FtcGxlQWZ0ZXJMYXN0VXNlZDtcbiAgaWYgKHJlbWFpbmluZyA+IDApIHtcbiAgICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXMgPSBuZXcgRmxvYXQzMkFycmF5KHJlbWFpbmluZyk7XG4gICAgZm9yIChpID0gMDsgaSA8IHJlbWFpbmluZzsgKytpKSB7XG4gICAgICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXNbaV0gPSBidWZmZXJbaW5kZXhTYW1wbGVBZnRlckxhc3RVc2VkICsgaV07XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlcyA9IG5ldyBGbG9hdDMyQXJyYXkoMCk7XG4gIH1cblxuICByZXR1cm4gbmV3IEJsb2IoW2RhdGFWaWV3MTZrXSwge1xuICAgIHR5cGU6ICdhdWRpby9sMTYnXG4gIH0pO1xuICB9O1xuXG4vKipcbiAqIENyZWF0ZXMgYSBCbG9iIHR5cGU6ICdhdWRpby9sMTYnIHdpdGggdGhlXG4gKiBjaHVuayBjb21pbmcgZnJvbSB0aGUgbWljcm9waG9uZS5cbiAqL1xudmFyIGV4cG9ydERhdGFCdWZmZXIgPSBmdW5jdGlvbihidWZmZXIsIGJ1ZmZlclNpemUpIHtcbiAgdmFyIHBjbUVuY29kZWRCdWZmZXIgPSBudWxsLFxuICAgIGRhdGFWaWV3ID0gbnVsbCxcbiAgICBpbmRleCA9IDAsXG4gICAgdm9sdW1lID0gMHg3RkZGOyAvL3JhbmdlIGZyb20gMCB0byAweDdGRkYgdG8gY29udHJvbCB0aGUgdm9sdW1lXG5cbiAgcGNtRW5jb2RlZEJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihidWZmZXJTaXplICogMik7XG4gIGRhdGFWaWV3ID0gbmV3IERhdGFWaWV3KHBjbUVuY29kZWRCdWZmZXIpO1xuXG4gIC8qIEV4cGxhbmF0aW9uIGZvciB0aGUgbWF0aDogVGhlIHJhdyB2YWx1ZXMgY2FwdHVyZWQgZnJvbSB0aGUgV2ViIEF1ZGlvIEFQSSBhcmVcbiAgICogaW4gMzItYml0IEZsb2F0aW5nIFBvaW50LCBiZXR3ZWVuIC0xIGFuZCAxIChwZXIgdGhlIHNwZWNpZmljYXRpb24pLlxuICAgKiBUaGUgdmFsdWVzIGZvciAxNi1iaXQgUENNIHJhbmdlIGJldHdlZW4gLTMyNzY4IGFuZCArMzI3NjcgKDE2LWJpdCBzaWduZWQgaW50ZWdlcikuXG4gICAqIE11bHRpcGx5IHRvIGNvbnRyb2wgdGhlIHZvbHVtZSBvZiB0aGUgb3V0cHV0LiBXZSBzdG9yZSBpbiBsaXR0bGUgZW5kaWFuLlxuICAgKi9cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXIubGVuZ3RoOyBpKyspIHtcbiAgICBkYXRhVmlldy5zZXRJbnQxNihpbmRleCwgYnVmZmVyW2ldICogdm9sdW1lLCB0cnVlKTtcbiAgICBpbmRleCArPSAyO1xuICB9XG5cbiAgLy8gbDE2IGlzIHRoZSBNSU1FIHR5cGUgZm9yIDE2LWJpdCBQQ01cbiAgcmV0dXJuIG5ldyBCbG9iKFtkYXRhVmlld10sIHsgdHlwZTogJ2F1ZGlvL2wxNicgfSk7XG59O1xuXG5NaWNyb3Bob25lLnByb3RvdHlwZS5fZXhwb3J0RGF0YUJ1ZmZlciA9IGZ1bmN0aW9uKGJ1ZmZlcil7XG4gIHV0aWxzLmV4cG9ydERhdGFCdWZmZXIoYnVmZmVyLCB0aGlzLmJ1ZmZlclNpemUpO1xufTsgXG5cblxuLy8gRnVuY3Rpb25zIHVzZWQgdG8gY29udHJvbCBNaWNyb3Bob25lIGV2ZW50cyBsaXN0ZW5lcnMuXG5NaWNyb3Bob25lLnByb3RvdHlwZS5vblN0YXJ0UmVjb3JkaW5nID0gIGZ1bmN0aW9uKCkge307XG5NaWNyb3Bob25lLnByb3RvdHlwZS5vblN0b3BSZWNvcmRpbmcgPSAgZnVuY3Rpb24oKSB7fTtcbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uQXVkaW8gPSAgZnVuY3Rpb24oKSB7fTtcblxubW9kdWxlLmV4cG9ydHMgPSBNaWNyb3Bob25lO1xuXG4iLCJtb2R1bGUuZXhwb3J0cz17XG4gICBcIm1vZGVsc1wiOiBbXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLXMud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0LWJldGEvYXBpL3YxL21vZGVscy9lcy1FU19Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiAxNjAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJlcy1FU19Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJlcy1FU1wiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJTcGFuaXNoIGJyb2FkYmFuZCBtb2RlbC5cIlxuICAgICAgfSwgXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLXMud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0LWJldGEvYXBpL3YxL21vZGVscy9qYS1KUF9Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiAxNjAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJqYS1KUF9Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJqYS1KUFwiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJKYXBhbmVzZSBicm9hZGJhbmQgbW9kZWwuXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS1zLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC1iZXRhL2FwaS92MS9tb2RlbHMvZW4tVVNfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogMTYwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiZW4tVVNfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiZW4tVVNcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiVVMgRW5nbGlzaCBicm9hZGJhbmQgbW9kZWwuXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS1zLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC1iZXRhL2FwaS92MS9tb2RlbHMvamEtSlBfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDgwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiamEtSlBfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImphLUpQXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIkphcGFuZXNlIG5hcnJvd2JhbmQgbW9kZWwuXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS1zLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC1iZXRhL2FwaS92MS9tb2RlbHMvZXMtRVNfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDgwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiZXMtRVNfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImVzLUVTXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlNwYW5pc2ggbmFycm93YmFuZCBtb2RlbC5cIlxuICAgICAgfSwgXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLXMud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0LWJldGEvYXBpL3YxL21vZGVscy9lbi1VU19OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogODAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJlbi1VU19OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiZW4tVVNcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiVVMgRW5nbGlzaCBuYXJyb3diYW5kIG1vZGVsLlwiXG4gICAgICB9XG4gICBdXG59XG4iLCJcbnZhciBlZmZlY3RzID0gcmVxdWlyZSgnLi92aWV3cy9lZmZlY3RzJyk7XG52YXIgZGlzcGxheSA9IHJlcXVpcmUoJy4vdmlld3MvZGlzcGxheScpO1xudmFyIGhpZGVFcnJvciA9IHJlcXVpcmUoJy4vdmlld3Mvc2hvd2Vycm9yJykuaGlkZUVycm9yO1xudmFyIGluaXRTb2NrZXQgPSByZXF1aXJlKCcuL3NvY2tldCcpLmluaXRTb2NrZXQ7XG5cbmV4cG9ydHMuaGFuZGxlRmlsZVVwbG9hZCA9IGZ1bmN0aW9uKHRva2VuLCBtb2RlbCwgZmlsZSwgY29udGVudFR5cGUsIGNhbGxiYWNrLCBvbmVuZCkge1xuXG5cbiAgICBjb25zb2xlLmxvZygnc2V0dGluZyBpbWFnZScpO1xuICAgIC8vICQoJyNwcm9ncmVzc0luZGljYXRvcicpLmNzcygndmlzaWJpbGl0eScsICd2aXNpYmxlJyk7XG5cbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIHRydWUpO1xuICAgIGhpZGVFcnJvcigpO1xuXG4gICAgJC5zdWJzY3JpYmUoJ3Byb2dyZXNzJywgZnVuY3Rpb24oZXZ0LCBkYXRhKSB7XG4gICAgICBjb25zb2xlLmxvZygncHJvZ3Jlc3M6ICcsIGRhdGEpO1xuICAgIH0pO1xuXG4gICAgdmFyIG1pY0ljb24gPSAkKCcjbWljcm9waG9uZUljb24nKTtcblxuICAgIGNvbnNvbGUubG9nKCdjb250ZW50VHlwZScsIGNvbnRlbnRUeXBlKTtcblxuICAgIHZhciBiYXNlU3RyaW5nID0gJyc7XG4gICAgdmFyIGJhc2VKU09OID0gJyc7XG5cbiAgICB2YXIgb3B0aW9ucyA9IHt9O1xuICAgIG9wdGlvbnMudG9rZW4gPSB0b2tlbjtcbiAgICBvcHRpb25zLm1lc3NhZ2UgPSB7XG4gICAgICAnYWN0aW9uJzogJ3N0YXJ0JyxcbiAgICAgICdjb250ZW50LXR5cGUnOiBjb250ZW50VHlwZSxcbiAgICAgICdpbnRlcmltX3Jlc3VsdHMnOiB0cnVlLFxuICAgICAgJ2NvbnRpbnVvdXMnOiB0cnVlLFxuICAgICAgJ3dvcmRfY29uZmlkZW5jZSc6IHRydWUsXG4gICAgICAndGltZXN0YW1wcyc6IHRydWUsXG4gICAgICAnbWF4X2FsdGVybmF0aXZlcyc6IDNcbiAgICB9O1xuICAgIG9wdGlvbnMubW9kZWwgPSBtb2RlbDtcblxuICAgIGZ1bmN0aW9uIG9uT3Blbihzb2NrZXQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdTb2NrZXQgb3BlbmVkJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25MaXN0ZW5pbmcoc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZygnU29ja2V0IGxpc3RlbmluZycpO1xuICAgICAgY2FsbGJhY2soc29ja2V0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbk1lc3NhZ2UobXNnKSB7XG4gICAgICBjb25zb2xlLmxvZygnU29ja2V0IG1zZzogJywgbXNnKTtcbiAgICAgIGlmIChtc2cucmVzdWx0cykge1xuICAgICAgICAvLyBDb252ZXJ0IHRvIGNsb3N1cmUgYXBwcm9hY2hcbiAgICAgICAgYmFzZVN0cmluZyA9IGRpc3BsYXkuc2hvd1Jlc3VsdChtc2csIGJhc2VTdHJpbmcpO1xuICAgICAgICBiYXNlSlNPTiA9IGRpc3BsYXkuc2hvd0pTT04obXNnLCBiYXNlSlNPTik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25FcnJvcihldnQpIHtcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgb25lbmQoZXZ0KTtcbiAgICAgIGNvbnNvbGUubG9nKCdTb2NrZXQgZXJyOiAnLCBldnQuY29kZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25DbG9zZShldnQpIHtcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgb25lbmQoZXZ0KTtcbiAgICAgIGNvbnNvbGUubG9nKCdTb2NrZXQgY2xvc2luZzogJywgZXZ0KTtcbiAgICB9XG5cbiAgICBpbml0U29ja2V0KG9wdGlvbnMsIG9uT3Blbiwgb25MaXN0ZW5pbmcsIG9uTWVzc2FnZSwgb25FcnJvciwgb25DbG9zZSk7XG5cbiAgfVxuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4vKmdsb2JhbCAkOmZhbHNlICovXG5cblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xudmFyIE1pY3JvcGhvbmUgPSByZXF1aXJlKCcuL01pY3JvcGhvbmUnKTtcbnZhciBzaG93ZXJyb3IgPSByZXF1aXJlKCcuL3ZpZXdzL3Nob3dlcnJvcicpO1xudmFyIHNob3dFcnJvciA9IHNob3dlcnJvci5zaG93RXJyb3I7XG52YXIgaGlkZUVycm9yID0gc2hvd2Vycm9yLmhpZGVFcnJvcjtcblxuLy8gTWluaSBXUyBjYWxsYmFjayBBUEksIHNvIHdlIGNhbiBpbml0aWFsaXplXG4vLyB3aXRoIG1vZGVsIGFuZCB0b2tlbiBpbiBVUkksIHBsdXNcbi8vIHN0YXJ0IG1lc3NhZ2Vcbi8vXG5cbnZhciBpbml0U29ja2V0ID0gZXhwb3J0cy5pbml0U29ja2V0ID0gZnVuY3Rpb24ob3B0aW9ucywgb25vcGVuLCBvbmxpc3RlbmluZywgb25tZXNzYWdlLCBvbmVycm9yLCBvbmNsb3NlLCByZXRyeUNvdW50RG93bikge1xuICB2YXIgbGlzdGVuaW5nID0gZmFsc2U7XG4gIGZ1bmN0aW9uIHdpdGhEZWZhdWx0KHZhbCwgZGVmYXVsdFZhbCkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsID09PSAndW5kZWZpbmVkJyA/IGRlZmF1bHRWYWwgOiB2YWw7XG4gIH1cbiAgdmFyIHNvY2tldCwgY291bnQ7XG4gIHZhciB0b2tlbiA9IG9wdGlvbnMudG9rZW47XG4gIHZhciBtb2RlbCA9IG9wdGlvbnMubW9kZWwgfHwgbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRNb2RlbCcpO1xuICB2YXIgbWVzc2FnZSA9IG9wdGlvbnMubWVzc2FnZSB8fCB7J2FjdGlvbic6ICdzdGFydCd9O1xuICB2YXIgc2Vzc2lvblBlcm1pc3Npb25zID0gd2l0aERlZmF1bHQob3B0aW9ucy5zZXNzaW9uUGVybWlzc2lvbnMsIEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3Nlc3Npb25QZXJtaXNzaW9ucycpKSk7XG4gIHZhciBzZXNzaW9uUGVybWlzc2lvbnNRdWVyeVBhcmFtID0gc2Vzc2lvblBlcm1pc3Npb25zID8gJzAnIDogJzEnO1xuICB2YXIgdXJsID0gb3B0aW9ucy5zZXJ2aWNlVVJJIHx8ICd3c3M6Ly9zdHJlYW0tcy53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQtYmV0YS9hcGkvdjEvcmVjb2duaXplP3dhdHNvbi10b2tlbj0nXG4gICAgKyB0b2tlblxuICAgICsgJyZYLVdEQy1QTC1PUFQtT1VUPScgKyBzZXNzaW9uUGVybWlzc2lvbnNRdWVyeVBhcmFtXG4gICAgKyAnJm1vZGVsPScgKyBtb2RlbDtcbiAgY29uc29sZS5sb2coJ1VSTCBtb2RlbCcsIG1vZGVsKTtcbiAgdHJ5IHtcbiAgICBzb2NrZXQgPSBuZXcgV2ViU29ja2V0KHVybCk7XG4gIH0gY2F0Y2goZXJyKSB7XG4gICAgY29uc29sZS5sb2coJ3dlYnNvY2tldGVycicsIGVycik7XG4gICAgc2hvd0Vycm9yKGVyci5tZXNzYWdlKTtcbiAgfVxuICBzb2NrZXQub25vcGVuID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgY29uc29sZS5sb2coJ3dzIG9wZW5lZCcpO1xuICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpKTtcbiAgICBvbm9wZW4oc29ja2V0KTtcbiAgfTtcbiAgc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciBtc2cgPSBKU09OLnBhcnNlKGV2dC5kYXRhKTtcbiAgICBjb25zb2xlLmxvZygnZXZ0JywgZXZ0KTtcbiAgICBpZiAobXNnLnN0YXRlID09PSAnbGlzdGVuaW5nJykge1xuICAgICAgJC5zdWJzY3JpYmUoJ3NvY2tldHN0b3AnLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdDbG9zaW5nIHNvY2tldC4uLicpO1xuICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7J2FjdGlvbic6ICdzdG9wJ30pKTtcbiAgICAgICAgc29ja2V0LmNsb3NlKCk7XG4gICAgICB9KTtcbiAgICAgIGlmICghbGlzdGVuaW5nKSB7XG4gICAgICAgIG9ubGlzdGVuaW5nKHNvY2tldCk7XG4gICAgICAgIGhpZGVFcnJvcigpO1xuICAgICAgICBsaXN0ZW5pbmcgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ2Nsb3Npbmcgc29ja2V0Jyk7XG4gICAgICAgIC8vIENhbm5vdCBjbG9zZSBzb2NrZXQgc2luY2Ugc3RhdGUgaXMgcmVwb3J0ZWQgaGVyZSBhcyAnQ0xPU0lORycgb3IgJ0NMT1NFRCdcbiAgICAgICAgLy8gRGVzcGl0ZSB0aGlzLCBpdCdzIHBvc3NpYmxlIHRvIHNlbmQgZnJvbSB0aGlzICdDTE9TSU5HJyBzb2NrZXQgd2l0aCBubyBpc3N1ZVxuICAgICAgICAvLyBDb3VsZCBiZSBhIGJyb3dzZXIgYnVnLCBzdGlsbCBpbnZlc3RpZ2F0aW5nXG4gICAgICAgIC8vIENvdWxkIGFsc28gYmUgYSBwcm94eS9nYXRld2F5IGlzc3VlXG4gICAgICAgIHNvY2tldC5jbG9zZSgpO1xuICAgICAgfVxuICAgIH1cbiAgICBvbm1lc3NhZ2UobXNnLCBzb2NrZXQpO1xuICB9O1xuXG4gIHNvY2tldC5vbmVycm9yID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgY29uc29sZS5sb2coJ1dTIG9uZXJyb3I6ICcsIGV2dCk7XG4gICAgc2hvd0Vycm9yKCdBcHBsaWNhdGlvbiBlcnJvciAnICsgZXZ0LmNvZGUgKyAnOiBwbGVhc2UgcmVmcmVzaCB5b3VyIGJyb3dzZXIgYW5kIHRyeSBhZ2FpbicpO1xuICAgIG9uZXJyb3IoZXZ0KTtcbiAgfTtcblxuICBzb2NrZXQub25jbG9zZSA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIGNvbnNvbGUubG9nKCdXUyBvbmNsb3NlOiAnLCBldnQpO1xuICAgIGlmIChldnQuY29kZSA9PT0gMTAwNikge1xuICAgICAgLy8gQXV0aGVudGljYXRpb24gZXJyb3IsIHRyeSB0byByZWNvbm5lY3RcbiAgICAgIGNvdW50ID0gdXRpbHMuZ2V0VG9rZW4oZnVuY3Rpb24odG9rZW4sIGVycikge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgc2hvd0Vycm9yKGVyci5tZXNzYWdlKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS5sb2coJ2dvdCB0b2tlbicsIHRva2VuKTtcbiAgICAgICAgb3B0aW9ucy50b2tlbiA9IHRva2VuO1xuICAgICAgICBpbml0U29ja2V0KG9wdGlvbnMsIG9ub3Blbiwgb25saXN0ZW5pbmcsIG9ubWVzc2FnZSwgb25lcnJvcik7XG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYgKGV2dC5jb2RlID4gMTAwMCkge1xuICAgICAgc2hvd0Vycm9yKCdTZXJ2ZXIgZXJyb3IgJyArIGV2dC5jb2RlICsgJzogcGxlYXNlIHJlZnJlc2ggeW91ciBicm93c2VyIGFuZCB0cnkgYWdhaW4nKTtcbiAgICB9XG4gICAgLy8gTWFkZSBpdCB0aHJvdWdoLCBub3JtYWwgY2xvc2VcbiAgICBvbmNsb3NlKGV2dCk7XG4gIH07XG5cbn1cblxuIiwiXG4vLyBGb3Igbm9uLXZpZXcgbG9naWNcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cualF1ZXJ5IDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbC5qUXVlcnkgOiBudWxsKTtcblxudmFyIGZpbGVCbG9jayA9IGZ1bmN0aW9uKF9vZmZzZXQsIGxlbmd0aCwgX2ZpbGUsIHJlYWRDaHVuaykge1xuICB2YXIgciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gIHZhciBibG9iID0gX2ZpbGUuc2xpY2UoX29mZnNldCwgbGVuZ3RoICsgX29mZnNldCk7XG4gIHIub25sb2FkID0gcmVhZENodW5rO1xuICByLnJlYWRBc0FycmF5QnVmZmVyKGJsb2IpO1xufVxuXG4vLyBCYXNlZCBvbiBhbGVkaWFmZXJpYSdzIFNPIHJlc3BvbnNlXG4vLyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzE0NDM4MTg3L2phdmFzY3JpcHQtZmlsZXJlYWRlci1wYXJzaW5nLWxvbmctZmlsZS1pbi1jaHVua3NcbmV4cG9ydHMub25GaWxlUHJvZ3Jlc3MgPSBmdW5jdGlvbihvcHRpb25zLCBvbmRhdGEsIG9uZXJyb3IsIG9uZW5kKSB7XG4gIHZhciBmaWxlICAgICAgID0gb3B0aW9ucy5maWxlO1xuICB2YXIgZmlsZVNpemUgICA9IGZpbGUuc2l6ZTtcbiAgdmFyIGNodW5rU2l6ZSAgPSBvcHRpb25zLmJ1ZmZlclNpemUgfHwgODE5MjtcbiAgdmFyIG9mZnNldCAgICAgPSAwO1xuICB2YXIgcmVhZENodW5rID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgaWYgKG9mZnNldCA+PSBmaWxlU2l6ZSkge1xuICAgICAgY29uc29sZS5sb2coXCJEb25lIHJlYWRpbmcgZmlsZVwiKTtcbiAgICAgIG9uZW5kKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChldnQudGFyZ2V0LmVycm9yID09IG51bGwpIHtcbiAgICAgIHZhciBidWZmZXIgPSBldnQudGFyZ2V0LnJlc3VsdDtcbiAgICAgIHZhciBsZW4gPSBidWZmZXIuYnl0ZUxlbmd0aDtcbiAgICAgIG9mZnNldCArPSBsZW47XG4gICAgICBvbmRhdGEoYnVmZmVyKTsgLy8gY2FsbGJhY2sgZm9yIGhhbmRsaW5nIHJlYWQgY2h1bmtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGVycm9yTWVzc2FnZSA9IGV2dC50YXJnZXQuZXJyb3I7XG4gICAgICBjb25zb2xlLmxvZyhcIlJlYWQgZXJyb3I6IFwiICsgZXJyb3JNZXNzYWdlKTtcbiAgICAgIG9uZXJyb3IoZXJyb3JNZXNzYWdlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZmlsZUJsb2NrKG9mZnNldCwgY2h1bmtTaXplLCBmaWxlLCByZWFkQ2h1bmspO1xuICB9XG4gIGZpbGVCbG9jayhvZmZzZXQsIGNodW5rU2l6ZSwgZmlsZSwgcmVhZENodW5rKTtcbn1cblxuZXhwb3J0cy5nZXRUb2tlbiA9IChmdW5jdGlvbigpIHtcbiAgLy8gTWFrZSBjYWxsIHRvIEFQSSB0byB0cnkgYW5kIGdldCB0b2tlblxuICB2YXIgaGFzQmVlblJ1blRpbWVzID0gMjtcbiAgcmV0dXJuIGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgaGFzQmVlblJ1blRpbWVzLS07XG4gICAgaWYgKGhhc0JlZW5SdW5UaW1lcyA9PT0gMCkge1xuICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignQ2Fubm90IHJlYWNoIHNlcnZlcicpO1xuICAgICAgY2FsbGJhY2sobnVsbCwgZXJyKTtcbiAgICB9XG4gICAgdmFyIHVybCA9ICcvdG9rZW4nO1xuICAgIHZhciB0b2tlblJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB0b2tlblJlcXVlc3Qub3BlbihcIkdFVFwiLCB1cmwsIHRydWUpO1xuICAgIHRva2VuUmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbihldnQpIHtcbiAgICAgIHZhciB0b2tlbiA9IHRva2VuUmVxdWVzdC5yZXNwb25zZVRleHQ7XG4gICAgICBjYWxsYmFjayh0b2tlbik7XG4gICAgfTtcbiAgICB0b2tlblJlcXVlc3Quc2VuZCgpO1xuICB9XG59KSgpO1xuXG5leHBvcnRzLmluaXRQdWJTdWIgPSBmdW5jdGlvbigpIHtcbiAgdmFyIG8gICAgICAgICA9ICQoe30pO1xuICAkLnN1YnNjcmliZSAgID0gby5vbi5iaW5kKG8pO1xuICAkLnVuc3Vic2NyaWJlID0gby5vZmYuYmluZChvKTtcbiAgJC5wdWJsaXNoICAgICA9IG8udHJpZ2dlci5iaW5kKG8pO1xufVxuIiwiXG5cbmV4cG9ydHMuaW5pdEFuaW1hdGVQYW5lbCA9IGZ1bmN0aW9uKCkge1xuICAkKCcucGFuZWwtaGVhZGluZyBzcGFuLmNsaWNrYWJsZScpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICBpZiAoJCh0aGlzKS5oYXNDbGFzcygncGFuZWwtY29sbGFwc2VkJykpIHtcbiAgICAgIC8vIGV4cGFuZCB0aGUgcGFuZWxcbiAgICAgICQodGhpcykucGFyZW50cygnLnBhbmVsJykuZmluZCgnLnBhbmVsLWJvZHknKS5zbGlkZURvd24oKTtcbiAgICAgICQodGhpcykucmVtb3ZlQ2xhc3MoJ3BhbmVsLWNvbGxhcHNlZCcpO1xuICAgICAgJCh0aGlzKS5maW5kKCdpJykucmVtb3ZlQ2xhc3MoJ2NhcmV0LWRvd24nKS5hZGRDbGFzcygnY2FyZXQtdXAnKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBjb2xsYXBzZSB0aGUgcGFuZWxcbiAgICAgICQodGhpcykucGFyZW50cygnLnBhbmVsJykuZmluZCgnLnBhbmVsLWJvZHknKS5zbGlkZVVwKCk7XG4gICAgICAkKHRoaXMpLmFkZENsYXNzKCdwYW5lbC1jb2xsYXBzZWQnKTtcbiAgICAgICQodGhpcykuZmluZCgnaScpLnJlbW92ZUNsYXNzKCdjYXJldC11cCcpLmFkZENsYXNzKCdjYXJldC1kb3duJyk7XG4gICAgfVxuICB9KTtcbn1cblxuIiwidmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdy5qUXVlcnkgOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsLmpRdWVyeSA6IG51bGwpO1xuXG52YXIgc2hvd1RpbWVzdGFtcCA9IGZ1bmN0aW9uKHRpbWVzdGFtcHMsIGNvbmZpZGVuY2VzKSB7XG4gIHZhciB3b3JkID0gdGltZXN0YW1wc1swXSxcbiAgICAgIHQwID0gdGltZXN0YW1wc1sxXSxcbiAgICAgIHQxID0gdGltZXN0YW1wc1syXTtcbiAgdmFyIHRpbWVsZW5ndGggPSB0MSAtIHQwO1xuICAvLyBTaG93IGNvbmZpZGVuY2UgaWYgZGVmaW5lZCwgZWxzZSAnbi9hJ1xuICB2YXIgZGlzcGxheUNvbmZpZGVuY2UgPSBjb25maWRlbmNlcyA/IGNvbmZpZGVuY2VzWzFdLnRvU3RyaW5nKCkuc3Vic3RyaW5nKDAsIDMpIDogJ24vYSc7XG4gICQoJyNtZXRhZGF0YVRhYmxlID4gdGJvZHk6bGFzdC1jaGlsZCcpLmFwcGVuZChcbiAgICAgICc8dHI+J1xuICAgICAgKyAnPHRkPicgKyB3b3JkICsgJzwvdGQ+J1xuICAgICAgKyAnPHRkPicgKyB0MCArICc8L3RkPidcbiAgICAgICsgJzx0ZD4nICsgZGlzcGxheUNvbmZpZGVuY2UgKyAnPC90ZD4nXG4gICAgICArICc8L3RyPidcbiAgICAgICk7XG59XG5cbnZhciBzaG93TWV0YURhdGEgPSBmdW5jdGlvbihhbHRlcm5hdGl2ZSkge1xuICAkKCcjbWV0YWRhdGFUYWJsZSA+IHRib2R5JykuZW1wdHkoKTtcbiAgdmFyIGNvbmZpZGVuY2VOZXN0ZWRBcnJheSA9IGFsdGVybmF0aXZlLndvcmRfY29uZmlkZW5jZTs7XG4gIHZhciB0aW1lc3RhbXBOZXN0ZWRBcnJheSA9IGFsdGVybmF0aXZlLnRpbWVzdGFtcHM7XG4gIGlmIChjb25maWRlbmNlTmVzdGVkQXJyYXkgJiYgY29uZmlkZW5jZU5lc3RlZEFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvbmZpZGVuY2VOZXN0ZWRBcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHRpbWVzdGFtcHMgPSB0aW1lc3RhbXBOZXN0ZWRBcnJheVtpXTtcbiAgICAgIHZhciBjb25maWRlbmNlcyA9IGNvbmZpZGVuY2VOZXN0ZWRBcnJheVtpXTtcbiAgICAgIHNob3dUaW1lc3RhbXAodGltZXN0YW1wcywgY29uZmlkZW5jZXMpO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH0gZWxzZSB7XG4gICAgaWYgKHRpbWVzdGFtcE5lc3RlZEFycmF5ICYmIHRpbWVzdGFtcE5lc3RlZEFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnNvbGUubG9nKCdTSE9XSU5HIFRJTUVTVEFNUFMnKTtcbiAgICAgIHRpbWVzdGFtcE5lc3RlZEFycmF5LmZvckVhY2goZnVuY3Rpb24odGltZXN0YW1wKSB7XG4gICAgICAgIHNob3dUaW1lc3RhbXAodGltZXN0YW1wKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuXG52YXIgc2hvd0FsdGVybmF0aXZlcyA9IGZ1bmN0aW9uKGFsdGVybmF0aXZlcykge1xuICB2YXIgJGh5cG90aGVzZXMgPSAkKCcuaHlwb3RoZXNlcyB1bCcpO1xuICBhbHRlcm5hdGl2ZXMuZm9yRWFjaChmdW5jdGlvbihhbHRlcm5hdGl2ZSwgaWR4KSB7XG4gICAgJGh5cG90aGVzZXMuYXBwZW5kKCc8bGkgZGF0YS1oeXBvdGhlc2lzLWluZGV4PScgKyBpZHggKyAnID4nICsgYWx0ZXJuYXRpdmUudHJhbnNjcmlwdCArICc8L2xpPicpO1xuICB9KTtcbiAgJGh5cG90aGVzZXMub24oJ2NsaWNrJywgXCJsaVwiLCBmdW5jdGlvbiAoYWx0ZXJuYXRpdmVzKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgY29uc29sZS5sb2coXCJzaG93aW5nIG1ldGFkYXRhXCIpO1xuICAgICAgdmFyIGlkeCA9ICsgJCh0aGlzKS5kYXRhKCdoeXBvdGhlc2lzLWluZGV4Jyk7XG4gICAgICB2YXIgYWx0ZXJuYXRpdmUgPSBhbHRlcm5hdGl2ZXNbaWR4XTtcbiAgICAgIHNob3dNZXRhRGF0YShhbHRlcm5hdGl2ZSk7XG4gICAgfVxuICB9KTtcbn1cblxuLy8gVE9ETzogQ29udmVydCB0byBjbG9zdXJlIGFwcHJvYWNoXG52YXIgcHJvY2Vzc1N0cmluZyA9IGZ1bmN0aW9uKGJhc2VTdHJpbmcsIGlzRmluaXNoZWQpIHtcblxuICBpZiAoaXNGaW5pc2hlZCkge1xuICAgIHZhciBmb3JtYXR0ZWRTdHJpbmcgPSBiYXNlU3RyaW5nLnNsaWNlKDAsIC0xKTtcbiAgICBmb3JtYXR0ZWRTdHJpbmcgPSBmb3JtYXR0ZWRTdHJpbmcuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBmb3JtYXR0ZWRTdHJpbmcuc3Vic3RyaW5nKDEpO1xuICAgIGZvcm1hdHRlZFN0cmluZyA9IGZvcm1hdHRlZFN0cmluZy50cmltKCkgKyAnLic7XG4gICAgY29uc29sZS5sb2coJ2Zvcm1hdHRlZCBmaW5hbCByZXM6JywgZm9ybWF0dGVkU3RyaW5nKTtcbiAgICAkKCcjcmVzdWx0c1RleHQnKS52YWwoZm9ybWF0dGVkU3RyaW5nKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmxvZygnaW50ZXJpbVJlc3VsdCByZXM6JywgYmFzZVN0cmluZyk7XG4gICAgJCgnI3Jlc3VsdHNUZXh0JykudmFsKGJhc2VTdHJpbmcpO1xuICB9XG5cbn1cblxuZXhwb3J0cy5zaG93SlNPTiA9IGZ1bmN0aW9uKG1zZywgYmFzZUpTT04pIHtcbiAgdmFyIGpzb24gPSBKU09OLnN0cmluZ2lmeShtc2cpO1xuICBiYXNlSlNPTiArPSBqc29uO1xuICBiYXNlSlNPTiArPSAnXFxuJztcbiAgJCgnI3Jlc3VsdHNKU09OJykudmFsKGJhc2VKU09OKTtcbiAgcmV0dXJuIGJhc2VKU09OO1xufVxuXG5leHBvcnRzLnNob3dSZXN1bHQgPSBmdW5jdGlvbihtc2csIGJhc2VTdHJpbmcsIGNhbGxiYWNrKSB7XG5cbiAgdmFyIGlkeCA9ICttc2cucmVzdWx0X2luZGV4O1xuXG4gIGlmIChtc2cucmVzdWx0cyAmJiBtc2cucmVzdWx0cy5sZW5ndGggPiAwKSB7XG5cbiAgICB2YXIgYWx0ZXJuYXRpdmVzID0gbXNnLnJlc3VsdHNbMF0uYWx0ZXJuYXRpdmVzO1xuICAgIHZhciB0ZXh0ID0gbXNnLnJlc3VsdHNbMF0uYWx0ZXJuYXRpdmVzWzBdLnRyYW5zY3JpcHQgfHwgJyc7XG5cbiAgICBzaG93TWV0YURhdGEoYWx0ZXJuYXRpdmVzWzBdKTtcbiAgICAvL0NhcGl0YWxpemUgZmlyc3Qgd29yZFxuICAgIC8vIGlmIGZpbmFsIHJlc3VsdHMsIGFwcGVuZCBhIG5ldyBwYXJhZ3JhcGhcbiAgICBpZiAobXNnLnJlc3VsdHMgJiYgbXNnLnJlc3VsdHNbMF0gJiYgbXNnLnJlc3VsdHNbMF0uZmluYWwpIHtcbiAgICAgIGJhc2VTdHJpbmcgKz0gdGV4dDtcbiAgICAgIGNvbnNvbGUubG9nKCdmaW5hbCByZXM6JywgYmFzZVN0cmluZyk7XG4gICAgICBwcm9jZXNzU3RyaW5nKGJhc2VTdHJpbmcsIHRydWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgdGVtcFN0cmluZyA9IGJhc2VTdHJpbmcgKyB0ZXh0O1xuICAgICAgY29uc29sZS5sb2coJ2ludGVyaW1SZXN1bHQgcmVzOicsIHRlbXBTdHJpbmcpO1xuICAgICAgcHJvY2Vzc1N0cmluZyh0ZW1wU3RyaW5nLCBmYWxzZSk7XG4gICAgfVxuICB9XG4gIGlmIChhbHRlcm5hdGl2ZXMpIHtcbiAgICBzaG93QWx0ZXJuYXRpdmVzKGFsdGVybmF0aXZlcyk7XG4gIH1cblxuICB2YXIgaXNOTk4gPSAvXigobilcXDMrKSQvLnRlc3QoYmFzZVN0cmluZyk7XG4gIGlmIChpc05OTikge1xuICAgIGJhc2VTdHJpbmcgPSAnPHVuaW50ZWxsaWdpYmxlOiBwbGVhc2UgY2hlY2sgc2VsZWN0ZWQgbGFuZ3VhZ2UgYW5kIGJhbmR3aWR0aD4nO1xuICB9XG4gIHJldHVybiBiYXNlU3RyaW5nO1xufVxuIiwiXG5cblxuZXhwb3J0cy5mbGFzaFNWRyA9IGZ1bmN0aW9uKGVsKSB7XG4gIGVsLmNzcyh7IGZpbGw6ICcjQTUzNzI1JyB9KTtcbiAgZnVuY3Rpb24gbG9vcCgpIHtcbiAgICBlbC5hbmltYXRlKHsgZmlsbDogJyNBNTM3MjUnIH0sXG4gICAgICAgIDEwMDAsICdsaW5lYXInKVxuICAgICAgLmFuaW1hdGUoeyBmaWxsOiAnd2hpdGUnIH0sXG4gICAgICAgICAgMTAwMCwgJ2xpbmVhcicpO1xuICB9XG4gIC8vIHJldHVybiB0aW1lclxuICB2YXIgdGltZXIgPSBzZXRUaW1lb3V0KGxvb3AsIDIwMDApO1xuICByZXR1cm4gdGltZXI7XG59O1xuXG5leHBvcnRzLnN0b3BGbGFzaFNWRyA9IGZ1bmN0aW9uKHRpbWVyKSB7XG4gIGVsLmNzcyh7IGZpbGw6ICd3aGl0ZScgfSApO1xuICBjbGVhckludGVydmFsKHRpbWVyKTtcbn1cblxuZXhwb3J0cy50b2dnbGVJbWFnZSA9IGZ1bmN0aW9uKGVsLCBuYW1lKSB7XG4gIGlmKGVsLmF0dHIoJ3NyYycpID09PSAnaW1nLycgKyBuYW1lICsgJy5zdmcnKSB7XG4gICAgZWwuYXR0cihcInNyY1wiLCAnaW1nL3N0b3AtcmVkLnN2ZycpO1xuICB9IGVsc2Uge1xuICAgIGVsLmF0dHIoJ3NyYycsICdpbWcvc3RvcC5zdmcnKTtcbiAgfVxufVxuXG52YXIgcmVzdG9yZUltYWdlID0gZXhwb3J0cy5yZXN0b3JlSW1hZ2UgPSBmdW5jdGlvbihlbCwgbmFtZSkge1xuICBlbC5hdHRyKCdzcmMnLCAnaW1nLycgKyBuYW1lICsgJy5zdmcnKTtcbn1cblxuZXhwb3J0cy5zdG9wVG9nZ2xlSW1hZ2UgPSBmdW5jdGlvbih0aW1lciwgZWwsIG5hbWUpIHtcbiAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG4gIHJlc3RvcmVJbWFnZShlbCwgbmFtZSk7XG59XG5cbiIsIlxudmFyIGluaXRTZXNzaW9uUGVybWlzc2lvbnMgPSByZXF1aXJlKCcuL3Nlc3Npb25wZXJtaXNzaW9ucycpLmluaXRTZXNzaW9uUGVybWlzc2lvbnM7XG52YXIgaW5pdFNlbGVjdE1vZGVsID0gcmVxdWlyZSgnLi9zZWxlY3Rtb2RlbCcpLmluaXRTZWxlY3RNb2RlbDtcbnZhciBpbml0QW5pbWF0ZVBhbmVsID0gcmVxdWlyZSgnLi9hbmltYXRlcGFuZWwnKS5pbml0QW5pbWF0ZVBhbmVsO1xudmFyIGluaXRTaG93VGFiID0gcmVxdWlyZSgnLi9zaG93dGFiJykuaW5pdFNob3dUYWI7XG52YXIgaW5pdFBsYXlTYW1wbGUgPSByZXF1aXJlKCcuL3BsYXlzYW1wbGUnKS5pbml0UGxheVNhbXBsZTtcblxuXG5leHBvcnRzLmluaXRWaWV3cyA9IGZ1bmN0aW9uKGN0eCkge1xuICBjb25zb2xlLmxvZygnSW5pdGlhbGl6aW5nIHZpZXdzLi4uJyk7XG4gIGluaXRTZWxlY3RNb2RlbChjdHgpO1xuICBpbml0UGxheVNhbXBsZShjdHgpO1xuICBpbml0U2Vzc2lvblBlcm1pc3Npb25zKCk7XG4gIGluaXRTaG93VGFiKCk7XG4gIGluaXRBbmltYXRlUGFuZWwoKTtcbiAgaW5pdFNob3dUYWIoKTtcbn1cbiIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xudmFyIG9uRmlsZVByb2dyZXNzID0gdXRpbHMub25GaWxlUHJvZ3Jlc3M7XG52YXIgaGFuZGxlRmlsZVVwbG9hZCA9IHJlcXVpcmUoJy4uL2ZpbGV1cGxvYWQnKS5oYW5kbGVGaWxlVXBsb2FkO1xudmFyIGluaXRTb2NrZXQgPSByZXF1aXJlKCcuLi9zb2NrZXQnKS5pbml0U29ja2V0O1xudmFyIHNob3dFcnJvciA9IHJlcXVpcmUoJy4vc2hvd2Vycm9yJykuc2hvd0Vycm9yO1xudmFyIGVmZmVjdHMgPSByZXF1aXJlKCcuL2VmZmVjdHMnKTtcblxuXG52YXIgcGxheVNhbXBsZSA9IGZ1bmN0aW9uKHRva2VuLCBpbWFnZVRhZywgaWNvbk5hbWUsIHVybCwgY2FsbGJhY2spIHtcblxuICB2YXIgY3VycmVudGx5RGlzcGxheWluZyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnKSk7XG5cbiAgaWYgKGN1cnJlbnRseURpc3BsYXlpbmcpIHtcbiAgICBzaG93RXJyb3IoJ0N1cnJlbnRseSBkaXNwbGF5aW5nIGFub3RoZXIgZmlsZSwgcGxlYXNlIHdhaXQgdW50aWwgY29tcGxldGUnKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIHRydWUpO1xuXG4gIHZhciB0aW1lciA9IHNldEludGVydmFsKGVmZmVjdHMudG9nZ2xlSW1hZ2UsIDc1MCwgaW1hZ2VUYWcsIGljb25OYW1lKTtcblxuICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gIHhoci5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuICB4aHIucmVzcG9uc2VUeXBlID0gJ2Jsb2InO1xuICB4aHIub25sb2FkID0gZnVuY3Rpb24oZSkge1xuICAgIHZhciBibG9iID0geGhyLnJlc3BvbnNlO1xuICAgIHZhciBjdXJyZW50TW9kZWwgPSAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnO1xuICAgIHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgIHZhciBibG9iVG9UZXh0ID0gbmV3IEJsb2IoW2Jsb2JdKS5zbGljZSgwLCA0KTtcbiAgICByZWFkZXIucmVhZEFzVGV4dChibG9iVG9UZXh0KTtcbiAgICByZWFkZXIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY29udGVudFR5cGUgPSByZWFkZXIucmVzdWx0ID09PSAnZkxhQycgPyAnYXVkaW8vZmxhYycgOiAnYXVkaW8vd2F2JztcbiAgICAgIGNvbnNvbGUubG9nKCdVcGxvYWRpbmcgZmlsZScsIHJlYWRlci5yZXN1bHQpO1xuICAgICAgdmFyIG1lZGlhU291cmNlVVJMID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgICAgIHZhciBhdWRpbyA9ICQoJy5hdWRpbycpLmdldCgwKTtcbiAgICAgICQoJy5hdWRpbycpLnNob3coKS5hdHRyKCdzcmMnLCBtZWRpYVNvdXJjZVVSTCk7XG4gICAgICBhdWRpby5wbGF5KCk7XG4gICAgICBoYW5kbGVGaWxlVXBsb2FkKHRva2VuLCBjdXJyZW50TW9kZWwsIGJsb2IsIGNvbnRlbnRUeXBlLCBmdW5jdGlvbihzb2NrZXQpIHtcbiAgICAgICAgdmFyIHBhcnNlT3B0aW9ucyA9IHtcbiAgICAgICAgICBmaWxlOiBibG9iXG4gICAgICAgIH07XG4gICAgICAgIG9uRmlsZVByb2dyZXNzKHBhcnNlT3B0aW9ucyxcbiAgICAgICAgICAvLyBPbiBkYXRhIGNodW5rXG4gICAgICAgICAgZnVuY3Rpb24oY2h1bmspIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdIYW5kbGluZyBjaHVuaycsIGNodW5rKTtcbiAgICAgICAgICAgIHNvY2tldC5zZW5kKGNodW5rKTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIC8vIE9uIGZpbGUgcmVhZCBlcnJvclxuICAgICAgICAgIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ0Vycm9yIHJlYWRpbmcgZmlsZTogJywgZXZ0Lm1lc3NhZ2UpO1xuICAgICAgICAgICAgc2hvd0Vycm9yKGV2dC5tZXNzYWdlKTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIC8vIE9uIGxvYWQgZW5kXG4gICAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7J2FjdGlvbic6ICdzdG9wJ30pKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICB9LCBcbiAgICAgICAgICAvLyBPbiBjb25uZWN0aW9uIGVuZFxuICAgICAgICAgIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgICAgZWZmZWN0cy5zdG9wVG9nZ2xlSW1hZ2UodGltZXIsIGltYWdlVGFnLCBpY29uTmFtZSk7XG4gICAgICAgICAgICBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIGZhbHNlKTtcbiAgICAgICAgICB9XG4gICAgICApO1xuICAgIH07XG4gIH07XG4gIHhoci5zZW5kKCk7XG59O1xuXG5cbmV4cG9ydHMuaW5pdFBsYXlTYW1wbGUgPSBmdW5jdGlvbihjdHgpIHtcblxuICAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIGVsID0gJCgnLnBsYXktc2FtcGxlLTEnKTtcbiAgICB2YXIgaWNvbk5hbWUgPSAncGxheSc7XG4gICAgdmFyIGltYWdlVGFnID0gZWwuZmluZCgnaW1nJyk7XG4gICAgdmFyIGZpbGVOYW1lID0gJ2F1ZGlvL3NhbXBsZTEud2F2JztcbiAgICBlbC5jbGljayggZnVuY3Rpb24oZXZ0KSB7XG4gICAgICBjb25zb2xlLmxvZygnQ0xJQ0shJyk7XG4gICAgICBwbGF5U2FtcGxlKGN0eC50b2tlbiwgaW1hZ2VUYWcsIGljb25OYW1lLCBmaWxlTmFtZSwgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdQbGF5IHNhbXBsZSByZXN1bHQnLCByZXN1bHQpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pKGN0eCk7XG5cbiAgKGZ1bmN0aW9uKCkge1xuICAgIHZhciBlbCA9ICQoJy5wbGF5LXNhbXBsZS0yJyk7XG4gICAgdmFyIGljb25OYW1lID0gJ3BsYXknO1xuICAgIHZhciBpbWFnZVRhZyA9IGVsLmZpbmQoJ2ltZycpO1xuICAgIHZhciBmaWxlTmFtZSA9ICdhdWRpby9zYW1wbGUyLndhdic7XG4gICAgZWwuY2xpY2soIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgY29uc29sZS5sb2coJ0NMSUNLIScpO1xuICAgICAgcGxheVNhbXBsZShjdHgudG9rZW4sIGltYWdlVGFnLCBpY29uTmFtZSwgZmlsZU5hbWUsIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBjb25zb2xlLmxvZygnUGxheSBzYW1wbGUgcmVzdWx0JywgcmVzdWx0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KShjdHgpO1xuXG59O1xuXG4iLCJcbmV4cG9ydHMuaW5pdFNlbGVjdE1vZGVsID0gZnVuY3Rpb24oY3R4KSB7XG5cbiAgZnVuY3Rpb24gaXNEZWZhdWx0KG1vZGVsKSB7XG4gICAgcmV0dXJuIG1vZGVsID09PSAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnO1xuICB9XG5cbiAgY3R4Lm1vZGVscy5mb3JFYWNoKGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgJChcInNlbGVjdCNkcm9wZG93bk1lbnUxXCIpLmFwcGVuZCggJChcIjxvcHRpb24+XCIpXG4gICAgICAudmFsKG1vZGVsLm5hbWUpXG4gICAgICAuaHRtbChtb2RlbC5kZXNjcmlwdGlvbilcbiAgICAgIC5wcm9wKCdzZWxlY3RlZCcsIGlzRGVmYXVsdChtb2RlbC5uYW1lKSlcbiAgICAgICk7XG4gIH0pO1xuXG4gICQoXCJzZWxlY3QjZHJvcGRvd25NZW51MVwiKS5jaGFuZ2UoZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIG1vZGVsTmFtZSA9ICQoXCJzZWxlY3QjZHJvcGRvd25NZW51MVwiKS52YWwoKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudE1vZGVsJywgbW9kZWxOYW1lKTtcbiAgfSk7XG5cbn1cbiIsIlxuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLmluaXRTZXNzaW9uUGVybWlzc2lvbnMgPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJ0luaXRpYWxpemluZyBzZXNzaW9uIHBlcm1pc3Npb25zIGhhbmRsZXInKTtcbiAgLy8gUmFkaW8gYnV0dG9uc1xuICB2YXIgc2Vzc2lvblBlcm1pc3Npb25zUmFkaW8gPSAkKFwiI3Nlc3Npb25QZXJtaXNzaW9uc1JhZGlvR3JvdXAgaW5wdXRbdHlwZT0ncmFkaW8nXVwiKTtcbiAgc2Vzc2lvblBlcm1pc3Npb25zUmFkaW8uY2xpY2soZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIGNoZWNrZWRWYWx1ZSA9IHNlc3Npb25QZXJtaXNzaW9uc1JhZGlvLmZpbHRlcignOmNoZWNrZWQnKS52YWwoKTtcbiAgICBjb25zb2xlLmxvZygnY2hlY2tlZFZhbHVlJywgY2hlY2tlZFZhbHVlKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnc2Vzc2lvblBlcm1pc3Npb25zJywgY2hlY2tlZFZhbHVlKTtcbiAgfSk7XG59XG4iLCJcblxuZXhwb3J0cy5zaG93RXJyb3IgPSBmdW5jdGlvbihtc2cpIHtcbiAgY29uc29sZS5sb2coJ3Nob3dpbmcgZXJyb3InKTtcbiAgdmFyIGVycm9yQWxlcnQgPSAkKCcuZXJyb3Itcm93Jyk7XG4gIGVycm9yQWxlcnQuaGlkZSgpO1xuICB2YXIgZXJyb3JNZXNzYWdlID0gJCgnI2Vycm9yTWVzc2FnZScpO1xuICBlcnJvck1lc3NhZ2UudGV4dChtc2cpO1xuICBlcnJvckFsZXJ0LnNob3coKTtcbiAgJCgnI2Vycm9yQ2xvc2UnKS5jbGljayhmdW5jdGlvbihlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGVycm9yQWxlcnQuaGlkZSgpO1xuICB9KTtcbn1cblxuZXhwb3J0cy5oaWRlRXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGVycm9yQWxlcnQgPSAkKCcuZXJyb3Itcm93Jyk7XG4gIGVycm9yQWxlcnQuaGlkZSgpO1xufVxuIiwiXG5cbmV4cG9ydHMuaW5pdFNob3dUYWIgPSBmdW5jdGlvbigpIHtcbiAgJCgnI25hdi10YWJzIGEnKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uIChlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgJCh0aGlzKS50YWIoJ3Nob3cnKVxuICB9KTtcbn1cbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgSUJNIENvcnAuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuLypnbG9iYWwgJDpmYWxzZSAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8vIFRPRE86IHJlZmFjdG9yIHRoaXMgaW50byBtdWx0aXBsZSBzbWFsbGVyIG1vZHVsZXNcblxudmFyIE1pY3JvcGhvbmUgPSByZXF1aXJlKCcuL01pY3JvcGhvbmUnKTtcbnZhciBtb2RlbHMgPSByZXF1aXJlKCcuL2RhdGEvbW9kZWxzLmpzb24nKS5tb2RlbHM7XG52YXIgaW5pdFZpZXdzID0gcmVxdWlyZSgnLi92aWV3cycpLmluaXRWaWV3cztcbnZhciBzaG93RXJyb3IgPSByZXF1aXJlKCcuL3ZpZXdzL3Nob3dlcnJvcicpLnNob3dFcnJvcjtcbnZhciBoaWRlRXJyb3IgPSByZXF1aXJlKCcuL3ZpZXdzL3Nob3dlcnJvcicpLmhpZGVFcnJvcjtcbnZhciBpbml0U29ja2V0ID0gcmVxdWlyZSgnLi9zb2NrZXQnKS5pbml0U29ja2V0O1xudmFyIGhhbmRsZUZpbGVVcGxvYWQgPSByZXF1aXJlKCcuL2ZpbGV1cGxvYWQnKS5oYW5kbGVGaWxlVXBsb2FkO1xudmFyIGRpc3BsYXkgPSByZXF1aXJlKCcuL3ZpZXdzL2Rpc3BsYXknKTtcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnZhciBlZmZlY3RzID0gcmVxdWlyZSgnLi92aWV3cy9lZmZlY3RzJyk7XG52YXIgcGtnID0gcmVxdWlyZSgnLi4vcGFja2FnZScpO1xuXG52YXIgQlVGRkVSU0laRSA9IDgxOTI7XG5cbiQoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCkge1xuXG4gIC8vIFRlbXBvcmFyeSBhcHAgZGF0YVxuICAkKCcjYXBwU2V0dGluZ3MnKVxuICAgIC5odG1sKFxuICAgICAgJzxwPlZlcnNpb246ICcgKyBwa2cudmVyc2lvbiArICc8L3A+J1xuICAgICAgKyAnPHA+QnVmZmVyIFNpemU6ICcgKyBCVUZGRVJTSVpFICsgJzwvcD4nXG4gICAgKTtcblxuICAvLyBUZW1wb3JhcnkgdG9wLXNjb3BlIHZhcmlhYmxlXG4gIHZhciBtaWNTb2NrZXQ7XG5cbiAgZnVuY3Rpb24gaGFuZGxlTWljcm9waG9uZSh0b2tlbiwgbW9kZWwsIG1pYywgY2FsbGJhY2spIHtcblxuICAgIHZhciBjdXJyZW50TW9kZWwgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudE1vZGVsJyk7XG4gICAgaWYgKGN1cnJlbnRNb2RlbC5pbmRleE9mKCdOYXJyb3diYW5kJykgPiAtMSkge1xuICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignTWljcm9waG9uZSBjYW5ub3QgYWNjb21vZGF0ZSBuYXJyb3cgYmFuZCBtb2RlbHMsIHBsZWFzZSBzZWxlY3QgYW5vdGhlcicpO1xuICAgICAgY2FsbGJhY2soZXJyLCBudWxsKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gVGVzdCBvdXQgd2Vic29ja2V0XG4gICAgdmFyIGJhc2VTdHJpbmcgPSAnJztcbiAgICB2YXIgYmFzZUpTT04gPSAnJztcblxuICAgIHZhciBvcHRpb25zID0ge307XG4gICAgb3B0aW9ucy50b2tlbiA9IHRva2VuO1xuICAgIG9wdGlvbnMubWVzc2FnZSA9IHtcbiAgICAgICdhY3Rpb24nOiAnc3RhcnQnLFxuICAgICAgJ2NvbnRlbnQtdHlwZSc6ICdhdWRpby9sMTY7cmF0ZT0xNjAwMCcsXG4gICAgICAnaW50ZXJpbV9yZXN1bHRzJzogdHJ1ZSxcbiAgICAgICdjb250aW51b3VzJzogdHJ1ZSxcbiAgICAgICd3b3JkX2NvbmZpZGVuY2UnOiB0cnVlLFxuICAgICAgJ3RpbWVzdGFtcHMnOiB0cnVlLFxuICAgICAgJ21heF9hbHRlcm5hdGl2ZXMnOiAzXG4gICAgfTtcbiAgICBvcHRpb25zLm1vZGVsID0gbW9kZWw7XG5cbiAgICBmdW5jdGlvbiBvbk9wZW4oc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZygnc29ja2V0IG9wZW5lZCcpO1xuICAgICAgY2FsbGJhY2sobnVsbCwgc29ja2V0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkxpc3RlbmluZyhzb2NrZXQpIHtcblxuICAgICAgbWljU29ja2V0ID0gc29ja2V0O1xuXG4gICAgICBtaWMub25BdWRpbyA9IGZ1bmN0aW9uKGJsb2IpIHtcbiAgICAgICAgaWYgKHNvY2tldC5yZWFkeVN0YXRlIDwgMikge1xuICAgICAgICAgIHNvY2tldC5zZW5kKGJsb2IpXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25NZXNzYWdlKG1zZywgc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZygnTWljIHNvY2tldCBtc2c6ICcsIG1zZyk7XG4gICAgICBpZiAobXNnLnJlc3VsdHMpIHtcbiAgICAgICAgLy8gQ29udmVydCB0byBjbG9zdXJlIGFwcHJvYWNoXG4gICAgICAgIGJhc2VTdHJpbmcgPSBkaXNwbGF5LnNob3dSZXN1bHQobXNnLCBiYXNlU3RyaW5nKTtcbiAgICAgICAgYmFzZUpTT04gPSBkaXNwbGF5LnNob3dKU09OKG1zZywgYmFzZUpTT04pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uRXJyb3Iociwgc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZygnTWljIHNvY2tldCBlcnI6ICcsIGVycik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25DbG9zZShldnQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdNaWMgc29ja2V0IGNsb3NlOiAnLCBldnQpO1xuICAgIH1cblxuICAgIGluaXRTb2NrZXQob3B0aW9ucywgb25PcGVuLCBvbkxpc3RlbmluZywgb25NZXNzYWdlLCBvbkVycm9yLCBvbkNsb3NlKTtcblxuICB9XG5cbiAgLy8gTWFrZSBjYWxsIHRvIEFQSSB0byB0cnkgYW5kIGdldCB0b2tlblxuICB2YXIgdXJsID0gJy90b2tlbic7XG4gIHZhciB0b2tlblJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgdG9rZW5SZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgdXJsLCB0cnVlKTtcbiAgdG9rZW5SZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKGV2dCkge1xuXG5cbiAgICB2YXIgdGVzdEZ1bmN0aW9uID0gKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGNvdW50ID0gNTtcbiAgICAgIHJldHVybiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICBjb3VudC0tO1xuICAgICAgICByZXR1cm4gY291bnQ7XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIHRlc3RGdW5jdGlvbigpO1xuICAgIHRlc3RGdW5jdGlvbigpO1xuICAgIGNvbnNvbGUubG9nKCdSZXN1bHQgZm9yIHQoKScsIHRlc3RGdW5jdGlvbigpKTtcblxuICAgIHdpbmRvdy5vbmJlZm9yZXVubG9hZCA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgIGxvY2FsU3RvcmFnZS5jbGVhcigpO1xuICAgIH07XG5cbiAgICB2YXIgdG9rZW4gPSB0b2tlblJlcXVlc3QucmVzcG9uc2VUZXh0O1xuICAgIGNvbnNvbGUubG9nKCdUb2tlbiAnLCBkZWNvZGVVUklDb21wb25lbnQodG9rZW4pKTtcblxuICAgIHZhciBtaWNPcHRpb25zID0ge1xuICAgICAgYnVmZmVyU2l6ZTogQlVGRkVSU0laRVxuICAgIH07XG4gICAgdmFyIG1pYyA9IG5ldyBNaWNyb3Bob25lKG1pY09wdGlvbnMpO1xuXG4gICAgdmFyIG1vZGVsT3B0aW9ucyA9IHtcbiAgICAgIHRva2VuOiB0b2tlblxuICAgICAgICAvLyBVbmNvbW1lbnQgaW4gY2FzZSBvZiBzZXJ2ZXIgQ09SUyBmYWlsdXJlXG4gICAgICAgIC8vIHVybDogJy9hcGkvbW9kZWxzJ1xuICAgIH07XG5cbiAgICAvLyBHZXQgYXZhaWxhYmxlIHNwZWVjaCByZWNvZ25pdGlvbiBtb2RlbHNcbiAgICAvLyBTZXQgdGhlbSBpbiBzdG9yYWdlXG4gICAgLy8gQW5kIGRpc3BsYXkgdGhlbSBpbiBkcm9wLWRvd25cbiAgICBjb25zb2xlLmxvZygnU1RUIE1vZGVscyAnLCBtb2RlbHMpO1xuXG4gICAgLy8gU2F2ZSBtb2RlbHMgdG8gbG9jYWxzdG9yYWdlXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21vZGVscycsIEpTT04uc3RyaW5naWZ5KG1vZGVscykpO1xuXG4gICAgLy8gU2V0IGRlZmF1bHQgY3VycmVudCBtb2RlbFxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50TW9kZWwnLCAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnc2Vzc2lvblBlcm1pc3Npb25zJywgJ3RydWUnKTtcblxuXG4gICAgLy8gSU5JVElBTElaQVRJT05cbiAgICAvLyBTZW5kIG1vZGVscyBhbmQgb3RoZXJcbiAgICAvLyB2aWV3IGNvbnRleHQgdG8gdmlld3NcbiAgICB2YXIgdmlld0NvbnRleHQgPSB7XG4gICAgICBtb2RlbHM6IG1vZGVscyxcbiAgICAgIHRva2VuOiB0b2tlblxuICAgIH07XG4gICAgaW5pdFZpZXdzKHZpZXdDb250ZXh0KTtcbiAgICB1dGlscy5pbml0UHViU3ViKCk7XG5cblxuICAgIGZ1bmN0aW9uIGhhbmRsZVNlbGVjdGVkRmlsZShmaWxlKSB7XG5cbiAgICAgIHZhciBjdXJyZW50bHlEaXNwbGF5aW5nID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycpKTtcbiAgICAgIFxuICAgICAgaWYgKGN1cnJlbnRseURpc3BsYXlpbmcpIHtcbiAgICAgICAgc2hvd0Vycm9yKCdUcmFuc2NyaXB0aW9uIHVuZGVyd2F5LCBwbGVhc2UgY2xpY2sgc3RvcCBvciB3YWl0IHVudGlsIGZpbmlzaGVkIHRvIHVwbG9hZCBhbm90aGVyIGZpbGUnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIHRydWUpO1xuICAgICAgaGlkZUVycm9yKCk7XG5cbiAgICAgIC8vIFZpc3VhbCBlZmZlY3RzXG4gICAgICB2YXIgdXBsb2FkSW1hZ2VUYWcgPSAkKCcjZmlsZVVwbG9hZFRhcmdldCA+IGltZycpO1xuICAgICAgdmFyIHRpbWVyID0gc2V0SW50ZXJ2YWwoZWZmZWN0cy50b2dnbGVJbWFnZSwgNzUwLCB1cGxvYWRJbWFnZVRhZywgJ3N0b3AnKTtcbiAgICAgIHZhciB1cGxvYWRUZXh0ID0gJCgnI2ZpbGVVcGxvYWRUYXJnZXQgPiBzcGFuJyk7XG4gICAgICB1cGxvYWRUZXh0LnRleHQoJ1N0b3AgVHJhbnNjcmliaW5nJyk7XG5cbiAgICAgIGZ1bmN0aW9uIHJlc3RvcmVVcGxvYWRUYWIoKSB7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgICBjbGVhckludGVydmFsKHRpbWVyKTtcbiAgICAgICAgZWZmZWN0cy5yZXN0b3JlSW1hZ2UodXBsb2FkSW1hZ2VUYWcsICd1cGxvYWQnKTtcbiAgICAgICAgdXBsb2FkVGV4dC50ZXh0KCdTZWxlY3QgRmlsZScpO1xuICAgICAgfVxuXG4gICAgICAvLyBDbGVhciBmbGFzaGluZyBpZiBzb2NrZXQgdXBsb2FkIGlzIHN0b3BwZWRcbiAgICAgICQuc3Vic2NyaWJlKCdzdG9wc29ja2V0JywgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICByZXN0b3JlVXBsb2FkVGFiKCk7XG4gICAgICB9KTtcblxuXG4gICAgICAvLyBHZXQgY3VycmVudCBtb2RlbFxuICAgICAgdmFyIGN1cnJlbnRNb2RlbCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50TW9kZWwnKTtcbiAgICAgIGNvbnNvbGUubG9nKCdjdXJyZW50TW9kZWwnLCBjdXJyZW50TW9kZWwpO1xuXG4gICAgICAvLyBSZWFkIGZpcnN0IDQgYnl0ZXMgdG8gZGV0ZXJtaW5lIGhlYWRlclxuICAgICAgdmFyIGJsb2JUb1RleHQgPSBuZXcgQmxvYihbZmlsZV0pLnNsaWNlKDAsIDQpO1xuICAgICAgdmFyIHIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgci5yZWFkQXNUZXh0KGJsb2JUb1RleHQpO1xuICAgICAgci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGNvbnRlbnRUeXBlO1xuICAgICAgICBpZiAoci5yZXN1bHQgPT09ICdmTGFDJykge1xuICAgICAgICAgY29udGVudFR5cGUgPSAnYXVkaW8vZmxhYyc7XG4gICAgICAgIH0gZWxzZSBpZiAoci5yZXN1bHQgPT09ICdSSUZGJykge1xuICAgICAgICAgY29udGVudFR5cGUgPSAnYXVkaW8vd2F2JztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN0b3JlVXBsb2FkVGFiKCk7XG4gICAgICAgICAgc2hvd0Vycm9yKCdPbmx5IFdBViBvciBGTEFDIGZpbGVzIGNhbiBiZSB0cmFuc2NyaWJlZCwgcGxlYXNlIHRyeSBhbm90aGVyIGZpbGUgZm9ybWF0Jyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnNvbGUubG9nKCdVcGxvYWRpbmcgZmlsZScsIHIucmVzdWx0KTtcbiAgICAgICAgaGFuZGxlRmlsZVVwbG9hZCh0b2tlbiwgY3VycmVudE1vZGVsLCBmaWxlLCBjb250ZW50VHlwZSwgZnVuY3Rpb24oc29ja2V0KSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ3JlYWRpbmcgZmlsZScpO1xuXG4gICAgICAgICAgICB2YXIgYmxvYiA9IG5ldyBCbG9iKFtmaWxlXSk7XG4gICAgICAgICAgICB2YXIgcGFyc2VPcHRpb25zID0ge1xuICAgICAgICAgICAgICBmaWxlOiBibG9iXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdXRpbHMub25GaWxlUHJvZ3Jlc3MocGFyc2VPcHRpb25zLFxuICAgICAgICAgICAgICAvLyBPbiBkYXRhIGNodW5rXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oY2h1bmspIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSGFuZGxpbmcgY2h1bmsnLCBjaHVuayk7XG4gICAgICAgICAgICAgICAgc29ja2V0LnNlbmQoY2h1bmspO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAvLyBPbiBmaWxlIHJlYWQgZXJyb3JcbiAgICAgICAgICAgICAgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0Vycm9yIHJlYWRpbmcgZmlsZTogJywgZXZ0Lm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIHNob3dFcnJvcihldnQubWVzc2FnZSk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIC8vIE9uIGxvYWQgZW5kXG4gICAgICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHsnYWN0aW9uJzogJ3N0b3AnfSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIFxuICAgICAgICAgIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgICAgZWZmZWN0cy5zdG9wVG9nZ2xlSW1hZ2UodGltZXIsIHVwbG9hZEltYWdlVGFnLCAndXBsb2FkJyk7XG4gICAgICAgICAgICB1cGxvYWRUZXh0LnRleHQoJ1NlbGVjdCBGaWxlJyk7XG4gICAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIGZhbHNlKTtcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCdzZXR0aW5nIHRhcmdldCcpO1xuXG4gICAgdmFyIGRyYWdBbmREcm9wVGFyZ2V0ID0gJChkb2N1bWVudCk7XG4gICAgZHJhZ0FuZERyb3BUYXJnZXQub24oJ2RyYWdlbnRlcicsIGZ1bmN0aW9uIChlKSB7XG4gICAgICBjb25zb2xlLmxvZygnZHJhZ2VudGVyJyk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH0pO1xuXG4gICAgZHJhZ0FuZERyb3BUYXJnZXQub24oJ2RyYWdvdmVyJywgZnVuY3Rpb24gKGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdkcmFnb3ZlcicpO1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB9KTtcblxuICAgIGRyYWdBbmREcm9wVGFyZ2V0Lm9uKCdkcm9wJywgZnVuY3Rpb24gKGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdGaWxlIGRyb3BwZWQnKTtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIHZhciBldnQgPSBlLm9yaWdpbmFsRXZlbnQ7XG4gICAgICAvLyBIYW5kbGUgZHJhZ2dlZCBmaWxlIGV2ZW50XG4gICAgICBoYW5kbGVGaWxlVXBsb2FkRXZlbnQoZXZ0KTtcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGhhbmRsZUZpbGVVcGxvYWRFdmVudChldnQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdoYW5kbGluZyBmaWxlIGRyb3AgZXZlbnQnKTtcbiAgICAgIC8vIEluaXQgZmlsZSB1cGxvYWQgd2l0aCBkZWZhdWx0IG1vZGVsXG4gICAgICB2YXIgZmlsZSA9IGV2dC5kYXRhVHJhbnNmZXIuZmlsZXNbMF07XG4gICAgICBoYW5kbGVTZWxlY3RlZEZpbGUoZmlsZSk7XG4gICAgfVxuXG4gICAgdmFyIGZpbGVVcGxvYWREaWFsb2cgPSAkKFwiI2ZpbGVVcGxvYWREaWFsb2dcIik7XG5cbiAgICBmaWxlVXBsb2FkRGlhbG9nLmNoYW5nZShmdW5jdGlvbihldnQpIHtcbiAgICAgIHZhciBmaWxlID0gZmlsZVVwbG9hZERpYWxvZy5nZXQoMCkuZmlsZXNbMF07XG4gICAgICBjb25zb2xlLmxvZygnZmlsZSB1cGxvYWQhJywgZmlsZSk7XG4gICAgICBoYW5kbGVTZWxlY3RlZEZpbGUoZmlsZSk7XG4gICAgfSk7XG5cbiAgICAkKFwiI2ZpbGVVcGxvYWRUYXJnZXRcIikuY2xpY2soZnVuY3Rpb24oZXZ0KSB7XG4gICAgICB2YXIgY3VycmVudGx5RGlzcGxheWluZyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnKSk7XG4gICAgICBpZiAoY3VycmVudGx5RGlzcGxheWluZykge1xuICAgICAgICAkLnB1Ymxpc2goJ3N0b3Bzb2NrZXQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBmaWxlVXBsb2FkRGlhbG9nXG4gICAgICAudHJpZ2dlcignY2xpY2snKTtcbiAgICB9KTtcblxuXG4gICAgLy8gU2V0IG1pY3JvcGhvbmUgc3RhdGUgdG8gbm90IHJ1bm5pbmdcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgncnVubmluZycsIGZhbHNlKTtcblxuICAgIHZhciByZWNvcmRCdXR0b24gPSAkKCcjcmVjb3JkQnV0dG9uJyk7XG4gICAgcmVjb3JkQnV0dG9uLmNsaWNrKCQucHJveHkoZnVuY3Rpb24oZXZ0KSB7XG5cbiAgICAgIC8vIFByZXZlbnQgZGVmYXVsdCBhbmNob3IgYmVoYXZpb3JcbiAgICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICB2YXIgcnVubmluZyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3J1bm5pbmcnKSk7XG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgncnVubmluZycsICFydW5uaW5nKTtcblxuICAgICAgY29uc29sZS5sb2coJ2NsaWNrIScpO1xuXG4gICAgICB2YXIgY3VycmVudE1vZGVsID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRNb2RlbCcpO1xuXG4gICAgICBjb25zb2xlLmxvZygncnVubmluZyBzdGF0ZScsIHJ1bm5pbmcpO1xuXG4gICAgICBpZiAoIXJ1bm5pbmcpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ05vdCBydW5uaW5nLCBoYW5kbGVNaWNyb3Bob25lKCknKTtcbiAgICAgICAgaGFuZGxlTWljcm9waG9uZSh0b2tlbiwgY3VycmVudE1vZGVsLCBtaWMsIGZ1bmN0aW9uKGVyciwgc29ja2V0KSB7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgdmFyIG1zZyA9IGVyci5tZXNzYWdlO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ0Vycm9yOiAnLCBtc2cpO1xuICAgICAgICAgICAgc2hvd0Vycm9yKG1zZyk7XG4gICAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgncnVubmluZycsIGZhbHNlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVjb3JkQnV0dG9uLmNzcygnYmFja2dyb3VuZC1jb2xvcicsICcjZDc0MTA4Jyk7XG4gICAgICAgICAgICByZWNvcmRCdXR0b24uZmluZCgnaW1nJykuYXR0cignc3JjJywgJ2ltZy9zdG9wLnN2ZycpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ3N0YXJ0aW5nIG1pYycpO1xuICAgICAgICAgICAgbWljLnJlY29yZCgpO1xuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3J1bm5pbmcnLCB0cnVlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1N0b3BwaW5nIG1pY3JvcGhvbmUsIHNlbmRpbmcgc3RvcCBhY3Rpb24gbWVzc2FnZScpO1xuICAgICAgICByZWNvcmRCdXR0b24ucmVtb3ZlQXR0cignc3R5bGUnKTtcbiAgICAgICAgcmVjb3JkQnV0dG9uLmZpbmQoJ2ltZycpLmF0dHIoJ3NyYycsICdpbWcvbWljcm9waG9uZS5zdmcnKTtcbiAgICAgICAgbWljU29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoeydhY3Rpb24nOiAnc3RvcCd9KSk7XG4gICAgICAgIC8vIENhbiBhbHNvIHNlbmQgZW1wdHkgYnVmZmVyIHRvIHNpZ25hbCBlbmRcbiAgICAgICAgLy8gdmFyIGVtcHR5QnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKDApO1xuICAgICAgICAvLyBtaWNTb2NrZXQuc2VuZChlbXB0eUJ1ZmZlcik7XG4gICAgICAgIG1pYy5zdG9wKCk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdydW5uaW5nJywgZmFsc2UpO1xuICAgICAgfVxuXG5cbiAgICB9LCB0aGlzKSk7XG4gIH1cbiAgdG9rZW5SZXF1ZXN0LnNlbmQoKTtcblxufSk7XG5cbiJdfQ==
