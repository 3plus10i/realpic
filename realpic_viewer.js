/**
 * RealPicViewer - 可复用的大图查看蒙版组件
 * 
 * 功能：为图片提供统一的模态框查看体验，支持3D翻转展示图片描述
 */

import RealPic, { parseLightMD } from './realpic.js';

/**
 * @typedef {Object} ViewerOptions
 * @property {string} modalId - 蒙版DOM元素ID (默认: 'viewerModal')
 * @property {string} containerId - 容器DOM元素ID (默认: 'viewerContainer')
 * @property {string} titleId - 标题元素ID (默认: 'viewerTitle')
 * @property {string} closeBtnId - 关闭按钮ID (默认: 'viewerCloseBtn')
 * @property {string} flipBtnId - 翻转按钮ID (默认: 'viewerFlipBtn')
 * @property {string} originPath - 原图基础路径
 * @property {string} themesPath - 主题基础路径
 * @property {Function} [onOpen] - 打开时的回调
 * @property {Function} [onClose] - 关闭时的回调
 * @property {string} [defaultTheme] - 默认主题名称 (默认: 'zmd')
 */

export class RealPicViewer {
    constructor(options = {}) {
        this.options = {
            modalId: 'viewerModal',
            containerId: 'viewerContainer',
            titleId: 'viewerTitle',
            descriptionId: 'viewerDescription',
            closeBtnId: 'viewerCloseBtn',
            flipBtnId: 'viewerFlipBtn',
            originPath: '/images/',
            themesPath: '/static/realpic/themes/',
            defaultTheme: '',
            loadingImage: '/static/realpic/blocks-shuffle-2.svg',
            onOpen: null,
            onClose: null,
            ...options
        };
        
        this.modal = document.getElementById(this.options.modalId);
        this.container = document.getElementById(this.options.containerId);
        this.titleEl = document.getElementById(this.options.titleId);
        this.descriptionEl = document.getElementById(this.options.descriptionId);
        this.closeBtn = document.getElementById(this.options.closeBtnId);
        this.flipBtn = document.getElementById(this.options.flipBtnId);
        
        this.realpic = null;
        this.isOpen = false;
        
        this._boundKeyHandler = this._handleKeydown.bind(this);
        this._boundClickHandler = this._handleClick.bind(this);
        
        this.init();
    }
    
