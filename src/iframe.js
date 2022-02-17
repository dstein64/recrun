let options = null;

// url of last recrun'd page
// Subsequently updated by the recrun message listener
let lastUrl = decodeURIComponent(location.hash.slice(1));

// send message to parent
const sendMsg = function(method, data) {
    // targetOrigin matches on scheme, hostname, and port, so even if there
    // has been a change to the URL (hash change or something else within the
    // same domain, this targetOrigin will work.
    parent.postMessage({method: method, data: data}, lastUrl);
};

const getApiUrl = function(token, url) {
    return 'https://api.diffbot.com/v3/article?html'
                 + '&token=' + token
                 + '&url=' + encodeURIComponent(url);
};

const getRecrunElementById = function(id) {
    return document.getElementById(id);
};

const recrunShow = function(id) {
    getRecrunElementById(id).style.display = null;
};

const recrunShowOnly = function(ids) {
    let container = getRecrunElementById('recrun-container');
    let children = container.children;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        child.style.display = 'none';
    }
    for (let i = 0; i < ids.length; i++) {
        let id = ids[i];
        recrunShow(id);
    }
};

document.addEventListener('keydown', function(e) {
    const upSet = new Set(['ArrowUp', 'PageUp', 'Home']);
    const downSet = new Set(['ArrowDown', 'PageDown', 'End', ' ']);
    const scrollElt = document.getElementById('scroll');
    if (e.type !== 'keydown') return;
    const atTop = scrollElt.scrollTop <= 0;
    const atBottom = scrollElt.scrollTop + scrollElt.clientHeight >= scrollElt.scrollHeight;
    const atLeft = scrollElt.scrollLeft <= 0;
    const atRight = scrollElt.scrollLeft + scrollElt.clientWidth >= scrollElt.scrollWidth;
    // ignore keys so they don't get sent to the top frame
    let ignore = false;
    if (e.key === 'Escape') {
        recrunClose();
        ignore = true;
    }
    ignore = ignore || (upSet.has(e.key) && atTop);
    ignore = ignore || (downSet.has(e.key) && atBottom);
    ignore = ignore || (e.key === 'ArrowLeft' && atLeft);
    ignore = ignore || (e.key === 'ArrowRight' && atRight);
    if (ignore) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
    return true;
});

// prevent mouse wheel scrolling from propagating when there are no scroll bars
// (this is a problem on Firefox, but not Chrome)
window.addEventListener('wheel', function(e) {
    const scrollElt = document.getElementById('scroll');
    const scrollRect = scrollElt.getBoundingClientRect();
    if (e.pageX < scrollRect.x
            || e.pageX > scrollRect.x + scrollRect.width
            || e.pageY < scrollRect.y
            || e.pageY > scrollRect.y + scrollRect.height)
        return true;
    const atTop = scrollElt.scrollTop <= 0;
    const atBottom = scrollElt.scrollTop + scrollElt.clientHeight >= scrollElt.scrollHeight;
    const atLeft = scrollElt.scrollLeft <= 0;
    const atRight = scrollElt.scrollLeft + scrollElt.clientWidth >= scrollElt.scrollWidth;
    // ignore scrolls so they don't get sent to the top frame
    if (atTop && atBottom && atLeft && atRight) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
    return true;
}, {passive: false});

