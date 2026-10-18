// 1. المتغيرات الأساسية ونظام حفظ النجوم والكؤوس والألوان
let currentLevel = 0;
let stars = parseInt(localStorage.getItem('kids_stars')) || 0;
let trophies = parseInt(localStorage.getItem('kids_trophies')) || 0;
let lettersData = [];
let currentMode = 'basic'; // الوضع الافتراضي للبرنامج (تأسيس أو متقدم)
let currentCategoryFile = ''; // مسار ملف البيانات الحالي
let currentLetterForm = 'isolated'; // شكل الحرف: isolated | initial | medial | final
let currentHaraka = 'none'; // الحركة القصيرة: none | fatha | damma | kasra
let currentAudioPlayer = null; // مشغل الصوت الحالي لمنع تداخل الأصوات
window.currentPenColor = '#43A047'; // اللون الافتراضي للقلم (الأخضر لقلم الطفل)

// متغيرات نظام التدريبات والواجب اليومي
let quizQuestions = [];
let currentQuizIndex = 0;
let currentTouchCount = 0;
let isHomeworkMode = false;
let homeworkStep = 0; // من 0 إلى 6 (٠-١ كتابة حرفين، ٢-٤ أسئلة عربي، ٥-٦ مسائل حساب)
let homeworkTotalSteps = 7;
let homeworkLetters = [];

const HARAKAT_MARKS = {
    none: '',
    fatha: '\u064E', // فتحة
    damma: '\u064F', // ضمة
    kasra: '\u0650'  // كسرة
};

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '١٠'];

function toArabicNumeral(num) {
    if (num >= 0 && num <= 10) return ARABIC_DIGITS[num];
    return String(num).replace(/\d/g, d => ARABIC_DIGITS[parseInt(d, 10)]);
}

// 2. تعريف عناصر الشاشات الخمس
const welcomeScreen = document.getElementById('welcome-screen');
const homeScreen = document.getElementById('home-screen');
const gridScreen = document.getElementById('grid-screen');
const drawingScreen = document.getElementById('drawing-screen');
const quizScreen = document.getElementById('quiz-screen');
const arabicToolsBar = document.getElementById('arabic-tools-bar');
const celebrationModal = document.getElementById('celebration-modal');

// تحديث عداد النجوم والكؤوس في جميع الشاشات
function updateScoreBoards() {
    document.getElementById('total-stars-count').innerText = stars;
    document.getElementById('map-stars-count').innerText = stars;
    const quizStarsEl = document.getElementById('quiz-stars-count');
    if (quizStarsEl) quizStarsEl.innerText = stars;
    const trophiesEl = document.getElementById('map-trophies-count');
    if (trophiesEl) trophiesEl.innerText = trophies;
}
updateScoreBoards();

function addStars(amount) {
    stars += amount;
    localStorage.setItem('kids_stars', stars);
    updateScoreBoards();
}

// نظام الذاكرة المستمرة لحفظ الحروف والمراحل المنجزة في LocalStorage
function getCompletedItemsMap() {
    try {
        return JSON.parse(localStorage.getItem('kids_completed_items') || '{}');
    } catch (e) {
        return {};
    }
}

function isItemCompleted(fileUrl, index) {
    const map = getCompletedItemsMap();
    const list = map[fileUrl];
    return Array.isArray(list) && list.includes(index);
}

function markItemCompleted(fileUrl, index) {
    if (!fileUrl || typeof index !== 'number') return;
    const map = getCompletedItemsMap();
    if (!Array.isArray(map[fileUrl])) {
        map[fileUrl] = [];
    }
    if (!map[fileUrl].includes(index)) {
        map[fileUrl].push(index);
        localStorage.setItem('kids_completed_items', JSON.stringify(map));
    }
}

// 3. برمجة لوحة الألوان لتغيير لون القلم ديناميكياً 🎨
document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active-color'));
        e.currentTarget.classList.add('active-color');
        window.currentPenColor = e.currentTarget.getAttribute('data-color');

        const canvas = document.getElementById('drawing-board');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = window.currentPenColor;
            ctx.beginPath();
        }
    });
});

