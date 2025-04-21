
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' })); // Increased payload limit for large images

const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 100 * 1024 * 1024 } }); // Increased limit

// Replace with your actual Groq API key
const GROQ_API_KEY = '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';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL_ID = 'meta-llama/llama-4-scout-17b-16e-instruct'; // Or 'meta-llama/llama-4-maverick-17b-128e-instruct'

async function analyzeImageWithGroq(base64Image, prompt) {
    const requestBody = JSON.stringify({
        model: GROQ_MODEL_ID,
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/png;base64,${base64Image}`
                        }
                    }
                ]
            }
        ],
        temperature: 1,
        max_completion_tokens: 512, // Adjust as needed for individual analysis
        top_p: 1,
        stream: false,
        stop: null
    });

    const groqResponse = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: requestBody,
    });

    if (!groqResponse.ok) {
        const groqError = await groqResponse.json();
        console.error('Error from Groq API:', groqError);
        throw new Error(`Groq API error: ${groqResponse.status} - ${JSON.stringify(groqError)}`);
    }

    return await groqResponse.json();
}

const capturedImages = []; 

app.post('/api/process-full-screenshot', upload.single('full_screenshot'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No full screenshot uploaded.' });
        }

        console.log('Received full screenshot for processing:', req.file.originalname, req.file.buffer.length, 'bytes');

        const base64Image = req.file.buffer.toString('base64');
        capturedImages.push(base64Image); 

        res.json({ message: 'Full screenshot received and stored.' });

    } catch (error) {
        console.error('Error processing full screenshot:', error);
        res.status(500).json({ error: 'Failed to process full screenshot on the server.', details: error.message });
    }
});

app.post('/api/summarize-screenshots', upload.array('screenshots', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No screenshots provided for summarization.' });
        }

        console.log('Received', req.files.length, 'screenshots for summarization.');

        const analysisResults = await Promise.all(req.files.map(async (file) => {
            const base64Image = file.buffer.toString('base64');
            const prompt = "Analyze this image and describe its key content.";
            try {
                const groqResult = await analyzeImageWithGroq(base64Image, prompt);
                return groqResult.choices?.[0]?.message?.content || "No analysis.";
            } catch (error) {
                console.error('Error analyzing an image:', error);
                return "Error during analysis.";
            }
        }));

        console.log('Individual analysis results:', analysisResults);

       
    const summaryPrompt = `The following are descriptions of key content from multiple images:\\n\\n${analysisResults.join("\\n\\n")}\\n\\nBased on this information, provide a concise summary of the overall content. In the summary and quiz do not mention image or screenshot. Summary can be 5 to 10 lines. Then, generate exactly 5 multiple-choice quiz questions related to the summary. Each question should have three options labeled A, B, and C. Clearly indicate the correct answer for each question using the format "**Correct Answer:** [Option Letter])". The final output should strictly adhere to the following format:

## Summary

[Your Summary Here]

## Multiple-Choice Quiz Questions

### Question 1: [Question 1 Text]
A) [Option A]
B) [Option B]
C) [Option C]
**Correct Answer:** [Correct Option Letter])

### Question 2: [Question 2 Text]
A) [Option A]
B) [Option B]
C) [Option C]
**Correct Answer:** [Correct Option Letter])

### Question 3: [Question 3 Text]
A) [Option A]
B) [Option B]
C) [Option C]
**Correct Answer:** [Correct Option Letter])

### Question 4: [Question 4 Text]
A) [Option A]
B) [Option B]
C) [Option C]
**Correct Answer:** [Correct Option Letter])

### Question 5: [Question 5 Text]
A) [Option A]
B) [Option B]
C) [Option C]
**Correct Answer:** [Correct Option Letter])`;
        const summaryRequestBody = JSON.stringify({
            model: GROQ_MODEL_ID,
            messages: [{ role: "user", content: summaryPrompt }],
            temperature: 0.7, // Lower temperature for more focused output
            max_completion_tokens: 1024, // Adjust for the length of the summary and quiz
            top_p: 1,
            stream: false,
            stop: null
        });

        const summaryResponse = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: summaryRequestBody,
        });

        if (!summaryResponse.ok) {
            const summaryError = await summaryResponse.json();
            console.error('Error from Groq API during summarization and quiz generation:', summaryError);
            return res.status(500).json({ error: 'Failed to get summary and quiz from Groq API.', details: JSON.stringify(summaryError) });
        }

        const summaryResult = await summaryResponse.json();
        const combinedOutput = summaryResult.choices?.[0]?.message?.content;

        console.log('Combined summary and quiz output:', combinedOutput);

        // Clear the captured images for the next session (optional)
        capturedImages.length = 0;

        res.json({ message: 'Screenshots summarized and quiz generated.', combined_output: combinedOutput });

    } catch (error) {
        console.error('Error during screenshot summarization and quiz generation:', error);
        res.status(500).json({ error: 'Failed to summarize screenshots and generate quiz.', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});