// ==UserScript==
// @name         mobile-dev-键盘事件调试器
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  在页面上显示键盘事件参数，用于调试移动端键盘行为
// @author       AI
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let panel = null;
    let eventCount = 0;
    const maxEvents = 10; // 最多显示10个事件

    // 创建显示面板
    function createPanel() {
        // 如果面板已存在，只是隐藏，则显示并返回
        if (panel) {
            panel.style.display = 'block';
            return;
        }

        panel = document.createElement('div');
        panel.id = 'keyEventDebugger';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 999999;
            max-width: 300px;
            word-wrap: break-word;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;

        // 创建关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 2px;
            right: 5px;
            background: transparent;
            color: white;
            border: none;
            font-size: 16px;
            cursor: pointer;
        `;
        closeBtn.onclick = () => panel.style.display = 'none';

        // 创建标题
        const title = document.createElement('div');
        title.textContent = '键盘事件调试 (Ctrl+Shift+K 重开)';
        title.style.cssText = `
            font-weight: bold;
            margin-bottom: 5px;
            border-bottom: 1px solid #555;
            padding-bottom: 5px;
        `;

        // 创建内容区域
        const content = document.createElement('div');
        content.id = 'keyEventLog';

        panel.appendChild(closeBtn);
        panel.appendChild(title);
        panel.appendChild(content);
        document.body.appendChild(panel);

        // 添加清除按钮
        const clearBtn = document.createElement('button');
        clearBtn.textContent = '清除';
        clearBtn.style.cssText = `
            margin-top: 10px;
            background: #2196F3;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
            width: 100%;
        `;
        clearBtn.onclick = () => {
            content.innerHTML = '';
            eventCount = 0;
        };
        panel.appendChild(clearBtn);

        // 添加设备信息显示
        const deviceInfo = document.createElement('div');
        deviceInfo.style.cssText = `
            margin-top: 10px;
            padding: 5px;
            background: rgba(33,150,243,0.2);
            border-radius: 3px;
            font-size: 11px;
        `;
        deviceInfo.innerHTML = `
            <div style="font-weight: bold;">设备信息:</div>
            <div>UA: ${navigator.userAgent.substring(0, 50)}...</div>
            <div>移动设备: ${/Mobi|Android/i.test(navigator.userAgent) ? '是' : '否'}</div>
            <div>触摸支持: ${('ontouchstart' in window) ? '是' : '否'}</div>
        `;
        panel.appendChild(deviceInfo);

        // 添加事件监听器
        addEventListeners();
    }

    // 格式化事件信息
    function formatEvent(e, eventType) {
        const timestamp = new Date().toLocaleTimeString();
        return `
<div style="margin-bottom: 8px; padding: 5px; background: rgba(255,255,255,0.1); border-radius: 3px;">
    <div style="color: #4CAF50; font-weight: bold;">${eventType} #${++eventCount}</div>
    <div style="color: #FFC107;">时间: ${timestamp}</div>
    <div>key: "${e.key}" (code: ${e.code})</div>
    <div style="color: ${e.shiftKey ? '#FF5252' : '#81C784'};">
        shiftKey: ${e.shiftKey} ${e.shiftKey ? '✓' : '✗'}
    </div>
    <div>ctrlKey: ${e.ctrlKey}</div>
    <div>altKey: ${e.altKey}</div>
    <div>metaKey: ${e.metaKey}</div>
    <div>keyCode: ${e.keyCode} (which: ${e.which})</div>
    <div>location: ${e.location}</div>
</div>`;
    }

    // 监听键盘事件
    function addEventListener(eventType) {
        document.addEventListener(eventType, function(e) {
            // 检查是否是重新打开面板的快捷键
            if (e.ctrlKey && e.shiftKey && e.key === 'K') {
                e.preventDefault();
                createPanel();
                return;
            }

            // 如果面板不存在或已隐藏，不处理事件
            if (!panel || panel.style.display === 'none') return;

            const content = document.getElementById('keyEventLog');
            if (!content) return;

            const eventHtml = formatEvent(e, eventType);
            const currentContent = content.innerHTML;
            
            // 保持最多显示maxEvents个事件
            const events = currentContent.split('</div>');
            if (events.length > maxEvents * 2) {
                content.innerHTML = eventHtml;
            } else {
                content.innerHTML = eventHtml + currentContent;
            }
        }, true); // 使用捕获阶段
    }

    // 添加三种键盘事件的监听器
    function addEventListeners() {
        addEventListener('keydown');
        addEventListener('keypress');
        addEventListener('keyup');
    }

    // 创建重新打开按钮（固定在页面左下角）
    function createReopenButton() {
        const reopenBtn = document.createElement('button');
        reopenBtn.id = 'keyEventReopenBtn';
        reopenBtn.textContent = '🔍';
        reopenBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: #2196F3;
            color: white;
            border: none;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            font-size: 20px;
            cursor: pointer;
            z-index: 999998;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;
        reopenBtn.title = '重新打开键盘事件调试面板 (Ctrl+Shift+K)';
        reopenBtn.onclick = createPanel;
        reopenBtn.onmouseover = () => {
            reopenBtn.style.transform = 'scale(1.1)';
            reopenBtn.style.background = '#1976D2';
        };
        reopenBtn.onmouseout = () => {
            reopenBtn.style.transform = 'scale(1)';
            reopenBtn.style.background = '#2196F3';
        };
        document.body.appendChild(reopenBtn);

        // 如果面板存在且显示，隐藏按钮；否则显示按钮
        function updateButtonVisibility() {
            if (panel && panel.style.display !== 'none') {
                reopenBtn.style.display = 'none';
            } else {
                reopenBtn.style.display = 'block';
            }
        }

        // 监听面板显示状态变化
        const observer = new MutationObserver(updateButtonVisibility);
        if (panel) {
            observer.observe(panel, { attributes: true, attributeFilter: ['style'] });
        }
        updateButtonVisibility();
    }

    // 初始化
    createPanel();
    createReopenButton();
})();
