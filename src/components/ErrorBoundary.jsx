import { Component } from "react";
import { track } from "../services/posthog";

const FONT = "'Outfit', system-ui, sans-serif";
const SERIF = "'Lora', Georgia, serif";

// Catches render crashes so the user sees a way out instead of a blank page.
// `compact` is for one tab inside the app (navigation stays usable); the default fills the screen.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("App crashed:", error, info?.componentStack);
    try {
      track("app_crash", { message: String(error?.message || error).slice(0, 300), where: this.props.name || "app" });
    } catch (_) {}
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    const compact = !!this.props.compact;
    return (
      <div
        role="alert"
        style={{
          minHeight: compact ? "70vh" : "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "32px 28px", textAlign: "center", background: "#FFFFFF", fontFamily: FONT, boxSizing: "border-box",
        }}
      >
        <img src="/logo.svg" alt="" width={64} height={64} style={{ borderRadius: 16, marginBottom: 20 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <p style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: "#1A1612", margin: "0 0 8px" }}>Something went wrong</p>
        <p style={{ fontSize: 14, color: "#8C857C", lineHeight: 1.5, margin: "0 0 24px", maxWidth: 300 }}>
          {compact ? "This screen ran into a problem. Your matches and messages are safe." : "Agape ran into a problem. Your matches and messages are safe."}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ width: "100%", maxWidth: 280, padding: "14px", borderRadius: 14, background: "#111111", color: "#fff", border: "none", fontFamily: FONT, fontSize: 15, fontWeight: 700, cursor: "pointer" }}
        >
          Reload Agape
        </button>
        {compact && (
          <button
            onClick={this.reset}
            style={{ marginTop: 6, padding: "12px", background: "none", border: "none", fontFamily: FONT, fontSize: 14, fontWeight: 600, color: "#8C857C", cursor: "pointer" }}
          >
            Try again
          </button>
        )}
      </div>
    );
  }
}
