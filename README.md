# SketchCAD

[![Download the installer](https://img.shields.io/badge/Download-Installer-1e5fd6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Atom0543/sketchcad/releases/latest/download/SketchCAD-Setup.exe)
[![Download portable zip](https://img.shields.io/badge/Download-Portable%20zip-555?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Atom0543/sketchcad/releases/latest/download/SketchCAD-portable.zip)

Windows 10/11 (needs Microsoft Edge WebView2, already present on most PCs). Use the installer (per-user, no admin rights, adds a Start menu entry and an uninstaller) or the portable zip (unzip anywhere, run SketchCAD.exe). Windows may show a SmartScreen warning because the app is not code-signed: choose *More info* then *Run anyway*.

2D CAD that is as easy as SketchUp, for laser-cut and robot parts. Thai / English UI, mm / cm / m / in.

- Draw: line, rectangle, circle, arcs, polygon, pen (curves), pencil, text, leader, dimensions (incl. radius / diameter), paint bucket
- Outline text for laser: real vector letters (cut the outline or engrave solid), Thai and English fonts included, add your own .ttf / .otf
- SketchUp-style inference: intersections, line-up with earlier points, parallel / perpendicular to edges
- Edit: move, rotate, scale, flip, reflect, offset, fillet, point editing, groups, components, tags (layers)
- Files: open / import DXF, SVG, PNG; save `.sketchcad`; export DXF, SVG, PNG, PDF (page setup, several pages)
- Laser options (opt-in): layer colours, kerf, path check, material sheet
- Auto-save with recovery

## Run

    npm install
    npm run dev          # browser at http://localhost:5173

## Build the Windows app (needs Rust + MSVC build tools + WebView2)

    npx tauri build --no-bundle    # -> src-tauri/target/release/SketchCAD.exe

## Fonts

Bundled outline-text fonts are SIL Open Font License 1.1: Caveat, Sarabun, Prompt, Noto Sans Thai, Kanit (from Google Fonts). Text shaping uses HarfBuzz (harfbuzzjs, MIT).
