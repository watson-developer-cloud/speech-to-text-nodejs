import React from 'react';
import PropTypes from 'prop-types';
import { Header, Jumbotron } from 'watson-react-components';

// eslint-disable-mnext-lin =
const DESCRIPTION = 'The IBM Watson Speech to Text service uses speech recognition capabilities to convert Arabic, English, Spanish, French, Brazilian Portuguese, Japanese, Korean, German, and Mandarin speech into text.';
const GDPR_INFO = 'This system is for demonstration purposes only and is not intended to process Personal Data. No Personal Data is to be entered into this system as it may not have the necessary controls in place to meet the requirements of the General Data Protection Regulation (EU) 2016/679';
const TERMS_OF_USE_URL = 'https://watson-developer-cloud.github.io/terms?name=Speech-to-Text%20Demo';

export default function Layout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>
          Speech to Text Demo
        </title>
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
          subBreadcrumbsUrl="https://speech-to-text-demo.ng.bluemix.net"
        />
        <Jumbotron
          serviceName="Speech to Text"
          repository="https://github.com/watson-developer-cloud/speech-to-text-nodejs"
          documentation="https://cloud.ibm.com/docs/services/speech-to-text?topic=speech-to-text-gettingStarted#gettingStarted"
          apiReference="https://cloud.ibm.com/apidocs/speech-to-text"
          version="GA"
          serviceIcon="/images/stt.svg"
          startInBluemix="https://cloud.ibm.com/registration?target=%2Fcatalog%2Fservices%2Fspeech-to-text%3FhideTours%3Dtrue%26cm_mmc%3D-_-Watson%2BCore_Watson%2BCore%2B-%2BPlatform-_-WW_WW-_-wdc-ref%26cm_mmc%3D-_-Watson%2BCore_Watson%2BCore%2B-%2BPlatform-_-WW_WW-_-wdc-ref%26cm_mmca1%3D000000OF%26cm_mmca2%3D10000409&_ga=2.158846578.918027017.1572271296-1405764752.1539884377&_gac=1.250083700.1571850605.Cj0KCQjw3JXtBRC8ARIsAEBHg4m4g1PSkKQRoI6YUe4A-6ysul0ziiWU0DVbqlbWAQpq3721u-bxkd0aAkV3EALw_wcB&cm_mc_uid=83381689395615475202389&cm_mc_sid_50200000=82214471572470185115&cm_mc_sid_52640000=21949701572470185117&cm_mmc=Earned-_-Watson%20Core%20-%20Platform-_-WW_WW-_-intercom&cm_mmca1=000000OF&cm_mmca2=10000409"
          description={DESCRIPTION}
        />

        <div className="_container _container_large gdpr-info">
          {GDPR_INFO}
        </div>
        <div className="_container _container_large gdpr-info">
          By using this application, you agree to the &nbsp;
          <a target="_blank" rel="noreferrer noopener" href={TERMS_OF_USE_URL}>
                Terms of Use
          </a>
        </div>
        <div id="root">
          {children}
        </div>
        <script type="text/javascript" src="scripts/bundle.js" />
        <script type="text/javascript" src="https://cdn.rawgit.com/watson-developer-cloud/watson-developer-cloud.github.io/master/analytics.js" />
      </body>
    </html>
  );
}

Layout.propTypes = {
  children: PropTypes.object.isRequired, // eslint-disable-line
};
