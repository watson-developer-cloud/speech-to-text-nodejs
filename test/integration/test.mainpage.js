/* eslint no-undef: 0 */
/* eslint prefer-arrow-callback: 0 */
casper.test.begin('Speech to Text', 7, function suite(test) {
  const baseHost = 'http://localhost:3000';

  function testForButtons() {
    casper.waitForSelector('div.buttons-container', function () {
      test.assertExists('button.base--button.speak-button', 'displays speak button');
      test.assertExists('button.base--button.download-button', 'displays download button');
      test.assertExists('div.reset-container.dimmed', 'displays reset-container dimmed');
      test.assertExists('div.reset-container.dimmed > a.reset-button', 'displays reset-container dimmed with child link');
    });
  }

  function testForSelection() {
    casper.waitForSelector('div.voice-input', function () {
      test.assertExists('div.voice-input > select.base--select', 'has voice select');
    });
  }

  casper.start(baseHost, function (result) {
    test.assert(result.status === 200, 'Front page opens');
    test.assertEquals(this.getTitle(), 'Text to Speech Demo', 'Title is found');
    testForButtons();
    testForSelection();
  });

  casper.run(function () {
    test.done();
  });
});
