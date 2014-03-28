/*
 * octotransformicator
 * racingcow.wordpress.com
 *
 * Copyright (c) 2014 David Miller
 * Licensed under the MIT license.
 */

'use strict';

var octopus = require('octopus-api'),
    xtend = require('xtend'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    rmdir = require('rimraf'),
    cp = require('cp'),
    AdmZip = require('adm-zip'),
    fstream = require('fstream'),
    async = require('async'),
    transformer = require('dotnet-config-transformer'),
    ops,
    pathOptions = {
        pkgsDir: 'c:\\octotransformicator\\packages',
        cfgDir: 'c:\\octotransformicator\\configs',
        cfgRegex: /.+\.config/,
        pkgExclude: /nothing/ // /AVPackageDelivery\.Installer.+\.nupkg|AirVault\.FP\.Image\.Cleaning\.Service.+\.nupkg|AirVault\.FP\.Recognition\.Forms\.Processing.+\.nupkg|AirVault\.FP\.Index\.Capture.+\.nupkg|AirVault\.RasterImage.+\.nupkg|AirVault\.SkeltaCustomProviders.+\.nupkg|AirVault\.SkeltaDocInjector.+\.nupkg|AirVault\.Forms\.Processing\.Wcf\.Service.+\.nupkg|AirVault\.SkeltaWCF.+\.nupkg|AirVault\.SkeltaWebClient.+\.nupkg|BarcodeHeaderSheetCreator.+\.nupkg|CT\.Airvault\.TransferPackageInjector.+\.nupkg/i
    };

exports._p = {

    pathsOperation: function(pathOperation, callback) {

        var paths = [];
        for (var path in ops.workingPaths) {
            paths.push(ops.workingPaths[path]);
        }

        async.each(paths, function(path, pathCallback) {
            pathOperation(path, pathCallback);
        }, callback);
    },

    ensureWorkingPaths: function(callback) {
        this.pathsOperation(mkdirp, callback);
    },

    cleanWorkingPath: function(callback) {
        this.pathsOperation(rmdir, callback);
    },

    copyPackages: function(pkgs, callback) {

        var fileIn,
            fileOut,
            pkgPath;

        pkgs.forEach(function(pkg) {
            this.getFeed(pkg.NuGetFeedId, function(err, feed) {

                if (err) {
                    console.log(err);
                    callback(err);
                    return;
                }

                pkgPath = pathOptions.pkgsDir; // + '/' + pkg.NuGetPackageId;

                //console.log(pkgPath);

                mkdirp(pkgPath, function(err) {

                    if (err) {
                        console.log(err);
                        callback(err);
                        return;
                    }

                    fileIn = feed.FeedUri + '\\' + pkg.NuGetPackageId + '.' + pkg.VersionSelectedLastRelease + '.nupkg';
                    fileOut = pkgPath + '\\' + pkg.NuGetPackageId + '.' + pkg.VersionSelectedLastRelease + '.nupkg';

                    //console.log('copying from "' + fileIn + '" to "' + fileOut + '"');
                    //this.copyFile(fileIn, fileOut, callback);
                    fs.createReadStream(fileIn).pipe(fs.createWriteStream(fileOut));

                }.bind(this));
            }.bind(this));
        }, this);
    },

    extractConfigs: function(callback) {

        fs.readdir(pathOptions.pkgsDir, function(err, fsObjs) {

            if (err) {
                console.log(err);
                callback(err);
                return;
            }

            mkdirp(pathOptions.cfgDir, function(err) {

                if (err) {
                    console.log(err);
                    callback(err);
                    return;
                }

                var name, zip, entries, destPath;
                fsObjs.forEach(function(fsObj) {
                    name = pathOptions.pkgsDir + '\\' + fsObj;
                    if (!fs.statSync(name).isDirectory() && !name.match(pathOptions.pkgExclude)) {

                        destPath = pathOptions.cfgDir + '\\' + fsObj;

                        //console.log('extracting ' + name + ' to ' + destPath);

                        zip = new AdmZip(name);
                        zip.extractAllTo(destPath, true);

                        //fs.createReadStream(name).pipe(unzip.Extract({path: destPath}));
                        //fs.createReadStream(name).pipe(unzip.Parse()).pipe(fstream.Writer(destPath));

                        // entries = zip.getEntries();
                        // entries.forEach(function(entry) {
                        //     if (entry.entryName.match(pathOptions.cfgRegex)) {
                        //         var destPath = pathOptions.cfgDir + '\\' + fsObj;
                        //         console.log('extracting entry ' + entry.entryName + ' to ' + destPath);
                        //         zip.extractEntryTo(entry.entryName, destPath);
                        //     }
                        // });
                    };
                });
            });
        });
    }

};

exports.init = function(settings) {
    ops = settings;
    octopus.init(settings.octopus);
    transformer.init(settings.transformer);
};

exports.buildTransforms = function(callback) {

    var _priv = this._p, 
        fileIn, fileOut, destPath,
        zip, entries, cfgEntries, matches,
        fileOpts = { encoding: 'utf8' },
        cfgRegex = new RegExp(ops.cfgPattern, 'i'),
        cbCalled = false,
        cbHandler = function(err) {
            if (!cbCalled) {
                cbCalled = true;
                callback(err);
            }
        };

    _priv.cleanWorkingPath(function(err) {
        console.log('(re)creating working folder');
        _priv.ensureWorkingPaths(function(err) {
            octopus.getEnvironments(function(err, environments) {
                console.log('getting packages/feeds...');
                octopus.getCurrentFeeds(function(err, feeds) {

                    console.log('done. retrieved ' + feeds.length + '\r\n');
                    async.each(feeds, function(feed, feedCallback) {

                        fileIn = feed.FeedUri + '\\' + feed.NuGetPackageId + '.' + feed.VersionSelectedLastRelease + '.nupkg';
                        fileOut = ops.workingPaths.packages + '\\' + feed.NuGetPackageId + '.' + feed.VersionSelectedLastRelease + '.nupkg';
                        console.log('copying "' + fileIn + '"\r\n\t ==> "' + fileOut + '"');
                        cp.sync(fileIn, fileOut);

                        destPath = ops.workingPaths.configs + '\\' + feed.NuGetPackageId + '\\';
                        console.log('extracting "' + fileOut + '"\r\n\t ==> "' + destPath + '"');

                        mkdirp.sync(ops.workingPaths.transforms + '\\' + feed.NuGetPackageId);

                        zip = new AdmZip(fileOut);
                        entries = zip.getEntries();
                        cfgEntries = [];
                        async.each(entries, 
                            function(entry, entryCallback) {
                                matches = entry.entryName.match(cfgRegex);
                                if (matches && matches.length) {
                                    console.log('\t\t' + entry.name);
                                    cfgEntries.push(entry);
                                    zip.extractEntryTo(entry, destPath, false, true);
                                }
                                entryCallback(null);
                            }, 
                            function(err) {
                                console.log('\tdone. extracted ' + cfgEntries.length + ' config files\r\n');
                                console.log('\ttransforming config files...')
                                async.each(cfgEntries, 
                                    function(cfgEntry, cfgEntryCallback) {

                                        async.each(environments, 
                                            function(environment, envCallback) {
                                                if (cfgEntry.name.toLowerCase().indexOf(environment.Name.toLowerCase()) !== -1) {

                                                    var cfgBase = cfgEntry.name.toLowerCase().replace('.' + environment.Name.toLowerCase(), '');
                                                    var cfgResult = cfgEntry.name.toLowerCase().replace('.config', '') + '.transformed.config';

                                                    console.log('\t transforming ' + cfgBase + '\r\n\t\t + ' + cfgEntry.name + ' \r\n\t\t ==> ' + cfgResult);

                                                    if (!fs.existsSync(destPath + cfgBase)) {
                                                        console.log(destPath + cfgBase + ' DOES NOT EXIST!');
                                                        envCallback(null);
                                                        return;
                                                    }

                                                    var configXml = fs.readFileSync(destPath + cfgBase, fileOpts);
                                                    var transformXml = fs.readFileSync(destPath + cfgEntry.name, fileOpts);

                                                    transformer.transform(configXml, transformXml, function(err, result) {

                                                        //console.log(result);

                                                        fs.writeFileSync(ops.workingPaths.transforms + '\\' + feed.NuGetPackageId + '\\' + cfgBase, configXml);
                                                        fs.writeFileSync(ops.workingPaths.transforms + '\\' + feed.NuGetPackageId + '\\' + cfgEntry.name, transformXml);
                                                        fs.writeFileSync(ops.workingPaths.transforms + '\\' + feed.NuGetPackageId + '\\' + cfgResult, result, fileOpts);

                                                        envCallback(err);
                                                    });
                                                }
                                            }, 
                                            cfgEntryCallback
                                        );
                                    }, 
                                    function(err) {
                                        console.log('\tdone.');
                                        feedCallback(null);
                                    }
                                );
                            }
                        );

                        //feedCallback(null);

                    }, cbHandler);
                });
            });
            
        });
    });
};