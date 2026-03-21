"use client";
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 32, fontFamily: "'Noto Sans TC', sans-serif" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>:(</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ fontSize: 14, color: "#888", marginBottom: 24, textAlign: "center", maxWidth: 400 }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{ padding: "10px 24px", borderRadius: 20, border: "none", background: "#3b82f6", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
