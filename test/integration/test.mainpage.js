/* eslint no-undef: 0 */
/* eslint prefer-arrow-callback: 0 */
/* eslint func-names: 0 */
/**
* @file
*   Testing to verify the Speech to Text demo is working properly
*/

// Define the suite of tests and give it the following properties:
// - Title, which shows up before any of the pass/fails.
// - Number of tests, must be changed as you add tests.
// - suite(), which contains all of your tests.
//
// @see http://casperjs.readthedocs.org/en/latest

casper.test.begin('Speech to Text', 23, function suite(test) {
  const baseHost = 'http://localhost:3000';

  function testForButtons() {
    casper.test.comment('Testing the 4 buttons');

    test.assertExists('button.base--button:nth-child(1)', 'displays Record Audio');
    test.assertExists('button.base--button:nth-child(2)', 'displays Upload Audio File');
    test.assertExists('button.base--button:nth-child(3)', 'displays Play Sample 1');
    test.assertExists('button.base--button:nth-child(4)', 'displays Play Sample 2');
    test.assertElementCount('button.base--button', 4);
  }

  function testVoiceModel() {
    casper.test.comment('Testing the Voice Model box');

    test.assertExists('select.base--select', 'displays Voice Model');
    test.assertSelectorHasText('select.base--select option', 'French broadband', 'French model is found');
    test.assertSelectorHasText('select.base--select option', 'Spanish broadband', 'Spanish model is found');
  }

  function testKeywords() {
    casper.test.comment('Testing the Keywords to spot box');

    test.assertExists('#keywords', 'displays Keywords to spot');
  }

  function testForTabpanels() {
    casper.test.comment('Testing the Output section');

    casper.then(function () {
      this.click('ul.tab-panels--tab-list li:nth-child(1)');
      test.assertSelectorHasText('ul.tab-panels--tab-list li:nth-child(1)', 'Text');
      test.assertHttpStatus(200);
    });
    casper.then(function () {
      this.click('ul.tab-panels--tab-list li:nth-child(3)');
      test.assertSelectorHasText('ul.tab-panels--tab-list li:nth-child(3)', 'Keywords (0/0)');
      test.assertHttpStatus(200);
    });
    casper.then(function () {
      this.click('ul.tab-panels--tab-list li:nth-child(4)');
      test.assertSelectorHasText('ul.tab-panels--tab-list li:nth-child(4)', 'JSON');
      test.assertHttpStatus(200);
    });
  }

  function checkLinkDest(selectorToClick) {
    casper.then(function () {
      this.click(selectorToClick);
      test.assertHttpStatus(200);
    });
  }

  function testHeaderLinks() {
    casper.test.comment('Testing the header links');

    checkLinkDest('div.header--wordmark');
    checkLinkDest('div.header--breadcrumbs');

    checkLinkDest('nav.jumbotron--nav li:nth-child(1)');
    checkLinkDest('nav.jumbotron--nav li:nth-child(2)');
    checkLinkDest('nav.jumbotron--nav li:nth-child(3)');
  }

  function testPlaySample() {
    casper.test.comment('Testing playing sameple 1');

    // casper.then() allows us to wait until previous tests and actions are
    // completed before moving on to the next steps.
    casper.then(function () {
      this.waitForSelector('button.base--button:nth-child(3)', function () {
        this.click('button.base--button:nth-child(3)');
      });
    });

    casper.waitForSelector('div.tab-panels--tab-content', function () {
      test.assertHttpStatus(200);
    });
  }

  casper.start(baseHost, function (result) {
    casper.test.comment('Starting Testing');

    test.assert(result.status === 200, 'Front page opens');
    test.assertEquals(this.getTitle(), 'Speech to Text Demo', 'Title is found');

    testHeaderLinks();
    testVoiceModel();
    testKeywords();
    testForButtons();
    testForTabpanels();
    testPlaySample();
  });

  casper.run(function () {
    test.done();
  });
});
