'use strict';

var octotransformicator = require('../lib/octotransformicator.js'),
    settings = require('../settings.json');

console.log('starting');

octotransformicator.init(settings);
octotransformicator.buildTransforms(function(err) {
    console.log('\r\nyour transforms are finished, my liege\r\n');
});