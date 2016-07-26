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
    'zh-CN_NarrowbandModel': ['zh-CN_sample1_for_8k.wav', 'zh-CN_sample2_for_8k.wav', '公司 的 支持 , 理财 计划', '假期 , 安排'],
    'fr-FR_BroadbandModel': ['fr-FR_Broadband_sample1.wav', 'fr-FR_Broadband_sample2.wav', 'liberté d\'opinion , frontières , idées', 'loisirs , durée du travail']
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
