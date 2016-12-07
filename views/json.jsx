import React from 'react';
import { JsonLink } from 'watson-react-components';


function resultSummary(r, i) {
    const json = JSON.stringify(r);
    const str = (json.length <= 78) ? str : json.substr(0,14) + ' ...' + json.substr(-60);

    return (
        <JsonLink json={r} key={i} >
            <code>{str}</code>
        </JsonLink>
    )
}

export function JSONView(props) {
    // todo: include opening request JSON

    // todo: make the display a little more friendly - e.g. label interim vs final vs speaker_labels

    // note: this originally rendered the JSON inline with a <Code> tag, but that silently crashed during highlighting.
    // This is probably better for performance anyways.
    const output = props.results.map(resultSummary);

    return (
        <div>
            {output}
        </div>
    );
}
