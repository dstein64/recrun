let curTimer = null;
const statusMessage = function(message, time) {
    time = (typeof time === 'undefined') ? 1500 : time;
    const element = document.getElementById('status');
    if (curTimer)
        clearTimeout(curTimer);
    element.innerText = message;
    curTimer = setTimeout(function () {
        element.innerText = '';
        curTimer = null;
    }, time);
};

const backgroundPage = chrome.extension.getBackgroundPage();

const useDiffbot = document.getElementById('useDiffbot-checkbox');

// enable Diffbot settings when 'Use Diffbot' is selected
// disable Diffbot settings otherwise
const diffbotToggle = function() {
    const diffbotSettings = document.getElementById('diffbot-settings');
    const tokenInput = document.getElementById('token');
    const diffbotHtmlCheckbox = document.getElementById('diffbotHtml-checkbox');
    if (useDiffbot.checked) {
        diffbotSettings.classList.remove('disabled');
        tokenInput.disabled = false;
        diffbotHtmlCheckbox.disabled = false;
        if (!tokenInput.value) {
            tokenInput.focus();
        }
    } else {
        diffbotSettings.classList.add('disabled');
        tokenInput.disabled = true;
        diffbotHtmlCheckbox.disabled = true;
    }
};

useDiffbot.addEventListener('change', diffbotToggle);

const checkboxes = ['media', 'diffbotHtml', 'useDiffbot'];

const saveOptions = function() {
    const options = Object.create(null);

    const tokenInput = document.getElementById('token').value;
    // trim since Diffbot tokens don't have spaces on the edge
    options['token'] = tokenInput.trim();

    for (let i = 0; i < checkboxes.length; i++) {
        const checkbox = checkboxes[i];
        options[checkbox] = document.getElementById(checkbox + '-checkbox').checked;
    }

    chrome.storage.local.set({options: options});
};

const loadOptions = function(opts) {
    const token = opts['token'];
    const tokenInput = document.getElementById('token');
    tokenInput.value = token;

    for (const checkbox of checkboxes) {
        const e = document.getElementById(checkbox + '-checkbox');
        e.checked = opts[checkbox];
    }

    // onchange won't fire when setting 'checked' with javascript,
    // so trigger diffbotToggle manually
    diffbotToggle();

    // onchange/oninput won't fire when loading options with javascript,
    // so trigger saveOptions manually
    saveOptions();
};

// restore saved options
document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.local.get(['options'], function(result) {
        const initOpts = result.options;
        // Restore saved options.
        loadOptions(initOpts);

        // Load default options.
        document.getElementById('defaults').addEventListener('click', function() {
            const defaults = backgroundPage.defaultOptions();
            loadOptions(defaults);
            statusMessage('Defaults Loaded', 1200);
        });

        document.getElementById('revert').addEventListener('click', function() {
            loadOptions(initOpts);
            statusMessage('Options Reverted', 1200);
        });
    });
});

// save options on any user input
(function() {
    const inputs = document.getElementsByTagName('input');
    for (const input of inputs) {
        // could handle each type separately to avoid multiple handlings
        // a text box will be handled by oninput on each character and onchange
        // when removing focus.
        // but this is fine for now.
        input.addEventListener('change', saveOptions);
        input.addEventListener('input', saveOptions);
    }
})();

// decouple label for touch devices, since clicking shows the tooltip.
(function() {
    if (window.matchMedia('(pointer: coarse)').matches) {
        let labels = document.getElementsByTagName('label');
        for (const label of labels) {
            if (label.querySelector('.tooltip'))
                label.removeAttribute('for');
        }
    }
})();

// version
document.getElementById('version').innerText = backgroundPage.getVersion();
