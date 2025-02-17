document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('button');
  
  buttons.forEach(button => {
    button.addEventListener('click', async () => {
      const tool = button.id;
      
      if (tool === 'save-pdf' || tool === 'save-image') {
        handleSave(tool);
        return;
      }

      // 发送消息到content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tab.id, { tool });
    });
  });
});

async function handleSave(type) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (type === 'save-pdf') {
    chrome.tabs.sendMessage(tab.id, { action: 'save-pdf' });
  } else {
    chrome.tabs.sendMessage(tab.id, { action: 'save-image' });
  }
} 