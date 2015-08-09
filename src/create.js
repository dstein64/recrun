// create a unique id that won't clash with any other ids on the page.
// doesn't have to be static since we don't refer to the id statically
// (no references in css, etc.).
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

recrunId = createUniqueId();
createOverlay();
