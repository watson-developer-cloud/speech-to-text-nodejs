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

$(document).ready(function() {

  // Only works on Chrome
  if (!$('body').hasClass('chrome')) {
    $('.unsupported-overlay').show();
  }

  // UI
  var micButton = $('.micButton'),
  micText = $('.micText'),
  transcript = $('#text'),
  errorMsg = $('.errorMsg'),
  modelSet = false;


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
  var sockets = {};

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

 
  function showJSON(json, baseJSON) {
    baseJSON += json;
    $('#resultsJSON').val(baseJSON);
  }

  // TODO: Convert to closure approach
  function showResult(data, baseString) {
    //if there are transcripts
    if (data.results && data.results.length > 0) {

      // showMetaData(data.results[0].alternatives[0].timestamps);

      var text = data.results[0].alternatives[0].transcript || '';

      //if is a partial transcripts
      if (data.results.length === 1 ) {

        //Capitalize first word
        // if final results, append a new paragraph
        if (data.results[0].final){
          console.log('final res:', text);
          baseString += text;
          baseString = baseString.charAt(0).toUpperCase() + baseString.substring(1);
          baseString = baseString.trim() + '.';
          $('#resultsText').val(baseString);
        } else {
          console.log('interimResult res:', text);
          var temp = baseString + text;
          $('#resultsText').val(temp);
        }
      }
    }
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

    getSocket(options, function(socket) {

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
          showResult(msg, baseString);
          showJSON(JSON.stringify(msg.results), baseJSON);
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
    getSocket(options, function(socket) {

      mic.onAudio = function(blob) {
        socket.send(blob)
      };

      callback(socket);

      sockets[model.name] = socket;

    }, function(msg) {
      console.log('ws msg', msg);
      if (msg.results) {
        showResult(msg, baseString);
        showJSON(JSON.stringify(msg.results), baseJSON);
      }
    }, function(err) {
      console.log('err', err);
    });

    function onError(err) {
      console.log('audio error: ', err);
    }

  }

  function stopMicrophone(socket, callback) {
    socket.send(JSON.stringify({'action': 'stop'}));
    callback(socket);
  }

  function setMicrophoneListener(modelObject, token, callback) {

    // recordButton.unbind('click');

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
  var url = '/token';
  var tokenRequest = new XMLHttpRequest();
  tokenRequest.open("GET", url, true);
  tokenRequest.onload = function(evt) {
    var token = tokenRequest.responseText;
    console.log('Token ', decodeURIComponent(token));
    // Get available speech recognition models
    // And display them in drop-down
    getModels(token, function(models) {

      console.log('STT Models ', models);
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

      var running = false;
      var recordButton = $('#recordButton');

      recordButton.click(function(evt) {

        var mic = new Microphone();

        console.log('click!');

        evt.preventDefault();
        // evt.stopPropagation();

        console.log('running state', running);

        if (!running) {
          initMicrophone(token, modelObject, mic, function(result) {
            recordButton.css('background-color', '#d74108');
            recordButton.find('img').attr('src', 'img/stop.svg');
            console.log('starting mic');
            mic.record();
          });
        } else {
          console.log('stopping mic');
          recordButton.removeAttr('style');
          recordButton.find('img').attr('src', 'img/microphone.svg');
          mic.stop();
          sockets[modelObject.name].send(JSON.stringify({'action': 'stop'}));
        }

        running = !running;

      });
      
      // Re-initialize event listener with appropriate model when model changes
      $("select#dropdownMenu1").change(function(evt) {
        var modelName = $("select#dropdownMenu1").val();
        var newModelObject = getModelObject(models, modelName);
        setMicrophoneListener(mic, modelObject, token);
      });

    });
  }
  tokenRequest.send();

});

