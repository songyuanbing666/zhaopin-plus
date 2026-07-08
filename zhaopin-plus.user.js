// ==UserScript==
// @name         Zhaopin-Plus
// @namespace    https://github.com/zhaopin-plus
// @version      1.0.0
// @author       Zhaopin-Plus
// @description  批量投递岗位，过滤黑名单公司，优化智联招聘界面。
// @match        https://www.zhaopin.com/*
// @grant        GM_addStyle
// @grant        GM_deleteValue
// @grant        GM_getValue
// @grant        GM_info
// @grant        GM_setValue
// ==/UserScript==

(function () {
  'use strict';

  const styleCache = new Set();
  const addStyle = css => {
    if (styleCache.has(css)) return;
    styleCache.add(css);
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(css);
    } else {
      const style = document.createElement('style');
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    }
  };

  const baseStyles = `
:root {
  --zp-primary: #1677ff;
  --zp-primary-hover: #4096ff;
  --zp-success: #52c41a;
  --zp-error: #ff4d4f;
  --zp-warning: #faad14;
  --zp-text: #1f2329;
  --zp-text-secondary: #718096;
  --zp-bg: #ffffff;
  --zp-border: #e5e7eb;
  --zp-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  --zp-radius: 8px;
  --zp-font-sans: "SF Pro SC", "SF Pro Text", "PingFang SC", "Helvetica Neue", "Helvetica", "Arial", sans-serif;
}

.zp-pressable {
  --zp-press-scale: .96;
  transition: background-color .18s cubic-bezier(.2,0,0,1),
              border-color .18s cubic-bezier(.2,0,0,1),
              color .18s cubic-bezier(.2,0,0,1),
              opacity .18s cubic-bezier(.2,0,0,1),
              transform .12s cubic-bezier(.2,0,0,1);
}

.zp-pressable:active:not(:disabled) {
  transform: scale(var(--zp-press-scale));
}

.zp-pressable:disabled {
  cursor: not-allowed;
  opacity: .55;
  transform: none;
}
`;
  addStyle(baseStyles);

  class Toast {
    constructor() {
      this.container = null;
      this.toasts = [];
    }

    show(message, type = 'info', duration = 3000) {
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.className = 'zp-toast-container';
        document.body.appendChild(this.container);
      }

      const toast = document.createElement('div');
      toast.className = `zp-toast zp-toast-${type}`;
      
      const icons = {
        info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
        error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      };

      toast.innerHTML = `
        <div class="zp-toast-icon">${icons[type] || icons.info}</div>
        <div class="zp-toast-content">${message}</div>
      `;

      this.container.appendChild(toast);
      toast.offsetHeight;
      requestAnimationFrame(() => toast.classList.add('zp-toast-enter'));

      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        toast.classList.remove('zp-toast-enter');
        toast.classList.add('zp-toast-leave');
        toast.addEventListener('transitionend', () => {
          if (toast.parentNode) toast.remove();
        }, { once: true });
        const index = this.toasts.indexOf(result);
        if (index > -1) this.toasts.splice(index, 1);
      };

      const result = { close };
      this.toasts.push(result);

      if (duration > 0) {
        setTimeout(() => {
          const idx = this.toasts.indexOf(result);
          if (idx > -1) close();
        }, duration);
      }

      return result;
    }

    info(message, duration) {
      return this.show(message, 'info', duration);
    }

    success(message, duration) {
      return this.show(message, 'success', duration);
    }

    error(message, duration) {
      return this.show(message, 'error', duration);
    }

    warning(message, duration) {
      return this.show(message, 'warning', duration);
    }
  }

  const toastStyles = `
.zp-toast-container {
  position: fixed;
  top: 80px;
  right: 24px;
  z-index: 999999;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.zp-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  border: 1px solid #e5e7eb;
  min-width: 280px;
  max-width: 400px;
  transform: translateX(120%);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.zp-toast-enter {
  transform: translateX(0);
  opacity: 1;
}

.zp-toast-leave {
  transform: translateX(120%);
  opacity: 0;
}

.zp-toast-icon {
  flex-shrink: 0;
}

.zp-toast-success {
  border-color: #52c41a;
  background: #f6ffed;
}
.zp-toast-success .zp-toast-icon { color: #52c41a; }

.zp-toast-error {
  border-color: #ff4d4f;
  background: #fff2f0;
}
.zp-toast-error .zp-toast-icon { color: #ff4d4f; }

.zp-toast-warning {
  border-color: #faad14;
  background: #fffbe6;
}
.zp-toast-warning .zp-toast-icon { color: #faad14; }

.zp-toast-info {
  border-color: #1677ff;
  background: #e6f7ff;
}
.zp-toast-info .zp-toast-icon { color: #1677ff; }

.zp-toast-content {
  font-size: 14px;
  color: #1f2329;
  line-height: 1.5;
}
`;
  addStyle(toastStyles);

  const toast = new Toast();

  class Modal {
    constructor(options = {}) {
      this.options = {
        title: '',
        width: '480px',
        closeable: true,
        hideFooter: false,
        ...options
      };
      this.init();
    }

    init() {
      this.overlay = document.createElement('div');
      this.overlay.className = 'zp-modal-overlay';

      this.panel = document.createElement('div');
      this.panel.className = 'zp-modal-panel';

      this.header = document.createElement('div');
      this.header.className = 'zp-modal-header';

      this.title = document.createElement('div');
      this.title.className = 'zp-modal-title';
      this.title.textContent = this.options.title;

      this.closeBtn = document.createElement('button');
      this.closeBtn.className = 'zp-modal-close-btn zp-pressable';
      this.closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      this.closeBtn.onclick = () => this.destroy();

      this.header.appendChild(this.title);
      if (this.options.closeable) {
        this.header.appendChild(this.closeBtn);
      }

      this.content = document.createElement('div');
      this.content.className = 'zp-modal-content';

      this.footer = document.createElement('div');
      this.footer.className = 'zp-modal-footer';

      this.panel.appendChild(this.header);
      this.panel.appendChild(this.content);
      if (!this.options.hideFooter) {
        this.panel.appendChild(this.footer);
      }

      this.overlay.appendChild(this.panel);
      document.body.appendChild(this.overlay);

      this.overlay.addEventListener('click', e => {
        if (e.target === this.overlay) this.destroy();
      });
    }

    setTitle(title) {
      this.title.textContent = title;
    }

    setContent(content) {
      if (typeof content === 'string') {
        this.content.innerHTML = content;
      } else {
        this.content.innerHTML = '';
        this.content.appendChild(content);
      }
    }

    setFooter(content) {
      if (typeof content === 'string') {
        this.footer.innerHTML = content;
      } else {
        this.footer.innerHTML = '';
        this.footer.appendChild(content);
      }
    }

    show() {
      this.overlay.classList.add('zp-show');
    }

    destroy() {
      this.overlay.classList.remove('zp-show');
      setTimeout(() => {
        if (this.overlay.parentNode) {
          this.overlay.remove();
        }
      }, 300);
    }
  }

  const modalStyles = `
.zp-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999998;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease, visibility 0.2s ease;
}

.zp-modal-overlay.zp-show {
  opacity: 1;
  visibility: visible;
}

.zp-modal-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  width: calc(100% - 40px);
  max-width: 480px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
  transform: translate(-50%, -48%);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.zp-modal-overlay.zp-show .zp-modal-panel {
  opacity: 1;
  transform: translate(-50%, -50%);
}

.zp-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.zp-modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2329;
}

.zp-modal-close-btn {
  background: none;
  border: none;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s;
}

.zp-modal-close-btn:hover {
  background: #f3f4f6;
  color: #6b7280;
}

.zp-modal-content {
  padding: 24px;
  max-height: 60vh;
  overflow-y: auto;
}

.zp-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
}

.zp-modal-btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.zp-modal-btn-primary {
  background: #1677ff;
  color: #fff;
}

.zp-modal-btn-primary:hover {
  background: #4096ff;
}

.zp-modal-btn-secondary {
  background: #f5f5f5;
  color: #666;
  border-color: #d9d9d9;
}

.zp-modal-btn-secondary:hover {
  background: #e8e8e8;
}
`;
  addStyle(modalStyles);

  class Logger {
    constructor(options = {}) {
      this.options = {
        title: '日志',
        emptyText: '暂无日志',
        ...options
      };
      this.init();
    }

    init() {
      this.el = document.createElement('div');
      this.el.className = 'zp-logger';
      this.el.innerHTML = `
        <div class="header">
          <div class="title">
            <span class="dot stopped"></span>
            <span>${this.options.title}</span>
          </div>
          <button class="close zp-pressable">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="body">
          <div class="empty">${this.options.emptyText}</div>
        </div>
      `;

      this.body = this.el.querySelector('.body');
      this.dot = this.el.querySelector('.dot');
      this.titleEl = this.el.querySelector('.title');
      this.el.querySelector('.close').onclick = () => this.hide();
      document.body.appendChild(this.el);
    }

    log(message, type = 'info') {
      const empty = this.body.querySelector('.empty');
      if (empty) empty.remove();

      const entry = document.createElement('div');
      entry.className = `entry log-${type}`;
      
      const icons = {
        info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        success: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
        error: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        warning: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      };

      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      entry.innerHTML = `
        <span class="icon">${icons[type] || icons.info}</span>
        <span class="time">${timeStr}</span>
        <span class="msg">${message}</span>
      `;

      this.body.appendChild(entry);
      this.body.scrollTop = this.body.scrollHeight;
    }

    show() {
      this.el.classList.add('show');
    }

    hide() {
      this.el.classList.remove('show');
    }

    setActive(active) {
      active ? this.dot.classList.remove('stopped') : this.dot.classList.add('stopped');
    }

    appendToTitle(el) {
      this.titleEl.appendChild(el);
    }

    destroy() {
      this.el.remove();
    }
  }

  const loggerStyles = `
.zp-logger {
  position: fixed;
  bottom: 100px;
  right: 24px;
  width: 360px;
  max-height: 400px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  z-index: 999996;
  transform: translateY(120%);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
}

.zp-logger.show {
  transform: translateY(0);
  opacity: 1;
}

.zp-logger .header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 12px 12px 0 0;
  border-bottom: 1px solid #e5e7eb;
}

.zp-logger .title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.zp-logger .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #52c41a;
}

.zp-logger .dot.stopped {
  background: #9ca3af;
}

.zp-logger .close {
  background: none;
  border: none;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s;
}

.zp-logger .close:hover {
  background: #e2e8f0;
  color: #6b7280;
}

.zp-logger .body {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.zp-logger .empty {
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
  padding: 24px 0;
}

.zp-logger .entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
}

.zp-logger .icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.zp-logger .log-info .icon { color: #1677ff; }
.zp-logger .log-success .icon { color: #52c41a; }
.zp-logger .log-error .icon { color: #ff4d4f; }
.zp-logger .log-warning .icon { color: #faad14; }

.zp-logger .time {
  flex-shrink: 0;
  color: #9ca3af;
  font-size: 12px;
}

.zp-logger .msg {
  flex: 1;
  color: #4b5563;
  word-break: break-all;
}
`;
  addStyle(loggerStyles);

  const storage = {
    get(key, defaultValue) {
      try {
        const value = GM_getValue(key);
        return value === undefined ? defaultValue : JSON.parse(value);
      } catch {
        return defaultValue;
      }
    },

    set(key, value) {
      try {
        GM_setValue(key, JSON.stringify(value));
      } catch (e) {
        console.error('Storage set error:', e);
      }
    },

    remove(key) {
      GM_deleteValue(key);
    }
  };

  const recordApply = () => {
    const today = new Date().toISOString().slice(0, 10);
    const records = storage.get('zp_apply_records', {});
    records[today] = (records[today] || 0) + 1;
    storage.set('zp_apply_records', records);
  };

  const getApplyStats = (days = 7) => {
    const records = storage.get('zp_apply_records', {});
    const stats = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      stats.push({
        date: dateStr,
        display: `${date.getMonth() + 1}/${date.getDate()}`,
        count: records[dateStr] || 0
      });
    }
    
    return stats;
  };

  const getTotalApplyCount = (days = 7) => {
    return getApplyStats(days).reduce((sum, item) => sum + item.count, 0);
  };

  const defaultConfig = {
    applyInterval: { min: 3, max: 5 },
    applyLimit: 50,
    jobAction: 'apply',
    skipBlacklist: true,
    skipHeadHunter: true,
    skipUrgent: false,
    blacklist: [],
    keywords: [],
    keywordMode: 'blacklist',
    salaryRange: { min: null, max: null },
    companyAgeRange: { min: null, max: null },
    companyFundRange: { min: null, max: null },
    skipDollarFund: false,
    enableAutoReply: false,
    autoReplyMessage: '您好，我对该职位很感兴趣，期待进一步沟通。',
    autoReplyMode: 'fixed',
    autoReplyTemplates: ['您好，我对该职位很感兴趣，期待进一步沟通。'],
    enableCopyJob: true,
    enableCompanyReview: true,
    autoRecordCommunicated: true
  };

  const getConfig = () => {
    const saved = storage.get('zp_config');
    return { ...defaultConfig, ...saved };
  };

  const saveConfig = (config) => {
    storage.set('zp_config', config);
    window.dispatchEvent(new CustomEvent('zp_config_changed'));
  };

  const getBlacklist = () => {
    return storage.get('zp_blacklist', []);
  };

  const addToBlacklist = (companyName, source = 'auto') => {
    const list = getBlacklist();
    if (!list.some(item => item.name === companyName)) {
      list.push({ name: companyName, source, timestamp: Date.now() });
      storage.set('zp_blacklist', list);
    }
    return list;
  };

  const removeFromBlacklist = (companyName) => {
    const list = getBlacklist();
    const index = list.findIndex(item => item.name === companyName);
    if (index > -1) {
      list.splice(index, 1);
      storage.set('zp_blacklist', list);
    }
    return list;
  };

  const isBlacklisted = (companyName) => {
    const list = getBlacklist();
    return list.some(item => companyName.includes(item.name) || item.name.includes(companyName));
  };

  const headHunterKeywords = ['外企德科', '人瑞', '众萃', '外包', '猎头', '派遣', '人力', '人力资源', '咨询'];
  const isHeadHunter = (companyName) => {
    return headHunterKeywords.some(keyword => companyName.includes(keyword));
  };

  const urgentKeywords = ['急聘', '急招', '急', '立刻', '马上', '尽快'];
  const isUrgentJob = (title) => {
    return urgentKeywords.some(keyword => title.includes(keyword));
  };

  const parseSalary = (salaryText) => {
    if (!salaryText) return null;
    const match = salaryText.match(/([\d.]+)[万w]?-([\d.]+)[万w]?/);
    if (match) {
      return {
        min: parseFloat(match[1]) * 10000,
        max: parseFloat(match[2]) * 10000
      };
    }
    const singleMatch = salaryText.match(/([\d.]+)[万w]?/);
    if (singleMatch) {
      const value = parseFloat(singleMatch[1]) * 10000;
      return { min: value, max: value };
    }
    return null;
  };

  const isSalaryMatch = (salaryText, range) => {
    if (!range.min && !range.max) return true;
    const salary = parseSalary(salaryText);
    if (!salary) return true;
    if (range.min && salary.max < range.min) return false;
    if (range.max && salary.min > range.max) return false;
    return true;
  };

  const parseCompanyAge = (ageText) => {
    if (!ageText) return null;
    const match = ageText.match(/(\d+)年/);
    return match ? parseInt(match[1]) : null;
  };

  const isCompanyAgeMatch = (ageText, range) => {
    if (!range.min && !range.max) return true;
    const age = parseCompanyAge(ageText);
    if (age === null) return true;
    if (range.min && age < range.min) return false;
    if (range.max && age > range.max) return false;
    return true;
  };

  const parseCompanyFund = (fundText) => {
    if (!fundText) return null;
    const match = fundText.match(/(\d+(?:\.\d+)?)\s*(万|亿)?/);
    if (!match) return null;
    let value = parseFloat(match[1]);
    if (match[2] === '亿') value *= 10000;
    return { value, isDollar: fundText.includes('美元') || fundText.includes('USD') };
  };

  const isCompanyFundMatch = (fundText, range) => {
    if (!range.min && !range.max) return true;
    const fund = parseCompanyFund(fundText);
    if (fund === null) return true;
    if (range.min && fund.value < range.min) return false;
    if (range.max && fund.value > range.max) return false;
    return true;
  };

  const jobCardSelectors = [
    '.joblist-box__item',
    '.joblist-box .joblist-item',
    '.position-list .position-item',
    'article[data-positionid]',
    '.job-card',
    '.job-item',
    '.searchresult-list .searchresult-item',
    '.contentpile__content__wrapper .contentpile__content__item'
  ];

  const findBtnByText = (container, tag, text) => {
    const buttons = container.querySelectorAll(tag);
    for (const btn of buttons) {
      if (btn.textContent.trim().includes(text)) return btn;
    }
    return null;
  };

  const getJobCards = () => {
    for (const selector of jobCardSelectors) {
      const cards = document.querySelectorAll(selector);
      if (cards.length > 0) return Array.from(cards);
    }
    return [];
  };

  const getJobCardInfo = (card) => {
    const jobLink = card.querySelector('.jobinfo__name') ||
                   card.querySelector('a[href*="/jobdetail/"]') ||
                   card.querySelector('a[href*="/jobs/"]') ||
                   card.querySelector('a[title]');
    const companyLink = card.querySelector('.companyinfo__name') ||
                       card.querySelector('a[href*="/companydetail/"]') ||
                       card.querySelector('a[href*="/company/"]') ||
                       card.querySelector('.company-name a') ||
                       card.querySelector('.company-link');
    const applyBtn = findBtnByText(card, 'button', '立即投递') ||
                    findBtnByText(card, 'a', '立即投递') ||
                    card.querySelector('.collect-and-apply__btn') ||
                    card.querySelector('.apply-btn');
    const favoriteBtn = findBtnByText(card, 'button', '收藏') ||
                       findBtnByText(card, 'span', '收藏') ||
                       card.querySelector('.collect-box__container') ||
                       card.querySelector('.favorite-btn');
    const salaryEl = card.querySelector('.jobinfo__salary') ||
                    card.querySelector('.salary') ||
                    card.querySelector('.job-salary') ||
                    card.querySelector('[class*="salary"]');
    const titleEl = jobLink || card.querySelector('.job-title') || card.querySelector('.position-title');

    return {
      title: titleEl?.textContent?.trim() || '',
      company: companyLink?.textContent?.trim() || '',
      salary: salaryEl?.textContent?.trim() || '',
      applyBtn,
      favoriteBtn,
      card,
      jobId: jobLink?.href?.match(/\/([^/]+)\.htm$/)?.[1] || ''
    };
  };

  class AutoApply {
    constructor() {
      this.isRunning = false;
      this.currentIndex = 0;
      this.totalApplied = 0;
      this.logger = new Logger({ title: '自动投递日志' });
    }

    async start(options = {}) {
      if (this.isRunning) {
        toast.warning('自动投递正在运行中');
        return;
      }

      this.isRunning = true;
      this.currentIndex = 0;
      this.totalApplied = 0;
      this.options = options;
      this.logger.show();
      this.logger.setActive(true);

      try {
        await this.run();
      } finally {
        this.isRunning = false;
        this.logger.setActive(false);
        toast.success(`自动投递完成，共投递 ${this.totalApplied} 个职位`);
      }
    }

    stop() {
      this.isRunning = false;
      toast.info('自动投递已停止');
    }

    async run() {
      const config = getConfig();

      // 等待职位列表加载
      let waitCount = 0;
      while (this.isRunning && getJobCards().length === 0 && waitCount < 10) {
        this.logger.log('等待职位列表加载...', 'info');
        await this.wait(1000);
        waitCount++;
      }

      while (this.isRunning) {
        const cards = getJobCards();
        if (this.currentIndex >= cards.length) {
          this.logger.log('已到达当前页末尾', 'info');
          const nextBtn = document.querySelector('.next-page') ||
                         findBtnByText(document, 'a', '下一页') ||
                         document.querySelector('[class*="next"]');
          if (nextBtn && this.totalApplied < config.applyLimit) {
            this.logger.log('正在翻页...', 'info');
            nextBtn.click();
            await this.wait(3000);
            this.currentIndex = 0;
            continue;
          }
          break;
        }

        const card = cards[this.currentIndex];
        const info = getJobCardInfo(card);
        this.currentIndex++;

        if (!info.company) continue;

        if (config.skipBlacklist && isBlacklisted(info.company)) {
          this.logger.log(`跳过黑名单公司: ${info.company}`, 'warning');
          continue;
        }

        if (config.skipHeadHunter && isHeadHunter(info.company)) {
          this.logger.log(`跳过猎头公司: ${info.company}`, 'warning');
          continue;
        }

        if (config.skipUrgent && isUrgentJob(info.title)) {
          this.logger.log(`跳过急聘岗位: ${info.title}`, 'warning');
          continue;
        }

        if (!isSalaryMatch(info.salary, config.salaryRange)) {
          this.logger.log(`薪资不匹配跳过: ${info.title} - ${info.salary}`, 'warning');
          continue;
        }

        if (this.totalApplied >= config.applyLimit) {
          this.logger.log('已达到投递上限', 'info');
          break;
        }

        try {
          await this.handleJob(info, config);
        } catch (e) {
          this.logger.log(`处理失败: ${info.title} - ${e.message}`, 'error');
        }

        const interval = this.getRandomInterval(config.applyInterval);
        await this.wait(interval * 1000);
      }
    }

    getRandomInterval(range) {
      return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    }

    async handleJob(info, config) {
      if (config.jobAction === 'favorite') {
        return this.favoriteJob(info);
      }
      return this.applyJob(info);
    }

    async favoriteJob(info) {
      return new Promise((resolve) => {
        const favoriteBtn = info.favoriteBtn || findBtnByText(info.card, 'button', '收藏');
        
        if (!favoriteBtn) {
          this.logger.log(`未找到收藏按钮: ${info.title}`, 'error');
          resolve(false);
          return;
        }

        this.logger.log(`正在收藏: ${info.title}`, 'info');
        favoriteBtn.click();
        
        setTimeout(() => {
          this.totalApplied++;
          recordApply();
          this.logger.log(`收藏成功: ${info.title}`, 'success');
          if (getConfig().autoRecordCommunicated) {
            addToBlacklist(info.company, 'auto');
          }
          resolve(true);
        }, 500);
      });
    }

    async applyJob(info) {
      return new Promise((resolve) => {
        const applyBtn = info.applyBtn;
        
        if (!applyBtn) {
          resolve(false);
          return;
        }

        this.logger.log(`正在投递: ${info.title} - ${info.company}`, 'info');
        
        applyBtn.click();
        
        setTimeout(() => {
          const confirmBtn = findBtnByText(document, 'button', '确认投递') ||
                            findBtnByText(document, 'button', '立即投递') ||
                            document.querySelector('.confirm-btn');
          
          if (confirmBtn) {
            confirmBtn.click();
            setTimeout(() => {
              this.totalApplied++;
              recordApply();
              this.logger.log(`投递成功: ${info.title}`, 'success');
              if (getConfig().autoRecordCommunicated) {
                addToBlacklist(info.company, 'auto');
              }
              resolve(true);
            }, 1000);
          } else {
            this.totalApplied++;
            recordApply();
            this.logger.log(`投递成功: ${info.title}`, 'success');
            if (getConfig().autoRecordCommunicated) {
              addToBlacklist(info.company, 'auto');
            }
            resolve(true);
          }
        }, 500);
      });
    }

    wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  const floatingActionsStyles = `
.zp-floating-actions {
  position: fixed;
  left: 24px;
  bottom: 24px;
  z-index: 999997;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
}

.zp-floating-action {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #1677ff;
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.zp-floating-action:hover {
  background: #4096ff;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(22, 119, 255, 0.5);
}

.zp-floating-action:active {
  transform: scale(0.95);
}

.zp-floating-action.zp-active {
  background: #52c41a;
}

.zp-floating-action::after {
  content: attr(data-tooltip);
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 12px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 12px;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
  pointer-events: none;
}

.zp-floating-action:hover::after {
  opacity: 1;
  visibility: visible;
}

.zp-floating-action svg {
  width: 22px;
  height: 22px;
}
`;
  addStyle(floatingActionsStyles);

  class SegmentedControl {
    constructor(opts = {}) {
      const { value = '', options: optList = [], onChange = () => {}, className = '' } = opts;
      this.value = value;
      this.options = optList;
      this.onChange = onChange;
      
      this.el = document.createElement('div');
      this.el.className = `zp-segmented-control ${className}`;
      
      this.indicator = document.createElement('div');
      this.indicator.className = 'indicator';
      this.el.appendChild(this.indicator);
      
      this.buttons = [];
      this.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `option ${value === opt.value ? 'active' : ''}`;
        btn.textContent = opt.label;
        btn.onclick = () => this.setValue(opt.value);
        this.el.appendChild(btn);
        this.buttons.push(btn);
      });
      
      this.updateIndicator();
    }
    
    setValue(value) {
      if (this.value === value) return;
      this.value = value;
      this.buttons.forEach((btn, i) => {
        btn.classList.toggle('active', this.options[i].value === value);
      });
      this.updateIndicator();
      this.onChange(value);
    }
    
    updateIndicator() {
      const activeBtn = this.el.querySelector('.option.active');
      if (activeBtn) {
        const rect = activeBtn.getBoundingClientRect();
        const elRect = this.el.getBoundingClientRect();
        this.el.style.setProperty('--indicator-left', `${rect.left - elRect.left}px`);
        this.el.style.setProperty('--indicator-width', `${rect.width}px`);
      }
    }
    
    get element() {
      return this.el;
    }
  }

  const segmentedControlStyles = `
.zp-segmented-control {
  box-sizing: border-box;
  position: relative;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 8px;
  background: #f1f3f5;
}

.zp-segmented-control .indicator {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: var(--indicator-left);
  width: var(--indicator-width);
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 10px 24px rgba(17,24,39,0.06);
  transition: left 0.25s cubic-bezier(0.2,0,0,1), width 0.25s cubic-bezier(0.2,0,0,1);
  pointer-events: none;
}

.zp-segmented-control .option {
  position: relative;
  z-index: 1;
  min-width: 0;
  min-height: 38px;
  padding: 0 14px;
  border: none;
  border-radius: 6px;
  background-color: transparent;
  color: #60646c;
  cursor: pointer;
  font-family: var(--zp-font-sans);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.18s cubic-bezier(0.2,0,0,1), background-color 0.18s cubic-bezier(0.2,0,0,1);
  user-select: none;
  white-space: nowrap;
}

.zp-segmented-control .option:hover:not(.active) {
  color: #374151;
}

.zp-segmented-control .option.active {
  color: #1677ff;
  font-weight: 700;
}

.zp-segmented-control.is-compact .option {
  min-height: 32px;
}
`;
  addStyle(segmentedControlStyles);

  class Repeater {
    constructor(options = {}) {
      const { label, values = [], onChange = () => {}, placeholder = '输入关键词', enableTransfer = false } = options;
      this.values = values;
      this.onChange = onChange;
      
      this.el = document.createElement('div');
      this.el.className = 'zp-repeater';
      
      const header = document.createElement('div');
      header.className = 'zp-repeater-header';
      
      const labelEl = document.createElement('span');
      labelEl.className = 'zp-repeater-label';
      labelEl.textContent = label;
      header.appendChild(labelEl);
      
      this.actions = document.createElement('div');
      this.actions.className = 'zp-repeater-actions';
      
      if (enableTransfer) {
        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'zp-repeater-action zp-pressable';
        exportBtn.textContent = '导出';
        exportBtn.onclick = () => this.exportValues();
        this.actions.appendChild(exportBtn);
        
        const importBtn = document.createElement('button');
        importBtn.type = 'button';
        importBtn.className = 'zp-repeater-action zp-pressable';
        importBtn.textContent = '导入';
        importBtn.onclick = () => this.importValues();
        this.actions.appendChild(importBtn);
      }
      
      header.appendChild(this.actions);
      this.el.appendChild(header);
      
      const inputWrapper = document.createElement('div');
      inputWrapper.className = 'zp-repeater-input-wrapper';
      
      this.input = document.createElement('input');
      this.input.type = 'text';
      this.input.className = 'zp-repeater-input';
      this.input.placeholder = placeholder;
      this.input.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          const value = this.input.value.trim();
          if (value) {
            if (this.values.includes(value)) {
              toast.error(`"${value}" 已存在`);
            } else {
              this.values.push(value);
              this.input.value = '';
              this.renderItems();
              this.onChange([...this.values]);
            }
          }
        }
      };
      
      inputWrapper.appendChild(this.input);
      this.el.appendChild(inputWrapper);
      
      this.list = document.createElement('div');
      this.list.className = 'zp-repeater-list';
      this.el.appendChild(this.list);
      
      this.renderItems();
    }
    
    renderItems() {
      this.list.innerHTML = '';
      this.values.forEach((value, index) => {
        const item = document.createElement('div');
        item.className = 'zp-repeater-item';
        
        const indexEl = document.createElement('span');
        indexEl.className = 'zp-repeater-item-index';
        indexEl.textContent = index + 1;
        item.appendChild(indexEl);
        
        const valueEl = document.createElement('span');
        valueEl.className = 'zp-repeater-item-value';
        valueEl.textContent = value;
        item.appendChild(valueEl);
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'zp-repeater-item-remove zp-pressable';
        removeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        removeBtn.onclick = () => {
          this.values.splice(index, 1);
          this.renderItems();
          this.onChange([...this.values]);
        };
        item.appendChild(removeBtn);
        
        this.list.appendChild(item);
      });
    }
    
    exportValues() {
      const text = this.values.join('\n');
      navigator.clipboard.writeText(text).then(() => {
        toast.success('已复制');
      }).catch(() => {
        toast.error('复制失败');
      });
    }
    
    importValues() {
      const modal = new Modal({ title: '导入关键词', width: '520px' });
      const content = document.createElement('div');
      content.className = 'zp-repeater-transfer';
      
      const tip = document.createElement('div');
      tip.className = 'zp-repeater-transfer-tip';
      tip.textContent = '每行一个关键词，导入后仍需点保存设置才会生效';
      content.appendChild(tip);
      
      const textarea = document.createElement('textarea');
      textarea.className = 'zp-repeater-transfer-input';
      textarea.placeholder = '每行输入一个关键词';
      content.appendChild(textarea);
      
      modal.setContent(content);
      
      const footer = document.createElement('div');
      footer.className = 'zp-repeater-transfer-footer';
      
      const replaceBtn = document.createElement('button');
      replaceBtn.className = 'zp-modal-btn zp-modal-btn-secondary zp-pressable';
      replaceBtn.textContent = '覆盖导入';
      replaceBtn.onclick = () => this.doImport(textarea.value, 'replace');
      footer.appendChild(replaceBtn);
      
      const appendBtn = document.createElement('button');
      appendBtn.className = 'zp-modal-btn zp-modal-btn-primary zp-pressable';
      appendBtn.textContent = '追加导入';
      appendBtn.onclick = () => this.doImport(textarea.value, 'append');
      footer.appendChild(appendBtn);
      
      modal.setFooter(footer);
      modal.show();
    }
    
    doImport(text, mode) {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length === 0) {
        toast.error('请输入至少一个关键词');
        return;
      }
      
      const oldCount = this.values.length;
      if (mode === 'replace') {
        this.values = lines;
      } else {
        lines.forEach(line => {
          if (!this.values.includes(line)) {
            this.values.push(line);
          }
        });
      }
      
      const newCount = this.values.length;
      this.renderItems();
      this.onChange([...this.values]);
      
      if (mode === 'replace') {
        toast.success(`已覆盖为 ${newCount} 个关键词`);
      } else {
        const added = newCount - oldCount;
        added > 0 ? toast.success(`已追加 ${added} 个关键词`) : toast.info('没有新增关键词');
      }
    }
    
    getValues() {
      return [...this.values];
    }
    
    setValues(values) {
      this.values = values;
      this.renderItems();
    }
    
    get element() {
      return this.el;
    }
  }

  const repeaterStyles = `
.zp-repeater {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.zp-repeater-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.zp-repeater-label {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.zp-repeater-actions {
  display: flex;
  gap: 8px;
}

.zp-repeater-action {
  padding: 4px 10px;
  font-size: 12px;
  color: #1677ff;
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.zp-repeater-action:hover {
  background: #e6f7ff;
  border-color: #1677ff;
}

.zp-repeater-input-wrapper {
  position: relative;
}

.zp-repeater-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.zp-repeater-input:focus {
  outline: none;
  border-color: #1677ff;
}

.zp-repeater-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.zp-repeater-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 13px;
}

.zp-repeater-item-index {
  color: #9ca3af;
  font-size: 12px;
}

.zp-repeater-item-value {
  color: #4b5563;
}

.zp-repeater-item-remove {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 2px;
  transition: color 0.2s;
}

.zp-repeater-item-remove:hover {
  color: #ff4d4f;
}

.zp-repeater-transfer {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.zp-repeater-transfer-tip {
  font-size: 13px;
  color: #9ca3af;
}

.zp-repeater-transfer-input {
  width: 100%;
  height: 150px;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  resize: none;
}

.zp-repeater-transfer-input:focus {
  outline: none;
  border-color: #1677ff;
}

.zp-repeater-transfer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
`;
  addStyle(repeaterStyles);

  class Toggle {
    constructor(options = {}) {
      const { value = false, onChange = () => {} } = options;
      this.value = value;
      this.onChange = onChange;
      
      this.el = document.createElement('div');
      this.el.className = 'zp-toggle';
      this.el.innerHTML = `
        <div class="zp-toggle-track">
          <div class="zp-toggle-thumb"></div>
        </div>
      `;
      
      this.track = this.el.querySelector('.zp-toggle-track');
      this.thumb = this.el.querySelector('.zp-toggle-thumb');
      
      this.setValue(value);
      
      this.el.onclick = () => this.setValue(!this.value);
    }
    
    setValue(value) {
      this.value = value;
      this.el.classList.toggle('zp-toggle-on', value);
      this.onChange(value);
    }
    
    getValues() {
      return this.value;
    }
    
    get element() {
      return this.el;
    }
  }

  const toggleStyles = `
.zp-toggle {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.zp-toggle-track {
  width: 44px;
  height: 24px;
  background: #d1d5db;
  border-radius: 12px;
  position: relative;
  transition: background-color 0.2s;
}

.zp-toggle-on .zp-toggle-track {
  background: #1677ff;
}

.zp-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  transition: transform 0.2s cubic-bezier(0.2,0,0,1);
}

.zp-toggle-on .zp-toggle-thumb {
  transform: translateX(20px);
}
`;
  addStyle(toggleStyles);

  class Settings {
    constructor() {
      this.config = getConfig();
      this.init();
    }
    
    init() {
      this.sections = [
        { id: 'apply', title: '投递控制', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>', description: '控制自动投递的行为' },
        { id: 'filter', title: '岗位过滤', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><filter id="a"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#a)"/><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>', description: '过滤不感兴趣的岗位' },
        { id: 'company', title: 'HR 和公司', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', description: '公司相关设置' },
        { id: 'communication', title: '沟通工具', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>', description: '自动回复和消息清理' },
        { id: 'data', title: '数据迁移', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>', description: '备份和恢复数据' },
        { id: 'about', title: '关于', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>', description: '版本信息和更新日志' }
      ];
      
      this.settings = [
        { id: 'applyInterval', group: 'apply', type: 'interval', label: '投递间隔', desc: '每次投递之间的随机等待时间' },
        { id: 'applyLimit', group: 'apply', type: 'number', label: '投递上限', desc: '单次自动投递的最大数量', min: 1, max: 200, defaultValue: 50 },
        { id: 'jobAction', group: 'apply', type: 'select', label: '岗位处理方式', desc: '选择投递还是只收藏', options: [
          { value: 'apply', label: '立即投递' },
          { value: 'favorite', label: '只收藏' }
        ]},
        { id: 'keywords', group: 'filter', type: 'repeater', label: '详情页关键词列表', desc: '按关键词过滤岗位描述', enableTransfer: true },
        { id: 'keywordMode', group: 'filter', type: 'select', label: '关键词过滤模式', desc: '黑名单：包含关键词的岗位跳过；白名单：只投递包含关键词的岗位', options: [
          { value: 'blacklist', label: '黑名单模式' },
          { value: 'whitelist', label: '白名单模式' }
        ]},
        { id: 'skipHeadHunter', group: 'filter', type: 'toggle', label: '屏蔽猎头岗位', desc: '自动跳过猎头公司发布的岗位' },
        { id: 'skipUrgent', group: 'filter', type: 'toggle', label: '屏蔽急聘岗位', desc: '隐藏带有急聘标识的岗位' },
        { id: 'salaryRange', group: 'filter', type: 'range', label: '薪资范围', desc: '过滤薪资不符合要求的岗位' },
        { id: 'skipBlacklist', group: 'company', type: 'toggle', label: '跳过黑名单公司', desc: '自动跳过已沟通或手动添加的公司' },
        { id: 'autoRecordCommunicated', group: 'company', type: 'toggle', label: '关闭沟通后自动记录', desc: '关闭沟通会话后自动将公司加入跳过列表' },
        { id: 'companyAgeRange', group: 'company', type: 'range', label: '公司成立时间', desc: '过滤公司成立年限不符合要求的岗位' },
        { id: 'companyFundRange', group: 'company', type: 'range', label: '公司注册资金', desc: '过滤注册资金不符合要求的公司，单位：万元' },
        { id: 'skipDollarFund', group: 'company', type: 'toggle', label: '跳过美元注册资金', desc: '自动跳过注册资金为美元的公司' },
        { id: 'enableCompanyReview', group: 'company', type: 'toggle', label: '公司评价', desc: '在岗位详情页查看和发布公司评价' },
        { id: 'enableAutoReply', group: 'communication', type: 'toggle', label: '自动回复', desc: '自动回复已读未回的沟通消息' },
        { id: 'autoReplyMode', group: 'communication', type: 'select', label: '回复模式', desc: '固定消息或随机用语', options: [
          { value: 'fixed', label: '固定消息' },
          { value: 'random', label: '随机用语' }
        ]},
        { id: 'autoReplyMessage', group: 'communication', type: 'input', label: '固定消息', desc: '自动回复时发送的固定消息' },
        { id: 'enableCopyJob', group: 'communication', type: 'toggle', label: '一键复制岗位信息', desc: '在岗位详情页显示复制按钮' }
      ];
    }
    
    open() {
      const modal = new Modal({ title: 'Zhaopin-Plus 设置', width: '840px', hideFooter: false });
      modal.panel.classList.add('zp-settings-panel');
      
      const layout = document.createElement('div');
      layout.className = 'zp-settings-layout';
      
      const sidebar = document.createElement('div');
      sidebar.className = 'zp-settings-sidebar';
      
      const nav = document.createElement('div');
      nav.className = 'zp-settings-nav';
      sidebar.appendChild(nav);
      
      const panel = document.createElement('div');
      panel.className = 'zp-settings-panel-content';
      
      const panelHeader = document.createElement('div');
      panelHeader.className = 'zp-settings-panel-header';
      
      const panelTitle = document.createElement('div');
      panelTitle.className = 'zp-settings-panel-title';
      
      const panelDesc = document.createElement('div');
      panelDesc.className = 'zp-settings-panel-desc';
      
      panelHeader.appendChild(panelTitle);
      panelHeader.appendChild(panelDesc);
      
      const content = document.createElement('div');
      content.className = 'zp-settings-content';
      
      panel.appendChild(panelHeader);
      panel.appendChild(content);
      
      layout.appendChild(sidebar);
      layout.appendChild(panel);
      
      modal.setContent(layout);
      
      const footer = document.createElement('div');
      footer.className = 'zp-settings-footer';
      
      const resetBtn = document.createElement('button');
      resetBtn.className = 'zp-modal-btn zp-modal-btn-secondary zp-pressable';
      resetBtn.textContent = '重置设置';
      
      const saveBtn = document.createElement('button');
      saveBtn.className = 'zp-modal-btn zp-modal-btn-primary zp-pressable';
      saveBtn.innerHTML = '<span class="zp-save-text">保存设置</span><span class="zp-save-success">已保存</span>';
      
      footer.appendChild(resetBtn);
      footer.appendChild(saveBtn);
      modal.setFooter(footer);
      
      let activeSection = this.sections[0].id;
      const sectionButtons = {};
      const settingElements = {};
      
      this.sections.forEach(section => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'zp-settings-nav-item zp-pressable';
        btn.innerHTML = `<span class="zp-settings-nav-icon">${section.icon}</span><span class="zp-settings-nav-title">${section.title}</span>`;
        btn.onclick = () => this.switchSection(section.id, panelTitle, panelDesc, content, sectionButtons);
        nav.appendChild(btn);
        sectionButtons[section.id] = btn;
      });
      
      this.settings.forEach(setting => {
        const el = this.createSettingElement(setting);
        settingElements[setting.id] = el;
      });
      
      const renderSection = (sectionId) => {
        content.innerHTML = '';
        const section = this.sections.find(s => s.id === sectionId);
        panelTitle.textContent = section.title;
        panelDesc.textContent = section.description;
        
        this.settings.filter(s => s.group === sectionId).forEach(setting => {
          const el = settingElements[setting.id];
          if (el) {
            content.appendChild(el);
          }
        });
      };
      
      this.switchSection = (sectionId, titleEl, descEl, contentEl, buttons) => {
        activeSection = sectionId;
        Object.entries(buttons).forEach(([id, btn]) => {
          btn.classList.toggle('is-active', id === sectionId);
        });
        renderSection(sectionId);
      };
      
      renderSection(activeSection);
      sectionButtons[activeSection].classList.add('is-active');
      
      resetBtn.onclick = () => {
        if (resetBtn.textContent === '确认重置？') {
          saveConfig(defaultConfig);
          toast.success('设置已重置为默认值');
          resetBtn.textContent = '重置设置';
          window.dispatchEvent(new CustomEvent('zp_config_changed'));
          modal.destroy();
        } else {
          resetBtn.textContent = '确认重置？';
          setTimeout(() => {
            resetBtn.textContent = '重置设置';
          }, 3000);
        }
      };
      
      saveBtn.onclick = () => {
        const config = getConfig();
        const newConfig = { ...config };
        
        this.settings.forEach(setting => {
          if (settingElements[setting.id]) {
            newConfig[setting.id] = settingElements[setting.id].getValues();
          }
        });
        
        const salary = newConfig.salaryRange;
        if (salary.min && salary.max && salary.min > salary.max) {
          toast.error('薪资范围填写有误');
          return;
        }
        
        saveConfig(newConfig);
        const saveText = saveBtn.querySelector('.zp-save-text');
        const saveSuccess = saveBtn.querySelector('.zp-save-success');
        saveText.style.display = 'none';
        saveSuccess.style.display = 'inline';
        setTimeout(() => {
          saveText.style.display = 'inline';
          saveSuccess.style.display = 'none';
        }, 2000);
      };
      
      modal.show();
    }
    
    createSettingElement(setting) {
      const container = document.createElement('div');
      container.className = 'zp-setting-item';
      
      const label = document.createElement('div');
      label.className = 'zp-setting-label';
      label.textContent = setting.label;
      
      const desc = document.createElement('div');
      desc.className = 'zp-setting-desc';
      desc.textContent = setting.desc;
      
      const content = document.createElement('div');
      content.className = 'zp-setting-content';
      
      let control = null;
      
      switch (setting.type) {
        case 'toggle':
          control = new Toggle({ value: getConfig()[setting.id], onChange: () => {} });
          break;
        case 'select':
          control = new SegmentedControl({ 
            value: getConfig()[setting.id], 
            options: setting.options,
            onChange: () => {}
          });
          break;
        case 'number':
          control = this.createNumberInput(setting);
          break;
        case 'interval':
          control = this.createIntervalInput(setting);
          break;
        case 'range':
          control = this.createRangeInput(setting);
          break;
        case 'repeater':
          control = new Repeater({ 
            label: '',
            values: getConfig()[setting.id] || [],
            onChange: () => {},
            enableTransfer: setting.enableTransfer
          });
          break;
        case 'input':
          control = this.createTextInput(setting);
          break;
        default:
          control = document.createElement('span');
          control.textContent = '未知类型';
      }
      
      if (control) {
        content.appendChild(control.element || control);
      }
      
      container.appendChild(label);
      container.appendChild(desc);
      container.appendChild(content);
      
      return container;
    }
    
    createNumberInput(setting) {
      const el = document.createElement('div');
      el.className = 'zp-number-input';
      
      const input = document.createElement('input');
      input.type = 'number';
      input.min = setting.min || 1;
      input.max = setting.max || 100;
      input.value = getConfig()[setting.id] || setting.defaultValue;
      input.className = 'zp-number-input-field';
      
      el.appendChild(input);
      
      el.getValues = () => parseInt(input.value) || setting.defaultValue;
      el.element = el;
      
      return el;
    }
    
    createIntervalInput(setting) {
      const el = document.createElement('div');
      el.className = 'zp-interval-input';
      
      const config = getConfig()[setting.id] || { min: 3, max: 5 };
      
      const minInput = document.createElement('input');
      minInput.type = 'number';
      minInput.min = 1;
      minInput.max = 60;
      minInput.value = config.min;
      minInput.className = 'zp-interval-input-field';
      
      const sep = document.createElement('span');
      sep.textContent = '~';
      
      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      maxInput.min = 1;
      maxInput.max = 60;
      maxInput.value = config.max;
      maxInput.className = 'zp-interval-input-field';
      
      const unit = document.createElement('span');
      unit.textContent = '秒';
      
      el.appendChild(minInput);
      el.appendChild(sep);
      el.appendChild(maxInput);
      el.appendChild(unit);
      
      el.getValues = () => ({
        min: parseInt(minInput.value) || 3,
        max: parseInt(maxInput.value) || 5
      });
      el.element = el;
      
      return el;
    }
    
    createRangeInput(setting) {
      const el = document.createElement('div');
      el.className = 'zp-range-input';
      
      const config = getConfig()[setting.id] || { min: null, max: null };
      
      const minInput = document.createElement('input');
      minInput.type = 'number';
      minInput.placeholder = '最低';
      minInput.value = config.min || '';
      minInput.className = 'zp-range-input-field';
      
      const sep = document.createElement('span');
      sep.textContent = '~';
      
      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      maxInput.placeholder = '最高';
      maxInput.value = config.max || '';
      maxInput.className = 'zp-range-input-field';
      
      el.appendChild(minInput);
      el.appendChild(sep);
      el.appendChild(maxInput);
      
      el.getValues = () => ({
        min: minInput.value ? parseInt(minInput.value) : null,
        max: maxInput.value ? parseInt(maxInput.value) : null
      });
      el.element = el;
      
      return el;
    }
    
    createTextInput(setting) {
      const el = document.createElement('div');
      el.className = 'zp-text-input';
      
      const input = document.createElement('input');
      input.type = 'text';
      input.value = getConfig()[setting.id] || '';
      input.className = 'zp-text-input-field';
      input.placeholder = setting.desc;
      
      el.appendChild(input);
      
      el.getValues = () => input.value;
      el.element = el;
      
      return el;
    }
  }
  
  const settingsStyles = `
.zp-settings-panel {
  max-width: 840px !important;
}

.zp-settings-layout {
  display: flex;
  height: 600px;
}

.zp-settings-sidebar {
  width: 180px;
  border-right: 1px solid #f0f0f0;
  overflow-y: auto;
}

.zp-settings-nav {
  display: flex;
  flex-direction: column;
}

.zp-settings-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.zp-settings-nav-item:hover {
  background: #f8fafc;
}

.zp-settings-nav-item.is-active {
  background: #e6f7ff;
  color: #1677ff;
}

.zp-settings-nav-icon {
  width: 16px;
  height: 16px;
}

.zp-settings-nav-title {
  font-size: 14px;
  font-weight: 500;
}

.zp-settings-panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.zp-settings-panel-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.zp-settings-panel-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2329;
}

.zp-settings-panel-desc {
  font-size: 13px;
  color: #9ca3af;
  margin-top: 4px;
}

.zp-settings-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.zp-setting-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.zp-setting-label {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.zp-setting-desc {
  font-size: 13px;
  color: #9ca3af;
}

.zp-setting-content {
  margin-top: 8px;
}

.zp-settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
}

.zp-save-success {
  display: none;
}

.zp-number-input-field,
.zp-interval-input-field,
.zp-range-input-field,
.zp-text-input-field {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  min-width: 100px;
}

.zp-number-input-field:focus,
.zp-interval-input-field:focus,
.zp-range-input-field:focus,
.zp-text-input-field:focus {
  outline: none;
  border-color: #1677ff;
}

.zp-interval-input,
.zp-range-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zp-interval-input span,
.zp-range-input span {
  color: #9ca3af;
}
`;
  addStyle(settingsStyles);
  
  const copyJobStyles = `
.zp-copy-job-btn {
  position: fixed;
  bottom: 100px;
  right: 24px;
  z-index: 999995;
  padding: 10px 16px;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  font-size: 14px;
  color: #4b5563;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.zp-copy-job-btn:hover {
  border-color: #1677ff;
  color: #1677ff;
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.2);
}

.zp-copy-job-btn.zp-copied {
  background: #52c41a;
  border-color: #52c41a;
  color: #fff;
}

.zp-copy-job-btn svg {
  width: 14px;
  height: 14px;
}
`;
  addStyle(copyJobStyles);
  
  const copyJobInfo = () => {
    const title = document.querySelector('.job-title') || 
                 document.querySelector('h1') ||
                 document.querySelector('.position-title');
    const company = document.querySelector('.company-name') ||
                   document.querySelector('.job-company') ||
                   document.querySelector('[class*="company"]');
    const salary = document.querySelector('.salary') ||
                  document.querySelector('.job-salary');
    const desc = document.querySelector('.job-detail') ||
                document.querySelector('.position-desc') ||
                document.querySelector('.desc');
    
    const info = [];
    if (title) info.push(title.textContent.trim());
    if (company) info.push(`公司：${company.textContent.trim()}`);
    if (salary) info.push(`薪资：${salary.textContent.trim()}`);
    if (desc) {
      const text = desc.textContent.replace(/\s+/g, ' ').trim();
      if (text.length > 0) {
        info.push(`\n职位描述：${text.slice(0, 500)}${text.length > 500 ? '...' : ''}`);
      }
    }
    
    const text = info.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.querySelector('.zp-copy-job-btn');
      if (btn) {
        btn.classList.add('zp-copied');
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> 已复制`;
        setTimeout(() => {
          btn.classList.remove('zp-copied');
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> 复制岗位信息`;
        }, 2000);
      }
      toast.success('岗位信息已复制');
    }).catch(() => {
      toast.error('复制失败，请手动复制');
    });
  };
  
  const initCopyButton = () => {
    if (document.querySelector('.zp-copy-job-btn')) return;
    
    const btn = document.createElement('button');
    btn.className = 'zp-copy-job-btn';
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> 复制岗位信息`;
    btn.onclick = copyJobInfo;
    document.body.appendChild(btn);
  };
  
  const isJobDetailPage = () => {
    return location.pathname.includes('/jobdetail/') || 
           location.pathname.includes('/jobs/');
  };
  
  const statsStyles = `
.zp-stats-content {
  padding: 24px;
}

.zp-stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.zp-stats-total {
  font-size: 24px;
  font-weight: 700;
  color: #1677ff;
}

.zp-stats-period {
  font-size: 14px;
  color: #9ca3af;
}

.zp-stats-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 200px;
  padding: 20px 0;
  border-bottom: 1px solid #e5e7eb;
}

.zp-stats-bar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.zp-stats-bar {
  width: 32px;
  min-height: 4px;
  background: linear-gradient(180deg, #1677ff 0%, #4096ff 100%);
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
}

.zp-stats-bar-empty {
  background: #f3f4f6;
}

.zp-stats-count {
  font-size: 12px;
  font-weight: 600;
  color: #4b5563;
}

.zp-stats-date {
  font-size: 12px;
  color: #9ca3af;
}

.zp-stats-list {
  margin-top: 20px;
}

.zp-stats-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.zp-stats-row:last-child {
  border-bottom: none;
}

.zp-stats-row-date {
  color: #4b5563;
}

.zp-stats-row-count {
  font-weight: 600;
  color: #1f2329;
}

.zp-stats-empty {
  text-align: center;
  padding: 40px 0;
  color: #9ca3af;
}
`;
  addStyle(statsStyles);
  
  const showApplyStats = () => {
    const modal = new Modal({ title: '投递统计', width: '520px' });
    const content = document.createElement('div');
    content.className = 'zp-stats-content';
    
    const stats = getApplyStats(7);
    const total = getTotalApplyCount(7);
    const maxCount = Math.max(...stats.map(s => s.count), 1);
    
    if (total === 0) {
      content.innerHTML = `
        <div class="zp-stats-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5">
            <path d="M18 20V10"/>
            <path d="M12 20V4"/>
            <path d="M6 20v-6"/>
          </svg>
          <p style="margin-top: 16px;">暂无投递记录</p>
          <p style="font-size: 13px;">开始自动投递后会显示统计数据</p>
        </div>
      `;
    } else {
      const chartBars = stats.map(s => {
        const height = Math.max(4, (s.count / maxCount) * 160);
        const barClass = s.count === 0 ? 'zp-stats-bar zp-stats-bar-empty' : 'zp-stats-bar';
        return `
          <div class="zp-stats-bar-wrapper">
            <span class="zp-stats-count">${s.count}</span>
            <div class="${barClass}" style="height: ${height}px;"></div>
            <span class="zp-stats-date">${s.display}</span>
          </div>
        `;
      }).reverse().join('');
      
      const listRows = stats.map(s => `
        <div class="zp-stats-row">
          <span class="zp-stats-row-date">${s.date}</span>
          <span class="zp-stats-row-count">${s.count} 次</span>
        </div>
      `).join('');
      
      content.innerHTML = `
        <div class="zp-stats-header">
          <div>
            <div class="zp-stats-total">${total} 次</div>
            <div class="zp-stats-period">近7天投递总数</div>
          </div>
        </div>
        <div class="zp-stats-chart">${chartBars}</div>
        <div class="zp-stats-list">${listRows}</div>
      `;
    }
    
    modal.setContent(content);
    
    const footer = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'zp-modal-btn zp-modal-btn-primary zp-pressable';
    closeBtn.textContent = '关闭';
    closeBtn.onclick = () => modal.destroy();
    footer.appendChild(closeBtn);
    modal.setFooter(footer);
    
    modal.show();
  };
  
  class FloatingActions {
    constructor() {
      this.autoApply = new AutoApply();
      this.isAutoRunning = false;
      this.settings = new Settings();
      this.init();
    }
    
    init() {
      this.container = document.createElement('div');
      this.container.className = 'zp-floating-actions';
      
      this.autoApplyBtn = document.createElement('button');
      this.autoApplyBtn.className = 'zp-floating-action';
      this.autoApplyBtn.id = 'zp-auto-apply-btn';
      this.autoApplyBtn.dataset.tooltip = '自动投递';
      this.autoApplyBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      `;
      this.autoApplyBtn.onclick = () => this.toggleAutoApply();
      
      this.statsBtn = document.createElement('button');
      this.statsBtn.className = 'zp-floating-action';
      this.statsBtn.dataset.tooltip = '投递统计';
      this.statsBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 20V10"/>
          <path d="M12 20V4"/>
          <path d="M6 20v-6"/>
        </svg>
      `;
      this.statsBtn.onclick = () => showApplyStats();
      
      this.settingsBtn = document.createElement('button');
      this.settingsBtn.className = 'zp-floating-action';
      this.settingsBtn.dataset.tooltip = '设置';
      this.settingsBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      `;
      this.settingsBtn.onclick = () => this.settings.open();
      
      this.container.appendChild(this.autoApplyBtn);
      this.container.appendChild(this.statsBtn);
      this.container.appendChild(this.settingsBtn);
      document.body.appendChild(this.container);
    }
    
    toggleAutoApply() {
      if (this.isAutoRunning) {
        this.autoApply.stop();
        this.isAutoRunning = false;
        this.autoApplyBtn.classList.remove('zp-active');
        this.autoApplyBtn.dataset.tooltip = '自动投递';
      } else {
        this.isAutoRunning = true;
        this.autoApplyBtn.classList.add('zp-active');
        this.autoApplyBtn.dataset.tooltip = '停止投递';
        this.autoApply.start();
      }
    }
  }
  
  const changelogData = [
    { version: '1.0.0', date: '2026-07-08', details: [
      '【新增】自动投递功能，支持批量投递智联招聘职位',
      '【新增】岗位过滤功能，支持按关键词、薪资、猎头等过滤',
      '【新增】公司黑名单管理，支持自动和手动添加',
      '【新增】公司成立时间和注册资金过滤',
      '【新增】一键复制岗位信息',
      '【新增】只收藏模式，可选择收藏而非投递',
      '【新增】屏蔽急聘岗位功能',
      '【新增】详情页关键词白名单模式',
      '【新增】数据备份恢复功能',
      '【新增】设置重置功能'
    ]}
  ];
  
  const showChangelog = () => {
    const modal = new Modal({ title: '更新日志', width: '520px', hideFooter: true });
    const content = document.createElement('div');
    content.className = 'zp-changelog-list';
    
    let html = '';
    changelogData.forEach(item => {
      html += `
        <div class="zp-changelog-item">
          <div class="zp-changelog-header">
            <span class="zp-changelog-version">v${item.version}</span>
            <span class="zp-changelog-date">${item.date}</span>
          </div>
          <ul class="zp-changelog-details">
            ${item.details.map(d => `<li>${d}</li>`).join('')}
          </ul>
        </div>
      `;
    });
    
    content.innerHTML = html;
    modal.setContent(content);
    modal.show();
  };
  
  const changelogStyles = `
.zp-changelog-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 8px 0;
}

.zp-changelog-item {
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  padding-left: 20px;
}

.zp-changelog-item:before {
  content: '';
  position: absolute;
  left: 0;
  top: 12px;
  bottom: -20px;
  width: 2px;
  background: #e5e7eb;
  border-radius: 2px;
}

.zp-changelog-item:last-child:before {
  display: none;
}

.zp-changelog-item:after {
  content: '';
  position: absolute;
  left: -4px;
  top: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #1677ff;
}

.zp-changelog-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.zp-changelog-version {
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
}

.zp-changelog-date {
  font-size: 13px;
  color: #9ca3af;
}

.zp-changelog-details {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.zp-changelog-details li {
  font-size: 14px;
  color: #4b5563;
  line-height: 1.6;
  padding-left: 16px;
  position: relative;
}

.zp-changelog-details li:before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 4px;
  height: 4px;
  background: #1677ff;
  border-radius: 50%;
}
`;
  addStyle(changelogStyles);
  
  const showAbout = () => {
    const modal = new Modal({ title: '关于 Zhaopin-Plus', width: '480px' });
    const content = document.createElement('div');
    content.className = 'zp-about-content';
    
    content.innerHTML = `
      <div class="zp-about-identity">
        <div class="zp-about-logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1677ff" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <div class="zp-about-main">
          <div class="zp-about-name">Zhaopin-Plus</div>
          <div class="zp-about-desc">智联招聘投递辅助脚本</div>
        </div>
      </div>
      <div class="zp-about-free">
        <span class="zp-about-free-main">永久免费</span>
      </div>
      <div class="zp-about-rows">
        <button class="zp-about-row zp-about-action zp-pressable" type="button">
          <span class="zp-about-label">当前版本</span>
          <span class="zp-about-value">v1.0.0</span>
        </button>
        <button class="zp-about-row zp-about-action zp-pressable" type="button" onclick="showChangelog()">
          <span class="zp-about-label">更新日志</span>
          <span class="zp-about-value">查看历史版本</span>
        </button>
      </div>
    `;
    
    modal.setContent(content);
    
    const footer = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'zp-modal-btn zp-modal-btn-primary zp-pressable';
    closeBtn.textContent = '关闭';
    closeBtn.onclick = () => modal.destroy();
    footer.appendChild(closeBtn);
    modal.setFooter(footer);
    
    modal.show();
  };
  
  const aboutStyles = `
.zp-about-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.zp-about-identity {
  display: flex;
  align-items: center;
  gap: 16px;
}

.zp-about-logo {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e6f7ff;
  border-radius: 12px;
}

.zp-about-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.zp-about-name {
  font-size: 20px;
  font-weight: 700;
  color: #1f2329;
}

.zp-about-desc {
  font-size: 14px;
  color: #9ca3af;
}

.zp-about-free {
  background: #fef3c7;
  padding: 12px 16px;
  border-radius: 8px;
  text-align: center;
}

.zp-about-free-main {
  font-size: 16px;
  font-weight: 700;
  color: #d97706;
}

.zp-about-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.zp-about-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.zp-about-row:hover {
  background: #f1f5f9;
}

.zp-about-label {
  font-size: 14px;
  color: #4b5563;
}

.zp-about-value {
  font-size: 14px;
  color: #1677ff;
  font-weight: 500;
}
`;
  addStyle(aboutStyles);
  
  const showDataBackup = () => {
    const modal = new Modal({ title: '数据迁移', width: '520px' });
    const content = document.createElement('div');
    content.className = 'zp-data-backup-content';
    
    content.innerHTML = `
      <div class="zp-data-section">
        <div class="zp-data-title">备份数据</div>
        <div class="zp-data-desc">将当前设置和黑名单数据导出为 JSON 文件</div>
        <button class="zp-data-btn zp-data-btn-primary zp-pressable" onclick="exportData()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          导出备份
        </button>
      </div>
      <div class="zp-data-section">
        <div class="zp-data-title">恢复数据</div>
        <div class="zp-data-desc">从之前导出的 JSON 文件恢复数据</div>
        <input type="file" id="zp-data-file" accept=".json" style="display: none;" onchange="importData(this)">
        <button class="zp-data-btn zp-data-btn-secondary zp-pressable" onclick="document.getElementById('zp-data-file').click()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          导入备份
        </button>
      </div>
    `;
    
    modal.setContent(content);
    
    const footer = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'zp-modal-btn zp-modal-btn-primary zp-pressable';
    closeBtn.textContent = '关闭';
    closeBtn.onclick = () => modal.destroy();
    footer.appendChild(closeBtn);
    modal.setFooter(footer);
    
    modal.show();
  };
  
  const dataBackupStyles = `
.zp-data-backup-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.zp-data-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.zp-data-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
}

.zp-data-desc {
  font-size: 13px;
  color: #9ca3af;
}

.zp-data-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
  margin-top: 8px;
}

.zp-data-btn-primary {
  background: #1677ff;
  color: #fff;
}

.zp-data-btn-primary:hover {
  background: #4096ff;
}

.zp-data-btn-secondary {
  background: #fff;
  color: #4b5563;
  border-color: #d1d5db;
}

.zp-data-btn-secondary:hover {
  background: #f8fafc;
}
`;
  addStyle(dataBackupStyles);
  
  window.exportData = () => {
    const data = {
      config: getConfig(),
      blacklist: getBlacklist(),
      version: '1.0.0',
      exportTime: Date.now()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zhaopin-plus-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('数据已导出');
  };
  
  window.importData = (input) => {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.config) {
          saveConfig(data.config);
        }
        if (data.blacklist) {
          storage.set('zp_blacklist', data.blacklist);
        }
        toast.success('数据已恢复');
        window.dispatchEvent(new CustomEvent('zp_config_changed'));
      } catch (err) {
        toast.error('数据格式错误');
      }
    };
    reader.readAsText(file);
    input.value = '';
  };
  
  window.showChangelog = showChangelog;
  
  const init = () => {
    new FloatingActions();
    
    if (isJobDetailPage() && getConfig().enableCopyJob) {
      initCopyButton();
    }
    
    const observer = new MutationObserver(() => {
      if (isJobDetailPage() && !document.querySelector('.zp-copy-job-btn')) {
        initCopyButton();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();
