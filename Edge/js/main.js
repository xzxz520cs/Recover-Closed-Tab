// 标记图标是否已初始化，防止重复初始化
let iconInitialized = false;

// 存储打开的标签页ID与其URL和标题的映射
let openTabsMap = {};

// 存储已关闭的标签页信息列表
let closedTabsList = [];

// 已关闭标签页的存储键名
const CLOSED_TABS_STORAGE_KEY = "closedTabs";

// 打开标签页的存储键名
const OPEN_TABS_STORAGE_KEY = "openTabs";

// 版本存储键名
const EXTENSION_VERSION_KEY = "extensionVersion";

// 标记是否正在创建上下文菜单
let isCreatingContextMenu = false;
let pendingCreateContextMenu = false;

// 默认设置
const defaultSettings = {
    restoreMethod: 'sessions',
    restoreToEnd: true,
    useOldMethodInIncognito: true,
    localsave19: null,
    localsave38: null,
    showAdvertising: true,
    maxClosedTabs: 1000,
    enableContextMenu: true,
    maxListItems: 25,
    clearHistoryOnInit: false
};

// 初始化函数
function initialize() {
    if (iconInitialized) return; // 防止重复初始化
    iconInitialized = true;

    // 初始化设置
    initializeSettings();

    // 从本地存储中获取已保存的图标数据和设置
    chrome.storage.local.get({ localsave19: null, localsave38: null, enableContextMenu: true }, function (data) {
        if (!(data.localsave19 && data.localsave38)) {
            console.log("未找到保存的图标数据。");
        } else {
            console.log("设置已保存的扩展图标。");

            // 创建 ImageData 对象
            const imageData19 = new ImageData(new Uint8ClampedArray(data.localsave19), 19, 19);
            const imageData38 = new ImageData(new Uint8ClampedArray(data.localsave38), 38, 38);

            // 设置扩展程序图标
            chrome.action.setIcon({
                imageData: {
                    "19": imageData19,
                    "38": imageData38
                }
            });
        }

        // 设置扩展程序标题
        updateActionTitle(data.enableContextMenu);

        // 根据enableContextMenu的值创建或移除上下文菜单
        if (data.enableContextMenu) {
            createContextMenu();
        } else {
            chrome.contextMenus.removeAll();
        }
    });

    // 获取已保存的已关闭标签页列表
    chrome.storage.local.get(CLOSED_TABS_STORAGE_KEY, function (data) {
        closedTabsList = data[CLOSED_TABS_STORAGE_KEY] || [];
    });

    // 获取已保存的打开标签页映射
    chrome.storage.local.get(OPEN_TABS_STORAGE_KEY, function (data) {
        openTabsMap = data[OPEN_TABS_STORAGE_KEY] || {};
    });

    // 在初始化时比较存储的打开标签页和当前打开的标签页，用于将浏览器关闭时关闭的标签页在浏览器打开时放入已关闭标签页列表中
    compareTabsAndUpdateClosedList();

    // 检查是否需要在初始化时清空历史记录
    chrome.storage.local.get(['clearHistoryOnInit', 'restoreMethod'], function (data) {
        if (data.clearHistoryOnInit && data.restoreMethod === 'old') {
            closedTabsList = []; // 清空已关闭标签页列表
            saveClosedTabsData(); // 保存更新后的已关闭标签页数据
        }
    });
}

// 添加一个函数，根据 enableContextMenu 状态更新扩展程序标题
function updateActionTitle(enableContextMenu) {
    const titleKey = enableContextMenu ? 'title' : 'title_no_context_menu';
    chrome.action.setTitle({ 'title': chrome.i18n.getMessage(titleKey) });
}

