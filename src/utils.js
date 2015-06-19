
// For non-view logic
var $ = require('jquery');

/**
 * Creates a Blob type: 'audio/l16' with the
 * chunk coming from the microphone.
 */
var exportDataBuffer = exports.exportDataBuffer = function(buffer, bufferSize) {
  var pcmEncodedBuffer = null,
    dataView = null,
    index = 0,
    volume = 0x7FFF; //range from 0 to 0x7FFF to control the volume

  pcmEncodedBuffer = new ArrayBuffer(bufferSize * 2);
  dataView = new DataView(pcmEncodedBuffer);

  /* Explanation for the math: The raw values captured from the Web Audio API are
   * in 32-bit Floating Point, between -1 and 1 (per the specification).
   * The values for 16-bit PCM range between -32768 and +32767 (16-bit signed integer).
   * Multiply to control the volume of the output. We store in little endian.
   */
  for (var i = 0; i < buffer.length; i++) {
    dataView.setInt16(index, buffer[i] * volume, true);
    index += 2;
  }

  // l16 is the MIME type for 16-bit PCM
  return new Blob([dataView], { type: 'audio/l16' });
};

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
    var block      = null;
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
        block(offset, chunkSize, file, readChunk);
    }
    block = fileBlock;
    block(offset, chunkSize, file, readChunk);
}

exports.parseFileHeader = function(file, ondata, onend, onerror) {
    var fileSize   = file.size;
    var chunkSize  = 48; // bytes
    var offset     = 0;
    var self       = this; // we need a reference to the current object
    var block      = null;
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
        block(offset, chunkSize, file, readChunk);
    }
    block = fileBlock;
    block(offset, chunkSize, file, readChunk);
}

exports.initPubSub = function() {
  var o         = $({});
  $.subscribe   = o.on.bind(o);
  $.unsubscribe = o.off.bind(o);
  $.publish     = o.trigger.bind(o);
}
