// حالة التتبع والكتابة الذكية المقيدة
window.tracingState = {
    character: '',
    baselineY: 0,
    fontSize: 200,
    fontFamily: '"Tajawal", "Cairo", "Arial", sans-serif',
    letterMaskCanvas: null,
    coreMaskCanvas: null,
    paintCanvas: null,
    maskData: null,
    maskWidth: 0,
    maskHeight: 0,
    targetPoints: [],
    startPoint: null,
    coveragePercent: 0,
    isCompleted: false
};

const TALL_STEM_LETTERS = ['أ', 'إ', 'ا', 'ل', 'ط', 'ظ', 'ك', '١'];

// رسم سطور دفتر الخط العربي (السطر الأساسي والسطور الإرشادية)
function drawNotebookLines(ctx, width, height, baselineY) {
    ctx.save();

    const upperLineY = Math.round(height * 0.20);
    const lowerLineY = Math.round(height * 0.86);

    // 1. السطر العلوي الإرشادي (نهاية الحروف الصاعدة مثل: أ، ل، ط، ك)
    ctx.beginPath();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#B3E5FC';
    ctx.moveTo(25, upperLineY);
    ctx.lineTo(width - 25, upperLineY);
    ctx.stroke();

    // 2. السطر السفلي الإرشادي (نهاية الحروف الهابطة تحت السطر مثل: ج، ر، ع، ن، ي)
    ctx.beginPath();
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CFD8DC';
    ctx.moveTo(25, lowerLineY);
    ctx.lineTo(width - 25, lowerLineY);
    ctx.stroke();

    // 3. السطر الأساسي للدفتر (الذي يستقر عليه الحرف)
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#FF8A65';
    ctx.moveTo(20, baselineY);
    ctx.lineTo(width - 20, baselineY);
    ctx.stroke();

    // تسميات إرشادية صغيرة على يمين الدفتر
    ctx.font = 'bold 15px "Tajawal", "Cairo", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#FF7043';
    ctx.fillText('السطر الأساسي ✏️', width - 26, baselineY - 6);

    ctx.fillStyle = '#90A4AE';
    ctx.font = '600 13px "Tajawal", "Cairo", sans-serif';
    ctx.fillText('تحت السطر ↓', width - 26, lowerLineY - 5);

    ctx.restore();
    ctx.beginPath();
}

