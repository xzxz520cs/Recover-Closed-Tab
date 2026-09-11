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
        } else if ('maxListItems' in changes || 'restoreMethod' in changes || 'useOldMethodInIncognito' in changes || 'menuShowTime' in changes || 'menuTimePosition' in changes || 'menuTimeTwoUnits' in changes) {
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
            'maxListItems': 25,
            'enableContextMenu': true,
            'useOldMethodInIncognito': true, // 获取新选项
            'menuShowTime': true,
            'menuTimePosition': 'left',
            'menuTimeTwoUnits': false
        }, function (result) {
            let restoreMethod = result.restoreMethod || 'sessions';
            let maxListItems = result.maxListItems || 25;
            let enableContextMenu = result.enableContextMenu;
            let useOldMethodInIncognito = result.useOldMethodInIncognito;
            let menuShowTime = result.menuShowTime;
            let menuTimePosition = result.menuTimePosition;
            let menuTimeTwoUnits = result.menuTimeTwoUnits;

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
                    contexts: ['action', 'page']
                });

                // 如果 restoreMethod 是 'old'，则添加 '清除扩展中的历史记录' 功能
                // 该菜单项只在扩展图标(action)右键菜单中显示，避免页面右键菜单多出这一项
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
                        // 先收集该菜单下的所有条目，用于计算时间对齐宽度
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
                            chrome.contextMenus.create({
                                id: item.id,
                                parentId: 'recentlyClosedTabs',
                                title: buildMenuTitle(item.title, item.timeMs, item.isSeconds, menuShowTime, menuTimePosition, menuAlignTarget, menuTimeTwoUnits),
                                contexts: ['action', 'page']
                            });
                        });

                        isCreatingContextMenu = false;
                        if (pendingCreateContextMenu) {
                            createContextMenu();
                        }
                    });
                } else if (restoreMethod === 'old') {
                    // 使用自定义列表
                    let numTabsToShow = Math.min(closedTabsList.length, maxListItems);
                    let items = [];
                    for (let i = closedTabsList.length - 1; i >= closedTabsList.length - numTabsToShow; i--) {
                        let tabInfo = closedTabsList[i];
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
                        chrome.contextMenus.create({
                            id: item.id,
                            parentId: 'recentlyClosedTabs',
                            title: buildMenuTitle(item.title, item.timeMs, item.isSeconds, menuShowTime, menuTimePosition, menuAlignTarget, menuTimeTwoUnits),
                            contexts: ['action', 'page']
                        });
                    });

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
                // 注意：当右键菜单仍由 sessions 生成、但无痕模式下切换到 old 时，
                // sessionId 是字母数字而非数字索引，parseInt 会得到 NaN。
                // 此时 closedTabsList[NaN] 为 undefined，需做空值守卫，避免崩溃。
                let index = parseInt(info.menuItemId.split('_')[1]);
                let tabInfo = closedTabsList[index];
                if (!tabInfo) {
                    console.warn("无法从旧方法历史中找到对应的标签页，可能菜单与恢复方式不匹配。");
                    return;
                }
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
                // 记录关闭时间（毫秒时间戳），用于右键菜单显示相对关闭时间
                tabInfo.closedAt = Date.now();
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
