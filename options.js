function save_options() {
    var tokenInput = document.getElementById("token");
    localStorage["token"] = tokenInput.value;
    
    // also let all tabs know of the new token
    chrome.tabs.query({}, function(tabs) {
        for (var i = 0; i < tabs.length; i++) {
            var tab = tabs[i];
            chrome.tabs.sendMessage(tab.id, {method: 'updateToken', token: tokenInput.value});
        }
    });

    // Update status to let user know options were saved.
    var status = document.getElementById("status");
    status.innerHTML = "Token Saved";
    setTimeout(function() {
        status.innerHTML = "";
    }, 1000);
}

function restore_options() {
    var token = localStorage["token"];
    if (!token) {
        return;
    }
    var tokenInput = document.getElementById("token");
    tokenInput.value = token;
}
document.addEventListener('DOMContentLoaded', restore_options);
document.querySelector('#save').addEventListener('click', save_options);
