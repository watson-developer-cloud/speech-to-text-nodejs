import React from 'react';
import {Icon} from 'watson-react-components';

// reducer to convert a list of messages into a (flat) list of results
function allResultsReducer(list, message) {
  return list.concat(message.results);
}

// reducer to extract all matched keywords from a list of results
function keywordReducer(keywords, result) {
  Object.keys(result.keywords_result || {}).forEach(k => {
    keywords[k] = keywords[k] || [];
    keywords[k].push(...result.keywords_result[k]);
  });
  return keywords;
}

function getSpotted(messages) {
  return messages.reduce(allResultsReducer, []).reduce(keywordReducer, {});
}

export function Keywords(props) {
  const notSpotted = props.isInProgress
    ? 'Not yet spotted.'
    : 'Not spotted.';
  const notSpottedIcon = props.isInProgress
    ? 'loader'
    : 'close';
  const spotted = getSpotted(props.messages);
  const list = props.keywords.map(k => {
    const spottings = spotted[k];
    return (
      <li key={k} className="base--li">
        <Icon type={spottings
          ? 'success-o'
          : notSpottedIcon} size="small"/> {' '}
        <b>{k}</b>: {spottings
          ? 'Spotted - '
          : notSpotted}
        <span className="base--p_light">
          {(spottings || []).map(s => `${s.start_time}-${s.end_time}s (${Math.round(s.confidence * 100)}%)`).join(', ')}
        </span>
      </li>
    );
  });
  return (
    <div>
      <ul className="base--ul base--ul_no-bullets">
        {list}
      </ul>
    </div>
  );
}

Keywords.propTypes = {
  messages: React.PropTypes.array.isRequired,
  keywords: React.PropTypes.array.isRequired,
  isInProgress: React.PropTypes.bool.isRequired,
};

export function getKeywordsSummary(keywords, messages) {
  const spotted = Object.keys(getSpotted(messages)).length;
  const total = keywords.length;
  return `(${spotted}/${total})`;
}
