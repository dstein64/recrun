var options = null;
chrome.runtime.sendMessage({method: "getOptions"}, function(response) {
    options = response;
})

// url of last recrun'd page
// Subsequently updated by the recrun message listener
var lastUrl = decodeURIComponent(location.hash.slice(1));

// send message to parent
var sendMsg = function(method, data) {
    // targetOrigin matches on scheme, hostname, and port, so even if there
    // has been a change to the URL (hash change or something else within the
    // same domain, this targetOrigin will work.
    parent.postMessage({method: method, data: data}, lastUrl);
};

var getApiUrl = function(token, url) {
    return 'https://api.diffbot.com/v3/article?html&token=' + token + '&url=' + encodeURIComponent(url);
};

var recrunId = 'recrun';

// append to <html> instead of <body>. Less chance of interfering.
// creates html that's not valid, but it works...
var appendTo = document.documentElement;

var getRecrunElementById = function(id) {
    return document.getElementById(id);
};

var recrunShow = function(id) {
    $(getRecrunElementById(id)).show();
};

var recrunShowOnly = function(ids) {
    var container = getRecrunElementById("recrun-container");
    var children = container.children;
    for (var i = 0; i < children.length; i++) {
        var child = children[i];
        $(child).hide();
    }
    for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        recrunShow(id);
    }
};

var getScrollElt = function() {
    return document.getElementById('scroll');
};

var ESC = 27;

var UP = 38;
var DOWN = 40;
var PGUP = 33;
var PGDOWN = 34;
var HOME = 36;
var END = 35;
var SPACE = 32;

var upSet = new Set([UP, PGUP, HOME]);
var downSet = new Set([DOWN, PGDOWN, END, SPACE]);

$(document).on('keydown mousedown', function(e) {
    var type = e.type;
    if (type === 'keydown') {
        var which = e.which;
        if (which === ESC) {
            recrunClose();
            return;
        }
        
        // ignore these or else they'll get sent to the top frame
        var ignore = false;
        var scrollElt = getScrollElt();
        if (upSet.has(which) && scrollElt.scrollTop <= 0) {
            ignore = true;
        }
        
        if (downSet.has(which)
                && (scrollElt.scrollTop + scrollElt.clientHeight >= scrollElt.scrollHeight)) {
            ignore = true;
        }
        
        if (ignore) {
            // don't need e.preventDefault() or e.stopPropagation(), as they're auto-implied
            return false;
        }
    } else if (type === 'mousedown') {
        // disable middle click scrolling. on your desktop, it sometimes freezes the tab (???)
        // also now that you've reverted back to keeping the host page's scroll bar, this will prevent
        // the scenario where a wheel scroll can't continue in the overlay and gets captured by the host
        if (e.which === 2)
            return false;
    }
});

// bottom of page gets jumpy from scroll wheel. it goes one pixel below where it should.
// this prevents that
$(document).on('mousewheel', function(e) {
    var wheelDelta = e.originalEvent.wheelDelta;
    var scrollElt = getScrollElt();
    var atBottom = scrollElt.scrollTop + scrollElt.clientHeight >= scrollElt.scrollHeight;
    if (wheelDelta < 0 && atBottom) { // wheelDelta < 0, when scrolling down
        return false;
    } else if (wheelDelta > 0 && scrollElt.scrollTop <= 0) {
        // I haven't seen this be a problem, but handle just in case
        return false;
    }
});

document.body.addEventListener('scroll', function(e) {
    var scroll = getScrollElt();
    var amount = e.detail;
    scroll.scrollTop += amount;
});

var setPropertyImp = function(element, key, val) {
    // have to use setProperty for setting !important. This doesn't work: span.style.backgroundColor = 'yellow !important';
    element.style.setProperty(key, val, 'important');
};

// have to store response here. re-calling bpopup relaods the iframe,
// losing its content.
// resp is an array with two elements, url and json object: [URL, JSON]
var resp = null;

