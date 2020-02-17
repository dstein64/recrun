// if already using Diffbot, make sure new option, useDiffbot, set to true
// can eventually remove this
(function() {
    var opts = localStorage["options"];
    if (opts) {
        opts = JSON.parse(opts);
        if (!('useDiffbot' in opts)) {
            if (('token' in opts) && opts.token) {
                opts['useDiffbot'] = true;
            } else {
                opts['useDiffbot'] = false;
            }
            localStorage["options"] = JSON.stringify(opts);
        }
    }
})();

var getOptions = function() {
    var opts = localStorage["options"];
    if (opts) {
        opts = JSON.parse(opts);
    }
    return opts;
};

var getVersion = function() {
    var version = 0;
    // chrome.app.getDetails().version is undocumented, so have a fallback
    try {
        version = chrome.app.getDetails().version;
    } catch (e) {
        version = chrome.runtime.getManifest().version;
    }
    return version;
};

var defaultOptions = function() {
    var options = Object.create(null);
    options['token'] = '';
    options['media'] = true;
    options['comments'] = false;
    options['diffbotHtml'] = false;
    options['useDiffbot'] = false;
    return options;
};

// set missing options using defaults
(function() {
    var opts = getOptions();
    if (!opts) {
        opts = Object.create(null);
    }

    var defaults = defaultOptions();

    var keys = Object.keys(defaults);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (!(key in opts)) {
            opts[key] = defaults[key];
        }
    }

    localStorage["options"] = JSON.stringify(opts);
})();

chrome.browserAction.onClicked.addListener(function() {
    function inject(callback=function() {}) {
        var scripts = [
            'src/lib/jquery.js',
            'src/lib/readabilitySAX/readabilitySAX.js',
            'src/content.js'
        ];
        let fn = callback;
        for (var i = scripts.length - 1; i >= 0; --i) {
            let script = scripts[i];
            let fn_ = fn;
            fn = function() {
                chrome.tabs.executeScript({
                    file: script
                }, fn_);
            }
        }
        fn();
    }
    var recrun = function(tries=0) {
        chrome.tabs.query({'active': true, 'currentWindow': true}, function(tabs) {
            chrome.tabs.sendMessage(
                tabs[0].id,
                {method: 'recrun', data: {url: tabs[0].url}},
                {},
                function(resp) {
                    if (chrome.runtime.lastError) {
                        if (tries == 0) {
                            inject(function() {recrun(tries + 1)});
                        } else {
                            var errmsg = "recrun couldn't start on this page.";
                            alert(errmsg);
                        }
                    }
                });
        });
    };
    recrun();
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    var method = request.method;
    if (method === "getOptions") {
        sendResponse(getOptions());
    } else if (method === "disable") {
        chrome.browserAction.disable(sender.tab.id);
    } else {
        sendResponse({});
    }
});
