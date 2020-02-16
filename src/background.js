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
    options['diffbotHtml'] = true;
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
    var recrun = function() {
        chrome.tabs.query({'active': true, 'currentWindow': true}, function(tabs) {
            chrome.tabs.sendMessage(
                tabs[0].id,
                {method: 'recrun', data: {url: tabs[0].url}},
                {},
                function(resp) {
                    if (chrome.runtime.lastError) {
                        var errmsg = "recrun couldn't start on this page.\n\n"
                            + "Reload the page and try again.\n\n"
                            + "(this occurs on tabs that were open while recrun "
                            + "was installed, updated, or re-enabled)";
                        alert(errmsg);
                    }
                });
        });
    };
    // Running recrun multiple times causes the following scripts to be executed
    // multiple times in the context of the same page. This is not a problem for
    // jquery.js nor readabilitySAX.js. Special handling in content.js prevents
    // the relevant code from executing more than once, which would be problematic.
    // This is an alternative to using broad host permissions for content scripts,
    // which the Chrome Web Store warns developers about. A downside to this approach
    // is that jquery.js and readabilitySAX.js may be injected multiple times, even
    // in some cases just to close the recrun window (e.g., when clicking the recrun
    // icon when a recrun window is already open).
    var scripts = [
        'src/lib/jquery.js',
        'src/lib/readabilitySAX/readabilitySAX.js',
        'src/content.js'
    ];
    let fn = recrun;
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