var sanitize = function(htmlString, rootNode, allowedTags, allowedAttrs) {
    var parser = new DOMParser();
    var htmldoc = parser.parseFromString(htmlString, "text/html");
    var doc = rootNode.ownerDocument;
    
    // 'rec' as in 'recursive', not 'rec' as in 'recrun'
    var rec = function(n, recrunNode) {
        var type = n.nodeType;
        if (type === Node.TEXT_NODE) {
            var text = n.textContent;
            recrunNode.appendChild(doc.createTextNode(text));
        } else if (type === Node.ELEMENT_NODE) {
            var tag = n.tagName;
            var tagLower = tag.toLowerCase();
            
            var nextRecrunNode = recrunNode;
            
            if (allowedTags.has(tagLower)) {
                var newElement = doc.createElement(tag);
                
                var attrs = n.attributes;
                for (var i = 0; i < attrs.length; i++) {
                    var attr = attrs[i];
                    var attrNameLower = attr.name.toLowerCase();
                    if (allowedAttrs.has(tagLower) && allowedAttrs.get(tagLower).has(attrNameLower)) {
                        newElement.setAttribute(attrNameLower, attr.value);
                    }
                }
                if (tagLower === 'a') {
                    newElement.setAttribute('target', '_blank');
                }
                
                recrunNode.appendChild(newElement);
                nextRecrunNode = newElement;
            }
                
            var _children = n.childNodes;
            for (var i = 0; i < _children.length; i++) {
                var _child = _children[i];
                rec(_child, nextRecrunNode);
            }
            
        }
    };
    var children = htmldoc.body.childNodes;
    for (var i = 0; i < children.length; i++) {
        var child = children[i];
        rec(child, rootNode);
    }
};

var descendantOfTag = function(element, tagName, depth) {
    depth = typeof depth !== 'undefined' ? depth : -1; // -1 for infinite. not safe.
    tagName = tagName.toUpperCase();
    var cur = element;
    var counter = 0;
    while (cur) {
        if (cur === null) { // at root
            return false;
        } else if (depth > -1 && counter > depth) {
            return false;
        } else if (cur.tagName === tagName) {
            return cur;
        } else {
            cur = cur.parentNode;
        }
        counter++;
    }
    return false;
};

// returns false on error (a node with no parent)
// returns outer on success
var wrapNode = function(outer, inner) {
    var parent = inner.parentElement;
    if (parent) {
        inner.parentElement.replaceChild(outer, inner);
        outer.appendChild(inner);
        return outer;
    } else {
        return false;
    }
};

// given some document fragment, return a list of nodes for which fn returns true
var getElements = function(frag, fn) {
    var l = [];
    var rec = function(n) {
        if (fn(n)) {
            l.push(n);
        }
        var children = n.children;
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            rec(child);
        }
    }
    rec(frag);
    return l;
};

