

exports.initShowTab = function() {
  $('#nav-tabs a').on("click", function (e) {
    e.preventDefault()
    $(this).tab('show')
  });
}
