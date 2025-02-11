// 配置参数
const API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
let API_KEY = '';

// 检查是否已保存API密钥
if (localStorage.getItem('api_key')) {
    API_KEY = localStorage.getItem('api_key');
} else {
    // 提示用户输入API密钥
    API_KEY = prompt('请输入您的API密钥（将安全保存在本地）：');
    if (API_KEY) {
        localStorage.setItem('api_key', API_KEY);
    }
}

// 添加设置按钮事件
document.addEventListener('DOMContentLoaded', () => {
    const settingsBtn = document.createElement('button');
    settingsBtn.textContent = '设置';
    settingsBtn.className = 'settings-btn';
    settingsBtn.onclick = () => {
        const newKey = prompt('请输入新的API密钥：', API_KEY);
        if (newKey && newKey.trim()) {
            API_KEY = newKey.trim();
            localStorage.setItem('api_key', API_KEY);
            alert('API密钥已更新！');
        }
    };
    document.querySelector('.container').appendChild(settingsBtn);
});

// 初始化历史记录
let nameHistory = JSON.parse(localStorage.getItem('nameHistory') || '[]');

// 历史记录相关的DOM元素
const historyBtn = document.getElementById('historyBtn');
const historySidebar = document.getElementById('historySidebar');
const closeHistory = document.getElementById('closeHistory');
const historyList = document.getElementById('historyList');

// 显示/隐藏历史记录侧边栏
historyBtn.addEventListener('click', () => {
    historySidebar.classList.toggle('active');
    renderHistory();  // 只在打开侧边栏时渲染历史记录
});

closeHistory.addEventListener('click', () => {
    historySidebar.classList.remove('active');
});

// 渲染历史记录
function renderHistory() {
    historyList.innerHTML = nameHistory.map((item, index) => `
        <div class="history-item" onclick="restoreHistory(${index})">
            <div class="timestamp">${new Date(item.timestamp).toLocaleString()}</div>
            <div class="history-names">
                <div class="english-name">英文名：${item.englishName || '未知'}</div>
                <div class="chinese-name">中文名：${item.name}</div>
            </div>
            <div class="details">${item.details.length} 条解释</div>
        </div>
    `).join('');
}

// 恢复历史记录
function restoreHistory(index) {
    const item = nameHistory[index];
    if (item && item.content) {
        // 同时恢复英文名到输入框
        document.getElementById('englishName').value = item.englishName || '';
        const resultsDiv = document.getElementById('results');
        displayResults(item.content);
        historySidebar.classList.remove('active');
    }
}

// 保存到历史记录
function saveToHistory(content, firstNameTitle) {
    const englishName = document.getElementById('englishName').value.trim();
    
    // 检查是否已经存在相同内容的记录
    const isDuplicate = nameHistory.some(item => item.content === content);
    if (isDuplicate) {
        return; // 如果已存在相同内容，则不重复保存
    }

    const timestamp = new Date().getTime();
    const historyItem = {
        timestamp: timestamp,
        englishName: englishName, // 保存英文名
        name: firstNameTitle,
        content: content,
        details: content.split('\n').filter(line => line.trim() && !line.match(/^\d+\.\s/))
    };
    
    nameHistory.unshift(historyItem);
    if (nameHistory.length > 50) {
        nameHistory.pop();
    }
    
    localStorage.setItem('nameHistory', JSON.stringify(nameHistory));
    renderHistory();
}

async function generateNames() {
    const englishName = document.getElementById('englishName').value.trim();
    if (!englishName) {
        alert('请输入英文名');
        return;
    }

    // 显示加载状态
    document.getElementById('loading').classList.remove('hidden');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: "Pro/deepseek-ai/DeepSeek-R1",
                messages: [{
                    role: "user",
                    content: `请根据英文名${englishName}生成三个优雅且有中国文化内涵的中文名。要求：
1. 每个名字包含中文、拼音
2. 分别用中英文解释名字的寓意
3. 体现中国传统文化元素
4. 理解英文名字的含义，然后生成中文名字，并且有幽默成分，适当可以加一些梗
格式范例：
1. 林书豪 (Lín Shūháo)
"林"含义：...
"书"含义：...
"豪"含义：...
   中文解释：...
   English: ...`
                }],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || '请求失败');
        }

        if (data.choices && data.choices[0]) {
            const content = data.choices[0].message.content;
            displayResults(content);
        } else {
            throw new Error('未获取到有效响应');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('生成失败：' + error.message);
    } finally {
        // 隐藏加载状态
        document.getElementById('loading').classList.add('hidden');
    }
}

function displayResults(content) {
    const resultsDiv = document.getElementById('results');
    const resultsContent = resultsDiv.querySelector('.results-content');
    
    // 解析内容
    const lines = content.split('\n');
    let currentName = '';
    let currentDetails = [];
    let names = [];
    let isCollectingDetails = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.match(/^\d+\.\s/)) {  // 新名字开始
            if (currentName) {
                names.push({
                    name: currentName,
                    details: currentDetails
                });
            }
            currentName = line;
            currentDetails = [];
            isCollectingDetails = true;
        } else if (isCollectingDetails && line) {
            // 检查是否是下一个名字的开始（通过查看下一行）
            const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
            if (nextLine.match(/^\d+\.\s/)) {
                names.push({
                    name: currentName,
                    details: [...currentDetails, line]
                });
                currentName = '';
                currentDetails = [];
                isCollectingDetails = false;
            } else {
                currentDetails.push(line);
            }
        }
    }

    // 添加最后一个名字
    if (currentName && currentDetails.length > 0) {
        names.push({
            name: currentName,
            details: currentDetails
        });
    }

    // 生成HTML
    const resultsHTML = names.map(item => `
        <div class="name-result">
            <div class="name-title">${item.name}</div>
            <div class="name-details">
                ${item.details.map(detail => {
                    if (detail.startsWith('English:')) {
                        return `<div class="detail-item english">${detail}</div>`;
                    } else if (detail.startsWith('中文解释:')) {
                        return `<div class="detail-item chinese">${detail}</div>`;
                    } else {
                        return `<div class="detail-item">${detail}</div>`;
                    }
                }).join('')}
            </div>
        </div>
    `).join('');

    // 显示结果
    resultsContent.innerHTML = resultsHTML;
    resultsDiv.classList.remove('hidden');
    
    // 保存到历史记录
    if (names.length > 0) {
        saveToHistory(content, names[0].name);
    }
}
