
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

exports.showMetaData = function(alternative) {
  var timestamps = alternative.timestamps;
  if (timestamps && timestamps.length > 0) {
    showTimestamps(timestamps);
  }
  var confidences = alternative.word_confidence;;
  if (confidences && confidences.length > 0) {
    showWordConfidence(confidences);
  }
}

exports.showAlternatives = function(alternatives) {
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


exports.showJSON = function(msg, baseJSON) {
  var json = JSON.stringify(msg);
  baseJSON += json;
  baseJSON += '\n';
  $('#resultsJSON').val(baseJSON);
  return baseJSON;
}

// TODO: Convert to closure approach
exports.showResult = function(baseString, isFinished) {

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
