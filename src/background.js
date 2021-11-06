const IS_FIREFOX = chrome.runtime.getURL('').startsWith('moz-extension://');

// if already using Diffbot, make sure new option, useDiffbot, set to true
// can eventually remove this
(function() {
    var opts = localStorage['options'];
    if (opts) {
        opts = JSON.parse(opts);
        if (!('useDiffbot' in opts)) {
            if (('token' in opts) && opts.token) {
                opts['useDiffbot'] = true;
            } else {
                opts['useDiffbot'] = false;
            }
            localStorage['options'] = JSON.stringify(opts);
        }
    }
})();

var getOptions = function() {
    var opts = localStorage['options'];
    if (opts) {
        opts = JSON.parse(opts);
    }
    return opts;
};

var getVersion = function() {
    return chrome.runtime.getManifest().version;
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

    localStorage['options'] = JSON.stringify(opts);
})();

var inject = function(callback=function() {}, scripts=[]) {
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
};

chrome.browserAction.onClicked.addListener(function(tab) {
    var showError = function() {
        var errorMessage = 'recrun couldn\'t run on this page.';
        // alert() doesn't work from Firefox background pages. A try/catch block is
        // not sufficient to prevent the "Browser Console" window that pops up with
        // the following message when using alert():
        // > "The Web Console logging API (console.log, console.info, console.warn,
        // > console.error) has been disabled by a script on this page."
        if (!IS_FIREFOX)
            alert(errorMessage);
    };
    var recrun = function() {
        chrome.tabs.sendMessage(
            tab.id,
            {method: 'recrun', data: {url: tab.url}},
            {},
            function(resp) {
                if (chrome.runtime.lastError || resp === 'undefined' || !resp.success) {
                    showError();
                }
            });
    };
    // First check if the current page is supported by trying to inject no-op code.
    // (e.g., https://chrome.google.com/webstore, https://addons.mozilla.org/en-US/firefox/,
    // chrome://extensions/, and other pages do not support extensions).
    chrome.tabs.executeScript(
        {code: '(function(){})();'},
        function() {
            if (chrome.runtime.lastError) {
                showError();
                return;
            }
            chrome.tabs.sendMessage(
                tab.id,
                {method: 'ping', data: {url: tab.url}},
                {},
                function(resp) {
                    let scripts = [];
                    // Always inject readabilitySAX, as it seems to get clobbered in some cases
                    // (e.g., when toggling Firefox's reader view).
                    scripts.push('src/lib/readabilitySAX/readabilitySAX.js');
                    // Inject content script if it hasn't been injected yet.
                    // On Firefox, in some cases just checking for lastError is not sufficient.
                    if (chrome.runtime.lastError || !resp || !resp.success) {
                        scripts.push('src/content.js');
                    }
                    inject(recrun, scripts);
                });
        });
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    var method = request.method;
    if (method === 'getOptions') {
        sendResponse(getOptions());
    } else if (method === 'disable') {
        chrome.browserAction.disable(sender.tab.id);
    } else {
        sendResponse({});
    }
});
