# <img src="icons/icon128.png" width="36" height="36" alt="Style Scope icon" align="center" /> Style Scope

一个 Chrome 扩展：悬停网页元素即可查看其计算样式、盒模型、内嵌间距与对象间距离。

## 功能

- 悬停预览，点击锁定元素
- 查看字体、字号、颜色及透明度、边框、阴影与背景
- 直接标注 margin、border、padding、content，以及图标与文字之间的 `gap`
- 选中对象后悬停另一个对象，显示 `X / Y` 边缘距离
- 父子包含关系显示 `T / R / B / L` 四边内嵌距离
- 复制资源时保留原始格式：PNG/JPG/WebP 保持原文件，内联 SVG 保持 SVG
- `⌘ + E` 开关检视；`Esc` 立即退出

## 安装

1. 打开 `chrome://extensions`
2. 开启「开发者模式」
3. 选择「加载已解压的扩展程序」
4. 选择本项目目录

## 使用

按 `⌘ + E` 开关检视。按一次开启，再按一次关闭；`Esc` 也会立即退出。开启后移动鼠标预览元素，点击即可锁定，点击其他元素可重新选择。

## 本地演示

运行任意静态服务器后打开 `demo.html`。例如：

```bash
python3 -m http.server 4173
```

然后访问 `http://127.0.0.1:4173/demo.html`。
