import React, { useState } from 'react'
import { useSentimentAnalysis, useCustomerSentiment } from '../hooks'
import type { SentimentAnalysisResult, CustomerSentiment, SentimentLabel } from '../types'

interface SentimentAnalysisCardProps {
  customerId?: string
  onAnalyze?: (result: SentimentAnalysisResult) => void
}

export const SentimentAnalysisCard: React.FC<SentimentAnalysisCardProps> = ({
  customerId,
  onAnalyze
}) => {
  const { analyze, result, isAnalyzing, error } = useSentimentAnalysis()
  const { sentiments, isLoading: historyLoading } = useCustomerSentiment(customerId || null)
  const [inputText, setInputText] = useState('')
  const [viewMode, setViewMode] = useState<'analyze' | 'history'>('analyze')

  const handleAnalyze = async () => {
    if (!inputText.trim()) return
    const res = await analyze(inputText)
    if (res) {
      onAnalyze?.(res)
    }
  }

  const getSentimentColor = (label: SentimentLabel) => {
    switch (label) {
      case 'positive': return 'text-green-500'
      case 'negative': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getSentimentBg = (label: SentimentLabel) => {
    switch (label) {
      case 'positive': return 'bg-green-100 text-green-700'
      case 'negative': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getEmotionColor = (emotion: string) => {
    const colors: Record<string, string> = {
      joy: 'bg-yellow-400',
      trust: 'bg-green-400',
      fear: 'bg-purple-400',
      surprise: 'bg-pink-400',
      sadness: 'bg-blue-400',
      disgust: 'bg-orange-400',
      anger: 'bg-red-400',
      anticipation: 'bg-cyan-400'
    }
    return colors[emotion] || 'bg-gray-400'
  }

  const formatScore = (score: number) => {
    if (score > 0) return `+${score.toFixed(2)}`
    return score.toFixed(2)
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold">Sentiment Analysis</h3>
            <p className="text-gray-500 text-sm mt-1">AI-powered sentiment detection</p>
          </div>
          {customerId && (
            <div className="flex gap-2 p-1 bg-gray-100 rounded-full">
              <button
                onClick={() => setViewMode('analyze')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  viewMode === 'analyze' ? 'bg-black text-white' : 'text-gray-500'
                }`}
              >
                Analyze
              </button>
              <button
                onClick={() => setViewMode('history')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  viewMode === 'history' ? 'bg-black text-white' : 'text-gray-500'
                }`}
              >
                History
              </button>
            </div>
          )}
        </div>
      </div>

      {viewMode === 'analyze' ? (
        <div className="p-6 space-y-6">
          {/* Input */}
          <div>
            <label className="block text-xs font-bold mb-2 text-gray-500">Text to Analyze</label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste meeting transcript, email, or message to analyze..."
              className="w-full p-4 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none resize-none h-32 font-mono"
            />
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !inputText.trim()}
            className="w-full py-3 bg-[#2563EB] text-white hover:bg-[#008f5b] rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Analyzing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.3-4.3"></path>
                </svg>
                Analyze Sentiment
              </>
            )}
          </button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-6 pt-6 border-t">
              {/* Score */}
              <div className="flex items-center gap-6">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-bold ${
                  result.label === 'positive' ? 'bg-green-500' :
                  result.label === 'negative' ? 'bg-red-500' :
                  'bg-gray-500'
                }`}>
                  {formatScore(result.score)}
                </div>
                <div>
                  <div className={`text-2xl font-bold ${getSentimentColor(result.label)}`}>
                    {result.label.toUpperCase()}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Confidence: {Math.round(result.confidence * 100)}%
                  </div>
                </div>
              </div>

              {/* Summary */}
              {result.summary && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <span className="font-mono text-xs uppercase text-gray-400 block mb-2">Analysis Summary</span>
                  <p className="text-gray-700">{result.summary}</p>
                </div>
              )}

              {/* Key Phrases */}
              {result.keyPhrases.length > 0 && (
                <div>
                  <span className="font-mono text-xs uppercase text-gray-400 block mb-2">Key Phrases</span>
                  <div className="flex flex-wrap gap-2">
                    {result.keyPhrases.map((phrase, i) => (
                      <span key={i} className={`px-3 py-1 rounded-full text-sm ${getSentimentBg(result.label)}`}>
                        {phrase}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Emotions */}
              <div>
                <span className="font-mono text-xs uppercase text-gray-400 block mb-3">Emotion Breakdown</span>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(result.emotions)
                    .sort((a, b) => b[1] - a[1])
                    .map(([emotion, value]) => (
                      <div key={emotion} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getEmotionColor(emotion)}`}></div>
                        <span className="text-sm text-gray-600 capitalize flex-1">{emotion}</span>
                        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getEmotionColor(emotion)} transition-all`}
                            style={{ width: `${value * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right">
                          {Math.round(value * 100)}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* History View */
        <div className="p-6">
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
            </div>
          ) : sentiments.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No sentiment history for this customer</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sentiments.map((sentiment) => (
                <SentimentHistoryItem key={sentiment.id} sentiment={sentiment} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Sentiment History Item
interface SentimentHistoryItemProps {
  sentiment: CustomerSentiment
}

const SentimentHistoryItem: React.FC<SentimentHistoryItemProps> = ({ sentiment }) => {
  const [expanded, setExpanded] = useState(false)

  const getSentimentBg = (label: SentimentLabel) => {
    switch (label) {
      case 'positive': return 'bg-green-100 text-green-700 border-green-200'
      case 'negative': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'meeting':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        )
      case 'pulse_message':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        )
      case 'email':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
        )
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        )
    }
  }

  return (
    <div
      className={`p-4 rounded-xl border cursor-pointer transition-all ${getSentimentBg(sentiment.sentimentLabel)}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
            sentiment.sentimentLabel === 'positive' ? 'bg-green-500 text-white' :
            sentiment.sentimentLabel === 'negative' ? 'bg-red-500 text-white' :
            'bg-gray-500 text-white'
          }`}>
            {sentiment.sentimentScore > 0 ? '+' : ''}{sentiment.sentimentScore.toFixed(1)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium capitalize">{sentiment.sentimentLabel}</span>
              <span className="text-xs opacity-60">
                {Math.round(sentiment.confidence * 100)}% confidence
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs opacity-70 mt-1">
              {getSourceIcon(sentiment.sourceType)}
              <span className="capitalize">{sentiment.sourceType.replace('_', ' ')}</span>
              <span>•</span>
              <span>{new Date(sentiment.analyzedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {expanded && sentiment.keyPhrases.length > 0 && (
        <div className="mt-3 pt-3 border-t border-current/20">
          <span className="text-xs font-medium opacity-60 block mb-2">Key Phrases</span>
          <div className="flex flex-wrap gap-1">
            {sentiment.keyPhrases.map((phrase, i) => (
              <span key={i} className="px-2 py-0.5 bg-white/50 rounded text-xs">
                {phrase}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SentimentAnalysisCard
