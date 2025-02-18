class WebAnnotator {
  constructor() {
    this.currentTool = null;
    this.isDrawing = false;
    this.canvas = null;
    this.ctx = null;
    this.floatingBall = null;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.ballStartX = 0;
    this.ballStartY = 0;
    this.menuVisible = false;
    
    this.annotationHistory = [];
    
    // 等待 DOM 完全加载后再初始化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.init();
        this.initFloatingBall();
      });
    } else {
      this.init();
      this.initFloatingBall();
    }
    
    // 添加键盘快捷键监听
    document.addEventListener('keydown', this.handleKeyboard.bind(this));
  }

  init() {
    // 确保 body 存在
    if (!document.body) {
      console.error('Body element not found');
      return;
    }

    // 创建绘图画布
    this.canvas = document.createElement('canvas');
    this.canvas.classList.add('drawing-canvas');
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  handleMouseDown(e) {
    if (!this.currentTool) return;
    
    switch(this.currentTool) {
      case 'highlight':
      case 'underline':
      case 'wavy':
        this.startAnnotation(e);
        break;
      case 'textbox':
        this.createTextBox(e);
        // 创建文本框后立即清除当前工具
        this.setCurrentTool(null);
        break;
    }
  }

  startAnnotation(e) {
    const selection = window.getSelection();
    if (!selection.toString()) return;

    try {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      
      switch(this.currentTool) {
        case 'highlight':
          span.className = 'annotation-highlight';
          break;
        case 'underline':
          span.className = 'annotation-underline';
          break;
        case 'wavy':
          span.className = 'annotation-wavy';
          break;
      }

      // 保存整个文档的当前状态
      const documentState = document.body.cloneNode(true);
      
      // 记录选择范围的文本内容和位置
      const selectionInfo = {
        text: range.toString(),
        startContainer: this.getNodePath(range.startContainer),
        startOffset: range.startOffset,
        endContainer: this.getNodePath(range.endContainer),
        endOffset: range.endOffset
      };

      // 添加到历史记录
      this.addToHistory({
        type: 'span',
        documentState: documentState,
        selectionInfo: selectionInfo
      });

      // 创建新注释
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
      
      selection.removeAllRanges();
    } catch (error) {
      console.error('注释失败:', error);
    }
  }

  // 获取节点的路径
  getNodePath(node) {
    const path = [];
    while (node && node.parentNode) {
      const parent = node.parentNode;
      const children = Array.from(parent.childNodes);
      path.unshift(children.indexOf(node));
      node = parent;
    }
    return path;
  }

  // 根据路径获取节点
  getNodeFromPath(path) {
    let node = document.body;
    for (let index of path) {
      node = node.childNodes[index];
      if (!node) return null;
    }
    return node;
  }

  startDrawing(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.beginPath();
    this.ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 2;
  }

  handleMouseMove(e) {
    if (!this.isDrawing || this.currentTool !== 'draw') return;
    
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    this.ctx.stroke();
  }

  handleMouseUp() {
    this.isDrawing = false;
  }

  createTextBox(e) {
    const textBox = document.createElement('div');
    textBox.className = 'annotation-textbox';
    textBox.contentEditable = 'true';
    textBox.spellcheck = false;
    
    // 添加唯一标识
    const textboxId = 'textbox-' + Date.now();
    textBox.dataset.textboxId = textboxId;
    
    // 设置初始位置
    textBox.style.left = `${e.pageX}px`;
    textBox.style.top = `${e.pageY}px`;
    
    document.body.appendChild(textBox);
    
    // 确保文本框可以立即获得焦点
    setTimeout(() => {
      textBox.focus();
    }, 0);

    // 添加到历史记录
    this.addToHistory({
      type: 'textbox',
      element: textBox,
      position: {
        x: e.pageX,
        y: e.pageY
      }
    });

    // 添加拖动功能
    this.makeTextBoxDraggable(textBox);
  }

  makeTextBoxDraggable(textBox) {
    let isDragging = false;
    let startX, startY;
    let boxStartX, boxStartY;

    textBox.addEventListener('mousedown', (e) => {
      // 只有在没有选中文本时才允许拖拽
      if (window.getSelection().toString()) {
        return;
      }
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = textBox.getBoundingClientRect();
      boxStartX = rect.left;
      boxStartY = rect.top;
      
      // 保存原始尺寸
      textBox.style.setProperty('--original-width', `${rect.width}px`);
      textBox.style.setProperty('--original-height', `${rect.height}px`);
      textBox.classList.add('dragging');
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      textBox.style.left = `${boxStartX + deltaX}px`;
      textBox.style.top = `${boxStartY + deltaY}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        textBox.classList.remove('dragging');
        // 移除临时样式属性
        textBox.style.removeProperty('--original-width');
        textBox.style.removeProperty('--original-height');
      }
    });

    // 禁用文本框的右键菜单
    textBox.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  handleKeyboard(e) {
    // 处理 Ctrl+Z
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      console.log('Ctrl+Z pressed'); // 调试用
      this.undo();
    }
  }

  initFloatingBall() {
    this.floatingBall = document.createElement('div');
    this.floatingBall.className = 'floating-ball';
    this.floatingBall.innerHTML = `
      <div class="ball-menu">
        <button class="tool-btn" data-tool="highlight" title="高亮">🌟</button>
        <button class="tool-btn" data-tool="underline" title="下划线">_</button>
        <button class="tool-btn" data-tool="wavy" title="波浪线">〰️</button>
        <button class="tool-btn" data-tool="textbox" title="文本框">📝</button>
        <button class="tool-btn undo" title="撤销">↩️</button>
        <hr style="margin: 5px 0; border-color: #eee;">
        <button class="tool-btn" data-action="save-pdf" title="保存为PDF">📑</button>
      </div>
    `;
    document.body.appendChild(this.floatingBall);

    let isDragging = false;
    let startX, startY;
    let menuTimeoutId = null;

    // 处理拖拽
    this.floatingBall.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('tool-btn')) return;
      
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = this.floatingBall.getBoundingClientRect();
      this.ballStartX = rect.left;
      this.ballStartY = rect.top;
      
      isDragging = true;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      this.floatingBall.style.left = `${this.ballStartX + deltaX}px`;
      this.floatingBall.style.top = `${this.ballStartY + deltaY}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // 处理菜单显示
    this.floatingBall.addEventListener('mouseenter', () => {
      clearTimeout(menuTimeoutId);
      this.toggleMenu(true);
    });

    this.floatingBall.addEventListener('mouseleave', (e) => {
      // 检查鼠标是否移动到菜单上
      const toElement = e.relatedTarget;
      if (!this.floatingBall.contains(toElement)) {
        menuTimeoutId = setTimeout(() => {
          // 如果不在菜单上，延迟关闭菜单
          if (!this.floatingBall.matches(':hover') && 
              !this.floatingBall.querySelector('.ball-menu').matches(':hover')) {
            this.toggleMenu(false);
          }
        }, 100);
      }
    });

    // 修改工具选择的处理
    this.floatingBall.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tool = e.target.dataset.tool;
        const action = e.target.dataset.action;

        if (tool === 'undo') {
          this.undo();
        } else if (action) {
          // 处理导出动作
          this.handleExport(action);
        } else if (tool) {
          this.setCurrentTool(tool);
          this.updateToolButtonStates();
        }
        this.toggleMenu(false);
      });

      btn.addEventListener('mouseenter', (e) => {
        clearTimeout(menuTimeoutId);
      });
    });
  }

  setCurrentTool(tool) {
    this.currentTool = tool;
    this.updateToolButtonStates();
  }

  updateToolButtonStates() {
    this.floatingBall.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === this.currentTool);
    });
  }

  addToHistory(action) {
    this.annotationHistory.push(action);
    console.log('Added to history:', action); // 调试用
  }

  undo() {
    const lastAction = this.annotationHistory.pop();
    if (!lastAction) return;

    try {
      if (lastAction.type === 'span') {
        const oldContent = lastAction.documentState;
        const currentScroll = {
          x: window.scrollX,
          y: window.scrollY
        };
        
        // 保存当前选中的工具
        const currentTool = this.currentTool;
        
        // 保存当前浮动球的位置
        const ballRect = this.floatingBall.getBoundingClientRect();
        const ballPosition = {
          left: this.floatingBall.style.left || `${ballRect.right - 20}px`,
          top: this.floatingBall.style.top || '50%'
        };
        
        // 移除所有现有的浮动球
        document.querySelectorAll('.floating-ball').forEach(el => el.remove());
        
        // 克隆 oldContent 并移除其中的浮动球
        const cleanContent = oldContent.cloneNode(true);
        cleanContent.querySelectorAll('.floating-ball').forEach(el => el.remove());
        
        // 替换整个 body 内容
        document.body.replaceWith(cleanContent);
        
        // 重新初始化注释器
        this.init();
        
        // 创建新的浮动球并设置到原来的位置
        this.floatingBall = null;
        this.initFloatingBall();
        this.floatingBall.style.left = ballPosition.left;
        this.floatingBall.style.top = ballPosition.top;
        
        // 恢复工具选择状态
        this.setCurrentTool(currentTool);
        
        // 恢复滚动位置
        window.scrollTo(currentScroll.x, currentScroll.y);
      } else if (lastAction.type === 'textbox') {
        if (lastAction.element && lastAction.element.parentNode) {
          lastAction.element.remove();
        }
      }
    } catch (error) {
      console.error('撤销失败:', error);
      // 发生错误时，确保清理所有浮动球
      document.querySelectorAll('.floating-ball').forEach(el => el.remove());
      // 重新创建一个浮动球
      this.floatingBall = null;
      this.initFloatingBall();
    }
  }

  toggleMenu(show) {
    const menu = this.floatingBall.querySelector('.ball-menu');
    menu.style.display = show ? 'block' : 'none';
  }

  // 修改导出处理方法
  handleExport(action) {
    if (action === 'save-pdf') {
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 10001;
        display: flex;
        gap: 20px;
        max-width: 1200px;
        width: 90%;
      `;

      // 设置面板
      const settingsPanel = `
        <div class="settings-panel">
          <h3 style="margin-top: 0;">打印设置</h3>
          <div style="margin: 15px 0;">
            <p style="color: #666; margin-bottom: 15px;">
              1. 点击"确定"后将打开打印对话框<br>
              2. 在打印对话框中选择"另存为 PDF"<br>
              3. 在"更多设置"中选择"边距"为"自定义"<br>
              4. 设置合适的边距后点击"保存"
            </p>
          </div>
          <div style="text-align: right; margin-top: 20px;">
            <button id="cancel-pdf" style="margin-right: 10px;">取消</button>
            <button id="confirm-pdf" style="background: #4285f4; color: white; border: none; padding: 8px 16px; border-radius: 4px;">确定</button>
          </div>
        </div>
      `;

      // 右侧预览面板
      const previewPanel = `
        <div class="preview-panel" style="border-left: 1px solid #eee; padding-left: 20px;">
          <h3 style="margin-top: 0;">预览</h3>
          <div id="pdf-preview" style="
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 20px;
            height: 500px;
            overflow: auto;
            background: #f8f9fa;
            position: relative;
          ">
            <div id="preview-content" style="
              background: white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              position: relative;
            ">
              ${this.getCleanContent()}
            </div>
          </div>
        </div>
      `;

      dialog.innerHTML = settingsPanel + previewPanel;
      document.body.appendChild(dialog);

      const cancelBtn = dialog.querySelector('#cancel-pdf');
      const confirmBtn = dialog.querySelector('#confirm-pdf');

      confirmBtn.onclick = () => {
        // 创建打印样式
        const style = document.createElement('style');
        style.id = 'print-style';
        style.textContent = `
          @media print {
            /* 隐藏不需要的元素 */
            .floating-ball, .ball-menu, .drawing-canvas {
              display: none !important;
            }
            /* 确保文本框可见 */
            .annotation-textbox {
              break-inside: avoid;
              position: absolute;
              border: 1px solid #4285f4;
              background: white !important;
              color: black !important;
              opacity: 1 !important;
              visibility: visible !important;
            }
            /* 确保注释样式正确 */
            .annotation-highlight {
              background-color: #ffeb3b !important;
              opacity: 0.7 !important;
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .annotation-underline {
              border-bottom: 2px solid black !important;
            }
            .annotation-wavy {
              border-bottom: 2px wavy red !important;
            }
          }
        `;
        document.head.appendChild(style);

        dialog.remove();
        window.print();

        // 清理打印样式
        setTimeout(() => {
          const printStyle = document.getElementById('print-style');
          if (printStyle) {
            printStyle.remove();
          }
        }, 0);
      };

      cancelBtn.onclick = () => {
        dialog.remove();
      };
    }
  }

  // 添加页面范围解析方法
  parsePageRange(range) {
    return range.split(',').map(part => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        return `${start}-${end}`;
      }
      return part.trim();
    }).join(',');
  }

  // 添加获取清理后内容的方法
  getCleanContent() {
    // 克隆当前页面内容
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = document.body.innerHTML;
    
    // 移除不需要的元素
    tempContainer.querySelectorAll('.floating-ball, #print-style, script, .ball-menu').forEach(el => el.remove());
    
    // 处理文本框
    tempContainer.querySelectorAll('.annotation-textbox').forEach(textBox => {
      // 保持文本框的样式和内容
      textBox.style.position = 'absolute';
      textBox.style.resize = 'none';
      textBox.style.backgroundColor = 'white';
      textBox.contentEditable = 'false';
      
      // 保持原始位置
      const originalBox = document.querySelector(`[data-textbox-id="${textBox.dataset.textboxId}"]`);
      if (originalBox) {
        const rect = originalBox.getBoundingClientRect();
        textBox.style.left = `${rect.left + window.scrollX}px`;
        textBox.style.top = `${rect.top + window.scrollY}px`;
        textBox.style.width = `${rect.width}px`;
        textBox.style.height = `${rect.height}px`;
      }
      
      // 确保文本框内容可见
      textBox.style.opacity = '1';
      textBox.style.visibility = 'visible';
      textBox.style.display = 'block';
      textBox.style.boxSizing = 'border-box';
      textBox.style.zIndex = '1';
    });
    
    return tempContainer.innerHTML;
  }
}

// 创建注释器实例
const annotator = new WebAnnotator();

// 修改消息监听器，移除重复的导出处理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.tool) {
    annotator.currentTool = request.tool;
  }
}); 