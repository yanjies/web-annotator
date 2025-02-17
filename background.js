// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('Web Annotator 扩展已安装');
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'save-pdf') {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'print-pdf'
      });
    });
  }
  
  if (request.action === 'save-image') {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'capture-image'
      });
    });
  }
}); 