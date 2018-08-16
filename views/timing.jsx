/* eslint camelcase: off, jsx-a11y/click-events-have-key-events: off */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { ArrowBox, Colors } from 'watson-react-components';

const Word = (props) => {
  function click(e) {
    e.preventDefault();
    props.onClick();
  }
  const {
    alternatives, onMouseEnter, onMouseLeave, start_time, showDetails, end_time,
  } = props;
  return (
    <span
      role="button"
      tabIndex={0}
      className="word arrow-box-container"
      onClick={click}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <a className="base--a" href="#alternative">
        {alternatives[0].word}
      </a>
      {alternatives.length > 1 ? (
        <sup>{alternatives.length}</sup>
      ) : null}
      <ArrowBox
        direction="top"
        show={showDetails}
        color={Colors.purple_50}
      >
        <div
          style={{
            color: 'white',
          }}
        >
          <p>
            {start_time}s - {end_time}s
          </p>
          <ul className="base--ul">
            {alternatives.map(w => (
              <li key={w.word} className="base--li">
                {w.word}: {Math.round(w.confidence * 1000) / 10}%
              </li>
            ))}
          </ul>
        </div>
      </ArrowBox>
    </span>
  );
};


Word.propTypes = {
  onMouseEnter: PropTypes.func.isRequired,
  onMouseLeave: PropTypes.func.isRequired,
  alternatives: PropTypes.array.isRequired, // eslint-disable-line
  showDetails: PropTypes.bool.isRequired,
  start_time: PropTypes.number.isRequired,
  end_time: PropTypes.number.isRequired,
  onClick: PropTypes.func.isRequired,
};

export class TimingView extends Component {
  constructor() {
    super();
    this.state = { clickSelected: null, mouseSelected: null };
  }

  getSelected() {
    const { clickSelected, mouseSelected } = this.state;
    return clickSelected || mouseSelected;
  }

  /**
     * Two UI interactions: hover and click
     *
     * If anything gets clicked, it overrides the hover interaction until it is hidden
     * by a second click
     *
     * @param clickSelected
     */
  clickSelect(click) {
    let clickSelected = click;
    // second click un-selects
    if (clickSelected === this.state.clickSelected) {
      clickSelected = null;
    }
    this.setState({ clickSelected, mouseSelected: null });
  }

  mouseSelect(mouseSelected) {
    if (this.state.clickSelected) {
      return;
    }
    this.setState({ mouseSelected });
  }

  render() {
    try {
      const results = this.props.messages
        .map(msg => msg.results.map((result, i) => (
          <div key={msg.result_index + i}>
            {(result.word_alternatives || [])
              .map(alt => (
                <Word
                  {...alt}
                  key={alt.start_time}
                  showDetails={alt.start_time === this.getSelected()}
                  onClick={this.clickSelect.bind(this, alt.start_time)}
                  onMouseEnter={this.mouseSelect.bind(this, alt.start_time)}
                  onMouseLeave={this.mouseSelect.bind(this, null)}
                />
              ))}
          </div>
        )))
        .reduce((a, b) => a.concat(b), []); // the reduce() call flattens the array
      return <div className="word-timings-alternatives">{results}</div>;
    } catch (ex) {
      console.log(ex);
      return <span>{ex.message}</span>;
    }
  }
}


TimingView.propTypes = {
  messages: PropTypes.array.isRequired, // eslint-disable-line
};


export default TimingView;
