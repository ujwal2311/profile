# Contributing to Live Whiteboard

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

## 🏁 Quick Start

```bash
# Fork → Clone → Branch → Code → PR
git clone https://github.com/ujwal2311/live-whiteboard.git
cd live-whiteboard
npm install
npm run dev
```

## 📋 Development Workflow

### 1. Find or Create an Issue

- Check [existing issues](https://github.com/ujwal2311/live-whiteboard/issues) first
- For new features, open a discussion issue before writing code
- Bug fixes can go straight to a PR

### 2. Branch Naming

```
feature/add-text-tool
fix/reconnection-race-condition
refactor/extract-shape-renderer
docs/update-architecture-diagram
```

### 3. Development

```bash
# Start dev server with HMR
npm run dev

# Test collaborative features:
# Open two browser tabs to http://localhost:5173
# Create a room in one, join from the other
```

### 4. Testing Checklist

Before submitting a PR, verify:

- [ ] Freehand drawing syncs between peers
- [ ] All shape tools (rect, circle, line) render correctly
- [ ] Eraser works on all content types
- [ ] Undo/redo works and syncs
- [ ] No console errors or warnings
- [ ] Mobile touch events work (test in DevTools device mode)
- [ ] Production build succeeds: `npm run build`

### 5. Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add text tool with font selection
fix: prevent ghost cursor after peer disconnect
refactor: extract shape rendering into separate module
docs: add WebRTC signaling sequence diagram
perf: batch canvas draw calls to reduce reflows
```

## 🏛️ Architecture Principles

### Separation of Concerns

Each custom hook owns exactly one domain:

| Hook | Responsibility |
|------|---------------|
| `usePeer` | PeerJS initialization, lifecycle, error recovery |
| `useRoom` | Connection management, host/guest logic, reconnection |
| `useCanvas` | Drawing engine, undo system, remote rendering |

**Rule:** Don't mix WebRTC logic into drawing code, or drawing logic into connection code.

### The Protocol Contract

All peer-to-peer messages **must** be created via factory functions in `protocol.js`:

```javascript
// ✅ Correct
sendData(drawStart(x, y, color, size, tool));

// ❌ Wrong — never send raw objects
sendData({ type: 'DRAW_START', x, y, color, size, tool });
```

This ensures type safety, consistent message shapes, and a single source of truth for the wire format.

### Canvas Rendering Rules

1. **All drawing uses Canvas 2D API** — no SVG, no DOM elements positioned on canvas
2. **Erasing uses compositing** (`destination-out`), not stroke tracking
3. **Shape previews use snapshot-restore** (ImageData), not redraw-everything
4. **Remote drawing mirrors local logic** — same rendering code, different input source

### No Backend Rule

The core application must work with **zero server-side code**. The only external dependency is PeerJS Cloud for WebRTC signaling. If you're adding a feature that requires a backend, discuss it in an issue first.

## 🎨 Code Style

- **React:** Functional components + hooks only (no class components)
- **State:** `useState` for UI state, `useRef` for mutable values that don't trigger re-renders
- **CSS:** Tailwind utility classes with brand tokens from `tailwind.config.js`
- **Formatting:** Consistent indentation (2 spaces), semicolons required

## 📦 Adding Dependencies

Before adding a new npm dependency:

1. **Check if the feature can be implemented with existing APIs** (Canvas, Web APIs, etc.)
2. **Check bundle size** using [bundlephobia.com](https://bundlephobia.com)
3. **Justify the addition** in your PR description

Our goal is to keep the total bundle under 300KB.

## 🐛 Bug Reports

When filing a bug, include:

1. **Browser + version** (e.g., Chrome 120, Firefox 121)
2. **Steps to reproduce**
3. **Expected vs. actual behavior**
4. **Console errors** (if any)
5. **Network conditions** (e.g., both on same WiFi, different networks)

For WebRTC-specific bugs, include output from `chrome://webrtc-internals/`.

## 📄 License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
