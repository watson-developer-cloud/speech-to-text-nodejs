# Speech to Text Browser Application

[![Build Status](https://travis-ci.org/watson-developer-cloud/speech-to-text-nodejs.svg?branch=master)](https://travis-ci.org/watson-developer-cloud/speech-to-text-nodejs)

  The [Speech to Text][service_url] service uses IBM's speech recognition capabilities to convert speech in multiple languages into text. The transcription of incoming audio is continuously sent back to the client with minimal delay, and it is corrected as more speech is heard. The service is accessed via a WebSocket interface; a REST HTTP interface is also available;

Node.js is also used to provide the browser client's authentication token.

[![Deploy to Bluemix](https://bluemix.net/deploy/button.png)](https://bluemix.net/deploy?repository=https://github.com/watson-developer-cloud/speech-to-text-nodejs)

## Getting started

1. You need a Bluemix account. If you don't have one, [sign up][sign_up].

2. Download and install the [Cloud-foundry CLI][cloud_foundry] tool if you haven't already.

3. Edit the `manifest.yml` file and change `<application-name>` to something unique. The name you use determines the URL of your application. For example, `<application-name>.mybluemix.net`.

  ```yaml
  applications:
  - services:
    - my-service-instance
    name: <application-name>
    command: npm start
    path: .
    memory: 512M
  ```

4. Connect to Bluemix with the command line tool.

  ```sh
  cf api https://api.ng.bluemix.net
  cf login
  ```

5. Create and retrieve service keys to access the [Speech to Text][service_url] service:

  ```none
  cf create-service speech_to_text standard my-stt-service
  cf create-service-key my-stt-service myKey
  cf service-key my-stt-service myKey
  ```

6. Create a `.env` file in the root directory by copying the sample `.env.example` file using the following command:

  ```none
  cp .env.example .env
  ```
  You will update the `.env` with the information you retrieved in steps 5.

  The `.env` file will look something like the following:

  ```none
  SPEECH_TO_TEXT_USERNAME=<username>
  SPEECH_TO_TEXT_PASSWORD=<password>
  ```

7. Install the dependencies you application need:

  ```none
  npm install
  ```

8. Start the application locally:

  ```none
  npm start
  ```

9. Point your browser to [http://localhost:3000](http://localhost:3000).

10. **Optional:** Push the application to Bluemix:

  ```none
  cf push
  ```

After completing the steps above, you are ready to test your application. Start a browser and enter the URL of your application.

            <your application name>.mybluemix.net


For more details about developing applications that use Watson Developer Cloud services in Bluemix, see [Getting started with Watson Developer Cloud and Bluemix][getting_started].


## Troubleshooting

* The main source of troubleshooting and recovery information is the Bluemix log. To view the log, run the following command:

  ```sh
  cf logs <application-name> --recent
  ```

* For more details about the service, see the [documentation][docs] for the Speech to Text service.


----

### Directory structure

```none
.
├── app.js                      // express routes
├── config                      // express configuration
│   ├── express.js
│   └── security.js
├── manifest.yml
├── package.json
├── public                      // static resources
├── server.js                   // entry point
├── test                        // tests
└── views                       // react components
```

## License

  This sample code is licensed under Apache 2.0.

## Contributing

  See [CONTRIBUTING](CONTRIBUTING.md).

## Open Source @ IBM
  Find more open source projects on the [IBM Github Page](http://ibm.github.io/)

## Privacy Notice

Sample web applications that include this package may be configured to track deployments to [IBM Bluemix](https://www.bluemix.net/) and other Cloud Foundry platforms. The following information is sent to a [Deployment Tracker](https://github.com/IBM-Bluemix/cf-deployment-tracker-service) service on each deployment:

* Node.js package version
* Node.js repository URL
* Application Name (`application_name`)
* Space ID (`space_id`)
* Application Version (`application_version`)
* Application URIs (`application_uris`)
* Labels of bound services
* Number of instances for each bound service and associated plan information

This data is collected from the `package.json` file in the sample application and the `VCAP_APPLICATION` and `VCAP_SERVICES` environment variables in IBM Bluemix and other Cloud Foundry platforms. This data is used by IBM to track metrics around deployments of sample applications to IBM Bluemix to measure the usefulness of our examples, so that we can continuously improve the content we offer to you. Only deployments of sample applications that include code to ping the Deployment Tracker service will be tracked.

[deploy_track_url]: https://github.com/cloudant-labs/deployment-tracker
[cloud_foundry]: https://github.com/cloudfoundry/cli
[getting_started]: https://www.ibm.com/watson/developercloud/doc/common/index.html
[service_url]: https://www.ibm.com/watson/services/speech-to-text/
[docs]: http://www.ibm.com/watson/developercloud/speech-to-text/
[sign_up]: https://console.bluemix.net/registration/
