import React from 'react';
import { ButtonsGroup, Tabs, Pane } from 'watson-react-components';
import SpeechToText from 'watson-speech/speech-to-text';
import ModelDropdown from './model-dropdown.jsx';
import { Transcript } from './transcript.jsx';
import { Keywords, getKeywordsSummary } from './keywords.jsx';
import { JSONView } from './json.jsx';
import samples from '../src/data/samples.json';

export default React.createClass({

    getInitialState() {
        return {
            model: 'en-US_BroadbandModel',
            results: [],
            audioSource: null,
            keywords: samples['en-US_BroadbandModel'].keywords.join(', '),
            // transcript model and keywords are the state that they were when the button was clicked.
            // Changing them during a transcription would cause a mismatch between the setting sent to the service and what is displayed on the demo, and could cause bugs.
            settingsAtStreamStart: {
                model: '',
                keywords: []
            },
        };
    },

    stopTranscription() {
        this.stream && this.stream.stop();
        this.setState({audioSource: null});
    },

    handleMicClick() {
        if (this.state.audioSource) {
            return this.stopTranscription();
        }
        this.setState({audioSource: 'mic', results: []});
        this.stream = SpeechToText.recognizeMicrophone({
            // todo: keywords, timing, etc
            token: this.state.token,
            smart_formatting: true, // formats phone numbers, currency, etc. (server-side)
            format: false, // formats sentences (client-side) - false here so that we can show the original JSON on that tab, but the Text tab does apply this.
            model: this.state.model,
            objectMode: true,
            continuous: true,
            keywords: this.getKeywordsArr(),
            keywords_threshold: 0.01, // note: in normal usage, you'd probably set this a bit higher
            timestamps: true
        })
            .on('data', this.handleResult)
            .on('end', this.handleTranscriptEnd)
            .on('error', e => console.log(e)); // todo: ui
        this.setState({settingsAtStreamStart: {
            model: this.state.model,
            keywords: this.getKeywordsArr()
        }});
    },

    handleUploadClick() {
        if (this.state.audioSource) {
            return this.stopTranscription();
        }
        const file = this.fileInput.files[0];
        if (!file) {
            return;
        }
        this.setState({audioSource: 'upload', results: []});
        this.playFile(file);
    },

    handleSample1Click() {
        this.handleSampleClick(1);
    },
    handleSample2Click() {
        this.handleSampleClick(2);
    },

    handleSampleClick(which) {
        if (this.state.audioSource) {
            return this.stopTranscription();
        }
        // todo: icons: play arrow when not playing, spinner when loading, stop button when playing
        // todo: use opus here for browsers that support it
        let filename = samples[this.state.model] && samples[this.state.model].files[which-1];
        if (!filename) {
            // todo: ui
            return console.log(`No sample ${which} available for model ${this.state.model}`, samples[this.state.model]);
        }
        this.setState({audioSource: 'sample-' + which, results: []});
        fetch('audio/' + filename).then(function(response) {
            // todo: see if there's a way to stream this data instead of downloading it and then processing it
            return response.blob();
        }).then(blob => {
            this.playFile(blob);
        }).catch(function(error) {
            console.log(error); // todo: ui
        });
    },

    playFile(file) {
        // todo: show a warning if browser cannot play filetype (flac)
        // todo: show a warning if browser cannot play filetype (flac)
        this.stream = SpeechToText.recognizeFile({
            token: this.state.token,
            data: file,
            play: true, // play the audio out loud
            realtime: true, // slows the results down to realtime if they come back faster than real-time (client-side)
            smart_formatting: true, // formats phone numbers, currency, etc. (server-side)
            format: false, // formats sentences (client-side) - false here so that we can show the original JSON on that tab, but the Text tab does apply this.
            model: this.state.model,
            objectMode: true,
            continuous: true,
            keywords: this.getKeywordsArr(),
            keywords_threshold: 0.01, // note: in normal usage, you'd probably set this a bit higher
            timestamps: true
        })
            .on('data', this.handleResult)
            .on('end', this.handleTranscriptEnd)
            .on('playback-error', e => console.log('unable to play file type in browser', e)) // todo: ui
            .on('error', e => console.log(e)); // todo: ui
        //['send-json','receive-json', 'data', 'error', 'connect', 'listening','close','enc'].forEach(e => this.stream.on(e, console.log.bind(console, e)));
        this.setState({settingsAtStreamStart: {
            model: this.state.model,
            keywords: this.getKeywordsArr()
        }});
    },

    handleResult(result) {
        this.setState({
            results: this.state.results.concat(result), // concat = new array = immutable state
        });
    },

    handleTranscriptEnd() {
        this.setState({audioSource: null});
    },

    componentDidMount() {
        this.fetchToken();
        // tokens expire after 60 minutes, so automatcally fetch a new one ever 50 minutes
        // Not sure if this will work properly if a computer goes to sleep for > 50 minutes and then wakes back up
        // react automatically binds the call to this
        this.state.tokenInterval = setInterval(this.fetchToken, 50*60*1000);
    },

    componentWillUnmount() {
        clearInterval(this.state.tokenInterval);
    },

    fetchToken() {
        return fetch('/api/token')
            .then(res => res.text())
            .then(token => this.setState({token}))
            // eslint-disable-next-line no-console
            .catch(err => console.log('error retrieving token', err));
    },

    handleModelChange(model) {
        const keywords = (samples[model] && samples[model].keywords) || '';
        this.setState({model, keywords})
    },

    handleKeywordsChange(e) {
        this.setState({keywords: e.target.value});
    },

    // cleans up the keywords string into an array of individual, trimmed, non-empty keywords/phrases
    getKeywordsArr() {
        return this.state.keywords.split(',').map(k=>k.trim()).filter(k=>k);
    },

    getFinalResults() {
        return this.state.results.filter( r => r.final );
    },

    getCurrentInterimResult() {
        const r = this.state.results[this.state.results.length-1];
        if (!r || r.final) {
            return null;
        }
        return r;
    },

    getFinalAndLatestInterimResult() {
        const final = this.getFinalResults();
        const interim = this.getCurrentInterimResult();
        if (interim) {
            final.push(interim);
        }
        return final;
    },

    // todo: use classes instead of setting style to show/hide things, consider adding transitions
    render() {
        return (<div className="_container _container_large">
            <h2>Transcribe Audio</h2>
            <p className="base--p">Use your microphone (compatible only with <a className="base--a"
                                                                                href="https://www.google.com/intl/en/chrome/browser/desktop/">Google
                Chrome</a> and <a className="base--a" href="https://www.mozilla.org/en-US/firefox/new/">Mozilla
                Firefox</a>).
                Upload pre-recorded audio (WAV for uncompressed audio, FLAC or OPUS) file formats.
                Drag and drop recorded audio onto the page, or use the audio samples provided.
                The returned result includes the recognized text, word alternatives (aka confusion networks), and
                spotted keywords.
                You may choose to spot your keywords by entering them (separated by commas) in the text box.</p>

            <h3>Setup</h3>

            <p>Voice Model: <ModelDropdown model={this.state.model} token={this.state.token} onChange={this.handleModelChange} /></p>

            <p>Keywords to spot: <input value={this.state.keywords} onChange={this.handleKeywordsChange} type="text" id="keywords"placeholder="Type comma separated keywords here (optional)" className="base--input"/></p>


            <button className="base--button" onClick={this.handleMicClick}>Record Audio</button>
            {' '}
            <label className="base--button">Upload Audio File
                <input type="file" ref={ r => this.fileInput = r } onChange={this.handleUploadClick} style={{display:'none'}} accept="audio/wav, audio/l16, audio/ogg, audio/flac, .wav, .ogg, .opus, .flac"/>
            </label>
            {' '}
            <button className="base--button" onClick={this.handleSample1Click}>Play Sample 1</button>
            {' '}
            <button className="base--button" onClick={this.handleSample2Click}>Play Sample 2</button>


            <h3>Output</h3>
            <Tabs selected={0}>
                <Pane label="Text">
                    <Transcript results={this.getFinalResults()} interimResult={this.getCurrentInterimResult()} model={this.state.settingsAtStreamStart.model} />
                </Pane>
                <Pane label={"Keywords " + getKeywordsSummary(this.state.settingsAtStreamStart.keywords, this.getFinalAndLatestInterimResult())}>
                    <Keywords results={this.getFinalAndLatestInterimResult()} keywords={this.state.settingsAtStreamStart.keywords} isInProgress={!!this.state.audioSource} />
                </Pane>
                <Pane label="JSON">
                    <JSONView results={this.state.results} />
                </Pane>
            </Tabs>

        </div>);
    }
});
