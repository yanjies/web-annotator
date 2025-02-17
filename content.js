class WebAnnotator {
  constructor() {
    this.currentTool = null;
    this.isDrawing = false;
    this.canvas = null;
    this.ctx = null;
    
    this.init();
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
    this.isDrawing = true;
    
    switch(this.currentTool) {
      case 'highlight':
      case 'underline':
      case 'wavy':
        this.startAnnotation(e);
        break;
      case 'draw':
        this.startDrawing(e);
        break;
      case 'textbox':
        this.createTextBox(e);
        break;
    }
  }

  startAnnotation(e) {
    const selection = window.getSelection();
    if (!selection.toString()) return;

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
    
    range.surroundContents(span);
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
  }
}

// 创建注释器实例
const annotator = new WebAnnotator();

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.tool) {
    annotator.currentTool = request.tool;
  }
  
  if (request.action === 'print-pdf') {
    window.print();
  }
  
  if (request.action === 'capture-image') {
    html2canvas(document.body).then(canvas => {
      const link = document.createElement('a');
      link.download = 'webpage-annotated.png';
      link.href = canvas.toDataURL();
      link.click();
    });
  }
}); 