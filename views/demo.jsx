import React from 'react';
import { Icon, Tabs, Pane, Alert } from 'watson-react-components';
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
            error: null
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
        this.setState({audioSource: 'mic', results: [], error: null});
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
            .on('error', this.handleError);
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
        // todo: spinner icon while loading audio
        // todo: use opus here for browsers that support it
        let filename = samples[this.state.model] && samples[this.state.model].files[which-1];
        if (!filename) {
            return this.handleError(`No sample ${which} available for model ${this.state.model}`, samples[this.state.model]);
        }
        this.setState({audioSource: 'sample-' + which, results: [], error: null});
        fetch('audio/' + filename).then(function(response) {
            // todo: see if there's a way to stream this data instead of downloading it and then processing it
            return response.blob();
        }).then(blob => {
            this.playFile(blob);
        }).catch(this.handleError);
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
            .on('playback-error', this.handleError)
            .on('error', this.handleError);
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
            .then(res => {
                if (res.status != 200) {
                    throw new Error(`Error retrieving auth token`);
                }
                return res.text()
            }) // todo: throw here if non-200 status
            .then(token => this.setState({token}))
            .catch(this.handleError);
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

    handleError(err, extra) {
        console.error(err, extra);
        // todo: catch specific errors here and provide a better UI
        if (err instanceof Error) {
            return this.setState({error: err.message})
        } else {
            this.setState({error: err});
        }
    },

    // todo: use classes instead of setting style to show/hide things, consider adding transitions
    render() {

        const err = this.state.error ? (<Alert type="error" color="red">
            <p className="base--p">{this.state.error}</p>
        </Alert>) : null;

        return (<div className="_container _container_large">
            <h2>Transcribe Audio</h2>

            <ul className="base--ul">
                <li className="base--li">Use your microphone to record audio (Chrome or Firefox only).</li>
                <li className="base--li">Upload pre-recorded audio (.wav, .flac, or .opus only).</li>
                <li className="base--li">Play one of the sample audio files.</li>
            </ul>
            <div style={{paddingRight: '3em', paddingBottom: '2em'}}>
                The returned result includes the recognized text, word alternatives, and spotted keywords. Some models can detect multiple speakers; this may slow down performance.
            </div>


            <h3>Setup</h3>

            <p>Voice Model: <ModelDropdown model={this.state.model} token={this.state.token} onChange={this.handleModelChange} /></p>

            <p>Keywords to spot: <input value={this.state.keywords} onChange={this.handleKeywordsChange} type="text" id="keywords"placeholder="Type comma separated keywords here (optional)" className="base--input"/></p>


            <button className="base--button" onClick={this.handleMicClick}><Icon type={this.state.audioSource === 'mic' ? 'stop' : 'microphone'} /> Record Audio</button>
            {' '}
            <label className="base--button"><Icon type={this.state.audioSource === 'upload' ? 'stop' : 'upload'} /> Upload Audio File
                <input type="file" ref={ r => this.fileInput = r } onChange={this.handleUploadClick} style={{display:'none'}} accept="audio/wav, audio/l16, audio/ogg, audio/flac, .wav, .ogg, .opus, .flac"/>
            </label>
            {' ' /* todo: make these a loading icon while the file is downloading -- also use opus files when possible */}
            <button className="base--button" onClick={this.handleSample1Click}><Icon type={this.state.audioSource === 'sample-1' ? 'stop' : 'play'} /> Play Sample 1</button>
            {' '}
            <button className="base--button" onClick={this.handleSample2Click}><Icon type={this.state.audioSource === 'sample-2' ? 'stop' : 'play'} /> Play Sample 2</button>

            {err}

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
