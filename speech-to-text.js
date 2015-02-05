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

'use strict';

var request = require('request').defaults({ strictSSL: false, jar:true});
var util = require('util');
var https = require('https');
var url = require('url');
var cookie = require('cookie');


function formatChunk(chunk) {
  // Convert the string into an array
  var result = chunk;

  // Check if in the stream doesn't have
  // two results together and parse them
  if (!result || result.indexOf('}{') === -1)
    return JSON.parse(result);

  // Check if we can parse the response
  try{
    result = '[' + result.replace(/}{/g,'},{') + ']';
    result = JSON.parse(result);
    return result[result.lenght-1];
  } catch(e){}

  return result;
}

/**
 * Check if the service/request have error and try to format them.
 * @param  {Function} cb the request callback
 */
function formatErrorIfExists(cb) {
  return function(error, response, body) {
    // If we have an error return it.
    if (error) {
      cb(error, body, response);
      return;
    }

    try {
      body = JSON.parse(body);
    } catch (e) {}

    // If we have a response and it contains an error
    if (body && (body.error || body.error_code)) {
      error = body;
      body = null;
    }

    // If we still don't have an error and there was an error...
    if (!error && (response.statusCode < 200 || response.statusCode >= 300)) {
      error = {
        code: response.statusCode,
        error: body
      };
      if (error.code === 401 || error.code === 403)
        error.error = 'Unauthorized: Access is denied due to invalid credentials';
      body = null;
    }
    cb(error, body, response);
  };
}

/**
 * Speech Recognition API Wrapper
 *
 * @param {[type]} options the context where 'auth' and 'url' are
 */
function SpeechToText(options) {
  this._options = options || {};
  this.url = options.url.replace(/\/$/, '');
  this.auth = 'Basic ' + new Buffer(options.username + ':' + options.password).toString('base64');
}

/**
 * Speech recognition for given audio using default model.
 * @return Returns only the final results.
 * Sessions have to be used to enable interim results.
 * PCM audio has to be LITTLE-ENDIAN with sample rate described
 * in the Content-type header,
 * e.g. Content-type:'audio/l16;rate=16000'.
 *
 * @param {boolean} params.continuous
 *        If true, multiple final results representing multiple consecutive
 *        phrases separated by pauses can be returned. Default: false.
 *
 * @param {Audio} [audio] Audio to be recognized.
 *
 * @param { } [varname] [description]
 */
SpeechToText.prototype.recognize = function(params, callback) {
  var options = {
    method: 'POST',
    url: this.url + '/v1/models/WatsonModel/recognize',
    headers: {
      'Authorization': this.auth,
      'Content-type': util.format('audio/l16; rate=%s', params.rate || '48000')
    }
  };

  return params.audio.pipe(request(options, formatErrorIfExists(callback)));
};

SpeechToText.prototype.recognize_live = function(params, callback) {
  console.log('rate:',params.rate);

  var service_url = this.url + util.format('/v1/sessions/%s/recognize',params.session_id);
  var parts = url.parse(service_url);
  var options = {
    rejectUnauthorized: false,
    agent:false,
    host: parts.hostname,
    port: parts.port,
    path: parts.pathname + (params.continuous ? '?continuous=true' : ''),
    method: 'POST',
    headers: {
      'Authorization': this.auth,
      'Transfer-Encoding': 'chunked',
      'Cookie': 'SESSIONID='+params.cookie_session,
      'Content-type': util.format('audio/l16; rate=%s',params.rate || 48000)
    }
  };

  // Create a request to POST to Watson
  var recognize_req = https.request(options, function(result) {
    result.setEncoding('utf-8');
    result.on('data', function(chunk) {
      try{
        chunk = formatChunk(chunk);
      } catch(e){
        callback(chunk);
        return;
      }
      callback(null, chunk);
    });
  });

  recognize_req.on('error', function(error) {
    callback(error);
  });
  return recognize_req;
};

