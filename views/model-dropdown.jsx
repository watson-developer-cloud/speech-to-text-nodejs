import React from 'react';
import PropTypes from 'prop-types';
import SpeechToText from 'watson-speech/speech-to-text';

// The list of models changes rarely, so we're caching it in a JSON file for faster initial
// load time. Once we have a token, this component will automatically fetch the current list
// of models and update the UI if necessary.
import cachedModels from '../src/data/models.json';

export default React.createClass({
  propTypes: {
    model: PropTypes.string.isRequired,
    token: PropTypes.string,
    onChange: PropTypes.func,
  },

  getInitialState() {
    // initialize with a (possibly outdated) cached JSON models file,
    // then update it once we have a token
    return { models: cachedModels };
  },

  componentDidMount() {
    if (this.props.token) {
      this.fetchModels(this.props.token);
    }
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.token !== this.props.token) {
      this.fetchModels(nextProps.token);
    }
  },

  fetchModels(token) {
    SpeechToText.getModels({ token }).then(models => this.setState({ models }))
      .catch(err => console.log('error loading models', err));
  },

  handleChange(e) {
    const model = e.target.value;
    if (model !== this.props.model && this.props.onChange) {
      this.props.onChange(e.target.value);
    }
  },

  render() {
    const models = this.state.models.sort((a, b) => a.description > b.description);
    const options = models.map(m => (<option value={m.name} key={m.name}>{m.description.replace(/\.$/, '')}
      {' '}
      ({m.rate / 1000}KHz)</option>));

    return (
      <select
        name="model"
        value={this.props.model}
        onChange={this.handleChange}
        className="base--select"
      >
        {options}
      </select>
    );
  },
});
