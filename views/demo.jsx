import React from 'react';

export default function() {
    return (<div className="_container _container_large">
        <h2>Transcribe Audio</h2>
        <p className="base--p">Use your microphone (compatible only with <a className="base--a" href="https://www.google.com/intl/en/chrome/browser/desktop/">Google Chrome</a> and <a className="base--a" href="https://www.mozilla.org/en-US/firefox/new/">Mozilla Firefox</a>).
            Upload pre-recorded audio (WAV for uncompressed audio, FLAC or OPUS) file formats.
            Drag and drop recorded audio onto the page, or use the audio samples provided.
            The returned result includes the recognized text, word alternatives (aka confusion networks), and spotted keywords.
            You may choose to spot your keywords by entering them (separated by commas) in the text box.</p>
    </div>);
}
