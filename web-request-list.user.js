// ==UserScript==
// @name         mobile-dev-请求监控
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  在网页上添加虚拟控制台，查看所有网络请求及其内容，支持JSON数据展开和请求测试
// @author       AI
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 存储所有请求数据
    let requests = [];
    let consoleVisible = false;
    let consoleElement = null;
    let currentSelectedRequest = null; // 当前选中的请求用于测试
    let testPanel = null;

    // JSON数据解析和展开功能
    const JSONViewer = {
        // 解析JSON字符串
        parseJSON: function(str) {
            try {
                return JSON.parse(str);
            } catch (e) {
                return str;
            }
        },

        // 判断是否为JSON字符串
        isJSON: function(str) {
            if (typeof str !== 'string') return false;
            try {
                JSON.parse(str);
                return true;
            } catch (e) {
                return false;
            }
        },

        // 创建可展开的JSON视图
        createJSONView: function(data, depth = 0) {
            const container = document.createElement('div');
            container.className = 'json-viewer';

            if (depth > 10) { // 防止无限递归
                container.textContent = '... (深度限制)';
                return container;
            }

            if (data === null) {
                container.innerHTML = '<span class="json-null">null</span>';
            } else if (typeof data === 'boolean') {
                container.innerHTML = `<span class="json-boolean">${data}</span>`;
            } else if (typeof data === 'number') {
                container.innerHTML = `<span class="json-number">${data}</span>`;
            } else if (typeof data === 'string') {
                if (this.isJSON(data)) {
                    const parsed = this.parseJSON(data);
                    container.appendChild(this.createJSONView(parsed, depth + 1));
                } else {
                    container.innerHTML = `<span class="json-string">"${this.escapeHTML(data)}"</span>`;
                }
            } else if (Array.isArray(data)) {
                if (data.length === 0) {
                    container.innerHTML = '<span class="json-array">[]</span>';
                } else {
                    const summary = document.createElement('span');
                    summary.className = 'json-toggle';
                    summary.innerHTML = `<span class="json-bracket">[</span> <span class="json-count">${data.length} items</span> <span class="json-bracket">]</span>`;

                    const content = document.createElement('div');
                    content.className = 'json-content';
                    content.style.display = 'none';

                    data.forEach((item, index) => {
                        const itemDiv = document.createElement('div');
                        itemDiv.className = 'json-item';
                        const indexSpan = document.createElement('span');
                        indexSpan.className = 'json-index';
                        indexSpan.textContent = `${index}:`;
                        itemDiv.appendChild(indexSpan);
                        itemDiv.appendChild(this.createJSONView(item, depth + 1));
                        content.appendChild(itemDiv);
                    });

                    container.appendChild(summary);
                    container.appendChild(content);

                    // 直接绑定事件，不使用innerHTML
                    summary.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (content.style.display === 'none') {
                            content.style.display = 'block';
                            summary.classList.add('expanded');
                        } else {
                            content.style.display = 'none';
                            summary.classList.remove('expanded');
                        }
                    });
                }
            } else if (typeof data === 'object') {
                const keys = Object.keys(data);
                if (keys.length === 0) {
                    container.innerHTML = '<span class="json-object">{}</span>';
                } else {
                    const summary = document.createElement('span');
                    summary.className = 'json-toggle';
                    summary.innerHTML = `<span class="json-bracket">{</span> <span class="json-count">${keys.length} properties</span> <span class="json-bracket">}</span>`;

                    const content = document.createElement('div');
                    content.className = 'json-content';
                    content.style.display = 'none';

                    keys.forEach(key => {
                        const itemDiv = document.createElement('div');
                        itemDiv.className = 'json-item';
                        const keySpan = document.createElement('span');
                        keySpan.className = 'json-key';
                        keySpan.textContent = `"${key}"`;
                        const colonSpan = document.createElement('span');
                        colonSpan.className = 'json-colon';
                        colonSpan.textContent = ': ';
                        itemDiv.appendChild(keySpan);
                        itemDiv.appendChild(colonSpan);
                        itemDiv.appendChild(this.createJSONView(data[key], depth + 1));
                        content.appendChild(itemDiv);
                    });

                    container.appendChild(summary);
                    container.appendChild(content);

                    // 直接绑定事件
                    summary.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (content.style.display === 'none') {
                            content.style.display = 'block';
                            summary.classList.add('expanded');
                        } else {
                            content.style.display = 'none';
                            summary.classList.remove('expanded');
                        }
                    });
                }
            }

            return container;
        },

        // HTML转义
        escapeHTML: function(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    };

    // 创建测试请求面板
    function createTestPanel() {
        const testPanel = document.createElement('div');
        testPanel.id = 'test-request-panel';
        testPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 80%;
            height: 70%;
            background: #1e1e1e;
            border: 2px solid #333;
            border-radius: 8px;
            z-index: 99998;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 12px;
            color: #fff;
            display: none;
            flex-direction: column;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;

        // 测试面板头部
        const header = document.createElement('div');
        header.style.cssText = `
            background: #333;
            padding: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #555;
            border-radius: 6px 6px 0 0;
        `;

        const headerTitle = document.createElement('div');
        headerTitle.style.fontWeight = 'bold';
        headerTitle.textContent = '发送测试请求';

        const headerButtons = document.createElement('div');

        const sendBtn = document.createElement('button');
        sendBtn.id = 'send-test-request';
        sendBtn.textContent = '发送请求';
        sendBtn.style.cssText = 'margin-right: 10px; background: #28a745; color: white; border: none; padding: 5px 15px; border-radius: 3px; cursor: pointer;';

        const closeBtn = document.createElement('button');
        closeBtn.id = 'close-test-panel';
        closeBtn.textContent = '关闭';
        closeBtn.style.cssText = 'background: #d9534f; color: white; border: none; padding: 5px 15px; border-radius: 3px; cursor: pointer;';

        headerButtons.appendChild(sendBtn);
        headerButtons.appendChild(closeBtn);

        header.appendChild(headerTitle);
        header.appendChild(headerButtons);

        // 测试面板内容
        const content = document.createElement('div');
        content.style.cssText = `
            flex: 1;
            padding: 15px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 15px;
        `;

        // 请求方法选择
        const methodRow = document.createElement('div');
        methodRow.style.cssText = 'display: flex; align-items: center; gap: 10px;';
        methodRow.innerHTML = `
            <label style="min-width: 60px;">方法:</label>
            <select id="test-method" style="background: #252525; color: white; border: 1px solid #555; padding: 5px; border-radius: 3px;">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
                <option value="HEAD">HEAD</option>
                <option value="OPTIONS">OPTIONS</option>
            </select>
        `;

        // URL输入
        const urlRow = document.createElement('div');
        urlRow.style.cssText = 'display: flex; align-items: center; gap: 10px;';
        urlRow.innerHTML = `
            <label style="min-width: 60px;">URL:</label>
            <input type="text" id="test-url" style="flex: 1; background: #252525; color: white; border: 1px solid #555; padding: 5px; border-radius: 3px;">
        `;

        // 请求头编辑
        const headersRow = document.createElement('div');
        headersRow.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
        headersRow.innerHTML = `
            <label>请求头:</label>
            <textarea id="test-headers" style="height: 120px; background: #252525; color: white; border: 1px solid #555; padding: 8px; border-radius: 3px; font-family: monospace; font-size: 11px; resize: vertical;"></textarea>
            <div style="font-size: 11px; color: #888;">格式: HeaderName: HeaderValue (每行一个)</div>
        `;

        // 请求体编辑
        const bodyRow = document.createElement('div');
        bodyRow.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
        bodyRow.innerHTML = `
            <label>请求体:</label>
            <textarea id="test-body" style="height: 150px; background: #252525; color: white; border: 1px solid #555; padding: 8px; border-radius: 3px; font-family: monospace; font-size: 11px; resize: vertical;"></textarea>
            <div style="font-size: 11px; color: #888;">支持 JSON、表单数据等格式</div>
        `;

        // 响应显示区域
        const responseRow = document.createElement('div');
        responseRow.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
        responseRow.innerHTML = `
            <label>响应:</label>
            <div id="test-response" style="height: 200px; background: #252525; border: 1px solid #555; padding: 8px; border-radius: 3px; overflow-y: auto; font-family: monospace; font-size: 11px; white-space: pre-wrap;"></div>
        `;

        content.appendChild(methodRow);
        content.appendChild(urlRow);
        content.appendChild(headersRow);
        content.appendChild(bodyRow);
        content.appendChild(responseRow);

        testPanel.appendChild(header);
        testPanel.appendChild(content);

        // 添加事件监听
        closeBtn.addEventListener('click', closeTestPanel);
        sendBtn.addEventListener('click', sendTestRequest);

        document.body.appendChild(testPanel);
        return testPanel;
    }

    function openTestPanel(request) {
        if (!testPanel) {
            testPanel = createTestPanel();
        }

        currentSelectedRequest = request;

        // 填充表单数据
        document.getElementById('test-method').value = request.method || 'GET';
        document.getElementById('test-url').value = request.url || '';

        // 填充请求头
        const headersText = Object.entries(request.requestHeaders || {})
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
        document.getElementById('test-headers').value = headersText;

        // 填充请求体
        let requestBody = request.requestData;
        if (typeof requestBody === 'object' && requestBody !== null) {
            requestBody = JSON.stringify(requestBody, null, 2);
        }
        document.getElementById('test-body').value = requestBody || '';

        // 清空响应区域
        document.getElementById('test-response').textContent = '';

        testPanel.style.display = 'flex';
    }

    function closeTestPanel() {
        if (testPanel) {
            testPanel.style.display = 'none';
        }
    }

    async function sendTestRequest() {
        const method = document.getElementById('test-method').value;
        const url = document.getElementById('test-url').value;
        const headersText = document.getElementById('test-headers').value;
        const body = document.getElementById('test-body').value;
        const responseDiv = document.getElementById('test-response');

        if (!url) {
            responseDiv.textContent = '错误: URL 不能为空';
            return;
        }

        try {
            // 解析请求头
            const headers = {};
            if (headersText.trim()) {
                headersText.split('\n').forEach(line => {
                    const colonIndex = line.indexOf(':');
                    if (colonIndex > -1) {
                        const key = line.substring(0, colonIndex).trim();
                        const value = line.substring(colonIndex + 1).trim();
                        if (key) {
                            headers[key] = value;
                        }
                    }
                });
            }

            // 准备请求配置
            const config = {
                method: method,
                headers: headers
            };

            // 处理请求体（非 GET/HEAD 请求）
            if (method !== 'GET' && method !== 'HEAD' && body) {
                // 尝试检测 Content-Type 来自动处理数据格式
                const contentType = headers['Content-Type'] || headers['content-type'];
                if (contentType && contentType.includes('application/json')) {
                    config.body = JSON.stringify(JSON.parse(body));
                } else {
                    config.body = body;
                }
            }

            responseDiv.textContent = '发送请求中...';

            // 发送请求
            const startTime = Date.now();
            const response = await fetch(url, config);
            const duration = Date.now() - startTime;

            // 读取响应数据
            let responseData;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                responseData = await response.json();
            } else {
                responseData = await response.text();
            }

            // 显示响应结果
            let responseText = `状态: ${response.status} ${response.statusText}\n`;
            responseText += `耗时: ${duration}ms\n`;
            responseText += `URL: ${response.url}\n\n`;
            responseText += '响应头:\n';

            // 添加响应头
            response.headers.forEach((value, key) => {
                responseText += `  ${key}: ${value}\n`;
            });

            responseText += '\n响应体:\n';

            // 格式化响应体
            if (typeof responseData === 'object') {
                responseText += JSON.stringify(responseData, null, 2);
            } else {
                responseText += responseData;
            }

            responseDiv.textContent = responseText;

        } catch (error) {
            responseDiv.textContent = `请求失败: ${error.message}\n${error.stack}`;
        }
    }

    // 创建控制台界面
    function createConsole() {
        const consoleDiv = document.createElement('div');
        consoleDiv.id = 'network-monitor-console';
        consoleDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 95%;
            height: 85%;
            background: #1e1e1e;
            border: 2px solid #333;
            border-radius: 8px;
            z-index: 10000;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 12px;
            color: #fff;
            display: none;
            flex-direction: column;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;

        // 控制台头部
        const header = document.createElement('div');
        header.style.cssText = `
            background: #333;
            padding: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #555;
            border-radius: 6px 6px 0 0;
        `;

        const headerTitle = document.createElement('div');
        headerTitle.style.fontWeight = 'bold';
        headerTitle.textContent = `网络请求监控器 (${requests.length} 个请求)`;

        const headerButtons = document.createElement('div');

        const expandAllBtn = document.createElement('button');
        expandAllBtn.id = 'expand-all';
        expandAllBtn.textContent = '展开所有';
        expandAllBtn.style.cssText = 'margin-right: 10px; background: #555; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;';

        const clearBtn = document.createElement('button');
        clearBtn.id = 'clear-requests';
        clearBtn.textContent = '清空';
        clearBtn.style.cssText = 'margin-right: 10px; background: #555; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;';

        // 新增测试按钮
        const testBtn = document.createElement('button');
        testBtn.id = 'test-request';
        testBtn.textContent = '测试请求';
        testBtn.style.cssText = 'margin-right: 10px; background: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;';
        testBtn.disabled = true; // 初始禁用，选中请求后启用

        const closeBtn = document.createElement('button');
        closeBtn.id = 'close-console';
        closeBtn.textContent = '关闭';
        closeBtn.style.cssText = 'background: #d9534f; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;';

        headerButtons.appendChild(expandAllBtn);
        headerButtons.appendChild(clearBtn);
        headerButtons.appendChild(testBtn);
        headerButtons.appendChild(closeBtn);

        header.appendChild(headerTitle);
        header.appendChild(headerButtons);

        // 控制台内容区域
        const content = document.createElement('div');
        content.style.cssText = `
            flex: 1;
            display: flex;
            overflow: hidden;
        `;

        // 请求列表
        const requestList = document.createElement('div');
        requestList.id = 'request-list';
        requestList.style.cssText = `
            width: 40%;
            overflow-y: auto;
            border-right: 1px solid #555;
            background: #252525;
        `;

        // 请求详情
        const requestDetail = document.createElement('div');
        requestDetail.id = 'request-detail';
        requestDetail.style.cssText = `
            width: 60%;
            overflow-y: auto;
            padding: 10px;
            background: #1e1e1e;
        `;

        content.appendChild(requestList);
        content.appendChild(requestDetail);
        consoleDiv.appendChild(header);
        consoleDiv.appendChild(content);

        // 添加JSON查看器样式
        const style = document.createElement('style');
        style.textContent = `
            .json-viewer {
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 12px;
                line-height: 1.4;
            }
            .json-toggle {
                cursor: pointer;
                user-select: none;
                padding: 2px 4px;
                border-radius: 3px;
            }
            .json-toggle:hover {
                background: #2a2a2a;
            }
            .json-toggle::before {
                content: '▶';
                display: inline-block;
                margin-right: 4px;
                font-size: 10px;
                transition: transform 0.2s;
            }
            .json-toggle.expanded::before {
                transform: rotate(90deg);
            }
            .json-content {
                margin-left: 16px;
                border-left: 1px dashed #444;
                padding-left: 8px;
            }
            .json-item {
                margin: 2px 0;
            }
            .json-key {
                color: #9cdcfe;
            }
            .json-index {
                color: #9cdcfe;
            }
            .json-string {
                color: #ce9178;
            }
            .json-number {
                color: #b5cea8;
            }
            .json-boolean {
                color: #569cd6;
            }
            .json-null {
                color: #569cd6;
            }
            .json-bracket {
                color: #ffd700;
            }
            .json-colon {
                color: #ffd700;
            }
            .json-count {
                color: #888;
                font-style: italic;
            }
            .data-section {
                margin-bottom: 15px;
            }
            .data-section h4 {
                color: #569cd6;
                margin: 0 0 8px 0;
                font-size: 13px;
            }
            .data-content {
                background: #252525;
                padding: 10px;
                border-radius: 4px;
                overflow-x: auto;
            }
            .raw-data-toggle {
                background: #333;
                border: none;
                color: #ccc;
                padding: 4px 8px;
                margin-top: 8px;
                cursor: pointer;
                border-radius: 3px;
                font-size: 11px;
            }
            .raw-data-toggle:hover {
                background: #444;
            }
        `;
        consoleDiv.appendChild(style);

        document.body.appendChild(consoleDiv);

        // 添加事件监听器
        closeBtn.addEventListener('click', toggleConsole);
        clearBtn.addEventListener('click', clearRequests);
        expandAllBtn.addEventListener('click', expandAllJSON);
        testBtn.addEventListener('click', function() {
            if (currentSelectedRequest) {
                openTestPanel(currentSelectedRequest);
            }
        });

        return consoleDiv;
    }

    // 展开所有JSON
    function expandAllJSON() {
        const toggles = document.querySelectorAll('.json-toggle');
        toggles.forEach(toggle => {
            const content = toggle.nextElementSibling;
            if (content && content.style.display === 'none') {
                content.style.display = 'block';
                toggle.classList.add('expanded');
            }
        });
    }

    // 切换控制台显示/隐藏
    function toggleConsole() {
        if (!consoleElement) {
            consoleElement = createConsole();
        }

        consoleVisible = !consoleVisible;
        consoleElement.style.display = consoleVisible ? 'flex' : 'none';

        if (consoleVisible) {
            updateRequestList();
        }
    }

    // 清空请求记录
    function clearRequests() {
        requests = [];
        updateRequestList();
        document.getElementById('request-detail').innerHTML = '';
        currentSelectedRequest = null;

        // 禁用测试按钮
        const testBtn = document.getElementById('test-request');
        if (testBtn) {
            testBtn.disabled = true;
        }
    }

    // 更新请求列表
    function updateRequestList() {
        const requestList = document.getElementById('request-list');
        const headerTitle = consoleElement.querySelector('div > div:first-child');
        headerTitle.textContent = `网络请求监控器 (${requests.length} 个请求)`;

        requestList.innerHTML = '';

        requests.forEach((req, index) => {
            const requestItem = document.createElement('div');
            requestItem.className = 'request-item';
            requestItem.setAttribute('data-index', index);
            requestItem.style.cssText = `
                padding: 8px;
                border-bottom: 1px solid #333;
                cursor: pointer;
                ${index === requests.length - 1 ? 'background: #2a2a2a;' : ''}
            `;

            const statusClass = req.status >= 400 ? 'status-error' :
                              req.status >= 300 ? 'status-warning' : 'status-success';
            const methodColor = {
                'GET': '#61affe',
                'POST': '#49cc90',
                'PUT': '#fca130',
                'DELETE': '#f93e3e',
                'PATCH': '#50e3c2'
            }[req.method] || '#569cd6';

            requestItem.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold; color: ${methodColor};">${req.method}</span>
                    <span class="${statusClass}" style="color: ${
                        statusClass === 'status-error' ? '#f14c4c' :
                        statusClass === 'status-warning' ? '#cca700' : '#89d185'
                    };">${req.status}</span>
                </div>
                <div style="font-size: 11px; color: #ccc; margin-top: 4px; word-break: break-all;">
                    ${req.url}
                </div>
                <div style="font-size: 10px; color: #888; margin-top: 2px; display: flex; justify-content: space-between;">
                    <span>${new Date(req.timestamp).toLocaleTimeString()}</span>
                    <span>${req.duration}ms</span>
                </div>
            `;

            requestItem.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                showRequestDetail(index);
            });
           // requestList.appendChild(requestItem);
            requestList.insertBefore(requestItem, requestList.firstChild);
        });
    }

    // 显示请求详情
    function showRequestDetail(index) {
        const request = requests[index];
        currentSelectedRequest = request; // 设置当前选中的请求

        // 启用测试按钮
        const testBtn = document.getElementById('test-request');
        if (testBtn) {
            testBtn.disabled = false;
        }

        const detailDiv = document.getElementById('request-detail');
        detailDiv.innerHTML = '';

        // 在详情区域添加测试按钮
        const testButtonRow = document.createElement('div');
        testButtonRow.style.cssText = 'margin-bottom: 15px;';
        const detailTestBtn = document.createElement('button');
        detailTestBtn.textContent = '基于此请求创建测试';
        detailTestBtn.style.cssText = 'background: #007bff; color: white; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer; font-size: 12px;';
        detailTestBtn.addEventListener('click', () => openTestPanel(request));
        testButtonRow.appendChild(detailTestBtn);
        detailDiv.appendChild(testButtonRow);

        // 创建基本信息部分
        const basicInfoSection = createDataSection('请求信息', `
            <div><strong>URL:</strong> ${escapeHTML(request.url)}</div>
            <div><strong>方法:</strong> ${escapeHTML(request.method)}</div>
            <div><strong>状态:</strong> <span style="color: ${
                request.status >= 400 ? '#f14c4c' : request.status >= 300 ? '#cca700' : '#89d185'
            }">${request.status} ${request.statusText || ''}</span></div>
            <div><strong>时间:</strong> ${new Date(request.timestamp).toLocaleString()}</div>
            <div><strong>耗时:</strong> ${request.duration}ms</div>
        `);
        detailDiv.appendChild(basicInfoSection);

        // 请求头
        const requestHeadersSection = createDataSection('请求头', formatHeaders(request.requestHeaders));
        detailDiv.appendChild(requestHeadersSection);

        // 请求数据
        if (request.requestData) {
            const requestDataSection = createDataSection('请求数据', '');
            const requestDataContent = requestDataSection.querySelector('.data-content');
            formatData(request.requestData, requestDataContent, 'request');
            detailDiv.appendChild(requestDataSection);
        }

        // 响应头
        const responseHeadersSection = createDataSection('响应头', formatHeaders(request.responseHeaders));
        detailDiv.appendChild(responseHeadersSection);

        // 响应数据
        if (request.responseData) {
            const responseDataSection = createDataSection('响应数据', '');
            const responseDataContent = responseDataSection.querySelector('.data-content');
            formatData(request.responseData, responseDataContent, 'response');
            detailDiv.appendChild(responseDataSection);
        }
    }

    // 创建数据区域
    function createDataSection(title, contentHTML) {
        const section = document.createElement('div');
        section.className = 'data-section';

        const titleEl = document.createElement('h4');
        titleEl.textContent = title;
        section.appendChild(titleEl);

        const contentEl = document.createElement('div');
        contentEl.className = 'data-content';
        contentEl.innerHTML = contentHTML;
        section.appendChild(contentEl);

        return section;
    }

    // 格式化头部信息
    function formatHeaders(headers) {
        if (!headers || Object.keys(headers).length === 0) {
            return '<em>无头部信息</em>';
        }
        return Object.entries(headers).map(([key, value]) =>
            `<div><strong>${escapeHTML(key)}:</strong> ${escapeHTML(value)}</div>`
        ).join('');
    }

    // 格式化数据（JSON展开或原始显示）
    function formatData(data, container, type) {
        let rawData = data;

        // 尝试解析JSON
        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                const jsonView = JSONViewer.createJSONView(parsed);
                container.appendChild(jsonView);
            } catch (e) {
                // 不是JSON，显示原始文本
                const pre = document.createElement('pre');
                pre.style.cssText = 'margin:0; white-space: pre-wrap; color: #ccc;';
                pre.textContent = data;
                container.appendChild(pre);
            }
        } else if (typeof data === 'object') {
            const jsonView = JSONViewer.createJSONView(data);
            container.appendChild(jsonView);
            rawData = JSON.stringify(data, null, 2);
        } else {
            const pre = document.createElement('pre');
            pre.style.cssText = 'margin:0; white-space: pre-wrap; color: #ccc;';
            pre.textContent = String(data);
            container.appendChild(pre);
            rawData = String(data);
        }

        // 添加原始数据切换按钮
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'raw-data-toggle';
        toggleBtn.textContent = '显示原始数据';

        const rawPre = document.createElement('pre');
        rawPre.style.cssText = 'display:none; margin:8px 0 0 0; white-space: pre-wrap; background: #1a1a1a; padding: 8px; border-radius: 3px; color: #888; font-size: 11px;';
        rawPre.textContent = rawData;

        toggleBtn.addEventListener('click', function() {
            if (rawPre.style.display === 'none') {
                rawPre.style.display = 'block';
                this.textContent = '隐藏原始数据';
            } else {
                rawPre.style.display = 'none';
                this.textContent = '显示原始数据';
            }
        });

        container.appendChild(toggleBtn);
        container.appendChild(rawPre);
    }

    // HTML转义
    function escapeHTML(str) {
        if (typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // 拦截 XMLHttpRequest
    const originalXHR = window.XMLHttpRequest;
    const XHRInterceptor = function() {
        const xhr = new originalXHR();
        const request = {
            method: 'GET',
            url: '',
            timestamp: Date.now(),
            requestHeaders: {},
            requestData: null,
            responseData: null,
            status: 0,
            statusText: '',
            responseHeaders: {},
            duration: 0
        };

        const startTime = Date.now();

        // 拦截 open 方法
        const originalOpen = xhr.open;
        xhr.open = function(method, url) {
            request.method = method.toUpperCase();
            request.url = url;
            return originalOpen.apply(this, arguments);
        };

        // 拦截 setRequestHeader
        const originalSetRequestHeader = xhr.setRequestHeader;
        xhr.setRequestHeader = function(header, value) {
            request.requestHeaders[header] = value;
            return originalSetRequestHeader.apply(this, arguments);
        };

        // 拦截 send 方法
        const originalSend = xhr.send;
        xhr.send = function(data) {
            request.requestData = data;
            return originalSend.apply(this, arguments);
        };

        // 监听 load 事件
        xhr.addEventListener('load', function() {
            request.status = xhr.status;
            request.statusText = xhr.statusText;
            request.duration = Date.now() - startTime;

            try {
                if (xhr.responseType === '' || xhr.responseType === 'text') {
                    request.responseData = xhr.responseText;
                } else {
                    request.responseData = xhr.response;
                }
            } catch (e) {
                request.responseData = '无法读取响应数据';
            }

            // 获取响应头
            const headers = xhr.getAllResponseHeaders();
            if (headers) {
                headers.split('\n').forEach(line => {
                    const index = line.indexOf(':');
                    if (index > 0) {
                        const key = line.substring(0, index).trim();
                        const value = line.substring(index + 1).trim();
                        request.responseHeaders[key] = value;
                    }
                });
            }

            requests.push(request);
            if (consoleVisible) {
                updateRequestList();
            }
        });

        return xhr;
    };

    window.XMLHttpRequest = XHRInterceptor;

    // 拦截 Fetch API
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const request = {
            method: 'GET',
            url: '',
            timestamp: Date.now(),
            requestHeaders: {},
            requestData: null,
            responseData: null,
            status: 0,
            statusText: '',
            responseHeaders: {},
            duration: 0
        };

        const startTime = Date.now();

        // 解析参数
        if (args[0] instanceof Request) {
            request.method = args[0].method;
            request.url = args[0].url;
        } else {
            request.url = args[0];
        }

        if (args[1]) {
            request.method = (args[1].method || 'GET').toUpperCase();
            request.requestHeaders = args[1].headers || {};
            request.requestData = args[1].body;
        }

        return originalFetch.apply(this, args).then(response => {
            request.status = response.status;
            request.statusText = response.statusText;
            request.duration = Date.now() - startTime;

            // 获取响应头
            response.headers.forEach((value, key) => {
                request.responseHeaders[key] = value;
            });

            // 克隆响应以读取内容
            const responseClone = response.clone();
            return responseClone.text().then(text => {
                request.responseData = text;
                requests.push(request);
                if (consoleVisible) {
                    updateRequestList();
                }
                return response;
            });
        });
    };

    // 创建控制台切换按钮
    const toggleButton = document.createElement('button');
    toggleButton.innerHTML = '♿︎';
    toggleButton.title = '网络请求监控';
    toggleButton.style.cssText = `
        position: fixed;
        top: 36px;
        right: 24px;
        width: 40px;
        height: 40px;
        background: #333;
        color: white;
        border: none;
        border-radius: 10%;
        cursor: pointer;
        z-index: 99999;
        font-size: 18px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        transition: all 0.3s ease;
    `;

    toggleButton.addEventListener('mouseenter', function() {
        this.style.background = '#555';
        this.style.transform = 'scale(1.1)';
    });

    toggleButton.addEventListener('mouseleave', function() {
        this.style.background = '#333';
        this.style.transform = 'scale(1)';
    });

    toggleButton.addEventListener('click', toggleConsole);

    // 等待页面加载完成后添加按钮
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            document.body.appendChild(toggleButton);
        });
    } else {
        document.body.appendChild(toggleButton);
    }

    // 添加键盘快捷键 (Ctrl+Shift+X)
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'X') {
            e.preventDefault();
            toggleConsole();
        }
    });

    console.log('网络请求监控器已加载。使用 Ctrl+Shift+X 或点击悬浮按钮打开控制台。');
})();
