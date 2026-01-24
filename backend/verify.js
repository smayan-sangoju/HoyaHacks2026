// Fake AI verification module
// For demo purposes this randomly verifies 80% of disposals as valid.
// In a real app you'd call a vision model (Gemini/Vertex/Replicate/OpenAI + vision)
// or a custom CV classifier, pass the image and claimed item type, and evaluate.

function fakeVerify({ itemType, imageBuffer, filename, predictedLabel }) {
  // Demo verification order:
  // 1) If client provided a predictedLabel (from MobileNet), and it includes
  //    the claimed itemType keyword, accept with high confidence.
  // 2) If filename contains itemType, accept (backward compatibility).
  // 3) Otherwise randomly accept 80% of the time.

  const lowerPred = (predictedLabel || '').toLowerCase()
  if (predictedLabel && itemType && lowerPred.includes(itemType.toLowerCase())) {
    return { verified: true, confidence: 0.95, note: 'Predicted label matched claimed item type (client-side model).' }
  }

  const lowerName = (filename || '').toLowerCase()
  const typeMatch = itemType && lowerName.includes(itemType.toLowerCase())
  if (typeMatch) {
    return { verified: true, confidence: 0.92, note: 'Filename heuristic matched claimed item type (demo).' }
  }

  const pass = Math.random() < 0.8 // 80% pass rate
  return {
    verified: pass,
    confidence: pass ? 0.8 + Math.random() * 0.2 : 0.2 + Math.random() * 0.3,
    note: 'Demo verification: randomly approves 80% of uploads. Replace with real CV/Gemini API.'
  }
}

module.exports = { fakeVerify };

/*
How to replace with real vision model (notes for judges / future work):
- Upload the image to a storage bucket.
- Send the image or URL + claimed item type to an image classifier API (Vision model,
  Gemini multimodal, or a purpose-built PyTorch/TensorFlow classifier).
- The classifier should return whether the object is recyclable/usable and whether
  it shows the item being placed in a proper bin (or you can require an additional
  short video/gif showing the disposal action).
- Use thresholds to determine verification and include model confidence in the DB.
*/
