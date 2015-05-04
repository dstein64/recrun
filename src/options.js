var curTimer = null;
var statusMessage = function(message, time) {
    time = (typeof time === 'undefined') ? 1500 : time;
    var element = document.getElementById("status");
    if (curTimer)
        clearTimeout(curTimer);
    element.innerText = message;
    var timer = setTimeout(function() {
        element.innerText = "";
        curTimer = null;
    }, time);
    curTimer = timer;
};

var checkboxes = ['media', 'comments', 'diffbotHtml'];

var saveOptions = function() {
    var options = Object.create(null);
    
    var tokenInput = document.getElementById("token").value;
    options['token'] = tokenInput;
    
    for (var i = 0; i < checkboxes.length; i++) {
        var checkbox = checkboxes[i];
        options[checkbox] =  document.getElementById(checkbox + '-checkbox').checked;
    }
    
    localStorage["options"] = JSON.stringify(options);
    
    // also let all tabs know of the new token
    chrome.tabs.query({}, function(tabs) {
        for (var i = 0; i < tabs.length; i++) {
            var tab = tabs[i];
            chrome.tabs.sendMessage(tab.id, {method: 'updateOptions', data: options});
        }
    });

    // Update status to let user know options were saved.
    statusMessage("Options Saved", 1200);
};

var loadOptions = function(opts) {
    var token = opts['token'];
    var tokenInput = document.getElementById("token");
    tokenInput.value = token;
    
    for (var i = 0; i < checkboxes.length; i++) {
        var checkbox = checkboxes[i];
        document.getElementById(checkbox + '-checkbox').checked = opts[checkbox];
    }
};

// restore saved options
document.addEventListener('DOMContentLoaded', function() {
    var opts = JSON.parse(localStorage["options"]);
    loadOptions(opts);
});

// load default options
document.querySelector('#defaults').addEventListener('click', function() {
    var defaults = chrome.extension.getBackgroundPage().defaultOptions();
    loadOptions(defaults);
    statusMessage("Defaults Loaded", 1200);
});

document.querySelector('#save').addEventListener('click', saveOptions);

var ENTER = 13;
document.addEventListener("keydown", function(e) {
    if (e.which === ENTER) {
        saveOptions();
        return false;
    }
});

