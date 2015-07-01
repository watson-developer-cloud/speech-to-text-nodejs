
exports.getModels = function(options, callback) {
  var token = options.token;
  var modelUrl = options.url || 'https://stream.watsonplatform.net/speech-to-text/api/v1/models';
  var sttRequest = new XMLHttpRequest();
  sttRequest.open("GET", modelUrl, true);
  sttRequest.withCredentials = true;
  sttRequest.setRequestHeader('Accept', 'application/json');
  sttRequest.setRequestHeader('X-Watson-Authorization-Token', token);
  sttRequest.onload = function(evt) {
    var response = JSON.parse(sttRequest.responseText);
    callback(response.models);
  };
  sttRequest.send();
}