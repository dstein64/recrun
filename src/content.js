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

var appendTo = document.documentElement;

$(iframe).hide();
appendTo.appendChild(iframe);

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
    $(iframe).fadeOut(200);
};

var recrunOpen = function() {
    disableScroll();
    $(iframe).fadeIn(200);
    // could also use url from chrome.runtime's message request.data.url
    sendMsg('recrun', {url: location.href});
};

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
        }
    }
};

//the following is for receiving a message from an iframe, not the extension background
window.addEventListener("message", receiveMessage, false);

chrome.runtime.onMessage.addListener(function(request) {
    var method = request.method; 
    if (method === "recrun") {
        var _exists = exists();
        if (_exists) {
            if (ready) {
                var _shown = shown(); // could have a toggle flag for this
                if (_shown) {
                    recrunClose();
                } else {
                    recrunOpen();
                }   
            } else {
                var errmsg = "Please try again soon.";
                alert(errmsg);
            }
        } else {
            var errmsg = "recrun couldn't run on this page.\n\n"
                + "(this occurs on incompatible pages)";
            alert(errmsg);
        }
    }
});
