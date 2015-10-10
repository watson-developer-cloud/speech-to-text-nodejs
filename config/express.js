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

// Module dependencies
var express    = require('express'),
  favicon      = require('serve-favicon'),
  errorhandler = require('errorhandler'),
  secure       = require('express-secure-only'),
  bodyParser   = require('body-parser'),
  morgan       = require('morgan'),
  csrf         = require('csurf'),
  cookieParser = require('cookie-parser'),
  fs           = require('fs');

module.exports = function (app) {
  app.set('view engine', 'ejs');
  app.enable('trust proxy');

  var logStream = fs.createWriteStream(__dirname + '/../logs/access.log', {flags: 'a'});
  // setup the logger
  app.use('/api/', morgan('combined', {stream: logStream}));


  // use only https
  var env = process.env.NODE_ENV || 'development';
  if ('production' === env) {
    console.log('redirect http to https');
    //app.use(secure());
    app.use(errorhandler());
  }

  // Configure Express
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  // Setup static public directory
  app.use(express.static(__dirname + '/../public'));
  app.use(favicon(__dirname + '/../public/images/favicon.ico'));

  // cookies
  var secret = Math.random().toString(36).substring(7);
  app.use(cookieParser(secret));

  var errorMessage = {
    error:'Too many requests, please try again in 30 seconds.',
    code: 429
  };

  // rate limiting
  var rateLimit = require('express-rate-limit');
  var limiter = rateLimit({
    windowMs: 30 * 1000, // seconds
    delayMs: 0,
    max: 3,
    message: JSON.stringify(errorMessage),
    global: false
  });

  // csrf
  var csrfProtection = csrf({ cookie: true });
  app.get('/', csrfProtection, function(req, res) {
    res.render('index', { ct: req.csrfToken() });
  });

  // apply to all requests that begin with /api/
  // csfr token and rate limiting.
  app.use('/api/', csrfProtection, limiter);
};
