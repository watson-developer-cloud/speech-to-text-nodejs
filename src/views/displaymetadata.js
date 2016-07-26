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
/* eslint no-invalid-this: 0, brace-style: 0, dot-notation: 0, spaced-comment:0 */
'use strict';

const INITIAL_OFFSET_X = 30;
const INITIAL_OFFSET_Y = 30;
const fontSize = 16;
const delta_y = 2 * fontSize;
const radius = 5;
const space = 4;
const hstep = 32;
const timeout = 500;
const defaultFont = fontSize + 'px Arial';
const boldFont = 'bold ' + fontSize + 'px Arial';
const italicFont = 'italic ' + fontSize + 'px Arial';
const opacity = '0.6';

var showAllHypotheses = true;
var keywordsInputDirty = false;
var keywords_to_search = [];
var detected_keywords = {};
var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
var hslider = document.getElementById('hslider');
var vslider = document.getElementById('vslider');
var leftArrowEnabled = false;
var rightArrowEnabled = false;
var worker = null;
var runTimer = false;
var scrolled = false;
// var textScrolled = false;
var pushed = 0;
var popped = 0;

ctx.font = defaultFont;

// -----------------------------------------------------------
// class WordAlternative
var WordAlternative = function(text, confidence) {
  if (text == '<eps>') {
    this._text = '<silence>';
    this._foreColor = '#888';
  }
  else if (text == '%HESITATION') {
    this._text = '<hesitation>';
    this._foreColor = '#888';
  }
  else {
    this._foreColor = '#000';
    this._text = text;
  }
  this._confidence = confidence;
  this._height = 2 * fontSize;
  ctx.font = defaultFont;
  this._width = ctx.measureText(this._text + ((this._confidence.toFixed(3) * 100).toFixed(1)) + '%').width + 60;
  this._fillStyle = '#f4f4f4';
  this._selectedFillStyle = '#e3e3e3';
  this._selected = false;
};

WordAlternative.prototype.width = function() {
  return this._width;
};

WordAlternative.prototype.height = function() {
  return this._height;
};

WordAlternative.prototype.width = function() {
  return this._width;
};

WordAlternative.prototype.select = function() {
  this._selected = true;
};

WordAlternative.prototype.unselect = function() {
  this._selected = false;
};

WordAlternative.prototype.draw = function(x, y, width) {
  ctx.fillStyle = this._selected ? this._selectedFillStyle : this._fillStyle;
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#d3d3d3';
  ctx.fillRect(x, y, width, this.height());
  ctx.strokeRect(x, y, width, this.height());

  ctx.fillStyle = this._foreColor;
  ctx.font = this._selected ? boldFont : defaultFont;
  ctx.fillText(this._text, x + 16, y + 20);
  ctx.font = italicFont;
  const appendix = (this._confidence.toFixed(3) * 100).toFixed(1) + '%';
  const rightOffset = ctx.measureText(appendix).width + 32;
  ctx.fillText(appendix, x + 16 + width - rightOffset, y + 20);
  ctx.font = defaultFont;
};

// -----------------------------------------------------------
// class Bin
var Bin = function(startTime, endTime) {
  this._connectorWidth = 40;
  this._startTime = startTime;
  this._endTime = endTime;
  this._wordAlternatives = [];
  this._maxWordAlternativeWidth = 0;
  this._height = 0;
  this._index = 0;
};

Bin.prototype.addWordAlternative = function(wa) {
  this._wordAlternatives.push(wa);
  for (var index = 0; index < this._wordAlternatives.length; index++) {
    var width = this._wordAlternatives[index].width();
    if (width > this._maxWordAlternativeWidth)
      this._maxWordAlternativeWidth = width;
  }
  this._height += wa.height();
};

Bin.prototype.height = function() {
  return this._height;
};

Bin.prototype.width = function() {
  return this._maxWordAlternativeWidth + 2 * this._connectorWidth;
};

