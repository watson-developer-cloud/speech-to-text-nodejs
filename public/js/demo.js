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

  // Service
  var recording = false,
    speech = new SpeechRecognizer({
      ws: '',
      model: 'WatsonModel'
    });

  speech.onstart = function() {
    console.log('demo.onstart()');
    recording = true;
    micButton.addClass('recording');
    micText.text('Press again when finished');
    errorMsg.hide();
    transcript.show();

    // Clean the paragraphs
    transcript.empty();
    $('<p></p>').appendTo(transcript);
  };

  speech.onerror = function(error) {
    console.log('demo.onerror():', error);
    recording = false;
    micButton.removeClass('recording');
    displayError(error);
  };

  speech.onend = function() {
    console.log('demo.onend()');
    recording = false;
    micButton.removeClass('recording');
    micText.text('Press to start speaking');
  };

  speech.onresult = function(data) {
    //console.log('demo.onresult()');
    showResult(data);
  };

  micButton.click(function() {
    if (!recording) {
      speech.start();
    } else {
      speech.stop();
      micButton.removeClass('recording');
      micText.text('Processing speech');
    }
  });

  function showResult(data) {
    //console.log(data);
    //if there are transcripts
    if (data.results && data.results.length > 0) {

      //if is a partial transcripts
      if (data.results.length === 1 ) {
        var paragraph = transcript.children().last(),
          text = data.results[0].alternatives[0].transcript || '';

        //Capitalize first word
        text = text.charAt(0).toUpperCase() + text.substring(1);
        // if final results, append a new paragraph
        if (data.results[0].final){
          text = text.trim() + '.';
          $('<p></p>').appendTo(transcript);
        }
        paragraph.text(text);
      }
    }
    transcript.show();
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

});