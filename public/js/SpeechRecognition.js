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

/**
 *  Object implementing the JavaScript interface to IBM's Automatic Speech Recognition service in the Cloud
 *  @author Daniel Bolanos and German Attanasio Ruiz 
 */

/**
 * SpeechRecognition class
 */
function SpeechRecognition() {
	
	var self = this;
	
	// definition of properties and default values
	this.grammars = null;
	this.lang = "English";
	this.continuous = true;
	this.interimResults = true;
	this.maxAlternatives = 1;
	this.serviceURI = "wss://c203b991-5272-4828-8779-5f5850e8c342:2TeHEQsqXUtK@stream-d.watsonplatform.net/speech-to-text-beta/api/v1/recognize";
	
	// enumeration of possible speech recognition states
	var SRState = {
			"started":1, 
			"stopped":2,
			"aborted":3,
	};	
	
	// private interface
	this.microphone = null;
	this.websocket = null;
	this.state = SRState.stopped;

	// methods to drive the speech interaction
    
	// start the recognition of speech
	this.start = function() { 
		
		//if (self.state == SRState.started)
		//	return;	
		
		// called when microphone recording starts
		this.onstartrecording = function() {
			
			console.log("onstartrecording()");
			console.log('websocket url: ' + self.serviceURI);		
			self.websocket = new WebSocket(self.serviceURI);
			
			// fired when the connection is opened
			self.websocket.onopen = function() {
				console.log('webSocket opened');
			};
			
			// fired when the connection gets closed
			self.websocket.onclose = function() {	
				console.log('webSocket closed');			
			};
			
			// fired when an error occurs
			self.websocket.onerror = function(error) {
				console.log('webSocket error ' + error);	
				var error = new SpeechRecognitionError();
				error.error = SpeechRecognitionError.ErrorCode["network"];
				error.message = 'WebSocket communication error';
				self.onerror(error);			
			};
			
			// fired when receiving messages from the server
			self.websocket.onmessage = function(e) {
				console.log('server says: ' + e.data);
				self.onresult(e.data);
			};  			
			
			self.onstart();
		};

		// called when microphone recording ends
		this.onstoprecording = function() {
			
			console.log("onstoprecording()");
		};
		
		// receive audio packets from the microphone
		this.onaudioprocess = function(data) {			
			
			if (self.websocket && self.websocket.readyState == WebSocket.OPEN) {	
				self.websocket.send(data);			
		    	console.log("packet sent");
		    } else {
		    	console.log("packet not sent");
		    }
		};
		
		// initialize the microphone component    	
		if (self.microphone == null) {
			console.log("calling new Microphone");
			self.microphone = new Microphone(self,this.onstartrecording,this.onstoprecording,this.onaudioprocess);
			self.microphone.record();
		}		
	};
    
	// stop the recognition of speech and get final recognition results
	this.stop = function() {
		
		//if (self.state == SRState.stopped || self.state == SRState.aborted)
		//	return;
    	
		// close the WebSocket connection
		if (self.websocket) {
			console.log('websocket.close()');
			self.websocket.close();
			self.websocket = null;
		}		

		// close the microphone component
		if (self.microphone) {
			self.microphone.stop();
		}
		
		self.onend();
	};
    
	// abort the recognition of speech without waiting for final recognition results
	this.abort = function() {
		
		//if (self.state == SRState.stopped || self.state == SRState.aborted)
		//	return;		
		
		self.stop();
	};

	// event methods (these are set by the user and are called asynchronously when events are fired)
	this.onaudiostart = function() {};
	this.onsoundstart = function() {};
	this.onspeechstart = function() {};
	this.onspeechend = function() {};
	this.onsoundend = function() {};
	this.onaudioend = function() {};
	this.onresult = function(result) {};
	this.onnomatch = function() {};
	this.onerror = function(error) {};
	this.onstart = function() {};
	this.onend = function() {};
}

/**
 * SpeechRecognitionError class, it represents a recognition error event
 */
function SpeechRecognitionError() {
   
	// enumeration of possible errors
	this.ErrorCode = {
			"no-speech":"no-speech", 
			"aborted":"aborted",
			"audio-capture":"audio-capture",
			"network":"network",
			"not-allowed":"not-allowed",
			"service-not-allowed":"service-not-allowed",
			"bad-grammar":"bad-grammar",
			"language-not-supported":"language-not-supported",
    };
    Object.freeze(this.ErrorCode);    

    // these attributes should be "read only" but there is not yet support for that in JavaScript
    this.error = null;       // error as an ErrorCode value
    this.message = null;     // message in string format
};

/**
 * Microphone class, this class takes care of initializing, capturing audio and uninitializing the microphone
 */
