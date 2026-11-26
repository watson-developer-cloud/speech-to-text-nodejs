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
const assert = require('assert');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
require('@babel/register');
const { Demo } = require('../../views/demo.jsx');

describe('react', () => {
  it('should render some html', () => {
    const index = require('../../views/index.jsx').default;
    const element = React.createElement(index, null);
    const result = ReactDOMServer.renderToString(element);
    assert(result);
    assert.equal(result.substr(0, 5), '<html');
  });

  it('keeps a trailing space in the keyword field while a phrase is being typed', () => {
    const demo = new Demo();
    demo.state.keywords = 'how ';

    const html = ReactDOMServer.renderToStaticMarkup(demo.render());
    assert(html.includes('value="how "'));
  });

  it('uses unique non-empty phrases for recognition', () => {
    const demo = new Demo();
    demo.state.keywords = ' how did you, next, how did you, ';

    assert.deepStrictEqual(demo.getRecognizeOptions().keywords, ['how did you', 'next']);
  });
});
