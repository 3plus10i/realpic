# RealPic 开发文档

本文档记录 RealPic 组件的技术细节，供维护和二次开发参考。

---

## 目录

- [架构设计](#架构设计)
- [配置系统详解](#配置系统详解)
- [核心类说明](#核心类说明)
- [生命周期](#生命周期)
- [主题开发规范](#主题开发规范)
- [性能优化](#性能优化)

---

## 架构设计

### 三层配置结构

```
┌─────────────────────────────────────┐
│  Option（用户传入，每次显示可不同）   │
│  - themePath: 主题路径              │
│  - contents: 内容数组               │
└─────────────┬───────────────────────┘
              ▼
┌─────────────────────────────────────┐
│  Config（主题定义，固定样式）         │
│  - front: 正面配置                  │
│  - back: 背面配置                   │
│  - contentArea: 内容区域定义        │
└─────────────┬───────────────────────┘
              ▼
┌─────────────────────────────────────┐
│  Theme（主题资源包）                 │
│  - config.json                      │
│  - 框架图片资源                     │
└─────────────────────────────────────┘
```

### 核心依赖

- **CSS 3D Transforms**: 实现翻转和透视效果
- **ResizeObserver**: 监听容器尺寸变化
- **ES6 Modules**: 模块化代码组织

---

## 配置系统详解

### SideConfig 配置类型

| 配置形式 | 示例 | 说明 |
|---------|------|------|
| 图片框架 | `{"image": "frame.png"}` | 使用PNG图片作为框架 |
| 尺寸+背景 | `{"width": 800, "height": 600, "background": "#fff"}` | 纯色或渐变背景 |
| 仅背景 | `{"background": "linear-gradient(...)"}` | 使用内容图片尺寸 |
| 最小配置 | `{}` | 默认 `#eee` 背景，使用内容图片尺寸 |

### 尺寸继承规则

1. **realpic尺寸** = front 的尺寸
2. front 的 width/height 默认使用 `front.image` 或内容图片的尺寸
3. back 的 width/height 默认继承 front 的值
4. back 框架图片以 `cover` 方式缩放填充 realpic 尺寸

### ContentArea 默认值

| 属性 | contentArea[0] (front) | contentArea[1] (back) |
|------|------------------------|------------------------|
| x | 0 | 0.1 |
| y | 0 | 0.1 |
| width | 1 | 0.8 |
| height | 1 | 0.8 |
| position | center | center |
| fit | contain | contain |

### 尺寸值格式

支持4种格式，统一通过 `_parseDimension()` 解析：

| 格式 | 示例 | 计算方式 |
|------|------|----------|
| 比例数字 | `0.5` | `0.5 × 基准尺寸` |
| 像素数字 | `560` | `560px` |
| 百分比 | `"50%"` | `0.5 × 基准尺寸` |
| 像素字符串 | `"560px"` | `560px` |

---

## 核心类说明

### ConfigParser

负责解析和规范化 theme config。

```javascript
class ConfigParser {
  static parse(rawConfig, themeBase)     // 解析完整配置
  static _parseSideConfig(sideConfig)    // 解析单面配置
  static _parseContentAreas(areas)       // 解析内容区域
  static _resolveDependencies(config)    // 处理尺寸继承
  static _resolveImagePaths(config, base)// 解析图片路径
  static _validate(config)               // 验证配置
}
```

### RealPic 实例方法

```javascript
class RealPic {
  constructor(container, options?)       // 创建 DOM 结构
  setOptions(options)                    // 更新配置，复用 DOM
  _init()                                // 初始化（首次渲染）
  _loadAndRender()                       // 加载资源并渲染
  _loadConfig()                          // 加载 theme config
  _loadImages()                          // 加载图片资源
  _createContentAreas()                  // 创建内容区域 DOM
  _applyLayout()                         // 计算并应用布局
  _mountContents()                       // 挂载内容
  _bindEvents()                          // 绑定交互事件
  _setupResizeObserver()                 // 监听容器尺寸变化
  show() / hide()                        // 显示/隐藏
  flip() / reset()                       // 翻转控制
  destroy()                              // 清理资源
}
```

---

## 生命周期

```
constructor(container, options?)
  ├── 创建 DOM 结构
  └── options ? setOptions(options) : 等待
         ▼
setOptions(options)
  ├── 保存 options
  └── isInitialized ? _updateContent() : _init()
         ▼
_init()
  ├── _loadAndRender()       // 加载资源并渲染
  ├── _bindEvents()          // 绑定交互事件
  ├── _setupResizeObserver() // 监听容器尺寸变化
  └── show()                 // 显示组件
         ▼
_loadAndRender()
  ├── _loadConfig()          // 加载并解析 theme config
  ├── _loadImages()          // 加载所有图片资源
  ├── getDimensions()        // 计算最终尺寸
  ├── _createContentAreas()  // 创建内容区域 DOM
  ├── _applyLayout()         // 计算并应用布局
  └── _mountContents()       // 挂载内容
         ▼
运行状态（等待交互）
  ├── 鼠标移动 → 透视效果
  ├── 点击 → 翻转 / 关闭
  └── 容器 resize → 重新布局
         ▼
hide()
  ├── 隐藏 DOM (realpic-hidden)
  └── reset()                // 重置 flip 状态
         ▼
destroy()
  ├── cancelAnimationFrame()
  ├── resizeObserver.disconnect()
  └── container.innerHTML = ''
```

### 典型使用流程

```javascript
// 1. 创建实例（初始化 DOM，但不显示）
const realpic = new RealPic(container);

// 2. 显示内容（加载资源、计算布局、显示）
await realpic.setOptions({
  themePath: './themes/postcard/',
  contents: [...]
});

// 3. 用户交互...
realpic.flip();

// 4. 关闭（隐藏 + 重置状态）
realpic.hide();

// 5. 显示新内容（复用 DOM）
await realpic.setOptions({
  themePath: './themes/zmd/',
  contents: [...]
});

// 6. 清理
realpic.destroy();
```

---

## 主题开发规范

### 开发流程

1. **设计框架图片**（可选）
   - 通过平面设计软件绘制框架图片
   - 测量内容区域左上角的像素坐标和宽高
   - 建议PNG格式以便于支持透明通道
   - 建议分辨率匹配显示设备的尺寸

2. **编写 config.json**
   - 定义 front/back 配置
   - 精确配置 contentArea 位置

3. **测试验证**
   - 测试显示效果，观察内容位置、尺寸和样式
   - 横图、竖图、小图、大图，不同容器尺寸

### 最佳实践

**框架设计：**
- 使用 PNG 透明背景，与页面融合
- 内容区域预留充足边距
- 记录设计稿中的内容区域像素坐标

**Config 配置：**
- 优先使用像素值（精确控制）
- 文字区域指定合适的 `fontSize`（建议 16-24px）
- 使用 `position` 控制文字对齐

**示例：完整主题配置**

```json
{
  "front": {
    "image": "./frame-A.png"
  },
  "back": {
    "image": "./frame-B.png",
    "background": "#f5f5f5"
  },
  "contentArea": [
    {
      "area": 0,
      "side": "front",
      "x": 46,
      "y": 46,
      "width": 990,
      "height": 640,
      "fit": "contain"
    },
    {
      "area": 1,
      "side": "back",
      "x": 60,
      "y": 190,
      "width": 480,
      "height": 320,
      "position": "center",
      "style": {
        "color": "#333333",
        "fontSize": "20px",
        "fontFamily": "'Microsoft YaHei', sans-serif"
      }
    }
  ]
}
```

---

## 性能优化

### 实现层面的优化

1. **DOM 复用**: 使用 `setOptions()` 更新内容，避免频繁创建/销毁实例
2. **ResizeObserver**: 使用原生 API 监听尺寸变化，而非轮询
3. **requestAnimationFrame**: 透视动画使用 RAF 确保流畅
4. **图片预加载**: 主题框架图片并行加载

### 使用建议

1. **容器尺寸**: 确保容器有确定的宽高
2. **图片优化**: 选用尺寸匹配的主题和图片
3. **实例复用**: 复用实例，使用 `setOptions()` 更新内容

---

## 浏览器兼容性

| 特性 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| CSS 3D Transforms | 12+ | 10+ | 4+ | 12+ |
| ResizeObserver | 64+ | 69+ | 13.1+ | 79+ |
| ES6 Modules | 61+ | 60+ | 10.1+ | 16+ |

最低支持版本：Chrome 60+, Firefox 55+, Safari 12+, Edge 79+

---

## 代码结构

```
realpic/
├── realpic.js          # 核心组件（RealPic 类 + ConfigParser）
├── realpic.css         # 组件样式（3D翻转、布局）
├── realpic_viewer.js   # 查看器封装（RealPicViewer）
├── realpic_viewer.css  # 查看器样式（蒙版、控制按钮）
├── themes/             # 主题包
│   ├── default/
│   ├── postcard/
│   └── card-*/
└── fonts/              # 字体文件
```

---

## 修改记录

- **v1.0** - 初始版本，支持基础3D翻转和主题系统
