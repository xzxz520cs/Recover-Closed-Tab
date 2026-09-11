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
    menuTimeTwoUnits: false,
    iconPreset: null,
    iconColor: '#adadad',
    iconColorEnabled: false
};

// 预设图标模板（每个图标带自己的 viewBox / path / 或 src）
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


// 获取 DOM 元素
const elems = document.querySelectorAll('[data-i18n]');
const icoFileInput = document.getElementById('icoFile');
const restoreIconButton = document.getElementById('restore-icon');
const iconColorInput = document.getElementById('iconColor');
const iconColorEnabledCheckbox = document.getElementById('iconColorEnabled');
const presetIconList = document.getElementById('preset-icon-list');
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
const menuShowTimeCheckbox = document.getElementById('menuShowTime');
const menuTimeTwoUnitsCheckbox = document.getElementById('menuTimeTwoUnits');
const menuTimePositionRadios = document.querySelectorAll('input[name="menuTimePosition"]');
const menuTimePositionGroup = document.getElementById('menuTimePositionGroup');

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

// 加载设置：通过底部唯一的 DOMContentLoaded 注册触发（避免重复注册导致 loadSettings 执行两次）
// 事件监听器
saveButton.addEventListener('click', saveSettings);
clearHistoryButton.addEventListener('click', clearBrowsingHistory);
resetButton.addEventListener('click', resetSettings);
restoreIconButton.addEventListener('click', restoreDefaultIcon);
icoFileInput.addEventListener('change', previewIcon);
iconColorInput.addEventListener('input', onIconColorChange);
iconColorEnabledCheckbox.addEventListener('change', onIconColorEnabledChange);

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
let changeListenersInstalled = false; // 防止重复安装监听器
function setupChangeListeners() {
    if (changeListenersInstalled) return; // 只安装一次
    changeListenersInstalled = true;

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
        menuShowTimeCheckbox.checked = items.menuShowTime;
        menuTimeTwoUnitsCheckbox.checked = items.menuTimeTwoUnits;
        for (let radio of menuTimePositionRadios) {
            radio.checked = (radio.value === items.menuTimePosition);
        }
        updateMenuTimePositionGroupState();

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

        // 回显图标颜色与预设图标
        if (iconColorEnabledCheckbox && typeof items.iconColorEnabled !== 'undefined') {
            iconColorEnabledCheckbox.checked = items.iconColorEnabled;
        }
        if (iconColorInput && items.iconColor) {
            iconColorInput.value = items.iconColor;
        }
        initPresetIconList();
        if (items.iconPreset && PRESET_ICONS[items.iconPreset]) {
            highlightPresetIcon(items.iconPreset);
            // 回显时把该预设图标显示到预览 canvas（仅预览，不含实际图标）
            previewPresetIcon(items.iconPreset, items.iconColor || defaultSettings.iconColor);
        } else {
            // 设置图标预览
            updateIconPreview(items.localsave19);
        }

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

// 根据是否显示时间，更新时间位置选项的禁用状态
function updateMenuTimePositionGroupState() {
    let showTime = menuShowTimeCheckbox.checked;
    menuTimePositionRadios.forEach(function (radio) {
        radio.disabled = !showTime;
    });
    if (menuTimePositionGroup) {
        if (showTime) {
            menuTimePositionGroup.classList.remove('disabled');
        } else {
            menuTimePositionGroup.classList.add('disabled');
        }
    }
}

// 监听是否显示时间复选框的变化
if (menuShowTimeCheckbox) {
    menuShowTimeCheckbox.addEventListener('change', updateMenuTimePositionGroupState);
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

    // 读取时间位置单选按钮
    let checkedTimePosition = document.querySelector('input[name="menuTimePosition"]:checked');
    let menuTimePosition = checkedTimePosition ? checkedTimePosition.value : 'left';

    let settings = {
        restoreMethod: restoreMethod,
        restoreToEnd: restoreToEndCheckbox.checked,
        useOldMethodInIncognito: useOldMethodInIncognitoCheckbox.checked, // 新增
        maxClosedTabs: Math.min(Math.max(parseInt(maxClosedTabsInput.value) || 1000, 0), 10000),
        maxListItems: maxListItems,
        enableContextMenu: enableContextMenuCheckbox.checked,
        clearHistoryOnInit: clearHistoryOnInitCheckbox.checked,
        menuShowTime: menuShowTimeCheckbox.checked,
        menuTimePosition: menuTimePosition,
        menuTimeTwoUnits: menuTimeTwoUnitsCheckbox.checked,
        iconColor: iconColorInput.value || defaultSettings.iconColor,
        iconColorEnabled: iconColorEnabledCheckbox.checked,
        iconPreset: null
    };

    // 记录当前选中的预设图标（若有）
    const activePreset = presetIconList && presetIconList.querySelector('button.active');
    if (activePreset) {
        settings.iconPreset = activePreset.dataset.preset;
    }

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
    } else if (activePreset) {
        // 选中了预设图标：保存时才真正生成并应用（预览已实时显示，实际图标此处才改变）
        renderPresetIcon(activePreset.dataset.preset, settings.iconColor, settings);
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

    // 方案 B：把上传图片的非透明像素染成所选颜色（保留 alpha，改 RGB）
    // 仅当勾选了「自定义图标颜色」时才染色，否则保留原图颜色
    let save19 = c19.getImageData(0, 0, 19, 19);
    let save38 = c38.getImageData(0, 0, 38, 38);
    if (settings.iconColorEnabled) {
        let tintColor = settings.iconColor || defaultSettings.iconColor;
        save19 = tintImageData(save19, tintColor);
        save38 = tintImageData(save38, tintColor);
    }

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
        menuShowTimeCheckbox.checked = defaultSettings.menuShowTime;
        menuTimeTwoUnitsCheckbox.checked = defaultSettings.menuTimeTwoUnits;
        for (let radio of menuTimePositionRadios) {
            radio.checked = (radio.value === defaultSettings.menuTimePosition);
        }
        updateMenuTimePositionGroupState();
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
    let defaultColor = defaultSettings.iconColor;
    if (iconColorInput) {
        iconColorInput.value = defaultColor;
    }
    if (iconColorEnabledCheckbox) {
        iconColorEnabledCheckbox.checked = defaultSettings.iconColorEnabled;
    }
    clearPresetIconSelection();
    chrome.storage.local.set({
        localsave19: null,
        localsave38: null,
        iconPreset: null,
        iconColor: defaultColor,
        iconColorEnabled: defaultSettings.iconColorEnabled
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

// 生成 SVG 图标链接（用于渲染预设图标按钮缩略图 / 预览）
function presetIconToDataUrl(presetId, color) {
    const preset = PRESET_ICONS[presetId];
    if (!preset) return null;
    // 拟物图标：直接使用 SVG 资源文件 URL（保留原始渐变/彩色，不可染色）
    if (preset.src) {
        return chrome.runtime.getURL(preset.src);
    }
    // 使用 contentBox（内容裁剪区）作为 viewBox，生成时即让内容铺满，无需运行时再裁剪
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
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// 绘制图标到目标画布
// stretch=true（拟物方形图标）：强制铺满整个正方形画布，消除四周留白
// stretch=false（单色图标）：等比居中缩放，保持图标形状不变形
function drawIconContentFitted(img, targetCanvas, targetCtx, size, stretch) {
    targetCanvas.width = size;
    targetCanvas.height = size;
    targetCtx.imageSmoothingEnabled = true;
    targetCtx.clearRect(0, 0, size, size);
    if (stretch) {
        targetCtx.drawImage(img, 0, 0, size, size);
        return;
    }
    const iw = img.naturalWidth || img.width || 24;
    const ih = img.naturalHeight || img.height || 24;
    const scale = Math.min(size / iw, size / ih);
    const nw = iw * scale;
    const nh = ih * scale;
    targetCtx.drawImage(img, (size - nw) / 2, (size - nh) / 2, nw, nh);
}

// 仅预览：把预设图标绘制到右侧预览 canvas（不改变实际图标，未保存）
function previewPresetIcon(presetId, color) {
    const dataUrl = presetIconToDataUrl(presetId, color);
    if (!dataUrl) return;
    const img = new Image();
    img.onload = function () {
        const preset = PRESET_ICONS[presetId];
        const isSrc = !!(preset && preset.src);
        const previewCtx = iconPreviewCanvas.getContext('2d', { willReadFrequently: true });
        drawIconContentFitted(img, iconPreviewCanvas, previewCtx, 19, isSrc);
        // 拟物图标 + 开启「自定义图标颜色」→ 只换主色相，保留高光
        if (isSrc && preset.colorable !== true && iconColorEnabledCheckbox && iconColorEnabledCheckbox.checked) {
            const imageData = previewCtx.getImageData(0, 0, 19, 19);
            tintEmojiImageData(imageData, color);
            previewCtx.putImageData(imageData, 0, 0);
        }
    };
    img.src = dataUrl;
}

// 渲染预设图标到 19/38 canvas，并保存 + setIcon（仅在保存时调用）
// settings 为完整设置对象（含 restoreMethod、menuShowTime、menuTimePosition 等），合并写入，避免只保存图标而丢失其它设置
function renderPresetIcon(presetId, color, settings) {
    const dataUrl = presetIconToDataUrl(presetId, color);
    if (!dataUrl) return;
    const img = new Image();
    img.onload = function () {
        const preset = PRESET_ICONS[presetId];
        const isSrc = !!(preset && preset.src);
        const colorEmoji = isSrc && preset.colorable !== true && iconColorEnabledCheckbox && iconColorEnabledCheckbox.checked;
        [{ canvas: canvas19, context: c19, size: 19 },
         { canvas: canvas38, context: c38, size: 38 }].forEach(function (item) {
            drawIconContentFitted(img, item.canvas, item.context, item.size, isSrc);
            // 拟物图标 + 开启「自定义图标颜色」→ 只换主色相，保留高光
            if (colorEmoji) {
                const imageData = item.context.getImageData(0, 0, item.size, item.size);
                tintEmojiImageData(imageData, color);
                item.context.putImageData(imageData, 0, 0);
            }
        });
        const imageData19 = c19.getImageData(0, 0, 19, 19);
        const imageData38 = c38.getImageData(0, 0, 38, 38);
        const save19 = Array.from(imageData19.data);
        const save38 = Array.from(imageData38.data);
        const saveEnabled = !!(iconColorEnabledCheckbox && iconColorEnabledCheckbox.checked);
        // 将完整 settings 与图标数据合并后写入，确保菜单设置（menuShowTime/menuTimePosition 等）不丢失
        chrome.storage.local.set(Object.assign({}, settings, { localsave19: save19, localsave38: save38, iconPreset: presetId, iconColor: color, iconColorEnabled: saveEnabled }), function () {
            chrome.action.setIcon({ imageData: { '19': imageData19, '38': imageData38 } });
            updateIconPreview(save19);
            unsavedChanges = false;
            updateSaveButton();
        });
    };
    img.src = dataUrl;
}

// 清除预设图标的选中状态
function clearPresetIconSelection() {
    if (presetIconList) {
        presetIconList.querySelectorAll('button').forEach(function (btn) {
            btn.classList.remove('active');
        });
    }
}

// 高亮选中的预设图标
function highlightPresetIcon(presetId) {
    if (!presetIconList) return;
    presetIconList.querySelectorAll('button').forEach(function (btn) {
        if (btn.dataset.preset === presetId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// 生成拟物图标（src）的着色缩略图：渲染到临时 canvas，若开启颜色则做色相替换，输出 PNG data URL
function renderEmojiThumbDataUrl(presetId, size, color, callback) {
    const preset = PRESET_ICONS[presetId];
    if (!preset || !preset.src) { callback(null); return; }
    const img = new Image();
    img.onload = function () {
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = size;
        thumbCanvas.height = size;
        const thumbCtx = thumbCanvas.getContext('2d', { willReadFrequently: true });
        drawIconContentFitted(img, thumbCanvas, thumbCtx, size, true);
        if (iconColorEnabledCheckbox && iconColorEnabledCheckbox.checked) {
            const imageData = thumbCtx.getImageData(0, 0, size, size);
            tintEmojiImageData(imageData, color);
            thumbCtx.putImageData(imageData, 0, 0);
        }
        callback(thumbCanvas.toDataURL('image/png'));
    };
    img.onerror = function () { callback(null); };
    img.src = chrome.runtime.getURL(preset.src);
}

// 动态创建预设图标按钮
function initPresetIconList() {
    if (!presetIconList) return;
    let currentColor = getEffectiveIconColor();
    Object.keys(PRESET_ICONS).forEach(function (presetId) {
        const preset = PRESET_ICONS[presetId];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.preset = presetId;
        btn.title = preset.name;
        btn.className = 'btn btn-outline-secondary preset-icon-btn';
        // 单色图标：直接用含颜色的 SVG data URL；拟物图标（src）：异步生成着色缩略图
        if (preset.src) {
            btn.innerHTML = '<img src="" alt="' + preset.name + '" width="24" height="24">';
            renderEmojiThumbDataUrl(presetId, 24, currentColor, function (url) {
                const imgEl = btn.querySelector('img');
                if (imgEl && url) { imgEl.src = url; }
            });
        } else {
            const dataUrl = presetIconToDataUrl(presetId, currentColor);
            btn.innerHTML = '<img src="' + dataUrl + '" alt="' + preset.name + '" width="24" height="24">';
        }
        btn.addEventListener('click', function () {
            previewPresetIcon(presetId, getEffectiveIconColor());
            highlightPresetIcon(presetId);
            unsavedChanges = true;
            updateSaveButton();
        });
        presetIconList.appendChild(btn);
    });
}

// 平滑更新预设图标缩略图：不清空列表，只重新生成缩略图并在加载完成后替换 src（避免图裂/闪烁）
// 单色图标（无 src）：直接修改颜色值（fill=color），随颜色实时变；拟物图标（src）：用「保留明暗」的半透明遮罩着色
function updateEmojiThumbs(color) {
    if (!presetIconList) return;
    presetIconList.querySelectorAll('button[data-preset]').forEach(function (btn) {
        const presetId = btn.dataset.preset;
        const preset = PRESET_ICONS[presetId];
        if (!preset) return;
        const imgEl = btn.querySelector('img');
        if (!imgEl) return;
        if (preset.src) {
            // 拟物图标：遮罩式着色，异步生成后替换
            renderEmojiThumbDataUrl(presetId, 24, color, function (url) {
                if (url) { imgEl.src = url; }
            });
        } else {
            // 单色图标：直接用所选颜色值填充
            const dataUrl = presetIconToDataUrl(presetId, color);
            if (dataUrl) { imgEl.src = dataUrl; }
        }
    });
}

// 读取当前选中的预设图标 id（若存在）
// ---- HSL 颜色工具（用于拟物图标的「主色跟随所选颜色、保留高光」着色） ----
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
// 低饱和度的灰色阴影与接近白色的高光保持原样 → 得到「整体明暗贴近所选颜色、高光立体感不变」的效果
function tintEmojiImageData(imageData, color) {
    if (!color) return imageData;
    const rgb = hexToRgb(color);
    const target = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const targetH = target[0];
    const targetS = target[1];
    const targetL = target[2];
    const d = imageData.data;
    // 先统计需着色像素的平均亮度，作为用户颜色叠加的相对基准
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
        // 低饱和度像素（灰色阴影）或接近白色的像素（高光）保留原样，保住拟物立体感
        if (hsl[1] < 0.15 || hsl[2] > 0.9) continue;
        // 以用户颜色的亮度为中心，叠加原像素相对平均亮度的偏移，保留明暗层次
        let nl = targetL + (hsl[2] - baseL);
        if (nl < 0) nl = 0; else if (nl > 1) nl = 1;
        const nrgb = hslToRgb(targetH, targetS, nl);
        d[i] = nrgb[0];
        d[i + 1] = nrgb[1];
        d[i + 2] = nrgb[2];
    }
    return imageData;
}

// 方案 B：给图片的非透明像素染色（保留 alpha，改 RGB），用于上传图片
function tintImageData(imageData, color) {
    if (!color) return imageData;
    const r = parseInt(color.substr(1, 2), 16);
    const g = parseInt(color.substr(3, 2), 16);
    const b = parseInt(color.substr(5, 2), 16);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0) {
            d[i] = r;
            d[i + 1] = g;
            d[i + 2] = b;
        }
    }
    return imageData;
}

// 颜色选择变化时的处理
function onIconColorChange() {
    // 用户修改颜色时，自动勾选「自定义图标颜色」
    if (iconColorEnabledCheckbox && !iconColorEnabledCheckbox.checked) {
        iconColorEnabledCheckbox.checked = true;
    }
    const color = getEffectiveIconColor();
    // 让拟物图标缩略图也实时跟着变色（平滑替换 src，不清空列表，避免图裂）
    updateEmojiThumbs(color);
    // 如果有选中预设图标，则仅更新预览（不改变实际图标，保存后才生效）
    const activePreset = presetIconList && presetIconList.querySelector('button.active');
    if (activePreset) {
        previewPresetIcon(activePreset.dataset.preset, color);
        unsavedChanges = true;
        updateSaveButton();
        return;
    }
    // 否则如果上传了图片，实时更新预览并标记未保存（保存时染色）
    if (icoFileInput.files.length > 0) {
        let file = icoFileInput.files[0];
        let reader = new FileReader();
        reader.onload = function (e) {
            let previewImg = new Image();
            previewImg.src = e.target.result;
            previewImg.onload = function () {
                drawIconPreviewTinted(previewImg, color);
            };
        };
        reader.readAsDataURL(file);
        unsavedChanges = true;
        updateSaveButton();
    }
}

// 颜色开关变化时的处理（开启/关闭颜色）—— 仅更新预览，保存后才生效
function onIconColorEnabledChange() {
    const color = getEffectiveIconColor();
    // 让拟物图标缩略图也实时跟着变色/还原（平滑替换 src，不清空列表，避免图裂）
    updateEmojiThumbs(color);
    const activePreset = presetIconList && presetIconList.querySelector('button.active');
    if (activePreset) {
        previewPresetIcon(activePreset.dataset.preset, color);
        unsavedChanges = true;
        updateSaveButton();
    } else if (icoFileInput.files.length > 0) {
        let file = icoFileInput.files[0];
        let reader = new FileReader();
        reader.onload = function (e) {
            let previewImg = new Image();
            previewImg.src = e.target.result;
            previewImg.onload = function () {
                if (iconColorEnabledCheckbox && iconColorEnabledCheckbox.checked) {
                    drawIconPreviewTinted(previewImg, color);
                } else {
                    drawIconPreview(previewImg);
                }
            };
        };
        reader.readAsDataURL(file);
        unsavedChanges = true;
        updateSaveButton();
    }
}

// 根据颜色开关返回实际生效的颜色（关闭时用默认色）
function getEffectiveIconColor() {
    if (!iconColorEnabledCheckbox || !iconColorEnabledCheckbox.checked) {
        return defaultSettings.iconColor;
    }
    return iconColorInput.value || defaultSettings.iconColor;
}

// 当选择新的文件时预览图标
function previewIcon() {
    clearPresetIconSelection();
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

// 按颜色染色后绘制图标预览（方案 B：只改非透明像素颜色，保留形状）
function drawIconPreviewTinted(image, color) {
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
    // 取出像素并染色
    const imageData = ctx.getImageData(0, 0, 19, 19);
    tintImageData(imageData, color);
    ctx.putImageData(imageData, 0, 0);
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
