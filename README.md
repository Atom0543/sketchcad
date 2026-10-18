# SketchCAD

[![Download SketchCAD for Windows](https://img.shields.io/badge/Download-SketchCAD.exe-1e5fd6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Atom0543/sketchcad/releases/latest/download/SketchCAD.exe)

Windows 10/11 (needs Microsoft Edge WebView2, already present on most PCs). Single file, no installer. Windows may show a SmartScreen warning because the app is not code-signed: choose *More info* then *Run anyway*.

2D CAD that is as easy as SketchUp, for laser-cut and robot parts. Thai / English UI, mm / cm / m / in.

- Draw: line, rectangle, circle, arcs, polygon, pen (curves), pencil, text, leader, dimensions
- Edit: move, rotate, scale, flip, reflect, offset, fillet, point editing, groups, components, tags (layers)
- Files: open / import DXF, SVG, PNG; save `.sketchcad`; export DXF, SVG, PNG, PDF (page setup, several pages)
- Laser options (opt-in): layer colours, kerf, path check, material sheet
- Auto-save with recovery

## Run

    npm install
    npm run dev          # browser at http://localhost:5173

## Build the Windows app (needs Rust + MSVC build tools + WebView2)

    npx tauri build --no-bundle    # -> src-tauri/target/release/SketchCAD.exe
