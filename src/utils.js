
// For non-view logic
var $ = require('jquery');

var fileBlock = function(_offset, length, _file, readChunk) {
  var r = new FileReader();
  var blob = _file.slice(_offset, length + _offset);
  r.onload = readChunk;
  r.readAsArrayBuffer(blob);
}

// From alediaferia's SO response
// http://stackoverflow.com/questions/14438187/javascript-filereader-parsing-long-file-in-chunks
exports.parseFile = function(file, ondata, onend, onerror) {
    var fileSize   = file.size;
    var chunkSize  = 2048; // bytes
    var offset     = 0;
    var self       = this; // we need a reference to the current object
    var readChunk = function(evt) {
        if (offset >= fileSize) {
            console.log("Done reading file");
            onend();
            return;
        }
        if (evt.target.error == null) {
            var buffer = evt.target.result;
            var len = buffer.byteLength;
            offset += len;
            ondata(buffer); // callback for handling read chunk
        } else {
            var errorMessage = evt.target.error;
            console.log("Read error: " + errorMessage);
            onerror(errorMessage);
            return;
        }
        fileBlock(offset, chunkSize, file, readChunk);
    }
    fileBlock(offset, chunkSize, file, readChunk);
}


exports.initPubSub = function() {
  var o         = $({});
  $.subscribe   = o.on.bind(o);
  $.unsubscribe = o.off.bind(o);
  $.publish     = o.trigger.bind(o);
}
