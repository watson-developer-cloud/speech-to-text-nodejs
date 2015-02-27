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

module.exports = function(io, speechToText) {

  var sessions = {};

  // Create a session on socket connection
  io.use(function(socket, next) {
    speechToText.createSession({}, function(err, session) {
      if (err) {
        next(new Error('The server could not create a session'));
      } else {
        sessions[socket.id] = session;
        sessions[socket.id].open = false;
        console.log(log(socket.id), 'created session');
        console.log('The system has:', Object.keys(sessions).length, 'sessions.');
        socket.emit('session', session.session_id);

        next();
      }
    });
  });

  var log = function(id) {
    return [
      '[socket.id:', id,
      sessions[id] ? ('session:' + sessions[id].cookie_session) : '', ']: '
    ].join(' ');
  };

  var observe_results = function(socket, recognize_end) {
    var session = sessions[socket.id];
    return function(err, chunk) {
      if (err) {
        console.log(log(socket.id), 'error:', err);
        socket.emit('onerror', {
          error: err
        });
        session.req.end();
        socket.disconnect();
      } else {
        var transcript = (chunk && chunk.results && chunk.results.length > 0);

        if (transcript && !recognize_end) {
          socket.emit('message', chunk);
        }
        if (recognize_end) {
          console.log(log(socket.id), 'results:', JSON.stringify(chunk, null, 2));
          console.log('socket.disconnect()');
          socket.disconnect();
        }
      }
    };
  };

  io.on('connection', function(socket) {
    var session = sessions[socket.id];

    socket.on('message', function(data) {
      //console.log(log(socket.id),'message:', data);

      if (!session.open) {
        session.open = true;
        var payload = {
          session_id: session.session_id,
          cookie_session: session.cookie_session,
          content_type: 'audio/l16; rate=' + (data.rate || 48000),
          continuous: true,
          interim_results: true
        };
        // POST /recognize to send data in every message we get
        session.req = speechToText.recognizeLive(payload, observe_results(socket, true));
        // GET /observeResult to get live transcripts
        speechToText.observeResult(payload, observe_results(socket, false));

      } else if (data.disconnect) {
        // Client send disconnect message.
        // end the /recognize request
        session.req.end();
      } else {
        session.req.write(data.audio);
      }
    });

    // Delete the session on disconnect
    socket.on('disconnect', function() {
      speechToText.deleteSession(session, function() {
        delete sessions[socket.id];
        console.log(log(socket.id), 'delete_session');
      });
    });
  });

};