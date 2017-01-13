import React from 'react';
import {JsonLink, RadioGroup, Radio} from 'watson-react-components';

const RAW = 'raw';
const FORMATTED = 'formatted';

function makeJsonLink(obj, i) {
  if (!obj) {
    return null; //(<div key={`jsonlink-${i}`} />);
  }

  const json = JSON.stringify(obj);
  const str = (json.length <= 78)
    ? json
    : json.substr(0, 14) + ' ...' + json.substr(-60).replace(/,/g, ', '); // space after commas to help browsers decide where breakpoints should go on small screens

  return (
    <JsonLink json={obj} key={`jsonlink-${i}`}>
      <code>{str}</code>
    </JsonLink>
  );
}

// we want to insert nulls into the array rather than remove the elements so that the non-null items will have the same key
function nullImterim(msg) {
  if (msg.speaker_labels) {
    // some messages can have both results (final or interim) and speaker labels
    // in that case we want to show it for the speaker_labels, even if the result is interim
    return msg;
  } else if (msg.results && msg.results.length && !msg.results[0].final) {
    return null;
  } else {
    return msg;
  }
}

function nullInterimRaw(raw) {
  if (!raw.json || nullImterim(raw.json)) {
    return raw;
  } else {
    return null;
  }
}

function renderRawMessage(msg, i) {
  if (!msg) {
    return null; //(<div key={`raw-${i}`} />);
  }
  return (
    <div key={`raw-${i}`}>
      {msg.sent === true
        ? 'Sent: '
        : ' '}
      {msg.sent === false
        ? 'Received: '
        : ''}
      {msg.sent && msg.binary
        ? 'Audio data (ongoing...)'
        : ''}
      {msg.close
        ? `Connection closed: ${msg.code} ${msg.message || ''}`
        : ''}
      {makeJsonLink(msg.json, i)}
    </div>
  );
}

export default React.createClass({
  displayName: 'JsonView',

  propTypes: {
    raw: React.PropTypes.array.isRequired,
    formatted: React.PropTypes.array.isRequired,
  },

  getInitialState() {
    return {showRaw: true, interim: false};
  },

  handleShowChange(show) {
    this.setState({
      showRaw: show === RAW
    });
  },

  handleInterimChange() {
    this.setState({
      interim: !this.state.interim
    });
  },

  render() {
    // note: this originally rendered the JSON inline with a <Code> tag, but that silently crashed during highlighting.
    // This is probably better for performance anyways.
    try {
      let output;

      if (this.state.showRaw) {
        output = (this.state.interim
          ? this.props.raw
          : this.props.raw.map(nullInterimRaw)).map(renderRawMessage);
      } else {
        output = (this.state.interim
          ? this.props.formatted
          : this.props.formatted.map(nullImterim)).map(makeJsonLink);
      }

      return (
        <div className="jsonview">
          <div className="options">
            Show: &nbsp;
            <RadioGroup tabStyle={true} name="input-name" selectedValue={this.state.showRaw
              ? RAW
              : FORMATTED} onChange={this.handleShowChange}>
              <Radio value={RAW}>WebSocket traffic</Radio>
              <Radio value={FORMATTED}>Formatted results from the SDK</Radio>
            </RadioGroup>
            <input role="checkbox" className="base--checkbox" type="checkbox" checked={!this.state.interim} onChange={this.handleInterimChange} id="interim"/>
            <label className="base--inline-label" htmlFor="interim">
              Hide interim results
            </label>
          </div>
          <hr className="base--hr"/>
          <div className="results">
            {output}
          </div>
        </div>
      );
    } catch (ex) {
      console.log(ex);
      return <div>{ex.message}</div>;
    }
  }
});
