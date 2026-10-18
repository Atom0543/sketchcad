# SketchCAD

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
