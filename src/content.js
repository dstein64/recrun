chrome.runtime.sendMessage({method: "ping"});

var options = null; // have to update options when this script is run and when user updates options.
                    // there is no synchronous way that you're aware of to get the token from 
                    // local storage right before making an API call.

var updateOptions = function(opts) {
    options = opts;
};

chrome.runtime.sendMessage({method: "getOptions"}, function(response) {
    var opts = response;
    updateOptions(opts);
});

var getApiUrl = function(token, url) {
    return 'https://api.diffbot.com/v3/article?html&token=' + token + '&url=' + encodeURIComponent(url);
};

var recrunId = '_recrun_2108a6f5-6bb4-4069-83ba-9e22d60b3f64';

var getOverlay = function() {
    return document.getElementById(recrunId);
};

var getRecrunWindow = function() {
    return getOverlay().contentWindow;
};

var getRecrunDoc = function() {
    return getRecrunWindow().document;
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
    var options = {
        zIndex: 2147483647,
        position: ['auto', '0px'],
        positionStyle: 'fixed',
        scrollBar2: false
    };
    
    overlay = $('#' + recrunId).bPopup(options, function() {
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
//the following is for receiving a message from an iframe, not the extension background
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
    
    setPropertyImp(iframe, 'padding', '0px');
    setPropertyImp(iframe, 'margin', '0px');
    setPropertyImp(iframe, 'width', '800px');
    setPropertyImp(iframe, 'height', '95%');
    setPropertyImp(iframe, 'top', '2%'); // 2% margin on top, 3% on bottom
    setPropertyImp(iframe, 'border-radius', '3px');
    setPropertyImp(iframe, 'background-color', '#f3f2ee');
    setPropertyImp(iframe, 'border', '1px solid #ccc');
    
    body.appendChild(iframe);
    return iframe;
};

// have to store response here. recalling bpopup relaods the iframe,
// losing its content.
var resp = null;

var overlayOpen = function() {
    return overlay && (document.getElementsByClassName('b-modal').length > 0);
};

var sanitize = function(htmlString, rootNode) {
    var parser = new DOMParser();
    var htmldoc = parser.parseFromString(htmlString, "text/html");
    var doc = rootNode.ownerDocument;
    
    // from https://diffbot.com/dev/docs/article/html/
    // block elements
    var allowedTagsL = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'blockquote', 'code', 'pre',
                        'ul', 'ol', 'li', 'table', 'tbody', 'tr', 'td', 'dl', 'dt', 'dd'];
    // inline elements (following specs, although I usually treat <br> as block)
    allowedTagsL = allowedTagsL.concat(['br', 'b', 'strong', 'i', 'em', 'u', 'a']);
    // media
    if (options.media) {
        allowedTagsL = allowedTagsL.concat(['figure', 'img', 'video', 'audio', 'source', 'figcaption', 'iframe', 'embed', 'object']);
    }
    var allowedTags = new Set(allowedTagsL);
    var allowerAttrs = new Map();
    allowerAttrs.set('td', new Set(['valign', 'colspan']));
    allowerAttrs.set('a', new Set(['href']));
    allowerAttrs.set('img', new Set(['src', 'alt']));
    allowerAttrs.set('video', new Set(['src']));
    allowerAttrs.set('audio', new Set(['src']));
    allowerAttrs.set('iframe', new Set(['src', 'frameborder']));
    allowerAttrs.set('embed', new Set(['src', 'type']));
    allowerAttrs.set('object', new Set(['src', 'type']));
    
    // 'rec' as in 'recursive', not 'rec' as in 'recrun'
    var rec = function(diffbotNode, recrunNode) {
        var type = diffbotNode.nodeType;
        if (type === Node.TEXT_NODE) {
            var text = diffbotNode.textContent;
            recrunNode.appendChild(doc.createTextNode(text));
        } else if (type === Node.ELEMENT_NODE) {
            var tag = diffbotNode.tagName;
            var tagLower = tag.toLowerCase();
            if (allowedTags.has(tagLower)) {
                var newElement = doc.createElement(tag);
                
                var attrs = diffbotNode.attributes;
                for (var i = 0; i < attrs.length; i++) {
                    var attr = attrs[i];
                    var attrNameLower = attr.name.toLowerCase();
                    if (allowerAttrs.has(tagLower) && allowerAttrs.get(tagLower).has(attrNameLower)) {
                        newElement.setAttribute(attrNameLower, attr.value);
                    }
                }
                if (tagLower === 'a') {
                    newElement.setAttribute('target', '_blank');
                }
                
                recrunNode.appendChild(newElement);
                var _children = diffbotNode.childNodes;
                for (var i = 0; i < _children.length; i++) {
                    var _child = _children[i];
                    rec(_child, newElement);
                }
            }
        }
    };
    var children = htmldoc.body.childNodes;
    for (var i = 0; i < children.length; i++) {
        var child = children[i];
        rec(child, rootNode);
    }
};

var fillOverlay = function() {
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
    
    var contentFrag = doc.createDocumentFragment();
    
    // first add primary content
    if (options.diffbotHtml) {
        if ('html' in article) {
            // create recrun content from Diffbot's html field
            var htmlString = article['html'];
            
            // can inject with innerHtml, and then clean up
            // I prefer this approach
            // generally, this approach protects against malicious and/or malformed html
            
            sanitize(htmlString, contentFrag);
        }
        
    } else {
        // create recrun content from Diffbot's text field
        // starting with one primary
        if (options.media && 'images' in article) {
            var images = article['images'];
            for (var i = 0; i < images.length; i++) {
                var image = images[i];
                if ('primary' in image
                        && image['primary'] === true
                        && 'url' in image
                        && (image['url'].startsWith('http://')
                                || image['url'].startsWith('https://'))) {
                    var img = doc.createElement('img');
                    img.src = image['url'];
                    contentFrag.appendChild(img);
                    break;
                }
            }
        }
        
        if ('text' in article) {
            var text = article['text'];
            var paragraphs = text.split(/\n/g);
            for (var i = 0; i < paragraphs.length; i++) {
                var p = doc.createElement('p');
                p.appendChild(doc.createTextNode(paragraphs[i]));
                contentFrag.appendChild(p);
            }
        }
    }
    
    // next add discussion
    
    var e = getRecrunElementById('recrun-html');
    e.appendChild(contentFrag);
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
            fillOverlay();
            recrunShow('recrun-apiresponse');
        } else {
            recrunShow('recrun-error');
        }
    };
    
    var TIMEOUT = 40000;
    
    if (resp) {
        bPopup(show);
    } else {
        bPopup(function() {
            recrunHide('recrun-apiresponse');
            recrunHide('recrun-error');
            recrunShow('recrun-loader');
            // missing token will return an error from Diffbot
            
            var validToken = ((typeof options.token) === 'string') && options.token.length > 0;
            if (!validToken) {
                show(); // will show an error
            } else {
                var url = document.location.href;
                var xhr = new XMLHttpRequest();
                var apiUrl = getApiUrl(options.token, url);
                xhr.open("GET", apiUrl, true);
                xhr.timeout = TIMEOUT;
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
                xhr.ontimeout = function () {
                    show();
                };
                xhr.send();
            }
        });
    }
};

chrome.runtime.onMessage.addListener(function(request) {
    var method = request.method; 
    if (method === "recrun") {
        recrun();
    } else if (method === "updateOptions") {
        updateOptions(request.data);
        resp = null; // reset saved state, so the next call will re-fetch
    }
});

