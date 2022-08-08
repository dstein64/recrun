let options = null;
const updateOptions = function(opts) {
    options = opts;
    // notify iframe.js
    if (iframe && iframe.contentWindow) {
        sendMsg('updateOptions', options);
    }
};

// create a unique id that won't clash with any other ids on the page.
// doesn't have to be static since we don't refer to the id statically
// (no references in css, etc.).
const createUniqueId = function() {
    let tries = 0;
    while (tries < 20) {
        const curId = '_' + Math.random().toString(36).substr(2, 9);
        if (!document.getElementById(curId)) {
            return curId;
        }
        tries = tries + 1;
    }
    return null;
};

const setPropertyImp = function(element, key, val) {
    // have to use setProperty for setting !important.
    // This doesn't work: span.style.backgroundColor = 'yellow !important';
    element.style.setProperty(key, val, 'important');
};

const iframe = document.createElement('iframe');
const src = 'src/iframe.html';
const hash = '#' + encodeURIComponent(location.href);
iframe.id = createUniqueId();
iframe.src = chrome.runtime.getURL(src + hash);
iframe.setAttribute('frameBorder', '0');
setPropertyImp(iframe, 'display', 'none');

const positionIframe = function() {
    // Set 'transform' to null, so that subsequent uses below aren't impacted
    // on existing settings.
    setPropertyImp(iframe, 'transform', null);
    setPropertyImp(iframe, 'transform-origin', null);

    setPropertyImp(iframe, 'position', 'fixed');
    setPropertyImp(iframe, 'display', 'none');
    setPropertyImp(iframe, 'padding', '0');
    setPropertyImp(iframe, 'margin', '0');
    // 2147483647 is the max. In testing, it seems like a tie goes to the most
    // recently added element. So you changed run_at from document_start to
    // document_idle, so that recrun z-index takes precedence
    setPropertyImp(iframe, 'z-index', '2147483647');
    setPropertyImp(iframe, 'top', '0');
    setPropertyImp(iframe, 'left', '0');
    setPropertyImp(iframe, 'width', '100%');
    setPropertyImp(iframe, 'height', '100%');

    // On mobile, account for viewport scaling on 1) pages that aren't mobile-friendly
    // (e.g., pages without a <meta name="viewport" ...> tag, or 2) pages that are zoomed.
    // As of 2020/06/03, window.visualViewport is available on Chrome and Firefox
    // for Android (although not available for desktop Firefox without manually turning
    // it on in about:config, even when using responsive design mode).
    if (window.visualViewport !== undefined) {
        const viewportWidth = window.visualViewport.width;
        const viewportHeight = window.visualViewport.height;
        const viewportScale = window.visualViewport.scale;
        const viewportOffsetLeft = window.visualViewport.offsetLeft;
        const viewportOffsetTop = window.visualViewport.offsetTop;
        // Don't use this approach unless necessary. The approach above is preferable since
        // it automatically scales for changing window sizes.
        if (viewportScale !== 1 || viewportOffsetLeft !== 0 || viewportOffsetTop !== 0) {
            let transform = 'translateX(' + viewportOffsetLeft + 'px)';
            transform += ' translateY(' + viewportOffsetTop + 'px)';
            transform += ' scale(' + (1 / viewportScale) + ')';
            setPropertyImp(iframe, 'width', viewportWidth * viewportScale + 'px');
            setPropertyImp(iframe, 'height', viewportHeight * viewportScale + 'px');
            setPropertyImp(iframe, 'transform-origin', 'top left');
            setPropertyImp(iframe, 'transform', transform);
        }
    }
};

// iframe is appended after recrun is clicked the first time.
// could remove it when recrun window closed (and then re-insert on subsequent
// clicks), But recrun'ing the same page multiple times during the same session
// is cached, within the iframe, so don't remove
const appendTo = document.documentElement;

const sendMsg = function(method, data) {
    iframe.contentWindow.postMessage(
        {
            'method': method,
            'data': data
        },
        (new URL(iframe.src)).origin);
};

const exists = function() {
    return iframe && appendTo.contains(iframe);
};

const shown = function() {
    return iframe && iframe.style.display !== 'none';
};

const registerEvents = function() {
    document.addEventListener('keydown', keyHandler);
};

const deregisterEvents = function() {
    document.removeEventListener('keydown', keyHandler);
};

const keyHandler = function(e) {
    if (!exists() || !shown()) {
        deregisterEvents();
        return true;
    }
    if (e.type !== 'keydown') return true;
    const s = new Set([
        'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown',
        'PageUp', 'PageDown', 'Home', 'End', ' '
    ]);
    if (e.key === 'Escape') {
        recrunClose();
    } else if (s.has(e.key)) {
        sendMsg('keydownscroll', e.key);
    }
    e.preventDefault();
    e.stopPropagation();
};

const recrunClose = function() {
    deregisterEvents();
    iframe.style.display = 'none';
};

// store last Diffbot response here
let cacheDiffbot = null;

const recrunOpen = function(retry) {
    positionIframe();
    if (!retry) {
        registerEvents();
        iframe.style.display = null;
    }
    // could also use url from chrome.runtime's message request.data.url
    const data = Object(null);

    const url = location.href;
    data['url'] = url;

    if (!options.useDiffbot) {
        const settings = Object(null);
        settings['cleanAttributes'] = false;
        const readable = new Readability(document, settings, 3);
        const article = readable.getArticle(false);

        const rArticle = Object(null);
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
let todo = null;

// is iframe ready
ready = false;

const receiveMessage = function(event) {
    const method = event.data['method'];
    const data = event.data['data'];
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
};

// the following is for receiving a message from an iframe, not the extension
// background
window.addEventListener('message', receiveMessage, false);

const compatible = function() {
    return document.contentType.indexOf('text/html') > -1
};

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    const method = request.method;
    const response = {method: method};
    response.success = true;
    if (method === 'recrun') {
        if (!compatible()) {
            response.success = false;
        } else if (!shown()) {
            chrome.storage.local.get(['options'], function(result) {
                if (!result.options) return;
                if (JSON.stringify(options) !== JSON.stringify(result.options)) {
                    // clear Diffbot cache
                    cacheDiffbot = null;
                }
                updateOptions(result.options);
                todo = function () {
                    recrunOpen(false);
                };
                appendTo.appendChild(iframe);
            });
        } else {
            recrunClose();
        }
    } else if (method === 'ping') {
        response.success = true;
    }
    // sending a response prevents chrome.runtime.lastError from firing for
    // no response.
    // see https://bugs.chromium.org/p/chromium/issues/detail?id=586155
    // alternatively, could return true from this function.
    sendResponse(response);
});
