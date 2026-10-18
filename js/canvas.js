// تحديد العناصر من واجهة المستخدم
const canvas = document.getElementById('drawing-board');
const ctx = canvas.getContext('2d');
const container = document.querySelector('.canvas-container');
let hintToastTimeout = null;

// 1. ضبط أبعاد لوحة الرسم لتملأ الحاوية بالكامل
function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = window.currentPenColor || '#43A047';
    ctx.beginPath();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// 2. متغيرات حالة الرسم المقيد
let isDrawing = false;
let lastValidPos = null;

function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function showOutOfBoundsHint() {
    const toast = document.getElementById('canvas-hint-toast');
    if (!toast) return;
    toast.classList.remove('hidden');
    if (hintToastTimeout) clearTimeout(hintToastTimeout);
    hintToastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 1100);
}

// رسم ضربة القلم داخل طبقة الحبر وتقييدها بقناع الحرف
function paintConstrainedStroke(x1, y1, x2, y2) {
    const state = window.tracingState;
    if (!state || !state.paintCanvas || !state.letterMaskCanvas) return;

    const pCtx = state.paintCanvas.getContext('2d');
    pCtx.save();
    pCtx.globalCompositeOperation = 'source-over';
    pCtx.lineWidth = 28;
    pCtx.lineCap = 'round';
    pCtx.lineJoin = 'round';
    pCtx.strokeStyle = window.currentPenColor || '#43A047';

    pCtx.beginPath();
    pCtx.moveTo(x1, y1);
    pCtx.lineTo(x2, y2);
    pCtx.stroke();

    // قص أي حبر يخرج عن حدود الحرف المسموحة
    pCtx.globalCompositeOperation = 'destination-in';
    pCtx.drawImage(state.letterMaskCanvas, 0, 0);
    pCtx.restore();

    if (typeof markStrokeCoverage === 'function') {
        markStrokeCoverage(x1, y1, x2, y2, 26);
    }
    if (typeof renderTracingScene === 'function') {
        renderTracingScene();
    }
}

// 3. دوال الرسم الأساسية
function startPosition(e) {
    e.preventDefault();
    isDrawing = true;

    const { x, y } = getPointerPos(e);

    if (typeof isPointInLetterMask === 'function' && !isPointInLetterMask(x, y)) {
        lastValidPos = null;
        showOutOfBoundsHint();
        return;
    }

    lastValidPos = { x, y };
    paintConstrainedStroke(x, y, x, y);
}

function endPosition() {
    isDrawing = false;
    lastValidPos = null;
    ctx.beginPath();
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();

    const { x, y } = getPointerPos(e);

    if (typeof isPointInLetterMask === 'function' && !isPointInLetterMask(x, y)) {
        lastValidPos = null;
        showOutOfBoundsHint();
        return;
    }

    const fromX = lastValidPos ? lastValidPos.x : x;
    const fromY = lastValidPos ? lastValidPos.y : y;
    lastValidPos = { x, y };

    paintConstrainedStroke(fromX, fromY, x, y);
}

// 4. ربط الأحداث (Pointer Events تدعم اللمس، القلم، والفأرة معاً)
canvas.addEventListener('pointerdown', startPosition);
canvas.addEventListener('pointerup', endPosition);
canvas.addEventListener('pointermove', draw);
canvas.addEventListener('pointercancel', endPosition);
canvas.addEventListener('pointerleave', endPosition);