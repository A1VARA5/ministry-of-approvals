import {Component, type ReactNode} from 'react'

// Renders a thrown error as text instead of a blank frame, so a broken file view is readable
// inside the Dashboard iframe where the console is out of reach.
export class ErrorBoundary extends Component<{children: ReactNode; label: string}, {error?: Error}> {
  state: {error?: Error} = {}
  static getDerivedStateFromError(error: Error) {
    return {error}
  }
  render() {
    if (this.state.error) {
      return (
        <pre style={{whiteSpace: 'pre-wrap', padding: 16, color: '#b3261e', fontSize: 12}}>
          {this.props.label} failed: {this.state.error.message}
          {'\n'}
          {this.state.error.stack?.split('\n').slice(0, 8).join('\n')}
        </pre>
      )
    }
    return this.props.children
  }
}
