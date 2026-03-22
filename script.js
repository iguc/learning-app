// Configuration
const SHEET_ID = '1IM1rOvvY95v8I8MMe84TjdMqsIrTags5DPFlmDoT-hY';
const API_KEY = 'AIzaSyDRTlxBzzdhMruzkM6Eg0Yy774_1LnP59o';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzYFvkjpS8rS6d_kKMp6L-RZgkwB0zOV_8aVSNIgsbjcZVmls3rQuEuXKEYAh5FOK06/exec';
const MASTERY_THRESHOLD = 5;

let allQuestions = [];
let filteredQuestions = [];
let questionStats = {};
let currentQuestionIndex = 0;
let selectedRange = { start: 1, end: 100 };
let stats = {
    correct: 0,
    total: 0
};

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    loadQuestions();
    setupRangeSelector();
});

// Setup range selector
function setupRangeSelector() {
    const startInput = document.getElementById('start-num');
    const endInput = document.getElementById('end-num');
    
    startInput.addEventListener('input', updateRangeCount);
    endInput.addEventListener('input', updateRangeCount);
}

function updateRangeCount() {
    const start = parseInt(document.getElementById('start-num').value) || 1;
    const end = parseInt(document.getElementById('end-num').value) || 100;
    const count = Math.max(0, end - start + 1);
    document.getElementById('range-count').textContent = count;
}

// Load all questions from Google Sheets
async function loadQuestions() {
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/問題?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.values) {
            throw new Error('No data found');
        }

        const rows = data.values.slice(1);
        allQuestions = rows.map(row => ({
            id: parseInt(row[0]),
            text: row[1],
            translation: row[2],
            correct: row[3] ? row[3].toLowerCase().trim() : ''
        }));

        // Initialize stats for all questions
        allQuestions.forEach(q => {
            const isEmpty = !q.text || q.text.trim() === '';
            questionStats[q.id] = {
                askedCount: 0,
                correctCount: 0,
                recentFive: isEmpty ? [true, true, true, true, true] : [],
                answerHistory: [],
                frequency: 1,
                isEmpty: isEmpty
            };
        });

        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('loading').innerHTML = '<p style="color:white;">Error loading questions. Check API key and Sheet ID.</p>';
    }
}

// Start learning with selected range
function startLearning() {
    const start = parseInt(document.getElementById('start-num').value);
    const end = parseInt(document.getElementById('end-num').value);

    if (start < 1 || end > 3300 || start > end) {
        alert('Please enter valid problem numbers (1-3300)');
        return;
    }

    selectedRange = { start, end };

    filteredQuestions = allQuestions.filter(q => {
        if (q.id < start || q.id > end) return false;
        const stat = questionStats[q.id];
        if (stat.recentFive.length === MASTERY_THRESHOLD && stat.recentFive.every(v => v === true)) {
            return false;
        }
        return true;
    });

    if (filteredQuestions.length === 0) {
        showCompletionScreen();
        return;
    }

    sortQuestionsByFrequency();
    stats = { correct: 0, total: 0 };
    currentQuestionIndex = 0;

    document.getElementById('range-selector').style.display = 'none';
    document.getElementById('completion-screen').style.display = 'none';
    document.getElementById('learning-screen').style.display = 'block';

    displayQuestion();
}