// 初始化设置函数
function initializeSettings() {
    // 获取当前扩展版本
    const currentVersion = chrome.runtime.getManifest().version;

    chrome.storage.local.get(Object.keys(defaultSettings).concat(EXTENSION_VERSION_KEY), function (items) {
        let settingsToSet = {};

        // 检查扩展的版本
        const savedVersion = items[EXTENSION_VERSION_KEY];

        if (savedVersion !== currentVersion) {
            console.log(`检测到扩展已从版本 ${savedVersion || '旧版本'} 升级到 ${currentVersion}`);

            // 进行版本迁移处理
            handleVersionUpgrade(savedVersion, currentVersion, items, settingsToSet);
        }

        // 设置默认值
        for (let key in defaultSettings) {
            if (!items.hasOwnProperty(key) || items[key] === undefined || items[key] === null) {
                settingsToSet[key] = defaultSettings[key];
            }
        }

        // 保存扩展的当前版本号
        settingsToSet[EXTENSION_VERSION_KEY] = currentVersion;

        if (Object.keys(settingsToSet).length > 0) {
            chrome.storage.local.set(settingsToSet, function () {
                console.log("默认设置已初始化或已更新。");
            });
        }
    });
}

// 处理版本升级的函数
function handleVersionUpgrade(savedVersion, currentVersion, items, settingsToSet) {
    // 如果之前没有保存版本号，表示从旧版本升级
    if (!savedVersion) {
        // 检查用户是否进行了设置
        if (items.hasOwnProperty('restoreMethod')) {
            // 用户进行了设置，保留用户设置
            console.log("检测到用户已有设置，保留用户的设置。");
        } else {
            // 用户没有进行过设置，按照新版本的默认设置
            console.log("用户未进行过设置，使用新版本的默认设置。");
            settingsToSet['restoreMethod'] = defaultSettings['restoreMethod'];
            settingsToSet['restoreToEnd'] = defaultSettings['restoreToEnd'];
            settingsToSet['maxClosedTabs'] = defaultSettings['maxClosedTabs'];
            settingsToSet['maxListItems'] = defaultSettings['maxListItems'];
            settingsToSet['enableContextMenu'] = defaultSettings['enableContextMenu'];
            settingsToSet['clearHistoryOnInit'] = defaultSettings['clearHistoryOnInit'];
        }
    }
}

// 确保在扩展启动时执行初始化函数
initialize();

// 添加事件监听器，在启动和安装时执行初始化
chrome.runtime.onStartup.addListener(initialize);
chrome.runtime.onInstalled.addListener(initialize);

// 监听标签页创建和更新事件，执行初始化（这是必要的）
chrome.tabs.onCreated.addListener(initialize);
chrome.tabs.onUpdated.addListener(initialize);

// 监听存储变化，更新上下文菜单
chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName === 'local') {
        if ('enableContextMenu' in changes) {
            // 当enableContextMenu变化时，更新标题和上下文菜单
            chrome.storage.local.get({ enableContextMenu: true }, function (data) {
                updateActionTitle(data.enableContextMenu); // 更新扩展程序标题
                if (data.enableContextMenu) {
                    createContextMenu();
                } else {
                    chrome.contextMenus.removeAll();
                }
            });
        } else if ('maxListItems' in changes || 'restoreMethod' in changes || 'useOldMethodInIncognito' in changes) {
            // 当其他相关设置变化时，只更新上下文菜单
            chrome.storage.local.get({ enableContextMenu: true }, function (data) {
                if (data.enableContextMenu) {
                    createContextMenu();
                }
            });
        }
    }
});


chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'clearClosedTabsList') {
        closedTabsList = [];
        saveClosedTabsData();

        // 更新上下文菜单
        chrome.storage.local.get({ enableContextMenu: true }, function (data) {
            if (data.enableContextMenu) {
                createContextMenu();
            }
        });

        sendResponse({ result: 'success' });
    }
});

// 获取最大已关闭标签页的存储数量
function getMaxClosedTabsCount(callback) {
    chrome.storage.local.get({ maxClosedTabs: 1000 }, function (data) {
        let count = data.maxClosedTabs;
        if (typeof count !== 'number' || isNaN(count)) {
            count = 1000;
        }
        callback(count);
    });
}