Bin.prototype.draw = function(x, y) {
  for (var index = 0; index < this._wordAlternatives.length; index++) {
    var wa = this._wordAlternatives[index];
    wa.draw(x + this._connectorWidth, y + delta_y * (index + 1), this._maxWordAlternativeWidth);
    if (showAllHypotheses == false)
      break;
  }

  ctx.moveTo(x + space + radius, y + fontSize);
  if (this._wordAlternatives.length > 0) {
    ctx.strokeStyle = '#4178BE';
    ctx.lineWidth = 2;
    ctx.lineTo(x + this.width() - (space + radius), y + fontSize);
    ctx.stroke();
  }
};

// -----------------------------------------------------------
// class Scene
var Scene = function() {
  this._bins = [];
  this._offset_X = INITIAL_OFFSET_X;
  this._offset_Y = INITIAL_OFFSET_Y;
  this._width = 0;
  this._height = 0;
  this._shift = 100;
};

Scene.prototype.draw = function() {
  var x = this._offset_X;
  var y = this._offset_Y;
  var last_bin_end_time = 0;

  for (var index = 0; index < this._bins.length; index++) {
    var bin = this._bins[index];
    var x_visible = Math.abs(x) <= canvas.width;
    ctx.beginPath();

    if (bin._startTime > last_bin_end_time) {
      if (x_visible) {
        ctx.moveTo(x + radius + space, y + fontSize);
      }
      if (last_bin_end_time > 0) {
        x += this._shift;
        if (x_visible) {
          ctx.strokeStyle = '#4178BE';
          ctx.lineWidth = 2;
          ctx.lineTo(x - (radius + space), y + fontSize);
          ctx.stroke();
        }
      }
      if (x_visible) {
        ctx.moveTo(x + radius, y + fontSize);
        ctx.lineWidth = 2;
        ctx.arc(x, y + fontSize, radius, 0, 2 * Math.PI, false);
        var start_time_caption = bin._startTime + ' s';
        var start_time_shift = ctx.measureText(start_time_caption).width / 2;
        ctx.fillText(start_time_caption, x - start_time_shift, y);
        ctx.stroke();
      }
    }

    if (x_visible) {
      bin.draw(x, y);
      ctx.moveTo(x + bin.width() + radius, y + fontSize);
      ctx.strokeStyle = '#4178BE';
      ctx.lineWidth = 2;
      ctx.arc(x + bin.width(), y + fontSize, radius, 0, 2 * Math.PI, false);
      ctx.stroke();
      var end_time_caption = bin._endTime + ' s';
      var end_time_shift = ctx.measureText(end_time_caption).width / 2;
      ctx.fillText(end_time_caption, x + bin.width() - end_time_shift, y);
      ctx.stroke();
    }

    last_bin_end_time = bin._endTime;
    x += bin.width();
    ctx.closePath();
  }
};

Scene.prototype.addBin = function(bin) {
  bin._index = this._bins.length;
  this._bins.push(bin);
  var width = 2 * INITIAL_OFFSET_X;
  var last_bin_end_time = 0;
  for (var index = 0; index < this._bins.length; index++) {
    // eslint-disable-next-line no-redeclare
    var bin = this._bins[index];
    if (bin._startTime > last_bin_end_time && last_bin_end_time > 0) {
      width += this._shift;
    }
    last_bin_end_time = bin._endTime;
    width += bin.width();
    if (this._height < bin.height()) {
      this._height = bin.height();
      vslider.min = canvas.height - this._height - 2.5 * INITIAL_OFFSET_Y;
    }
  }
  this._width = width;
};

Scene.prototype.width = function() {
  return this._width + 2 * this._shift;
};

Scene.prototype.height = function() {
  return this._height;
};

Scene.prototype.findBins = function(start_time, end_time) {
  var foundBins = [];
  for (var index = 0; index < this._bins.length; index++) {
    var bin = this._bins[index];
    var binStartTime = bin._startTime;
    var binEndTime = bin._endTime;
    if (binStartTime >= start_time && binEndTime <= end_time) {
      foundBins.push(bin);
    }
  }
  return foundBins;
};

