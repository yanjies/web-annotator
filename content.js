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
    
    this.init();
    this.initFloatingBall();
    
    // 添加键盘快捷键监听
    document.addEventListener('keydown', this.handleKeyboard.bind(this));
  }

  init() {
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
    textBox.contentEditable = true;
    textBox.style.left = e.pageX + 'px';
    textBox.style.top = e.pageY + 'px';
    document.body.appendChild(textBox);
    textBox.focus();

    // 添加到历史记录
    this.addToHistory({
      type: 'textbox',
      element: textBox
    });

    // 添加拖动功能
    this.makeTextBoxDraggable(textBox);
  }

  makeTextBoxDraggable(textBox) {
    let isDragging = false;
    let startX, startY;
    let boxStartX, boxStartY;

    textBox.addEventListener('mousedown', (e) => {
      // 如果是在编辑文本，不启动拖拽
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || window.getSelection().toString()) {
        return;
      }
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = textBox.getBoundingClientRect();
      boxStartX = rect.left;
      boxStartY = rect.top;
      
      // 添加临时样式
      textBox.style.cursor = 'move';
      textBox.style.userSelect = 'none';
      
      // 防止文本选择
      e.preventDefault();
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
        textBox.style.cursor = 'text';
        textBox.style.userSelect = 'text';
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
        // 恢复到之前的文档状态
        const oldContent = lastAction.documentState;
        const currentScroll = {
          x: window.scrollX,
          y: window.scrollY
        };
        
        // 保存当前选中的工具
        const currentTool = this.currentTool;
        
        // 替换整个 body 内容
        document.body.replaceWith(oldContent);
        
        // 重新初始化注释器
        this.init();
        this.initFloatingBall();
        
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
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        z-index: 10001;
      `;
      dialog.innerHTML = `
        <h3 style="margin-top: 0;">导出PDF设置</h3>
        <div style="margin: 10px 0;">
          <label>文件名：</label>
          <input type="text" id="pdf-filename" value="webpage-annotated.pdf" style="width: 200px;">
        </div>
        <div style="margin: 10px 0;">
          <label>页面范围：</label>
          <input type="text" id="pdf-range" placeholder="例如：1-5" style="width: 100px;">
          <div style="font-size: 12px; color: #666; margin-top: 5px;">
            留空表示导出全部页面<br>
            支持格式：2-5 或 1,3,5-7
          </div>
        </div>
        <div style="margin: 10px 0;">
          <label>页面边距(mm)：</label>
          <div style="display: grid; grid-template-columns: auto auto; gap: 5px; margin-top: 5px;">
            <label>左边距：</label>
            <input type="number" id="margin-left" value="20" min="0" style="width: 60px;">
            <label>右边距：</label>
            <input type="number" id="margin-right" value="20" min="0" style="width: 60px;">
          </div>
        </div>
        <div style="text-align: right; margin-top: 15px;">
          <button id="cancel-pdf" style="margin-right: 10px;">取消</button>
          <button id="confirm-pdf">确定</button>
        </div>
      `;
      document.body.appendChild(dialog);

      const cancelBtn = dialog.querySelector('#cancel-pdf');
      const confirmBtn = dialog.querySelector('#confirm-pdf');
      const filenameInput = dialog.querySelector('#pdf-filename');
      const rangeInput = dialog.querySelector('#pdf-range');
      const marginLeftInput = dialog.querySelector('#margin-left');
      const marginRightInput = dialog.querySelector('#margin-right');

      confirmBtn.onclick = () => {
        const filename = filenameInput.value.trim();
        const range = rangeInput.value.trim();
        const marginLeft = marginLeftInput.value;
        const marginRight = marginRightInput.value;
        
        if (!filename) {
          alert('请输入文件名');
          return;
        }

        // 创建打印样式
        const style = document.createElement('style');
        style.id = 'print-style';
        style.textContent = `
          @media print {
            @page {
              margin-left: ${marginLeft}mm !important;
              margin-right: ${marginRight}mm !important;
            }
            ${range ? this.generatePrintRangeCSS(range) : ''}
          }
        `;
        document.head.appendChild(style);

        dialog.remove();
        window.print();

        // 清理打印样式
        const printStyle = document.getElementById('print-style');
        if (printStyle) {
          printStyle.remove();
        }
      };

      cancelBtn.onclick = () => {
        dialog.remove();
      };
    }
  }

  generatePrintRangeCSS(range) {
    const ranges = range.split(',').map(r => r.trim());
    const pageSelectors = ranges.map(r => {
      if (r.includes('-')) {
        const [start, end] = r.split('-').map(Number);
        return Array.from(
          { length: end - start + 1 },
          (_, i) => `@page :nth(${start + i})`
        ).join(',');
      }
      return `@page :nth(${r})`;
    });

    return `
      @media print {
        ${pageSelectors.join(',')} {
          display: block;
        }
        @page :not(${pageSelectors.join(',')}) {
          display: none;
        }
      }
    `;
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