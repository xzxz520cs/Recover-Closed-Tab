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

// ⚠️ 关于无痕模式（manifest 中 "incognito": "split"）：
// 常规与无痕是【两个独立的扩展实例】（共享同一份 chrome.storage），但 Chromium 的
// MenuManager 是 ProfileSelections(kRedirectedToOriginal)——两个实例共用同一个菜单管理器。
// chrome.contextMenus.create/update/remove 的 id 带「是否无痕」标记，只作用于本实例；
// 但 removeAll() 是按扩展 id 清空整张表、不区分上下文，会把另一个实例的菜单项一起删掉，
// 导致那个窗口的扩展菜单整块消失（要等到在那个窗口关一次标签才重建）。
// 因此本文件【绝不使用 removeAll】，改为只清除本实例自己创建的菜单项。
function isIncognitoContext() {
    return !!chrome.extension.inIncognitoContext;
}

// 菜单项 id 记录键：按上下文分开存，避免两个实例互相覆盖
function getMenuIdsStorageKey() {
    return isIncognitoContext() ? 'menuItemIds_incognito' : 'menuItemIds_regular';
}

// 读取并清空 chrome.runtime.lastError（避免 Unchecked runtime.lastError 刷屏）
function takeLastErrorMessage() {
    const error = chrome.runtime.lastError;
    return error && error.message ? error.message : '';
}

// 清除本上下文创建的菜单项（不使用 removeAll，原因见上）
function clearOwnMenuItems(callback) {
    const storageKey = getMenuIdsStorageKey();
    chrome.storage.local.get({ [storageKey]: [] }, function (data) {
        const message = takeLastErrorMessage();
        if (message) {
            console.warn('读取右键菜单项记录失败：' + message);
        }
        const ids = Array.isArray(data[storageKey]) ? data[storageKey] : [];
        if (ids.length === 0) {
            callback();
            return;
        }
        let remaining = ids.length;
        ids.forEach(function (id) {
            chrome.contextMenus.remove(id, function () {
                const errorMessage = takeLastErrorMessage();
                // 项不存在（例如无痕 profile 已被 Chromium 自动清理）属正常情况
                if (errorMessage && !/cannot find menu item/i.test(errorMessage)) {
                    console.warn('移除右键菜单项失败（' + id + '）：' + errorMessage);
                }
                remaining--;
                if (remaining <= 0) callback();
            });
        });
    });
}

// 保存本上下文创建的菜单项 id 列表（供下次清理使用）
function saveOwnMenuIds(ids) {
    chrome.storage.local.set({ [getMenuIdsStorageKey()]: ids }, function () {
        const message = takeLastErrorMessage();
        if (message) {
            console.warn('保存右键菜单项记录失败：' + message);
        }
    });
}

// 关闭右键菜单功能时：只清理本上下文自己的菜单项
function removeOwnMenuItems() {
    clearOwnMenuItems(function () {
        saveOwnMenuIds([]);
    });
}

// 菜单布局版本：旧版本使用 removeAll + 固定 id，升级后无法枚举旧菜单项，
// 因此每个布局版本做一次（仅常规上下文参与）的一次性清理，并广播给另一个上下文重建。
const MENU_LAYOUT_VERSION = 2;
const MENU_LAYOUT_VERSION_KEY = 'menuLayoutVersion';

// 构建前准备：必要时做一次性迁移清理，然后清除本上下文自己的菜单项
function prepareOwnMenuItems(callback) {
    chrome.storage.local.get({ [MENU_LAYOUT_VERSION_KEY]: 0 }, function (data) {
        const message = takeLastErrorMessage();
        if (message) {
            console.warn('读取右键菜单布局版本失败：' + message);
        }

        if (data[MENU_LAYOUT_VERSION_KEY] < MENU_LAYOUT_VERSION && !isIncognitoContext()) {
            // 仅常规上下文执行唯一一次 removeAll，然后写入新版本号：storage.onChanged
            // 会让两个上下文都重建自己的菜单，所以不会出现“某个窗口菜单消失”的问题。
            chrome.contextMenus.removeAll(function () {
                takeLastErrorMessage();
                chrome.storage.local.set({ [MENU_LAYOUT_VERSION_KEY]: MENU_LAYOUT_VERSION }, function () {
                    const setMessage = takeLastErrorMessage();
                    if (setMessage) {
                        console.warn('写入右键菜单布局版本失败：' + setMessage);
                    }
                    saveOwnMenuIds([]);
                    callback();
                });
            });
            return;
        }

        clearOwnMenuItems(callback);
    });
}