// have to pass baseURI for resolving relative links
const sanitize = function(htmlString, rootNode, allowedTags, allowedAttrs, baseURI) {
    const parser = new DOMParser();
    const htmldoc = parser.parseFromString(htmlString, 'text/html');
    const doc = rootNode.ownerDocument;

    // 'rec' as in 'recursive', not 'rec' as in 'recrun'
    const rec = function(n, recrunNode) {
        const type = n.nodeType;
        if (type === Node.TEXT_NODE) {
            const text = n.textContent;
            recrunNode.appendChild(doc.createTextNode(text));
        } else if (type === Node.ELEMENT_NODE) {
            const tag = n.tagName;
            const tagLower = tag.toLowerCase();

            let nextRecrunNode = recrunNode;

            if (allowedTags.has(tagLower)) {
                const newElement = doc.createElement(tag);

                const attrs = n.attributes;
                for (let i = 0; i < attrs.length; i++) {
                    const attr = attrs[i];
                    const attrNameLower = attr.name.toLowerCase();
                    if (allowedAttrs.has(tagLower)
                          && allowedAttrs.get(tagLower).has(attrNameLower)) {
                        let val = attr.value;

                        // resolve paths

                        // http://stackoverflow.com/questions/4071117/
                        //        uri-starting-with-two-slashes-how-do-they-behave/
                        //        4071178#4071178
                        // http://www.ietf.org/rfc/rfc3986.txt
                        //
                        // Within a representation with a well defined base URI of:
                        //    http://a/b/c/d;p?q
                        // a relative reference is transformed to its target URI
                        // as follows:
                        //
                        //    'g:h'           =  'g:h'
                        //    'g'             =  'http://a/b/c/g'
                        //    './g'           =  'http://a/b/c/g'
                        //    'g/'            =  'http://a/b/c/g/'
                        //    '/g'            =  'http://a/g'
                        //    '//g'           =  'http://g'
                        //*    '?y'            =  'http://a/b/c/d;p?y'
                        //    'g?y'           =  'http://a/b/c/g?y'
                        //*    '#s'            =  'http://a/b/c/d;p?q#s'
                        //    'g#s'           =  'http://a/b/c/g#s'
                        //    'g?y#s'         =  'http://a/b/c/g?y#s'
                        //    ';x'            =  'http://a/b/c/;x'
                        //    'g;x'           =  'http://a/b/c/g;x'
                        //    'g;x?y#s'       =  'http://a/b/c/g;x?y#s'
                        //    ''              =  'http://a/b/c/d;p?q'
                        //    '.'             =  'http://a/b/c/'
                        //    './'            =  'http://a/b/c/'
                        //    '..'            =  'http://a/b/'
                        //    '../'           =  'http://a/b/'
                        //    '../g'          =  'http://a/b/g'
                        //    '../..'         =  'http://a/'
                        //    '../../'        =  'http://a/'
                        //    '../../g'       =  'http://a/g'

                        if (attrNameLower === 'src' || attrNameLower === 'href') {
                            if (val.indexOf('://') === -1) {
                                const u = new URL(baseURI);
                                const origin = u.origin;

                                // You confirmed with tests that URLs starting
                                // with '//' get protocol from baseURI, not from
                                // protocol of site you're currently on
                                if (val.startsWith('//')) {
                                    val = u.protocol + val;
                                } else if (val.startsWith('/')) {
                                    val = origin + val;
                                } else if (val.startsWith('?')) {
                                    val = origin + u.pathname + val;
                                } else if (val.startsWith('#')) {
                                    val = origin + u.pathname + u.search + val;
                                } else if (val.indexOf(':') > -1) {
                                    // do nothing
                                } else {
                                    const pathname = u.pathname;
                                    const basePath = origin + pathname.substring(
                                        0, pathname.lastIndexOf('/') + 1);
                                    val = basePath + val;
                                }
                            }
                        }

                        newElement.setAttribute(attrNameLower, val);
                    }
                }

                if (tagLower === 'a') {
                    newElement.setAttribute('target', '_blank');
                }

                // <video> and <audio> need controls
                if (tagLower === 'video' || tagLower === 'audio') {
                    newElement.setAttribute('controls', '')
                }

                recrunNode.appendChild(newElement);
                nextRecrunNode = newElement;
            }

            const _children = n.childNodes;
            for (let i = 0; i < _children.length; i++) {
                const _child = _children[i];
                rec(_child, nextRecrunNode);
            }

        }
    };
    const children = htmldoc.body.childNodes;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        rec(child, rootNode);
    }
};

const descendantOfTag = function(element, tagName, depth) {
    // -1 for infinite. not safe.
    depth = typeof depth !== 'undefined' ? depth : -1;
    tagName = tagName.toUpperCase();
    let cur = element;
    let counter = 0;
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
const wrapNode = function(outer, inner) {
    const parent = inner.parentElement;
    if (parent) {
        inner.parentElement.replaceChild(outer, inner);
        outer.appendChild(inner);
        return outer;
    } else {
        return false;
    }
};

// given some document fragment, return a list of nodes for which fn returns true
const getElements = function(frag, fn) {
    const l = [];
    const rec = function(n) {
        if (fn(n)) {
            l.push(n);
        }
        const children = n.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            rec(child);
        }
    };
    rec(frag);
    return l;
};

