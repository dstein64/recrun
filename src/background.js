var ping = new Set();

var onStartup = false; // have we heard from onStartup?
chrome.runtime.onStartup.addListener(function() {
    onStartup = true;
});

var getOptions = function() {
    var opts = localStorage["options"];
    if (opts) {
        opts = JSON.parse(opts);
    }
    return opts;
};

// set defaults
(function() {
    var opts = getOptions();
    if (!opts) {
        opts = Object.create(null);
    }
    
    if (!('token' in opts))
        opts['token'] = '';
    
    if (!('media' in opts))
        opts['media'] = true;
    
    if (!('diffbotHtml' in opts))
        opts['diffbotHtml'] = true;
    
    localStorage["options"] = JSON.stringify(opts);
})();

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
    ping['delete'](tabId);
});

chrome.browserAction.onClicked.addListener(function() {
    chrome.tabs.query({'active': true, 'currentWindow': true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {method: 'recrun'}, {}, function(resp) {
            if (chrome.runtime.lastError) {
                var errmsg = "recrun couldn't start on this page.\n\n"
                    + "Reload the page and try again.\n\n"
                    + "(this occurs on tabs that were open while recrun was installed, updated, or re-enabled)"
                alert(errmsg);
            }
        });
    });
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    var method = request.method;
    var tabId = sender.tab.id;
    if (method === "getOptions") {
        sendResponse(getOptions());
    } else if (method === 'ping') {
        ping.add(tabId);
    } else {
        sendResponse({});
    }
});

var ContentScript = function(script, js, allFrames, runAt) {
    this.script = script;
    this.js = js;
    this.allFrames = allFrames;
    this.runAt = runAt;
};