// 当点击扩展程序图标时，恢复最近关闭的标签页或窗口
chrome.action.onClicked.addListener(function (tab) {
    initialize();
    chrome.storage.local.get({
        'restoreMethod': 'sessions',
        'restoreToEnd': true,
        'useOldMethodInIncognito': true // 获取新选项
    }, function (result) {
        let restoreMethod = result.restoreMethod || 'sessions';
        let restoreToEnd = result.restoreToEnd;
        let useOldMethodInIncognito = result.useOldMethodInIncognito;

        // 检测是否在无痕模式下
        chrome.windows.get(tab.windowId, function (window) {
            if (window.incognito && useOldMethodInIncognito && restoreMethod === 'sessions') {
                // 如果在无痕模式下，并且启用设置，则切换为 'old' 方法
                restoreMethod = 'old';
            }

            if (restoreMethod === 'sessions') {
                // 使用 chrome.sessions API 恢复
                chrome.sessions.getRecentlyClosed({ maxResults: 1 }, function (sessions) {
                    if (sessions.length === 0) return;

                    let session = sessions[0];
                    if (session.tab) {
                        // 恢复标签页
                        chrome.sessions.restore(session.tab.sessionId, function (restoredSession) {
                            if (restoreToEnd && restoredSession?.tab?.id) {
                                // 将标签页移动到末尾并激活
                                chrome.tabs.move(restoredSession.tab.id, { index: -1 }, function () {
                                    chrome.tabs.update(restoredSession.tab.id, { active: true });
                                });
                            }
                            // 更新上下文菜单
                            chrome.storage.local.get({ enableContextMenu: true }, function (data) {
                                if (data.enableContextMenu) {
                                    createContextMenu();
                                }
                            });
                        });
                    } else if (session.window) {
                        // 恢复窗口
                        chrome.sessions.restore(session.window.sessionId);
                    }
                });
            } else if (restoreMethod === 'old') {
                // 使用自定义方法恢复
                let lastClosedTab = closedTabsList.pop();
                if (!lastClosedTab) return;

                let lastClosedTabUrl = lastClosedTab.url;

                if (lastClosedTabUrl.startsWith('file://')) {
                    // 打开无法直接访问的本地文件页面
                    chrome.tabs.create({
                        url: chrome.runtime.getURL('unreachable.html') + '?fileUrl=' + encodeURIComponent(lastClosedTabUrl)
                    });
                } else {
                    // 创建新标签页
                    chrome.tabs.create({ url: lastClosedTabUrl }, function (newTab) {
                        if (restoreToEnd) {
                            chrome.tabs.move(newTab.id, { index: -1 }, function () {
                                chrome.tabs.update(newTab.id, { active: true });
                            });
                        }
                    });
                }

                saveClosedTabsData(); // 保存更新后的已关闭标签页数据
            }
        });
    });
});

// 添加快捷键命令监听
chrome.commands.onCommand.addListener(function (command) {
    if (command.startsWith('activate_extension_')) {
        // 获取当前活动标签页
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs.length > 0) {
                // 调用与点击事件相同的处理逻辑
                chrome.action.onClicked.dispatch(tabs[0]);
            }
        });
    }
});

// 监听标签页创建事件
chrome.tabs.onCreated.addListener(function (tab) {
    if (tab.url && tab.url !== 'chrome://newtab/' && tab.url !== 'about:blank') {
        openTabsMap[tab.id] = { url: tab.url, title: tab.title };
        saveOpenTabsData();
    }
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (tab.url && tab.url !== 'chrome://newtab/' && tab.url !== 'about:blank') {
        openTabsMap[tabId] = { url: tab.url, title: tab.title };
        saveOpenTabsData();
    }
});

