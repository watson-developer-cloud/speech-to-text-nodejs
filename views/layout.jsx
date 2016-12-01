import React from 'react';
import { Header, Jumbotron, Footer } from 'watson-react-components';

export default function(props) {
    return (
        <html>
            <head>
                <title>Speech to Text Demo</title>
                <meta charset="utf-8"/>
                <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/images/favicon.ico" type="image/x-icon" />
                <link rel="stylesheet" href="/css/watson-react-components.min.css"/>
                <link rel="stylesheet" href="/css/style.css"/>
                <script type="text/javascript" src="scripts/bundle.js" defer async></script>
            </head>
            <body>
                <Header mainBreadcrumbs="Speech to Text" mainBreadcrumbsUrl="http://www.ibm.com/watson/developercloud/speech-to-text.html" />
                <Jumbotron
                    serviceName="Speech to Text"
                    repository="https://github.com/watson-developer-cloud/speech-to-text-nodejs"
                    documentation="http://www.ibm.com/smarterplanet/us/en/ibmwatson/developercloud/doc/speech-to-text/"
                    apiReference="http://www.ibm.com/smarterplanet/us/en/ibmwatson/developercloud/speech-to-text/api"
                    version="GA"
                    serviceIcon="/images/stt.svg"
                    description="The IBM Watson Speech to Text service uses speech recognition capabilities to convert Arabic, English, Spanish, French, Brazilian Portuguese, Japanese, and Mandarin speech into text."
                />
                <div id="root">
                {props.children}
                </div>
                <Footer/>
            <script type="text/javascript" src="scripts/vendor/google-analytics.js" defer async></script>
            </body>
    </html>
    );
}