Scene.prototype.startTimeToSliderValue = function(start_time) {
  var last_bin_end_time = 0;
  var value = 0;
  for (var binIndex = 0; binIndex < this._bins.length; binIndex++) {
    var bin = this._bins[binIndex];
    if (bin._startTime < start_time) {
      value += bin.width();
      if (bin._startTime > last_bin_end_time && last_bin_end_time > 0) {
        // eslint-disable-next-line no-use-before-define
        value += scene._shift;
      }
      last_bin_end_time = bin._endTime;
    }
  }
  return value;
};

// ---------------------------------------------------------------------

var scene = new Scene();

function parseAlternative(element/*, index, array*/) {
  var confidence = element['confidence'];
  var word = element['word'];
  var bin = scene._bins[scene._bins.length - 1];
  bin.addWordAlternative(new WordAlternative(word, confidence));
}

function parseBin(element/*, index, array*/) {
  var start_time = element['start_time'];
  var end_time = element['end_time'];
  var alternatives = element['alternatives'];
  var bin = new Bin(start_time, end_time);
  scene.addBin(bin);
  alternatives.forEach(parseAlternative);
}

function draw() {
  ctx.clearRect(0, 0, 970, 370);
  scene.draw();
}

function onHScroll() {
  if (hslider.value == 0) {
    leftArrowEnabled = false;
    rightArrowEnabled = true;
    $('#left-arrow').attr('src', 'images/arrow-left-icon-disabled.svg');
    $('#left-arrow').css('background-color', 'transparent');
    $('#right-arrow').attr('src', 'images/arrow-right-icon.svg');
    $('#right-arrow').css('background-color', '#C7C7C7');
  }
  else if (hslider.value == Math.floor(hslider.max)) {
    leftArrowEnabled = true;
    rightArrowEnabled = false;
    $('#left-arrow').attr('src', 'images/arrow-left-icon.svg');
    $('#left-arrow').css('background-color', '#C7C7C7');
    $('#right-arrow').attr('src', 'images/arrow-right-icon-disabled.svg');
    $('#right-arrow').css('background-color', 'transparent');
  }
  else {
    leftArrowEnabled = true;
    rightArrowEnabled = true;
    $('#left-arrow').attr('src', 'images/arrow-left-icon.svg');
    $('#left-arrow').css('background-color', '#C7C7C7');
    $('#right-arrow').attr('src', 'images/arrow-right-icon.svg');
    $('#right-arrow').css('background-color', '#C7C7C7');
  }
  scene._offset_X = INITIAL_OFFSET_X - hslider.value;
  draw();
}

function onVScroll() {
  scene._offset_Y = INITIAL_OFFSET_Y + Number(vslider.value);
  draw();
}

