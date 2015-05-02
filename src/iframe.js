var sendClose = function() {
    parent.postMessage('close', decodeURIComponent(location.hash.slice(1)));
};

var _close = document.getElementById('recrun-close');
_close.onclick = function() {
    sendClose();
};

var ESC = 27;

var UP = 38;
var DOWN = 40;
var PGDOWN = 34;
var PGUP = 33;
var SPACE = 32;
var HOME = 36;
var END = 35;

$(document).on('keydown', function(e) {
    var type = e.type;
    if (type === 'keydown') {
        var which = e.which;
        if (which === ESC) {
            sendClose();
        }
    }
});

document.body.addEventListener('key', function(e) {
    var scroll = document.getElementById('scroll');
    var amount = 0;
    var n = 40;
    var h = scroll.clientHeight * 0.85;
    var key = e.detail;
    if (key === UP) {
        amount = -1 * n;
    } else if (key === DOWN) {
        amount = n;
    } else if (key === SPACE || key === PGDOWN) {
        amount = h;
    } else if (key === PGUP) {
        amount = -1 * h;
    } else if (key === HOME) {
        amount = -1 * scroll.scrollTop;
    } else if (key === END) {
        amount = scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop;
    } else if (key === ESC) {
        sendClose();
        return;
    }
    scroll.scrollTop += amount;
});

