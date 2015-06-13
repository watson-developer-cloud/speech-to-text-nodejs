/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
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

module.exports = function(credentials) {

  var http = require('http'),
      connect = require('connect'),
      transformerProxy = require('transformer-proxy'),
      httpProxy = require('http-proxy');


  var proxyUrl = credentials.hostname;

	console.log('proxyUrl', proxyUrl);

  var proxy = httpProxy.createProxyServer({
    target: proxyUrl,
      secure: false,
      ws: true
  });

  var proxyServer = http.createServer(function (req, res) {
    proxy.web(req, res);
  });


  var creds = new Buffer(credentials.username + ':' + credentials.password).toString('base64');

  // Listen to the `upgrade` event and proxy the
  // WebSocket requests as well.
  proxyServer.on('upgrade', function (req, socket, head) {
    console.log('upgrade request', req);
    req.headers['Authorization'] = 'Basic ' + creds;
    proxy.ws(req, socket, head);
    proxy.on('error', function(err) {
      console.log('WS proxy error: ', err);
    });
  });

  var websocketPort = 8020;
  console.log('Proxy websocket server listening at: ' + websocketPort);
  proxyServer.listen(websocketPort);

};