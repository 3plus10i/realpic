/**
 * RealPic - 装裱式双面展示器
 * 将内容放入主题框架，支持 3D 翻转效果
 * 
 * option配置规范:
 * - themePath: 主题文件夹路径（必选）
 * - contents: 内容数组，必须与 contentArea 匹配（必选）
 *   - 第0项: image 类型，对应 contentArea[0] (front)
 *   - 第1项: text 类型，对应 contentArea[1] (back)
 */

const PERSPECTIVE_MAX_ROTATION = 4; // PC端最大旋转角度（度）
const PERSPECTIVE_MAX_ROTATION_MOBILE = 12; // 移动端最大旋转角度（度）
const DEFAULT_BACKGROUND = '#eeeeee';
const DEFAULT_FONT_SCALE = 0.03; // 默认字体为 realpic 宽度的多少（推荐2.5%）

// 动态导入 marked 库（ESM 方式）
let markedPromise = null;
async function getMarked() {
    if (!markedPromise) {
        markedPromise = import('https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.min.js')
            .then(m => m.marked)
            .catch(() => null);
    }
    return markedPromise;
}

/**
 * 处理链接，添加安全属性
 * @param {string} html - HTML 字符串
 * @returns {string} 处理后的 HTML
 */
function processLinks(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    tempDiv.querySelectorAll('a').forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        link.classList.add('viewer-md-link');
    });
    return tempDiv.innerHTML;
}

/**
 * Markdown 解析器（基于 marked）
 * 支持标准 Markdown 语法
 * @param {string} md - Markdown 文本
 * @returns {Promise<string>} HTML
 */
export async function parseLightMD(md) {
    if (!md || typeof md !== 'string') return '';

    const marked = await getMarked();
    if (marked) {
        try {
            const html = marked.parse(md);
            return processLinks(html);
        } catch (e) {
            console.warn('Marked parse error:', e);
        }
    }

    // Fallback: 基础格式支持
    return md
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/~~([^~]+)~~/g, '<del>$1</del>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="viewer-md-link">$1</a>')
        .replace(/\n/g, '<br>');
}

/**
 * 配置解析器 - 负责解析和规范化 theme config
 */
class ConfigParser {
    /**
     * 解析完整的配置
     * @param {Object} rawConfig - 原始配置
     * @param {string} themeBase - 主题基础路径
     * @returns {Object} 规范化后的配置
     */
    static parse(rawConfig, themeBase) {
        const config = {
            front: this._parseSideConfig(rawConfig.front || {}),
            back: this._parseSideConfig(rawConfig.back || {}),
            contentArea: this._parseContentAreas(rawConfig.contentArea || [])
        };

        // 解析第二阶段：处理依赖关系
        this._resolveDependencies(config);

        // 解析图片路径
        this._resolveImagePaths(config, themeBase);

        // 验证配置
        this._validate(config);

        return config;
    }

    /**
     * 解析单面配置
     * @private
     */
    static _parseSideConfig(sideConfig) {
        const result = {
            image: sideConfig.image || null,
            background: sideConfig.background || DEFAULT_BACKGROUND,
            width: sideConfig.width ?? null,
            height: sideConfig.height ?? null
        };

        // 如果是空对象{}，保持background默认值
        if (!sideConfig.image && !sideConfig.width && !sideConfig.height && !sideConfig.background) {
            result.background = DEFAULT_BACKGROUND;
        }

        return result;
    }

    /**
     * 解析内容区域配置
     * @private
     */
    static _parseContentAreas(areas) {
        if (!Array.isArray(areas) || areas.length === 0) {
            // 默认提供两个区域
            return [
                { area: 0, side: 'front' },
                { area: 1, side: 'back' }
            ];
        }

        return areas.map((area, index) => ({
            area: area.area ?? index,
            side: area.side || (index === 0 ? 'front' : 'back'),
            x: area.x ?? (index === 0 ? 0 : 0.1),
            y: area.y ?? (index === 0 ? 0 : 0.1),
            width: area.width ?? (index === 0 ? 1 : 0.8),
            height: area.height ?? (index === 0 ? 1 : 0.8),
            position: area.position || 'center',
            fit: area.fit || 'contain',
            style: area.style || {}
        }));
    }

