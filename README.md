# RealPic - 装裱式双面展示器

使用Realpic将图文内容放入主题框架，支持 3D 翻转效果与鼠标跟随透视。

## 特性

- **3D 翻转** - 流畅的 CSS 3D 翻转动画
- **透视跟随** - 鼠标/触摸移动时产生立体透视效果
- **主题框架** - 将内容装入主题边框中
- **智能适配** - 自动缩放适配不同尺寸容器
- **Markdown支持** - 文字内容支持使用 Markdown 格式

## 快速开始

```html
<link rel="stylesheet" href="./realpic.css">
<!-- 挂载容器必须具有指明的宽高 -->
<div id="container" style="width: 80vw; height: 80vh;"></div>

<script type="module">
  import RealPic from './realpic.js';
  
  const realpic = new RealPic(document.getElementById('container'));
  
  await realpic.setOptions({
    themePath: './themes/postcard/',
    contents: [
      { type: 'image', src: './photo.jpg' },
      { type: 'text', content: '**标题**\n描述文字' }
    ]
  });
</script>
```

## 配置

### Option（用户配置）

```javascript
{
  themePath: './themes/postcard/',  // 主题文件夹路径
  contents: [                        // 内容数组
    { type: 'image', src: './photo.jpg' },    // 第0项：图片（正面）
    { type: 'text', content: '描述文字' }      // 第1项：文字（背面）
  ]
}
```

内容类型：
- `image`: `src` - 图片URL, `alt` - 替代文本
- `text`: `content` - 文本内容（支持 标准Markdown）
* 在前端文本框中输入的文本需要使用空格+回车以换行.

### Config（主题配置）

主题文件夹中的 `config.json`：

```json
{
  "front": { "image": "./frame-A.png" },
  "back": { "image": "./frame-B.png", "background": "#f5f5f5" },
  "contentArea": [
    { "area": 0, "side": "front", "x": 46, "y": 46, "width": 990, "height": 640 },
    // 尺寸支持百分比写法
    { "area": 1, "side": "back", "x": "10%", "y": "20%", "width": "50%", "height": "50%",
      "style": { "color": "#333", "fontSize": "20px" }
    }
  ]
}
```

配置说明：
- `front/back.image`: 框架图片路径（可选）
- `front/back.background`: 背景色或渐变（可选，默认 `#eee`）
- `contentArea`: 内容区域定义
  - `x, y`: 左上角坐标（像素）
  - `width, height`: 区域尺寸
  - `position`: 位置（`left`/`right`/`top`/`bottom`）
  - `fit`: 图片适配方式（`contain`/`cover`/`stretch`）
  - `style`: CSS 样式（文字颜色、字体大小等）

## API

| 方法 | 说明 |
|------|------|
| `setOptions(options)` | 更新配置并重新渲染 |
| `flip()` | 触发3D翻转到另一面 |
| `show()` / `hide()` | 显示/隐藏组件（hide会重置翻转） |
| `reset()` | 重置翻转状态到正面 |
| `destroy()` | 销毁组件，清理DOM和事件 |

## 主题开发

1. **设计框架图片**（推荐使用在线矢量设计工具Pixso）
2. **测量内容区域**的像素坐标和尺寸
3. **编写 config.json** 配置位置和样式，设计附加样式
4. **测试验证**不同尺寸的图片显示效果（将素材放到ppt里是个方便的手动测试方式）
