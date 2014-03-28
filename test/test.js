'use strict';

var should = require('should'),
    octotransformicator = require('../lib/octotransformicator.js'),
    settings = require('../settings.json');

describe('octotransformicator', function() {

    this.timeout(settings.timeoutMs);

    describe('extractConfigs', function() {
        it('should extract config files to local drive', function(done) {
            octotransformicator.init(settings);
            octotransformicator.buildTransforms(function(err) {
                console.log('\r\nyour transforms are finished, my liege\r\n');
            });
        });
    });

});