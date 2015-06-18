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
      if (!listening) {
        onlistening(socket);
        listening = true;
      } else {
        console.log('closing socket');
        // Cannot close socket since state is reported here as 'CLOSING' or 'CLOSED'
        // Despite this, it's possible to send from this 'CLOSING' socket with no issue
        // Could be a browser bug, still investigating
        // Could also be a proxy/gateway issue
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


},{}],6:[function(require,module,exports){

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

},{}],7:[function(require,module,exports){

var initSessionPermissions = require('./sessionpermissions').initSessionPermissions;
var initSelectModel = require('./selectmodel').initSelectModel;
var initAnimatePanel = require('./animatepanel').initAnimatePanel;
var initShowTab = require('./showtab').initShowTab;


exports.initViews = function(ctx) {
  console.log('Initializing views...');
  initSelectModel(ctx);
  initSessionPermissions();
  initShowTab();
  initAnimatePanel();
}

},{"./animatepanel":5,"./selectmodel":8,"./sessionpermissions":9,"./showtab":10}],8:[function(require,module,exports){

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

},{}],9:[function(require,module,exports){


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

},{}],10:[function(require,module,exports){


exports.initShowTab = function() {
  $('#nav-tabs a').on("click", function (e) {
    e.preventDefault()
    $(this).tab('show')
  });
}

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
    }

    function onError(err, socket) {
      console.log('err', err);
    }

    initSocket(options, onOpen, onListening, onMessage, onError);

  }

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


},{"./Microphone":1,"./models":2,"./socket":3,"./utils":4,"./views":7,"./views/display":6}]},{},[11])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5ucG0vbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwic3JjL01pY3JvcGhvbmUuanMiLCJzcmMvbW9kZWxzLmpzIiwic3JjL3NvY2tldC5qcyIsInNyYy91dGlscy5qcyIsInNyYy92aWV3cy9hbmltYXRlcGFuZWwuanMiLCJzcmMvdmlld3MvZGlzcGxheS5qcyIsInNyYy92aWV3cy9pbmRleC5qcyIsInNyYy92aWV3cy9zZWxlY3Rtb2RlbC5qcyIsInNyYy92aWV3cy9zZXNzaW9ucGVybWlzc2lvbnMuanMiLCJzcmMvdmlld3Mvc2hvd3RhYi5qcyIsInNyYy9pbmRleCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgJ0xpY2Vuc2UnKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gJ0FTIElTJyBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG4vKipcbiAqIENhcHR1cmVzIG1pY3JvcGhvbmUgaW5wdXQgZnJvbSB0aGUgYnJvd3Nlci5cbiAqIFdvcmtzIGF0IGxlYXN0IG9uIGxhdGVzdCB2ZXJzaW9ucyBvZiBGaXJlZm94IGFuZCBDaHJvbWVcbiAqL1xuZnVuY3Rpb24gTWljcm9waG9uZShfb3B0aW9ucykge1xuICB2YXIgb3B0aW9ucyA9IF9vcHRpb25zIHx8IHt9O1xuXG4gIC8vIHdlIHJlY29yZCBpbiBtb25vIGJlY2F1c2UgdGhlIHNwZWVjaCByZWNvZ25pdGlvbiBzZXJ2aWNlXG4gIC8vIGRvZXMgbm90IHN1cHBvcnQgc3RlcmVvLlxuICB0aGlzLmJ1ZmZlclNpemUgPSBvcHRpb25zLmJ1ZmZlclNpemUgfHwgMjA0ODtcbiAgdGhpcy5pbnB1dENoYW5uZWxzID0gb3B0aW9ucy5pbnB1dENoYW5uZWxzIHx8IDE7XG4gIHRoaXMub3V0cHV0Q2hhbm5lbHMgPSBvcHRpb25zLm91dHB1dENoYW5uZWxzIHx8IDE7XG4gIHRoaXMucmVjb3JkaW5nID0gZmFsc2U7XG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gZmFsc2U7XG4gIHRoaXMuc2FtcGxlUmF0ZSA9IDE2MDAwO1xuICAvLyBhdXhpbGlhciBidWZmZXIgdG8ga2VlcCB1bnVzZWQgc2FtcGxlcyAodXNlZCB3aGVuIGRvaW5nIGRvd25zYW1wbGluZylcbiAgdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzID0gbmV3IEZsb2F0MzJBcnJheSgwKTtcblxuICAvLyBDaHJvbWUgb3IgRmlyZWZveCBvciBJRSBVc2VyIG1lZGlhXG4gIGlmICghbmF2aWdhdG9yLmdldFVzZXJNZWRpYSkge1xuICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgPSBuYXZpZ2F0b3Iud2Via2l0R2V0VXNlck1lZGlhIHx8XG4gICAgbmF2aWdhdG9yLm1vekdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3IubXNHZXRVc2VyTWVkaWE7XG4gIH1cblxufVxuXG4vKipcbiAqIENhbGxlZCB3aGVuIHRoZSB1c2VyIHJlamVjdCB0aGUgdXNlIG9mIHRoZSBtaWNocm9waG9uZVxuICogQHBhcmFtICBlcnJvciBUaGUgZXJyb3JcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUub25QZXJtaXNzaW9uUmVqZWN0ZWQgPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJ01pY3JvcGhvbmUub25QZXJtaXNzaW9uUmVqZWN0ZWQoKScpO1xuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IGZhbHNlO1xuICB0aGlzLm9uRXJyb3IoJ1Blcm1pc3Npb24gdG8gYWNjZXNzIHRoZSBtaWNyb3Bob25lIHJlamV0ZWQuJyk7XG59O1xuXG5NaWNyb3Bob25lLnByb3RvdHlwZS5vbkVycm9yID0gZnVuY3Rpb24oZXJyb3IpIHtcbiAgY29uc29sZS5sb2coJ01pY3JvcGhvbmUub25FcnJvcigpOicsIGVycm9yKTtcbn07XG5cbi8qKlxuICogQ2FsbGVkIHdoZW4gdGhlIHVzZXIgYXV0aG9yaXplcyB0aGUgdXNlIG9mIHRoZSBtaWNyb3Bob25lLlxuICogQHBhcmFtICB7T2JqZWN0fSBzdHJlYW0gVGhlIFN0cmVhbSB0byBjb25uZWN0IHRvXG4gKlxuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5vbk1lZGlhU3RyZWFtID0gIGZ1bmN0aW9uKHN0cmVhbSkge1xuICB2YXIgQXVkaW9DdHggPSB3aW5kb3cuQXVkaW9Db250ZXh0IHx8IHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQ7XG5cbiAgaWYgKCFBdWRpb0N0eClcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0F1ZGlvQ29udGV4dCBub3QgYXZhaWxhYmxlJyk7XG5cbiAgaWYgKCF0aGlzLmF1ZGlvQ29udGV4dClcbiAgICB0aGlzLmF1ZGlvQ29udGV4dCA9IG5ldyBBdWRpb0N0eCgpO1xuXG4gIHZhciBnYWluID0gdGhpcy5hdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xuICB2YXIgYXVkaW9JbnB1dCA9IHRoaXMuYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHN0cmVhbSk7XG5cbiAgYXVkaW9JbnB1dC5jb25uZWN0KGdhaW4pO1xuXG4gIHRoaXMubWljID0gdGhpcy5hdWRpb0NvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKHRoaXMuYnVmZmVyU2l6ZSxcbiAgICB0aGlzLmlucHV0Q2hhbm5lbHMsIHRoaXMub3V0cHV0Q2hhbm5lbHMpO1xuXG4gIC8vIHVuY29tbWVudCB0aGUgZm9sbG93aW5nIGxpbmUgaWYgeW91IHdhbnQgdG8gdXNlIHlvdXIgbWljcm9waG9uZSBzYW1wbGUgcmF0ZVxuICAvL3RoaXMuc2FtcGxlUmF0ZSA9IHRoaXMuYXVkaW9Db250ZXh0LnNhbXBsZVJhdGU7XG4gIGNvbnNvbGUubG9nKCdNaWNyb3Bob25lLm9uTWVkaWFTdHJlYW0oKTogc2FtcGxpbmcgcmF0ZSBpczonLCB0aGlzLnNhbXBsZVJhdGUpO1xuXG4gIHRoaXMubWljLm9uYXVkaW9wcm9jZXNzID0gdGhpcy5fb25hdWRpb3Byb2Nlc3MuYmluZCh0aGlzKTtcbiAgdGhpcy5zdHJlYW0gPSBzdHJlYW07XG5cbiAgZ2Fpbi5jb25uZWN0KHRoaXMubWljKTtcbiAgdGhpcy5taWMuY29ubmVjdCh0aGlzLmF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG4gIHRoaXMucmVjb3JkaW5nID0gdHJ1ZTtcbiAgdGhpcy5yZXF1ZXN0ZWRBY2Nlc3MgPSBmYWxzZTtcbiAgdGhpcy5vblN0YXJ0UmVjb3JkaW5nKCk7XG59O1xuXG4vKipcbiAqIGNhbGxiYWNrIHRoYXQgaXMgYmVpbmcgdXNlZCBieSB0aGUgbWljcm9waG9uZVxuICogdG8gc2VuZCBhdWRpbyBjaHVua3MuXG4gKiBAcGFyYW0gIHtvYmplY3R9IGRhdGEgYXVkaW9cbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUuX29uYXVkaW9wcm9jZXNzID0gZnVuY3Rpb24oZGF0YSkge1xuICBpZiAoIXRoaXMucmVjb3JkaW5nKSB7XG4gICAgLy8gV2Ugc3BlYWsgYnV0IHdlIGFyZSBub3QgcmVjb3JkaW5nXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gU2luZ2xlIGNoYW5uZWxcbiAgdmFyIGNoYW4gPSBkYXRhLmlucHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDApO1xuXG4gIHRoaXMub25BdWRpbyh0aGlzLl9leHBvcnREYXRhQnVmZmVyVG8xNktoeihuZXcgRmxvYXQzMkFycmF5KGNoYW4pKSk7XG5cbiAgLy9leHBvcnQgd2l0aCBtaWNyb3Bob25lIG1oeiwgcmVtZW1iZXIgdG8gdXBkYXRlIHRoZSB0aGlzLnNhbXBsZVJhdGVcbiAgLy8gd2l0aCB0aGUgc2FtcGxlIHJhdGUgZnJvbSB5b3VyIG1pY3JvcGhvbmVcbiAgLy8gdGhpcy5vbkF1ZGlvKHRoaXMuX2V4cG9ydERhdGFCdWZmZXIobmV3IEZsb2F0MzJBcnJheShjaGFuKSkpO1xuXG59O1xuXG4vKipcbiAqIFN0YXJ0IHRoZSBhdWRpbyByZWNvcmRpbmdcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUucmVjb3JkID0gZnVuY3Rpb24oKSB7XG4gIGlmICghbmF2aWdhdG9yLmdldFVzZXJNZWRpYSl7XG4gICAgdGhpcy5vbkVycm9yKCdCcm93c2VyIGRvZXNuXFwndCBzdXBwb3J0IG1pY3JvcGhvbmUgaW5wdXQnKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKHRoaXMucmVxdWVzdGVkQWNjZXNzKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhpcy5yZXF1ZXN0ZWRBY2Nlc3MgPSB0cnVlO1xuICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKHsgYXVkaW86IHRydWUgfSxcbiAgICB0aGlzLm9uTWVkaWFTdHJlYW0uYmluZCh0aGlzKSwgLy8gTWljcm9waG9uZSBwZXJtaXNzaW9uIGdyYW50ZWRcbiAgICB0aGlzLm9uUGVybWlzc2lvblJlamVjdGVkLmJpbmQodGhpcykpOyAvLyBNaWNyb3Bob25lIHBlcm1pc3Npb24gcmVqZWN0ZWRcbn07XG5cbi8qKlxuICogU3RvcCB0aGUgYXVkaW8gcmVjb3JkaW5nXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCF0aGlzLnJlY29yZGluZylcbiAgICByZXR1cm47XG4gIHRoaXMucmVjb3JkaW5nID0gZmFsc2U7XG4gIHRoaXMuc3RyZWFtLnN0b3AoKTtcbiAgdGhpcy5yZXF1ZXN0ZWRBY2Nlc3MgPSBmYWxzZTtcbiAgdGhpcy5taWMuZGlzY29ubmVjdCgwKTtcbiAgdGhpcy5taWMgPSBudWxsO1xuICB0aGlzLm9uU3RvcFJlY29yZGluZygpO1xufTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgQmxvYiB0eXBlOiAnYXVkaW8vbDE2JyB3aXRoIHRoZSBjaHVuayBhbmQgZG93bnNhbXBsaW5nIHRvIDE2IGtIelxuICogY29taW5nIGZyb20gdGhlIG1pY3JvcGhvbmUuXG4gKiBFeHBsYW5hdGlvbiBmb3IgdGhlIG1hdGg6IFRoZSByYXcgdmFsdWVzIGNhcHR1cmVkIGZyb20gdGhlIFdlYiBBdWRpbyBBUEkgYXJlXG4gKiBpbiAzMi1iaXQgRmxvYXRpbmcgUG9pbnQsIGJldHdlZW4gLTEgYW5kIDEgKHBlciB0aGUgc3BlY2lmaWNhdGlvbikuXG4gKiBUaGUgdmFsdWVzIGZvciAxNi1iaXQgUENNIHJhbmdlIGJldHdlZW4gLTMyNzY4IGFuZCArMzI3NjcgKDE2LWJpdCBzaWduZWQgaW50ZWdlcikuXG4gKiBNdWx0aXBseSB0byBjb250cm9sIHRoZSB2b2x1bWUgb2YgdGhlIG91dHB1dC4gV2Ugc3RvcmUgaW4gbGl0dGxlIGVuZGlhbi5cbiAqIEBwYXJhbSAge09iamVjdH0gYnVmZmVyIE1pY3JvcGhvbmUgYXVkaW8gY2h1bmtcbiAqIEByZXR1cm4ge0Jsb2J9ICdhdWRpby9sMTYnIGNodW5rXG4gKiBAZGVwcmVjYXRlZCBUaGlzIG1ldGhvZCBpcyBkZXByYWNhdGVkXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLl9leHBvcnREYXRhQnVmZmVyVG8xNktoeiA9IGZ1bmN0aW9uKGJ1ZmZlck5ld1NhbXBsZXMpIHtcbiAgdmFyIGJ1ZmZlciA9IG51bGwsXG4gICAgbmV3U2FtcGxlcyA9IGJ1ZmZlck5ld1NhbXBsZXMubGVuZ3RoLFxuICAgIHVudXNlZFNhbXBsZXMgPSB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXMubGVuZ3RoO1xuXG4gIGlmICh1bnVzZWRTYW1wbGVzID4gMCkge1xuICAgIGJ1ZmZlciA9IG5ldyBGbG9hdDMyQXJyYXkodW51c2VkU2FtcGxlcyArIG5ld1NhbXBsZXMpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdW51c2VkU2FtcGxlczsgKytpKSB7XG4gICAgICBidWZmZXJbaV0gPSB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXNbaV07XG4gICAgfVxuICAgIGZvciAoaSA9IDA7IGkgPCBuZXdTYW1wbGVzOyArK2kpIHtcbiAgICAgIGJ1ZmZlclt1bnVzZWRTYW1wbGVzICsgaV0gPSBidWZmZXJOZXdTYW1wbGVzW2ldO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBidWZmZXIgPSBidWZmZXJOZXdTYW1wbGVzO1xuICB9XG5cbiAgLy8gZG93bnNhbXBsaW5nIHZhcmlhYmxlc1xuICB2YXIgZmlsdGVyID0gW1xuICAgICAgLTAuMDM3OTM1LCAtMC4wMDA4OTAyNCwgMC4wNDAxNzMsIDAuMDE5OTg5LCAwLjAwNDc3OTIsIC0wLjA1ODY3NSwgLTAuMDU2NDg3LFxuICAgICAgLTAuMDA0MDY1MywgMC4xNDUyNywgMC4yNjkyNywgMC4zMzkxMywgMC4yNjkyNywgMC4xNDUyNywgLTAuMDA0MDY1MywgLTAuMDU2NDg3LFxuICAgICAgLTAuMDU4Njc1LCAwLjAwNDc3OTIsIDAuMDE5OTg5LCAwLjA0MDE3MywgLTAuMDAwODkwMjQsIC0wLjAzNzkzNVxuICAgIF0sXG4gICAgc2FtcGxpbmdSYXRlUmF0aW8gPSB0aGlzLmF1ZGlvQ29udGV4dC5zYW1wbGVSYXRlIC8gMTYwMDAsXG4gICAgbk91dHB1dFNhbXBsZXMgPSBNYXRoLmZsb29yKChidWZmZXIubGVuZ3RoIC0gZmlsdGVyLmxlbmd0aCkgLyAoc2FtcGxpbmdSYXRlUmF0aW8pKSArIDEsXG4gICAgcGNtRW5jb2RlZEJ1ZmZlcjE2ayA9IG5ldyBBcnJheUJ1ZmZlcihuT3V0cHV0U2FtcGxlcyAqIDIpLFxuICAgIGRhdGFWaWV3MTZrID0gbmV3IERhdGFWaWV3KHBjbUVuY29kZWRCdWZmZXIxNmspLFxuICAgIGluZGV4ID0gMCxcbiAgICB2b2x1bWUgPSAweDdGRkYsIC8vcmFuZ2UgZnJvbSAwIHRvIDB4N0ZGRiB0byBjb250cm9sIHRoZSB2b2x1bWVcbiAgICBuT3V0ID0gMDtcblxuICBmb3IgKHZhciBpID0gMDsgaSArIGZpbHRlci5sZW5ndGggLSAxIDwgYnVmZmVyLmxlbmd0aDsgaSA9IE1hdGgucm91bmQoc2FtcGxpbmdSYXRlUmF0aW8gKiBuT3V0KSkge1xuICAgIHZhciBzYW1wbGUgPSAwO1xuICAgIGZvciAodmFyIGogPSAwOyBqIDwgZmlsdGVyLmxlbmd0aDsgKytqKSB7XG4gICAgICBzYW1wbGUgKz0gYnVmZmVyW2kgKyBqXSAqIGZpbHRlcltqXTtcbiAgICB9XG4gICAgc2FtcGxlICo9IHZvbHVtZTtcbiAgICBkYXRhVmlldzE2ay5zZXRJbnQxNihpbmRleCwgc2FtcGxlLCB0cnVlKTsgLy8gJ3RydWUnIC0+IG1lYW5zIGxpdHRsZSBlbmRpYW5cbiAgICBpbmRleCArPSAyO1xuICAgIG5PdXQrKztcbiAgfVxuXG4gIHZhciBpbmRleFNhbXBsZUFmdGVyTGFzdFVzZWQgPSBNYXRoLnJvdW5kKHNhbXBsaW5nUmF0ZVJhdGlvICogbk91dCk7XG4gIHZhciByZW1haW5pbmcgPSBidWZmZXIubGVuZ3RoIC0gaW5kZXhTYW1wbGVBZnRlckxhc3RVc2VkO1xuICBpZiAocmVtYWluaW5nID4gMCkge1xuICAgIHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlcyA9IG5ldyBGbG9hdDMyQXJyYXkocmVtYWluaW5nKTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgcmVtYWluaW5nOyArK2kpIHtcbiAgICAgIHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlc1tpXSA9IGJ1ZmZlcltpbmRleFNhbXBsZUFmdGVyTGFzdFVzZWQgKyBpXTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzID0gbmV3IEZsb2F0MzJBcnJheSgwKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgQmxvYihbZGF0YVZpZXcxNmtdLCB7XG4gICAgdHlwZTogJ2F1ZGlvL2wxNidcbiAgfSk7XG4gIH07XG5cbi8qKlxuICogQ3JlYXRlcyBhIEJsb2IgdHlwZTogJ2F1ZGlvL2wxNicgd2l0aCB0aGVcbiAqIGNodW5rIGNvbWluZyBmcm9tIHRoZSBtaWNyb3Bob25lLlxuICovXG52YXIgZXhwb3J0RGF0YUJ1ZmZlciA9IGZ1bmN0aW9uKGJ1ZmZlciwgYnVmZmVyU2l6ZSkge1xuICB2YXIgcGNtRW5jb2RlZEJ1ZmZlciA9IG51bGwsXG4gICAgZGF0YVZpZXcgPSBudWxsLFxuICAgIGluZGV4ID0gMCxcbiAgICB2b2x1bWUgPSAweDdGRkY7IC8vcmFuZ2UgZnJvbSAwIHRvIDB4N0ZGRiB0byBjb250cm9sIHRoZSB2b2x1bWVcblxuICBwY21FbmNvZGVkQnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKGJ1ZmZlclNpemUgKiAyKTtcbiAgZGF0YVZpZXcgPSBuZXcgRGF0YVZpZXcocGNtRW5jb2RlZEJ1ZmZlcik7XG5cbiAgLyogRXhwbGFuYXRpb24gZm9yIHRoZSBtYXRoOiBUaGUgcmF3IHZhbHVlcyBjYXB0dXJlZCBmcm9tIHRoZSBXZWIgQXVkaW8gQVBJIGFyZVxuICAgKiBpbiAzMi1iaXQgRmxvYXRpbmcgUG9pbnQsIGJldHdlZW4gLTEgYW5kIDEgKHBlciB0aGUgc3BlY2lmaWNhdGlvbikuXG4gICAqIFRoZSB2YWx1ZXMgZm9yIDE2LWJpdCBQQ00gcmFuZ2UgYmV0d2VlbiAtMzI3NjggYW5kICszMjc2NyAoMTYtYml0IHNpZ25lZCBpbnRlZ2VyKS5cbiAgICogTXVsdGlwbHkgdG8gY29udHJvbCB0aGUgdm9sdW1lIG9mIHRoZSBvdXRwdXQuIFdlIHN0b3JlIGluIGxpdHRsZSBlbmRpYW4uXG4gICAqL1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlci5sZW5ndGg7IGkrKykge1xuICAgIGRhdGFWaWV3LnNldEludDE2KGluZGV4LCBidWZmZXJbaV0gKiB2b2x1bWUsIHRydWUpO1xuICAgIGluZGV4ICs9IDI7XG4gIH1cblxuICAvLyBsMTYgaXMgdGhlIE1JTUUgdHlwZSBmb3IgMTYtYml0IFBDTVxuICByZXR1cm4gbmV3IEJsb2IoW2RhdGFWaWV3XSwgeyB0eXBlOiAnYXVkaW8vbDE2JyB9KTtcbn07XG5cbk1pY3JvcGhvbmUucHJvdG90eXBlLl9leHBvcnREYXRhQnVmZmVyID0gZnVuY3Rpb24oYnVmZmVyKXtcbiAgdXRpbHMuZXhwb3J0RGF0YUJ1ZmZlcihidWZmZXIsIHRoaXMuYnVmZmVyU2l6ZSk7XG59OyBcblxuXG4vLyBGdW5jdGlvbnMgdXNlZCB0byBjb250cm9sIE1pY3JvcGhvbmUgZXZlbnRzIGxpc3RlbmVycy5cbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uU3RhcnRSZWNvcmRpbmcgPSAgZnVuY3Rpb24oKSB7fTtcbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uU3RvcFJlY29yZGluZyA9ICBmdW5jdGlvbigpIHt9O1xuTWljcm9waG9uZS5wcm90b3R5cGUub25BdWRpbyA9ICBmdW5jdGlvbigpIHt9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1pY3JvcGhvbmU7XG5cbiIsIlxuZXhwb3J0cy5nZXRNb2RlbHMgPSBmdW5jdGlvbihvcHRpb25zLCBjYWxsYmFjaykge1xuICB2YXIgdG9rZW4gPSBvcHRpb25zLnRva2VuO1xuICB2YXIgbW9kZWxVcmwgPSBvcHRpb25zLnVybCB8fCAnaHR0cHM6Ly9zdHJlYW0tcy53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQtYmV0YS9hcGkvdjEvbW9kZWxzJztcbiAgdmFyIHN0dFJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgc3R0UmVxdWVzdC5vcGVuKFwiR0VUXCIsIG1vZGVsVXJsLCB0cnVlKTtcbiAgc3R0UmVxdWVzdC53aXRoQ3JlZGVudGlhbHMgPSB0cnVlO1xuICBzdHRSZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gIHN0dFJlcXVlc3Quc2V0UmVxdWVzdEhlYWRlcignWC1XYXRzb24tQXV0aG9yaXphdGlvbi1Ub2tlbicsIHRva2VuKTtcbiAgc3R0UmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgcmVzcG9uc2UgPSBKU09OLnBhcnNlKHN0dFJlcXVlc3QucmVzcG9uc2VUZXh0KTtcbiAgICBjYWxsYmFjayhyZXNwb25zZS5tb2RlbHMpO1xuICB9O1xuICBzdHRSZXF1ZXN0LnNlbmQoKTtcbn1cbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgSUJNIENvcnAuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuLypnbG9iYWwgJDpmYWxzZSAqL1xuXG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnZhciBNaWNyb3Bob25lID0gcmVxdWlyZSgnLi9NaWNyb3Bob25lJyk7XG5cbi8vIE1pbmkgV1MgY2FsbGJhY2sgQVBJLCBzbyB3ZSBjYW4gaW5pdGlhbGl6ZVxuLy8gd2l0aCBtb2RlbCBhbmQgdG9rZW4gaW4gVVJJLCBwbHVzXG4vLyBzdGFydCBtZXNzYWdlXG5leHBvcnRzLmluaXRTb2NrZXQgPSBmdW5jdGlvbihvcHRpb25zLCBvbm9wZW4sIG9ubGlzdGVuaW5nLCBvbm1lc3NhZ2UsIG9uZXJyb3IpIHtcbiAgdmFyIGxpc3RlbmluZyA9IGZhbHNlO1xuICBmdW5jdGlvbiB3aXRoRGVmYXVsdCh2YWwsIGRlZmF1bHRWYWwpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ3VuZGVmaW5lZCcgPyBkZWZhdWx0VmFsIDogdmFsO1xuICB9XG4gIHZhciB0b2tlbiA9IG9wdGlvbnMudG9rZW47XG4gIHZhciBtb2RlbCA9IG9wdGlvbnMubW9kZWwgfHwgJ2VuLVVTX0Jyb2FkYmFuZE1vZGVsJztcbiAgdmFyIG1lc3NhZ2UgPSBvcHRpb25zLm1lc3NhZ2UgfHwgeydhY3Rpb24nOiAnc3RhcnQnfTtcbiAgdmFyIHNlc3Npb25QZXJtaXNzaW9ucyA9IHdpdGhEZWZhdWx0KG9wdGlvbnMuc2Vzc2lvblBlcm1pc3Npb25zLCBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdzZXNzaW9uUGVybWlzc2lvbnMnKSkpO1xuICB2YXIgc2Vzc2lvblBlcm1pc3Npb25zUXVlcnlQYXJhbSA9IHNlc3Npb25QZXJtaXNzaW9ucyA/ICcwJyA6ICcxJztcbiAgdmFyIHVybCA9IG9wdGlvbnMuc2VydmljZVVSSSB8fCAnd3NzOi8vc3RyZWFtLXMud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0LWJldGEvYXBpL3YxL3JlY29nbml6ZT93YXRzb24tdG9rZW49J1xuICAgICsgdG9rZW5cbiAgICArICcmWC1XREMtUEwtT1BULU9VVD0nICsgc2Vzc2lvblBlcm1pc3Npb25zUXVlcnlQYXJhbVxuICAgICsgJyZtb2RlbD0nICsgbW9kZWw7XG4gIGNvbnNvbGUubG9nKCdVUkwgbW9kZWwnLCBtb2RlbCk7XG4gIHZhciBzb2NrZXQgPSBuZXcgV2ViU29ja2V0KHVybCk7XG4gIHNvY2tldC5vbm9wZW4gPSBmdW5jdGlvbihldnQpIHtcbiAgICBjb25zb2xlLmxvZygnd3Mgb3BlbmVkJyk7XG4gICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkpO1xuICAgIG9ub3Blbihzb2NrZXQpO1xuICB9O1xuICBzb2NrZXQub25tZXNzYWdlID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIG1zZyA9IEpTT04ucGFyc2UoZXZ0LmRhdGEpO1xuICAgIGNvbnNvbGUubG9nKCdldnQnLCBldnQpO1xuICAgIGlmIChtc2cuc3RhdGUgPT09ICdsaXN0ZW5pbmcnKSB7XG4gICAgICBpZiAoIWxpc3RlbmluZykge1xuICAgICAgICBvbmxpc3RlbmluZyhzb2NrZXQpO1xuICAgICAgICBsaXN0ZW5pbmcgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ2Nsb3Npbmcgc29ja2V0Jyk7XG4gICAgICAgIC8vIENhbm5vdCBjbG9zZSBzb2NrZXQgc2luY2Ugc3RhdGUgaXMgcmVwb3J0ZWQgaGVyZSBhcyAnQ0xPU0lORycgb3IgJ0NMT1NFRCdcbiAgICAgICAgLy8gRGVzcGl0ZSB0aGlzLCBpdCdzIHBvc3NpYmxlIHRvIHNlbmQgZnJvbSB0aGlzICdDTE9TSU5HJyBzb2NrZXQgd2l0aCBubyBpc3N1ZVxuICAgICAgICAvLyBDb3VsZCBiZSBhIGJyb3dzZXIgYnVnLCBzdGlsbCBpbnZlc3RpZ2F0aW5nXG4gICAgICAgIC8vIENvdWxkIGFsc28gYmUgYSBwcm94eS9nYXRld2F5IGlzc3VlXG4gICAgICAgIC8vIHNvY2tldC5jbG9zZSgpO1xuICAgICAgfVxuICAgIH1cbiAgICBvbm1lc3NhZ2UobXNnLCBzb2NrZXQpO1xuICB9O1xuICBzb2NrZXQub25lcnJvciA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciBlcnIgPSBldnQuZGF0YTtcbiAgICBvbmVycm9yKGVyciwgc29ja2V0KTtcbiAgfTtcbn1cblxuIiwiXG4vKipcbiAqIENyZWF0ZXMgYSBCbG9iIHR5cGU6ICdhdWRpby9sMTYnIHdpdGggdGhlXG4gKiBjaHVuayBjb21pbmcgZnJvbSB0aGUgbWljcm9waG9uZS5cbiAqL1xudmFyIGV4cG9ydERhdGFCdWZmZXIgPSBleHBvcnRzLmV4cG9ydERhdGFCdWZmZXIgPSBmdW5jdGlvbihidWZmZXIsIGJ1ZmZlclNpemUpIHtcbiAgdmFyIHBjbUVuY29kZWRCdWZmZXIgPSBudWxsLFxuICAgIGRhdGFWaWV3ID0gbnVsbCxcbiAgICBpbmRleCA9IDAsXG4gICAgdm9sdW1lID0gMHg3RkZGOyAvL3JhbmdlIGZyb20gMCB0byAweDdGRkYgdG8gY29udHJvbCB0aGUgdm9sdW1lXG5cbiAgcGNtRW5jb2RlZEJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihidWZmZXJTaXplICogMik7XG4gIGRhdGFWaWV3ID0gbmV3IERhdGFWaWV3KHBjbUVuY29kZWRCdWZmZXIpO1xuXG4gIC8qIEV4cGxhbmF0aW9uIGZvciB0aGUgbWF0aDogVGhlIHJhdyB2YWx1ZXMgY2FwdHVyZWQgZnJvbSB0aGUgV2ViIEF1ZGlvIEFQSSBhcmVcbiAgICogaW4gMzItYml0IEZsb2F0aW5nIFBvaW50LCBiZXR3ZWVuIC0xIGFuZCAxIChwZXIgdGhlIHNwZWNpZmljYXRpb24pLlxuICAgKiBUaGUgdmFsdWVzIGZvciAxNi1iaXQgUENNIHJhbmdlIGJldHdlZW4gLTMyNzY4IGFuZCArMzI3NjcgKDE2LWJpdCBzaWduZWQgaW50ZWdlcikuXG4gICAqIE11bHRpcGx5IHRvIGNvbnRyb2wgdGhlIHZvbHVtZSBvZiB0aGUgb3V0cHV0LiBXZSBzdG9yZSBpbiBsaXR0bGUgZW5kaWFuLlxuICAgKi9cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXIubGVuZ3RoOyBpKyspIHtcbiAgICBkYXRhVmlldy5zZXRJbnQxNihpbmRleCwgYnVmZmVyW2ldICogdm9sdW1lLCB0cnVlKTtcbiAgICBpbmRleCArPSAyO1xuICB9XG5cbiAgLy8gbDE2IGlzIHRoZSBNSU1FIHR5cGUgZm9yIDE2LWJpdCBQQ01cbiAgcmV0dXJuIG5ldyBCbG9iKFtkYXRhVmlld10sIHsgdHlwZTogJ2F1ZGlvL2wxNicgfSk7XG59O1xuXG4vLyBGcm9tIGFsZWRpYWZlcmlhJ3MgU08gcmVzcG9uc2Vcbi8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTQ0MzgxODcvamF2YXNjcmlwdC1maWxlcmVhZGVyLXBhcnNpbmctbG9uZy1maWxlLWluLWNodW5rc1xuZXhwb3J0cy5wYXJzZUZpbGUgPSBmdW5jdGlvbihmaWxlLCBjYWxsYmFjaykge1xuICAgIHZhciBmaWxlU2l6ZSAgID0gZmlsZS5zaXplO1xuICAgIHZhciBjaHVua1NpemUgID0gMjA0OCAqIDQ7IC8vIGJ5dGVzXG4gICAgdmFyIG9mZnNldCAgICAgPSA0NDtcbiAgICB2YXIgc2VsZiAgICAgICA9IHRoaXM7IC8vIHdlIG5lZWQgYSByZWZlcmVuY2UgdG8gdGhlIGN1cnJlbnQgb2JqZWN0XG4gICAgdmFyIGJsb2NrICAgICAgPSBudWxsO1xuICAgIHZhciBjb3VudCAgICAgID0gMDtcbiAgICB2YXIgZm9vID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgIGlmIChvZmZzZXQgPj0gZmlsZVNpemUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiRG9uZSByZWFkaW5nIGZpbGVcIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV2dC50YXJnZXQuZXJyb3IgPT0gbnVsbCkge1xuICAgICAgICAgICAgdmFyIGJ1ZmZlciA9IGV2dC50YXJnZXQucmVzdWx0O1xuICAgICAgICAgICAgdmFyIGxlbiA9IGJ1ZmZlci5ieXRlTGVuZ3RoO1xuICAgICAgICAgICAgb2Zmc2V0ICs9IGxlbjtcbiAgICAgICAgICAgIHZhciBmaW5hbEJsb2IgPSBleHBvcnREYXRhQnVmZmVyKGJ1ZmZlciwgbGVuKTtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIGNhbGxiYWNrKGJ1ZmZlcik7IC8vIGNhbGxiYWNrIGZvciBoYW5kbGluZyByZWFkIGNodW5rXG4gICAgICAgICAgICB9LCBjb3VudCAqIDEwMCk7XG4gICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJSZWFkIGVycm9yOiBcIiArIGV2dC50YXJnZXQuZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGJsb2NrKG9mZnNldCwgY2h1bmtTaXplLCBmaWxlKTtcbiAgICB9XG4gICAgYmxvY2sgPSBmdW5jdGlvbihfb2Zmc2V0LCBsZW5ndGgsIF9maWxlKSB7XG4gICAgICAgIHZhciByID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgICAgdmFyIGJsb2IgPSBfZmlsZS5zbGljZShfb2Zmc2V0LCBsZW5ndGggKyBfb2Zmc2V0KTtcbiAgICAgICAgci5vbmxvYWQgPSBmb287XG4gICAgICAgIHIucmVhZEFzQXJyYXlCdWZmZXIoYmxvYik7XG4gICAgfVxuICAgIGJsb2NrKG9mZnNldCwgY2h1bmtTaXplLCBmaWxlKTtcbn1cblxuXG4iLCJcblxuZXhwb3J0cy5pbml0QW5pbWF0ZVBhbmVsID0gZnVuY3Rpb24oKSB7XG4gICQoJy5wYW5lbC1oZWFkaW5nIHNwYW4uY2xpY2thYmxlJykub24oXCJjbGlja1wiLCBmdW5jdGlvbiAoZSkge1xuICAgIGlmICgkKHRoaXMpLmhhc0NsYXNzKCdwYW5lbC1jb2xsYXBzZWQnKSkge1xuICAgICAgLy8gZXhwYW5kIHRoZSBwYW5lbFxuICAgICAgJCh0aGlzKS5wYXJlbnRzKCcucGFuZWwnKS5maW5kKCcucGFuZWwtYm9keScpLnNsaWRlRG93bigpO1xuICAgICAgJCh0aGlzKS5yZW1vdmVDbGFzcygncGFuZWwtY29sbGFwc2VkJyk7XG4gICAgICAkKHRoaXMpLmZpbmQoJ2knKS5yZW1vdmVDbGFzcygnY2FyZXQtZG93bicpLmFkZENsYXNzKCdjYXJldC11cCcpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIGNvbGxhcHNlIHRoZSBwYW5lbFxuICAgICAgJCh0aGlzKS5wYXJlbnRzKCcucGFuZWwnKS5maW5kKCcucGFuZWwtYm9keScpLnNsaWRlVXAoKTtcbiAgICAgICQodGhpcykuYWRkQ2xhc3MoJ3BhbmVsLWNvbGxhcHNlZCcpO1xuICAgICAgJCh0aGlzKS5maW5kKCdpJykucmVtb3ZlQ2xhc3MoJ2NhcmV0LXVwJykuYWRkQ2xhc3MoJ2NhcmV0LWRvd24nKTtcbiAgICB9XG4gIH0pO1xufVxuXG4iLCJcbnZhciBzaG93VGltZXN0YW1wcyA9IGZ1bmN0aW9uKHRpbWVzdGFtcHMpIHtcbiAgdGltZXN0YW1wcy5mb3JFYWNoKGZ1bmN0aW9uKHRpbWVzdGFtcCkge1xuICAgIHZhciB3b3JkID0gdGltZXN0YW1wWzBdLFxuICAgICAgdDAgPSB0aW1lc3RhbXBbMV0sXG4gICAgICB0MSA9IHRpbWVzdGFtcFsyXTtcbiAgICB2YXIgdGltZWxlbmd0aCA9IHQxIC0gdDA7XG4gICAgJCgnLnRhYmxlLWhlYWRlci1yb3cnKS5hcHBlbmQoJzx0aD4nICsgd29yZCArICc8L3RoPicpO1xuICAgICQoJy50aW1lLWxlbmd0aC1yb3cnKS5hcHBlbmQoJzx0ZD4nICsgdGltZWxlbmd0aC50b1N0cmluZygpLnN1YnN0cmluZygwLCAzKSArICcgczwvdGQ+Jyk7XG4gIH0pO1xufVxuXG52YXIgc2hvd1dvcmRDb25maWRlbmNlID0gZnVuY3Rpb24oY29uZmlkZW5jZXMpIHtcbiAgY29uc29sZS5sb2coJ2NvbmZpZGVuY2VzJywgY29uZmlkZW5jZXMpO1xuICBjb25maWRlbmNlcy5mb3JFYWNoKGZ1bmN0aW9uKGNvbmZpZGVuY2UpIHtcbiAgICB2YXIgZGlzcGxheUNvbmZpZGVuY2UgPSBjb25maWRlbmNlWzFdLnRvU3RyaW5nKCkuc3Vic3RyaW5nKDAsIDMpO1xuICAgICQoJy5jb25maWRlbmNlLXNjb3JlLXJvdycpLmFwcGVuZCgnPHRkPicgKyBkaXNwbGF5Q29uZmlkZW5jZSArICcgPC90ZD4nKTtcbiAgfSk7XG59XG5cbmV4cG9ydHMuc2hvd01ldGFEYXRhID0gZnVuY3Rpb24oYWx0ZXJuYXRpdmUpIHtcbiAgdmFyIHRpbWVzdGFtcHMgPSBhbHRlcm5hdGl2ZS50aW1lc3RhbXBzO1xuICBpZiAodGltZXN0YW1wcyAmJiB0aW1lc3RhbXBzLmxlbmd0aCA+IDApIHtcbiAgICBzaG93VGltZXN0YW1wcyh0aW1lc3RhbXBzKTtcbiAgfVxuICB2YXIgY29uZmlkZW5jZXMgPSBhbHRlcm5hdGl2ZS53b3JkX2NvbmZpZGVuY2U7O1xuICBpZiAoY29uZmlkZW5jZXMgJiYgY29uZmlkZW5jZXMubGVuZ3RoID4gMCkge1xuICAgIHNob3dXb3JkQ29uZmlkZW5jZShjb25maWRlbmNlcyk7XG4gIH1cbn1cblxuZXhwb3J0cy5zaG93QWx0ZXJuYXRpdmVzID0gZnVuY3Rpb24oYWx0ZXJuYXRpdmVzKSB7XG4gIHZhciAkaHlwb3RoZXNlcyA9ICQoJy5oeXBvdGhlc2VzIHVsJyk7XG4gICRoeXBvdGhlc2VzLmh0bWwoJycpO1xuICBhbHRlcm5hdGl2ZXMuZm9yRWFjaChmdW5jdGlvbihhbHRlcm5hdGl2ZSwgaWR4KSB7XG4gICAgJGh5cG90aGVzZXMuYXBwZW5kKCc8bGkgZGF0YS1oeXBvdGhlc2lzLWluZGV4PScgKyBpZHggKyAnID4nICsgYWx0ZXJuYXRpdmUudHJhbnNjcmlwdCArICc8L2xpPicpO1xuICB9KTtcbiAgJGh5cG90aGVzZXMub24oJ2NsaWNrJywgXCJsaVwiLCBmdW5jdGlvbiAoKSB7XG4gICAgY29uc29sZS5sb2coXCJzaG93aW5nIG1ldGFkYXRhXCIpO1xuICAgIHZhciBpZHggPSArICQodGhpcykuZGF0YSgnaHlwb3RoZXNpcy1pbmRleCcpO1xuICAgIHZhciBhbHRlcm5hdGl2ZSA9IGFsdGVybmF0aXZlc1tpZHhdO1xuICAgIHNob3dNZXRhRGF0YShhbHRlcm5hdGl2ZSk7XG4gIH0pO1xufVxuXG5cbmV4cG9ydHMuc2hvd0pTT04gPSBmdW5jdGlvbihtc2csIGJhc2VKU09OKSB7XG4gIHZhciBqc29uID0gSlNPTi5zdHJpbmdpZnkobXNnKTtcbiAgYmFzZUpTT04gKz0ganNvbjtcbiAgYmFzZUpTT04gKz0gJ1xcbic7XG4gICQoJyNyZXN1bHRzSlNPTicpLnZhbChiYXNlSlNPTik7XG4gIHJldHVybiBiYXNlSlNPTjtcbn1cblxuLy8gVE9ETzogQ29udmVydCB0byBjbG9zdXJlIGFwcHJvYWNoXG5leHBvcnRzLnNob3dSZXN1bHQgPSBmdW5jdGlvbihiYXNlU3RyaW5nLCBpc0ZpbmlzaGVkKSB7XG5cbiAgaWYgKGlzRmluaXNoZWQpIHtcbiAgICB2YXIgZm9ybWF0dGVkU3RyaW5nID0gYmFzZVN0cmluZy5zbGljZSgwLCAtMSk7XG4gICAgZm9ybWF0dGVkU3RyaW5nID0gZm9ybWF0dGVkU3RyaW5nLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgZm9ybWF0dGVkU3RyaW5nLnN1YnN0cmluZygxKTtcbiAgICBmb3JtYXR0ZWRTdHJpbmcgPSBmb3JtYXR0ZWRTdHJpbmcudHJpbSgpICsgJy4nO1xuICAgIGNvbnNvbGUubG9nKCdmb3JtYXR0ZWQgZmluYWwgcmVzOicsIGZvcm1hdHRlZFN0cmluZyk7XG4gICAgJCgnI3Jlc3VsdHNUZXh0JykudmFsKGZvcm1hdHRlZFN0cmluZyk7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS5sb2coJ2ludGVyaW1SZXN1bHQgcmVzOicsIGJhc2VTdHJpbmcpO1xuICAgICQoJyNyZXN1bHRzVGV4dCcpLnZhbChiYXNlU3RyaW5nKTtcbiAgfVxuXG59XG4iLCJcbnZhciBpbml0U2Vzc2lvblBlcm1pc3Npb25zID0gcmVxdWlyZSgnLi9zZXNzaW9ucGVybWlzc2lvbnMnKS5pbml0U2Vzc2lvblBlcm1pc3Npb25zO1xudmFyIGluaXRTZWxlY3RNb2RlbCA9IHJlcXVpcmUoJy4vc2VsZWN0bW9kZWwnKS5pbml0U2VsZWN0TW9kZWw7XG52YXIgaW5pdEFuaW1hdGVQYW5lbCA9IHJlcXVpcmUoJy4vYW5pbWF0ZXBhbmVsJykuaW5pdEFuaW1hdGVQYW5lbDtcbnZhciBpbml0U2hvd1RhYiA9IHJlcXVpcmUoJy4vc2hvd3RhYicpLmluaXRTaG93VGFiO1xuXG5cbmV4cG9ydHMuaW5pdFZpZXdzID0gZnVuY3Rpb24oY3R4KSB7XG4gIGNvbnNvbGUubG9nKCdJbml0aWFsaXppbmcgdmlld3MuLi4nKTtcbiAgaW5pdFNlbGVjdE1vZGVsKGN0eCk7XG4gIGluaXRTZXNzaW9uUGVybWlzc2lvbnMoKTtcbiAgaW5pdFNob3dUYWIoKTtcbiAgaW5pdEFuaW1hdGVQYW5lbCgpO1xufVxuIiwiXG5leHBvcnRzLmluaXRTZWxlY3RNb2RlbCA9IGZ1bmN0aW9uKGN0eCkge1xuXG4gIGN0eC5tb2RlbHMuZm9yRWFjaChmdW5jdGlvbihtb2RlbCkge1xuICAgICQoXCJzZWxlY3QjZHJvcGRvd25NZW51MVwiKS5hcHBlbmQoICQoXCI8b3B0aW9uPlwiKVxuICAgICAgLnZhbChtb2RlbC5uYW1lKVxuICAgICAgLmh0bWwobW9kZWwuZGVzY3JpcHRpb24pXG4gICAgICApO1xuICB9KTtcblxuICAkKFwic2VsZWN0I2Ryb3Bkb3duTWVudTFcIikuY2hhbmdlKGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciBtb2RlbE5hbWUgPSAkKFwic2VsZWN0I2Ryb3Bkb3duTWVudTFcIikudmFsKCk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRNb2RlbCcsIG1vZGVsTmFtZSk7XG4gIH0pO1xuXG59XG4iLCJcblxuZXhwb3J0cy5pbml0U2Vzc2lvblBlcm1pc3Npb25zID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUubG9nKCdJbml0aWFsaXppbmcgc2Vzc2lvbiBwZXJtaXNzaW9ucyBoYW5kbGVyJyk7XG4gIC8vIFJhZGlvIGJ1dHRvbnNcbiAgc2Vzc2lvblBlcm1pc3Npb25zUmFkaW8gPSAkKFwiI3Nlc3Npb25QZXJtaXNzaW9uc1JhZGlvR3JvdXAgaW5wdXRbdHlwZT0ncmFkaW8nXVwiKTtcbiAgc2Vzc2lvblBlcm1pc3Npb25zUmFkaW8uY2xpY2soZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIGNoZWNrZWRWYWx1ZSA9IHNlc3Npb25QZXJtaXNzaW9uc1JhZGlvLmZpbHRlcignOmNoZWNrZWQnKS52YWwoKTtcbiAgICBjb25zb2xlLmxvZygnY2hlY2tlZFZhbHVlJywgY2hlY2tlZFZhbHVlKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnc2Vzc2lvblBlcm1pc3Npb25zJywgY2hlY2tlZFZhbHVlKTtcbiAgfSk7XG59XG4iLCJcblxuZXhwb3J0cy5pbml0U2hvd1RhYiA9IGZ1bmN0aW9uKCkge1xuICAkKCcjbmF2LXRhYnMgYScpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAkKHRoaXMpLnRhYignc2hvdycpXG4gIH0pO1xufVxuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4vKmdsb2JhbCAkOmZhbHNlICovXG5cbid1c2Ugc3RyaWN0JztcblxuLy8gVE9ETzogcmVmYWN0b3IgdGhpcyBpbnRvIG11bHRpcGxlIHNtYWxsZXIgbW9kdWxlc1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG52YXIgaW5pdFNvY2tldCA9IHJlcXVpcmUoJy4vc29ja2V0JykuaW5pdFNvY2tldDtcbnZhciBNaWNyb3Bob25lID0gcmVxdWlyZSgnLi9NaWNyb3Bob25lJyk7XG52YXIgbW9kZWxzID0gcmVxdWlyZSgnLi9tb2RlbHMnKTtcbnZhciBpbml0Vmlld3MgPSByZXF1aXJlKCcuL3ZpZXdzJykuaW5pdFZpZXdzO1xudmFyIGRpc3BsYXkgPSByZXF1aXJlKCcuL3ZpZXdzL2Rpc3BsYXknKTtcblxudmFyIG1pY1NvY2tldDtcblxuJChkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKSB7XG5cblxuICBmdW5jdGlvbiBwcm9jZXNzU3RyaW5nKG1zZywgYmFzZVN0cmluZywgY2FsbGJhY2spIHtcbiAgICAvL2lmIHRoZXJlIGFyZSB0cmFuc2NyaXB0c1xuICAgIHZhciBpZHggPSArbXNnLnJlc3VsdF9pbmRleDtcbiAgICB2YXIgcnVubmluZyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3J1bm5pbmcnKSk7XG5cbiAgICBpZiAobXNnLnJlc3VsdHMgJiYgbXNnLnJlc3VsdHMubGVuZ3RoID4gMCkge1xuXG4gICAgICB2YXIgYWx0ZXJuYXRpdmVzID0gbXNnLnJlc3VsdHNbMF0uYWx0ZXJuYXRpdmVzO1xuICAgICAgdmFyIHRleHQgPSBtc2cucmVzdWx0c1swXS5hbHRlcm5hdGl2ZXNbMF0udHJhbnNjcmlwdCB8fCAnJztcblxuICAgICAgLy9DYXBpdGFsaXplIGZpcnN0IHdvcmRcbiAgICAgIC8vIGlmIGZpbmFsIHJlc3VsdHMsIGFwcGVuZCBhIG5ldyBwYXJhZ3JhcGhcbiAgICAgIGlmIChtc2cucmVzdWx0cyAmJiBtc2cucmVzdWx0c1swXSAmJiBtc2cucmVzdWx0c1swXS5maW5hbCkge1xuICAgICAgICBiYXNlU3RyaW5nICs9IHRleHQ7XG4gICAgICAgIGNvbnNvbGUubG9nKCdmaW5hbCByZXM6JywgYmFzZVN0cmluZyk7XG4gICAgICAgIGRpc3BsYXkuc2hvd1Jlc3VsdChiYXNlU3RyaW5nLCB0cnVlKTtcbiAgICAgICAgZGlzcGxheS5zaG93TWV0YURhdGEoYWx0ZXJuYXRpdmVzWzBdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciB0ZW1wU3RyaW5nID0gYmFzZVN0cmluZyArIHRleHQ7XG4gICAgICAgIGNvbnNvbGUubG9nKCdpbnRlcmltUmVzdWx0IHJlczonLCB0ZW1wU3RyaW5nKTtcbiAgICAgICAgZGlzcGxheS5zaG93UmVzdWx0KHRlbXBTdHJpbmcsIGZhbHNlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGFsdGVybmF0aXZlcykge1xuICAgICAgZGlzcGxheS5zaG93QWx0ZXJuYXRpdmVzKGFsdGVybmF0aXZlcyk7XG4gICAgfVxuICAgIHJldHVybiBiYXNlU3RyaW5nO1xuICB9XG5cbiAgZnVuY3Rpb24gaW5pdEZpbGVVcGxvYWQodG9rZW4sIG1vZGVsLCBmaWxlLCBjYWxsYmFjaykge1xuXG4gICAgdmFyIGJhc2VTdHJpbmcgPSAnJztcbiAgICB2YXIgYmFzZUpTT04gPSAnJztcblxuICAgIHZhciBvcHRpb25zID0ge307XG4gICAgb3B0aW9ucy50b2tlbiA9IHRva2VuO1xuICAgIG9wdGlvbnMubWVzc2FnZSA9IHtcbiAgICAgICdhY3Rpb24nOiAnc3RhcnQnLFxuICAgICAgJ2NvbnRlbnQtdHlwZSc6ICdhdWRpby9sMTY7cmF0ZT00NDEwMCcsXG4gICAgICAnaW50ZXJpbV9yZXN1bHRzJzogdHJ1ZSxcbiAgICAgICdjb250aW51b3VzJzogdHJ1ZSxcbiAgICAgICd3b3JkX2NvbmZpZGVuY2UnOiB0cnVlLFxuICAgICAgJ3RpbWVzdGFtcHMnOiB0cnVlLFxuICAgICAgJ21heF9hbHRlcm5hdGl2ZXMnOiAzXG4gICAgfTtcbiAgICBvcHRpb25zLm1vZGVsID0gbW9kZWwubmFtZTtcblxuICAgIGZ1bmN0aW9uIG9uT3Blbihzb2NrZXQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdzb2NrZXQgb3BlbmVkJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25MaXN0ZW5pbmcoc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZygnY29ubmVjdGlvbiBsaXN0ZW5pbmcnKTtcbiAgICAgIGNhbGxiYWNrKHNvY2tldCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25NZXNzYWdlKG1zZykge1xuICAgICAgY29uc29sZS5sb2coJ3dzIG1zZycsIG1zZyk7XG4gICAgICBpZiAobXNnLnJlc3VsdHMpIHtcbiAgICAgICAgYmFzZVN0cmluZyA9IHByb2Nlc3NTdHJpbmcobXNnLCBiYXNlU3RyaW5nKTtcbiAgICAgICAgYmFzZUpTT04gPSBkaXNwbGF5LnNob3dKU09OKG1zZywgYmFzZUpTT04pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uRXJyb3IoZXJyKSB7XG4gICAgICBjb25zb2xlLmxvZygnZXJyJywgZXJyKTtcbiAgICB9XG5cbiAgICBpbml0U29ja2V0KG9wdGlvbnMsIG9uT3Blbiwgb25MaXN0ZW5pbmcsIG9uTWVzc2FnZSwgb25FcnJvcik7XG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGluaXRNaWNyb3Bob25lKHRva2VuLCBtb2RlbCwgbWljLCBjYWxsYmFjaykge1xuICAgIC8vIFRlc3Qgb3V0IHdlYnNvY2tldFxuICAgIHZhciBiYXNlU3RyaW5nID0gJyc7XG4gICAgdmFyIGJhc2VKU09OID0gJyc7XG5cbiAgICB2YXIgb3B0aW9ucyA9IHt9O1xuICAgIG9wdGlvbnMudG9rZW4gPSB0b2tlbjtcbiAgICBvcHRpb25zLm1lc3NhZ2UgPSB7XG4gICAgICAnYWN0aW9uJzogJ3N0YXJ0JyxcbiAgICAgICdjb250ZW50LXR5cGUnOiAnYXVkaW8vbDE2O3JhdGU9MTYwMDAnLFxuICAgICAgJ2ludGVyaW1fcmVzdWx0cyc6IHRydWUsXG4gICAgICAnY29udGludW91cyc6IHRydWUsXG4gICAgICAnd29yZF9jb25maWRlbmNlJzogdHJ1ZSxcbiAgICAgICd0aW1lc3RhbXBzJzogdHJ1ZSxcbiAgICAgICdtYXhfYWx0ZXJuYXRpdmVzJzogM1xuICAgIH07XG4gICAgb3B0aW9ucy5tb2RlbCA9IG1vZGVsO1xuXG4gICAgZnVuY3Rpb24gb25PcGVuKHNvY2tldCkge1xuICAgICAgY29uc29sZS5sb2coJ3NvY2tldCBvcGVuZWQnKTtcbiAgICAgIGNhbGxiYWNrKHNvY2tldCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25MaXN0ZW5pbmcoc29ja2V0KSB7XG5cbiAgICAgIG1pY1NvY2tldCA9IHNvY2tldDtcblxuICAgICAgbWljLm9uQXVkaW8gPSBmdW5jdGlvbihibG9iKSB7XG4gICAgICAgIGlmIChzb2NrZXQucmVhZHlTdGF0ZSA8IDIpIHtcbiAgICAgICAgICBzb2NrZXQuc2VuZChibG9iKVxuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uTWVzc2FnZShtc2csIHNvY2tldCkge1xuICAgICAgY29uc29sZS5sb2coJ3dzIG1zZycsIG1zZyk7XG4gICAgICBpZiAobXNnLnJlc3VsdHMpIHtcbiAgICAgICAgYmFzZVN0cmluZyA9IHByb2Nlc3NTdHJpbmcobXNnLCBiYXNlU3RyaW5nKTtcbiAgICAgICAgYmFzZUpTT04gPSBkaXNwbGF5LnNob3dKU09OKG1zZywgYmFzZUpTT04pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uRXJyb3IoZXJyLCBzb2NrZXQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdlcnInLCBlcnIpO1xuICAgIH1cblxuICAgIGluaXRTb2NrZXQob3B0aW9ucywgb25PcGVuLCBvbkxpc3RlbmluZywgb25NZXNzYWdlLCBvbkVycm9yKTtcblxuICB9XG5cbiAgLy8gTWFrZSBjYWxsIHRvIEFQSSB0byB0cnkgYW5kIGdldCB0b2tlblxuICB2YXIgdXJsID0gJy90b2tlbic7XG4gIHZhciB0b2tlblJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgdG9rZW5SZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgdXJsLCB0cnVlKTtcbiAgdG9rZW5SZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKGV2dCkge1xuXG4gICAgdmFyIHRva2VuID0gdG9rZW5SZXF1ZXN0LnJlc3BvbnNlVGV4dDtcbiAgICBjb25zb2xlLmxvZygnVG9rZW4gJywgZGVjb2RlVVJJQ29tcG9uZW50KHRva2VuKSk7XG5cbiAgICB2YXIgbWljID0gbmV3IE1pY3JvcGhvbmUoKTtcblxuICAgIHZhciBtb2RlbE9wdGlvbnMgPSB7XG4gICAgICB0b2tlbjogdG9rZW5cbiAgICAgIC8vIFVuY29tbWVudCBpbiBjYXNlIG9mIHNlcnZlciBDT1JTIGZhaWx1cmVcbiAgICAgIC8vIHVybDogJy9hcGkvbW9kZWxzJ1xuICAgIH07XG5cbiAgICAvLyBHZXQgYXZhaWxhYmxlIHNwZWVjaCByZWNvZ25pdGlvbiBtb2RlbHNcbiAgICAvLyBTZXQgdGhlbSBpbiBzdG9yYWdlXG4gICAgLy8gQW5kIGRpc3BsYXkgdGhlbSBpbiBkcm9wLWRvd25cbiAgICBtb2RlbHMuZ2V0TW9kZWxzKG1vZGVsT3B0aW9ucywgZnVuY3Rpb24obW9kZWxzKSB7XG5cbiAgICAgIGNvbnNvbGUubG9nKCdTVFQgTW9kZWxzICcsIG1vZGVscyk7XG5cbiAgICAgIC8vIFNhdmUgbW9kZWxzIHRvIGxvY2Fsc3RvcmFnZVxuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21vZGVscycsIEpTT04uc3RyaW5naWZ5KG1vZGVscykpO1xuXG4gICAgICAvLyBTZXQgZGVmYXVsdCBjdXJyZW50IG1vZGVsXG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudE1vZGVsJywgJ2VuLVVTX0Jyb2FkYmFuZE1vZGVsJyk7XG5cblxuICAgICAgLy8gU2VuZCBtb2RlbHMgYW5kIG90aGVyXG4gICAgICAvLyB2aWV3IGNvbnRleHQgdG8gdmlld3NcbiAgICAgIHZhciB2aWV3Q29udGV4dCA9IHtcbiAgICAgICAgbW9kZWxzOiBtb2RlbHNcbiAgICAgIH07XG5cbiAgICAgIGZ1bmN0aW9uIGhhbmRsZUZpbGVVcGxvYWRFdmVudChldnQpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ2hhbmRsaW5nIGZpbGUgZHJvcCBldmVudCcpO1xuICAgICAgICAvLyBJbml0IGZpbGUgdXBsb2FkIHdpdGggZGVmYXVsdCBtb2RlbFxuICAgICAgICB2YXIgZmlsZSA9IGV2dC5kYXRhVHJhbnNmZXIuZmlsZXNbMF07XG4gICAgICAgIHZhciBjdXJyZW50TW9kZWwgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudE1vZGVsJyk7XG4gICAgICAgIGluaXRGaWxlVXBsb2FkKHRva2VuLCBjdXJyZW50TW9kZWwsIGZpbGUsIGZ1bmN0aW9uKHNvY2tldCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdVcGxvYWRpbmcgZmlsZScsIGZpbGUpO1xuICAgICAgICAgIHZhciBibG9iID0gbmV3IEJsb2IoW2ZpbGVdLCB7dHlwZTogJ2F1ZGlvL2wxNjtyYXRlPTQ0MTAwJ30pO1xuICAgICAgICAgIHV0aWxzLnBhcnNlRmlsZShibG9iLCBmdW5jdGlvbihjaHVuaykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ0hhbmRsaW5nIGNodW5rJywgY2h1bmspO1xuICAgICAgICAgICAgc29ja2V0LnNlbmQoY2h1bmspO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgY29uc29sZS5sb2coJ3NldHRpbmcgdGFyZ2V0Jyk7XG5cbiAgICAgIHZhciB0YXJnZXQgPSAkKFwiI2ZpbGVVcGxvYWRUYXJnZXRcIik7XG4gICAgICB0YXJnZXQub24oJ2RyYWdlbnRlcicsIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdkcmFnZW50ZXInKTtcbiAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfSk7XG5cbiAgICAgIHRhcmdldC5vbignZHJhZ292ZXInLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICBjb25zb2xlLmxvZygnZHJhZ292ZXInKTtcbiAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfSk7XG5cbiAgICAgIHRhcmdldC5vbignZHJvcCcsIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdGaWxlIGRyb3BwZWQnKTtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB2YXIgZXZ0ID0gZS5vcmlnaW5hbEV2ZW50O1xuICAgICAgICAvLyBIYW5kbGUgZHJhZ2dlZCBmaWxlIGV2ZW50XG4gICAgICAgIGhhbmRsZUZpbGVVcGxvYWRFdmVudChldnQpO1xuICAgICAgfSk7XG5cbiAgICAgIGluaXRWaWV3cyh2aWV3Q29udGV4dCk7XG5cblxuICAgICAgLy8gU2V0IG1pY3JvcGhvbmUgc3RhdGUgdG8gbm90IHJ1bm5pbmdcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdydW5uaW5nJywgZmFsc2UpO1xuXG4gICAgICB2YXIgcmVjb3JkQnV0dG9uID0gJCgnI3JlY29yZEJ1dHRvbicpO1xuICAgICAgcmVjb3JkQnV0dG9uLmNsaWNrKCQucHJveHkoZnVuY3Rpb24oZXZ0KSB7XG5cbiAgICAgICAgLy8gUHJldmVudCBkZWZhdWx0IGFuY2hvciBiZWhhdmlvclxuICAgICAgICBldnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICB2YXIgcnVubmluZyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3J1bm5pbmcnKSk7XG5cbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3J1bm5pbmcnLCAhcnVubmluZyk7XG5cbiAgICAgICAgY29uc29sZS5sb2coJ2NsaWNrIScpO1xuXG4gICAgICAgIHZhciBjdXJyZW50TW9kZWwgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudE1vZGVsJyk7XG5cbiAgICAgICAgY29uc29sZS5sb2coJ3J1bm5pbmcgc3RhdGUnLCBydW5uaW5nKTtcblxuICAgICAgICBpZiAoIXJ1bm5pbmcpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnTm90IHJ1bm5pbmcsIGluaXRNaWNyb3Bob25lKCknKTtcbiAgICAgICAgICByZWNvcmRCdXR0b24uY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJyNkNzQxMDgnKTtcbiAgICAgICAgICByZWNvcmRCdXR0b24uZmluZCgnaW1nJykuYXR0cignc3JjJywgJ2ltZy9zdG9wLnN2ZycpO1xuICAgICAgICAgIGluaXRNaWNyb3Bob25lKHRva2VuLCBjdXJyZW50TW9kZWwsIG1pYywgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICAgICByZWNvcmRCdXR0b24uY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywgJyNkNzQxMDgnKTtcbiAgICAgICAgICAgIHJlY29yZEJ1dHRvbi5maW5kKCdpbWcnKS5hdHRyKCdzcmMnLCAnaW1nL3N0b3Auc3ZnJyk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnc3RhcnRpbmcgbWljJyk7XG4gICAgICAgICAgICBtaWMucmVjb3JkKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1N0b3BwaW5nIG1pY3JvcGhvbmUsIHNlbmRpbmcgc3RvcCBhY3Rpb24gbWVzc2FnZScpO1xuICAgICAgICAgIHJlY29yZEJ1dHRvbi5yZW1vdmVBdHRyKCdzdHlsZScpO1xuICAgICAgICAgIHJlY29yZEJ1dHRvbi5maW5kKCdpbWcnKS5hdHRyKCdzcmMnLCAnaW1nL21pY3JvcGhvbmUuc3ZnJyk7XG4gICAgICAgICAgLy8gbWljU29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoeydhY3Rpb24nOiAnc3RvcCd9KSk7XG4gICAgICAgICAgdmFyIGVtcHR5QnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKDApO1xuICAgICAgICAgIG1pY1NvY2tldC5zZW5kKGVtcHR5QnVmZmVyKTtcbiAgICAgICAgICBtaWMuc3RvcCgpO1xuICAgICAgICB9XG5cbiAgICAgIH0sIHRoaXMpKTtcblxuICAgIH0pO1xuICB9XG4gIHRva2VuUmVxdWVzdC5zZW5kKCk7XG5cbn0pO1xuXG4iXX0=
