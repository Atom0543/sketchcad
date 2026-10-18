# SketchCAD (working name)

2D CAD for Windows, as easy as SketchUp, with AutoCAD-style tools. Used to draw
parts for laser cutting and robot builds, so dimensions must be exact (mm).

## Users
Makers and robotics builders. Thai first, English switchable. Tablet-free; mouse + keyboard.

## Mode
Operate. The canvas is the product; chrome stays quiet. Light theme, dark switchable.

## Principles
- Type a number after any drag to set the exact size (SketchUp VCB behaviour).
- Click a shape to edit its size later.
- Snapping is automatic and visible.
- Laser extras (layers by colour, kerf, closed-path check) are opt-in toggles, never default.

## Scope, round 1
Line, rectangle, circle, select/edit, snap, units (mm/cm/m/in), undo/redo, DXF export.
Later: arcs, polygons (hexagon by flat-to-flat), fillet/chamfer, offset, text, leader,
dimensions, SVG/PNG/PDF, DWG via `acadrust` (Rust), laser options, manual nesting.
