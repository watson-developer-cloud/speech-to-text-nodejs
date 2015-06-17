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

var wsUrl = 'ws://127.0.0.1:8020/speech-to-text-beta/api/v1/recognize';

// From alediaferia's SO response
// http://stackoverflow.com/questions/14438187/javascript-filereader-parsing-long-file-in-chunks
function parseFile(file, callback) {
    var fileSize   = file.size;
    var chunkSize  = 2048 * 16; // bytes
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
            var finalBlob = utils.exportDataBuffer(buffer, len);
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


function getModels(token, callback) {
  // var modelUrl = 'https://stream-s.watsonplatform.net/speech-to-text-beta/api/v1/models';
  var modelUrl = '/api/models';
  var sttRequest = new XMLHttpRequest();
  sttRequest.open("GET", modelUrl, true);
  sttRequest.withCredentials = true;
  sttRequest.setRequestHeader('Accept', 'application/json');
  sttRequest.setRequestHeader('X-Watson-Authorization-Token', token);
  sttRequest.onload = function(evt) {
    // We wait until we've given this request a chance to load and (ideally) set the cookie
    // But we get a net::ERR_CONNECTION_REFUSED, apparantly because no cookie is set
    var response = JSON.parse(sttRequest.responseText);
    callback(response.models);
  };
  sttRequest.send();
}

$(document).ready(function() {

  // Only works on Chrome
  if (!$('body').hasClass('chrome')) {
    $('.unsupported-overlay').show();
  }

  // UI
  var micButton = $('.micButton'),
  micText = $('.micText'),
  transcript = $('#text'),
  errorMsg = $('.errorMsg');


  function displayError(error) {
    var message = error;
    try {
      var errorJson = JSON.parse(error);
      message = JSON.stringify(errorJson, null, 2);
    } catch (e) {
      message = error;
    }

    errorMsg.text(message);
    errorMsg.show();
    transcript.hide();
  }

  //Sample audios
  var audio1 = 'audio/sample1.wav',
      audio2 = 'audio/sample2.wav';

  function _error(xhr) {
    $('.loading').hide();
    displayError('Error processing the request, please try again.');
  }


  // function stopSounds() {
  //   $('.sample2').get(0).pause();
  //   $('.sample2').get(0).currentTime = 0;
  //   $('.sample1').get(0).pause();
  //   $('.sample1').get(0).currentTime = 0;
  // }
  //
  // $('.audio1').click(function() {
  //   $('.audio-staged audio').attr('src', audio1);
  //   stopSounds();
  //   $('.sample1').get(0).play();
  // });
  //
  // $('.audio2').click(function() {
  //   $('.audio-staged audio').attr('src', audio2);
  //   stopSounds();
  //   $('.sample2').get(0).play();
  // });
  //
  // $('.send-api-audio1').click(function() {
  //   transcriptAudio(audio1);
  // });
  //
  // $('.send-api-audio2').click(function() {
  //   transcriptAudio(audio2);
  // });
  //
  // function showAudioResult(data){
  //   $('.loading').hide();
  //   transcript.empty();
  //   $('<p></p>').appendTo(transcript);
  //   showResult(data);
  // }
  //

  function showMetaData(timestamps) {
    timestamps.forEach(function(timestamp) {
      var word = timestamp[0],
        t0 = timestamp[1],
        t1 = timestamp[2];
      var timelength = t1 - t0;
      $('.table-header-row').append('<th>' + word + '</th>');
      $('.time-length-row').append('<td>' + timelength.toString().slice(0, 3) + ' s</td>');
    });
  }

  function showAlternatives(alternatives) {
    var $hypotheses = $('.hypotheses ul');
    $hypotheses.html('');
    alternatives.forEach(function(alternative, idx) {
      $hypotheses.append('<li data-hypothesis-index=' + idx + ' >' + alternative.transcript + '</li>');
    });
    $hypotheses.on('click', "li", function () {
      console.log("showing metadata");
      var idx = + $(this).data('hypothesis-index');
      var timestamps = alternatives[idx].timestamps;
      showMetaData(timestamps);
    });
  }


  function showJSON(msg, baseJSON) {
    var json = JSON.stringify(msg);
    baseJSON += json;
    baseJSON += '\n';
    $('#resultsJSON').val(baseJSON);
    return baseJSON;
  }

  // TODO: Convert to closure approach
  function showResult(baseString, isFinished) {

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
        showResult(baseString, true);
      } else {
        var tempString = baseString + text;
        console.log('interimResult res:', tempString);
        showResult(tempString, false);
      }

    }

    if (alternatives) {
      showAlternatives(alternatives);
      showMetaData(alternatives[0].timestamps);
    }

    return baseString;

  }

  function initFileUpload(token, model) {

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
    options.serviceURI = wsUrl += '?model=' + model.name;

    initSocket(options, function(socket) {

        function handleFileUploadEvent(evt) {
          console.log('Uploading file');
          var file = evt.dataTransfer.files[0];
          var blob = new Blob([file], {type: 'audio/l16;rate=44100'});
          parseFile(blob, function(chunk) {
            console.log('Handling chunk', chunk);
            socket.send(chunk);
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

      }, function(msg) {
        console.log('ws msg', msg);
        if (msg.results) {
          processString(msg, baseString);
          showJSON(msg, baseJSON);
        }
      }, function(err) {
        console.log('err', err);
      }
    );

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
    options.model = model.name;
    options.serviceURI = wsUrl += '?model=' + model.name;

    initSocket(options, function(socket) {

      var micSocket = socket;

      mic.onAudio = function(blob) {
        if (socket.readyState < 2) {
          socket.send(blob)
        }
      };

      callback(socket);

    }, function(msg, socket) {
      console.log('ws msg', msg);
      if (msg.results) {
        baseString = processString(msg, baseString);
        baseJSON = showJSON(msg, baseJSON);
      }
      var running = JSON.parse(localStorage.getItem('running'));
      var resultIndex = msg.result_index;
      if (msg.results && msg.results[0].final && !running) {
        stopMicrophone(socket, function(result) {
          console.log('mic stopped: ', result);
        });
      }
    }, function(err, socket) {
      console.log('err', err);
    });

    function onError(err) {
      console.log('audio error: ', err);
    }

  }

  function stopMicrophone(socket, callback) {
    socket.send(JSON.stringify({'action': 'stop'}));
    callback(true);
  }

  function getModelObject(models, modelName) {
    var result = null;
    models.forEach(function(model) {
      if (model.name === modelName) {
        result = model;
      }
    });
    return result;
  }

  // Make call to API to try and get cookie
  // var url = '/token';
  // var tokenRequest = new XMLHttpRequest();
  // tokenRequest.open("GET", url, true);
  // tokenRequest.onload = function(evt) {
    // var token = tokenRequest.responseText;
    // console.log('Token ', decodeURIComponent(token));
  function init() {
    // Get available speech recognition models
    // And display them in drop-down
    var mic = new Microphone();
    var token = 'blah';
    getModels(token, function(models) {

      console.log('STT Models ', models);

      // Save models to localstorage
      localStorage.setItem('models', JSON.stringify(models));

      models.forEach(function(model) {
        $("select#dropdownMenu1").append( $("<option>")
          .val(model.name)
          .html(model.description)
          );
      });

      // Initialize UI with default model
      // TODO: need to wait to send start message
      var modelObject = getModelObject(models, 'en-US_BroadbandModel');
      var modelObject = {name: 'en-US_BroadbandModel'};

      localStorage.setItem('running', false);
      var recordButton = $('#recordButton');

      // Radio buttons
      var shareSessionRadio = $("#shareSessionRadioGroup input[type='radio']");
      shareSessionRadio.click(function(evt) {
        var checkedValue = shareSessionRadio.filter(':checked').val();
        localStorage.setItem('shareSession', checkedValue);
        console.log('checked option', checkedValue);
      });

      recordButton.click($.proxy(function(evt) {

        var running = JSON.parse(localStorage.getItem('running'));

        localStorage.setItem('running', !running);

        console.log('click!');

        evt.preventDefault();
        // evt.stopPropagation();

        console.log('running state', running);

        if (!running) {
          console.log('not running, initMicrophone');
          recordButton.css('background-color', '#d74108');
          recordButton.find('img').attr('src', 'img/stop.svg');
          console.log('starting mic');
          initMicrophone(token, modelObject, mic, function(result) {
            recordButton.css('background-color', '#d74108');
            recordButton.find('img').attr('src', 'img/stop.svg');
            console.log('starting mic');
            mic.record();
          });
        } else {
          recordButton.removeAttr('style');
          recordButton.find('img').attr('src', 'img/microphone.svg');
          mic.stop();
        }

      }, this));

      // Re-initialize event listener with appropriate model when model changes
      $("#dropdownMenu1").change(function(evt) {
        var modelName = $("select#dropdownMenu1").val();
        localStorage.setItem('currentModel', modelName);
        var newModelObject = getModelObject(models, modelName);
      });

      // Re-initialize event listener with appropriate model when model changes
      $("select#dropdownMenu1").change(function(evt) {
        var modelName = $("select#dropdownMenu1").val();
        localStorage.setItem('currentModel', modelName);
        var newModelObject = getModelObject(models, modelName);
      });

    });
  }
  init();
  // tokenRequest.send();

});
