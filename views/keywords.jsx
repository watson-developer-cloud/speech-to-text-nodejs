import React from 'react';


function keywordReducer(keywords, result) {
    console.log('reducing', result, keywords);
    Object.keys(result.keywords_result || {}).forEach(k => {
        keywords[k] = keywords[k] || [];
        keywords[k].push(...result.keywords_result[k]);
    });
    return keywords;
}

function renderSpottings(spottings) {
    let list;
    if (spottings) {
        list = spottings.map(s => `${s.start_time}-${s.end_time}s (${Math.round(s.confidence * 100)}%)`).join(', ');
    } else {
        list = '(not spotted)';
    }
    return (<span>{list}</span>);
}


export function Keywords(props) {
    const spotted = props.results.reduce(keywordReducer, {});
    const list = props.keywords.map(k => (<li key={k} className="base--li"><b>{k}</b>: {renderSpottings(spotted[k])}</li>));
    // todo: Think about a better way of displaying this, perhaps in-line with the text and just highlight the appropriate word
    // todo: figure out why some styles such as base--ul_no-bullets base--p_light don't seem to work
    return (
        <div>
            <ul className="base--ul base--ul_no-bullets">
                {list}
            </ul>
            <p className="base--p base--p_light">Format for each spotted keyword is start time-end time (% confidence).</p>
        </div>
    );
}
