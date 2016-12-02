/**
 * Copyright 2014 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* global $ */
'use strict';

var initPlaySample = require('./playsample').initPlaySample;

exports.initSelectModel = function(ctx) {

  function getModel(ctx, name) {
    for (var i = 0; i < ctx.models.length; i++) {
      var model = ctx.models[i];
      if (model.name == name) {
        return model;
      }
    }
    return null;
  }

  function isDiarizationSupported(model) {
    var supported_features = model.supported_features;
    return supported_features.speaker_labels;
  }

  ctx.models.forEach(function(model) {
    $('#dropdownMenuList').append(
      $('<li>')
        .attr('role', 'presentation')
        .append(
          $('<a>').attr('role', 'menu-item')
            .attr('href', '/')
            .attr('data-model', model.name)
            .append(model.description.substring(0, model.description.length - 1), model.rate == 8000 ? ' (8KHz)' : ' (16KHz)')
        )
    );
  });

  var model = getModel(ctx, ctx.currentModel);
  $('#diarization').toggle(isDiarizationSupported(model));
  $('#diarization > input[type="checkbox"]').prop('checked', false);
  $('li.speakersTab').hide();

  $('#dropdownMenuList').click(function(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    console.log('Change view', $(evt.target).text());
    var description = $(evt.target).text();
    var name = $(evt.target).data('model');

    var model = getModel(ctx, name);
    $('#diarization').toggle(isDiarizationSupported(model));
    $('#diarization > input[type="checkbox"]').prop('checked', false);
    $('li.speakersTab').hide();

    $('#dropdownMenuDefault').empty().text(description);
    $('#dropdownMenu1').dropdown('toggle');
    localStorage.setItem('currentModel', name);
    ctx.currentModel = name;
    initPlaySample(ctx);
    $('#tb_keywords').focus();
    $('#tb_keywords').val('');
    $('#tb_keywords').change();
    $.publish('clearscreen');
  });
};
