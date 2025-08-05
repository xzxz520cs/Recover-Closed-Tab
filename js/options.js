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


// 获取 DOM 元素
const elems = document.querySelectorAll('[data-i18n]');
const icoFileInput = document.getElementById('icoFile');
const restoreIconButton = document.getElementById('restore-icon');
const restoreMethodRadios = document.querySelectorAll('input[name="restoreMethod"]');
const restoreToEndCheckbox = document.getElementById('restoreToEnd');
const saveButton = document.getElementById('save');
const clearHistoryButton = document.getElementById('clearHistory');
const resetButton = document.getElementById('reset');
const iconPreviewCanvas = document.getElementById('icon-preview-canvas');
const advertisingDiv = document.getElementById('advertising');
const closeAdvertisingButton = document.getElementById('close-advertising');
const maxClosedTabsInput = document.getElementById('maxClosedTabs');
const maxListItemsInput = document.getElementById('maxListItems');
const enableContextMenuCheckbox = document.getElementById('enableContextMenu');
const advertising2 = document.getElementById('advertising-2');
const advertisingContainer = document.getElementById('advertising-container');
const clearHistoryOnInitCheckbox = document.getElementById('clearHistoryOnInit');
const useOldMethodInIncognitoCheckbox = document.getElementById('useOldMethodInIncognito');
const shortcutsTabButton = document.getElementById('shortcuts-tab');

const sessionsOptionsDiv = document.getElementById('sessionsOptions');
const oldOptionsDiv = document.getElementById('oldOptions');

// 初始化工具提示
function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.forEach(function (tooltipTriggerEl) {
        const messageKey = tooltipTriggerEl.getAttribute('data-i18n-tooltip');
        if (messageKey) {
            const message = chrome.i18n.getMessage(messageKey);
            tooltipTriggerEl.setAttribute('title', message);
            new bootstrap.Tooltip(tooltipTriggerEl);
        }
    });
}

// 用于跟踪是否有未保存的更改
let unsavedChanges = false;

// 获取 19px 和 38px 的 canvas 上下文
const canvas19 = document.getElementById("19px");
const c19 = canvas19.getContext("2d", { willReadFrequently: true });

const canvas38 = document.getElementById("38px");
const c38 = canvas38.getContext("2d", { willReadFrequently: true });

// 国际化支持
for (let elem of elems) {
    let i18nKey = elem.dataset.i18n;
    if (i18nKey) {
        let message = chrome.i18n.getMessage(i18nKey);
        if (elem.tagName === 'INPUT' && (elem.type === 'button' || elem.type === 'submit')) {
            elem.value = message;
        } else if (elem.tagName === 'INPUT' && elem.type === 'checkbox') {
            // For checkbox labels
            let label = document.querySelector(`label[for="${elem.id}"]`);
            if (label) {
                label.innerHTML = message;
            }
        } else if (elem.tagName === 'LABEL') {
            elem.innerHTML = message;
        } else {
            elem.textContent = message;
        }
    }
}

// 加载设置
document.addEventListener('DOMContentLoaded', loadSettings);

// 事件监听器
saveButton.addEventListener('click', saveSettings);
clearHistoryButton.addEventListener('click', clearBrowsingHistory);
resetButton.addEventListener('click', resetSettings);
restoreIconButton.addEventListener('click', restoreDefaultIcon);
icoFileInput.addEventListener('change', previewIcon);

// 添加快捷键设置按钮点击事件
if (shortcutsTabButton) {
    shortcutsTabButton.addEventListener('click', function() {
        chrome.tabs.create({url: 'chrome://extensions/shortcuts'});
    });
}

// 为恢复方法的单选按钮添加事件监听器
for (let radio of restoreMethodRadios) {
    radio.addEventListener('change', updateDependentOptionsVisibility);
}

// 监测设置更改
function setupChangeListeners() {
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('change', function () {
            unsavedChanges = true;
            updateSaveButton();
        });
    });
}

// 加载设置函数
function loadSettings() {
    chrome.storage.local.get(defaultSettings, function (items) {
        // 设置选中的恢复方法
        for (let radio of restoreMethodRadios) {
            radio.checked = (radio.value === items.restoreMethod);
        }

        // 更新特定选项的可见性
        updateDependentOptionsVisibility();

        // 其他设置
        restoreToEndCheckbox.checked = items.restoreToEnd;
        maxListItemsInput.value = items.maxListItems;

        // 检测用户的语言环境
        const locale = chrome.i18n.getUILanguage() || chrome.i18n.getMessage("@@ui_locale");

        // 如果是 zh-CN 或 zh_CN，显示第二个广告，隐藏主要广告内容
        if (locale === "zh-CN" || locale === "zh_CN") {
            if (advertising2) {
                advertising2.style.display = "block";
            }
            // 获取广告内容元素并隐藏
            const advertisingContent = document.getElementById('advertising-content');
            if (advertisingContent) {
                advertisingContent.style.display = "none";
            }
        }

        maxClosedTabsInput.value = items.maxClosedTabs;
        enableContextMenuCheckbox.checked = items.enableContextMenu;
        clearHistoryOnInitCheckbox.checked = items.clearHistoryOnInit;  // 设置复选框状态
        useOldMethodInIncognitoCheckbox.checked = items.useOldMethodInIncognito;

        // 显示或隐藏广告
        if (items.showAdvertising) {
            advertisingDiv.classList.add('show');
            advertisingDiv.classList.add('fade'); // 可选
            advertisingContainer.style.display = 'block';
        } else {
            advertisingDiv.classList.remove('show');
            advertisingDiv.classList.remove('fade'); // 可选
            advertisingContainer.style.display = 'none';
        }

        // 设置图标预览
        updateIconPreview(items.localsave19);

        unsavedChanges = false;
        updateSaveButton();
        setupChangeListeners();
    });
}