// تحديد نقطة البداية الخضراء التربوية لكل حرف أو كلمة تلقائياً
function computeStartPoint(coreData, width, height, character, baselineY, fontSize) {
    const isLatin = /[A-Za-z0-9]/.test(character);
    const cleanChar = character.replace(/[ـ\u064E\u064F\u0650]/g, '');
    const firstChar = cleanChar[0] || character[0] || '';
    const isTallStem = TALL_STEM_LETTERS.includes(firstChar);

    let minX = width, maxX = 0, minY = height, maxY = 0;
    const step = 3;

    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const alpha = coreData[(y * width + x) * 4 + 3];
            if (alpha > 128) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (minX >= maxX || minY >= maxY) {
        return { x: Math.round(width / 2), y: baselineY - 40 };
    }

    // للحروف والأرقام الإنجليزية: نقطة البداية أعلى يسار الحرف الأول
    if (isLatin) {
        const bandMaxX = minX + Math.min(90, (maxX - minX) * 0.45);
        let bestY = maxY;
        let bestX = minX;
        for (let y = minY; y <= maxY; y += 2) {
            for (let x = minX; x <= bandMaxX; x += 2) {
                if (coreData[(y * width + x) * 4 + 3] > 128) {
                    if (y < bestY) {
                        bestY = y;
                        bestX = x + 8;
                    }
                }
            }
        }
        return { x: Math.round(bestX), y: Math.round(bestY + 10) };
    }

    // للحروف العربية ذات العمود الصاعد (أ، ل، ط، ظ، ك، ١): نقطة البداية في قمة العمود الأيمن
    if (isTallStem) {
        const rightZoneMinX = maxX - Math.min(110, (maxX - minX) * 0.45);
        // نتجنب الهمزة المنفصلة في أعلى الألف بالبحث في جسم العمود نفسه
        const searchStartY = (firstChar === 'أ') ? Math.round(baselineY - fontSize * 0.52) : minY;
        for (let y = Math.max(minY, searchStartY); y <= maxY; y += 2) {
            for (let x = maxX; x >= rightZoneMinX; x -= 2) {
                if (coreData[(y * width + x) * 4 + 3] > 128) {
                    return { x: Math.round(x - 8), y: Math.round(y + 12) };
                }
            }
        }
    }

    // لباقي الحروف والكلمات العربية: نبحث عن أقصى يمين جسم الحرف الأساسي (مع تجاهل النقاط العلوية مثل ت، ث، ش، ق، ف)
    const bodyTopY = Math.max(minY, Math.round(baselineY - fontSize * 0.36));
    const bodyBottomY = Math.min(maxY, Math.round(baselineY + fontSize * 0.08));

    let rightMostX = -1;
    let rightMostY = baselineY;

    for (let x = maxX; x >= minX; x -= 2) {
        for (let y = bodyTopY; y <= bodyBottomY; y += 2) {
            if (coreData[(y * width + x) * 4 + 3] > 128) {
                rightMostX = x;
                rightMostY = y;
                break;
            }
        }
        if (rightMostX !== -1) break;
    }

    if (rightMostX !== -1) {
        // نصعد قليلاً لأعلى بداية السن الأيمن للحرف (مثل سن الباء أو الشين أو حاجب الجيم)
        const checkX = Math.max(minX, rightMostX - 10);
        let topOfStrokeY = rightMostY;
        for (let y = rightMostY; y >= bodyTopY - 25; y -= 2) {
            if (y >= 0 && coreData[(y * width + checkX) * 4 + 3] > 128) {
                topOfStrokeY = y;
            } else {
                break;
            }
        }
        return { x: Math.round(checkX), y: Math.round(topOfStrokeY + 10) };
    }

    return { x: Math.round(maxX - 14), y: Math.round(minY + 16) };
}