// an aricle object has title, author, date, etc.
const fillOverlay = function(article, baseURI) {
    const fields = ['title', 'author', 'date'];
    for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        const e = getRecrunElementById('recrun-' + field);
        if (field in article && e) {
            e.appendChild(document.createTextNode(article[field]));
        }
    }

    const contentFrag = document.createDocumentFragment();

    // the following allowed tags and attributes is specific to Diffbot, but will
    // be used for non-diffbot recrun'ing as well

    // from https://diffbot.com/dev/docs/article/html/
    // block elements
    let allowedTagsL = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'blockquote', 'code',
                        'pre', 'ul', 'ol', 'li', 'table', 'tbody', 'tr', 'td',
                        'dl', 'dt', 'dd'];
    // inline elements (following specs, although I usually treat <br> as block)
    allowedTagsL = allowedTagsL.concat(['br', 'b', 'strong', 'i', 'em', 'u', 'a']);
    // media
    if (options.media) {
        allowedTagsL = allowedTagsL.concat(['figure', 'img', 'video', 'audio',
                                            'source', 'figcaption', 'iframe',
                                            'embed', 'object']);
    }
    const allowedTags = new Set(allowedTagsL);
    const allowedAttrs = new Map();
    allowedAttrs.set('td', new Set(['valign', 'colspan']));
    allowedAttrs.set('a', new Set(['href']));
    allowedAttrs.set('img', new Set(['src', 'alt']));
    allowedAttrs.set('video', new Set(['src']));
    allowedAttrs.set('audio', new Set(['src']));
    allowedAttrs.set('source', new Set(['src', 'type']));
    allowedAttrs.set('iframe', new Set(['src', 'frameborder']));
    allowedAttrs.set('embed', new Set(['src', 'type']));
    allowedAttrs.set('object', new Set(['src', 'type']));

    const useDiffbot = options.useDiffbot;

    if (!useDiffbot) {
        allowedTags.add('div');
        const htmlString = article['html'];
        sanitize(htmlString, contentFrag, allowedTags, allowedAttrs, baseURI);
        // wrap img in <figure> for better layout (so same styling rules can be
        // used for Diffbot and readability)
        const isImg = function(n) {
            return (n.nodeType === Node.ELEMENT_NODE) && (n.tagName === 'IMG');
        };
        const imgs = getElements(contentFrag, isImg);
        for (let i = 0; i < imgs.length; i++) {
            const img = imgs[i];
            if (!descendantOfTag(img, 'FIGURE', 10)
                    && !descendantOfTag(img, 'A', 10)) {
                const figure = contentFrag.ownerDocument.createElement('figure');
                wrapNode(figure, img);
            }
        }
    } else {
        // first add primary content
        if (options.diffbotHtml && ('html' in article)) {
            // create recrun content from Diffbot's html field
            const htmlString = article['html'];

            // can inject with innerHtml, and then clean up
            // I prefer this approach
            // generally, this approach protects against malicious and/or
            // malformed html

            sanitize(htmlString, contentFrag, allowedTags, allowedAttrs, baseURI);
        } else if ('text' in article) {
            // create recrun content from Diffbot's text field
            // starting with one primary
            if (options.media && 'images' in article) {
                const images = article['images'];
                for (let i = 0; i < images.length; i++) {
                    const image = images[i];
                    if ('primary' in image
                            && image['primary'] === true
                            && 'url' in image
                            && (image['url'].startsWith('http://')
                                    || image['url'].startsWith('https://'))) {
                        const img = document.createElement('img');
                        img.src = image['url'];
                        contentFrag.appendChild(img);
                        break;
                    }
                }
            }

            const text = article['text'];
            const paragraphs = text.split(/\n/g);
            for (let i = 0; i < paragraphs.length; i++) {
                const p = document.createElement('p');
                p.appendChild(document.createTextNode(paragraphs[i]));
                contentFrag.appendChild(p);
            }
        }
    }

    const e = getRecrunElementById('recrun-html');

    if (contentFrag) {
        e.appendChild(contentFrag);
    }
};

const recrunClose = function() {
    sendMsg('close', null);
};