// 更新保存按钮状态
function updateSaveButton() {
    if (unsavedChanges) {
        saveButton.classList.remove('btn-success');
        saveButton.classList.add('btn-danger');
    } else {
        saveButton.classList.remove('btn-danger');
        saveButton.classList.add('btn-success');
    }
}

// 更新特定选项的可见性
function updateDependentOptionsVisibility() {
    let selectedMethod = document.querySelector('input[name="restoreMethod"]:checked').value;
    if (selectedMethod === 'sessions') {
        sessionsOptionsDiv.style.display = 'block';
        oldOptionsDiv.style.display = 'none';
        maxListItemsInput.max = 25;
        if (parseInt(maxListItemsInput.value) > 25) {
            maxListItemsInput.value = 25;
        }
    } else if (selectedMethod === 'old') {
        sessionsOptionsDiv.style.display = 'none';
        oldOptionsDiv.style.display = 'block';
        maxListItemsInput.max = 1000;
    }
}

// 保存设置函数
function saveSettings() {
    let restoreMethod = document.querySelector('input[name="restoreMethod"]:checked').value;

    // 校验 "最近关闭的标签页列表" 显示数量
    let maxListItems = parseInt(maxListItemsInput.value) || 100;
    if (restoreMethod === 'sessions') {
        maxListItems = Math.min(Math.max(maxListItems, 1), 25);
    } else {
        maxListItems = Math.min(Math.max(maxListItems, 1), 1000);
    }

    let settings = {
        restoreMethod: restoreMethod,
        restoreToEnd: restoreToEndCheckbox.checked,
        useOldMethodInIncognito: useOldMethodInIncognitoCheckbox.checked, // 新增
        maxClosedTabs: Math.min(Math.max(parseInt(maxClosedTabsInput.value) || 1000, 0), 10000),
        maxListItems: maxListItems,
        enableContextMenu: enableContextMenuCheckbox.checked,
        clearHistoryOnInit: clearHistoryOnInitCheckbox.checked
    };

    if (icoFileInput.files.length > 0) {
        let file = icoFileInput.files[0];
        let imgFileReader = new FileReader();
        imgFileReader.readAsDataURL(file);
        imgFileReader.onload = function () {
            let img = new Image();
            img.src = imgFileReader.result;
            img.onload = function () {
                processAndSaveIcons(3, img, settings);
            }
        }
    } else {
        chrome.storage.local.set(settings, function () {
            console.log("设置已保存");
        });
    }

    unsavedChanges = false;
    updateSaveButton();
}

// 处理并保存图标函数
function processAndSaveIcons(times, img, settings) {
    if (times <= 0) {
        updateIconPreview(settings.localsave19);
        return;
    }

    [{ canvas: canvas19, context: c19, size: 19 },
    { canvas: canvas38, context: c38, size: 38 }].forEach(item => {
        let { canvas, context, size } = item;

        context.imageSmoothingEnabled = true;
        context.clearRect(0, 0, size, size);

        let scale = Math.min(size / img.width, size / img.height);
        let newWidth = img.width * scale;
        let newHeight = img.height * scale;
        let x = (size - newWidth) / 2;
        let y = (size - newHeight) / 2;

        context.drawImage(img, x, y, newWidth, newHeight);
    });

    let save19 = c19.getImageData(0, 0, 19, 19);
    let save38 = c38.getImageData(0, 0, 38, 38);

    settings.localsave19 = Array.from(save19.data);
    settings.localsave38 = Array.from(save38.data);

    chrome.storage.local.set(settings, function () {
        if (chrome.runtime.lastError) {
            console.error("保存设置时出错：" + chrome.runtime.lastError.message);
        } else {
            console.log("设置和图标数据已保存，剩余次数：", times - 1);
            chrome.action.setIcon({
                imageData: {
                    "19": save19,
                    "38": save38
                }
            });
            processAndSaveIcons(times - 1, img, settings);
        }
    });
}

