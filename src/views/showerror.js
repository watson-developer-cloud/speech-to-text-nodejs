
'use strict';

exports.showError = function(msg) {
  console.log('Error: ', msg);
  var errorAlert = $('.error-row');
  errorAlert.hide();
  errorAlert.css('background-color', '#d74108');
  errorAlert.css('color', 'white');
  var errorMessage = $('#errorMessage');
  errorMessage.text(msg);
  errorAlert.show();
  $('#errorClose').click(function(e) {
    e.preventDefault();
    errorAlert.hide();
    return false;
  });
}

exports.showNotice = function(msg) {
  console.log('Notice: ', msg);
  var noticeAlert = $('.notification-row');
  noticeAlert.hide();
  noticeAlert.css('border', '2px solid #ececec');
  noticeAlert.css('background-color', '#f4f4f4');
  noticeAlert.css('color', 'black');
  var noticeMessage = $('#notificationMessage');
  noticeMessage.text(msg);
  noticeAlert.show();
  $('#notificationClose').click(function(e) {
    e.preventDefault();
    noticeAlert.hide();
    return false;
  });
}

exports.hideError = function() {
  var errorAlert = $('.error-row');
  errorAlert.hide();
}