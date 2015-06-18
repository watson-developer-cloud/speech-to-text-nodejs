
exports.initSelectModel = function(ctx) {

  function isDefault(model) {
    return model === 'en-US_BroadbandModel';
  }

  ctx.models.forEach(function(model) {
    $("select#dropdownMenu1").append( $("<option>")
      .val(model.name)
      .html(model.description)
      .prop('selected', isDefault(model.name))
      );
  });

  $("select#dropdownMenu1").change(function(evt) {
    var modelName = $("select#dropdownMenu1").val();
    localStorage.setItem('currentModel', modelName);
  });

}
