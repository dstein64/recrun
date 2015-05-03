var sendClose = function() {
    parent.postMessage('close', decodeURIComponent(location.hash.slice(1)));
};

var _close = document.getElementById('recrun-close');
_close.onclick = function() {
    sendClose();
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

$(document).on('keydown', function(e) {
    var type = e.type;
    if (type === 'keydown') {
        var which = e.which;
        if (which === ESC) {
            sendClose();
            return;
        }
        
        var ignore = false;
        var scroll = getScrollElt();
        if (upSet.has(which) && scroll.scrollTop === 0) {
            ignore = true;
        }
        
        if (downSet.has(which)
                && (scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight)) {
            ignore = true;
        }
        
        if (ignore) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }
});

document.body.addEventListener('scroll', function(e) {
    var scroll = getScrollElt();
    var amount = e.detail;
    scroll.scrollTop += amount;
});

