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

var WatsonSpeechToText = require('watson-speech/speech-to-text');

var scrolled = false,
    textScrolled = false;

var showTimestamp = function(timestamps, confidences) {
  var word = timestamps[0],
      t0 = timestamps[1],
      t1 = timestamps[2];

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
};


var showMetaData = function(alternative) {
  var confidenceNestedArray = alternative.word_confidence;
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
};

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
        var transcript = alternative.transcript;
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
};

var alternativePrototype = new Alternatives();



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
};

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
};

exports.initDisplayMetadata = function() {
  initScroll();
  initTextScroll();
};

/**
 * Renders both final and interim results to a readonly textarea.
 * Returns final, but not interim text, and expects the caller to include this as the second argument to the next call.
 *
 * Also updates scrolling and alternatives.
 *
 * @param {Object} result - result object from server, may contain interim or final results
 * @param {String} baseString - Final text from previous calls, or '' if this is the first call for this transcription.
 * @returns {String}
 */
function showResult(result, baseString) {

    var alternatives = result.alternatives;
    var text = alternatives[0].transcript || '';

    // if all words are mapped to nothing then there is nothing else to do
    if ((text.length === 0)) {
         return baseString;
    }

    // if final results, append a new paragraph
    if (result.final) {
       baseString += text;
       $('#resultsText').val(baseString);
       showMetaData(alternatives[0]);
       // Only show alternatives if we're final
       alternativePrototype.showAlternatives(alternatives);
    } else {
      $('#resultsText').val(baseString + text);
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

function renderJson(messages) {
    var text = messages.map(function(msg) {
        return JSON.stringify(msg, null, 2);
    }).join('\n') + '\n';
    $('#resultsJSON').append(text);
}

function isJsonTabActive() {
    return $('.nav-tabs .active').text() === 'JSON';
}

exports.renderStream = function(stream, model) {
    // init the JSON tab
    var $resultsJSON = $('#resultsJSON');
    $resultsJSON.empty();

    // buffer the JSON messages in memory unless the tab is active
    var jsonBuffer = [];
    stream.on('message', function(msg) {
        if (isJsonTabActive()) {
            renderJson([msg]);
        } else {
            jsonBuffer.push(msg);
        }
    });
    // render the json tab when it is selected
    $.unsubscribe('showjson');
    $.subscribe('showjson', function() {
        if (jsonBuffer.length) {
            renderJson(jsonBuffer);
            jsonBuffer.length = 0; // delete all messages
        }
    });

    // handle the text tab
    // this is a bit tricky because we want to update the text of the interim results without loosing the previous final results
    // so we store the final text in baseString and then showResult() automatically updates it when we get more final text
    var baseString = '';
    // format the stream and then use the formatted 'result' event to display the text
    stream.pipe(new WatsonSpeechToText.FormatStream({model: model, hesitation: ''}))
        .on('result', function(result) {
            baseString = showResult(result, baseString);
        });
};
