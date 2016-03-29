(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
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
/* global OfflineAudioContext */
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
  this.samplesAll = new Float32Array(20000000);
  this.samplesAllOffset = 0;

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
Microphone.prototype.onMediaStream = function(stream) {
  var AudioCtx = window.AudioContext || window.webkitAudioContext;

  if (!AudioCtx)
    throw new Error('AudioContext not available');

  if (!this.audioContext)
    this.audioContext = new AudioCtx();

  var gain = this.audioContext.createGain();
  var audioInput = this.audioContext.createMediaStreamSource(stream);

  audioInput.connect(gain);

  if (!this.mic) {
    this.mic = this.audioContext.createScriptProcessor(this.bufferSize,
    this.inputChannels, this.outputChannels);
  }

  // uncomment the following line if you want to use your microphone sample rate
  // this.sampleRate = this.audioContext.sampleRate;
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

  // resampler(this.audioContext.sampleRate,data.inputBuffer,this.onAudio);

  this.saveData(new Float32Array(chan));
  this.onAudio(this._exportDataBufferTo16Khz(new Float32Array(chan)));

  // export with microphone mhz, remember to update the this.sampleRate
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
  navigator.getUserMedia({audio: true},
    this.onMediaStream.bind(this), // Microphone permission granted
    this.onPermissionRejected.bind(this)); // Microphone permission rejected
};

/**
 * Stop the audio recording
 */
Microphone.prototype.stop = function() {
  if (!this.recording)
    return;
  if (JSON.parse(localStorage.getItem('playback')))
    this.playWav(); /* plays back the audio that was recorded*/
  this.recording = false;
  this.stream.getTracks()[0].stop();
  this.requestedAccess = false;
  this.mic.disconnect(0);
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
    volume = 0x7FFF, // range from 0 to 0x7FFF to control the volume
    nOut = 0;

  // eslint-disable-next-line no-redeclare
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



// // native way of resampling captured audio
// var resampler = function(sampleRate, audioBuffer, callbackProcessAudio) {
//
//   console.log('length: ' + audioBuffer.length + ' ' + sampleRate);
//   var channels = 1;
//   var targetSampleRate = 16000;
//   var numSamplesTarget = audioBuffer.length * targetSampleRate / sampleRate;
//
//   var offlineContext = new OfflineAudioContext(channels, numSamplesTarget, targetSampleRate);
//   var bufferSource = offlineContext.createBufferSource();
//   bufferSource.buffer = audioBuffer;
//
//   // callback that is called when the resampling finishes
//   offlineContext.oncomplete = function(event) {
//     var samplesTarget = event.renderedBuffer.getChannelData(0);
//     console.log('Done resampling: ' + samplesTarget.length + ' samples produced');
//
//   // convert from [-1,1] range of floating point numbers to [-32767,32767] range of integers
//     var index = 0;
//     var volume = 0x7FFF;
//     var pcmEncodedBuffer = new ArrayBuffer(samplesTarget.length * 2);    // short integer to byte
//     var dataView = new DataView(pcmEncodedBuffer);
//     for (var i = 0; i < samplesTarget.length; i++) {
//       dataView.setInt16(index, samplesTarget[i] * volume, true);
//       index += 2;
//     }
//
//     // l16 is the MIME type for 16-bit PCM
//     callbackProcessAudio(new Blob([dataView], {type: 'audio/l16'}));
//   };
//
//   bufferSource.connect(offlineContext.destination);
//   bufferSource.start(0);
//   offlineContext.startRendering();
// };



/**
 * Creates a Blob type: 'audio/l16' with the
 * chunk coming from the microphone.
 */
// var exportDataBuffer = function(buffer, bufferSize) {
//   var pcmEncodedBuffer = null,
//     dataView = null,
//     index = 0,
//     volume = 0x7FFF; // range from 0 to 0x7FFF to control the volume
//
//   pcmEncodedBuffer = new ArrayBuffer(bufferSize * 2);
//   dataView = new DataView(pcmEncodedBuffer);
//
//   /* Explanation for the math: The raw values captured from the Web Audio API are
//    * in 32-bit Floating Point, between -1 and 1 (per the specification).
//    * The values for 16-bit PCM range between -32768 and +32767 (16-bit signed integer).
//    * Multiply to control the volume of the output. We store in little endian.
//    */
//   for (var i = 0; i < buffer.length; i++) {
//     dataView.setInt16(index, buffer[i] * volume, true);
//     index += 2;
//   }
//
//   // l16 is the MIME type for 16-bit PCM
//   return new Blob([dataView], {type: 'audio/l16'});
// };

Microphone.prototype._exportDataBuffer = function(buffer){
  utils.exportDataBuffer(buffer, this.bufferSize);
};


// Functions used to control Microphone events listeners.
Microphone.prototype.onStartRecording = function() {};
Microphone.prototype.onStopRecording = function() {};
Microphone.prototype.onAudio = function() {};

module.exports = Microphone;

Microphone.prototype.saveData = function(samples) {
  for (var i = 0; i < samples.length; ++i) {
    this.samplesAll[this.samplesAllOffset + i] = samples[i];
  }
  this.samplesAllOffset += samples.length;
  console.log('samples: ' + this.samplesAllOffset);
};

Microphone.prototype.playWav = function() {
  var samples = this.samplesAll.subarray(0, this.samplesAllOffset);
  var dataview = this.encodeWav(samples, 1, this.audioContext.sampleRate);
  var audioBlob = new Blob([dataview], {type: 'audio/l16'});
  var url = window.URL.createObjectURL(audioBlob);
  var audio = new Audio();
  audio.src = url;
  audio.play();
};

Microphone.prototype.encodeWav = function(samples, numChannels, sampleRate) {
  console.log('#samples: ' + samples.length);
  var buffer = new ArrayBuffer(44 + samples.length * 2);
  var view = new DataView(buffer);

  /* RIFF identifier */
  this.writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  this.writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  this.writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 4, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numChannels * 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  this.writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  this.floatTo16BitPCM(view, 44, samples);

  return view;
};

Microphone.prototype.writeString = function(view, offset, string){
  for (var i = 0; i < string.length; i++){
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

Microphone.prototype.floatTo16BitPCM = function(output, offset, input){
  for (var i = 0; i < input.length; i++, offset += 2){
    var s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
};

},{"./utils":8}],2:[function(require,module,exports){
module.exports={
   "models": [
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/ar-AR_BroadbandModel", 
         "rate": 16000, 
         "name": "ar-AR_BroadbandModel", 
         "language": "ar-AR", 
         "description": "Modern Standard Arabic broadband model."
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/en-UK_BroadbandModel", 
         "rate": 16000, 
         "name": "en-UK_BroadbandModel", 
         "language": "en-UK", 
         "description": "UK English broadband model."
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/en-UK_NarrowbandModel", 
         "rate": 8000, 
         "name": "en-UK_NarrowbandModel", 
         "language": "en-UK", 
         "description": "UK English narrowband model."
      },
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/en-US_BroadbandModel", 
         "rate": 16000, 
         "name": "en-US_BroadbandModel", 
         "language": "en-US", 
         "description": "US English broadband model."
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/en-US_NarrowbandModel", 
         "rate": 8000, 
         "name": "en-US_NarrowbandModel", 
         "language": "en-US", 
         "description": "US English narrowband model."
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/es-ES_BroadbandModel", 
         "rate": 16000, 
         "name": "es-ES_BroadbandModel", 
         "language": "es-ES", 
         "description": "Spanish broadband model."
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/es-ES_NarrowbandModel", 
         "rate": 8000, 
         "name": "es-ES_NarrowbandModel", 
         "language": "es-ES", 
         "description": "Spanish narrowband model."
      },
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/ja-JP_BroadbandModel", 
         "rate": 16000, 
         "name": "ja-JP_BroadbandModel", 
         "language": "ja-JP", 
         "description": "Japanese broadband model."
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/ja-JP_NarrowbandModel", 
         "rate": 8000, 
         "name": "ja-JP_NarrowbandModel", 
         "language": "ja-JP", 
         "description": "Japanese narrowband model."
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/pt-BR_BroadbandModel", 
         "rate": 16000, 
         "name": "pt-BR_BroadbandModel", 
         "language": "pt-BR", 
         "description": "Brazilian Portuguese broadband model."
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/pt-BR_NarrowbandModel", 
         "rate": 8000, 
         "name": "pt-BR_NarrowbandModel", 
         "language": "pt-BR", 
         "description": "Brazilian Portuguese narrowband model."
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/zh-CN_BroadbandModel", 
         "rate": 16000, 
         "name": "zh-CN_BroadbandModel", 
         "language": "zh-CN", 
         "description": "Mandarin broadband model."
      },
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/zh-CN_NarrowbandModel", 
         "rate": 8000, 
         "name": "zh-CN_NarrowbandModel", 
         "language": "zh-CN", 
         "description": "Mandarin narrowband model."
      } 
   ]
}
},{}],3:[function(require,module,exports){
/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
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
/* global $ */
'use strict';

var display = require('./views/displaymetadata');
var initSocket = require('./socket').initSocket;

exports.handleFileUpload = function(type, token, model, file, contentType, callback, onend) {
  // Set currentlyDisplaying to prevent other sockets from opening
  localStorage.setItem('currentlyDisplaying', type);

  $.subscribe('progress', function(evt, data) {
    console.log('progress: ', data);
  });

  console.log('contentType', contentType);

  var baseString = '';
  var baseJSON = '';

  $.subscribe('showjson', function() {
    var $resultsJSON = $('#resultsJSON');
    $resultsJSON.val(baseJSON);
  });

  var keywords = display.getKeywordsToSearch();
  var keywords_threshold = keywords.length == 0 ? null : 0.01;

  var options = {};
  options.token = token;
  options.message = {
    'action': 'start',
    'content-type': contentType,
    'interim_results': true,
    'continuous': true,
    'word_confidence': true,
    'timestamps': true,
    'max_alternatives': 3,
    'inactivity_timeout': 600,
    'word_alternatives_threshold': 0.001,
    'keywords_threshold': keywords_threshold,
    'keywords': keywords
  };
  options.model = model;

  function onOpen() {
    console.log('Socket opened');
  }

  function onListening(socket) {
    console.log('Socket listening');
    callback(socket);
  }

  function onMessage(msg) {
    if (msg.results) {
      // Convert to closure approach
      baseString = display.showResult(msg, baseString, model);
      baseJSON = JSON.stringify(msg, null, 2);
      display.showJSON(baseJSON);
    }
  }

  function onError(evt) {
    localStorage.setItem('currentlyDisplaying', 'false');
    onend(evt);
    console.log('Socket err: ', evt.code);
  }

  function onClose(evt) {
    localStorage.setItem('currentlyDisplaying', 'false');
    onend(evt);
    console.log('Socket closing: ', evt);
  }

  initSocket(options, onOpen, onListening, onMessage, onError, onClose);
};

},{"./socket":7,"./views/displaymetadata":10}],4:[function(require,module,exports){
/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
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
/* global $ */
'use strict';

var initSocket = require('./socket').initSocket;
var display = require('./views/displaymetadata');

exports.handleMicrophone = function(token, model, mic, callback) {

  if (model.indexOf('Narrowband') > -1) {
    var err = new Error('Microphone transcription cannot accomodate narrowband models, ' +
      'please select another');
    callback(err, null);
    return false;
  }

  $.publish('clearscreen');

  // Test out websocket
  var baseString = '';
  var baseJSON = '';

  $.subscribe('showjson', function() {
    var $resultsJSON = $('#resultsJSON');
    $resultsJSON.val(baseJSON);
  });

  var keywords = display.getKeywordsToSearch();
  var keywords_threshold = keywords.length == 0 ? null : 0.01;

  var options = {};
  options.token = token;
  options.message = {
    'action': 'start',
    'content-type': 'audio/l16;rate=16000',
    'interim_results': true,
    'continuous': true,
    'word_confidence': true,
    'timestamps': true,
    'max_alternatives': 3,
    'inactivity_timeout': 600,
    'word_alternatives_threshold': 0.001,
    'keywords_threshold': keywords_threshold,
    'keywords': keywords
  };
  options.model = model;

  function onOpen(socket) {
    console.log('Mic socket: opened');
    callback(null, socket);
  }

  function onListening(socket) {
    mic.onAudio = function(blob) {
      if (socket.readyState < 2) {
        socket.send(blob);
      }
    };
  }

  function onMessage(msg) {
    if (msg.results) {
      // Convert to closure approach
      baseString = display.showResult(msg, baseString, model);
      baseJSON = JSON.stringify(msg, null, 2);
      display.showJSON(baseJSON);
    }
  }

  function onError() {
    console.log('Mic socket err: ', err);
  }

  function onClose(evt) {
    console.log('Mic socket close: ', evt);
  }

  initSocket(options, onOpen, onListening, onMessage, onError, onClose);
};

},{"./socket":7,"./views/displaymetadata":10}],5:[function(require,module,exports){
/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
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
/* global $:false, BUFFERSIZE */

'use strict';

var models = require('./data/models.json').models;
var utils = require('./utils');
utils.initPubSub();
var initViews = require('./views').initViews;
var showerror = require('./views/showerror');
var showError = showerror.showError;
var getModels = require('./models').getModels;

window.BUFFERSIZE = 8192;

$(document).ready(function() {
  var tokenGenerator = utils.createTokenGenerator();

  // Make call to API to try and get token
  tokenGenerator.getToken(function(err, token) {
    window.onbeforeunload = function() {
      localStorage.clear();
    };

    if (!token) {
      console.error('No authorization token available');
      console.error('Attempting to reconnect...');

      if (err && err.code)
        showError('Server error ' + err.code + ': ' + err.error);
      else
        showError('Server error ' + err.code + ': please refresh your browser and try again');
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

    // Check if playback functionality is invoked
    localStorage.setItem('playbackON', false);
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split('=');
      if (decodeURIComponent(pair[0]) === 'debug') {
        localStorage.setItem('playbackON',decodeURIComponent(pair[1]));
      }
    }

    // Set default current model
    localStorage.setItem('currentModel', 'en-US_BroadbandModel');
    localStorage.setItem('sessionPermissions', 'true');

    getModels(token);

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

},{"./data/models.json":2,"./models":6,"./utils":8,"./views":14,"./views/showerror":19}],6:[function(require,module,exports){
/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
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
'use strict';
var selectModel = require('./views/selectmodel').initSelectModel;

exports.getModels = function(token) {
  var viewContext = {
    currentModel: 'en-US_BroadbandModel',
    models: null,
    token: token,
    bufferSize: BUFFERSIZE
  };
  var modelUrl = 'https://stream.watsonplatform.net/speech-to-text/api/v1/models';
  var sttRequest = new XMLHttpRequest();
  sttRequest.open('GET', modelUrl, true);
  sttRequest.withCredentials = true;
  sttRequest.setRequestHeader('Accept', 'application/json');
  sttRequest.setRequestHeader('X-Watson-Authorization-Token', token);
  sttRequest.onload = function() {
    var response = JSON.parse(sttRequest.responseText);
    var sorted = response.models.sort(function(a,b) {
      if (a.name > b.name) {
        return 1;
      }
      if (a.name < b.name) {
        return -1;
      }
      return 0;
    });
    response.models = sorted;
    localStorage.setItem('models', JSON.stringify(response.models));
    viewContext.models = response.models;
    selectModel(viewContext);
  };
  sttRequest.onerror = function() {
    viewContext.models = require('./data/models.json').models;
    selectModel(viewContext);
  };
  sttRequest.send();
};

},{"./data/models.json":2,"./views/selectmodel":17}],7:[function(require,module,exports){
/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
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
/* global $:false */

'use strict';

var utils = require('./utils');
var showerror = require('./views/showerror');
var showError = showerror.showError;

// Mini WS callback API, so we can initialize
// with model and token in URI, plus
// start message

// Initialize closure, which holds maximum getToken call count
var tokenGenerator = utils.createTokenGenerator();

var initSocket = exports.initSocket = function(options, onopen, onlistening, onmessage, onerror, onclose) {
  var listening;
  // function withDefault(val, defaultVal) {
  //   return typeof val === 'undefined' ? defaultVal : val;
  // }
  var socket;
  var token = options.token;
  var model = options.model || localStorage.getItem('currentModel');
  var message = options.message || {'action': 'start'};
  // var sessionPermissions = withDefault(options.sessionPermissions,
  //   JSON.parse(localStorage.getItem('sessionPermissions')));
  // var sessionPermissionsQueryParam = sessionPermissions ? '0' : '1';
  // TODO: add '&X-Watson-Learning-Opt-Out=' + sessionPermissionsQueryParam once
  // we find why it's not accepted as query parameter
  // var url = options.serviceURI || 'wss://stream-d.watsonplatform.net/speech-to-text/api/v1/recognize?watson-token=';
  var url = options.serviceURI || 'wss://stream.watsonplatform.net/speech-to-text/api/v1/recognize?watson-token=';
  url += token + '&model=' + model;
  console.log('URL model', model);
  try {
    socket = new WebSocket(url);
  } catch (err) {
    console.error('WS connection error: ', err);
  }
  socket.onopen = function() {
    listening = false;
    $.subscribe('hardsocketstop', function() {
      console.log('MICROPHONE: close.');
      socket.send(JSON.stringify({action:'stop'}));
      socket.close();
    });
    $.subscribe('socketstop', function() {
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
        throw new Error('No authorization token is currently available');
      }
      tokenGenerator.getToken(function(err, token) {
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
      return false;
    }
    // Made it through, normal close
    $.unsubscribe('hardsocketstop');
    $.unsubscribe('socketstop');
    onclose(evt);
  };

};

},{"./utils":8,"./views/showerror":19}],8:[function(require,module,exports){
(function (global){
/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
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

'use strict';

// For non-view logic
var $ = (typeof window !== "undefined" ? window['jQuery'] : typeof global !== "undefined" ? global['jQuery'] : null);

var fileBlock = function(_offset, length, _file, readChunk) {
  var r = new FileReader();
  var blob = _file.slice(_offset, length + _offset);
  r.onload = readChunk;
  r.readAsArrayBuffer(blob);
};

// Based on alediaferia's SO response
// http://stackoverflow.com/questions/14438187/javascript-filereader-parsing-long-file-in-chunks
exports.onFileProgress = function(options, ondata, running, onerror, onend, samplingRate) {
  var file = options.file;
  var fileSize = file.size;
  var chunkSize = options.bufferSize || 16000;  // in bytes
  var offset = 0;
  var readChunk = function(evt) {
    if (offset >= fileSize) {
      console.log('Done reading file');
      onend();
      return;
    }
    if (!running()) {
      return;
    }
    if (evt.target.error == null) {
      var buffer = evt.target.result;
      var len = buffer.byteLength;
      offset += len;
      // console.log('sending: ' + len);
      ondata(buffer); // callback for handling read chunk
    } else {
      var errorMessage = evt.target.error;
      console.log('Read error: ' + errorMessage);
      onerror(errorMessage);
      return;
    }
    // use this timeout to pace the data upload for the playSample case,
    // the idea is that the hyps do not arrive before the audio is played back
    if (samplingRate) {
      // console.log('samplingRate: ' +
      //  samplingRate + ' timeout: ' + (chunkSize * 1000) / (samplingRate * 2));
      setTimeout(function() {
        fileBlock(offset, chunkSize, file, readChunk);
      }, (chunkSize * 1000) / (samplingRate * 2));
    } else {
      fileBlock(offset, chunkSize, file, readChunk);
    }
  };
  fileBlock(offset, chunkSize, file, readChunk);
};

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
      var url = '/api/token';
      var tokenRequest = new XMLHttpRequest();
      tokenRequest.open('POST', url, true);
      tokenRequest.setRequestHeader('csrf-token',$('meta[name="ct"]').attr('content'));
      tokenRequest.onreadystatechange = function() {
        if (tokenRequest.readyState === 4) {
          if (tokenRequest.status === 200) {
            var token = tokenRequest.responseText;
            callback(null, token);
          } else {
            var error = 'Cannot reach server';
            if (tokenRequest.responseText){
              try {
                error = JSON.parse(tokenRequest.responseText);
              } catch (e) {
                error = tokenRequest.responseText;
              }
            }
            callback(error);
          }
        }
      };
      tokenRequest.send();
    },
    getCount: function() { return hasBeenRunTimes; }
  };
};

exports.initPubSub = function() {
  var o = $({});
  $.subscribe = o.on.bind(o);
  $.unsubscribe = o.off.bind(o);
  $.publish = o.trigger.bind(o);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

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
/* global $ */
'use strict';

/* eslint no-invalid-this: 0*/

exports.initAnimatePanel = function() {
  $('.panel-heading span.clickable').on('click', function() {
    if ($(this).hasClass('panel-collapsed')) {
      // expand the panel
      $(this).parents('.panel').find('.panel-body').slideDown();
      $(this).removeClass('panel-collapsed');
      $(this).find('i').removeClass('caret-down').addClass('caret-up');
    } else {
      // collapse the panel
      $(this).parents('.panel').find('.panel-body').slideUp();
      $(this).addClass('panel-collapsed');
      $(this).find('i').removeClass('caret-up').addClass('caret-down');
    }
  });
};

},{}],10:[function(require,module,exports){
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
/* global $ */
/* eslint no-invalid-this: 0, brace-style: 0, dot-notation: 0, spaced-comment:0 */
'use strict';

const INITIAL_OFFSET_X = 30;
const INITIAL_OFFSET_Y = 30;
const fontSize = 16;
const delta_y = 2 * fontSize;
const radius = 5;
const space = 4;
const hstep = 32;
const timeout = 500;
const defaultFont = fontSize + 'px Arial';
const boldFont = 'bold ' + fontSize + 'px Arial';
const italicFont = 'italic ' + fontSize + 'px Arial';
const opacity = '0.6';

var showAllHypotheses = true;
var keywordsInputDirty = false;
var keywords_to_search = [];
var detected_keywords = {};
var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
var hslider = document.getElementById('hslider');
var vslider = document.getElementById('vslider');
var leftArrowEnabled = false;
var rightArrowEnabled = false;
var worker = null;
var runTimer = false;
var scrolled = false;
// var textScrolled = false;
var pushed = 0;
var popped = 0;

ctx.font = defaultFont;

// -----------------------------------------------------------
// class WordAlternative
var WordAlternative = function(text, confidence) {
  if (text == '<eps>') {
    this._text = '<silence>';
    this._foreColor = '#888';
  }
  else if (text == '%HESITATION') {
    this._text = '<hesitation>';
    this._foreColor = '#888';
  }
  else {
    this._foreColor = '#000';
    this._text = text;
  }
  this._confidence = confidence;
  this._height = 2 * fontSize;
  ctx.font = defaultFont;
  this._width = ctx.measureText(this._text + ((this._confidence.toFixed(3) * 100).toFixed(1)) + '%').width + 60;
  this._fillStyle = '#f4f4f4';
  this._selectedFillStyle = '#e3e3e3';
  this._selected = false;
};

WordAlternative.prototype.width = function() {
  return this._width;
};

WordAlternative.prototype.height = function() {
  return this._height;
};

WordAlternative.prototype.width = function() {
  return this._width;
};

WordAlternative.prototype.select = function() {
  this._selected = true;
};

WordAlternative.prototype.unselect = function() {
  this._selected = false;
};

WordAlternative.prototype.draw = function(x, y, width) {
  ctx.fillStyle = this._selected ? this._selectedFillStyle : this._fillStyle;
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#d3d3d3';
  ctx.fillRect(x, y, width, this.height());
  ctx.strokeRect(x, y, width, this.height());

  ctx.fillStyle = this._foreColor;
  ctx.font = this._selected ? boldFont : defaultFont;
  ctx.fillText(this._text, x + 16, y + 20);
  ctx.font = italicFont;
  const appendix = (this._confidence.toFixed(3) * 100).toFixed(1) + '%';
  const rightOffset = ctx.measureText(appendix).width + 32;
  ctx.fillText(appendix, x + 16 + width - rightOffset, y + 20);
  ctx.font = defaultFont;
};

// -----------------------------------------------------------
// class Bin
var Bin = function(startTime, endTime) {
  this._connectorWidth = 40;
  this._startTime = startTime;
  this._endTime = endTime;
  this._wordAlternatives = [];
  this._maxWordAlternativeWidth = 0;
  this._height = 0;
  this._index = 0;
};

Bin.prototype.addWordAlternative = function(wa) {
  this._wordAlternatives.push(wa);
  for (var index = 0; index < this._wordAlternatives.length; index++) {
    var width = this._wordAlternatives[index].width();
    if (width > this._maxWordAlternativeWidth)
      this._maxWordAlternativeWidth = width;
  }
  this._height += wa.height();
};

Bin.prototype.height = function() {
  return this._height;
};

Bin.prototype.width = function() {
  return this._maxWordAlternativeWidth + 2 * this._connectorWidth;
};

Bin.prototype.draw = function(x, y) {
  for (var index = 0; index < this._wordAlternatives.length; index++) {
    var wa = this._wordAlternatives[index];
    wa.draw(x + this._connectorWidth, y + delta_y * (index + 1), this._maxWordAlternativeWidth);
    if (showAllHypotheses == false)
      break;
  }

  ctx.moveTo(x + space + radius, y + fontSize);
  if (this._wordAlternatives.length > 0) {
    ctx.strokeStyle = '#4178BE';
    ctx.lineWidth = 2;
    ctx.lineTo(x + this.width() - (space + radius), y + fontSize);
    ctx.stroke();
  }
};

// -----------------------------------------------------------
// class Scene
var Scene = function() {
  this._bins = [];
  this._offset_X = INITIAL_OFFSET_X;
  this._offset_Y = INITIAL_OFFSET_Y;
  this._width = 0;
  this._height = 0;
  this._shift = 100;
};

Scene.prototype.draw = function() {
  var x = this._offset_X;
  var y = this._offset_Y;
  var last_bin_end_time = 0;

  for (var index = 0; index < this._bins.length; index++) {
    var bin = this._bins[index];
    var x_visible = Math.abs(x) <= canvas.width;
    ctx.beginPath();

    if (bin._startTime > last_bin_end_time) {
      if (x_visible) {
        ctx.moveTo(x + radius + space, y + fontSize);
      }
      if (last_bin_end_time > 0) {
        x += this._shift;
        if (x_visible) {
          ctx.strokeStyle = '#4178BE';
          ctx.lineWidth = 2;
          ctx.lineTo(x - (radius + space), y + fontSize);
          ctx.stroke();
        }
      }
      if (x_visible) {
        ctx.moveTo(x + radius, y + fontSize);
        ctx.lineWidth = 2;
        ctx.arc(x, y + fontSize, radius, 0, 2 * Math.PI, false);
        var start_time_caption = bin._startTime + ' s';
        var start_time_shift = ctx.measureText(start_time_caption).width / 2;
        ctx.fillText(start_time_caption, x - start_time_shift, y);
        ctx.stroke();
      }
    }

    if (x_visible) {
      bin.draw(x, y);
      ctx.moveTo(x + bin.width() + radius, y + fontSize);
      ctx.strokeStyle = '#4178BE';
      ctx.lineWidth = 2;
      ctx.arc(x + bin.width(), y + fontSize, radius, 0, 2 * Math.PI, false);
      ctx.stroke();
      var end_time_caption = bin._endTime + ' s';
      var end_time_shift = ctx.measureText(end_time_caption).width / 2;
      ctx.fillText(end_time_caption, x + bin.width() - end_time_shift, y);
      ctx.stroke();
    }

    last_bin_end_time = bin._endTime;
    x += bin.width();
    ctx.closePath();
  }
};

Scene.prototype.addBin = function(bin) {
  bin._index = this._bins.length;
  this._bins.push(bin);
  var width = 2 * INITIAL_OFFSET_X;
  var last_bin_end_time = 0;
  for (var index = 0; index < this._bins.length; index++) {
    // eslint-disable-next-line no-redeclare
    var bin = this._bins[index];
    if (bin._startTime > last_bin_end_time && last_bin_end_time > 0) {
      width += this._shift;
    }
    last_bin_end_time = bin._endTime;
    width += bin.width();
    if (this._height < bin.height()) {
      this._height = bin.height();
      vslider.min = canvas.height - this._height - 2.5 * INITIAL_OFFSET_Y;
    }
  }
  this._width = width;
};

Scene.prototype.width = function() {
  return this._width + 2 * this._shift;
};

Scene.prototype.height = function() {
  return this._height;
};

Scene.prototype.findBins = function(start_time, end_time) {
  var foundBins = [];
  for (var index = 0; index < this._bins.length; index++) {
    var bin = this._bins[index];
    var binStartTime = bin._startTime;
    var binEndTime = bin._endTime;
    if (binStartTime >= start_time && binEndTime <= end_time) {
      foundBins.push(bin);
    }
  }
  return foundBins;
};

Scene.prototype.startTimeToSliderValue = function(start_time) {
  var last_bin_end_time = 0;
  var value = 0;
  for (var binIndex = 0; binIndex < this._bins.length; binIndex++) {
    var bin = this._bins[binIndex];
    if (bin._startTime < start_time) {
      value += bin.width();
      if (bin._startTime > last_bin_end_time && last_bin_end_time > 0) {
        // eslint-disable-next-line no-use-before-define
        value += scene._shift;
      }
      last_bin_end_time = bin._endTime;
    }
  }
  return value;
};

// ---------------------------------------------------------------------

var scene = new Scene();

function parseAlternative(element/*, index, array*/) {
  var confidence = element['confidence'];
  var word = element['word'];
  var bin = scene._bins[scene._bins.length - 1];
  bin.addWordAlternative(new WordAlternative(word, confidence));
}

function parseBin(element/*, index, array*/) {
  var start_time = element['start_time'];
  var end_time = element['end_time'];
  var alternatives = element['alternatives'];
  var bin = new Bin(start_time, end_time);
  scene.addBin(bin);
  alternatives.forEach(parseAlternative);
}

function draw() {
  ctx.clearRect(0, 0, 970, 370);
  scene.draw();
}

function onHScroll() {
  if (hslider.value == 0) {
    leftArrowEnabled = false;
    rightArrowEnabled = true;
    $('#left-arrow').attr('src', 'images/arrow-left-icon-disabled.svg');
    $('#left-arrow').css('background-color', 'transparent');
    $('#right-arrow').attr('src', 'images/arrow-right-icon.svg');
    $('#right-arrow').css('background-color', '#C7C7C7');
  }
  else if (hslider.value == Math.floor(hslider.max)) {
    leftArrowEnabled = true;
    rightArrowEnabled = false;
    $('#left-arrow').attr('src', 'images/arrow-left-icon.svg');
    $('#left-arrow').css('background-color', '#C7C7C7');
    $('#right-arrow').attr('src', 'images/arrow-right-icon-disabled.svg');
    $('#right-arrow').css('background-color', 'transparent');
  }
  else {
    leftArrowEnabled = true;
    rightArrowEnabled = true;
    $('#left-arrow').attr('src', 'images/arrow-left-icon.svg');
    $('#left-arrow').css('background-color', '#C7C7C7');
    $('#right-arrow').attr('src', 'images/arrow-right-icon.svg');
    $('#right-arrow').css('background-color', '#C7C7C7');
  }
  scene._offset_X = INITIAL_OFFSET_X - hslider.value;
  draw();
}

function onVScroll() {
  scene._offset_Y = INITIAL_OFFSET_Y + Number(vslider.value);
  draw();
}

function clearScene() {
  scene._bins = [];
  scene._width = 0;
  scene._height = 0;
  scene._offset_X = INITIAL_OFFSET_X;
  scene._offset_Y = INITIAL_OFFSET_Y;
  hslider.max = 0;
  hslider.value = hslider.max;
  vslider.max = 0;
  vslider.min = 0;
  vslider.value = vslider.max;
  $('#hslider').css('display', 'none');
  $('#vslider').css('display', 'none');
  $('#show_alternate_words').css('display', 'none');
  $('#canvas').css('display', 'none');
  $('#canvas-placeholder').css('display', 'block');
  $('#left-arrow').css('display', 'none');
  $('#right-arrow').css('display', 'none');

  showAllHypotheses = true;
  $('#show_alternate_words').text('Hide alternate words');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function clearKeywordsToSearch() {
  keywords_to_search = [];
  $('#error-wrong-keywords-filetype').css('display', 'none');
  $('.keywords_title').css('display', 'none');
  $('#keywords').css('display', 'none');
  $('#transcription_text').css('width', '100%');
}

function clearDetectedKeywords() {
  $('#keywords ul').empty();
  detected_keywords = {};
}

// ---------------------------------------------------------------------

$('#left-arrow').hover(
  function() {
    if (leftArrowEnabled) {
      $(this).css('background-color', '#C7C7C7');
      $(this).css('opacity', '1');
    }
    else {
      $(this).css('background-color', 'transparent');
      $(this).css('opacity', opacity);
    }
  },
  function() {
    if (leftArrowEnabled) {
      $(this).css('background-color', '#C7C7C7');
    }
    else {
      $(this).css('background-color', 'transparent');
    }
    $(this).css('opacity', opacity);
  }
);

$('#right-arrow').hover(
  function() {
    if (rightArrowEnabled) {
      $(this).css('background-color', '#C7C7C7');
      $(this).css('opacity', '1');
    }
    else {
      $(this).css('background-color', 'transparent');
      $(this).css('opacity', opacity);
    }
  },
  function() {
    if (rightArrowEnabled) {
      $(this).css('background-color', '#C7C7C7');
    }
    else {
      $(this).css('background-color', 'transparent');
    }
    $(this).css('opacity', opacity);
  }
);

$('#left-arrow').click(function() {
  var updated_value = hslider.value - hstep;
  if (updated_value < 0) {
    updated_value = 0;
  }
  hslider.value = updated_value;
  onHScroll();
});

$('#right-arrow').click(function() {
  var updated_value = Number(hslider.value) + hstep;
  if (updated_value > hslider.max) {
    updated_value = hslider.max;
  }
  hslider.value = updated_value;
  onHScroll();
});

$('#btnLoadKWS').click(function(/*e*/) {
  $(this).find('input[type=\'file\']').click();
});

$('#btnLoadKWS input').click(function(e) {
  e.stopPropagation();
});

$('#btnLoadKWS input').change(function(e) {
  e.stopPropagation();
  clearKeywordsToSearch();
  var selectedFile = $(this)[0].files[0];
  if (typeof selectedFile == 'undefined') {
    console.log('User cancelled OpenFile dialog. No keywords file loaded.');
    return;
  }

  if ($(this).val().lastIndexOf('.txt') == -1) {
    $('#error-wrong-keywords-filetype').css('display', 'block');
    return;
  }

  var reader = new FileReader();
  reader.readAsText(selectedFile);
  reader.onload = function() {
    $('#keywords ul').empty();
    var text = reader.result;
    var keywordsToSearch = text.split('\n');
    // eslint-disable-next-line no-use-before-define
    keywordsToSearch.forEach(addKeywordToSearch);
    if (keywordsToSearch.length > 0) {
      $('.keywords_title').css('display', 'block');
      $('#keywords').css('display', 'block');
      $('#transcription_text').css('width', '55%');
    }
  };
});

$('#tb_keywords').focus(function () {
  if (keywordsInputDirty == false) {
    keywordsInputDirty = true;
    $(this).css('font-style', 'normal');
    $(this).css('color', '#121212');
    $(this).val('');
  }
});

$('#tb_keywords').change(function() {
  clearKeywordsToSearch();
  var text = $(this).val();
  // eslint-disable-next-line no-use-before-define
  text.split(',').forEach(addKeywordToSearch);
  if (keywords_to_search.length > 0) {
    $('.keywords_title').css('display', 'block');
    $('#keywords').css('display', 'block');
    $('#transcription_text').css('width', '55%');
  }
});

// -----------------------------------------------------------------

function keywordNotFound(keyword) {
  var $li_kwd = $('<li class=\'keyword_no_occurrences\'/>');
  $li_kwd.append(document.createTextNode(keyword));
  $('#keywords ul').append($li_kwd);
}

function addKeywordToSearch(element/*, index, array*/) {
  var keyword = element.trim();
  if (keyword.length == 0) return;

  if (keywords_to_search.indexOf(keyword) == -1) {
    keywords_to_search.push(keyword);
  }
}

$('#errorWrongKeywordsFiletypeClose').click(function(/*e*/) {
  $('#error-wrong-keywords-filetype').css('display', 'none');
});

function toggleSpottedKeywordClass(node) {
  if (node.className == 'keyword_collapsed') {
    node.getElementsByClassName('keyword_icon')[0].src = 'images/close-icon.svg';
    node.className = 'keyword_expanded';
  }
  else if (node.className == 'keyword_expanded') {
    node.getElementsByClassName('keyword_icon')[0].src = 'images/open-icon.svg';
    node.className = 'keyword_collapsed';
  }
}

$('#keywords ul').click(function(e) {
  var node = e.srcElement || e.target;

  if (node.className == 'keyword_text') {
    toggleSpottedKeywordClass(node.parentNode);
  }
  else if (node.className == 'keyword_icon') {
    toggleSpottedKeywordClass(node.parentNode.parentNode);
  }
  else {
    toggleSpottedKeywordClass(node);
  }
});

function parseKeywords(keywords_result) {
  // eslint-disable-next-line guard-for-in
  for (var keyword in keywords_result) {
    var arr = keywords_result[keyword];
    // eslint-disable-next-line no-continue
    if (arr.length == 0) continue;
    if (keyword in detected_keywords == false) {
      detected_keywords[keyword] = [];
    }
    detected_keywords[keyword] = detected_keywords[keyword].concat(arr);
  }
}

function unselectLastKeyword() {
  for (var binIndex = 0; binIndex < scene._bins.length; binIndex++) {
    var bin = scene._bins[binIndex];
    var wordAlternatives = bin._wordAlternatives;
    for (var waIndex = 0; waIndex < wordAlternatives.length; waIndex++) {
      var wordAlternative = wordAlternatives[waIndex];
      wordAlternative.unselect();
    }
  }
}

window.onKeywordOccurrenceSelected = function(start_time, keywordFragments) {
  unselectLastKeyword();
  var keywordConsistsOfTopHypothesesOnly = true;
  for (var index = 0; index < keywordFragments.length; index++) {
    var fragment = keywordFragments[index];
    var binIndex = fragment[0];
    var waIndex = fragment[1];
    if (waIndex > 0) {
      keywordConsistsOfTopHypothesesOnly = false;
    }
    var bin = scene._bins[binIndex];
    var wordAlternative = bin._wordAlternatives[waIndex];
    wordAlternative.select();
  }
  if (showAllHypotheses == false && keywordConsistsOfTopHypothesesOnly == false) {
    // eslint-disable-next-line no-use-before-define
    toggleAlternateWords();
  }
  hslider.value = scene.startTimeToSliderValue(start_time);
  onHScroll();

  $('html, body').animate({scrollTop: $('#canvas').offset().top}, 500);
};

function keywordToHashSet(normalized_text) {
  var hashSet = {};
  var segments = normalized_text.split(' ');
  for (var index = 0; index < segments.length; index++) {
    var segment = segments[index];
    hashSet[segment] = true;
  }
  return hashSet;
}

function updateKeyword(keyword) {
  var arr = detected_keywords[keyword];
  var arrlen = arr.length;

  var $li = $('<li class=\'keyword_collapsed\'/>');
  var $keyword_text = $('<span class=\'keyword_text\'><img class=\'keyword_icon\' src=\'images/open-icon.svg\'>' + keyword + '</span>');
  var $keyword_count = $('<span class=\'keyword_count\'>(' + arrlen + ')</span>');
  $li.append($keyword_text);
  $li.append($keyword_count);
  var $table = $('<table class=\'kws_occurrences\'/>');
  for (var index = 0; index < arrlen; index++) {
    var kwd_occurrence = arr[index];
    var start_time = kwd_occurrence['start_time'].toFixed(2);
    var end_time = kwd_occurrence['end_time'].toFixed(2);
    var confidence = (kwd_occurrence['confidence'] * 100).toFixed(1);
    var normalized_text = kwd_occurrence['normalized_text'];
    var set = keywordToHashSet(normalized_text);
    var foundBins = scene.findBins(start_time, end_time);
    var keywordFragments = [];

    for (var binIndex = 0; binIndex < foundBins.length; binIndex++) {
      var bin = foundBins[binIndex];
      var wordAlternatives = bin._wordAlternatives;
      for (var waIndex = 0; waIndex < wordAlternatives.length; waIndex++) {
        var wordAlternative = wordAlternatives[waIndex];
        var isKeyword = set[wordAlternative._text];
        if (isKeyword) {
          var coordinate = [bin._index, waIndex];
          keywordFragments.push(coordinate);
        }
      }
    }

    var onClick = '"onKeywordOccurrenceSelected(' + start_time + ',' + JSON.stringify(keywordFragments) + ')"';
    var $tr = $('<tr class=\'selectable\' onClick=' + onClick + '/>');
    var $td_index = $('<td class=\'index\'>' + (index + 1) + '.</td>');
    var $td_start_label = $('<td class=\'bold\'>Start:</td>');
    var $td_start = $('<td/>');
    $td_start.append(document.createTextNode(start_time));
    var $td_end_label = $('<td class=\'bold\'>End:</td>');
    var $td_end = $('<td/>');
    $td_end.append(document.createTextNode(end_time));
    var $td_confidence_label = $('<td class=\'bold\'>Confidence:</td>');
    var $td_confidence = $('<td/>');
    $td_confidence.append(document.createTextNode(confidence + '%'));
    $tr.append([$td_index, $td_start_label, $td_start, $td_end_label, $td_end, $td_confidence_label, $td_confidence]);
    $table.append($tr);
  }
  $li.append($table);
  $('#keywords ul').append($li);
}

function updateDetectedKeywords() {
  $('#keywords ul').empty();
  keywords_to_search.forEach(function(element/*, index, array*/) {
    var keyword = element;
    if (keyword in detected_keywords) {
      updateKeyword(keyword);
    }
    else {
      keywordNotFound(keyword);
    }
  });
}

function toggleAlternateWords() {
  if (showAllHypotheses == false) {
    if (vslider.min < 0) {
      $('#vslider').css('display', 'block');
    }
    $('#show_alternate_words').text('Hide alternate words');
    showAllHypotheses = true;
  }
  else {
    $('#vslider').css('display', 'none');
    $('#show_alternate_words').text('Show alternate words');
    showAllHypotheses = false;
  }
  draw();
}

$('#show_alternate_words').click(function(/*e*/) {
  toggleAlternateWords();
});

exports.showJSON = function(baseJSON) {
  if ($('.nav-tabs .active').text() == 'JSON') {
    $('#resultsJSON').val(baseJSON);
  }
};

function updateTextScroll(){
  if (!scrolled){
    var element = $('#resultsText').get(0);
    element.scrollTop = element.scrollHeight;
  }
}

function initTextScroll() {
  // $('#resultsText').on('scroll', function(){
  //     textScrolled = true;
  // });
}

function onResize() {
  var x_ratio = $('#canvas').width() / canvas.width;
  var y_ratio = $('#canvas').height() / canvas.height;
  canvas.width = $('#canvas').width();
  canvas.height = $('#canvas').height();
  ctx.setTransform(x_ratio, 0, 0, y_ratio, 0, 0);
  draw();
}

function resetWorker() {
  runTimer = false;
  worker.postMessage({
    type:'clear'
  });
  pushed = 0;
  popped = 0;
  console.log('---> resetWorker called');
}

exports.initDisplayMetadata = function() {
  initTextScroll();
  keywordsInputDirty = false;
  hslider.min = 0;
  hslider.max = 0;
  hslider.value = hslider.min;
  vslider.min = 0;
  vslider.max = 0;
  vslider.value = vslider.max;
  $('#vslider').css('display', 'none');
  $('#hslider').on('change mousemove', function() {
    onHScroll();
  });
  $('#vslider').on('change mousemove', function() {
    onVScroll();
  });

  $('#canvas').css('display', 'none');
  $('#canvas-placeholder').css('display', 'block');
  $('#left-arrow').css('display', 'none');
  $('#right-arrow').css('display', 'none');

  onResize(); // to adjust the canvas size

  var workerScriptBody =
    'var fifo = [];\n' +
    'var onmessage = function(event) {\n' +
    '  var payload = event.data;\n' +
    '  var type = payload.type;\n' +
    '  if(type == \'push\') {\n' +
    '    fifo.push(payload.msg);\n' +
    '  }\n' +
    '  else if(type == \'shift\' && fifo.length > 0) {\n' +
    '    var msg = fifo.shift();\n' +
    '    postMessage({\n' +
    '     bins:msg.results[0].word_alternatives,\n' +
    '     kws:msg.results[0].keywords_result\n' +
    '    });\n' +
    '  }\n' +
    '  else if(type == \'clear\') {\n' +
    '    fifo = [];\n' +
    '    console.log(\'worker: fifo cleared\');\n' +
    '  }\n' +
    '}\n';

  var blobURL = window.URL.createObjectURL(new Blob([workerScriptBody]));
  worker = new Worker(blobURL);
  worker.onmessage = function(event) {
    var data = event.data;
    // eslint-disable-next-line no-use-before-define
    showCNsKWS(data.bins, data.kws);
    popped++;
    console.log('----> popped', popped);
  };
};

function showCNsKWS(bins, kws) {
  bins.forEach(parseBin);
  hslider.max = scene.width() - canvas.width + INITIAL_OFFSET_X;
  hslider.value = hslider.max;
  onHScroll();

  if (vslider.min < 0 && showAllHypotheses) {
    $('#vslider').css('display', 'block');
  }
  $('#hslider').css('display', 'block');
  $('#show_alternate_words').css('display', 'inline-block');
  $('#canvas').css('display', 'block');
  $('#canvas-placeholder').css('display', 'none');
  $('#left-arrow').css('display', 'inline-block');
  $('#right-arrow').css('display', 'inline-block');

  // KWS
  parseKeywords(kws);
  updateDetectedKeywords();
}

function onTimer() {
  worker.postMessage({
    type:'shift'
  });
  if (runTimer == true) {
    setTimeout(onTimer, timeout);
  }
}

exports.showResult = function(msg, baseString, model) {
  if (msg.results && msg.results.length > 0) {
    //var alternatives = msg.results[0].alternatives;
    var text = msg.results[0].alternatives[0].transcript || '';

    // apply mappings to beautify
    text = text.replace(/%HESITATION\s/g, '');
    text = text.replace(/([^*])\1{2,}/g, '');

    if (msg.results[0].final) {
      console.log('-> ' + text);
      worker.postMessage({
        type:'push',
        msg:msg
      });
      pushed++;
      console.log('----> pushed', pushed);
      if (runTimer == false) {
        runTimer = true;
        setTimeout(onTimer, timeout);
      }
    }
    text = text.replace(/D_[^\s]+/g,'');

    // if all words are mapped to nothing then there is nothing else to do
    if ((text.length == 0) || (/^\s+$/.test(text))) {
      return baseString;
    }

    var japanese = ((model.substring(0,5) == 'ja-JP') || (model.substring(0,5) == 'zh-CN'));

    // capitalize first word
    // if final results, append a new paragraph
    if (msg.results && msg.results[0] && msg.results[0].final) {
      text = text.slice(0, -1);
      text = text.charAt(0).toUpperCase() + text.substring(1);
      if (japanese) {
        text = text.trim() + '。';
        text = text.replace(/ /g,'');
      }
      else {
        text = text.trim() + '. ';
      }
      baseString += text;
      $('#resultsText').val(baseString);
    }
    else {
      if (japanese) {
        text = text.replace(/ /g,''); // remove whitespaces
      } else {
          text = text.charAt(0).toUpperCase() + text.substring(1);
      }
      $('#resultsText').val(baseString + text);
    }
  }
  updateTextScroll();
  return baseString;
};

exports.getKeywordsToSearch = function() {
  return keywords_to_search;
};

$.subscribe('clearscreen', function() {
  clearScene();
  clearDetectedKeywords();
  resetWorker();
});

$(window).resize(function() {
  onResize();
});

},{}],11:[function(require,module,exports){
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
/* global $ */
'use strict';

var handleSelectedFile = require('./fileupload').handleSelectedFile;

exports.initDragDrop = function(ctx) {

  var dragAndDropTarget = $(document);

  dragAndDropTarget.on('dragenter', function(e) {
    e.stopPropagation();
    e.preventDefault();
  });

  dragAndDropTarget.on('dragover', function(e) {
    e.stopPropagation();
    e.preventDefault();
  });

  function handleFileUploadEvent(file) {
    handleSelectedFile(ctx.token, file);
  }

  dragAndDropTarget.on('drop', function(e) {
    e.preventDefault();
    var evt = e.originalEvent;

    if (evt.dataTransfer.files.length == 0)
      return;

    var file = evt.dataTransfer.files[0];
    console.log('File dropped');

    // Handle dragged file event
    handleFileUploadEvent(file);
  });


};

},{"./fileupload":13}],12:[function(require,module,exports){
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
/* global $ */
'use strict';

exports.flashSVG = function(el) {
  el.css({fill: '#A53725'});
  function loop() {
    el.animate({fill: '#A53725'},
        1000, 'linear')
      .animate({fill: 'white'},
          1000, 'linear');
  }
  // return timer
  var timer = setTimeout(loop, 2000);
  return timer;
};

exports.stopFlashSVG = function(timer, el) {
  el.css({fill: 'white'});
  clearInterval(timer);
};

exports.toggleImage = function(el, name) {
  if (el.attr('src') === 'images/' + name + '.svg') {
    el.attr('src', 'images/stop-red.svg');
  } else {
    el.attr('src', 'images/stop.svg');
  }
};

var restoreImage = exports.restoreImage = function(el, name) {
  el.attr('src', 'images/' + name + '.svg');
};

exports.stopToggleImage = function(timer, el, name) {
  clearInterval(timer);
  restoreImage(el, name);
};

},{}],13:[function(require,module,exports){
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
/* global $ */
'use strict';

var showError = require('./showerror').showError;
var showNotice = require('./showerror').showNotice;
var handleFileUpload = require('../handlefileupload').handleFileUpload;
var effects = require('./effects');
var utils = require('../utils');

// Need to remove the view logic here and move this out to the handlefileupload controller
var handleSelectedFile = exports.handleSelectedFile = (function() {

  var running = false;
  localStorage.setItem('currentlyDisplaying', 'false');

  return function(token, file) {

    $.publish('clearscreen');


    localStorage.setItem('currentlyDisplaying', 'fileupload');
    running = true;

    // Visual effects
    var uploadImageTag = $('#fileUploadTarget > img');
    var timer = setInterval(effects.toggleImage, 750, uploadImageTag, 'stop');
    var uploadText = $('#fileUploadTarget > span');
    uploadText.text('Stop Transcribing');

    function restoreUploadTab() {
        clearInterval(timer);
        effects.restoreImage(uploadImageTag, 'upload');
        uploadText.text('Select Audio File');
      }

    // Clear flashing if socket upload is stopped
    $.subscribe('hardsocketstop', function() {
        restoreUploadTab();
        running = false;
      });

    // Get current model
    var currentModel = localStorage.getItem('currentModel');
    console.log('currentModel', currentModel);

    // Read first 4 bytes to determine header
    var blobToText = new Blob([file]).slice(0, 4);
    var r = new FileReader();
    r.readAsText(blobToText);
    var audio;
    r.onload = function() {
        var contentType;
        if (r.result === 'fLaC') {
        contentType = 'audio/flac';
        showNotice('Notice: This browser does not support playing FLAC audio, so no audio will accompany the transcription.');
      } else if (r.result === 'RIFF') {
        contentType = 'audio/wav';
        audio = new Audio();
        var wavBlob = new Blob([file], {type: 'audio/wav'});
        var wavURL = URL.createObjectURL(wavBlob);
        audio.src = wavURL;
        audio.play();
        $.subscribe('hardsocketstop', function() {
          audio.pause();
          audio.currentTime = 0;
        });
      } else if (r.result === 'OggS') {
        contentType = 'audio/ogg; codecs=opus';
        audio = new Audio();
        var opusBlob = new Blob([file], {type: 'audio/ogg; codecs=opus'});
        var opusURL = URL.createObjectURL(opusBlob);
        audio.src = opusURL;
        audio.play();
        $.subscribe('hardsocketstop', function() {
          audio.pause();
          audio.currentTime = 0;
        });
      } else {
        restoreUploadTab();
        showError('Only WAV, FLAC, or OPUS files can be transcribed. Please try another file format.');
        localStorage.setItem('currentlyDisplaying', 'false');
        return;
      }
        handleFileUpload('fileupload', token, currentModel, file, contentType, function(socket) {
        var blob = new Blob([file]);
        var parseOptions = {
          file: blob
        };
        utils.onFileProgress(parseOptions,
          // On data chunk
          function onData(chunk) {
            socket.send(chunk);
          },
          function isRunning() {
            if (running)
              return true;
            else
                return false;
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
        function() {
          effects.stopToggleImage(timer, uploadImageTag, 'upload');
          uploadText.text('Select Audio File');
          localStorage.setItem('currentlyDisplaying', 'false');
        }
      );
      };
  };
})();


exports.initFileUpload = function(ctx) {

  var fileUploadDialog = $('#fileUploadDialog');

  fileUploadDialog.change(function() {
    var file = fileUploadDialog.get(0).files[0];
    handleSelectedFile(ctx.token, file);
  });

  $('#fileUploadTarget').click(function() {

    var currentlyDisplaying = localStorage.getItem('currentlyDisplaying');

    if (currentlyDisplaying == 'fileupload') {
      console.log('HARD SOCKET STOP');
      $.publish('hardsocketstop');
      localStorage.setItem('currentlyDisplaying', 'false');
      return;
    } else if (currentlyDisplaying == 'sample') {
      showError('Currently another file is playing, please stop the file or wait until it finishes');
      return;
    } else if (currentlyDisplaying == 'record') {
      showError('Currently audio is being recorded, please stop recording before playing a sample');
      return;
    }
    fileUploadDialog.val(null);

    fileUploadDialog
    .trigger('click');

  });

};

},{"../handlefileupload":3,"../utils":8,"./effects":12,"./showerror":19}],14:[function(require,module,exports){
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
'use strict';

var initSessionPermissions = require('./sessionpermissions').initSessionPermissions;
var initAnimatePanel = require('./animatepanel').initAnimatePanel;
var initShowTab = require('./showtab').initShowTab;
var initDragDrop = require('./dragdrop').initDragDrop;
var initPlaySample = require('./playsample').initPlaySample;
var initRecordButton = require('./recordbutton').initRecordButton;
var initFileUpload = require('./fileupload').initFileUpload;
var initDisplayMetadata = require('./displaymetadata').initDisplayMetadata;

exports.initViews = function(ctx) {
  console.log('Initializing views...');
  initPlaySample(ctx);
  initDragDrop(ctx);
  initRecordButton(ctx);
  initFileUpload(ctx);
  initSessionPermissions();
  initShowTab();
  initAnimatePanel();
  initShowTab();
  initDisplayMetadata();
};

},{"./animatepanel":9,"./displaymetadata":10,"./dragdrop":11,"./fileupload":13,"./playsample":15,"./recordbutton":16,"./sessionpermissions":18,"./showtab":20}],15:[function(require,module,exports){
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
/* global $ */
'use strict';

var utils = require('../utils');
var onFileProgress = utils.onFileProgress;
var handleFileUpload = require('../handlefileupload').handleFileUpload;
var getKeywordsToSearch = require('./displaymetadata').getKeywordsToSearch;
var showError = require('./showerror').showError;
var effects = require('./effects');

var LOOKUP_TABLE = {
  'ar-AR_BroadbandModel': ['ar-AR_Broadband_sample1.wav', 'ar-AR_Broadband_sample2.wav', 'الطقس , رياح معتدلة', 'احلامنا , نستلهم'],
  'en-UK_BroadbandModel': ['en-UK_Broadband_sample1.wav', 'en-UK_Broadband_sample2.wav', 'important industry, affordable travel, business', 'consumer, quality, best practice'],
  'en-UK_NarrowbandModel': ['en-UK_Narrowband_sample1.wav', 'en-UK_Narrowband_sample2.wav', 'heavy rain, northwest, UK', 'Watson, sources across social media'],
  'en-US_BroadbandModel': ['Us_English_Broadband_Sample_1.wav', 'Us_English_Broadband_Sample_2.wav', 'sense of pride, watson, technology, changing the world', 'round, whirling velocity, unwanted emotion'],
  'en-US_NarrowbandModel': ['Us_English_Narrowband_Sample_1.wav', 'Us_English_Narrowband_Sample_2.wav', 'course online, four hours, help', 'ibm, customer experience, media data'],
  'es-ES_BroadbandModel': ['Es_ES_spk24_16khz.wav', 'Es_ES_spk19_16khz.wav', 'quiero preguntarle, existen productos', 'preparando, regalos para la familia, sobrinos'],
  'es-ES_NarrowbandModel': ['Es_ES_spk24_8khz.wav', 'Es_ES_spk19_8khz.wav', 'QUIERO PREGUNTARLE, EXISTEN PRODUCTOS', 'PREPARANDO, REGALOS PARA LA FAMILIA, SOBRINOS'],
  'ja-JP_BroadbandModel': ['sample-Ja_JP-wide1.wav', 'sample-Ja_JP-wide2.wav', '場所 , 今日', '変更 , 給与 , コード'],
  'ja-JP_NarrowbandModel': ['sample-Ja_JP-narrow3.wav', 'sample-Ja_JP-narrow4.wav', 'お客様 , お手数', '申し込み , 今回 , 通帳'],
  'pt-BR_BroadbandModel': ['pt-BR_Sample1-16KHz.wav', 'pt-BR_Sample2-16KHz.wav', 'sistema da ibm, setor bancário, qualidade, necessidades dos clientes', 'médicos, informações, planos de tratamento'],
  'pt-BR_NarrowbandModel': ['pt-BR_Sample1-8KHz.wav', 'pt-BR_Sample2-8KHz.wav', 'cozinha, inovadoras receitas, criatividade', 'sistema, treinado por especialistas, setores diferentes'],
  'zh-CN_BroadbandModel': ['zh-CN_sample1_for_16k.wav', 'zh-CN_sample2_for_16k.wav', '沃 森 是 认知 , 大 数据 分析 能力', '技术 , 语音 , 的 用户 体验 , 人们 , 手机'],
  'zh-CN_NarrowbandModel': ['zh-CN_sample1_for_8k.wav', 'zh-CN_sample2_for_8k.wav', '公司 的 支持 , 理财 计划', '假期 , 安排']
};

var playSample = (function() {

  var running = false;
  localStorage.setItem('currentlyDisplaying', 'false');
  localStorage.setItem('samplePlaying', 'false');

  return function(token, imageTag, sampleNumber, iconName, url, keywords) {
    $.publish('clearscreen');

    var currentlyDisplaying = localStorage.getItem('currentlyDisplaying');
    var samplePlaying = localStorage.getItem('samplePlaying');

    if (samplePlaying === sampleNumber) {
      console.log('HARD SOCKET STOP');
      $.publish('socketstop');
      localStorage.setItem('currentlyDisplaying', 'false');
      localStorage.setItem('samplePlaying', 'false');
      effects.stopToggleImage(timer, imageTag, iconName); // eslint-disable-line no-use-before-define
      effects.restoreImage(imageTag, iconName);
      running = false;
      return;
    }

    if (currentlyDisplaying === 'record') {
      showError('Currently audio is being recorded, please stop recording before playing a sample');
      return;
    } else if (currentlyDisplaying === 'fileupload' || samplePlaying !== 'false') {
      showError('Currently another file is playing, please stop the file or wait until it finishes');
      return;
    }

    localStorage.setItem('currentlyDisplaying', 'sample');
    localStorage.setItem('samplePlaying', sampleNumber);
    running = true;

    $('#resultsText').val('');   // clear hypotheses from previous runs

    var timer = setInterval(effects.toggleImage, 750, imageTag, iconName);

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = function() {
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

        if (getKeywordsToSearch().length == 0) {
          $('#tb_keywords').focus();
          $('#tb_keywords').val(keywords);
          $('#tb_keywords').change();
        }
        handleFileUpload('sample', token, currentModel, blob, contentType, function(socket) {
          var parseOptions = {
            file: blob
          };
          // var samplingRate = (currentModel.indexOf('Broadband') !== -1) ? 16000 : 8000;
          onFileProgress(parseOptions,
            // On data chunk
            function onData(chunk) {
              socket.send(chunk);
            },
            function isRunning() {
              if (running)
                return true;
              else
                return false;
            },
            // On file read error
            function(evt) {
              console.log('Error reading file: ', evt.message);
              // showError(evt.message);
            },
            // On load end
            function() {
              socket.send(JSON.stringify({'action': 'stop'}));
            }/* ,
            samplingRate*/
            );
        },
        // On connection end
          function() {
            effects.stopToggleImage(timer, imageTag, iconName);
            effects.restoreImage(imageTag, iconName);
            localStorage.getItem('currentlyDisplaying', 'false');
            localStorage.setItem('samplePlaying', 'false');
          }
        );
      };
    };
    xhr.send();
  };
})();

exports.initPlaySample = function(ctx) {
  var keywords1 = LOOKUP_TABLE[ctx.currentModel][2].split(',');
  var keywords2 = LOOKUP_TABLE[ctx.currentModel][3].split(',');
  var set = {};

  for (var i = keywords1.length - 1; i >= 0; --i) {
    var word = keywords1[i].trim();
    set[word] = word;
  }

  // eslint-disable-next-line no-redeclare
  for (var i = keywords2.length - 1; i >= 0; --i) {
    // eslint-disable-next-line no-redeclare
    var word = keywords2[i].trim();
    set[word] = word;
  }

  var keywords = [];
  // eslint-disable-next-line no-redeclare
  for (var word in set) { // eslint-disable-line guard-for-in
    keywords.push(set[word]);
  }
  keywords.sort();

  (function() {
    var fileName = 'audio/' + LOOKUP_TABLE[ctx.currentModel][0];
    // var keywords = LOOKUP_TABLE[ctx.currentModel][2];
    var el = $('.play-sample-1');
    el.off('click');
    var iconName = 'play';
    var imageTag = el.find('img');
    el.click(function() {
      playSample(ctx.token, imageTag, 'sample-1', iconName, fileName, keywords, function(result) {
        console.log('Play sample result', result);
      });
    });
  })(ctx, LOOKUP_TABLE);

  (function() {
    var fileName = 'audio/' + LOOKUP_TABLE[ctx.currentModel][1];
    // var keywords = LOOKUP_TABLE[ctx.currentModel][3];
    var el = $('.play-sample-2');
    el.off('click');
    var iconName = 'play';
    var imageTag = el.find('img');
    el.click(function() {
      playSample(ctx.token, imageTag, 'sample-2', iconName, fileName, keywords, function(result) {
        console.log('Play sample result', result);
      });
    });
  })(ctx, LOOKUP_TABLE);
};

},{"../handlefileupload":3,"../utils":8,"./displaymetadata":10,"./effects":12,"./showerror":19}],16:[function(require,module,exports){
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
/* global $ */
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
      var currentlyDisplaying = localStorage.getItem('currentlyDisplaying');

      if (currentlyDisplaying == 'sample' || currentlyDisplaying == 'fileupload') {
        showError('Currently another file is playing, please stop the file or wait until it finishes');
        return;
      }
      localStorage.setItem('currentlyDisplaying', 'record');
      if (!running) {
        $('#resultsText').val('');   // clear hypotheses from previous runs
        console.log('Not running, handleMicrophone()');
        handleMicrophone(token, currentModel, mic, function(err) {
          if (err) {
            var msg = 'Error: ' + err.message;
            console.log(msg);
            showError(msg);
            running = false;
            localStorage.setItem('currentlyDisplaying', 'false');
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
        localStorage.setItem('currentlyDisplaying', 'false');
      }
    };
  })());
};

},{"../Microphone":1,"../handlemicrophone":4,"./showerror":19}],17:[function(require,module,exports){
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
/* global $ */
'use strict';

var initPlaySample = require('./playsample').initPlaySample;

exports.initSelectModel = function(ctx) {


  ctx.models.forEach(function(model) {
    $('#dropdownMenuList').append(
      $('<li>')
        .attr('role', 'presentation')
        .append(
          $('<a>').attr('role', 'menu-item')
            .attr('href', '/')
            .attr('data-model', model.name)
            .append(model.description.substring(0, model.description.length - 1), model.rate == 8000 ? ' (8KHz)' : ' (16KHz)'))
          );
  });


  $('#dropdownMenuList').click(function(evt) {
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
    $('#tb_keywords').focus();
    $('#tb_keywords').val('');
    $('#tb_keywords').change();
    $.publish('clearscreen');
  });

};

},{"./playsample":15}],18:[function(require,module,exports){
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
/* global $ */
'use strict';


exports.initSessionPermissions = function() {
  console.log('Initializing session permissions handler');
  // Radio buttons
  var sessionPermissionsRadio = $('#sessionPermissionsRadioGroup input[type=\'radio\']');
  sessionPermissionsRadio.click(function() {
    var checkedValue = sessionPermissionsRadio.filter(':checked').val();
    console.log('checkedValue', checkedValue);
    localStorage.setItem('sessionPermissions', checkedValue);
  });
};

},{}],19:[function(require,module,exports){
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
/* global $ */
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
};

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
};

exports.hideError = function() {
  var errorAlert = $('.error-row');
  errorAlert.hide();
};

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
/* global $ */
'use strict';

exports.initShowTab = function() {
  $('.nav-tabs a[data-toggle="tab"]').on('shown.bs.tab', function(e) {
    // show selected tab / active
    var target = $(e.target).text();
    if (target === 'JSON') {
      $.publish('showjson');
    }
  });
};

},{}]},{},[5])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwic3JjL01pY3JvcGhvbmUuanMiLCJzcmMvZGF0YS9tb2RlbHMuanNvbiIsInNyYy9oYW5kbGVmaWxldXBsb2FkLmpzIiwic3JjL2hhbmRsZW1pY3JvcGhvbmUuanMiLCJzcmMvaW5kZXguanMiLCJzcmMvbW9kZWxzLmpzIiwic3JjL3NvY2tldC5qcyIsInNyYy91dGlscy5qcyIsInNyYy92aWV3cy9hbmltYXRlcGFuZWwuanMiLCJzcmMvdmlld3MvZGlzcGxheW1ldGFkYXRhLmpzIiwic3JjL3ZpZXdzL2RyYWdkcm9wLmpzIiwic3JjL3ZpZXdzL2VmZmVjdHMuanMiLCJzcmMvdmlld3MvZmlsZXVwbG9hZC5qcyIsInNyYy92aWV3cy9pbmRleC5qcyIsInNyYy92aWV3cy9wbGF5c2FtcGxlLmpzIiwic3JjL3ZpZXdzL3JlY29yZGJ1dHRvbi5qcyIsInNyYy92aWV3cy9zZWxlY3Rtb2RlbC5qcyIsInNyYy92aWV3cy9zZXNzaW9ucGVybWlzc2lvbnMuanMiLCJzcmMvdmlld3Mvc2hvd2Vycm9yLmpzIiwic3JjL3ZpZXdzL3Nob3d0YWIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdFhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2pJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNwSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3QzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNSBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgJ0xpY2Vuc2UnKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gJ0FTIElTJyBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbi8qIGdsb2JhbCBPZmZsaW5lQXVkaW9Db250ZXh0ICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbi8qKlxuICogQ2FwdHVyZXMgbWljcm9waG9uZSBpbnB1dCBmcm9tIHRoZSBicm93c2VyLlxuICogV29ya3MgYXQgbGVhc3Qgb24gbGF0ZXN0IHZlcnNpb25zIG9mIEZpcmVmb3ggYW5kIENocm9tZVxuICovXG5mdW5jdGlvbiBNaWNyb3Bob25lKF9vcHRpb25zKSB7XG4gIHZhciBvcHRpb25zID0gX29wdGlvbnMgfHwge307XG5cbiAgLy8gd2UgcmVjb3JkIGluIG1vbm8gYmVjYXVzZSB0aGUgc3BlZWNoIHJlY29nbml0aW9uIHNlcnZpY2VcbiAgLy8gZG9lcyBub3Qgc3VwcG9ydCBzdGVyZW8uXG4gIHRoaXMuYnVmZmVyU2l6ZSA9IG9wdGlvbnMuYnVmZmVyU2l6ZSB8fCA4MTkyO1xuICB0aGlzLmlucHV0Q2hhbm5lbHMgPSBvcHRpb25zLmlucHV0Q2hhbm5lbHMgfHwgMTtcbiAgdGhpcy5vdXRwdXRDaGFubmVscyA9IG9wdGlvbnMub3V0cHV0Q2hhbm5lbHMgfHwgMTtcbiAgdGhpcy5yZWNvcmRpbmcgPSBmYWxzZTtcbiAgdGhpcy5yZXF1ZXN0ZWRBY2Nlc3MgPSBmYWxzZTtcbiAgdGhpcy5zYW1wbGVSYXRlID0gMTYwMDA7XG4gIC8vIGF1eGlsaWFyIGJ1ZmZlciB0byBrZWVwIHVudXNlZCBzYW1wbGVzICh1c2VkIHdoZW4gZG9pbmcgZG93bnNhbXBsaW5nKVxuICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXMgPSBuZXcgRmxvYXQzMkFycmF5KDApO1xuICB0aGlzLnNhbXBsZXNBbGwgPSBuZXcgRmxvYXQzMkFycmF5KDIwMDAwMDAwKTtcbiAgdGhpcy5zYW1wbGVzQWxsT2Zmc2V0ID0gMDtcblxuICAvLyBDaHJvbWUgb3IgRmlyZWZveCBvciBJRSBVc2VyIG1lZGlhXG4gIGlmICghbmF2aWdhdG9yLmdldFVzZXJNZWRpYSkge1xuICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgPSBuYXZpZ2F0b3Iud2Via2l0R2V0VXNlck1lZGlhIHx8XG4gICAgbmF2aWdhdG9yLm1vekdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3IubXNHZXRVc2VyTWVkaWE7XG4gIH1cblxufVxuXG4vKipcbiAqIENhbGxlZCB3aGVuIHRoZSB1c2VyIHJlamVjdCB0aGUgdXNlIG9mIHRoZSBtaWNocm9waG9uZVxuICogQHBhcmFtICBlcnJvciBUaGUgZXJyb3JcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUub25QZXJtaXNzaW9uUmVqZWN0ZWQgPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJ01pY3JvcGhvbmUub25QZXJtaXNzaW9uUmVqZWN0ZWQoKScpO1xuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IGZhbHNlO1xuICB0aGlzLm9uRXJyb3IoJ1Blcm1pc3Npb24gdG8gYWNjZXNzIHRoZSBtaWNyb3Bob25lIHJlamV0ZWQuJyk7XG59O1xuXG5NaWNyb3Bob25lLnByb3RvdHlwZS5vbkVycm9yID0gZnVuY3Rpb24oZXJyb3IpIHtcbiAgY29uc29sZS5sb2coJ01pY3JvcGhvbmUub25FcnJvcigpOicsIGVycm9yKTtcbn07XG5cbi8qKlxuICogQ2FsbGVkIHdoZW4gdGhlIHVzZXIgYXV0aG9yaXplcyB0aGUgdXNlIG9mIHRoZSBtaWNyb3Bob25lLlxuICogQHBhcmFtICB7T2JqZWN0fSBzdHJlYW0gVGhlIFN0cmVhbSB0byBjb25uZWN0IHRvXG4gKlxuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5vbk1lZGlhU3RyZWFtID0gZnVuY3Rpb24oc3RyZWFtKSB7XG4gIHZhciBBdWRpb0N0eCA9IHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dDtcblxuICBpZiAoIUF1ZGlvQ3R4KVxuICAgIHRocm93IG5ldyBFcnJvcignQXVkaW9Db250ZXh0IG5vdCBhdmFpbGFibGUnKTtcblxuICBpZiAoIXRoaXMuYXVkaW9Db250ZXh0KVxuICAgIHRoaXMuYXVkaW9Db250ZXh0ID0gbmV3IEF1ZGlvQ3R4KCk7XG5cbiAgdmFyIGdhaW4gPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gIHZhciBhdWRpb0lucHV0ID0gdGhpcy5hdWRpb0NvbnRleHQuY3JlYXRlTWVkaWFTdHJlYW1Tb3VyY2Uoc3RyZWFtKTtcblxuICBhdWRpb0lucHV0LmNvbm5lY3QoZ2Fpbik7XG5cbiAgaWYgKCF0aGlzLm1pYykge1xuICAgIHRoaXMubWljID0gdGhpcy5hdWRpb0NvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKHRoaXMuYnVmZmVyU2l6ZSxcbiAgICB0aGlzLmlucHV0Q2hhbm5lbHMsIHRoaXMub3V0cHV0Q2hhbm5lbHMpO1xuICB9XG5cbiAgLy8gdW5jb21tZW50IHRoZSBmb2xsb3dpbmcgbGluZSBpZiB5b3Ugd2FudCB0byB1c2UgeW91ciBtaWNyb3Bob25lIHNhbXBsZSByYXRlXG4gIC8vIHRoaXMuc2FtcGxlUmF0ZSA9IHRoaXMuYXVkaW9Db250ZXh0LnNhbXBsZVJhdGU7XG4gIGNvbnNvbGUubG9nKCdNaWNyb3Bob25lLm9uTWVkaWFTdHJlYW0oKTogc2FtcGxpbmcgcmF0ZSBpczonLCB0aGlzLnNhbXBsZVJhdGUpO1xuXG4gIHRoaXMubWljLm9uYXVkaW9wcm9jZXNzID0gdGhpcy5fb25hdWRpb3Byb2Nlc3MuYmluZCh0aGlzKTtcbiAgdGhpcy5zdHJlYW0gPSBzdHJlYW07XG5cbiAgZ2Fpbi5jb25uZWN0KHRoaXMubWljKTtcbiAgdGhpcy5taWMuY29ubmVjdCh0aGlzLmF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG4gIHRoaXMucmVjb3JkaW5nID0gdHJ1ZTtcbiAgdGhpcy5yZXF1ZXN0ZWRBY2Nlc3MgPSBmYWxzZTtcbiAgdGhpcy5vblN0YXJ0UmVjb3JkaW5nKCk7XG59O1xuXG4vKipcbiAqIGNhbGxiYWNrIHRoYXQgaXMgYmVpbmcgdXNlZCBieSB0aGUgbWljcm9waG9uZVxuICogdG8gc2VuZCBhdWRpbyBjaHVua3MuXG4gKiBAcGFyYW0gIHtvYmplY3R9IGRhdGEgYXVkaW9cbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUuX29uYXVkaW9wcm9jZXNzID0gZnVuY3Rpb24oZGF0YSkge1xuICBpZiAoIXRoaXMucmVjb3JkaW5nKSB7XG4gICAgLy8gV2Ugc3BlYWsgYnV0IHdlIGFyZSBub3QgcmVjb3JkaW5nXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gU2luZ2xlIGNoYW5uZWxcbiAgdmFyIGNoYW4gPSBkYXRhLmlucHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDApO1xuXG4gIC8vIHJlc2FtcGxlcih0aGlzLmF1ZGlvQ29udGV4dC5zYW1wbGVSYXRlLGRhdGEuaW5wdXRCdWZmZXIsdGhpcy5vbkF1ZGlvKTtcblxuICB0aGlzLnNhdmVEYXRhKG5ldyBGbG9hdDMyQXJyYXkoY2hhbikpO1xuICB0aGlzLm9uQXVkaW8odGhpcy5fZXhwb3J0RGF0YUJ1ZmZlclRvMTZLaHoobmV3IEZsb2F0MzJBcnJheShjaGFuKSkpO1xuXG4gIC8vIGV4cG9ydCB3aXRoIG1pY3JvcGhvbmUgbWh6LCByZW1lbWJlciB0byB1cGRhdGUgdGhlIHRoaXMuc2FtcGxlUmF0ZVxuICAvLyB3aXRoIHRoZSBzYW1wbGUgcmF0ZSBmcm9tIHlvdXIgbWljcm9waG9uZVxuICAvLyB0aGlzLm9uQXVkaW8odGhpcy5fZXhwb3J0RGF0YUJ1ZmZlcihuZXcgRmxvYXQzMkFycmF5KGNoYW4pKSk7XG5cbn07XG5cbi8qKlxuICogU3RhcnQgdGhlIGF1ZGlvIHJlY29yZGluZ1xuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5yZWNvcmQgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCFuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKXtcbiAgICB0aGlzLm9uRXJyb3IoJ0Jyb3dzZXIgZG9lc25cXCd0IHN1cHBvcnQgbWljcm9waG9uZSBpbnB1dCcpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAodGhpcy5yZXF1ZXN0ZWRBY2Nlc3MpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IHRydWU7XG4gIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEoe2F1ZGlvOiB0cnVlfSxcbiAgICB0aGlzLm9uTWVkaWFTdHJlYW0uYmluZCh0aGlzKSwgLy8gTWljcm9waG9uZSBwZXJtaXNzaW9uIGdyYW50ZWRcbiAgICB0aGlzLm9uUGVybWlzc2lvblJlamVjdGVkLmJpbmQodGhpcykpOyAvLyBNaWNyb3Bob25lIHBlcm1pc3Npb24gcmVqZWN0ZWRcbn07XG5cbi8qKlxuICogU3RvcCB0aGUgYXVkaW8gcmVjb3JkaW5nXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCF0aGlzLnJlY29yZGluZylcbiAgICByZXR1cm47XG4gIGlmIChKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdwbGF5YmFjaycpKSlcbiAgICB0aGlzLnBsYXlXYXYoKTsgLyogcGxheXMgYmFjayB0aGUgYXVkaW8gdGhhdCB3YXMgcmVjb3JkZWQqL1xuICB0aGlzLnJlY29yZGluZyA9IGZhbHNlO1xuICB0aGlzLnN0cmVhbS5nZXRUcmFja3MoKVswXS5zdG9wKCk7XG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gZmFsc2U7XG4gIHRoaXMubWljLmRpc2Nvbm5lY3QoMCk7XG4gIHRoaXMub25TdG9wUmVjb3JkaW5nKCk7XG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYSBCbG9iIHR5cGU6ICdhdWRpby9sMTYnIHdpdGggdGhlIGNodW5rIGFuZCBkb3duc2FtcGxpbmcgdG8gMTYga0h6XG4gKiBjb21pbmcgZnJvbSB0aGUgbWljcm9waG9uZS5cbiAqIEV4cGxhbmF0aW9uIGZvciB0aGUgbWF0aDogVGhlIHJhdyB2YWx1ZXMgY2FwdHVyZWQgZnJvbSB0aGUgV2ViIEF1ZGlvIEFQSSBhcmVcbiAqIGluIDMyLWJpdCBGbG9hdGluZyBQb2ludCwgYmV0d2VlbiAtMSBhbmQgMSAocGVyIHRoZSBzcGVjaWZpY2F0aW9uKS5cbiAqIFRoZSB2YWx1ZXMgZm9yIDE2LWJpdCBQQ00gcmFuZ2UgYmV0d2VlbiAtMzI3NjggYW5kICszMjc2NyAoMTYtYml0IHNpZ25lZCBpbnRlZ2VyKS5cbiAqIE11bHRpcGx5IHRvIGNvbnRyb2wgdGhlIHZvbHVtZSBvZiB0aGUgb3V0cHV0LiBXZSBzdG9yZSBpbiBsaXR0bGUgZW5kaWFuLlxuICogQHBhcmFtICB7T2JqZWN0fSBidWZmZXIgTWljcm9waG9uZSBhdWRpbyBjaHVua1xuICogQHJldHVybiB7QmxvYn0gJ2F1ZGlvL2wxNicgY2h1bmtcbiAqIEBkZXByZWNhdGVkIFRoaXMgbWV0aG9kIGlzIGRlcHJhY2F0ZWRcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUuX2V4cG9ydERhdGFCdWZmZXJUbzE2S2h6ID0gZnVuY3Rpb24oYnVmZmVyTmV3U2FtcGxlcykge1xuICB2YXIgYnVmZmVyID0gbnVsbCxcbiAgICBuZXdTYW1wbGVzID0gYnVmZmVyTmV3U2FtcGxlcy5sZW5ndGgsXG4gICAgdW51c2VkU2FtcGxlcyA9IHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlcy5sZW5ndGg7XG5cblxuICBpZiAodW51c2VkU2FtcGxlcyA+IDApIHtcbiAgICBidWZmZXIgPSBuZXcgRmxvYXQzMkFycmF5KHVudXNlZFNhbXBsZXMgKyBuZXdTYW1wbGVzKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHVudXNlZFNhbXBsZXM7ICsraSkge1xuICAgICAgYnVmZmVyW2ldID0gdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzW2ldO1xuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgbmV3U2FtcGxlczsgKytpKSB7XG4gICAgICBidWZmZXJbdW51c2VkU2FtcGxlcyArIGldID0gYnVmZmVyTmV3U2FtcGxlc1tpXTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgYnVmZmVyID0gYnVmZmVyTmV3U2FtcGxlcztcbiAgfVxuXG4gIC8vIGRvd25zYW1wbGluZyB2YXJpYWJsZXNcbiAgdmFyIGZpbHRlciA9IFtcbiAgICAgIC0wLjAzNzkzNSwgLTAuMDAwODkwMjQsIDAuMDQwMTczLCAwLjAxOTk4OSwgMC4wMDQ3NzkyLCAtMC4wNTg2NzUsIC0wLjA1NjQ4NyxcbiAgICAgIC0wLjAwNDA2NTMsIDAuMTQ1MjcsIDAuMjY5MjcsIDAuMzM5MTMsIDAuMjY5MjcsIDAuMTQ1MjcsIC0wLjAwNDA2NTMsIC0wLjA1NjQ4NyxcbiAgICAgIC0wLjA1ODY3NSwgMC4wMDQ3NzkyLCAwLjAxOTk4OSwgMC4wNDAxNzMsIC0wLjAwMDg5MDI0LCAtMC4wMzc5MzVcbiAgICBdLFxuICAgIHNhbXBsaW5nUmF0ZVJhdGlvID0gdGhpcy5hdWRpb0NvbnRleHQuc2FtcGxlUmF0ZSAvIDE2MDAwLFxuICAgIG5PdXRwdXRTYW1wbGVzID0gTWF0aC5mbG9vcigoYnVmZmVyLmxlbmd0aCAtIGZpbHRlci5sZW5ndGgpIC8gKHNhbXBsaW5nUmF0ZVJhdGlvKSkgKyAxLFxuICAgIHBjbUVuY29kZWRCdWZmZXIxNmsgPSBuZXcgQXJyYXlCdWZmZXIobk91dHB1dFNhbXBsZXMgKiAyKSxcbiAgICBkYXRhVmlldzE2ayA9IG5ldyBEYXRhVmlldyhwY21FbmNvZGVkQnVmZmVyMTZrKSxcbiAgICBpbmRleCA9IDAsXG4gICAgdm9sdW1lID0gMHg3RkZGLCAvLyByYW5nZSBmcm9tIDAgdG8gMHg3RkZGIHRvIGNvbnRyb2wgdGhlIHZvbHVtZVxuICAgIG5PdXQgPSAwO1xuXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1yZWRlY2xhcmVcbiAgZm9yICh2YXIgaSA9IDA7IGkgKyBmaWx0ZXIubGVuZ3RoIC0gMSA8IGJ1ZmZlci5sZW5ndGg7IGkgPSBNYXRoLnJvdW5kKHNhbXBsaW5nUmF0ZVJhdGlvICogbk91dCkpIHtcbiAgICB2YXIgc2FtcGxlID0gMDtcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGZpbHRlci5sZW5ndGg7ICsraikge1xuICAgICAgc2FtcGxlICs9IGJ1ZmZlcltpICsgal0gKiBmaWx0ZXJbal07XG4gICAgfVxuICAgIHNhbXBsZSAqPSB2b2x1bWU7XG4gICAgZGF0YVZpZXcxNmsuc2V0SW50MTYoaW5kZXgsIHNhbXBsZSwgdHJ1ZSk7IC8vICd0cnVlJyAtPiBtZWFucyBsaXR0bGUgZW5kaWFuXG4gICAgaW5kZXggKz0gMjtcbiAgICBuT3V0Kys7XG4gIH1cblxuICB2YXIgaW5kZXhTYW1wbGVBZnRlckxhc3RVc2VkID0gTWF0aC5yb3VuZChzYW1wbGluZ1JhdGVSYXRpbyAqIG5PdXQpO1xuICB2YXIgcmVtYWluaW5nID0gYnVmZmVyLmxlbmd0aCAtIGluZGV4U2FtcGxlQWZ0ZXJMYXN0VXNlZDtcbiAgaWYgKHJlbWFpbmluZyA+IDApIHtcbiAgICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXMgPSBuZXcgRmxvYXQzMkFycmF5KHJlbWFpbmluZyk7XG4gICAgZm9yIChpID0gMDsgaSA8IHJlbWFpbmluZzsgKytpKSB7XG4gICAgICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXNbaV0gPSBidWZmZXJbaW5kZXhTYW1wbGVBZnRlckxhc3RVc2VkICsgaV07XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlcyA9IG5ldyBGbG9hdDMyQXJyYXkoMCk7XG4gIH1cblxuICByZXR1cm4gbmV3IEJsb2IoW2RhdGFWaWV3MTZrXSwge1xuICAgIHR5cGU6ICdhdWRpby9sMTYnXG4gIH0pO1xufTtcblxuXG5cbi8vIC8vIG5hdGl2ZSB3YXkgb2YgcmVzYW1wbGluZyBjYXB0dXJlZCBhdWRpb1xuLy8gdmFyIHJlc2FtcGxlciA9IGZ1bmN0aW9uKHNhbXBsZVJhdGUsIGF1ZGlvQnVmZmVyLCBjYWxsYmFja1Byb2Nlc3NBdWRpbykge1xuLy9cbi8vICAgY29uc29sZS5sb2coJ2xlbmd0aDogJyArIGF1ZGlvQnVmZmVyLmxlbmd0aCArICcgJyArIHNhbXBsZVJhdGUpO1xuLy8gICB2YXIgY2hhbm5lbHMgPSAxO1xuLy8gICB2YXIgdGFyZ2V0U2FtcGxlUmF0ZSA9IDE2MDAwO1xuLy8gICB2YXIgbnVtU2FtcGxlc1RhcmdldCA9IGF1ZGlvQnVmZmVyLmxlbmd0aCAqIHRhcmdldFNhbXBsZVJhdGUgLyBzYW1wbGVSYXRlO1xuLy9cbi8vICAgdmFyIG9mZmxpbmVDb250ZXh0ID0gbmV3IE9mZmxpbmVBdWRpb0NvbnRleHQoY2hhbm5lbHMsIG51bVNhbXBsZXNUYXJnZXQsIHRhcmdldFNhbXBsZVJhdGUpO1xuLy8gICB2YXIgYnVmZmVyU291cmNlID0gb2ZmbGluZUNvbnRleHQuY3JlYXRlQnVmZmVyU291cmNlKCk7XG4vLyAgIGJ1ZmZlclNvdXJjZS5idWZmZXIgPSBhdWRpb0J1ZmZlcjtcbi8vXG4vLyAgIC8vIGNhbGxiYWNrIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIHJlc2FtcGxpbmcgZmluaXNoZXNcbi8vICAgb2ZmbGluZUNvbnRleHQub25jb21wbGV0ZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4vLyAgICAgdmFyIHNhbXBsZXNUYXJnZXQgPSBldmVudC5yZW5kZXJlZEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKTtcbi8vICAgICBjb25zb2xlLmxvZygnRG9uZSByZXNhbXBsaW5nOiAnICsgc2FtcGxlc1RhcmdldC5sZW5ndGggKyAnIHNhbXBsZXMgcHJvZHVjZWQnKTtcbi8vXG4vLyAgIC8vIGNvbnZlcnQgZnJvbSBbLTEsMV0gcmFuZ2Ugb2YgZmxvYXRpbmcgcG9pbnQgbnVtYmVycyB0byBbLTMyNzY3LDMyNzY3XSByYW5nZSBvZiBpbnRlZ2Vyc1xuLy8gICAgIHZhciBpbmRleCA9IDA7XG4vLyAgICAgdmFyIHZvbHVtZSA9IDB4N0ZGRjtcbi8vICAgICB2YXIgcGNtRW5jb2RlZEJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihzYW1wbGVzVGFyZ2V0Lmxlbmd0aCAqIDIpOyAgICAvLyBzaG9ydCBpbnRlZ2VyIHRvIGJ5dGVcbi8vICAgICB2YXIgZGF0YVZpZXcgPSBuZXcgRGF0YVZpZXcocGNtRW5jb2RlZEJ1ZmZlcik7XG4vLyAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzYW1wbGVzVGFyZ2V0Lmxlbmd0aDsgaSsrKSB7XG4vLyAgICAgICBkYXRhVmlldy5zZXRJbnQxNihpbmRleCwgc2FtcGxlc1RhcmdldFtpXSAqIHZvbHVtZSwgdHJ1ZSk7XG4vLyAgICAgICBpbmRleCArPSAyO1xuLy8gICAgIH1cbi8vXG4vLyAgICAgLy8gbDE2IGlzIHRoZSBNSU1FIHR5cGUgZm9yIDE2LWJpdCBQQ01cbi8vICAgICBjYWxsYmFja1Byb2Nlc3NBdWRpbyhuZXcgQmxvYihbZGF0YVZpZXddLCB7dHlwZTogJ2F1ZGlvL2wxNid9KSk7XG4vLyAgIH07XG4vL1xuLy8gICBidWZmZXJTb3VyY2UuY29ubmVjdChvZmZsaW5lQ29udGV4dC5kZXN0aW5hdGlvbik7XG4vLyAgIGJ1ZmZlclNvdXJjZS5zdGFydCgwKTtcbi8vICAgb2ZmbGluZUNvbnRleHQuc3RhcnRSZW5kZXJpbmcoKTtcbi8vIH07XG5cblxuXG4vKipcbiAqIENyZWF0ZXMgYSBCbG9iIHR5cGU6ICdhdWRpby9sMTYnIHdpdGggdGhlXG4gKiBjaHVuayBjb21pbmcgZnJvbSB0aGUgbWljcm9waG9uZS5cbiAqL1xuLy8gdmFyIGV4cG9ydERhdGFCdWZmZXIgPSBmdW5jdGlvbihidWZmZXIsIGJ1ZmZlclNpemUpIHtcbi8vICAgdmFyIHBjbUVuY29kZWRCdWZmZXIgPSBudWxsLFxuLy8gICAgIGRhdGFWaWV3ID0gbnVsbCxcbi8vICAgICBpbmRleCA9IDAsXG4vLyAgICAgdm9sdW1lID0gMHg3RkZGOyAvLyByYW5nZSBmcm9tIDAgdG8gMHg3RkZGIHRvIGNvbnRyb2wgdGhlIHZvbHVtZVxuLy9cbi8vICAgcGNtRW5jb2RlZEJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihidWZmZXJTaXplICogMik7XG4vLyAgIGRhdGFWaWV3ID0gbmV3IERhdGFWaWV3KHBjbUVuY29kZWRCdWZmZXIpO1xuLy9cbi8vICAgLyogRXhwbGFuYXRpb24gZm9yIHRoZSBtYXRoOiBUaGUgcmF3IHZhbHVlcyBjYXB0dXJlZCBmcm9tIHRoZSBXZWIgQXVkaW8gQVBJIGFyZVxuLy8gICAgKiBpbiAzMi1iaXQgRmxvYXRpbmcgUG9pbnQsIGJldHdlZW4gLTEgYW5kIDEgKHBlciB0aGUgc3BlY2lmaWNhdGlvbikuXG4vLyAgICAqIFRoZSB2YWx1ZXMgZm9yIDE2LWJpdCBQQ00gcmFuZ2UgYmV0d2VlbiAtMzI3NjggYW5kICszMjc2NyAoMTYtYml0IHNpZ25lZCBpbnRlZ2VyKS5cbi8vICAgICogTXVsdGlwbHkgdG8gY29udHJvbCB0aGUgdm9sdW1lIG9mIHRoZSBvdXRwdXQuIFdlIHN0b3JlIGluIGxpdHRsZSBlbmRpYW4uXG4vLyAgICAqL1xuLy8gICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlci5sZW5ndGg7IGkrKykge1xuLy8gICAgIGRhdGFWaWV3LnNldEludDE2KGluZGV4LCBidWZmZXJbaV0gKiB2b2x1bWUsIHRydWUpO1xuLy8gICAgIGluZGV4ICs9IDI7XG4vLyAgIH1cbi8vXG4vLyAgIC8vIGwxNiBpcyB0aGUgTUlNRSB0eXBlIGZvciAxNi1iaXQgUENNXG4vLyAgIHJldHVybiBuZXcgQmxvYihbZGF0YVZpZXddLCB7dHlwZTogJ2F1ZGlvL2wxNid9KTtcbi8vIH07XG5cbk1pY3JvcGhvbmUucHJvdG90eXBlLl9leHBvcnREYXRhQnVmZmVyID0gZnVuY3Rpb24oYnVmZmVyKXtcbiAgdXRpbHMuZXhwb3J0RGF0YUJ1ZmZlcihidWZmZXIsIHRoaXMuYnVmZmVyU2l6ZSk7XG59O1xuXG5cbi8vIEZ1bmN0aW9ucyB1c2VkIHRvIGNvbnRyb2wgTWljcm9waG9uZSBldmVudHMgbGlzdGVuZXJzLlxuTWljcm9waG9uZS5wcm90b3R5cGUub25TdGFydFJlY29yZGluZyA9IGZ1bmN0aW9uKCkge307XG5NaWNyb3Bob25lLnByb3RvdHlwZS5vblN0b3BSZWNvcmRpbmcgPSBmdW5jdGlvbigpIHt9O1xuTWljcm9waG9uZS5wcm90b3R5cGUub25BdWRpbyA9IGZ1bmN0aW9uKCkge307XG5cbm1vZHVsZS5leHBvcnRzID0gTWljcm9waG9uZTtcblxuTWljcm9waG9uZS5wcm90b3R5cGUuc2F2ZURhdGEgPSBmdW5jdGlvbihzYW1wbGVzKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7ICsraSkge1xuICAgIHRoaXMuc2FtcGxlc0FsbFt0aGlzLnNhbXBsZXNBbGxPZmZzZXQgKyBpXSA9IHNhbXBsZXNbaV07XG4gIH1cbiAgdGhpcy5zYW1wbGVzQWxsT2Zmc2V0ICs9IHNhbXBsZXMubGVuZ3RoO1xuICBjb25zb2xlLmxvZygnc2FtcGxlczogJyArIHRoaXMuc2FtcGxlc0FsbE9mZnNldCk7XG59O1xuXG5NaWNyb3Bob25lLnByb3RvdHlwZS5wbGF5V2F2ID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzYW1wbGVzID0gdGhpcy5zYW1wbGVzQWxsLnN1YmFycmF5KDAsIHRoaXMuc2FtcGxlc0FsbE9mZnNldCk7XG4gIHZhciBkYXRhdmlldyA9IHRoaXMuZW5jb2RlV2F2KHNhbXBsZXMsIDEsIHRoaXMuYXVkaW9Db250ZXh0LnNhbXBsZVJhdGUpO1xuICB2YXIgYXVkaW9CbG9iID0gbmV3IEJsb2IoW2RhdGF2aWV3XSwge3R5cGU6ICdhdWRpby9sMTYnfSk7XG4gIHZhciB1cmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChhdWRpb0Jsb2IpO1xuICB2YXIgYXVkaW8gPSBuZXcgQXVkaW8oKTtcbiAgYXVkaW8uc3JjID0gdXJsO1xuICBhdWRpby5wbGF5KCk7XG59O1xuXG5NaWNyb3Bob25lLnByb3RvdHlwZS5lbmNvZGVXYXYgPSBmdW5jdGlvbihzYW1wbGVzLCBudW1DaGFubmVscywgc2FtcGxlUmF0ZSkge1xuICBjb25zb2xlLmxvZygnI3NhbXBsZXM6ICcgKyBzYW1wbGVzLmxlbmd0aCk7XG4gIHZhciBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoNDQgKyBzYW1wbGVzLmxlbmd0aCAqIDIpO1xuICB2YXIgdmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xuXG4gIC8qIFJJRkYgaWRlbnRpZmllciAqL1xuICB0aGlzLndyaXRlU3RyaW5nKHZpZXcsIDAsICdSSUZGJyk7XG4gIC8qIFJJRkYgY2h1bmsgbGVuZ3RoICovXG4gIHZpZXcuc2V0VWludDMyKDQsIDM2ICsgc2FtcGxlcy5sZW5ndGggKiAyLCB0cnVlKTtcbiAgLyogUklGRiB0eXBlICovXG4gIHRoaXMud3JpdGVTdHJpbmcodmlldywgOCwgJ1dBVkUnKTtcbiAgLyogZm9ybWF0IGNodW5rIGlkZW50aWZpZXIgKi9cbiAgdGhpcy53cml0ZVN0cmluZyh2aWV3LCAxMiwgJ2ZtdCAnKTtcbiAgLyogZm9ybWF0IGNodW5rIGxlbmd0aCAqL1xuICB2aWV3LnNldFVpbnQzMigxNiwgMTYsIHRydWUpO1xuICAvKiBzYW1wbGUgZm9ybWF0IChyYXcpICovXG4gIHZpZXcuc2V0VWludDE2KDIwLCAxLCB0cnVlKTtcbiAgLyogY2hhbm5lbCBjb3VudCAqL1xuICB2aWV3LnNldFVpbnQxNigyMiwgbnVtQ2hhbm5lbHMsIHRydWUpO1xuICAvKiBzYW1wbGUgcmF0ZSAqL1xuICB2aWV3LnNldFVpbnQzMigyNCwgc2FtcGxlUmF0ZSwgdHJ1ZSk7XG4gIC8qIGJ5dGUgcmF0ZSAoc2FtcGxlIHJhdGUgKiBibG9jayBhbGlnbikgKi9cbiAgdmlldy5zZXRVaW50MzIoMjgsIHNhbXBsZVJhdGUgKiA0LCB0cnVlKTtcbiAgLyogYmxvY2sgYWxpZ24gKGNoYW5uZWwgY291bnQgKiBieXRlcyBwZXIgc2FtcGxlKSAqL1xuICB2aWV3LnNldFVpbnQxNigzMiwgbnVtQ2hhbm5lbHMgKiAyLCB0cnVlKTtcbiAgLyogYml0cyBwZXIgc2FtcGxlICovXG4gIHZpZXcuc2V0VWludDE2KDM0LCAxNiwgdHJ1ZSk7XG4gIC8qIGRhdGEgY2h1bmsgaWRlbnRpZmllciAqL1xuICB0aGlzLndyaXRlU3RyaW5nKHZpZXcsIDM2LCAnZGF0YScpO1xuICAvKiBkYXRhIGNodW5rIGxlbmd0aCAqL1xuICB2aWV3LnNldFVpbnQzMig0MCwgc2FtcGxlcy5sZW5ndGggKiAyLCB0cnVlKTtcblxuICB0aGlzLmZsb2F0VG8xNkJpdFBDTSh2aWV3LCA0NCwgc2FtcGxlcyk7XG5cbiAgcmV0dXJuIHZpZXc7XG59O1xuXG5NaWNyb3Bob25lLnByb3RvdHlwZS53cml0ZVN0cmluZyA9IGZ1bmN0aW9uKHZpZXcsIG9mZnNldCwgc3RyaW5nKXtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHJpbmcubGVuZ3RoOyBpKyspe1xuICAgIHZpZXcuc2V0VWludDgob2Zmc2V0ICsgaSwgc3RyaW5nLmNoYXJDb2RlQXQoaSkpO1xuICB9XG59O1xuXG5NaWNyb3Bob25lLnByb3RvdHlwZS5mbG9hdFRvMTZCaXRQQ00gPSBmdW5jdGlvbihvdXRwdXQsIG9mZnNldCwgaW5wdXQpe1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGlucHV0Lmxlbmd0aDsgaSsrLCBvZmZzZXQgKz0gMil7XG4gICAgdmFyIHMgPSBNYXRoLm1heCgtMSwgTWF0aC5taW4oMSwgaW5wdXRbaV0pKTtcbiAgICBvdXRwdXQuc2V0SW50MTYob2Zmc2V0LCBzIDwgMCA/IHMgKiAweDgwMDAgOiBzICogMHg3RkZGLCB0cnVlKTtcbiAgfVxufTtcbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgIFwibW9kZWxzXCI6IFtcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0ud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0L2FwaS92MS9tb2RlbHMvYXItQVJfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogMTYwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiYXItQVJfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiYXItQVJcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiTW9kZXJuIFN0YW5kYXJkIEFyYWJpYyBicm9hZGJhbmQgbW9kZWwuXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL21vZGVscy9lbi1VS19Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiAxNjAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJlbi1VS19Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJlbi1VS1wiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJVSyBFbmdsaXNoIGJyb2FkYmFuZCBtb2RlbC5cIlxuICAgICAgfSwgXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC9hcGkvdjEvbW9kZWxzL2VuLVVLX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiA4MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcImVuLVVLX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJlbi1VS1wiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJVSyBFbmdsaXNoIG5hcnJvd2JhbmQgbW9kZWwuXCJcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC9hcGkvdjEvbW9kZWxzL2VuLVVTX0Jyb2FkYmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDE2MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcImVuLVVTX0Jyb2FkYmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImVuLVVTXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlVTIEVuZ2xpc2ggYnJvYWRiYW5kIG1vZGVsLlwiXG4gICAgICB9LCBcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0ud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0L2FwaS92MS9tb2RlbHMvZW4tVVNfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDgwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiZW4tVVNfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImVuLVVTXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlVTIEVuZ2xpc2ggbmFycm93YmFuZCBtb2RlbC5cIlxuICAgICAgfSwgXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC9hcGkvdjEvbW9kZWxzL2VzLUVTX0Jyb2FkYmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDE2MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcImVzLUVTX0Jyb2FkYmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImVzLUVTXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlNwYW5pc2ggYnJvYWRiYW5kIG1vZGVsLlwiXG4gICAgICB9LCBcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0ud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0L2FwaS92MS9tb2RlbHMvZXMtRVNfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDgwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiZXMtRVNfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImVzLUVTXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlNwYW5pc2ggbmFycm93YmFuZCBtb2RlbC5cIlxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0ud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0L2FwaS92MS9tb2RlbHMvamEtSlBfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogMTYwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiamEtSlBfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiamEtSlBcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiSmFwYW5lc2UgYnJvYWRiYW5kIG1vZGVsLlwiXG4gICAgICB9LCBcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0ud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0L2FwaS92MS9tb2RlbHMvamEtSlBfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDgwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiamEtSlBfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImphLUpQXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIkphcGFuZXNlIG5hcnJvd2JhbmQgbW9kZWwuXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL21vZGVscy9wdC1CUl9Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiAxNjAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJwdC1CUl9Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJwdC1CUlwiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJCcmF6aWxpYW4gUG9ydHVndWVzZSBicm9hZGJhbmQgbW9kZWwuXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL21vZGVscy9wdC1CUl9OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogODAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJwdC1CUl9OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwicHQtQlJcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiQnJhemlsaWFuIFBvcnR1Z3Vlc2UgbmFycm93YmFuZCBtb2RlbC5cIlxuICAgICAgfSwgXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC9hcGkvdjEvbW9kZWxzL3poLUNOX0Jyb2FkYmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDE2MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcInpoLUNOX0Jyb2FkYmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcInpoLUNOXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIk1hbmRhcmluIGJyb2FkYmFuZCBtb2RlbC5cIlxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0ud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0L2FwaS92MS9tb2RlbHMvemgtQ05fTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDgwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiemgtQ05fTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcInpoLUNOXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIk1hbmRhcmluIG5hcnJvd2JhbmQgbW9kZWwuXCJcbiAgICAgIH0gXG4gICBdXG59IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNSBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4vKiBnbG9iYWwgJCAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZGlzcGxheSA9IHJlcXVpcmUoJy4vdmlld3MvZGlzcGxheW1ldGFkYXRhJyk7XG52YXIgaW5pdFNvY2tldCA9IHJlcXVpcmUoJy4vc29ja2V0JykuaW5pdFNvY2tldDtcblxuZXhwb3J0cy5oYW5kbGVGaWxlVXBsb2FkID0gZnVuY3Rpb24odHlwZSwgdG9rZW4sIG1vZGVsLCBmaWxlLCBjb250ZW50VHlwZSwgY2FsbGJhY2ssIG9uZW5kKSB7XG4gIC8vIFNldCBjdXJyZW50bHlEaXNwbGF5aW5nIHRvIHByZXZlbnQgb3RoZXIgc29ja2V0cyBmcm9tIG9wZW5pbmdcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCB0eXBlKTtcblxuICAkLnN1YnNjcmliZSgncHJvZ3Jlc3MnLCBmdW5jdGlvbihldnQsIGRhdGEpIHtcbiAgICBjb25zb2xlLmxvZygncHJvZ3Jlc3M6ICcsIGRhdGEpO1xuICB9KTtcblxuICBjb25zb2xlLmxvZygnY29udGVudFR5cGUnLCBjb250ZW50VHlwZSk7XG5cbiAgdmFyIGJhc2VTdHJpbmcgPSAnJztcbiAgdmFyIGJhc2VKU09OID0gJyc7XG5cbiAgJC5zdWJzY3JpYmUoJ3Nob3dqc29uJywgZnVuY3Rpb24oKSB7XG4gICAgdmFyICRyZXN1bHRzSlNPTiA9ICQoJyNyZXN1bHRzSlNPTicpO1xuICAgICRyZXN1bHRzSlNPTi52YWwoYmFzZUpTT04pO1xuICB9KTtcblxuICB2YXIga2V5d29yZHMgPSBkaXNwbGF5LmdldEtleXdvcmRzVG9TZWFyY2goKTtcbiAgdmFyIGtleXdvcmRzX3RocmVzaG9sZCA9IGtleXdvcmRzLmxlbmd0aCA9PSAwID8gbnVsbCA6IDAuMDE7XG5cbiAgdmFyIG9wdGlvbnMgPSB7fTtcbiAgb3B0aW9ucy50b2tlbiA9IHRva2VuO1xuICBvcHRpb25zLm1lc3NhZ2UgPSB7XG4gICAgJ2FjdGlvbic6ICdzdGFydCcsXG4gICAgJ2NvbnRlbnQtdHlwZSc6IGNvbnRlbnRUeXBlLFxuICAgICdpbnRlcmltX3Jlc3VsdHMnOiB0cnVlLFxuICAgICdjb250aW51b3VzJzogdHJ1ZSxcbiAgICAnd29yZF9jb25maWRlbmNlJzogdHJ1ZSxcbiAgICAndGltZXN0YW1wcyc6IHRydWUsXG4gICAgJ21heF9hbHRlcm5hdGl2ZXMnOiAzLFxuICAgICdpbmFjdGl2aXR5X3RpbWVvdXQnOiA2MDAsXG4gICAgJ3dvcmRfYWx0ZXJuYXRpdmVzX3RocmVzaG9sZCc6IDAuMDAxLFxuICAgICdrZXl3b3Jkc190aHJlc2hvbGQnOiBrZXl3b3Jkc190aHJlc2hvbGQsXG4gICAgJ2tleXdvcmRzJzoga2V5d29yZHNcbiAgfTtcbiAgb3B0aW9ucy5tb2RlbCA9IG1vZGVsO1xuXG4gIGZ1bmN0aW9uIG9uT3BlbigpIHtcbiAgICBjb25zb2xlLmxvZygnU29ja2V0IG9wZW5lZCcpO1xuICB9XG5cbiAgZnVuY3Rpb24gb25MaXN0ZW5pbmcoc29ja2V0KSB7XG4gICAgY29uc29sZS5sb2coJ1NvY2tldCBsaXN0ZW5pbmcnKTtcbiAgICBjYWxsYmFjayhzb2NrZXQpO1xuICB9XG5cbiAgZnVuY3Rpb24gb25NZXNzYWdlKG1zZykge1xuICAgIGlmIChtc2cucmVzdWx0cykge1xuICAgICAgLy8gQ29udmVydCB0byBjbG9zdXJlIGFwcHJvYWNoXG4gICAgICBiYXNlU3RyaW5nID0gZGlzcGxheS5zaG93UmVzdWx0KG1zZywgYmFzZVN0cmluZywgbW9kZWwpO1xuICAgICAgYmFzZUpTT04gPSBKU09OLnN0cmluZ2lmeShtc2csIG51bGwsIDIpO1xuICAgICAgZGlzcGxheS5zaG93SlNPTihiYXNlSlNPTik7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb25FcnJvcihldnQpIHtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsICdmYWxzZScpO1xuICAgIG9uZW5kKGV2dCk7XG4gICAgY29uc29sZS5sb2coJ1NvY2tldCBlcnI6ICcsIGV2dC5jb2RlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uQ2xvc2UoZXZ0KSB7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCAnZmFsc2UnKTtcbiAgICBvbmVuZChldnQpO1xuICAgIGNvbnNvbGUubG9nKCdTb2NrZXQgY2xvc2luZzogJywgZXZ0KTtcbiAgfVxuXG4gIGluaXRTb2NrZXQob3B0aW9ucywgb25PcGVuLCBvbkxpc3RlbmluZywgb25NZXNzYWdlLCBvbkVycm9yLCBvbkNsb3NlKTtcbn07XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDE1IElCTSBDb3JwLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbi8qIGdsb2JhbCAkICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBpbml0U29ja2V0ID0gcmVxdWlyZSgnLi9zb2NrZXQnKS5pbml0U29ja2V0O1xudmFyIGRpc3BsYXkgPSByZXF1aXJlKCcuL3ZpZXdzL2Rpc3BsYXltZXRhZGF0YScpO1xuXG5leHBvcnRzLmhhbmRsZU1pY3JvcGhvbmUgPSBmdW5jdGlvbih0b2tlbiwgbW9kZWwsIG1pYywgY2FsbGJhY2spIHtcblxuICBpZiAobW9kZWwuaW5kZXhPZignTmFycm93YmFuZCcpID4gLTEpIHtcbiAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdNaWNyb3Bob25lIHRyYW5zY3JpcHRpb24gY2Fubm90IGFjY29tb2RhdGUgbmFycm93YmFuZCBtb2RlbHMsICcgK1xuICAgICAgJ3BsZWFzZSBzZWxlY3QgYW5vdGhlcicpO1xuICAgIGNhbGxiYWNrKGVyciwgbnVsbCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgJC5wdWJsaXNoKCdjbGVhcnNjcmVlbicpO1xuXG4gIC8vIFRlc3Qgb3V0IHdlYnNvY2tldFxuICB2YXIgYmFzZVN0cmluZyA9ICcnO1xuICB2YXIgYmFzZUpTT04gPSAnJztcblxuICAkLnN1YnNjcmliZSgnc2hvd2pzb24nLCBmdW5jdGlvbigpIHtcbiAgICB2YXIgJHJlc3VsdHNKU09OID0gJCgnI3Jlc3VsdHNKU09OJyk7XG4gICAgJHJlc3VsdHNKU09OLnZhbChiYXNlSlNPTik7XG4gIH0pO1xuXG4gIHZhciBrZXl3b3JkcyA9IGRpc3BsYXkuZ2V0S2V5d29yZHNUb1NlYXJjaCgpO1xuICB2YXIga2V5d29yZHNfdGhyZXNob2xkID0ga2V5d29yZHMubGVuZ3RoID09IDAgPyBudWxsIDogMC4wMTtcblxuICB2YXIgb3B0aW9ucyA9IHt9O1xuICBvcHRpb25zLnRva2VuID0gdG9rZW47XG4gIG9wdGlvbnMubWVzc2FnZSA9IHtcbiAgICAnYWN0aW9uJzogJ3N0YXJ0JyxcbiAgICAnY29udGVudC10eXBlJzogJ2F1ZGlvL2wxNjtyYXRlPTE2MDAwJyxcbiAgICAnaW50ZXJpbV9yZXN1bHRzJzogdHJ1ZSxcbiAgICAnY29udGludW91cyc6IHRydWUsXG4gICAgJ3dvcmRfY29uZmlkZW5jZSc6IHRydWUsXG4gICAgJ3RpbWVzdGFtcHMnOiB0cnVlLFxuICAgICdtYXhfYWx0ZXJuYXRpdmVzJzogMyxcbiAgICAnaW5hY3Rpdml0eV90aW1lb3V0JzogNjAwLFxuICAgICd3b3JkX2FsdGVybmF0aXZlc190aHJlc2hvbGQnOiAwLjAwMSxcbiAgICAna2V5d29yZHNfdGhyZXNob2xkJzoga2V5d29yZHNfdGhyZXNob2xkLFxuICAgICdrZXl3b3Jkcyc6IGtleXdvcmRzXG4gIH07XG4gIG9wdGlvbnMubW9kZWwgPSBtb2RlbDtcblxuICBmdW5jdGlvbiBvbk9wZW4oc29ja2V0KSB7XG4gICAgY29uc29sZS5sb2coJ01pYyBzb2NrZXQ6IG9wZW5lZCcpO1xuICAgIGNhbGxiYWNrKG51bGwsIHNvY2tldCk7XG4gIH1cblxuICBmdW5jdGlvbiBvbkxpc3RlbmluZyhzb2NrZXQpIHtcbiAgICBtaWMub25BdWRpbyA9IGZ1bmN0aW9uKGJsb2IpIHtcbiAgICAgIGlmIChzb2NrZXQucmVhZHlTdGF0ZSA8IDIpIHtcbiAgICAgICAgc29ja2V0LnNlbmQoYmxvYik7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uTWVzc2FnZShtc2cpIHtcbiAgICBpZiAobXNnLnJlc3VsdHMpIHtcbiAgICAgIC8vIENvbnZlcnQgdG8gY2xvc3VyZSBhcHByb2FjaFxuICAgICAgYmFzZVN0cmluZyA9IGRpc3BsYXkuc2hvd1Jlc3VsdChtc2csIGJhc2VTdHJpbmcsIG1vZGVsKTtcbiAgICAgIGJhc2VKU09OID0gSlNPTi5zdHJpbmdpZnkobXNnLCBudWxsLCAyKTtcbiAgICAgIGRpc3BsYXkuc2hvd0pTT04oYmFzZUpTT04pO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9uRXJyb3IoKSB7XG4gICAgY29uc29sZS5sb2coJ01pYyBzb2NrZXQgZXJyOiAnLCBlcnIpO1xuICB9XG5cbiAgZnVuY3Rpb24gb25DbG9zZShldnQpIHtcbiAgICBjb25zb2xlLmxvZygnTWljIHNvY2tldCBjbG9zZTogJywgZXZ0KTtcbiAgfVxuXG4gIGluaXRTb2NrZXQob3B0aW9ucywgb25PcGVuLCBvbkxpc3RlbmluZywgb25NZXNzYWdlLCBvbkVycm9yLCBvbkNsb3NlKTtcbn07XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDE1IElCTSBDb3JwLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbi8qIGdsb2JhbCAkOmZhbHNlLCBCVUZGRVJTSVpFICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIG1vZGVscyA9IHJlcXVpcmUoJy4vZGF0YS9tb2RlbHMuanNvbicpLm1vZGVscztcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnV0aWxzLmluaXRQdWJTdWIoKTtcbnZhciBpbml0Vmlld3MgPSByZXF1aXJlKCcuL3ZpZXdzJykuaW5pdFZpZXdzO1xudmFyIHNob3dlcnJvciA9IHJlcXVpcmUoJy4vdmlld3Mvc2hvd2Vycm9yJyk7XG52YXIgc2hvd0Vycm9yID0gc2hvd2Vycm9yLnNob3dFcnJvcjtcbnZhciBnZXRNb2RlbHMgPSByZXF1aXJlKCcuL21vZGVscycpLmdldE1vZGVscztcblxud2luZG93LkJVRkZFUlNJWkUgPSA4MTkyO1xuXG4kKGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpIHtcbiAgdmFyIHRva2VuR2VuZXJhdG9yID0gdXRpbHMuY3JlYXRlVG9rZW5HZW5lcmF0b3IoKTtcblxuICAvLyBNYWtlIGNhbGwgdG8gQVBJIHRvIHRyeSBhbmQgZ2V0IHRva2VuXG4gIHRva2VuR2VuZXJhdG9yLmdldFRva2VuKGZ1bmN0aW9uKGVyciwgdG9rZW4pIHtcbiAgICB3aW5kb3cub25iZWZvcmV1bmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgIGxvY2FsU3RvcmFnZS5jbGVhcigpO1xuICAgIH07XG5cbiAgICBpZiAoIXRva2VuKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdObyBhdXRob3JpemF0aW9uIHRva2VuIGF2YWlsYWJsZScpO1xuICAgICAgY29uc29sZS5lcnJvcignQXR0ZW1wdGluZyB0byByZWNvbm5lY3QuLi4nKTtcblxuICAgICAgaWYgKGVyciAmJiBlcnIuY29kZSlcbiAgICAgICAgc2hvd0Vycm9yKCdTZXJ2ZXIgZXJyb3IgJyArIGVyci5jb2RlICsgJzogJyArIGVyci5lcnJvcik7XG4gICAgICBlbHNlXG4gICAgICAgIHNob3dFcnJvcignU2VydmVyIGVycm9yICcgKyBlcnIuY29kZSArICc6IHBsZWFzZSByZWZyZXNoIHlvdXIgYnJvd3NlciBhbmQgdHJ5IGFnYWluJyk7XG4gICAgfVxuXG4gICAgdmFyIHZpZXdDb250ZXh0ID0ge1xuICAgICAgY3VycmVudE1vZGVsOiAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnLFxuICAgICAgbW9kZWxzOiBtb2RlbHMsXG4gICAgICB0b2tlbjogdG9rZW4sXG4gICAgICBidWZmZXJTaXplOiBCVUZGRVJTSVpFXG4gICAgfTtcblxuICAgIGluaXRWaWV3cyh2aWV3Q29udGV4dCk7XG5cbiAgICAvLyBTYXZlIG1vZGVscyB0byBsb2NhbHN0b3JhZ2VcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbW9kZWxzJywgSlNPTi5zdHJpbmdpZnkobW9kZWxzKSk7XG5cbiAgICAvLyBDaGVjayBpZiBwbGF5YmFjayBmdW5jdGlvbmFsaXR5IGlzIGludm9rZWRcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgncGxheWJhY2tPTicsIGZhbHNlKTtcbiAgICB2YXIgcXVlcnkgPSB3aW5kb3cubG9jYXRpb24uc2VhcmNoLnN1YnN0cmluZygxKTtcbiAgICB2YXIgdmFycyA9IHF1ZXJ5LnNwbGl0KCcmJyk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2YXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcGFpciA9IHZhcnNbaV0uc3BsaXQoJz0nKTtcbiAgICAgIGlmIChkZWNvZGVVUklDb21wb25lbnQocGFpclswXSkgPT09ICdkZWJ1ZycpIHtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3BsYXliYWNrT04nLGRlY29kZVVSSUNvbXBvbmVudChwYWlyWzFdKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gU2V0IGRlZmF1bHQgY3VycmVudCBtb2RlbFxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50TW9kZWwnLCAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnc2Vzc2lvblBlcm1pc3Npb25zJywgJ3RydWUnKTtcblxuICAgIGdldE1vZGVscyh0b2tlbik7XG5cbiAgICAkLnN1YnNjcmliZSgnY2xlYXJzY3JlZW4nLCBmdW5jdGlvbigpIHtcbiAgICAgICQoJyNyZXN1bHRzVGV4dCcpLnRleHQoJycpO1xuICAgICAgJCgnI3Jlc3VsdHNKU09OJykudGV4dCgnJyk7XG4gICAgICAkKCcuZXJyb3Itcm93JykuaGlkZSgpO1xuICAgICAgJCgnLm5vdGlmaWNhdGlvbi1yb3cnKS5oaWRlKCk7XG4gICAgICAkKCcuaHlwb3RoZXNlcyA+IHVsJykuZW1wdHkoKTtcbiAgICAgICQoJyNtZXRhZGF0YVRhYmxlQm9keScpLmVtcHR5KCk7XG4gICAgfSk7XG5cbiAgfSk7XG5cbn0pO1xuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNSBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4ndXNlIHN0cmljdCc7XG52YXIgc2VsZWN0TW9kZWwgPSByZXF1aXJlKCcuL3ZpZXdzL3NlbGVjdG1vZGVsJykuaW5pdFNlbGVjdE1vZGVsO1xuXG5leHBvcnRzLmdldE1vZGVscyA9IGZ1bmN0aW9uKHRva2VuKSB7XG4gIHZhciB2aWV3Q29udGV4dCA9IHtcbiAgICBjdXJyZW50TW9kZWw6ICdlbi1VU19Ccm9hZGJhbmRNb2RlbCcsXG4gICAgbW9kZWxzOiBudWxsLFxuICAgIHRva2VuOiB0b2tlbixcbiAgICBidWZmZXJTaXplOiBCVUZGRVJTSVpFXG4gIH07XG4gIHZhciBtb2RlbFVybCA9ICdodHRwczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL21vZGVscyc7XG4gIHZhciBzdHRSZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gIHN0dFJlcXVlc3Qub3BlbignR0VUJywgbW9kZWxVcmwsIHRydWUpO1xuICBzdHRSZXF1ZXN0LndpdGhDcmVkZW50aWFscyA9IHRydWU7XG4gIHN0dFJlcXVlc3Quc2V0UmVxdWVzdEhlYWRlcignQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgc3R0UmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKCdYLVdhdHNvbi1BdXRob3JpemF0aW9uLVRva2VuJywgdG9rZW4pO1xuICBzdHRSZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZXNwb25zZSA9IEpTT04ucGFyc2Uoc3R0UmVxdWVzdC5yZXNwb25zZVRleHQpO1xuICAgIHZhciBzb3J0ZWQgPSByZXNwb25zZS5tb2RlbHMuc29ydChmdW5jdGlvbihhLGIpIHtcbiAgICAgIGlmIChhLm5hbWUgPiBiLm5hbWUpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgICB9XG4gICAgICBpZiAoYS5uYW1lIDwgYi5uYW1lKSB7XG4gICAgICAgIHJldHVybiAtMTtcbiAgICAgIH1cbiAgICAgIHJldHVybiAwO1xuICAgIH0pO1xuICAgIHJlc3BvbnNlLm1vZGVscyA9IHNvcnRlZDtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbW9kZWxzJywgSlNPTi5zdHJpbmdpZnkocmVzcG9uc2UubW9kZWxzKSk7XG4gICAgdmlld0NvbnRleHQubW9kZWxzID0gcmVzcG9uc2UubW9kZWxzO1xuICAgIHNlbGVjdE1vZGVsKHZpZXdDb250ZXh0KTtcbiAgfTtcbiAgc3R0UmVxdWVzdC5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgdmlld0NvbnRleHQubW9kZWxzID0gcmVxdWlyZSgnLi9kYXRhL21vZGVscy5qc29uJykubW9kZWxzO1xuICAgIHNlbGVjdE1vZGVsKHZpZXdDb250ZXh0KTtcbiAgfTtcbiAgc3R0UmVxdWVzdC5zZW5kKCk7XG59O1xuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNSBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4vKiBnbG9iYWwgJDpmYWxzZSAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnZhciBzaG93ZXJyb3IgPSByZXF1aXJlKCcuL3ZpZXdzL3Nob3dlcnJvcicpO1xudmFyIHNob3dFcnJvciA9IHNob3dlcnJvci5zaG93RXJyb3I7XG5cbi8vIE1pbmkgV1MgY2FsbGJhY2sgQVBJLCBzbyB3ZSBjYW4gaW5pdGlhbGl6ZVxuLy8gd2l0aCBtb2RlbCBhbmQgdG9rZW4gaW4gVVJJLCBwbHVzXG4vLyBzdGFydCBtZXNzYWdlXG5cbi8vIEluaXRpYWxpemUgY2xvc3VyZSwgd2hpY2ggaG9sZHMgbWF4aW11bSBnZXRUb2tlbiBjYWxsIGNvdW50XG52YXIgdG9rZW5HZW5lcmF0b3IgPSB1dGlscy5jcmVhdGVUb2tlbkdlbmVyYXRvcigpO1xuXG52YXIgaW5pdFNvY2tldCA9IGV4cG9ydHMuaW5pdFNvY2tldCA9IGZ1bmN0aW9uKG9wdGlvbnMsIG9ub3Blbiwgb25saXN0ZW5pbmcsIG9ubWVzc2FnZSwgb25lcnJvciwgb25jbG9zZSkge1xuICB2YXIgbGlzdGVuaW5nO1xuICAvLyBmdW5jdGlvbiB3aXRoRGVmYXVsdCh2YWwsIGRlZmF1bHRWYWwpIHtcbiAgLy8gICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ3VuZGVmaW5lZCcgPyBkZWZhdWx0VmFsIDogdmFsO1xuICAvLyB9XG4gIHZhciBzb2NrZXQ7XG4gIHZhciB0b2tlbiA9IG9wdGlvbnMudG9rZW47XG4gIHZhciBtb2RlbCA9IG9wdGlvbnMubW9kZWwgfHwgbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRNb2RlbCcpO1xuICB2YXIgbWVzc2FnZSA9IG9wdGlvbnMubWVzc2FnZSB8fCB7J2FjdGlvbic6ICdzdGFydCd9O1xuICAvLyB2YXIgc2Vzc2lvblBlcm1pc3Npb25zID0gd2l0aERlZmF1bHQob3B0aW9ucy5zZXNzaW9uUGVybWlzc2lvbnMsXG4gIC8vICAgSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnc2Vzc2lvblBlcm1pc3Npb25zJykpKTtcbiAgLy8gdmFyIHNlc3Npb25QZXJtaXNzaW9uc1F1ZXJ5UGFyYW0gPSBzZXNzaW9uUGVybWlzc2lvbnMgPyAnMCcgOiAnMSc7XG4gIC8vIFRPRE86IGFkZCAnJlgtV2F0c29uLUxlYXJuaW5nLU9wdC1PdXQ9JyArIHNlc3Npb25QZXJtaXNzaW9uc1F1ZXJ5UGFyYW0gb25jZVxuICAvLyB3ZSBmaW5kIHdoeSBpdCdzIG5vdCBhY2NlcHRlZCBhcyBxdWVyeSBwYXJhbWV0ZXJcbiAgLy8gdmFyIHVybCA9IG9wdGlvbnMuc2VydmljZVVSSSB8fCAnd3NzOi8vc3RyZWFtLWQud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0L2FwaS92MS9yZWNvZ25pemU/d2F0c29uLXRva2VuPSc7XG4gIHZhciB1cmwgPSBvcHRpb25zLnNlcnZpY2VVUkkgfHwgJ3dzczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL3JlY29nbml6ZT93YXRzb24tdG9rZW49JztcbiAgdXJsICs9IHRva2VuICsgJyZtb2RlbD0nICsgbW9kZWw7XG4gIGNvbnNvbGUubG9nKCdVUkwgbW9kZWwnLCBtb2RlbCk7XG4gIHRyeSB7XG4gICAgc29ja2V0ID0gbmV3IFdlYlNvY2tldCh1cmwpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKCdXUyBjb25uZWN0aW9uIGVycm9yOiAnLCBlcnIpO1xuICB9XG4gIHNvY2tldC5vbm9wZW4gPSBmdW5jdGlvbigpIHtcbiAgICBsaXN0ZW5pbmcgPSBmYWxzZTtcbiAgICAkLnN1YnNjcmliZSgnaGFyZHNvY2tldHN0b3AnLCBmdW5jdGlvbigpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdNSUNST1BIT05FOiBjbG9zZS4nKTtcbiAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHthY3Rpb246J3N0b3AnfSkpO1xuICAgICAgc29ja2V0LmNsb3NlKCk7XG4gICAgfSk7XG4gICAgJC5zdWJzY3JpYmUoJ3NvY2tldHN0b3AnLCBmdW5jdGlvbigpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdNSUNST1BIT05FOiBjbG9zZS4nKTtcbiAgICAgIHNvY2tldC5jbG9zZSgpO1xuICAgIH0pO1xuICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpKTtcbiAgICBvbm9wZW4oc29ja2V0KTtcbiAgfTtcbiAgc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciBtc2cgPSBKU09OLnBhcnNlKGV2dC5kYXRhKTtcbiAgICBpZiAobXNnLmVycm9yKSB7XG4gICAgICBzaG93RXJyb3IobXNnLmVycm9yKTtcbiAgICAgICQucHVibGlzaCgnaGFyZHNvY2tldHN0b3AnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKG1zZy5zdGF0ZSA9PT0gJ2xpc3RlbmluZycpIHtcbiAgICAgIC8vIEVhcmx5IGN1dCBvZmYsIHdpdGhvdXQgbm90aWZpY2F0aW9uXG4gICAgICBpZiAoIWxpc3RlbmluZykge1xuICAgICAgICBvbmxpc3RlbmluZyhzb2NrZXQpO1xuICAgICAgICBsaXN0ZW5pbmcgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ01JQ1JPUEhPTkU6IENsb3Npbmcgc29ja2V0LicpO1xuICAgICAgICBzb2NrZXQuY2xvc2UoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgb25tZXNzYWdlKG1zZywgc29ja2V0KTtcbiAgfTtcblxuICBzb2NrZXQub25lcnJvciA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIGNvbnNvbGUubG9nKCdXUyBvbmVycm9yOiAnLCBldnQpO1xuICAgIHNob3dFcnJvcignQXBwbGljYXRpb24gZXJyb3IgJyArIGV2dC5jb2RlICsgJzogcGxlYXNlIHJlZnJlc2ggeW91ciBicm93c2VyIGFuZCB0cnkgYWdhaW4nKTtcbiAgICAkLnB1Ymxpc2goJ2NsZWFyc2NyZWVuJyk7XG4gICAgb25lcnJvcihldnQpO1xuICB9O1xuXG4gIHNvY2tldC5vbmNsb3NlID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgY29uc29sZS5sb2coJ1dTIG9uY2xvc2U6ICcsIGV2dCk7XG4gICAgaWYgKGV2dC5jb2RlID09PSAxMDA2KSB7XG4gICAgICAvLyBBdXRoZW50aWNhdGlvbiBlcnJvciwgdHJ5IHRvIHJlY29ubmVjdFxuICAgICAgY29uc29sZS5sb2coJ2dlbmVyYXRvciBjb3VudCcsIHRva2VuR2VuZXJhdG9yLmdldENvdW50KCkpO1xuICAgICAgaWYgKHRva2VuR2VuZXJhdG9yLmdldENvdW50KCkgPiAxKSB7XG4gICAgICAgICQucHVibGlzaCgnaGFyZHNvY2tldHN0b3AnKTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBhdXRob3JpemF0aW9uIHRva2VuIGlzIGN1cnJlbnRseSBhdmFpbGFibGUnKTtcbiAgICAgIH1cbiAgICAgIHRva2VuR2VuZXJhdG9yLmdldFRva2VuKGZ1bmN0aW9uKGVyciwgdG9rZW4pIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICQucHVibGlzaCgnaGFyZHNvY2tldHN0b3AnKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS5sb2coJ0ZldGNoaW5nIGFkZGl0aW9uYWwgdG9rZW4uLi4nKTtcbiAgICAgICAgb3B0aW9ucy50b2tlbiA9IHRva2VuO1xuICAgICAgICBpbml0U29ja2V0KG9wdGlvbnMsIG9ub3Blbiwgb25saXN0ZW5pbmcsIG9ubWVzc2FnZSwgb25lcnJvciwgb25jbG9zZSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGV2dC5jb2RlID09PSAxMDExKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdTZXJ2ZXIgZXJyb3IgJyArIGV2dC5jb2RlICsgJzogcGxlYXNlIHJlZnJlc2ggeW91ciBicm93c2VyIGFuZCB0cnkgYWdhaW4nKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGV2dC5jb2RlID4gMTAwMCkge1xuICAgICAgY29uc29sZS5lcnJvcignU2VydmVyIGVycm9yICcgKyBldnQuY29kZSArICc6IHBsZWFzZSByZWZyZXNoIHlvdXIgYnJvd3NlciBhbmQgdHJ5IGFnYWluJyk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIC8vIE1hZGUgaXQgdGhyb3VnaCwgbm9ybWFsIGNsb3NlXG4gICAgJC51bnN1YnNjcmliZSgnaGFyZHNvY2tldHN0b3AnKTtcbiAgICAkLnVuc3Vic2NyaWJlKCdzb2NrZXRzdG9wJyk7XG4gICAgb25jbG9zZShldnQpO1xuICB9O1xuXG59O1xuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNSBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLy8gRm9yIG5vbi12aWV3IGxvZ2ljXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydqUXVlcnknXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ2pRdWVyeSddIDogbnVsbCk7XG5cbnZhciBmaWxlQmxvY2sgPSBmdW5jdGlvbihfb2Zmc2V0LCBsZW5ndGgsIF9maWxlLCByZWFkQ2h1bmspIHtcbiAgdmFyIHIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICB2YXIgYmxvYiA9IF9maWxlLnNsaWNlKF9vZmZzZXQsIGxlbmd0aCArIF9vZmZzZXQpO1xuICByLm9ubG9hZCA9IHJlYWRDaHVuaztcbiAgci5yZWFkQXNBcnJheUJ1ZmZlcihibG9iKTtcbn07XG5cbi8vIEJhc2VkIG9uIGFsZWRpYWZlcmlhJ3MgU08gcmVzcG9uc2Vcbi8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTQ0MzgxODcvamF2YXNjcmlwdC1maWxlcmVhZGVyLXBhcnNpbmctbG9uZy1maWxlLWluLWNodW5rc1xuZXhwb3J0cy5vbkZpbGVQcm9ncmVzcyA9IGZ1bmN0aW9uKG9wdGlvbnMsIG9uZGF0YSwgcnVubmluZywgb25lcnJvciwgb25lbmQsIHNhbXBsaW5nUmF0ZSkge1xuICB2YXIgZmlsZSA9IG9wdGlvbnMuZmlsZTtcbiAgdmFyIGZpbGVTaXplID0gZmlsZS5zaXplO1xuICB2YXIgY2h1bmtTaXplID0gb3B0aW9ucy5idWZmZXJTaXplIHx8IDE2MDAwOyAgLy8gaW4gYnl0ZXNcbiAgdmFyIG9mZnNldCA9IDA7XG4gIHZhciByZWFkQ2h1bmsgPSBmdW5jdGlvbihldnQpIHtcbiAgICBpZiAob2Zmc2V0ID49IGZpbGVTaXplKSB7XG4gICAgICBjb25zb2xlLmxvZygnRG9uZSByZWFkaW5nIGZpbGUnKTtcbiAgICAgIG9uZW5kKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghcnVubmluZygpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChldnQudGFyZ2V0LmVycm9yID09IG51bGwpIHtcbiAgICAgIHZhciBidWZmZXIgPSBldnQudGFyZ2V0LnJlc3VsdDtcbiAgICAgIHZhciBsZW4gPSBidWZmZXIuYnl0ZUxlbmd0aDtcbiAgICAgIG9mZnNldCArPSBsZW47XG4gICAgICAvLyBjb25zb2xlLmxvZygnc2VuZGluZzogJyArIGxlbik7XG4gICAgICBvbmRhdGEoYnVmZmVyKTsgLy8gY2FsbGJhY2sgZm9yIGhhbmRsaW5nIHJlYWQgY2h1bmtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGVycm9yTWVzc2FnZSA9IGV2dC50YXJnZXQuZXJyb3I7XG4gICAgICBjb25zb2xlLmxvZygnUmVhZCBlcnJvcjogJyArIGVycm9yTWVzc2FnZSk7XG4gICAgICBvbmVycm9yKGVycm9yTWVzc2FnZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIHVzZSB0aGlzIHRpbWVvdXQgdG8gcGFjZSB0aGUgZGF0YSB1cGxvYWQgZm9yIHRoZSBwbGF5U2FtcGxlIGNhc2UsXG4gICAgLy8gdGhlIGlkZWEgaXMgdGhhdCB0aGUgaHlwcyBkbyBub3QgYXJyaXZlIGJlZm9yZSB0aGUgYXVkaW8gaXMgcGxheWVkIGJhY2tcbiAgICBpZiAoc2FtcGxpbmdSYXRlKSB7XG4gICAgICAvLyBjb25zb2xlLmxvZygnc2FtcGxpbmdSYXRlOiAnICtcbiAgICAgIC8vICBzYW1wbGluZ1JhdGUgKyAnIHRpbWVvdXQ6ICcgKyAoY2h1bmtTaXplICogMTAwMCkgLyAoc2FtcGxpbmdSYXRlICogMikpO1xuICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgZmlsZUJsb2NrKG9mZnNldCwgY2h1bmtTaXplLCBmaWxlLCByZWFkQ2h1bmspO1xuICAgICAgfSwgKGNodW5rU2l6ZSAqIDEwMDApIC8gKHNhbXBsaW5nUmF0ZSAqIDIpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZmlsZUJsb2NrKG9mZnNldCwgY2h1bmtTaXplLCBmaWxlLCByZWFkQ2h1bmspO1xuICAgIH1cbiAgfTtcbiAgZmlsZUJsb2NrKG9mZnNldCwgY2h1bmtTaXplLCBmaWxlLCByZWFkQ2h1bmspO1xufTtcblxuZXhwb3J0cy5jcmVhdGVUb2tlbkdlbmVyYXRvciA9IGZ1bmN0aW9uKCkge1xuICAvLyBNYWtlIGNhbGwgdG8gQVBJIHRvIHRyeSBhbmQgZ2V0IHRva2VuXG4gIHZhciBoYXNCZWVuUnVuVGltZXMgPSAwO1xuICByZXR1cm4ge1xuICAgIGdldFRva2VuOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgKytoYXNCZWVuUnVuVGltZXM7XG4gICAgICBpZiAoaGFzQmVlblJ1blRpbWVzID4gNSkge1xuICAgICAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdDYW5ub3QgcmVhY2ggc2VydmVyJyk7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIGVycik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHZhciB1cmwgPSAnL2FwaS90b2tlbic7XG4gICAgICB2YXIgdG9rZW5SZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICB0b2tlblJlcXVlc3Qub3BlbignUE9TVCcsIHVybCwgdHJ1ZSk7XG4gICAgICB0b2tlblJlcXVlc3Quc2V0UmVxdWVzdEhlYWRlcignY3NyZi10b2tlbicsJCgnbWV0YVtuYW1lPVwiY3RcIl0nKS5hdHRyKCdjb250ZW50JykpO1xuICAgICAgdG9rZW5SZXF1ZXN0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodG9rZW5SZXF1ZXN0LnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICBpZiAodG9rZW5SZXF1ZXN0LnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgICB2YXIgdG9rZW4gPSB0b2tlblJlcXVlc3QucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgdG9rZW4pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgZXJyb3IgPSAnQ2Fubm90IHJlYWNoIHNlcnZlcic7XG4gICAgICAgICAgICBpZiAodG9rZW5SZXF1ZXN0LnJlc3BvbnNlVGV4dCl7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZXJyb3IgPSBKU09OLnBhcnNlKHRva2VuUmVxdWVzdC5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgZXJyb3IgPSB0b2tlblJlcXVlc3QucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYWxsYmFjayhlcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgdG9rZW5SZXF1ZXN0LnNlbmQoKTtcbiAgICB9LFxuICAgIGdldENvdW50OiBmdW5jdGlvbigpIHsgcmV0dXJuIGhhc0JlZW5SdW5UaW1lczsgfVxuICB9O1xufTtcblxuZXhwb3J0cy5pbml0UHViU3ViID0gZnVuY3Rpb24oKSB7XG4gIHZhciBvID0gJCh7fSk7XG4gICQuc3Vic2NyaWJlID0gby5vbi5iaW5kKG8pO1xuICAkLnVuc3Vic2NyaWJlID0gby5vZmYuYmluZChvKTtcbiAgJC5wdWJsaXNoID0gby50cmlnZ2VyLmJpbmQobyk7XG59O1xuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4vKiBnbG9iYWwgJCAqL1xuJ3VzZSBzdHJpY3QnO1xuXG4vKiBlc2xpbnQgbm8taW52YWxpZC10aGlzOiAwKi9cblxuZXhwb3J0cy5pbml0QW5pbWF0ZVBhbmVsID0gZnVuY3Rpb24oKSB7XG4gICQoJy5wYW5lbC1oZWFkaW5nIHNwYW4uY2xpY2thYmxlJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgaWYgKCQodGhpcykuaGFzQ2xhc3MoJ3BhbmVsLWNvbGxhcHNlZCcpKSB7XG4gICAgICAvLyBleHBhbmQgdGhlIHBhbmVsXG4gICAgICAkKHRoaXMpLnBhcmVudHMoJy5wYW5lbCcpLmZpbmQoJy5wYW5lbC1ib2R5Jykuc2xpZGVEb3duKCk7XG4gICAgICAkKHRoaXMpLnJlbW92ZUNsYXNzKCdwYW5lbC1jb2xsYXBzZWQnKTtcbiAgICAgICQodGhpcykuZmluZCgnaScpLnJlbW92ZUNsYXNzKCdjYXJldC1kb3duJykuYWRkQ2xhc3MoJ2NhcmV0LXVwJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGNvbGxhcHNlIHRoZSBwYW5lbFxuICAgICAgJCh0aGlzKS5wYXJlbnRzKCcucGFuZWwnKS5maW5kKCcucGFuZWwtYm9keScpLnNsaWRlVXAoKTtcbiAgICAgICQodGhpcykuYWRkQ2xhc3MoJ3BhbmVsLWNvbGxhcHNlZCcpO1xuICAgICAgJCh0aGlzKS5maW5kKCdpJykucmVtb3ZlQ2xhc3MoJ2NhcmV0LXVwJykuYWRkQ2xhc3MoJ2NhcmV0LWRvd24nKTtcbiAgICB9XG4gIH0pO1xufTtcbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgSUJNIENvcnAuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuLyogZ2xvYmFsICQgKi9cbi8qIGVzbGludCBuby1pbnZhbGlkLXRoaXM6IDAsIGJyYWNlLXN0eWxlOiAwLCBkb3Qtbm90YXRpb246IDAsIHNwYWNlZC1jb21tZW50OjAgKi9cbid1c2Ugc3RyaWN0JztcblxuY29uc3QgSU5JVElBTF9PRkZTRVRfWCA9IDMwO1xuY29uc3QgSU5JVElBTF9PRkZTRVRfWSA9IDMwO1xuY29uc3QgZm9udFNpemUgPSAxNjtcbmNvbnN0IGRlbHRhX3kgPSAyICogZm9udFNpemU7XG5jb25zdCByYWRpdXMgPSA1O1xuY29uc3Qgc3BhY2UgPSA0O1xuY29uc3QgaHN0ZXAgPSAzMjtcbmNvbnN0IHRpbWVvdXQgPSA1MDA7XG5jb25zdCBkZWZhdWx0Rm9udCA9IGZvbnRTaXplICsgJ3B4IEFyaWFsJztcbmNvbnN0IGJvbGRGb250ID0gJ2JvbGQgJyArIGZvbnRTaXplICsgJ3B4IEFyaWFsJztcbmNvbnN0IGl0YWxpY0ZvbnQgPSAnaXRhbGljICcgKyBmb250U2l6ZSArICdweCBBcmlhbCc7XG5jb25zdCBvcGFjaXR5ID0gJzAuNic7XG5cbnZhciBzaG93QWxsSHlwb3RoZXNlcyA9IHRydWU7XG52YXIga2V5d29yZHNJbnB1dERpcnR5ID0gZmFsc2U7XG52YXIga2V5d29yZHNfdG9fc2VhcmNoID0gW107XG52YXIgZGV0ZWN0ZWRfa2V5d29yZHMgPSB7fTtcbnZhciBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FudmFzJyk7XG52YXIgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG52YXIgaHNsaWRlciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoc2xpZGVyJyk7XG52YXIgdnNsaWRlciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd2c2xpZGVyJyk7XG52YXIgbGVmdEFycm93RW5hYmxlZCA9IGZhbHNlO1xudmFyIHJpZ2h0QXJyb3dFbmFibGVkID0gZmFsc2U7XG52YXIgd29ya2VyID0gbnVsbDtcbnZhciBydW5UaW1lciA9IGZhbHNlO1xudmFyIHNjcm9sbGVkID0gZmFsc2U7XG4vLyB2YXIgdGV4dFNjcm9sbGVkID0gZmFsc2U7XG52YXIgcHVzaGVkID0gMDtcbnZhciBwb3BwZWQgPSAwO1xuXG5jdHguZm9udCA9IGRlZmF1bHRGb250O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gY2xhc3MgV29yZEFsdGVybmF0aXZlXG52YXIgV29yZEFsdGVybmF0aXZlID0gZnVuY3Rpb24odGV4dCwgY29uZmlkZW5jZSkge1xuICBpZiAodGV4dCA9PSAnPGVwcz4nKSB7XG4gICAgdGhpcy5fdGV4dCA9ICc8c2lsZW5jZT4nO1xuICAgIHRoaXMuX2ZvcmVDb2xvciA9ICcjODg4JztcbiAgfVxuICBlbHNlIGlmICh0ZXh0ID09ICclSEVTSVRBVElPTicpIHtcbiAgICB0aGlzLl90ZXh0ID0gJzxoZXNpdGF0aW9uPic7XG4gICAgdGhpcy5fZm9yZUNvbG9yID0gJyM4ODgnO1xuICB9XG4gIGVsc2Uge1xuICAgIHRoaXMuX2ZvcmVDb2xvciA9ICcjMDAwJztcbiAgICB0aGlzLl90ZXh0ID0gdGV4dDtcbiAgfVxuICB0aGlzLl9jb25maWRlbmNlID0gY29uZmlkZW5jZTtcbiAgdGhpcy5faGVpZ2h0ID0gMiAqIGZvbnRTaXplO1xuICBjdHguZm9udCA9IGRlZmF1bHRGb250O1xuICB0aGlzLl93aWR0aCA9IGN0eC5tZWFzdXJlVGV4dCh0aGlzLl90ZXh0ICsgKCh0aGlzLl9jb25maWRlbmNlLnRvRml4ZWQoMykgKiAxMDApLnRvRml4ZWQoMSkpICsgJyUnKS53aWR0aCArIDYwO1xuICB0aGlzLl9maWxsU3R5bGUgPSAnI2Y0ZjRmNCc7XG4gIHRoaXMuX3NlbGVjdGVkRmlsbFN0eWxlID0gJyNlM2UzZTMnO1xuICB0aGlzLl9zZWxlY3RlZCA9IGZhbHNlO1xufTtcblxuV29yZEFsdGVybmF0aXZlLnByb3RvdHlwZS53aWR0aCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5fd2lkdGg7XG59O1xuXG5Xb3JkQWx0ZXJuYXRpdmUucHJvdG90eXBlLmhlaWdodCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5faGVpZ2h0O1xufTtcblxuV29yZEFsdGVybmF0aXZlLnByb3RvdHlwZS53aWR0aCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5fd2lkdGg7XG59O1xuXG5Xb3JkQWx0ZXJuYXRpdmUucHJvdG90eXBlLnNlbGVjdCA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLl9zZWxlY3RlZCA9IHRydWU7XG59O1xuXG5Xb3JkQWx0ZXJuYXRpdmUucHJvdG90eXBlLnVuc2VsZWN0ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuX3NlbGVjdGVkID0gZmFsc2U7XG59O1xuXG5Xb3JkQWx0ZXJuYXRpdmUucHJvdG90eXBlLmRyYXcgPSBmdW5jdGlvbih4LCB5LCB3aWR0aCkge1xuICBjdHguZmlsbFN0eWxlID0gdGhpcy5fc2VsZWN0ZWQgPyB0aGlzLl9zZWxlY3RlZEZpbGxTdHlsZSA6IHRoaXMuX2ZpbGxTdHlsZTtcbiAgY3R4LmxpbmVXaWR0aCA9IDE7XG4gIGN0eC5zdHJva2VTdHlsZSA9ICcjZDNkM2QzJztcbiAgY3R4LmZpbGxSZWN0KHgsIHksIHdpZHRoLCB0aGlzLmhlaWdodCgpKTtcbiAgY3R4LnN0cm9rZVJlY3QoeCwgeSwgd2lkdGgsIHRoaXMuaGVpZ2h0KCkpO1xuXG4gIGN0eC5maWxsU3R5bGUgPSB0aGlzLl9mb3JlQ29sb3I7XG4gIGN0eC5mb250ID0gdGhpcy5fc2VsZWN0ZWQgPyBib2xkRm9udCA6IGRlZmF1bHRGb250O1xuICBjdHguZmlsbFRleHQodGhpcy5fdGV4dCwgeCArIDE2LCB5ICsgMjApO1xuICBjdHguZm9udCA9IGl0YWxpY0ZvbnQ7XG4gIGNvbnN0IGFwcGVuZGl4ID0gKHRoaXMuX2NvbmZpZGVuY2UudG9GaXhlZCgzKSAqIDEwMCkudG9GaXhlZCgxKSArICclJztcbiAgY29uc3QgcmlnaHRPZmZzZXQgPSBjdHgubWVhc3VyZVRleHQoYXBwZW5kaXgpLndpZHRoICsgMzI7XG4gIGN0eC5maWxsVGV4dChhcHBlbmRpeCwgeCArIDE2ICsgd2lkdGggLSByaWdodE9mZnNldCwgeSArIDIwKTtcbiAgY3R4LmZvbnQgPSBkZWZhdWx0Rm9udDtcbn07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBjbGFzcyBCaW5cbnZhciBCaW4gPSBmdW5jdGlvbihzdGFydFRpbWUsIGVuZFRpbWUpIHtcbiAgdGhpcy5fY29ubmVjdG9yV2lkdGggPSA0MDtcbiAgdGhpcy5fc3RhcnRUaW1lID0gc3RhcnRUaW1lO1xuICB0aGlzLl9lbmRUaW1lID0gZW5kVGltZTtcbiAgdGhpcy5fd29yZEFsdGVybmF0aXZlcyA9IFtdO1xuICB0aGlzLl9tYXhXb3JkQWx0ZXJuYXRpdmVXaWR0aCA9IDA7XG4gIHRoaXMuX2hlaWdodCA9IDA7XG4gIHRoaXMuX2luZGV4ID0gMDtcbn07XG5cbkJpbi5wcm90b3R5cGUuYWRkV29yZEFsdGVybmF0aXZlID0gZnVuY3Rpb24od2EpIHtcbiAgdGhpcy5fd29yZEFsdGVybmF0aXZlcy5wdXNoKHdhKTtcbiAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX3dvcmRBbHRlcm5hdGl2ZXMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgdmFyIHdpZHRoID0gdGhpcy5fd29yZEFsdGVybmF0aXZlc1tpbmRleF0ud2lkdGgoKTtcbiAgICBpZiAod2lkdGggPiB0aGlzLl9tYXhXb3JkQWx0ZXJuYXRpdmVXaWR0aClcbiAgICAgIHRoaXMuX21heFdvcmRBbHRlcm5hdGl2ZVdpZHRoID0gd2lkdGg7XG4gIH1cbiAgdGhpcy5faGVpZ2h0ICs9IHdhLmhlaWdodCgpO1xufTtcblxuQmluLnByb3RvdHlwZS5oZWlnaHQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX2hlaWdodDtcbn07XG5cbkJpbi5wcm90b3R5cGUud2lkdGggPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX21heFdvcmRBbHRlcm5hdGl2ZVdpZHRoICsgMiAqIHRoaXMuX2Nvbm5lY3RvcldpZHRoO1xufTtcblxuQmluLnByb3RvdHlwZS5kcmF3ID0gZnVuY3Rpb24oeCwgeSkge1xuICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fd29yZEFsdGVybmF0aXZlcy5sZW5ndGg7IGluZGV4KyspIHtcbiAgICB2YXIgd2EgPSB0aGlzLl93b3JkQWx0ZXJuYXRpdmVzW2luZGV4XTtcbiAgICB3YS5kcmF3KHggKyB0aGlzLl9jb25uZWN0b3JXaWR0aCwgeSArIGRlbHRhX3kgKiAoaW5kZXggKyAxKSwgdGhpcy5fbWF4V29yZEFsdGVybmF0aXZlV2lkdGgpO1xuICAgIGlmIChzaG93QWxsSHlwb3RoZXNlcyA9PSBmYWxzZSlcbiAgICAgIGJyZWFrO1xuICB9XG5cbiAgY3R4Lm1vdmVUbyh4ICsgc3BhY2UgKyByYWRpdXMsIHkgKyBmb250U2l6ZSk7XG4gIGlmICh0aGlzLl93b3JkQWx0ZXJuYXRpdmVzLmxlbmd0aCA+IDApIHtcbiAgICBjdHguc3Ryb2tlU3R5bGUgPSAnIzQxNzhCRSc7XG4gICAgY3R4LmxpbmVXaWR0aCA9IDI7XG4gICAgY3R4LmxpbmVUbyh4ICsgdGhpcy53aWR0aCgpIC0gKHNwYWNlICsgcmFkaXVzKSwgeSArIGZvbnRTaXplKTtcbiAgICBjdHguc3Ryb2tlKCk7XG4gIH1cbn07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBjbGFzcyBTY2VuZVxudmFyIFNjZW5lID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuX2JpbnMgPSBbXTtcbiAgdGhpcy5fb2Zmc2V0X1ggPSBJTklUSUFMX09GRlNFVF9YO1xuICB0aGlzLl9vZmZzZXRfWSA9IElOSVRJQUxfT0ZGU0VUX1k7XG4gIHRoaXMuX3dpZHRoID0gMDtcbiAgdGhpcy5faGVpZ2h0ID0gMDtcbiAgdGhpcy5fc2hpZnQgPSAxMDA7XG59O1xuXG5TY2VuZS5wcm90b3R5cGUuZHJhdyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgeCA9IHRoaXMuX29mZnNldF9YO1xuICB2YXIgeSA9IHRoaXMuX29mZnNldF9ZO1xuICB2YXIgbGFzdF9iaW5fZW5kX3RpbWUgPSAwO1xuXG4gIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLl9iaW5zLmxlbmd0aDsgaW5kZXgrKykge1xuICAgIHZhciBiaW4gPSB0aGlzLl9iaW5zW2luZGV4XTtcbiAgICB2YXIgeF92aXNpYmxlID0gTWF0aC5hYnMoeCkgPD0gY2FudmFzLndpZHRoO1xuICAgIGN0eC5iZWdpblBhdGgoKTtcblxuICAgIGlmIChiaW4uX3N0YXJ0VGltZSA+IGxhc3RfYmluX2VuZF90aW1lKSB7XG4gICAgICBpZiAoeF92aXNpYmxlKSB7XG4gICAgICAgIGN0eC5tb3ZlVG8oeCArIHJhZGl1cyArIHNwYWNlLCB5ICsgZm9udFNpemUpO1xuICAgICAgfVxuICAgICAgaWYgKGxhc3RfYmluX2VuZF90aW1lID4gMCkge1xuICAgICAgICB4ICs9IHRoaXMuX3NoaWZ0O1xuICAgICAgICBpZiAoeF92aXNpYmxlKSB7XG4gICAgICAgICAgY3R4LnN0cm9rZVN0eWxlID0gJyM0MTc4QkUnO1xuICAgICAgICAgIGN0eC5saW5lV2lkdGggPSAyO1xuICAgICAgICAgIGN0eC5saW5lVG8oeCAtIChyYWRpdXMgKyBzcGFjZSksIHkgKyBmb250U2l6ZSk7XG4gICAgICAgICAgY3R4LnN0cm9rZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoeF92aXNpYmxlKSB7XG4gICAgICAgIGN0eC5tb3ZlVG8oeCArIHJhZGl1cywgeSArIGZvbnRTaXplKTtcbiAgICAgICAgY3R4LmxpbmVXaWR0aCA9IDI7XG4gICAgICAgIGN0eC5hcmMoeCwgeSArIGZvbnRTaXplLCByYWRpdXMsIDAsIDIgKiBNYXRoLlBJLCBmYWxzZSk7XG4gICAgICAgIHZhciBzdGFydF90aW1lX2NhcHRpb24gPSBiaW4uX3N0YXJ0VGltZSArICcgcyc7XG4gICAgICAgIHZhciBzdGFydF90aW1lX3NoaWZ0ID0gY3R4Lm1lYXN1cmVUZXh0KHN0YXJ0X3RpbWVfY2FwdGlvbikud2lkdGggLyAyO1xuICAgICAgICBjdHguZmlsbFRleHQoc3RhcnRfdGltZV9jYXB0aW9uLCB4IC0gc3RhcnRfdGltZV9zaGlmdCwgeSk7XG4gICAgICAgIGN0eC5zdHJva2UoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoeF92aXNpYmxlKSB7XG4gICAgICBiaW4uZHJhdyh4LCB5KTtcbiAgICAgIGN0eC5tb3ZlVG8oeCArIGJpbi53aWR0aCgpICsgcmFkaXVzLCB5ICsgZm9udFNpemUpO1xuICAgICAgY3R4LnN0cm9rZVN0eWxlID0gJyM0MTc4QkUnO1xuICAgICAgY3R4LmxpbmVXaWR0aCA9IDI7XG4gICAgICBjdHguYXJjKHggKyBiaW4ud2lkdGgoKSwgeSArIGZvbnRTaXplLCByYWRpdXMsIDAsIDIgKiBNYXRoLlBJLCBmYWxzZSk7XG4gICAgICBjdHguc3Ryb2tlKCk7XG4gICAgICB2YXIgZW5kX3RpbWVfY2FwdGlvbiA9IGJpbi5fZW5kVGltZSArICcgcyc7XG4gICAgICB2YXIgZW5kX3RpbWVfc2hpZnQgPSBjdHgubWVhc3VyZVRleHQoZW5kX3RpbWVfY2FwdGlvbikud2lkdGggLyAyO1xuICAgICAgY3R4LmZpbGxUZXh0KGVuZF90aW1lX2NhcHRpb24sIHggKyBiaW4ud2lkdGgoKSAtIGVuZF90aW1lX3NoaWZ0LCB5KTtcbiAgICAgIGN0eC5zdHJva2UoKTtcbiAgICB9XG5cbiAgICBsYXN0X2Jpbl9lbmRfdGltZSA9IGJpbi5fZW5kVGltZTtcbiAgICB4ICs9IGJpbi53aWR0aCgpO1xuICAgIGN0eC5jbG9zZVBhdGgoKTtcbiAgfVxufTtcblxuU2NlbmUucHJvdG90eXBlLmFkZEJpbiA9IGZ1bmN0aW9uKGJpbikge1xuICBiaW4uX2luZGV4ID0gdGhpcy5fYmlucy5sZW5ndGg7XG4gIHRoaXMuX2JpbnMucHVzaChiaW4pO1xuICB2YXIgd2lkdGggPSAyICogSU5JVElBTF9PRkZTRVRfWDtcbiAgdmFyIGxhc3RfYmluX2VuZF90aW1lID0gMDtcbiAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2JpbnMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXJlZGVjbGFyZVxuICAgIHZhciBiaW4gPSB0aGlzLl9iaW5zW2luZGV4XTtcbiAgICBpZiAoYmluLl9zdGFydFRpbWUgPiBsYXN0X2Jpbl9lbmRfdGltZSAmJiBsYXN0X2Jpbl9lbmRfdGltZSA+IDApIHtcbiAgICAgIHdpZHRoICs9IHRoaXMuX3NoaWZ0O1xuICAgIH1cbiAgICBsYXN0X2Jpbl9lbmRfdGltZSA9IGJpbi5fZW5kVGltZTtcbiAgICB3aWR0aCArPSBiaW4ud2lkdGgoKTtcbiAgICBpZiAodGhpcy5faGVpZ2h0IDwgYmluLmhlaWdodCgpKSB7XG4gICAgICB0aGlzLl9oZWlnaHQgPSBiaW4uaGVpZ2h0KCk7XG4gICAgICB2c2xpZGVyLm1pbiA9IGNhbnZhcy5oZWlnaHQgLSB0aGlzLl9oZWlnaHQgLSAyLjUgKiBJTklUSUFMX09GRlNFVF9ZO1xuICAgIH1cbiAgfVxuICB0aGlzLl93aWR0aCA9IHdpZHRoO1xufTtcblxuU2NlbmUucHJvdG90eXBlLndpZHRoID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl93aWR0aCArIDIgKiB0aGlzLl9zaGlmdDtcbn07XG5cblNjZW5lLnByb3RvdHlwZS5oZWlnaHQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX2hlaWdodDtcbn07XG5cblNjZW5lLnByb3RvdHlwZS5maW5kQmlucyA9IGZ1bmN0aW9uKHN0YXJ0X3RpbWUsIGVuZF90aW1lKSB7XG4gIHZhciBmb3VuZEJpbnMgPSBbXTtcbiAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2JpbnMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgdmFyIGJpbiA9IHRoaXMuX2JpbnNbaW5kZXhdO1xuICAgIHZhciBiaW5TdGFydFRpbWUgPSBiaW4uX3N0YXJ0VGltZTtcbiAgICB2YXIgYmluRW5kVGltZSA9IGJpbi5fZW5kVGltZTtcbiAgICBpZiAoYmluU3RhcnRUaW1lID49IHN0YXJ0X3RpbWUgJiYgYmluRW5kVGltZSA8PSBlbmRfdGltZSkge1xuICAgICAgZm91bmRCaW5zLnB1c2goYmluKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZvdW5kQmlucztcbn07XG5cblNjZW5lLnByb3RvdHlwZS5zdGFydFRpbWVUb1NsaWRlclZhbHVlID0gZnVuY3Rpb24oc3RhcnRfdGltZSkge1xuICB2YXIgbGFzdF9iaW5fZW5kX3RpbWUgPSAwO1xuICB2YXIgdmFsdWUgPSAwO1xuICBmb3IgKHZhciBiaW5JbmRleCA9IDA7IGJpbkluZGV4IDwgdGhpcy5fYmlucy5sZW5ndGg7IGJpbkluZGV4KyspIHtcbiAgICB2YXIgYmluID0gdGhpcy5fYmluc1tiaW5JbmRleF07XG4gICAgaWYgKGJpbi5fc3RhcnRUaW1lIDwgc3RhcnRfdGltZSkge1xuICAgICAgdmFsdWUgKz0gYmluLndpZHRoKCk7XG4gICAgICBpZiAoYmluLl9zdGFydFRpbWUgPiBsYXN0X2Jpbl9lbmRfdGltZSAmJiBsYXN0X2Jpbl9lbmRfdGltZSA+IDApIHtcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVzZS1iZWZvcmUtZGVmaW5lXG4gICAgICAgIHZhbHVlICs9IHNjZW5lLl9zaGlmdDtcbiAgICAgIH1cbiAgICAgIGxhc3RfYmluX2VuZF90aW1lID0gYmluLl9lbmRUaW1lO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdmFsdWU7XG59O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxudmFyIHNjZW5lID0gbmV3IFNjZW5lKCk7XG5cbmZ1bmN0aW9uIHBhcnNlQWx0ZXJuYXRpdmUoZWxlbWVudC8qLCBpbmRleCwgYXJyYXkqLykge1xuICB2YXIgY29uZmlkZW5jZSA9IGVsZW1lbnRbJ2NvbmZpZGVuY2UnXTtcbiAgdmFyIHdvcmQgPSBlbGVtZW50Wyd3b3JkJ107XG4gIHZhciBiaW4gPSBzY2VuZS5fYmluc1tzY2VuZS5fYmlucy5sZW5ndGggLSAxXTtcbiAgYmluLmFkZFdvcmRBbHRlcm5hdGl2ZShuZXcgV29yZEFsdGVybmF0aXZlKHdvcmQsIGNvbmZpZGVuY2UpKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VCaW4oZWxlbWVudC8qLCBpbmRleCwgYXJyYXkqLykge1xuICB2YXIgc3RhcnRfdGltZSA9IGVsZW1lbnRbJ3N0YXJ0X3RpbWUnXTtcbiAgdmFyIGVuZF90aW1lID0gZWxlbWVudFsnZW5kX3RpbWUnXTtcbiAgdmFyIGFsdGVybmF0aXZlcyA9IGVsZW1lbnRbJ2FsdGVybmF0aXZlcyddO1xuICB2YXIgYmluID0gbmV3IEJpbihzdGFydF90aW1lLCBlbmRfdGltZSk7XG4gIHNjZW5lLmFkZEJpbihiaW4pO1xuICBhbHRlcm5hdGl2ZXMuZm9yRWFjaChwYXJzZUFsdGVybmF0aXZlKTtcbn1cblxuZnVuY3Rpb24gZHJhdygpIHtcbiAgY3R4LmNsZWFyUmVjdCgwLCAwLCA5NzAsIDM3MCk7XG4gIHNjZW5lLmRyYXcoKTtcbn1cblxuZnVuY3Rpb24gb25IU2Nyb2xsKCkge1xuICBpZiAoaHNsaWRlci52YWx1ZSA9PSAwKSB7XG4gICAgbGVmdEFycm93RW5hYmxlZCA9IGZhbHNlO1xuICAgIHJpZ2h0QXJyb3dFbmFibGVkID0gdHJ1ZTtcbiAgICAkKCcjbGVmdC1hcnJvdycpLmF0dHIoJ3NyYycsICdpbWFnZXMvYXJyb3ctbGVmdC1pY29uLWRpc2FibGVkLnN2ZycpO1xuICAgICQoJyNsZWZ0LWFycm93JykuY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJ3RyYW5zcGFyZW50Jyk7XG4gICAgJCgnI3JpZ2h0LWFycm93JykuYXR0cignc3JjJywgJ2ltYWdlcy9hcnJvdy1yaWdodC1pY29uLnN2ZycpO1xuICAgICQoJyNyaWdodC1hcnJvdycpLmNzcygnYmFja2dyb3VuZC1jb2xvcicsICcjQzdDN0M3Jyk7XG4gIH1cbiAgZWxzZSBpZiAoaHNsaWRlci52YWx1ZSA9PSBNYXRoLmZsb29yKGhzbGlkZXIubWF4KSkge1xuICAgIGxlZnRBcnJvd0VuYWJsZWQgPSB0cnVlO1xuICAgIHJpZ2h0QXJyb3dFbmFibGVkID0gZmFsc2U7XG4gICAgJCgnI2xlZnQtYXJyb3cnKS5hdHRyKCdzcmMnLCAnaW1hZ2VzL2Fycm93LWxlZnQtaWNvbi5zdmcnKTtcbiAgICAkKCcjbGVmdC1hcnJvdycpLmNzcygnYmFja2dyb3VuZC1jb2xvcicsICcjQzdDN0M3Jyk7XG4gICAgJCgnI3JpZ2h0LWFycm93JykuYXR0cignc3JjJywgJ2ltYWdlcy9hcnJvdy1yaWdodC1pY29uLWRpc2FibGVkLnN2ZycpO1xuICAgICQoJyNyaWdodC1hcnJvdycpLmNzcygnYmFja2dyb3VuZC1jb2xvcicsICd0cmFuc3BhcmVudCcpO1xuICB9XG4gIGVsc2Uge1xuICAgIGxlZnRBcnJvd0VuYWJsZWQgPSB0cnVlO1xuICAgIHJpZ2h0QXJyb3dFbmFibGVkID0gdHJ1ZTtcbiAgICAkKCcjbGVmdC1hcnJvdycpLmF0dHIoJ3NyYycsICdpbWFnZXMvYXJyb3ctbGVmdC1pY29uLnN2ZycpO1xuICAgICQoJyNsZWZ0LWFycm93JykuY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJyNDN0M3QzcnKTtcbiAgICAkKCcjcmlnaHQtYXJyb3cnKS5hdHRyKCdzcmMnLCAnaW1hZ2VzL2Fycm93LXJpZ2h0LWljb24uc3ZnJyk7XG4gICAgJCgnI3JpZ2h0LWFycm93JykuY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJyNDN0M3QzcnKTtcbiAgfVxuICBzY2VuZS5fb2Zmc2V0X1ggPSBJTklUSUFMX09GRlNFVF9YIC0gaHNsaWRlci52YWx1ZTtcbiAgZHJhdygpO1xufVxuXG5mdW5jdGlvbiBvblZTY3JvbGwoKSB7XG4gIHNjZW5lLl9vZmZzZXRfWSA9IElOSVRJQUxfT0ZGU0VUX1kgKyBOdW1iZXIodnNsaWRlci52YWx1ZSk7XG4gIGRyYXcoKTtcbn1cblxuZnVuY3Rpb24gY2xlYXJTY2VuZSgpIHtcbiAgc2NlbmUuX2JpbnMgPSBbXTtcbiAgc2NlbmUuX3dpZHRoID0gMDtcbiAgc2NlbmUuX2hlaWdodCA9IDA7XG4gIHNjZW5lLl9vZmZzZXRfWCA9IElOSVRJQUxfT0ZGU0VUX1g7XG4gIHNjZW5lLl9vZmZzZXRfWSA9IElOSVRJQUxfT0ZGU0VUX1k7XG4gIGhzbGlkZXIubWF4ID0gMDtcbiAgaHNsaWRlci52YWx1ZSA9IGhzbGlkZXIubWF4O1xuICB2c2xpZGVyLm1heCA9IDA7XG4gIHZzbGlkZXIubWluID0gMDtcbiAgdnNsaWRlci52YWx1ZSA9IHZzbGlkZXIubWF4O1xuICAkKCcjaHNsaWRlcicpLmNzcygnZGlzcGxheScsICdub25lJyk7XG4gICQoJyN2c2xpZGVyJykuY3NzKCdkaXNwbGF5JywgJ25vbmUnKTtcbiAgJCgnI3Nob3dfYWx0ZXJuYXRlX3dvcmRzJykuY3NzKCdkaXNwbGF5JywgJ25vbmUnKTtcbiAgJCgnI2NhbnZhcycpLmNzcygnZGlzcGxheScsICdub25lJyk7XG4gICQoJyNjYW52YXMtcGxhY2Vob2xkZXInKS5jc3MoJ2Rpc3BsYXknLCAnYmxvY2snKTtcbiAgJCgnI2xlZnQtYXJyb3cnKS5jc3MoJ2Rpc3BsYXknLCAnbm9uZScpO1xuICAkKCcjcmlnaHQtYXJyb3cnKS5jc3MoJ2Rpc3BsYXknLCAnbm9uZScpO1xuXG4gIHNob3dBbGxIeXBvdGhlc2VzID0gdHJ1ZTtcbiAgJCgnI3Nob3dfYWx0ZXJuYXRlX3dvcmRzJykudGV4dCgnSGlkZSBhbHRlcm5hdGUgd29yZHMnKTtcbiAgY3R4LmNsZWFyUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xufVxuXG5mdW5jdGlvbiBjbGVhcktleXdvcmRzVG9TZWFyY2goKSB7XG4gIGtleXdvcmRzX3RvX3NlYXJjaCA9IFtdO1xuICAkKCcjZXJyb3Itd3Jvbmcta2V5d29yZHMtZmlsZXR5cGUnKS5jc3MoJ2Rpc3BsYXknLCAnbm9uZScpO1xuICAkKCcua2V5d29yZHNfdGl0bGUnKS5jc3MoJ2Rpc3BsYXknLCAnbm9uZScpO1xuICAkKCcja2V5d29yZHMnKS5jc3MoJ2Rpc3BsYXknLCAnbm9uZScpO1xuICAkKCcjdHJhbnNjcmlwdGlvbl90ZXh0JykuY3NzKCd3aWR0aCcsICcxMDAlJyk7XG59XG5cbmZ1bmN0aW9uIGNsZWFyRGV0ZWN0ZWRLZXl3b3JkcygpIHtcbiAgJCgnI2tleXdvcmRzIHVsJykuZW1wdHkoKTtcbiAgZGV0ZWN0ZWRfa2V5d29yZHMgPSB7fTtcbn1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiQoJyNsZWZ0LWFycm93JykuaG92ZXIoXG4gIGZ1bmN0aW9uKCkge1xuICAgIGlmIChsZWZ0QXJyb3dFbmFibGVkKSB7XG4gICAgICAkKHRoaXMpLmNzcygnYmFja2dyb3VuZC1jb2xvcicsICcjQzdDN0M3Jyk7XG4gICAgICAkKHRoaXMpLmNzcygnb3BhY2l0eScsICcxJyk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgJCh0aGlzKS5jc3MoJ2JhY2tncm91bmQtY29sb3InLCAndHJhbnNwYXJlbnQnKTtcbiAgICAgICQodGhpcykuY3NzKCdvcGFjaXR5Jywgb3BhY2l0eSk7XG4gICAgfVxuICB9LFxuICBmdW5jdGlvbigpIHtcbiAgICBpZiAobGVmdEFycm93RW5hYmxlZCkge1xuICAgICAgJCh0aGlzKS5jc3MoJ2JhY2tncm91bmQtY29sb3InLCAnI0M3QzdDNycpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICQodGhpcykuY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJ3RyYW5zcGFyZW50Jyk7XG4gICAgfVxuICAgICQodGhpcykuY3NzKCdvcGFjaXR5Jywgb3BhY2l0eSk7XG4gIH1cbik7XG5cbiQoJyNyaWdodC1hcnJvdycpLmhvdmVyKFxuICBmdW5jdGlvbigpIHtcbiAgICBpZiAocmlnaHRBcnJvd0VuYWJsZWQpIHtcbiAgICAgICQodGhpcykuY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJyNDN0M3QzcnKTtcbiAgICAgICQodGhpcykuY3NzKCdvcGFjaXR5JywgJzEnKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAkKHRoaXMpLmNzcygnYmFja2dyb3VuZC1jb2xvcicsICd0cmFuc3BhcmVudCcpO1xuICAgICAgJCh0aGlzKS5jc3MoJ29wYWNpdHknLCBvcGFjaXR5KTtcbiAgICB9XG4gIH0sXG4gIGZ1bmN0aW9uKCkge1xuICAgIGlmIChyaWdodEFycm93RW5hYmxlZCkge1xuICAgICAgJCh0aGlzKS5jc3MoJ2JhY2tncm91bmQtY29sb3InLCAnI0M3QzdDNycpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICQodGhpcykuY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJ3RyYW5zcGFyZW50Jyk7XG4gICAgfVxuICAgICQodGhpcykuY3NzKCdvcGFjaXR5Jywgb3BhY2l0eSk7XG4gIH1cbik7XG5cbiQoJyNsZWZ0LWFycm93JykuY2xpY2soZnVuY3Rpb24oKSB7XG4gIHZhciB1cGRhdGVkX3ZhbHVlID0gaHNsaWRlci52YWx1ZSAtIGhzdGVwO1xuICBpZiAodXBkYXRlZF92YWx1ZSA8IDApIHtcbiAgICB1cGRhdGVkX3ZhbHVlID0gMDtcbiAgfVxuICBoc2xpZGVyLnZhbHVlID0gdXBkYXRlZF92YWx1ZTtcbiAgb25IU2Nyb2xsKCk7XG59KTtcblxuJCgnI3JpZ2h0LWFycm93JykuY2xpY2soZnVuY3Rpb24oKSB7XG4gIHZhciB1cGRhdGVkX3ZhbHVlID0gTnVtYmVyKGhzbGlkZXIudmFsdWUpICsgaHN0ZXA7XG4gIGlmICh1cGRhdGVkX3ZhbHVlID4gaHNsaWRlci5tYXgpIHtcbiAgICB1cGRhdGVkX3ZhbHVlID0gaHNsaWRlci5tYXg7XG4gIH1cbiAgaHNsaWRlci52YWx1ZSA9IHVwZGF0ZWRfdmFsdWU7XG4gIG9uSFNjcm9sbCgpO1xufSk7XG5cbiQoJyNidG5Mb2FkS1dTJykuY2xpY2soZnVuY3Rpb24oLyplKi8pIHtcbiAgJCh0aGlzKS5maW5kKCdpbnB1dFt0eXBlPVxcJ2ZpbGVcXCddJykuY2xpY2soKTtcbn0pO1xuXG4kKCcjYnRuTG9hZEtXUyBpbnB1dCcpLmNsaWNrKGZ1bmN0aW9uKGUpIHtcbiAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbn0pO1xuXG4kKCcjYnRuTG9hZEtXUyBpbnB1dCcpLmNoYW5nZShmdW5jdGlvbihlKSB7XG4gIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gIGNsZWFyS2V5d29yZHNUb1NlYXJjaCgpO1xuICB2YXIgc2VsZWN0ZWRGaWxlID0gJCh0aGlzKVswXS5maWxlc1swXTtcbiAgaWYgKHR5cGVvZiBzZWxlY3RlZEZpbGUgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb25zb2xlLmxvZygnVXNlciBjYW5jZWxsZWQgT3BlbkZpbGUgZGlhbG9nLiBObyBrZXl3b3JkcyBmaWxlIGxvYWRlZC4nKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoJCh0aGlzKS52YWwoKS5sYXN0SW5kZXhPZignLnR4dCcpID09IC0xKSB7XG4gICAgJCgnI2Vycm9yLXdyb25nLWtleXdvcmRzLWZpbGV0eXBlJykuY3NzKCdkaXNwbGF5JywgJ2Jsb2NrJyk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gIHJlYWRlci5yZWFkQXNUZXh0KHNlbGVjdGVkRmlsZSk7XG4gIHJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAkKCcja2V5d29yZHMgdWwnKS5lbXB0eSgpO1xuICAgIHZhciB0ZXh0ID0gcmVhZGVyLnJlc3VsdDtcbiAgICB2YXIga2V5d29yZHNUb1NlYXJjaCA9IHRleHQuc3BsaXQoJ1xcbicpO1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11c2UtYmVmb3JlLWRlZmluZVxuICAgIGtleXdvcmRzVG9TZWFyY2guZm9yRWFjaChhZGRLZXl3b3JkVG9TZWFyY2gpO1xuICAgIGlmIChrZXl3b3Jkc1RvU2VhcmNoLmxlbmd0aCA+IDApIHtcbiAgICAgICQoJy5rZXl3b3Jkc190aXRsZScpLmNzcygnZGlzcGxheScsICdibG9jaycpO1xuICAgICAgJCgnI2tleXdvcmRzJykuY3NzKCdkaXNwbGF5JywgJ2Jsb2NrJyk7XG4gICAgICAkKCcjdHJhbnNjcmlwdGlvbl90ZXh0JykuY3NzKCd3aWR0aCcsICc1NSUnKTtcbiAgICB9XG4gIH07XG59KTtcblxuJCgnI3RiX2tleXdvcmRzJykuZm9jdXMoZnVuY3Rpb24gKCkge1xuICBpZiAoa2V5d29yZHNJbnB1dERpcnR5ID09IGZhbHNlKSB7XG4gICAga2V5d29yZHNJbnB1dERpcnR5ID0gdHJ1ZTtcbiAgICAkKHRoaXMpLmNzcygnZm9udC1zdHlsZScsICdub3JtYWwnKTtcbiAgICAkKHRoaXMpLmNzcygnY29sb3InLCAnIzEyMTIxMicpO1xuICAgICQodGhpcykudmFsKCcnKTtcbiAgfVxufSk7XG5cbiQoJyN0Yl9rZXl3b3JkcycpLmNoYW5nZShmdW5jdGlvbigpIHtcbiAgY2xlYXJLZXl3b3Jkc1RvU2VhcmNoKCk7XG4gIHZhciB0ZXh0ID0gJCh0aGlzKS52YWwoKTtcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVzZS1iZWZvcmUtZGVmaW5lXG4gIHRleHQuc3BsaXQoJywnKS5mb3JFYWNoKGFkZEtleXdvcmRUb1NlYXJjaCk7XG4gIGlmIChrZXl3b3Jkc190b19zZWFyY2gubGVuZ3RoID4gMCkge1xuICAgICQoJy5rZXl3b3Jkc190aXRsZScpLmNzcygnZGlzcGxheScsICdibG9jaycpO1xuICAgICQoJyNrZXl3b3JkcycpLmNzcygnZGlzcGxheScsICdibG9jaycpO1xuICAgICQoJyN0cmFuc2NyaXB0aW9uX3RleHQnKS5jc3MoJ3dpZHRoJywgJzU1JScpO1xuICB9XG59KTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZnVuY3Rpb24ga2V5d29yZE5vdEZvdW5kKGtleXdvcmQpIHtcbiAgdmFyICRsaV9rd2QgPSAkKCc8bGkgY2xhc3M9XFwna2V5d29yZF9ub19vY2N1cnJlbmNlc1xcJy8+Jyk7XG4gICRsaV9rd2QuYXBwZW5kKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGtleXdvcmQpKTtcbiAgJCgnI2tleXdvcmRzIHVsJykuYXBwZW5kKCRsaV9rd2QpO1xufVxuXG5mdW5jdGlvbiBhZGRLZXl3b3JkVG9TZWFyY2goZWxlbWVudC8qLCBpbmRleCwgYXJyYXkqLykge1xuICB2YXIga2V5d29yZCA9IGVsZW1lbnQudHJpbSgpO1xuICBpZiAoa2V5d29yZC5sZW5ndGggPT0gMCkgcmV0dXJuO1xuXG4gIGlmIChrZXl3b3Jkc190b19zZWFyY2guaW5kZXhPZihrZXl3b3JkKSA9PSAtMSkge1xuICAgIGtleXdvcmRzX3RvX3NlYXJjaC5wdXNoKGtleXdvcmQpO1xuICB9XG59XG5cbiQoJyNlcnJvcldyb25nS2V5d29yZHNGaWxldHlwZUNsb3NlJykuY2xpY2soZnVuY3Rpb24oLyplKi8pIHtcbiAgJCgnI2Vycm9yLXdyb25nLWtleXdvcmRzLWZpbGV0eXBlJykuY3NzKCdkaXNwbGF5JywgJ25vbmUnKTtcbn0pO1xuXG5mdW5jdGlvbiB0b2dnbGVTcG90dGVkS2V5d29yZENsYXNzKG5vZGUpIHtcbiAgaWYgKG5vZGUuY2xhc3NOYW1lID09ICdrZXl3b3JkX2NvbGxhcHNlZCcpIHtcbiAgICBub2RlLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ2tleXdvcmRfaWNvbicpWzBdLnNyYyA9ICdpbWFnZXMvY2xvc2UtaWNvbi5zdmcnO1xuICAgIG5vZGUuY2xhc3NOYW1lID0gJ2tleXdvcmRfZXhwYW5kZWQnO1xuICB9XG4gIGVsc2UgaWYgKG5vZGUuY2xhc3NOYW1lID09ICdrZXl3b3JkX2V4cGFuZGVkJykge1xuICAgIG5vZGUuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgna2V5d29yZF9pY29uJylbMF0uc3JjID0gJ2ltYWdlcy9vcGVuLWljb24uc3ZnJztcbiAgICBub2RlLmNsYXNzTmFtZSA9ICdrZXl3b3JkX2NvbGxhcHNlZCc7XG4gIH1cbn1cblxuJCgnI2tleXdvcmRzIHVsJykuY2xpY2soZnVuY3Rpb24oZSkge1xuICB2YXIgbm9kZSA9IGUuc3JjRWxlbWVudCB8fCBlLnRhcmdldDtcblxuICBpZiAobm9kZS5jbGFzc05hbWUgPT0gJ2tleXdvcmRfdGV4dCcpIHtcbiAgICB0b2dnbGVTcG90dGVkS2V5d29yZENsYXNzKG5vZGUucGFyZW50Tm9kZSk7XG4gIH1cbiAgZWxzZSBpZiAobm9kZS5jbGFzc05hbWUgPT0gJ2tleXdvcmRfaWNvbicpIHtcbiAgICB0b2dnbGVTcG90dGVkS2V5d29yZENsYXNzKG5vZGUucGFyZW50Tm9kZS5wYXJlbnROb2RlKTtcbiAgfVxuICBlbHNlIHtcbiAgICB0b2dnbGVTcG90dGVkS2V5d29yZENsYXNzKG5vZGUpO1xuICB9XG59KTtcblxuZnVuY3Rpb24gcGFyc2VLZXl3b3JkcyhrZXl3b3Jkc19yZXN1bHQpIHtcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGd1YXJkLWZvci1pblxuICBmb3IgKHZhciBrZXl3b3JkIGluIGtleXdvcmRzX3Jlc3VsdCkge1xuICAgIHZhciBhcnIgPSBrZXl3b3Jkc19yZXN1bHRba2V5d29yZF07XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnRpbnVlXG4gICAgaWYgKGFyci5sZW5ndGggPT0gMCkgY29udGludWU7XG4gICAgaWYgKGtleXdvcmQgaW4gZGV0ZWN0ZWRfa2V5d29yZHMgPT0gZmFsc2UpIHtcbiAgICAgIGRldGVjdGVkX2tleXdvcmRzW2tleXdvcmRdID0gW107XG4gICAgfVxuICAgIGRldGVjdGVkX2tleXdvcmRzW2tleXdvcmRdID0gZGV0ZWN0ZWRfa2V5d29yZHNba2V5d29yZF0uY29uY2F0KGFycik7XG4gIH1cbn1cblxuZnVuY3Rpb24gdW5zZWxlY3RMYXN0S2V5d29yZCgpIHtcbiAgZm9yICh2YXIgYmluSW5kZXggPSAwOyBiaW5JbmRleCA8IHNjZW5lLl9iaW5zLmxlbmd0aDsgYmluSW5kZXgrKykge1xuICAgIHZhciBiaW4gPSBzY2VuZS5fYmluc1tiaW5JbmRleF07XG4gICAgdmFyIHdvcmRBbHRlcm5hdGl2ZXMgPSBiaW4uX3dvcmRBbHRlcm5hdGl2ZXM7XG4gICAgZm9yICh2YXIgd2FJbmRleCA9IDA7IHdhSW5kZXggPCB3b3JkQWx0ZXJuYXRpdmVzLmxlbmd0aDsgd2FJbmRleCsrKSB7XG4gICAgICB2YXIgd29yZEFsdGVybmF0aXZlID0gd29yZEFsdGVybmF0aXZlc1t3YUluZGV4XTtcbiAgICAgIHdvcmRBbHRlcm5hdGl2ZS51bnNlbGVjdCgpO1xuICAgIH1cbiAgfVxufVxuXG53aW5kb3cub25LZXl3b3JkT2NjdXJyZW5jZVNlbGVjdGVkID0gZnVuY3Rpb24oc3RhcnRfdGltZSwga2V5d29yZEZyYWdtZW50cykge1xuICB1bnNlbGVjdExhc3RLZXl3b3JkKCk7XG4gIHZhciBrZXl3b3JkQ29uc2lzdHNPZlRvcEh5cG90aGVzZXNPbmx5ID0gdHJ1ZTtcbiAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IGtleXdvcmRGcmFnbWVudHMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgdmFyIGZyYWdtZW50ID0ga2V5d29yZEZyYWdtZW50c1tpbmRleF07XG4gICAgdmFyIGJpbkluZGV4ID0gZnJhZ21lbnRbMF07XG4gICAgdmFyIHdhSW5kZXggPSBmcmFnbWVudFsxXTtcbiAgICBpZiAod2FJbmRleCA+IDApIHtcbiAgICAgIGtleXdvcmRDb25zaXN0c09mVG9wSHlwb3RoZXNlc09ubHkgPSBmYWxzZTtcbiAgICB9XG4gICAgdmFyIGJpbiA9IHNjZW5lLl9iaW5zW2JpbkluZGV4XTtcbiAgICB2YXIgd29yZEFsdGVybmF0aXZlID0gYmluLl93b3JkQWx0ZXJuYXRpdmVzW3dhSW5kZXhdO1xuICAgIHdvcmRBbHRlcm5hdGl2ZS5zZWxlY3QoKTtcbiAgfVxuICBpZiAoc2hvd0FsbEh5cG90aGVzZXMgPT0gZmFsc2UgJiYga2V5d29yZENvbnNpc3RzT2ZUb3BIeXBvdGhlc2VzT25seSA9PSBmYWxzZSkge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11c2UtYmVmb3JlLWRlZmluZVxuICAgIHRvZ2dsZUFsdGVybmF0ZVdvcmRzKCk7XG4gIH1cbiAgaHNsaWRlci52YWx1ZSA9IHNjZW5lLnN0YXJ0VGltZVRvU2xpZGVyVmFsdWUoc3RhcnRfdGltZSk7XG4gIG9uSFNjcm9sbCgpO1xuXG4gICQoJ2h0bWwsIGJvZHknKS5hbmltYXRlKHtzY3JvbGxUb3A6ICQoJyNjYW52YXMnKS5vZmZzZXQoKS50b3B9LCA1MDApO1xufTtcblxuZnVuY3Rpb24ga2V5d29yZFRvSGFzaFNldChub3JtYWxpemVkX3RleHQpIHtcbiAgdmFyIGhhc2hTZXQgPSB7fTtcbiAgdmFyIHNlZ21lbnRzID0gbm9ybWFsaXplZF90ZXh0LnNwbGl0KCcgJyk7XG4gIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBzZWdtZW50cy5sZW5ndGg7IGluZGV4KyspIHtcbiAgICB2YXIgc2VnbWVudCA9IHNlZ21lbnRzW2luZGV4XTtcbiAgICBoYXNoU2V0W3NlZ21lbnRdID0gdHJ1ZTtcbiAgfVxuICByZXR1cm4gaGFzaFNldDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlS2V5d29yZChrZXl3b3JkKSB7XG4gIHZhciBhcnIgPSBkZXRlY3RlZF9rZXl3b3Jkc1trZXl3b3JkXTtcbiAgdmFyIGFycmxlbiA9IGFyci5sZW5ndGg7XG5cbiAgdmFyICRsaSA9ICQoJzxsaSBjbGFzcz1cXCdrZXl3b3JkX2NvbGxhcHNlZFxcJy8+Jyk7XG4gIHZhciAka2V5d29yZF90ZXh0ID0gJCgnPHNwYW4gY2xhc3M9XFwna2V5d29yZF90ZXh0XFwnPjxpbWcgY2xhc3M9XFwna2V5d29yZF9pY29uXFwnIHNyYz1cXCdpbWFnZXMvb3Blbi1pY29uLnN2Z1xcJz4nICsga2V5d29yZCArICc8L3NwYW4+Jyk7XG4gIHZhciAka2V5d29yZF9jb3VudCA9ICQoJzxzcGFuIGNsYXNzPVxcJ2tleXdvcmRfY291bnRcXCc+KCcgKyBhcnJsZW4gKyAnKTwvc3Bhbj4nKTtcbiAgJGxpLmFwcGVuZCgka2V5d29yZF90ZXh0KTtcbiAgJGxpLmFwcGVuZCgka2V5d29yZF9jb3VudCk7XG4gIHZhciAkdGFibGUgPSAkKCc8dGFibGUgY2xhc3M9XFwna3dzX29jY3VycmVuY2VzXFwnLz4nKTtcbiAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IGFycmxlbjsgaW5kZXgrKykge1xuICAgIHZhciBrd2Rfb2NjdXJyZW5jZSA9IGFycltpbmRleF07XG4gICAgdmFyIHN0YXJ0X3RpbWUgPSBrd2Rfb2NjdXJyZW5jZVsnc3RhcnRfdGltZSddLnRvRml4ZWQoMik7XG4gICAgdmFyIGVuZF90aW1lID0ga3dkX29jY3VycmVuY2VbJ2VuZF90aW1lJ10udG9GaXhlZCgyKTtcbiAgICB2YXIgY29uZmlkZW5jZSA9IChrd2Rfb2NjdXJyZW5jZVsnY29uZmlkZW5jZSddICogMTAwKS50b0ZpeGVkKDEpO1xuICAgIHZhciBub3JtYWxpemVkX3RleHQgPSBrd2Rfb2NjdXJyZW5jZVsnbm9ybWFsaXplZF90ZXh0J107XG4gICAgdmFyIHNldCA9IGtleXdvcmRUb0hhc2hTZXQobm9ybWFsaXplZF90ZXh0KTtcbiAgICB2YXIgZm91bmRCaW5zID0gc2NlbmUuZmluZEJpbnMoc3RhcnRfdGltZSwgZW5kX3RpbWUpO1xuICAgIHZhciBrZXl3b3JkRnJhZ21lbnRzID0gW107XG5cbiAgICBmb3IgKHZhciBiaW5JbmRleCA9IDA7IGJpbkluZGV4IDwgZm91bmRCaW5zLmxlbmd0aDsgYmluSW5kZXgrKykge1xuICAgICAgdmFyIGJpbiA9IGZvdW5kQmluc1tiaW5JbmRleF07XG4gICAgICB2YXIgd29yZEFsdGVybmF0aXZlcyA9IGJpbi5fd29yZEFsdGVybmF0aXZlcztcbiAgICAgIGZvciAodmFyIHdhSW5kZXggPSAwOyB3YUluZGV4IDwgd29yZEFsdGVybmF0aXZlcy5sZW5ndGg7IHdhSW5kZXgrKykge1xuICAgICAgICB2YXIgd29yZEFsdGVybmF0aXZlID0gd29yZEFsdGVybmF0aXZlc1t3YUluZGV4XTtcbiAgICAgICAgdmFyIGlzS2V5d29yZCA9IHNldFt3b3JkQWx0ZXJuYXRpdmUuX3RleHRdO1xuICAgICAgICBpZiAoaXNLZXl3b3JkKSB7XG4gICAgICAgICAgdmFyIGNvb3JkaW5hdGUgPSBbYmluLl9pbmRleCwgd2FJbmRleF07XG4gICAgICAgICAga2V5d29yZEZyYWdtZW50cy5wdXNoKGNvb3JkaW5hdGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIG9uQ2xpY2sgPSAnXCJvbktleXdvcmRPY2N1cnJlbmNlU2VsZWN0ZWQoJyArIHN0YXJ0X3RpbWUgKyAnLCcgKyBKU09OLnN0cmluZ2lmeShrZXl3b3JkRnJhZ21lbnRzKSArICcpXCInO1xuICAgIHZhciAkdHIgPSAkKCc8dHIgY2xhc3M9XFwnc2VsZWN0YWJsZVxcJyBvbkNsaWNrPScgKyBvbkNsaWNrICsgJy8+Jyk7XG4gICAgdmFyICR0ZF9pbmRleCA9ICQoJzx0ZCBjbGFzcz1cXCdpbmRleFxcJz4nICsgKGluZGV4ICsgMSkgKyAnLjwvdGQ+Jyk7XG4gICAgdmFyICR0ZF9zdGFydF9sYWJlbCA9ICQoJzx0ZCBjbGFzcz1cXCdib2xkXFwnPlN0YXJ0OjwvdGQ+Jyk7XG4gICAgdmFyICR0ZF9zdGFydCA9ICQoJzx0ZC8+Jyk7XG4gICAgJHRkX3N0YXJ0LmFwcGVuZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShzdGFydF90aW1lKSk7XG4gICAgdmFyICR0ZF9lbmRfbGFiZWwgPSAkKCc8dGQgY2xhc3M9XFwnYm9sZFxcJz5FbmQ6PC90ZD4nKTtcbiAgICB2YXIgJHRkX2VuZCA9ICQoJzx0ZC8+Jyk7XG4gICAgJHRkX2VuZC5hcHBlbmQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoZW5kX3RpbWUpKTtcbiAgICB2YXIgJHRkX2NvbmZpZGVuY2VfbGFiZWwgPSAkKCc8dGQgY2xhc3M9XFwnYm9sZFxcJz5Db25maWRlbmNlOjwvdGQ+Jyk7XG4gICAgdmFyICR0ZF9jb25maWRlbmNlID0gJCgnPHRkLz4nKTtcbiAgICAkdGRfY29uZmlkZW5jZS5hcHBlbmQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY29uZmlkZW5jZSArICclJykpO1xuICAgICR0ci5hcHBlbmQoWyR0ZF9pbmRleCwgJHRkX3N0YXJ0X2xhYmVsLCAkdGRfc3RhcnQsICR0ZF9lbmRfbGFiZWwsICR0ZF9lbmQsICR0ZF9jb25maWRlbmNlX2xhYmVsLCAkdGRfY29uZmlkZW5jZV0pO1xuICAgICR0YWJsZS5hcHBlbmQoJHRyKTtcbiAgfVxuICAkbGkuYXBwZW5kKCR0YWJsZSk7XG4gICQoJyNrZXl3b3JkcyB1bCcpLmFwcGVuZCgkbGkpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVEZXRlY3RlZEtleXdvcmRzKCkge1xuICAkKCcja2V5d29yZHMgdWwnKS5lbXB0eSgpO1xuICBrZXl3b3Jkc190b19zZWFyY2guZm9yRWFjaChmdW5jdGlvbihlbGVtZW50LyosIGluZGV4LCBhcnJheSovKSB7XG4gICAgdmFyIGtleXdvcmQgPSBlbGVtZW50O1xuICAgIGlmIChrZXl3b3JkIGluIGRldGVjdGVkX2tleXdvcmRzKSB7XG4gICAgICB1cGRhdGVLZXl3b3JkKGtleXdvcmQpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGtleXdvcmROb3RGb3VuZChrZXl3b3JkKTtcbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiB0b2dnbGVBbHRlcm5hdGVXb3JkcygpIHtcbiAgaWYgKHNob3dBbGxIeXBvdGhlc2VzID09IGZhbHNlKSB7XG4gICAgaWYgKHZzbGlkZXIubWluIDwgMCkge1xuICAgICAgJCgnI3ZzbGlkZXInKS5jc3MoJ2Rpc3BsYXknLCAnYmxvY2snKTtcbiAgICB9XG4gICAgJCgnI3Nob3dfYWx0ZXJuYXRlX3dvcmRzJykudGV4dCgnSGlkZSBhbHRlcm5hdGUgd29yZHMnKTtcbiAgICBzaG93QWxsSHlwb3RoZXNlcyA9IHRydWU7XG4gIH1cbiAgZWxzZSB7XG4gICAgJCgnI3ZzbGlkZXInKS5jc3MoJ2Rpc3BsYXknLCAnbm9uZScpO1xuICAgICQoJyNzaG93X2FsdGVybmF0ZV93b3JkcycpLnRleHQoJ1Nob3cgYWx0ZXJuYXRlIHdvcmRzJyk7XG4gICAgc2hvd0FsbEh5cG90aGVzZXMgPSBmYWxzZTtcbiAgfVxuICBkcmF3KCk7XG59XG5cbiQoJyNzaG93X2FsdGVybmF0ZV93b3JkcycpLmNsaWNrKGZ1bmN0aW9uKC8qZSovKSB7XG4gIHRvZ2dsZUFsdGVybmF0ZVdvcmRzKCk7XG59KTtcblxuZXhwb3J0cy5zaG93SlNPTiA9IGZ1bmN0aW9uKGJhc2VKU09OKSB7XG4gIGlmICgkKCcubmF2LXRhYnMgLmFjdGl2ZScpLnRleHQoKSA9PSAnSlNPTicpIHtcbiAgICAkKCcjcmVzdWx0c0pTT04nKS52YWwoYmFzZUpTT04pO1xuICB9XG59O1xuXG5mdW5jdGlvbiB1cGRhdGVUZXh0U2Nyb2xsKCl7XG4gIGlmICghc2Nyb2xsZWQpe1xuICAgIHZhciBlbGVtZW50ID0gJCgnI3Jlc3VsdHNUZXh0JykuZ2V0KDApO1xuICAgIGVsZW1lbnQuc2Nyb2xsVG9wID0gZWxlbWVudC5zY3JvbGxIZWlnaHQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW5pdFRleHRTY3JvbGwoKSB7XG4gIC8vICQoJyNyZXN1bHRzVGV4dCcpLm9uKCdzY3JvbGwnLCBmdW5jdGlvbigpe1xuICAvLyAgICAgdGV4dFNjcm9sbGVkID0gdHJ1ZTtcbiAgLy8gfSk7XG59XG5cbmZ1bmN0aW9uIG9uUmVzaXplKCkge1xuICB2YXIgeF9yYXRpbyA9ICQoJyNjYW52YXMnKS53aWR0aCgpIC8gY2FudmFzLndpZHRoO1xuICB2YXIgeV9yYXRpbyA9ICQoJyNjYW52YXMnKS5oZWlnaHQoKSAvIGNhbnZhcy5oZWlnaHQ7XG4gIGNhbnZhcy53aWR0aCA9ICQoJyNjYW52YXMnKS53aWR0aCgpO1xuICBjYW52YXMuaGVpZ2h0ID0gJCgnI2NhbnZhcycpLmhlaWdodCgpO1xuICBjdHguc2V0VHJhbnNmb3JtKHhfcmF0aW8sIDAsIDAsIHlfcmF0aW8sIDAsIDApO1xuICBkcmF3KCk7XG59XG5cbmZ1bmN0aW9uIHJlc2V0V29ya2VyKCkge1xuICBydW5UaW1lciA9IGZhbHNlO1xuICB3b3JrZXIucG9zdE1lc3NhZ2Uoe1xuICAgIHR5cGU6J2NsZWFyJ1xuICB9KTtcbiAgcHVzaGVkID0gMDtcbiAgcG9wcGVkID0gMDtcbiAgY29uc29sZS5sb2coJy0tLT4gcmVzZXRXb3JrZXIgY2FsbGVkJyk7XG59XG5cbmV4cG9ydHMuaW5pdERpc3BsYXlNZXRhZGF0YSA9IGZ1bmN0aW9uKCkge1xuICBpbml0VGV4dFNjcm9sbCgpO1xuICBrZXl3b3Jkc0lucHV0RGlydHkgPSBmYWxzZTtcbiAgaHNsaWRlci5taW4gPSAwO1xuICBoc2xpZGVyLm1heCA9IDA7XG4gIGhzbGlkZXIudmFsdWUgPSBoc2xpZGVyLm1pbjtcbiAgdnNsaWRlci5taW4gPSAwO1xuICB2c2xpZGVyLm1heCA9IDA7XG4gIHZzbGlkZXIudmFsdWUgPSB2c2xpZGVyLm1heDtcbiAgJCgnI3ZzbGlkZXInKS5jc3MoJ2Rpc3BsYXknLCAnbm9uZScpO1xuICAkKCcjaHNsaWRlcicpLm9uKCdjaGFuZ2UgbW91c2Vtb3ZlJywgZnVuY3Rpb24oKSB7XG4gICAgb25IU2Nyb2xsKCk7XG4gIH0pO1xuICAkKCcjdnNsaWRlcicpLm9uKCdjaGFuZ2UgbW91c2Vtb3ZlJywgZnVuY3Rpb24oKSB7XG4gICAgb25WU2Nyb2xsKCk7XG4gIH0pO1xuXG4gICQoJyNjYW52YXMnKS5jc3MoJ2Rpc3BsYXknLCAnbm9uZScpO1xuICAkKCcjY2FudmFzLXBsYWNlaG9sZGVyJykuY3NzKCdkaXNwbGF5JywgJ2Jsb2NrJyk7XG4gICQoJyNsZWZ0LWFycm93JykuY3NzKCdkaXNwbGF5JywgJ25vbmUnKTtcbiAgJCgnI3JpZ2h0LWFycm93JykuY3NzKCdkaXNwbGF5JywgJ25vbmUnKTtcblxuICBvblJlc2l6ZSgpOyAvLyB0byBhZGp1c3QgdGhlIGNhbnZhcyBzaXplXG5cbiAgdmFyIHdvcmtlclNjcmlwdEJvZHkgPVxuICAgICd2YXIgZmlmbyA9IFtdO1xcbicgK1xuICAgICd2YXIgb25tZXNzYWdlID0gZnVuY3Rpb24oZXZlbnQpIHtcXG4nICtcbiAgICAnICB2YXIgcGF5bG9hZCA9IGV2ZW50LmRhdGE7XFxuJyArXG4gICAgJyAgdmFyIHR5cGUgPSBwYXlsb2FkLnR5cGU7XFxuJyArXG4gICAgJyAgaWYodHlwZSA9PSBcXCdwdXNoXFwnKSB7XFxuJyArXG4gICAgJyAgICBmaWZvLnB1c2gocGF5bG9hZC5tc2cpO1xcbicgK1xuICAgICcgIH1cXG4nICtcbiAgICAnICBlbHNlIGlmKHR5cGUgPT0gXFwnc2hpZnRcXCcgJiYgZmlmby5sZW5ndGggPiAwKSB7XFxuJyArXG4gICAgJyAgICB2YXIgbXNnID0gZmlmby5zaGlmdCgpO1xcbicgK1xuICAgICcgICAgcG9zdE1lc3NhZ2Uoe1xcbicgK1xuICAgICcgICAgIGJpbnM6bXNnLnJlc3VsdHNbMF0ud29yZF9hbHRlcm5hdGl2ZXMsXFxuJyArXG4gICAgJyAgICAga3dzOm1zZy5yZXN1bHRzWzBdLmtleXdvcmRzX3Jlc3VsdFxcbicgK1xuICAgICcgICAgfSk7XFxuJyArXG4gICAgJyAgfVxcbicgK1xuICAgICcgIGVsc2UgaWYodHlwZSA9PSBcXCdjbGVhclxcJykge1xcbicgK1xuICAgICcgICAgZmlmbyA9IFtdO1xcbicgK1xuICAgICcgICAgY29uc29sZS5sb2coXFwnd29ya2VyOiBmaWZvIGNsZWFyZWRcXCcpO1xcbicgK1xuICAgICcgIH1cXG4nICtcbiAgICAnfVxcbic7XG5cbiAgdmFyIGJsb2JVUkwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChuZXcgQmxvYihbd29ya2VyU2NyaXB0Qm9keV0pKTtcbiAgd29ya2VyID0gbmV3IFdvcmtlcihibG9iVVJMKTtcbiAgd29ya2VyLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdmFyIGRhdGEgPSBldmVudC5kYXRhO1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11c2UtYmVmb3JlLWRlZmluZVxuICAgIHNob3dDTnNLV1MoZGF0YS5iaW5zLCBkYXRhLmt3cyk7XG4gICAgcG9wcGVkKys7XG4gICAgY29uc29sZS5sb2coJy0tLS0+IHBvcHBlZCcsIHBvcHBlZCk7XG4gIH07XG59O1xuXG5mdW5jdGlvbiBzaG93Q05zS1dTKGJpbnMsIGt3cykge1xuICBiaW5zLmZvckVhY2gocGFyc2VCaW4pO1xuICBoc2xpZGVyLm1heCA9IHNjZW5lLndpZHRoKCkgLSBjYW52YXMud2lkdGggKyBJTklUSUFMX09GRlNFVF9YO1xuICBoc2xpZGVyLnZhbHVlID0gaHNsaWRlci5tYXg7XG4gIG9uSFNjcm9sbCgpO1xuXG4gIGlmICh2c2xpZGVyLm1pbiA8IDAgJiYgc2hvd0FsbEh5cG90aGVzZXMpIHtcbiAgICAkKCcjdnNsaWRlcicpLmNzcygnZGlzcGxheScsICdibG9jaycpO1xuICB9XG4gICQoJyNoc2xpZGVyJykuY3NzKCdkaXNwbGF5JywgJ2Jsb2NrJyk7XG4gICQoJyNzaG93X2FsdGVybmF0ZV93b3JkcycpLmNzcygnZGlzcGxheScsICdpbmxpbmUtYmxvY2snKTtcbiAgJCgnI2NhbnZhcycpLmNzcygnZGlzcGxheScsICdibG9jaycpO1xuICAkKCcjY2FudmFzLXBsYWNlaG9sZGVyJykuY3NzKCdkaXNwbGF5JywgJ25vbmUnKTtcbiAgJCgnI2xlZnQtYXJyb3cnKS5jc3MoJ2Rpc3BsYXknLCAnaW5saW5lLWJsb2NrJyk7XG4gICQoJyNyaWdodC1hcnJvdycpLmNzcygnZGlzcGxheScsICdpbmxpbmUtYmxvY2snKTtcblxuICAvLyBLV1NcbiAgcGFyc2VLZXl3b3Jkcyhrd3MpO1xuICB1cGRhdGVEZXRlY3RlZEtleXdvcmRzKCk7XG59XG5cbmZ1bmN0aW9uIG9uVGltZXIoKSB7XG4gIHdvcmtlci5wb3N0TWVzc2FnZSh7XG4gICAgdHlwZTonc2hpZnQnXG4gIH0pO1xuICBpZiAocnVuVGltZXIgPT0gdHJ1ZSkge1xuICAgIHNldFRpbWVvdXQob25UaW1lciwgdGltZW91dCk7XG4gIH1cbn1cblxuZXhwb3J0cy5zaG93UmVzdWx0ID0gZnVuY3Rpb24obXNnLCBiYXNlU3RyaW5nLCBtb2RlbCkge1xuICBpZiAobXNnLnJlc3VsdHMgJiYgbXNnLnJlc3VsdHMubGVuZ3RoID4gMCkge1xuICAgIC8vdmFyIGFsdGVybmF0aXZlcyA9IG1zZy5yZXN1bHRzWzBdLmFsdGVybmF0aXZlcztcbiAgICB2YXIgdGV4dCA9IG1zZy5yZXN1bHRzWzBdLmFsdGVybmF0aXZlc1swXS50cmFuc2NyaXB0IHx8ICcnO1xuXG4gICAgLy8gYXBwbHkgbWFwcGluZ3MgdG8gYmVhdXRpZnlcbiAgICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC8lSEVTSVRBVElPTlxccy9nLCAnJyk7XG4gICAgdGV4dCA9IHRleHQucmVwbGFjZSgvKFteKl0pXFwxezIsfS9nLCAnJyk7XG5cbiAgICBpZiAobXNnLnJlc3VsdHNbMF0uZmluYWwpIHtcbiAgICAgIGNvbnNvbGUubG9nKCctPiAnICsgdGV4dCk7XG4gICAgICB3b3JrZXIucG9zdE1lc3NhZ2Uoe1xuICAgICAgICB0eXBlOidwdXNoJyxcbiAgICAgICAgbXNnOm1zZ1xuICAgICAgfSk7XG4gICAgICBwdXNoZWQrKztcbiAgICAgIGNvbnNvbGUubG9nKCctLS0tPiBwdXNoZWQnLCBwdXNoZWQpO1xuICAgICAgaWYgKHJ1blRpbWVyID09IGZhbHNlKSB7XG4gICAgICAgIHJ1blRpbWVyID0gdHJ1ZTtcbiAgICAgICAgc2V0VGltZW91dChvblRpbWVyLCB0aW1lb3V0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGV4dCA9IHRleHQucmVwbGFjZSgvRF9bXlxcc10rL2csJycpO1xuXG4gICAgLy8gaWYgYWxsIHdvcmRzIGFyZSBtYXBwZWQgdG8gbm90aGluZyB0aGVuIHRoZXJlIGlzIG5vdGhpbmcgZWxzZSB0byBkb1xuICAgIGlmICgodGV4dC5sZW5ndGggPT0gMCkgfHwgKC9eXFxzKyQvLnRlc3QodGV4dCkpKSB7XG4gICAgICByZXR1cm4gYmFzZVN0cmluZztcbiAgICB9XG5cbiAgICB2YXIgamFwYW5lc2UgPSAoKG1vZGVsLnN1YnN0cmluZygwLDUpID09ICdqYS1KUCcpIHx8IChtb2RlbC5zdWJzdHJpbmcoMCw1KSA9PSAnemgtQ04nKSk7XG5cbiAgICAvLyBjYXBpdGFsaXplIGZpcnN0IHdvcmRcbiAgICAvLyBpZiBmaW5hbCByZXN1bHRzLCBhcHBlbmQgYSBuZXcgcGFyYWdyYXBoXG4gICAgaWYgKG1zZy5yZXN1bHRzICYmIG1zZy5yZXN1bHRzWzBdICYmIG1zZy5yZXN1bHRzWzBdLmZpbmFsKSB7XG4gICAgICB0ZXh0ID0gdGV4dC5zbGljZSgwLCAtMSk7XG4gICAgICB0ZXh0ID0gdGV4dC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHRleHQuc3Vic3RyaW5nKDEpO1xuICAgICAgaWYgKGphcGFuZXNlKSB7XG4gICAgICAgIHRleHQgPSB0ZXh0LnRyaW0oKSArICfjgIInO1xuICAgICAgICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC8gL2csJycpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRleHQgPSB0ZXh0LnRyaW0oKSArICcuICc7XG4gICAgICB9XG4gICAgICBiYXNlU3RyaW5nICs9IHRleHQ7XG4gICAgICAkKCcjcmVzdWx0c1RleHQnKS52YWwoYmFzZVN0cmluZyk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgaWYgKGphcGFuZXNlKSB7XG4gICAgICAgIHRleHQgPSB0ZXh0LnJlcGxhY2UoLyAvZywnJyk7IC8vIHJlbW92ZSB3aGl0ZXNwYWNlc1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0ZXh0ID0gdGV4dC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHRleHQuc3Vic3RyaW5nKDEpO1xuICAgICAgfVxuICAgICAgJCgnI3Jlc3VsdHNUZXh0JykudmFsKGJhc2VTdHJpbmcgKyB0ZXh0KTtcbiAgICB9XG4gIH1cbiAgdXBkYXRlVGV4dFNjcm9sbCgpO1xuICByZXR1cm4gYmFzZVN0cmluZztcbn07XG5cbmV4cG9ydHMuZ2V0S2V5d29yZHNUb1NlYXJjaCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4ga2V5d29yZHNfdG9fc2VhcmNoO1xufTtcblxuJC5zdWJzY3JpYmUoJ2NsZWFyc2NyZWVuJywgZnVuY3Rpb24oKSB7XG4gIGNsZWFyU2NlbmUoKTtcbiAgY2xlYXJEZXRlY3RlZEtleXdvcmRzKCk7XG4gIHJlc2V0V29ya2VyKCk7XG59KTtcblxuJCh3aW5kb3cpLnJlc2l6ZShmdW5jdGlvbigpIHtcbiAgb25SZXNpemUoKTtcbn0pO1xuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4vKiBnbG9iYWwgJCAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgaGFuZGxlU2VsZWN0ZWRGaWxlID0gcmVxdWlyZSgnLi9maWxldXBsb2FkJykuaGFuZGxlU2VsZWN0ZWRGaWxlO1xuXG5leHBvcnRzLmluaXREcmFnRHJvcCA9IGZ1bmN0aW9uKGN0eCkge1xuXG4gIHZhciBkcmFnQW5kRHJvcFRhcmdldCA9ICQoZG9jdW1lbnQpO1xuXG4gIGRyYWdBbmREcm9wVGFyZ2V0Lm9uKCdkcmFnZW50ZXInLCBmdW5jdGlvbihlKSB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIH0pO1xuXG4gIGRyYWdBbmREcm9wVGFyZ2V0Lm9uKCdkcmFnb3ZlcicsIGZ1bmN0aW9uKGUpIHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gaGFuZGxlRmlsZVVwbG9hZEV2ZW50KGZpbGUpIHtcbiAgICBoYW5kbGVTZWxlY3RlZEZpbGUoY3R4LnRva2VuLCBmaWxlKTtcbiAgfVxuXG4gIGRyYWdBbmREcm9wVGFyZ2V0Lm9uKCdkcm9wJywgZnVuY3Rpb24oZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB2YXIgZXZ0ID0gZS5vcmlnaW5hbEV2ZW50O1xuXG4gICAgaWYgKGV2dC5kYXRhVHJhbnNmZXIuZmlsZXMubGVuZ3RoID09IDApXG4gICAgICByZXR1cm47XG5cbiAgICB2YXIgZmlsZSA9IGV2dC5kYXRhVHJhbnNmZXIuZmlsZXNbMF07XG4gICAgY29uc29sZS5sb2coJ0ZpbGUgZHJvcHBlZCcpO1xuXG4gICAgLy8gSGFuZGxlIGRyYWdnZWQgZmlsZSBldmVudFxuICAgIGhhbmRsZUZpbGVVcGxvYWRFdmVudChmaWxlKTtcbiAgfSk7XG5cblxufTtcbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgSUJNIENvcnAuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuLyogZ2xvYmFsICQgKi9cbid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5mbGFzaFNWRyA9IGZ1bmN0aW9uKGVsKSB7XG4gIGVsLmNzcyh7ZmlsbDogJyNBNTM3MjUnfSk7XG4gIGZ1bmN0aW9uIGxvb3AoKSB7XG4gICAgZWwuYW5pbWF0ZSh7ZmlsbDogJyNBNTM3MjUnfSxcbiAgICAgICAgMTAwMCwgJ2xpbmVhcicpXG4gICAgICAuYW5pbWF0ZSh7ZmlsbDogJ3doaXRlJ30sXG4gICAgICAgICAgMTAwMCwgJ2xpbmVhcicpO1xuICB9XG4gIC8vIHJldHVybiB0aW1lclxuICB2YXIgdGltZXIgPSBzZXRUaW1lb3V0KGxvb3AsIDIwMDApO1xuICByZXR1cm4gdGltZXI7XG59O1xuXG5leHBvcnRzLnN0b3BGbGFzaFNWRyA9IGZ1bmN0aW9uKHRpbWVyLCBlbCkge1xuICBlbC5jc3Moe2ZpbGw6ICd3aGl0ZSd9KTtcbiAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG59O1xuXG5leHBvcnRzLnRvZ2dsZUltYWdlID0gZnVuY3Rpb24oZWwsIG5hbWUpIHtcbiAgaWYgKGVsLmF0dHIoJ3NyYycpID09PSAnaW1hZ2VzLycgKyBuYW1lICsgJy5zdmcnKSB7XG4gICAgZWwuYXR0cignc3JjJywgJ2ltYWdlcy9zdG9wLXJlZC5zdmcnKTtcbiAgfSBlbHNlIHtcbiAgICBlbC5hdHRyKCdzcmMnLCAnaW1hZ2VzL3N0b3Auc3ZnJyk7XG4gIH1cbn07XG5cbnZhciByZXN0b3JlSW1hZ2UgPSBleHBvcnRzLnJlc3RvcmVJbWFnZSA9IGZ1bmN0aW9uKGVsLCBuYW1lKSB7XG4gIGVsLmF0dHIoJ3NyYycsICdpbWFnZXMvJyArIG5hbWUgKyAnLnN2ZycpO1xufTtcblxuZXhwb3J0cy5zdG9wVG9nZ2xlSW1hZ2UgPSBmdW5jdGlvbih0aW1lciwgZWwsIG5hbWUpIHtcbiAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG4gIHJlc3RvcmVJbWFnZShlbCwgbmFtZSk7XG59O1xuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4vKiBnbG9iYWwgJCAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgc2hvd0Vycm9yID0gcmVxdWlyZSgnLi9zaG93ZXJyb3InKS5zaG93RXJyb3I7XG52YXIgc2hvd05vdGljZSA9IHJlcXVpcmUoJy4vc2hvd2Vycm9yJykuc2hvd05vdGljZTtcbnZhciBoYW5kbGVGaWxlVXBsb2FkID0gcmVxdWlyZSgnLi4vaGFuZGxlZmlsZXVwbG9hZCcpLmhhbmRsZUZpbGVVcGxvYWQ7XG52YXIgZWZmZWN0cyA9IHJlcXVpcmUoJy4vZWZmZWN0cycpO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKTtcblxuLy8gTmVlZCB0byByZW1vdmUgdGhlIHZpZXcgbG9naWMgaGVyZSBhbmQgbW92ZSB0aGlzIG91dCB0byB0aGUgaGFuZGxlZmlsZXVwbG9hZCBjb250cm9sbGVyXG52YXIgaGFuZGxlU2VsZWN0ZWRGaWxlID0gZXhwb3J0cy5oYW5kbGVTZWxlY3RlZEZpbGUgPSAoZnVuY3Rpb24oKSB7XG5cbiAgdmFyIHJ1bm5pbmcgPSBmYWxzZTtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCAnZmFsc2UnKTtcblxuICByZXR1cm4gZnVuY3Rpb24odG9rZW4sIGZpbGUpIHtcblxuICAgICQucHVibGlzaCgnY2xlYXJzY3JlZW4nKTtcblxuXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCAnZmlsZXVwbG9hZCcpO1xuICAgIHJ1bm5pbmcgPSB0cnVlO1xuXG4gICAgLy8gVmlzdWFsIGVmZmVjdHNcbiAgICB2YXIgdXBsb2FkSW1hZ2VUYWcgPSAkKCcjZmlsZVVwbG9hZFRhcmdldCA+IGltZycpO1xuICAgIHZhciB0aW1lciA9IHNldEludGVydmFsKGVmZmVjdHMudG9nZ2xlSW1hZ2UsIDc1MCwgdXBsb2FkSW1hZ2VUYWcsICdzdG9wJyk7XG4gICAgdmFyIHVwbG9hZFRleHQgPSAkKCcjZmlsZVVwbG9hZFRhcmdldCA+IHNwYW4nKTtcbiAgICB1cGxvYWRUZXh0LnRleHQoJ1N0b3AgVHJhbnNjcmliaW5nJyk7XG5cbiAgICBmdW5jdGlvbiByZXN0b3JlVXBsb2FkVGFiKCkge1xuICAgICAgICBjbGVhckludGVydmFsKHRpbWVyKTtcbiAgICAgICAgZWZmZWN0cy5yZXN0b3JlSW1hZ2UodXBsb2FkSW1hZ2VUYWcsICd1cGxvYWQnKTtcbiAgICAgICAgdXBsb2FkVGV4dC50ZXh0KCdTZWxlY3QgQXVkaW8gRmlsZScpO1xuICAgICAgfVxuXG4gICAgLy8gQ2xlYXIgZmxhc2hpbmcgaWYgc29ja2V0IHVwbG9hZCBpcyBzdG9wcGVkXG4gICAgJC5zdWJzY3JpYmUoJ2hhcmRzb2NrZXRzdG9wJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlc3RvcmVVcGxvYWRUYWIoKTtcbiAgICAgICAgcnVubmluZyA9IGZhbHNlO1xuICAgICAgfSk7XG5cbiAgICAvLyBHZXQgY3VycmVudCBtb2RlbFxuICAgIHZhciBjdXJyZW50TW9kZWwgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudE1vZGVsJyk7XG4gICAgY29uc29sZS5sb2coJ2N1cnJlbnRNb2RlbCcsIGN1cnJlbnRNb2RlbCk7XG5cbiAgICAvLyBSZWFkIGZpcnN0IDQgYnl0ZXMgdG8gZGV0ZXJtaW5lIGhlYWRlclxuICAgIHZhciBibG9iVG9UZXh0ID0gbmV3IEJsb2IoW2ZpbGVdKS5zbGljZSgwLCA0KTtcbiAgICB2YXIgciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgci5yZWFkQXNUZXh0KGJsb2JUb1RleHQpO1xuICAgIHZhciBhdWRpbztcbiAgICByLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgY29udGVudFR5cGU7XG4gICAgICAgIGlmIChyLnJlc3VsdCA9PT0gJ2ZMYUMnKSB7XG4gICAgICAgIGNvbnRlbnRUeXBlID0gJ2F1ZGlvL2ZsYWMnO1xuICAgICAgICBzaG93Tm90aWNlKCdOb3RpY2U6IFRoaXMgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IHBsYXlpbmcgRkxBQyBhdWRpbywgc28gbm8gYXVkaW8gd2lsbCBhY2NvbXBhbnkgdGhlIHRyYW5zY3JpcHRpb24uJyk7XG4gICAgICB9IGVsc2UgaWYgKHIucmVzdWx0ID09PSAnUklGRicpIHtcbiAgICAgICAgY29udGVudFR5cGUgPSAnYXVkaW8vd2F2JztcbiAgICAgICAgYXVkaW8gPSBuZXcgQXVkaW8oKTtcbiAgICAgICAgdmFyIHdhdkJsb2IgPSBuZXcgQmxvYihbZmlsZV0sIHt0eXBlOiAnYXVkaW8vd2F2J30pO1xuICAgICAgICB2YXIgd2F2VVJMID0gVVJMLmNyZWF0ZU9iamVjdFVSTCh3YXZCbG9iKTtcbiAgICAgICAgYXVkaW8uc3JjID0gd2F2VVJMO1xuICAgICAgICBhdWRpby5wbGF5KCk7XG4gICAgICAgICQuc3Vic2NyaWJlKCdoYXJkc29ja2V0c3RvcCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGF1ZGlvLnBhdXNlKCk7XG4gICAgICAgICAgYXVkaW8uY3VycmVudFRpbWUgPSAwO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoci5yZXN1bHQgPT09ICdPZ2dTJykge1xuICAgICAgICBjb250ZW50VHlwZSA9ICdhdWRpby9vZ2c7IGNvZGVjcz1vcHVzJztcbiAgICAgICAgYXVkaW8gPSBuZXcgQXVkaW8oKTtcbiAgICAgICAgdmFyIG9wdXNCbG9iID0gbmV3IEJsb2IoW2ZpbGVdLCB7dHlwZTogJ2F1ZGlvL29nZzsgY29kZWNzPW9wdXMnfSk7XG4gICAgICAgIHZhciBvcHVzVVJMID0gVVJMLmNyZWF0ZU9iamVjdFVSTChvcHVzQmxvYik7XG4gICAgICAgIGF1ZGlvLnNyYyA9IG9wdXNVUkw7XG4gICAgICAgIGF1ZGlvLnBsYXkoKTtcbiAgICAgICAgJC5zdWJzY3JpYmUoJ2hhcmRzb2NrZXRzdG9wJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgYXVkaW8ucGF1c2UoKTtcbiAgICAgICAgICBhdWRpby5jdXJyZW50VGltZSA9IDA7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdG9yZVVwbG9hZFRhYigpO1xuICAgICAgICBzaG93RXJyb3IoJ09ubHkgV0FWLCBGTEFDLCBvciBPUFVTIGZpbGVzIGNhbiBiZSB0cmFuc2NyaWJlZC4gUGxlYXNlIHRyeSBhbm90aGVyIGZpbGUgZm9ybWF0LicpO1xuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsICdmYWxzZScpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAgIGhhbmRsZUZpbGVVcGxvYWQoJ2ZpbGV1cGxvYWQnLCB0b2tlbiwgY3VycmVudE1vZGVsLCBmaWxlLCBjb250ZW50VHlwZSwgZnVuY3Rpb24oc29ja2V0KSB7XG4gICAgICAgIHZhciBibG9iID0gbmV3IEJsb2IoW2ZpbGVdKTtcbiAgICAgICAgdmFyIHBhcnNlT3B0aW9ucyA9IHtcbiAgICAgICAgICBmaWxlOiBibG9iXG4gICAgICAgIH07XG4gICAgICAgIHV0aWxzLm9uRmlsZVByb2dyZXNzKHBhcnNlT3B0aW9ucyxcbiAgICAgICAgICAvLyBPbiBkYXRhIGNodW5rXG4gICAgICAgICAgZnVuY3Rpb24gb25EYXRhKGNodW5rKSB7XG4gICAgICAgICAgICBzb2NrZXQuc2VuZChjaHVuayk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBmdW5jdGlvbiBpc1J1bm5pbmcoKSB7XG4gICAgICAgICAgICBpZiAocnVubmluZylcbiAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgLy8gT24gZmlsZSByZWFkIGVycm9yXG4gICAgICAgICAgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnRXJyb3IgcmVhZGluZyBmaWxlOiAnLCBldnQubWVzc2FnZSk7XG4gICAgICAgICAgICBzaG93RXJyb3IoJ0Vycm9yOiAnICsgZXZ0Lm1lc3NhZ2UpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgLy8gT24gbG9hZCBlbmRcbiAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHsnYWN0aW9uJzogJ3N0b3AnfSkpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgZWZmZWN0cy5zdG9wVG9nZ2xlSW1hZ2UodGltZXIsIHVwbG9hZEltYWdlVGFnLCAndXBsb2FkJyk7XG4gICAgICAgICAgdXBsb2FkVGV4dC50ZXh0KCdTZWxlY3QgQXVkaW8gRmlsZScpO1xuICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgJ2ZhbHNlJyk7XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgICB9O1xuICB9O1xufSkoKTtcblxuXG5leHBvcnRzLmluaXRGaWxlVXBsb2FkID0gZnVuY3Rpb24oY3R4KSB7XG5cbiAgdmFyIGZpbGVVcGxvYWREaWFsb2cgPSAkKCcjZmlsZVVwbG9hZERpYWxvZycpO1xuXG4gIGZpbGVVcGxvYWREaWFsb2cuY2hhbmdlKGZ1bmN0aW9uKCkge1xuICAgIHZhciBmaWxlID0gZmlsZVVwbG9hZERpYWxvZy5nZXQoMCkuZmlsZXNbMF07XG4gICAgaGFuZGxlU2VsZWN0ZWRGaWxlKGN0eC50b2tlbiwgZmlsZSk7XG4gIH0pO1xuXG4gICQoJyNmaWxlVXBsb2FkVGFyZ2V0JykuY2xpY2soZnVuY3Rpb24oKSB7XG5cbiAgICB2YXIgY3VycmVudGx5RGlzcGxheWluZyA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJyk7XG5cbiAgICBpZiAoY3VycmVudGx5RGlzcGxheWluZyA9PSAnZmlsZXVwbG9hZCcpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdIQVJEIFNPQ0tFVCBTVE9QJyk7XG4gICAgICAkLnB1Ymxpc2goJ2hhcmRzb2NrZXRzdG9wJyk7XG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsICdmYWxzZScpO1xuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAoY3VycmVudGx5RGlzcGxheWluZyA9PSAnc2FtcGxlJykge1xuICAgICAgc2hvd0Vycm9yKCdDdXJyZW50bHkgYW5vdGhlciBmaWxlIGlzIHBsYXlpbmcsIHBsZWFzZSBzdG9wIHRoZSBmaWxlIG9yIHdhaXQgdW50aWwgaXQgZmluaXNoZXMnKTtcbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnRseURpc3BsYXlpbmcgPT0gJ3JlY29yZCcpIHtcbiAgICAgIHNob3dFcnJvcignQ3VycmVudGx5IGF1ZGlvIGlzIGJlaW5nIHJlY29yZGVkLCBwbGVhc2Ugc3RvcCByZWNvcmRpbmcgYmVmb3JlIHBsYXlpbmcgYSBzYW1wbGUnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZmlsZVVwbG9hZERpYWxvZy52YWwobnVsbCk7XG5cbiAgICBmaWxlVXBsb2FkRGlhbG9nXG4gICAgLnRyaWdnZXIoJ2NsaWNrJyk7XG5cbiAgfSk7XG5cbn07XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDE0IElCTSBDb3JwLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIGluaXRTZXNzaW9uUGVybWlzc2lvbnMgPSByZXF1aXJlKCcuL3Nlc3Npb25wZXJtaXNzaW9ucycpLmluaXRTZXNzaW9uUGVybWlzc2lvbnM7XG52YXIgaW5pdEFuaW1hdGVQYW5lbCA9IHJlcXVpcmUoJy4vYW5pbWF0ZXBhbmVsJykuaW5pdEFuaW1hdGVQYW5lbDtcbnZhciBpbml0U2hvd1RhYiA9IHJlcXVpcmUoJy4vc2hvd3RhYicpLmluaXRTaG93VGFiO1xudmFyIGluaXREcmFnRHJvcCA9IHJlcXVpcmUoJy4vZHJhZ2Ryb3AnKS5pbml0RHJhZ0Ryb3A7XG52YXIgaW5pdFBsYXlTYW1wbGUgPSByZXF1aXJlKCcuL3BsYXlzYW1wbGUnKS5pbml0UGxheVNhbXBsZTtcbnZhciBpbml0UmVjb3JkQnV0dG9uID0gcmVxdWlyZSgnLi9yZWNvcmRidXR0b24nKS5pbml0UmVjb3JkQnV0dG9uO1xudmFyIGluaXRGaWxlVXBsb2FkID0gcmVxdWlyZSgnLi9maWxldXBsb2FkJykuaW5pdEZpbGVVcGxvYWQ7XG52YXIgaW5pdERpc3BsYXlNZXRhZGF0YSA9IHJlcXVpcmUoJy4vZGlzcGxheW1ldGFkYXRhJykuaW5pdERpc3BsYXlNZXRhZGF0YTtcblxuZXhwb3J0cy5pbml0Vmlld3MgPSBmdW5jdGlvbihjdHgpIHtcbiAgY29uc29sZS5sb2coJ0luaXRpYWxpemluZyB2aWV3cy4uLicpO1xuICBpbml0UGxheVNhbXBsZShjdHgpO1xuICBpbml0RHJhZ0Ryb3AoY3R4KTtcbiAgaW5pdFJlY29yZEJ1dHRvbihjdHgpO1xuICBpbml0RmlsZVVwbG9hZChjdHgpO1xuICBpbml0U2Vzc2lvblBlcm1pc3Npb25zKCk7XG4gIGluaXRTaG93VGFiKCk7XG4gIGluaXRBbmltYXRlUGFuZWwoKTtcbiAgaW5pdFNob3dUYWIoKTtcbiAgaW5pdERpc3BsYXlNZXRhZGF0YSgpO1xufTtcbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgSUJNIENvcnAuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuLyogZ2xvYmFsICQgKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKTtcbnZhciBvbkZpbGVQcm9ncmVzcyA9IHV0aWxzLm9uRmlsZVByb2dyZXNzO1xudmFyIGhhbmRsZUZpbGVVcGxvYWQgPSByZXF1aXJlKCcuLi9oYW5kbGVmaWxldXBsb2FkJykuaGFuZGxlRmlsZVVwbG9hZDtcbnZhciBnZXRLZXl3b3Jkc1RvU2VhcmNoID0gcmVxdWlyZSgnLi9kaXNwbGF5bWV0YWRhdGEnKS5nZXRLZXl3b3Jkc1RvU2VhcmNoO1xudmFyIHNob3dFcnJvciA9IHJlcXVpcmUoJy4vc2hvd2Vycm9yJykuc2hvd0Vycm9yO1xudmFyIGVmZmVjdHMgPSByZXF1aXJlKCcuL2VmZmVjdHMnKTtcblxudmFyIExPT0tVUF9UQUJMRSA9IHtcbiAgJ2FyLUFSX0Jyb2FkYmFuZE1vZGVsJzogWydhci1BUl9Ccm9hZGJhbmRfc2FtcGxlMS53YXYnLCAnYXItQVJfQnJvYWRiYW5kX3NhbXBsZTIud2F2JywgJ9in2YTYt9mC2LMgLCDYsdmK2KfYrSDZhdi52KrYr9mE2KknLCAn2KfYrdmE2KfZhdmG2KcgLCDZhtiz2KrZhNmH2YUnXSxcbiAgJ2VuLVVLX0Jyb2FkYmFuZE1vZGVsJzogWydlbi1VS19Ccm9hZGJhbmRfc2FtcGxlMS53YXYnLCAnZW4tVUtfQnJvYWRiYW5kX3NhbXBsZTIud2F2JywgJ2ltcG9ydGFudCBpbmR1c3RyeSwgYWZmb3JkYWJsZSB0cmF2ZWwsIGJ1c2luZXNzJywgJ2NvbnN1bWVyLCBxdWFsaXR5LCBiZXN0IHByYWN0aWNlJ10sXG4gICdlbi1VS19OYXJyb3diYW5kTW9kZWwnOiBbJ2VuLVVLX05hcnJvd2JhbmRfc2FtcGxlMS53YXYnLCAnZW4tVUtfTmFycm93YmFuZF9zYW1wbGUyLndhdicsICdoZWF2eSByYWluLCBub3J0aHdlc3QsIFVLJywgJ1dhdHNvbiwgc291cmNlcyBhY3Jvc3Mgc29jaWFsIG1lZGlhJ10sXG4gICdlbi1VU19Ccm9hZGJhbmRNb2RlbCc6IFsnVXNfRW5nbGlzaF9Ccm9hZGJhbmRfU2FtcGxlXzEud2F2JywgJ1VzX0VuZ2xpc2hfQnJvYWRiYW5kX1NhbXBsZV8yLndhdicsICdzZW5zZSBvZiBwcmlkZSwgd2F0c29uLCB0ZWNobm9sb2d5LCBjaGFuZ2luZyB0aGUgd29ybGQnLCAncm91bmQsIHdoaXJsaW5nIHZlbG9jaXR5LCB1bndhbnRlZCBlbW90aW9uJ10sXG4gICdlbi1VU19OYXJyb3diYW5kTW9kZWwnOiBbJ1VzX0VuZ2xpc2hfTmFycm93YmFuZF9TYW1wbGVfMS53YXYnLCAnVXNfRW5nbGlzaF9OYXJyb3diYW5kX1NhbXBsZV8yLndhdicsICdjb3Vyc2Ugb25saW5lLCBmb3VyIGhvdXJzLCBoZWxwJywgJ2libSwgY3VzdG9tZXIgZXhwZXJpZW5jZSwgbWVkaWEgZGF0YSddLFxuICAnZXMtRVNfQnJvYWRiYW5kTW9kZWwnOiBbJ0VzX0VTX3NwazI0XzE2a2h6LndhdicsICdFc19FU19zcGsxOV8xNmtoei53YXYnLCAncXVpZXJvIHByZWd1bnRhcmxlLCBleGlzdGVuIHByb2R1Y3RvcycsICdwcmVwYXJhbmRvLCByZWdhbG9zIHBhcmEgbGEgZmFtaWxpYSwgc29icmlub3MnXSxcbiAgJ2VzLUVTX05hcnJvd2JhbmRNb2RlbCc6IFsnRXNfRVNfc3BrMjRfOGtoei53YXYnLCAnRXNfRVNfc3BrMTlfOGtoei53YXYnLCAnUVVJRVJPIFBSRUdVTlRBUkxFLCBFWElTVEVOIFBST0RVQ1RPUycsICdQUkVQQVJBTkRPLCBSRUdBTE9TIFBBUkEgTEEgRkFNSUxJQSwgU09CUklOT1MnXSxcbiAgJ2phLUpQX0Jyb2FkYmFuZE1vZGVsJzogWydzYW1wbGUtSmFfSlAtd2lkZTEud2F2JywgJ3NhbXBsZS1KYV9KUC13aWRlMi53YXYnLCAn5aC05omAICwg5LuK5pelJywgJ+WkieabtCAsIOe1puS4jiAsIOOCs+ODvOODiSddLFxuICAnamEtSlBfTmFycm93YmFuZE1vZGVsJzogWydzYW1wbGUtSmFfSlAtbmFycm93My53YXYnLCAnc2FtcGxlLUphX0pQLW5hcnJvdzQud2F2JywgJ+OBiuWuouanmCAsIOOBiuaJi+aVsCcsICfnlLPjgZfovrzjgb8gLCDku4rlm54gLCDpgJrluLMnXSxcbiAgJ3B0LUJSX0Jyb2FkYmFuZE1vZGVsJzogWydwdC1CUl9TYW1wbGUxLTE2S0h6LndhdicsICdwdC1CUl9TYW1wbGUyLTE2S0h6LndhdicsICdzaXN0ZW1hIGRhIGlibSwgc2V0b3IgYmFuY8OhcmlvLCBxdWFsaWRhZGUsIG5lY2Vzc2lkYWRlcyBkb3MgY2xpZW50ZXMnLCAnbcOpZGljb3MsIGluZm9ybWHDp8O1ZXMsIHBsYW5vcyBkZSB0cmF0YW1lbnRvJ10sXG4gICdwdC1CUl9OYXJyb3diYW5kTW9kZWwnOiBbJ3B0LUJSX1NhbXBsZTEtOEtIei53YXYnLCAncHQtQlJfU2FtcGxlMi04S0h6LndhdicsICdjb3ppbmhhLCBpbm92YWRvcmFzIHJlY2VpdGFzLCBjcmlhdGl2aWRhZGUnLCAnc2lzdGVtYSwgdHJlaW5hZG8gcG9yIGVzcGVjaWFsaXN0YXMsIHNldG9yZXMgZGlmZXJlbnRlcyddLFxuICAnemgtQ05fQnJvYWRiYW5kTW9kZWwnOiBbJ3poLUNOX3NhbXBsZTFfZm9yXzE2ay53YXYnLCAnemgtQ05fc2FtcGxlMl9mb3JfMTZrLndhdicsICfmsoMg5qOuIOaYryDorqTnn6UgLCDlpKcg5pWw5o2uIOWIhuaekCDog73lipsnLCAn5oqA5pyvICwg6K+t6Z+zICwg55qEIOeUqOaItyDkvZPpqowgLCDkurrku6wgLCDmiYvmnLonXSxcbiAgJ3poLUNOX05hcnJvd2JhbmRNb2RlbCc6IFsnemgtQ05fc2FtcGxlMV9mb3JfOGsud2F2JywgJ3poLUNOX3NhbXBsZTJfZm9yXzhrLndhdicsICflhazlj7gg55qEIOaUr+aMgSAsIOeQhui0oiDorqHliJInLCAn5YGH5pyfICwg5a6J5o6SJ11cbn07XG5cbnZhciBwbGF5U2FtcGxlID0gKGZ1bmN0aW9uKCkge1xuXG4gIHZhciBydW5uaW5nID0gZmFsc2U7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgJ2ZhbHNlJyk7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzYW1wbGVQbGF5aW5nJywgJ2ZhbHNlJyk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHRva2VuLCBpbWFnZVRhZywgc2FtcGxlTnVtYmVyLCBpY29uTmFtZSwgdXJsLCBrZXl3b3Jkcykge1xuICAgICQucHVibGlzaCgnY2xlYXJzY3JlZW4nKTtcblxuICAgIHZhciBjdXJyZW50bHlEaXNwbGF5aW5nID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnKTtcbiAgICB2YXIgc2FtcGxlUGxheWluZyA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdzYW1wbGVQbGF5aW5nJyk7XG5cbiAgICBpZiAoc2FtcGxlUGxheWluZyA9PT0gc2FtcGxlTnVtYmVyKSB7XG4gICAgICBjb25zb2xlLmxvZygnSEFSRCBTT0NLRVQgU1RPUCcpO1xuICAgICAgJC5wdWJsaXNoKCdzb2NrZXRzdG9wJyk7XG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsICdmYWxzZScpO1xuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3NhbXBsZVBsYXlpbmcnLCAnZmFsc2UnKTtcbiAgICAgIGVmZmVjdHMuc3RvcFRvZ2dsZUltYWdlKHRpbWVyLCBpbWFnZVRhZywgaWNvbk5hbWUpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVzZS1iZWZvcmUtZGVmaW5lXG4gICAgICBlZmZlY3RzLnJlc3RvcmVJbWFnZShpbWFnZVRhZywgaWNvbk5hbWUpO1xuICAgICAgcnVubmluZyA9IGZhbHNlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChjdXJyZW50bHlEaXNwbGF5aW5nID09PSAncmVjb3JkJykge1xuICAgICAgc2hvd0Vycm9yKCdDdXJyZW50bHkgYXVkaW8gaXMgYmVpbmcgcmVjb3JkZWQsIHBsZWFzZSBzdG9wIHJlY29yZGluZyBiZWZvcmUgcGxheWluZyBhIHNhbXBsZScpO1xuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAoY3VycmVudGx5RGlzcGxheWluZyA9PT0gJ2ZpbGV1cGxvYWQnIHx8IHNhbXBsZVBsYXlpbmcgIT09ICdmYWxzZScpIHtcbiAgICAgIHNob3dFcnJvcignQ3VycmVudGx5IGFub3RoZXIgZmlsZSBpcyBwbGF5aW5nLCBwbGVhc2Ugc3RvcCB0aGUgZmlsZSBvciB3YWl0IHVudGlsIGl0IGZpbmlzaGVzJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCAnc2FtcGxlJyk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3NhbXBsZVBsYXlpbmcnLCBzYW1wbGVOdW1iZXIpO1xuICAgIHJ1bm5pbmcgPSB0cnVlO1xuXG4gICAgJCgnI3Jlc3VsdHNUZXh0JykudmFsKCcnKTsgICAvLyBjbGVhciBoeXBvdGhlc2VzIGZyb20gcHJldmlvdXMgcnVuc1xuXG4gICAgdmFyIHRpbWVyID0gc2V0SW50ZXJ2YWwoZWZmZWN0cy50b2dnbGVJbWFnZSwgNzUwLCBpbWFnZVRhZywgaWNvbk5hbWUpO1xuXG4gICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHhoci5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuICAgIHhoci5yZXNwb25zZVR5cGUgPSAnYmxvYic7XG4gICAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGJsb2IgPSB4aHIucmVzcG9uc2U7XG4gICAgICB2YXIgY3VycmVudE1vZGVsID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRNb2RlbCcpIHx8ICdlbi1VU19Ccm9hZGJhbmRNb2RlbCc7XG4gICAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgIHZhciBibG9iVG9UZXh0ID0gbmV3IEJsb2IoW2Jsb2JdKS5zbGljZSgwLCA0KTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGJsb2JUb1RleHQpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgY29udGVudFR5cGUgPSByZWFkZXIucmVzdWx0ID09PSAnZkxhQycgPyAnYXVkaW8vZmxhYycgOiAnYXVkaW8vd2F2JztcbiAgICAgICAgY29uc29sZS5sb2coJ1VwbG9hZGluZyBmaWxlJywgcmVhZGVyLnJlc3VsdCk7XG4gICAgICAgIHZhciBtZWRpYVNvdXJjZVVSTCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XG4gICAgICAgIHZhciBhdWRpbyA9IG5ldyBBdWRpbygpO1xuICAgICAgICBhdWRpby5zcmMgPSBtZWRpYVNvdXJjZVVSTDtcbiAgICAgICAgYXVkaW8ucGxheSgpO1xuICAgICAgICAkLnN1YnNjcmliZSgnaGFyZHNvY2tldHN0b3AnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBhdWRpby5wYXVzZSgpO1xuICAgICAgICAgIGF1ZGlvLmN1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgfSk7XG4gICAgICAgICQuc3Vic2NyaWJlKCdzb2NrZXRzdG9wJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgYXVkaW8ucGF1c2UoKTtcbiAgICAgICAgICBhdWRpby5jdXJyZW50VGltZSA9IDA7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChnZXRLZXl3b3Jkc1RvU2VhcmNoKCkubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAkKCcjdGJfa2V5d29yZHMnKS5mb2N1cygpO1xuICAgICAgICAgICQoJyN0Yl9rZXl3b3JkcycpLnZhbChrZXl3b3Jkcyk7XG4gICAgICAgICAgJCgnI3RiX2tleXdvcmRzJykuY2hhbmdlKCk7XG4gICAgICAgIH1cbiAgICAgICAgaGFuZGxlRmlsZVVwbG9hZCgnc2FtcGxlJywgdG9rZW4sIGN1cnJlbnRNb2RlbCwgYmxvYiwgY29udGVudFR5cGUsIGZ1bmN0aW9uKHNvY2tldCkge1xuICAgICAgICAgIHZhciBwYXJzZU9wdGlvbnMgPSB7XG4gICAgICAgICAgICBmaWxlOiBibG9iXG4gICAgICAgICAgfTtcbiAgICAgICAgICAvLyB2YXIgc2FtcGxpbmdSYXRlID0gKGN1cnJlbnRNb2RlbC5pbmRleE9mKCdCcm9hZGJhbmQnKSAhPT0gLTEpID8gMTYwMDAgOiA4MDAwO1xuICAgICAgICAgIG9uRmlsZVByb2dyZXNzKHBhcnNlT3B0aW9ucyxcbiAgICAgICAgICAgIC8vIE9uIGRhdGEgY2h1bmtcbiAgICAgICAgICAgIGZ1bmN0aW9uIG9uRGF0YShjaHVuaykge1xuICAgICAgICAgICAgICBzb2NrZXQuc2VuZChjaHVuayk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZnVuY3Rpb24gaXNSdW5uaW5nKCkge1xuICAgICAgICAgICAgICBpZiAocnVubmluZylcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyBPbiBmaWxlIHJlYWQgZXJyb3JcbiAgICAgICAgICAgIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnRXJyb3IgcmVhZGluZyBmaWxlOiAnLCBldnQubWVzc2FnZSk7XG4gICAgICAgICAgICAgIC8vIHNob3dFcnJvcihldnQubWVzc2FnZSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgLy8gT24gbG9hZCBlbmRcbiAgICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7J2FjdGlvbic6ICdzdG9wJ30pKTtcbiAgICAgICAgICAgIH0vKiAsXG4gICAgICAgICAgICBzYW1wbGluZ1JhdGUqL1xuICAgICAgICAgICAgKTtcbiAgICAgICAgfSxcbiAgICAgICAgLy8gT24gY29ubmVjdGlvbiBlbmRcbiAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGVmZmVjdHMuc3RvcFRvZ2dsZUltYWdlKHRpbWVyLCBpbWFnZVRhZywgaWNvbk5hbWUpO1xuICAgICAgICAgICAgZWZmZWN0cy5yZXN0b3JlSW1hZ2UoaW1hZ2VUYWcsIGljb25OYW1lKTtcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgJ2ZhbHNlJyk7XG4gICAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnc2FtcGxlUGxheWluZycsICdmYWxzZScpO1xuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgIH07XG4gICAgfTtcbiAgICB4aHIuc2VuZCgpO1xuICB9O1xufSkoKTtcblxuZXhwb3J0cy5pbml0UGxheVNhbXBsZSA9IGZ1bmN0aW9uKGN0eCkge1xuICB2YXIga2V5d29yZHMxID0gTE9PS1VQX1RBQkxFW2N0eC5jdXJyZW50TW9kZWxdWzJdLnNwbGl0KCcsJyk7XG4gIHZhciBrZXl3b3JkczIgPSBMT09LVVBfVEFCTEVbY3R4LmN1cnJlbnRNb2RlbF1bM10uc3BsaXQoJywnKTtcbiAgdmFyIHNldCA9IHt9O1xuXG4gIGZvciAodmFyIGkgPSBrZXl3b3JkczEubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICB2YXIgd29yZCA9IGtleXdvcmRzMVtpXS50cmltKCk7XG4gICAgc2V0W3dvcmRdID0gd29yZDtcbiAgfVxuXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1yZWRlY2xhcmVcbiAgZm9yICh2YXIgaSA9IGtleXdvcmRzMi5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1yZWRlY2xhcmVcbiAgICB2YXIgd29yZCA9IGtleXdvcmRzMltpXS50cmltKCk7XG4gICAgc2V0W3dvcmRdID0gd29yZDtcbiAgfVxuXG4gIHZhciBrZXl3b3JkcyA9IFtdO1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcmVkZWNsYXJlXG4gIGZvciAodmFyIHdvcmQgaW4gc2V0KSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgZ3VhcmQtZm9yLWluXG4gICAga2V5d29yZHMucHVzaChzZXRbd29yZF0pO1xuICB9XG4gIGtleXdvcmRzLnNvcnQoKTtcblxuICAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIGZpbGVOYW1lID0gJ2F1ZGlvLycgKyBMT09LVVBfVEFCTEVbY3R4LmN1cnJlbnRNb2RlbF1bMF07XG4gICAgLy8gdmFyIGtleXdvcmRzID0gTE9PS1VQX1RBQkxFW2N0eC5jdXJyZW50TW9kZWxdWzJdO1xuICAgIHZhciBlbCA9ICQoJy5wbGF5LXNhbXBsZS0xJyk7XG4gICAgZWwub2ZmKCdjbGljaycpO1xuICAgIHZhciBpY29uTmFtZSA9ICdwbGF5JztcbiAgICB2YXIgaW1hZ2VUYWcgPSBlbC5maW5kKCdpbWcnKTtcbiAgICBlbC5jbGljayhmdW5jdGlvbigpIHtcbiAgICAgIHBsYXlTYW1wbGUoY3R4LnRva2VuLCBpbWFnZVRhZywgJ3NhbXBsZS0xJywgaWNvbk5hbWUsIGZpbGVOYW1lLCBrZXl3b3JkcywgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdQbGF5IHNhbXBsZSByZXN1bHQnLCByZXN1bHQpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pKGN0eCwgTE9PS1VQX1RBQkxFKTtcblxuICAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIGZpbGVOYW1lID0gJ2F1ZGlvLycgKyBMT09LVVBfVEFCTEVbY3R4LmN1cnJlbnRNb2RlbF1bMV07XG4gICAgLy8gdmFyIGtleXdvcmRzID0gTE9PS1VQX1RBQkxFW2N0eC5jdXJyZW50TW9kZWxdWzNdO1xuICAgIHZhciBlbCA9ICQoJy5wbGF5LXNhbXBsZS0yJyk7XG4gICAgZWwub2ZmKCdjbGljaycpO1xuICAgIHZhciBpY29uTmFtZSA9ICdwbGF5JztcbiAgICB2YXIgaW1hZ2VUYWcgPSBlbC5maW5kKCdpbWcnKTtcbiAgICBlbC5jbGljayhmdW5jdGlvbigpIHtcbiAgICAgIHBsYXlTYW1wbGUoY3R4LnRva2VuLCBpbWFnZVRhZywgJ3NhbXBsZS0yJywgaWNvbk5hbWUsIGZpbGVOYW1lLCBrZXl3b3JkcywgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdQbGF5IHNhbXBsZSByZXN1bHQnLCByZXN1bHQpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pKGN0eCwgTE9PS1VQX1RBQkxFKTtcbn07XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDE0IElCTSBDb3JwLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbi8qIGdsb2JhbCAkICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBNaWNyb3Bob25lID0gcmVxdWlyZSgnLi4vTWljcm9waG9uZScpO1xudmFyIGhhbmRsZU1pY3JvcGhvbmUgPSByZXF1aXJlKCcuLi9oYW5kbGVtaWNyb3Bob25lJykuaGFuZGxlTWljcm9waG9uZTtcbnZhciBzaG93RXJyb3IgPSByZXF1aXJlKCcuL3Nob3dlcnJvcicpLnNob3dFcnJvcjtcblxuZXhwb3J0cy5pbml0UmVjb3JkQnV0dG9uID0gZnVuY3Rpb24oY3R4KSB7XG5cbiAgdmFyIHJlY29yZEJ1dHRvbiA9ICQoJyNyZWNvcmRCdXR0b24nKTtcblxuICByZWNvcmRCdXR0b24uY2xpY2soKGZ1bmN0aW9uKCkge1xuXG4gICAgdmFyIHJ1bm5pbmcgPSBmYWxzZTtcbiAgICB2YXIgdG9rZW4gPSBjdHgudG9rZW47XG4gICAgdmFyIG1pY09wdGlvbnMgPSB7XG4gICAgICBidWZmZXJTaXplOiBjdHguYnVmZmVyc2l6ZVxuICAgIH07XG4gICAgdmFyIG1pYyA9IG5ldyBNaWNyb3Bob25lKG1pY09wdGlvbnMpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgLy8gUHJldmVudCBkZWZhdWx0IGFuY2hvciBiZWhhdmlvclxuICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgIHZhciBjdXJyZW50TW9kZWwgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudE1vZGVsJyk7XG4gICAgICB2YXIgY3VycmVudGx5RGlzcGxheWluZyA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJyk7XG5cbiAgICAgIGlmIChjdXJyZW50bHlEaXNwbGF5aW5nID09ICdzYW1wbGUnIHx8IGN1cnJlbnRseURpc3BsYXlpbmcgPT0gJ2ZpbGV1cGxvYWQnKSB7XG4gICAgICAgIHNob3dFcnJvcignQ3VycmVudGx5IGFub3RoZXIgZmlsZSBpcyBwbGF5aW5nLCBwbGVhc2Ugc3RvcCB0aGUgZmlsZSBvciB3YWl0IHVudGlsIGl0IGZpbmlzaGVzJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgJ3JlY29yZCcpO1xuICAgICAgaWYgKCFydW5uaW5nKSB7XG4gICAgICAgICQoJyNyZXN1bHRzVGV4dCcpLnZhbCgnJyk7ICAgLy8gY2xlYXIgaHlwb3RoZXNlcyBmcm9tIHByZXZpb3VzIHJ1bnNcbiAgICAgICAgY29uc29sZS5sb2coJ05vdCBydW5uaW5nLCBoYW5kbGVNaWNyb3Bob25lKCknKTtcbiAgICAgICAgaGFuZGxlTWljcm9waG9uZSh0b2tlbiwgY3VycmVudE1vZGVsLCBtaWMsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIHZhciBtc2cgPSAnRXJyb3I6ICcgKyBlcnIubWVzc2FnZTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKG1zZyk7XG4gICAgICAgICAgICBzaG93RXJyb3IobXNnKTtcbiAgICAgICAgICAgIHJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgJ2ZhbHNlJyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlY29yZEJ1dHRvbi5jc3MoJ2JhY2tncm91bmQtY29sb3InLCAnI2Q3NDEwOCcpO1xuICAgICAgICAgICAgcmVjb3JkQnV0dG9uLmZpbmQoJ2ltZycpLmF0dHIoJ3NyYycsICdpbWFnZXMvc3RvcC5zdmcnKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdzdGFydGluZyBtaWMnKTtcbiAgICAgICAgICAgIG1pYy5yZWNvcmQoKTtcbiAgICAgICAgICAgIHJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZygnU3RvcHBpbmcgbWljcm9waG9uZSwgc2VuZGluZyBzdG9wIGFjdGlvbiBtZXNzYWdlJyk7XG4gICAgICAgIHJlY29yZEJ1dHRvbi5yZW1vdmVBdHRyKCdzdHlsZScpO1xuICAgICAgICByZWNvcmRCdXR0b24uZmluZCgnaW1nJykuYXR0cignc3JjJywgJ2ltYWdlcy9taWNyb3Bob25lLnN2ZycpO1xuICAgICAgICAkLnB1Ymxpc2goJ2hhcmRzb2NrZXRzdG9wJyk7XG4gICAgICAgIG1pYy5zdG9wKCk7XG4gICAgICAgIHJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCAnZmFsc2UnKTtcbiAgICAgIH1cbiAgICB9O1xuICB9KSgpKTtcbn07XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDE0IElCTSBDb3JwLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbi8qIGdsb2JhbCAkICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBpbml0UGxheVNhbXBsZSA9IHJlcXVpcmUoJy4vcGxheXNhbXBsZScpLmluaXRQbGF5U2FtcGxlO1xuXG5leHBvcnRzLmluaXRTZWxlY3RNb2RlbCA9IGZ1bmN0aW9uKGN0eCkge1xuXG5cbiAgY3R4Lm1vZGVscy5mb3JFYWNoKGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgJCgnI2Ryb3Bkb3duTWVudUxpc3QnKS5hcHBlbmQoXG4gICAgICAkKCc8bGk+JylcbiAgICAgICAgLmF0dHIoJ3JvbGUnLCAncHJlc2VudGF0aW9uJylcbiAgICAgICAgLmFwcGVuZChcbiAgICAgICAgICAkKCc8YT4nKS5hdHRyKCdyb2xlJywgJ21lbnUtaXRlbScpXG4gICAgICAgICAgICAuYXR0cignaHJlZicsICcvJylcbiAgICAgICAgICAgIC5hdHRyKCdkYXRhLW1vZGVsJywgbW9kZWwubmFtZSlcbiAgICAgICAgICAgIC5hcHBlbmQobW9kZWwuZGVzY3JpcHRpb24uc3Vic3RyaW5nKDAsIG1vZGVsLmRlc2NyaXB0aW9uLmxlbmd0aCAtIDEpLCBtb2RlbC5yYXRlID09IDgwMDAgPyAnICg4S0h6KScgOiAnICgxNktIeiknKSlcbiAgICAgICAgICApO1xuICB9KTtcblxuXG4gICQoJyNkcm9wZG93bk1lbnVMaXN0JykuY2xpY2soZnVuY3Rpb24oZXZ0KSB7XG4gICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXZ0LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGNvbnNvbGUubG9nKCdDaGFuZ2UgdmlldycsICQoZXZ0LnRhcmdldCkudGV4dCgpKTtcbiAgICB2YXIgbmV3TW9kZWxEZXNjcmlwdGlvbiA9ICQoZXZ0LnRhcmdldCkudGV4dCgpO1xuICAgIHZhciBuZXdNb2RlbCA9ICQoZXZ0LnRhcmdldCkuZGF0YSgnbW9kZWwnKTtcbiAgICAkKCcjZHJvcGRvd25NZW51RGVmYXVsdCcpLmVtcHR5KCkudGV4dChuZXdNb2RlbERlc2NyaXB0aW9uKTtcbiAgICAkKCcjZHJvcGRvd25NZW51MScpLmRyb3Bkb3duKCd0b2dnbGUnKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudE1vZGVsJywgbmV3TW9kZWwpO1xuICAgIGN0eC5jdXJyZW50TW9kZWwgPSBuZXdNb2RlbDtcbiAgICBpbml0UGxheVNhbXBsZShjdHgpO1xuICAgICQoJyN0Yl9rZXl3b3JkcycpLmZvY3VzKCk7XG4gICAgJCgnI3RiX2tleXdvcmRzJykudmFsKCcnKTtcbiAgICAkKCcjdGJfa2V5d29yZHMnKS5jaGFuZ2UoKTtcbiAgICAkLnB1Ymxpc2goJ2NsZWFyc2NyZWVuJyk7XG4gIH0pO1xuXG59O1xuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4vKiBnbG9iYWwgJCAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5cbmV4cG9ydHMuaW5pdFNlc3Npb25QZXJtaXNzaW9ucyA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnSW5pdGlhbGl6aW5nIHNlc3Npb24gcGVybWlzc2lvbnMgaGFuZGxlcicpO1xuICAvLyBSYWRpbyBidXR0b25zXG4gIHZhciBzZXNzaW9uUGVybWlzc2lvbnNSYWRpbyA9ICQoJyNzZXNzaW9uUGVybWlzc2lvbnNSYWRpb0dyb3VwIGlucHV0W3R5cGU9XFwncmFkaW9cXCddJyk7XG4gIHNlc3Npb25QZXJtaXNzaW9uc1JhZGlvLmNsaWNrKGZ1bmN0aW9uKCkge1xuICAgIHZhciBjaGVja2VkVmFsdWUgPSBzZXNzaW9uUGVybWlzc2lvbnNSYWRpby5maWx0ZXIoJzpjaGVja2VkJykudmFsKCk7XG4gICAgY29uc29sZS5sb2coJ2NoZWNrZWRWYWx1ZScsIGNoZWNrZWRWYWx1ZSk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3Nlc3Npb25QZXJtaXNzaW9ucycsIGNoZWNrZWRWYWx1ZSk7XG4gIH0pO1xufTtcbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgSUJNIENvcnAuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuLyogZ2xvYmFsICQgKi9cbid1c2Ugc3RyaWN0JztcblxuXG5leHBvcnRzLnNob3dFcnJvciA9IGZ1bmN0aW9uKG1zZykge1xuICBjb25zb2xlLmxvZygnRXJyb3I6ICcsIG1zZyk7XG4gIHZhciBlcnJvckFsZXJ0ID0gJCgnLmVycm9yLXJvdycpO1xuICBlcnJvckFsZXJ0LmhpZGUoKTtcbiAgZXJyb3JBbGVydC5jc3MoJ2JhY2tncm91bmQtY29sb3InLCAnI2Q3NDEwOCcpO1xuICBlcnJvckFsZXJ0LmNzcygnY29sb3InLCAnd2hpdGUnKTtcbiAgdmFyIGVycm9yTWVzc2FnZSA9ICQoJyNlcnJvck1lc3NhZ2UnKTtcbiAgZXJyb3JNZXNzYWdlLnRleHQobXNnKTtcbiAgZXJyb3JBbGVydC5zaG93KCk7XG4gICQoJyNlcnJvckNsb3NlJykuY2xpY2soZnVuY3Rpb24oZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlcnJvckFsZXJ0LmhpZGUoKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0pO1xufTtcblxuZXhwb3J0cy5zaG93Tm90aWNlID0gZnVuY3Rpb24obXNnKSB7XG4gIGNvbnNvbGUubG9nKCdOb3RpY2U6ICcsIG1zZyk7XG4gIHZhciBub3RpY2VBbGVydCA9ICQoJy5ub3RpZmljYXRpb24tcm93Jyk7XG4gIG5vdGljZUFsZXJ0LmhpZGUoKTtcbiAgbm90aWNlQWxlcnQuY3NzKCdib3JkZXInLCAnMnB4IHNvbGlkICNlY2VjZWMnKTtcbiAgbm90aWNlQWxlcnQuY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJyNmNGY0ZjQnKTtcbiAgbm90aWNlQWxlcnQuY3NzKCdjb2xvcicsICdibGFjaycpO1xuICB2YXIgbm90aWNlTWVzc2FnZSA9ICQoJyNub3RpZmljYXRpb25NZXNzYWdlJyk7XG4gIG5vdGljZU1lc3NhZ2UudGV4dChtc2cpO1xuICBub3RpY2VBbGVydC5zaG93KCk7XG4gICQoJyNub3RpZmljYXRpb25DbG9zZScpLmNsaWNrKGZ1bmN0aW9uKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgbm90aWNlQWxlcnQuaGlkZSgpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSk7XG59O1xuXG5leHBvcnRzLmhpZGVFcnJvciA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZXJyb3JBbGVydCA9ICQoJy5lcnJvci1yb3cnKTtcbiAgZXJyb3JBbGVydC5oaWRlKCk7XG59O1xuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4vKiBnbG9iYWwgJCAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLmluaXRTaG93VGFiID0gZnVuY3Rpb24oKSB7XG4gICQoJy5uYXYtdGFicyBhW2RhdGEtdG9nZ2xlPVwidGFiXCJdJykub24oJ3Nob3duLmJzLnRhYicsIGZ1bmN0aW9uKGUpIHtcbiAgICAvLyBzaG93IHNlbGVjdGVkIHRhYiAvIGFjdGl2ZVxuICAgIHZhciB0YXJnZXQgPSAkKGUudGFyZ2V0KS50ZXh0KCk7XG4gICAgaWYgKHRhcmdldCA9PT0gJ0pTT04nKSB7XG4gICAgICAkLnB1Ymxpc2goJ3Nob3dqc29uJyk7XG4gICAgfVxuICB9KTtcbn07XG4iXX0=
