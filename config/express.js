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
  bodyParser   = require('body-parser'),
  csrf         = require('csurf'),
  cookieParser = require('cookie-parser');

module.exports = function (app) {
  app.set('view engine', 'ejs');
  app.enable('trust proxy');

  // use only https
  var env = process.env.NODE_ENV || 'development';
  if ('production' === env) {
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

  // csrf
  var csrfProtection = csrf({ cookie: true });
  app.get('/', csrfProtection, function(req, res) {
    res.render('index', { ct: req.csrfToken() });
  });

  // apply to all requests that begin with /api/
  // csfr token
  app.use('/api/', csrfProtection);
};
