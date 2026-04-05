import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('BonusBridge error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="8" cy="8" r="6.5"/>
                <line x1="8" y1="5" x2="8" y2="8.5"/>
                <circle cx="8" cy="11" r="0.5" fill="currentColor"/>
              </svg>
            </div>
            <p className="text-white font-medium mb-1">Something went wrong</p>
            <p className="text-slate-400 text-sm mb-6">Your session may have expired or there was an unexpected error.</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => window.location.href = '/login'}
                className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition"
              >
                Back to Login
              </button>
              <button
                onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
                className="w-full py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
