# 恢复关闭的标签页 - Chrome扩展

[![Version](https://img.shields.io/badge/version-3.65-blue)]()

一个简单实用的Chrome扩展，帮助您快速找回意外关闭的标签页。

## 主要功能

- 一键恢复最近关闭的标签页
- 支持恢复整个关闭的窗口
- 右键菜单快速访问关闭的标签页列表
- 可自定义最大保存数量(最多1000个)
- 多语言支持(中文、英文、日文等)

## 目录结构

```
src/        ← 唯一源码编辑目录（manifest 不含 update_url，由构建脚本注入）
Chrome/     ← Chrome 商店产物（构建生成，manifest 含 update_url）
Edge/       ← Edge 商店产物（构建生成，无 update_url）
build.py    ← 构建脚本（Python 3，零依赖）
build.ps1   ← Windows PowerShell 封装
build.cmd   ← Windows 双击运行封装
```

## 开发者：修改与构建

**重要**：所有代码修改请只改 `src/` 目录。`Chrome/` 与 `Edge/` 是由 `build.py` 生成的产物，**不要手工修改**，否则下次构建会被覆盖。

构建（需要 Python 3）：

```powershell
# 生成 Chrome/ 与 Edge/，并在 dist/ 打包两个商店的发布 zip
.\build.ps1

# 注入新版本号（zip 文件名同步）
.\build.ps1 -Version 3.66

# 只生成产物目录，不打包
.\build.ps1 -NoZip

# 生成前清空产物目录
.\build.ps1 -Clean
```

或直接用 Python：

```bash
python build.py
python build.py --version 3.66
python build.py --no-zip
```

构建脚本完成的工作：

- 将 `src/` 复制到 `Chrome/` 和 `Edge/`
- 仅在 `Chrome/manifest.json` 注入 `update_url`（`https://clients2.google.com/service/update2/crx`）
- `Edge/manifest.json` 不包含 `update_url`（正确做法）
- **默认在 `dist/` 生成两个商店的发布 zip**：`recover-closed-tab-chrome-<版本>.zip` 与 `recover-closed-tab-edge-<版本>.zip`（加 `-NoZip` / `--no-zip` 可跳过）

## 使用方法

1. **点击扩展图标**：恢复最近关闭的标签页
2. **右键菜单**：
   - 右键点击扩展图标
   - 选择"最近关闭的标签页列表"
   - 从列表中选择要恢复的页面

## 安装方法

1. 从[Chrome应用商店](https://chromewebstore.google.com/detail/%E6%81%A2%E5%A4%8D%E5%85%B3%E9%97%AD%E7%9A%84%E6%A0%87%E7%AD%BE%E9%A1%B5/kmnmkpgmneeokldcmfcgjppgpcfecoed)安装
2. 或手动安装：
   - 下载本扩展的ZIP文件并解压
   - 访问`chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"，选择解压后的文件夹

## 配置选项

在扩展选项页面可以设置：

- 最大保存的标签页数量(1-1000)
- 是否启用右键菜单功能
- 右键菜单中是否显示关闭时间（及显示在左侧或右侧、是否显示两级单位）
- 恢复后是否激活标签页
- 无痕模式下的行为设置

## 隐私声明

本扩展仅记录浏览器本地关闭的标签页信息，不会收集或上传任何用户数据。

## 技术支持

如有问题或建议，请通过以下方式联系：
- 邮箱: ttfdg520cs@gmail.com
- GitHub: 提交Issue
