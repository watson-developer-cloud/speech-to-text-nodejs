// load environment properties from a .env file for local development
require('dotenv').load({silent: true});


const app = require('./app.js');

// Deployment tracking
require('cf-deployment-tracker-client').track();

var port = process.env.PORT || process.env.VCAP_APP_PORT || 3000;
app.listen(port);
console.log('listening at:', port);