/**
 * Result observer for upcoming or ongoing recognition task in the session.
 * This request has to be started before POST on recognize finishes,
 * otherwise it waits for the next recognition.
 *
 * @param {String} [params.session_id] Session used in the recognition.
 * @param {boolean} [params.interim_results] If true,
 * interim results will be returned. Default: false.
 */
SpeechToText.prototype.observe_result = function(params, callback) {
  var service_url = this.url + util.format('/v1/sessions/%s/observeResult',
    params.session_id
  );

  var parts = url.parse(service_url);
  var options = {
    rejectUnauthorized: false,
    agent:false,
    host: parts.hostname,
    port: parts.port,
    path: parts.pathname + '?interim_results=true',
    method: 'GET',
    headers: {
      'Authorization': this.auth,
      'Cookie': 'SESSIONID='+params.cookie_session,
      'Accept': 'application/json'
    }
  };

  // Create a request to POST to Watson
  var req = https.request(options, function(result) {
    result.setEncoding('utf-8');
    result.on('data', function(chunk) {
      try{
        chunk = formatChunk(chunk);
      } catch(e) {
        callback(chunk);
        return;
      }
      callback(null, chunk);
    });
  });

  req.on('error', function(error) {
    callback(error);
  });

  req.end();
  return req;
};

/**
 * Get the state of the engine to check if recognize is available.
 *
 * Concurrent recognitions on the same session are not allowed.
 * This is the way to check if the session is ready to accept a new recognition task.
 * The returned state has to be 'initialized' to be able to do recognize POST.
 *
 * @param {String} [params.session_id] Session used in the recognition.
 */
SpeechToText.prototype.recognize_status = function(params, callback) {
  var url = util.format('/v1/sessions/%s/recognize',
    params.session_id
  );

  var options = {
    method: 'GET',
    url: url,
    json: true,
    headers: { 'Authorization': this.auth }
  };

  return request(options, formatErrorIfExists(callback));
};

/**
 * List of models available.
 *
 */
SpeechToText.prototype.models = function(params, callback) {
  var options = {
    method: 'GET',
    url: this.url + '/v1/models',
    json: true,
    headers: { 'Authorization': this.auth }
  };

  return request(options, formatErrorIfExists(callback));
};

/**
 * Get information about a model based on the given model_id
 * @param {String} [params.model_id] The desired model
 *
 */
SpeechToText.prototype.model = function(params, callback) {
  var options = {
    method: 'GET',
    url: this.url + '/v1/models/' + params.model_id,
    json: true,
    headers: { 'Authorization': this.auth }
  };

  return request(options, formatErrorIfExists(callback));
};

/**
 * Create a session
 * The session can be used for multiple recognition tasks, which are
 * guaranteed to happen on the same ASR engine. Creating a session
 * locks an engine exclusively for the session's use.
 * Set-cookie header is returned with a cookie that must be used for
 * each request using this session.
 * The session expires after 15 minutes of inactivity.
 *
 */
SpeechToText.prototype.create_session = function(params, callback) {
  var options = {
    method: 'POST',
    url: this.url + '/v1/sessions',
    headers: { 'Authorization': this.auth }
  };

  function addSessionId(cb) {
    return function(error, body,response) {
      if (error) {
        cb(error, body, response);
        return;
      }
      var cookies = cookie.parse(response.headers['set-cookie'][0]);
      body.cookie_session = cookies.SESSIONID;
      cb(error, body, response);
    };
  }

  return request(options, formatErrorIfExists(addSessionId(callback)));
};

/**
 * Deletes the specified session.
 *
 * @param {String} [params.session_id] Session id.
 */
SpeechToText.prototype.delete_session = function(params, callback) {
  var options = {
    method: 'DELETE',
    url: this.url + '/v1/sessions/'+ params.session_id,
    json: true,
    headers: { 'Authorization': this.auth }
  };

  return request(options, formatErrorIfExists(callback));
};

module.exports = SpeechToText;