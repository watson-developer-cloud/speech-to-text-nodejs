<h1 align="center" style="border-bottom: none;">🎤 Speech to Text Demo </h1>
<h3 align="center">Node.js sample applications that shows some of the the IBM Watson Speech to Text service features.</h3>
<p align="center">
  <a href="http://travis-ci.org/watson-developer-cloud/speech-to-text-nodejs">
    <img alt="Travis" src="https://travis-ci.org/watson-developer-cloud/speech-to-text-nodejs.svg?branch=master">
  </a>
  <a href="#badge">
    <img alt="semantic-release" src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg">
  </a>
</p>
</p>

The [Speech to Text][service_url] service uses IBM's speech recognition capabilities to convert speech in multiple languages into text. The transcription of incoming audio is continuously sent back to the client with minimal delay, and it is corrected as more speech is heard. The service is accessed via a WebSocket interface; a REST HTTP interface is also available;

You can view a [demo][demo_url] of this app.

## Prerequisites

1. Sign up for an [IBM Cloud account](https://console.bluemix.net/registration/).
1. Download the [IBM Cloud CLI](https://console.bluemix.net/docs/cli/index.html#overview).
1. Create an instance of the Speech to Text service and get your credentials:
    - Go to the [Speech to Text](https://console.bluemix.net/catalog/services/speech-to-text) page in the IBM Cloud Catalog.
    - Log in to your IBM Cloud account.
    - Click **Create**.
    - Click **Show** to view the service credentials.
    - Copy the `apikey` value, or copy the `username` and `password` values if your service instance doesn't provide an `apikey`.
    - Copy the `url` value.

## Configuring the application

1. In the application folder, copy the *.env.example* file and create a file called *.env*

    ```
    cp .env.example .env
    ```

2. Open the *.env* file and add the service credentials that you obtained in the previous step.

    Example *.env* file that configures the `apikey` and `url` for a Speech to Text service instance hosted in the US East region:

    ```
    SPEECH_TO_TEXT_IAM_APIKEY=X4rbi8vwZmKpXfowaS3GAsA7vdy17Qh7km5D6EzKLHL2
    SPEECH_TO_TEXT_URL=https://stream-wdc.watsonplatform.net/speech-to-text/api
    ```

    - If your service instance uses `username` and `password` credentials, add the `SPEECH_TO_TEXT_USERNAME` and `SPEECH_TO_TEXT_PASSWORD` variables to the *.env* file.

    Example *.env* file that configures the `username`, `password`, and `url` for a Speech to Text service instance hosted in the Sydney region:

    ```
    SPEECH_TO_TEXT_USERNAME=522be-7b41-ab44-dec3-g1eab2ha73c6
    SPEECH_TO_TEXT_PASSWORD=A4Z5BdGENrwu8
    SPEECH_TO_TEXT_URL=https://gateway-syd.watsonplatform.net/speech-to-text/api
    ```

## Running locally

1. Install the dependencies

    ```
    npm install
    ```

1. Run the application

    ```
    npm start
    ```

1. View the application in a browser at `localhost:3000`

## Deploying to IBM Cloud as a Cloud Foundry Application

1. Login to IBM Cloud with the [IBM Cloud CLI](https://console.bluemix.net/docs/cli/index.html#overview)

    ```
    ibmcloud login
    ```

1. Target a Cloud Foundry organization and space.

    ```
    ibmcloud target --cf
    ```

1. Edit the *manifest.yml* file. Change the **name** field to something unique. For example, `- name: my-app-name`.
1. Deploy the application

    ```
    ibmcloud app push
    ```

1. View the application online at the app URL, for example: https://my-app-name.mybluemix.net


## License

  This sample code is licensed under Apache 2.0.

## Contributing

  See [CONTRIBUTING](./CONTRIBUTING.md).

## Open Source @ IBM
  Find more open source projects on the [IBM Github Page](http://ibm.github.io/)


[service_url]: https://www.ibm.com/watson/services/speech-to-text/
[docs]: https://www.ibm.com/watson/developercloud/speech-to-text/api/v1/curl.html?curl
[sign_up]: https://console.bluemix.net/registration/?target=/catalog/services/speech-to-text/
[demo_url]: https://speech-to-text-demo.ng.bluemix.net