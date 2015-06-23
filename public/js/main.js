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
      $.subscribe('stopsocket', function(data) {
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

    $.subscribe('clearscreen', function() {
      $('#resultsText').text('');
      $('#resultsJSON').text('');
      $('.hypotheses > ul').empty();
      $('#metadataTableBody').empty();
    });

    function handleSelectedFile(file) {

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
      console.log('CURRENTLY DISPLAYING', currentlyDisplaying);
      if (currentlyDisplaying) {
        $.publish('stopsocket');
        localStorage.setItem('currentlyDisplaying', false);
        return;
      }

      fileUploadDialog.val(null);

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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5ucG0vbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwicGFja2FnZS5qc29uIiwic3JjL01pY3JvcGhvbmUuanMiLCJzcmMvZGF0YS9tb2RlbHMuanNvbiIsInNyYy9maWxldXBsb2FkLmpzIiwic3JjL3NvY2tldC5qcyIsInNyYy91dGlscy5qcyIsInNyYy92aWV3cy9hbmltYXRlcGFuZWwuanMiLCJzcmMvdmlld3MvZGlzcGxheS5qcyIsInNyYy92aWV3cy9lZmZlY3RzLmpzIiwic3JjL3ZpZXdzL2luZGV4LmpzIiwic3JjL3ZpZXdzL3BsYXlzYW1wbGUuanMiLCJzcmMvdmlld3Mvc2VsZWN0bW9kZWwuanMiLCJzcmMvdmlld3Mvc2Vzc2lvbnBlcm1pc3Npb25zLmpzIiwic3JjL3ZpZXdzL3Nob3dlcnJvci5qcyIsInNyYy92aWV3cy9zaG93dGFiLmpzIiwic3JjL2luZGV4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzlHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMvR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cz17XG4gIFwibmFtZVwiOiBcIlNwZWVjaFRvVGV4dEJyb3dzZXJTdGFydGVyQXBwXCIsXG4gIFwidmVyc2lvblwiOiBcIjAuMC42XCIsXG4gIFwiZGVzY3JpcHRpb25cIjogXCJBIHNhbXBsZSBicm93c2VyIGFwcCBmb3IgQmx1ZW1peCB0aGF0IHVzZSB0aGUgc3BlZWNoLXRvLXRleHQgc2VydmljZSwgZmV0Y2hpbmcgYSB0b2tlbiB2aWEgTm9kZS5qc1wiLFxuICBcImRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJib2R5LXBhcnNlclwiOiBcIn4xLjEwLjJcIixcbiAgICBcImNvbm5lY3RcIjogXCJeMy4zLjVcIixcbiAgICBcImVycm9yaGFuZGxlclwiOiBcIn4xLjIuNFwiLFxuICAgIFwiZXhwcmVzc1wiOiBcIn40LjEwLjhcIixcbiAgICBcImhhcm1vblwiOiBcIl4xLjMuMVwiLFxuICAgIFwiaHR0cC1wcm94eVwiOiBcIl4xLjExLjFcIixcbiAgICBcInJlcXVlc3RcIjogXCJ+Mi41My4wXCIsXG4gICAgXCJ0cmFuc2Zvcm1lci1wcm94eVwiOiBcIl4wLjMuMVwiXG4gIH0sXG4gIFwiZW5naW5lc1wiOiB7XG4gICAgXCJub2RlXCI6IFwiPj0wLjEwXCJcbiAgfSxcbiAgXCJyZXBvc2l0b3J5XCI6IHtcbiAgICBcInR5cGVcIjogXCJnaXRcIixcbiAgICBcInVybFwiOiBcImh0dHBzOi8vZ2l0aHViLmNvbS93YXRzb24tZGV2ZWxvcGVyLWNsb3VkL3NwZWVjaC10by10ZXh0LWJyb3dzZXIuZ2l0XCJcbiAgfSxcbiAgXCJhdXRob3JcIjogXCJJQk0gQ29ycC5cIixcbiAgXCJicm93c2VyaWZ5LXNoaW1cIjoge1xuICAgIFwianF1ZXJ5XCI6IFwiZ2xvYmFsOmpRdWVyeVwiXG4gIH0sXG4gIFwiYnJvd3NlcmlmeVwiOiB7XG4gICAgXCJ0cmFuc2Zvcm1cIjogW1xuICAgICAgXCJicm93c2VyaWZ5LXNoaW1cIlxuICAgIF1cbiAgfSxcbiAgXCJjb250cmlidXRvcnNcIjogW1xuICAgIHtcbiAgICAgIFwibmFtZVwiOiBcIkdlcm1hbiBBdHRhbmFzaW8gUnVpelwiLFxuICAgICAgXCJlbWFpbFwiOiBcImdlcm1hbmF0dEB1cy5pYm0uY29tXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwibmFtZVwiOiBcIkRhbmllbCBCb2xhbm9cIixcbiAgICAgIFwiZW1haWxcIjogXCJkYm9sYW5vQHVzLmlibS5jb21cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJuYW1lXCI6IFwiQnJpdGFueSBMLiBQb252ZWxsZVwiLFxuICAgICAgXCJlbWFpbFwiOiBcImJscG9udmVsbGVAdXMuaWJtLmNvbVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcIm5hbWVcIjogXCJFcmljIFMuIEJ1bGxpbmd0b25cIixcbiAgICAgIFwiZW1haWxcIjogXCJlc2J1bGxpbkB1cy5pYm0uY29tXCJcbiAgICB9XG4gIF0sXG4gIFwibGljZW5zZVwiOiBcIkFwYWNoZS0yLjBcIixcbiAgXCJidWdzXCI6IHtcbiAgICBcInVybFwiOiBcImh0dHBzOi8vZ2l0aHViLmNvbS93YXRzb24tZGV2ZWxvcGVyLWNsb3VkL3NwZWVjaC10by10ZXh0LWJyb3dzZXIvaXNzdWVzXCJcbiAgfSxcbiAgXCJzY3JpcHRzXCI6IHtcbiAgICBcInN0YXJ0XCI6IFwibm9kZSBhcHAuanNcIixcbiAgICBcImJ1aWxkXCI6IFwiYnJvd3NlcmlmeSAtbyBwdWJsaWMvanMvbWFpbi5qcyBzcmMvaW5kZXguanNcIixcbiAgICBcIndhdGNoXCI6IFwid2F0Y2hpZnkgLWQgLW8gcHVibGljL2pzL21haW4uanMgc3JjL2luZGV4LmpzXCJcbiAgfSxcbiAgXCJkZXZEZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiYnJvd3NlcmlmeVwiOiBcIl4xMC4yLjRcIixcbiAgICBcImJyb3dzZXJpZnktc2hpbVwiOiBcIl4zLjguOVwiXG4gIH1cbn1cbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgSUJNIENvcnAuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlICdMaWNlbnNlJyk7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuICdBUyBJUycgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuLyoqXG4gKiBDYXB0dXJlcyBtaWNyb3Bob25lIGlucHV0IGZyb20gdGhlIGJyb3dzZXIuXG4gKiBXb3JrcyBhdCBsZWFzdCBvbiBsYXRlc3QgdmVyc2lvbnMgb2YgRmlyZWZveCBhbmQgQ2hyb21lXG4gKi9cbmZ1bmN0aW9uIE1pY3JvcGhvbmUoX29wdGlvbnMpIHtcbiAgdmFyIG9wdGlvbnMgPSBfb3B0aW9ucyB8fCB7fTtcblxuICAvLyB3ZSByZWNvcmQgaW4gbW9ubyBiZWNhdXNlIHRoZSBzcGVlY2ggcmVjb2duaXRpb24gc2VydmljZVxuICAvLyBkb2VzIG5vdCBzdXBwb3J0IHN0ZXJlby5cbiAgdGhpcy5idWZmZXJTaXplID0gb3B0aW9ucy5idWZmZXJTaXplIHx8IDgxOTI7XG4gIHRoaXMuaW5wdXRDaGFubmVscyA9IG9wdGlvbnMuaW5wdXRDaGFubmVscyB8fCAxO1xuICB0aGlzLm91dHB1dENoYW5uZWxzID0gb3B0aW9ucy5vdXRwdXRDaGFubmVscyB8fCAxO1xuICB0aGlzLnJlY29yZGluZyA9IGZhbHNlO1xuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IGZhbHNlO1xuICB0aGlzLnNhbXBsZVJhdGUgPSAxNjAwMDtcbiAgLy8gYXV4aWxpYXIgYnVmZmVyIHRvIGtlZXAgdW51c2VkIHNhbXBsZXMgKHVzZWQgd2hlbiBkb2luZyBkb3duc2FtcGxpbmcpXG4gIHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlcyA9IG5ldyBGbG9hdDMyQXJyYXkoMCk7XG5cbiAgLy8gQ2hyb21lIG9yIEZpcmVmb3ggb3IgSUUgVXNlciBtZWRpYVxuICBpZiAoIW5hdmlnYXRvci5nZXRVc2VyTWVkaWEpIHtcbiAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhID0gbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSB8fFxuICAgIG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhO1xuICB9XG5cbn1cblxuLyoqXG4gKiBDYWxsZWQgd2hlbiB0aGUgdXNlciByZWplY3QgdGhlIHVzZSBvZiB0aGUgbWljaHJvcGhvbmVcbiAqIEBwYXJhbSAgZXJyb3IgVGhlIGVycm9yXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uUGVybWlzc2lvblJlamVjdGVkID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUubG9nKCdNaWNyb3Bob25lLm9uUGVybWlzc2lvblJlamVjdGVkKCknKTtcbiAgdGhpcy5yZXF1ZXN0ZWRBY2Nlc3MgPSBmYWxzZTtcbiAgdGhpcy5vbkVycm9yKCdQZXJtaXNzaW9uIHRvIGFjY2VzcyB0aGUgbWljcm9waG9uZSByZWpldGVkLicpO1xufTtcblxuTWljcm9waG9uZS5wcm90b3R5cGUub25FcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XG4gIGNvbnNvbGUubG9nKCdNaWNyb3Bob25lLm9uRXJyb3IoKTonLCBlcnJvcik7XG59O1xuXG4vKipcbiAqIENhbGxlZCB3aGVuIHRoZSB1c2VyIGF1dGhvcml6ZXMgdGhlIHVzZSBvZiB0aGUgbWljcm9waG9uZS5cbiAqIEBwYXJhbSAge09iamVjdH0gc3RyZWFtIFRoZSBTdHJlYW0gdG8gY29ubmVjdCB0b1xuICpcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUub25NZWRpYVN0cmVhbSA9ICBmdW5jdGlvbihzdHJlYW0pIHtcbiAgdmFyIEF1ZGlvQ3R4ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xuXG4gIGlmICghQXVkaW9DdHgpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdBdWRpb0NvbnRleHQgbm90IGF2YWlsYWJsZScpO1xuXG4gIGlmICghdGhpcy5hdWRpb0NvbnRleHQpXG4gICAgdGhpcy5hdWRpb0NvbnRleHQgPSBuZXcgQXVkaW9DdHgoKTtcblxuICB2YXIgZ2FpbiA9IHRoaXMuYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgdmFyIGF1ZGlvSW5wdXQgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzdHJlYW0pO1xuXG4gIGF1ZGlvSW5wdXQuY29ubmVjdChnYWluKTtcblxuICB0aGlzLm1pYyA9IHRoaXMuYXVkaW9Db250ZXh0LmNyZWF0ZVNjcmlwdFByb2Nlc3Nvcih0aGlzLmJ1ZmZlclNpemUsXG4gICAgdGhpcy5pbnB1dENoYW5uZWxzLCB0aGlzLm91dHB1dENoYW5uZWxzKTtcblxuICAvLyB1bmNvbW1lbnQgdGhlIGZvbGxvd2luZyBsaW5lIGlmIHlvdSB3YW50IHRvIHVzZSB5b3VyIG1pY3JvcGhvbmUgc2FtcGxlIHJhdGVcbiAgLy90aGlzLnNhbXBsZVJhdGUgPSB0aGlzLmF1ZGlvQ29udGV4dC5zYW1wbGVSYXRlO1xuICBjb25zb2xlLmxvZygnTWljcm9waG9uZS5vbk1lZGlhU3RyZWFtKCk6IHNhbXBsaW5nIHJhdGUgaXM6JywgdGhpcy5zYW1wbGVSYXRlKTtcblxuICB0aGlzLm1pYy5vbmF1ZGlvcHJvY2VzcyA9IHRoaXMuX29uYXVkaW9wcm9jZXNzLmJpbmQodGhpcyk7XG4gIHRoaXMuc3RyZWFtID0gc3RyZWFtO1xuXG4gIGdhaW4uY29ubmVjdCh0aGlzLm1pYyk7XG4gIHRoaXMubWljLmNvbm5lY3QodGhpcy5hdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuICB0aGlzLnJlY29yZGluZyA9IHRydWU7XG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gZmFsc2U7XG4gIHRoaXMub25TdGFydFJlY29yZGluZygpO1xufTtcblxuLyoqXG4gKiBjYWxsYmFjayB0aGF0IGlzIGJlaW5nIHVzZWQgYnkgdGhlIG1pY3JvcGhvbmVcbiAqIHRvIHNlbmQgYXVkaW8gY2h1bmtzLlxuICogQHBhcmFtICB7b2JqZWN0fSBkYXRhIGF1ZGlvXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLl9vbmF1ZGlvcHJvY2VzcyA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgaWYgKCF0aGlzLnJlY29yZGluZykge1xuICAgIC8vIFdlIHNwZWFrIGJ1dCB3ZSBhcmUgbm90IHJlY29yZGluZ1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIFNpbmdsZSBjaGFubmVsXG4gIHZhciBjaGFuID0gZGF0YS5pbnB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKTtcblxuICB0aGlzLm9uQXVkaW8odGhpcy5fZXhwb3J0RGF0YUJ1ZmZlclRvMTZLaHoobmV3IEZsb2F0MzJBcnJheShjaGFuKSkpO1xuXG4gIC8vZXhwb3J0IHdpdGggbWljcm9waG9uZSBtaHosIHJlbWVtYmVyIHRvIHVwZGF0ZSB0aGUgdGhpcy5zYW1wbGVSYXRlXG4gIC8vIHdpdGggdGhlIHNhbXBsZSByYXRlIGZyb20geW91ciBtaWNyb3Bob25lXG4gIC8vIHRoaXMub25BdWRpbyh0aGlzLl9leHBvcnREYXRhQnVmZmVyKG5ldyBGbG9hdDMyQXJyYXkoY2hhbikpKTtcblxufTtcblxuLyoqXG4gKiBTdGFydCB0aGUgYXVkaW8gcmVjb3JkaW5nXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLnJlY29yZCA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIW5hdmlnYXRvci5nZXRVc2VyTWVkaWEpe1xuICAgIHRoaXMub25FcnJvcignQnJvd3NlciBkb2VzblxcJ3Qgc3VwcG9ydCBtaWNyb3Bob25lIGlucHV0Jyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICh0aGlzLnJlcXVlc3RlZEFjY2Vzcykge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gdHJ1ZTtcbiAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSh7IGF1ZGlvOiB0cnVlIH0sXG4gICAgdGhpcy5vbk1lZGlhU3RyZWFtLmJpbmQodGhpcyksIC8vIE1pY3JvcGhvbmUgcGVybWlzc2lvbiBncmFudGVkXG4gICAgdGhpcy5vblBlcm1pc3Npb25SZWplY3RlZC5iaW5kKHRoaXMpKTsgLy8gTWljcm9waG9uZSBwZXJtaXNzaW9uIHJlamVjdGVkXG59O1xuXG4vKipcbiAqIFN0b3AgdGhlIGF1ZGlvIHJlY29yZGluZ1xuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XG4gIGlmICghdGhpcy5yZWNvcmRpbmcpXG4gICAgcmV0dXJuO1xuICB0aGlzLnJlY29yZGluZyA9IGZhbHNlO1xuICB0aGlzLnN0cmVhbS5zdG9wKCk7XG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gZmFsc2U7XG4gIHRoaXMubWljLmRpc2Nvbm5lY3QoMCk7XG4gIHRoaXMubWljID0gbnVsbDtcbiAgdGhpcy5vblN0b3BSZWNvcmRpbmcoKTtcbn07XG5cbi8qKlxuICogQ3JlYXRlcyBhIEJsb2IgdHlwZTogJ2F1ZGlvL2wxNicgd2l0aCB0aGUgY2h1bmsgYW5kIGRvd25zYW1wbGluZyB0byAxNiBrSHpcbiAqIGNvbWluZyBmcm9tIHRoZSBtaWNyb3Bob25lLlxuICogRXhwbGFuYXRpb24gZm9yIHRoZSBtYXRoOiBUaGUgcmF3IHZhbHVlcyBjYXB0dXJlZCBmcm9tIHRoZSBXZWIgQXVkaW8gQVBJIGFyZVxuICogaW4gMzItYml0IEZsb2F0aW5nIFBvaW50LCBiZXR3ZWVuIC0xIGFuZCAxIChwZXIgdGhlIHNwZWNpZmljYXRpb24pLlxuICogVGhlIHZhbHVlcyBmb3IgMTYtYml0IFBDTSByYW5nZSBiZXR3ZWVuIC0zMjc2OCBhbmQgKzMyNzY3ICgxNi1iaXQgc2lnbmVkIGludGVnZXIpLlxuICogTXVsdGlwbHkgdG8gY29udHJvbCB0aGUgdm9sdW1lIG9mIHRoZSBvdXRwdXQuIFdlIHN0b3JlIGluIGxpdHRsZSBlbmRpYW4uXG4gKiBAcGFyYW0gIHtPYmplY3R9IGJ1ZmZlciBNaWNyb3Bob25lIGF1ZGlvIGNodW5rXG4gKiBAcmV0dXJuIHtCbG9ifSAnYXVkaW8vbDE2JyBjaHVua1xuICogQGRlcHJlY2F0ZWQgVGhpcyBtZXRob2QgaXMgZGVwcmFjYXRlZFxuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5fZXhwb3J0RGF0YUJ1ZmZlclRvMTZLaHogPSBmdW5jdGlvbihidWZmZXJOZXdTYW1wbGVzKSB7XG4gIHZhciBidWZmZXIgPSBudWxsLFxuICAgIG5ld1NhbXBsZXMgPSBidWZmZXJOZXdTYW1wbGVzLmxlbmd0aCxcbiAgICB1bnVzZWRTYW1wbGVzID0gdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzLmxlbmd0aDtcblxuICBpZiAodW51c2VkU2FtcGxlcyA+IDApIHtcbiAgICBidWZmZXIgPSBuZXcgRmxvYXQzMkFycmF5KHVudXNlZFNhbXBsZXMgKyBuZXdTYW1wbGVzKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHVudXNlZFNhbXBsZXM7ICsraSkge1xuICAgICAgYnVmZmVyW2ldID0gdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzW2ldO1xuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgbmV3U2FtcGxlczsgKytpKSB7XG4gICAgICBidWZmZXJbdW51c2VkU2FtcGxlcyArIGldID0gYnVmZmVyTmV3U2FtcGxlc1tpXTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgYnVmZmVyID0gYnVmZmVyTmV3U2FtcGxlcztcbiAgfVxuXG4gIC8vIGRvd25zYW1wbGluZyB2YXJpYWJsZXNcbiAgdmFyIGZpbHRlciA9IFtcbiAgICAgIC0wLjAzNzkzNSwgLTAuMDAwODkwMjQsIDAuMDQwMTczLCAwLjAxOTk4OSwgMC4wMDQ3NzkyLCAtMC4wNTg2NzUsIC0wLjA1NjQ4NyxcbiAgICAgIC0wLjAwNDA2NTMsIDAuMTQ1MjcsIDAuMjY5MjcsIDAuMzM5MTMsIDAuMjY5MjcsIDAuMTQ1MjcsIC0wLjAwNDA2NTMsIC0wLjA1NjQ4NyxcbiAgICAgIC0wLjA1ODY3NSwgMC4wMDQ3NzkyLCAwLjAxOTk4OSwgMC4wNDAxNzMsIC0wLjAwMDg5MDI0LCAtMC4wMzc5MzVcbiAgICBdLFxuICAgIHNhbXBsaW5nUmF0ZVJhdGlvID0gdGhpcy5hdWRpb0NvbnRleHQuc2FtcGxlUmF0ZSAvIDE2MDAwLFxuICAgIG5PdXRwdXRTYW1wbGVzID0gTWF0aC5mbG9vcigoYnVmZmVyLmxlbmd0aCAtIGZpbHRlci5sZW5ndGgpIC8gKHNhbXBsaW5nUmF0ZVJhdGlvKSkgKyAxLFxuICAgIHBjbUVuY29kZWRCdWZmZXIxNmsgPSBuZXcgQXJyYXlCdWZmZXIobk91dHB1dFNhbXBsZXMgKiAyKSxcbiAgICBkYXRhVmlldzE2ayA9IG5ldyBEYXRhVmlldyhwY21FbmNvZGVkQnVmZmVyMTZrKSxcbiAgICBpbmRleCA9IDAsXG4gICAgdm9sdW1lID0gMHg3RkZGLCAvL3JhbmdlIGZyb20gMCB0byAweDdGRkYgdG8gY29udHJvbCB0aGUgdm9sdW1lXG4gICAgbk91dCA9IDA7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgKyBmaWx0ZXIubGVuZ3RoIC0gMSA8IGJ1ZmZlci5sZW5ndGg7IGkgPSBNYXRoLnJvdW5kKHNhbXBsaW5nUmF0ZVJhdGlvICogbk91dCkpIHtcbiAgICB2YXIgc2FtcGxlID0gMDtcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGZpbHRlci5sZW5ndGg7ICsraikge1xuICAgICAgc2FtcGxlICs9IGJ1ZmZlcltpICsgal0gKiBmaWx0ZXJbal07XG4gICAgfVxuICAgIHNhbXBsZSAqPSB2b2x1bWU7XG4gICAgZGF0YVZpZXcxNmsuc2V0SW50MTYoaW5kZXgsIHNhbXBsZSwgdHJ1ZSk7IC8vICd0cnVlJyAtPiBtZWFucyBsaXR0bGUgZW5kaWFuXG4gICAgaW5kZXggKz0gMjtcbiAgICBuT3V0Kys7XG4gIH1cblxuICB2YXIgaW5kZXhTYW1wbGVBZnRlckxhc3RVc2VkID0gTWF0aC5yb3VuZChzYW1wbGluZ1JhdGVSYXRpbyAqIG5PdXQpO1xuICB2YXIgcmVtYWluaW5nID0gYnVmZmVyLmxlbmd0aCAtIGluZGV4U2FtcGxlQWZ0ZXJMYXN0VXNlZDtcbiAgaWYgKHJlbWFpbmluZyA+IDApIHtcbiAgICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXMgPSBuZXcgRmxvYXQzMkFycmF5KHJlbWFpbmluZyk7XG4gICAgZm9yIChpID0gMDsgaSA8IHJlbWFpbmluZzsgKytpKSB7XG4gICAgICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXNbaV0gPSBidWZmZXJbaW5kZXhTYW1wbGVBZnRlckxhc3RVc2VkICsgaV07XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlcyA9IG5ldyBGbG9hdDMyQXJyYXkoMCk7XG4gIH1cblxuICByZXR1cm4gbmV3IEJsb2IoW2RhdGFWaWV3MTZrXSwge1xuICAgIHR5cGU6ICdhdWRpby9sMTYnXG4gIH0pO1xuICB9O1xuXG4vKipcbiAqIENyZWF0ZXMgYSBCbG9iIHR5cGU6ICdhdWRpby9sMTYnIHdpdGggdGhlXG4gKiBjaHVuayBjb21pbmcgZnJvbSB0aGUgbWljcm9waG9uZS5cbiAqL1xudmFyIGV4cG9ydERhdGFCdWZmZXIgPSBmdW5jdGlvbihidWZmZXIsIGJ1ZmZlclNpemUpIHtcbiAgdmFyIHBjbUVuY29kZWRCdWZmZXIgPSBudWxsLFxuICAgIGRhdGFWaWV3ID0gbnVsbCxcbiAgICBpbmRleCA9IDAsXG4gICAgdm9sdW1lID0gMHg3RkZGOyAvL3JhbmdlIGZyb20gMCB0byAweDdGRkYgdG8gY29udHJvbCB0aGUgdm9sdW1lXG5cbiAgcGNtRW5jb2RlZEJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihidWZmZXJTaXplICogMik7XG4gIGRhdGFWaWV3ID0gbmV3IERhdGFWaWV3KHBjbUVuY29kZWRCdWZmZXIpO1xuXG4gIC8qIEV4cGxhbmF0aW9uIGZvciB0aGUgbWF0aDogVGhlIHJhdyB2YWx1ZXMgY2FwdHVyZWQgZnJvbSB0aGUgV2ViIEF1ZGlvIEFQSSBhcmVcbiAgICogaW4gMzItYml0IEZsb2F0aW5nIFBvaW50LCBiZXR3ZWVuIC0xIGFuZCAxIChwZXIgdGhlIHNwZWNpZmljYXRpb24pLlxuICAgKiBUaGUgdmFsdWVzIGZvciAxNi1iaXQgUENNIHJhbmdlIGJldHdlZW4gLTMyNzY4IGFuZCArMzI3NjcgKDE2LWJpdCBzaWduZWQgaW50ZWdlcikuXG4gICAqIE11bHRpcGx5IHRvIGNvbnRyb2wgdGhlIHZvbHVtZSBvZiB0aGUgb3V0cHV0LiBXZSBzdG9yZSBpbiBsaXR0bGUgZW5kaWFuLlxuICAgKi9cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXIubGVuZ3RoOyBpKyspIHtcbiAgICBkYXRhVmlldy5zZXRJbnQxNihpbmRleCwgYnVmZmVyW2ldICogdm9sdW1lLCB0cnVlKTtcbiAgICBpbmRleCArPSAyO1xuICB9XG5cbiAgLy8gbDE2IGlzIHRoZSBNSU1FIHR5cGUgZm9yIDE2LWJpdCBQQ01cbiAgcmV0dXJuIG5ldyBCbG9iKFtkYXRhVmlld10sIHsgdHlwZTogJ2F1ZGlvL2wxNicgfSk7XG59O1xuXG5NaWNyb3Bob25lLnByb3RvdHlwZS5fZXhwb3J0RGF0YUJ1ZmZlciA9IGZ1bmN0aW9uKGJ1ZmZlcil7XG4gIHV0aWxzLmV4cG9ydERhdGFCdWZmZXIoYnVmZmVyLCB0aGlzLmJ1ZmZlclNpemUpO1xufTsgXG5cblxuLy8gRnVuY3Rpb25zIHVzZWQgdG8gY29udHJvbCBNaWNyb3Bob25lIGV2ZW50cyBsaXN0ZW5lcnMuXG5NaWNyb3Bob25lLnByb3RvdHlwZS5vblN0YXJ0UmVjb3JkaW5nID0gIGZ1bmN0aW9uKCkge307XG5NaWNyb3Bob25lLnByb3RvdHlwZS5vblN0b3BSZWNvcmRpbmcgPSAgZnVuY3Rpb24oKSB7fTtcbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uQXVkaW8gPSAgZnVuY3Rpb24oKSB7fTtcblxubW9kdWxlLmV4cG9ydHMgPSBNaWNyb3Bob25lO1xuXG4iLCJtb2R1bGUuZXhwb3J0cz17XG4gICBcIm1vZGVsc1wiOiBbXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLXMud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0LWJldGEvYXBpL3YxL21vZGVscy9lcy1FU19Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiAxNjAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJlcy1FU19Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJlcy1FU1wiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJTcGFuaXNoIGJyb2FkYmFuZCBtb2RlbC5cIlxuICAgICAgfSwgXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLXMud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0LWJldGEvYXBpL3YxL21vZGVscy9qYS1KUF9Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiAxNjAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJqYS1KUF9Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJqYS1KUFwiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJKYXBhbmVzZSBicm9hZGJhbmQgbW9kZWwuXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS1zLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC1iZXRhL2FwaS92MS9tb2RlbHMvZW4tVVNfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogMTYwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiZW4tVVNfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiZW4tVVNcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiVVMgRW5nbGlzaCBicm9hZGJhbmQgbW9kZWwuXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS1zLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC1iZXRhL2FwaS92MS9tb2RlbHMvamEtSlBfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDgwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiamEtSlBfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImphLUpQXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIkphcGFuZXNlIG5hcnJvd2JhbmQgbW9kZWwuXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS1zLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC1iZXRhL2FwaS92MS9tb2RlbHMvZXMtRVNfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDgwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiZXMtRVNfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImVzLUVTXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlNwYW5pc2ggbmFycm93YmFuZCBtb2RlbC5cIlxuICAgICAgfSwgXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLXMud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0LWJldGEvYXBpL3YxL21vZGVscy9lbi1VU19OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogODAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJlbi1VU19OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiZW4tVVNcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiVVMgRW5nbGlzaCBuYXJyb3diYW5kIG1vZGVsLlwiXG4gICAgICB9XG4gICBdXG59XG4iLCJcbnZhciBlZmZlY3RzID0gcmVxdWlyZSgnLi92aWV3cy9lZmZlY3RzJyk7XG52YXIgZGlzcGxheSA9IHJlcXVpcmUoJy4vdmlld3MvZGlzcGxheScpO1xudmFyIGhpZGVFcnJvciA9IHJlcXVpcmUoJy4vdmlld3Mvc2hvd2Vycm9yJykuaGlkZUVycm9yO1xudmFyIGluaXRTb2NrZXQgPSByZXF1aXJlKCcuL3NvY2tldCcpLmluaXRTb2NrZXQ7XG5cbmV4cG9ydHMuaGFuZGxlRmlsZVVwbG9hZCA9IGZ1bmN0aW9uKHRva2VuLCBtb2RlbCwgZmlsZSwgY29udGVudFR5cGUsIGNhbGxiYWNrLCBvbmVuZCkge1xuXG5cbiAgICBjb25zb2xlLmxvZygnc2V0dGluZyBpbWFnZScpO1xuICAgIC8vICQoJyNwcm9ncmVzc0luZGljYXRvcicpLmNzcygndmlzaWJpbGl0eScsICd2aXNpYmxlJyk7XG5cbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIHRydWUpO1xuICAgIGhpZGVFcnJvcigpO1xuXG4gICAgJC5zdWJzY3JpYmUoJ3Byb2dyZXNzJywgZnVuY3Rpb24oZXZ0LCBkYXRhKSB7XG4gICAgICBjb25zb2xlLmxvZygncHJvZ3Jlc3M6ICcsIGRhdGEpO1xuICAgIH0pO1xuXG4gICAgdmFyIG1pY0ljb24gPSAkKCcjbWljcm9waG9uZUljb24nKTtcblxuICAgIGNvbnNvbGUubG9nKCdjb250ZW50VHlwZScsIGNvbnRlbnRUeXBlKTtcblxuICAgIHZhciBiYXNlU3RyaW5nID0gJyc7XG4gICAgdmFyIGJhc2VKU09OID0gJyc7XG5cbiAgICB2YXIgb3B0aW9ucyA9IHt9O1xuICAgIG9wdGlvbnMudG9rZW4gPSB0b2tlbjtcbiAgICBvcHRpb25zLm1lc3NhZ2UgPSB7XG4gICAgICAnYWN0aW9uJzogJ3N0YXJ0JyxcbiAgICAgICdjb250ZW50LXR5cGUnOiBjb250ZW50VHlwZSxcbiAgICAgICdpbnRlcmltX3Jlc3VsdHMnOiB0cnVlLFxuICAgICAgJ2NvbnRpbnVvdXMnOiB0cnVlLFxuICAgICAgJ3dvcmRfY29uZmlkZW5jZSc6IHRydWUsXG4gICAgICAndGltZXN0YW1wcyc6IHRydWUsXG4gICAgICAnbWF4X2FsdGVybmF0aXZlcyc6IDNcbiAgICB9O1xuICAgIG9wdGlvbnMubW9kZWwgPSBtb2RlbDtcblxuICAgIGZ1bmN0aW9uIG9uT3Blbihzb2NrZXQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdTb2NrZXQgb3BlbmVkJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25MaXN0ZW5pbmcoc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZygnU29ja2V0IGxpc3RlbmluZycpO1xuICAgICAgY2FsbGJhY2soc29ja2V0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbk1lc3NhZ2UobXNnKSB7XG4gICAgICBjb25zb2xlLmxvZygnU29ja2V0IG1zZzogJywgbXNnKTtcbiAgICAgIGlmIChtc2cucmVzdWx0cykge1xuICAgICAgICAvLyBDb252ZXJ0IHRvIGNsb3N1cmUgYXBwcm9hY2hcbiAgICAgICAgYmFzZVN0cmluZyA9IGRpc3BsYXkuc2hvd1Jlc3VsdChtc2csIGJhc2VTdHJpbmcpO1xuICAgICAgICBiYXNlSlNPTiA9IGRpc3BsYXkuc2hvd0pTT04obXNnLCBiYXNlSlNPTik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25FcnJvcihldnQpIHtcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgb25lbmQoZXZ0KTtcbiAgICAgIGNvbnNvbGUubG9nKCdTb2NrZXQgZXJyOiAnLCBldnQuY29kZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25DbG9zZShldnQpIHtcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgb25lbmQoZXZ0KTtcbiAgICAgIGNvbnNvbGUubG9nKCdTb2NrZXQgY2xvc2luZzogJywgZXZ0KTtcbiAgICB9XG5cbiAgICBpbml0U29ja2V0KG9wdGlvbnMsIG9uT3Blbiwgb25MaXN0ZW5pbmcsIG9uTWVzc2FnZSwgb25FcnJvciwgb25DbG9zZSk7XG5cbiAgfVxuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4vKmdsb2JhbCAkOmZhbHNlICovXG5cblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xudmFyIE1pY3JvcGhvbmUgPSByZXF1aXJlKCcuL01pY3JvcGhvbmUnKTtcbnZhciBzaG93ZXJyb3IgPSByZXF1aXJlKCcuL3ZpZXdzL3Nob3dlcnJvcicpO1xudmFyIHNob3dFcnJvciA9IHNob3dlcnJvci5zaG93RXJyb3I7XG52YXIgaGlkZUVycm9yID0gc2hvd2Vycm9yLmhpZGVFcnJvcjtcblxuLy8gTWluaSBXUyBjYWxsYmFjayBBUEksIHNvIHdlIGNhbiBpbml0aWFsaXplXG4vLyB3aXRoIG1vZGVsIGFuZCB0b2tlbiBpbiBVUkksIHBsdXNcbi8vIHN0YXJ0IG1lc3NhZ2Vcbi8vXG5cbnZhciBpbml0U29ja2V0ID0gZXhwb3J0cy5pbml0U29ja2V0ID0gZnVuY3Rpb24ob3B0aW9ucywgb25vcGVuLCBvbmxpc3RlbmluZywgb25tZXNzYWdlLCBvbmVycm9yLCBvbmNsb3NlLCByZXRyeUNvdW50RG93bikge1xuICB2YXIgbGlzdGVuaW5nID0gZmFsc2U7XG4gIGZ1bmN0aW9uIHdpdGhEZWZhdWx0KHZhbCwgZGVmYXVsdFZhbCkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsID09PSAndW5kZWZpbmVkJyA/IGRlZmF1bHRWYWwgOiB2YWw7XG4gIH1cbiAgdmFyIHNvY2tldCwgY291bnQ7XG4gIHZhciB0b2tlbiA9IG9wdGlvbnMudG9rZW47XG4gIHZhciBtb2RlbCA9IG9wdGlvbnMubW9kZWwgfHwgbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRNb2RlbCcpO1xuICB2YXIgbWVzc2FnZSA9IG9wdGlvbnMubWVzc2FnZSB8fCB7J2FjdGlvbic6ICdzdGFydCd9O1xuICB2YXIgc2Vzc2lvblBlcm1pc3Npb25zID0gd2l0aERlZmF1bHQob3B0aW9ucy5zZXNzaW9uUGVybWlzc2lvbnMsIEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3Nlc3Npb25QZXJtaXNzaW9ucycpKSk7XG4gIHZhciBzZXNzaW9uUGVybWlzc2lvbnNRdWVyeVBhcmFtID0gc2Vzc2lvblBlcm1pc3Npb25zID8gJzAnIDogJzEnO1xuICB2YXIgdXJsID0gb3B0aW9ucy5zZXJ2aWNlVVJJIHx8ICd3c3M6Ly9zdHJlYW0tcy53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQtYmV0YS9hcGkvdjEvcmVjb2duaXplP3dhdHNvbi10b2tlbj0nXG4gICAgKyB0b2tlblxuICAgICsgJyZYLVdEQy1QTC1PUFQtT1VUPScgKyBzZXNzaW9uUGVybWlzc2lvbnNRdWVyeVBhcmFtXG4gICAgKyAnJm1vZGVsPScgKyBtb2RlbDtcbiAgY29uc29sZS5sb2coJ1VSTCBtb2RlbCcsIG1vZGVsKTtcbiAgdHJ5IHtcbiAgICBzb2NrZXQgPSBuZXcgV2ViU29ja2V0KHVybCk7XG4gIH0gY2F0Y2goZXJyKSB7XG4gICAgY29uc29sZS5sb2coJ3dlYnNvY2tldGVycicsIGVycik7XG4gICAgc2hvd0Vycm9yKGVyci5tZXNzYWdlKTtcbiAgfVxuICBzb2NrZXQub25vcGVuID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgY29uc29sZS5sb2coJ3dzIG9wZW5lZCcpO1xuICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpKTtcbiAgICBvbm9wZW4oc29ja2V0KTtcbiAgfTtcbiAgc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciBtc2cgPSBKU09OLnBhcnNlKGV2dC5kYXRhKTtcbiAgICBjb25zb2xlLmxvZygnZXZ0JywgZXZ0KTtcbiAgICBpZiAobXNnLnN0YXRlID09PSAnbGlzdGVuaW5nJykge1xuICAgICAgJC5zdWJzY3JpYmUoJ3N0b3Bzb2NrZXQnLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdDbG9zaW5nIHNvY2tldC4uLicpO1xuICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7J2FjdGlvbic6ICdzdG9wJ30pKTtcbiAgICAgICAgc29ja2V0LmNsb3NlKCk7XG4gICAgICB9KTtcbiAgICAgIGlmICghbGlzdGVuaW5nKSB7XG4gICAgICAgIG9ubGlzdGVuaW5nKHNvY2tldCk7XG4gICAgICAgIGhpZGVFcnJvcigpO1xuICAgICAgICBsaXN0ZW5pbmcgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ2Nsb3Npbmcgc29ja2V0Jyk7XG4gICAgICAgIC8vIENhbm5vdCBjbG9zZSBzb2NrZXQgc2luY2Ugc3RhdGUgaXMgcmVwb3J0ZWQgaGVyZSBhcyAnQ0xPU0lORycgb3IgJ0NMT1NFRCdcbiAgICAgICAgLy8gRGVzcGl0ZSB0aGlzLCBpdCdzIHBvc3NpYmxlIHRvIHNlbmQgZnJvbSB0aGlzICdDTE9TSU5HJyBzb2NrZXQgd2l0aCBubyBpc3N1ZVxuICAgICAgICAvLyBDb3VsZCBiZSBhIGJyb3dzZXIgYnVnLCBzdGlsbCBpbnZlc3RpZ2F0aW5nXG4gICAgICAgIC8vIENvdWxkIGFsc28gYmUgYSBwcm94eS9nYXRld2F5IGlzc3VlXG4gICAgICAgIHNvY2tldC5jbG9zZSgpO1xuICAgICAgfVxuICAgIH1cbiAgICBvbm1lc3NhZ2UobXNnLCBzb2NrZXQpO1xuICB9O1xuXG4gIHNvY2tldC5vbmVycm9yID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgY29uc29sZS5sb2coJ1dTIG9uZXJyb3I6ICcsIGV2dCk7XG4gICAgc2hvd0Vycm9yKCdBcHBsaWNhdGlvbiBlcnJvciAnICsgZXZ0LmNvZGUgKyAnOiBwbGVhc2UgcmVmcmVzaCB5b3VyIGJyb3dzZXIgYW5kIHRyeSBhZ2FpbicpO1xuICAgIG9uZXJyb3IoZXZ0KTtcbiAgfTtcblxuICBzb2NrZXQub25jbG9zZSA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIGNvbnNvbGUubG9nKCdXUyBvbmNsb3NlOiAnLCBldnQpO1xuICAgIGlmIChldnQuY29kZSA9PT0gMTAwNikge1xuICAgICAgLy8gQXV0aGVudGljYXRpb24gZXJyb3IsIHRyeSB0byByZWNvbm5lY3RcbiAgICAgIGNvdW50ID0gdXRpbHMuZ2V0VG9rZW4oZnVuY3Rpb24odG9rZW4sIGVycikge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgc2hvd0Vycm9yKGVyci5tZXNzYWdlKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS5sb2coJ2dvdCB0b2tlbicsIHRva2VuKTtcbiAgICAgICAgb3B0aW9ucy50b2tlbiA9IHRva2VuO1xuICAgICAgICBpbml0U29ja2V0KG9wdGlvbnMsIG9ub3Blbiwgb25saXN0ZW5pbmcsIG9ubWVzc2FnZSwgb25lcnJvcik7XG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYgKGV2dC5jb2RlID4gMTAwMCkge1xuICAgICAgc2hvd0Vycm9yKCdTZXJ2ZXIgZXJyb3IgJyArIGV2dC5jb2RlICsgJzogcGxlYXNlIHJlZnJlc2ggeW91ciBicm93c2VyIGFuZCB0cnkgYWdhaW4nKTtcbiAgICB9XG4gICAgLy8gTWFkZSBpdCB0aHJvdWdoLCBub3JtYWwgY2xvc2VcbiAgICBvbmNsb3NlKGV2dCk7XG4gIH07XG5cbn1cblxuIiwiXG4vLyBGb3Igbm9uLXZpZXcgbG9naWNcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cualF1ZXJ5IDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbC5qUXVlcnkgOiBudWxsKTtcblxudmFyIGZpbGVCbG9jayA9IGZ1bmN0aW9uKF9vZmZzZXQsIGxlbmd0aCwgX2ZpbGUsIHJlYWRDaHVuaykge1xuICB2YXIgciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gIHZhciBibG9iID0gX2ZpbGUuc2xpY2UoX29mZnNldCwgbGVuZ3RoICsgX29mZnNldCk7XG4gIHIub25sb2FkID0gcmVhZENodW5rO1xuICByLnJlYWRBc0FycmF5QnVmZmVyKGJsb2IpO1xufVxuXG4vLyBCYXNlZCBvbiBhbGVkaWFmZXJpYSdzIFNPIHJlc3BvbnNlXG4vLyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzE0NDM4MTg3L2phdmFzY3JpcHQtZmlsZXJlYWRlci1wYXJzaW5nLWxvbmctZmlsZS1pbi1jaHVua3NcbmV4cG9ydHMub25GaWxlUHJvZ3Jlc3MgPSBmdW5jdGlvbihvcHRpb25zLCBvbmRhdGEsIG9uZXJyb3IsIG9uZW5kKSB7XG4gIHZhciBmaWxlICAgICAgID0gb3B0aW9ucy5maWxlO1xuICB2YXIgZmlsZVNpemUgICA9IGZpbGUuc2l6ZTtcbiAgdmFyIGNodW5rU2l6ZSAgPSBvcHRpb25zLmJ1ZmZlclNpemUgfHwgODE5MjtcbiAgdmFyIG9mZnNldCAgICAgPSAwO1xuICB2YXIgcmVhZENodW5rID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgaWYgKG9mZnNldCA+PSBmaWxlU2l6ZSkge1xuICAgICAgY29uc29sZS5sb2coXCJEb25lIHJlYWRpbmcgZmlsZVwiKTtcbiAgICAgIG9uZW5kKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChldnQudGFyZ2V0LmVycm9yID09IG51bGwpIHtcbiAgICAgIHZhciBidWZmZXIgPSBldnQudGFyZ2V0LnJlc3VsdDtcbiAgICAgIHZhciBsZW4gPSBidWZmZXIuYnl0ZUxlbmd0aDtcbiAgICAgIG9mZnNldCArPSBsZW47XG4gICAgICBvbmRhdGEoYnVmZmVyKTsgLy8gY2FsbGJhY2sgZm9yIGhhbmRsaW5nIHJlYWQgY2h1bmtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGVycm9yTWVzc2FnZSA9IGV2dC50YXJnZXQuZXJyb3I7XG4gICAgICBjb25zb2xlLmxvZyhcIlJlYWQgZXJyb3I6IFwiICsgZXJyb3JNZXNzYWdlKTtcbiAgICAgIG9uZXJyb3IoZXJyb3JNZXNzYWdlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZmlsZUJsb2NrKG9mZnNldCwgY2h1bmtTaXplLCBmaWxlLCByZWFkQ2h1bmspO1xuICB9XG4gIGZpbGVCbG9jayhvZmZzZXQsIGNodW5rU2l6ZSwgZmlsZSwgcmVhZENodW5rKTtcbn1cblxuZXhwb3J0cy5nZXRUb2tlbiA9IChmdW5jdGlvbigpIHtcbiAgLy8gTWFrZSBjYWxsIHRvIEFQSSB0byB0cnkgYW5kIGdldCB0b2tlblxuICB2YXIgaGFzQmVlblJ1blRpbWVzID0gMjtcbiAgcmV0dXJuIGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgaGFzQmVlblJ1blRpbWVzLS07XG4gICAgaWYgKGhhc0JlZW5SdW5UaW1lcyA9PT0gMCkge1xuICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignQ2Fubm90IHJlYWNoIHNlcnZlcicpO1xuICAgICAgY2FsbGJhY2sobnVsbCwgZXJyKTtcbiAgICB9XG4gICAgdmFyIHVybCA9ICcvdG9rZW4nO1xuICAgIHZhciB0b2tlblJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB0b2tlblJlcXVlc3Qub3BlbihcIkdFVFwiLCB1cmwsIHRydWUpO1xuICAgIHRva2VuUmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbihldnQpIHtcbiAgICAgIHZhciB0b2tlbiA9IHRva2VuUmVxdWVzdC5yZXNwb25zZVRleHQ7XG4gICAgICBjYWxsYmFjayh0b2tlbik7XG4gICAgfTtcbiAgICB0b2tlblJlcXVlc3Quc2VuZCgpO1xuICB9XG59KSgpO1xuXG5leHBvcnRzLmluaXRQdWJTdWIgPSBmdW5jdGlvbigpIHtcbiAgdmFyIG8gICAgICAgICA9ICQoe30pO1xuICAkLnN1YnNjcmliZSAgID0gby5vbi5iaW5kKG8pO1xuICAkLnVuc3Vic2NyaWJlID0gby5vZmYuYmluZChvKTtcbiAgJC5wdWJsaXNoICAgICA9IG8udHJpZ2dlci5iaW5kKG8pO1xufVxuIiwiXG5cbmV4cG9ydHMuaW5pdEFuaW1hdGVQYW5lbCA9IGZ1bmN0aW9uKCkge1xuICAkKCcucGFuZWwtaGVhZGluZyBzcGFuLmNsaWNrYWJsZScpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICBpZiAoJCh0aGlzKS5oYXNDbGFzcygncGFuZWwtY29sbGFwc2VkJykpIHtcbiAgICAgIC8vIGV4cGFuZCB0aGUgcGFuZWxcbiAgICAgICQodGhpcykucGFyZW50cygnLnBhbmVsJykuZmluZCgnLnBhbmVsLWJvZHknKS5zbGlkZURvd24oKTtcbiAgICAgICQodGhpcykucmVtb3ZlQ2xhc3MoJ3BhbmVsLWNvbGxhcHNlZCcpO1xuICAgICAgJCh0aGlzKS5maW5kKCdpJykucmVtb3ZlQ2xhc3MoJ2NhcmV0LWRvd24nKS5hZGRDbGFzcygnY2FyZXQtdXAnKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBjb2xsYXBzZSB0aGUgcGFuZWxcbiAgICAgICQodGhpcykucGFyZW50cygnLnBhbmVsJykuZmluZCgnLnBhbmVsLWJvZHknKS5zbGlkZVVwKCk7XG4gICAgICAkKHRoaXMpLmFkZENsYXNzKCdwYW5lbC1jb2xsYXBzZWQnKTtcbiAgICAgICQodGhpcykuZmluZCgnaScpLnJlbW92ZUNsYXNzKCdjYXJldC11cCcpLmFkZENsYXNzKCdjYXJldC1kb3duJyk7XG4gICAgfVxuICB9KTtcbn1cblxuIiwidmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdy5qUXVlcnkgOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsLmpRdWVyeSA6IG51bGwpO1xuXG52YXIgc2hvd1RpbWVzdGFtcCA9IGZ1bmN0aW9uKHRpbWVzdGFtcHMsIGNvbmZpZGVuY2VzKSB7XG4gIHZhciB3b3JkID0gdGltZXN0YW1wc1swXSxcbiAgICAgIHQwID0gdGltZXN0YW1wc1sxXSxcbiAgICAgIHQxID0gdGltZXN0YW1wc1syXTtcbiAgdmFyIHRpbWVsZW5ndGggPSB0MSAtIHQwO1xuICAvLyBTaG93IGNvbmZpZGVuY2UgaWYgZGVmaW5lZCwgZWxzZSAnbi9hJ1xuICB2YXIgZGlzcGxheUNvbmZpZGVuY2UgPSBjb25maWRlbmNlcyA/IGNvbmZpZGVuY2VzWzFdLnRvU3RyaW5nKCkuc3Vic3RyaW5nKDAsIDMpIDogJ24vYSc7XG4gICQoJyNtZXRhZGF0YVRhYmxlID4gdGJvZHk6bGFzdC1jaGlsZCcpLmFwcGVuZChcbiAgICAgICc8dHI+J1xuICAgICAgKyAnPHRkPicgKyB3b3JkICsgJzwvdGQ+J1xuICAgICAgKyAnPHRkPicgKyB0MCArICc8L3RkPidcbiAgICAgICsgJzx0ZD4nICsgdDEgKyAnPC90ZD4nXG4gICAgICArICc8dGQ+JyArIGRpc3BsYXlDb25maWRlbmNlICsgJzwvdGQ+J1xuICAgICAgKyAnPC90cj4nXG4gICAgICApO1xufVxuXG52YXIgc2hvd01ldGFEYXRhID0gZnVuY3Rpb24oYWx0ZXJuYXRpdmUpIHtcbiAgJCgnI21ldGFkYXRhVGFibGUgPiB0Ym9keScpLmVtcHR5KCk7XG4gIHZhciBjb25maWRlbmNlTmVzdGVkQXJyYXkgPSBhbHRlcm5hdGl2ZS53b3JkX2NvbmZpZGVuY2U7O1xuICB2YXIgdGltZXN0YW1wTmVzdGVkQXJyYXkgPSBhbHRlcm5hdGl2ZS50aW1lc3RhbXBzO1xuICBpZiAoY29uZmlkZW5jZU5lc3RlZEFycmF5ICYmIGNvbmZpZGVuY2VOZXN0ZWRBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb25maWRlbmNlTmVzdGVkQXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciB0aW1lc3RhbXBzID0gdGltZXN0YW1wTmVzdGVkQXJyYXlbaV07XG4gICAgICB2YXIgY29uZmlkZW5jZXMgPSBjb25maWRlbmNlTmVzdGVkQXJyYXlbaV07XG4gICAgICBzaG93VGltZXN0YW1wKHRpbWVzdGFtcHMsIGNvbmZpZGVuY2VzKTtcbiAgICB9XG4gICAgcmV0dXJuO1xuICB9IGVsc2Uge1xuICAgIGlmICh0aW1lc3RhbXBOZXN0ZWRBcnJheSAmJiB0aW1lc3RhbXBOZXN0ZWRBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zb2xlLmxvZygnU0hPV0lORyBUSU1FU1RBTVBTJyk7XG4gICAgICB0aW1lc3RhbXBOZXN0ZWRBcnJheS5mb3JFYWNoKGZ1bmN0aW9uKHRpbWVzdGFtcCkge1xuICAgICAgICBzaG93VGltZXN0YW1wKHRpbWVzdGFtcCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cblxudmFyIHNob3dBbHRlcm5hdGl2ZXMgPSBmdW5jdGlvbihhbHRlcm5hdGl2ZXMpIHtcbiAgdmFyICRoeXBvdGhlc2VzID0gJCgnLmh5cG90aGVzZXMgdWwnKTtcbiAgYWx0ZXJuYXRpdmVzLmZvckVhY2goZnVuY3Rpb24oYWx0ZXJuYXRpdmUsIGlkeCkge1xuICAgICRoeXBvdGhlc2VzLmFwcGVuZCgnPGxpIGRhdGEtaHlwb3RoZXNpcy1pbmRleD0nICsgaWR4ICsgJyA+JyArIGFsdGVybmF0aXZlLnRyYW5zY3JpcHQgKyAnPC9saT4nKTtcbiAgfSk7XG4gICRoeXBvdGhlc2VzLm9uKCdjbGljaycsIFwibGlcIiwgZnVuY3Rpb24gKGFsdGVybmF0aXZlcykge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwic2hvd2luZyBtZXRhZGF0YVwiKTtcbiAgICAgIHZhciBpZHggPSArICQodGhpcykuZGF0YSgnaHlwb3RoZXNpcy1pbmRleCcpO1xuICAgICAgdmFyIGFsdGVybmF0aXZlID0gYWx0ZXJuYXRpdmVzW2lkeF07XG4gICAgICBzaG93TWV0YURhdGEoYWx0ZXJuYXRpdmUpO1xuICAgIH1cbiAgfSk7XG59XG5cbi8vIFRPRE86IENvbnZlcnQgdG8gY2xvc3VyZSBhcHByb2FjaFxudmFyIHByb2Nlc3NTdHJpbmcgPSBmdW5jdGlvbihiYXNlU3RyaW5nLCBpc0ZpbmlzaGVkKSB7XG5cbiAgaWYgKGlzRmluaXNoZWQpIHtcbiAgICB2YXIgZm9ybWF0dGVkU3RyaW5nID0gYmFzZVN0cmluZy5zbGljZSgwLCAtMSk7XG4gICAgZm9ybWF0dGVkU3RyaW5nID0gZm9ybWF0dGVkU3RyaW5nLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgZm9ybWF0dGVkU3RyaW5nLnN1YnN0cmluZygxKTtcbiAgICBmb3JtYXR0ZWRTdHJpbmcgPSBmb3JtYXR0ZWRTdHJpbmcudHJpbSgpICsgJy4nO1xuICAgIGNvbnNvbGUubG9nKCdmb3JtYXR0ZWQgZmluYWwgcmVzOicsIGZvcm1hdHRlZFN0cmluZyk7XG4gICAgJCgnI3Jlc3VsdHNUZXh0JykudmFsKGZvcm1hdHRlZFN0cmluZyk7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS5sb2coJ2ludGVyaW1SZXN1bHQgcmVzOicsIGJhc2VTdHJpbmcpO1xuICAgICQoJyNyZXN1bHRzVGV4dCcpLnZhbChiYXNlU3RyaW5nKTtcbiAgfVxuXG59XG5cbmV4cG9ydHMuc2hvd0pTT04gPSBmdW5jdGlvbihtc2csIGJhc2VKU09OKSB7XG4gIHZhciBqc29uID0gSlNPTi5zdHJpbmdpZnkobXNnKTtcbiAgYmFzZUpTT04gKz0ganNvbjtcbiAgYmFzZUpTT04gKz0gJ1xcbic7XG4gICQoJyNyZXN1bHRzSlNPTicpLnZhbChiYXNlSlNPTik7XG4gIHJldHVybiBiYXNlSlNPTjtcbn1cblxuZXhwb3J0cy5zaG93UmVzdWx0ID0gZnVuY3Rpb24obXNnLCBiYXNlU3RyaW5nLCBjYWxsYmFjaykge1xuXG4gIHZhciBpZHggPSArbXNnLnJlc3VsdF9pbmRleDtcblxuICBpZiAobXNnLnJlc3VsdHMgJiYgbXNnLnJlc3VsdHMubGVuZ3RoID4gMCkge1xuXG4gICAgdmFyIGFsdGVybmF0aXZlcyA9IG1zZy5yZXN1bHRzWzBdLmFsdGVybmF0aXZlcztcbiAgICB2YXIgdGV4dCA9IG1zZy5yZXN1bHRzWzBdLmFsdGVybmF0aXZlc1swXS50cmFuc2NyaXB0IHx8ICcnO1xuXG4gICAgc2hvd01ldGFEYXRhKGFsdGVybmF0aXZlc1swXSk7XG4gICAgLy9DYXBpdGFsaXplIGZpcnN0IHdvcmRcbiAgICAvLyBpZiBmaW5hbCByZXN1bHRzLCBhcHBlbmQgYSBuZXcgcGFyYWdyYXBoXG4gICAgaWYgKG1zZy5yZXN1bHRzICYmIG1zZy5yZXN1bHRzWzBdICYmIG1zZy5yZXN1bHRzWzBdLmZpbmFsKSB7XG4gICAgICBiYXNlU3RyaW5nICs9IHRleHQ7XG4gICAgICB2YXIgZGlzcGxheUZpbmFsU3RyaW5nID0gYmFzZVN0cmluZztcbiAgICAgIGRpc3BsYXlGaW5hbFN0cmluZyA9IGRpc3BsYXlGaW5hbFN0cmluZy5yZXBsYWNlKC8lSEVTSVRBVElPTlxccy9nLCAnJyk7XG4gICAgICBkaXNwbGF5RmluYWxTdHJpbmcgPSBkaXNwbGF5RmluYWxTdHJpbmcucmVwbGFjZSgvXigobilcXDMrKSQvZywgJycpO1xuICAgICAgcHJvY2Vzc1N0cmluZyhkaXNwbGF5RmluYWxTdHJpbmcsIHRydWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgdGVtcFN0cmluZyA9IGJhc2VTdHJpbmcgKyB0ZXh0O1xuICAgICAgdGVtcFN0cmluZyA9IHRlbXBTdHJpbmcucmVwbGFjZSgvJUhFU0lUQVRJT05cXHMvZywgJycpO1xuICAgICAgdGVtcFN0cmluZyA9IHRlbXBTdHJpbmcucmVwbGFjZSgvXigobilcXDMrKSQvZywgJycpO1xuICAgICAgcHJvY2Vzc1N0cmluZyh0ZW1wU3RyaW5nLCBmYWxzZSk7XG4gICAgfVxuICB9XG4gIGlmIChhbHRlcm5hdGl2ZXMpIHtcbiAgICBzaG93QWx0ZXJuYXRpdmVzKGFsdGVybmF0aXZlcyk7XG4gIH1cblxuICByZXR1cm4gYmFzZVN0cmluZztcblxufTtcbiIsIlxuXG5cbmV4cG9ydHMuZmxhc2hTVkcgPSBmdW5jdGlvbihlbCkge1xuICBlbC5jc3MoeyBmaWxsOiAnI0E1MzcyNScgfSk7XG4gIGZ1bmN0aW9uIGxvb3AoKSB7XG4gICAgZWwuYW5pbWF0ZSh7IGZpbGw6ICcjQTUzNzI1JyB9LFxuICAgICAgICAxMDAwLCAnbGluZWFyJylcbiAgICAgIC5hbmltYXRlKHsgZmlsbDogJ3doaXRlJyB9LFxuICAgICAgICAgIDEwMDAsICdsaW5lYXInKTtcbiAgfVxuICAvLyByZXR1cm4gdGltZXJcbiAgdmFyIHRpbWVyID0gc2V0VGltZW91dChsb29wLCAyMDAwKTtcbiAgcmV0dXJuIHRpbWVyO1xufTtcblxuZXhwb3J0cy5zdG9wRmxhc2hTVkcgPSBmdW5jdGlvbih0aW1lcikge1xuICBlbC5jc3MoeyBmaWxsOiAnd2hpdGUnIH0gKTtcbiAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG59XG5cbmV4cG9ydHMudG9nZ2xlSW1hZ2UgPSBmdW5jdGlvbihlbCwgbmFtZSkge1xuICBpZihlbC5hdHRyKCdzcmMnKSA9PT0gJ2ltZy8nICsgbmFtZSArICcuc3ZnJykge1xuICAgIGVsLmF0dHIoXCJzcmNcIiwgJ2ltZy9zdG9wLXJlZC5zdmcnKTtcbiAgfSBlbHNlIHtcbiAgICBlbC5hdHRyKCdzcmMnLCAnaW1nL3N0b3Auc3ZnJyk7XG4gIH1cbn1cblxudmFyIHJlc3RvcmVJbWFnZSA9IGV4cG9ydHMucmVzdG9yZUltYWdlID0gZnVuY3Rpb24oZWwsIG5hbWUpIHtcbiAgZWwuYXR0cignc3JjJywgJ2ltZy8nICsgbmFtZSArICcuc3ZnJyk7XG59XG5cbmV4cG9ydHMuc3RvcFRvZ2dsZUltYWdlID0gZnVuY3Rpb24odGltZXIsIGVsLCBuYW1lKSB7XG4gIGNsZWFySW50ZXJ2YWwodGltZXIpO1xuICByZXN0b3JlSW1hZ2UoZWwsIG5hbWUpO1xufVxuXG4iLCJcbnZhciBpbml0U2Vzc2lvblBlcm1pc3Npb25zID0gcmVxdWlyZSgnLi9zZXNzaW9ucGVybWlzc2lvbnMnKS5pbml0U2Vzc2lvblBlcm1pc3Npb25zO1xudmFyIGluaXRTZWxlY3RNb2RlbCA9IHJlcXVpcmUoJy4vc2VsZWN0bW9kZWwnKS5pbml0U2VsZWN0TW9kZWw7XG52YXIgaW5pdEFuaW1hdGVQYW5lbCA9IHJlcXVpcmUoJy4vYW5pbWF0ZXBhbmVsJykuaW5pdEFuaW1hdGVQYW5lbDtcbnZhciBpbml0U2hvd1RhYiA9IHJlcXVpcmUoJy4vc2hvd3RhYicpLmluaXRTaG93VGFiO1xudmFyIGluaXRQbGF5U2FtcGxlID0gcmVxdWlyZSgnLi9wbGF5c2FtcGxlJykuaW5pdFBsYXlTYW1wbGU7XG5cblxuZXhwb3J0cy5pbml0Vmlld3MgPSBmdW5jdGlvbihjdHgpIHtcbiAgY29uc29sZS5sb2coJ0luaXRpYWxpemluZyB2aWV3cy4uLicpO1xuICBpbml0U2VsZWN0TW9kZWwoY3R4KTtcbiAgaW5pdFBsYXlTYW1wbGUoY3R4KTtcbiAgaW5pdFNlc3Npb25QZXJtaXNzaW9ucygpO1xuICBpbml0U2hvd1RhYigpO1xuICBpbml0QW5pbWF0ZVBhbmVsKCk7XG4gIGluaXRTaG93VGFiKCk7XG59XG4iLCJcbid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKTtcbnZhciBvbkZpbGVQcm9ncmVzcyA9IHV0aWxzLm9uRmlsZVByb2dyZXNzO1xudmFyIGhhbmRsZUZpbGVVcGxvYWQgPSByZXF1aXJlKCcuLi9maWxldXBsb2FkJykuaGFuZGxlRmlsZVVwbG9hZDtcbnZhciBpbml0U29ja2V0ID0gcmVxdWlyZSgnLi4vc29ja2V0JykuaW5pdFNvY2tldDtcbnZhciBzaG93RXJyb3IgPSByZXF1aXJlKCcuL3Nob3dlcnJvcicpLnNob3dFcnJvcjtcbnZhciBlZmZlY3RzID0gcmVxdWlyZSgnLi9lZmZlY3RzJyk7XG5cblxudmFyIHBsYXlTYW1wbGUgPSBmdW5jdGlvbih0b2tlbiwgaW1hZ2VUYWcsIGljb25OYW1lLCB1cmwsIGNhbGxiYWNrKSB7XG5cbiAgdmFyIGN1cnJlbnRseURpc3BsYXlpbmcgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJykpO1xuXG4gIGlmIChjdXJyZW50bHlEaXNwbGF5aW5nKSB7XG4gICAgc2hvd0Vycm9yKCdDdXJyZW50bHkgZGlzcGxheWluZyBhbm90aGVyIGZpbGUsIHBsZWFzZSB3YWl0IHVudGlsIGNvbXBsZXRlJyk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgJC5wdWJsaXNoKCdjbGVhcnNjcmVlbicpO1xuXG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgdHJ1ZSk7XG5cbiAgdmFyIHRpbWVyID0gc2V0SW50ZXJ2YWwoZWZmZWN0cy50b2dnbGVJbWFnZSwgNzUwLCBpbWFnZVRhZywgaWNvbk5hbWUpO1xuXG4gIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgeGhyLm9wZW4oJ0dFVCcsIHVybCwgdHJ1ZSk7XG4gIHhoci5yZXNwb25zZVR5cGUgPSAnYmxvYic7XG4gIHhoci5vbmxvYWQgPSBmdW5jdGlvbihlKSB7XG4gICAgdmFyIGJsb2IgPSB4aHIucmVzcG9uc2U7XG4gICAgdmFyIGN1cnJlbnRNb2RlbCA9ICdlbi1VU19Ccm9hZGJhbmRNb2RlbCc7XG4gICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgdmFyIGJsb2JUb1RleHQgPSBuZXcgQmxvYihbYmxvYl0pLnNsaWNlKDAsIDQpO1xuICAgIHJlYWRlci5yZWFkQXNUZXh0KGJsb2JUb1RleHQpO1xuICAgIHJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjb250ZW50VHlwZSA9IHJlYWRlci5yZXN1bHQgPT09ICdmTGFDJyA/ICdhdWRpby9mbGFjJyA6ICdhdWRpby93YXYnO1xuICAgICAgY29uc29sZS5sb2coJ1VwbG9hZGluZyBmaWxlJywgcmVhZGVyLnJlc3VsdCk7XG4gICAgICB2YXIgbWVkaWFTb3VyY2VVUkwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuICAgICAgdmFyIGF1ZGlvID0gJCgnLmF1ZGlvJykuZ2V0KDApO1xuICAgICAgJCgnLmF1ZGlvJykuc2hvdygpLmF0dHIoJ3NyYycsIG1lZGlhU291cmNlVVJMKTtcbiAgICAgIGF1ZGlvLnBsYXkoKTtcbiAgICAgIGhhbmRsZUZpbGVVcGxvYWQodG9rZW4sIGN1cnJlbnRNb2RlbCwgYmxvYiwgY29udGVudFR5cGUsIGZ1bmN0aW9uKHNvY2tldCkge1xuICAgICAgICB2YXIgcGFyc2VPcHRpb25zID0ge1xuICAgICAgICAgIGZpbGU6IGJsb2JcbiAgICAgICAgfTtcbiAgICAgICAgb25GaWxlUHJvZ3Jlc3MocGFyc2VPcHRpb25zLFxuICAgICAgICAgIC8vIE9uIGRhdGEgY2h1bmtcbiAgICAgICAgICBmdW5jdGlvbihjaHVuaykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ0hhbmRsaW5nIGNodW5rJywgY2h1bmspO1xuICAgICAgICAgICAgc29ja2V0LnNlbmQoY2h1bmspO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgLy8gT24gZmlsZSByZWFkIGVycm9yXG4gICAgICAgICAgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnRXJyb3IgcmVhZGluZyBmaWxlOiAnLCBldnQubWVzc2FnZSk7XG4gICAgICAgICAgICBzaG93RXJyb3IoZXZ0Lm1lc3NhZ2UpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgLy8gT24gbG9hZCBlbmRcbiAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHsnYWN0aW9uJzogJ3N0b3AnfSkpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sIFxuICAgICAgICAgIC8vIE9uIGNvbm5lY3Rpb24gZW5kXG4gICAgICAgICAgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICBlZmZlY3RzLnN0b3BUb2dnbGVJbWFnZSh0aW1lciwgaW1hZ2VUYWcsIGljb25OYW1lKTtcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgICAgIH1cbiAgICAgICk7XG4gICAgfTtcbiAgfTtcbiAgeGhyLnNlbmQoKTtcbn07XG5cblxuZXhwb3J0cy5pbml0UGxheVNhbXBsZSA9IGZ1bmN0aW9uKGN0eCkge1xuXG4gIChmdW5jdGlvbigpIHtcbiAgICB2YXIgZWwgPSAkKCcucGxheS1zYW1wbGUtMScpO1xuICAgIHZhciBpY29uTmFtZSA9ICdwbGF5JztcbiAgICB2YXIgaW1hZ2VUYWcgPSBlbC5maW5kKCdpbWcnKTtcbiAgICB2YXIgZmlsZU5hbWUgPSAnYXVkaW8vc2FtcGxlMS53YXYnO1xuICAgIGVsLmNsaWNrKCBmdW5jdGlvbihldnQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdDTElDSyEnKTtcbiAgICAgIHBsYXlTYW1wbGUoY3R4LnRva2VuLCBpbWFnZVRhZywgaWNvbk5hbWUsIGZpbGVOYW1lLCBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1BsYXkgc2FtcGxlIHJlc3VsdCcsIHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSkoY3R4KTtcblxuICAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIGVsID0gJCgnLnBsYXktc2FtcGxlLTInKTtcbiAgICB2YXIgaWNvbk5hbWUgPSAncGxheSc7XG4gICAgdmFyIGltYWdlVGFnID0gZWwuZmluZCgnaW1nJyk7XG4gICAgdmFyIGZpbGVOYW1lID0gJ2F1ZGlvL3NhbXBsZTIud2F2JztcbiAgICBlbC5jbGljayggZnVuY3Rpb24oZXZ0KSB7XG4gICAgICBjb25zb2xlLmxvZygnQ0xJQ0shJyk7XG4gICAgICBwbGF5U2FtcGxlKGN0eC50b2tlbiwgaW1hZ2VUYWcsIGljb25OYW1lLCBmaWxlTmFtZSwgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdQbGF5IHNhbXBsZSByZXN1bHQnLCByZXN1bHQpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pKGN0eCk7XG5cbn07XG5cbiIsIlxuZXhwb3J0cy5pbml0U2VsZWN0TW9kZWwgPSBmdW5jdGlvbihjdHgpIHtcblxuICBmdW5jdGlvbiBpc0RlZmF1bHQobW9kZWwpIHtcbiAgICByZXR1cm4gbW9kZWwgPT09ICdlbi1VU19Ccm9hZGJhbmRNb2RlbCc7XG4gIH1cblxuICBjdHgubW9kZWxzLmZvckVhY2goZnVuY3Rpb24obW9kZWwpIHtcbiAgICAkKFwic2VsZWN0I2Ryb3Bkb3duTWVudTFcIikuYXBwZW5kKCAkKFwiPG9wdGlvbj5cIilcbiAgICAgIC52YWwobW9kZWwubmFtZSlcbiAgICAgIC5odG1sKG1vZGVsLmRlc2NyaXB0aW9uKVxuICAgICAgLnByb3AoJ3NlbGVjdGVkJywgaXNEZWZhdWx0KG1vZGVsLm5hbWUpKVxuICAgICAgKTtcbiAgfSk7XG5cbiAgJChcInNlbGVjdCNkcm9wZG93bk1lbnUxXCIpLmNoYW5nZShmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgbW9kZWxOYW1lID0gJChcInNlbGVjdCNkcm9wZG93bk1lbnUxXCIpLnZhbCgpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50TW9kZWwnLCBtb2RlbE5hbWUpO1xuICB9KTtcblxufVxuIiwiXG4ndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuaW5pdFNlc3Npb25QZXJtaXNzaW9ucyA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnSW5pdGlhbGl6aW5nIHNlc3Npb24gcGVybWlzc2lvbnMgaGFuZGxlcicpO1xuICAvLyBSYWRpbyBidXR0b25zXG4gIHZhciBzZXNzaW9uUGVybWlzc2lvbnNSYWRpbyA9ICQoXCIjc2Vzc2lvblBlcm1pc3Npb25zUmFkaW9Hcm91cCBpbnB1dFt0eXBlPSdyYWRpbyddXCIpO1xuICBzZXNzaW9uUGVybWlzc2lvbnNSYWRpby5jbGljayhmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgY2hlY2tlZFZhbHVlID0gc2Vzc2lvblBlcm1pc3Npb25zUmFkaW8uZmlsdGVyKCc6Y2hlY2tlZCcpLnZhbCgpO1xuICAgIGNvbnNvbGUubG9nKCdjaGVja2VkVmFsdWUnLCBjaGVja2VkVmFsdWUpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzZXNzaW9uUGVybWlzc2lvbnMnLCBjaGVja2VkVmFsdWUpO1xuICB9KTtcbn1cbiIsIlxuXG5leHBvcnRzLnNob3dFcnJvciA9IGZ1bmN0aW9uKG1zZykge1xuICBjb25zb2xlLmxvZygnc2hvd2luZyBlcnJvcicpO1xuICB2YXIgZXJyb3JBbGVydCA9ICQoJy5lcnJvci1yb3cnKTtcbiAgZXJyb3JBbGVydC5oaWRlKCk7XG4gIHZhciBlcnJvck1lc3NhZ2UgPSAkKCcjZXJyb3JNZXNzYWdlJyk7XG4gIGVycm9yTWVzc2FnZS50ZXh0KG1zZyk7XG4gIGVycm9yQWxlcnQuc2hvdygpO1xuICAkKCcjZXJyb3JDbG9zZScpLmNsaWNrKGZ1bmN0aW9uKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXJyb3JBbGVydC5oaWRlKCk7XG4gIH0pO1xufVxuXG5leHBvcnRzLmhpZGVFcnJvciA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZXJyb3JBbGVydCA9ICQoJy5lcnJvci1yb3cnKTtcbiAgZXJyb3JBbGVydC5oaWRlKCk7XG59XG4iLCJcblxuZXhwb3J0cy5pbml0U2hvd1RhYiA9IGZ1bmN0aW9uKCkge1xuICAkKCcjbmF2LXRhYnMgYScpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAkKHRoaXMpLnRhYignc2hvdycpXG4gIH0pO1xufVxuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4vKmdsb2JhbCAkOmZhbHNlICovXG5cbid1c2Ugc3RyaWN0JztcblxuLy8gVE9ETzogcmVmYWN0b3IgdGhpcyBpbnRvIG11bHRpcGxlIHNtYWxsZXIgbW9kdWxlc1xuXG52YXIgTWljcm9waG9uZSA9IHJlcXVpcmUoJy4vTWljcm9waG9uZScpO1xudmFyIG1vZGVscyA9IHJlcXVpcmUoJy4vZGF0YS9tb2RlbHMuanNvbicpLm1vZGVscztcbnZhciBpbml0Vmlld3MgPSByZXF1aXJlKCcuL3ZpZXdzJykuaW5pdFZpZXdzO1xudmFyIHNob3dFcnJvciA9IHJlcXVpcmUoJy4vdmlld3Mvc2hvd2Vycm9yJykuc2hvd0Vycm9yO1xudmFyIGhpZGVFcnJvciA9IHJlcXVpcmUoJy4vdmlld3Mvc2hvd2Vycm9yJykuaGlkZUVycm9yO1xudmFyIGluaXRTb2NrZXQgPSByZXF1aXJlKCcuL3NvY2tldCcpLmluaXRTb2NrZXQ7XG52YXIgaGFuZGxlRmlsZVVwbG9hZCA9IHJlcXVpcmUoJy4vZmlsZXVwbG9hZCcpLmhhbmRsZUZpbGVVcGxvYWQ7XG52YXIgZGlzcGxheSA9IHJlcXVpcmUoJy4vdmlld3MvZGlzcGxheScpO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xudmFyIGVmZmVjdHMgPSByZXF1aXJlKCcuL3ZpZXdzL2VmZmVjdHMnKTtcbnZhciBwa2cgPSByZXF1aXJlKCcuLi9wYWNrYWdlJyk7XG5cbnZhciBCVUZGRVJTSVpFID0gODE5MjtcblxuJChkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKSB7XG5cblxuXG4gIC8vIFRlbXBvcmFyeSBhcHAgZGF0YVxuICAkKCcjYXBwU2V0dGluZ3MnKVxuICAgIC5odG1sKFxuICAgICAgJzxwPlZlcnNpb246ICcgKyBwa2cudmVyc2lvbiArICc8L3A+J1xuICAgICAgKyAnPHA+QnVmZmVyIFNpemU6ICcgKyBCVUZGRVJTSVpFICsgJzwvcD4nXG4gICAgKTtcblxuICAvLyBUZW1wb3JhcnkgdG9wLXNjb3BlIHZhcmlhYmxlXG4gIHZhciBtaWNTb2NrZXQ7XG5cbiAgZnVuY3Rpb24gaGFuZGxlTWljcm9waG9uZSh0b2tlbiwgbW9kZWwsIG1pYywgY2FsbGJhY2spIHtcblxuICAgIHZhciBjdXJyZW50TW9kZWwgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudE1vZGVsJyk7XG4gICAgaWYgKGN1cnJlbnRNb2RlbC5pbmRleE9mKCdOYXJyb3diYW5kJykgPiAtMSkge1xuICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignTWljcm9waG9uZSBjYW5ub3QgYWNjb21vZGF0ZSBuYXJyb3cgYmFuZCBtb2RlbHMsIHBsZWFzZSBzZWxlY3QgYW5vdGhlcicpO1xuICAgICAgY2FsbGJhY2soZXJyLCBudWxsKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAkLnB1Ymxpc2goJ2NsZWFyc2NyZWVuJyk7XG5cbiAgICAvLyBUZXN0IG91dCB3ZWJzb2NrZXRcbiAgICB2YXIgYmFzZVN0cmluZyA9ICcnO1xuICAgIHZhciBiYXNlSlNPTiA9ICcnO1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcbiAgICBvcHRpb25zLnRva2VuID0gdG9rZW47XG4gICAgb3B0aW9ucy5tZXNzYWdlID0ge1xuICAgICAgJ2FjdGlvbic6ICdzdGFydCcsXG4gICAgICAnY29udGVudC10eXBlJzogJ2F1ZGlvL2wxNjtyYXRlPTE2MDAwJyxcbiAgICAgICdpbnRlcmltX3Jlc3VsdHMnOiB0cnVlLFxuICAgICAgJ2NvbnRpbnVvdXMnOiB0cnVlLFxuICAgICAgJ3dvcmRfY29uZmlkZW5jZSc6IHRydWUsXG4gICAgICAndGltZXN0YW1wcyc6IHRydWUsXG4gICAgICAnbWF4X2FsdGVybmF0aXZlcyc6IDNcbiAgICB9O1xuICAgIG9wdGlvbnMubW9kZWwgPSBtb2RlbDtcblxuICAgIGZ1bmN0aW9uIG9uT3Blbihzb2NrZXQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdzb2NrZXQgb3BlbmVkJyk7XG4gICAgICBjYWxsYmFjayhudWxsLCBzb2NrZXQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uTGlzdGVuaW5nKHNvY2tldCkge1xuXG4gICAgICBtaWNTb2NrZXQgPSBzb2NrZXQ7XG5cbiAgICAgIG1pYy5vbkF1ZGlvID0gZnVuY3Rpb24oYmxvYikge1xuICAgICAgICBpZiAoc29ja2V0LnJlYWR5U3RhdGUgPCAyKSB7XG4gICAgICAgICAgc29ja2V0LnNlbmQoYmxvYilcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbk1lc3NhZ2UobXNnLCBzb2NrZXQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdNaWMgc29ja2V0IG1zZzogJywgbXNnKTtcbiAgICAgIGlmIChtc2cucmVzdWx0cykge1xuICAgICAgICAvLyBDb252ZXJ0IHRvIGNsb3N1cmUgYXBwcm9hY2hcbiAgICAgICAgYmFzZVN0cmluZyA9IGRpc3BsYXkuc2hvd1Jlc3VsdChtc2csIGJhc2VTdHJpbmcpO1xuICAgICAgICBiYXNlSlNPTiA9IGRpc3BsYXkuc2hvd0pTT04obXNnLCBiYXNlSlNPTik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25FcnJvcihyLCBzb2NrZXQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdNaWMgc29ja2V0IGVycjogJywgZXJyKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkNsb3NlKGV2dCkge1xuICAgICAgY29uc29sZS5sb2coJ01pYyBzb2NrZXQgY2xvc2U6ICcsIGV2dCk7XG4gICAgfVxuXG4gICAgaW5pdFNvY2tldChvcHRpb25zLCBvbk9wZW4sIG9uTGlzdGVuaW5nLCBvbk1lc3NhZ2UsIG9uRXJyb3IsIG9uQ2xvc2UpO1xuXG4gIH1cblxuICAvLyBNYWtlIGNhbGwgdG8gQVBJIHRvIHRyeSBhbmQgZ2V0IHRva2VuXG4gIHZhciB1cmwgPSAnL3Rva2VuJztcbiAgdmFyIHRva2VuUmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICB0b2tlblJlcXVlc3Qub3BlbihcIkdFVFwiLCB1cmwsIHRydWUpO1xuICB0b2tlblJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24oZXZ0KSB7XG5cblxuICAgIHZhciB0ZXN0RnVuY3Rpb24gPSAoZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY291bnQgPSA1O1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIGNvdW50LS07XG4gICAgICAgIHJldHVybiBjb3VudDtcbiAgICAgIH1cbiAgICB9KSgpO1xuXG4gICAgdGVzdEZ1bmN0aW9uKCk7XG4gICAgdGVzdEZ1bmN0aW9uKCk7XG4gICAgY29uc29sZS5sb2coJ1Jlc3VsdCBmb3IgdCgpJywgdGVzdEZ1bmN0aW9uKCkpO1xuXG4gICAgd2luZG93Lm9uYmVmb3JldW5sb2FkID0gZnVuY3Rpb24oZSkge1xuICAgICAgbG9jYWxTdG9yYWdlLmNsZWFyKCk7XG4gICAgfTtcblxuICAgIHZhciB0b2tlbiA9IHRva2VuUmVxdWVzdC5yZXNwb25zZVRleHQ7XG4gICAgY29uc29sZS5sb2coJ1Rva2VuICcsIGRlY29kZVVSSUNvbXBvbmVudCh0b2tlbikpO1xuXG4gICAgdmFyIG1pY09wdGlvbnMgPSB7XG4gICAgICBidWZmZXJTaXplOiBCVUZGRVJTSVpFXG4gICAgfTtcbiAgICB2YXIgbWljID0gbmV3IE1pY3JvcGhvbmUobWljT3B0aW9ucyk7XG5cbiAgICB2YXIgbW9kZWxPcHRpb25zID0ge1xuICAgICAgdG9rZW46IHRva2VuXG4gICAgICAgIC8vIFVuY29tbWVudCBpbiBjYXNlIG9mIHNlcnZlciBDT1JTIGZhaWx1cmVcbiAgICAgICAgLy8gdXJsOiAnL2FwaS9tb2RlbHMnXG4gICAgfTtcblxuICAgIC8vIEdldCBhdmFpbGFibGUgc3BlZWNoIHJlY29nbml0aW9uIG1vZGVsc1xuICAgIC8vIFNldCB0aGVtIGluIHN0b3JhZ2VcbiAgICAvLyBBbmQgZGlzcGxheSB0aGVtIGluIGRyb3AtZG93blxuICAgIGNvbnNvbGUubG9nKCdTVFQgTW9kZWxzICcsIG1vZGVscyk7XG5cbiAgICAvLyBTYXZlIG1vZGVscyB0byBsb2NhbHN0b3JhZ2VcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbW9kZWxzJywgSlNPTi5zdHJpbmdpZnkobW9kZWxzKSk7XG5cbiAgICAvLyBTZXQgZGVmYXVsdCBjdXJyZW50IG1vZGVsXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRNb2RlbCcsICdlbi1VU19Ccm9hZGJhbmRNb2RlbCcpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzZXNzaW9uUGVybWlzc2lvbnMnLCAndHJ1ZScpO1xuXG5cbiAgICAvLyBJTklUSUFMSVpBVElPTlxuICAgIC8vIFNlbmQgbW9kZWxzIGFuZCBvdGhlclxuICAgIC8vIHZpZXcgY29udGV4dCB0byB2aWV3c1xuICAgIHZhciB2aWV3Q29udGV4dCA9IHtcbiAgICAgIG1vZGVsczogbW9kZWxzLFxuICAgICAgdG9rZW46IHRva2VuXG4gICAgfTtcbiAgICBpbml0Vmlld3Modmlld0NvbnRleHQpO1xuICAgIHV0aWxzLmluaXRQdWJTdWIoKTtcblxuICAgICQuc3Vic2NyaWJlKCdjbGVhcnNjcmVlbicsIGZ1bmN0aW9uKCkge1xuICAgICAgJCgnI3Jlc3VsdHNUZXh0JykudGV4dCgnJyk7XG4gICAgICAkKCcjcmVzdWx0c0pTT04nKS50ZXh0KCcnKTtcbiAgICAgICQoJy5oeXBvdGhlc2VzID4gdWwnKS5lbXB0eSgpO1xuICAgICAgJCgnI21ldGFkYXRhVGFibGVCb2R5JykuZW1wdHkoKTtcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGhhbmRsZVNlbGVjdGVkRmlsZShmaWxlKSB7XG5cbiAgICAgIHZhciBjdXJyZW50bHlEaXNwbGF5aW5nID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycpKTtcbiAgICAgIFxuICAgICAgaWYgKGN1cnJlbnRseURpc3BsYXlpbmcpIHtcbiAgICAgICAgc2hvd0Vycm9yKCdUcmFuc2NyaXB0aW9uIHVuZGVyd2F5LCBwbGVhc2UgY2xpY2sgc3RvcCBvciB3YWl0IHVudGlsIGZpbmlzaGVkIHRvIHVwbG9hZCBhbm90aGVyIGZpbGUnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAkLnB1Ymxpc2goJ2NsZWFyc2NyZWVuJyk7XG5cbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgdHJ1ZSk7XG4gICAgICBoaWRlRXJyb3IoKTtcblxuICAgICAgLy8gVmlzdWFsIGVmZmVjdHNcbiAgICAgIHZhciB1cGxvYWRJbWFnZVRhZyA9ICQoJyNmaWxlVXBsb2FkVGFyZ2V0ID4gaW1nJyk7XG4gICAgICB2YXIgdGltZXIgPSBzZXRJbnRlcnZhbChlZmZlY3RzLnRvZ2dsZUltYWdlLCA3NTAsIHVwbG9hZEltYWdlVGFnLCAnc3RvcCcpO1xuICAgICAgdmFyIHVwbG9hZFRleHQgPSAkKCcjZmlsZVVwbG9hZFRhcmdldCA+IHNwYW4nKTtcbiAgICAgIHVwbG9hZFRleHQudGV4dCgnU3RvcCBUcmFuc2NyaWJpbmcnKTtcblxuICAgICAgZnVuY3Rpb24gcmVzdG9yZVVwbG9hZFRhYigpIHtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGltZXIpO1xuICAgICAgICBlZmZlY3RzLnJlc3RvcmVJbWFnZSh1cGxvYWRJbWFnZVRhZywgJ3VwbG9hZCcpO1xuICAgICAgICB1cGxvYWRUZXh0LnRleHQoJ1NlbGVjdCBGaWxlJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIENsZWFyIGZsYXNoaW5nIGlmIHNvY2tldCB1cGxvYWQgaXMgc3RvcHBlZFxuICAgICAgJC5zdWJzY3JpYmUoJ3N0b3Bzb2NrZXQnLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIHJlc3RvcmVVcGxvYWRUYWIoKTtcbiAgICAgIH0pO1xuXG5cbiAgICAgIC8vIEdldCBjdXJyZW50IG1vZGVsXG4gICAgICB2YXIgY3VycmVudE1vZGVsID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRNb2RlbCcpO1xuICAgICAgY29uc29sZS5sb2coJ2N1cnJlbnRNb2RlbCcsIGN1cnJlbnRNb2RlbCk7XG5cbiAgICAgIC8vIFJlYWQgZmlyc3QgNCBieXRlcyB0byBkZXRlcm1pbmUgaGVhZGVyXG4gICAgICB2YXIgYmxvYlRvVGV4dCA9IG5ldyBCbG9iKFtmaWxlXSkuc2xpY2UoMCwgNCk7XG4gICAgICB2YXIgciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICByLnJlYWRBc1RleHQoYmxvYlRvVGV4dCk7XG4gICAgICByLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgY29udGVudFR5cGU7XG4gICAgICAgIGlmIChyLnJlc3VsdCA9PT0gJ2ZMYUMnKSB7XG4gICAgICAgICBjb250ZW50VHlwZSA9ICdhdWRpby9mbGFjJztcbiAgICAgICAgfSBlbHNlIGlmIChyLnJlc3VsdCA9PT0gJ1JJRkYnKSB7XG4gICAgICAgICBjb250ZW50VHlwZSA9ICdhdWRpby93YXYnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3RvcmVVcGxvYWRUYWIoKTtcbiAgICAgICAgICBzaG93RXJyb3IoJ09ubHkgV0FWIG9yIEZMQUMgZmlsZXMgY2FuIGJlIHRyYW5zY3JpYmVkLCBwbGVhc2UgdHJ5IGFub3RoZXIgZmlsZSBmb3JtYXQnKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS5sb2coJ1VwbG9hZGluZyBmaWxlJywgci5yZXN1bHQpO1xuICAgICAgICBoYW5kbGVGaWxlVXBsb2FkKHRva2VuLCBjdXJyZW50TW9kZWwsIGZpbGUsIGNvbnRlbnRUeXBlLCBmdW5jdGlvbihzb2NrZXQpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygncmVhZGluZyBmaWxlJyk7XG5cbiAgICAgICAgICAgIHZhciBibG9iID0gbmV3IEJsb2IoW2ZpbGVdKTtcbiAgICAgICAgICAgIHZhciBwYXJzZU9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgIGZpbGU6IGJsb2JcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB1dGlscy5vbkZpbGVQcm9ncmVzcyhwYXJzZU9wdGlvbnMsXG4gICAgICAgICAgICAgIC8vIE9uIGRhdGEgY2h1bmtcbiAgICAgICAgICAgICAgICBmdW5jdGlvbihjaHVuaykge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdIYW5kbGluZyBjaHVuaycsIGNodW5rKTtcbiAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChjaHVuayk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIC8vIE9uIGZpbGUgcmVhZCBlcnJvclxuICAgICAgICAgICAgICBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnRXJyb3IgcmVhZGluZyBmaWxlOiAnLCBldnQubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgc2hvd0Vycm9yKGV2dC5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgLy8gT24gbG9hZCBlbmRcbiAgICAgICAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoeydhY3Rpb24nOiAnc3RvcCd9KSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgXG4gICAgICAgICAgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICBlZmZlY3RzLnN0b3BUb2dnbGVJbWFnZSh0aW1lciwgdXBsb2FkSW1hZ2VUYWcsICd1cGxvYWQnKTtcbiAgICAgICAgICAgIHVwbG9hZFRleHQudGV4dCgnU2VsZWN0IEZpbGUnKTtcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ3NldHRpbmcgdGFyZ2V0Jyk7XG5cbiAgICB2YXIgZHJhZ0FuZERyb3BUYXJnZXQgPSAkKGRvY3VtZW50KTtcbiAgICBkcmFnQW5kRHJvcFRhcmdldC5vbignZHJhZ2VudGVyJywgZnVuY3Rpb24gKGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdkcmFnZW50ZXInKTtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfSk7XG5cbiAgICBkcmFnQW5kRHJvcFRhcmdldC5vbignZHJhZ292ZXInLCBmdW5jdGlvbiAoZSkge1xuICAgICAgY29uc29sZS5sb2coJ2RyYWdvdmVyJyk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH0pO1xuXG4gICAgZHJhZ0FuZERyb3BUYXJnZXQub24oJ2Ryb3AnLCBmdW5jdGlvbiAoZSkge1xuICAgICAgY29uc29sZS5sb2coJ0ZpbGUgZHJvcHBlZCcpO1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgdmFyIGV2dCA9IGUub3JpZ2luYWxFdmVudDtcbiAgICAgIC8vIEhhbmRsZSBkcmFnZ2VkIGZpbGUgZXZlbnRcbiAgICAgIGhhbmRsZUZpbGVVcGxvYWRFdmVudChldnQpO1xuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gaGFuZGxlRmlsZVVwbG9hZEV2ZW50KGV2dCkge1xuICAgICAgY29uc29sZS5sb2coJ2hhbmRsaW5nIGZpbGUgZHJvcCBldmVudCcpO1xuICAgICAgLy8gSW5pdCBmaWxlIHVwbG9hZCB3aXRoIGRlZmF1bHQgbW9kZWxcbiAgICAgIHZhciBmaWxlID0gZXZ0LmRhdGFUcmFuc2Zlci5maWxlc1swXTtcbiAgICAgIGhhbmRsZVNlbGVjdGVkRmlsZShmaWxlKTtcbiAgICB9XG5cbiAgICB2YXIgZmlsZVVwbG9hZERpYWxvZyA9ICQoXCIjZmlsZVVwbG9hZERpYWxvZ1wiKTtcblxuICAgIGZpbGVVcGxvYWREaWFsb2cuY2hhbmdlKGZ1bmN0aW9uKGV2dCkge1xuICAgICAgdmFyIGZpbGUgPSBmaWxlVXBsb2FkRGlhbG9nLmdldCgwKS5maWxlc1swXTtcbiAgICAgIGNvbnNvbGUubG9nKCdmaWxlIHVwbG9hZCEnLCBmaWxlKTtcbiAgICAgIGhhbmRsZVNlbGVjdGVkRmlsZShmaWxlKTtcbiAgICB9KTtcblxuICAgICQoXCIjZmlsZVVwbG9hZFRhcmdldFwiKS5jbGljayhmdW5jdGlvbihldnQpIHtcbiAgICAgIHZhciBjdXJyZW50bHlEaXNwbGF5aW5nID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycpKTtcbiAgICAgIGNvbnNvbGUubG9nKCdDVVJSRU5UTFkgRElTUExBWUlORycsIGN1cnJlbnRseURpc3BsYXlpbmcpO1xuICAgICAgaWYgKGN1cnJlbnRseURpc3BsYXlpbmcpIHtcbiAgICAgICAgJC5wdWJsaXNoKCdzdG9wc29ja2V0Jyk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGZpbGVVcGxvYWREaWFsb2cudmFsKG51bGwpO1xuXG4gICAgICBmaWxlVXBsb2FkRGlhbG9nXG4gICAgICAudHJpZ2dlcignY2xpY2snKTtcblxuICAgIH0pO1xuXG5cbiAgICAvLyBTZXQgbWljcm9waG9uZSBzdGF0ZSB0byBub3QgcnVubmluZ1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdydW5uaW5nJywgZmFsc2UpO1xuXG4gICAgdmFyIHJlY29yZEJ1dHRvbiA9ICQoJyNyZWNvcmRCdXR0b24nKTtcbiAgICByZWNvcmRCdXR0b24uY2xpY2soJC5wcm94eShmdW5jdGlvbihldnQpIHtcblxuICAgICAgLy8gUHJldmVudCBkZWZhdWx0IGFuY2hvciBiZWhhdmlvclxuICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgIHZhciBydW5uaW5nID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgncnVubmluZycpKTtcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdydW5uaW5nJywgIXJ1bm5pbmcpO1xuXG4gICAgICBjb25zb2xlLmxvZygnY2xpY2shJyk7XG5cbiAgICAgIHZhciBjdXJyZW50TW9kZWwgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudE1vZGVsJyk7XG5cbiAgICAgIGNvbnNvbGUubG9nKCdydW5uaW5nIHN0YXRlJywgcnVubmluZyk7XG5cbiAgICAgIGlmICghcnVubmluZykge1xuICAgICAgICBjb25zb2xlLmxvZygnTm90IHJ1bm5pbmcsIGhhbmRsZU1pY3JvcGhvbmUoKScpO1xuICAgICAgICBoYW5kbGVNaWNyb3Bob25lKHRva2VuLCBjdXJyZW50TW9kZWwsIG1pYywgZnVuY3Rpb24oZXJyLCBzb2NrZXQpIHtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICB2YXIgbXNnID0gZXJyLm1lc3NhZ2U7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnRXJyb3I6ICcsIG1zZyk7XG4gICAgICAgICAgICBzaG93RXJyb3IobXNnKTtcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdydW5uaW5nJywgZmFsc2UpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWNvcmRCdXR0b24uY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJyNkNzQxMDgnKTtcbiAgICAgICAgICAgIHJlY29yZEJ1dHRvbi5maW5kKCdpbWcnKS5hdHRyKCdzcmMnLCAnaW1nL3N0b3Auc3ZnJyk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnc3RhcnRpbmcgbWljJyk7XG4gICAgICAgICAgICBtaWMucmVjb3JkKCk7XG4gICAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgncnVubmluZycsIHRydWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZygnU3RvcHBpbmcgbWljcm9waG9uZSwgc2VuZGluZyBzdG9wIGFjdGlvbiBtZXNzYWdlJyk7XG4gICAgICAgIHJlY29yZEJ1dHRvbi5yZW1vdmVBdHRyKCdzdHlsZScpO1xuICAgICAgICByZWNvcmRCdXR0b24uZmluZCgnaW1nJykuYXR0cignc3JjJywgJ2ltZy9taWNyb3Bob25lLnN2ZycpO1xuICAgICAgICBtaWNTb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7J2FjdGlvbic6ICdzdG9wJ30pKTtcbiAgICAgICAgLy8gQ2FuIGFsc28gc2VuZCBlbXB0eSBidWZmZXIgdG8gc2lnbmFsIGVuZFxuICAgICAgICAvLyB2YXIgZW1wdHlCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoMCk7XG4gICAgICAgIC8vIG1pY1NvY2tldC5zZW5kKGVtcHR5QnVmZmVyKTtcbiAgICAgICAgbWljLnN0b3AoKTtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3J1bm5pbmcnLCBmYWxzZSk7XG4gICAgICB9XG5cblxuICAgIH0sIHRoaXMpKTtcbiAgfVxuICB0b2tlblJlcXVlc3Quc2VuZCgpO1xuXG59KTtcblxuIl19