// 4. دالة تركيب الحركة القصيرة على شكل الحرف في موضعه بدقة
function combineFormAndHaraka(formStr, harakaKey) {
    if (!formStr || harakaKey === 'none' || !HARAKAT_MARKS[harakaKey]) {
        return formStr;
    }

    if (harakaKey === 'kasra' && formStr.includes('أ')) {
        return formStr.replace('أ', 'إِ');
    }

    const mark = HARAKAT_MARKS[harakaKey];
    let result = '';
    let markAdded = false;
    for (const ch of formStr) {
        result += ch;
        if (!markAdded && ch !== 'ـ') {
            result += mark;
            markAdded = true;
        }
    }
    return markAdded ? result : (formStr + mark);
}

// الحصول على النص الفعلي المعروض حالياً على لوحة الرسم
function getActiveCharacterText() {
    if (!lettersData.length || !lettersData[currentLevel]) return '';
    const currentData = lettersData[currentLevel];

    if (currentData.forms) {
        const baseForm = currentData.forms[currentLetterForm] || currentData.char;
        return combineFormAndHaraka(baseForm, currentHaraka);
    }

    return currentData.char;
}

// تحديث أزرار شريط أشكال الحرف والحركات القصيرة
function updateArabicToolbarUI() {
    if (!lettersData.length || !lettersData[currentLevel]) return;
    const currentData = lettersData[currentLevel];

    if (!currentData.forms) {
        arabicToolsBar.classList.add('hidden');
        return;
    }

    arabicToolsBar.classList.remove('hidden');

    ['isolated', 'initial', 'medial', 'final'].forEach(formKey => {
        const previewEl = document.getElementById(`form-preview-${formKey}`);
        if (previewEl && currentData.forms[formKey]) {
            previewEl.innerText = combineFormAndHaraka(currentData.forms[formKey], currentHaraka);
        }
    });

    const activeBaseForm = currentData.forms[currentLetterForm] || currentData.char;
    ['none', 'fatha', 'damma', 'kasra'].forEach(harakaKey => {
        const previewEl = document.getElementById(`haraka-preview-${harakaKey}`);
        if (previewEl) {
            previewEl.innerText = combineFormAndHaraka(activeBaseForm, harakaKey);
        }
    });

    document.querySelectorAll('.form-btn').forEach(btn => {
        btn.classList.toggle('active-chip', btn.getAttribute('data-form') === currentLetterForm);
    });
    document.querySelectorAll('.haraka-btn').forEach(btn => {
        btn.classList.toggle('active-chip', btn.getAttribute('data-haraka') === currentHaraka);
    });
}

// 5. نظام النطق الصوتي المدمج (ملفات صوتية عربية محلية + Web Speech API)
function speakFallback(text, lang = 'ar-SA') {
    if (!('speechSynthesis' in window) || !text) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.85;
    utterance.pitch = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const langPrefix = lang.split('-')[0].toLowerCase();
    const matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
    if (matchedVoice) {
        utterance.voice = matchedVoice;
    }

    window.speechSynthesis.speak(utterance);
}