// رسم نقطة البداية الخضراء الإرشادية على الحرف
function drawStartPointIndicator(ctx, startPoint, coveragePercent) {
    if (!startPoint) return;

    ctx.save();

    // دائرة هالة خضراء خارجية
    ctx.beginPath();
    ctx.arc(startPoint.x, startPoint.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 200, 83, 0.25)';
    ctx.fill();

    // النقطة الخضراء الأساسية
    ctx.beginPath();
    ctx.arc(startPoint.x, startPoint.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#00C853';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    // نقطة بيضاء صغيرة في المركز
    ctx.beginPath();
    ctx.arc(startPoint.x, startPoint.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // إظهار لافتة "ابدأ من هنا" قبل أن يبدأ الطفل بتغطية الحرف
    if (coveragePercent < 20) {
        const labelText = 'ابدأ من هنا';
        ctx.font = 'bold 14px "Tajawal", "Cairo", sans-serif';
        const labelWidth = ctx.measureText(labelText).width + 18;
        const labelX = Math.min(Math.max(startPoint.x, labelWidth / 2 + 10), ctx.canvas.width - labelWidth / 2 - 10);
        const labelY = Math.max(32, startPoint.y - 26);

        ctx.fillStyle = '#00C853';
        ctx.beginPath();
        ctx.roundRect(labelX - labelWidth / 2, labelY - 22, labelWidth, 24, 12);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, labelX, labelY - 10);
    }

    ctx.restore();
    ctx.beginPath();
}

// تحديث واجهة شريط التغطية وزر "إنجاز 🌟"
function updateTracingProgressUI(percent) {
    const progressText = document.getElementById('tracing-progress-text');
    const progressFill = document.getElementById('tracing-progress-fill');
    const nextBtn = document.getElementById('btn-next');

    const arabicNum = typeof toArabicNumeral === 'function' ? toArabicNumeral(percent) : percent;

    if (progressText) {
        progressText.innerText = percent >= 100
            ? 'تغطية الحرف: مكتمل ١٠٠٪ ✅'
            : `تغطية الحرف: ${arabicNum}٪`;
    }
    if (progressFill) {
        progressFill.style.width = `${percent}%`;
        progressFill.style.backgroundColor = percent >= 100 ? '#43A047' : '#29B6F6';
    }

    if (nextBtn) {
        if (percent >= 100) {
            nextBtn.disabled = false;
            nextBtn.classList.remove('btn-locked');
            nextBtn.classList.add('btn-ready-pulse');
        } else {
            nextBtn.disabled = true;
            nextBtn.classList.add('btn-locked');
            nextBtn.classList.remove('btn-ready-pulse');
        }
    }
}

// إعادة رسم اللوحة المجمعة (السطور + القالب المفرغ + تلوين الطفل المقيد داخل الحرف + نقطة البداية)
function renderTracingScene() {
    const canvas = document.getElementById('drawing-board');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const state = window.tracingState;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. رسم سطور الدفتر
    drawNotebookLines(ctx, canvas.width, canvas.height, state.baselineY);

    // 2. رسم خلفية الحرف المفرغ
    ctx.save();
    ctx.font = `bold ${state.fontSize}px ${state.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if ('fontVariantLigatures' in ctx) {
        ctx.fontVariantLigatures = 'no-contextual';
    }
    ctx.fillStyle = '#E0E0E0';
    ctx.fillText(state.character, canvas.width / 2, state.baselineY);
    ctx.restore();

    // 3. رسم طبقة تلوين الطفل (المقيدة داخل قناع الحرف فقط)
    if (state.paintCanvas) {
        ctx.drawImage(state.paintCanvas, 0, 0);
    }

    // 4. رسم الإطار الخارجي للحرف ليبقى واضحاً وحاداً
    ctx.save();
    ctx.font = `bold ${state.fontSize}px ${state.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if ('fontVariantLigatures' in ctx) {
        ctx.fontVariantLigatures = 'no-contextual';
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#BDBDBD';
    ctx.strokeText(state.character, canvas.width / 2, state.baselineY);
    ctx.restore();

    // 5. رسم نقطة البداية الخضراء
    drawStartPointIndicator(ctx, state.startPoint, state.coveragePercent);

    ctx.beginPath();
}

// التحقق مما إذا كانت النقطة داخل حدود الحرف المسموح بها
function isPointInLetterMask(x, y) {
    const state = window.tracingState;
    if (!state.maskData || !state.maskWidth || !state.maskHeight) return true;

    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= state.maskWidth || iy < 0 || iy >= state.maskHeight) return false;

    const alpha = state.maskData[(iy * state.maskWidth + ix) * 4 + 3];
    return alpha > 25;
}

// تسجيل مرور القلم وتحديث نسبة تغطية الحرف
function markStrokeCoverage(x1, y1, x2, y2, brushRadius = 26) {
    const state = window.tracingState;
    if (!state.targetPoints || !state.targetPoints.length) return;

    const rSq = brushRadius * brushRadius;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    let coveredCount = 0;
    for (let i = 0; i < state.targetPoints.length; i++) {
        const pt = state.targetPoints[i];
        if (!pt.covered) {
            let t = 0;
            if (lenSq > 0) {
                t = Math.max(0, Math.min(1, ((pt.x - x1) * dx + (pt.y - y1) * dy) / lenSq));
            }
            const projX = x1 + t * dx;
            const projY = y1 + t * dy;
            const distSq = (pt.x - projX) * (pt.x - projX) + (pt.y - projY) * (pt.y - projY);
            if (distSq <= rSq) {
                pt.covered = true;
            }
        }
        if (pt.covered) coveredCount++;
    }

    // نعتبر تغطية 68% من نقاط القلب الداخلي للحرف إنجازاً كاملاً (100%) لمراعاة الزوايا الدقيقة ليد الطفل
    const rawRatio = coveredCount / state.targetPoints.length;
    const scaledPercent = Math.min(100, Math.round((rawRatio / 0.68) * 100));

    state.coveragePercent = scaledPercent;
    state.isCompleted = scaledPercent >= 100;
    updateTracingProgressUI(scaledPercent);
}

function drawTemplate(character) {
    const canvas = document.getElementById('drawing-board');
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;

    const width = canvas.width;
    const height = canvas.height;
    const baselineY = Math.round(height * 0.64);
    const fontFamily = '"Tajawal", "Cairo", "Arial", sans-serif';

    const ctx = canvas.getContext('2d');
    let fontSize = Math.min(280, Math.round(height * 0.52));
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    let textWidth = ctx.measureText(character).width;
    const maxAllowedWidth = width * 0.82;

    while (textWidth > maxAllowedWidth && fontSize > 50) {
        fontSize -= 10;
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        textWidth = ctx.measureText(character).width;
    }

    // 1. إنشاء قناع السماح بالكتابة (مع هامش تسامح مريح ليد الطفل حول حدود الحرف)
    const letterMaskCanvas = document.createElement('canvas');
    letterMaskCanvas.width = width;
    letterMaskCanvas.height = height;
    const maskCtx = letterMaskCanvas.getContext('2d');
    maskCtx.font = `bold ${fontSize}px ${fontFamily}`;
    maskCtx.textAlign = 'center';
    maskCtx.textBaseline = 'alphabetic';
    if ('fontVariantLigatures' in maskCtx) {
        maskCtx.fontVariantLigatures = 'no-contextual';
    }
    maskCtx.lineJoin = 'round';
    maskCtx.lineCap = 'round';
    maskCtx.lineWidth = 28; // هامش أمان بسيط حول حدود الحرف
    maskCtx.strokeStyle = '#000000';
    maskCtx.fillStyle = '#000000';
    maskCtx.strokeText(character, width / 2, baselineY);
    maskCtx.fillText(character, width / 2, baselineY);

    // 2. إنشاء قناع القلب الداخلي للحرف لحساب نسبة التغطية ونقطة البداية بدقة
    const coreMaskCanvas = document.createElement('canvas');
    coreMaskCanvas.width = width;
    coreMaskCanvas.height = height;
    const coreCtx = coreMaskCanvas.getContext('2d');
    coreCtx.font = `bold ${fontSize}px ${fontFamily}`;
    coreCtx.textAlign = 'center';
    coreCtx.textBaseline = 'alphabetic';
    if ('fontVariantLigatures' in coreCtx) {
        coreCtx.fontVariantLigatures = 'no-contextual';
    }
    coreCtx.fillStyle = '#000000';
    coreCtx.fillText(character, width / 2, baselineY);

    const maskImageData = maskCtx.getImageData(0, 0, width, height);
    const coreImageData = coreCtx.getImageData(0, 0, width, height);
    const coreData = coreImageData.data;

    // استخراج نقاط التغطية المطلوبة من جسم الحرف
    const targetPoints = [];
    const sampleStep = 8;
    for (let y = 0; y < height; y += sampleStep) {
        for (let x = 0; x < width; x += sampleStep) {
            const alpha = coreData[(y * width + x) * 4 + 3];
            if (alpha > 128) {
                targetPoints.push({ x, y, covered: false });
            }
        }
    }

    // 3. حساب نقطة البداية الخضراء التربوية
    const startPoint = computeStartPoint(coreData, width, height, character, baselineY, fontSize);

    // 4. إنشاء طبقة حبر الطفل الفارغة
    const paintCanvas = document.createElement('canvas');
    paintCanvas.width = width;
    paintCanvas.height = height;

    // حفظ الحالة
    window.tracingState = {
        character,
        baselineY,
        fontSize,
        fontFamily,
        letterMaskCanvas,
        coreMaskCanvas,
        paintCanvas,
        maskData: maskImageData.data,
        maskWidth: width,
        maskHeight: height,
        targetPoints,
        startPoint,
        coveragePercent: 0,
        isCompleted: false
    };

    updateTracingProgressUI(0);
    renderTracingScene();
}