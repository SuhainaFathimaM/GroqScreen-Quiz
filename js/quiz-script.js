const summaryContentElement = document.getElementById('summary-content');
const summaryContainer = document.getElementById('summary-container');
const quizContainer = document.getElementById('quiz-container');
const startQuizButton = document.getElementById('start-quiz-button');

const questionWrappers = document.querySelectorAll('.question-wrapper');
const prevButton = document.getElementById('prev-button');
const nextButton = document.getElementById('next-button');
const resultsContainer = document.getElementById('results-container');
const resultsList = document.getElementById('results-list');
const scoreDisplay = document.querySelector('#results-container .score');
const quizForm = document.getElementById('quiz-form');

let currentQuestionIndex = 0;
let questionsData = []; 
const userAnswers = {};

console.log('Script loaded.');

function showQuestion(index) {
    console.log(`showQuestion called with index: ${index}`);
    questionWrappers.forEach((wrapper, i) => {
        wrapper.style.display = i === index ? 'block' : 'none';
        wrapper.classList.remove('active');
    });
    if (questionWrappers[index]) {
        questionWrappers[index].classList.add('active');
    }

    prevButton.style.display = index > 0 ? 'inline-block' : 'none';
    nextButton.style.display = 'inline-block';
    nextButton.textContent = index < questionsData.length - 1 ? 'Next' : 'Submit Quiz'; 
    console.log(`nextButton text is now: ${nextButton.textContent}`);
}

function loadQuestionData(combinedOutput) {
    console.log('loadQuestionData called with output:', combinedOutput);
    const summaryMatch = combinedOutput.match(/## Summary\s*\n\n(.*?)\n\n## Multiple-Choice Quiz Questions/s);
    if (summaryMatch && summaryMatch[1]) {
        summaryContentElement.textContent = summaryMatch[1].trim();
        console.log('Summary loaded:', summaryContentElement.textContent);
    }

    for (let i = 1; i <= 5; i++) {
        const regex = new RegExp(`### Question${i}:\\s*(.*?)\\s*A\\)\\s*(.*?)\\s*B\\)\\s*(.*?)\\s*C\\)\\s*(.*?)\\s*\\**Correct Answer:\\*\\*\\s*([ABC])\\)`, 's');
        const match = combinedOutput.match(regex);
        if (match) {
            const questionData = {
                question: match[1].trim(),
                options: { A: match[2].trim(), B: match[3].trim(), C: match[4].trim() },
                correctAnswer: match[5].trim().toUpperCase(),
                questionNumber: i
            };
            questionsData.push(questionData);
            console.log(`Question ${i} parsed:`, questionData);
        }
    }

    if (questionsData.length === 5) {
        questionsData.forEach((q, index) => {
            const qNum = index + 1;
            document.getElementById(`q${qNum}-text`).textContent = q.question;
            document.getElementById(`q${qNum}-a-text`).textContent = q.options.A;
            document.getElementById(`q${qNum}-b-text`).textContent = q.options.B;
            document.getElementById(`q${qNum}-c-text`).textContent = q.options.C;
            console.log(`Question ${qNum} text loaded into HTML.`);
        });
        showQuestion(currentQuestionIndex);
    } else {
        summaryContentElement.textContent = "Error parsing quiz questions.";
        quizContainer.style.display = 'none';
        startQuizButton.style.display = 'none';
        console.error('Error parsing quiz questions. questionsData:', questionsData);
    }
}

function handleAnswerSelection(questionIndex, answer) {
    console.log(`handleAnswerSelection for question ${questionIndex + 1} with answer: ${answer}`);
    userAnswers[`q${questionIndex + 1}`] = answer;
    const wrapper = questionWrappers[questionIndex];
    const labels = wrapper.querySelectorAll('.option-label');
    labels.forEach(label => label.classList.remove('selected'));
    const selectedLabel = wrapper.querySelector(`label[for="q${questionIndex + 1}-${answer.toLowerCase()}"]`);
    if (selectedLabel) {
        selectedLabel.classList.add('selected');
        console.log(`Answer ${answer} selected for question ${questionIndex + 1}`);
    }
}

function submitQuiz() {
    console.log('submitQuiz called.');
    quizContainer.style.display = 'none';
    resultsContainer.style.display = 'block';
    resultsList.innerHTML = '';
    let correctCount = 0;

    
    questionWrappers.forEach(wrapper => {
        wrapper.classList.remove('correct', 'incorrect');
        const labels = wrapper.querySelectorAll('.option-label');
        labels.forEach(label => label.classList.remove('correct-answer', 'incorrect-answer', 'selected'));
        const feedbackDiv = wrapper.querySelector('.question-feedback');
        if (feedbackDiv) {
            feedbackDiv.textContent = '';
            feedbackDiv.classList.remove('correct', 'incorrect');
        }
    });

    questionsData.forEach((question, index) => {
        const userAnswer = userAnswers[`q${index + 1}`];
        const isCorrect = userAnswer === question.correctAnswer;

        const listItem = document.createElement('li');
        listItem.innerHTML = `<strong>Question ${index + 1}:</strong> ${question.question}<br>Your Answer: ${userAnswer || 'Not answered'} <br>Correct Answer: ${question.correctAnswer} <span style="font-weight: bold; color: ${isCorrect ? 'green' : 'red'}">${isCorrect ? '✓' : '✗'}</span>`;
        resultsList.appendChild(listItem);
        console.log(`Result added for question ${index + 1}. Correct: ${isCorrect}`);
        if (isCorrect) {
            correctCount++;
        }
    });

    scoreDisplay.textContent = `You scored ${correctCount} out of ${questionsData.length}`;
    console.log('Quiz submitted. Score:', scoreDisplay.textContent);
}


startQuizButton.addEventListener('click', function() {
    console.log('Start Quiz button clicked.');
    summaryContainer.style.display = 'none';
    startQuizButton.style.display = 'none';
    quizContainer.style.display = 'block';
});

prevButton.addEventListener('click', function() {
    console.log('Previous button clicked. currentQuestionIndex:', currentQuestionIndex);
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        showQuestion(currentQuestionIndex);
    }
});

nextButton.addEventListener('click', function() {
    console.log('Next button clicked. currentQuestionIndex:', currentQuestionIndex);
    if (currentQuestionIndex < questionsData.length - 1) {
        currentQuestionIndex++;
        showQuestion(currentQuestionIndex);
    } else {
        
        console.log('Reached last question. Submitting quiz directly.');
        submitQuiz();
    }
});

questionWrappers.forEach((wrapper, index) => {
    wrapper.querySelectorAll('.option-input').forEach(input => {
        input.addEventListener('change', function() {
            handleAnswerSelection(index, this.value);
        });
    });
});

quizForm.addEventListener('submit', function(event) {
    event.preventDefault(); 
    console.log('Quiz form submitted (should be prevented).');
});


const urlParams = new URLSearchParams(window.location.search);
const combinedOutput = urlParams.get('combined_output');
if (combinedOutput) {
    loadQuestionData(combinedOutput);
} else {
    summaryContentElement.textContent = "No quiz data provided.";
    quizContainer.style.display = 'none';
    startQuizButton.style.display = 'none';
    console.log('No combined_output found in URL.');
}
