import React from 'react';
import { Icon } from 'watson-react-components';


function keywordReducer(keywords, msg) {
    const result = msg.results[0];
    Object.keys(result.keywords_result || {}).forEach(k => {
        keywords[k] = keywords[k] || [];
        keywords[k].push(...result.keywords_result[k]);
    });
    return keywords;
}

export function Keywords(props) {
    const notSpotted = props.isInProgress ? 'Not yet spotted.' : 'Not spotted.';
    const notSpottedIcon = props.isInProgress ? 'loader' : 'close';
    const spotted = props.results.reduce(keywordReducer, {});
    const list = props.keywords.map(k => {
        const spottings = spotted[k];
        return (
            <li key={k} className="base--li">
                <Icon type={spottings ? 'success-o' : notSpottedIcon} size="small"  />
                {' '}
                <b>{k}</b>: {spottings ? 'Spotted - ' : notSpotted}
                <span className="base--p_light">
                    {(spottings || []).map(s => `${s.start_time}-${s.end_time}s (${Math.round(s.confidence * 100)}%)`).join(', ')}
                </span>
            </li>
        )
    });
    return (
        <div>
            <ul className="base--ul base--ul_no-bullets">
                {list}
            </ul>
        </div>
    );
}

export function getKeywordsSummary(keywords, results) {
    const spotted = Object.keys(results.reduce(keywordReducer, {})).length;
    const total = keywords.length;
    return `(${spotted}/${total})`;
}
