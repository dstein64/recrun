// This is called from options.js (see scope warning above).
const defaultOptions = function() {
    const options = Object.create(null);
    options['token'] = '';
    options['media'] = true;
    options['comments'] = false;
    options['diffbotHtml'] = false;
    options['useDiffbot'] = false;
    return options;
};

// Set missing options using defaults.
(function() {
    chrome.storage.local.get({options: {}}, function(result) {
        let opts = result.options;
        const defaults = defaultOptions();

        const keys = Object.keys(defaults);
        for (const key of keys) {
            if (!(key in opts)) {
                opts[key] = defaults[key];
            }
        }
        chrome.storage.local.set({options: opts});
    });
})();

chrome.action.onClicked.addListener(function(tab) {
    const recrun = function() {
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
    chrome.scripting.executeScript({
        target: {tabId: tab.id},
        func: () => {(function(){})();}
    }, (results) => {
        if (chrome.runtime.lastError) {
            // Earlier versions showed an error message here using alert():
            //   recrun couldn't run on this page.
            // This was avoided on Firefox, since it led to an error popup.
            // However, with manifest v3's service workers, showing a message with alert()
            // is not possible.
            return;
        }
        chrome.tabs.sendMessage(
            tab.id,
            {method: 'ping', data: {url: tab.url}},
            {},
            function(resp) {
                const scripts = [];
                // Always inject readabilitySAX, as it seems to get clobbered in some cases
                // (e.g., when toggling Firefox's reader view).
                scripts.push('src/lib/readabilitySAX/readabilitySAX.js');
                // Inject content script if it hasn't been injected yet.
                // On Firefox, in some cases just checking for lastError is not sufficient.
                if (chrome.runtime.lastError || !resp || !resp.success) {
                    scripts.push('src/content.js');
                }
                chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    files: scripts
                }, () => {
                    recrun();
                });
            });
    });
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    const method = request.method;
    if (method === 'getDefaultOptions') {
        sendResponse(defaultOptions());
    }
});
