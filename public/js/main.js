(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports={
  "name": "SpeechToTextBrowserStarterApp",
  "version": "0.0.4",
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
var initSocket = exports.initSocket = function(options, onopen, onlistening, onmessage, onerror, onclose) {
  var listening = false;
  function withDefault(val, defaultVal) {
    return typeof val === 'undefined' ? defaultVal : val;
  }
  var socket;
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
      console.log('Connect attempt token: ', token);
      utils.getToken(function(token) {
        console.log('got token', token);
        options.token = token;
        initSocket(options, onopen, onlistening, onmessage, onerror);
        return false;
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

exports.getToken = function(callback) {
  // Make call to API to try and get token
  var url = '/token';
  var tokenRequest = new XMLHttpRequest();
  tokenRequest.open("GET", url, true);
  tokenRequest.onload = function(evt) {
    var token = tokenRequest.responseText;
    callback(token);
  };
  tokenRequest.send();
}

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
  $('#metadataTable > tbody').html();
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
    el.attr("src", 'img/' + name + '-red.svg');
  } else {
    el.attr('src', 'img/' + name + '.svg');
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

      localStorage.getItem('currentlyDisplaying', true);
      hideError();

      // Visual effects
      var uploadImageTag = $('#fileUploadTarget > img');
      var timer = setInterval(effects.toggleImage, 750, uploadImageTag, 'stop');
      var uploadText = $('#fileUploadTarget > span');
      uploadText.text('Stop Transcribing');

      // Clear flashing if socket upload is stopped
      $.subscribe('stopsocket', function(data) {
        clearInterval(timer);
        effects.restoreImage(uploadImageTag, 'upload');
        localStorage.getItem('currentlyDisplaying', false);
        uploadText.text('Select File');
      });


      // Get current model
      var currentModel = localStorage.getItem('currentModel');
      console.log('currentModel', currentModel);

      // Read first 4 bytes to determine header
      var blobToText = new Blob([file]).slice(0, 4);
      var r = new FileReader();
      r.readAsText(blobToText);
      r.onload = function() {
        var contentType = r.result === 'fLaC' ? 'audio/flac' : 'audio/wav';
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5ucG0vbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwicGFja2FnZS5qc29uIiwic3JjL01pY3JvcGhvbmUuanMiLCJzcmMvZGF0YS9tb2RlbHMuanNvbiIsInNyYy9maWxldXBsb2FkLmpzIiwic3JjL3NvY2tldC5qcyIsInNyYy91dGlscy5qcyIsInNyYy92aWV3cy9hbmltYXRlcGFuZWwuanMiLCJzcmMvdmlld3MvZGlzcGxheS5qcyIsInNyYy92aWV3cy9lZmZlY3RzLmpzIiwic3JjL3ZpZXdzL2luZGV4LmpzIiwic3JjL3ZpZXdzL3BsYXlzYW1wbGUuanMiLCJzcmMvdmlld3Mvc2VsZWN0bW9kZWwuanMiLCJzcmMvdmlld3Mvc2Vzc2lvbnBlcm1pc3Npb25zLmpzIiwic3JjL3ZpZXdzL3Nob3dlcnJvci5qcyIsInNyYy92aWV3cy9zaG93dGFiLmpzIiwic3JjL2luZGV4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMxR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHM9e1xuICBcIm5hbWVcIjogXCJTcGVlY2hUb1RleHRCcm93c2VyU3RhcnRlckFwcFwiLFxuICBcInZlcnNpb25cIjogXCIwLjAuNFwiLFxuICBcImRlc2NyaXB0aW9uXCI6IFwiQSBzYW1wbGUgYnJvd3NlciBhcHAgZm9yIEJsdWVtaXggdGhhdCB1c2UgdGhlIHNwZWVjaC10by10ZXh0IHNlcnZpY2UsIGZldGNoaW5nIGEgdG9rZW4gdmlhIE5vZGUuanNcIixcbiAgXCJkZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiYm9keS1wYXJzZXJcIjogXCJ+MS4xMC4yXCIsXG4gICAgXCJjb25uZWN0XCI6IFwiXjMuMy41XCIsXG4gICAgXCJlcnJvcmhhbmRsZXJcIjogXCJ+MS4yLjRcIixcbiAgICBcImV4cHJlc3NcIjogXCJ+NC4xMC44XCIsXG4gICAgXCJoYXJtb25cIjogXCJeMS4zLjFcIixcbiAgICBcImh0dHAtcHJveHlcIjogXCJeMS4xMS4xXCIsXG4gICAgXCJyZXF1ZXN0XCI6IFwifjIuNTMuMFwiLFxuICAgIFwidHJhbnNmb3JtZXItcHJveHlcIjogXCJeMC4zLjFcIlxuICB9LFxuICBcImVuZ2luZXNcIjoge1xuICAgIFwibm9kZVwiOiBcIj49MC4xMFwiXG4gIH0sXG4gIFwicmVwb3NpdG9yeVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiZ2l0XCIsXG4gICAgXCJ1cmxcIjogXCJodHRwczovL2dpdGh1Yi5jb20vd2F0c29uLWRldmVsb3Blci1jbG91ZC9zcGVlY2gtdG8tdGV4dC1icm93c2VyLmdpdFwiXG4gIH0sXG4gIFwiYXV0aG9yXCI6IFwiSUJNIENvcnAuXCIsXG4gIFwiYnJvd3NlcmlmeS1zaGltXCI6IHtcbiAgICBcImpxdWVyeVwiOiBcImdsb2JhbDpqUXVlcnlcIlxuICB9LFxuICBcImJyb3dzZXJpZnlcIjoge1xuICAgIFwidHJhbnNmb3JtXCI6IFtcbiAgICAgIFwiYnJvd3NlcmlmeS1zaGltXCJcbiAgICBdXG4gIH0sXG4gIFwiY29udHJpYnV0b3JzXCI6IFtcbiAgICB7XG4gICAgICBcIm5hbWVcIjogXCJHZXJtYW4gQXR0YW5hc2lvIFJ1aXpcIixcbiAgICAgIFwiZW1haWxcIjogXCJnZXJtYW5hdHRAdXMuaWJtLmNvbVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcIm5hbWVcIjogXCJEYW5pZWwgQm9sYW5vXCIsXG4gICAgICBcImVtYWlsXCI6IFwiZGJvbGFub0B1cy5pYm0uY29tXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwibmFtZVwiOiBcIkJyaXRhbnkgTC4gUG9udmVsbGVcIixcbiAgICAgIFwiZW1haWxcIjogXCJibHBvbnZlbGxlQHVzLmlibS5jb21cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJuYW1lXCI6IFwiRXJpYyBTLiBCdWxsaW5ndG9uXCIsXG4gICAgICBcImVtYWlsXCI6IFwiZXNidWxsaW5AdXMuaWJtLmNvbVwiXG4gICAgfVxuICBdLFxuICBcImxpY2Vuc2VcIjogXCJBcGFjaGUtMi4wXCIsXG4gIFwiYnVnc1wiOiB7XG4gICAgXCJ1cmxcIjogXCJodHRwczovL2dpdGh1Yi5jb20vd2F0c29uLWRldmVsb3Blci1jbG91ZC9zcGVlY2gtdG8tdGV4dC1icm93c2VyL2lzc3Vlc1wiXG4gIH0sXG4gIFwic2NyaXB0c1wiOiB7XG4gICAgXCJzdGFydFwiOiBcIm5vZGUgYXBwLmpzXCIsXG4gICAgXCJidWlsZFwiOiBcImJyb3dzZXJpZnkgLW8gcHVibGljL2pzL21haW4uanMgc3JjL2luZGV4LmpzXCIsXG4gICAgXCJ3YXRjaFwiOiBcIndhdGNoaWZ5IC1kIC1vIHB1YmxpYy9qcy9tYWluLmpzIHNyYy9pbmRleC5qc1wiXG4gIH0sXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcImJyb3dzZXJpZnlcIjogXCJeMTAuMi40XCIsXG4gICAgXCJicm93c2VyaWZ5LXNoaW1cIjogXCJeMy44LjlcIlxuICB9XG59XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDE0IElCTSBDb3JwLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSAnTGljZW5zZScpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiAnQVMgSVMnIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbi8qKlxuICogQ2FwdHVyZXMgbWljcm9waG9uZSBpbnB1dCBmcm9tIHRoZSBicm93c2VyLlxuICogV29ya3MgYXQgbGVhc3Qgb24gbGF0ZXN0IHZlcnNpb25zIG9mIEZpcmVmb3ggYW5kIENocm9tZVxuICovXG5mdW5jdGlvbiBNaWNyb3Bob25lKF9vcHRpb25zKSB7XG4gIHZhciBvcHRpb25zID0gX29wdGlvbnMgfHwge307XG5cbiAgLy8gd2UgcmVjb3JkIGluIG1vbm8gYmVjYXVzZSB0aGUgc3BlZWNoIHJlY29nbml0aW9uIHNlcnZpY2VcbiAgLy8gZG9lcyBub3Qgc3VwcG9ydCBzdGVyZW8uXG4gIHRoaXMuYnVmZmVyU2l6ZSA9IG9wdGlvbnMuYnVmZmVyU2l6ZSB8fCA4MTkyO1xuICB0aGlzLmlucHV0Q2hhbm5lbHMgPSBvcHRpb25zLmlucHV0Q2hhbm5lbHMgfHwgMTtcbiAgdGhpcy5vdXRwdXRDaGFubmVscyA9IG9wdGlvbnMub3V0cHV0Q2hhbm5lbHMgfHwgMTtcbiAgdGhpcy5yZWNvcmRpbmcgPSBmYWxzZTtcbiAgdGhpcy5yZXF1ZXN0ZWRBY2Nlc3MgPSBmYWxzZTtcbiAgdGhpcy5zYW1wbGVSYXRlID0gMTYwMDA7XG4gIC8vIGF1eGlsaWFyIGJ1ZmZlciB0byBrZWVwIHVudXNlZCBzYW1wbGVzICh1c2VkIHdoZW4gZG9pbmcgZG93bnNhbXBsaW5nKVxuICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXMgPSBuZXcgRmxvYXQzMkFycmF5KDApO1xuXG4gIC8vIENocm9tZSBvciBGaXJlZm94IG9yIElFIFVzZXIgbWVkaWFcbiAgaWYgKCFuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKSB7XG4gICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSA9IG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEgfHxcbiAgICBuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tc0dldFVzZXJNZWRpYTtcbiAgfVxuXG59XG5cbi8qKlxuICogQ2FsbGVkIHdoZW4gdGhlIHVzZXIgcmVqZWN0IHRoZSB1c2Ugb2YgdGhlIG1pY2hyb3Bob25lXG4gKiBAcGFyYW0gIGVycm9yIFRoZSBlcnJvclxuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5vblBlcm1pc3Npb25SZWplY3RlZCA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnTWljcm9waG9uZS5vblBlcm1pc3Npb25SZWplY3RlZCgpJyk7XG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gZmFsc2U7XG4gIHRoaXMub25FcnJvcignUGVybWlzc2lvbiB0byBhY2Nlc3MgdGhlIG1pY3JvcGhvbmUgcmVqZXRlZC4nKTtcbn07XG5cbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uRXJyb3IgPSBmdW5jdGlvbihlcnJvcikge1xuICBjb25zb2xlLmxvZygnTWljcm9waG9uZS5vbkVycm9yKCk6JywgZXJyb3IpO1xufTtcblxuLyoqXG4gKiBDYWxsZWQgd2hlbiB0aGUgdXNlciBhdXRob3JpemVzIHRoZSB1c2Ugb2YgdGhlIG1pY3JvcGhvbmUuXG4gKiBAcGFyYW0gIHtPYmplY3R9IHN0cmVhbSBUaGUgU3RyZWFtIHRvIGNvbm5lY3QgdG9cbiAqXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uTWVkaWFTdHJlYW0gPSAgZnVuY3Rpb24oc3RyZWFtKSB7XG4gIHZhciBBdWRpb0N0eCA9IHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dDtcblxuICBpZiAoIUF1ZGlvQ3R4KVxuICAgIHRocm93IG5ldyBFcnJvcignQXVkaW9Db250ZXh0IG5vdCBhdmFpbGFibGUnKTtcblxuICBpZiAoIXRoaXMuYXVkaW9Db250ZXh0KVxuICAgIHRoaXMuYXVkaW9Db250ZXh0ID0gbmV3IEF1ZGlvQ3R4KCk7XG5cbiAgdmFyIGdhaW4gPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gIHZhciBhdWRpb0lucHV0ID0gdGhpcy5hdWRpb0NvbnRleHQuY3JlYXRlTWVkaWFTdHJlYW1Tb3VyY2Uoc3RyZWFtKTtcblxuICBhdWRpb0lucHV0LmNvbm5lY3QoZ2Fpbik7XG5cbiAgdGhpcy5taWMgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IodGhpcy5idWZmZXJTaXplLFxuICAgIHRoaXMuaW5wdXRDaGFubmVscywgdGhpcy5vdXRwdXRDaGFubmVscyk7XG5cbiAgLy8gdW5jb21tZW50IHRoZSBmb2xsb3dpbmcgbGluZSBpZiB5b3Ugd2FudCB0byB1c2UgeW91ciBtaWNyb3Bob25lIHNhbXBsZSByYXRlXG4gIC8vdGhpcy5zYW1wbGVSYXRlID0gdGhpcy5hdWRpb0NvbnRleHQuc2FtcGxlUmF0ZTtcbiAgY29uc29sZS5sb2coJ01pY3JvcGhvbmUub25NZWRpYVN0cmVhbSgpOiBzYW1wbGluZyByYXRlIGlzOicsIHRoaXMuc2FtcGxlUmF0ZSk7XG5cbiAgdGhpcy5taWMub25hdWRpb3Byb2Nlc3MgPSB0aGlzLl9vbmF1ZGlvcHJvY2Vzcy5iaW5kKHRoaXMpO1xuICB0aGlzLnN0cmVhbSA9IHN0cmVhbTtcblxuICBnYWluLmNvbm5lY3QodGhpcy5taWMpO1xuICB0aGlzLm1pYy5jb25uZWN0KHRoaXMuYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgdGhpcy5yZWNvcmRpbmcgPSB0cnVlO1xuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IGZhbHNlO1xuICB0aGlzLm9uU3RhcnRSZWNvcmRpbmcoKTtcbn07XG5cbi8qKlxuICogY2FsbGJhY2sgdGhhdCBpcyBiZWluZyB1c2VkIGJ5IHRoZSBtaWNyb3Bob25lXG4gKiB0byBzZW5kIGF1ZGlvIGNodW5rcy5cbiAqIEBwYXJhbSAge29iamVjdH0gZGF0YSBhdWRpb1xuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5fb25hdWRpb3Byb2Nlc3MgPSBmdW5jdGlvbihkYXRhKSB7XG4gIGlmICghdGhpcy5yZWNvcmRpbmcpIHtcbiAgICAvLyBXZSBzcGVhayBidXQgd2UgYXJlIG5vdCByZWNvcmRpbmdcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBTaW5nbGUgY2hhbm5lbFxuICB2YXIgY2hhbiA9IGRhdGEuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCk7XG5cbiAgdGhpcy5vbkF1ZGlvKHRoaXMuX2V4cG9ydERhdGFCdWZmZXJUbzE2S2h6KG5ldyBGbG9hdDMyQXJyYXkoY2hhbikpKTtcblxuICAvL2V4cG9ydCB3aXRoIG1pY3JvcGhvbmUgbWh6LCByZW1lbWJlciB0byB1cGRhdGUgdGhlIHRoaXMuc2FtcGxlUmF0ZVxuICAvLyB3aXRoIHRoZSBzYW1wbGUgcmF0ZSBmcm9tIHlvdXIgbWljcm9waG9uZVxuICAvLyB0aGlzLm9uQXVkaW8odGhpcy5fZXhwb3J0RGF0YUJ1ZmZlcihuZXcgRmxvYXQzMkFycmF5KGNoYW4pKSk7XG5cbn07XG5cbi8qKlxuICogU3RhcnQgdGhlIGF1ZGlvIHJlY29yZGluZ1xuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5yZWNvcmQgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCFuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKXtcbiAgICB0aGlzLm9uRXJyb3IoJ0Jyb3dzZXIgZG9lc25cXCd0IHN1cHBvcnQgbWljcm9waG9uZSBpbnB1dCcpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAodGhpcy5yZXF1ZXN0ZWRBY2Nlc3MpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IHRydWU7XG4gIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEoeyBhdWRpbzogdHJ1ZSB9LFxuICAgIHRoaXMub25NZWRpYVN0cmVhbS5iaW5kKHRoaXMpLCAvLyBNaWNyb3Bob25lIHBlcm1pc3Npb24gZ3JhbnRlZFxuICAgIHRoaXMub25QZXJtaXNzaW9uUmVqZWN0ZWQuYmluZCh0aGlzKSk7IC8vIE1pY3JvcGhvbmUgcGVybWlzc2lvbiByZWplY3RlZFxufTtcblxuLyoqXG4gKiBTdG9wIHRoZSBhdWRpbyByZWNvcmRpbmdcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMucmVjb3JkaW5nKVxuICAgIHJldHVybjtcbiAgdGhpcy5yZWNvcmRpbmcgPSBmYWxzZTtcbiAgdGhpcy5zdHJlYW0uc3RvcCgpO1xuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IGZhbHNlO1xuICB0aGlzLm1pYy5kaXNjb25uZWN0KDApO1xuICB0aGlzLm1pYyA9IG51bGw7XG4gIHRoaXMub25TdG9wUmVjb3JkaW5nKCk7XG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYSBCbG9iIHR5cGU6ICdhdWRpby9sMTYnIHdpdGggdGhlIGNodW5rIGFuZCBkb3duc2FtcGxpbmcgdG8gMTYga0h6XG4gKiBjb21pbmcgZnJvbSB0aGUgbWljcm9waG9uZS5cbiAqIEV4cGxhbmF0aW9uIGZvciB0aGUgbWF0aDogVGhlIHJhdyB2YWx1ZXMgY2FwdHVyZWQgZnJvbSB0aGUgV2ViIEF1ZGlvIEFQSSBhcmVcbiAqIGluIDMyLWJpdCBGbG9hdGluZyBQb2ludCwgYmV0d2VlbiAtMSBhbmQgMSAocGVyIHRoZSBzcGVjaWZpY2F0aW9uKS5cbiAqIFRoZSB2YWx1ZXMgZm9yIDE2LWJpdCBQQ00gcmFuZ2UgYmV0d2VlbiAtMzI3NjggYW5kICszMjc2NyAoMTYtYml0IHNpZ25lZCBpbnRlZ2VyKS5cbiAqIE11bHRpcGx5IHRvIGNvbnRyb2wgdGhlIHZvbHVtZSBvZiB0aGUgb3V0cHV0LiBXZSBzdG9yZSBpbiBsaXR0bGUgZW5kaWFuLlxuICogQHBhcmFtICB7T2JqZWN0fSBidWZmZXIgTWljcm9waG9uZSBhdWRpbyBjaHVua1xuICogQHJldHVybiB7QmxvYn0gJ2F1ZGlvL2wxNicgY2h1bmtcbiAqIEBkZXByZWNhdGVkIFRoaXMgbWV0aG9kIGlzIGRlcHJhY2F0ZWRcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUuX2V4cG9ydERhdGFCdWZmZXJUbzE2S2h6ID0gZnVuY3Rpb24oYnVmZmVyTmV3U2FtcGxlcykge1xuICB2YXIgYnVmZmVyID0gbnVsbCxcbiAgICBuZXdTYW1wbGVzID0gYnVmZmVyTmV3U2FtcGxlcy5sZW5ndGgsXG4gICAgdW51c2VkU2FtcGxlcyA9IHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlcy5sZW5ndGg7XG5cbiAgaWYgKHVudXNlZFNhbXBsZXMgPiAwKSB7XG4gICAgYnVmZmVyID0gbmV3IEZsb2F0MzJBcnJheSh1bnVzZWRTYW1wbGVzICsgbmV3U2FtcGxlcyk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bnVzZWRTYW1wbGVzOyArK2kpIHtcbiAgICAgIGJ1ZmZlcltpXSA9IHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlc1tpXTtcbiAgICB9XG4gICAgZm9yIChpID0gMDsgaSA8IG5ld1NhbXBsZXM7ICsraSkge1xuICAgICAgYnVmZmVyW3VudXNlZFNhbXBsZXMgKyBpXSA9IGJ1ZmZlck5ld1NhbXBsZXNbaV07XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGJ1ZmZlciA9IGJ1ZmZlck5ld1NhbXBsZXM7XG4gIH1cblxuICAvLyBkb3duc2FtcGxpbmcgdmFyaWFibGVzXG4gIHZhciBmaWx0ZXIgPSBbXG4gICAgICAtMC4wMzc5MzUsIC0wLjAwMDg5MDI0LCAwLjA0MDE3MywgMC4wMTk5ODksIDAuMDA0Nzc5MiwgLTAuMDU4Njc1LCAtMC4wNTY0ODcsXG4gICAgICAtMC4wMDQwNjUzLCAwLjE0NTI3LCAwLjI2OTI3LCAwLjMzOTEzLCAwLjI2OTI3LCAwLjE0NTI3LCAtMC4wMDQwNjUzLCAtMC4wNTY0ODcsXG4gICAgICAtMC4wNTg2NzUsIDAuMDA0Nzc5MiwgMC4wMTk5ODksIDAuMDQwMTczLCAtMC4wMDA4OTAyNCwgLTAuMDM3OTM1XG4gICAgXSxcbiAgICBzYW1wbGluZ1JhdGVSYXRpbyA9IHRoaXMuYXVkaW9Db250ZXh0LnNhbXBsZVJhdGUgLyAxNjAwMCxcbiAgICBuT3V0cHV0U2FtcGxlcyA9IE1hdGguZmxvb3IoKGJ1ZmZlci5sZW5ndGggLSBmaWx0ZXIubGVuZ3RoKSAvIChzYW1wbGluZ1JhdGVSYXRpbykpICsgMSxcbiAgICBwY21FbmNvZGVkQnVmZmVyMTZrID0gbmV3IEFycmF5QnVmZmVyKG5PdXRwdXRTYW1wbGVzICogMiksXG4gICAgZGF0YVZpZXcxNmsgPSBuZXcgRGF0YVZpZXcocGNtRW5jb2RlZEJ1ZmZlcjE2ayksXG4gICAgaW5kZXggPSAwLFxuICAgIHZvbHVtZSA9IDB4N0ZGRiwgLy9yYW5nZSBmcm9tIDAgdG8gMHg3RkZGIHRvIGNvbnRyb2wgdGhlIHZvbHVtZVxuICAgIG5PdXQgPSAwO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpICsgZmlsdGVyLmxlbmd0aCAtIDEgPCBidWZmZXIubGVuZ3RoOyBpID0gTWF0aC5yb3VuZChzYW1wbGluZ1JhdGVSYXRpbyAqIG5PdXQpKSB7XG4gICAgdmFyIHNhbXBsZSA9IDA7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBmaWx0ZXIubGVuZ3RoOyArK2opIHtcbiAgICAgIHNhbXBsZSArPSBidWZmZXJbaSArIGpdICogZmlsdGVyW2pdO1xuICAgIH1cbiAgICBzYW1wbGUgKj0gdm9sdW1lO1xuICAgIGRhdGFWaWV3MTZrLnNldEludDE2KGluZGV4LCBzYW1wbGUsIHRydWUpOyAvLyAndHJ1ZScgLT4gbWVhbnMgbGl0dGxlIGVuZGlhblxuICAgIGluZGV4ICs9IDI7XG4gICAgbk91dCsrO1xuICB9XG5cbiAgdmFyIGluZGV4U2FtcGxlQWZ0ZXJMYXN0VXNlZCA9IE1hdGgucm91bmQoc2FtcGxpbmdSYXRlUmF0aW8gKiBuT3V0KTtcbiAgdmFyIHJlbWFpbmluZyA9IGJ1ZmZlci5sZW5ndGggLSBpbmRleFNhbXBsZUFmdGVyTGFzdFVzZWQ7XG4gIGlmIChyZW1haW5pbmcgPiAwKSB7XG4gICAgdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzID0gbmV3IEZsb2F0MzJBcnJheShyZW1haW5pbmcpO1xuICAgIGZvciAoaSA9IDA7IGkgPCByZW1haW5pbmc7ICsraSkge1xuICAgICAgdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzW2ldID0gYnVmZmVyW2luZGV4U2FtcGxlQWZ0ZXJMYXN0VXNlZCArIGldO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXMgPSBuZXcgRmxvYXQzMkFycmF5KDApO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBCbG9iKFtkYXRhVmlldzE2a10sIHtcbiAgICB0eXBlOiAnYXVkaW8vbDE2J1xuICB9KTtcbiAgfTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgQmxvYiB0eXBlOiAnYXVkaW8vbDE2JyB3aXRoIHRoZVxuICogY2h1bmsgY29taW5nIGZyb20gdGhlIG1pY3JvcGhvbmUuXG4gKi9cbnZhciBleHBvcnREYXRhQnVmZmVyID0gZnVuY3Rpb24oYnVmZmVyLCBidWZmZXJTaXplKSB7XG4gIHZhciBwY21FbmNvZGVkQnVmZmVyID0gbnVsbCxcbiAgICBkYXRhVmlldyA9IG51bGwsXG4gICAgaW5kZXggPSAwLFxuICAgIHZvbHVtZSA9IDB4N0ZGRjsgLy9yYW5nZSBmcm9tIDAgdG8gMHg3RkZGIHRvIGNvbnRyb2wgdGhlIHZvbHVtZVxuXG4gIHBjbUVuY29kZWRCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoYnVmZmVyU2l6ZSAqIDIpO1xuICBkYXRhVmlldyA9IG5ldyBEYXRhVmlldyhwY21FbmNvZGVkQnVmZmVyKTtcblxuICAvKiBFeHBsYW5hdGlvbiBmb3IgdGhlIG1hdGg6IFRoZSByYXcgdmFsdWVzIGNhcHR1cmVkIGZyb20gdGhlIFdlYiBBdWRpbyBBUEkgYXJlXG4gICAqIGluIDMyLWJpdCBGbG9hdGluZyBQb2ludCwgYmV0d2VlbiAtMSBhbmQgMSAocGVyIHRoZSBzcGVjaWZpY2F0aW9uKS5cbiAgICogVGhlIHZhbHVlcyBmb3IgMTYtYml0IFBDTSByYW5nZSBiZXR3ZWVuIC0zMjc2OCBhbmQgKzMyNzY3ICgxNi1iaXQgc2lnbmVkIGludGVnZXIpLlxuICAgKiBNdWx0aXBseSB0byBjb250cm9sIHRoZSB2b2x1bWUgb2YgdGhlIG91dHB1dC4gV2Ugc3RvcmUgaW4gbGl0dGxlIGVuZGlhbi5cbiAgICovXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyLmxlbmd0aDsgaSsrKSB7XG4gICAgZGF0YVZpZXcuc2V0SW50MTYoaW5kZXgsIGJ1ZmZlcltpXSAqIHZvbHVtZSwgdHJ1ZSk7XG4gICAgaW5kZXggKz0gMjtcbiAgfVxuXG4gIC8vIGwxNiBpcyB0aGUgTUlNRSB0eXBlIGZvciAxNi1iaXQgUENNXG4gIHJldHVybiBuZXcgQmxvYihbZGF0YVZpZXddLCB7IHR5cGU6ICdhdWRpby9sMTYnIH0pO1xufTtcblxuTWljcm9waG9uZS5wcm90b3R5cGUuX2V4cG9ydERhdGFCdWZmZXIgPSBmdW5jdGlvbihidWZmZXIpe1xuICB1dGlscy5leHBvcnREYXRhQnVmZmVyKGJ1ZmZlciwgdGhpcy5idWZmZXJTaXplKTtcbn07IFxuXG5cbi8vIEZ1bmN0aW9ucyB1c2VkIHRvIGNvbnRyb2wgTWljcm9waG9uZSBldmVudHMgbGlzdGVuZXJzLlxuTWljcm9waG9uZS5wcm90b3R5cGUub25TdGFydFJlY29yZGluZyA9ICBmdW5jdGlvbigpIHt9O1xuTWljcm9waG9uZS5wcm90b3R5cGUub25TdG9wUmVjb3JkaW5nID0gIGZ1bmN0aW9uKCkge307XG5NaWNyb3Bob25lLnByb3RvdHlwZS5vbkF1ZGlvID0gIGZ1bmN0aW9uKCkge307XG5cbm1vZHVsZS5leHBvcnRzID0gTWljcm9waG9uZTtcblxuIiwibW9kdWxlLmV4cG9ydHM9e1xuICAgXCJtb2RlbHNcIjogW1xuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS1zLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC1iZXRhL2FwaS92MS9tb2RlbHMvZXMtRVNfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogMTYwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiZXMtRVNfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiZXMtRVNcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiU3BhbmlzaCBicm9hZGJhbmQgbW9kZWwuXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS1zLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC1iZXRhL2FwaS92MS9tb2RlbHMvamEtSlBfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogMTYwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiamEtSlBfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiamEtSlBcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiSmFwYW5lc2UgYnJvYWRiYW5kIG1vZGVsLlwiXG4gICAgICB9LCBcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0tcy53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQtYmV0YS9hcGkvdjEvbW9kZWxzL2VuLVVTX0Jyb2FkYmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDE2MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcImVuLVVTX0Jyb2FkYmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImVuLVVTXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlVTIEVuZ2xpc2ggYnJvYWRiYW5kIG1vZGVsLlwiXG4gICAgICB9LCBcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0tcy53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQtYmV0YS9hcGkvdjEvbW9kZWxzL2phLUpQX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiA4MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcImphLUpQX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJqYS1KUFwiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJKYXBhbmVzZSBuYXJyb3diYW5kIG1vZGVsLlwiXG4gICAgICB9LCBcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0tcy53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQtYmV0YS9hcGkvdjEvbW9kZWxzL2VzLUVTX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiA4MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcImVzLUVTX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJlcy1FU1wiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJTcGFuaXNoIG5hcnJvd2JhbmQgbW9kZWwuXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS1zLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC1iZXRhL2FwaS92MS9tb2RlbHMvZW4tVVNfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDgwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiZW4tVVNfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImVuLVVTXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlVTIEVuZ2xpc2ggbmFycm93YmFuZCBtb2RlbC5cIlxuICAgICAgfVxuICAgXVxufVxuIiwiXG52YXIgZWZmZWN0cyA9IHJlcXVpcmUoJy4vdmlld3MvZWZmZWN0cycpO1xudmFyIGRpc3BsYXkgPSByZXF1aXJlKCcuL3ZpZXdzL2Rpc3BsYXknKTtcbnZhciBoaWRlRXJyb3IgPSByZXF1aXJlKCcuL3ZpZXdzL3Nob3dlcnJvcicpLmhpZGVFcnJvcjtcbnZhciBpbml0U29ja2V0ID0gcmVxdWlyZSgnLi9zb2NrZXQnKS5pbml0U29ja2V0O1xuXG5leHBvcnRzLmhhbmRsZUZpbGVVcGxvYWQgPSBmdW5jdGlvbih0b2tlbiwgbW9kZWwsIGZpbGUsIGNvbnRlbnRUeXBlLCBjYWxsYmFjaywgb25lbmQpIHtcblxuXG4gICAgY29uc29sZS5sb2coJ3NldHRpbmcgaW1hZ2UnKTtcbiAgICAvLyAkKCcjcHJvZ3Jlc3NJbmRpY2F0b3InKS5jc3MoJ3Zpc2liaWxpdHknLCAndmlzaWJsZScpO1xuXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCB0cnVlKTtcbiAgICBoaWRlRXJyb3IoKTtcblxuICAgICQuc3Vic2NyaWJlKCdwcm9ncmVzcycsIGZ1bmN0aW9uKGV2dCwgZGF0YSkge1xuICAgICAgY29uc29sZS5sb2coJ3Byb2dyZXNzOiAnLCBkYXRhKTtcbiAgICB9KTtcblxuICAgIHZhciBtaWNJY29uID0gJCgnI21pY3JvcGhvbmVJY29uJyk7XG5cbiAgICBjb25zb2xlLmxvZygnY29udGVudFR5cGUnLCBjb250ZW50VHlwZSk7XG5cbiAgICB2YXIgYmFzZVN0cmluZyA9ICcnO1xuICAgIHZhciBiYXNlSlNPTiA9ICcnO1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcbiAgICBvcHRpb25zLnRva2VuID0gdG9rZW47XG4gICAgb3B0aW9ucy5tZXNzYWdlID0ge1xuICAgICAgJ2FjdGlvbic6ICdzdGFydCcsXG4gICAgICAnY29udGVudC10eXBlJzogY29udGVudFR5cGUsXG4gICAgICAnaW50ZXJpbV9yZXN1bHRzJzogdHJ1ZSxcbiAgICAgICdjb250aW51b3VzJzogdHJ1ZSxcbiAgICAgICd3b3JkX2NvbmZpZGVuY2UnOiB0cnVlLFxuICAgICAgJ3RpbWVzdGFtcHMnOiB0cnVlLFxuICAgICAgJ21heF9hbHRlcm5hdGl2ZXMnOiAzXG4gICAgfTtcbiAgICBvcHRpb25zLm1vZGVsID0gbW9kZWw7XG5cbiAgICBmdW5jdGlvbiBvbk9wZW4oc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZygnU29ja2V0IG9wZW5lZCcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uTGlzdGVuaW5nKHNvY2tldCkge1xuICAgICAgY29uc29sZS5sb2coJ1NvY2tldCBsaXN0ZW5pbmcnKTtcbiAgICAgIGNhbGxiYWNrKHNvY2tldCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25NZXNzYWdlKG1zZykge1xuICAgICAgY29uc29sZS5sb2coJ1NvY2tldCBtc2c6ICcsIG1zZyk7XG4gICAgICBpZiAobXNnLnJlc3VsdHMpIHtcbiAgICAgICAgLy8gQ29udmVydCB0byBjbG9zdXJlIGFwcHJvYWNoXG4gICAgICAgIGJhc2VTdHJpbmcgPSBkaXNwbGF5LnNob3dSZXN1bHQobXNnLCBiYXNlU3RyaW5nKTtcbiAgICAgICAgYmFzZUpTT04gPSBkaXNwbGF5LnNob3dKU09OKG1zZywgYmFzZUpTT04pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uRXJyb3IoZXZ0KSB7XG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIGZhbHNlKTtcbiAgICAgIG9uZW5kKGV2dCk7XG4gICAgICBjb25zb2xlLmxvZygnU29ja2V0IGVycjogJywgZXZ0LmNvZGUpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uQ2xvc2UoZXZ0KSB7XG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIGZhbHNlKTtcbiAgICAgIG9uZW5kKGV2dCk7XG4gICAgICBjb25zb2xlLmxvZygnU29ja2V0IGNsb3Npbmc6ICcsIGV2dCk7XG4gICAgfVxuXG4gICAgaW5pdFNvY2tldChvcHRpb25zLCBvbk9wZW4sIG9uTGlzdGVuaW5nLCBvbk1lc3NhZ2UsIG9uRXJyb3IsIG9uQ2xvc2UpO1xuXG4gIH1cbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgSUJNIENvcnAuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuLypnbG9iYWwgJDpmYWxzZSAqL1xuXG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnZhciBNaWNyb3Bob25lID0gcmVxdWlyZSgnLi9NaWNyb3Bob25lJyk7XG52YXIgc2hvd2Vycm9yID0gcmVxdWlyZSgnLi92aWV3cy9zaG93ZXJyb3InKTtcbnZhciBzaG93RXJyb3IgPSBzaG93ZXJyb3Iuc2hvd0Vycm9yO1xudmFyIGhpZGVFcnJvciA9IHNob3dlcnJvci5oaWRlRXJyb3I7XG5cbi8vIE1pbmkgV1MgY2FsbGJhY2sgQVBJLCBzbyB3ZSBjYW4gaW5pdGlhbGl6ZVxuLy8gd2l0aCBtb2RlbCBhbmQgdG9rZW4gaW4gVVJJLCBwbHVzXG4vLyBzdGFydCBtZXNzYWdlXG52YXIgaW5pdFNvY2tldCA9IGV4cG9ydHMuaW5pdFNvY2tldCA9IGZ1bmN0aW9uKG9wdGlvbnMsIG9ub3Blbiwgb25saXN0ZW5pbmcsIG9ubWVzc2FnZSwgb25lcnJvciwgb25jbG9zZSkge1xuICB2YXIgbGlzdGVuaW5nID0gZmFsc2U7XG4gIGZ1bmN0aW9uIHdpdGhEZWZhdWx0KHZhbCwgZGVmYXVsdFZhbCkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsID09PSAndW5kZWZpbmVkJyA/IGRlZmF1bHRWYWwgOiB2YWw7XG4gIH1cbiAgdmFyIHNvY2tldDtcbiAgdmFyIHRva2VuID0gb3B0aW9ucy50b2tlbjtcbiAgdmFyIG1vZGVsID0gb3B0aW9ucy5tb2RlbCB8fCBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudE1vZGVsJyk7XG4gIHZhciBtZXNzYWdlID0gb3B0aW9ucy5tZXNzYWdlIHx8IHsnYWN0aW9uJzogJ3N0YXJ0J307XG4gIHZhciBzZXNzaW9uUGVybWlzc2lvbnMgPSB3aXRoRGVmYXVsdChvcHRpb25zLnNlc3Npb25QZXJtaXNzaW9ucywgSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnc2Vzc2lvblBlcm1pc3Npb25zJykpKTtcbiAgdmFyIHNlc3Npb25QZXJtaXNzaW9uc1F1ZXJ5UGFyYW0gPSBzZXNzaW9uUGVybWlzc2lvbnMgPyAnMCcgOiAnMSc7XG4gIHZhciB1cmwgPSBvcHRpb25zLnNlcnZpY2VVUkkgfHwgJ3dzczovL3N0cmVhbS1zLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC1iZXRhL2FwaS92MS9yZWNvZ25pemU/d2F0c29uLXRva2VuPSdcbiAgICArIHRva2VuXG4gICAgKyAnJlgtV0RDLVBMLU9QVC1PVVQ9JyArIHNlc3Npb25QZXJtaXNzaW9uc1F1ZXJ5UGFyYW1cbiAgICArICcmbW9kZWw9JyArIG1vZGVsO1xuICBjb25zb2xlLmxvZygnVVJMIG1vZGVsJywgbW9kZWwpO1xuICB0cnkge1xuICAgIHNvY2tldCA9IG5ldyBXZWJTb2NrZXQodXJsKTtcbiAgfSBjYXRjaChlcnIpIHtcbiAgICBjb25zb2xlLmxvZygnd2Vic29ja2V0ZXJyJywgZXJyKTtcbiAgICBzaG93RXJyb3IoZXJyLm1lc3NhZ2UpO1xuICB9XG4gIHNvY2tldC5vbm9wZW4gPSBmdW5jdGlvbihldnQpIHtcbiAgICBjb25zb2xlLmxvZygnd3Mgb3BlbmVkJyk7XG4gICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkpO1xuICAgIG9ub3Blbihzb2NrZXQpO1xuICB9O1xuICBzb2NrZXQub25tZXNzYWdlID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIG1zZyA9IEpTT04ucGFyc2UoZXZ0LmRhdGEpO1xuICAgIGNvbnNvbGUubG9nKCdldnQnLCBldnQpO1xuICAgIGlmIChtc2cuc3RhdGUgPT09ICdsaXN0ZW5pbmcnKSB7XG4gICAgICAkLnN1YnNjcmliZSgnc29ja2V0c3RvcCcsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ0Nsb3Npbmcgc29ja2V0Li4uJyk7XG4gICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHsnYWN0aW9uJzogJ3N0b3AnfSkpO1xuICAgICAgICBzb2NrZXQuY2xvc2UoKTtcbiAgICAgIH0pO1xuICAgICAgaWYgKCFsaXN0ZW5pbmcpIHtcbiAgICAgICAgb25saXN0ZW5pbmcoc29ja2V0KTtcbiAgICAgICAgaGlkZUVycm9yKCk7XG4gICAgICAgIGxpc3RlbmluZyA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZygnY2xvc2luZyBzb2NrZXQnKTtcbiAgICAgICAgLy8gQ2Fubm90IGNsb3NlIHNvY2tldCBzaW5jZSBzdGF0ZSBpcyByZXBvcnRlZCBoZXJlIGFzICdDTE9TSU5HJyBvciAnQ0xPU0VEJ1xuICAgICAgICAvLyBEZXNwaXRlIHRoaXMsIGl0J3MgcG9zc2libGUgdG8gc2VuZCBmcm9tIHRoaXMgJ0NMT1NJTkcnIHNvY2tldCB3aXRoIG5vIGlzc3VlXG4gICAgICAgIC8vIENvdWxkIGJlIGEgYnJvd3NlciBidWcsIHN0aWxsIGludmVzdGlnYXRpbmdcbiAgICAgICAgLy8gQ291bGQgYWxzbyBiZSBhIHByb3h5L2dhdGV3YXkgaXNzdWVcbiAgICAgICAgc29ja2V0LmNsb3NlKCk7XG4gICAgICB9XG4gICAgfVxuICAgIG9ubWVzc2FnZShtc2csIHNvY2tldCk7XG4gIH07XG5cbiAgc29ja2V0Lm9uZXJyb3IgPSBmdW5jdGlvbihldnQpIHtcbiAgICBjb25zb2xlLmxvZygnV1Mgb25lcnJvcjogJywgZXZ0KTtcbiAgICBzaG93RXJyb3IoJ0FwcGxpY2F0aW9uIGVycm9yICcgKyBldnQuY29kZSArICc6IHBsZWFzZSByZWZyZXNoIHlvdXIgYnJvd3NlciBhbmQgdHJ5IGFnYWluJyk7XG4gICAgb25lcnJvcihldnQpO1xuICB9O1xuXG4gIHNvY2tldC5vbmNsb3NlID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgY29uc29sZS5sb2coJ1dTIG9uY2xvc2U6ICcsIGV2dCk7XG4gICAgaWYgKGV2dC5jb2RlID09PSAxMDA2KSB7XG4gICAgICAvLyBBdXRoZW50aWNhdGlvbiBlcnJvciwgdHJ5IHRvIHJlY29ubmVjdFxuICAgICAgY29uc29sZS5sb2coJ0Nvbm5lY3QgYXR0ZW1wdCB0b2tlbjogJywgdG9rZW4pO1xuICAgICAgdXRpbHMuZ2V0VG9rZW4oZnVuY3Rpb24odG9rZW4pIHtcbiAgICAgICAgY29uc29sZS5sb2coJ2dvdCB0b2tlbicsIHRva2VuKTtcbiAgICAgICAgb3B0aW9ucy50b2tlbiA9IHRva2VuO1xuICAgICAgICBpbml0U29ja2V0KG9wdGlvbnMsIG9ub3Blbiwgb25saXN0ZW5pbmcsIG9ubWVzc2FnZSwgb25lcnJvcik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAoZXZ0LmNvZGUgPiAxMDAwKSB7XG4gICAgICBzaG93RXJyb3IoJ1NlcnZlciBlcnJvciAnICsgZXZ0LmNvZGUgKyAnOiBwbGVhc2UgcmVmcmVzaCB5b3VyIGJyb3dzZXIgYW5kIHRyeSBhZ2FpbicpO1xuICAgIH1cbiAgICAvLyBNYWRlIGl0IHRocm91Z2gsIG5vcm1hbCBjbG9zZVxuICAgIG9uY2xvc2UoZXZ0KTtcbiAgfTtcblxufVxuXG4iLCJcbi8vIEZvciBub24tdmlldyBsb2dpY1xudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdy5qUXVlcnkgOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsLmpRdWVyeSA6IG51bGwpO1xuXG52YXIgZmlsZUJsb2NrID0gZnVuY3Rpb24oX29mZnNldCwgbGVuZ3RoLCBfZmlsZSwgcmVhZENodW5rKSB7XG4gIHZhciByID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgdmFyIGJsb2IgPSBfZmlsZS5zbGljZShfb2Zmc2V0LCBsZW5ndGggKyBfb2Zmc2V0KTtcbiAgci5vbmxvYWQgPSByZWFkQ2h1bms7XG4gIHIucmVhZEFzQXJyYXlCdWZmZXIoYmxvYik7XG59XG5cbi8vIEJhc2VkIG9uIGFsZWRpYWZlcmlhJ3MgU08gcmVzcG9uc2Vcbi8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTQ0MzgxODcvamF2YXNjcmlwdC1maWxlcmVhZGVyLXBhcnNpbmctbG9uZy1maWxlLWluLWNodW5rc1xuZXhwb3J0cy5vbkZpbGVQcm9ncmVzcyA9IGZ1bmN0aW9uKG9wdGlvbnMsIG9uZGF0YSwgb25lcnJvciwgb25lbmQpIHtcbiAgdmFyIGZpbGUgICAgICAgPSBvcHRpb25zLmZpbGU7XG4gIHZhciBmaWxlU2l6ZSAgID0gZmlsZS5zaXplO1xuICB2YXIgY2h1bmtTaXplICA9IG9wdGlvbnMuYnVmZmVyU2l6ZSB8fCA4MTkyO1xuICB2YXIgb2Zmc2V0ICAgICA9IDA7XG4gIHZhciByZWFkQ2h1bmsgPSBmdW5jdGlvbihldnQpIHtcbiAgICBpZiAob2Zmc2V0ID49IGZpbGVTaXplKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIkRvbmUgcmVhZGluZyBmaWxlXCIpO1xuICAgICAgb25lbmQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGV2dC50YXJnZXQuZXJyb3IgPT0gbnVsbCkge1xuICAgICAgdmFyIGJ1ZmZlciA9IGV2dC50YXJnZXQucmVzdWx0O1xuICAgICAgdmFyIGxlbiA9IGJ1ZmZlci5ieXRlTGVuZ3RoO1xuICAgICAgb2Zmc2V0ICs9IGxlbjtcbiAgICAgIG9uZGF0YShidWZmZXIpOyAvLyBjYWxsYmFjayBmb3IgaGFuZGxpbmcgcmVhZCBjaHVua1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgZXJyb3JNZXNzYWdlID0gZXZ0LnRhcmdldC5lcnJvcjtcbiAgICAgIGNvbnNvbGUubG9nKFwiUmVhZCBlcnJvcjogXCIgKyBlcnJvck1lc3NhZ2UpO1xuICAgICAgb25lcnJvcihlcnJvck1lc3NhZ2UpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBmaWxlQmxvY2sob2Zmc2V0LCBjaHVua1NpemUsIGZpbGUsIHJlYWRDaHVuayk7XG4gIH1cbiAgZmlsZUJsb2NrKG9mZnNldCwgY2h1bmtTaXplLCBmaWxlLCByZWFkQ2h1bmspO1xufVxuXG5leHBvcnRzLmdldFRva2VuID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgLy8gTWFrZSBjYWxsIHRvIEFQSSB0byB0cnkgYW5kIGdldCB0b2tlblxuICB2YXIgdXJsID0gJy90b2tlbic7XG4gIHZhciB0b2tlblJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgdG9rZW5SZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgdXJsLCB0cnVlKTtcbiAgdG9rZW5SZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciB0b2tlbiA9IHRva2VuUmVxdWVzdC5yZXNwb25zZVRleHQ7XG4gICAgY2FsbGJhY2sodG9rZW4pO1xuICB9O1xuICB0b2tlblJlcXVlc3Quc2VuZCgpO1xufVxuXG5leHBvcnRzLmluaXRQdWJTdWIgPSBmdW5jdGlvbigpIHtcbiAgdmFyIG8gICAgICAgICA9ICQoe30pO1xuICAkLnN1YnNjcmliZSAgID0gby5vbi5iaW5kKG8pO1xuICAkLnVuc3Vic2NyaWJlID0gby5vZmYuYmluZChvKTtcbiAgJC5wdWJsaXNoICAgICA9IG8udHJpZ2dlci5iaW5kKG8pO1xufVxuIiwiXG5cbmV4cG9ydHMuaW5pdEFuaW1hdGVQYW5lbCA9IGZ1bmN0aW9uKCkge1xuICAkKCcucGFuZWwtaGVhZGluZyBzcGFuLmNsaWNrYWJsZScpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICBpZiAoJCh0aGlzKS5oYXNDbGFzcygncGFuZWwtY29sbGFwc2VkJykpIHtcbiAgICAgIC8vIGV4cGFuZCB0aGUgcGFuZWxcbiAgICAgICQodGhpcykucGFyZW50cygnLnBhbmVsJykuZmluZCgnLnBhbmVsLWJvZHknKS5zbGlkZURvd24oKTtcbiAgICAgICQodGhpcykucmVtb3ZlQ2xhc3MoJ3BhbmVsLWNvbGxhcHNlZCcpO1xuICAgICAgJCh0aGlzKS5maW5kKCdpJykucmVtb3ZlQ2xhc3MoJ2NhcmV0LWRvd24nKS5hZGRDbGFzcygnY2FyZXQtdXAnKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBjb2xsYXBzZSB0aGUgcGFuZWxcbiAgICAgICQodGhpcykucGFyZW50cygnLnBhbmVsJykuZmluZCgnLnBhbmVsLWJvZHknKS5zbGlkZVVwKCk7XG4gICAgICAkKHRoaXMpLmFkZENsYXNzKCdwYW5lbC1jb2xsYXBzZWQnKTtcbiAgICAgICQodGhpcykuZmluZCgnaScpLnJlbW92ZUNsYXNzKCdjYXJldC11cCcpLmFkZENsYXNzKCdjYXJldC1kb3duJyk7XG4gICAgfVxuICB9KTtcbn1cblxuIiwidmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdy5qUXVlcnkgOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsLmpRdWVyeSA6IG51bGwpO1xuXG52YXIgc2hvd1RpbWVzdGFtcCA9IGZ1bmN0aW9uKHRpbWVzdGFtcHMsIGNvbmZpZGVuY2VzKSB7XG4gIHZhciB3b3JkID0gdGltZXN0YW1wc1swXSxcbiAgICAgIHQwID0gdGltZXN0YW1wc1sxXSxcbiAgICAgIHQxID0gdGltZXN0YW1wc1syXTtcbiAgdmFyIHRpbWVsZW5ndGggPSB0MSAtIHQwO1xuICAvLyBTaG93IGNvbmZpZGVuY2UgaWYgZGVmaW5lZCwgZWxzZSAnbi9hJ1xuICB2YXIgZGlzcGxheUNvbmZpZGVuY2UgPSBjb25maWRlbmNlcyA/IGNvbmZpZGVuY2VzWzFdLnRvU3RyaW5nKCkuc3Vic3RyaW5nKDAsIDMpIDogJ24vYSc7XG4gICQoJyNtZXRhZGF0YVRhYmxlID4gdGJvZHk6bGFzdC1jaGlsZCcpLmFwcGVuZChcbiAgICAgICc8dHI+J1xuICAgICAgKyAnPHRkPicgKyB3b3JkICsgJzwvdGQ+J1xuICAgICAgKyAnPHRkPicgKyB0MCArICc8L3RkPidcbiAgICAgICsgJzx0ZD4nICsgZGlzcGxheUNvbmZpZGVuY2UgKyAnPC90ZD4nXG4gICAgICArICc8L3RyPidcbiAgICAgICk7XG59XG5cbnZhciBzaG93TWV0YURhdGEgPSBmdW5jdGlvbihhbHRlcm5hdGl2ZSkge1xuICAkKCcjbWV0YWRhdGFUYWJsZSA+IHRib2R5JykuaHRtbCgpO1xuICB2YXIgY29uZmlkZW5jZU5lc3RlZEFycmF5ID0gYWx0ZXJuYXRpdmUud29yZF9jb25maWRlbmNlOztcbiAgdmFyIHRpbWVzdGFtcE5lc3RlZEFycmF5ID0gYWx0ZXJuYXRpdmUudGltZXN0YW1wcztcbiAgaWYgKGNvbmZpZGVuY2VOZXN0ZWRBcnJheSAmJiBjb25maWRlbmNlTmVzdGVkQXJyYXkubGVuZ3RoID4gMCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29uZmlkZW5jZU5lc3RlZEFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgdGltZXN0YW1wcyA9IHRpbWVzdGFtcE5lc3RlZEFycmF5W2ldO1xuICAgICAgdmFyIGNvbmZpZGVuY2VzID0gY29uZmlkZW5jZU5lc3RlZEFycmF5W2ldO1xuICAgICAgc2hvd1RpbWVzdGFtcCh0aW1lc3RhbXBzLCBjb25maWRlbmNlcyk7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfSBlbHNlIHtcbiAgICBpZiAodGltZXN0YW1wTmVzdGVkQXJyYXkgJiYgdGltZXN0YW1wTmVzdGVkQXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgY29uc29sZS5sb2coJ1NIT1dJTkcgVElNRVNUQU1QUycpO1xuICAgICAgdGltZXN0YW1wTmVzdGVkQXJyYXkuZm9yRWFjaChmdW5jdGlvbih0aW1lc3RhbXApIHtcbiAgICAgICAgc2hvd1RpbWVzdGFtcCh0aW1lc3RhbXApO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5cbnZhciBzaG93QWx0ZXJuYXRpdmVzID0gZnVuY3Rpb24oYWx0ZXJuYXRpdmVzKSB7XG4gIHZhciAkaHlwb3RoZXNlcyA9ICQoJy5oeXBvdGhlc2VzIHVsJyk7XG4gICRoeXBvdGhlc2VzLmh0bWwoJycpO1xuICBhbHRlcm5hdGl2ZXMuZm9yRWFjaChmdW5jdGlvbihhbHRlcm5hdGl2ZSwgaWR4KSB7XG4gICAgJGh5cG90aGVzZXMuYXBwZW5kKCc8bGkgZGF0YS1oeXBvdGhlc2lzLWluZGV4PScgKyBpZHggKyAnID4nICsgYWx0ZXJuYXRpdmUudHJhbnNjcmlwdCArICc8L2xpPicpO1xuICB9KTtcbiAgJGh5cG90aGVzZXMub24oJ2NsaWNrJywgXCJsaVwiLCBmdW5jdGlvbiAoKSB7XG4gICAgY29uc29sZS5sb2coXCJzaG93aW5nIG1ldGFkYXRhXCIpO1xuICAgIHZhciBpZHggPSArICQodGhpcykuZGF0YSgnaHlwb3RoZXNpcy1pbmRleCcpO1xuICAgIHZhciBhbHRlcm5hdGl2ZSA9IGFsdGVybmF0aXZlc1tpZHhdO1xuICAgIHNob3dNZXRhRGF0YShhbHRlcm5hdGl2ZSk7XG4gIH0pO1xufVxuXG4vLyBUT0RPOiBDb252ZXJ0IHRvIGNsb3N1cmUgYXBwcm9hY2hcbnZhciBwcm9jZXNzU3RyaW5nID0gZnVuY3Rpb24oYmFzZVN0cmluZywgaXNGaW5pc2hlZCkge1xuXG4gIGlmIChpc0ZpbmlzaGVkKSB7XG4gICAgdmFyIGZvcm1hdHRlZFN0cmluZyA9IGJhc2VTdHJpbmcuc2xpY2UoMCwgLTEpO1xuICAgIGZvcm1hdHRlZFN0cmluZyA9IGZvcm1hdHRlZFN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIGZvcm1hdHRlZFN0cmluZy5zdWJzdHJpbmcoMSk7XG4gICAgZm9ybWF0dGVkU3RyaW5nID0gZm9ybWF0dGVkU3RyaW5nLnRyaW0oKSArICcuJztcbiAgICBjb25zb2xlLmxvZygnZm9ybWF0dGVkIGZpbmFsIHJlczonLCBmb3JtYXR0ZWRTdHJpbmcpO1xuICAgICQoJyNyZXN1bHRzVGV4dCcpLnZhbChmb3JtYXR0ZWRTdHJpbmcpO1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUubG9nKCdpbnRlcmltUmVzdWx0IHJlczonLCBiYXNlU3RyaW5nKTtcbiAgICAkKCcjcmVzdWx0c1RleHQnKS52YWwoYmFzZVN0cmluZyk7XG4gIH1cblxufVxuXG5leHBvcnRzLnNob3dKU09OID0gZnVuY3Rpb24obXNnLCBiYXNlSlNPTikge1xuICB2YXIganNvbiA9IEpTT04uc3RyaW5naWZ5KG1zZyk7XG4gIGJhc2VKU09OICs9IGpzb247XG4gIGJhc2VKU09OICs9ICdcXG4nO1xuICAkKCcjcmVzdWx0c0pTT04nKS52YWwoYmFzZUpTT04pO1xuICByZXR1cm4gYmFzZUpTT047XG59XG5cbmV4cG9ydHMuc2hvd1Jlc3VsdCA9IGZ1bmN0aW9uKG1zZywgYmFzZVN0cmluZywgY2FsbGJhY2spIHtcblxuICB2YXIgaWR4ID0gK21zZy5yZXN1bHRfaW5kZXg7XG5cbiAgaWYgKG1zZy5yZXN1bHRzICYmIG1zZy5yZXN1bHRzLmxlbmd0aCA+IDApIHtcblxuICAgIHZhciBhbHRlcm5hdGl2ZXMgPSBtc2cucmVzdWx0c1swXS5hbHRlcm5hdGl2ZXM7XG4gICAgdmFyIHRleHQgPSBtc2cucmVzdWx0c1swXS5hbHRlcm5hdGl2ZXNbMF0udHJhbnNjcmlwdCB8fCAnJztcblxuICAgIHNob3dNZXRhRGF0YShhbHRlcm5hdGl2ZXNbMF0pO1xuICAgIC8vQ2FwaXRhbGl6ZSBmaXJzdCB3b3JkXG4gICAgLy8gaWYgZmluYWwgcmVzdWx0cywgYXBwZW5kIGEgbmV3IHBhcmFncmFwaFxuICAgIGlmIChtc2cucmVzdWx0cyAmJiBtc2cucmVzdWx0c1swXSAmJiBtc2cucmVzdWx0c1swXS5maW5hbCkge1xuICAgICAgYmFzZVN0cmluZyArPSB0ZXh0O1xuICAgICAgY29uc29sZS5sb2coJ2ZpbmFsIHJlczonLCBiYXNlU3RyaW5nKTtcbiAgICAgIHByb2Nlc3NTdHJpbmcoYmFzZVN0cmluZywgdHJ1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciB0ZW1wU3RyaW5nID0gYmFzZVN0cmluZyArIHRleHQ7XG4gICAgICBjb25zb2xlLmxvZygnaW50ZXJpbVJlc3VsdCByZXM6JywgdGVtcFN0cmluZyk7XG4gICAgICBwcm9jZXNzU3RyaW5nKHRlbXBTdHJpbmcsIGZhbHNlKTtcbiAgICB9XG4gIH1cbiAgaWYgKGFsdGVybmF0aXZlcykge1xuICAgIHNob3dBbHRlcm5hdGl2ZXMoYWx0ZXJuYXRpdmVzKTtcbiAgfVxuXG4gIHZhciBpc05OTiA9IC9eKChuKVxcMyspJC8udGVzdChiYXNlU3RyaW5nKTtcbiAgaWYgKGlzTk5OKSB7XG4gICAgYmFzZVN0cmluZyA9ICc8dW5pbnRlbGxpZ2libGU6IHBsZWFzZSBjaGVjayBzZWxlY3RlZCBsYW5ndWFnZSBhbmQgYmFuZHdpZHRoPic7XG4gIH1cbiAgcmV0dXJuIGJhc2VTdHJpbmc7XG59XG4iLCJcblxuXG5leHBvcnRzLmZsYXNoU1ZHID0gZnVuY3Rpb24oZWwpIHtcbiAgZWwuY3NzKHsgZmlsbDogJyNBNTM3MjUnIH0pO1xuICBmdW5jdGlvbiBsb29wKCkge1xuICAgIGVsLmFuaW1hdGUoeyBmaWxsOiAnI0E1MzcyNScgfSxcbiAgICAgICAgMTAwMCwgJ2xpbmVhcicpXG4gICAgICAuYW5pbWF0ZSh7IGZpbGw6ICd3aGl0ZScgfSxcbiAgICAgICAgICAxMDAwLCAnbGluZWFyJyk7XG4gIH1cbiAgLy8gcmV0dXJuIHRpbWVyXG4gIHZhciB0aW1lciA9IHNldFRpbWVvdXQobG9vcCwgMjAwMCk7XG4gIHJldHVybiB0aW1lcjtcbn07XG5cbmV4cG9ydHMuc3RvcEZsYXNoU1ZHID0gZnVuY3Rpb24odGltZXIpIHtcbiAgZWwuY3NzKHsgZmlsbDogJ3doaXRlJyB9ICk7XG4gIGNsZWFySW50ZXJ2YWwodGltZXIpO1xufVxuXG5leHBvcnRzLnRvZ2dsZUltYWdlID0gZnVuY3Rpb24oZWwsIG5hbWUpIHtcbiAgaWYoZWwuYXR0cignc3JjJykgPT09ICdpbWcvJyArIG5hbWUgKyAnLnN2ZycpIHtcbiAgICBlbC5hdHRyKFwic3JjXCIsICdpbWcvJyArIG5hbWUgKyAnLXJlZC5zdmcnKTtcbiAgfSBlbHNlIHtcbiAgICBlbC5hdHRyKCdzcmMnLCAnaW1nLycgKyBuYW1lICsgJy5zdmcnKTtcbiAgfVxufVxuXG52YXIgcmVzdG9yZUltYWdlID0gZXhwb3J0cy5yZXN0b3JlSW1hZ2UgPSBmdW5jdGlvbihlbCwgbmFtZSkge1xuICBlbC5hdHRyKCdzcmMnLCAnaW1nLycgKyBuYW1lICsgJy5zdmcnKTtcbn1cblxuZXhwb3J0cy5zdG9wVG9nZ2xlSW1hZ2UgPSBmdW5jdGlvbih0aW1lciwgZWwsIG5hbWUpIHtcbiAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG4gIHJlc3RvcmVJbWFnZShlbCwgbmFtZSk7XG59XG5cbiIsIlxudmFyIGluaXRTZXNzaW9uUGVybWlzc2lvbnMgPSByZXF1aXJlKCcuL3Nlc3Npb25wZXJtaXNzaW9ucycpLmluaXRTZXNzaW9uUGVybWlzc2lvbnM7XG52YXIgaW5pdFNlbGVjdE1vZGVsID0gcmVxdWlyZSgnLi9zZWxlY3Rtb2RlbCcpLmluaXRTZWxlY3RNb2RlbDtcbnZhciBpbml0QW5pbWF0ZVBhbmVsID0gcmVxdWlyZSgnLi9hbmltYXRlcGFuZWwnKS5pbml0QW5pbWF0ZVBhbmVsO1xudmFyIGluaXRTaG93VGFiID0gcmVxdWlyZSgnLi9zaG93dGFiJykuaW5pdFNob3dUYWI7XG52YXIgaW5pdFBsYXlTYW1wbGUgPSByZXF1aXJlKCcuL3BsYXlzYW1wbGUnKS5pbml0UGxheVNhbXBsZTtcblxuXG5leHBvcnRzLmluaXRWaWV3cyA9IGZ1bmN0aW9uKGN0eCkge1xuICBjb25zb2xlLmxvZygnSW5pdGlhbGl6aW5nIHZpZXdzLi4uJyk7XG4gIGluaXRTZWxlY3RNb2RlbChjdHgpO1xuICBpbml0UGxheVNhbXBsZShjdHgpO1xuICBpbml0U2Vzc2lvblBlcm1pc3Npb25zKCk7XG4gIGluaXRTaG93VGFiKCk7XG4gIGluaXRBbmltYXRlUGFuZWwoKTtcbiAgaW5pdFNob3dUYWIoKTtcbn1cbiIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xudmFyIG9uRmlsZVByb2dyZXNzID0gdXRpbHMub25GaWxlUHJvZ3Jlc3M7XG52YXIgaGFuZGxlRmlsZVVwbG9hZCA9IHJlcXVpcmUoJy4uL2ZpbGV1cGxvYWQnKS5oYW5kbGVGaWxlVXBsb2FkO1xudmFyIGluaXRTb2NrZXQgPSByZXF1aXJlKCcuLi9zb2NrZXQnKS5pbml0U29ja2V0O1xudmFyIHNob3dFcnJvciA9IHJlcXVpcmUoJy4vc2hvd2Vycm9yJykuc2hvd0Vycm9yO1xudmFyIGVmZmVjdHMgPSByZXF1aXJlKCcuL2VmZmVjdHMnKTtcblxuXG52YXIgcGxheVNhbXBsZSA9IGZ1bmN0aW9uKHRva2VuLCBpbWFnZVRhZywgaWNvbk5hbWUsIHVybCwgY2FsbGJhY2spIHtcblxuICB2YXIgY3VycmVudGx5RGlzcGxheWluZyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnKSk7XG5cbiAgaWYgKGN1cnJlbnRseURpc3BsYXlpbmcpIHtcbiAgICBzaG93RXJyb3IoJ0N1cnJlbnRseSBkaXNwbGF5aW5nIGFub3RoZXIgZmlsZSwgcGxlYXNlIHdhaXQgdW50aWwgY29tcGxldGUnKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIHRydWUpO1xuXG4gIHZhciB0aW1lciA9IHNldEludGVydmFsKGVmZmVjdHMudG9nZ2xlSW1hZ2UsIDc1MCwgaW1hZ2VUYWcsIGljb25OYW1lKTtcblxuICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gIHhoci5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuICB4aHIucmVzcG9uc2VUeXBlID0gJ2Jsb2InO1xuICB4aHIub25sb2FkID0gZnVuY3Rpb24oZSkge1xuICAgIHZhciBibG9iID0geGhyLnJlc3BvbnNlO1xuICAgIHZhciBjdXJyZW50TW9kZWwgPSAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnO1xuICAgIHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgIHZhciBibG9iVG9UZXh0ID0gbmV3IEJsb2IoW2Jsb2JdKS5zbGljZSgwLCA0KTtcbiAgICBjb25zb2xlLmxvZygnVE9LRU4nLCB0b2tlbik7XG4gICAgY29uc29sZS5sb2coJ1VSTCcsIHVybCk7XG4gICAgY29uc29sZS5sb2coJ0JMT0InLCBibG9iKTtcbiAgICByZWFkZXIucmVhZEFzVGV4dChibG9iVG9UZXh0KTtcbiAgICByZWFkZXIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY29udGVudFR5cGUgPSByZWFkZXIucmVzdWx0ID09PSAnZkxhQycgPyAnYXVkaW8vZmxhYycgOiAnYXVkaW8vd2F2JztcbiAgICAgIGNvbnNvbGUubG9nKCdVcGxvYWRpbmcgZmlsZScsIHJlYWRlci5yZXN1bHQpO1xuICAgICAgaGFuZGxlRmlsZVVwbG9hZCh0b2tlbiwgY3VycmVudE1vZGVsLCBibG9iLCBjb250ZW50VHlwZSwgZnVuY3Rpb24oc29ja2V0KSB7XG4gICAgICAgIHZhciBwYXJzZU9wdGlvbnMgPSB7XG4gICAgICAgICAgZmlsZTogYmxvYlxuICAgICAgICB9O1xuICAgICAgICBvbkZpbGVQcm9ncmVzcyhwYXJzZU9wdGlvbnMsXG4gICAgICAgICAgLy8gT24gZGF0YSBjaHVua1xuICAgICAgICAgIGZ1bmN0aW9uKGNodW5rKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnSGFuZGxpbmcgY2h1bmsnLCBjaHVuayk7XG4gICAgICAgICAgICBzb2NrZXQuc2VuZChjaHVuayk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICAvLyBPbiBmaWxlIHJlYWQgZXJyb3JcbiAgICAgICAgICBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdFcnJvciByZWFkaW5nIGZpbGU6ICcsIGV2dC5tZXNzYWdlKTtcbiAgICAgICAgICAgIHNob3dFcnJvcihldnQubWVzc2FnZSk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICAvLyBPbiBsb2FkIGVuZFxuICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoeydhY3Rpb24nOiAnc3RvcCd9KSk7XG4gICAgICAgICAgfSk7XG4gICAgICB9LCBcbiAgICAgIC8vIE9uIGNvbm5lY3Rpb24gZW5kXG4gICAgICAgIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgIGVmZmVjdHMuc3RvcFRvZ2dsZUltYWdlKHRpbWVyLCBpbWFnZVRhZywgaWNvbk5hbWUpO1xuICAgICAgICAgIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgICB9XG4gICAgICApO1xuICAgIH07XG4gIH07XG4gIHhoci5zZW5kKCk7XG59O1xuXG5cbmV4cG9ydHMuaW5pdFBsYXlTYW1wbGUgPSBmdW5jdGlvbihjdHgpIHtcblxuICAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIGVsID0gJCgnLnBsYXktc2FtcGxlLTEnKTtcbiAgICB2YXIgaWNvbk5hbWUgPSAncGxheSc7XG4gICAgdmFyIGltYWdlVGFnID0gZWwuZmluZCgnaW1nJyk7XG4gICAgdmFyIGZpbGVOYW1lID0gJ2F1ZGlvL3NhbXBsZTEud2F2JztcbiAgICBlbC5jbGljayggZnVuY3Rpb24oZXZ0KSB7XG4gICAgICBjb25zb2xlLmxvZygnQ0xJQ0shJyk7XG4gICAgICBwbGF5U2FtcGxlKGN0eC50b2tlbiwgaW1hZ2VUYWcsIGljb25OYW1lLCBmaWxlTmFtZSwgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdQbGF5IHNhbXBsZSByZXN1bHQnLCByZXN1bHQpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pKGN0eCk7XG5cbiAgKGZ1bmN0aW9uKCkge1xuICAgIHZhciBlbCA9ICQoJy5wbGF5LXNhbXBsZS0yJyk7XG4gICAgdmFyIGljb25OYW1lID0gJ3BsYXknO1xuICAgIHZhciBpbWFnZVRhZyA9IGVsLmZpbmQoJ2ltZycpO1xuICAgIHZhciBmaWxlTmFtZSA9ICdhdWRpby9zYW1wbGUyLndhdic7XG4gICAgZWwuY2xpY2soIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgY29uc29sZS5sb2coJ0NMSUNLIScpO1xuICAgICAgcGxheVNhbXBsZShjdHgudG9rZW4sIGltYWdlVGFnLCBpY29uTmFtZSwgZmlsZU5hbWUsIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBjb25zb2xlLmxvZygnUGxheSBzYW1wbGUgcmVzdWx0JywgcmVzdWx0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KShjdHgpO1xuXG59O1xuXG4iLCJcbmV4cG9ydHMuaW5pdFNlbGVjdE1vZGVsID0gZnVuY3Rpb24oY3R4KSB7XG5cbiAgZnVuY3Rpb24gaXNEZWZhdWx0KG1vZGVsKSB7XG4gICAgcmV0dXJuIG1vZGVsID09PSAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnO1xuICB9XG5cbiAgY3R4Lm1vZGVscy5mb3JFYWNoKGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgJChcInNlbGVjdCNkcm9wZG93bk1lbnUxXCIpLmFwcGVuZCggJChcIjxvcHRpb24+XCIpXG4gICAgICAudmFsKG1vZGVsLm5hbWUpXG4gICAgICAuaHRtbChtb2RlbC5kZXNjcmlwdGlvbilcbiAgICAgIC5wcm9wKCdzZWxlY3RlZCcsIGlzRGVmYXVsdChtb2RlbC5uYW1lKSlcbiAgICAgICk7XG4gIH0pO1xuXG4gICQoXCJzZWxlY3QjZHJvcGRvd25NZW51MVwiKS5jaGFuZ2UoZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIG1vZGVsTmFtZSA9ICQoXCJzZWxlY3QjZHJvcGRvd25NZW51MVwiKS52YWwoKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudE1vZGVsJywgbW9kZWxOYW1lKTtcbiAgfSk7XG5cbn1cbiIsIlxuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLmluaXRTZXNzaW9uUGVybWlzc2lvbnMgPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJ0luaXRpYWxpemluZyBzZXNzaW9uIHBlcm1pc3Npb25zIGhhbmRsZXInKTtcbiAgLy8gUmFkaW8gYnV0dG9uc1xuICB2YXIgc2Vzc2lvblBlcm1pc3Npb25zUmFkaW8gPSAkKFwiI3Nlc3Npb25QZXJtaXNzaW9uc1JhZGlvR3JvdXAgaW5wdXRbdHlwZT0ncmFkaW8nXVwiKTtcbiAgc2Vzc2lvblBlcm1pc3Npb25zUmFkaW8uY2xpY2soZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIGNoZWNrZWRWYWx1ZSA9IHNlc3Npb25QZXJtaXNzaW9uc1JhZGlvLmZpbHRlcignOmNoZWNrZWQnKS52YWwoKTtcbiAgICBjb25zb2xlLmxvZygnY2hlY2tlZFZhbHVlJywgY2hlY2tlZFZhbHVlKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnc2Vzc2lvblBlcm1pc3Npb25zJywgY2hlY2tlZFZhbHVlKTtcbiAgfSk7XG59XG4iLCJcblxuZXhwb3J0cy5zaG93RXJyb3IgPSBmdW5jdGlvbihtc2cpIHtcbiAgY29uc29sZS5sb2coJ3Nob3dpbmcgZXJyb3InKTtcbiAgdmFyIGVycm9yQWxlcnQgPSAkKCcuZXJyb3Itcm93Jyk7XG4gIGVycm9yQWxlcnQuaGlkZSgpO1xuICB2YXIgZXJyb3JNZXNzYWdlID0gJCgnI2Vycm9yTWVzc2FnZScpO1xuICBlcnJvck1lc3NhZ2UudGV4dChtc2cpO1xuICBlcnJvckFsZXJ0LnNob3coKTtcbiAgJCgnI2Vycm9yQ2xvc2UnKS5jbGljayhmdW5jdGlvbihlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGVycm9yQWxlcnQuaGlkZSgpO1xuICB9KTtcbn1cblxuZXhwb3J0cy5oaWRlRXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGVycm9yQWxlcnQgPSAkKCcuZXJyb3Itcm93Jyk7XG4gIGVycm9yQWxlcnQuaGlkZSgpO1xufVxuIiwiXG5cbmV4cG9ydHMuaW5pdFNob3dUYWIgPSBmdW5jdGlvbigpIHtcbiAgJCgnI25hdi10YWJzIGEnKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uIChlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgJCh0aGlzKS50YWIoJ3Nob3cnKVxuICB9KTtcbn1cbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgSUJNIENvcnAuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuLypnbG9iYWwgJDpmYWxzZSAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8vIFRPRE86IHJlZmFjdG9yIHRoaXMgaW50byBtdWx0aXBsZSBzbWFsbGVyIG1vZHVsZXNcblxudmFyIE1pY3JvcGhvbmUgPSByZXF1aXJlKCcuL01pY3JvcGhvbmUnKTtcbnZhciBtb2RlbHMgPSByZXF1aXJlKCcuL2RhdGEvbW9kZWxzLmpzb24nKS5tb2RlbHM7XG52YXIgaW5pdFZpZXdzID0gcmVxdWlyZSgnLi92aWV3cycpLmluaXRWaWV3cztcbnZhciBzaG93RXJyb3IgPSByZXF1aXJlKCcuL3ZpZXdzL3Nob3dlcnJvcicpLnNob3dFcnJvcjtcbnZhciBoaWRlRXJyb3IgPSByZXF1aXJlKCcuL3ZpZXdzL3Nob3dlcnJvcicpLmhpZGVFcnJvcjtcbnZhciBpbml0U29ja2V0ID0gcmVxdWlyZSgnLi9zb2NrZXQnKS5pbml0U29ja2V0O1xudmFyIGhhbmRsZUZpbGVVcGxvYWQgPSByZXF1aXJlKCcuL2ZpbGV1cGxvYWQnKS5oYW5kbGVGaWxlVXBsb2FkO1xudmFyIGRpc3BsYXkgPSByZXF1aXJlKCcuL3ZpZXdzL2Rpc3BsYXknKTtcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnZhciBlZmZlY3RzID0gcmVxdWlyZSgnLi92aWV3cy9lZmZlY3RzJyk7XG52YXIgcGtnID0gcmVxdWlyZSgnLi4vcGFja2FnZScpO1xuXG52YXIgQlVGRkVSU0laRSA9IDgxOTI7XG5cbiQoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCkge1xuXG4gIC8vIFRlbXBvcmFyeSBhcHAgZGF0YVxuICAkKCcjYXBwU2V0dGluZ3MnKVxuICAgIC5odG1sKFxuICAgICAgJzxwPlZlcnNpb246ICcgKyBwa2cudmVyc2lvbiArICc8L3A+J1xuICAgICAgKyAnPHA+QnVmZmVyIFNpemU6ICcgKyBCVUZGRVJTSVpFICsgJzwvcD4nXG4gICAgKTtcblxuICAvLyBUZW1wb3JhcnkgdG9wLXNjb3BlIHZhcmlhYmxlXG4gIHZhciBtaWNTb2NrZXQ7XG5cbiAgZnVuY3Rpb24gaGFuZGxlTWljcm9waG9uZSh0b2tlbiwgbW9kZWwsIG1pYywgY2FsbGJhY2spIHtcblxuICAgIHZhciBjdXJyZW50TW9kZWwgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudE1vZGVsJyk7XG4gICAgaWYgKGN1cnJlbnRNb2RlbC5pbmRleE9mKCdOYXJyb3diYW5kJykgPiAtMSkge1xuICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignTWljcm9waG9uZSBjYW5ub3QgYWNjb21vZGF0ZSBuYXJyb3cgYmFuZCBtb2RlbHMsIHBsZWFzZSBzZWxlY3QgYW5vdGhlcicpO1xuICAgICAgY2FsbGJhY2soZXJyLCBudWxsKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gVGVzdCBvdXQgd2Vic29ja2V0XG4gICAgdmFyIGJhc2VTdHJpbmcgPSAnJztcbiAgICB2YXIgYmFzZUpTT04gPSAnJztcblxuICAgIHZhciBvcHRpb25zID0ge307XG4gICAgb3B0aW9ucy50b2tlbiA9IHRva2VuO1xuICAgIG9wdGlvbnMubWVzc2FnZSA9IHtcbiAgICAgICdhY3Rpb24nOiAnc3RhcnQnLFxuICAgICAgJ2NvbnRlbnQtdHlwZSc6ICdhdWRpby9sMTY7cmF0ZT0xNjAwMCcsXG4gICAgICAnaW50ZXJpbV9yZXN1bHRzJzogdHJ1ZSxcbiAgICAgICdjb250aW51b3VzJzogdHJ1ZSxcbiAgICAgICd3b3JkX2NvbmZpZGVuY2UnOiB0cnVlLFxuICAgICAgJ3RpbWVzdGFtcHMnOiB0cnVlLFxuICAgICAgJ21heF9hbHRlcm5hdGl2ZXMnOiAzXG4gICAgfTtcbiAgICBvcHRpb25zLm1vZGVsID0gbW9kZWw7XG5cbiAgICBmdW5jdGlvbiBvbk9wZW4oc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZygnc29ja2V0IG9wZW5lZCcpO1xuICAgICAgY2FsbGJhY2sobnVsbCwgc29ja2V0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkxpc3RlbmluZyhzb2NrZXQpIHtcblxuICAgICAgbWljU29ja2V0ID0gc29ja2V0O1xuXG4gICAgICBtaWMub25BdWRpbyA9IGZ1bmN0aW9uKGJsb2IpIHtcbiAgICAgICAgaWYgKHNvY2tldC5yZWFkeVN0YXRlIDwgMikge1xuICAgICAgICAgIHNvY2tldC5zZW5kKGJsb2IpXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25NZXNzYWdlKG1zZywgc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZygnTWljIHNvY2tldCBtc2c6ICcsIG1zZyk7XG4gICAgICBpZiAobXNnLnJlc3VsdHMpIHtcbiAgICAgICAgLy8gQ29udmVydCB0byBjbG9zdXJlIGFwcHJvYWNoXG4gICAgICAgIGJhc2VTdHJpbmcgPSBkaXNwbGF5LnNob3dSZXN1bHQobXNnLCBiYXNlU3RyaW5nKTtcbiAgICAgICAgYmFzZUpTT04gPSBkaXNwbGF5LnNob3dKU09OKG1zZywgYmFzZUpTT04pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uRXJyb3Iociwgc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZygnTWljIHNvY2tldCBlcnI6ICcsIGVycik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25DbG9zZShldnQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdNaWMgc29ja2V0IGNsb3NlOiAnLCBldnQpO1xuICAgIH1cblxuICAgIGluaXRTb2NrZXQob3B0aW9ucywgb25PcGVuLCBvbkxpc3RlbmluZywgb25NZXNzYWdlLCBvbkVycm9yLCBvbkNsb3NlKTtcblxuICB9XG5cbiAgLy8gTWFrZSBjYWxsIHRvIEFQSSB0byB0cnkgYW5kIGdldCB0b2tlblxuICB2YXIgdXJsID0gJy90b2tlbic7XG4gIHZhciB0b2tlblJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgdG9rZW5SZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgdXJsLCB0cnVlKTtcbiAgdG9rZW5SZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKGV2dCkge1xuXG4gICAgd2luZG93Lm9uYmVmb3JldW5sb2FkID0gZnVuY3Rpb24oZSkge1xuICAgICAgbG9jYWxTdG9yYWdlLmNsZWFyKCk7XG4gICAgfTtcblxuICAgIHZhciB0b2tlbiA9IHRva2VuUmVxdWVzdC5yZXNwb25zZVRleHQ7XG4gICAgY29uc29sZS5sb2coJ1Rva2VuICcsIGRlY29kZVVSSUNvbXBvbmVudCh0b2tlbikpO1xuXG4gICAgdmFyIG1pY09wdGlvbnMgPSB7XG4gICAgICBidWZmZXJTaXplOiBCVUZGRVJTSVpFXG4gICAgfTtcbiAgICB2YXIgbWljID0gbmV3IE1pY3JvcGhvbmUobWljT3B0aW9ucyk7XG5cbiAgICB2YXIgbW9kZWxPcHRpb25zID0ge1xuICAgICAgdG9rZW46IHRva2VuXG4gICAgICAgIC8vIFVuY29tbWVudCBpbiBjYXNlIG9mIHNlcnZlciBDT1JTIGZhaWx1cmVcbiAgICAgICAgLy8gdXJsOiAnL2FwaS9tb2RlbHMnXG4gICAgfTtcblxuICAgIC8vIEdldCBhdmFpbGFibGUgc3BlZWNoIHJlY29nbml0aW9uIG1vZGVsc1xuICAgIC8vIFNldCB0aGVtIGluIHN0b3JhZ2VcbiAgICAvLyBBbmQgZGlzcGxheSB0aGVtIGluIGRyb3AtZG93blxuICAgIGNvbnNvbGUubG9nKCdTVFQgTW9kZWxzICcsIG1vZGVscyk7XG5cbiAgICAvLyBTYXZlIG1vZGVscyB0byBsb2NhbHN0b3JhZ2VcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbW9kZWxzJywgSlNPTi5zdHJpbmdpZnkobW9kZWxzKSk7XG5cbiAgICAvLyBTZXQgZGVmYXVsdCBjdXJyZW50IG1vZGVsXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRNb2RlbCcsICdlbi1VU19Ccm9hZGJhbmRNb2RlbCcpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzZXNzaW9uUGVybWlzc2lvbnMnLCAndHJ1ZScpO1xuXG5cbiAgICAvLyBJTklUSUFMSVpBVElPTlxuICAgIC8vIFNlbmQgbW9kZWxzIGFuZCBvdGhlclxuICAgIC8vIHZpZXcgY29udGV4dCB0byB2aWV3c1xuICAgIHZhciB2aWV3Q29udGV4dCA9IHtcbiAgICAgIG1vZGVsczogbW9kZWxzLFxuICAgICAgdG9rZW46IHRva2VuXG4gICAgfTtcbiAgICBpbml0Vmlld3Modmlld0NvbnRleHQpO1xuICAgIHV0aWxzLmluaXRQdWJTdWIoKTtcblxuXG4gICAgZnVuY3Rpb24gaGFuZGxlU2VsZWN0ZWRGaWxlKGZpbGUpIHtcblxuICAgICAgdmFyIGN1cnJlbnRseURpc3BsYXlpbmcgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJykpO1xuICAgICAgXG4gICAgICBpZiAoY3VycmVudGx5RGlzcGxheWluZykge1xuICAgICAgICBzaG93RXJyb3IoJ1RyYW5zY3JpcHRpb24gdW5kZXJ3YXksIHBsZWFzZSBjbGljayBzdG9wIG9yIHdhaXQgdW50aWwgZmluaXNoZWQgdG8gdXBsb2FkIGFub3RoZXIgZmlsZScpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgdHJ1ZSk7XG4gICAgICBoaWRlRXJyb3IoKTtcblxuICAgICAgLy8gVmlzdWFsIGVmZmVjdHNcbiAgICAgIHZhciB1cGxvYWRJbWFnZVRhZyA9ICQoJyNmaWxlVXBsb2FkVGFyZ2V0ID4gaW1nJyk7XG4gICAgICB2YXIgdGltZXIgPSBzZXRJbnRlcnZhbChlZmZlY3RzLnRvZ2dsZUltYWdlLCA3NTAsIHVwbG9hZEltYWdlVGFnLCAnc3RvcCcpO1xuICAgICAgdmFyIHVwbG9hZFRleHQgPSAkKCcjZmlsZVVwbG9hZFRhcmdldCA+IHNwYW4nKTtcbiAgICAgIHVwbG9hZFRleHQudGV4dCgnU3RvcCBUcmFuc2NyaWJpbmcnKTtcblxuICAgICAgLy8gQ2xlYXIgZmxhc2hpbmcgaWYgc29ja2V0IHVwbG9hZCBpcyBzdG9wcGVkXG4gICAgICAkLnN1YnNjcmliZSgnc3RvcHNvY2tldCcsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG4gICAgICAgIGVmZmVjdHMucmVzdG9yZUltYWdlKHVwbG9hZEltYWdlVGFnLCAndXBsb2FkJyk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgICB1cGxvYWRUZXh0LnRleHQoJ1NlbGVjdCBGaWxlJyk7XG4gICAgICB9KTtcblxuXG4gICAgICAvLyBHZXQgY3VycmVudCBtb2RlbFxuICAgICAgdmFyIGN1cnJlbnRNb2RlbCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50TW9kZWwnKTtcbiAgICAgIGNvbnNvbGUubG9nKCdjdXJyZW50TW9kZWwnLCBjdXJyZW50TW9kZWwpO1xuXG4gICAgICAvLyBSZWFkIGZpcnN0IDQgYnl0ZXMgdG8gZGV0ZXJtaW5lIGhlYWRlclxuICAgICAgdmFyIGJsb2JUb1RleHQgPSBuZXcgQmxvYihbZmlsZV0pLnNsaWNlKDAsIDQpO1xuICAgICAgdmFyIHIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgci5yZWFkQXNUZXh0KGJsb2JUb1RleHQpO1xuICAgICAgci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGNvbnRlbnRUeXBlID0gci5yZXN1bHQgPT09ICdmTGFDJyA/ICdhdWRpby9mbGFjJyA6ICdhdWRpby93YXYnO1xuICAgICAgICBjb25zb2xlLmxvZygnVXBsb2FkaW5nIGZpbGUnLCByLnJlc3VsdCk7XG4gICAgICAgIGhhbmRsZUZpbGVVcGxvYWQodG9rZW4sIGN1cnJlbnRNb2RlbCwgZmlsZSwgY29udGVudFR5cGUsIGZ1bmN0aW9uKHNvY2tldCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdyZWFkaW5nIGZpbGUnKTtcblxuICAgICAgICAgICAgdmFyIGJsb2IgPSBuZXcgQmxvYihbZmlsZV0pO1xuICAgICAgICAgICAgdmFyIHBhcnNlT3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgZmlsZTogYmxvYlxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHV0aWxzLm9uRmlsZVByb2dyZXNzKHBhcnNlT3B0aW9ucyxcbiAgICAgICAgICAgICAgLy8gT24gZGF0YSBjaHVua1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKGNodW5rKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0hhbmRsaW5nIGNodW5rJywgY2h1bmspO1xuICAgICAgICAgICAgICAgIHNvY2tldC5zZW5kKGNodW5rKTtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgLy8gT24gZmlsZSByZWFkIGVycm9yXG4gICAgICAgICAgICAgIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdFcnJvciByZWFkaW5nIGZpbGU6ICcsIGV2dC5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICBzaG93RXJyb3IoZXZ0Lm1lc3NhZ2UpO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAvLyBPbiBsb2FkIGVuZFxuICAgICAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7J2FjdGlvbic6ICdzdG9wJ30pKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBcbiAgICAgICAgICBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgICAgIGVmZmVjdHMuc3RvcFRvZ2dsZUltYWdlKHRpbWVyLCB1cGxvYWRJbWFnZVRhZywgJ3VwbG9hZCcpO1xuICAgICAgICAgICAgdXBsb2FkVGV4dC50ZXh0KCdTZWxlY3QgRmlsZScpO1xuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZygnc2V0dGluZyB0YXJnZXQnKTtcblxuICAgIHZhciBkcmFnQW5kRHJvcFRhcmdldCA9ICQoZG9jdW1lbnQpO1xuICAgIGRyYWdBbmREcm9wVGFyZ2V0Lm9uKCdkcmFnZW50ZXInLCBmdW5jdGlvbiAoZSkge1xuICAgICAgY29uc29sZS5sb2coJ2RyYWdlbnRlcicpO1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB9KTtcblxuICAgIGRyYWdBbmREcm9wVGFyZ2V0Lm9uKCdkcmFnb3ZlcicsIGZ1bmN0aW9uIChlKSB7XG4gICAgICBjb25zb2xlLmxvZygnZHJhZ292ZXInKTtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfSk7XG5cbiAgICBkcmFnQW5kRHJvcFRhcmdldC5vbignZHJvcCcsIGZ1bmN0aW9uIChlKSB7XG4gICAgICBjb25zb2xlLmxvZygnRmlsZSBkcm9wcGVkJyk7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB2YXIgZXZ0ID0gZS5vcmlnaW5hbEV2ZW50O1xuICAgICAgLy8gSGFuZGxlIGRyYWdnZWQgZmlsZSBldmVudFxuICAgICAgaGFuZGxlRmlsZVVwbG9hZEV2ZW50KGV2dCk7XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBoYW5kbGVGaWxlVXBsb2FkRXZlbnQoZXZ0KSB7XG4gICAgICBjb25zb2xlLmxvZygnaGFuZGxpbmcgZmlsZSBkcm9wIGV2ZW50Jyk7XG4gICAgICAvLyBJbml0IGZpbGUgdXBsb2FkIHdpdGggZGVmYXVsdCBtb2RlbFxuICAgICAgdmFyIGZpbGUgPSBldnQuZGF0YVRyYW5zZmVyLmZpbGVzWzBdO1xuICAgICAgaGFuZGxlU2VsZWN0ZWRGaWxlKGZpbGUpO1xuICAgIH1cblxuICAgIHZhciBmaWxlVXBsb2FkRGlhbG9nID0gJChcIiNmaWxlVXBsb2FkRGlhbG9nXCIpO1xuXG4gICAgZmlsZVVwbG9hZERpYWxvZy5jaGFuZ2UoZnVuY3Rpb24oZXZ0KSB7XG4gICAgICB2YXIgZmlsZSA9IGZpbGVVcGxvYWREaWFsb2cuZ2V0KDApLmZpbGVzWzBdO1xuICAgICAgY29uc29sZS5sb2coJ2ZpbGUgdXBsb2FkIScsIGZpbGUpO1xuICAgICAgaGFuZGxlU2VsZWN0ZWRGaWxlKGZpbGUpO1xuICAgIH0pO1xuXG4gICAgJChcIiNmaWxlVXBsb2FkVGFyZ2V0XCIpLmNsaWNrKGZ1bmN0aW9uKGV2dCkge1xuICAgICAgdmFyIGN1cnJlbnRseURpc3BsYXlpbmcgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJykpO1xuICAgICAgaWYgKGN1cnJlbnRseURpc3BsYXlpbmcpIHtcbiAgICAgICAgJC5wdWJsaXNoKCdzdG9wc29ja2V0Jyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgZmlsZVVwbG9hZERpYWxvZ1xuICAgICAgLnRyaWdnZXIoJ2NsaWNrJyk7XG4gICAgfSk7XG5cblxuICAgIC8vIFNldCBtaWNyb3Bob25lIHN0YXRlIHRvIG5vdCBydW5uaW5nXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3J1bm5pbmcnLCBmYWxzZSk7XG5cbiAgICB2YXIgcmVjb3JkQnV0dG9uID0gJCgnI3JlY29yZEJ1dHRvbicpO1xuICAgIHJlY29yZEJ1dHRvbi5jbGljaygkLnByb3h5KGZ1bmN0aW9uKGV2dCkge1xuXG4gICAgICAvLyBQcmV2ZW50IGRlZmF1bHQgYW5jaG9yIGJlaGF2aW9yXG4gICAgICBldnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgdmFyIHJ1bm5pbmcgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdydW5uaW5nJykpO1xuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3J1bm5pbmcnLCAhcnVubmluZyk7XG5cbiAgICAgIGNvbnNvbGUubG9nKCdjbGljayEnKTtcblxuICAgICAgdmFyIGN1cnJlbnRNb2RlbCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50TW9kZWwnKTtcblxuICAgICAgY29uc29sZS5sb2coJ3J1bm5pbmcgc3RhdGUnLCBydW5uaW5nKTtcblxuICAgICAgaWYgKCFydW5uaW5nKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdOb3QgcnVubmluZywgaGFuZGxlTWljcm9waG9uZSgpJyk7XG4gICAgICAgIGhhbmRsZU1pY3JvcGhvbmUodG9rZW4sIGN1cnJlbnRNb2RlbCwgbWljLCBmdW5jdGlvbihlcnIsIHNvY2tldCkge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIHZhciBtc2cgPSBlcnIubWVzc2FnZTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdFcnJvcjogJywgbXNnKTtcbiAgICAgICAgICAgIHNob3dFcnJvcihtc2cpO1xuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3J1bm5pbmcnLCBmYWxzZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlY29yZEJ1dHRvbi5jc3MoJ2JhY2tncm91bmQtY29sb3InLCAnI2Q3NDEwOCcpO1xuICAgICAgICAgICAgcmVjb3JkQnV0dG9uLmZpbmQoJ2ltZycpLmF0dHIoJ3NyYycsICdpbWcvc3RvcC5zdmcnKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdzdGFydGluZyBtaWMnKTtcbiAgICAgICAgICAgIG1pYy5yZWNvcmQoKTtcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdydW5uaW5nJywgdHJ1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdTdG9wcGluZyBtaWNyb3Bob25lLCBzZW5kaW5nIHN0b3AgYWN0aW9uIG1lc3NhZ2UnKTtcbiAgICAgICAgcmVjb3JkQnV0dG9uLnJlbW92ZUF0dHIoJ3N0eWxlJyk7XG4gICAgICAgIHJlY29yZEJ1dHRvbi5maW5kKCdpbWcnKS5hdHRyKCdzcmMnLCAnaW1nL21pY3JvcGhvbmUuc3ZnJyk7XG4gICAgICAgIG1pY1NvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHsnYWN0aW9uJzogJ3N0b3AnfSkpO1xuICAgICAgICAvLyBDYW4gYWxzbyBzZW5kIGVtcHR5IGJ1ZmZlciB0byBzaWduYWwgZW5kXG4gICAgICAgIC8vIHZhciBlbXB0eUJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcigwKTtcbiAgICAgICAgLy8gbWljU29ja2V0LnNlbmQoZW1wdHlCdWZmZXIpO1xuICAgICAgICBtaWMuc3RvcCgpO1xuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgncnVubmluZycsIGZhbHNlKTtcbiAgICAgIH1cblxuXG4gICAgfSwgdGhpcykpO1xuICB9XG4gIHRva2VuUmVxdWVzdC5zZW5kKCk7XG5cbn0pO1xuXG4iXX0=