function clearScene() {
  scene._bins = [];
  scene._width = 0;
  scene._height = 0;
  scene._offset_X = INITIAL_OFFSET_X;
  scene._offset_Y = INITIAL_OFFSET_Y;
  hslider.max = 0;
  hslider.value = hslider.max;
  vslider.max = 0;
  vslider.min = 0;
  vslider.value = vslider.max;
  $('#hslider').css('display', 'none');
  $('#vslider').css('display', 'none');
  $('#show_alternate_words').css('display', 'none');
  $('#canvas').css('display', 'none');
  $('#canvas-placeholder').css('display', 'block');
  $('#left-arrow').css('display', 'none');
  $('#right-arrow').css('display', 'none');

  showAllHypotheses = true;
  $('#show_alternate_words').text('Hide alternate words');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function clearKeywordsToSearch() {
  keywords_to_search = [];
  $('#error-wrong-keywords-filetype').css('display', 'none');
  $('.keywords_title').css('display', 'none');
  $('#keywords').css('display', 'none');
  $('#transcription_text').css('width', '100%');
}

function clearDetectedKeywords() {
  $('#keywords ul').empty();
  detected_keywords = {};
}

// ---------------------------------------------------------------------

$('#left-arrow').hover(
  function() {
    if (leftArrowEnabled) {
      $(this).css('background-color', '#C7C7C7');
      $(this).css('opacity', '1');
    }
    else {
      $(this).css('background-color', 'transparent');
      $(this).css('opacity', opacity);
    }
  },
  function() {
    if (leftArrowEnabled) {
      $(this).css('background-color', '#C7C7C7');
    }
    else {
      $(this).css('background-color', 'transparent');
    }
    $(this).css('opacity', opacity);
  }
);

$('#right-arrow').hover(
  function() {
    if (rightArrowEnabled) {
      $(this).css('background-color', '#C7C7C7');
      $(this).css('opacity', '1');
    }
    else {
      $(this).css('background-color', 'transparent');
      $(this).css('opacity', opacity);
    }
  },
  function() {
    if (rightArrowEnabled) {
      $(this).css('background-color', '#C7C7C7');
    }
    else {
      $(this).css('background-color', 'transparent');
    }
    $(this).css('opacity', opacity);
  }
);

$('#left-arrow').click(function() {
  var updated_value = hslider.value - hstep;
  if (updated_value < 0) {
    updated_value = 0;
  }
  hslider.value = updated_value;
  onHScroll();
});

$('#right-arrow').click(function() {
  var updated_value = Number(hslider.value) + hstep;
  if (updated_value > hslider.max) {
    updated_value = hslider.max;
  }
  hslider.value = updated_value;
  onHScroll();
});

$('#btnLoadKWS').click(function(/*e*/) {
  $(this).find('input[type=\'file\']').click();
});

$('#btnLoadKWS input').click(function(e) {
  e.stopPropagation();
});

$('#btnLoadKWS input').change(function(e) {
  e.stopPropagation();
  clearKeywordsToSearch();
  var selectedFile = $(this)[0].files[0];
  if (typeof selectedFile == 'undefined') {
    console.log('User cancelled OpenFile dialog. No keywords file loaded.');
    return;
  }

  if ($(this).val().lastIndexOf('.txt') == -1) {
    $('#error-wrong-keywords-filetype').css('display', 'block');
    return;
  }

  var reader = new FileReader();
  reader.readAsText(selectedFile);
  reader.onload = function() {
    $('#keywords ul').empty();
    var text = reader.result;
    var keywordsToSearch = text.split('\n');
    // eslint-disable-next-line no-use-before-define
    keywordsToSearch.forEach(addKeywordToSearch);
    if (keywordsToSearch.length > 0) {
      $('.keywords_title').css('display', 'block');
      $('#keywords').css('display', 'block');
      $('#transcription_text').css('width', '55%');
    }
  };
});

$('#tb_keywords').focus(function () {
  if (keywordsInputDirty == false) {
    keywordsInputDirty = true;
    $(this).css('font-style', 'normal');
    $(this).css('color', '#121212');
    $(this).val('');
  }
});

$('#tb_keywords').change(function() {
  clearKeywordsToSearch();
  var text = $(this).val();
  // eslint-disable-next-line no-use-before-define
  text.split(',').forEach(addKeywordToSearch);
  if (keywords_to_search.length > 0) {
    $('.keywords_title').css('display', 'block');
    $('#keywords').css('display', 'block');
    $('#transcription_text').css('width', '55%');
  }
});

// -----------------------------------------------------------------

function keywordNotFound(keyword) {
  var $li_kwd = $('<li class=\'keyword_no_occurrences\'/>');
  $li_kwd.append(document.createTextNode(keyword));
  $('#keywords ul').append($li_kwd);
}

function addKeywordToSearch(element/*, index, array*/) {
  var keyword = element.trim();
  if (keyword.length == 0) return;

  if (keywords_to_search.indexOf(keyword) == -1) {
    keywords_to_search.push(keyword);
  }
}

$('#errorWrongKeywordsFiletypeClose').click(function(/*e*/) {
  $('#error-wrong-keywords-filetype').css('display', 'none');
});

function toggleSpottedKeywordClass(node) {
  if (node.className == 'keyword_collapsed') {
    node.getElementsByClassName('keyword_icon')[0].src = 'images/close-icon.svg';
    node.className = 'keyword_expanded';
  }
  else if (node.className == 'keyword_expanded') {
    node.getElementsByClassName('keyword_icon')[0].src = 'images/open-icon.svg';
    node.className = 'keyword_collapsed';
  }
}

$('#keywords ul').click(function(e) {
  var node = e.srcElement || e.target;

  if (node.className == 'keyword_text') {
    toggleSpottedKeywordClass(node.parentNode);
  }
  else if (node.className == 'keyword_icon') {
    toggleSpottedKeywordClass(node.parentNode.parentNode);
  }
  else {
    toggleSpottedKeywordClass(node);
  }
});

function parseKeywords(keywords_result) {
  // eslint-disable-next-line guard-for-in
  for (var keyword in keywords_result) {
    var arr = keywords_result[keyword];
    // eslint-disable-next-line no-continue
    if (arr.length == 0) continue;
    if (keyword in detected_keywords == false) {
      detected_keywords[keyword] = [];
    }
    detected_keywords[keyword] = detected_keywords[keyword].concat(arr);
  }
}

function unselectLastKeyword() {
  for (var binIndex = 0; binIndex < scene._bins.length; binIndex++) {
    var bin = scene._bins[binIndex];
    var wordAlternatives = bin._wordAlternatives;
    for (var waIndex = 0; waIndex < wordAlternatives.length; waIndex++) {
      var wordAlternative = wordAlternatives[waIndex];
      wordAlternative.unselect();
    }
  }
}

window.onKeywordOccurrenceSelected = function(start_time, keywordFragments) {
  unselectLastKeyword();
  var keywordConsistsOfTopHypothesesOnly = true;
  for (var index = 0; index < keywordFragments.length; index++) {
    var fragment = keywordFragments[index];
    var binIndex = fragment[0];
    var waIndex = fragment[1];
    if (waIndex > 0) {
      keywordConsistsOfTopHypothesesOnly = false;
    }
    var bin = scene._bins[binIndex];
    var wordAlternative = bin._wordAlternatives[waIndex];
    wordAlternative.select();
  }
  if (showAllHypotheses == false && keywordConsistsOfTopHypothesesOnly == false) {
    // eslint-disable-next-line no-use-before-define
    toggleAlternateWords();
  }
  hslider.value = scene.startTimeToSliderValue(start_time);
  onHScroll();

  $('html, body').animate({scrollTop: $('#canvas').offset().top}, 500);
};

function keywordToHashSet(normalized_text) {
  var hashSet = {};
  var segments = normalized_text.split(' ');
  for (var index = 0; index < segments.length; index++) {
    var segment = segments[index];
    hashSet[segment] = true;
  }
  return hashSet;
}

function updateKeyword(keyword) {
  var arr = detected_keywords[keyword];
  var arrlen = arr.length;

  var $li = $('<li class=\'keyword_collapsed\'/>');
  var $keyword_text = $('<span class=\'keyword_text\'><img class=\'keyword_icon\' src=\'images/open-icon.svg\'>' + keyword + '</span>');
  var $keyword_count = $('<span class=\'keyword_count\'>(' + arrlen + ')</span>');
  $li.append($keyword_text);
  $li.append($keyword_count);
  var $table = $('<table class=\'kws_occurrences\'/>');
  for (var index = 0; index < arrlen; index++) {
    var kwd_occurrence = arr[index];
    var start_time = kwd_occurrence['start_time'].toFixed(2);
    var end_time = kwd_occurrence['end_time'].toFixed(2);
    var confidence = (kwd_occurrence['confidence'] * 100).toFixed(1);
    var normalized_text = kwd_occurrence['normalized_text'];
    var set = keywordToHashSet(normalized_text);
    var foundBins = scene.findBins(start_time, end_time);
    var keywordFragments = [];

    for (var binIndex = 0; binIndex < foundBins.length; binIndex++) {
      var bin = foundBins[binIndex];
      var wordAlternatives = bin._wordAlternatives;
      for (var waIndex = 0; waIndex < wordAlternatives.length; waIndex++) {
        var wordAlternative = wordAlternatives[waIndex];
        var isKeyword = set[wordAlternative._text];
        if (isKeyword) {
          var coordinate = [bin._index, waIndex];
          keywordFragments.push(coordinate);
        }
      }
    }

    var onClick = '"onKeywordOccurrenceSelected(' + start_time + ',' + JSON.stringify(keywordFragments) + ')"';
    var $tr = $('<tr class=\'selectable\' onClick=' + onClick + '/>');
    var $td_index = $('<td class=\'index\'>' + (index + 1) + '.</td>');
    var $td_start_label = $('<td class=\'bold\'>Start:</td>');
    var $td_start = $('<td/>');
    $td_start.append(document.createTextNode(start_time));
    var $td_end_label = $('<td class=\'bold\'>End:</td>');
    var $td_end = $('<td/>');
    $td_end.append(document.createTextNode(end_time));
    var $td_confidence_label = $('<td class=\'bold\'>Confidence:</td>');
    var $td_confidence = $('<td/>');
    $td_confidence.append(document.createTextNode(confidence + '%'));
    $tr.append([$td_index, $td_start_label, $td_start, $td_end_label, $td_end, $td_confidence_label, $td_confidence]);
    $table.append($tr);
  }
  $li.append($table);
  $('#keywords ul').append($li);
}

function updateDetectedKeywords() {
  $('#keywords ul').empty();
  keywords_to_search.forEach(function(element/*, index, array*/) {
    var keyword = element;
    if (keyword in detected_keywords) {
      updateKeyword(keyword);
    }
    else {
      keywordNotFound(keyword);
    }
  });
}

function toggleAlternateWords() {
  if (showAllHypotheses == false) {
    if (vslider.min < 0) {
      $('#vslider').css('display', 'block');
    }
    $('#show_alternate_words').text('Hide alternate words');
    showAllHypotheses = true;
  }
  else {
    $('#vslider').css('display', 'none');
    $('#show_alternate_words').text('Show alternate words');
    showAllHypotheses = false;
  }
  draw();
}

$('#show_alternate_words').click(function(/*e*/) {
  toggleAlternateWords();
});

exports.showJSON = function(baseJSON) {
  if ($('.nav-tabs .active').text() == 'JSON') {
    $('#resultsJSON').val(baseJSON);
  }
};

function updateTextScroll(){
  if (!scrolled){
    var element = $('#resultsText').get(0);
    element.scrollTop = element.scrollHeight;
  }
}

function initTextScroll() {
  // $('#resultsText').on('scroll', function(){
  //     textScrolled = true;
  // });
}

function onResize() {
  var dpr = window.devicePixelRatio || 1;
  var bsr = ctx.webkitBackingStorePixelRatio ||
  ctx.mozBackingStorePixelRatio ||
  ctx.msBackingStorePixelRatio ||
  ctx.oBackingStorePixelRatio ||
  ctx.backingStorePixelRatio || 1;
  var ratio = dpr / bsr;
  console.log('dpr/bsr =', ratio);
  var w = $('#canvas').width();
  var h = $('#canvas').height();
  canvas.width = w * ratio;
  canvas.height = h * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw();
}

function resetWorker() {
  runTimer = false;
  worker.postMessage({
    type:'clear'
  });
  pushed = 0;
  popped = 0;
  console.log('---> resetWorker called');
}

exports.initDisplayMetadata = function() {
  initTextScroll();
  keywordsInputDirty = false;
  hslider.min = 0;
  hslider.max = 0;
  hslider.value = hslider.min;
  vslider.min = 0;
  vslider.max = 0;
  vslider.value = vslider.max;
  $('#vslider').css('display', 'none');
  $('#hslider').on('change mousemove', function() {
    onHScroll();
  });
  $('#vslider').on('change mousemove', function() {
    onVScroll();
  });

  $('#canvas').css('display', 'none');
  $('#canvas-placeholder').css('display', 'block');
  $('#left-arrow').css('display', 'none');
  $('#right-arrow').css('display', 'none');

  onResize(); // to adjust the canvas size

  var workerScriptBody =
    'var fifo = [];\n' +
    'var onmessage = function(event) {\n' +
    '  var payload = event.data;\n' +
    '  var type = payload.type;\n' +
    '  if(type == \'push\') {\n' +
    '    fifo.push(payload.msg);\n' +
    '  }\n' +
    '  else if(type == \'shift\' && fifo.length > 0) {\n' +
    '    var msg = fifo.shift();\n' +
    '    postMessage({\n' +
    '     bins:msg.results[0].word_alternatives,\n' +
    '     kws:msg.results[0].keywords_result\n' +
    '    });\n' +
    '  }\n' +
    '  else if(type == \'clear\') {\n' +
    '    fifo = [];\n' +
    '    console.log(\'worker: fifo cleared\');\n' +
    '  }\n' +
    '}\n';

  var blobURL = window.URL.createObjectURL(new Blob([workerScriptBody]));
  worker = new Worker(blobURL);
  worker.onmessage = function(event) {
    var data = event.data;
    // eslint-disable-next-line no-use-before-define
    showCNsKWS(data.bins, data.kws);
    popped++;
    console.log('----> popped', popped);
  };
};

function showCNsKWS(bins, kws) {
  bins.forEach(parseBin);
  hslider.max = scene.width() - canvas.width + INITIAL_OFFSET_X;
  hslider.value = hslider.max;
  onHScroll();

  if (vslider.min < 0 && showAllHypotheses) {
    $('#vslider').css('display', 'block');
  }
  $('#hslider').css('display', 'block');
  $('#show_alternate_words').css('display', 'inline-block');
  $('#canvas').css('display', 'block');
  $('#canvas-placeholder').css('display', 'none');
  $('#left-arrow').css('display', 'inline-block');
  $('#right-arrow').css('display', 'inline-block');

  // KWS
  parseKeywords(kws);
  updateDetectedKeywords();
}

function onTimer() {
  worker.postMessage({
    type:'shift'
  });
  if (runTimer == true) {
    setTimeout(onTimer, timeout);
  }
}

exports.showResult = function(msg, baseString, model) {
  if (msg.results && msg.results.length > 0) {
    //var alternatives = msg.results[0].alternatives;
    var text = msg.results[0].alternatives[0].transcript || '';

    // apply mappings to beautify
    text = text.replace(/%HESITATION\s/g, '');
    //text = text.replace(/([^*])\1{2,}/g, '');   // seems to be getting in the way of smart formatting, 1000101 is converted to 1101

    if (msg.results[0].final) {
      console.log('-> ' + text);
      worker.postMessage({
        type:'push',
        msg:msg
      });
      pushed++;
      console.log('----> pushed', pushed);
      if (runTimer == false) {
        runTimer = true;
        setTimeout(onTimer, timeout);
      }
    }
    text = text.replace(/D_[^\s]+/g,'');

    // if all words are mapped to nothing then there is nothing else to do
    if ((text.length == 0) || (/^\s+$/.test(text))) {
      return baseString;
    }

    var japanese = ((model.substring(0,5) == 'ja-JP') || (model.substring(0,5) == 'zh-CN'));

    // capitalize first word
    // if final results, append a new paragraph
    if (msg.results && msg.results[0] && msg.results[0].final) {
      text = text.slice(0, -1);
      text = text.charAt(0).toUpperCase() + text.substring(1);
      if (japanese) {
        text = text.trim() + '。';
        text = text.replace(/ /g,'');
      }
      else {
        text = text.trim() + '. ';
      }
      baseString += text;
      $('#resultsText').val(baseString);
    }
    else {
      if (japanese) {
        text = text.replace(/ /g,''); // remove whitespaces
      } else {
          text = text.charAt(0).toUpperCase() + text.substring(1);
      }
      $('#resultsText').val(baseString + text);
    }
  }
  updateTextScroll();
  return baseString;
};

exports.getKeywordsToSearch = function() {
  return keywords_to_search;
};

$.subscribe('clearscreen', function() {
  clearScene();
  clearDetectedKeywords();
  resetWorker();
});

$(window).resize(function() {
  onResize();
});
