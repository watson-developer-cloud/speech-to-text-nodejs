import React from 'react';

export function SpeakerLabels(props) {

    const results = props.messages.map(msg => {
        // When resultsBySpeaker is enabled, each msg.results array may contain multiple results.
        // The result_index is for the first result in the message, so we need to count up from there to calculate the key.
        return msg.results.map( (result,i) => (
            <div key={`result-${msg.result_index + i}`}>
                <dt>{result.speaker}: </dt>
                <dd>{result.alternatives[0].transcript}</dd>
            </div>
        ))
    }).reduce((a,b) => a.concat(b), []); // the reduce() call flattens the array
    return (
        <dialog className="speaker-labels">
            {results}
        </dialog>
    );
}