// 重新打开已关闭的标签页
function reopenClosedTab(tabInfo, index) {
    chrome.storage.local.get({ 'restoreMethod': 'old', 'restoreToEnd': true, 'useOldMethodInIncognito': true }, function (result) {
        let restoreMethod = result.restoreMethod || 'old';
        let restoreToEnd = result.restoreToEnd;
        let useOldMethodInIncognito = result.useOldMethodInIncognito;

        // 检测无痕模式
        let isIncognito = chrome.extension.inIncognitoContext;
        if (isIncognito && useOldMethodInIncognito && restoreMethod === 'sessions') {
            restoreMethod = 'old';
        }

        if (restoreMethod === 'old') {
            if (tabInfo.url.startsWith('file://')) {
                chrome.tabs.create({
                    url: chrome.runtime.getURL('unreachable.html') + '?fileUrl=' + encodeURIComponent(tabInfo.url)
                });
            } else {
                chrome.tabs.create({ url: tabInfo.url }, function (newTab) {
                    if (restoreToEnd) {
                        chrome.tabs.move(newTab.id, { index: -1 }, function () {
                            chrome.tabs.update(newTab.id, { active: true });
                        });
                    }
                });
            }

            // 从列表中移除已打开的标签页
            closedTabsList.splice(index, 1);
            saveClosedTabsData();

            // 更新上下文菜单
            chrome.storage.local.get({ enableContextMenu: true }, function (data) {
                if (data.enableContextMenu) {
                    createContextMenu();
                }
            });
        } else {
            console.log("无法在无痕模式下使用 'sessions' 方法恢复标签页");
        }
    });
}

// 记录标签页关闭事件
chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
    const closedTabInfo = openTabsMap[tabId];
    if (closedTabInfo && closedTabInfo.url && closedTabInfo.url !== 'chrome://newtab/' && closedTabInfo.url !== 'about:blank' && !closedTabInfo.url.includes('unreachable.html')) {
        closedTabsList.push(closedTabInfo);
    }
    delete openTabsMap[tabId];

    saveClosedTabsData();
    saveOpenTabsData();
});

// 保存已关闭的标签页数据到本地存储
function saveClosedTabsData() {
    getMaxClosedTabsCount(function (MAX_CLOSED_TABS_COUNT) {
        if (MAX_CLOSED_TABS_COUNT !== 0) {
            if (closedTabsList.length > MAX_CLOSED_TABS_COUNT) {
                closedTabsList.splice(0, closedTabsList.length - MAX_CLOSED_TABS_COUNT);
            }
        } else {
            closedTabsList = []; // 清空列表
        }
        chrome.storage.local.set({ [CLOSED_TABS_STORAGE_KEY]: closedTabsList }, function () {
            if (chrome.runtime.lastError) {
                console.error("保存已关闭标签页数据时出错：" + chrome.runtime.lastError.message);
            } else {
                // 更新上下文菜单
                chrome.storage.local.get({ enableContextMenu: true }, function (data) {
                    if (data.enableContextMenu) {
                        createContextMenu();
                    }
                });
            }
        });
    });
}

// 保存打开的标签页数据到本地存储
function saveOpenTabsData() {
    chrome.storage.local.set({ [OPEN_TABS_STORAGE_KEY]: openTabsMap }, function () {
        if (chrome.runtime.lastError) {
            console.error("保存打开标签页数据时出错：" + chrome.runtime.lastError.message);
        }
    });
}

