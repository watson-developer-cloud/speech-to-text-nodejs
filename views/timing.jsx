import React from 'react';
import {ArrowBox, Colors} from 'watson-react-components';

const Word = function(props) {

  function click(e) {
    e.preventDefault();
    props.onClick();
  }
  return (
    <span className="word arrow-box-container" onClick={click} onMouseEnter={props.onMouseEnter} onMouseLeave={props.onMouseLeave}>
      <a className="base--a" href="#">{props.alternatives[0].word}</a>
      {props.alternatives.length > 1
        ? (
          <sup>{props.alternatives.length}</sup>
        )
        : null}
      <ArrowBox direction="top" show={props.showDetails} color={Colors.purple_50}>
        <div style={{
          color: 'white'
        }}>
          <p>{props.start_time}s - {props.end_time}s</p>
          <ul className="base--ul">
            {props.alternatives.map(w => (
              <li key={w.word} className="base--li">{w.word}: {Math.round(w.confidence * 1000) / 10}%</li>
            ))}
          </ul>
        </div>
      </ArrowBox>
    </span>
  );
};

Word.propTypes = {
  onMouseEnter: React.PropTypes.func.isRequired,
  onMouseLeave: React.PropTypes.func.isRequired,
  alternatives: React.PropTypes.array.isRequired,
  showDetails: React.PropTypes.bool.isRequired,
  start_time: React.PropTypes.string.isRequired,
  end_time: React.PropTypes.string.isRequired,
};

export const TimingView = React.createClass({
  propTypes: {
    messages: React.PropTypes.array.isRequired,
  },

  getInitialState() {
    return {clickSelected: null, mouseSelected: null};
  },
  getSelected() {
    return this.state.clickSelected || this.state.mouseSelected;
  },
  /**
     * Two UI interactions: hover and click
     *
     * If anything gets clicked, it overrides the hover interaction until it is hidden by a second click
     *
     * @param clickSelected
     */
  clickSelect(clickSelected) {
    // second click un-selects
    if (clickSelected === this.state.clickSelected) {
      clickSelected = null;
    }
    this.setState({clickSelected, mouseSelected: null});
  },
  mouseSelect(mouseSelected) {
    if (this.state.clickSelected) {
      return;
    }
    this.setState({mouseSelected});
  },
  render() {
    try {

      const results = this.props.messages.map(msg => {
        // todo: show additional result.alternatives
        return msg.results.map((result, i) => (
          <div key={msg.result_index + i}>
            {(result.word_alternatives || []).map(alt => <Word {...alt} key={alt.start_time} showDetails={alt.start_time === this.getSelected()} onClick={this.clickSelect.bind(this, alt.start_time)} onMouseEnter={this.mouseSelect.bind(this, alt.start_time)} onMouseLeave={this.mouseSelect.bind(this, null)}/>)}
          </div>
        ));
      }).reduce((a, b) => a.concat(b), []); // the reduce() call flattens the array
      return (
        <div className="word-timings-alternatives">
          {results}
        </div>
      );
    } catch (ex) {
      console.log(ex);
      return (
        <span>{ex.message}</span>
      );
    }
  }
});
