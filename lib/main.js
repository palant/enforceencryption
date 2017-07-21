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
    let uri = document.documentElement.getAttribute("relatedUrl");
    if (!uri)
    {
      Services.tm.currentThread.dispatch(this._applyToWindow.bind(this, window, document),
          Ci.nsIEventTarget.DISPATCH_NORMAL);
      return;
    }

    uri = Services.io.newURI(uri, null, null);
    if (!uri.schemeIs("https"))
      return;

    let rows = document.getElementById("security-privacy-rows");
    if (!rows)
      return;

    let sslStatus = window.opener.gBrowser
                                 .securityUI
                                 .QueryInterface(Ci.nsISSLStatusProvider)
                                 .SSLStatus;

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

    let hbox = row.appendChild(createElement("hbox"));

    let isSecure = this.service.isSecureURI(this.service.HEADER_HSTS, uri, 0);
    let label = hbox.appendChild(createElement("textbox", {
      id: idPrefix + "value",
      class: "fieldValue",
      flex: "1",
      readonly: "true",
      value: this.stringBundle.GetStringFromName(isSecure ? "yes" : "no")
    }));

    let button = hbox.appendChild(createElement("button", {
      id: idPrefix + "buton",
      label: this.stringBundle.GetStringFromName(isSecure ? "stop" : "start")
    }));
    button.addEventListener("command", this.toggleEncryption.bind(this, label, button, uri, sslStatus));

    rows.appendChild(row);
    insertedElements.set(window, row);
  },

  toggleEncryption: function(label, button, uri, sslStatus)
  {
    let isSecure = this.service.isSecureURI(this.service.HEADER_HSTS, uri, 0);
    if (!isSecure)
    {
      const secondsInYear = 365 * 24 * 60 * 60;
      const maxAge = 1000 * secondsInYear;   // sort of "forever"
      if ("SOURCE_UNKNOWN" in this.service)
      {
        // Firefox 56+
        this.service.processHeader(this.service.HEADER_HSTS, uri, "max-age=" + maxAge, sslStatus, 0, this.service.SOURCE_UNKNOWN);
      }
      else
      {
        // Older Firefox versions
        this.service.processHeader(this.service.HEADER_HSTS, uri, "max-age=" + maxAge, sslStatus, 0);
      }
    }
    else
      this.service.removeState(this.service.HEADER_HSTS, uri, 0);

    isSecure = this.service.isSecureURI(this.service.HEADER_HSTS, uri, 0);
    label.value = this.stringBundle.GetStringFromName(isSecure ? "yes" : "no");
    button.label = this.stringBundle.GetStringFromName(isSecure ? "stop" : "start");
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
