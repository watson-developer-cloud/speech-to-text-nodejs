import React from 'react';

function flattenReducer(a,b) {
    return a.concat(b);
}

export function Timing(props) {
    // todo: add some caching if this proves to be too expensive to re-run on every result
    const words = props.results.map();
    return (
        <div>
            {words}
            <span>{formatter.formatString(getText(props.interimResult), true)}</span>
        </div>
    );
}