    init() {
        if (!this.modal || !this.container) {
            console.error('RealPicViewer: 找不到必要的DOM元素');
            return;
        }
        
        // 创建加载动画元素
        this._createLoadingElement();
        
        // 初始化 RealPic 实例
        this.realpic = new RealPic(this.container);
        
        // 绑定关闭事件
        this.closeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
        });
        
        // 绑定翻转事件
        this.flipBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.realpic?.flip();
        });
        
        // 绑定点击和键盘事件
        this.modal.addEventListener('click', this._boundClickHandler);
        document.addEventListener('keydown', this._boundKeyHandler);
    }
    
    /**
     * 创建加载动画元素
     * @private
     */
    _createLoadingElement() {
        // 检查是否已存在
        if (this.modal.querySelector('.viewer-loading')) {
            return;
        }
        
        const loadingEl = document.createElement('div');
        loadingEl.className = 'viewer-loading';
        
        const img = document.createElement('img');
        img.src = this.options.loadingImage;
        img.alt = '加载中';
        img.width = 80;
        img.height = 80;
        
        loadingEl.appendChild(img);
        this.modal.appendChild(loadingEl);
    }
    
    /**
     * 处理点击事件
     */
    _handleClick(e) {
        // 点击背景关闭
        if (e.target === this.modal) {
            this.close();
            return;
        }
        
        // 点击realpic-root本身关闭（非框架区域）
        const isFrontOrBack = e.target.classList.contains('realpic-root');
        if (isFrontOrBack) {
            this.close();
            return;
        }
        
        // 点击框架内容区域翻转
        const isFrame = e.target.classList.contains('realpic-frame') || 
                        e.target.closest('.realpic-frame');
        if (isFrame) {
            this.realpic?.flip();
        }
    }
    
    /**
     * 处理键盘事件
     */
    _handleKeydown(e) {
        if (e.key === 'Escape' && this.isOpen) {
            this.close();
        }
    }
    
    /**
     * 获取主题路径
     */
    getThemePath(theme) {
        if (!theme || theme.trim() === '') {
            return `${this.options.themesPath}${this.options.defaultTheme}/`;
        }
        return `${this.options.themesPath}${theme}/`;
    }
    
    /**
     * 显示图片
     * @param {Object} image - 图片元数据 { filename, title, description, postscript, theme }
     */
    async show(image) {
        if (!this.realpic) return;
        
        // 如果正在加载中，忽略此次点击
        if (this.isLoading) return;
        this.isLoading = true;
        
        // 执行打开回调
        if (this.options.onOpen) {
            await this.options.onOpen(image);
        }
        
        // 设置标题
        if (this.titleEl) {
            this.titleEl.textContent = image.title || '';
        }
        
        // 设置描述（显示在标题下方，支持轻量级 Markdown）
        if (this.descriptionEl) {
            this.descriptionEl.innerHTML = parseLightMD(image.description || '');
        }
        
        // 获取主题路径
        const themePath = this.getThemePath(image.theme);
        
        // 先显示模态框和加载动画
        this.modal.classList.add('active');
        this.modal.classList.add('loading');
        document.body.style.overflow = 'hidden';
        this.isOpen = true;
        
        try {
            // 预加载所有资源（大图 + 主题图片）
            await this._preloadResources(image, themePath);
            
            // 资源就绪后，设置 RealPic 内容并渲染
            await this.realpic.setOptions({
                themePath: themePath,
                contents: [
                    { 
                        area: 0,
                        type: 'image', 
                        src: `${this.options.originPath}${image.filename}`,
                        alt: image.title 
                    },
                    { 
                        area: 1,
                        type: 'text', 
                        content: image.postscript || ''
                    }
                ]
            });
        } catch (error) {
            console.error('加载图片失败:', error);
        } finally {
            // 移除加载状态，显示内容
            this.modal.classList.remove('loading');
            this.isLoading = false;
        }
    }
    
    /**
     * 预加载所有必需资源
     * @private
     */
    async _preloadResources(image, themePath) {
        const resourcesToLoad = [];
        
        // 1. 预加载大图
        const originUrl = `${this.options.originPath}${image.filename}`;
        resourcesToLoad.push(this._preloadImage(originUrl));
        
        // 2. 加载主题配置并预加载主题图片
        try {
            const configUrl = `${themePath}config.json`;
            const configResponse = await fetch(configUrl);
            if (configResponse.ok) {
                const config = await configResponse.json();
                // 预加载主题 front/back 图片
                if (config.front?.image) {
                    resourcesToLoad.push(this._preloadImage(`${themePath}${config.front.image}`));
                }
                if (config.back?.image) {
                    resourcesToLoad.push(this._preloadImage(`${themePath}${config.back.image}`));
                }
            }
        } catch (e) {
            // 主题配置加载失败不影响主图显示
        }
        
        // 等待所有资源加载完成
        await Promise.all(resourcesToLoad);
    }
    
    /**
     * 预加载单张图片
     * @private
     */
    _preloadImage(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null); // 加载失败也继续
            img.src = url;
        });
    }
    
    /**
     * 关闭模态框
     */
    close() {
        if (!this.isOpen) return;
        
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.isOpen = false;
        
        // 延迟隐藏组件
        setTimeout(() => {
            this.realpic?.hide();
        }, 300);
        
        // 执行关闭回调
        if (this.options.onClose) {
            setTimeout(() => this.options.onClose(), 300);
        }
    }
    
    /**
     * 销毁组件
     */
    destroy() {
        this.modal?.removeEventListener('click', this._boundClickHandler);
        document.removeEventListener('keydown', this._boundKeyHandler);
        this.realpic?.destroy();
        this.realpic = null;
    }
}

export default RealPicViewer;
