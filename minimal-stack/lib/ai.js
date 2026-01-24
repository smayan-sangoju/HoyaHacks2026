import fetch from 'node-fetch'

export async function callOpenRouter(frames, context = {}) {
  const API_KEY = process.env.OPENROUTER_API_KEY
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY not configured')

  // This is a conceptual example. OpenRouter's exact API for vision models
  // may differ; consult their docs. Many vision models accept base64 images
  // or multipart uploads. Below is a JSON example.

  const payload = {
    model: 'gpt-image-1',
    input: {
      context,
      frames
    }
  }

  const resp = await fetch('https://api.openrouter.ai/v1/outputs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify(payload)
  })
  if (!resp.ok) throw new Error('OpenRouter error')
  const jr = await resp.json()
  // Parse model output into {binVisible, bottleVisible, action, confidence}
  // This parsing is model-specific.
  return jr
}