function playLocalAudioFile(audioPath, fallbackText = '', lang = 'ar-SA') {
    if (currentAudioPlayer) {
        currentAudioPlayer.pause();
        currentAudioPlayer.currentTime = 0;
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    currentAudioPlayer = new Audio(audioPath);
    currentAudioPlayer.play().catch(() => {
        if (fallbackText) speakFallback(fallbackText, lang);
    });
}

function getLocalArabicAudioPath() {
    const item = lettersData[currentLevel];
    const audioIdx = (item && typeof item.originalIndex === 'number') ? item.originalIndex : currentLevel;

    if (currentCategoryFile.includes('arabic_letters')) {
        return `assets/audio/ar/letter_${audioIdx}_${currentHaraka}.mp3`;
    }
    if (currentCategoryFile.includes('arabic_numbers')) {
        return `assets/audio/ar/number_${audioIdx}.mp3`;
    }
    if (currentCategoryFile.includes('arabic_words')) {
        return `assets/audio/ar/word_${audioIdx}.mp3`;
    }
    if (currentCategoryFile.includes('math_equations')) {
        return `assets/audio/ar/math_${audioIdx}.mp3`;
    }
    return null;
}

function speakCurrentItem() {
    if (!lettersData.length || !lettersData[currentLevel]) return;
    const currentData = lettersData[currentLevel];

    if (currentCategoryFile.includes('english')) {
        speakFallback(currentData.char, 'en-US');
        return;
    }

    const localAudioPath = getLocalArabicAudioPath();
    if (localAudioPath) {
        const fallbackText = (currentData.sounds && currentData.sounds[currentHaraka])
            ? currentData.sounds[currentHaraka]
            : (currentData.name || currentData.char);
        playLocalAudioFile(localAudioPath, fallbackText, 'ar-SA');
        return;
    }

    speakFallback(currentData.char, 'ar-SA');
}

// ربط أزرار مواضع الحرف (منفصل، أول، وسط، آخر الكلمة)
document.querySelectorAll('.form-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        currentLetterForm = btn.getAttribute('data-form');
        updateArabicToolbarUI();
        drawTemplate(getActiveCharacterText());
        speakCurrentItem();
    });
});

// ربط أزرار الحركات القصيرة (بدون حركة، فتحة، ضمة، كسرة)
document.querySelectorAll('.haraka-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        currentHaraka = btn.getAttribute('data-haraka');
        updateArabicToolbarUI();
        drawTemplate(getActiveCharacterText());
        speakCurrentItem();
    });
});

// ربط زر الاستماع في أعلى لوحة الرسم
const speakBtn = document.getElementById('btn-speak');
if (speakBtn) {
    speakBtn.addEventListener('click', () => {
        speakCurrentItem();
    });
}

// 6. برمجة أزرار البوابة الرئيسية (اختيار المستوى)
document.getElementById('btn-basic').addEventListener('click', () => {
    currentMode = 'basic';
    switchScreen(homeScreen);
});

document.getElementById('btn-advanced').addEventListener('click', () => {
    currentMode = 'advanced';
    switchScreen(homeScreen);
});

// 7. برمجة جزر خريطة الكنز (قراءة البيانات حسب المستوى المختار)
document.querySelectorAll('.category-btn').forEach(button => {
    button.addEventListener('click', () => {
        isHomeworkMode = false;
        const targetFile = currentMode === 'basic'
            ? button.getAttribute('data-target-basic')
            : button.getAttribute('data-target-advanced');

        loadCategoryData(targetFile);
    });
});

// 8. جلب البيانات والانتقال لـ (شاشة الشبكة)
async function loadCategoryData(fileUrl) {
    try {
        currentCategoryFile = fileUrl;
        const response = await fetch(fileUrl);
        lettersData = await response.json();

        buildGrid();
        switchScreen(gridScreen);
    } catch (error) {
        console.error("خطأ في تحميل البيانات: ", error);
        alert("تأكد من تشغيل المشروع عبر سيرفر محلي لقراءة ملفات JSON");
    }
}

// 9. بناء شبكة الحروف/الكلمات ديناميكياً مع استرجاع الإنجاز المحفوظ
function buildGrid() {
    const gridContainer = document.getElementById('items-grid');
    gridContainer.innerHTML = '';

    lettersData.forEach((item, index) => {
        const btn = document.createElement('button');
        btn.className = 'grid-item';

        // استرجاع حالة الإنجاز الدائمة من ذاكرة المتصفح/الآيباد
        if (isItemCompleted(currentCategoryFile, index)) {
            btn.classList.add('completed');
        }

        if (item.char.length > 3) {
            btn.style.fontSize = '1.8rem';
        }

        btn.innerText = item.char;

        btn.addEventListener('click', () => {
            isHomeworkMode = false;
            currentLevel = index;
            currentLetterForm = 'isolated';
            currentHaraka = 'none';
            switchScreen(drawingScreen);
            startLevel();
        });

        gridContainer.appendChild(btn);
    });
}

