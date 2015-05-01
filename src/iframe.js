var _close = document.getElementById('recrun-close');
_close.onclick = function() {
    parent.postMessage('close', decodeURIComponent(location.hash.slice(1)));
};
