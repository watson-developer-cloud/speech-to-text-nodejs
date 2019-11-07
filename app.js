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

const express = require('express');

const app = express();
const { IamTokenManager } = require('ibm-watson/auth');

// Bootstrap application settings
require('./config/express')(app);

const serviceUrl = process.env.SPEECH_TO_TEXT_URL;

const tokenManager = new IamTokenManager({
  apikey: process.env.SPEECH_TO_TEXT_IAM_APIKEY || '<iam_apikey>',
});


app.get('/', (req, res) => res.render('index'));

// Get credentials using your credentials
app.get('/api/v1/credentials', async (req, res, next) => {
  try {
    const accessToken = await tokenManager.getToken();
    res.json({
      accessToken,
      serviceUrl,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = app;