// 创建单个菜单项；若同 id 已存在（旧版本残留等）则退化为 update，保证菜单能建起来
function createContextMenuItem(properties) {
    chrome.contextMenus.create(properties, function () {
        const errorMessage = takeLastErrorMessage();
        if (!errorMessage) return;
        if (!/duplicate id/i.test(errorMessage)) {
            console.warn('创建右键菜单项失败（' + properties.id + '）：' + errorMessage);
            return;
        }
        const patch = { title: properties.title };
        if (properties.contexts) patch.contexts = properties.contexts;
        if (properties.parentId) patch.parentId = properties.parentId;
        if (typeof properties.enabled === 'boolean') patch.enabled = properties.enabled;
        if (typeof properties.visible === 'boolean') patch.visible = properties.visible;
        chrome.contextMenus.update(properties.id, patch, function () {
            const updateMessage = takeLastErrorMessage();
            if (updateMessage) {
                console.warn('更新右键菜单项失败（' + properties.id + '）：' + updateMessage);
            }
        });
    });
}

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
    clearHistoryOnInit: false,
    menuShowTime: true,
    menuTimePosition: 'left',
    menuTimeTwoUnits: false
};

// 初始化函数
function initialize() {
    if (iconInitialized) return; // 防止重复初始化
    iconInitialized = true;

    // 初始化设置
    initializeSettings();

    // 从本地存储中获取已保存的图标数据和设置
    chrome.storage.local.get({ localsave19: null, localsave38: null, iconPreset: null, iconColor: '#adadad', iconColorEnabled: false, enableContextMenu: true }, function (data) {
        if (data.localsave19 && data.localsave38) {
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
        } else if (data.iconPreset && PRESET_ICONS[data.iconPreset]) {
            // 兜底：只有预设+颜色，用 OffscreenCanvas 渲染生成像素
            renderPresetIconInWorker(data.iconPreset, data.iconColor || '#adadad', !!data.iconColorEnabled);
        } else {
            console.log("未找到保存的图标数据。");
        }

        // 设置扩展程序标题
        updateActionTitle(data.enableContextMenu);

        // 根据enableContextMenu的值创建或移除上下文菜单
        if (data.enableContextMenu) {
            createContextMenu();
        } else {
            removeOwnMenuItems();
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
                    removeOwnMenuItems();
                }
            });
        } else if ('maxListItems' in changes || 'restoreMethod' in changes || 'useOldMethodInIncognito' in changes || 'menuShowTime' in changes || 'menuTimePosition' in changes || 'menuTimeTwoUnits' in changes || MENU_LAYOUT_VERSION_KEY in changes) {
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
        // 记录 incognito 标记：两个扩展实例共用一份 openTabsMap，需要区分归属
        openTabsMap[tab.id] = { url: tab.url, title: tab.title, incognito: !!tab.incognito };
        saveOpenTabsData();
    }
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (tab.url && tab.url !== 'chrome://newtab/' && tab.url !== 'about:blank') {
        openTabsMap[tabId] = { url: tab.url, title: tab.title, incognito: !!tab.incognito };
        saveOpenTabsData();
    }
});

// 重新打开已关闭的标签页（对应菜单项 id 为 closedTab_*，数据来自扩展自己记录的历史）
function reopenClosedTab(tabInfo, index) {
    if (!tabInfo) return;

    chrome.storage.local.get({ 'restoreToEnd': true }, function (result) {
        let restoreToEnd = result.restoreToEnd;

        // 说明：tabInfo 来自扩展自己记录的历史，直接打开对应 URL 即可，不再受
        // restoreMethod 影响（无痕上下文的菜单也只可能来自这份历史）。
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

        // 从列表中移除已打开的标签页（索引失效时按对象查找兑底）
        let removeIndex = (typeof index === 'number' && closedTabsList[index] === tabInfo) ?
            index : closedTabsList.indexOf(tabInfo);
        if (removeIndex >= 0) {
            closedTabsList.splice(removeIndex, 1);
        }
        saveClosedTabsData();

        // 更新上下文菜单
        chrome.storage.local.get({ enableContextMenu: true }, function (data) {
            if (data.enableContextMenu) {
                createContextMenu();
            }
        });
    });
}