// 创建上下文菜单
function createContextMenu() {
    if (isCreatingContextMenu) {
        pendingCreateContextMenu = true;
        return;
    }
    isCreatingContextMenu = true;
    pendingCreateContextMenu = false;

    chrome.contextMenus.removeAll(function () {
        chrome.storage.local.get({
            'restoreMethod': 'sessions',
            'maxListItems': 100,
            'enableContextMenu': true,
            'useOldMethodInIncognito': true // 获取新选项
        }, function (result) {
            let restoreMethod = result.restoreMethod || 'sessions';
            let maxListItems = result.maxListItems || 100;
            let enableContextMenu = result.enableContextMenu;
            let useOldMethodInIncognito = result.useOldMethodInIncognito;

            // 使用 chrome.extension.inIncognitoContext 检测无痕模式
            let isIncognito = chrome.extension.inIncognitoContext;
            if (isIncognito && useOldMethodInIncognito && restoreMethod === 'sessions') {
                // 如果在无痕模式下，并且启用设置，则切换为 'old' 方法
                restoreMethod = 'old';
            }

            if (enableContextMenu) {
                // 创建 '最近关闭的标签页' 父菜单项
                chrome.contextMenus.create({
                    id: 'recentlyClosedTabs',
                    title: chrome.i18n.getMessage('recently_closed_tabs'),
                    contexts: ['action']
                });

                // 如果 restoreMethod 是 'old'，则添加 '清除扩展中的历史记录' 功能
                if (restoreMethod === 'old') {
                    chrome.contextMenus.create({
                        id: 'clearExtensionHistory',
                        title: chrome.i18n.getMessage('clear_extension_history'),
                        contexts: ['action']
                    });
                }

                if (restoreMethod === 'sessions') {
                    // 使用 chrome.sessions API 获取最近关闭的会话
                    chrome.sessions.getRecentlyClosed({ maxResults: Math.min(maxListItems, 25) }, function (sessions) {
                        sessions.forEach(function (session, index) {
                            if (session.tab) {
                                let tab = session.tab;
                                let title = tab.title || tab.url;
                                let sessionId = tab.sessionId;
                                chrome.contextMenus.create({
                                    id: 'sessionTab_' + sessionId,
                                    parentId: 'recentlyClosedTabs',
                                    title: title,
                                    contexts: ['action']
                                });
                            } else if (session.window) {
                                let windowSessionId = session.window.sessionId;
                                let windowTabs = session.window.tabs;
                                let title = windowTabs && windowTabs.length > 0 ?
                                    chrome.i18n.getMessage('closed_window_with_count_and_title', [windowTabs.length, windowTabs[0].title || windowTabs[0].url]) :
                                    chrome.i18n.getMessage('closed_window');

                                chrome.contextMenus.create({
                                    id: 'sessionWindow_' + windowSessionId,
                                    parentId: 'recentlyClosedTabs',
                                    title: title,
                                    contexts: ['action']
                                });
                            }
                        });

                        isCreatingContextMenu = false;
                        if (pendingCreateContextMenu) {
                            createContextMenu();
                        }
                    });
                } else if (restoreMethod === 'old') {
                    // 使用自定义列表
                    let numTabsToShow = Math.min(closedTabsList.length, maxListItems);
                    for (let i = closedTabsList.length - 1; i >= closedTabsList.length - numTabsToShow; i--) {
                        let tabInfo = closedTabsList[i];
                        let title = tabInfo.title || tabInfo.url; // 如果没有标题，使用URL
                        chrome.contextMenus.create({
                            id: 'closedTab_' + i,
                            parentId: 'recentlyClosedTabs',
                            title: title,
                            contexts: ['action']
                        });
                    }

                    isCreatingContextMenu = false;
                    if (pendingCreateContextMenu) {
                        createContextMenu();
                    }
                } else {
                    isCreatingContextMenu = false;
                    if (pendingCreateContextMenu) {
                        createContextMenu();
                    }
                }
            } else {
                isCreatingContextMenu = false;
                if (pendingCreateContextMenu) {
                    createContextMenu();
                }
            }
        });
    });
}

