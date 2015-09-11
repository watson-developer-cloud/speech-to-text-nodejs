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
  
  //resampler(this.audioContext.sampleRate,data.inputBuffer,this.onAudio);

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

  
  
// native way of resampling captured audio
var resampler = function(sampleRate, audioBuffer, callbackProcessAudio) {
	
	console.log("length: " + audioBuffer.length + " " + sampleRate);
	var channels = 1; 
	var targetSampleRate = 16000;
   var numSamplesTarget = audioBuffer.length * targetSampleRate / sampleRate;

   var offlineContext = new OfflineAudioContext(channels, numSamplesTarget, targetSampleRate);
   var bufferSource = offlineContext.createBufferSource();
   bufferSource.buffer = audioBuffer;

	// callback that is called when the resampling finishes
   offlineContext.oncomplete = function(event) {   	
      var samplesTarget = event.renderedBuffer.getChannelData(0);                                       
      console.log('Done resampling: ' + samplesTarget.length + " samples produced");  

		// convert from [-1,1] range of floating point numbers to [-32767,32767] range of integers
		var index = 0;
		var volume = 0x7FFF;
  		var pcmEncodedBuffer = new ArrayBuffer(samplesTarget.length*2);    // short integer to byte
  		var dataView = new DataView(pcmEncodedBuffer);
      for (var i = 0; i < samplesTarget.length; i++) {
    		dataView.setInt16(index, samplesTarget[i]*volume, true);
    		index += 2;
  		}

      // l16 is the MIME type for 16-bit PCM
      callbackProcessAudio(new Blob([dataView], { type: 'audio/l16' }));         
   };

   bufferSource.connect(offlineContext.destination);
   bufferSource.start(0);
   offlineContext.startRendering();   
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


},{"./utils":7}],2:[function(require,module,exports){
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
      },
      {
         "url": "https://stream-s.watsonplatform.net/speech-to-text/api/v1/models/pt-BR_BroadbandModel", 
         "rate": 16000, 
         "name": "pt-BR_BroadbandModel", 
         "language": "pt-BR", 
         "description": "Brazilian Portuguese broadband model (16KHz)"
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/pt-BR_NarrowbandModel", 
         "rate": 8000, 
         "name": "pt-BR_NarrowbandModel", 
         "language": "pt-BR", 
         "description": "Brazilian Portuguese narrowband model (8KHz)"
      },
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/zh-CN_BroadbandModel", 
         "rate": 16000, 
         "name": "zh-CN_BroadbandModel", 
         "language": "zh-CN", 
         "description": "Mandarin broadband model (16KHz)"
      },     
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/zh-CN_NarrowbandModel", 
         "rate": 8000, 
         "name": "zh-CN_NarrowbandModel", 
         "language": "zh-CN", 
         "description": "Mandarin narrowband model (8KHz)"
      }      
   ]
}

},{}],3:[function(require,module,exports){

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

    $.subscribe('showjson', function(data) {
      var $resultsJSON = $('#resultsJSON')
      $resultsJSON.empty();
      $resultsJSON.append(baseJSON);
    });

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
      'inactivity_timeout': 600
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
        baseString = display.showResult(msg, baseString, model);
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


},{"./socket":6,"./views/displaymetadata":9,"./views/effects":11,"./views/showerror":18}],4:[function(require,module,exports){

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

  $.subscribe('showjson', function(data) {
    var $resultsJSON = $('#resultsJSON')
    $resultsJSON.empty();
    $resultsJSON.append(baseJSON);
  });

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
    'inactivity_timeout': 600    
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
      baseString = display.showResult(msg, baseString, model);
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
},{"./socket":6,"./views/displaymetadata":9}],5:[function(require,module,exports){
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

window.BUFFERSIZE = 8192;

$(document).ready(function() {

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

},{"./Microphone":1,"./data/models.json":2,"./utils":7,"./views":13}],6:[function(require,module,exports){
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
  var url = options.serviceURI || 'wss://stream-s.watsonplatform.net/speech-to-text/api/v1/recognize?watson-token='
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
},{"./Microphone":1,"./utils":7,"./views/showerror":18}],7:[function(require,module,exports){
(function (global){

// For non-view logic
var $ = (typeof window !== "undefined" ? window['jQuery'] : typeof global !== "undefined" ? global['jQuery'] : null);

var fileBlock = function(_offset, length, _file, readChunk) {
  var r = new FileReader();
  var blob = _file.slice(_offset, length + _offset);
  r.onload = readChunk;
  r.readAsArrayBuffer(blob);
}

// Based on alediaferia's SO response
// http://stackoverflow.com/questions/14438187/javascript-filereader-parsing-long-file-in-chunks
exports.onFileProgress = function(options, ondata, onerror, onend, samplingRate) {
  var file       = options.file;
  var fileSize   = file.size;
  var chunkSize  = options.bufferSize || 16000;  // in bytes
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
      console.log("sending: " + len)
      ondata(buffer); // callback for handling read chunk
    } else {
      var errorMessage = evt.target.error;
      console.log("Read error: " + errorMessage);
      onerror(errorMessage);
      return;
    }
    // use this timeout to pace the data upload for the playSample case, the idea is that the hyps do not arrive before the audio is played back
    if (samplingRate) {
    	console.log("samplingRate: " +  samplingRate + " timeout: " + (chunkSize*1000)/(samplingRate*2))
    	setTimeout(function() { fileBlock(offset, chunkSize, file, readChunk); }, (chunkSize*1000)/(samplingRate*2));
    } else {
      fileBlock(offset, chunkSize, file, readChunk);
    }
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

var $ = (typeof window !== "undefined" ? window['jQuery'] : typeof global !== "undefined" ? global['jQuery'] : null);
var scrolled = false,
    textScrolled = false;

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
/*var processString = function(baseString, isFinished) {

  if (isFinished) {
    var formattedString = baseString.slice(0, -1);
    formattedString = formattedString.charAt(0).toUpperCase() + formattedString.substring(1);
    formattedString = formattedString.trim() + '. ';
    $('#resultsText').val(formattedString);
    return formattedString;
  } else {
    $('#resultsText').val(baseString);
    return baseString;
  }
}*/

exports.showJSON = function(msg, baseJSON) {
  
   var json = JSON.stringify(msg, null, 2);
    baseJSON += json;
    baseJSON += '\n';                                                          

  if ($('.nav-tabs .active').text() == "JSON") {
      $('#resultsJSON').append(baseJSON);
      baseJSON = "";
      console.log("updating json");
  }
  
  return baseJSON;
}

function updateTextScroll(){
  if(!scrolled){
    var element = $('#resultsText').get(0);
    element.scrollTop = element.scrollHeight;
  }
}

var initTextScroll = function() {
  $('#resultsText').on('scroll', function(){
      textScrolled = true;
  });
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

exports.initDisplayMetadata = function() {
  initScroll();
  initTextScroll();
};


exports.showResult = function(msg, baseString, model, callback) {

  var idx = +msg.result_index;

  if (msg.results && msg.results.length > 0) {

    var alternatives = msg.results[0].alternatives;
    var text = msg.results[0].alternatives[0].transcript || '';
    
    // apply mappings to beautify
    text = text.replace(/%HESITATION\s/g, '');
    text = text.replace(/(.)\1{2,}/g, '');
    
    // if all words are mapped to nothing then there is nothing else to do
    if (text.length == 0) {
    	return baseString;
    }    	  
    
    // capitalize first word
    // if final results, append a new paragraph
    if (msg.results && msg.results[0] && msg.results[0].final) {
       text = text.slice(0, -1);
       text = text.charAt(0).toUpperCase() + text.substring(1);
       if ((model.substring(0,5) == "ja-JP") || (model.substring(0,5) == "zh-CN")) {        
          text = text.trim() + '。';
          text = text.replace(/ /g,'');      // remove whitespaces 
       } else {  
          text = text.trim() + '. ';
       }       
       baseString += text;
       $('#resultsText').val(baseString);
       showMetaData(alternatives[0]);
       // Only show alternatives if we're final
       alternativePrototype.showAlternatives(alternatives);
    } else {
       if ((model.substring(0,5) == "ja-JP") || (model.substring(0,5) == "zh-CN")) {        
          text = text.replace(/ /g,'');      // remove whitespaces     	         
       } else {
        	 text = text.charAt(0).toUpperCase() + text.substring(1);
       }
    	 $('#resultsText').val(baseString + text);    	 
    }
  }

  updateScroll();
  updateTextScroll();
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
},{"../handlefileupload":3,"../utils":7,"./effects":11,"./showerror":18}],13:[function(require,module,exports){

var initSessionPermissions = require('./sessionpermissions').initSessionPermissions;
var initSelectModel = require('./selectmodel').initSelectModel;
var initAnimatePanel = require('./animatepanel').initAnimatePanel;
var initShowTab = require('./showtab').initShowTab;
var initDragDrop = require('./dragdrop').initDragDrop;
var initPlaySample = require('./playsample').initPlaySample;
var initRecordButton = require('./recordbutton').initRecordButton;
var initFileUpload = require('./fileupload').initFileUpload;
var initDisplayMetadata = require('./displaymetadata').initDisplayMetadata;


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
  initDisplayMetadata();
}

},{"./animatepanel":8,"./displaymetadata":9,"./dragdrop":10,"./fileupload":12,"./playsample":14,"./recordbutton":15,"./selectmodel":16,"./sessionpermissions":17,"./showtab":19}],14:[function(require,module,exports){

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
  'ja-JP_NarrowbandModel': ['sample-Ja_JP-narrow3.wav', 'sample-Ja_JP-narrow4.wav'],
  'pt-BR_BroadbandModel': ['pt-BR_Sample1-16KHz.wav', 'pt-BR_Sample2-16KHz.wav'],
  'pt-BR_NarrowbandModel': ['pt-BR_Sample1-8KHz.wav', 'pt-BR_Sample2-8KHz.wav'],
  'zh-CN_BroadbandModel': ['sample-Ja_JP-narrow3.wav', 'sample-Ja_JP-narrow4.wav'],
  'zh-CN_NarrowbandModel': ['sample-Ja_JP-narrow3.wav', 'sample-Ja_JP-narrow4.wav']
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
          var samplingRate = (currentModel.indexOf("Broadband") != -1) ? 16000 : 8000;
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
            },
            samplingRate
            );
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



},{"../handlefileupload":3,"../socket":6,"../utils":7,"./effects":11,"./showerror":18}],15:[function(require,module,exports){

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
},{"../Microphone":1,"../handlemicrophone":4,"./showerror":18}],16:[function(require,module,exports){

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

'use strict';

exports.initShowTab = function() {

  $('.nav-tabs a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
    //show selected tab / active
    var target = $(e.target).text();
    if (target === 'JSON') {
      console.log('showing json');
      $.publish('showjson');
    }
  });

}
},{}]},{},[5])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwic3JjL01pY3JvcGhvbmUuanMiLCJzcmMvZGF0YS9tb2RlbHMuanNvbiIsInNyYy9oYW5kbGVmaWxldXBsb2FkLmpzIiwic3JjL2hhbmRsZW1pY3JvcGhvbmUuanMiLCJzcmMvaW5kZXguanMiLCJzcmMvc29ja2V0LmpzIiwic3JjL3V0aWxzLmpzIiwic3JjL3ZpZXdzL2FuaW1hdGVwYW5lbC5qcyIsInNyYy92aWV3cy9kaXNwbGF5bWV0YWRhdGEuanMiLCJzcmMvdmlld3MvZHJhZ2Ryb3AuanMiLCJzcmMvdmlld3MvZWZmZWN0cy5qcyIsInNyYy92aWV3cy9maWxldXBsb2FkLmpzIiwic3JjL3ZpZXdzL2luZGV4LmpzIiwic3JjL3ZpZXdzL3BsYXlzYW1wbGUuanMiLCJzcmMvdmlld3MvcmVjb3JkYnV0dG9uLmpzIiwic3JjL3ZpZXdzL3NlbGVjdG1vZGVsLmpzIiwic3JjL3ZpZXdzL3Nlc3Npb25wZXJtaXNzaW9ucy5qcyIsInNyYy92aWV3cy9zaG93ZXJyb3IuanMiLCJzcmMvdmlld3Mvc2hvd3RhYi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQy9IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDakdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM5TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgSUJNIENvcnAuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlICdMaWNlbnNlJyk7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuICdBUyBJUycgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuLyoqXG4gKiBDYXB0dXJlcyBtaWNyb3Bob25lIGlucHV0IGZyb20gdGhlIGJyb3dzZXIuXG4gKiBXb3JrcyBhdCBsZWFzdCBvbiBsYXRlc3QgdmVyc2lvbnMgb2YgRmlyZWZveCBhbmQgQ2hyb21lXG4gKi9cbmZ1bmN0aW9uIE1pY3JvcGhvbmUoX29wdGlvbnMpIHtcbiAgdmFyIG9wdGlvbnMgPSBfb3B0aW9ucyB8fCB7fTtcblxuICAvLyB3ZSByZWNvcmQgaW4gbW9ubyBiZWNhdXNlIHRoZSBzcGVlY2ggcmVjb2duaXRpb24gc2VydmljZVxuICAvLyBkb2VzIG5vdCBzdXBwb3J0IHN0ZXJlby5cbiAgdGhpcy5idWZmZXJTaXplID0gb3B0aW9ucy5idWZmZXJTaXplIHx8IDgxOTI7XG4gIHRoaXMuaW5wdXRDaGFubmVscyA9IG9wdGlvbnMuaW5wdXRDaGFubmVscyB8fCAxO1xuICB0aGlzLm91dHB1dENoYW5uZWxzID0gb3B0aW9ucy5vdXRwdXRDaGFubmVscyB8fCAxO1xuICB0aGlzLnJlY29yZGluZyA9IGZhbHNlO1xuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IGZhbHNlO1xuICB0aGlzLnNhbXBsZVJhdGUgPSAxNjAwMDtcbiAgLy8gYXV4aWxpYXIgYnVmZmVyIHRvIGtlZXAgdW51c2VkIHNhbXBsZXMgKHVzZWQgd2hlbiBkb2luZyBkb3duc2FtcGxpbmcpXG4gIHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlcyA9IG5ldyBGbG9hdDMyQXJyYXkoMCk7XG5cbiAgLy8gQ2hyb21lIG9yIEZpcmVmb3ggb3IgSUUgVXNlciBtZWRpYVxuICBpZiAoIW5hdmlnYXRvci5nZXRVc2VyTWVkaWEpIHtcbiAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhID0gbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSB8fFxuICAgIG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhO1xuICB9XG5cbn1cblxuLyoqXG4gKiBDYWxsZWQgd2hlbiB0aGUgdXNlciByZWplY3QgdGhlIHVzZSBvZiB0aGUgbWljaHJvcGhvbmVcbiAqIEBwYXJhbSAgZXJyb3IgVGhlIGVycm9yXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uUGVybWlzc2lvblJlamVjdGVkID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUubG9nKCdNaWNyb3Bob25lLm9uUGVybWlzc2lvblJlamVjdGVkKCknKTtcbiAgdGhpcy5yZXF1ZXN0ZWRBY2Nlc3MgPSBmYWxzZTtcbiAgdGhpcy5vbkVycm9yKCdQZXJtaXNzaW9uIHRvIGFjY2VzcyB0aGUgbWljcm9waG9uZSByZWpldGVkLicpO1xufTtcblxuTWljcm9waG9uZS5wcm90b3R5cGUub25FcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XG4gIGNvbnNvbGUubG9nKCdNaWNyb3Bob25lLm9uRXJyb3IoKTonLCBlcnJvcik7XG59O1xuXG4vKipcbiAqIENhbGxlZCB3aGVuIHRoZSB1c2VyIGF1dGhvcml6ZXMgdGhlIHVzZSBvZiB0aGUgbWljcm9waG9uZS5cbiAqIEBwYXJhbSAge09iamVjdH0gc3RyZWFtIFRoZSBTdHJlYW0gdG8gY29ubmVjdCB0b1xuICpcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUub25NZWRpYVN0cmVhbSA9ICBmdW5jdGlvbihzdHJlYW0pIHtcbiAgdmFyIEF1ZGlvQ3R4ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xuXG4gIGlmICghQXVkaW9DdHgpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdBdWRpb0NvbnRleHQgbm90IGF2YWlsYWJsZScpO1xuXG4gIGlmICghdGhpcy5hdWRpb0NvbnRleHQpXG4gICAgdGhpcy5hdWRpb0NvbnRleHQgPSBuZXcgQXVkaW9DdHgoKTtcblxuICB2YXIgZ2FpbiA9IHRoaXMuYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgdmFyIGF1ZGlvSW5wdXQgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzdHJlYW0pO1xuXG4gIGF1ZGlvSW5wdXQuY29ubmVjdChnYWluKTtcblxuICB0aGlzLm1pYyA9IHRoaXMuYXVkaW9Db250ZXh0LmNyZWF0ZVNjcmlwdFByb2Nlc3Nvcih0aGlzLmJ1ZmZlclNpemUsXG4gICAgdGhpcy5pbnB1dENoYW5uZWxzLCB0aGlzLm91dHB1dENoYW5uZWxzKTtcblxuICAvLyB1bmNvbW1lbnQgdGhlIGZvbGxvd2luZyBsaW5lIGlmIHlvdSB3YW50IHRvIHVzZSB5b3VyIG1pY3JvcGhvbmUgc2FtcGxlIHJhdGVcbiAgLy90aGlzLnNhbXBsZVJhdGUgPSB0aGlzLmF1ZGlvQ29udGV4dC5zYW1wbGVSYXRlO1xuICBjb25zb2xlLmxvZygnTWljcm9waG9uZS5vbk1lZGlhU3RyZWFtKCk6IHNhbXBsaW5nIHJhdGUgaXM6JywgdGhpcy5zYW1wbGVSYXRlKTtcblxuICB0aGlzLm1pYy5vbmF1ZGlvcHJvY2VzcyA9IHRoaXMuX29uYXVkaW9wcm9jZXNzLmJpbmQodGhpcyk7XG4gIHRoaXMuc3RyZWFtID0gc3RyZWFtO1xuXG4gIGdhaW4uY29ubmVjdCh0aGlzLm1pYyk7XG4gIHRoaXMubWljLmNvbm5lY3QodGhpcy5hdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuICB0aGlzLnJlY29yZGluZyA9IHRydWU7XG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gZmFsc2U7XG4gIHRoaXMub25TdGFydFJlY29yZGluZygpO1xufTtcblxuLyoqXG4gKiBjYWxsYmFjayB0aGF0IGlzIGJlaW5nIHVzZWQgYnkgdGhlIG1pY3JvcGhvbmVcbiAqIHRvIHNlbmQgYXVkaW8gY2h1bmtzLlxuICogQHBhcmFtICB7b2JqZWN0fSBkYXRhIGF1ZGlvXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLl9vbmF1ZGlvcHJvY2VzcyA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgaWYgKCF0aGlzLnJlY29yZGluZykge1xuICAgIC8vIFdlIHNwZWFrIGJ1dCB3ZSBhcmUgbm90IHJlY29yZGluZ1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIFNpbmdsZSBjaGFubmVsXG4gIHZhciBjaGFuID0gZGF0YS5pbnB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKTsgIFxuICBcbiAgLy9yZXNhbXBsZXIodGhpcy5hdWRpb0NvbnRleHQuc2FtcGxlUmF0ZSxkYXRhLmlucHV0QnVmZmVyLHRoaXMub25BdWRpbyk7XG5cbiAgdGhpcy5vbkF1ZGlvKHRoaXMuX2V4cG9ydERhdGFCdWZmZXJUbzE2S2h6KG5ldyBGbG9hdDMyQXJyYXkoY2hhbikpKTtcblxuICAvL2V4cG9ydCB3aXRoIG1pY3JvcGhvbmUgbWh6LCByZW1lbWJlciB0byB1cGRhdGUgdGhlIHRoaXMuc2FtcGxlUmF0ZVxuICAvLyB3aXRoIHRoZSBzYW1wbGUgcmF0ZSBmcm9tIHlvdXIgbWljcm9waG9uZVxuICAvLyB0aGlzLm9uQXVkaW8odGhpcy5fZXhwb3J0RGF0YUJ1ZmZlcihuZXcgRmxvYXQzMkFycmF5KGNoYW4pKSk7XG5cbn07XG5cbi8qKlxuICogU3RhcnQgdGhlIGF1ZGlvIHJlY29yZGluZ1xuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5yZWNvcmQgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCFuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKXtcbiAgICB0aGlzLm9uRXJyb3IoJ0Jyb3dzZXIgZG9lc25cXCd0IHN1cHBvcnQgbWljcm9waG9uZSBpbnB1dCcpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAodGhpcy5yZXF1ZXN0ZWRBY2Nlc3MpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IHRydWU7XG4gIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEoeyBhdWRpbzogdHJ1ZSB9LFxuICAgIHRoaXMub25NZWRpYVN0cmVhbS5iaW5kKHRoaXMpLCAvLyBNaWNyb3Bob25lIHBlcm1pc3Npb24gZ3JhbnRlZFxuICAgIHRoaXMub25QZXJtaXNzaW9uUmVqZWN0ZWQuYmluZCh0aGlzKSk7IC8vIE1pY3JvcGhvbmUgcGVybWlzc2lvbiByZWplY3RlZFxufTtcblxuLyoqXG4gKiBTdG9wIHRoZSBhdWRpbyByZWNvcmRpbmdcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMucmVjb3JkaW5nKVxuICAgIHJldHVybjtcbiAgdGhpcy5yZWNvcmRpbmcgPSBmYWxzZTtcbiAgdGhpcy5zdHJlYW0uc3RvcCgpO1xuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IGZhbHNlO1xuICB0aGlzLm1pYy5kaXNjb25uZWN0KDApO1xuICB0aGlzLm1pYyA9IG51bGw7XG4gIHRoaXMub25TdG9wUmVjb3JkaW5nKCk7XG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYSBCbG9iIHR5cGU6ICdhdWRpby9sMTYnIHdpdGggdGhlIGNodW5rIGFuZCBkb3duc2FtcGxpbmcgdG8gMTYga0h6XG4gKiBjb21pbmcgZnJvbSB0aGUgbWljcm9waG9uZS5cbiAqIEV4cGxhbmF0aW9uIGZvciB0aGUgbWF0aDogVGhlIHJhdyB2YWx1ZXMgY2FwdHVyZWQgZnJvbSB0aGUgV2ViIEF1ZGlvIEFQSSBhcmVcbiAqIGluIDMyLWJpdCBGbG9hdGluZyBQb2ludCwgYmV0d2VlbiAtMSBhbmQgMSAocGVyIHRoZSBzcGVjaWZpY2F0aW9uKS5cbiAqIFRoZSB2YWx1ZXMgZm9yIDE2LWJpdCBQQ00gcmFuZ2UgYmV0d2VlbiAtMzI3NjggYW5kICszMjc2NyAoMTYtYml0IHNpZ25lZCBpbnRlZ2VyKS5cbiAqIE11bHRpcGx5IHRvIGNvbnRyb2wgdGhlIHZvbHVtZSBvZiB0aGUgb3V0cHV0LiBXZSBzdG9yZSBpbiBsaXR0bGUgZW5kaWFuLlxuICogQHBhcmFtICB7T2JqZWN0fSBidWZmZXIgTWljcm9waG9uZSBhdWRpbyBjaHVua1xuICogQHJldHVybiB7QmxvYn0gJ2F1ZGlvL2wxNicgY2h1bmtcbiAqIEBkZXByZWNhdGVkIFRoaXMgbWV0aG9kIGlzIGRlcHJhY2F0ZWRcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUuX2V4cG9ydERhdGFCdWZmZXJUbzE2S2h6ID0gZnVuY3Rpb24oYnVmZmVyTmV3U2FtcGxlcykge1xuICB2YXIgYnVmZmVyID0gbnVsbCxcbiAgICBuZXdTYW1wbGVzID0gYnVmZmVyTmV3U2FtcGxlcy5sZW5ndGgsXG4gICAgdW51c2VkU2FtcGxlcyA9IHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlcy5sZW5ndGg7ICAgXG4gICAgXG5cbiAgaWYgKHVudXNlZFNhbXBsZXMgPiAwKSB7XG4gICAgYnVmZmVyID0gbmV3IEZsb2F0MzJBcnJheSh1bnVzZWRTYW1wbGVzICsgbmV3U2FtcGxlcyk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bnVzZWRTYW1wbGVzOyArK2kpIHtcbiAgICAgIGJ1ZmZlcltpXSA9IHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlc1tpXTtcbiAgICB9XG4gICAgZm9yIChpID0gMDsgaSA8IG5ld1NhbXBsZXM7ICsraSkge1xuICAgICAgYnVmZmVyW3VudXNlZFNhbXBsZXMgKyBpXSA9IGJ1ZmZlck5ld1NhbXBsZXNbaV07XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGJ1ZmZlciA9IGJ1ZmZlck5ld1NhbXBsZXM7XG4gIH1cblxuICAvLyBkb3duc2FtcGxpbmcgdmFyaWFibGVzXG4gIHZhciBmaWx0ZXIgPSBbXG4gICAgICAtMC4wMzc5MzUsIC0wLjAwMDg5MDI0LCAwLjA0MDE3MywgMC4wMTk5ODksIDAuMDA0Nzc5MiwgLTAuMDU4Njc1LCAtMC4wNTY0ODcsXG4gICAgICAtMC4wMDQwNjUzLCAwLjE0NTI3LCAwLjI2OTI3LCAwLjMzOTEzLCAwLjI2OTI3LCAwLjE0NTI3LCAtMC4wMDQwNjUzLCAtMC4wNTY0ODcsXG4gICAgICAtMC4wNTg2NzUsIDAuMDA0Nzc5MiwgMC4wMTk5ODksIDAuMDQwMTczLCAtMC4wMDA4OTAyNCwgLTAuMDM3OTM1XG4gICAgXSxcbiAgICBzYW1wbGluZ1JhdGVSYXRpbyA9IHRoaXMuYXVkaW9Db250ZXh0LnNhbXBsZVJhdGUgLyAxNjAwMCxcbiAgICBuT3V0cHV0U2FtcGxlcyA9IE1hdGguZmxvb3IoKGJ1ZmZlci5sZW5ndGggLSBmaWx0ZXIubGVuZ3RoKSAvIChzYW1wbGluZ1JhdGVSYXRpbykpICsgMSxcbiAgICBwY21FbmNvZGVkQnVmZmVyMTZrID0gbmV3IEFycmF5QnVmZmVyKG5PdXRwdXRTYW1wbGVzICogMiksXG4gICAgZGF0YVZpZXcxNmsgPSBuZXcgRGF0YVZpZXcocGNtRW5jb2RlZEJ1ZmZlcjE2ayksXG4gICAgaW5kZXggPSAwLFxuICAgIHZvbHVtZSA9IDB4N0ZGRiwgLy9yYW5nZSBmcm9tIDAgdG8gMHg3RkZGIHRvIGNvbnRyb2wgdGhlIHZvbHVtZVxuICAgIG5PdXQgPSAwO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpICsgZmlsdGVyLmxlbmd0aCAtIDEgPCBidWZmZXIubGVuZ3RoOyBpID0gTWF0aC5yb3VuZChzYW1wbGluZ1JhdGVSYXRpbyAqIG5PdXQpKSB7XG4gICAgdmFyIHNhbXBsZSA9IDA7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBmaWx0ZXIubGVuZ3RoOyArK2opIHtcbiAgICAgIHNhbXBsZSArPSBidWZmZXJbaSArIGpdICogZmlsdGVyW2pdO1xuICAgIH1cbiAgICBzYW1wbGUgKj0gdm9sdW1lO1xuICAgIGRhdGFWaWV3MTZrLnNldEludDE2KGluZGV4LCBzYW1wbGUsIHRydWUpOyAvLyAndHJ1ZScgLT4gbWVhbnMgbGl0dGxlIGVuZGlhblxuICAgIGluZGV4ICs9IDI7XG4gICAgbk91dCsrO1xuICB9XG5cbiAgdmFyIGluZGV4U2FtcGxlQWZ0ZXJMYXN0VXNlZCA9IE1hdGgucm91bmQoc2FtcGxpbmdSYXRlUmF0aW8gKiBuT3V0KTtcbiAgdmFyIHJlbWFpbmluZyA9IGJ1ZmZlci5sZW5ndGggLSBpbmRleFNhbXBsZUFmdGVyTGFzdFVzZWQ7XG4gIGlmIChyZW1haW5pbmcgPiAwKSB7XG4gICAgdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzID0gbmV3IEZsb2F0MzJBcnJheShyZW1haW5pbmcpO1xuICAgIGZvciAoaSA9IDA7IGkgPCByZW1haW5pbmc7ICsraSkge1xuICAgICAgdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzW2ldID0gYnVmZmVyW2luZGV4U2FtcGxlQWZ0ZXJMYXN0VXNlZCArIGldO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXMgPSBuZXcgRmxvYXQzMkFycmF5KDApO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBCbG9iKFtkYXRhVmlldzE2a10sIHtcbiAgICB0eXBlOiAnYXVkaW8vbDE2J1xuICB9KTtcbiAgfTtcblxuICBcbiAgXG4vLyBuYXRpdmUgd2F5IG9mIHJlc2FtcGxpbmcgY2FwdHVyZWQgYXVkaW9cbnZhciByZXNhbXBsZXIgPSBmdW5jdGlvbihzYW1wbGVSYXRlLCBhdWRpb0J1ZmZlciwgY2FsbGJhY2tQcm9jZXNzQXVkaW8pIHtcblx0XG5cdGNvbnNvbGUubG9nKFwibGVuZ3RoOiBcIiArIGF1ZGlvQnVmZmVyLmxlbmd0aCArIFwiIFwiICsgc2FtcGxlUmF0ZSk7XG5cdHZhciBjaGFubmVscyA9IDE7IFxuXHR2YXIgdGFyZ2V0U2FtcGxlUmF0ZSA9IDE2MDAwO1xuICAgdmFyIG51bVNhbXBsZXNUYXJnZXQgPSBhdWRpb0J1ZmZlci5sZW5ndGggKiB0YXJnZXRTYW1wbGVSYXRlIC8gc2FtcGxlUmF0ZTtcblxuICAgdmFyIG9mZmxpbmVDb250ZXh0ID0gbmV3IE9mZmxpbmVBdWRpb0NvbnRleHQoY2hhbm5lbHMsIG51bVNhbXBsZXNUYXJnZXQsIHRhcmdldFNhbXBsZVJhdGUpO1xuICAgdmFyIGJ1ZmZlclNvdXJjZSA9IG9mZmxpbmVDb250ZXh0LmNyZWF0ZUJ1ZmZlclNvdXJjZSgpO1xuICAgYnVmZmVyU291cmNlLmJ1ZmZlciA9IGF1ZGlvQnVmZmVyO1xuXG5cdC8vIGNhbGxiYWNrIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIHJlc2FtcGxpbmcgZmluaXNoZXNcbiAgIG9mZmxpbmVDb250ZXh0Lm9uY29tcGxldGUgPSBmdW5jdGlvbihldmVudCkgeyAgIFx0XG4gICAgICB2YXIgc2FtcGxlc1RhcmdldCA9IGV2ZW50LnJlbmRlcmVkQnVmZmVyLmdldENoYW5uZWxEYXRhKDApOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgY29uc29sZS5sb2coJ0RvbmUgcmVzYW1wbGluZzogJyArIHNhbXBsZXNUYXJnZXQubGVuZ3RoICsgXCIgc2FtcGxlcyBwcm9kdWNlZFwiKTsgIFxuXG5cdFx0Ly8gY29udmVydCBmcm9tIFstMSwxXSByYW5nZSBvZiBmbG9hdGluZyBwb2ludCBudW1iZXJzIHRvIFstMzI3NjcsMzI3NjddIHJhbmdlIG9mIGludGVnZXJzXG5cdFx0dmFyIGluZGV4ID0gMDtcblx0XHR2YXIgdm9sdW1lID0gMHg3RkZGO1xuICBcdFx0dmFyIHBjbUVuY29kZWRCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoc2FtcGxlc1RhcmdldC5sZW5ndGgqMik7ICAgIC8vIHNob3J0IGludGVnZXIgdG8gYnl0ZVxuICBcdFx0dmFyIGRhdGFWaWV3ID0gbmV3IERhdGFWaWV3KHBjbUVuY29kZWRCdWZmZXIpO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzYW1wbGVzVGFyZ2V0Lmxlbmd0aDsgaSsrKSB7XG4gICAgXHRcdGRhdGFWaWV3LnNldEludDE2KGluZGV4LCBzYW1wbGVzVGFyZ2V0W2ldKnZvbHVtZSwgdHJ1ZSk7XG4gICAgXHRcdGluZGV4ICs9IDI7XG4gIFx0XHR9XG5cbiAgICAgIC8vIGwxNiBpcyB0aGUgTUlNRSB0eXBlIGZvciAxNi1iaXQgUENNXG4gICAgICBjYWxsYmFja1Byb2Nlc3NBdWRpbyhuZXcgQmxvYihbZGF0YVZpZXddLCB7IHR5cGU6ICdhdWRpby9sMTYnIH0pKTsgICAgICAgICBcbiAgIH07XG5cbiAgIGJ1ZmZlclNvdXJjZS5jb25uZWN0KG9mZmxpbmVDb250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgIGJ1ZmZlclNvdXJjZS5zdGFydCgwKTtcbiAgIG9mZmxpbmVDb250ZXh0LnN0YXJ0UmVuZGVyaW5nKCk7ICAgXG59O1xuIFxuICBcblxuLyoqXG4gKiBDcmVhdGVzIGEgQmxvYiB0eXBlOiAnYXVkaW8vbDE2JyB3aXRoIHRoZVxuICogY2h1bmsgY29taW5nIGZyb20gdGhlIG1pY3JvcGhvbmUuXG4gKi9cbnZhciBleHBvcnREYXRhQnVmZmVyID0gZnVuY3Rpb24oYnVmZmVyLCBidWZmZXJTaXplKSB7XG4gIHZhciBwY21FbmNvZGVkQnVmZmVyID0gbnVsbCxcbiAgICBkYXRhVmlldyA9IG51bGwsXG4gICAgaW5kZXggPSAwLFxuICAgIHZvbHVtZSA9IDB4N0ZGRjsgLy9yYW5nZSBmcm9tIDAgdG8gMHg3RkZGIHRvIGNvbnRyb2wgdGhlIHZvbHVtZVxuXG4gIHBjbUVuY29kZWRCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoYnVmZmVyU2l6ZSAqIDIpO1xuICBkYXRhVmlldyA9IG5ldyBEYXRhVmlldyhwY21FbmNvZGVkQnVmZmVyKTtcblxuICAvKiBFeHBsYW5hdGlvbiBmb3IgdGhlIG1hdGg6IFRoZSByYXcgdmFsdWVzIGNhcHR1cmVkIGZyb20gdGhlIFdlYiBBdWRpbyBBUEkgYXJlXG4gICAqIGluIDMyLWJpdCBGbG9hdGluZyBQb2ludCwgYmV0d2VlbiAtMSBhbmQgMSAocGVyIHRoZSBzcGVjaWZpY2F0aW9uKS5cbiAgICogVGhlIHZhbHVlcyBmb3IgMTYtYml0IFBDTSByYW5nZSBiZXR3ZWVuIC0zMjc2OCBhbmQgKzMyNzY3ICgxNi1iaXQgc2lnbmVkIGludGVnZXIpLlxuICAgKiBNdWx0aXBseSB0byBjb250cm9sIHRoZSB2b2x1bWUgb2YgdGhlIG91dHB1dC4gV2Ugc3RvcmUgaW4gbGl0dGxlIGVuZGlhbi5cbiAgICovXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyLmxlbmd0aDsgaSsrKSB7XG4gICAgZGF0YVZpZXcuc2V0SW50MTYoaW5kZXgsIGJ1ZmZlcltpXSAqIHZvbHVtZSwgdHJ1ZSk7XG4gICAgaW5kZXggKz0gMjtcbiAgfVxuXG4gIC8vIGwxNiBpcyB0aGUgTUlNRSB0eXBlIGZvciAxNi1iaXQgUENNXG4gIHJldHVybiBuZXcgQmxvYihbZGF0YVZpZXddLCB7IHR5cGU6ICdhdWRpby9sMTYnIH0pO1xufTtcblxuTWljcm9waG9uZS5wcm90b3R5cGUuX2V4cG9ydERhdGFCdWZmZXIgPSBmdW5jdGlvbihidWZmZXIpe1xuICB1dGlscy5leHBvcnREYXRhQnVmZmVyKGJ1ZmZlciwgdGhpcy5idWZmZXJTaXplKTtcbn07IFxuXG5cbi8vIEZ1bmN0aW9ucyB1c2VkIHRvIGNvbnRyb2wgTWljcm9waG9uZSBldmVudHMgbGlzdGVuZXJzLlxuTWljcm9waG9uZS5wcm90b3R5cGUub25TdGFydFJlY29yZGluZyA9ICBmdW5jdGlvbigpIHt9O1xuTWljcm9waG9uZS5wcm90b3R5cGUub25TdG9wUmVjb3JkaW5nID0gIGZ1bmN0aW9uKCkge307XG5NaWNyb3Bob25lLnByb3RvdHlwZS5vbkF1ZGlvID0gIGZ1bmN0aW9uKCkge307XG5cbm1vZHVsZS5leHBvcnRzID0gTWljcm9waG9uZTtcblxuIiwibW9kdWxlLmV4cG9ydHM9e1xuICAgXCJtb2RlbHNcIjogW1xuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL21vZGVscy9lbi1VU19Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiAxNjAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJlbi1VU19Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJlbi1VU1wiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJVUyBFbmdsaXNoIGJyb2FkYmFuZCBtb2RlbCAoMTZLSHopXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL21vZGVscy9lbi1VU19OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogODAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJlbi1VU19OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiZW4tVVNcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiVVMgRW5nbGlzaCBuYXJyb3diYW5kIG1vZGVsICg4S0h6KVwiXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL21vZGVscy9lcy1FU19Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiAxNjAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJlcy1FU19Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJlcy1FU1wiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJTcGFuaXNoIGJyb2FkYmFuZCBtb2RlbCAoMTZLSHopXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL21vZGVscy9lcy1FU19OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogODAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJlcy1FU19OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiZXMtRVNcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiU3BhbmlzaCBuYXJyb3diYW5kIG1vZGVsICg4S0h6KVwiXG4gICAgICB9LCBcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0ud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0L2FwaS92MS9tb2RlbHMvamEtSlBfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogMTYwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiamEtSlBfQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiamEtSlBcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiSmFwYW5lc2UgYnJvYWRiYW5kIG1vZGVsICgxNktIeilcIlxuICAgICAgfSwgXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC9hcGkvdjEvbW9kZWxzL2phLUpQX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiA4MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcImphLUpQX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJqYS1KUFwiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJKYXBhbmVzZSBuYXJyb3diYW5kIG1vZGVsICg4S0h6KVwiXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS1zLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC9hcGkvdjEvbW9kZWxzL3B0LUJSX0Jyb2FkYmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDE2MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcInB0LUJSX0Jyb2FkYmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcInB0LUJSXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIkJyYXppbGlhbiBQb3J0dWd1ZXNlIGJyb2FkYmFuZCBtb2RlbCAoMTZLSHopXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL21vZGVscy9wdC1CUl9OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogODAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJwdC1CUl9OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwicHQtQlJcIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiQnJhemlsaWFuIFBvcnR1Z3Vlc2UgbmFycm93YmFuZCBtb2RlbCAoOEtIeilcIlxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0ud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0L2FwaS92MS9tb2RlbHMvemgtQ05fQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogMTYwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiemgtQ05fQnJvYWRiYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiemgtQ05cIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiTWFuZGFyaW4gYnJvYWRiYW5kIG1vZGVsICgxNktIeilcIlxuICAgICAgfSwgICAgIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL21vZGVscy96aC1DTl9OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcInJhdGVcIjogODAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJ6aC1DTl9OYXJyb3diYW5kTW9kZWxcIiwgXG4gICAgICAgICBcImxhbmd1YWdlXCI6IFwiemgtQ05cIiwgXG4gICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiTWFuZGFyaW4gbmFycm93YmFuZCBtb2RlbCAoOEtIeilcIlxuICAgICAgfSAgICAgIFxuICAgXVxufVxuIiwiXG52YXIgZWZmZWN0cyA9IHJlcXVpcmUoJy4vdmlld3MvZWZmZWN0cycpO1xudmFyIGRpc3BsYXkgPSByZXF1aXJlKCcuL3ZpZXdzL2Rpc3BsYXltZXRhZGF0YScpO1xudmFyIGhpZGVFcnJvciA9IHJlcXVpcmUoJy4vdmlld3Mvc2hvd2Vycm9yJykuaGlkZUVycm9yO1xudmFyIGluaXRTb2NrZXQgPSByZXF1aXJlKCcuL3NvY2tldCcpLmluaXRTb2NrZXQ7XG5cbmV4cG9ydHMuaGFuZGxlRmlsZVVwbG9hZCA9IGZ1bmN0aW9uKHRva2VuLCBtb2RlbCwgZmlsZSwgY29udGVudFR5cGUsIGNhbGxiYWNrLCBvbmVuZCkge1xuXG4gICAgLy8gU2V0IGN1cnJlbnRseURpc3BsYXlpbmcgdG8gcHJldmVudCBvdGhlciBzb2NrZXRzIGZyb20gb3BlbmluZ1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgdHJ1ZSk7XG5cbiAgICAvLyAkKCcjcHJvZ3Jlc3NJbmRpY2F0b3InKS5jc3MoJ3Zpc2liaWxpdHknLCAndmlzaWJsZScpO1xuXG4gICAgJC5zdWJzY3JpYmUoJ3Byb2dyZXNzJywgZnVuY3Rpb24oZXZ0LCBkYXRhKSB7XG4gICAgICBjb25zb2xlLmxvZygncHJvZ3Jlc3M6ICcsIGRhdGEpO1xuICAgIH0pO1xuXG4gICAgY29uc29sZS5sb2coJ2NvbnRlbnRUeXBlJywgY29udGVudFR5cGUpO1xuXG4gICAgdmFyIGJhc2VTdHJpbmcgPSAnJztcbiAgICB2YXIgYmFzZUpTT04gPSAnJztcblxuICAgICQuc3Vic2NyaWJlKCdzaG93anNvbicsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHZhciAkcmVzdWx0c0pTT04gPSAkKCcjcmVzdWx0c0pTT04nKVxuICAgICAgJHJlc3VsdHNKU09OLmVtcHR5KCk7XG4gICAgICAkcmVzdWx0c0pTT04uYXBwZW5kKGJhc2VKU09OKTtcbiAgICB9KTtcblxuICAgIHZhciBvcHRpb25zID0ge307XG4gICAgb3B0aW9ucy50b2tlbiA9IHRva2VuO1xuICAgIG9wdGlvbnMubWVzc2FnZSA9IHtcbiAgICAgICdhY3Rpb24nOiAnc3RhcnQnLFxuICAgICAgJ2NvbnRlbnQtdHlwZSc6IGNvbnRlbnRUeXBlLFxuICAgICAgJ2ludGVyaW1fcmVzdWx0cyc6IHRydWUsXG4gICAgICAnY29udGludW91cyc6IHRydWUsXG4gICAgICAnd29yZF9jb25maWRlbmNlJzogdHJ1ZSxcbiAgICAgICd0aW1lc3RhbXBzJzogdHJ1ZSxcbiAgICAgICdtYXhfYWx0ZXJuYXRpdmVzJzogMyxcbiAgICAgICdpbmFjdGl2aXR5X3RpbWVvdXQnOiA2MDBcbiAgICB9O1xuICAgIG9wdGlvbnMubW9kZWwgPSBtb2RlbDtcblxuICAgIGZ1bmN0aW9uIG9uT3Blbihzb2NrZXQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdTb2NrZXQgb3BlbmVkJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25MaXN0ZW5pbmcoc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZygnU29ja2V0IGxpc3RlbmluZycpO1xuICAgICAgY2FsbGJhY2soc29ja2V0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbk1lc3NhZ2UobXNnKSB7XG4gICAgICBpZiAobXNnLnJlc3VsdHMpIHtcbiAgICAgICAgLy8gQ29udmVydCB0byBjbG9zdXJlIGFwcHJvYWNoXG4gICAgICAgIGJhc2VTdHJpbmcgPSBkaXNwbGF5LnNob3dSZXN1bHQobXNnLCBiYXNlU3RyaW5nLCBtb2RlbCk7XG4gICAgICAgIGJhc2VKU09OID0gZGlzcGxheS5zaG93SlNPTihtc2csIGJhc2VKU09OKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkVycm9yKGV2dCkge1xuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG4gICAgICBvbmVuZChldnQpO1xuICAgICAgY29uc29sZS5sb2coJ1NvY2tldCBlcnI6ICcsIGV2dC5jb2RlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkNsb3NlKGV2dCkge1xuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG4gICAgICBvbmVuZChldnQpO1xuICAgICAgY29uc29sZS5sb2coJ1NvY2tldCBjbG9zaW5nOiAnLCBldnQpO1xuICAgIH1cblxuICAgIGluaXRTb2NrZXQob3B0aW9ucywgb25PcGVuLCBvbkxpc3RlbmluZywgb25NZXNzYWdlLCBvbkVycm9yLCBvbkNsb3NlKTtcbn1cblxuIiwiXG4ndXNlIHN0cmljdCc7XG5cbnZhciBpbml0U29ja2V0ID0gcmVxdWlyZSgnLi9zb2NrZXQnKS5pbml0U29ja2V0O1xudmFyIGRpc3BsYXkgPSByZXF1aXJlKCcuL3ZpZXdzL2Rpc3BsYXltZXRhZGF0YScpO1xuXG5leHBvcnRzLmhhbmRsZU1pY3JvcGhvbmUgPSBmdW5jdGlvbih0b2tlbiwgbW9kZWwsIG1pYywgY2FsbGJhY2spIHtcblxuICBpZiAobW9kZWwuaW5kZXhPZignTmFycm93YmFuZCcpID4gLTEpIHtcbiAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdNaWNyb3Bob25lIHRyYW5zY3JpcHRpb24gY2Fubm90IGFjY29tb2RhdGUgbmFycm93YmFuZCBtb2RlbHMsIHBsZWFzZSBzZWxlY3QgYW5vdGhlcicpO1xuICAgIGNhbGxiYWNrKGVyciwgbnVsbCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgJC5wdWJsaXNoKCdjbGVhcnNjcmVlbicpO1xuXG4gIC8vIFRlc3Qgb3V0IHdlYnNvY2tldFxuICB2YXIgYmFzZVN0cmluZyA9ICcnO1xuICB2YXIgYmFzZUpTT04gPSAnJztcblxuICAkLnN1YnNjcmliZSgnc2hvd2pzb24nLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgdmFyICRyZXN1bHRzSlNPTiA9ICQoJyNyZXN1bHRzSlNPTicpXG4gICAgJHJlc3VsdHNKU09OLmVtcHR5KCk7XG4gICAgJHJlc3VsdHNKU09OLmFwcGVuZChiYXNlSlNPTik7XG4gIH0pO1xuXG4gIHZhciBvcHRpb25zID0ge307XG4gIG9wdGlvbnMudG9rZW4gPSB0b2tlbjtcbiAgb3B0aW9ucy5tZXNzYWdlID0ge1xuICAgICdhY3Rpb24nOiAnc3RhcnQnLFxuICAgICdjb250ZW50LXR5cGUnOiAnYXVkaW8vbDE2O3JhdGU9MTYwMDAnLFxuICAgICdpbnRlcmltX3Jlc3VsdHMnOiB0cnVlLFxuICAgICdjb250aW51b3VzJzogdHJ1ZSxcbiAgICAnd29yZF9jb25maWRlbmNlJzogdHJ1ZSxcbiAgICAndGltZXN0YW1wcyc6IHRydWUsXG4gICAgJ21heF9hbHRlcm5hdGl2ZXMnOiAzLFxuICAgICdpbmFjdGl2aXR5X3RpbWVvdXQnOiA2MDAgICAgXG4gIH07XG4gIG9wdGlvbnMubW9kZWwgPSBtb2RlbDtcblxuICBmdW5jdGlvbiBvbk9wZW4oc29ja2V0KSB7XG4gICAgY29uc29sZS5sb2coJ01pYyBzb2NrZXQ6IG9wZW5lZCcpO1xuICAgIGNhbGxiYWNrKG51bGwsIHNvY2tldCk7XG4gIH1cblxuICBmdW5jdGlvbiBvbkxpc3RlbmluZyhzb2NrZXQpIHtcblxuICAgIG1pYy5vbkF1ZGlvID0gZnVuY3Rpb24oYmxvYikge1xuICAgICAgaWYgKHNvY2tldC5yZWFkeVN0YXRlIDwgMikge1xuICAgICAgICBzb2NrZXQuc2VuZChibG9iKVxuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBvbk1lc3NhZ2UobXNnLCBzb2NrZXQpIHtcbiAgICBjb25zb2xlLmxvZygnTWljIHNvY2tldCBtc2c6ICcsIG1zZyk7XG4gICAgaWYgKG1zZy5yZXN1bHRzKSB7XG4gICAgICAvLyBDb252ZXJ0IHRvIGNsb3N1cmUgYXBwcm9hY2hcbiAgICAgIGJhc2VTdHJpbmcgPSBkaXNwbGF5LnNob3dSZXN1bHQobXNnLCBiYXNlU3RyaW5nLCBtb2RlbCk7XG4gICAgICBiYXNlSlNPTiA9IGRpc3BsYXkuc2hvd0pTT04obXNnLCBiYXNlSlNPTik7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb25FcnJvcihyLCBzb2NrZXQpIHtcbiAgICBjb25zb2xlLmxvZygnTWljIHNvY2tldCBlcnI6ICcsIGVycik7XG4gIH1cblxuICBmdW5jdGlvbiBvbkNsb3NlKGV2dCkge1xuICAgIGNvbnNvbGUubG9nKCdNaWMgc29ja2V0IGNsb3NlOiAnLCBldnQpO1xuICB9XG5cbiAgaW5pdFNvY2tldChvcHRpb25zLCBvbk9wZW4sIG9uTGlzdGVuaW5nLCBvbk1lc3NhZ2UsIG9uRXJyb3IsIG9uQ2xvc2UpO1xufSIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgSUJNIENvcnAuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuLypnbG9iYWwgJDpmYWxzZSAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBNaWNyb3Bob25lID0gcmVxdWlyZSgnLi9NaWNyb3Bob25lJyk7XG52YXIgbW9kZWxzID0gcmVxdWlyZSgnLi9kYXRhL21vZGVscy5qc29uJykubW9kZWxzO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xudXRpbHMuaW5pdFB1YlN1YigpO1xudmFyIGluaXRWaWV3cyA9IHJlcXVpcmUoJy4vdmlld3MnKS5pbml0Vmlld3M7XG5cbndpbmRvdy5CVUZGRVJTSVpFID0gODE5MjtcblxuJChkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKSB7XG5cbiAgLy8gTWFrZSBjYWxsIHRvIEFQSSB0byB0cnkgYW5kIGdldCB0b2tlblxuICB1dGlscy5nZXRUb2tlbihmdW5jdGlvbih0b2tlbikge1xuXG4gICAgd2luZG93Lm9uYmVmb3JldW5sb2FkID0gZnVuY3Rpb24oZSkge1xuICAgICAgbG9jYWxTdG9yYWdlLmNsZWFyKCk7XG4gICAgfTtcblxuICAgIGlmICghdG9rZW4pIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIGF1dGhvcml6YXRpb24gdG9rZW4gYXZhaWxhYmxlJyk7XG4gICAgICBjb25zb2xlLmVycm9yKCdBdHRlbXB0aW5nIHRvIHJlY29ubmVjdC4uLicpO1xuICAgIH1cblxuICAgIHZhciB2aWV3Q29udGV4dCA9IHtcbiAgICAgIGN1cnJlbnRNb2RlbDogJ2VuLVVTX0Jyb2FkYmFuZE1vZGVsJyxcbiAgICAgIG1vZGVsczogbW9kZWxzLFxuICAgICAgdG9rZW46IHRva2VuLFxuICAgICAgYnVmZmVyU2l6ZTogQlVGRkVSU0laRVxuICAgIH07XG5cbiAgICBpbml0Vmlld3Modmlld0NvbnRleHQpO1xuXG4gICAgLy8gU2F2ZSBtb2RlbHMgdG8gbG9jYWxzdG9yYWdlXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21vZGVscycsIEpTT04uc3RyaW5naWZ5KG1vZGVscykpO1xuXG4gICAgLy8gU2V0IGRlZmF1bHQgY3VycmVudCBtb2RlbFxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50TW9kZWwnLCAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnc2Vzc2lvblBlcm1pc3Npb25zJywgJ3RydWUnKTtcblxuXG4gICAgJC5zdWJzY3JpYmUoJ2NsZWFyc2NyZWVuJywgZnVuY3Rpb24oKSB7XG4gICAgICAkKCcjcmVzdWx0c1RleHQnKS50ZXh0KCcnKTtcbiAgICAgICQoJyNyZXN1bHRzSlNPTicpLnRleHQoJycpO1xuICAgICAgJCgnLmVycm9yLXJvdycpLmhpZGUoKTtcbiAgICAgICQoJy5ub3RpZmljYXRpb24tcm93JykuaGlkZSgpO1xuICAgICAgJCgnLmh5cG90aGVzZXMgPiB1bCcpLmVtcHR5KCk7XG4gICAgICAkKCcjbWV0YWRhdGFUYWJsZUJvZHknKS5lbXB0eSgpO1xuICAgIH0pO1xuXG4gIH0pO1xuXG59KTtcbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgSUJNIENvcnAuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuLypnbG9iYWwgJDpmYWxzZSAqL1xuXG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnZhciBNaWNyb3Bob25lID0gcmVxdWlyZSgnLi9NaWNyb3Bob25lJyk7XG52YXIgc2hvd2Vycm9yID0gcmVxdWlyZSgnLi92aWV3cy9zaG93ZXJyb3InKTtcbnZhciBzaG93RXJyb3IgPSBzaG93ZXJyb3Iuc2hvd0Vycm9yO1xudmFyIGhpZGVFcnJvciA9IHNob3dlcnJvci5oaWRlRXJyb3I7XG5cbi8vIE1pbmkgV1MgY2FsbGJhY2sgQVBJLCBzbyB3ZSBjYW4gaW5pdGlhbGl6ZVxuLy8gd2l0aCBtb2RlbCBhbmQgdG9rZW4gaW4gVVJJLCBwbHVzXG4vLyBzdGFydCBtZXNzYWdlXG5cbi8vIEluaXRpYWxpemUgY2xvc3VyZSwgd2hpY2ggaG9sZHMgbWF4aW11bSBnZXRUb2tlbiBjYWxsIGNvdW50XG52YXIgdG9rZW5HZW5lcmF0b3IgPSB1dGlscy5jcmVhdGVUb2tlbkdlbmVyYXRvcigpO1xuXG52YXIgaW5pdFNvY2tldCA9IGV4cG9ydHMuaW5pdFNvY2tldCA9IGZ1bmN0aW9uKG9wdGlvbnMsIG9ub3Blbiwgb25saXN0ZW5pbmcsIG9ubWVzc2FnZSwgb25lcnJvciwgb25jbG9zZSkge1xuICB2YXIgbGlzdGVuaW5nO1xuICBmdW5jdGlvbiB3aXRoRGVmYXVsdCh2YWwsIGRlZmF1bHRWYWwpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ3VuZGVmaW5lZCcgPyBkZWZhdWx0VmFsIDogdmFsO1xuICB9XG4gIHZhciBzb2NrZXQ7XG4gIHZhciB0b2tlbiA9IG9wdGlvbnMudG9rZW47XG4gIHZhciBtb2RlbCA9IG9wdGlvbnMubW9kZWwgfHwgbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRNb2RlbCcpO1xuICB2YXIgbWVzc2FnZSA9IG9wdGlvbnMubWVzc2FnZSB8fCB7J2FjdGlvbic6ICdzdGFydCd9O1xuICB2YXIgc2Vzc2lvblBlcm1pc3Npb25zID0gd2l0aERlZmF1bHQob3B0aW9ucy5zZXNzaW9uUGVybWlzc2lvbnMsIEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3Nlc3Npb25QZXJtaXNzaW9ucycpKSk7XG4gIHZhciBzZXNzaW9uUGVybWlzc2lvbnNRdWVyeVBhcmFtID0gc2Vzc2lvblBlcm1pc3Npb25zID8gJzAnIDogJzEnO1xuICB2YXIgdXJsID0gb3B0aW9ucy5zZXJ2aWNlVVJJIHx8ICd3c3M6Ly9zdHJlYW0tcy53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL3JlY29nbml6ZT93YXRzb24tdG9rZW49J1xuICAgICsgdG9rZW5cbiAgICArICcmWC1XREMtUEwtT1BULU9VVD0nICsgc2Vzc2lvblBlcm1pc3Npb25zUXVlcnlQYXJhbVxuICAgICsgJyZtb2RlbD0nICsgbW9kZWw7XG4gIGNvbnNvbGUubG9nKCdVUkwgbW9kZWwnLCBtb2RlbCk7XG4gIHRyeSB7XG4gICAgc29ja2V0ID0gbmV3IFdlYlNvY2tldCh1cmwpO1xuICB9IGNhdGNoKGVycikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1dTIGNvbm5lY3Rpb24gZXJyb3I6ICcsIGVycik7XG4gIH1cbiAgc29ja2V0Lm9ub3BlbiA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIGxpc3RlbmluZyA9IGZhbHNlO1xuICAgICQuc3Vic2NyaWJlKCdoYXJkc29ja2V0c3RvcCcsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdNSUNST1BIT05FOiBjbG9zZS4nKTtcbiAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHthY3Rpb246J3N0b3AnfSkpO1xuICAgIH0pO1xuICAgICQuc3Vic2NyaWJlKCdzb2NrZXRzdG9wJywgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgY29uc29sZS5sb2coJ01JQ1JPUEhPTkU6IGNsb3NlLicpO1xuICAgICAgc29ja2V0LmNsb3NlKCk7XG4gICAgfSk7XG4gICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkpO1xuICAgIG9ub3Blbihzb2NrZXQpO1xuICB9O1xuICBzb2NrZXQub25tZXNzYWdlID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIG1zZyA9IEpTT04ucGFyc2UoZXZ0LmRhdGEpO1xuICAgIGlmIChtc2cuZXJyb3IpIHtcbiAgICAgIHNob3dFcnJvcihtc2cuZXJyb3IpO1xuICAgICAgJC5wdWJsaXNoKCdoYXJkc29ja2V0c3RvcCcpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAobXNnLnN0YXRlID09PSAnbGlzdGVuaW5nJykge1xuICAgICAgLy8gRWFybHkgY3V0IG9mZiwgd2l0aG91dCBub3RpZmljYXRpb25cbiAgICAgIGlmICghbGlzdGVuaW5nKSB7XG4gICAgICAgIG9ubGlzdGVuaW5nKHNvY2tldCk7XG4gICAgICAgIGxpc3RlbmluZyA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZygnTUlDUk9QSE9ORTogQ2xvc2luZyBzb2NrZXQuJyk7XG4gICAgICAgIHNvY2tldC5jbG9zZSgpO1xuICAgICAgfVxuICAgIH1cbiAgICBvbm1lc3NhZ2UobXNnLCBzb2NrZXQpO1xuICB9O1xuXG4gIHNvY2tldC5vbmVycm9yID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgY29uc29sZS5sb2coJ1dTIG9uZXJyb3I6ICcsIGV2dCk7XG4gICAgc2hvd0Vycm9yKCdBcHBsaWNhdGlvbiBlcnJvciAnICsgZXZ0LmNvZGUgKyAnOiBwbGVhc2UgcmVmcmVzaCB5b3VyIGJyb3dzZXIgYW5kIHRyeSBhZ2FpbicpO1xuICAgICQucHVibGlzaCgnY2xlYXJzY3JlZW4nKTtcbiAgICBvbmVycm9yKGV2dCk7XG4gIH07XG5cbiAgc29ja2V0Lm9uY2xvc2UgPSBmdW5jdGlvbihldnQpIHtcbiAgICBjb25zb2xlLmxvZygnV1Mgb25jbG9zZTogJywgZXZ0KTtcbiAgICBpZiAoZXZ0LmNvZGUgPT09IDEwMDYpIHtcbiAgICAgIC8vIEF1dGhlbnRpY2F0aW9uIGVycm9yLCB0cnkgdG8gcmVjb25uZWN0XG4gICAgICBjb25zb2xlLmxvZygnZ2VuZXJhdG9yIGNvdW50JywgdG9rZW5HZW5lcmF0b3IuZ2V0Q291bnQoKSk7XG4gICAgICBpZiAodG9rZW5HZW5lcmF0b3IuZ2V0Q291bnQoKSA+IDEpIHtcbiAgICAgICAgJC5wdWJsaXNoKCdoYXJkc29ja2V0c3RvcCcpO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyBhdXRob3JpemF0aW9uIHRva2VuIGlzIGN1cnJlbnRseSBhdmFpbGFibGVcIik7XG4gICAgICB9XG4gICAgICB0b2tlbkdlbmVyYXRvci5nZXRUb2tlbihmdW5jdGlvbih0b2tlbiwgZXJyKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAkLnB1Ymxpc2goJ2hhcmRzb2NrZXRzdG9wJyk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnNvbGUubG9nKCdGZXRjaGluZyBhZGRpdGlvbmFsIHRva2VuLi4uJyk7XG4gICAgICAgIG9wdGlvbnMudG9rZW4gPSB0b2tlbjtcbiAgICAgICAgaW5pdFNvY2tldChvcHRpb25zLCBvbm9wZW4sIG9ubGlzdGVuaW5nLCBvbm1lc3NhZ2UsIG9uZXJyb3IsIG9uY2xvc2UpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmIChldnQuY29kZSA9PT0gMTAxMSkge1xuICAgICAgY29uc29sZS5lcnJvcignU2VydmVyIGVycm9yICcgKyBldnQuY29kZSArICc6IHBsZWFzZSByZWZyZXNoIHlvdXIgYnJvd3NlciBhbmQgdHJ5IGFnYWluJyk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmIChldnQuY29kZSA+IDEwMDApIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1NlcnZlciBlcnJvciAnICsgZXZ0LmNvZGUgKyAnOiBwbGVhc2UgcmVmcmVzaCB5b3VyIGJyb3dzZXIgYW5kIHRyeSBhZ2FpbicpO1xuICAgICAgLy8gc2hvd0Vycm9yKCdTZXJ2ZXIgZXJyb3IgJyArIGV2dC5jb2RlICsgJzogcGxlYXNlIHJlZnJlc2ggeW91ciBicm93c2VyIGFuZCB0cnkgYWdhaW4nKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gTWFkZSBpdCB0aHJvdWdoLCBub3JtYWwgY2xvc2VcbiAgICAkLnVuc3Vic2NyaWJlKCdoYXJkc29ja2V0c3RvcCcpO1xuICAgICQudW5zdWJzY3JpYmUoJ3NvY2tldHN0b3AnKTtcbiAgICBvbmNsb3NlKGV2dCk7XG4gIH07XG5cbn0iLCJcbi8vIEZvciBub24tdmlldyBsb2dpY1xudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snalF1ZXJ5J10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydqUXVlcnknXSA6IG51bGwpO1xuXG52YXIgZmlsZUJsb2NrID0gZnVuY3Rpb24oX29mZnNldCwgbGVuZ3RoLCBfZmlsZSwgcmVhZENodW5rKSB7XG4gIHZhciByID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgdmFyIGJsb2IgPSBfZmlsZS5zbGljZShfb2Zmc2V0LCBsZW5ndGggKyBfb2Zmc2V0KTtcbiAgci5vbmxvYWQgPSByZWFkQ2h1bms7XG4gIHIucmVhZEFzQXJyYXlCdWZmZXIoYmxvYik7XG59XG5cbi8vIEJhc2VkIG9uIGFsZWRpYWZlcmlhJ3MgU08gcmVzcG9uc2Vcbi8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTQ0MzgxODcvamF2YXNjcmlwdC1maWxlcmVhZGVyLXBhcnNpbmctbG9uZy1maWxlLWluLWNodW5rc1xuZXhwb3J0cy5vbkZpbGVQcm9ncmVzcyA9IGZ1bmN0aW9uKG9wdGlvbnMsIG9uZGF0YSwgb25lcnJvciwgb25lbmQsIHNhbXBsaW5nUmF0ZSkge1xuICB2YXIgZmlsZSAgICAgICA9IG9wdGlvbnMuZmlsZTtcbiAgdmFyIGZpbGVTaXplICAgPSBmaWxlLnNpemU7XG4gIHZhciBjaHVua1NpemUgID0gb3B0aW9ucy5idWZmZXJTaXplIHx8IDE2MDAwOyAgLy8gaW4gYnl0ZXNcbiAgdmFyIG9mZnNldCAgICAgPSAwO1xuICB2YXIgcmVhZENodW5rID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgaWYgKG9mZnNldCA+PSBmaWxlU2l6ZSkge1xuICAgICAgY29uc29sZS5sb2coXCJEb25lIHJlYWRpbmcgZmlsZVwiKTtcbiAgICAgIG9uZW5kKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChldnQudGFyZ2V0LmVycm9yID09IG51bGwpIHtcbiAgICAgIHZhciBidWZmZXIgPSBldnQudGFyZ2V0LnJlc3VsdDtcbiAgICAgIHZhciBsZW4gPSBidWZmZXIuYnl0ZUxlbmd0aDtcbiAgICAgIG9mZnNldCArPSBsZW47XG4gICAgICBjb25zb2xlLmxvZyhcInNlbmRpbmc6IFwiICsgbGVuKVxuICAgICAgb25kYXRhKGJ1ZmZlcik7IC8vIGNhbGxiYWNrIGZvciBoYW5kbGluZyByZWFkIGNodW5rXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBlcnJvck1lc3NhZ2UgPSBldnQudGFyZ2V0LmVycm9yO1xuICAgICAgY29uc29sZS5sb2coXCJSZWFkIGVycm9yOiBcIiArIGVycm9yTWVzc2FnZSk7XG4gICAgICBvbmVycm9yKGVycm9yTWVzc2FnZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIHVzZSB0aGlzIHRpbWVvdXQgdG8gcGFjZSB0aGUgZGF0YSB1cGxvYWQgZm9yIHRoZSBwbGF5U2FtcGxlIGNhc2UsIHRoZSBpZGVhIGlzIHRoYXQgdGhlIGh5cHMgZG8gbm90IGFycml2ZSBiZWZvcmUgdGhlIGF1ZGlvIGlzIHBsYXllZCBiYWNrXG4gICAgaWYgKHNhbXBsaW5nUmF0ZSkge1xuICAgIFx0Y29uc29sZS5sb2coXCJzYW1wbGluZ1JhdGU6IFwiICsgIHNhbXBsaW5nUmF0ZSArIFwiIHRpbWVvdXQ6IFwiICsgKGNodW5rU2l6ZSoxMDAwKS8oc2FtcGxpbmdSYXRlKjIpKVxuICAgIFx0c2V0VGltZW91dChmdW5jdGlvbigpIHsgZmlsZUJsb2NrKG9mZnNldCwgY2h1bmtTaXplLCBmaWxlLCByZWFkQ2h1bmspOyB9LCAoY2h1bmtTaXplKjEwMDApLyhzYW1wbGluZ1JhdGUqMikpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmaWxlQmxvY2sob2Zmc2V0LCBjaHVua1NpemUsIGZpbGUsIHJlYWRDaHVuayk7XG4gICAgfVxuICB9XG4gIGZpbGVCbG9jayhvZmZzZXQsIGNodW5rU2l6ZSwgZmlsZSwgcmVhZENodW5rKTtcbn1cblxuZXhwb3J0cy5jcmVhdGVUb2tlbkdlbmVyYXRvciA9IGZ1bmN0aW9uKCkge1xuICAvLyBNYWtlIGNhbGwgdG8gQVBJIHRvIHRyeSBhbmQgZ2V0IHRva2VuXG4gIHZhciBoYXNCZWVuUnVuVGltZXMgPSAwO1xuICByZXR1cm4ge1xuICAgIGdldFRva2VuOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICsraGFzQmVlblJ1blRpbWVzO1xuICAgIGlmIChoYXNCZWVuUnVuVGltZXMgPiA1KSB7XG4gICAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdDYW5ub3QgcmVhY2ggc2VydmVyJyk7XG4gICAgICBjYWxsYmFjayhudWxsLCBlcnIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdXJsID0gJy90b2tlbic7XG4gICAgdmFyIHRva2VuUmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHRva2VuUmVxdWVzdC5vcGVuKFwiR0VUXCIsIHVybCwgdHJ1ZSk7XG4gICAgdG9rZW5SZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKGV2dCkge1xuICAgICAgdmFyIHRva2VuID0gdG9rZW5SZXF1ZXN0LnJlc3BvbnNlVGV4dDtcbiAgICAgIGNhbGxiYWNrKHRva2VuKTtcbiAgICB9O1xuICAgIHRva2VuUmVxdWVzdC5zZW5kKCk7XG4gICAgfSxcbiAgICBnZXRDb3VudDogZnVuY3Rpb24oKSB7IHJldHVybiBoYXNCZWVuUnVuVGltZXM7IH1cbiAgfVxufTtcblxuZXhwb3J0cy5nZXRUb2tlbiA9IChmdW5jdGlvbigpIHtcbiAgLy8gTWFrZSBjYWxsIHRvIEFQSSB0byB0cnkgYW5kIGdldCB0b2tlblxuICB2YXIgaGFzQmVlblJ1blRpbWVzID0gMDtcbiAgcmV0dXJuIGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgaGFzQmVlblJ1blRpbWVzKytcbiAgICBpZiAoaGFzQmVlblJ1blRpbWVzID4gNSkge1xuICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignQ2Fubm90IHJlYWNoIHNlcnZlcicpO1xuICAgICAgY2FsbGJhY2sobnVsbCwgZXJyKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHVybCA9ICcvdG9rZW4nO1xuICAgIHZhciB0b2tlblJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB0b2tlblJlcXVlc3Qub3BlbihcIkdFVFwiLCB1cmwsIHRydWUpO1xuICAgIHRva2VuUmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbihldnQpIHtcbiAgICAgIHZhciB0b2tlbiA9IHRva2VuUmVxdWVzdC5yZXNwb25zZVRleHQ7XG4gICAgICBjYWxsYmFjayh0b2tlbik7XG4gICAgfTtcbiAgICB0b2tlblJlcXVlc3Quc2VuZCgpO1xuICB9XG59KSgpO1xuXG5leHBvcnRzLmluaXRQdWJTdWIgPSBmdW5jdGlvbigpIHtcbiAgdmFyIG8gICAgICAgICA9ICQoe30pO1xuICAkLnN1YnNjcmliZSAgID0gby5vbi5iaW5kKG8pO1xuICAkLnVuc3Vic2NyaWJlID0gby5vZmYuYmluZChvKTtcbiAgJC5wdWJsaXNoICAgICA9IG8udHJpZ2dlci5iaW5kKG8pO1xufSIsIlxuXG5leHBvcnRzLmluaXRBbmltYXRlUGFuZWwgPSBmdW5jdGlvbigpIHtcbiAgJCgnLnBhbmVsLWhlYWRpbmcgc3Bhbi5jbGlja2FibGUnKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uIChlKSB7XG4gICAgaWYgKCQodGhpcykuaGFzQ2xhc3MoJ3BhbmVsLWNvbGxhcHNlZCcpKSB7XG4gICAgICAvLyBleHBhbmQgdGhlIHBhbmVsXG4gICAgICAkKHRoaXMpLnBhcmVudHMoJy5wYW5lbCcpLmZpbmQoJy5wYW5lbC1ib2R5Jykuc2xpZGVEb3duKCk7XG4gICAgICAkKHRoaXMpLnJlbW92ZUNsYXNzKCdwYW5lbC1jb2xsYXBzZWQnKTtcbiAgICAgICQodGhpcykuZmluZCgnaScpLnJlbW92ZUNsYXNzKCdjYXJldC1kb3duJykuYWRkQ2xhc3MoJ2NhcmV0LXVwJyk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgLy8gY29sbGFwc2UgdGhlIHBhbmVsXG4gICAgICAkKHRoaXMpLnBhcmVudHMoJy5wYW5lbCcpLmZpbmQoJy5wYW5lbC1ib2R5Jykuc2xpZGVVcCgpO1xuICAgICAgJCh0aGlzKS5hZGRDbGFzcygncGFuZWwtY29sbGFwc2VkJyk7XG4gICAgICAkKHRoaXMpLmZpbmQoJ2knKS5yZW1vdmVDbGFzcygnY2FyZXQtdXAnKS5hZGRDbGFzcygnY2FyZXQtZG93bicpO1xuICAgIH1cbiAgfSk7XG59XG5cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snalF1ZXJ5J10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydqUXVlcnknXSA6IG51bGwpO1xudmFyIHNjcm9sbGVkID0gZmFsc2UsXG4gICAgdGV4dFNjcm9sbGVkID0gZmFsc2U7XG5cbnZhciBzaG93VGltZXN0YW1wID0gZnVuY3Rpb24odGltZXN0YW1wcywgY29uZmlkZW5jZXMpIHtcbiAgdmFyIHdvcmQgPSB0aW1lc3RhbXBzWzBdLFxuICAgICAgdDAgPSB0aW1lc3RhbXBzWzFdLFxuICAgICAgdDEgPSB0aW1lc3RhbXBzWzJdO1xuICB2YXIgdGltZWxlbmd0aCA9IHQxIC0gdDA7XG4gIC8vIFNob3cgY29uZmlkZW5jZSBpZiBkZWZpbmVkLCBlbHNlICduL2EnXG4gIHZhciBkaXNwbGF5Q29uZmlkZW5jZSA9IGNvbmZpZGVuY2VzID8gY29uZmlkZW5jZXNbMV0udG9TdHJpbmcoKS5zdWJzdHJpbmcoMCwgMykgOiAnbi9hJztcbiAgJCgnI21ldGFkYXRhVGFibGUgPiB0Ym9keTpsYXN0LWNoaWxkJykuYXBwZW5kKFxuICAgICAgJzx0cj4nXG4gICAgICArICc8dGQ+JyArIHdvcmQgKyAnPC90ZD4nXG4gICAgICArICc8dGQ+JyArIHQwICsgJzwvdGQ+J1xuICAgICAgKyAnPHRkPicgKyB0MSArICc8L3RkPidcbiAgICAgICsgJzx0ZD4nICsgZGlzcGxheUNvbmZpZGVuY2UgKyAnPC90ZD4nXG4gICAgICArICc8L3RyPidcbiAgICAgICk7XG59XG5cblxudmFyIHNob3dNZXRhRGF0YSA9IGZ1bmN0aW9uKGFsdGVybmF0aXZlKSB7XG4gIHZhciBjb25maWRlbmNlTmVzdGVkQXJyYXkgPSBhbHRlcm5hdGl2ZS53b3JkX2NvbmZpZGVuY2U7O1xuICB2YXIgdGltZXN0YW1wTmVzdGVkQXJyYXkgPSBhbHRlcm5hdGl2ZS50aW1lc3RhbXBzO1xuICBpZiAoY29uZmlkZW5jZU5lc3RlZEFycmF5ICYmIGNvbmZpZGVuY2VOZXN0ZWRBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb25maWRlbmNlTmVzdGVkQXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciB0aW1lc3RhbXBzID0gdGltZXN0YW1wTmVzdGVkQXJyYXlbaV07XG4gICAgICB2YXIgY29uZmlkZW5jZXMgPSBjb25maWRlbmNlTmVzdGVkQXJyYXlbaV07XG4gICAgICBzaG93VGltZXN0YW1wKHRpbWVzdGFtcHMsIGNvbmZpZGVuY2VzKTtcbiAgICB9XG4gICAgcmV0dXJuO1xuICB9IGVsc2Uge1xuICAgIGlmICh0aW1lc3RhbXBOZXN0ZWRBcnJheSAmJiB0aW1lc3RhbXBOZXN0ZWRBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICB0aW1lc3RhbXBOZXN0ZWRBcnJheS5mb3JFYWNoKGZ1bmN0aW9uKHRpbWVzdGFtcCkge1xuICAgICAgICBzaG93VGltZXN0YW1wKHRpbWVzdGFtcCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cblxudmFyIEFsdGVybmF0aXZlcyA9IGZ1bmN0aW9uKCl7XG5cbiAgdmFyIHN0cmluZ09uZSA9ICcnLFxuICAgIHN0cmluZ1R3byA9ICcnLFxuICAgIHN0cmluZ1RocmVlID0gJyc7XG5cbiAgdGhpcy5jbGVhclN0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHN0cmluZ09uZSA9ICcnO1xuICAgIHN0cmluZ1R3byA9ICcnO1xuICAgIHN0cmluZ1RocmVlID0gJyc7XG4gIH07XG5cbiAgdGhpcy5zaG93QWx0ZXJuYXRpdmVzID0gZnVuY3Rpb24oYWx0ZXJuYXRpdmVzLCBpc0ZpbmFsLCB0ZXN0aW5nKSB7XG4gICAgdmFyICRoeXBvdGhlc2VzID0gJCgnLmh5cG90aGVzZXMgb2wnKTtcbiAgICAkaHlwb3RoZXNlcy5lbXB0eSgpO1xuICAgIC8vICRoeXBvdGhlc2VzLmFwcGVuZCgkKCc8L2JyPicpKTtcbiAgICBhbHRlcm5hdGl2ZXMuZm9yRWFjaChmdW5jdGlvbihhbHRlcm5hdGl2ZSwgaWR4KSB7XG4gICAgICB2YXIgJGFsdGVybmF0aXZlO1xuICAgICAgaWYgKGFsdGVybmF0aXZlLnRyYW5zY3JpcHQpIHtcbiAgICAgICAgdmFyIHRyYW5zY3JpcHQgPSBhbHRlcm5hdGl2ZS50cmFuc2NyaXB0LnJlcGxhY2UoLyVIRVNJVEFUSU9OXFxzL2csICcnKTtcbiAgICAgICAgdHJhbnNjcmlwdCA9IHRyYW5zY3JpcHQucmVwbGFjZSgvKC4pXFwxezIsfS9nLCAnJyk7XG4gICAgICAgIHN3aXRjaCAoaWR4KSB7XG4gICAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgc3RyaW5nT25lID0gc3RyaW5nT25lICsgdHJhbnNjcmlwdDtcbiAgICAgICAgICAgICRhbHRlcm5hdGl2ZSA9ICQoJzxsaSBkYXRhLWh5cG90aGVzaXMtaW5kZXg9JyArIGlkeCArICcgPicgKyBzdHJpbmdPbmUgKyAnPC9saT4nKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgIHN0cmluZ1R3byA9IHN0cmluZ1R3byArIHRyYW5zY3JpcHQ7XG4gICAgICAgICAgICAkYWx0ZXJuYXRpdmUgPSAkKCc8bGkgZGF0YS1oeXBvdGhlc2lzLWluZGV4PScgKyBpZHggKyAnID4nICsgc3RyaW5nVHdvICsgJzwvbGk+Jyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICBzdHJpbmdUaHJlZSA9IHN0cmluZ1RocmVlICsgdHJhbnNjcmlwdDtcbiAgICAgICAgICAgICRhbHRlcm5hdGl2ZSA9ICQoJzxsaSBkYXRhLWh5cG90aGVzaXMtaW5kZXg9JyArIGlkeCArICcgPicgKyBzdHJpbmdUaHJlZSArICc8L2xpPicpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgJGh5cG90aGVzZXMuYXBwZW5kKCRhbHRlcm5hdGl2ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH07XG59XG5cbnZhciBhbHRlcm5hdGl2ZVByb3RvdHlwZSA9IG5ldyBBbHRlcm5hdGl2ZXMoKTtcblxuXG4vLyBUT0RPOiBDb252ZXJ0IHRvIGNsb3N1cmUgYXBwcm9hY2hcbi8qdmFyIHByb2Nlc3NTdHJpbmcgPSBmdW5jdGlvbihiYXNlU3RyaW5nLCBpc0ZpbmlzaGVkKSB7XG5cbiAgaWYgKGlzRmluaXNoZWQpIHtcbiAgICB2YXIgZm9ybWF0dGVkU3RyaW5nID0gYmFzZVN0cmluZy5zbGljZSgwLCAtMSk7XG4gICAgZm9ybWF0dGVkU3RyaW5nID0gZm9ybWF0dGVkU3RyaW5nLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgZm9ybWF0dGVkU3RyaW5nLnN1YnN0cmluZygxKTtcbiAgICBmb3JtYXR0ZWRTdHJpbmcgPSBmb3JtYXR0ZWRTdHJpbmcudHJpbSgpICsgJy4gJztcbiAgICAkKCcjcmVzdWx0c1RleHQnKS52YWwoZm9ybWF0dGVkU3RyaW5nKTtcbiAgICByZXR1cm4gZm9ybWF0dGVkU3RyaW5nO1xuICB9IGVsc2Uge1xuICAgICQoJyNyZXN1bHRzVGV4dCcpLnZhbChiYXNlU3RyaW5nKTtcbiAgICByZXR1cm4gYmFzZVN0cmluZztcbiAgfVxufSovXG5cbmV4cG9ydHMuc2hvd0pTT04gPSBmdW5jdGlvbihtc2csIGJhc2VKU09OKSB7XG4gIFxuICAgdmFyIGpzb24gPSBKU09OLnN0cmluZ2lmeShtc2csIG51bGwsIDIpO1xuICAgIGJhc2VKU09OICs9IGpzb247XG4gICAgYmFzZUpTT04gKz0gJ1xcbic7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuXG4gIGlmICgkKCcubmF2LXRhYnMgLmFjdGl2ZScpLnRleHQoKSA9PSBcIkpTT05cIikge1xuICAgICAgJCgnI3Jlc3VsdHNKU09OJykuYXBwZW5kKGJhc2VKU09OKTtcbiAgICAgIGJhc2VKU09OID0gXCJcIjtcbiAgICAgIGNvbnNvbGUubG9nKFwidXBkYXRpbmcganNvblwiKTtcbiAgfVxuICBcbiAgcmV0dXJuIGJhc2VKU09OO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVUZXh0U2Nyb2xsKCl7XG4gIGlmKCFzY3JvbGxlZCl7XG4gICAgdmFyIGVsZW1lbnQgPSAkKCcjcmVzdWx0c1RleHQnKS5nZXQoMCk7XG4gICAgZWxlbWVudC5zY3JvbGxUb3AgPSBlbGVtZW50LnNjcm9sbEhlaWdodDtcbiAgfVxufVxuXG52YXIgaW5pdFRleHRTY3JvbGwgPSBmdW5jdGlvbigpIHtcbiAgJCgnI3Jlc3VsdHNUZXh0Jykub24oJ3Njcm9sbCcsIGZ1bmN0aW9uKCl7XG4gICAgICB0ZXh0U2Nyb2xsZWQgPSB0cnVlO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlU2Nyb2xsKCl7XG4gIGlmKCFzY3JvbGxlZCl7XG4gICAgdmFyIGVsZW1lbnQgPSAkKCcudGFibGUtc2Nyb2xsJykuZ2V0KDApO1xuICAgIGVsZW1lbnQuc2Nyb2xsVG9wID0gZWxlbWVudC5zY3JvbGxIZWlnaHQ7XG4gIH1cbn1cblxudmFyIGluaXRTY3JvbGwgPSBmdW5jdGlvbigpIHtcbiAgJCgnLnRhYmxlLXNjcm9sbCcpLm9uKCdzY3JvbGwnLCBmdW5jdGlvbigpe1xuICAgICAgc2Nyb2xsZWQ9dHJ1ZTtcbiAgfSk7XG59XG5cbmV4cG9ydHMuaW5pdERpc3BsYXlNZXRhZGF0YSA9IGZ1bmN0aW9uKCkge1xuICBpbml0U2Nyb2xsKCk7XG4gIGluaXRUZXh0U2Nyb2xsKCk7XG59O1xuXG5cbmV4cG9ydHMuc2hvd1Jlc3VsdCA9IGZ1bmN0aW9uKG1zZywgYmFzZVN0cmluZywgbW9kZWwsIGNhbGxiYWNrKSB7XG5cbiAgdmFyIGlkeCA9ICttc2cucmVzdWx0X2luZGV4O1xuXG4gIGlmIChtc2cucmVzdWx0cyAmJiBtc2cucmVzdWx0cy5sZW5ndGggPiAwKSB7XG5cbiAgICB2YXIgYWx0ZXJuYXRpdmVzID0gbXNnLnJlc3VsdHNbMF0uYWx0ZXJuYXRpdmVzO1xuICAgIHZhciB0ZXh0ID0gbXNnLnJlc3VsdHNbMF0uYWx0ZXJuYXRpdmVzWzBdLnRyYW5zY3JpcHQgfHwgJyc7XG4gICAgXG4gICAgLy8gYXBwbHkgbWFwcGluZ3MgdG8gYmVhdXRpZnlcbiAgICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC8lSEVTSVRBVElPTlxccy9nLCAnJyk7XG4gICAgdGV4dCA9IHRleHQucmVwbGFjZSgvKC4pXFwxezIsfS9nLCAnJyk7XG4gICAgXG4gICAgLy8gaWYgYWxsIHdvcmRzIGFyZSBtYXBwZWQgdG8gbm90aGluZyB0aGVuIHRoZXJlIGlzIG5vdGhpbmcgZWxzZSB0byBkb1xuICAgIGlmICh0ZXh0Lmxlbmd0aCA9PSAwKSB7XG4gICAgXHRyZXR1cm4gYmFzZVN0cmluZztcbiAgICB9ICAgIFx0ICBcbiAgICBcbiAgICAvLyBjYXBpdGFsaXplIGZpcnN0IHdvcmRcbiAgICAvLyBpZiBmaW5hbCByZXN1bHRzLCBhcHBlbmQgYSBuZXcgcGFyYWdyYXBoXG4gICAgaWYgKG1zZy5yZXN1bHRzICYmIG1zZy5yZXN1bHRzWzBdICYmIG1zZy5yZXN1bHRzWzBdLmZpbmFsKSB7XG4gICAgICAgdGV4dCA9IHRleHQuc2xpY2UoMCwgLTEpO1xuICAgICAgIHRleHQgPSB0ZXh0LmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgdGV4dC5zdWJzdHJpbmcoMSk7XG4gICAgICAgaWYgKChtb2RlbC5zdWJzdHJpbmcoMCw1KSA9PSBcImphLUpQXCIpIHx8IChtb2RlbC5zdWJzdHJpbmcoMCw1KSA9PSBcInpoLUNOXCIpKSB7ICAgICAgICBcbiAgICAgICAgICB0ZXh0ID0gdGV4dC50cmltKCkgKyAn44CCJztcbiAgICAgICAgICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC8gL2csJycpOyAgICAgIC8vIHJlbW92ZSB3aGl0ZXNwYWNlcyBcbiAgICAgICB9IGVsc2UgeyAgXG4gICAgICAgICAgdGV4dCA9IHRleHQudHJpbSgpICsgJy4gJztcbiAgICAgICB9ICAgICAgIFxuICAgICAgIGJhc2VTdHJpbmcgKz0gdGV4dDtcbiAgICAgICAkKCcjcmVzdWx0c1RleHQnKS52YWwoYmFzZVN0cmluZyk7XG4gICAgICAgc2hvd01ldGFEYXRhKGFsdGVybmF0aXZlc1swXSk7XG4gICAgICAgLy8gT25seSBzaG93IGFsdGVybmF0aXZlcyBpZiB3ZSdyZSBmaW5hbFxuICAgICAgIGFsdGVybmF0aXZlUHJvdG90eXBlLnNob3dBbHRlcm5hdGl2ZXMoYWx0ZXJuYXRpdmVzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgIGlmICgobW9kZWwuc3Vic3RyaW5nKDAsNSkgPT0gXCJqYS1KUFwiKSB8fCAobW9kZWwuc3Vic3RyaW5nKDAsNSkgPT0gXCJ6aC1DTlwiKSkgeyAgICAgICAgXG4gICAgICAgICAgdGV4dCA9IHRleHQucmVwbGFjZSgvIC9nLCcnKTsgICAgICAvLyByZW1vdmUgd2hpdGVzcGFjZXMgICAgIFx0ICAgICAgICAgXG4gICAgICAgfSBlbHNlIHtcbiAgICAgICAgXHQgdGV4dCA9IHRleHQuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyB0ZXh0LnN1YnN0cmluZygxKTtcbiAgICAgICB9XG4gICAgXHQgJCgnI3Jlc3VsdHNUZXh0JykudmFsKGJhc2VTdHJpbmcgKyB0ZXh0KTsgICAgXHQgXG4gICAgfVxuICB9XG5cbiAgdXBkYXRlU2Nyb2xsKCk7XG4gIHVwZGF0ZVRleHRTY3JvbGwoKTtcbiAgcmV0dXJuIGJhc2VTdHJpbmc7XG5cbn07XG5cbiQuc3Vic2NyaWJlKCdjbGVhcnNjcmVlbicsIGZ1bmN0aW9uKCkge1xuICB2YXIgJGh5cG90aGVzZXMgPSAkKCcuaHlwb3RoZXNlcyB1bCcpO1xuICBzY3JvbGxlZCA9IGZhbHNlO1xuICAkaHlwb3RoZXNlcy5lbXB0eSgpO1xuICBhbHRlcm5hdGl2ZVByb3RvdHlwZS5jbGVhclN0cmluZygpO1xufSk7XG5cbiIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgaGFuZGxlU2VsZWN0ZWRGaWxlID0gcmVxdWlyZSgnLi9maWxldXBsb2FkJykuaGFuZGxlU2VsZWN0ZWRGaWxlO1xuXG5leHBvcnRzLmluaXREcmFnRHJvcCA9IGZ1bmN0aW9uKGN0eCkge1xuXG4gIHZhciBkcmFnQW5kRHJvcFRhcmdldCA9ICQoZG9jdW1lbnQpO1xuXG4gIGRyYWdBbmREcm9wVGFyZ2V0Lm9uKCdkcmFnZW50ZXInLCBmdW5jdGlvbiAoZSkge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICB9KTtcblxuICBkcmFnQW5kRHJvcFRhcmdldC5vbignZHJhZ292ZXInLCBmdW5jdGlvbiAoZSkge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICB9KTtcblxuICBkcmFnQW5kRHJvcFRhcmdldC5vbignZHJvcCcsIGZ1bmN0aW9uIChlKSB7XG4gICAgY29uc29sZS5sb2coJ0ZpbGUgZHJvcHBlZCcpO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB2YXIgZXZ0ID0gZS5vcmlnaW5hbEV2ZW50O1xuICAgIC8vIEhhbmRsZSBkcmFnZ2VkIGZpbGUgZXZlbnRcbiAgICBoYW5kbGVGaWxlVXBsb2FkRXZlbnQoZXZ0KTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gaGFuZGxlRmlsZVVwbG9hZEV2ZW50KGV2dCkge1xuICAgIC8vIEluaXQgZmlsZSB1cGxvYWQgd2l0aCBkZWZhdWx0IG1vZGVsXG4gICAgdmFyIGZpbGUgPSBldnQuZGF0YVRyYW5zZmVyLmZpbGVzWzBdO1xuICAgIGhhbmRsZVNlbGVjdGVkRmlsZShjdHgudG9rZW4sIGZpbGUpO1xuICB9XG5cbn1cbiIsIlxuXG5cbmV4cG9ydHMuZmxhc2hTVkcgPSBmdW5jdGlvbihlbCkge1xuICBlbC5jc3MoeyBmaWxsOiAnI0E1MzcyNScgfSk7XG4gIGZ1bmN0aW9uIGxvb3AoKSB7XG4gICAgZWwuYW5pbWF0ZSh7IGZpbGw6ICcjQTUzNzI1JyB9LFxuICAgICAgICAxMDAwLCAnbGluZWFyJylcbiAgICAgIC5hbmltYXRlKHsgZmlsbDogJ3doaXRlJyB9LFxuICAgICAgICAgIDEwMDAsICdsaW5lYXInKTtcbiAgfVxuICAvLyByZXR1cm4gdGltZXJcbiAgdmFyIHRpbWVyID0gc2V0VGltZW91dChsb29wLCAyMDAwKTtcbiAgcmV0dXJuIHRpbWVyO1xufTtcblxuZXhwb3J0cy5zdG9wRmxhc2hTVkcgPSBmdW5jdGlvbih0aW1lcikge1xuICBlbC5jc3MoeyBmaWxsOiAnd2hpdGUnIH0gKTtcbiAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG59XG5cbmV4cG9ydHMudG9nZ2xlSW1hZ2UgPSBmdW5jdGlvbihlbCwgbmFtZSkge1xuICBpZihlbC5hdHRyKCdzcmMnKSA9PT0gJ2ltYWdlcy8nICsgbmFtZSArICcuc3ZnJykge1xuICAgIGVsLmF0dHIoXCJzcmNcIiwgJ2ltYWdlcy9zdG9wLXJlZC5zdmcnKTtcbiAgfSBlbHNlIHtcbiAgICBlbC5hdHRyKCdzcmMnLCAnaW1hZ2VzL3N0b3Auc3ZnJyk7XG4gIH1cbn1cblxudmFyIHJlc3RvcmVJbWFnZSA9IGV4cG9ydHMucmVzdG9yZUltYWdlID0gZnVuY3Rpb24oZWwsIG5hbWUpIHtcbiAgZWwuYXR0cignc3JjJywgJ2ltYWdlcy8nICsgbmFtZSArICcuc3ZnJyk7XG59XG5cbmV4cG9ydHMuc3RvcFRvZ2dsZUltYWdlID0gZnVuY3Rpb24odGltZXIsIGVsLCBuYW1lKSB7XG4gIGNsZWFySW50ZXJ2YWwodGltZXIpO1xuICByZXN0b3JlSW1hZ2UoZWwsIG5hbWUpO1xufVxuIiwiXG4ndXNlIHN0cmljdCc7XG5cbnZhciBzaG93RXJyb3IgPSByZXF1aXJlKCcuL3Nob3dlcnJvcicpLnNob3dFcnJvcjtcbnZhciBzaG93Tm90aWNlID0gcmVxdWlyZSgnLi9zaG93ZXJyb3InKS5zaG93Tm90aWNlO1xudmFyIGhhbmRsZUZpbGVVcGxvYWQgPSByZXF1aXJlKCcuLi9oYW5kbGVmaWxldXBsb2FkJykuaGFuZGxlRmlsZVVwbG9hZDtcbnZhciBlZmZlY3RzID0gcmVxdWlyZSgnLi9lZmZlY3RzJyk7XG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xuXG4vLyBOZWVkIHRvIHJlbW92ZSB0aGUgdmlldyBsb2dpYyBoZXJlIGFuZCBtb3ZlIHRoaXMgb3V0IHRvIHRoZSBoYW5kbGVmaWxldXBsb2FkIGNvbnRyb2xsZXJcbnZhciBoYW5kbGVTZWxlY3RlZEZpbGUgPSBleHBvcnRzLmhhbmRsZVNlbGVjdGVkRmlsZSA9IChmdW5jdGlvbigpIHtcblxuICAgIHZhciBydW5uaW5nID0gZmFsc2U7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24odG9rZW4sIGZpbGUpIHtcblxuICAgIHZhciBjdXJyZW50bHlEaXNwbGF5aW5nID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycpKTtcblxuICAgIC8vIGlmIChjdXJyZW50bHlEaXNwbGF5aW5nKSB7XG4gICAgLy8gICBzaG93RXJyb3IoJ0N1cnJlbnRseSBhbm90aGVyIGZpbGUgaXMgcGxheWluZywgcGxlYXNlIHN0b3AgdGhlIGZpbGUgb3Igd2FpdCB1bnRpbCBpdCBmaW5pc2hlcycpO1xuICAgIC8vICAgcmV0dXJuO1xuICAgIC8vIH1cblxuICAgICQucHVibGlzaCgnY2xlYXJzY3JlZW4nKTtcblxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgdHJ1ZSk7XG4gICAgcnVubmluZyA9IHRydWU7XG5cbiAgICAvLyBWaXN1YWwgZWZmZWN0c1xuICAgIHZhciB1cGxvYWRJbWFnZVRhZyA9ICQoJyNmaWxlVXBsb2FkVGFyZ2V0ID4gaW1nJyk7XG4gICAgdmFyIHRpbWVyID0gc2V0SW50ZXJ2YWwoZWZmZWN0cy50b2dnbGVJbWFnZSwgNzUwLCB1cGxvYWRJbWFnZVRhZywgJ3N0b3AnKTtcbiAgICB2YXIgdXBsb2FkVGV4dCA9ICQoJyNmaWxlVXBsb2FkVGFyZ2V0ID4gc3BhbicpO1xuICAgIHVwbG9hZFRleHQudGV4dCgnU3RvcCBUcmFuc2NyaWJpbmcnKTtcblxuICAgIGZ1bmN0aW9uIHJlc3RvcmVVcGxvYWRUYWIoKSB7XG4gICAgICBjbGVhckludGVydmFsKHRpbWVyKTtcbiAgICAgIGVmZmVjdHMucmVzdG9yZUltYWdlKHVwbG9hZEltYWdlVGFnLCAndXBsb2FkJyk7XG4gICAgICB1cGxvYWRUZXh0LnRleHQoJ1NlbGVjdCBGaWxlJyk7XG4gICAgfVxuXG4gICAgLy8gQ2xlYXIgZmxhc2hpbmcgaWYgc29ja2V0IHVwbG9hZCBpcyBzdG9wcGVkXG4gICAgJC5zdWJzY3JpYmUoJ2hhcmRzb2NrZXRzdG9wJywgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgcmVzdG9yZVVwbG9hZFRhYigpO1xuICAgIH0pO1xuXG5cbiAgICAvLyBHZXQgY3VycmVudCBtb2RlbFxuICAgIHZhciBjdXJyZW50TW9kZWwgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudE1vZGVsJyk7XG4gICAgY29uc29sZS5sb2coJ2N1cnJlbnRNb2RlbCcsIGN1cnJlbnRNb2RlbCk7XG5cbiAgICAvLyBSZWFkIGZpcnN0IDQgYnl0ZXMgdG8gZGV0ZXJtaW5lIGhlYWRlclxuICAgIHZhciBibG9iVG9UZXh0ID0gbmV3IEJsb2IoW2ZpbGVdKS5zbGljZSgwLCA0KTtcbiAgICB2YXIgciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgci5yZWFkQXNUZXh0KGJsb2JUb1RleHQpO1xuICAgIHIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY29udGVudFR5cGU7XG4gICAgICBpZiAoci5yZXN1bHQgPT09ICdmTGFDJykge1xuICAgICAgICBjb250ZW50VHlwZSA9ICdhdWRpby9mbGFjJztcbiAgICAgICAgc2hvd05vdGljZSgnTm90aWNlOiBicm93c2VycyBkbyBub3Qgc3VwcG9ydCBwbGF5aW5nIEZMQUMgYXVkaW8sIHNvIG5vIGF1ZGlvIHdpbGwgYWNjb21wYW55IHRoZSB0cmFuc2NyaXB0aW9uJyk7XG4gICAgICB9IGVsc2UgaWYgKHIucmVzdWx0ID09PSAnUklGRicpIHtcbiAgICAgICAgY29udGVudFR5cGUgPSAnYXVkaW8vd2F2JztcbiAgICAgICAgdmFyIGF1ZGlvID0gbmV3IEF1ZGlvKCk7XG4gICAgICAgIHZhciB3YXZCbG9iID0gbmV3IEJsb2IoW2ZpbGVdLCB7dHlwZTogJ2F1ZGlvL3dhdid9KTtcbiAgICAgICAgdmFyIHdhdlVSTCA9IFVSTC5jcmVhdGVPYmplY3RVUkwod2F2QmxvYik7XG4gICAgICAgIGF1ZGlvLnNyYyA9IHdhdlVSTDtcbiAgICAgICAgYXVkaW8ucGxheSgpO1xuICAgICAgICAkLnN1YnNjcmliZSgnaGFyZHNvY2tldHN0b3AnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBhdWRpby5wYXVzZSgpO1xuICAgICAgICAgIGF1ZGlvLmN1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN0b3JlVXBsb2FkVGFiKCk7XG4gICAgICAgIHNob3dFcnJvcignT25seSBXQVYgb3IgRkxBQyBmaWxlcyBjYW4gYmUgdHJhbnNjcmliZWQsIHBsZWFzZSB0cnkgYW5vdGhlciBmaWxlIGZvcm1hdCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBoYW5kbGVGaWxlVXBsb2FkKHRva2VuLCBjdXJyZW50TW9kZWwsIGZpbGUsIGNvbnRlbnRUeXBlLCBmdW5jdGlvbihzb2NrZXQpIHtcbiAgICAgICAgdmFyIGJsb2IgPSBuZXcgQmxvYihbZmlsZV0pO1xuICAgICAgICB2YXIgcGFyc2VPcHRpb25zID0ge1xuICAgICAgICAgIGZpbGU6IGJsb2JcbiAgICAgICAgfTtcbiAgICAgICAgdXRpbHMub25GaWxlUHJvZ3Jlc3MocGFyc2VPcHRpb25zLFxuICAgICAgICAgIC8vIE9uIGRhdGEgY2h1bmtcbiAgICAgICAgICBmdW5jdGlvbihjaHVuaykge1xuICAgICAgICAgICAgc29ja2V0LnNlbmQoY2h1bmspO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgLy8gT24gZmlsZSByZWFkIGVycm9yXG4gICAgICAgICAgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnRXJyb3IgcmVhZGluZyBmaWxlOiAnLCBldnQubWVzc2FnZSk7XG4gICAgICAgICAgICBzaG93RXJyb3IoJ0Vycm9yOiAnICsgZXZ0Lm1lc3NhZ2UpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgLy8gT24gbG9hZCBlbmRcbiAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHsnYWN0aW9uJzogJ3N0b3AnfSkpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSwgXG4gICAgICAgIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgIGVmZmVjdHMuc3RvcFRvZ2dsZUltYWdlKHRpbWVyLCB1cGxvYWRJbWFnZVRhZywgJ3VwbG9hZCcpO1xuICAgICAgICAgIHVwbG9hZFRleHQudGV4dCgnU2VsZWN0IEZpbGUnKTtcbiAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIGZhbHNlKTtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9O1xuICB9XG59KSgpO1xuXG5cbmV4cG9ydHMuaW5pdEZpbGVVcGxvYWQgPSBmdW5jdGlvbihjdHgpIHtcblxuICB2YXIgZmlsZVVwbG9hZERpYWxvZyA9ICQoXCIjZmlsZVVwbG9hZERpYWxvZ1wiKTtcblxuICBmaWxlVXBsb2FkRGlhbG9nLmNoYW5nZShmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgZmlsZSA9IGZpbGVVcGxvYWREaWFsb2cuZ2V0KDApLmZpbGVzWzBdO1xuICAgIGhhbmRsZVNlbGVjdGVkRmlsZShjdHgudG9rZW4sIGZpbGUpO1xuICB9KTtcblxuICAkKFwiI2ZpbGVVcGxvYWRUYXJnZXRcIikuY2xpY2soZnVuY3Rpb24oZXZ0KSB7XG5cbiAgICB2YXIgY3VycmVudGx5RGlzcGxheWluZyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnKSk7XG5cbiAgICBpZiAoY3VycmVudGx5RGlzcGxheWluZykge1xuICAgICAgY29uc29sZS5sb2coJ0hBUkQgU09DS0VUIFNUT1AnKTtcbiAgICAgICQucHVibGlzaCgnaGFyZHNvY2tldHN0b3AnKTtcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZpbGVVcGxvYWREaWFsb2cudmFsKG51bGwpO1xuXG4gICAgZmlsZVVwbG9hZERpYWxvZ1xuICAgIC50cmlnZ2VyKCdjbGljaycpO1xuXG4gIH0pO1xuXG59IiwiXG52YXIgaW5pdFNlc3Npb25QZXJtaXNzaW9ucyA9IHJlcXVpcmUoJy4vc2Vzc2lvbnBlcm1pc3Npb25zJykuaW5pdFNlc3Npb25QZXJtaXNzaW9ucztcbnZhciBpbml0U2VsZWN0TW9kZWwgPSByZXF1aXJlKCcuL3NlbGVjdG1vZGVsJykuaW5pdFNlbGVjdE1vZGVsO1xudmFyIGluaXRBbmltYXRlUGFuZWwgPSByZXF1aXJlKCcuL2FuaW1hdGVwYW5lbCcpLmluaXRBbmltYXRlUGFuZWw7XG52YXIgaW5pdFNob3dUYWIgPSByZXF1aXJlKCcuL3Nob3d0YWInKS5pbml0U2hvd1RhYjtcbnZhciBpbml0RHJhZ0Ryb3AgPSByZXF1aXJlKCcuL2RyYWdkcm9wJykuaW5pdERyYWdEcm9wO1xudmFyIGluaXRQbGF5U2FtcGxlID0gcmVxdWlyZSgnLi9wbGF5c2FtcGxlJykuaW5pdFBsYXlTYW1wbGU7XG52YXIgaW5pdFJlY29yZEJ1dHRvbiA9IHJlcXVpcmUoJy4vcmVjb3JkYnV0dG9uJykuaW5pdFJlY29yZEJ1dHRvbjtcbnZhciBpbml0RmlsZVVwbG9hZCA9IHJlcXVpcmUoJy4vZmlsZXVwbG9hZCcpLmluaXRGaWxlVXBsb2FkO1xudmFyIGluaXREaXNwbGF5TWV0YWRhdGEgPSByZXF1aXJlKCcuL2Rpc3BsYXltZXRhZGF0YScpLmluaXREaXNwbGF5TWV0YWRhdGE7XG5cblxuZXhwb3J0cy5pbml0Vmlld3MgPSBmdW5jdGlvbihjdHgpIHtcbiAgY29uc29sZS5sb2coJ0luaXRpYWxpemluZyB2aWV3cy4uLicpO1xuICBpbml0U2VsZWN0TW9kZWwoY3R4KTtcbiAgaW5pdFBsYXlTYW1wbGUoY3R4KTtcbiAgaW5pdERyYWdEcm9wKGN0eCk7XG4gIGluaXRSZWNvcmRCdXR0b24oY3R4KTtcbiAgaW5pdEZpbGVVcGxvYWQoY3R4KTtcbiAgaW5pdFNlc3Npb25QZXJtaXNzaW9ucygpO1xuICBpbml0U2hvd1RhYigpO1xuICBpbml0QW5pbWF0ZVBhbmVsKCk7XG4gIGluaXRTaG93VGFiKCk7XG4gIGluaXREaXNwbGF5TWV0YWRhdGEoKTtcbn1cbiIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xudmFyIG9uRmlsZVByb2dyZXNzID0gdXRpbHMub25GaWxlUHJvZ3Jlc3M7XG52YXIgaGFuZGxlRmlsZVVwbG9hZCA9IHJlcXVpcmUoJy4uL2hhbmRsZWZpbGV1cGxvYWQnKS5oYW5kbGVGaWxlVXBsb2FkO1xudmFyIGluaXRTb2NrZXQgPSByZXF1aXJlKCcuLi9zb2NrZXQnKS5pbml0U29ja2V0O1xudmFyIHNob3dFcnJvciA9IHJlcXVpcmUoJy4vc2hvd2Vycm9yJykuc2hvd0Vycm9yO1xudmFyIGVmZmVjdHMgPSByZXF1aXJlKCcuL2VmZmVjdHMnKTtcblxuXG52YXIgTE9PS1VQX1RBQkxFID0ge1xuICAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnOiBbJ1VzX0VuZ2xpc2hfQnJvYWRiYW5kX1NhbXBsZV8xLndhdicsICdVc19FbmdsaXNoX0Jyb2FkYmFuZF9TYW1wbGVfMi53YXYnXSxcbiAgJ2VuLVVTX05hcnJvd2JhbmRNb2RlbCc6IFsnVXNfRW5nbGlzaF9OYXJyb3diYW5kX1NhbXBsZV8xLndhdicsICdVc19FbmdsaXNoX05hcnJvd2JhbmRfU2FtcGxlXzIud2F2J10sXG4gICdlcy1FU19Ccm9hZGJhbmRNb2RlbCc6IFsnRXNfRVNfc3BrMjRfMTZraHoud2F2JywgJ0VzX0VTX3NwazE5XzE2a2h6LndhdiddLFxuICAnZXMtRVNfTmFycm93YmFuZE1vZGVsJzogWydFc19FU19zcGsyNF84a2h6LndhdicsICdFc19FU19zcGsxOV84a2h6LndhdiddLFxuICAnamEtSlBfQnJvYWRiYW5kTW9kZWwnOiBbJ3NhbXBsZS1KYV9KUC13aWRlMS53YXYnLCAnc2FtcGxlLUphX0pQLXdpZGUyLndhdiddLFxuICAnamEtSlBfTmFycm93YmFuZE1vZGVsJzogWydzYW1wbGUtSmFfSlAtbmFycm93My53YXYnLCAnc2FtcGxlLUphX0pQLW5hcnJvdzQud2F2J10sXG4gICdwdC1CUl9Ccm9hZGJhbmRNb2RlbCc6IFsncHQtQlJfU2FtcGxlMS0xNktIei53YXYnLCAncHQtQlJfU2FtcGxlMi0xNktIei53YXYnXSxcbiAgJ3B0LUJSX05hcnJvd2JhbmRNb2RlbCc6IFsncHQtQlJfU2FtcGxlMS04S0h6LndhdicsICdwdC1CUl9TYW1wbGUyLThLSHoud2F2J10sXG4gICd6aC1DTl9Ccm9hZGJhbmRNb2RlbCc6IFsnc2FtcGxlLUphX0pQLW5hcnJvdzMud2F2JywgJ3NhbXBsZS1KYV9KUC1uYXJyb3c0LndhdiddLFxuICAnemgtQ05fTmFycm93YmFuZE1vZGVsJzogWydzYW1wbGUtSmFfSlAtbmFycm93My53YXYnLCAnc2FtcGxlLUphX0pQLW5hcnJvdzQud2F2J11cbn07XG5cbnZhciBwbGF5U2FtcGxlID0gKGZ1bmN0aW9uKCkge1xuXG4gIHZhciBydW5uaW5nID0gZmFsc2U7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuXG4gIHJldHVybiBmdW5jdGlvbih0b2tlbiwgaW1hZ2VUYWcsIGljb25OYW1lLCB1cmwsIGNhbGxiYWNrKSB7XG5cbiAgICAkLnB1Ymxpc2goJ2NsZWFyc2NyZWVuJyk7XG5cbiAgICB2YXIgY3VycmVudGx5RGlzcGxheWluZyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnKSk7XG5cbiAgICBjb25zb2xlLmxvZygnQ1VSUkVOVExZIERJU1BMQVlJTkcnLCBjdXJyZW50bHlEaXNwbGF5aW5nKTtcblxuICAgIC8vIFRoaXMgZXJyb3IgaGFuZGxpbmcgbmVlZHMgdG8gYmUgZXhwYW5kZWQgdG8gYWNjb21vZGF0ZVxuICAgIC8vIHRoZSB0d28gZGlmZmVyZW50IHBsYXkgc2FtcGxlcyBmaWxlc1xuICAgIGlmIChjdXJyZW50bHlEaXNwbGF5aW5nKSB7XG4gICAgICBjb25zb2xlLmxvZygnSEFSRCBTT0NLRVQgU1RPUCcpO1xuICAgICAgJC5wdWJsaXNoKCdzb2NrZXRzdG9wJyk7XG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIGZhbHNlKTtcbiAgICAgIGVmZmVjdHMuc3RvcFRvZ2dsZUltYWdlKHRpbWVyLCBpbWFnZVRhZywgaWNvbk5hbWUpO1xuICAgICAgZWZmZWN0cy5yZXN0b3JlSW1hZ2UoaW1hZ2VUYWcsIGljb25OYW1lKTtcbiAgICAgIHJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoY3VycmVudGx5RGlzcGxheWluZyAmJiBydW5uaW5nKSB7XG4gICAgICBzaG93RXJyb3IoJ0N1cnJlbnRseSBhbm90aGVyIGZpbGUgaXMgcGxheWluZywgcGxlYXNlIHN0b3AgdGhlIGZpbGUgb3Igd2FpdCB1bnRpbCBpdCBmaW5pc2hlcycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgdHJ1ZSk7XG4gICAgcnVubmluZyA9IHRydWU7XG5cbiAgICB2YXIgdGltZXIgPSBzZXRJbnRlcnZhbChlZmZlY3RzLnRvZ2dsZUltYWdlLCA3NTAsIGltYWdlVGFnLCBpY29uTmFtZSk7XG5cbiAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgeGhyLm9wZW4oJ0dFVCcsIHVybCwgdHJ1ZSk7XG4gICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdibG9iJztcbiAgICB4aHIub25sb2FkID0gZnVuY3Rpb24oZSkge1xuICAgICAgdmFyIGJsb2IgPSB4aHIucmVzcG9uc2U7XG4gICAgICB2YXIgY3VycmVudE1vZGVsID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRNb2RlbCcpIHx8ICdlbi1VU19Ccm9hZGJhbmRNb2RlbCc7XG4gICAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgIHZhciBibG9iVG9UZXh0ID0gbmV3IEJsb2IoW2Jsb2JdKS5zbGljZSgwLCA0KTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGJsb2JUb1RleHQpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgY29udGVudFR5cGUgPSByZWFkZXIucmVzdWx0ID09PSAnZkxhQycgPyAnYXVkaW8vZmxhYycgOiAnYXVkaW8vd2F2JztcbiAgICAgICAgY29uc29sZS5sb2coJ1VwbG9hZGluZyBmaWxlJywgcmVhZGVyLnJlc3VsdCk7XG4gICAgICAgIHZhciBtZWRpYVNvdXJjZVVSTCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XG4gICAgICAgIHZhciBhdWRpbyA9IG5ldyBBdWRpbygpO1xuICAgICAgICBhdWRpby5zcmMgPSBtZWRpYVNvdXJjZVVSTDtcbiAgICAgICAgYXVkaW8ucGxheSgpO1xuICAgICAgICAkLnN1YnNjcmliZSgnaGFyZHNvY2tldHN0b3AnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBhdWRpby5wYXVzZSgpO1xuICAgICAgICAgIGF1ZGlvLmN1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgfSk7XG4gICAgICAgICQuc3Vic2NyaWJlKCdzb2NrZXRzdG9wJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgYXVkaW8ucGF1c2UoKTtcbiAgICAgICAgICBhdWRpby5jdXJyZW50VGltZSA9IDA7XG4gICAgICAgIH0pO1xuICAgICAgICBoYW5kbGVGaWxlVXBsb2FkKHRva2VuLCBjdXJyZW50TW9kZWwsIGJsb2IsIGNvbnRlbnRUeXBlLCBmdW5jdGlvbihzb2NrZXQpIHtcbiAgICAgICAgICB2YXIgcGFyc2VPcHRpb25zID0ge1xuICAgICAgICAgICAgZmlsZTogYmxvYlxuICAgICAgICAgIH07XG4gICAgICAgICAgdmFyIHNhbXBsaW5nUmF0ZSA9IChjdXJyZW50TW9kZWwuaW5kZXhPZihcIkJyb2FkYmFuZFwiKSAhPSAtMSkgPyAxNjAwMCA6IDgwMDA7XG4gICAgICAgICAgb25GaWxlUHJvZ3Jlc3MocGFyc2VPcHRpb25zLFxuICAgICAgICAgICAgLy8gT24gZGF0YSBjaHVua1xuICAgICAgICAgICAgZnVuY3Rpb24oY2h1bmspIHtcbiAgICAgICAgICAgICAgc29ja2V0LnNlbmQoY2h1bmspO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIC8vIE9uIGZpbGUgcmVhZCBlcnJvclxuICAgICAgICAgICAgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdFcnJvciByZWFkaW5nIGZpbGU6ICcsIGV2dC5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgLy8gc2hvd0Vycm9yKGV2dC5tZXNzYWdlKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyBPbiBsb2FkIGVuZFxuICAgICAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHsnYWN0aW9uJzogJ3N0b3AnfSkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNhbXBsaW5nUmF0ZVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSwgXG4gICAgICAgIC8vIE9uIGNvbm5lY3Rpb24gZW5kXG4gICAgICAgICAgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICBlZmZlY3RzLnN0b3BUb2dnbGVJbWFnZSh0aW1lciwgaW1hZ2VUYWcsIGljb25OYW1lKTtcbiAgICAgICAgICAgIGVmZmVjdHMucmVzdG9yZUltYWdlKGltYWdlVGFnLCBpY29uTmFtZSk7XG4gICAgICAgICAgICBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIGZhbHNlKTtcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9O1xuICAgIH07XG4gICAgeGhyLnNlbmQoKTtcbiAgfTtcbn0pKCk7XG5cblxuZXhwb3J0cy5pbml0UGxheVNhbXBsZSA9IGZ1bmN0aW9uKGN0eCkge1xuXG4gIChmdW5jdGlvbigpIHtcbiAgICB2YXIgZmlsZU5hbWUgPSAnYXVkaW8vJyArIExPT0tVUF9UQUJMRVtjdHguY3VycmVudE1vZGVsXVswXTtcbiAgICB2YXIgZWwgPSAkKCcucGxheS1zYW1wbGUtMScpO1xuICAgIGVsLm9mZignY2xpY2snKTtcbiAgICB2YXIgaWNvbk5hbWUgPSAncGxheSc7XG4gICAgdmFyIGltYWdlVGFnID0gZWwuZmluZCgnaW1nJyk7XG4gICAgZWwuY2xpY2soIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgcGxheVNhbXBsZShjdHgudG9rZW4sIGltYWdlVGFnLCBpY29uTmFtZSwgZmlsZU5hbWUsIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBjb25zb2xlLmxvZygnUGxheSBzYW1wbGUgcmVzdWx0JywgcmVzdWx0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KShjdHgsIExPT0tVUF9UQUJMRSk7XG5cbiAgKGZ1bmN0aW9uKCkge1xuICAgIHZhciBmaWxlTmFtZSA9ICdhdWRpby8nICsgTE9PS1VQX1RBQkxFW2N0eC5jdXJyZW50TW9kZWxdWzFdO1xuICAgIHZhciBlbCA9ICQoJy5wbGF5LXNhbXBsZS0yJyk7XG4gICAgZWwub2ZmKCdjbGljaycpO1xuICAgIHZhciBpY29uTmFtZSA9ICdwbGF5JztcbiAgICB2YXIgaW1hZ2VUYWcgPSBlbC5maW5kKCdpbWcnKTtcbiAgICBlbC5jbGljayggZnVuY3Rpb24oZXZ0KSB7XG4gICAgICBwbGF5U2FtcGxlKGN0eC50b2tlbiwgaW1hZ2VUYWcsIGljb25OYW1lLCBmaWxlTmFtZSwgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdQbGF5IHNhbXBsZSByZXN1bHQnLCByZXN1bHQpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pKGN0eCwgTE9PS1VQX1RBQkxFKTtcblxufTtcblxuXG4iLCJcbid1c2Ugc3RyaWN0JztcblxudmFyIE1pY3JvcGhvbmUgPSByZXF1aXJlKCcuLi9NaWNyb3Bob25lJyk7XG52YXIgaGFuZGxlTWljcm9waG9uZSA9IHJlcXVpcmUoJy4uL2hhbmRsZW1pY3JvcGhvbmUnKS5oYW5kbGVNaWNyb3Bob25lO1xudmFyIHNob3dFcnJvciA9IHJlcXVpcmUoJy4vc2hvd2Vycm9yJykuc2hvd0Vycm9yO1xudmFyIHNob3dOb3RpY2UgPSByZXF1aXJlKCcuL3Nob3dlcnJvcicpLnNob3dOb3RpY2U7XG5cbmV4cG9ydHMuaW5pdFJlY29yZEJ1dHRvbiA9IGZ1bmN0aW9uKGN0eCkge1xuXG4gIHZhciByZWNvcmRCdXR0b24gPSAkKCcjcmVjb3JkQnV0dG9uJyk7XG5cbiAgcmVjb3JkQnV0dG9uLmNsaWNrKChmdW5jdGlvbigpIHtcblxuICAgIHZhciBydW5uaW5nID0gZmFsc2U7XG4gICAgdmFyIHRva2VuID0gY3R4LnRva2VuO1xuICAgIHZhciBtaWNPcHRpb25zID0ge1xuICAgICAgYnVmZmVyU2l6ZTogY3R4LmJ1ZmZlcnNpemVcbiAgICB9O1xuICAgIHZhciBtaWMgPSBuZXcgTWljcm9waG9uZShtaWNPcHRpb25zKTtcblxuICAgIHJldHVybiBmdW5jdGlvbihldnQpIHtcbiAgICAgIC8vIFByZXZlbnQgZGVmYXVsdCBhbmNob3IgYmVoYXZpb3JcbiAgICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICB2YXIgY3VycmVudE1vZGVsID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRNb2RlbCcpO1xuICAgICAgdmFyIGN1cnJlbnRseURpc3BsYXlpbmcgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJykpO1xuXG4gICAgICBpZiAoY3VycmVudGx5RGlzcGxheWluZykge1xuICAgICAgICBzaG93RXJyb3IoJ0N1cnJlbnRseSBhbm90aGVyIGZpbGUgaXMgcGxheWluZywgcGxlYXNlIHN0b3AgdGhlIGZpbGUgb3Igd2FpdCB1bnRpbCBpdCBmaW5pc2hlcycpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICghcnVubmluZykge1xuICAgICAgICBjb25zb2xlLmxvZygnTm90IHJ1bm5pbmcsIGhhbmRsZU1pY3JvcGhvbmUoKScpO1xuICAgICAgICBoYW5kbGVNaWNyb3Bob25lKHRva2VuLCBjdXJyZW50TW9kZWwsIG1pYywgZnVuY3Rpb24oZXJyLCBzb2NrZXQpIHtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICB2YXIgbXNnID0gJ0Vycm9yOiAnICsgZXJyLm1lc3NhZ2U7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhtc2cpO1xuICAgICAgICAgICAgc2hvd0Vycm9yKG1zZyk7XG4gICAgICAgICAgICBydW5uaW5nID0gZmFsc2U7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlY29yZEJ1dHRvbi5jc3MoJ2JhY2tncm91bmQtY29sb3InLCAnI2Q3NDEwOCcpO1xuICAgICAgICAgICAgcmVjb3JkQnV0dG9uLmZpbmQoJ2ltZycpLmF0dHIoJ3NyYycsICdpbWFnZXMvc3RvcC5zdmcnKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdzdGFydGluZyBtaWMnKTtcbiAgICAgICAgICAgIG1pYy5yZWNvcmQoKTtcbiAgICAgICAgICAgIHJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZygnU3RvcHBpbmcgbWljcm9waG9uZSwgc2VuZGluZyBzdG9wIGFjdGlvbiBtZXNzYWdlJyk7XG4gICAgICAgIHJlY29yZEJ1dHRvbi5yZW1vdmVBdHRyKCdzdHlsZScpO1xuICAgICAgICByZWNvcmRCdXR0b24uZmluZCgnaW1nJykuYXR0cignc3JjJywgJ2ltYWdlcy9taWNyb3Bob25lLnN2ZycpO1xuICAgICAgICAkLnB1Ymxpc2goJ2hhcmRzb2NrZXRzdG9wJyk7XG4gICAgICAgIG1pYy5zdG9wKCk7XG4gICAgICAgIHJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gIH0pKCkpO1xufSIsIlxudmFyIGluaXRQbGF5U2FtcGxlID0gcmVxdWlyZSgnLi9wbGF5c2FtcGxlJykuaW5pdFBsYXlTYW1wbGU7XG5cbmV4cG9ydHMuaW5pdFNlbGVjdE1vZGVsID0gZnVuY3Rpb24oY3R4KSB7XG5cbiAgZnVuY3Rpb24gaXNEZWZhdWx0KG1vZGVsKSB7XG4gICAgcmV0dXJuIG1vZGVsID09PSAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnO1xuICB9XG5cbiAgY3R4Lm1vZGVscy5mb3JFYWNoKGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgJChcIiNkcm9wZG93bk1lbnVMaXN0XCIpLmFwcGVuZChcbiAgICAgICQoXCI8bGk+XCIpXG4gICAgICAgIC5hdHRyKCdyb2xlJywgJ3ByZXNlbnRhdGlvbicpXG4gICAgICAgIC5hcHBlbmQoXG4gICAgICAgICAgJCgnPGE+JykuYXR0cigncm9sZScsICdtZW51LWl0ZW0nKVxuICAgICAgICAgICAgLmF0dHIoJ2hyZWYnLCAnLycpXG4gICAgICAgICAgICAuYXR0cignZGF0YS1tb2RlbCcsIG1vZGVsLm5hbWUpXG4gICAgICAgICAgICAuYXBwZW5kKG1vZGVsLmRlc2NyaXB0aW9uKVxuICAgICAgICAgIClcbiAgICAgIClcbiAgfSk7XG5cbiAgJChcIiNkcm9wZG93bk1lbnVMaXN0XCIpLmNsaWNrKGZ1bmN0aW9uKGV2dCkge1xuICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2dC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBjb25zb2xlLmxvZygnQ2hhbmdlIHZpZXcnLCAkKGV2dC50YXJnZXQpLnRleHQoKSk7XG4gICAgdmFyIG5ld01vZGVsRGVzY3JpcHRpb24gPSAkKGV2dC50YXJnZXQpLnRleHQoKTtcbiAgICB2YXIgbmV3TW9kZWwgPSAkKGV2dC50YXJnZXQpLmRhdGEoJ21vZGVsJyk7XG4gICAgJCgnI2Ryb3Bkb3duTWVudURlZmF1bHQnKS5lbXB0eSgpLnRleHQobmV3TW9kZWxEZXNjcmlwdGlvbik7XG4gICAgJCgnI2Ryb3Bkb3duTWVudTEnKS5kcm9wZG93bigndG9nZ2xlJyk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRNb2RlbCcsIG5ld01vZGVsKTtcbiAgICBjdHguY3VycmVudE1vZGVsID0gbmV3TW9kZWw7XG4gICAgaW5pdFBsYXlTYW1wbGUoY3R4KTtcbiAgICAkLnB1Ymxpc2goJ2NsZWFyc2NyZWVuJyk7XG4gIH0pO1xuXG59IiwiXG4ndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuaW5pdFNlc3Npb25QZXJtaXNzaW9ucyA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnSW5pdGlhbGl6aW5nIHNlc3Npb24gcGVybWlzc2lvbnMgaGFuZGxlcicpO1xuICAvLyBSYWRpbyBidXR0b25zXG4gIHZhciBzZXNzaW9uUGVybWlzc2lvbnNSYWRpbyA9ICQoXCIjc2Vzc2lvblBlcm1pc3Npb25zUmFkaW9Hcm91cCBpbnB1dFt0eXBlPSdyYWRpbyddXCIpO1xuICBzZXNzaW9uUGVybWlzc2lvbnNSYWRpby5jbGljayhmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgY2hlY2tlZFZhbHVlID0gc2Vzc2lvblBlcm1pc3Npb25zUmFkaW8uZmlsdGVyKCc6Y2hlY2tlZCcpLnZhbCgpO1xuICAgIGNvbnNvbGUubG9nKCdjaGVja2VkVmFsdWUnLCBjaGVja2VkVmFsdWUpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzZXNzaW9uUGVybWlzc2lvbnMnLCBjaGVja2VkVmFsdWUpO1xuICB9KTtcbn1cbiIsIlxuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLnNob3dFcnJvciA9IGZ1bmN0aW9uKG1zZykge1xuICBjb25zb2xlLmxvZygnRXJyb3I6ICcsIG1zZyk7XG4gIHZhciBlcnJvckFsZXJ0ID0gJCgnLmVycm9yLXJvdycpO1xuICBlcnJvckFsZXJ0LmhpZGUoKTtcbiAgZXJyb3JBbGVydC5jc3MoJ2JhY2tncm91bmQtY29sb3InLCAnI2Q3NDEwOCcpO1xuICBlcnJvckFsZXJ0LmNzcygnY29sb3InLCAnd2hpdGUnKTtcbiAgdmFyIGVycm9yTWVzc2FnZSA9ICQoJyNlcnJvck1lc3NhZ2UnKTtcbiAgZXJyb3JNZXNzYWdlLnRleHQobXNnKTtcbiAgZXJyb3JBbGVydC5zaG93KCk7XG4gICQoJyNlcnJvckNsb3NlJykuY2xpY2soZnVuY3Rpb24oZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlcnJvckFsZXJ0LmhpZGUoKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0pO1xufVxuXG5leHBvcnRzLnNob3dOb3RpY2UgPSBmdW5jdGlvbihtc2cpIHtcbiAgY29uc29sZS5sb2coJ05vdGljZTogJywgbXNnKTtcbiAgdmFyIG5vdGljZUFsZXJ0ID0gJCgnLm5vdGlmaWNhdGlvbi1yb3cnKTtcbiAgbm90aWNlQWxlcnQuaGlkZSgpO1xuICBub3RpY2VBbGVydC5jc3MoJ2JvcmRlcicsICcycHggc29saWQgI2VjZWNlYycpO1xuICBub3RpY2VBbGVydC5jc3MoJ2JhY2tncm91bmQtY29sb3InLCAnI2Y0ZjRmNCcpO1xuICBub3RpY2VBbGVydC5jc3MoJ2NvbG9yJywgJ2JsYWNrJyk7XG4gIHZhciBub3RpY2VNZXNzYWdlID0gJCgnI25vdGlmaWNhdGlvbk1lc3NhZ2UnKTtcbiAgbm90aWNlTWVzc2FnZS50ZXh0KG1zZyk7XG4gIG5vdGljZUFsZXJ0LnNob3coKTtcbiAgJCgnI25vdGlmaWNhdGlvbkNsb3NlJykuY2xpY2soZnVuY3Rpb24oZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBub3RpY2VBbGVydC5oaWRlKCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9KTtcbn1cblxuZXhwb3J0cy5oaWRlRXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGVycm9yQWxlcnQgPSAkKCcuZXJyb3Itcm93Jyk7XG4gIGVycm9yQWxlcnQuaGlkZSgpO1xufSIsIlxuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLmluaXRTaG93VGFiID0gZnVuY3Rpb24oKSB7XG5cbiAgJCgnLm5hdi10YWJzIGFbZGF0YS10b2dnbGU9XCJ0YWJcIl0nKS5vbignc2hvd24uYnMudGFiJywgZnVuY3Rpb24gKGUpIHtcbiAgICAvL3Nob3cgc2VsZWN0ZWQgdGFiIC8gYWN0aXZlXG4gICAgdmFyIHRhcmdldCA9ICQoZS50YXJnZXQpLnRleHQoKTtcbiAgICBpZiAodGFyZ2V0ID09PSAnSlNPTicpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdzaG93aW5nIGpzb24nKTtcbiAgICAgICQucHVibGlzaCgnc2hvd2pzb24nKTtcbiAgICB9XG4gIH0pO1xuXG59Il19