function Microphone(speechrecognition,onstartrecording,onstoprecording,onaudioprocess) {
	
	var self = this;
	
	// audio capture properties
	this.bufferSize = 2048;				// buffer size for audio capture, in bytes
	this.inputChannels = 1;				// number of input audio channels
	this.outputChannels = 1;			// number of output audio channels
	this.sampleRate = null;				// sampling rate, this property is read only
	this.recording = false;				// whether audio recording is ongoing
	this.requestedAccess = false;		// whether the user was already prompted for access to microphone 
	
	this.audioContext = null;						// one single audio context per window
	this.speechrecognition = speechrecognition;
	this.onstartrecording = onstartrecording;
	this.onstoprecording = onstoprecording;
	this.onaudioprocess = onaudioprocess;
	//this.callbackAudioStart = callbackAudioStart;	// to be called when audio capture starts
	//this.callbackSoundStart = callbackSoundStart;	// to be called when sound/speech is detected (Voice Activity Detection module)
	//this.callbackSpeechStart = callbackSpeechStart;	// to be called when the captured speech samples are used for recognition
	//this.callbackSpeechEnd = callbackSpeechEnd;		// to be called when the captured speech samples are no longer used for recognition
	//this.callbackAudioEnd = callbackAudioEnd;		// to be called when audio/speech is no longer detected
	//this.callbackSoundEnd = callbackSoundEnd;		// to be called when audio capture ends
	//this.callbackAudioData = callbackAudioData;		// to be called when audio samples come from the microphone
	//this.callbackError = callbackError;				// to be called when an error occurs
	this.processor = null;
	
	/**
	 * Start recording audio, it makes the browser prompt the user to grant access to the microphone
	 */ 
	this.record = function() {
		
		// already requested?
		//if (this.requestedAccess) {
		//	return;
		//}	
		
		console.log("inside record()");
		
		// construct a browser-independent getUserMedia (Chrome, Firefox or IE User media)
		if (!navigator.getUserMedia) {
			navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
			if (!navigator.getUserMedia) {
				var error = new SpeechRecognitionError();
				error.error = error.ErrorCode["audio-capture"];
				error.message = 'Browser does not support microphone input';		
				self.speechrecognition.onerror(error);
				return;
			}
		}

		// request access to microphone and add handlers for the response
		this.requestedAccess = true;
		console.log("calling getUserMedia()");
		navigator.getUserMedia({ audio: true },
				self.onMediaStream.bind(this),			// microphone permission granted
			    self.onPermissionRejected.bind(this));	// microphone permission rejected		
	};
	
	/**
	 * Stop the audio recording
	 */
	this.stop = function() {
		if (!this.recording)
			return;
		self.recording = false;
		self.requestedAccess = false;
		self.processor.disconnect(0);
		self.processor = null;
		self.onstoprecording();
	};
	
	/**
	 * Called when the user authorizes the use of the microphone.
	 * @param  {Object} stream The Stream to connect to
	 */
	this.onMediaStream = function(stream) {
	
		//if (this.requestedAccess) {
		//	return;
		//}
		
		console.log("onMediaStream() begin");
	
		// get the audio context 
		var AudioCtx = window.AudioContext || window.webkitAudioContext;  // for cross-browser compatibility
		if (!AudioCtx) {
			var error = new SpeechRecognitionError();
			error.error = error.ErrorCode["audio-capture"];
			error.message = 'AudioContext not available on this browser';		
			self.speechrecognition.onerror(error);
		}
		if (!this.audioContext)
			this.audioContext = new AudioCtx();
	  
		// the graph will look like this: source -> (gain) -> processor -> destination
		var audioSource = this.audioContext.createMediaStreamSource(stream);		
		self.processor = this.audioContext.createScriptProcessor(this.bufferSize, this.inputChannels, this.outputChannels);
		console.log('Microphone.onMediaStream(): sampling rate is:', this.audioContext.sampleRate);
		self.sampleRate = this.audioContext.sampleRate;
		self.processor.onaudioprocess = self.onaudiosamples.bind(this);

		audioSource.connect(self.processor);
	  
		self.processor.connect(this.audioContext.destination);
		self.recording = true;
		self.requestedAccess = false;
		self.onstartrecording();

		console.log("onMediaStream() end");
	};
	
	/**
	 * Called automatically when the user rejects access to the microphone 
	 * @param {Object} errorMessage The error message
	 */
	this.onPermissionRejected = function(errorMessage) {
		var error = new SpeechRecognitionError();
		error.error = error.ErrorCode["not-allowed"];
		error.message = 'User did not grant access to microphone, error code: ' + errorMessage;	
		self.speechrecognition.onerror(error); 
		this.requestedAccess = false;
	};
	
	/**
	 * Callback function that gets called with audio data from the microphone
	 * @param data audio data, each sample is a float in the range [0,1]
	 */ 
	this.onaudiosamples = function(data) {
		
		//console.log("onaudiosamples()");
		
		// signal the beginning of audio capture if necessary
		if (self.samplesComing == false) {
			self.onaudiostart();
			self.samplesComing = true;
		}		
		
		// resampling and compression goes here
		
		// speech activity detection goes here

		// get the data from the channel (we only need a single channel for speech recognition)
		var chanData = data.inputBuffer.getChannelData(0);		
		self.onaudioprocess(self.toPCM16k(new Float32Array(chanData)));
	};
	
	/**
	 * Creates a Blob type: 'audio/l16' with a chunk of audio samples
	 * coming from the microphone.
	 * @param  {Object} buffer Microphone audio chunk
	 * @return {Blob} 'audio/l16' chunk
	 */
	this.toPCM16k = function(buffer) {
		
		var pcmEncodedBuffer = null,
			dataView = null,
			index = 0,
			volume = 0x7FFF; //range from 0 to 0x7FFF to control the volume

		pcmEncodedBuffer = new ArrayBuffer(this.bufferSize * 2);
		dataView = new DataView(pcmEncodedBuffer);
	  
		//console.log("total # samples to process: " + buffer.length);

		// Explanation for the math: The raw values captured from the Web Audio API are	
		// in 32-bit Floating Point, between -1 and 1 (per the specification).
		// The values for 16-bit PCM range between -32768 and +32767 (16-bit signed integer).
		// Multiply to control the volume of the output. We store in little endian.
	   
		for (var i = 0; i < buffer.length; i++) {
			dataView.setInt16(index, buffer[i] * volume, true);    
			index += 2;
		}

		// l16 is the MIME type for 16-bit PCM
		return new Blob([dataView], { type: 'audio/l16' });
	};	
}
