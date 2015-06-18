
var initSessionPermissions = require('./sessionpermissions').initSessionPermissions;


exports.initViews = function() {
  console.log('Initializing views...');
  initSessionPermissions();
}