// reset recrun content to default
const reset = function() {
    const ids = ['recrun-title', 'recrun-author', 'recrun-date', 'recrun-html'];
    for (let i = 0; i < ids.length; i++) {
        const cur = ids[i];
        const element = document.getElementById(cur);
        while (element.firstChild) {
            element.removeChild(element.lastChild);
        }
    }
};

const recrun = function(article, baseURI) {
    reset();

    const showDiffbot = function(article) {
        return function() {
            fillOverlay(article, baseURI);
            recrunShowOnly(['recrun-apiresponse']);
        }
    };

    const showError = function() {
        recrunShowOnly(['recrun-error']);
    };
    let callback;
    const url = lastUrl;

    // use cached response
    // also make sure cached response corresponds to current url (since url
    // can change without a full page reload)
    if (article) {
        callback = function() {
            fillOverlay(article, baseURI);
            recrunShowOnly(['recrun-apiresponse']);
        }
    } else {
        callback = function() {
            const TIMEOUT = 40000;
            recrunShowOnly(['recrun-loader']);

            // no need to trim. options page does that.
            const validToken = ((typeof options.token) === 'string')
                             && options.token.length > 0;
            if (!validToken) {
                showError(); // will show an error
            } else {
                const xhr = new XMLHttpRequest();
                const apiUrl = getApiUrl(options.token, url);
                xhr.open('GET', apiUrl, true);
                xhr.timeout = TIMEOUT;
                xhr.onreadystatechange = function() {
                    // 0 The request is not initialized
                    // 1 ... has been set up
                    // 2 ... has been sent
                    // 3 ... is in process
                    // 4 ... is complete
                    if (xhr.readyState === 4) {
                        const status = xhr.status;
                        let showFn = showError;
                        if (status === 200) {
                            const _resp = JSON.parse(xhr.responseText);
                            if (!('error' in _resp)
                                    && 'objects' in _resp
                                    && _resp['objects'].length > 0) {
                                const articles = [];
                                const len = _resp['objects'].length;
                                for (let i = 0; i < len; i++) {
                                    const object = _resp['objects'][i];
                                    if ('type' in object
                                          && object['type'] === 'article') {
                                        articles.push(object);
                                    }
                                }
                                if (articles.length > 0) {
                                    const article = articles[0];
                                    // send to content.js for caching
                                    sendMsg('cacheDiffbot', article);
                                    showFn = showDiffbot(article);
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
const dppMatch = function(u1, u2) {
    const U1 = new URL(u1);
    const U2 = new URL(u2);
    return (U1.port === U2.port
            && U1.protocol === U2.protocol
            && U1.host === U2.host);
};

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

const keydownScroll = function(key) {
    const scrollElt = document.getElementById('scroll');
    const n = 40;
    const h = scrollElt.clientHeight * 0.85;

    let x = 0;
    let y = 0;

    if (key === 'ArrowLeft') {
        x = -1 * n;
    } else if (key === 'ArrowUp') {
        y = -1 * n;
    } else if (key === 'ArrowRight') {
        x = n;
    } else if (key === 'ArrowDown') {
        y = n;
    } else if (key === ' ' || key === 'PageDown') {
        y = h;
    } else if (key === 'PageUp') {
        y = -1 * h;
    } else if (key === 'Home') {
        y = -1 * scrollElt.scrollTop;
    } else if (key === 'End') {
        y = scrollElt.scrollHeight
            - scrollElt.clientHeight
            - scrollElt.scrollTop;
    }

    scrollElt.scrollLeft += x;
    scrollElt.scrollTop += y;
};

const receiveMessage = function(event) {
    const method = event.data['method'];
    const data = event.data['data'];
    if (dppMatch(lastUrl, event.origin)) {
        if (method === 'recrun') {
            lastUrl = data['url'];
            let article = null;
            if ('article' in data && data['article']) {
                article = data['article'];
            }
            const baseURI = data['baseURI'];
            recrun(article, baseURI);
        } else if (method === 'updateOptions') {
            // reset saved state, so the next call will re-fetch
            options = data;
        } else if (method === 'keydownscroll') {
            keydownScroll(data);
        }
    }
};
// the following is for receiving a message from an iframe, not the extension
// background
window.addEventListener('message', receiveMessage, false);

document.addEventListener('DOMContentLoaded', function(event) {
    chrome.runtime.sendMessage({method: 'getOptions'}, function(response) {
        options = response;
        sendMsg('ready', null);
    });
});
