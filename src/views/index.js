
var initSessionPermissions = require('./sessionpermissions').initSessionPermissions;
var initSelectModel = require('./selectmodel').initSelectModel;
var initAnimatePanel = require('./animatepanel').initAnimatePanel;
var initShowTab = require('./showtab').initShowTab;


exports.initViews = function(ctx) {
  console.log('Initializing views...');
  initSelectModel(ctx);
  initSessionPermissions();
  initShowTab();
  initAnimatePanel();
}
