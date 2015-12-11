var options = null;
var updateOptions = function(opts) {
    options = opts;
    // notify iframe.js
    if (iframe && iframe.contentWindow) {
        sendMsg('updateOptions', options);
    }
};
chrome.runtime.sendMessage({method: "getOptions"}, function(response) {
    var opts = response;
    updateOptions(opts);
});
chrome.runtime.onMessage.addListener(function(request) {
    var method = request.method;
    if (method === "updateOptions") {
        updateOptions(request.data);
        // clear Diffbot cache
        cacheDiffbot = null;
    }
});

//create a unique id that won't clash with any other ids on the page.
//doesn't have to be static since we don't refer to the id statically
//(no references in css, etc.).
var createUniqueId = function() {
 var tries = 0;
 while (tries < 20) {
     var curId = '_' + Math.random().toString(36).substr(2, 9);
     if (!document.getElementById(curId)) {
         return curId;
     }
     tries = tries + 1;
 }
 return null;
};

var setPropertyImp = function(element, key, val) {
    // have to use setProperty for setting !important. This doesn't work: span.style.backgroundColor = 'yellow !important';
    element.style.setProperty(key, val, 'important');
};

var iframe = document.createElement('iframe');
var src = 'src/iframe.html';
var hash = '#' + encodeURIComponent(location.href);
iframe.id = createUniqueId();
iframe.src = chrome.extension.getURL(src + hash);

setPropertyImp(iframe, 'position', 'fixed');
setPropertyImp(iframe, 'top', '0px');
setPropertyImp(iframe, 'left', '0px');
setPropertyImp(iframe, 'padding', '0px');
setPropertyImp(iframe, 'margin', '0px');
setPropertyImp(iframe, 'width', '100vw');
setPropertyImp(iframe, 'height', '100vh');

// 2147483647 is the max. In testing, it seems like a tie goes to the most recently added element.
// So you changed run_at from document_start to document_idle, so that recrun z-index takes precedence
setPropertyImp(iframe, 'z-index', '2147483647');

iframe.setAttribute('frameBorder', '0px');

// iframe is appended after recrun is clicked the first time.
// could remove it when recrun window closed (and then re-insert on subsequent clicks),
// But recrun'ing the same page multiple times during the same session is cached, within the
// iframe, so don't remove
var appendTo = document.documentElement;

$(iframe).hide();

var sendMsg = function(method, data) {
    iframe.contentWindow.postMessage({'method': method, 'data': data}, 'chrome-extension://' + chrome.runtime.id);    
};

var exists = function() {
    return iframe && appendTo.contains(iframe);
};

var shown = function() {
    return iframe && $(iframe).is(":visible"); 
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

var disableScroll = function() {
    $('html').on(disableScrollEvents, disableScrollHandler);
};

var enableScroll = function() {
    $('html').off(disableScrollEvents, disableScrollHandler);
};

var disableScrollEvents = 'scroll mousewheel touchmove keydown mousedown';

var disableScrollHandler = function(e) {
    if (!exists() || !shown()) {
        enableScroll();
        return true;
    }
    
    var type = e.type;
    
    var s = new Set([UP, DOWN, PGDOWN, PGUP, SPACE, HOME, END, ESC]);

    var scrollKeyPress = type === 'keydown' && s.has(e.which);
    var scrollMouseWheel = type === 'mousewheel';
    var middleClick = type === 'mousedown' && e.which === 2;
    
    // returning false calls e.preventDefault() and e.stopPropagation()

    if (type === 'keydown' && e.which === ESC) {
        recrunClose();
    } else if (scrollKeyPress) {
        var key = e.which;
        sendMsg('keydownscroll', key);
    } else if (scrollMouseWheel) {
        var wheelDelta = e.originalEvent.wheelDeltaY;
        sendMsg('mousewheelscroll', wheelDelta);
    } else if (middleClick) {
        // not sure how to capture scrolling from middle click, so just capture and block
        // so background page doesn't move
    } else {
        return true;
    }
    return false;
};

var recrunClose = function() {
    enableScroll();
    //$(iframe).hide();
    $(iframe).fadeOut(200, function() {
        appendTo.removeChild(iframe);
    });
};

// store last Diffbot response here
var cacheDiffbot = null;

var recrunOpen = function(retry) {
    if (!retry) {
        disableScroll();
        $(iframe).fadeIn(200);   
    }
    // could also use url from chrome.runtime's message request.data.url
    var data = Object(null);
    
    var url = location.href;
    data['url'] = url;
    
    if (!options.useDiffbot) {
        var settings = Object(null);
        settings['cleanAttributes'] = false;
        var readable = new Readability(document, settings, 3);
        var article = readable.getArticle(false);
        
        var rArticle = Object(null);
        rArticle['text'] = article.getText();
        rArticle['html'] = article.getHTML();
        rArticle['title'] = article.title;
        data['article'] = rArticle;
    } else if (cacheDiffbot && cacheDiffbot['pageUrl'] === url) {
        data['article'] = cacheDiffbot;
    }
    
    data['baseURI'] = document.baseURI;
    
    sendMsg('recrun', data);
};

// todo holds a function to run once ready
var todo = null;

// is iframe ready
ready = false;

var receiveMessage = function(event) {
    if (event.origin === (new URL(chrome.extension.getURL(''))).origin) {
        var method = event.data['method'];
        var data = event.data['data'];
        if (method === 'close') {
            recrunClose();
        } else if (method === 'ready') {
            ready = true;
            if (todo) {
                // TODO: is there any scenario where you should poll here?
                //       seemingly, todo should always be able to run at this point
                todo();
                todo = null;
            }
        } else if (method === 'retry') {
            recrunOpen(true);
        } else if (method === 'cacheDiffbot') {
            cacheDiffbot = data;
        }
    }
};

//the following is for receiving a message from an iframe, not the extension background
window.addEventListener("message", receiveMessage, false);

chrome.runtime.onMessage.addListener(function(request) {
    var method = request.method;
    
    if (method === "recrun") {        
        var _shown = shown(); // could have a toggle flag for this
        if (_shown) {
            recrunClose();
            return;
        } else {
            todo = function() {
                recrunOpen(false);
            };
            appendTo.appendChild(iframe);
            
            // TODO: possibly some error checking such that if user tries to recrun, but
            //       recrun'ing doesn't finish within X seconds, assume a problematic site
            //       (e.g., a site that removes the recrun iframe)
            var error = false;
            if (error) {
                var errmsg = "recrun couldn't run on this page.\n\n"
                    + "(this occurs on incompatible pages)";
                alert(errmsg);
                return;
            }
        }
    }
});
