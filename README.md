# Radial

A high-performance, transparent radial concentric menu for app launching and navigation. Built with Electron, Vite, and SVG, it features a unique "always-on-top" design and smooth expansion animations.

![Radial Menu](screenshots/radial-menu.png)

## Key Features

- **Concentric Ring Expansion**: A multi-level radial menu that expands and collapses with smooth SVG clip-path animations.
- **Always-on-Top & Transparent**: Frameless window that stays above other applications while maintaining a clean, distraction-free aesthetic.
- **Draggable Handle**: A dedicated, opaque inner ring between the center disc and command ring for repositioning the window.
- **OS Settings Integration**: One-click access to native OS settings across Linux, Windows, and macOS.
- **Keyboard Shortcuts**: Responsive to `Escape` for navigation/closing and `Alt+F4` for quitting.
- **GPU Stable on Linux**: Specifically tuned to disable hardware acceleration to prevent crashes on Wayland and X11 environments.

## Technical Stack

- **Framework**: [Electron](https://www.electronjs.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: Vanilla CSS with [FontAwesome](https://fontawesome.com/) icons
- **Graphics**: Dynamic SVG generation with [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)

## Installation & Development

### Prerequisites

- Node.js (v18+)
- npm

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Build

```bash
# Build for production
npm run build
```

The build output will be located in `dist/` (renderer) and `dist-electron/` (main process).

## Configuration

The menu structure is defined in `src/renderer/main.ts` via the `ROOT` object. You can customize icons, labels, and commands for each ring.

### Default Controls

- **Center Gear**: Toggle the first command ring.
- **Inner Band**: Click and drag to move the window.
- **Escape**: Back one level / Collapse menu / Quit app.
- **Alt+F4**: Immediate quit.

## Linux Specifics

To ensure maximum stability on Linux (especially with transparency and frameless windows), the following flags are applied automatically:
- Hardware Acceleration is **Disabled**.
- Ozone Platform is set to **Auto**.
- Window is positioned in the **Bottom-Right** corner by default.

## License

MIT
