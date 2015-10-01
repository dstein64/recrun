var getOptions = function() {
    var opts = localStorage["options"];
    if (opts) {
        opts = JSON.parse(opts);
    }
    return opts;
};

var defaultOptions = function() {
    var options = Object.create(null);
    options['token'] = '';
    options['media'] = true;
    options['comments'] = false;
    options['diffbotHtml'] = true;
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
        if (!(key in opts))
            opts[key] = defaults[key];
    }
    
    localStorage["options"] = JSON.stringify(opts);
})();

chrome.browserAction.onClicked.addListener(function() {
    chrome.tabs.query({'active': true, 'currentWindow': true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {method: 'recrun', data: {url: tabs[0].url}}, {}, function(resp) {
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
    if (method === "getOptions") {
        sendResponse(getOptions());
    } else {
        sendResponse({});
    }
});