// an aricle object has title, author, date, etc.
var fillOverlay = function(article) {
    var fields = ['title', 'author', 'date'];
    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        var e = getRecrunElementById('recrun-' + field);
        if (field in article && e) {
            e.appendChild(document.createTextNode(article[field]));
        }
    }
    
    var contentFrag = document.createDocumentFragment();
    
    // the following allowed tags and attributes is specific to Diffbot, but will
    // be used for non-diffbot recrun'ing as well
    
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
    var allowedAttrs = new Map();
    allowedAttrs.set('td', new Set(['valign', 'colspan']));
    allowedAttrs.set('a', new Set(['href']));
    allowedAttrs.set('img', new Set(['src', 'alt']));
    allowedAttrs.set('video', new Set(['src']));
    allowedAttrs.set('audio', new Set(['src']));
    allowedAttrs.set('iframe', new Set(['src', 'frameborder']));
    allowedAttrs.set('embed', new Set(['src', 'type']));
    allowedAttrs.set('object', new Set(['src', 'type']));
    
    var useDiffbot = options.useDiffbot;
    
    if (!useDiffbot) {
        allowedTags.add('div');
        var htmlString = article['html'];
        sanitize(htmlString, contentFrag, allowedTags, allowedAttrs);
        // wrap img in <figure> for better layout (so same styling rules can be used for Diffbot and readability)
        var isImg = function(n) {
            return (n.nodeType === Node.ELEMENT_NODE) && (n.tagName === "IMG");
        };
        var imgs = getElements(contentFrag, isImg);
        for (var i = 0; i < imgs.length; i++) {
            var img = imgs[i];
            if (!descendantOfTag(img, "FIGURE", 10)) {
                var figure = contentFrag.ownerDocument.createElement('figure');
                wrapNode(figure, img);
            }
        }
    } else {
     // first add primary content
        if (options.diffbotHtml && ('html' in article)) {
            // create recrun content from Diffbot's html field
            var htmlString = article['html'];
            
            // can inject with innerHtml, and then clean up
            // I prefer this approach
            // generally, this approach protects against malicious and/or malformed html
            
            sanitize(htmlString, contentFrag, allowedTags, allowedAttrs);
        } else if ('text' in article) {
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
                        var img = document.createElement('img');
                        img.src = image['url'];
                        contentFrag.appendChild(img);
                        break;
                    }
                }
            }
            
            var text = article['text'];
            var paragraphs = text.split(/\n/g);
            for (var i = 0; i < paragraphs.length; i++) {
                var p = document.createElement('p');
                p.appendChild(document.createTextNode(paragraphs[i]));
                contentFrag.appendChild(p);
            }
        }
        
        // next add discussion
        
        // TODO: indent comments based on parent/child relationships
        
        var commentsFrag = document.createDocumentFragment();
        // comments currently disabled
        if (false && options.comments && ('discussion' in article)) {
            var discussion = article['discussion'];
            if ('posts' in discussion) {
                var posts = discussion['posts'];
                if (posts.length > 0) {
                    var commentsHeader = document.createElement('h2');
                    commentsHeader.appendChild(document.createTextNode('Comments'));
                    commentsFrag.appendChild(commentsHeader);
                    for (var i = 0; i < posts.length; i++) {
                        var post = posts[i];
                        var postDiv = document.createElement('div');
                        postDiv.classList.add('post');
                        
                        if ('author' in post) {
                            var postAuthorDiv = document.createElement('div');
                            postAuthorDiv.classList.add('postAuthor');
                            postAuthorDiv.appendChild(document.createTextNode(post['author']));
                            postDiv.appendChild(postAuthorDiv);
                        }
                        
                        if ('date' in post) {
                            var postDateDiv = document.createElement('div');
                            postDateDiv.classList.add('postDate');
                            postDateDiv.appendChild(document.createTextNode(post['date']));
                            postDiv.appendChild(postDateDiv);
                        }
                        
                        var postContentDiv = document.createElement('div');
                        postContentDiv.classList.add('postContent');
                        if (options.diffbotHtml) {
                            if ('html' in post) {
                                var htmlPostString = post['html'];
                                sanitize(htmlPostString, postContentDiv);
                            }
                        } else if ('text' in post) {
                            var postP = document.createElement('p');
                            postP.appendChild(document.createTextNode(post['text']));
                            postContentDiv.appendChild(postP);
                        }
                        
                        if (!('parentId' in post) && i < posts.length-1) {
                            var postSep = document.createElement('hr');
                            postContentDiv.appendChild(postSep);
                        }
                        
                        postDiv.appendChild(postContentDiv);
                        commentsFrag.appendChild(postDiv);
                    }
                }
            }
        }
    }
    
    var e = getRecrunElementById('recrun-html');
    
    if (contentFrag) {
        e.appendChild(contentFrag);
    }
    
    if (commentsFrag) {
        e.appendChild(commentsFrag);
    }
};

var recrunClose = function() {
    sendMsg('close', null);
};

// reset recrun content to default
var reset = function() { 
    ids = ['recrun-title', 'recrun-author', 'recrun-date', 'recrun-html'];
    for (var i = 0; i < ids.length; i++) {
        var cur = ids[i];
        $('#' + cur).empty();
    }
};