// 10. التنقل الآمن بين الواجهات الخمس
function switchScreen(showElement) {
    [welcomeScreen, homeScreen, gridScreen, drawingScreen, quizScreen].forEach(scr => {
        if (scr) {
            scr.classList.remove('active');
            scr.classList.add('hidden');
        }
    });

    showElement.classList.remove('hidden');
    showElement.classList.add('active');
}

// 11. دالة بدء الرسم
function startLevel() {
    const currentData = lettersData[currentLevel];
    document.getElementById('level-title').innerText = currentData.name;

    const badgeEl = document.getElementById('drawing-badge');
    if (badgeEl) {
        if (isHomeworkMode) {
            badgeEl.innerText = `📝 واجب اليوم: الخطوة ${toArabicNumeral(homeworkStep + 1)} من ${toArabicNumeral(homeworkTotalSteps)}`;
            badgeEl.classList.add('homework-active-badge');
        } else {
            badgeEl.innerText = '📓 دفتر الخط المسطر';
            badgeEl.classList.remove('homework-active-badge');
        }
    }

    updateArabicToolbarUI();

    if (typeof resizeCanvas === 'function') {
        resizeCanvas();
    }
    drawTemplate(getActiveCharacterText());
    speakCurrentItem();
}

// 12. التحكم بأزرار لوحة الرسم والمؤثرات البصرية
function fireConfetti() {
    confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#42A5F5', '#66BB6A', '#FFA726', '#AB47BC']
    });
}

// زر الإنجاز في شاشة الرسم (لا يتفعل إلا بعد تغطية الحرف)
document.getElementById('btn-next').addEventListener('click', () => {
    if (window.tracingState && !window.tracingState.isCompleted) {
        return;
    }

    addStars(1);
    playLocalAudioFile('assets/audio/ar/feedback_correct.mp3', 'أحسنت يا بطل', 'ar-SA');

    const currentData = lettersData[currentLevel];
    if (isHomeworkMode) {
        // حفظ الحرف المنجز ضمن واجب اليوم في سجل الحروف الأساسي أيضاً
        if (currentData && typeof currentData.originalIndex === 'number') {
            markItemCompleted('data/arabic_letters.json', currentData.originalIndex);
        }
    } else {
        markItemCompleted(currentCategoryFile, currentLevel);
        const gridItems = document.querySelectorAll('.grid-item');
        if (gridItems[currentLevel]) {
            gridItems[currentLevel].classList.add('completed');
        }
    }

    fireConfetti();

    setTimeout(() => {
        if (isHomeworkMode) {
            homeworkStep += 1;
            if (homeworkStep === 1) {
                // الانتقال للحرف الثاني في واجب اليوم
                currentLevel = 1;
                currentLetterForm = 'isolated';
                currentHaraka = 'none';
                startLevel();
            } else {
                // الانتقال لمرحلة الأسئلة التفاعلية في واجب اليوم
                currentQuizIndex = 0;
                switchScreen(quizScreen);
                renderQuizQuestion();
            }
        } else {
            switchScreen(gridScreen);
        }
    }, 1300);
});

document.getElementById('btn-clear').addEventListener('click', () => {
    if (lettersData.length > 0) {
        drawTemplate(getActiveCharacterText());
    }
});

// =========================================================
// 13. محرك التدريبات التفاعلية والواجب اليومي (Quiz Engine)
// =========================================================

function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// تشغيل تدريب اللغة العربية (صيد الحروف وأشكالها)
document.getElementById('btn-quiz-arabic').addEventListener('click', async () => {
    try {
        isHomeworkMode = false;
        const res = await fetch('data/quizzes_arabic.json');
        const allArabic = await res.json();
        quizQuestions = shuffleArray(allArabic).slice(0, 6);
        currentQuizIndex = 0;
        switchScreen(quizScreen);
        renderQuizQuestion();
    } catch (e) {
        console.error('خطأ في تحميل تدريبات العربي:', e);
    }
});

