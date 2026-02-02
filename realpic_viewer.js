/**
 * RealPicViewer - 可复用的大图查看蒙版组件
 * 
 * 功能：为图片提供统一的模态框查看体验，支持3D翻转展示图片描述
 */

import RealPic from './realpic.js';

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
            closeBtnId: 'viewerCloseBtn',
            flipBtnId: 'viewerFlipBtn',
            originPath: '/images/',
            themesPath: '/static/realpic/themes/',
            defaultTheme: 'zmd',
            onOpen: null,
            onClose: null,
            ...options
        };
        
        this.modal = document.getElementById(this.options.modalId);
        this.container = document.getElementById(this.options.containerId);
        this.titleEl = document.getElementById(this.options.titleId);
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
     * @param {Object} image - 图片元数据 { filename, title, description, theme }
     */
    async show(image) {
        if (!this.realpic) return;
        
        // 执行打开回调
        if (this.options.onOpen) {
            await this.options.onOpen(image);
        }
        
        // 设置标题
        if (this.titleEl) {
            this.titleEl.textContent = image.title || '';
        }
        
        // 获取主题路径
        const themePath = this.getThemePath(image.theme);
        
        // 设置 RealPic 内容
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
                    content: image.description || ''
                }
            ]
        });
        
        // 显示模态框
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.isOpen = true;
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
