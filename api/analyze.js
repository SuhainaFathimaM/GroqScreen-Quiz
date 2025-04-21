import { fetch } from 'node-fetch';
import multer from 'multer';
import cors from 'cors';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }).array('screenshots', 10);

    return new Promise((resolve, reject) => {
        upload(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                resolve(res.status(400).json({ error: `File upload error: ${err.message}` }));
                return;
            } else if (err) {
                resolve(res.status(500).json({ error: `Unexpected error during file upload: ${err.message}` }));
                return;
            }

            if (!req.files || req.files.length === 0) {
                resolve(res.status(400).json({ error: 'No screenshots provided for summarization.' }));
                return;
            }

            const GROQ_API_KEY = process.env.GROQ_API_KEY;
            const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
            const GROQ_MODEL_ID = 'meta-llama/llama-4-scout-17b-16e-instruct';

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
                    max_completion_tokens: 512,
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

            try {
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
                    temperature: 0.7,
                    max_completion_tokens: 1024,
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
                    resolve(res.status(500).json({ error: 'Failed to get summary and quiz from Groq API.', details: JSON.stringify(summaryError) }));
                    return;
                }

                const summaryResult = await summaryResponse.json();
                const combinedOutput = summaryResult.choices?.[0]?.message?.content;

                resolve(res.status(200).json({ message: 'Screenshots summarized and quiz generated.', combined_output: combinedOutput }));

            } catch (error) {
                console.error('Error during screenshot summarization and quiz generation:', error);
                resolve(res.status(500).json({ error: 'Failed to summarize screenshots and generate quiz.', details: error.message }));
            }
        });
    });
}

export const config = {
    api: {
        bodyParser: false,
    },
};
