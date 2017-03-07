import React from 'react';
import Layout from './layout.jsx'
import Demo from './demo.jsx'

export default function index(props) {
  return (<Layout bluemixAnalytics={props.BLUEMIX_ANALYTICS} ><Demo/></Layout>); // eslint-disable-line
}
