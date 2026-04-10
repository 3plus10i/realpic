/**
 * RealPic 字体加载器
 * 从 fonts-config.json 读取配置，动态创建 @font-face 并预加载
 * 供 main.js 和 demo 页面共用，确保字体单点定义
 */

/**
 * 预加载 RealPic 字体
 * @param {string} fontsConfigPath - 字体配置文件路径，默认为 './fonts/fonts-config.json'
 * @param {string} fontsBasePath - 字体文件基础路径，默认为 './fonts/'
 */
export const preloadRealPicFont = async (fontsConfigPath = './fonts/fonts-config.json', fontsBasePath = './fonts/') => {
    try {
        // 加载字体配置
        const response = await fetch(fontsConfigPath);
        if (!response.ok) throw new Error('无法加载字体配置');
        const config = await response.json();
        const fonts = config.fonts || [];

        // 动态创建 @font-face CSS 样式
        const styleEl = document.createElement('style');
        styleEl.textContent = fonts.map(({ family, file, weight = 'normal', style = 'normal' }) => `
            @font-face {
                font-family: '${family}';
                src: url('${fontsBasePath}${file}') format('woff2');
                font-weight: ${weight};
                font-style: ${style};
                font-display: swap;
            }
        `).join('\n');
        document.head.appendChild(styleEl);

        // 延迟预加载字体
        setTimeout(() => {
            if ('FontFace' in window) {
                const fontPromises = fonts.map(({ family, file, weight = 'normal', style = 'normal' }) => {
                    const fontFace = new FontFace(family, `url(${fontsBasePath}${file})`, { weight, style });
                    return fontFace.load()
                        .then(loadedFace => {
                            document.fonts.add(loadedFace);
                            return family;
                        })
                        .catch(err => {
                            console.warn(`[FontPreload] 字体 ${family} 加载失败:`, err);
                            return null;
                        });
                });

                Promise.all(fontPromises).then(results => {
                    const loaded = results.filter(Boolean);
                    console.log(`[FontPreload] ${loaded.length}/${fonts.length} 个字体预加载完成:`, loaded);
                });
            } else {
                // 降级方案
                fonts.forEach(({ family }) => {
                    const hiddenEl = document.createElement('div');
                    hiddenEl.style.cssText = `position:absolute;left:-9999px;visibility:hidden;font-family:${family}`;
                    hiddenEl.textContent = '预加载字体';
                    document.body.appendChild(hiddenEl);
                    setTimeout(() => document.body.removeChild(hiddenEl), 500);
                });
            }
        }, 1000);
    } catch (err) {
        console.warn('[FontPreload] 字体配置加载失败:', err);
    }
};