var recrun = function(article) {
    reset();
    
    var showDiffbot = function(article) {
        return function() {
            fillOverlay(article);
            recrunShowOnly(['recrun-apiresponse']);
        }
    };
    
    var showError = function() {
        recrunShowOnly(['recrun-error']);
    };
    
    var callback = null;
    
    var url = lastUrl;
    
    var useDiffbot = options.useDiffbot;
    
    // use cached response
    // also make sure cached response corresponds to current url (since url
    // can change without a full page reload)
    if (article) {
        callback = function() {
            fillOverlay(article);
            recrunShowOnly(['recrun-apiresponse']);
        }
    } else if (resp && url === resp[0]) {
        callback = showDiffbot(resp[1][0]);
    } else {
        callback = function() {
            var TIMEOUT = 40000;
            recrunShowOnly(['recrun-loader']);
            
            // no need to trim. options page does that.
            var validToken = ((typeof options.token) === 'string') && options.token.length > 0;
            if (!validToken) {
                showError(); // will show an error
            } else {
                var xhr = new XMLHttpRequest();
                var apiUrl = getApiUrl(options.token, url);
                xhr.open("GET", apiUrl, true);
                xhr.timeout = TIMEOUT;
                xhr.onreadystatechange = function() {
                    // 0 The request is not initialized
                    // 1 ... has been set up
                    // 2 ... has been sent
                    // 3 ... is in process
                    // 4 ... is complete
                    if (xhr.readyState === 4) {
                        var status = xhr.status;
                        var showFn = showError;
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
                                if (articles.length > 0) {
                                    resp = [url, articles];
                                    showFn = showDiffbot(resp[1][0]);
                                }
                            }
                        }
                        showFn();
                    }
                };
                xhr.ontimeout = function () {
                    showError();
                };
                xhr.send();
            }
        };
    }
    
    if (callback) {
        callback();
    }
};

// same domain, protocol, and port for two URLs?
var dppMatch = function(u1, u2) {
    U1 = new URL(u1);
    U2 = new URL(u2);
    return (U1.port === U2.port
            && U1.protocol === U2.protocol
            && U1.host === U2.host);
}

document.getElementById('recrun-retry-button').onclick = function() {
    recrunShowOnly(['recrun-loader']);
    // insert a half second delay showing the loader when retrying.
    // without this, it can be unclear if pressing the retry button
    // resulted in any action.
    window.setTimeout(function() {
        sendMsg('retry', null);
    }, 250);
};

document.getElementById('overlay').onclick = function() {
    recrunClose();
};

document.getElementById('recrun-close').onclick = function() {
    recrunClose();
};

var scroll = function(amount) {
    var evt = new CustomEvent('scroll', {'detail': amount});
    document.body.dispatchEvent(evt);
}

var keydownScroll = function(key) {
    var scrollElt = getRecrunElementById('scroll');
    var n = 40;
    var h = scrollElt.clientHeight * 0.85;
    
    var amount = 0;

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
    
    scroll(amount);
}

var mousewheelScroll = function(wheelDelta) {
    var scrollElt = getRecrunElementById('scroll');
    var atBottom = scrollElt.scrollTop + scrollElt.clientHeight >= scrollElt.scrollHeight;
    var atTop = scrollElt.scrollTop <= 0;
    if ((wheelDelta < 0 && atBottom) // prevents jumping 1 pixel beyond boundary
            || (wheelDelta > 0 && atTop)) {
        return false;
    }
    // this will cause scrolling speed to match mouse wheel scrolling
    // with a mouse, but scrolling will be slightly faster with the Mac trackpad
    // than it usually is.
    amount = (-533/120) * wheelDelta;
    // since can't currently get consistency, just turn off mouse
    // wheel scrolling from border region
    //scroll(amount);
}

var receiveMessage = function(event) {
    var method = event.data['method'];
    var data = event.data['data'];
    if (dppMatch(lastUrl, event.origin)) {
        if (method === 'recrun') {
            lastUrl = data['url'];
            var article = null;
            if ('rArticle' in data) {
                article = data['rArticle'];
            }
            recrun(article);
        } else if (method === 'amountscroll') {
            scroll(data);
        } else if (method === 'keydownscroll') {
            keydownScroll(data);
        } else if (method === 'mousewheelscroll') {
            mousewheelScroll(data);
        } else if (method === 'updateOptions') {
            // reset saved state, so the next call will re-fetch
            options = data;
            resp = null;
        }
    }
};
//the following is for receiving a message from an iframe, not the extension background
window.addEventListener("message", receiveMessage, false);

sendMsg('ready', null);