// 记录标签页关闭事件
chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
    const closedTabInfo = openTabsMap[tabId];
    if (closedTabInfo && closedTabInfo.url && closedTabInfo.url !== 'chrome://newtab/' && closedTabInfo.url !== 'about:blank' && !closedTabInfo.url.includes('unreachable.html')) {
        // 记录关闭时间（毫秒时间戳），用于右键菜单显示相对关闭时间
        closedTabInfo.closedAt = Date.now();
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

// 截断网页名到最大长度（超长时追加省略号）
function truncateTitle(title, maxLength) {
    if (!title) return '';
    if (title.length <= maxLength) return title;
    return title.slice(0, maxLength) + '…';
}

// 将时间戳格式化为相对时间（"x秒前"、"x分钟前"、"x小时前"、"x天前"、"x个月前"、"x年前"）
// timestampMs 为毫秒时间戳；若无效（旧数据/浏览器未提供）返回 null
// twoUnits 为 true 时按两级单位显示（如"3分5秒前"、"1小时2分钟前"），否则仅显示最大单位（如"3分钟前"）
function formatRelativeTime(timestampMs, twoUnits) {
    if (!timestampMs || typeof timestampMs !== 'number' || isNaN(timestampMs)) {
        return null;
    }
    const diffSeconds = Math.floor((Date.now() - timestampMs) / 1000);
    if (diffSeconds < 0) diffSeconds = 0;

    const MINUTE = 60;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;
    const MONTH = 30 * DAY;
    const YEAR = 365 * DAY;

    if (twoUnits) {
        if (diffSeconds < MINUTE) {
            return chrome.i18n.getMessage('menu_seconds_ago', [diffSeconds]);
        } else if (diffSeconds < HOUR) {
            const m = Math.floor(diffSeconds / MINUTE);
            const s = diffSeconds % MINUTE;
            return chrome.i18n.getMessage('menu_two_units_minutes_seconds', [m, s]);
        } else if (diffSeconds < DAY) {
            const h = Math.floor(diffSeconds / HOUR);
            const m = Math.floor((diffSeconds % HOUR) / MINUTE);
            return chrome.i18n.getMessage('menu_two_units_hours_minutes', [h, m]);
        } else if (diffSeconds < MONTH) {
            const d = Math.floor(diffSeconds / DAY);
            const h = Math.floor((diffSeconds % DAY) / HOUR);
            return chrome.i18n.getMessage('menu_two_units_days_hours', [d, h]);
        } else if (diffSeconds < YEAR) {
            const mo = Math.floor(diffSeconds / MONTH);
            const d = Math.floor((diffSeconds % MONTH) / DAY);
            return chrome.i18n.getMessage('menu_two_units_months_days', [mo, d]);
        } else {
            const y = Math.floor(diffSeconds / YEAR);
            const mo = Math.floor((diffSeconds % YEAR) / MONTH);
            return chrome.i18n.getMessage('menu_two_units_years_months', [y, mo]);
        }
    }

    if (diffSeconds < MINUTE) {
        return chrome.i18n.getMessage('menu_seconds_ago', [diffSeconds]);
    } else if (diffSeconds < HOUR) {
        return chrome.i18n.getMessage('menu_minutes_ago', [Math.floor(diffSeconds / MINUTE)]);
    } else if (diffSeconds < DAY) {
        return chrome.i18n.getMessage('menu_hours_ago', [Math.floor(diffSeconds / HOUR)]);
    } else if (diffSeconds < MONTH) {
        return chrome.i18n.getMessage('menu_days_ago', [Math.floor(diffSeconds / DAY)]);
    } else if (diffSeconds < YEAR) {
        return chrome.i18n.getMessage('menu_months_ago', [Math.floor(diffSeconds / MONTH)]);
    } else {
        return chrome.i18n.getMessage('menu_years_ago', [Math.floor(diffSeconds / YEAR)]);
    }
}

// 判断字符是否为全角/宽字符（中文、日文、韩文、全角符号等），宽字符按 2 个单位计
function isFullWidthChar(ch) {
    const code = ch.codePointAt(0);
    return (
        (code >= 0x1100 && code <= 0x115F) || // Hangul Jamo
        (code >= 0x2E80 && code <= 0xA4CF) || // CJK, Hiragana, Katakana
        (code >= 0xAC00 && code <= 0xD7A3) || // Hangul syllables
        (code >= 0xF900 && code <= 0xFAFF) || // CJK compat ideographs
        (code >= 0xFE30 && code <= 0xFE4F) || // CJK compat forms
        (code >= 0xFF00 && code <= 0xFF60) || // fullwidth forms
        (code >= 0xFFE0 && code <= 0xFFE6) || // fullwidth signs
        (code >= 0x20000 && code <= 0x2FA1F)  // CJK ext B
    );
}

// 计算字符串的视觉宽度（单位：普通 ASCII 字符宽度，宽字符记 2）
function menuTitleWidthUnits(str) {
    let units = 0;
    for (const ch of str) {
        units += isFullWidthChar(ch) ? 2 : 1;
    }
    return units;
}

// " · " 分隔符的近似宽度（单位）与字符串
const MENU_SEPARATOR_UNITS = 3;
const MENU_SEPARATOR = ' · ';

// 右对齐固定参数（临时调试项已移除，固定采用以下值）
const MENU_TIME_ALIGN = true;
const MENU_TIME_ALIGN_WIDTH = 44;
const MENU_TIME_SPACE_UNIT = 0.5;

// 防止超出 Chrome 菜单标题长度/像素宽度上限导致末尾时间被截断
const MAX_MENU_TITLE_CHARS = 64;
const MAX_MENU_WIDTH_UNITS = 44;

// 估算某菜单项"标题 + 分隔符 + 时间"的自然总宽度（单位），用于计算对齐目标
function estimateMenuTitleTotalUnits(title, timeStampMs, isSeconds, menuTimeTwoUnits) {
    const MAX_TITLE_LENGTH = 30;
    let name = truncateTitle(title, MAX_TITLE_LENGTH);
    let timeMs = timeStampMs;
    if (isSeconds && typeof timeMs === 'number' && !isNaN(timeMs)) {
        timeMs = timeMs * 1000;
    }
    const relativeTime = formatRelativeTime(timeMs, menuTimeTwoUnits);
    if (relativeTime === null) return menuTitleWidthUnits(name);
    return menuTitleWidthUnits(name) + MENU_SEPARATOR_UNITS + menuTitleWidthUnits(relativeTime);
}

// 计算右对齐时要使用的目标总宽度：取“固定宽度”与“该列表中最长条目自然宽度”的较大值，并限制不超过菜单宽度上限
function computeMenuTimeAlignTarget(items, menuTimeTwoUnits) {
    let target = MENU_TIME_ALIGN_WIDTH;
    let maxTotal = 0;
    items.forEach(function (item) {
        const total = estimateMenuTitleTotalUnits(item.title, item.timeMs, item.isSeconds, menuTimeTwoUnits);
        if (total > maxTotal) maxTotal = total;
    });
    if (maxTotal > target) target = maxTotal;
    if (target > MAX_MENU_WIDTH_UNITS) target = MAX_MENU_WIDTH_UNITS;
    return target;
}

// 构建右键菜单标题："相对时间 · 网页名" 或 "网页名 · 相对时间"（网页名最长30字符）
// timeStampMs 为毫秒时间戳；isSeconds 为 true 时表示 timeStampMs 实际是秒值（sessions 的 lastModified）
// showTime 为 false 时不显示时间；timePosition 为 'right' 时时间在右侧；timeAlignWidth 为目标总宽度（标题 + 分隔符 + 时间，ASCII=1、中文=2）
function buildMenuTitle(title, timeStampMs, isSeconds, showTime, timePosition, timeAlignWidth, menuTimeTwoUnits) {
    const MAX_TITLE_LENGTH = 30;
    let name = truncateTitle(title, MAX_TITLE_LENGTH);

    if (!showTime) return name;

    let timeMs = timeStampMs;
    if (isSeconds && typeof timeMs === 'number' && !isNaN(timeMs)) {
        timeMs = timeMs * 1000;
    }
    const relativeTime = formatRelativeTime(timeMs, menuTimeTwoUnits);
    if (relativeTime === null) return name;

    if (timePosition === 'right') {
        // 让“标题 + 空格 + 分隔符 + 时间”的总宽度对齐到目标，从而时间右缘对齐
        if (MENU_TIME_ALIGN) {
            let targetUnits = parseInt(timeAlignWidth, 10);
            if (isNaN(targetUnits) || targetUnits < 0) targetUnits = 0;
            let spaceUnit = MENU_TIME_SPACE_UNIT;
            if (targetUnits > 0) {
                const titleUnits = menuTitleWidthUnits(name);
                const timeUnits = menuTitleWidthUnits(relativeTime);
                const deficit = targetUnits - titleUnits - MENU_SEPARATOR_UNITS - timeUnits;
                let spaces = Math.round(deficit / spaceUnit);
                // 同时限制“总字符数”和“总视觉宽度（单位）”，避免超出 Chrome 菜单长度/宽度上限导致时间被截断
                const maxSpacesByChars = MAX_MENU_TITLE_CHARS - name.length - MENU_SEPARATOR.length - relativeTime.length;
                const maxSpacesByUnits = Math.floor((MAX_MENU_WIDTH_UNITS - titleUnits - MENU_SEPARATOR_UNITS - timeUnits) / spaceUnit);
                let maxSpaces = Math.min(maxSpacesByChars, maxSpacesByUnits);
                if (maxSpaces < 0) maxSpaces = 0;
                if (spaces > maxSpaces) spaces = maxSpaces;
                if (spaces > 0) {
                    return name + ' '.repeat(spaces) + MENU_SEPARATOR + relativeTime;
                }
            }
        }
        return name + MENU_SEPARATOR + relativeTime;
    }
    return relativeTime + MENU_SEPARATOR + name;
}

// 创建上下文菜单（去抖入口；真正构建见 buildContextMenu）
function createContextMenu() {
    if (isCreatingContextMenu) {
        pendingCreateContextMenu = true;
        return;
    }
    isCreatingContextMenu = true;
    pendingCreateContextMenu = false;

    // 构建前先清理菜单项：正常路径只清本上下文自己的项，升级后首次会做一次性迁移
    // （正常路径不使用 removeAll：split 模式下会把另一个上下文【常规/无痕】创建的
    //  菜单项一起删掉，导致那个窗口的菜单整块消失）
    prepareOwnMenuItems(function () {
        let finished = false;
        // 看门狗：任何异常或遗失的回调都不允许永久卡住菜单重建
        const watchdog = setTimeout(finishBuild, 5000);

        function finishBuild() {
            if (finished) return;
            finished = true;
            clearTimeout(watchdog);
            isCreatingContextMenu = false;
            if (pendingCreateContextMenu) {
                createContextMenu();
            }
        }

        try {
            buildContextMenu(function (createdIds) {
                saveOwnMenuIds(createdIds);
                finishBuild();
            });
        } catch (e) {
            console.warn('构建右键菜单时出错：' + (e && e.message ? e.message : e));
            finishBuild();
        }
    });
}

// 构建菜单项；done(createdIds) 在全部菜单项创建请求发出后调用
function buildContextMenu(done) {
    chrome.storage.local.get({
        'restoreMethod': 'sessions',
        'maxListItems': 25,
        'enableContextMenu': true,
        'useOldMethodInIncognito': true, // 兼容旧设置：现在只影响“点击扩展图标恢复”的行为
        'menuShowTime': true,
        'menuTimePosition': 'left',
        'menuTimeTwoUnits': false
    }, function (result) {
        const settingsErrorMessage = takeLastErrorMessage();
        if (settingsErrorMessage) {
            console.warn('读取右键菜单设置失败：' + settingsErrorMessage);
        }

        const createdIds = [];
        let clearHistoryItemAdded = false;

        // 创建菜单项并记录 id（供下次清理本上下文旧菜单项使用）
        function createItem(properties) {
            createdIds.push(properties.id);
            createContextMenuItem(properties);
        }

        // '清除扩展中的历史记录'：只在扩展图标(action)右键菜单中显示，避免页面右键菜单多出这一项
        function addClearHistoryItem() {
            if (clearHistoryItemAdded) return;
            clearHistoryItemAdded = true;
            createItem({
                id: 'clearExtensionHistory',
                title: chrome.i18n.getMessage('clear_extension_history'),
                contexts: ['action']
            });
        }

        // 用扩展自己记录的已关闭标签页填充菜单（时间可在左或在右，也可隐藏）
        function addOwnHistoryItems() {
            let numTabsToShow = Math.min(closedTabsList.length, maxListItems);
            let items = [];
            for (let i = closedTabsList.length - 1; i >= closedTabsList.length - numTabsToShow; i--) {
                let tabInfo = closedTabsList[i];
                if (!tabInfo) continue;
                items.push({
                    id: 'closedTab_' + i,
                    title: tabInfo.title || tabInfo.url, // 如果没有标题，使用URL
                    timeMs: tabInfo.closedAt,
                    isSeconds: false
                });
            }

            // 计算右对齐目标总宽度（固定宽度与最长条目的较大值）
            let menuAlignTarget = computeMenuTimeAlignTarget(items, menuTimeTwoUnits);

            // 按设置生成标题（时间可在左或在右，也可隐藏，右侧可右对齐）
            items.forEach(function (item) {
                createItem({
                    id: item.id,
                    parentId: 'recentlyClosedTabs',
                    title: buildMenuTitle(item.title, item.timeMs, item.isSeconds, menuShowTime, menuTimePosition, menuAlignTarget, menuTimeTwoUnits),
                    contexts: ['action', 'page']
                });
            });
        }

        // 用浏览器内置的最近关闭列表填充菜单
        function addSessionItems(sessions) {
            let items = [];
            sessions.forEach(function (session) {
                if (session.tab) {
                    let tab = session.tab;
                    items.push({
                        id: 'sessionTab_' + tab.sessionId,
                        title: tab.title || tab.url,
                        timeMs: session.lastModified,
                        isSeconds: true
                    });
                } else if (session.window) {
                    let windowSessionId = session.window.sessionId;
                    let windowTabs = session.window.tabs;
                    let title = windowTabs && windowTabs.length > 0 ?
                        chrome.i18n.getMessage('closed_window_with_count_and_title', [windowTabs.length, windowTabs[0].title || windowTabs[0].url]) :
                        chrome.i18n.getMessage('closed_window');
                    items.push({
                        id: 'sessionWindow_' + windowSessionId,
                        title: title,
                        timeMs: session.lastModified,
                        isSeconds: true
                    });
                }
            });

            // 计算右对齐目标总宽度（固定宽度与最长条目的较大值）
            let menuAlignTarget = computeMenuTimeAlignTarget(items, menuTimeTwoUnits);

            // 按设置生成标题（时间可在左或在右，也可隐藏，右侧可右对齐）
            items.forEach(function (item) {
                createItem({
                    id: item.id,
                    parentId: 'recentlyClosedTabs',
                    title: buildMenuTitle(item.title, item.timeMs, item.isSeconds, menuShowTime, menuTimePosition, menuAlignTarget, menuTimeTwoUnits),
                    contexts: ['action', 'page']
                });
            });
        }

        let restoreMethod = result.restoreMethod || 'sessions';
        let maxListItems = result.maxListItems || 25;
        let enableContextMenu = result.enableContextMenu;
        let menuShowTime = result.menuShowTime;
        let menuTimePosition = result.menuTimePosition;
        let menuTimeTwoUnits = result.menuTimeTwoUnits;

        if (!enableContextMenu) {
            done(createdIds);
            return;
        }

        // 无痕上下文固定使用扩展自己记录的历史：
        // chrome.sessions 依赖 SessionService，而无痕 profile 下它返回 NULL，拿不到任何数据。
        if (isIncognitoContext()) {
            restoreMethod = 'old';
        }

        // 创建 '最近关闭的标签页' 父菜单项
        createItem({
            id: 'recentlyClosedTabs',
            title: chrome.i18n.getMessage('recently_closed_tabs'),
            contexts: ['action', 'page']
        });

        // 如果 restoreMethod 是 'old'，则添加 '清除扩展中的历史记录' 功能
        if (restoreMethod === 'old') {
            addClearHistoryItem();
        }

        if (restoreMethod === 'sessions') {
            // 使用 chrome.sessions API 获取最近关闭的会话
            chrome.sessions.getRecentlyClosed({ maxResults: Math.min(maxListItems, 25) }, function (sessions) {
                const sessionsErrorMessage = takeLastErrorMessage();
                if (sessionsErrorMessage || !Array.isArray(sessions)) {
                    // 无痕模式或其它异常下拿不到浏览器会话，降级为扩展自己记录的历史
                    console.warn('获取浏览器最近关闭的标签页失败，改用扩展记录的历史：' +
                        (sessionsErrorMessage || '返回数据异常'));
                    addClearHistoryItem();
                    addOwnHistoryItems();
                } else {
                    addSessionItems(sessions);
                }
                done(createdIds);
            });
        } else if (restoreMethod === 'old') {
            // 使用自定义列表
            addOwnHistoryItems();
            done(createdIds);
        } else {
            done(createdIds);
        }
    });
}

// 监听上下文菜单点击事件
chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId.startsWith('sessionTab_')) {
        // sessionTab_* 只可能由「浏览器内置方式(sessions)」生成，且只出现在能调用
        // chrome.sessions 的上下文（常规），因此这里直接走浏览器会话恢复。
        let sessionId = info.menuItemId.substring('sessionTab_'.length);

        if (!chrome.sessions || !chrome.sessions.restore) {
            console.warn('当前上下文不支持 chrome.sessions，无法恢复该标签页。');
            return;
        }

        chrome.storage.local.get({ 'restoreToEnd': true }, function (result) {
            let restoreToEnd = result.restoreToEnd;

            chrome.sessions.restore(sessionId, function (restoredSession) {
                const message = takeLastErrorMessage();
                if (message) {
                    console.warn('恢复浏览器会话失败：' + message);
                }

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
        });
    } else if (info.menuItemId.startsWith('closedTab_')) {
        let index = parseInt(info.menuItemId.split('_')[1]);
        let tabInfo = closedTabsList[index];
        reopenClosedTab(tabInfo, index);
    } else if (info.menuItemId.startsWith('sessionWindow_')) {
        // sessionWindow_* 同样只会由 sessions 方式生成，且只出现在常规上下文
        let sessionId = info.menuItemId.substring('sessionWindow_'.length);

        if (!chrome.sessions || !chrome.sessions.restore) {
            console.warn('当前上下文不支持 chrome.sessions，无法恢复该窗口。');
            return;
        }

        chrome.sessions.restore(sessionId, function () {
            const message = takeLastErrorMessage();
            if (message) {
                console.warn('恢复浏览器窗口失败：' + message);
            }
            // 恢复窗口后更新上下文菜单
            chrome.storage.local.get({ enableContextMenu: true }, function (data) {
                if (data.enableContextMenu) {
                    createContextMenu();
                }
            });
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
        // split 模式下 openTabsMap 存在共享的 chrome.storage.local 里，常规/无痕两个上下文
        // 都会读写；这里只处理属于当前上下文的条目，避免把另一个上下文正在开着的标签页误判为已关闭
        let isIncognito = isIncognitoContext();

        // 遍历存储的打开标签页，找出已关闭的标签页
        for (let tabId in openTabsMap) {
            let tabInfo = openTabsMap[tabId];
            if (!tabInfo) continue;
            if (!!tabInfo.incognito !== isIncognito) continue; // 属于另一个上下文，跳过
            if (!currentTabUrls.has(tabInfo.url)) {
                // 标签页已关闭，添加到已关闭标签页列表中
                // 记录关闭时间（毫秒时间戳），用于右键菜单显示相对关闭时间
                tabInfo.closedAt = Date.now();
                closedTabsList.push(tabInfo);
            }
        }

        // 保存更新后的已关闭标签页列表
        saveClosedTabsData();

        // 更新 openTabsMap 为当前上下文打开的标签页，同时保留另一个上下文的条目
        let updatedOpenTabsMap = {};
        for (let tabId in openTabsMap) {
            let tabInfo = openTabsMap[tabId];
            if (tabInfo && !!tabInfo.incognito !== isIncognito) {
                updatedOpenTabsMap[tabId] = tabInfo;
            }
        }
        currentTabs.forEach(tab => {
            if (tab.url && tab.url !== 'chrome://newtab/' && tab.url !== 'about:blank') {
                updatedOpenTabsMap[tab.id] = { url: tab.url, title: tab.title, incognito: !!tab.incognito };
            }
        });
        openTabsMap = updatedOpenTabsMap;
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

// 预设图标模板（与 options.js 保持一致，每个图标带自己的 viewBox / contentBox / path / 或 src）
// colorable=true 的单色图标可染色；colorable=false 的拟物图标（emoji 风格，固定彩色）不可染色
// contentBox 为内容裁剪区域（viewBox 坐标系），用于生成时预先裁剪、让内容铺满画布
const PRESET_ICONS = {
    reply: { name: 'reply', viewBox: '0 0 24 24', contentBox: '0 2.5 24 19.9', colorable: true, path: 'M9.3,7.8V2.5L0,11.8l9.3,9.3v-5.5c6.7,0,11.3,2.1,14.7,6.8C22.7,15.8,18.7,9.2,9.3,7.8z' },
    undo: { name: 'undo', viewBox: '0 0 24 24', contentBox: '2 7 20.5 9.1', colorable: true, path: 'M12.5,8c-2.65,0-5.05,0.99-6.9,2.6L2,7v9h9l-3.62-3.62c1.39-1.16,3.16-1.88,5.12-1.88,3.54,0,6.55,2.31,7.6,5.5l2.37-0.78C21.08,11.03,17.15,8,12.5,8z' },
    clock: { name: 'clock-rotate-left', viewBox: '0 0 512 512', contentBox: '0 0 512 512', colorable: true, path: 'M75 75L41 41C25.9 25.9 0 36.6 0 57.9V168c0 13.3 10.7 24 24 24h110.1c21.4 0 32.1-25.9 17-41l-30.8-30.8C155 85.5 203 64 256 64c106 0 192 86 192 192s-86 192-192 192c-40.8 0-78.6-12.7-109.7-34.4c-14.5-10.1-34.4-6.6-44.6 7.9s-6.6 34.4 7.9 44.6C151.2 495 201.7 512 256 512c141.4 0 256-114.6 256-256S397.4 0 256 0C185.3 0 121.3 28.7 75 75m181 53c-13.3 0-24 10.7-24 24v104c0 6.4 2.5 12.5 7 17l72 72c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-65-65V152c0-13.3-10.7-24-24-24z' },
    backCircle: { name: 'arrow-back-circle', viewBox: '0 0 512 512', contentBox: '40 40 432 432', colorable: true, path: 'M48 256c0 114.87 93.13 208 208 208s208-93.13 208-208S370.87 48 256 48S48 141.13 48 256m212.65-91.36a16 16 0 0 1 .09 22.63L208.42 240H342a16 16 0 0 1 0 32H208.42l52.32 52.73A16 16 0 1 1 238 347.27l-79.39-80a16 16 0 0 1 0-22.54l79.39-80a16 16 0 0 1 22.65-.09' },
    restore: { name: 'restore', viewBox: '0 0 24 24', contentBox: '1 3 21 18', colorable: true, path: 'M13 3a9 9 0 0 0-9 9H1l3.89 3.89l.07.14L9 12H6a7 7 0 0 1 7-7a7 7 0 0 1 7 7a7 7 0 0 1-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.9 8.9 0 0 0 13 21a9 9 0 0 0 9-9a9 9 0 0 0-9-9' },
    backArrowEmoji: { name: 'back arrow', src: 'img/presets/fluent-emoji-back-arrow.svg', colorable: false },
    backCurveEmoji: { name: 'undo', src: 'img/presets/fluent-emoji-left-arrow-curving-right.svg', colorable: false },
    loopRestoreEmoji: { name: 'loop', src: 'img/presets/fluent-emoji-right-curve-left.png', colorable: false },
    cycleRefreshEmoji: { name: 'cycle', src: 'img/presets/fluent-emoji-clockwise-vertical.png', colorable: false },
    turnBackEmoji: { name: 'turn back', src: 'img/presets/fluent-emoji-right-curve-down.png', colorable: false }
};

// ---- HSL 颜色工具（用于拟物图标的「只换主色相、保留高光」着色），与 options.js 保持一致 ----
function hexToRgb(hex) {
    return {
        r: parseInt(hex.substr(1, 2), 16),
        g: parseInt(hex.substr(3, 2), 16),
        b: parseInt(hex.substr(5, 2), 16)
    };
}
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            default: h = (r - g) / d + 4;
        }
        h /= 6;
    }
    return [h, s, l];
}
function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// 拟物图标着色：主色跟随用户所选颜色（色相+饱和度+亮度），并保留原图相对明暗层次
// 低饱和度的灰色阴影与接近白色的高光保持原样
function tintEmojiImageData(imageData, color) {
    if (!color) return imageData;
    const rgb = hexToRgb(color);
    const target = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const targetH = target[0];
    const targetS = target[1];
    const targetL = target[2];
    const d = imageData.data;
    let baseL = 0, count = 0;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const hsl = rgbToHsl(d[i], d[i + 1], d[i + 2]);
        if (hsl[1] < 0.15 || hsl[2] > 0.9) continue;
        baseL += hsl[2]; count++;
    }
    baseL = count ? baseL / count : 0.5;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const hsl = rgbToHsl(d[i], d[i + 1], d[i + 2]);
        if (hsl[1] < 0.15 || hsl[2] > 0.9) continue;
        let nl = targetL + (hsl[2] - baseL);
        if (nl < 0) nl = 0; else if (nl > 1) nl = 1;
        const nrgb = hslToRgb(targetH, targetS, nl);
        d[i] = nrgb[0];
        d[i + 1] = nrgb[1];
        d[i + 2] = nrgb[2];
    }
    return imageData;
}

