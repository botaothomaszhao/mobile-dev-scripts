// ==UserScript==
// @name         mobile-dev-页面内日志显示
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  显示控制台消息
// @author       AI
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 创建日志容器
    const logContainer = document.createElement('div');
    logContainer.id = 'tm-log-container';
    logContainer.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        width: 300px;
        max-height: 200px;
        background: rgba(0,0,0,0.8);
        color: #0f0;
        font-family: monospace;
        font-size: 12px;
        padding: 10px;
        overflow-y: auto;
        z-index: 999999;
        border-radius: 5px;
        display: ${/Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'block' : 'none'};
    `;

    // 清空按钮
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '清空';
    clearBtn.style.cssText = `
        position: absolute;
        top: 2px;
        right: 2px;
        background: #f00;
        color: #fff;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        font-size: 10px;
        padding: 2px 5px;
    `;
    clearBtn.onclick = () => logContent.innerHTML = '';

    const logContent = document.createElement('div');
    logContent.style.marginTop = '20px';

    logContainer.appendChild(clearBtn);
    logContainer.appendChild(logContent);
    document.body.appendChild(logContainer);

    // 重写console方法
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    function addLog(message, type = 'log') {
        const entry = document.createElement('div');
        const time = new Date().toLocaleTimeString();
        const prefix = `[${time}]`;

        entry.style.cssText = `
            margin: 2px 0;
            padding: 2px;
            border-left: 3px solid ${type === 'error' ? '#f00' : type === 'warn' ? '#ff0' : '#0f0'};
            padding-left: 5px;
        `;

        // 处理对象
        const msgStr = typeof message === 'object' ? JSON.stringify(message, null, 2) : String(message);
        entry.textContent = `${prefix} ${msgStr}`;

        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
    }

    console.log = function(...args) {
        originalLog.apply(console, args);
        args.forEach(arg => addLog(arg, 'log'));
    };

    console.warn = function(...args) {
        originalWarn.apply(console, args);
        args.forEach(arg => addLog(arg, 'warn'));
    };

    console.error = function(...args) {
        originalError.apply(console, args);
        args.forEach(arg => addLog(arg, 'error'));
    };

    // 测试
    console.log('Tampermonkey脚本已加载');
})();