    /**
     * 解析依赖关系
     * - back的width/height默认使用front的值
     * @private
     */
    static _resolveDependencies(config) {
        // back的宽高默认继承front
        if (config.back.width === null) {
            config.back.width = config.front.width;
        }
        if (config.back.height === null) {
            config.back.height = config.front.height;
        }
    }

    /**
     * 解析图片路径为绝对路径
     * @private
     */
    static _resolveImagePaths(config, themeBase) {
        if (!themeBase) return;

        const base = themeBase.endsWith('/') ? themeBase : themeBase + '/';

        if (config.front.image) {
            config.front.image = this._resolvePath(config.front.image, base);
        }
        if (config.back.image) {
            config.back.image = this._resolvePath(config.back.image, base);
        }
    }

    /**
     * 解析相对路径
     * @private
     */
    static _resolvePath(path, base) {
        if (path.startsWith('http') || path.startsWith('/')) {
            return path;
        }
        if (path.startsWith('./')) {
            return base + path.slice(2);
        }
        return base + path;
    }

    /**
     * 验证配置有效性
     * @private
     */
    static _validate(config) {
        // 检查contentArea[0]必须是front
        if (config.contentArea[0]?.side !== 'front') {
            console.warn('Config warning: contentArea[0] should have side="front"');
        }
        // 检查contentArea[1]必须是back
        if (config.contentArea[1]?.side !== 'back') {
            console.warn('Config warning: contentArea[1] should have side="back"');
        }
    }

    /**
     * 获取解析后的尺寸（在加载图片后调用）
     * @param {Object} config - 解析后的配置
     * @param {Object} loadedImages - 已加载的图片信息
     * @returns {Object} { front: {width, height}, back: {width, height}, realpic: {width, height} }
     */
    static getDimensions(config, loadedImages) {
        // 确定 front 尺寸
        let frontWidth = config.front.width;
        let frontHeight = config.front.height;

        // 如果front没有指定尺寸，使用front图片尺寸
        if (frontWidth === null || frontHeight === null) {
            const frontImg = loadedImages.frontFrame;
            if (frontImg) {
                frontWidth = frontWidth ?? frontImg.width;
                frontHeight = frontHeight ?? frontImg.height;
            }
        }

        // 如果还是没有，使用content图片尺寸
        if (frontWidth === null || frontHeight === null) {
            const contentImg = loadedImages.content_0;
            if (contentImg) {
                frontWidth = frontWidth ?? contentImg.width;
                frontHeight = frontHeight ?? contentImg.height;
            }
        }

        // 最终fallback：使用默认值
        frontWidth = frontWidth ?? 800;
        frontHeight = frontHeight ?? 600;

        // back尺寸继承front或用自己的配置
        let backWidth = config.back.width ?? frontWidth;
        let backHeight = config.back.height ?? frontHeight;

        return {
            front: { width: frontWidth, height: frontHeight },
            back: { width: backWidth, height: backHeight },
            realpic: { width: frontWidth, height: frontHeight }
        };
    }
}

/**
 * RealPic 主类
 */
export default class RealPic {
    /**
     * @param {HTMLElement} container - 父容器
     * @param {Object} options - 配置选项（可选，不传则延迟初始化）
     */
    constructor(container, options = null) {
        if (!container) {
            throw new Error('Container element is required');
        }

        this.container = container;
        this.options = null;
        this.isFlipped = false;
        this.isAnimating = false;
        this.parsedConfig = null;
        this.dimensions = null;
        this.loadedImages = {};
        this.contentAreas = new Map();
        this.resizeObserver = null;
        this.resizeTimeout = null;
        this.rafId = null;
        this.isInitialized = false;

        this._createDOM();

        if (options) {
            this.setOptions(options);
        }
    }

    /**
     * 设置选项并初始化/更新
     * @param {Object} options - 配置选项
     */
    async setOptions(options) {
        this.options = options;

        if (!this.isInitialized) {
            await this._init();
            this.isInitialized = true;
        } else {
            await this._updateContent();
        }
    }