// 在 service worker 中用 OffscreenCanvas 渲染预设图标并设置图标（兜底）
function renderPresetIconInWorker(presetId, color, colorEnabled) {
    const preset = PRESET_ICONS[presetId];
    if (!preset) return;
    let dataUrl;
    if (preset.src) {
        // 拟物图标：使用 SVG 资源文件
        dataUrl = chrome.runtime.getURL(preset.src);
    } else {
        const viewBox = preset.contentBox || preset.viewBox || '0 0 24 24';
        let svg;
        if (preset.stroke) {
            svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '" fill="none" ' +
                'stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="' + preset.path + '"/></svg>';
        } else {
            svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '">' +
                '<path d="' + preset.path + '" fill="' + color + '"/></svg>';
        }
        dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    }

    const img = new Image();
    img.onload = function () {
        // 图标已在生成时裁剪 viewBox；拟物图标（src）强制铺满，单色图标等比居中
        const isSrc = !!(preset.src);
        function render(size) {
            const canvas = new OffscreenCanvas(size, size);
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.clearRect(0, 0, size, size);
            if (isSrc) {
                ctx.drawImage(img, 0, 0, size, size);
            } else {
                const iw = img.naturalWidth || img.width || 24;
                const ih = img.naturalHeight || img.height || 24;
                const scale = Math.min(size / iw, size / ih);
                const nw = iw * scale;
                const nh = ih * scale;
                ctx.drawImage(img, (size - nw) / 2, (size - nh) / 2, nw, nh);
            }
            // 拟物图标 + 开启「自定义图标颜色」→ 只换主色相，保留高光
            if (isSrc && colorEnabled && preset.colorable !== true) {
                const imageData = ctx.getImageData(0, 0, size, size);
                tintEmojiImageData(imageData, color);
                ctx.putImageData(imageData, 0, 0);
            }
            return Array.from(ctx.getImageData(0, 0, size, size).data);
        }
        const save19 = render(19);
        const save38 = render(38);
        chrome.storage.local.set({ localsave19: save19, localsave38: save38 }, function () {
            chrome.action.setIcon({
                imageData: {
                    '19': new ImageData(new Uint8ClampedArray(save19), 19, 19),
                    '38': new ImageData(new Uint8ClampedArray(save38), 38, 38)
                }
            });
        });
    };
    img.src = dataUrl;
}
