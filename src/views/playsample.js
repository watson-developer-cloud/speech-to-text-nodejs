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
var effects = require('./effects');
var WatsonSpeechToText = require('watson-speech/speech-to-text');
var display = require('./displayresults');


var LOOKUP_TABLE = {
  'ar-AR_BroadbandModel': ['ar-AR_Broadband_sample1.wav', 'ar-AR_Broadband_sample2.wav'],
  'en-UK_BroadbandModel': ['en-UK_Broadband_sample1.wav', 'en-UK_Broadband_sample2.wav'],
  'en-UK_NarrowbandModel': ['en-UK_Narrowband_sample1.wav', 'en-UK_Narrowband_sample2.wav'],
  'en-US_BroadbandModel': ['Us_English_Broadband_Sample_1.wav', 'Us_English_Broadband_Sample_2.wav'],
  'en-US_NarrowbandModel': ['Us_English_Narrowband_Sample_1.wav', 'Us_English_Narrowband_Sample_2.wav'],
  'es-ES_BroadbandModel': ['Es_ES_spk24_16khz.wav', 'Es_ES_spk19_16khz.wav'],
  'es-ES_NarrowbandModel': ['Es_ES_spk24_8khz.wav', 'Es_ES_spk19_8khz.wav'],  
  'ja-JP_BroadbandModel': ['sample-Ja_JP-wide1.wav', 'sample-Ja_JP-wide2.wav'],
  'ja-JP_NarrowbandModel': ['sample-Ja_JP-narrow3.wav', 'sample-Ja_JP-narrow4.wav'],
  'pt-BR_BroadbandModel': ['pt-BR_Sample1-16KHz.wav', 'pt-BR_Sample2-16KHz.wav'],
  'pt-BR_NarrowbandModel': ['pt-BR_Sample1-8KHz.wav', 'pt-BR_Sample2-8KHz.wav'],
  'zh-CN_BroadbandModel': ['zh-CN_sample1_for_16k.wav', 'zh-CN_sample2_for_16k.wav'],
  'zh-CN_NarrowbandModel': ['zh-CN_sample1_for_8k.wav', 'zh-CN_sample2_for_8k.wav']
};

var playSample = (function() {

  var running = false;
  var audio;
  var stream;
  localStorage.setItem('currentlyDisplaying', 'false');
  localStorage.setItem('samplePlaying', 'false');

  return function(token, imageTag, sampleNumber, iconName, url, currentModel) {

    $.publish('clearscreen');

    var currentlyDisplaying = localStorage.getItem('currentlyDisplaying');
    var samplePlaying = localStorage.getItem('samplePlaying');

    if (running) {
      stream.stop();
      // same as current means that we should just stop the current playback and return
      if (samplePlaying === sampleNumber) {
        console.log('HARD SOCKET STOP');
        $.publish('socketstop');
        localStorage.setItem('currentlyDisplaying', 'false');
        localStorage.setItem('samplePlaying', 'false');
        effects.stopToggleImage(timer, imageTag, iconName);
        effects.restoreImage(imageTag, iconName);
        running = false;
        return;
      }
      // else: a different sample was requested - stop the current playback, and then begin playing the new sample
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

    audio = new Audio();
    audio.src = url;
    stream = WatsonSpeechToText.recognizeElement({
      token: token,
      element: audio,
      model: currentModel,
      'X-Watson-Learning-Opt-Out': JSON.parse(localStorage.getItem('sessionPermissions')) ? '0' : '1'
    });

    stream.on('end', function() {
      effects.stopToggleImage(timer, imageTag, iconName);
      effects.restoreImage(imageTag, iconName);
      localStorage.setItem('currentlyDisplaying', 'false');
      localStorage.setItem('samplePlaying', 'false');
      audio = null;
    });

    display.renderStream(stream, currentModel);

  };
})();


exports.initPlaySample = function(ctx) {

  (function() {
    var fileName = 'audio/' + LOOKUP_TABLE[ctx.currentModel][0];
    var el = $('.play-sample-1');
    el.off('click');
    var iconName = 'play';
    var imageTag = el.find('img');
    el.click( function() {
      playSample(ctx.token, imageTag, 'sample-1', iconName, fileName, ctx.currentModel);
    });
  })(ctx, LOOKUP_TABLE);

  (function() {
    var fileName = 'audio/' + LOOKUP_TABLE[ctx.currentModel][1];
    var el = $('.play-sample-2');
    el.off('click');
    var iconName = 'play';
    var imageTag = el.find('img');
    el.click( function() {
      playSample(ctx.token, imageTag, 'sample-2', iconName, fileName, ctx.currentModel);
    });
  })(ctx, LOOKUP_TABLE);

};
