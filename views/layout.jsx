import React from 'react';
import PropTypes from 'prop-types';
import { Header, Jumbotron } from 'watson-react-components';

// eslint-disable-mnext-lin =
const DESCRIPTION = 'The IBM Watson Speech to Text service uses speech recognition capabilities to convert Arabic, English, Spanish, French, Brazilian Portuguese, Japanese, and Mandarin speech into text.';

export default function Layout(props) {
  return (
    <html lang="en">
      <head>
        <title>Speech to Text Demo</title>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/images/favicon.ico" type="image/x-icon" />
        <link rel="stylesheet" href="/css/watson-react-components.min.css" />
        <link rel="stylesheet" href="/css/style.css" />
      </head>
      <body>
        <Header
          mainBreadcrumbs="Speech to Text"
          mainBreadcrumbsUrl="https://www.ibm.com/watson/services/speech-to-text/"
          subBreadcrumbs="Speech to Text Demo"
          subBreadcrumbsUrl="https://speech-to-text-demo.mybluemix.net"

        />
        <Jumbotron
          serviceName="Speech to Text"
          repository="https://github.com/watson-developer-cloud/speech-to-text-nodejs"
          documentation="https://console.bluemix.net/docs/services/speech-to-text/getting-started.html"
          apiReference="http://www.ibm.com/watson/developercloud/speech-to-text/api"
          version="GA"
          serviceIcon="/images/stt.svg"
          startInBluemix="https://console.bluemix.net/registration?target=%2Fdeveloper%2Fwatson%2Fcreate-project%3Fservices%3Dspeech_to_text%26action%3Dcreate%26hideTours%3Dtrue%26cm_mmc%3DOSocial_Tumblr-_-Watson%2BCore_Watson%2BCore%2B-%2BPlatform-_-WW_WW-_-wdc-ref%26cm_mmc%3DOSocial_Tumblr-_-Watson%2BCore_Watson%2BCore%2B-%2BPlatform-_-WW_WW-_-wdc-ref%26cm_mmca1%3D000000OF%26cm_mmca2%3D10000409"
          description={DESCRIPTION}
        />
        <div id="root">
          {props.children}
        </div>
        <script type="text/javascript" src="scripts/bundle.js" />
        { props.bluemixAnalytics ? <script type="text/javascript" src="scripts/analytics.js" /> : null }
      </body>
    </html>
  );
}

Layout.propTypes = {
  children: PropTypes.object.isRequired, // eslint-disable-line
  bluemixAnalytics: PropTypes.bool.isRequired,
};
