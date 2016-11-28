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

    // todo: make the display a little more friendly

    // note: this originally rendered the JSON inline with a <Code> tag, but that silently crashed during highlighting.
    // This is probably better for performance anyways.

    // convert things back to the original format where each object has a results array with a single result in it
    const output = props.results.map(r => {
        const result = {
            results: [Object.assign({}, r)], // create a clone so that I can delete the result_index from it
            result_index: r.index
        };
        delete result.results[0].index;
        return result;
    })
        // then map to a
        .map(resultSummary);

    return (
        <div>
            {output}
        </div>
    );
}
