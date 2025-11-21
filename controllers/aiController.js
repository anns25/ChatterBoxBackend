import createHttpError from 'http-errors'
import OpenAI from 'openai'

let openai = null

const getOpenAIClient = () => {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw createHttpError(500, 'OpenAI API key is not configured. Please set OPENAI_API_KEY in your .env file.')
    }
    openai = new OpenAI({
      apiKey: apiKey,
    })
  }
  return openai
}

// Map of rewrite options to prompts
const REWRITE_PROMPTS = {
  // Tone Adjustments
  'professional': 'Rewrite this message in a professional, business-appropriate tone while keeping the same meaning.',
  'formal': 'Rewrite this message in a formal tone while keeping the same meaning.',
  'casual': 'Rewrite this message in a casual, relaxed tone while keeping the same meaning.',
  'friendly': 'Rewrite this message in a warm and friendly tone while keeping the same meaning.',
  'assertive': 'Rewrite this message in an assertive, confident tone while keeping the same meaning.',
  'polite': 'Rewrite this message in a more polite tone while keeping the same meaning.',
  
  // Emotion-Based
  'more-empathetic': 'Rewrite this message to be more empathetic and understanding.',
  'more-enthusiastic': 'Rewrite this message to be more enthusiastic and energetic.',
  'more-calm': 'Rewrite this message to be more calm and composed.',
  'more-humorous': 'Rewrite this message to be more humorous and light-hearted.',
  'less-emotional': 'Rewrite this message to be less emotional and more neutral.',
  
  // Grammar & Writing
  'fix-grammar': 'Fix any grammar errors in this message while keeping the same meaning and tone.',
  'fix-spelling': 'Fix any spelling and punctuation errors in this message.',
  'improve-structure': 'Improve the sentence structure and readability of this message.',
  'more-concise': 'Make this message more concise while keeping all important information.',
  'more-coherent': 'Rewrite this message to be more coherent and well-organized.',
  'more-natural': 'Rewrite this message to sound more natural and conversational.',
  
  // Length-Based
  'shorter': 'Make this message shorter while keeping the key points.',
  'very-short': 'Make this message very short, like an SMS, while keeping the essential meaning.',
  'longer': 'Expand this message with more details while keeping the same meaning.',
  'summary': 'Create a concise summary version of this message.',
  'bullet-points': 'Convert this message into bullet points.',
  
  // Creative
  'more-witty': 'Rewrite this message to be more witty and clever.',
  'poetic': 'Rewrite this message in a poetic style.',
  'emoji-enhanced': 'Add appropriate emojis to enhance this message.',
  'gen-z-slang': 'Rewrite this message using Gen Z slang and modern internet language.',
}

export const rewriteMessage = async (req, res, next) => {
    try {
      const { message, rewriteType } = req.body
  
      if (!message || !message.trim()) {
        throw createHttpError(400, 'Message is required')
      }
  
      if (!rewriteType || !REWRITE_PROMPTS[rewriteType]) {
        throw createHttpError(400, 'Valid rewrite type is required')
      }
  
      // Get OpenAI client (will initialize if needed)
      const client = getOpenAIClient()
  
      const prompt = `${REWRITE_PROMPTS[rewriteType]}\n\nOriginal message: "${message}"\n\nRewritten message:`
  
      const completion = await client.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that rewrites messages according to user requests. Return only the rewritten message, nothing else.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      })
  
      const rewrittenMessage = completion.choices[0].message.content.trim()
  
      res.json({
        original: message,
        rewritten: rewrittenMessage,
        rewriteType,
      })
    } catch (err) {
      if (err.response?.status === 401) {
        next(createHttpError(500, 'AI service authentication failed. Please check API key.'))
      } else if (err.status === 500 && err.message.includes('API key')) {
        next(err)
      } else {
        next(err)
      }
    }
  }