// تشغيل تدريب الرياضيات البصري (الجمع والطرح بالعدّ)
document.getElementById('btn-quiz-math').addEventListener('click', async () => {
    try {
        isHomeworkMode = false;
        const res = await fetch('data/quizzes_math.json');
        const allMath = await res.json();
        quizQuestions = shuffleArray(allMath).slice(0, 5);
        currentQuizIndex = 0;
        switchScreen(quizScreen);
        renderQuizQuestion();
    } catch (e) {
        console.error('خطأ في تحميل تدريبات الرياضيات:', e);
    }
});

// تشغيل نظام "واجب اليوم 📝" (كتابة حرفين + ٣ أسئلة عربي + مسألتين جمع وطرح)
document.getElementById('btn-daily-homework').addEventListener('click', async () => {
    try {
        isHomeworkMode = true;
        homeworkStep = 0;

        const [lettersRes, arQuizRes, mathQuizRes] = await Promise.all([
            fetch('data/arabic_letters.json'),
            fetch('data/quizzes_arabic.json'),
            fetch('data/quizzes_math.json')
        ]);

        const allLetters = await lettersRes.json();
        const allArQuizzes = await arQuizRes.json();
        const allMathQuizzes = await mathQuizRes.json();

        // حفظ الفهرس الأصلي لكل حرف لتشغيل ملف الصوت الصحيح
        const indexedLetters = allLetters.map((item, idx) => ({ ...item, originalIndex: idx }));
        homeworkLetters = shuffleArray(indexedLetters).slice(0, 2);

        // تجهيز باقة الأسئلة (٣ عربي + ٢ حساب)
        const selectedAr = shuffleArray(allArQuizzes).slice(0, 3);
        const selectedMath = shuffleArray(allMathQuizzes).slice(0, 2);
        quizQuestions = [...selectedAr, ...selectedMath];

        // نبدأ بكتابة الحرف الأول في شاشة الرسم
        currentCategoryFile = 'data/arabic_letters.json';
        lettersData = homeworkLetters;
        currentLevel = 0;
        currentLetterForm = 'isolated';
        currentHaraka = 'none';

        switchScreen(drawingScreen);
        startLevel();
    } catch (e) {
        console.error('خطأ في تشغيل واجب اليوم:', e);
    }
});

function speakCurrentQuizQuestion() {
    const q = quizQuestions[currentQuizIndex];
    if (!q) return;
    if (q.audioKey) {
        playLocalAudioFile(`assets/audio/ar/${q.audioKey}.mp3`, q.prompt, 'ar-SA');
    } else {
        speakFallback(q.prompt, 'ar-SA');
    }
}

document.getElementById('btn-quiz-speak').addEventListener('click', () => {
    speakCurrentQuizQuestion();
});

// تلوين الحرف المستهدف داخل الكلمة عند الإجابة الصحيحة
function highlightTargetLetterInWord(word, targetLetter) {
    if (!targetLetter) return word;
    const baseTarget = targetLetter.replace(/ـ/g, '')[0];
    if (!baseTarget) return word;

    let highlighted = '';
    for (const ch of word) {
        if (ch === baseTarget || (baseTarget === 'أ' && (ch === 'أ' || ch === 'إ' || ch === 'ا'))) {
            highlighted += `<span class="letter-highlight">${ch}</span>`;
        } else {
            highlighted += ch;
        }
    }
    return highlighted;
}

