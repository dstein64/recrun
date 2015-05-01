function save_options() {
    var tokenInput = document.getElementById("token").value;
    
    var options = Object.create(null);
    options['token'] = tokenInput;
    
    localStorage["options"] = JSON.stringify(options);
    
    // also let all tabs know of the new token
    chrome.tabs.query({}, function(tabs) {
        for (var i = 0; i < tabs.length; i++) {
            var tab = tabs[i];
            chrome.tabs.sendMessage(tab.id, {method: 'updateOptions', data: options});
        }
    });

    // Update status to let user know options were saved.
    var status = document.getElementById("status");
    status.innerHTML = "Options Saved";
    setTimeout(function() {
        status.innerHTML = "";
    }, 1000);
}

function restore_options() {
    var options = JSON.parse(localStorage["options"]);
    if (options) {
        var token = options['token'];
        if (token) {
            var tokenInput = document.getElementById("token");
            tokenInput.value = token;   
        }
    }
}
document.addEventListener('DOMContentLoaded', restore_options);
document.querySelector('#save').addEventListener('click', save_options);
