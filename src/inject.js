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
