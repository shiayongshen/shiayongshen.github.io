/**
 * 共用 JavaScript 文件
 * 包含粒子效果、主題切換等功能
 */

/**
 * 創建背景粒子效果
 * @param {number} particleCount - 粒子數量，默認 50
 */
function createParticles(particleCount = 50) {
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (Math.random() * 20 + 15) + 's';
        document.body.appendChild(particle);
    }
}

/**
 * 初始化主題
 */
function initializeTheme() {
    // 檢查本地存儲的主題偏好
    const savedTheme = localStorage.getItem('theme') || 'light-theme';
    document.body.className = savedTheme;
}

/**
 * 切換主題
 * @param {string} theme - 'light-theme' 或 'dark-theme'
 */
function switchTheme(theme) {
    document.body.className = theme;
    localStorage.setItem('theme', theme);
}

/**
 * 平滑滾動到指定元素
 * @param {string} id - 元素 ID
 */
function smoothScroll(id) {
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

/**
 * 初始化所有導航連結的平滑滾動
 */
function initializeSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                smoothScroll(href.substring(1));
            }
        });
    });
}

/**
 * 當 DOM 加載完成時執行初始化
 */
document.addEventListener('DOMContentLoaded', function () {
    // 創建粒子效果
    createParticles();
    
    // 初始化主題
    initializeTheme();
    
    // 初始化平滑滾動
    initializeSmoothScroll();
});

/**
 * 延遲加載圖片
 */
function lazyLoadImages() {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    observer.unobserve(img);
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
}

/**
 * 檢測用戶偏好的顏色方案
 */
function detectColorSchemePreference() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        switchTheme('dark-theme');
    }
}
