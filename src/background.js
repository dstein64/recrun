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
        chrome.tabs.sendMessage(tabs[0].id, {method: 'recrun'});
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

var mInjected = false;
var manualInject = function(force) {
    force = (typeof force) === 'undefined' ? false : force;
    if (!force && (onStartup || mInjected))
        return false;
    mInjected = true;
    
    var contentScripts = [];
    var manifest = chrome.runtime.getManifest();
    
    for (var h = 0; h < manifest.content_scripts.length; h++) {
        var _content_scripts = manifest.content_scripts[h];
        var all_frames = false;
        if ('all_frames' in _content_scripts) {
            all_frames = _content_scripts['all_frames'];
        }
        var run_at = 'document_idle';
        if ('run_at' in _content_scripts) {
            run_at = _content_scripts['run_at'];
        }
        
        if (_content_scripts && ('css' in _content_scripts)) {
            for (var i = 0; i < _content_scripts.css.length; i++) {
                var css = _content_scripts.css[i];
                var cs = new ContentScript(css, false, all_frames, run_at);
                contentScripts.push(cs);
            }
        }
        
        if (_content_scripts && ('js' in _content_scripts)) {
            for (var i = 0; i < _content_scripts.js.length; i++) {
                var js = _content_scripts.js[i];
                var cs = new ContentScript(js, true, all_frames, run_at);
                contentScripts.push(cs);
            }
        }
    }
    chrome.tabs.query({}, function(tabs) {
        for (var i = 0; i < tabs.length; i++) {
            var tab = tabs[i];
            var tabId = tab.id;
            if (ping.has(tabId)) {
                continue;
            }
            var url = tab.url;
            if (/^(?:http|https):\/\//.test(url)) {
                (function(id) {
                    var inject = function(remaining) {
                        if (remaining.length <= 0)
                            return;
                        
                        var first = remaining[0];
                        
                        if (!first.js) {
                            var options = {file: first.script, allFrames: first.allFrames};
                            chrome.tabs.insertCSS(id, options, function() {
                                if (chrome.runtime.lastError) {}
                                inject(remaining.slice(1));
                            });
                        } else {
                            var options = {file: first.script, allFrames: first.allFrames, runAt: first.runAt};
                            chrome.tabs.executeScript(id, options, function() {
                                    if (chrome.runtime.lastError) {}
                                    inject(remaining.slice(1));
                                });
                        }
                    };
                    inject(contentScripts);
                    
                })(tabId);
            }
        }
    });
    return true;
};

chrome.runtime.onInstalled.addListener(function(details){
    var reason = details.reason;
    var extensionLoaded = (reason === "install" || reason === "update");
    if (extensionLoaded) {
        manualInject();
    }
});

setTimeout(function() {
    manualInject();
}, 2000);


