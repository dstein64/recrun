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

var useDiffbot = document.getElementById('useDiffbot-checkbox');

// enable Diffbot settings when "Use Diffbot" is selected
// disable Diffbot settings otherwise 
var diffbotToggle = function() {
    var diffbotSettings = document.getElementById('diffbot-settings');
    var tokenInput = document.getElementById('token');
    var diffbotHtmlCheckbox = document.getElementById('diffbotHtml-checkbox');
    if (useDiffbot.checked) {
        diffbotSettings.classList.remove("disabled");
        tokenInput.disabled = false;
        diffbotHtmlCheckbox.disabled = false;
    } else {
        diffbotSettings.classList.add("disabled");
        tokenInput.disabled = true;
        diffbotHtmlCheckbox.disabled = true;
    }
};

useDiffbot.addEventListener('change', diffbotToggle);

//var checkboxes = ['media', 'comments', 'diffbotHtml'];
var checkboxes = ['media', 'diffbotHtml', 'useDiffbot'];

var saveOptions = function() {
    var options = Object.create(null);
    
    var tokenInput = document.getElementById("token").value;
    options['token'] = tokenInput.trim(); // trim since Diffbot tokens don't have spaces on the edge
    
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
};

var loadOptions = function(opts) {
    var token = opts['token'];
    var tokenInput = document.getElementById("token");
    tokenInput.value = token;
    
    for (var i = 0; i < checkboxes.length; i++) {
        var checkbox = checkboxes[i];
        var e = document.getElementById(checkbox + '-checkbox');
        e.checked = opts[checkbox];
    }
    
    // onchange won't fire when setting 'checked' with javascript,
    // so trigger diffbotToggle manually
    diffbotToggle();
    
    // onchange/oninput won't fire when loading options with javascript,
    // so trigger saveOptions manually
    saveOptions();
};

var initOpts = JSON.parse(localStorage["options"]);

// restore saved options
document.addEventListener('DOMContentLoaded', function() {
    loadOptions(initOpts);
});

// load default options
document.querySelector('#defaults').addEventListener('click', function() {
    var defaults = chrome.extension.getBackgroundPage().defaultOptions();
    loadOptions(defaults);
    statusMessage("Defaults Loaded", 1200);
});

// save options on any user input
(function() {
    var inputs = document.getElementsByTagName('input');
    for (var i = 0; i < inputs.length; i++) {
        var input = inputs[i];
        // could handle each type separately to avoid multiple handlings
        // a text box will be handled by oninput on each character and onchange
        // when removing focus.
        // but this is fine for now.
        input.addEventListener('change', saveOptions);
        input.addEventListener('input', saveOptions);
    }
})();

document.querySelector('#revert').addEventListener('click', function() {
    loadOptions(initOpts);
    statusMessage("Options Reverted", 1200);
});


