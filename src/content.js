chrome.runtime.sendMessage({'message': "ping"});

chrome.runtime.sendMessage({method: "getToken"}, function(response) {
    token = response.token;
});

var getApiUrl = function(token, url) {
    return 'https://api.diffbot.com/v3/article?html&token=' + token + '&url=' + encodeURIComponent(url);
};

var recrunId = '_recrun';

var getOverlay = function() {
    return document.getElementById(recrunId);
};

var getRecrunDoc = function() {
    var iframe = document.getElementById(recrunId);
    return iframe.contentWindow.document;
};

var getRecrunElementById = function(id) {
    return getRecrunDoc().getElementById(id);
};

var recrunShow = function(id) {
    $(getRecrunElementById(id)).show();
};

var recrunHide = function(id) {
    $(getRecrunElementById(id)).hide();
};

var overlay = null;
var bPopup = function(callback) {
    overlay = $('#' + recrunId).bPopup({
        zIndex: 2147483647,
        position: ['auto', '0px'],
        positionStyle: 'fixed'
    }, function() {
        var intervalId = setInterval(function() {
            if (getRecrunDoc().readyState === 'complete') {
                clearInterval(intervalId);
                callback();
            }
        }, 100);
    });
};
function receiveMessage(event) {
    if (event.data === 'close'
          && event.origin === (new URL(chrome.extension.getURL(''))).origin
          && overlay) {
        overlay.close();
    }
}
window.addEventListener("message", receiveMessage, false);

var setPropertyImp = function(element, key, val) {
    // have to use setProperty for setting !important. This doesn't work: span.style.backgroundColor = 'yellow !important';
    element.style.setProperty(key, val, 'important');
};

// gets the overlay or creates it if it doesn't exist
var createOverlay = function() {
    var body = document.body;
    
    var iframe = document.createElement('iframe');
    var src = 'src/iframe.html';
    var hash = '#' + encodeURIComponent(location.href);
    iframe.src = chrome.extension.getURL(src + hash);
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

// have to store response here. recalling bpopup relaods the iframe,
// losing its content.
var resp = null;

var token = ''; // have to update token when this script is run and when user updates token.
                // there is no synchronous way that you're aware of to get the token from 
                // local storage right before making an API call.

var overlayOpen = function() {
    return overlay && (document.getElementsByClassName('b-modal').length > 0);
};

var recrun = function() {
    if (overlayOpen()) {
        overlay.close();
        return;
    }
    
    if (!getOverlay())
        createOverlay();
    
    var show = function() {
        recrunHide('recrun-loader');
        if (resp) {
            var doc = getRecrunDoc(); // recrun document
            var article = resp[0];
            var fields = ['title', 'author', 'date'];
            for (var i = 0; i < fields.length; i++) {
                var field = fields[i];
                var e = getRecrunElementById('recrun-' + field);
                if (field in article && e && doc) {
                    e.appendChild(doc.createTextNode(article[field]));
                }
            }
            
            var e = getRecrunElementById('recrun-html');
            
            if ('images' in article && e) {
                var images = article['images'];
                for (var i = 0; i < images.length; i++) {
                    var image = images[i];
                    if ('primary' in image
                            && image['primary'] === true
                            && 'url' in image
                            && (image['url'].startsWith('http://')
                                    || image['url'].startsWith('https://'))
                            && doc) {
                        var img = doc.createElement('img');
                        img.src = image['url'];
                        e.appendChild(img);
                        break;
                    }
                }
            }
            
            if ('text' in article && e && doc) {
                var text = article['text'];
                var paragraphs = text.split(/\n/g);
                for (var i = 0; i < paragraphs.length; i++) {
                    var p = doc.createElement('p');
                    p.appendChild(doc.createTextNode(paragraphs[i]));
                    e.appendChild(p);
                }
            }
            
            recrunShow('recrun-apiresponse');
        } else {
            recrunShow('recrun-error');
        }
    };
    
    if (resp) {
        bPopup(show);
    } else {
        bPopup(function() {
            recrunHide('recrun-apiresponse');
            recrunHide('recrun-error');
            recrunShow('recrun-loader');
            // missing token will return an error from Diffbot
            
            var validToken = ((typeof token) === 'string') && token.length > 0;
            if (!validToken) {
                show(); // will show an error
            } else {
                var url = document.location.href;
                var xhr = new XMLHttpRequest();
                var apiUrl = getApiUrl(token, url);
                xhr.open("GET", apiUrl, true);
                xhr.onreadystatechange = function() {
                    if (xhr.readyState == 4) {
                        var status = xhr.status;
                        if (status === 200) {
                            var _resp = JSON.parse(xhr.responseText);
                            if (!('error' in _resp)
                                    && 'objects' in _resp
                                    && _resp['objects'].length > 0) {
                                var articles = [];
                                for (var i = 0; i < _resp['objects'].length; i++) {
                                    var object = _resp['objects'][i];
                                    if ('type' in object && object['type'] === 'article') {
                                        articles.push(object);
                                    }
                                }
                                if (articles.length > 0)
                                    resp = articles;
                            }
                        }
                        show();
                    }
                };
                xhr.send();
            }
        });
    }
};

chrome.runtime.onMessage.addListener(function(request) {
    if (request.method == "recrun") {
        recrun();
    } else if (request.method == "updateToken") {
        token = request.token;
    }
});


