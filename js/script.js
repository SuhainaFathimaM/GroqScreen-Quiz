const captureFullScreenStartButton = document.getElementById('start-full-screenshot');
const captureFullScreenStopButton = document.getElementById('stop-full-screenshot');
const loadingOverlay = document.getElementById('loading-overlay');
const confirmationMessageDiv = document.getElementById('confirmation-message');

let fullScreenStream;
let fullScreenVideoTrack;
let isFullScreenCapturing = false;
const capturedImageDataURLs = [];
let screenshotCount = 0;

function showConfirmation(message, duration = 2000) {
    confirmationMessageDiv.textContent = message;
    confirmationMessageDiv.style.opacity = 1;
    setTimeout(() => {
        confirmationMessageDiv.style.opacity = 0;
    }, duration);
}

function showLoading() {
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

async function startFullScreenCapture() {
    try {
        fullScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        fullScreenVideoTrack = fullScreenStream.getVideoTracks()[0];
        isFullScreenCapturing = true;
        captureFullScreenStartButton.disabled = true;
        captureFullScreenStartButton.innerHTML = '<span>🔴</span> Capturing... (0)'; // Visual feedback for active capture
        captureFullScreenStopButton.disabled = false;
        capturedImageDataURLs.length = 0;
        screenshotCount = 0;
        captureFullScreenInterval();
        showConfirmation('Screen capture started...');


        fullScreenVideoTrack.onended = () => {
            stopFullScreenCapture();
        };

    } catch (error) {
        console.error('Error accessing display media:', error);
        captureFullScreenStartButton.disabled = false;
        captureFullScreenStartButton.innerHTML = `<span>▶️</span> Start Capture (0)`;
        captureFullScreenStopButton.disabled = true;
        isFullScreenCapturing = false;
        showConfirmation('Failed to start screen capture.', 3000);

    }
}

async function captureFullScreenFrame() {
    if (!fullScreenStream || !fullScreenVideoTrack || !isFullScreenCapturing) {
        return;
    }
    try {
        const imageCapture = new ImageCapture(fullScreenVideoTrack);
        const bitmap = await imageCapture.grabFrame();

        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        const imageDataURL = canvas.toDataURL('image/png');
        capturedImageDataURLs.push(imageDataURL);
        screenshotCount++;
        updateStartButtonTextCapturing();

    } catch (error) {
        console.error('Error capturing full screenshot frame:', error);
        showConfirmation('Error capturing frame.', 2000);

    }
}

function captureFullScreenInterval() {
    if (isFullScreenCapturing) {
        captureFullScreenFrame();
        setTimeout(captureFullScreenInterval, 5000);
    }
}

function stopFullScreenCapture() {
    isFullScreenCapturing = false;
    captureFullScreenStartButton.disabled = false;
    updateStartButtonText();
    captureFullScreenStopButton.disabled = true;
    if (fullScreenStream) {
        fullScreenStream.getTracks().forEach(track => track.stop());
        fullScreenStream = null;
        fullScreenVideoTrack = null;
    }
    showConfirmation('Stopping capture and processing...', 3000);
    sendAllScreenshotsForSummary();
}

async function sendAllScreenshotsForSummary() {
    if (capturedImageDataURLs.length === 0) {
        alert('No screenshots captured.');
        return;
    }

    showLoading();

    const blobs = await Promise.all(capturedImageDataURLs.map(async (url) => {
        const response = await fetch(url);
        return await response.blob();
    }));

    const formData = new FormData();
    blobs.forEach((blob, index) => {
        formData.append('screenshots', blob, `screenshot-${index + 1}.png`);
    });

    try {
        // Update this URL to your Vercel backend API endpoint
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            console.error('Error sending screenshots for summarization:', await response.text());
            alert('Failed to get summary and quiz data.');
            hideLoading();
            showConfirmation('Failed to get summary and quiz data.', 3000);
            return;
        }

        const result = await response.json();
        console.log('Summary result:', result);
        hideLoading();
        if (result && result.combined_output) {
            window.location.href = `quiz.html?combined_output=${encodeURIComponent(result.combined_output)}`;
        } else {
            alert('No summary and quiz data received.');
            showConfirmation('No summary and quiz data received.', 3000);
        }

    } catch (error) {
        console.error('Error sending screenshots for summarization:', error);
        alert('Failed to send screenshots for summary.');
        hideLoading();
        showConfirmation('Failed to send screenshots for summary.', 3000);
    }
}

function updateStartButtonText() {
    captureFullScreenStartButton.innerHTML = `<span>▶️</span> Start Capture (${screenshotCount})`;
}

function updateStartButtonTextCapturing() {
    captureFullScreenStartButton.innerHTML = `<span>🔴</span> Capturing... (${screenshotCount})`;
}

captureFullScreenStartButton.addEventListener('click', startFullScreenCapture);
captureFullScreenStopButton.addEventListener('click', stopFullScreenCapture);


updateStartButtonText();
