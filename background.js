chrome.browserAction.onClicked.addListener(function() {
    chrome.tabs.query({'active': true, 'currentWindow': true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {method: 'recrun'});
    });
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.method == "getToken") {
        sendResponse({token: localStorage['token']});
    } else
        sendResponse({});
});
