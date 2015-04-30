chrome.runtime.sendMessage({'message': "ping"});

chrome.runtime.sendMessage({method: "getToken"}, function(response) {
    token = response.token;
});

var getApiUrl = function(token, url) {
    return 'https://www.diffbot.com/api/article?html&token=' + token + '&url=' + encodeURIComponent(url);
};

var styleSheet = function(file) {
    var link = document.createElement('link');
    link.setAttribute('href', file);
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('type', 'text/css');
    return link;
};

var recrunId = '_recrun';

var showOverlay = function() {
    $('#' + recrunId).bPopup({
        zIndex: 2147483647,
        position: ['auto', '0px'],
        positionStyle: 'fixed'
    });
};

var getOverlay = function() {
    var overlay = document.getElementById('recrun');
    return overlay;
};

var setPropertyImp = function(element, key, val) {
    // have to use setProperty for setting !important. This doesn't work: span.style.backgroundColor = 'yellow !important';
    element.style.setProperty(key, val, 'important');
};

// gets the overlay or creates it if it doesn't exist
var createOverlay = function() {
    var body = document.body;
    
    var iframe = document.createElement('iframe');
    iframe.src = chrome.extension.getURL('src/iframe.html');
    iframe.setAttribute('id', recrunId);
    
    iframe.style.display = 'none'; // don't make this !important, or it won't change
    
    setPropertyImp(iframe, 'padding', '6px');
    setPropertyImp(iframe, 'margin-top', '1%');
    setPropertyImp(iframe, 'margin-bottom', '1%');
    setPropertyImp(iframe, 'width', '800px');
    setPropertyImp(iframe, 'height', '95%');
    setPropertyImp(iframe, 'border-radius', '3px');
    setPropertyImp(iframe, 'background-color', '#f3f2ee');
    setPropertyImp(iframe, 'border', '1px solid #ccc');
    
    body.appendChild(iframe);
    return iframe;
};

var hideErrors = function() {
    $('#recrun-error').hide();
};

var getRecrunElementById = function(id) {
    var iframe = document.getElementById(recrunId);
    return iframe.contentWindow.document.getElementById(id);
};

var callApi = function(token) {  
    if (!getOverlay())
        createOverlay();
    
    showOverlay();
    $('#recrun-loader').show();
    hideErrors();
    
    if (!token) {
        // token required ignore for now since this will be handled by the 401 error
        //console.log('no token');
        //return;
    }
    
    var url = document.location.href;
    var xhr = new XMLHttpRequest();
    var apiUrl = getApiUrl(token, url);
    xhr.open("GET", apiUrl, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            var errorFn = function() {
                $('#recrun-loader').hide();
                $('#recrun-error').show();
            };
            var status = xhr.status;
            if (status === 200) {
                var resp = JSON.parse(xhr.responseText);
                if ('error' in resp) {
                    errorFn();
                } else {
                    var fields = ['title', 'author', 'date'];
                    for (var i = 0; i < fields.length; i++) {
                        var field = fields[i];
                        var e = getRecrunElementById('recrun-' + field);
                        if (resp[field])
                            e.innerHTML = resp[field];
                    }
                    
                    var text = '<p>' + resp['text'].replace(/\n/g, '</p><p>') + '</p>';
                    getRecrunElementById('recrun-html').innerHTML = text;
                    
                    successFlag = true;
                    $('#recrun-loader').hide();
                    $('#recrun-apiresponse').show();
                }
            } else if (status === 401) { 
                errorFn();
            } else {
                errorFn();
            }
        }
    };
    xhr.send();
};

var token = ''; // have to update token when this script is run and when user updates token.
                // there is no synchronous way that you're aware of to get the token from 
                // local storage right before making an API call.

var successFlag = false; // keeps track of whether the last request was successful or not

chrome.runtime.onMessage.addListener(
    function(request) {
        if (request.method == "recrun") {
            if (successFlag)
                showOverlay();
            else {
                callApi(token);
            }
        } else if (request.method == "updateToken") {
            token = request.token;
        }
});

