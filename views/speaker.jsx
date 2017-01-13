import React from 'react';

export function SpeakersView(props) {
  try {
    const results = props.messages.map(msg => {
      // When resultsBySpeaker is enabled, each msg.results array may contain multiple results.
      // The result_index is for the first result in the message,
      // so we need to count up from there to calculate the key.

      // resultsBySpeaker/SpeakerStream sets each results.speaker value once it is known, but can also return
      // results without any speaker set if the speakerlessInterim flag is set (for faster UI updates).
      return msg.results.map((result, i) => (
        <div key={`result-${msg.result_index + i}`}>
          <dt>{typeof result.speaker === 'number'
              ? `Speaker ${result.speaker}: `
              : '(Detecting speakers): '}</dt>
          <dd>{result.alternatives[0].transcript}</dd>
        </div>
      ));
    }).reduce((a, b) => a.concat(b), []); // the reduce() call flattens the array
    return (
      <dialog className="speaker-labels">
        {results}
      </dialog>
    );
  } catch (ex) {
    console.log(ex);
    return (
      <span>{ex.message}</span>
    );
  }
}

SpeakersView.propTypes = {
  messages: React.PropTypes.array.isRequired,
};
