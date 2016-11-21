import React from 'react';
import { FormatStream } from 'watson-speech/speech-to-text';


function getText(result) {
    return (result && result.alternatives && result.alternatives[0] && result.alternatives[0].transcript) || '';
}


export function Transcript(props) {
    const formatter = new FormatStream({model: props.model});

    // todo: add some caching if this proves to be too expensive to re-run on every result
    const results = props.results.map(result => {
        const str = getText(result);
        return (<span key={`result-${result.index}`}>{formatter.formatString(str)}</span>);
    });
    return (
        <div>
        {results}
        <span>{formatter.formatString(getText(props.interimResult), true)}</span>
        </div>
    );
}
