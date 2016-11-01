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
  
  var m = getModelDetails(ctx, ctx.currentModel);
  console.log(m);
//  if(m.name != 'en-US_NarrowbandModel') {
//    $('li.speakersTab').hide();
//  }

  $('#dropdownMenuList').click(function(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    console.log('Change view', $(evt.target).text());
    var newModelDescription = $(evt.target).text();
    var newModel = $(evt.target).data('model');

    resetTabs();
    var m = getModelDetails(ctx, newModel);
    if(m.name == 'en-US_NarrowbandModel') {
      $('li.speakersTab').show();
    }
    else {
      $('li.speakersTab').hide();
    }
    console.log(m);

    $('#dropdownMenuDefault').empty().text(newModelDescription);
    $('#dropdownMenu1').dropdown('toggle');
    localStorage.setItem('currentModel', newModel);
    ctx.currentModel = newModel;
    initPlaySample(ctx);
    $('#tb_keywords').focus();
    $('#tb_keywords').val('');
    $('#tb_keywords').change();
    $.publish('clearscreen');
  });
  
  function getModelDetails(ctx, name) {
    for(var i = 0; i < ctx.models.length; i++) {
      var model = ctx.models[i];
      if(model.name == name) {
        return model;
      }
    }
    return null;
  }
  
  function resetTabs() {
    $("#transcription_text > form > div > ul > li:eq(0)").addClass('active');
    $("#transcription_text > form > div > ul > li:eq(1)").removeClass('active');
    $("#transcription_text > form > div > ul > li:eq(2)").removeClass('active');
  }
};