// 监听上下文菜单点击事件
chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId.startsWith('sessionTab_')) {
        let sessionId = info.menuItemId.substring('sessionTab_'.length);

        chrome.storage.local.get({ 'restoreToEnd': true, 'useOldMethodInIncognito': true }, function (result) {
            let restoreToEnd = result.restoreToEnd;
            let useOldMethodInIncognito = result.useOldMethodInIncognito;

            let restoreMethod = 'sessions';
            // 使用 chrome.extension.inIncognitoContext 检测无痕模式
            let isIncognito = chrome.extension.inIncognitoContext;
            if (isIncognito && useOldMethodInIncognito) {
                restoreMethod = 'old';
            }

            if (restoreMethod === 'sessions') {
                chrome.sessions.restore(sessionId, function (restoredSession) {

                    if (restoreToEnd && restoredSession?.tab?.id) {
                        chrome.tabs.move(restoredSession.tab.id, { index: -1 }, function () {
                            chrome.tabs.update(restoredSession.tab.id, { active: true });
                        });
                    }
                    // 更新上下文菜单
                    chrome.storage.local.get({ enableContextMenu: true }, function (data) {
                        if (data.enableContextMenu) {
                            createContextMenu();
                        }
                    });
                });
            } else if (restoreMethod === 'old') {
                // 使用自定义方法恢复
                let index = parseInt(info.menuItemId.split('_')[1]);
                let tabInfo = closedTabsList[index];
                reopenClosedTab(tabInfo, index);
            }
        });
    } else if (info.menuItemId.startsWith('closedTab_')) {
        let index = parseInt(info.menuItemId.split('_')[1]);
        let tabInfo = closedTabsList[index];
        reopenClosedTab(tabInfo, index);
    } else if (info.menuItemId.startsWith('sessionWindow_')) {
        let sessionId = info.menuItemId.substring('sessionWindow_'.length);

        chrome.storage.local.get({ 'useOldMethodInIncognito': true }, function (result) {
            let useOldMethodInIncognito = result.useOldMethodInIncognito;

            let restoreMethod = 'sessions';
            // 使用 chrome.extension.inIncognitoContext 检测无痕模式
            let isIncognito = chrome.extension.inIncognitoContext;
            if (isIncognito && useOldMethodInIncognito) {
                restoreMethod = 'old';
            }
            if (restoreMethod === 'sessions') {
                chrome.sessions.restore(sessionId, function () {
                    // 恢复窗口后更新上下文菜单
                    chrome.storage.local.get({ enableContextMenu: true }, function (data) {
                        if (data.enableContextMenu) {
                            createContextMenu();
                        }
                    });
                });
            } else if (restoreMethod === 'old') {
                // 无法恢复窗口，可能需要提示用户
                console.log("无法在无痕模式下使用 'sessions' 恢复窗口");
            }
        });
    } else if (info.menuItemId === 'clearExtensionHistory') {
        console.log('Clearing extension history');
        // 清除扩展中的已关闭标签页历史记录
        closedTabsList = [];
        saveClosedTabsData();

        // 更新上下文菜单
        createContextMenu();
    }
});

// 在初始化时比较存储的打开标签页和当前打开的标签页
function compareTabsAndUpdateClosedList() {
    chrome.tabs.query({}, function (currentTabs) {
        // 创建一个当前打开标签页的 URL 集合
        let currentTabUrls = new Set(currentTabs.map(tab => tab.url));

        // 遍历存储的打开标签页，找出已关闭的标签页
        for (let tabId in openTabsMap) {
            let tabInfo = openTabsMap[tabId];
            if (!currentTabUrls.has(tabInfo.url)) {
                // 标签页已关闭，添加到已关闭标签页列表中
                closedTabsList.push(tabInfo);
            }
        }

        // 保存更新后的已关闭标签页列表
        saveClosedTabsData();

        // 更新 openTabsMap 为当前打开的标签页
        openTabsMap = {};
        currentTabs.forEach(tab => {
            if (tab.url && tab.url !== 'chrome://newtab/' && tab.url !== 'about:blank') {
                openTabsMap[tab.id] = { url: tab.url, title: tab.title };
            }
        });
        saveOpenTabsData();
    });
}

// 获取当前存储使用的大小（用于调试）
function getStorageSize(callback) {
    chrome.storage.local.get(null, function (items) {
        let totalSize = 0;
        for (let key in items) {
            if (items.hasOwnProperty(key)) {
                totalSize += key.length + JSON.stringify(items[key]).length;
            }
        }
        callback(totalSize / (1024 * 1024)); // 转换为 MB
    });
}

// 输出当前存储大小到控制台
getStorageSize(function (sizeMB) {
    console.log("当前存储大小（MB）: " + sizeMB.toFixed(4) + " MB");
});
