// 全局变量，存储当前打开的标签页的 URL
var openTabsUrlMap = {};
const MAX_CLOSED_TABS_COUNT = 1000; // 最大保存关闭标签页数量
const CLOSED_TABS_STORAGE_KEY = "closedTabs"; // 存储关闭标签页的键名
const OPEN_TABS_STORAGE_KEY = "openTabs"; // 存储打开标签页的键名

// 从 Chrome 的本地存储中获取保存的图标数据
chrome.storage.local.get(["localsave19", "localsave38"], function(data) {
    if (data && data.localsave19 && data.localsave38) {
        console.log("设置储存的扩展图标。");

        const imageDataFor19px = new ImageData(new Uint8ClampedArray(data.localsave19), 19, 19);
        const imageDataFor38px = new ImageData(new Uint8ClampedArray(data.localsave38), 38, 38);

        chrome.action.setIcon({
            imageData: {
                "19": imageDataFor19px,
                "38": imageDataFor38px
            }
        });
    } else {
        console.log("没有找到保存的图标数据。");
    }
});

// 从 Chrome 的本地存储中获取关闭的标签页数据
chrome.storage.local.get(CLOSED_TABS_STORAGE_KEY, function(data) {
    if (data && data[CLOSED_TABS_STORAGE_KEY]) {
        closedTabsList = data[CLOSED_TABS_STORAGE_KEY]; // 获取关闭标签页的列表
    } else {
        closedTabsList = []; // 初始化为空数组
    }
});

// 从 Chrome 的本地存储中获取打开的标签页数据
chrome.storage.local.get(OPEN_TABS_STORAGE_KEY, function(data) {
    if (data && data[OPEN_TABS_STORAGE_KEY]) {
        openTabsUrlMap = data[OPEN_TABS_STORAGE_KEY]; // 获取打开标签页的 URL
    } else {
        openTabsUrlMap = {}; // 初始化为空对象
    }
});

// 在 Chrome 启动时执行的监听器
chrome.runtime.onStartup.addListener(function() {
  // 查询当前所有打开的标签页
  chrome.tabs.query({}, function(tabs) {
      let currentTabs = {}; // 用于存储当前实际打开的标签页

      // 遍历每个标签页
      tabs.forEach(tab => {
          // 排除新标签页
          if (tab.url !== 'chrome://newtab/') {
              currentTabs[tab.id] = tab.url; // 将非新标签页的 URL 存入 currentTabs
          }
      });

      // 遍历 openTabsUrlMap 中记录的标签页
      for (let id in openTabsUrlMap) {
          // 如果当前打开的标签页不包含 openTabsUrlMap 中的 URL
          if (!Object.values(currentTabs).includes(openTabsUrlMap[id])) {
              closedTabsList.push(openTabsUrlMap[id]); // 将其视为已关闭并加入 closedTabsList
          }
      }

      // 更新 openTabsUrlMap 为当前实际打开的标签页
      openTabsUrlMap = currentTabs;

      saveClosedTabsData(); // 保存关闭标签页数据
      saveOpenTabsData(); // 保存打开标签页数据
  });
});


// 当扩展图标被点击时，打开并删除关闭标签页列表中的最后一个 URL
chrome.action.onClicked.addListener(function () {
    var lastClosedTabUrl = closedTabsList.pop(); // 从列表中取出最后一个 URL
    if (!lastClosedTabUrl) return; // 如果没有 URL，直接返回
    chrome.tabs.create({ url: lastClosedTabUrl }); // 打开新标签页
    saveClosedTabsData(); // 保存更新后的关闭标签页数据
});

// 当新标签页被创建时，将其 URL 存储在 openTabsUrlMap 中
chrome.tabs.onCreated.addListener(function (tab) {
    if (tab['url'] !== 'chrome://newtab/') {
        openTabsUrlMap[tab['id']] = tab['url']; // 记录标签页的 URL
        saveOpenTabsData(); // 保存打开的标签页数据
    }
});

// 当标签页的 URL 更新时，更新 openTabsUrlMap 中对应的 URL
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (tab['url'] !== 'chrome://newtab/') {
        openTabsUrlMap[tab['id']] = tab['url']; // 更新标签页的 URL
        saveOpenTabsData(); // 保存打开的标签页数据
    }
});

// 当标签页被关闭时，将其 URL 添加到 closedTabsList 的末尾
chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
    for (var id in openTabsUrlMap) {
        if (id == tabId) {
            closedTabsList.push(openTabsUrlMap[id]); // 将 URL 添加到关闭列表
            delete openTabsUrlMap[id]; // 从 openTabsUrlMap 中删除记录
            break; // 找到后退出循环
        }
    }
    saveClosedTabsData(); // 保存更新后的关闭标签页数据
    saveOpenTabsData(); // 保存更新后的打开标签页数据
});

// 保存关闭的标签页数据到本地存储
function saveClosedTabsData() {
  if (closedTabsList.length > MAX_CLOSED_TABS_COUNT) {
      closedTabsList.splice(0, closedTabsList.length - MAX_CLOSED_TABS_COUNT); // 删除最早的记录
  }
  chrome.storage.local.set({ [CLOSED_TABS_STORAGE_KEY]: closedTabsList }, function () {
      if (chrome.runtime.lastError) {
          console.error("保存数据时出错: " + chrome.runtime.lastError.message);
      }
  });
}

// 保存打开的标签页数据到本地存储
function saveOpenTabsData() {
  chrome.storage.local.set({ [OPEN_TABS_STORAGE_KEY]: openTabsUrlMap }, function () {
      if (chrome.runtime.lastError) {
          console.error("保存数据时出错: " + chrome.runtime.lastError.message);
      }
  });
}

// 设置扩展的标题
chrome.action.setTitle({ 'title': chrome.i18n.getMessage('title') });

//输出当前储存大小
function getStorageSize(callback) {
  chrome.storage.local.get(null, function(items) {
      let totalSize = 0;
      for (let key in items) {
          if (items.hasOwnProperty(key)) {
              // 计算每个项的大小
              totalSize += key.length + JSON.stringify(items[key]).length;
          }
      }
      // 转换为 MB
      const totalSizeMB = totalSize / (1024 * 1024);
      callback(totalSizeMB);
  });
}

// 使用方法
getStorageSize(function(sizeMB) {
  console.log("当前存储大小（MB）: " + sizeMB.toFixed(2) + " MB");
});