document.addEventListener('DOMContentLoaded', function () {
    // 国际化支持，设置页面文本
    var elems = document.getElementsByTagName('*');
    for (var i = 0; i < elems.length; i++) {
        var i18n = elems[i].dataset.i18n;
        if (i18n) {
            if (elems[i].value) {
                elems[i].value = chrome.i18n.getMessage(i18n);
            } else {
                elems[i].innerHTML = chrome.i18n.getMessage(i18n);
            }
        }
    }

    // 从查询参数中获取原始的文件 URL
    function getFileUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('fileUrl');
    }

    // 处理文件链接
    const fileUrl = getFileUrl();
    const fileLink = document.getElementById('fileLink');
    if (fileUrl) {
        fileLink.href = fileUrl;
        fileLink.textContent = decodeURIComponent(fileUrl);
    } else {
        fileLink.textContent = chrome.i18n.getMessage('invalid_file_url');
    }
});