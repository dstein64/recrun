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
var src = 'src/content.html';
var hash = '#' + encodeURIComponent(location.href);
iframe.id = createUniqueId();
iframe.src = chrome.extension.getURL(src + hash);

setPropertyImp(iframe, 'position', 'fixed');
setPropertyImp(iframe, 'top', '0px');
setPropertyImp(iframe, 'left', '0px');
setPropertyImp(iframe, 'padding', '0px');
setPropertyImp(iframe, 'margin', '0px');
setPropertyImp(iframe, 'width', '100%');
setPropertyImp(iframe, 'height', '100%');
setPropertyImp(iframe, 'z-index', '2147483647');

iframe.setAttribute('frameBorder', '0px');

document.body.appendChild(iframe);

// seemingly we'd want to hide the iframe now. However, when doing this there
// seems to be a drawing issue where the frame gets put too far left. Letting the
// frame load first, and then hiding it after loading seems to fix the issue. So
// content.js tells us to hide.
//$(iframe).hide();

var ESC = 27;

var UP = 38;
var DOWN = 40;
var PGUP = 33;
var PGDOWN = 34;
var HOME = 36;
var END = 35;
var SPACE = 32;

var s = new Set([UP, DOWN, PGDOWN, PGUP, SPACE, HOME, END, ESC]);

// Without clicking on iframe, this outer iframe will capture keydowns, so pass to child.
$(document).on('keydown scroll', function(e) {
    if (e.type === 'keydown') {
        var which = e.which;
        if (s.has(which)) {
            iframe.contentWindow.postMessage({'method': 'keydown', 'data': which}, 'chrome-extension://' + chrome.runtime.id);
            return false;
        } else {
            return true;
        }
    } else {
        // ignore scroll. not sure why this triggers sometimes with Fn-Direction
        return false;
    }
});

function receiveMessage(event) {
    if (event.origin === (new URL(chrome.extension.getURL(''))).origin) {
        if (event.data === 'show') {
            $(iframe).show();
        } else if (event.data === 'hide') {
            $(iframe).hide();
        }
    }
}
//the following is for receiving a message from an iframe, not the extension background
window.addEventListener("message", receiveMessage, false);
