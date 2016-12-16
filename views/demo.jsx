import React from 'react';
import { Icon, Tabs, Pane, Alert } from 'watson-react-components';
import recognizeMicrophone from 'watson-speech/speech-to-text/recognize-microphone';
import recognizeFile from 'watson-speech/speech-to-text/recognize-file';
import ModelDropdown from './model-dropdown.jsx';
import { Transcript } from './transcript.jsx';
import { Keywords, getKeywordsSummary } from './keywords.jsx';
import JSONView from './json.jsx';
import samples from '../src/data/samples.json';

const ERR_MIC_NARROWBAND = 'Microphone transcription cannot accommodate narrowband voice models, please select a broadband one.';

export default React.createClass({

    getInitialState() {
        return {
            model: 'en-US_BroadbandModel',
            raw_messages: [],
            formatted_messages: [],
            audioSource: null,
            keywords: this.getKeywords('en-US_BroadbandModel'),
            // transcript model and keywords are the state that they were when the button was clicked.
            // Changing them during a transcription would cause a mismatch between the setting sent to the service and what is displayed on the demo, and could cause bugs.
            settingsAtStreamStart: {
                model: '',
                keywords: []
            },
            error: null
        };
    },

    reset() {
        this.setState({
            raw_messages: [],
            formatted_messages: [],
            error: null
        });
    },

    captureSettings() {
        this.setState({settingsAtStreamStart: {
            model: this.state.model,
            keywords: this.getKeywordsArr()
        }});
    },

    stopTranscription() {
        this.stream && this.stream.stop();
        this.setState({audioSource: null});
    },

    getRecognizeOptions(extra) {
        var keywords = this.getKeywordsArr();
        return Object.assign({
            token: this.state.token,
            smart_formatting: true, // formats phone numbers, currency, etc. (server-side)
            format: true, // adds capitals, periods, and a few other things (client-side)
            model: this.state.model,
            objectMode: true,
            continuous: true,
            keywords: keywords,
            keywords_threshold: keywords.length ? 0.01 : undefined, // note: in normal usage, you'd probably set this a bit higher
            timestamps: true
        }, extra);
    },

    isNarrowBand(model) {
        model = model || this.state.model;
        return model.indexOf('Narrowband') !== -1;
    },

    handleMicClick() {
        if (this.state.audioSource) {
            return this.stopTranscription();
        }
        this.reset();
        if(this.isNarrowBand()) {
            return this.handleError(ERR_MIC_NARROWBAND);
        }
        this.setState({audioSource: 'mic'});

        // The recognizeMicrophone() method is a helper method provided by the watson-speach package
        // It sets up the microphone, converts and downsamples the audio, and then transcribes it over a WebSocket connection
        // It also provides a number of optional features, some of which are enabled by default:
        //  * enables object mode by default (options.objectMode)
        //  * formats results (Capitals, periods, etc.) (options.format)
        //  * outputs the text to a DOM element - not used in this demo because it doesn't play nice with react (options.outputElement)
        //  * a few other things for backwards compatibility and sane defaults
        // In addition to this, it passes other service-level options along to the RecognizeStream that manages the actual WebSocket connection.
        this.handleStream(recognizeMicrophone(this.getRecognizeOptions()))
    },

    handleUploadClick() {
        if (this.state.audioSource) {
            return this.stopTranscription();
        }
        const file = this.fileInput.files[0];
        if (!file) {
            return;
        }
        this.reset();
        this.setState({audioSource: 'upload'});
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
        let filename = samples[this.state.model] && samples[this.state.model][which-1].filename;
        if (!filename) {
            return this.handleError(`No sample ${which} available for model ${this.state.model}`, samples[this.state.model]);
        }
        this.reset();
        this.setState({audioSource: 'sample-' + which});
        fetch('audio/' + filename).then(function(response) {
            // todo: see if there's a way to stream this data instead of downloading it and then processing it
            return response.blob();
        }).then(blob => {
            this.playFile(blob);
        }).catch(this.handleError);
    },

    playFile(file) {
        // The recognizeFile() method is a helper method provided by the watson-speach package
        // It accepts a file input and transcribes the contents over a WebSocket connection
        // It also provides a number of optional features, some of which are enabled by default:
        //  * enables object mode by default (options.objectMode)
        //  * plays the file in the browser if possible (options.play)
        //  * formats results (Capitals, periods, etc.) (options.format)
        //  * slows results down to realtime speed if received faster than realtime - this causes extra interim `data` events to be emitted (options.realtime)
        //  * combines speaker_labels with results (options.resultsBySpeaker)
        //  * outputs the text to a DOM element - not used in this demo because it doesn't play nice with react (options.outputElement)
        //  * a few other things for backwards compatibility and sane defaults
        // In addition to this, it passes other service-level options along to the RecognizeStream that manages the actual WebSocket connection.
        this.handleStream(recognizeFile(this.getRecognizeOptions({
            data: file,
            play: true, // play the audio out loud
            realtime: true, // use a helper stream to slow down the transcript output to match the audio speed (creates more interim results)
        })));
    },

    handleStream(stream) {
        this.stream = stream;
        this.captureSettings();

        // grab the formatted messages and also handle errors and such
        stream.on('data', this.handleFormattedMessage)
            .on('end', this.handleTranscriptEnd)
            .on('error', this.handleError);

        // grab raw messages from the debugging events for display on the JSON tab
        stream.recognizeStream
            .on('message', (frame, json) => this.handleRawdMessage({
                sent: false,
                frame,
                json
            }))
            .on('send-json', json => this.handleRawdMessage({
                sent: true,
                json
            }))
            .once('send-data', data => this.handleRawdMessage({
                sent: true,
                binary: true,
                data
            }));
    },

    handleRawdMessage(msg) {
        this.setState({
            raw_messages: this.state.raw_messages.concat(msg)
        });
    },

    handleFormattedMessage(msg) {
        this.setState({
            formatted_messages: this.state.formatted_messages.concat(msg)
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

    getKeywords(model) {
        // a few models have more than two sample files, but the demo can only handle two samples at the moment
        // so this just takes the keywords from the first two samples
        const files = samples[model];
        return files[0].keywords + ', ' + files[1].keywords;
    },

    handleModelChange(model) {
        this.setState({
            model,
            keywords: this.getKeywords(model)
        });
        // clear the microphone narrowband error if it's visible and a broadband model was just selected
        if (this.state.error === ERR_MIC_NARROWBAND && !this.isNarrowBand(model)) {
            this.setState({
                error: null
            })
        }
    },

    supportsSpeakerLabels(model) {
        // todo: make this read from the list of models
    },

    handleKeywordsChange(e) {
        this.setState({keywords: e.target.value});
    },

    // cleans up the keywords string into an array of individual, trimmed, non-empty keywords/phrases
    getKeywordsArr() {
        return this.state.keywords.split(',').map(k=>k.trim()).filter(k=>k);
    },

    getFinalResults() {
        return this.state.formatted_messages.filter( r => r.results && r.results[0].final );
    },

    getCurrentInterimResult() {
        const r = this.state.formatted_messages[this.state.formatted_messages.length-1];

        // When resultsBySpeaker is enabled, each msg.results array may contain multiple results. However, all results
        // in a given message will be either final or interim, so just checking the first one still works here.
        if (!r || !r.results || r.results[0].final) {
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


            <button className={this.isNarrowBand() ? 'base--button base--button_black' : 'base--button'} onClick={this.handleMicClick}><Icon type={this.state.audioSource === 'mic' ? 'stop' : 'microphone'} /> Record Audio</button>

            {' '}
            <label className="base--button" style={{display: this.state.audioSource === 'upload' ? 'none' : undefined}}><Icon type='upload' /> Upload Audio File
                <input type="file" ref={ r => this.fileInput = r } onChange={this.handleUploadClick} style={{display:'none'}} accept="audio/wav, audio/l16, audio/ogg, audio/flac, .wav, .ogg, .opus, .flac"/>
            </label>
            <button className="base--button" style={{display: this.state.audioSource === 'upload' ? undefined : 'none'}}><Icon type='stop' /> Upload Audio File</button>

            {' ' /* todo: make these a loading icon while the file is downloading -- also use opus files when possible */}
            <button className="base--button" onClick={this.handleSample1Click}><Icon type={this.state.audioSource === 'sample-1' ? 'stop' : 'play'} /> Play Sample 1</button>
            {' '}
            <button className="base--button" onClick={this.handleSample2Click}><Icon type={this.state.audioSource === 'sample-2' ? 'stop' : 'play'} /> Play Sample 2</button>

            {err}

            <h3>Output</h3>
            <Tabs selected={0}>
                <Pane label="Text">
                    <Transcript messages={this.getFinalAndLatestInterimResult()} />
                </Pane>
                <Pane label={"Keywords " + getKeywordsSummary(this.state.settingsAtStreamStart.keywords, this.getFinalAndLatestInterimResult())}>
                    <Keywords messages={this.getFinalAndLatestInterimResult()} keywords={this.state.settingsAtStreamStart.keywords} isInProgress={!!this.state.audioSource} />
                </Pane>
                <Pane label="JSON">
                    <JSONView raw={this.state.raw_messages} formatted={this.state.formatted_messages} />
                </Pane>
            </Tabs>

        </div>);
    }
});