// عرض السؤال الحالي في شاشة التدريبات
function renderQuizQuestion() {
    const q = quizQuestions[currentQuizIndex];
    if (!q) return;

    currentTouchCount = 0;

    // 1. تحديث شارة التقدم
    const progressBadge = document.getElementById('quiz-progress-badge');
    if (isHomeworkMode) {
        progressBadge.innerText = `📝 واجب اليوم: الخطوة ${toArabicNumeral(homeworkStep + 1)} من ${toArabicNumeral(homeworkTotalSteps)}`;
        progressBadge.classList.add('homework-active-badge');
    } else {
        progressBadge.innerText = `السؤال ${toArabicNumeral(currentQuizIndex + 1)} من ${toArabicNumeral(quizQuestions.length)}`;
        progressBadge.classList.remove('homework-active-badge');
    }

    // 2. تحديث نص السؤال وإخفاء لافتة التعزيز السابقة
    document.getElementById('quiz-prompt-text').innerText = q.prompt;
    const feedbackBanner = document.getElementById('quiz-feedback-banner');
    feedbackBanner.className = 'quiz-feedback-banner hidden';
    feedbackBanner.innerText = '';

    const visualStage = document.getElementById('quiz-visual-stage');
    const optionsContainer = document.getElementById('quiz-options-container');
    visualStage.innerHTML = '';
    optionsContainer.innerHTML = '';

    // 3. بناء المنطقة البصرية والاختيارات حسب نوع السؤال
    if (q.type === 'visual_math') {
        renderVisualMathQuestion(q, visualStage, optionsContainer);
    } else {
        renderArabicQuizQuestion(q, visualStage, optionsContainer);
    }

    // 4. قراءة السؤال صوتياً للطفل
    speakCurrentQuizQuestion();
}

// عرض سؤال لغة عربية (صيد الحروف أو أشكال الحرف والحركات)
function renderArabicQuizQuestion(q, visualStage, optionsContainer) {
    // بطاقة استعراض الحرف المطلوب في الوسط
    const targetBadge = document.createElement('div');
    targetBadge.className = 'quiz-target-letter-box';
    targetBadge.innerHTML = `
        <span class="target-box-label">ابحث عن:</span>
        <span class="target-box-char">${q.targetLetter}</span>
    `;
    visualStage.appendChild(targetBadge);

    let questionAnswered = false;

    q.options.forEach(opt => {
        const card = document.createElement('button');
        card.className = 'quiz-option-card';

        const emojiHtml = opt.emoji ? `<span class="quiz-card-emoji">${opt.emoji}</span>` : '';
        const subHtml = opt.sub ? `<span class="quiz-card-sub">${opt.sub}</span>` : '';

        card.innerHTML = `
            ${emojiHtml}
            <span class="quiz-card-word">${opt.word}</span>
            ${subHtml}
        `;

        card.addEventListener('click', () => {
            if (questionAnswered) return;

            if (opt.isCorrect) {
                questionAnswered = true;
                card.classList.add('correct-card');

                // إبراز الحرف المستهدف بلون مميز داخل الكلمة
                const wordSpan = card.querySelector('.quiz-card-word');
                if (wordSpan && q.type === 'letter_hunt') {
                    wordSpan.innerHTML = highlightTargetLetterInWord(opt.word, q.targetLetter);
                }

                handleCorrectQuizAnswer();
            } else {
                card.classList.add('wrong-card');
                setTimeout(() => card.classList.remove('wrong-card'), 600);
                handleWrongQuizAnswer();
            }
        });

        optionsContainer.appendChild(card);
    });
}

