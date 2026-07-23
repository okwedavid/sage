#!/bin/bash
# Quick script to push v7.1 updates to GitHub

echo "🚀 Pushing SAGE v7.1 updates to GitHub..."
echo ""

# Stage all changes
git add .

# Commit with detailed message
git commit -m "feat: Add personal LLM API key settings & fix image analysis

- Settings page: Users can add personal Groq API key
- Model selection: Choose between 70B, 8B, Mixtral, Gemma models
- Settings persist in localStorage
- Image analysis: Improved upload validation & error handling
- Vision worker: Optimized model fallback chain
- Better error messages throughout

Sprint 7 preparation for production deployment"

# Push to main branch
git push origin main

echo ""
echo "✅ Push complete!"
echo ""
echo "Changes pushed:"
echo "  ✓ Personal API key configuration"
echo "  ✓ Model selection (5 models)"
echo "  ✓ Image analysis fixes"
echo "  ✓ Better error handling"
echo ""
echo "Next steps:"
echo "  1. Test the new Settings page"
echo "  2. Try uploading an image for analysis"
echo "  3. Check backend logs for any errors"
echo ""