// 清除浏览记录的函数
function clearBrowsingHistory() {
    // 发送消息给背景脚本，要求清除已关闭标签页的历史记录
    chrome.runtime.sendMessage({ action: 'clearClosedTabsList' }, function(response) {
        if (chrome.runtime.lastError) {
            console.error("清除已关闭标签页历史记录时出错：" + chrome.runtime.lastError.message);
        } else {
            // 设置按钮反馈为“历史已清理”，变为成功样式
            clearHistoryButton.textContent = chrome.i18n.getMessage('historyClearedMessage');
            clearHistoryButton.classList.remove('btn-warning');
            clearHistoryButton.classList.add('btn-success');

            // 延迟2秒后恢复默认按钮样式和文本
            setTimeout(() => {
                clearHistoryButton.textContent = chrome.i18n.getMessage('clearHistory');
                clearHistoryButton.classList.remove('btn-success');
                clearHistoryButton.classList.add('btn-warning');
            }, 2000); // 设置为2秒延迟
        }
    });
}

// 重置设置函数
function resetSettings() {
    chrome.storage.local.set(defaultSettings, function () {
        // 更新界面元素以反映默认设置
        for (let radio of restoreMethodRadios) {
            radio.checked = (radio.value === defaultSettings.restoreMethod);
        }
        restoreToEndCheckbox.checked = defaultSettings.restoreToEnd;
        maxClosedTabsInput.value = defaultSettings.maxClosedTabs;
        maxListItemsInput.value = defaultSettings.maxListItems;
        useOldMethodInIncognitoCheckbox.checked = defaultSettings.useOldMethodInIncognito;
        enableContextMenuCheckbox.checked = defaultSettings.enableContextMenu;
        clearHistoryOnInitCheckbox.checked = defaultSettings.clearHistoryOnInit;
        icoFileInput.value = '';

        // 更新相关可见性和状态
        updateDependentOptionsVisibility();
        restoreDefaultIcon();
        console.log("设置已重置为默认值");
    });
}

// 恢复默认图标函数
function restoreDefaultIcon() {
    icoFileInput.value = '';
    chrome.storage.local.set({
        localsave19: null,
        localsave38: null
    }, function () {
        chrome.action.setIcon({
            path: {
                "19": "img/ico_19px.png",
                "38": "img/ico_38px.png"
            }
        });
        updateIconPreview(null);
        console.log("已恢复默认图标");
    });
}

// 当选择新的文件时预览图标
function previewIcon() {
    if (icoFileInput.files.length > 0) {
        let file = icoFileInput.files[0];
        let reader = new FileReader();
        reader.onload = function (e) {
            let previewImg = new Image();
            previewImg.src = e.target.result;
            previewImg.onload = function () {
                drawIconPreview(previewImg);
            }
        }
        reader.readAsDataURL(file);
    }
}

// 更新图标预览
function updateIconPreview(localsave19) {
    iconPreviewCanvas.width = 19;
    iconPreviewCanvas.height = 19;
    const ctx = iconPreviewCanvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, 19, 19);

    if (localsave19) {
        const imageData = new ImageData(new Uint8ClampedArray(localsave19), 19, 19);
        ctx.putImageData(imageData, 0, 0);
    } else {
        let defaultIcon = new Image();
        defaultIcon.src = chrome.runtime.getURL('img/ico_128px.png');
        defaultIcon.onload = function () {
            let scale = Math.min(19 / defaultIcon.width, 19 / defaultIcon.height);
            let newWidth = defaultIcon.width * scale;
            let newHeight = defaultIcon.height * scale;
            let x = (19 - newWidth) / 2;
            let y = (19 - newHeight) / 2;
            ctx.drawImage(defaultIcon, x, y, newWidth, newHeight);
        }
    }
}

// 绘制图标预览
function drawIconPreview(image) {
    iconPreviewCanvas.width = 19;
    iconPreviewCanvas.height = 19;
    const ctx = iconPreviewCanvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, 19, 19);
    let scale = Math.min(19 / image.width, 19 / image.height);
    let newWidth = image.width * scale;
    let newHeight = image.height * scale;
    let x = (19 - newWidth) / 2;
    let y = (19 - newHeight) / 2;
    ctx.drawImage(image, x, y, newWidth, newHeight);
}

document.addEventListener('DOMContentLoaded', function () {
    loadSettings();
    updateSaveButton();

    // 初始化工具提示
    initializeTooltips();

    // 检测用户的语言环境
    const locale = chrome.i18n.getUILanguage() || chrome.i18n.getMessage("@@ui_locale");

    // 如果是 zh-CN 或 zh_CN，显示第二个广告
    if (locale === "zh-CN" || locale === "zh_CN") {
        if (advertising2) {
            advertising2.style.display = "block";
        }
    }
});

// 关闭广告的按钮事件
closeAdvertisingButton.addEventListener('click', function () {
    chrome.storage.local.set({ showAdvertising: false }, function () {
        console.log('广告已永久关闭。');
        advertisingContainer.style.display = 'none';
    });
});
