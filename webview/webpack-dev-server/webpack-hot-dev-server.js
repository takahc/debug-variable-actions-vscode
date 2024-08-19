/* eslint-disable */
/*
    MIT License http://www.opensource.org/licenses/mit-license.php
    Author Tobias Koppers @sokra
*/
/* globals __webpack_hash__ */
if (module.hot) {

    // ADD
    // const api = require('vue-hot-reload-api')
    // const Vue = require('vue')
    // api.install(Vue)
    // if (!api.compatible) {
    //     throw new Error('vue-hot-reload-api is not compatible with the version of Vue you are using.')
    // }
    // module.hot.accept()
    // if (!module.hot.data) {
    //     // for each component option object to be hot-reloaded,
    //     // you need to create a record for it with a unique id.
    //     // do this once on startup.
    //     api.createRecord('very-unique-id', myComponentOptions)
    // } else {
    //     // if a component has only its template or render function changed,
    //     // you can force a re-render for all its active instances without
    //     // destroying/re-creating them. This keeps all current app state intact.
    //     api.rerender('very-unique-id', myComponentOptions)

    //     // --- OR ---

    //     // if a component has non-template/render options changed,
    //     // it needs to be fully reloaded. This will destroy and re-create all its
    //     // active instances (and their children).
    //     api.reload('very-unique-id', myComponentOptions)
    // }


    if (!window.__vscode__) {
        window.__vscode__ = acquireVsCodeApi();
        window.__reload__ = function () {
            console.log('post message to vscode to reload!');
            window.__vscode__.postMessage({
                command: 'reload',
                text: 'from web view',
            });

            // const api = require('vue-hot-reload-api')
            // const Vue = require('vue')
            // console.log('api.compatible', api.compatible)
            // if (!api.compatible) {
            //     throw new Error('vue-hot-reload-api is not compatible with the version of Vue you are using.')
            // }
            // module.hot.accept()
            // if (!module.hot.data) api.createRecord(name, result)
            // api.rerender(name, result)
        };
    }

    var lastHash;
    var upToDate = function upToDate() {
        return lastHash.indexOf(__webpack_hash__) >= 0;
    };
    var log = require('webpack/hot/log');
    var check = function check() {
        module.hot
            .check(true)
            .then(function (updatedModules) {
                if (!updatedModules) {
                    console.log('warning', '[HMR] Cannot find update. Need to do a full reload!');
                    console.log('warning', '[HMR] (Probably because of restarting the webpack-dev-server)');
                    window.__reload__();
                    return;
                }

                console.log('upToDate', upToDate());
                if (!upToDate()) {
                    check();
                }

                require('webpack/hot/log-apply-result')(updatedModules, updatedModules);

                if (upToDate()) {
                    log('info', '[HMR] App is up to date.');
                }
            })
            .catch(function (err) {
                var status = module.hot.status();
                if (['abort', 'fail'].indexOf(status) >= 0) {
                    console.log('warning', '[HMR] Cannot apply update. Need to do a full reload!');
                    console.log('warning', '[HMR] ' + log.formatError(err));
                    window.__reload__();
                } else {
                    log('warning', '[HMR] Update failed: ' + log.formatError(err));
                }
            });
    };
    var hotEmitter = require('webpack/hot/emitter');
    hotEmitter.on('webpackHotUpdate', function (currentHash) {
        lastHash = currentHash;
        if (!upToDate() && module.hot.status() === 'idle') {
            log('info', '[HMR] Checking for updates on the server...');
            check();
        }
    });
    log('info', '[HMR] Waiting for update signal from WDS...');
} else {
    throw new Error('[HMR] Hot Module Replacement is disabled.');
}
