import React from 'react';
import { ButtonsGroup, Tabs, Pane } from 'watson-react-components';
import SpeechToText from 'watson-speech/speech-to-text';
import ModelDropdown from './model-dropdown.jsx';
import { Transcript } from './transcript.jsx';
import { KeywordsSpotted } from './keywords.jsx';
import samples from '../src/data/samples.json';

export default React.createClass({

    getInitialState() {
        return {
            model: 'en-US_BroadbandModel',
            results: [],
            interimResult: null,
            audioSource: null,
            keywords: samples['en-US_BroadbandModel'].keywords.join(',')
        };
    },

    handleSourceClick(e) {
        const source = e.target.value;
        if (this.state.audioSource) {
            return this.stopTranscription();
        }
        // todo: reset results and interimResults
        switch (source) {
            case 'mic':
                return this.handleMicClick();
            case 'upload':
                return this.handleUploadClick();
            case 'sample-1':
                return this.handleSampleClick(1);
            case 'sample-2':
                return this.handleSampleClick(2);
            default:
                console.log('Unhandled source: ', source);
        }
    },

    stopTranscription() {
        this.stream && this.stream.stop();
        this.setState({audioSource: null});
    },

    handleMicClick() {
        console.log('handling mic click');
        this.setState({audioSource: 'mic'});
        this.stream = SpeechToText.recognizeMicrophone({
            // todo: keywords, timing, etc
            token: this.state.token,
            format: false, // so that we can show the correct output on the JSON tab. Formatting will be applied by the Transcript element
            model: this.state.model,
            objectMode: true
        })
            .on('data', this.handleResult)
            .on('end', this.handleTranscriptEnd)
            .on('error', e => console.log(e));
    },

    handleUploadClick() {
        // todo: stick a hidden file input in the dom, have this trigger a click on it, when the value changes, send it to SpeechToText.recognizeFile();
        alert('File upload is not yet implemented :(');
    },

    handleSampleClick(which) {
        let filename = samples[this.state.model] && samples[this.state.model].files[which-1];
        if (!filename) {
            return console.log(`No sample ${which} available for model ${this.state.model}`, samples[this.state.model]);
        }
        this.setState({audioSource: 'sample-' + which});
        fetch('audio/' + filename).then(function(response) {
            // todo: see if there's a way to stream this data instead of downloading it and then processing it
            return response.blob();
        }).then(blob => {
            this.stream = SpeechToText.recognizeFile({
                // todo: keywords, timing, etc
                token: this.state.token,
                data: blob,
                play: true, // play the audio out loud
                format: false, // so that we can show the correct output on the JSON tab. Formatting will be applied by the Transcript element
                model: this.state.model,
                objectMode: true
            })
            .on('data', this.handleResult)
            .on('end', this.handleTranscriptEnd)
            .on('error', e => console.log(e));

        }).catch(function(error) {
            console.log(error);
        });
    },

    handleResult(result) {
        if(result.final) {
            this.setState({
                results: this.state.results.concat(result), // concat = new array = immutable state
                interimResult: null
            });
        } else {
            this.setState({
                interimResult: result
            });
        }
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

    getKeywordsArr() {
        return this.state.keywords.split(',').map(k=>k.trim()).filter(k=>k);
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

            <ModelDropdown model={this.state.model} token={this.state.token} onChange={this.handleModelChange} />

            <input value={this.state.keywords} onChange={this.handleKeywordsChange} type="text" id="keywords"placeholder="Type comma separated keywords here (optional)" className="base--input"/>

            <ButtonsGroup
                type="button"
                name="button"
                onClick={this.handleSourceClick}
                buttons={[{
                    value: 'mic',
                    id: 'mic',
                    text: 'Record Audio',
                }, {
                    value: 'upload',
                    id: 'upload',
                    text: 'Select Audio File',
                }, {
                    value: 'sample-1',
                    id: 'sample-1',
                    text: 'Play Sample 1',
                }, {
                    value: 'sample-2',
                    id: 'sample-2',
                    text: 'Play Sample 2',
                }]}
            />

            <Tabs selected={0}>
                <Pane label="Text">
                    <Transcript results={this.state.results} interimResult={this.state.interimResult} model={this.state.model} />
                </Pane>
                <Pane label="Keywords">
                    <KeywordsSpotted results={this.state.results} keywords={this.getKeywordsArr()} />
                </Pane>
            </Tabs>

        </div>);
    }
});
