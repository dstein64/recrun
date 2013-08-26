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

var showOverlay = function() {
    $('#recrun').bPopup({
        zIndex: 2147483647,
        position: ['auto', '0px'],
        positionStyle: 'fixed'
    });
};

var getOverlay = function() {
    var overlay = document.getElementById('recrun');
    return overlay;
};

var anchorTag = function(href, text, newWindow) {
    newWindow = (typeof newWindow === "undefined") ? false : newWindow;
    return '<a href="' + href + '"' + (newWindow ? ' target="_blank"' : '') + '>' + text + '</a>';
};

// gets the overlay or creates it if it doesn't exist
var createOverlay = function() {
    var body = document.getElementsByTagName('body')[0];
    var head = document.getElementsByTagName('head')[0];
    
    head.appendChild(styleSheet(chrome.extension.getURL('cssreset-context.css')));
    head.appendChild(styleSheet(chrome.extension.getURL('style.css')));
    
    var recrun = document.createElement('div');
    recrun.setAttribute('id', 'recrun');
    
    var style = recrun.style;
    style.display = 'none';
    style.padding = '6px';
    // without the following, overlay would press against top
    // (it wasn't properly vertically aligned for some reason)
    style.marginTop = '1%';
    style.marginBottom = '1%';
    style.width = '800px';
    style.height = '95%';
    style.borderRadius = '3px';
    style.backgroundColor = '#f3f2ee';
    style.border = '1px solid #ccc';
    
    var loader = chrome.extension.getURL('loader.gif');
    recrun.innerHTML = '<span id="recrun-close" class="b-close">X</span>'
        +              '<div style="overflow: auto; height: 100%;">'
        +                '<div class="yui3-cssreset" id="recrun-container">'
        +                  '<img id="recrun-loader" src="' + loader + '"></img>'
        +                  '<div id="recrun-apiresponse">'
        +                    '<div id="recrun-title"></div>'
        +                    '<div id="recrun-author"></div>'
        +                    '<div id="recrun-date"></div>'
        +                    '<div id="recrun-html"></div>'
        +                  '</div><!-- #recrun-apiresponse -->'
        +                  '<div id="recrun-errors">'
        +                    '<div id="recrun-tokenerror">'
        +                      'There is an error with your Diffbot token.'
        +                      '<br><br>'
        +                      'Visit ' + anchorTag('http://www.diffbot.com', 'diffbot.com', true) + ' to sign up for a free token.'
        +                      '<br><br>'
        +                      'Enter your Diffbot token on the recrun ' + anchorTag(chrome.extension.getURL('options.html'), 'Options page', true) + '.'
        +                    '</div><!-- #recrun-tokenerror -->'
        +                    '<div id="recrun-unknownerror">'
        +                      'There was an error.'
        +                    '</div><!-- #recrun-unknownerror -->'
        +                  '</div><!-- #recrun-errors -->'
        +                '</div><!-- #recrun-container -->'
        +              '</div>';
    
    body.appendChild(recrun);
    return recrun;
};

var hideErrors = function() {
    $('#recrun-tokenerror').hide();
    $('#recrun-unknownerror').hide();
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
            if (xhr.status == 200) {
                var resp = JSON.parse(xhr.responseText);
                var fields = ['title', 'author', 'date'];
                for (var i = 0; i < fields.length; i++) {
                    var field = fields[i];
                    var e = document.getElementById('recrun-' + field);
                    if (resp[field])
                        e.innerHTML = resp[field];
                }
                
                var text = '<p>' + resp['text'].replace(/\n/g, '</p><p>') + '</p>';
                document.getElementById('recrun-html').innerHTML = text;
                
                successFlag = true;
                $('#recrun-loader').hide();
                $('#recrun-apiresponse').show();
            } else if (xhr.status == 401) { 
                $('#recrun-loader').hide();
                $('#recrun-tokenerror').show();
            } else {
                $('#recrun-loader').hide();
                $('#recrun-unknownerror').show();
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

chrome.runtime.sendMessage({method: "getToken"}, function(response) {
    token = response.token;
});