// عرض مسألة جمع أو طرح تفاعلية بالعدّ البصري
function renderVisualMathQuestion(q, visualStage, optionsContainer) {
    const mathContainer = document.createElement('div');
    mathContainer.className = 'visual-math-box';

    // شريط المعادلة الرياضية الكبير
    const equationRow = document.createElement('div');
    equationRow.className = 'math-equation-display';
    equationRow.innerHTML = `
        <span class="eq-text">${q.equationText}</span>
        <span id="eq-answer-slot" class="eq-answer-slot">؟</span>
    `;
    mathContainer.appendChild(equationRow);

    // منطقة العناصر القابلة للمس والعدّ
    const objectsRow = document.createElement('div');
    objectsRow.className = 'countable-objects-row';

    function createCountableItem(emoji, isSubtracted = false) {
        const itemBtn = document.createElement('button');
        itemBtn.type = 'button';
        itemBtn.className = 'countable-item' + (isSubtracted ? ' subtracted-item' : '');
        itemBtn.innerHTML = `
            <span class="countable-emoji">${emoji}</span>
            <span class="count-badge hidden">٠</span>
            ${isSubtracted ? '<span class="sub-cross">❌</span>' : ''}
        `;

        if (!isSubtracted) {
            itemBtn.addEventListener('click', () => {
                const badge = itemBtn.querySelector('.count-badge');
                let assignedNum = parseInt(itemBtn.getAttribute('data-count-num') || '0', 10);
                if (!assignedNum) {
                    currentTouchCount += 1;
                    assignedNum = currentTouchCount;
                    itemBtn.setAttribute('data-count-num', String(assignedNum));
                    itemBtn.classList.add('counted-active');
                    badge.innerText = toArabicNumeral(assignedNum);
                    badge.classList.remove('hidden');
                } else {
                    itemBtn.classList.remove('counted-active');
                    void itemBtn.offsetWidth; // إعادة تشغيل حركة النبض
                    itemBtn.classList.add('counted-active');
                }

                // نطق الرقم عند لمس التفاحة/البالون
                if (assignedNum >= 1 && assignedNum <= 10) {
                    playLocalAudioFile(`assets/audio/ar/count_${assignedNum}.mp3`, String(assignedNum), 'ar-SA');
                }
            });
        }

        return itemBtn;
    }

    if (q.operation === 'add') {
        const group1 = document.createElement('div');
        group1.className = 'countable-group';
        for (let i = 0; i < q.num1; i++) {
            group1.appendChild(createCountableItem(q.emoji, false));
        }

        const plusSign = document.createElement('span');
        plusSign.className = 'visual-op-sign';
        plusSign.innerText = '+';

        const group2 = document.createElement('div');
        group2.className = 'countable-group';
        for (let i = 0; i < q.num2; i++) {
            group2.appendChild(createCountableItem(q.emoji, false));
        }

        objectsRow.appendChild(group1);
        objectsRow.appendChild(plusSign);
        objectsRow.appendChild(group2);
    } else {
        // عملية الطرح: نعرض العناصر المتبقية قابلة للعدّ، والعناصر المطروحة عليها علامة حذف لطيفة
        const groupRemain = document.createElement('div');
        groupRemain.className = 'countable-group';
        const remainingCount = q.num1 - q.num2;
        for (let i = 0; i < q.num1; i++) {
            const isSub = i >= remainingCount;
            groupRemain.appendChild(createCountableItem(q.emoji, isSub));
        }
        objectsRow.appendChild(groupRemain);
    }

    const hintText = document.createElement('p');
    hintText.className = 'touch-count-hint';
    hintText.innerText = `👆 المس ${q.itemName} بإصبعك لتعدّها بالصوت!`;

    mathContainer.appendChild(objectsRow);
    mathContainer.appendChild(hintText);
    visualStage.appendChild(mathContainer);

    // بطاقات اختيار الرقم الصحيح
    let questionAnswered = false;
    q.options.forEach(opt => {
        const card = document.createElement('button');
        card.className = 'quiz-option-card math-option-card';
        card.innerHTML = `<span class="quiz-card-number">${opt.label}</span>`;

        card.addEventListener('click', () => {
            if (questionAnswered) return;

            if (opt.value === q.answer) {
                questionAnswered = true;
                card.classList.add('correct-card');

                const slot = document.getElementById('eq-answer-slot');
                if (slot) {
                    slot.innerText = opt.label;
                    slot.classList.add('solved-slot');
                }

                handleCorrectQuizAnswer();
            } else {
                card.classList.add('wrong-card');
                setTimeout(() => card.classList.remove('wrong-card'), 600);
                handleWrongQuizAnswer();
            }
        });

        optionsContainer.appendChild(card);
    });
}

