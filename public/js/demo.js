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

  var speech = new SpeechRecognition({
    ws: 'ws://127.0.0.1:8020/speech-to-text-beta/api/v1/recognize',
    model: 'WatsonModel'
  });

  speech.onresult = function(result) {
    console.log('got a result: ', result);
  };

  speech.onerror = function(err) {
    console.log('got a error: ', err);
  };

  // Test out library
  var sampleUrl = 'audio/sample1.flac';
  var sampleRequest = new XMLHttpRequest();
  sampleRequest.open("GET", sampleUrl, true);
  sampleRequest.responseType = 'blob';
  sampleRequest.onload = function(evt) {
    console.log('speech started...');
    var blob = sampleRequest.response;
    var trimmedBlob = blob.slice(0, 4);
    var reader = new FileReader();
    reader.addEventListener("loadend", function() {
      console.log('state', reader.readyState);
      console.log('bytes', reader.result);
      if (reader.result === 'fLaC') {
        speech._init('audio/flac');
      } else {
        speech._init('audio/l16;rate=48000');
      }
      speech.onstart = function(evt) {
        speech.recognize(sampleRequest.response);
      };
    });
    reader.readAsText(trimmedBlob);
  };
  sampleRequest.send();

  // Test out token
  var tokenUrl = '/token';
  var tokenRequest = new XMLHttpRequest();
  tokenRequest.open("GET", tokenUrl, true);
  tokenRequest.onload = function(evt) {
    // console.log('token ', tokenRequest.responseText);
    // console.log('response', request.responseText);
    // var xhr = new XMLHttpRequest();
    // var url = 'https://stream-d.watsonplatform.net/text-to-speech-beta/api/v1/voices';
    // xhr.open('GET', url, true);
    // xhr.setRequestHeader('X-Watson-Authorization-Token', request.responseText);
    // xhr.setRequestHeader('Authorization ', 'none');
    // xhr.send();
    // xhr.onload = function(evt) {
    //   console.log('speech data', xhr.responseText);
    //   alert('responsetext', xhr.responseText);
    // };
  };
  tokenRequest.send();

  var modelsUrl = '/v1/models';
  var modelsRequest = new XMLHttpRequest();
  modelsRequest.open("GET", modelsUrl, true);
  // request.setRequestHeader('Authorization', 'Basic ' + creds);
  modelsRequest.onload = function(evt) {
    // console.log('token ', request.responseText);
  };
  modelsRequest.send();


// Service
  // var recording = false,
  //   speech = new SpeechRecognition({
  //     ws: 'ws://127.0.0.1:8020/speech-to-text-beta/api/v1/recognize',
  //     model: 'WatsonModel'
  //   });

  // speech.onstart = function() {
  //   console.log('demo.onstart()');
  //   recording = true;
  //   micButton.addClass('recording');
  //   micText.text('Press again when finished');
  //   errorMsg.hide();
  //   transcript.show();
  //
  //   // Clean the paragraphs
  //   transcript.empty();
  //   $('<p></p>').appendTo(transcript);
  // };
  //
  // speech.onerror = function(error) {
  //   // console.log('demo.onerror():', error);
  //   // recording = false;
  //   // micButton.removeClass('recording');
  //   displayError(error);
  // };
  //
  // speech.onend = function() {
  //   console.log('demo.onend()');
  //   recording = false;
  //   micButton.removeClass('recording');
  //   micText.text('Press to start speaking');
  // };
  //
  // speech.onresult = function(data) {
  //   console.log('demo.onresult()', data);
  //   showResult(data);
  // };
  //
  // micButton.click(function() {
  //   if (!recording) {
  //     speech.start();
  //   } else {
  //     speech.stop();
  //     micButton.removeClass('recording');
  //     micText.text('Processing speech');
  //   }
  // });

  function showResult(data) {
    //console.log(data);
    //if there are transcripts
    if (data.results && data.results.length > 0) {

      //if is a partial transcripts
      if (data.results.length === 1 ) {
        var paragraph = transcript.children().last(),
          text = data.results[0].alternatives[0].transcript || '';

        console.log('text', text);
        //Capitalize first word
        text = text.charAt(0).toUpperCase() + text.substring(1);
        // if final results, append a new paragraph
        // if (data.results[0].final){
        text = text.trim() + '.';
        $('.loading').hide();
        $('#text').append(text);
        // }
        // paragraph.text(text);
      }
    }
    // transcript.show();
  }

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

  function stopSounds() {
    $('.sample2').get(0).pause();
    $('.sample2').get(0).currentTime = 0;
    $('.sample1').get(0).pause();
    $('.sample1').get(0).currentTime = 0;
  }

  $('.audio1').click(function() {
    $('.audio-staged audio').attr('src', audio1);
    stopSounds();
    $('.sample1').get(0).play();
  });

  $('.audio2').click(function() {
    $('.audio-staged audio').attr('src', audio2);
    stopSounds();
    $('.sample2').get(0).play();
  });

  $('.send-api-audio1').click(function() {
    transcriptAudio(audio1);
  });

  $('.send-api-audio2').click(function() {
    transcriptAudio(audio2);
  });

  function showAudioResult(data){
    $('.loading').hide();
    transcript.empty();
    $('<p></p>').appendTo(transcript);
    showResult(data);
  }
  // submit event
  function transcriptAudio(audio) {
    $('.loading').show();
    $('.error').hide();
    transcript.hide();
    $('.url-input').val(audio);
    $('.upload-form').hide();
    // Grab all form data
    $.ajax({
      url: '/',
      type: 'POST',
      data: $('.upload-form').serialize(),
      success: showAudioResult,
      error: _error
    });
  }
  // var ws = new WebSocket('ws://127.0.0.1:8020/speech-to-text-beta/api/v1/recognize');
  // window.ws = ws;
  // ws.onopen = function(evt) {
  //   console.log('loading');
  //   ws.send(JSON.stringify({'action': 'start', 'content-type': 'audio/l16;rate=48000'}));
  // };
  //
  // ws.onmessage = function(evt) { 
  //   console.log('msg ', evt.data); 
  //   var data = JSON.parse(evt.data);
  //   showResult(data);
  // };
  //
  // ws.onerror = function(evt) { 
  //   console.log('error ', evt); 
  // };

  function sendDraggedFile(file) {
    $('.loading').show();
    console.log('loading blob: ');
    // ws.send(file);
    // ws.send(JSON.stringify({'action': 'stop'}));
  }

  function handleFileUploadEvent(evt) {
    console.log('uploading file');
    var file = evt.dataTransfer.files[0];
    var objectUrl = URL.createObjectURL(file);
    sendDraggedFile(file);
    $('.custom.sample-title').text(file.name);
    $('.audio3').click(function() {
      console.log('evt', evt);
      $('.sample3').prop('src', objectUrl);
      stopSounds();
      $('.sample3').get(0).play();
    });
    $('.send-api-audio3').click(function() {
      console.log('click! API');
      sendDraggedFile(file);
    });
  }

  var target = $("#fileUploadTarget");
  target.on('dragenter', function (e) {
      e.stopPropagation();
      e.preventDefault();
      $(this).css('border', '2px solid #0B85A1');
  });

  target.on('dragover', function (e) {
       e.stopPropagation();
       e.preventDefault();
  });

  target.on('drop', function (e) {
   
       $(this).css('border', '2px dotted #0B85A1');
       e.preventDefault();
       var evt = e.originalEvent;
   
       // Handle dragged file event
       handleFileUploadEvent(evt);
  });


});
