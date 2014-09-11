/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

let {Services} = Cu.import("resource://gre/modules/Services.jsm");

let insertedElements = new WeakMap();

let observer = {
  get stringBundle()
  {
    // Randomize URI to work around bug 719376
    let uri = "chrome://enforceencryption/locale/pageinfo.properties?" + Math.random();
    let result = Services.strings.createBundle(uri);

    delete this.stringBundle;
    return (this.stringBundle = result);
  },

  get service()
  {
    let result = Cc["@mozilla.org/ssservice;1"].getService(Ci.nsISiteSecurityService);

    delete this.service;
    return (this.service = result);
  },

  applyToWindow: function(window)
  {
    let document = window.document;
    if (document.documentElement.getAttribute("windowtype") != "Browser:page-info")
      return;

    // Allow the page info window to handle the load event before continueing,
    // otherwise gWindow variable might be uninitialized.
    Services.tm.currentThread.dispatch(this._applyToWindow.bind(this, window, document),
        Ci.nsIEventTarget.DISPATCH_NORMAL);
  },

  _applyToWindow: function(window, document)
  {
    let content = window.gWindow;
    if (!content || content.location.protocol != "https:")
      return;

    let rows = document.getElementById("security-privacy-rows");
    if (!rows)
      return;

    function createElement(tagName, attributes, textContent)
    {
      let result = document.createElement(tagName);
      for (let key in attributes)
        result.setAttribute(key, attributes[key]);
      if (textContent)
        result.textContent = textContent;
      return result;
    }

    const idPrefix = "security-privacy-enforceencryption-";
    let row = createElement("row", {
      id: idPrefix + "row"
    });

    row.appendChild(createElement("label", {
      id: idPrefix + "label",
      class: "fieldLabel",
      control: idPrefix + "value"
    }, this.stringBundle.GetStringFromName("enforce.label")));

    let uri = Services.io.newURI(content.location.href, null, null);
    let isSecure = this.service.isSecureURI(this.service.HEADER_HSTS, uri, 0);
    let value = row.appendChild(createElement("checkbox", {
      id: idPrefix + "value",
      class: "fieldValue",
      checked: isSecure ? "true" : "false",
      label: this.stringBundle.GetStringFromName(isSecure ? "yes" : "no")
    }));
    value.addEventListener("command", this.toggleEncryption.bind(this, value, uri));

    rows.appendChild(row);
    insertedElements.set(window, row);
  },

  toggleEncryption: function(checkbox, uri)
  {
    if (checkbox.checked)
    {
      const secondsInYear = 365 * 24 * 60 * 60;
      const maxAge = 1000 * secondsInYear;   // sort of "forever"
      this.service.processHeader(this.service.HEADER_HSTS, uri, "max-age=" + maxAge, 0);
    }
    else
      this.service.removeState(this.service.HEADER_HSTS, uri, 0);

    let isSecure = this.service.isSecureURI(this.service.HEADER_HSTS, uri, 0);
    checkbox.checked = isSecure;
    checkbox.label = this.stringBundle.GetStringFromName(isSecure ? "yes" : "no");
  },

  removeFromWindow: function(window)
  {
    let element = insertedElements.get(window);
    if (typeof element != "undefined" && element.parentNode)
      element.parentNode.removeChild(element);
  }
};

let {WindowObserver} = require("windowObserver");
new WindowObserver(observer, "load");
