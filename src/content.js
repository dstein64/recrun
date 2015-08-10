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

// gets initialized in create.js
var recrunId = null;

// append to <html> instead of <body>. Less chance of interfering.
// creates html that's not valid, but it works...
var appendTo = document.documentElement;

var getOverlay = function() {
	if (recrunId)
		return document.getElementById(recrunId);
	else
		return null;
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

//keydown for ESC handled in iframe.js
//here we handle UP and DOWN, which may sometimes be captured
//by top frame (even after trying multiple ways to get iframe in focus)
var disableScrollEvents = 'scroll mousewheel touchmove keydown mousedown';

var disableScrollHandler = function(e) {    
 var type = e.type;
 
 var ESC = 27;
 
 var UP = 38;
 var DOWN = 40;
 var PGUP = 33;
 var PGDOWN = 34;
 var HOME = 36;
 var END = 35;
 var SPACE = 32;
 var s = new Set([UP, DOWN, PGDOWN, PGUP, SPACE, HOME, END, ESC]);
 
 var scrollKeyPress = type === 'keydown' && s.has(e.which);
 var scrollMouseWheel = type === 'mousewheel';
 var middleClick = type === 'mousedown' && e.which === 2;
 
 var amount = 0;
 var scrollElt = getRecrunElementById('scroll');
 var atBottom = scrollElt.scrollTop + scrollElt.clientHeight >= scrollElt.scrollHeight;
 var atTop = scrollElt.scrollTop <= 0;
 
 if (type === 'keydown' && e.which === ESC) {
     overlay.close();
     return false;
 } else if (scrollKeyPress) {
     
     var key = e.which;
     
     var n = 40;
     var h = scrollElt.clientHeight * 0.85;
     
     if (key === UP) {
         amount = -1 * n;
     } else if (key === DOWN) {
         amount = n;
     } else if (key === SPACE || key === PGDOWN) {
         amount = h;
     } else if (key === PGUP) {
         amount = -1 * h;
     } else if (key === HOME) {
         amount = -1 * scrollElt.scrollTop;
     } else if (key === END) {
         amount = scrollElt.scrollHeight - scrollElt.clientHeight - scrollElt.scrollTop;
     }
     
 } else if (scrollMouseWheel) {
     var wheelDelta = e.originalEvent.wheelDeltaY;
     if ((wheelDelta < 0 && atBottom) // prevents jumping 1 pixel beyong boundary
             || (wheelDelta > 0 && atTop)) {
         return false;
     }
     // this will cause scrolling speed to match mouse wheel scrolling
     // with a mouse, but scrolling will be slightly faster with the Mac trackpad
     // than it usually is.
     amount = (-533/120) * wheelDelta;
     // since can't currently get consistency, just turn off mouse
     // wheel scrolling from border region
     return false;
 } else if (middleClick) {
     // not sure how to capture scrolling from middle click, so just capture and block
     // so background page doesn't move
     return false;
 } else {
     return true;
 }
 
 var evt = new CustomEvent('scroll', {'detail': amount});
 getRecrunWindow().document.body.dispatchEvent(evt);   
 
 // returning false calls e.preventDefault() and e.stopPropagation()
 return false;
};

var disableScroll = function() {
 $('html').on(disableScrollEvents, disableScrollHandler);
};

var enableScroll = function() {
 $('html').off(disableScrollEvents, disableScrollHandler);
};

var vHeight = '95%';
var vPos = '2%'; // 2% margin on top, 3% on bottom

var overlay = null;
var bPopup = function(callback) {
    var options = {
        zIndex: 2147483647,
        position: ['auto', vPos + ' !important'],
        appendTo: appendTo,
        positionStyle: 'fixed',
        onOpen: disableScroll,
        onClose: enableScroll
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
    setPropertyImp(iframe, 'height', vHeight);
    setPropertyImp(iframe, 'top', vPos);
    setPropertyImp(iframe, 'border-radius', '3px');
    setPropertyImp(iframe, 'background-color', '#f3f2ee');
    setPropertyImp(iframe, 'border', '1px solid #ccc');
    
    appendTo.appendChild(iframe);
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
    
    // TODO: indent comments based on parent/child relationships
    
    var commentsFrag = doc.createDocumentFragment();
    // comments currently disabled
    if (false && options.comments && ('discussion' in article)) {
        var discussion = article['discussion'];
        if ('posts' in discussion) {
            var posts = discussion['posts'];
            if (posts.length > 0) {
                var commentsHeader = doc.createElement('h2');
                commentsHeader.appendChild(doc.createTextNode('Comments'));
                commentsFrag.appendChild(commentsHeader);
                for (var i = 0; i < posts.length; i++) {
                    var post = posts[i];
                    var postDiv = doc.createElement('div');
                    postDiv.classList.add('post');
                    
                    if ('author' in post) {
                        var postAuthorDiv = doc.createElement('div');
                        postAuthorDiv.classList.add('postAuthor');
                        postAuthorDiv.appendChild(doc.createTextNode(post['author']));
                        postDiv.appendChild(postAuthorDiv);
                    }
                    
                    if ('date' in post) {
                        var postDateDiv = doc.createElement('div');
                        postDateDiv.classList.add('postDate');
                        postDateDiv.appendChild(doc.createTextNode(post['date']));
                        postDiv.appendChild(postDateDiv);
                    }
                    
                    var postContentDiv = doc.createElement('div');
                    postContentDiv.classList.add('postContent');
                    if (options.diffbotHtml) {
                        if ('html' in post) {
                            var htmlPostString = post['html'];
                            sanitize(htmlPostString, postContentDiv);
                        }
                    } else if ('text' in post) {
                        var postP = doc.createElement('p');
                        postP.appendChild(doc.createTextNode(post['text']));
                        postContentDiv.appendChild(postP);
                    }
                    
                    if (!('parentId' in post) && i < posts.length-1) {
                        var postSep = doc.createElement('hr');
                        postContentDiv.appendChild(postSep);
                    }
                    
                    postDiv.appendChild(postContentDiv);
                    commentsFrag.appendChild(postDiv);
                }
            }
        }
    }
    
    var e = getRecrunElementById('recrun-html');
    e.appendChild(contentFrag);
    e.appendChild(commentsFrag);
};

var recrun = function() {
    if (overlayOpen()) {
        overlay.close();
        return;
    }
    
    if (!getOverlay()) {
        var errmsg = "recrun couldn't start on this page.\n\n"
            + "This can occur on incompatible pages or if recrun is used before"
            + " the page is finished loading. For the latter case, please try again"
            + " shortly.";
        alert(errmsg);
    	return;
    }
    
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

