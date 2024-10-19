var elems = document.getElementsByTagName('*');

var img = new Image();
var imgFile = new FileReader();

var canvas19 = document.getElementById("19px");
var c19 = canvas19.getContext("2d");
c19.fillStyle = "rgba(255,255,255,0)";

var canvas38 = document.getElementById("38px");
var c38 = canvas38.getContext("2d");
c38.fillStyle = "rgba(255,255,255,0)";

var s = document.getElementById("save");
var r = document.getElementById("reset");
s.addEventListener("click", save, false);
r.addEventListener("click", reset, false);

// 多语言支持
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

// 设置扩展图标
function save() {
    // 取得用户选择的图片
    var newIco = document.getElementById("icoFile").files;

    // 检测用户是否选择了图片
    if (newIco.length == 0) {
        console.log("no image");
        return;
    }

    // 读取图片数据
    imgFile.readAsDataURL(newIco[0]);
    imgFile.onload = function (m) {
        img.src = this.result;
        img.onload = function () {
            // 启用平滑
            c19.imageSmoothingEnabled = true;
            c38.imageSmoothingEnabled = true;

            for (let j = 0; j < 4; j++) { // 循环四次
                // 清空canvas
                c19.clearRect(0, 0, 19, 19);
                c38.clearRect(0, 0, 38, 38);

                // 计算缩放比例
                const scale19 = Math.min(19 / img.width, 19 / img.height);
                const scale38 = Math.min(38 / img.width, 38 / img.height);

                // 计算新的宽高
                const newWidth19 = img.width * scale19;
                const newHeight19 = img.height * scale19;
                const newWidth38 = img.width * scale38;
                const newHeight38 = img.height * scale38;

                // 计算绘制位置以居中
                const x19 = (19 - newWidth19) / 2;
                const y19 = (19 - newHeight19) / 2;
                const x38 = (38 - newWidth38) / 2;
                const y38 = (38 - newHeight38) / 2;

                // 将图片输入canvas，缩放并居中
                c19.drawImage(img, x19, y19, newWidth19, newHeight19);
                c38.drawImage(img, x38, y38, newWidth38, newHeight38);

                // 取得缩放后的imageData
                var save19 = c19.getImageData(0, 0, 19, 19);
                var save38 = c38.getImageData(0, 0, 38, 38);

                // 保存像素数据为数组
                chrome.storage.local.set({
                    "localsave19": Array.from(save19.data),
                    "localsave38": Array.from(save38.data)
                }, function () {
                    if (chrome.runtime.lastError) {
                        console.error("Error saving data: " + chrome.runtime.lastError.message);
                    } else {
                        console.log("Data saved to chrome.storage.local");
                    }
                });

                // 更改图标
                chrome.action.setIcon({
                    imageData: {
                        "19": save19,
                        "38": save38
                    }
                });
            }
        }
    }
}

// 重置为默认设置
function reset() {
    // 将图标设置为默认
    chrome.action.setIcon({
        path: {
            "19": "img/ico_19px.png",
            "38": "img/ico_38px.png"
        }
    });
    // 删除储存
    chrome.storage.local.remove(["localsave19", "localsave38"], function () {
        console.log("Data removed from chrome.storage.local");
    });
}