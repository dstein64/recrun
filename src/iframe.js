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

$(document).on('keydown mousedown', function(e) {
    var type = e.type;
    if (type === 'keydown') {
        var which = e.which;
        if (which === ESC) {
            sendClose();
            return;
        }
        
        // ignore these or else they'll get sent the top frame
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
            // don't need e.preventDefault() or e.stopPropagation(), as their auto-implied
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


