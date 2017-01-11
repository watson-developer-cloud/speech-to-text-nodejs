'use strict';

var app = require('./app.js');

// Deployment tracking
require('cf-deployment-tracker-client').track();

var port = process.env.PORT || 3000;
app.listen(port);
console.log('listening at:', port);