function handleCorrectQuizAnswer() {
    addStars(1);
    fireConfetti();
    playLocalAudioFile('assets/audio/ar/feedback_correct.mp3', 'أحسنت يا بطل', 'ar-SA');

    const feedbackBanner = document.getElementById('quiz-feedback-banner');
    feedbackBanner.innerText = '🌟 أحسنت يا بطل! إجابة رائعة!';
    feedbackBanner.className = 'quiz-feedback-banner feedback-success';

    setTimeout(() => {
        if (isHomeworkMode) {
            homeworkStep += 1;
        }
        currentQuizIndex += 1;

        if (currentQuizIndex < quizQuestions.length) {
            renderQuizQuestion();
        } else {
            finishQuizSession();
        }
    }, 1700);
}

function handleWrongQuizAnswer() {
    playLocalAudioFile('assets/audio/ar/feedback_wrong.mp3', 'حاول مرة أخرى يا بطل', 'ar-SA');
    const feedbackBanner = document.getElementById('quiz-feedback-banner');
    feedbackBanner.innerText = '💡 حاول مرة أخرى يا بطل!';
    feedbackBanner.className = 'quiz-feedback-banner feedback-retry';
}

function finishQuizSession() {
    const iconEl = document.getElementById('celebration-icon');
    const titleEl = document.getElementById('celebration-title');
    const descEl = document.getElementById('celebration-desc');

    if (isHomeworkMode) {
        trophies += 1;
        localStorage.setItem('kids_trophies', trophies);
        addStars(5); // مكافأة إضافية لإتمام الواجب اليومي
        iconEl.innerText = '🏆';
        titleEl.innerText = 'كأس الواجب اليومي!';
        descEl.innerText = 'مبروك يا بطل! أنجزت واجب اليوم بالكامل وحصلت على الكأس الذهبي و ٥ نجوم إضافية!';
        playLocalAudioFile('assets/audio/ar/feedback_trophy.mp3', 'مبروك يا بطل', 'ar-SA');
    } else {
        iconEl.innerText = '🌟';
        titleEl.innerText = 'أنت رائع يا بطل!';
        descEl.innerText = 'لقد أكملت جميع أسئلة التحدي بنجاح!';
        playLocalAudioFile('assets/audio/ar/feedback_correct.mp3', 'أحسنت يا بطل', 'ar-SA');
    }

    fireConfetti();
    celebrationModal.classList.remove('hidden');
}

document.getElementById('btn-close-celebration').addEventListener('click', () => {
    celebrationModal.classList.add('hidden');
    isHomeworkMode = false;
    switchScreen(homeScreen);
});

// 14. أزرار الرجوع (Navigation)
document.getElementById('btn-back-grid').addEventListener('click', () => {
    if (isHomeworkMode) {
        isHomeworkMode = false;
        switchScreen(homeScreen);
    } else {
        switchScreen(gridScreen);
    }
});

document.getElementById('btn-back-quiz').addEventListener('click', () => {
    isHomeworkMode = false;
    switchScreen(homeScreen);
});

document.getElementById('btn-back-home').addEventListener('click', () => {
    switchScreen(homeScreen);
});

document.getElementById('btn-back-welcome').addEventListener('click', () => {
    switchScreen(welcomeScreen);
});

// 15. تحديث الرسم عند دوران الشاشة أو اكتمال تحميل الخطوط التعليمية
window.addEventListener('resize', () => {
    if (lettersData.length > 0 && drawingScreen.classList.contains('active')) {
        drawTemplate(getActiveCharacterText());
    }
});

if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
        if (lettersData.length > 0 && drawingScreen.classList.contains('active')) {
            drawTemplate(getActiveCharacterText());
        }
    });
}

// 16. تسجيل Service Worker للعمل بدون إنترنت
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .catch(error => console.log('فشل تشغيل Service Worker:', error));
    });
}