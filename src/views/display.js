var $ = require('jquery');

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

var showMetaData = function(alternative) {
  var timestamps = alternative.timestamps;
  if (timestamps && timestamps.length > 0) {
    showTimestamps(timestamps);
  }
  var confidences = alternative.word_confidence;;
  if (confidences && confidences.length > 0) {
    showWordConfidence(confidences);
  }
}

var showAlternatives = function(alternatives) {
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

// TODO: Convert to closure approach
var processString = function(baseString, isFinished) {

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

exports.showJSON = function(msg, baseJSON) {
  var json = JSON.stringify(msg);
  baseJSON += json;
  baseJSON += '\n';
  $('#resultsJSON').val(baseJSON);
  return baseJSON;
}

exports.showResult = function(msg, baseString, callback) {

  var idx = +msg.result_index;

  if (msg.results && msg.results.length > 0) {

    var alternatives = msg.results[0].alternatives;
    var text = msg.results[0].alternatives[0].transcript || '';

    //Capitalize first word
    // if final results, append a new paragraph
    if (msg.results && msg.results[0] && msg.results[0].final) {
      baseString += text;
      console.log('final res:', baseString);
      processString(baseString, true);
      showMetaData(alternatives[0]);
    } else {
      var tempString = baseString + text;
      console.log('interimResult res:', tempString);
      processString(tempString, false);
    }
  }
  if (alternatives) {
    showAlternatives(alternatives);
  }

  var isNNN = /^((n)\3+)$/.test(baseString);
  if (isNNN) {
    baseString = '<unintelligible: please check selected language and bandwidth>';
  }
  return baseString;
}
