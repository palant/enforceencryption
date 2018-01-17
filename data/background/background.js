/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

const secondsInYear = 365 * 24 * 60 * 60;
const maxAge = 1000 * secondsInYear;   // sort of "forever"

let api = function()
{
  if (window.browser)
  {
    try
    {
      window.browser.tabs.get(0).catch(error => void 0);
      return window.browser;
    }
    catch (e)
    {
      // Browser API in IE expects callbacks
    }
  }

  let sourceAPI = window.browser || window.chrome;

  function promisify(method, numArgs, ...args)
  {
    return new Promise((resolve, reject) =>
    {
      if (args.length != numArgs)
      {
        throw new Error("Unexpected number of arguments: got " + args.length +
                        ", expected " + numArgs);
      }

      this[method](...args, result =>
      {
        if (sourceAPI.runtime.lastError)
          reject(sourceAPI.runtime.lastError.message);
        else
          resolve(result);
      });
    });
  }

  return {
    i18n: sourceAPI.i18n,
    tabs: {
      get: promisify.bind(sourceAPI.tabs, "get", 1),
      query: promisify.bind(sourceAPI.tabs, "query", 1),
      onCreated: sourceAPI.tabs.onCreated,
      onUpdated: sourceAPI.tabs.onUpdated,
      onReplaced: sourceAPI.tabs.onReplaced
    },
    webRequest: {
      onBeforeSendHeaders: sourceAPI.webRequest.onBeforeSendHeaders,
      onHeadersReceived: sourceAPI.webRequest.onHeadersReceived
    },
    webNavigation: {
      onCommitted: sourceAPI.webNavigation.onCommitted
    },
    pageAction: {
      show: sourceAPI.pageAction.show,
      hide: sourceAPI.pageAction.hide,
      setTitle: sourceAPI.pageAction.setTitle,
      getTitle: promisify.bind(sourceAPI.pageAction, "getTitle", 1),
      setIcon: promisify.bind(sourceAPI.pageAction, "setIcon", 1),
      onClicked: sourceAPI.pageAction.onClicked
    },
    runtime: sourceAPI.runtime
  };
}();

function checkStatus(tabId)
{
  let url;
  let seenRequest = false;
  let seenSecure = true;

  let listener = function(details)
  {
    seenRequest = true;
    if (seenSecure && !details.url.startsWith("https://"))
      seenSecure = false;
    return {
      cancel: true
    };
  };

  return api.tabs.get(tabId).then(tab =>
  {
    url = tab.url;
    if (!url.startsWith("https://"))
      return Promise.reject("wrong-scheme");

    let urlObj = new URL(url);
    urlObj.hash = "";
    urlObj.search = "?_enforce_encryption_" + Math.random();
    let secureUrl = urlObj.toString();

    urlObj.protocol = "http:";
    let originalUrl = urlObj.toString();
    api.webRequest.onBeforeSendHeaders.addListener(listener, {
      tabId: -1,
      urls: [originalUrl, secureUrl],
      // Firefox misreports fetch requests as "other"
      types: ["xmlhttprequest", "other"]
    }, ["blocking", "requestHeaders"]);
    return window.fetch(originalUrl).catch(error =>
    {
      // Ignore fetch error, this request isn't supposed to succeed
    });
  }).then(() =>
  {
    api.webRequest.onBeforeSendHeaders.removeListener(listener);
    if (!seenRequest)
      return Promise.reject(new Error("Unexpected: Enforce Encryption didn't receive the test request it triggered"));

    return api.tabs.get(tabId);
  }).then(tab =>
  {
    if (tab.url != url)
      return Promise.reject("url-changed");

    return seenSecure;
  });
}

let title_locked = api.i18n.getMessage("stop");
let icon_locked = {
  16: "data/images/locked16.png",
  20: "data/images/locked20.png",
  24: "data/images/locked24.png",
  25: "data/images/locked25.png",
  30: "data/images/locked30.png",
  32: "data/images/locked32.png",
  40: "data/images/locked40.png"
};

let title_unlocked = api.i18n.getMessage("start");
let icon_unlocked = {
  16: "data/images/unlocked16.png",
  20: "data/images/unlocked20.png",
  24: "data/images/unlocked24.png",
  25: "data/images/unlocked25.png",
  30: "data/images/unlocked30.png",
  32: "data/images/unlocked32.png",
  40: "data/images/unlocked40.png"
};

function updateStatus(tabId)
{
  checkStatus(tabId).then(hasHSTS =>
  {
    api.pageAction.show(tabId);
    api.pageAction.setTitle({tabId, title: hasHSTS ? title_locked : title_unlocked});
    return api.pageAction.setIcon({tabId, path: hasHSTS ? icon_locked : icon_unlocked});
  }).catch(error =>
  {
    if (typeof error == "string")
    {
      // Internal error message, ignore
      return;
    }
    console.error(error);
  });
}

api.tabs.query({}).then(tabs =>
{
  for (let tab of tabs)
    updateStatus(tab.id);
}).catch(error => console.error(error));

api.tabs.onReplaced.addListener((addedTabId, removedTabId) =>
{
  updateStatus(addedTabId);
});

api.webNavigation.onCommitted.addListener(details =>
{
  if (details.frameId != 0)
    return;

  updateStatus(details.tabId);
});

api.pageAction.onClicked.addListener(tab =>
{
  let url = tab.url;
  if (!tab.url.startsWith("https://"))
    return;

  api.pageAction.getTitle({tabId: tab.id}).then(title =>
  {
    return title == title_locked;
  }).then(hasHSTS =>
  {
    function listener(details)
    {
      let headers = details.responseHeaders || [];
      headers.push({
        name: "Strict-Transport-Security",
        value: "max-age=" + (hasHSTS ? 0 : maxAge)
      });
      return {responseHeaders: headers};
    }

    api.webRequest.onHeadersReceived.addListener(listener, {
      urls: [url],
      types: ["xmlhttprequest"]
    }, ["responseHeaders", "blocking"]);
    return window.fetch(url, {
      method: "HEAD",
      cache: "force-cache"
    }).catch(error =>
    {
      // Ignore errors
    }).then(() =>
    {
      api.webRequest.onHeadersReceived.removeListener(listener);
    });
  }).then(() =>
  {
    updateStatus(tab.id);
  });
});