    /**
     * 初始化组件
     * @private
     */
    async _init() {
        await this._loadAndRender();

        // 设置 ResizeObserver
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                clearTimeout(this.resizeTimeout);
                this.resizeTimeout = setTimeout(() => {
                    if (this.isInitialized) this._applyLayout();
                }, 100);
            });
            this.resizeObserver.observe(this.container);
        }

        this.show();
    }

    /**
     * 更新内容（复用 DOM）
     * @private
     */
    async _updateContent() {
        this.reset();
        this._clearFrames();
        this.contentAreas.clear();
        try {
            await this._loadAndRender();
            this.show();
        } catch (error) {
            console.error('更新内容失败:', error);
        }
    }

    /**
     * 清空框架内容和样式
     * @private
     */
    _clearFrames() {
        [this.frontFrame, this.backFrame].forEach(frame => {
            frame.innerHTML = '';
            frame.style.cssText = '';
            frame.className = 'realpic-frame';
        });
    }

    /**
     * 加载资源并渲染
     * @private
     */
    async _loadAndRender() {
        // 1. 加载并解析主题配置
        await this._loadConfig();

        // 2. 加载所有图片资源
        await this._loadImages();

        // 3. 计算最终尺寸
        this.dimensions = ConfigParser.getDimensions(this.parsedConfig, this.loadedImages);

        // 4. 创建内容区域
        this._createContentAreas();

        // 5. 计算并应用布局
        this._applyLayout();

        // 6. 挂载内容
        await this._mountContents();
    }

    /**
     * 加载主题配置
     * @private
     */
    async _loadConfig() {
        const themeBase = this.options?.themePath;

        if (!themeBase) {
            throw new Error('themePath is required in options');
        }

        const configPath = (themeBase.endsWith('/') ? themeBase : themeBase + '/') + 'config.json';

        try {
            const response = await fetch(configPath);
            if (!response.ok) {
                throw new Error(`Failed to load theme config: ${configPath}`);
            }
            const rawConfig = await response.json();
            this.parsedConfig = ConfigParser.parse(rawConfig, themeBase);
        } catch (error) {
            console.error('Failed to load theme:', error);
            // 使用最小默认配置
            this.parsedConfig = ConfigParser.parse({}, themeBase);
        }
    }

    /**
     * 加载图片资源
     * @private
     */
    async _loadImages() {
        const loadSingle = (url, key) => new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                this.loadedImages[key] = { width: img.naturalWidth, height: img.naturalHeight, url, element: img };
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`Failed to load image: ${url}`);
                resolve(null);
            };
            img.src = url;
        });

        const tasks = [];
        this.loadedImages = {};

        if (this.parsedConfig.front.image) tasks.push(loadSingle(this.parsedConfig.front.image, 'frontFrame'));
        if (this.parsedConfig.back.image) tasks.push(loadSingle(this.parsedConfig.back.image, 'backFrame'));

        const contents = this.options.contents || [];
        contents.forEach((content, index) => {
            if (content.type === 'image' && content.src) {
                tasks.push(loadSingle(content.src, `content_${index}`));
            }
        });

        await Promise.all(tasks);
    }

    /**
     * 创建内容区域
     * @private
     */
    _createContentAreas() {
        this.contentAreas.clear();
        
        // 清空现有框架内容，确保无残留
        this.frontFrame.innerHTML = '';
        this.backFrame.innerHTML = '';

        this.parsedConfig.contentArea.forEach(areaConfig => {
            const side = areaConfig.side;
            const parentFrame = side === 'front' ? this.frontFrame : this.backFrame;

            const areaEl = document.createElement('div');
            areaEl.className = 'realpic-content-area';
            areaEl.dataset.areaId = areaConfig.area;
            areaEl.dataset.side = side;
            areaEl.dataset.position = areaConfig.position;
            areaEl.dataset.fit = areaConfig.fit;

            parentFrame.appendChild(areaEl);

            this.contentAreas.set(areaConfig.area, {
                element: areaEl,
                config: areaConfig,
                side: side
            });
        });
    }

    /**
     * 应用布局
     * @private
     */
    _applyLayout() {
        const containerRect = this.rootElement.getBoundingClientRect();
        const containerW = containerRect.width;
        const containerH = containerRect.height;

        const realpicSize = this.dimensions.realpic;

        // 等比例缩放以适应容器，充分利用容器空间
        const scale = Math.min(
            containerW / realpicSize.width,
            containerH / realpicSize.height
        );

        const scaledW = realpicSize.width * scale;
        const scaledH = realpicSize.height * scale;

        // 应用 viewport 尺寸
        this.perspectiveWrapper.style.width = `${scaledW}px`;
        this.perspectiveWrapper.style.height = `${scaledH}px`;

        // 应用 front 布局
        this._applyFrameLayout('front', this.frontFrame, scaledW, scaledH);

        // 应用 back 布局
        this._applyFrameLayout('back', this.backFrame, scaledW, scaledH);

        // 应用内容区域布局
        this.contentAreas.forEach((areaInfo) => {
            this._applyAreaLayout(areaInfo);
        });
    }

    /**
     * 应用单面框架布局
     * @private
     */
    _applyFrameLayout(side, frameEl, viewportW, viewportH) {
        const config = this.parsedConfig[side];
        const sideDimensions = this.dimensions[side];

        // 计算该面在realpic尺寸内的缩放
        const sideScale = Math.min(
            viewportW / sideDimensions.width,
            viewportH / sideDimensions.height
        );

        const frameW = sideDimensions.width * sideScale;
        const frameH = sideDimensions.height * sideScale;
        const offsetX = (viewportW - frameW) / 2;
        const offsetY = (viewportH - frameH) / 2;

        frameEl.style.width = `${frameW}px`;
        frameEl.style.height = `${frameH}px`;
        frameEl.style.left = `${offsetX}px`;
        frameEl.style.top = `${offsetY}px`;

        // 应用背景
        if (config.image && this.loadedImages[`${side}Frame`]) {
            frameEl.style.backgroundImage = `url('${config.image}')`;
            frameEl.style.backgroundSize = `${frameW}px ${frameH}px`;
            frameEl.style.backgroundColor = 'transparent';
        } else {
            frameEl.style.backgroundImage = 'none';
            frameEl.style.backgroundColor = config.background;
        }

        // 保存缩放信息供后续使用
        this[`_${side}Scale`] = sideScale;
        this[`_${side}FrameSize`] = { width: frameW, height: frameH };
    }

    /**
     * 应用内容区域布局
     * @private
     */
    _applyAreaLayout(areaInfo) {
        const { element: areaEl, config, side } = areaInfo;
        const sideScale = this[`_${side}Scale`] || 1;
        const sideDimensions = this.dimensions[side];

        // 解析尺寸值
        const x = this._parseDimension(config.x, sideDimensions.width) * sideScale;
        const y = this._parseDimension(config.y, sideDimensions.height) * sideScale;
        const width = this._parseDimension(config.width, sideDimensions.width) * sideScale;
        const height = this._parseDimension(config.height, sideDimensions.height) * sideScale;

        areaEl.style.left = `${x}px`;
        areaEl.style.top = `${y}px`;
        areaEl.style.width = `${width}px`;
        areaEl.style.height = `${height}px`;

        // 应用样式（将 camelCase 转为 kebab-case）
        if (config.style) {
            for (const [key, value] of Object.entries(config.style)) {
                const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                areaEl.style[cssKey] = value;
            }
        }
    }

    /**
     * 解析尺寸值
     * @private
     */
    _parseDimension(value, baseSize) {
        if (typeof value === 'string') {
            value = value.trim();
            if (value.endsWith('%')) {
                return parseFloat(value) / 100 * baseSize;
            } else if (value.endsWith('px')) {
                return parseFloat(value);
            } else {
                const num = parseFloat(value);
                return num <= 1 ? num * baseSize : num;
            }
        }
        return value <= 1 ? value * baseSize : value;
    }

    /**
     * 挂载内容
     * @private
     */
    async _mountContents() {
        const contents = this.options.contents || [];

        const tasks = contents.map(async (contentData, index) => {
            const areaId = contentData.area !== undefined ? contentData.area : index;
            const areaInfo = this.contentAreas.get(areaId);

            if (!areaInfo) {
                console.warn(`Content area ${areaId} not found`);
                return;
            }

            const { element: areaEl, config: areaConfig } = areaInfo;

            // 根据类型挂载内容
            if (contentData.type === 'image') {
                this._mountImageContent(areaEl, contentData);
            } else if (contentData.type === 'text') {
                await this._mountTextContent(areaEl, contentData, areaConfig);
            }
        });

        await Promise.all(tasks);
    }

    /**
     * 挂载图片内容
     * @private
     */
    _mountImageContent(areaEl, contentData) {
        areaEl.innerHTML = ''; // 清空之前的内容，防止重影
        const img = document.createElement('img');
        img.src = contentData.src || '';
        img.alt = contentData.alt || '';
        areaEl.appendChild(img);
    }

    /**
     * 挂载文本内容（使用 SVG foreignObject 实现完美缩放）
     * @private
     */
    async _mountTextContent(areaEl, contentData, areaConfig) {
        const side = areaConfig.side;
        const sideDimensions = this.dimensions[side];
        // 这里不能只基于宽度，因为有些瘦高图片的超高会导致放缩，进而导致基于宽度的字号太小
        const realpicRange = Math.max(this.dimensions.realpic.width, this.dimensions.realpic.height);

        // 使用设计尺寸（未缩放前的原始尺寸）
        const width = this._parseDimension(areaConfig.width, sideDimensions.width);
        const height = this._parseDimension(areaConfig.height, sideDimensions.height);

        // 计算字体大小：优先使用 theme 指定的 fontSize，否则按 realpic 宽度的 2.5%
        const fontSizeValue = areaConfig.style?.fontSize;
        let fontSize;
        if (fontSizeValue) {
            fontSize = typeof fontSizeValue === 'string' ? parseFloat(fontSizeValue) || realpicRange * DEFAULT_FONT_SCALE : fontSizeValue;
        } else {
            fontSize = realpicRange * DEFAULT_FONT_SCALE;
        }

        // 解析位置为 flex 对齐值
        const alignMap = {
            top: ['flex-start', 'center', 'center'],
            bottom: ['flex-end', 'center', 'center'],
            left: ['center', 'flex-start', 'left'],
            right: ['center', 'flex-end', 'right'],
            center: ['center', 'center', 'center']
        };
        const [alignItems, justifyContent, textAlign] = alignMap[areaConfig.position || 'center'];

        const htmlContent = await parseLightMD(contentData.content || '');

        areaEl.innerHTML = `
            <svg viewBox="0 0 ${width} ${height}" 
                 preserveAspectRatio="xMidYMid meet"
                 width="100%" height="100%"
                 style="display: block;">
                <foreignObject width="${width}" height="${height}">
                    <div xmlns="http://www.w3.org/1999/xhtml" 
                         class="realpic-text-content"
                         style="width: ${width}px; height: ${height}px; overflow: hidden; display: flex; align-items: ${alignItems}; justify-content: ${justifyContent}; font-size: ${fontSize}px;">
                        <div style="width: 100%; text-align: ${textAlign};">${htmlContent}</div>
                    </div>
                </foreignObject>
            </svg>
        `;
        // <div style="width: 100%; text-align: ${textAlign};">${htmlContent}</div>
    }

    /**
     * 创建 DOM 结构
     * @private
     */
    _createDOM() {
        this.container.innerHTML = '';
        this.container.classList.add('realpic-mount-point');

        // 根容器
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'realpic-root realpic-hidden';

        // 透视旋转层
        this.perspectiveWrapper = document.createElement('div');
        this.perspectiveWrapper.className = 'realpic-viewport';

        // 翻转器
        this.flipper = document.createElement('div');
        this.flipper.className = 'realpic-flipper';

        // 正面
        this.frontElement = document.createElement('div');
        this.frontElement.className = 'realpic-front';
        this.frontFrame = document.createElement('div');
        this.frontFrame.className = 'realpic-frame';
        this.frontElement.appendChild(this.frontFrame);

        // 背面
        this.backElement = document.createElement('div');
        this.backElement.className = 'realpic-back';
        this.backFrame = document.createElement('div');
        this.backFrame.className = 'realpic-frame';
        this.backElement.appendChild(this.backFrame);

        // 组装
        this.flipper.appendChild(this.frontElement);
        this.flipper.appendChild(this.backElement);
        this.perspectiveWrapper.appendChild(this.flipper);
        this.rootElement.appendChild(this.perspectiveWrapper);
        this.container.appendChild(this.rootElement);

        // 绑定事件
        this._bindFrameEvents(this.frontFrame);
        this._bindFrameEvents(this.backFrame);
        this.rootElement.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link) e.stopPropagation();
        });
    }

    /**
     * 绑定单个 frame 的事件
     * @private
     */
    _bindFrameEvents(frameEl) {
        // 更新坐标并调度透视更新
        const updatePointer = (x, y) => {
            if (this.isAnimating) return;
            this._lastMouseX = x;
            this._lastMouseY = y;
            if (!this._rafPending) {
                this._rafPending = true;
                this.rafId = requestAnimationFrame(() => {
                    this._rafPending = false;
                    this._updatePerspective();
                });
            }
        };

        frameEl.addEventListener('mousemove', (e) => updatePointer(e.clientX, e.clientY));
        frameEl.addEventListener('mouseleave', () => {
            this._lastMouseX = undefined;
            this._lastMouseY = undefined;
            this._updatePerspective();
        });
        frameEl.addEventListener('touchstart', (e) => {
            if (this.isAnimating) return;
            const touch = e.touches[0];
            this._isTouching = true;
            this._lastMouseX = touch.clientX;
            this._lastMouseY = touch.clientY;
            this._updatePerspective();
        }, { passive: false });
        frameEl.addEventListener('touchmove', (e) => {
            if (!this._isTouching || this.isAnimating) return;
            const touch = e.touches[0];
            updatePointer(touch.clientX, touch.clientY);
        }, { passive: false });
        frameEl.addEventListener('touchend', () => {
            this._isTouching = false;
            this._lastMouseX = undefined;
            this._lastMouseY = undefined;
            this._updatePerspective();
        });
    }

    /**
     * 更新透视效果
     * @private
     */
    _updatePerspective() {
        if (this.isAnimating || this._lastMouseX === undefined) return;

        // 使用 realpic-viewport 计算偏移
        const rect = this.perspectiveWrapper.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // 计算相对于中心的偏移比例（-1 到 1）
        const offsetX = (this._lastMouseX - centerX) / (rect.width / 2);
        const offsetY = (centerY - this._lastMouseY) / (rect.height / 2);

        // 根据设备类型选择最大旋转角度
        const maxRotation = this._isTouching ? PERSPECTIVE_MAX_ROTATION_MOBILE : PERSPECTIVE_MAX_ROTATION;

        // 基于偏移比例计算旋转角度
        const rotateX = offsetY * maxRotation;
        const rotateY = offsetX * maxRotation;

        this.perspectiveWrapper.style.transform = 
            `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`;
    }


    /**
     * 翻转
     */
    flip() {
        if (this.isAnimating) return;

        this.isAnimating = true;
        this.isFlipped = !this.isFlipped;

        this.perspectiveWrapper.style.transform = 'rotateX(0) rotateY(0) translateZ(0)';

        if (this.isFlipped) {
            this.rootElement.classList.add('realpic-flipped');
        } else {
            this.rootElement.classList.remove('realpic-flipped');
        }

        setTimeout(() => {
            this.isAnimating = false;
        }, 600);
    }

    /**
     * 重置到正面
     */
    reset() {
        this.isFlipped = false;
        this.rootElement.classList.remove('realpic-flipped');
    }

    /**
     * 显示组件
     */
    show() {
        if (this.rootElement) {
            this.rootElement.classList.remove('realpic-hidden');
        }
    }

    /**
     * 隐藏组件
     */
    hide() {
        if (this.rootElement) {
            this.rootElement.classList.add('realpic-hidden');
        }
        // 重置flip状态，确保下次打开时从正面开始
        this.reset();
    }

    /**
     * 检查是否可见
     * @returns {boolean}
     */
    isVisible() {
        return this.rootElement && !this.rootElement.classList.contains('realpic-hidden');
    }

    /**
     * 销毁组件
     */
    destroy() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        clearTimeout(this.resizeTimeout);

        this.container.innerHTML = '';
        this.container.classList.remove('realpic-mount-point');

        this.contentAreas.clear();
    }
}
