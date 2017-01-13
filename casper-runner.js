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

if (!process.env.SPEECH_TO_TEXT_USERNAME) {
  console.log('Skipping integration tests because SPEECH_TO_TEXT_USERNAME is null');
  process.exit(0);
}

require('dotenv').config({silent: true});

const spawn = require('child_process').spawn;

const app = require('./app');
const port = 3000;

const server = app.listen(port, () => {
  console.log('Server running on port: %d', port);

  function kill(code) {
    server.close(() => {
      process.exit(code);
    });
  }

  function runTests() {
    const casper = spawn('npm', ['run', 'test-integration']);
    casper.stdout.pipe(process.stdout);

    casper.on('error', (error) => {
      console.log(`ERROR: ${error}`);
      server.close(() => {
        process.exit(1);
      });
    });

    casper.on('close', kill);
  }

  runTests();
});