// Go back to range selector with confirmation dialog
function goBackToRange() {
    const dialogContent = `
        <div style="background:white; padding:30px; border-radius:12px; box-shadow:0 10px 40px rgba(0,0,0,0.2); max-width:400px;">
            <h3 style="margin-bottom:15px; color:#333;">Reset Learning?</h3>
            <p style="color:#666; margin-bottom:25px;">What would you like to do?</p>
            
            <button onclick="resetSession()" style="width:100%; padding:12px; background:#dc3545; color:white; border:none; border-radius:8px; cursor:pointer; margin-bottom:10px; font-weight:600;">
                Reset This Session Only
            </button>
            
            <button onclick="resetAllHistory()" style="width:100%; padding:12px; background:#ff6b6b; color:white; border:none; border-radius:8px; cursor:pointer; margin-bottom:10px; font-weight:600;">
                Reset All History (Complete Restart)
            </button>
            
            <button onclick="cancelReset()" style="width:100%; padding:12px; background:#6c757d; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:600;">
                Continue Learning
            </button>
        </div>
    `;
    
    const overlay = document.createElement('div');
    overlay.id = 'reset-dialog-overlay';
    overlay.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%; 
        background:rgba(0,0,0,0.5); z-index:1000; display:flex; 
        align-items:center; justify-content:center;
    `;
    overlay.innerHTML = dialogContent;
    document.body.appendChild(overlay);
}

function resetSession() {
    stats = { correct: 0, total: 0 };
    currentQuestionIndex = 0;
    document.getElementById('reset-dialog-overlay').remove();
    document.getElementById('range-selector').style.display = 'block';
    document.getElementById('learning-screen').style.display = 'none';
}

function resetAllHistory() {
    for (let i = selectedRange.start; i <= selectedRange.end; i++) {
        if (questionStats[i]) {
            questionStats[i] = {
                askedCount: 0,
                correctCount: 0,
                recentFive: questionStats[i].isEmpty ? [true, true, true, true, true] : [],
                answerHistory: [],
                frequency: 1,
                isEmpty: questionStats[i].isEmpty
            };
        }
    }
    
    stats = { correct: 0, total: 0 };
    currentQuestionIndex = 0;
    
    document.getElementById('reset-dialog-overlay').remove();
    document.getElementById('range-selector').style.display = 'block';
    document.getElementById('learning-screen').style.display = 'none';
}

function cancelReset() {
    document.getElementById('reset-dialog-overlay').remove();
}

// Show completion screen
function showCompletionScreen() {
    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    document.getElementById('session-accuracy').textContent = accuracy + '%';
    document.getElementById('completed-range').textContent = selectedRange.start + ' - ' + selectedRange.end;
    
    document.getElementById('range-selector').style.display = 'none';
    document.getElementById('learning-screen').style.display = 'none';
    document.getElementById('completion-screen').style.display = 'block';
}

// Sort questions by frequency
function sortQuestionsByFrequency() {
    filteredQuestions.sort(() => {
        const freq1 = questionStats[filteredQuestions[0]?.id]?.frequency || 1;
        const freq2 = questionStats[filteredQuestions[1]?.id]?.frequency || 1;
        const weight1 = Math.random() * freq1;
        const weight2 = Math.random() * freq2;
        return weight2 - weight1;
    });
}

// Display current question
function displayQuestion() {
    if (currentQuestionIndex >= filteredQuestions.length) {
        currentQuestionIndex = 0;
        sortQuestionsByFrequency();
    }

    const question = filteredQuestions[currentQuestionIndex];
    const stat = questionStats[question.id];

    document.getElementById('question-text').textContent = question.text;
    document.getElementById('question-translation').textContent = question.translation;
    document.getElementById('question-num').textContent = question.id;
    document.getElementById('user-answer').value = '';
    document.getElementById('user-answer').focus();

    document.getElementById('asked-count').textContent = stat.askedCount;
    
    const overallAccuracy = stat.askedCount > 0 
        ? Math.round((stat.correctCount / stat.askedCount) * 100)
        : 0;
    document.getElementById('overall-accuracy').textContent = overallAccuracy + '%';

    const recentDisplay = stat.recentFive.length === 0
        ? '-'
        : stat.recentFive.map(v => v ? '○' : '×').join('');
    document.getElementById('recent-three').textContent = recentDisplay;

    document.getElementById('result').style.display = 'none';
    document.getElementById('question-container').style.display = 'block';
}

// Handle Enter key
function handleKeyPress(event) {
    if (event.key === 'Enter') {
        submitAnswer();
    }
}

// Submit answer
async function submitAnswer() {
    const userInput = document.getElementById('user-answer').value.trim();
    
    if (!userInput) {
        alert('Please enter an answer');
        return;
    }

    const question = filteredQuestions[currentQuestionIndex];
    const stat = questionStats[question.id];
    const isCorrect = normalizeAnswer(userInput) === question.correct;

    // Update stats
    stat.askedCount++;
    if (isCorrect) {
        stat.correctCount++;
    }

    // Update answer history
    stat.answerHistory.push(isCorrect ? '○' : '×');

    // Update recent five
    stat.recentFive.push(isCorrect);
    if (stat.recentFive.length > MASTERY_THRESHOLD) {
        stat.recentFive.shift();
    }

    // Update frequency
    if (isCorrect) {
        stat.frequency = Math.max(0.5, stat.frequency - 0.2);
    } else {
        stat.frequency = stat.frequency + 0.3;
    }

    // Update global stats
    stats.total++;
    if (isCorrect) stats.correct++;
    updateSessionStats();

    // Show result
    showResult(isCorrect, userInput, question);

    // Save record to Google Sheets
    await saveRecord(question, userInput, isCorrect, stat);
}

// Normalize answer
function normalizeAnswer(answer) {
    return answer.toLowerCase().trim();
}

// Show result
function showResult(isCorrect, userInput, question) {
    const resultDiv = document.getElementById('result');
    const resultIcon = document.getElementById('result-icon');
    const resultTitle = document.getElementById('result-title');
    const resultDetails = document.getElementById('result-details');

    if (isCorrect) {
        resultIcon.textContent = '🎉';
        resultTitle.textContent = 'Correct!';
        resultTitle.style.color = '#28a745';
        resultDetails.innerHTML = `<p><span class="label">Your answer:</span> ${userInput}</p>`;
    } else {
        resultIcon.textContent = '📚';
        resultTitle.textContent = 'Not quite right';
        resultTitle.style.color = '#dc3545';
        resultDetails.innerHTML = `
            <p><span class="label">Your answer:</span> ${userInput}</p>
            <p><span class="label">Correct answer:</span> ${question.correct}</p>
        `;
    }

    resultDiv.style.display = 'block';
    document.getElementById('question-container').style.display = 'none';
}

// Update session statistics
function updateSessionStats() {
    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    document.getElementById('accuracy').textContent = accuracy + '%';
    document.getElementById('correctCount').textContent = stats.correct;
    document.getElementById('answeredCount').textContent = stats.total;
}

// Save record to Google Sheets
async function saveRecord(question, userInput, isCorrect, stat) {
    const timestamp = new Date().toLocaleString('en-US');
    const recordData = [
        timestamp,
        question.id,
        question.text,
        question.translation,
        userInput,
        question.correct,
        isCorrect ? '○' : '×',
        stat.frequency.toFixed(2)
    ];

    const statsData = [
        question.id,
        stat.askedCount,
        stat.correctCount,
        stat.askedCount > 0 ? Math.round((stat.correctCount / stat.askedCount) * 100) + '%' : '0%',
        stat.recentFive.map(v => v ? '○' : '×').join(''),
        stat.frequency.toFixed(2),
        stat.recentFive.length === MASTERY_THRESHOLD && stat.recentFive.every(v => v) ? 'Y' : 'N'
    ];

    // History detail data (first 10 attempts)
    const historyData = [question.id];
    for (let i = 0; i < 10; i++) {
        historyData.push(stat.answerHistory[i] || '-');
    }

    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'record',
                data: recordData
            })
        });

        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'stats',
                data: statsData
            })
        });

        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'history',
                data: historyData
            })
        });
    } catch (error) {
        console.log('Save record (non-critical):', error);
    }
}

// Next question
function nextQuestion() {
    currentQuestionIndex++;
    
    const allMastered = filteredQuestions.every(q => {
        const stat = questionStats[q.id];
        return stat.recentFive.length === MASTERY_THRESHOLD && 
               stat.recentFive.every(v => v === true);
    });

    if (allMastered) {
        showCompletionScreen();
    } else {
        filteredQuestions = filteredQuestions.filter(q => {
            const stat = questionStats[q.id];
            return !(stat.recentFive.length === MASTERY_THRESHOLD && 
                     stat.recentFive.every(v => v === true));
        });

        if (filteredQuestions.length === 0) {
            showCompletionScreen();
        } else {
            if (currentQuestionIndex >= filteredQuestions.length) {
                currentQuestionIndex = 0;
                sortQuestionsByFrequency();
            }
            displayQuestion();
        }
    }
}
