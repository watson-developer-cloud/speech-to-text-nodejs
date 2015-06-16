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

 
  function showJSON(json, baseJSON) {
    baseJSON += json;
    $('#resultsJSON').val(baseJSON);
  }

  function showResult(data, baseString) {
    //if there are transcripts
    if (data.results && data.results.length > 0) {

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
      'content-type': 'audio/l16', //;rate=' + model.rate,
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
          var blob = new Blob([file], {type: 'audio/l16'});
          parseFile(blob, function(chunk) {
            console.log('Handling chunk', chunk);
            // socket.send(chunk);
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


  function initSpeech(socket) {

    var mic = new Microphone();

    var running = false;
    var recordButton = document.getElementById("recordButton");
    recordButton.onclick = function(evt) {
      if (running) {
        console.log('stopping mic');
        mic.stop();
        running = false;
      } else {
        console.log('starting mic');
        mic.record();
        running = true;
      }
    };
    var count = 0;
    mic.onAudio = function(blob) {
      // setTimeout(function() {
        socket.send(blob)
      // }, count * 100);
      // count++;
    };


    function onError(err) {
      console.log('audio error: ', err);
    }

  }

  function initMicrophone(token, model) {
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
    getSocket(options, function() {}, function(evt) {
      console.log('ws msg', evt.data);
      var json = evt.data;
      var msg = JSON.parse(json);
      if (msg.results) {
        showResult(msg, baseString);
        showJSON(JSON.stringify(msg.results), baseJSON);
      }
    }, function(err) {
      console.log('err', err);
    });
  }

  function initUI(token, model) {
    initFileUpload(token, model);
    // initMicrophone(token, model);
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
      var modelObject = getModelObject(models, 'en-US_BroadbandModel');
      console.log('initUI', modelObject);
      if (modelObject) {
        initUI(token, modelObject);
      }
      // Re-initialize UI when model changes
      // $("select#dropdownMenu1").change(function(evt) {
      //   var modelName = $("select#dropdownMenu1").val();
      //   var model = getModelObject(models, modelName);
      //   if (model) {
      //     initUI(token, model);
      //   }
      // });
    });
  }
  tokenRequest.send();


});

