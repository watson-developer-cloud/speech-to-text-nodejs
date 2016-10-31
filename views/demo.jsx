import React from 'react';
import { ButtonsGroup } from 'watson-react-components';
import ModelDropdown from './ModelDropdown.jsx';
import SpeechToText from 'watson-speech/speech-to-text';


export default React.createClass({

    getInitialState() {
        return {
            model: 'en-US_BroadbandModel'
        };
    },

    handleSourceClick(e) {
        console.log(e.target.value)
    },

    componentDidMount() {
        this.fetchToken();
        // tokens expire after 60 minutes, so automatcally fetch a new one ever 50 minutes
        // Not sure if this will work properly if a computer goes to sleep for > 50 minutes and then wakes back up
        // react automatically binds the call to this
        this.state.tokenInterval = setInterval(this.fetchToken, 50*1000);
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
        this.setState({model})
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

            <input type="text" id="keywords" placeholder="Type comma separated keywords here (optional)" className="base--input"></input>

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


        </div>);
    }
});
