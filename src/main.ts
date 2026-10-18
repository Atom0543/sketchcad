import './style.css'
import {
  type Pt, type Shape, type Rect, type Poly, type Txt, type Guide,
  images, defs, tags, env, dist, mid, deg, segDist, nearestOnSeg, rectEdges, polyVerts, polyEdges, straightEdges,
  shapeDist, translate, bounds, tagOf, isVisible, isLocked, flat, expandInst,
  arcAt, arcFrom3, arcFromBulge, inArc, sweepOf, normA, TAU, rotateShape, scaleShape,
  type BNode, type Bz, bzEdges, nearestOnBz, insertNode, toggleSmooth, toBz, fitFree, cubicAt, bzSegs, flipShape, reflectShape, trimErase, splitShape,
} from './geom'
import { drawShape, setImageLoadHandler, type View, FONT } from './render'
import { toDxf, toSvg, parseDxf, parseSvg, toProject, parseProject, type Project } from './io'
import { initPage, type Unit } from './pdf'
import { initTray, type Panel } from './tray'
import { kvGet, kvSet } from './autosave'
import { type Laser, type Check, defaultLaser, kerfApply, checkPaths, sheetStats, laserColor } from './laser'

type Tool = 'select' | 'eraser' | 'line' | 'rect' | 'circle' | 'poly' | 'offset' | 'fillet' | 'move' | 'tape' | 'protractor' | 'dim' | 'text' | 'leader' | 'place' | 'arc' | 'arc2' | 'arc3' | 'rotate' | 'scale' | 'pen' | 'penline' | 'pencil' | 'node' | 'reflect'
type ToolBtn = Exclude<Tool, 'place'>

// ---------- i18n ----------
const T = {
  en: {
    undo: 'Undo', redo: 'Redo', unit: 'Unit', theme: 'Theme', fc: 'From centre',
    mFile: 'File', mEdit: 'Edit', mView: 'View',
    new: 'New', open: 'Open…', importf: 'Import…', save: 'Save project', exDxf: 'Export DXF', exSvg: 'Export SVG', exPng: 'Export PNG…', exPdf: 'Page setup / PDF…',
    del: 'Delete', clearGuides: 'Clear guides', zoomExt: 'Zoom to fit',
    select: 'Select', eraser: 'Eraser', line: 'Line', rect: 'Rectangle', circle: 'Circle', poly: 'Polygon',
    offset: 'Offset', fillet: 'Round corners', move: 'Move', tape: 'Tape measure', protractor: 'Protractor',
    dim: 'Dimension', text: 'Text', leader: 'Leader',
    arc: 'Arc (centre, start, end)', arc2: '2 Point Arc', arc3: '3 Point Arc', rotate: 'Rotate', scale: 'Scale',
    pageN: 'Page', addPage: 'Add page', delPage: 'Delete page', unitsT: 'Which page each piece goes on', scaleWord: 'Scale', showScale: 'Show scale on the page', scaleCorner: 'Scale label corner',
    cBL: 'Bottom left', cBR: 'Bottom right', cTL: 'Top left', cTR: 'Top right', emptyPage: 'This page is empty. Move a piece here from the list.', looseT: 'Everything else (ungrouped)',
    unitsHint: 'Pieces can only be split across pages when they are grouped or made into components.', copy: 'Copy', paste: 'Paste', dupl: 'Duplicate',
    laserT: 'Laser options', laserOn: 'Enable laser options', laserColors: 'Colour by tag in SVG / PDF / PNG', setCut: 'Set as Cut', setEngrave: 'Set as Engrave', setScore: 'Set as Score',
    kerfOn: 'Compensate kerf on export', kerfMm: 'Kerf width (mm)', kerfTagL: 'Applies to tag', checkBtn: 'Check paths', checkOk: 'No open ends or doubled lines.',
    checkRes: 'open ends', checkDup: 'doubled shapes', sheetT: 'Material sheet', sheetW: 'Width (mm)', sheetH: 'Height (mm)', addSheet: 'Add sheet',
    sheetUtil: 'Material used', sheetOut: 'parts outside the sheet', sheetNone: 'Add a sheet, then drag your parts onto it.',
    more: 'More tools', radius: 'Radius', startAng: 'Start angle (°)', endAng: 'End angle (°)',
    h_arc0: 'Click the centre', h_arc1: 'Click the start point (sets the radius)', h_arc2: 'Move round to the end, or type the sweep angle (°) + Enter. Shift = clockwise.',
    h_arc20: 'Click the first end point', h_arc21: 'Click the second end point', h_arc22: 'Pull out the bulge, or type its height + Enter.',
    h_arc30: 'Click the start point', h_arc31: 'Click a point the arc passes through', h_arc32: 'Click the end point.',
    h_rotate0: 'Click the centre of rotation (select shapes first, or click one)', h_rotate1: 'Click a reference direction', h_rotate2: 'Click the new direction, or type the angle (°) + Enter.',
    h_scale0: 'Click the base point (select shapes first, or click one)', h_scale1: 'Click a reference point', h_scale2: 'Click the new point, or type the factor (e.g. 2) + Enter.',
    l_arc: 'Sweep', l_arc2: 'Rise', l_arc3: 'Radius', l_rotate: 'Angle', l_scale: 'Factor',
    splitX: 'Split at crossings', splitNone: 'Nothing crosses the selected shapes.',
    reflect: 'Reflect (mirror line)', l_reflect: 'Angle',
    h_reflect0: 'Select shapes first. The mirror line follows the mouse (Tab = vertical / horizontal). Click to fix where it goes.',
    h_reflect1: 'Turn the line to the angle you want, then click. The arrow shows the side the reflection appears on. Ctrl = move instead of copy.',
    reflectSide: 'Reflection appears here',
    autosaved: 'Auto-saved', recoverT: 'Recover unsaved work?', recover: 'Recover', discard: 'Discard', editingGroup: 'Editing group (click empty space or Esc to leave)',
    flipH: 'Flip left-right', flipV: 'Flip top-bottom', mirrorH: 'Mirror copy left-right', mirrorV: 'Mirror copy top-bottom', flipHint: 'Hold Ctrl to leave the original and make a mirrored copy.',
    editPts: 'Edit points', penline: 'Pen (straight lines)', pencil: 'Pencil (freehand)',
    h_penline0: 'Click to add corner points. Click the first point to close; Enter, double-click or right-click to finish.', h_penline1: 'Click to add corner points. Click the first point to close; Enter, double-click or right-click to finish.',
    h_pencil0: 'Press and drag to draw freely. Let go and the stroke is smoothed into an editable curve.', l_penline: '', l_pencil: '',
    pen: 'Pen (curves)', node: 'Edit points', toPath: 'Convert to editable path', fillL: 'Fill', noFill: 'No fill', nodesL: 'Points',
    h_pen0: 'Click = corner point · click and drag = curve point. Click the first point to close; Enter, double-click or right-click to finish; Backspace undoes a point.',
    h_pen1: 'Click = corner point · click and drag = curve point. Click the first point to close; Enter, double-click or right-click to finish; Backspace undoes a point.',
    h_node0: 'Click a shape to edit its points. Click the line to add a point there (it snaps to the middle) · drag the point or its handles (small circles) to turn and bend · double-click a point: corner ↔ smooth · Alt+drag the line bends it · Delete removes a point.',
    h_node1: 'Drag the point or its handles. Alt breaks the handles apart. Delete removes the point. Double-click: corner ↔ smooth.', l_pen: '', l_node: '',
    gridSnap: 'Snap to grid', axisH: 'Horizontal', axisV: 'Vertical',
    mWindow: 'Window', selAll: 'Select all', group: 'Group', ungroup: 'Ungroup', makeComp: 'Make component', explode: 'Explode',
    selectFirst: 'Select something first.', component: 'Component', insert: 'Insert', editComp: 'Edit', done: 'Done',
    tagsT: 'Tags (layers)', compsT: 'Components', entityT: 'Entity info', addTag: 'Add tag', tagL: 'Tag', nSel: 'objects selected',
    posx: 'X', posy: 'Y', close: 'Close', activeTag: 'Draw on this tag', visible: 'Show / hide', locked: 'Lock', editing: 'Editing component',
    noComps: 'No components yet. Select shapes and press “Make component”.', h_place0: 'Click to place the component. Esc stops.',
    length: 'Length', angle: 'Angle (°)', width: 'Width', height: 'Height', diameter: 'Diameter',
    corner: 'Corner radius', size: 'Text size', offsetf: 'Offset', sides: 'Sides', flat: 'Flat-to-flat', content: 'Text',
    opacity: 'Opacity (%)', vertices: 'Points', closedL: 'Closed', openL: 'Open', guideL: 'Guide line (not exported)', imageL: 'Trace image (not exported)',
    empty: 'Click a shape to edit its size, or press L, R, C to draw.', props: 'Properties',
    h_select0: 'Click a shape. Delete removes it.',
    h_eraser0: 'Click or drag over shapes to erase them.',
    h_line0: 'Click the start point (Ctrl = from midpoint)',
    h_line1: 'Click the end, or type a length + Enter. Tab switches to angle. Shift locks the axis. Esc ends.',
    h_rect0: 'Click the first corner (Ctrl = from centre)',
    h_rect1: 'Click the opposite corner, or type width,height + Enter.',
    h_circle0: 'Click the centre', h_circle1: 'Click to set radius, or type it + Enter.',
    h_poly0: 'Click the centre. Type sides + s (e.g. 8s) + Enter to change the number of sides.',
    h_poly1: 'Move to set the size (edge to edge), or type the width + Enter.',
    h_offset0: 'Click a shape to offset its edge',
    h_offset1: 'Pull in or out, or type a distance + Enter. Click to accept.',
    h_fillet0: 'Click a rectangle to round its corners',
    h_fillet1: 'Move to set the radius, or type it + Enter. Click to accept.',
    h_move0: 'Click a base point (select shapes first, or click one)',
    h_move1: 'Click the destination, or type a distance + Enter. Shift locks the axis. Ctrl = copy.',
    h_tape0: 'Click an edge to pull a parallel guide, or click two points to measure',
    h_tape1: 'Click the second point to read the distance',
    h_tape2: 'Pull the guide to a distance, or type it + Enter. Click to place.',
    h_protractor0: 'Click the angle vertex', h_protractor1: 'Click a point on the first arm', h_protractor2: 'Click the second arm to read the angle',
    h_dim0: 'Click the first point', h_dim1: 'Click the second point', h_dim2: 'Click to place the dimension line.',
    h_text0: 'Click where the text goes', h_leader0: 'Click the point to label', h_leader1: 'Click where the text goes',
    l_line: 'Length', l_rect: 'Dimensions', l_circle: 'Radius', l_poly: 'Flat width', l_offset: 'Distance', l_fillet: 'Radius',
    l_move: 'Distance', l_tape: 'Distance', l_protractor: 'Angle', l_dim: 'Length', l_text: '', l_leader: '', l_select: '', l_eraser: '',
    endpoint: 'Endpoint', midpoint: 'Midpoint', center: 'Centre', quadrant: 'Quadrant', onedge: 'On edge', onguide: 'On guide',
    pageSetup: 'Page setup', paper: 'Paper', orient: 'Orientation', landscape: 'Landscape', portrait: 'Portrait', pscale: 'Scale',
    fit: 'Fit to page', custom: 'Custom 1 : N', margin: 'Margin (mm)', lineW: 'Line weight (mm)', centerPage: 'Centre on page',
    cancel: 'Cancel', print: 'Print…', dlPdf: 'Download PDF', drawing: 'Drawing', tooBig: 'Drawing is larger than the page at this scale.',
    pdfThai: 'Thai text may not appear in the downloaded PDF. Use Print… and choose “Save as PDF” to keep it.',
    resolution: 'Resolution (dpi)', whiteBg: 'White background', exportBtn: 'Export',
    nothing: 'Nothing to export yet.', imported: 'Imported', shapesW: 'objects', skipped: 'Skipped (not supported yet)',
    dwgNote: 'DWG needs the desktop version (coming). Save as DXF from your CAD program for now.',
    badFile: 'Could not read this file', unsupported: 'Unsupported file type', saved: 'Saved',
  },
  th: {
    undo: 'ย้อนกลับ', redo: 'ทำซ้ำ', unit: 'หน่วย', theme: 'ธีม', fc: 'จากจุดกึ่งกลาง',
    mFile: 'ไฟล์', mEdit: 'แก้ไข', mView: 'มุมมอง',
    new: 'ใหม่', open: 'เปิด…', importf: 'นำเข้า…', save: 'บันทึกโปรเจกต์', exDxf: 'ส่งออก DXF', exSvg: 'ส่งออก SVG', exPng: 'ส่งออก PNG…', exPdf: 'ตั้งค่าหน้ากระดาษ / PDF…',
    del: 'ลบ', clearGuides: 'ล้างเส้นไกด์', zoomExt: 'ซูมพอดีงาน',
    select: 'เลือก', eraser: 'ยางลบ', line: 'เส้น', rect: 'สี่เหลี่ยม', circle: 'วงกลม', poly: 'หลายเหลี่ยม',
    offset: 'ออฟเซ็ต (ขยับขอบ)', fillet: 'ทำมุมโค้งมน', move: 'ย้าย', tape: 'ตลับเมตร', protractor: 'ไม้โปรแทรกเตอร์ (วัดมุม)',
    dim: 'ใส่ขนาด', text: 'ข้อความ', leader: 'เส้นชี้ (Leader)',
    arc: 'อาร์ก (จุดศูนย์กลาง, จุดเริ่ม, จุดจบ)', arc2: 'อาร์ก 2 จุด', arc3: 'อาร์ก 3 จุด', rotate: 'หมุน', scale: 'ย่อ/ขยาย',
    pageN: 'หน้า', addPage: 'เพิ่มหน้า', delPage: 'ลบหน้า', unitsT: 'แต่ละชิ้นอยู่หน้าไหน', scaleWord: 'สเกล', showScale: 'แสดงสเกลบนหน้ากระดาษ', scaleCorner: 'มุมที่แสดงสเกล',
    cBL: 'ล่างซ้าย', cBR: 'ล่างขวา', cTL: 'บนซ้าย', cTR: 'บนขวา', emptyPage: 'หน้านี้ว่าง ย้ายชิ้นงานมาจากรายการด้านซ้าย', looseT: 'ชิ้นอื่นๆ (ที่ไม่ได้จัดกลุ่ม)',
    unitsHint: 'แยกชิ้นไปคนละหน้าได้เมื่อจัดกลุ่มหรือสร้างเป็นคอมโพเนนต์แล้วเท่านั้น', copy: 'คัดลอก', paste: 'วาง', dupl: 'ทำซ้ำ (Duplicate)',
    laserT: 'ตัวเลือกงานเลเซอร์', laserOn: 'เปิดตัวเลือกงานเลเซอร์', laserColors: 'แยกสีตาม Tag ใน SVG / PDF / PNG', setCut: 'ตั้งเป็นตัด (Cut)', setEngrave: 'ตั้งเป็นแกะสลัก (Engrave)', setScore: 'ตั้งเป็นรอยขีด (Score)',
    kerfOn: 'ชดเชย kerf ตอนส่งออก', kerfMm: 'ความกว้างรอยตัด kerf (มม.)', kerfTagL: 'ใช้กับ Tag', checkBtn: 'ตรวจเส้น', checkOk: 'ไม่พบเส้นเปิดหรือเส้นซ้อน',
    checkRes: 'ปลายเส้นเปิด', checkDup: 'รูปซ้อนกัน', sheetT: 'แผ่นวัสดุ', sheetW: 'กว้าง (มม.)', sheetH: 'สูง (มม.)', addSheet: 'เพิ่มแผ่น',
    sheetUtil: 'ใช้วัสดุ', sheetOut: 'ชิ้นอยู่นอกแผ่น', sheetNone: 'เพิ่มแผ่นวัสดุ แล้วลากชิ้นงานไปวาง',
    more: 'เครื่องมือเพิ่มเติม', radius: 'รัศมี', startAng: 'มุมเริ่ม (°)', endAng: 'มุมจบ (°)',
    h_arc0: 'คลิกจุดศูนย์กลาง', h_arc1: 'คลิกจุดเริ่มต้น (กำหนดรัศมี)', h_arc2: 'เลื่อนเมาส์ไปจุดจบ หรือพิมพ์มุม (°) + Enter · Shift = ตามเข็ม',
    h_arc20: 'คลิกปลายแรก', h_arc21: 'คลิกปลายที่สอง', h_arc22: 'ดึงความโค้ง หรือพิมพ์ความสูงโค้ง + Enter',
    h_arc30: 'คลิกจุดเริ่มต้น', h_arc31: 'คลิกจุดที่อาร์กผ่าน', h_arc32: 'คลิกจุดสิ้นสุด',
    h_rotate0: 'คลิกจุดศูนย์กลางการหมุน (เลือกรูปก่อน หรือคลิกที่รูปเลย)', h_rotate1: 'คลิกทิศทางอ้างอิง', h_rotate2: 'คลิกทิศทางใหม่ หรือพิมพ์มุม (°) + Enter',
    h_scale0: 'คลิกจุดฐาน (เลือกรูปก่อน หรือคลิกที่รูปเลย)', h_scale1: 'คลิกจุดอ้างอิง', h_scale2: 'คลิกจุดใหม่ หรือพิมพ์อัตราส่วน (เช่น 2) + Enter',
    l_arc: 'มุมกวาด', l_arc2: 'ความสูงโค้ง', l_arc3: 'รัศมี', l_rotate: 'มุม', l_scale: 'อัตราส่วน',
    splitX: 'แยกเส้นที่ตัดกัน', splitNone: 'ไม่มีรูปไหนตัดกับรูปที่เลือก',
    reflect: 'สะท้อน (เส้นกระจก)', l_reflect: 'มุม',
    h_reflect0: 'เลือกชิ้นงานก่อน เส้นกระจกจะตามเมาส์ (Tab = สลับตั้ง/นอน) คลิกเพื่อกำหนดตำแหน่งเส้น',
    h_reflect1: 'หมุนเส้นไปมุมที่ต้องการแล้วคลิก ลูกศรบอกฝั่งที่ภาพสะท้อนจะออก · Ctrl = ย้ายแทนการคัดลอก',
    reflectSide: 'ภาพสะท้อนออกทางนี้',
    autosaved: 'บันทึกอัตโนมัติ', recoverT: 'กู้คืนงานที่ยังไม่ได้บันทึก?', recover: 'กู้คืน', discard: 'ทิ้ง', editingGroup: 'กำลังแก้ไขกลุ่ม (คลิกที่ว่างหรือกด Esc เพื่อออก)',
    flipH: 'พลิกซ้าย-ขวา', flipV: 'พลิกบน-ล่าง', mirrorH: 'คัดลอกแบบกระจก ซ้าย-ขวา', mirrorV: 'คัดลอกแบบกระจก บน-ล่าง', flipHint: 'กด Ctrl ค้างเพื่อเก็บต้นฉบับไว้และทำสำเนาแบบกระจก',
    editPts: 'แก้ไขจุด (ดัดเส้น)', penline: 'ปากกา (เส้นตรง)', pencil: 'ดินสอ (วาดอิสระ)',
    h_penline0: 'คลิกเพื่อวางจุดมุม · คลิกจุดแรกเพื่อปิดรูป · Enter / ดับเบิลคลิก / คลิกขวา = จบ', h_penline1: 'คลิกเพื่อวางจุดมุม · คลิกจุดแรกเพื่อปิดรูป · Enter / ดับเบิลคลิก / คลิกขวา = จบ',
    h_pencil0: 'กดแล้วลากเพื่อวาดอิสระ ปล่อยเมาส์แล้วเส้นจะถูกทำให้เรียบเป็นเส้นโค้งที่แก้ไขได้', l_penline: '', l_pencil: '',
    pen: 'ปากกา (เส้นโค้ง)', node: 'แก้ไขจุด', toPath: 'แปลงเป็นเส้นที่แก้ไขได้', fillL: 'สีพื้น', noFill: 'ไม่มีสีพื้น', nodesL: 'จำนวนจุด',
    h_pen0: 'คลิก = จุดมุม · คลิกแล้วลาก = จุดโค้ง · คลิกจุดแรกเพื่อปิดรูป · Enter / ดับเบิลคลิก / คลิกขวา = จบ · Backspace = ลบจุดล่าสุด',
    h_pen1: 'คลิก = จุดมุม · คลิกแล้วลาก = จุดโค้ง · คลิกจุดแรกเพื่อปิดรูป · Enter / ดับเบิลคลิก / คลิกขวา = จบ · Backspace = ลบจุดล่าสุด',
    h_node0: 'คลิกรูปเพื่อแก้จุด คลิกบนเส้นเพื่อเพิ่มจุดตรงนั้น (ใกล้กึ่งกลางจะเกาะกึ่งกลางพอดี) · ลากจุดหรือก้านจับ (วงกลมเล็ก) เพื่อหมุนและดัดโค้ง · ดับเบิลคลิกจุด: มุม ↔ โค้ง · Alt+ลากที่เส้น = ดัดตรงๆ · Delete ลบจุด',
    h_node1: 'ลากจุดหรือก้านจับ · กด Alt ค้างเพื่อแยกก้านสองข้าง · Delete ลบจุด · ดับเบิลคลิก: มุม ↔ โค้ง', l_pen: '', l_node: '',
    gridSnap: 'ยึดตาราง', axisH: 'แนวนอน', axisV: 'แนวตั้ง',
    mWindow: 'หน้าต่าง', selAll: 'เลือกทั้งหมด', group: 'จัดกลุ่ม', ungroup: 'แยกกลุ่ม', makeComp: 'สร้างคอมโพเนนต์', explode: 'ระเบิด (แตกออก)',
    selectFirst: 'เลือกรูปก่อน', component: 'คอมโพเนนต์', insert: 'วาง', editComp: 'แก้ไข', done: 'เสร็จ',
    tagsT: 'เลเยอร์ (Tags)', compsT: 'คอมโพเนนต์', entityT: 'ข้อมูลรูป', addTag: 'เพิ่ม Tag', tagL: 'Tag', nSel: 'ชิ้นที่เลือก',
    posx: 'X', posy: 'Y', close: 'ปิด', activeTag: 'วาดลงใน Tag นี้', visible: 'แสดง / ซ่อน', locked: 'ล็อก', editing: 'กำลังแก้คอมโพเนนต์',
    noComps: 'ยังไม่มีคอมโพเนนต์ เลือกรูปแล้วกด “สร้างคอมโพเนนต์”', h_place0: 'คลิกเพื่อวางคอมโพเนนต์ · Esc หยุด',
    length: 'ความยาว', angle: 'มุม (°)', width: 'กว้าง', height: 'สูง', diameter: 'เส้นผ่านศูนย์กลาง',
    corner: 'รัศมีมุมโค้ง', size: 'ขนาดตัวอักษร', offsetf: 'ระยะเส้นขนาด', sides: 'จำนวนด้าน', flat: 'กว้างขอบถึงขอบ', content: 'ข้อความ',
    opacity: 'ความทึบ (%)', vertices: 'จำนวนจุด', closedL: 'ปิด', openL: 'เปิด', guideL: 'เส้นไกด์ (ไม่ถูกส่งออก)', imageL: 'ภาพลอกลาย (ไม่ถูกส่งออก)',
    empty: 'คลิกรูปเพื่อแก้ขนาด หรือกด L, R, C เพื่อวาด', props: 'คุณสมบัติ',
    h_select0: 'คลิกที่รูป กด Delete เพื่อลบ',
    h_eraser0: 'คลิกหรือลากผ่านรูปเพื่อลบ',
    h_line0: 'คลิกจุดเริ่มต้น (Ctrl = เริ่มจากกึ่งกลาง)',
    h_line1: 'คลิกจุดปลาย หรือพิมพ์ความยาว + Enter · Tab สลับไปใส่มุม · Shift ล็อกแกน · Esc จบ',
    h_rect0: 'คลิกมุมแรก (Ctrl = วาดจากจุดกึ่งกลาง)',
    h_rect1: 'คลิกมุมตรงข้าม หรือพิมพ์ กว้าง,สูง + Enter',
    h_circle0: 'คลิกจุดศูนย์กลาง', h_circle1: 'คลิกกำหนดรัศมี หรือพิมพ์รัศมี + Enter',
    h_poly0: 'คลิกจุดศูนย์กลาง · พิมพ์จำนวนด้าน + s (เช่น 8s) + Enter เพื่อเปลี่ยนจำนวนด้าน',
    h_poly1: 'เลื่อนเมาส์กำหนดขนาด (วัดขอบถึงขอบ) หรือพิมพ์ความกว้าง + Enter',
    h_offset0: 'คลิกที่รูปเพื่อขยับขอบเข้า/ออก',
    h_offset1: 'ดึงเข้าหรือออก หรือพิมพ์ระยะ + Enter · คลิกเพื่อยืนยัน',
    h_fillet0: 'คลิกที่สี่เหลี่ยมเพื่อทำมุมโค้ง',
    h_fillet1: 'เลื่อนเมาส์กำหนดรัศมี หรือพิมพ์ค่า + Enter · คลิกเพื่อยืนยัน',
    h_move0: 'คลิกจุดฐาน (เลือกรูปก่อน หรือคลิกที่รูปเลย)',
    h_move1: 'คลิกจุดปลายทาง หรือพิมพ์ระยะ + Enter · Shift ล็อกแกน · Ctrl = คัดลอก',
    h_tape0: 'คลิกที่ขอบเพื่อดึงเส้นไกด์ขนาน หรือคลิก 2 จุดเพื่อวัดระยะ',
    h_tape1: 'คลิกจุดที่สองเพื่ออ่านระยะ',
    h_tape2: 'ดึงเส้นไกด์ไปที่ระยะที่ต้องการ หรือพิมพ์ค่า + Enter · คลิกเพื่อวาง',
    h_protractor0: 'คลิกจุดยอดมุม', h_protractor1: 'คลิกจุดบนแขนแรก', h_protractor2: 'คลิกแขนที่สองเพื่ออ่านมุม',
    h_dim0: 'คลิกจุดแรก', h_dim1: 'คลิกจุดที่สอง', h_dim2: 'คลิกเพื่อวางเส้นขนาด',
    h_text0: 'คลิกตำแหน่งที่จะวางข้อความ', h_leader0: 'คลิกจุดที่จะชี้', h_leader1: 'คลิกตำแหน่งที่จะวางข้อความ',
    l_line: 'ความยาว', l_rect: 'ขนาด', l_circle: 'รัศมี', l_poly: 'กว้างขอบถึงขอบ', l_offset: 'ระยะ', l_fillet: 'รัศมี',
    l_move: 'ระยะ', l_tape: 'ระยะ', l_protractor: 'มุม', l_dim: 'ความยาว', l_text: '', l_leader: '', l_select: '', l_eraser: '',
    endpoint: 'จุดปลาย', midpoint: 'จุดกึ่งกลาง', center: 'จุดศูนย์กลาง', quadrant: 'จุดสี่ทิศ', onedge: 'บนขอบ', onguide: 'บนเส้นไกด์',
    pageSetup: 'ตั้งค่าหน้ากระดาษ', paper: 'กระดาษ', orient: 'แนวกระดาษ', landscape: 'แนวนอน', portrait: 'แนวตั้ง', pscale: 'สเกล',
    fit: 'พอดีหน้า', custom: 'กำหนดเอง 1 : N', margin: 'ขอบกระดาษ (มม.)', lineW: 'ความหนาเส้น (มม.)', centerPage: 'จัดกึ่งกลางหน้า',
    cancel: 'ยกเลิก', print: 'พิมพ์…', dlPdf: 'ดาวน์โหลด PDF', drawing: 'ขนาดงาน', tooBig: 'งานใหญ่กว่ากระดาษที่สเกลนี้',
    pdfThai: 'ข้อความภาษาไทยอาจไม่แสดงใน PDF ที่ดาวน์โหลด ให้ใช้ “พิมพ์…” แล้วเลือก “บันทึกเป็น PDF” แทน',
    resolution: 'ความละเอียด (dpi)', whiteBg: 'พื้นหลังสีขาว', exportBtn: 'ส่งออก',
    nothing: 'ยังไม่มีงานให้ส่งออก', imported: 'นำเข้าแล้ว', shapesW: 'ชิ้น', skipped: 'ข้าม (ยังไม่รองรับ)',
    dwgNote: 'DWG ต้องใช้เวอร์ชันโปรแกรม (กำลังทำ) ตอนนี้ให้บันทึกเป็น DXF จากโปรแกรม CAD เดิมก่อน',
    badFile: 'อ่านไฟล์นี้ไม่ได้', unsupported: 'ไม่รองรับไฟล์ชนิดนี้', saved: 'บันทึกแล้ว',
  },
}
type Key = keyof typeof T.en
let lang: 'th' | 'en' = 'th'
const tr = (k: Key) => T[lang][k]
const trs = (k: string) => (T[lang] as Record<string, string>)[k] ?? k

// ---------- state ----------
const UNIT: Record<string, number> = { mm: 1, cm: 10, m: 1000, in: 25.4 }
const DWELL = 500 // ms hover before centre/midpoint appears when idle (instant while drawing)
let unit = 'mm'
let shapes: Shape[] = []
let sel = -1 // primary selected index (drives the properties panel)
let selSet = new Set<number>()
let activeTag = '0'
let placeDef = ''
let apts: Pt[] = [] // clicked points for arcs, rotate, scale and reflect
let mirrorVert = true // reflect: orientation of the mirror line before it is placed
let lastRise = 0
let laser: Laser = defaultLaser()
let check: Check | null = null // result of the last path check (drawn as rings)
let marquee: { a: Pt; b: Pt; add: boolean } | null = null
let editCtx: { id: string; saved: Shape[]; undo: string[]; redo: string[] } | null = null
let hover = -1
let tool: Tool = 'line'
let start: Pt | null = null
let dimB: Pt | null = null
let filletIdx = -1
let moveSet: number[] = []
let offsetIdx = -1
let offsetMag = 0
let tapeEdge: [Pt, Pt] | null = null
let tapeHover: [Pt, Pt] | null = null
let prot: Pt[] = []
let protRes: Pt[] | null = null
let tapeRes: [Pt, Pt] | null = null
let sides = 6
let cur: Pt = { x: 0, y: 0 }
let typed = ''
let typedAng = ''
let angMode = false
let shift = false
let ctrl = false
let fromCenter = false
let penNodes: BNode[] = [] // path being drawn with the pen
let penDrag = false
let openGroup = 0 // group id whose members are being edited one by one (0 = none)
let free: Pt[] | null = null // pencil stroke in progress
const isPen = () => tool === 'pen' || tool === 'penline'
let nodeSel = -1 // selected anchor while editing points
let segDrag: { seg: number; t: number; base: BNode[] } | null = null // dragging a curve segment to bend it
let nodeDrag: { kind: 'p' | 'hi' | 'ho'; i: number } | null = null
let gridSnap = false // off by default: lines follow your direction, not the grid
let axisHit: { ref: Pt; axis: 'h' | 'v' } | null = null
type SnapKey = 'endpoint' | 'midpoint' | 'center' | 'quadrant' | 'onedge' | 'onguide'
let snapHit: { p: Pt; l: SnapKey } | null = null
let reveal = -1, dwellIdx = -1, dwellTimer = 0
let pending: { p: Pt; tip?: Pt } | null = null
const view: View = { ox: 0, oy: 0, s: 2 }
const undoStack: string[] = []
const redoStack: string[] = []

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const cv = $<HTMLCanvasElement>('cv')
const ctx = cv.getContext('2d')!
let props: HTMLElement = document.createElement('div') // body of the Entity info panel
const tb = $<HTMLInputElement>('tb')

env.textW = (s: Txt) => { ctx.save(); ctx.font = `${s.size * 10}px ${FONT}`; const w = ctx.measureText(s.s).width / 10; ctx.restore(); return w }
setImageLoadHandler(() => draw())

// ---------- helpers ----------
const fmt = (mm: number) => String(+(mm / UNIT[unit]).toFixed(3))
const toMM = (v: number) => v * UNIT[unit]
const sx = (x: number) => view.ox + x * view.s
const sy = (y: number) => view.oy - y * view.s
const wx = (px: number) => (px - view.ox) / view.s
const wy = (py: number) => (view.oy - py) / view.s
const effCenter = () => fromCenter !== ctrl
const busy = () => start !== null || penNodes.length > 0 || apts.length > 0 || prot.length > 0 || offsetIdx >= 0 || filletIdx >= 0
function setSel(ix: number[]) {
  const set = new Set<number>()
  for (const i of ix) {
    const s = shapes[i]
    if (!s) continue
    set.add(i)
    if (s.g && s.g !== openGroup) shapes.forEach((q, j) => { if (q.g === s.g) set.add(j) }) // a group selects as one
  }
  selSet = set; sel = ix.length ? ix[ix.length - 1] : -1
}
const tagged = <T extends Shape>(s: T): T => (activeTag === '0' || s.t === 'guide' ? s : { ...s, tag: activeTag })
const uid = () => Math.random().toString(36).slice(2, 10)

type SP = { p: Pt; l: SnapKey }
function basePoints(): SP[] {
  const out: SP[] = []
  for (const s of flat(shapes)) {
    if (s.t === 'bz') { if (!(nodeDrag && s === shapes[sel])) s.nodes.forEach((n) => out.push({ p: n.p, l: 'endpoint' })); continue }
    if (s.t === 'line' || s.t === 'dim') out.push({ p: s.a, l: 'endpoint' }, { p: s.b, l: 'endpoint' })
    else if (s.t === 'circle') out.push({ p: s.c, l: 'center' })
    else if (s.t === 'arc') out.push({ p: arcAt(s, 0), l: 'endpoint' }, { p: arcAt(s, 1), l: 'endpoint' }, { p: s.c, l: 'center' })
    else if (s.t === 'poly') { out.push({ p: s.c, l: 'center' }); polyVerts(s).forEach((p) => out.push({ p, l: 'endpoint' })) }
    else if (s.t === 'pl') s.pts.forEach((p) => out.push({ p, l: 'endpoint' }))
    else if (s.t === 'text') { out.push({ p: s.p, l: 'endpoint' }); if (s.tip) out.push({ p: s.tip, l: 'endpoint' }) }
    else if (s.t === 'rect') {
      if (s.r > 0) {
        const { x, y, w, h, r } = s
        for (const p of [{ x: x + r, y }, { x: x + w - r, y }, { x: x + w, y: y + r }, { x: x + w, y: y + h - r }, { x: x + w - r, y: y + h }, { x: x + r, y: y + h }, { x, y: y + h - r }, { x, y: y + r }])
          out.push({ p, l: 'endpoint' })
      } else for (const [a] of rectEdges(s)) out.push({ p: a, l: 'endpoint' })
    }
  }
  return out
}
function revealPoints(i: number): SP[] {
  const s = shapes[i]
  if (!s) return []
  if (s.t === 'line') return [{ p: mid(s.a, s.b), l: 'midpoint' }]
  if (s.t === 'arc') return [{ p: arcAt(s, 0.5), l: 'midpoint' }]
  if (s.t === 'circle') return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => ({ p: { x: s.c.x + a * s.r, y: s.c.y + b * s.r }, l: 'quadrant' as SnapKey }))
  if (s.t === 'rect') return [{ p: { x: s.x + s.w / 2, y: s.y + s.h / 2 }, l: 'center' }, ...rectEdges(s).map(([a, b]) => ({ p: mid(a, b), l: 'midpoint' as SnapKey }))]
  if (s.t === 'poly') return polyEdges(s).map(([a, b]) => ({ p: mid(a, b), l: 'midpoint' as SnapKey }))
  if (s.t === 'pl') return straightEdges(s).map(([a, b]) => ({ p: mid(a, b), l: 'midpoint' as SnapKey }))
  return []
}
function gridStep() {
  const raw = 20 / view.s
  const k = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 5, 10].map((m) => m * k).find((v) => v >= raw)!
}
/** Closest point lying ON any edge, circle or guide (so a line can start "on" a circle). */
function edgeSnap(p: Pt): SP | null {
  const tol = 10 / view.s
  let best: SP | null = null, bd = tol
  shapes.forEach((s, i) => {
    if (moveSet.includes(i) || !isVisible(s) || (nodeDrag && i === sel)) return
    const c: Pt[] = []
    if (s.t === 'bz') for (const [a, b] of bzEdges(s)) c.push(nearestOnSeg(p, a, b))
    if (s.t === 'circle') { const d = dist(p, s.c) || 1; c.push({ x: s.c.x + ((p.x - s.c.x) / d) * s.r, y: s.c.y + ((p.y - s.c.y) / d) * s.r }) }
    else if (s.t === 'arc') { const a = Math.atan2(p.y - s.c.y, p.x - s.c.x); if (inArc(s, a)) c.push({ x: s.c.x + s.r * Math.cos(a), y: s.c.y + s.r * Math.sin(a) }) }
    else if (s.t === 'guide') { const t = (p.x - s.p.x) * s.d.x + (p.y - s.p.y) * s.d.y; c.push({ x: s.p.x + s.d.x * t, y: s.p.y + s.d.y * t }) }
    else for (const [a, b] of straightEdges(s)) c.push(nearestOnSeg(p, a, b))
    for (const q of c) { const d = dist(p, q); if (d < bd) { bd = d; best = { p: q, l: s.t === 'guide' ? 'onguide' : 'onedge' } } }
  })
  return best
}
function snap(p: Pt): Pt {
  const tol = 10 / view.s
  let best: SP | null = null, bd = tol
  for (const q of [...basePoints(), ...revealPoints(reveal)]) {
    const d = dist(p, q.p)
    if (d < bd) { bd = d; best = q }
  }
  best = best ?? edgeSnap(p)
  snapHit = best
  if (best) return best.p
  if (!gridSnap) return p
  const g = gridStep()
  return { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g }
}
/** Point the current drag started from, if horizontal/vertical locking makes sense for this tool. */
function axisRef(): Pt | null {
  if (tool === 'reflect') return apts[0] ?? null
  if (isPen()) return penNodes.length ? penNodes[penNodes.length - 1].p : null
  if (tool === 'line' || tool === 'move' || tool === 'leader') return start
  if (tool === 'dim') return dimB ? null : start
  if (tool === 'tape') return tapeEdge ? null : start
  return null
}
// revealed points stay while the cursor is inside the shape (or 30px around it)
function inZone(s: Shape | undefined, p: Pt) {
  if (!s) return false
  const tol = 30 / view.s
  if (s.t === 'circle' || s.t === 'arc') return dist(p, s.c) <= s.r + tol
  if (s.t === 'poly') return dist(p, s.c) <= s.ap / Math.cos(Math.PI / s.n) + tol
  if (s.t === 'rect') return p.x >= s.x - tol && p.x <= s.x + s.w + tol && p.y >= s.y - tol && p.y <= s.y + s.h + tol
  return shapeDist(s, p) <= tol
}
const noDwell = (s: Shape) => s.t === 'inst' || s.t === 'dim' || s.t === 'text' || s.t === 'guide' || s.t === 'image'
function updateDwell(raw: Pt) {
  if (reveal >= 0 && !inZone(shapes[reveal], raw)) reveal = -1
  let idx = -1, bd = 14 / view.s
  shapes.forEach((s, i) => {
    if (noDwell(s) || !isVisible(s) || moveSet.includes(i)) return
    const d = shapeDist(s, raw)
    if (d < bd) { bd = d; idx = i }
  })
  if (idx >= 0 && busy() && idx !== reveal) { clearTimeout(dwellTimer); dwellIdx = idx; reveal = idx; return } // mid-operation: show at once
  if (idx === dwellIdx) return
  dwellIdx = idx
  clearTimeout(dwellTimer)
  if (idx >= 0 && idx !== reveal) dwellTimer = window.setTimeout(() => { reveal = idx; draw() }, DWELL)
}
function pick(p: Pt, only?: Shape['t']) {
  let best = -1, bd = 7 / view.s
  shapes.forEach((s, i) => { if ((only && s.t !== only) || !isVisible(s) || isLocked(s) || (openGroup && s.g !== openGroup)) return; const d = shapeDist(s, p); if (d < bd) { bd = d; best = i } })
  return best
}
function edgeAt(p: Pt): [Pt, Pt] | null {
  let best: [Pt, Pt] | null = null, bd = 8 / view.s
  for (const s of shapes) if (isVisible(s)) for (const [a, b] of straightEdges(s)) { const d = segDist(p, a, b); if (d < bd) { bd = d; best = [a, b] } }
  return best
}
function contains(s: Shape, p: Pt) {
  if (s.t === 'rect') return p.x > s.x && p.x < s.x + s.w && p.y > s.y && p.y < s.y + s.h
  if (s.t === 'circle' || s.t === 'arc') return dist(p, s.c) < s.r
  if (s.t === 'poly') return Array.from({ length: s.n }, (_, k) => s.rot + Math.PI / s.n + (2 * Math.PI * k) / s.n)
    .every((a) => (p.x - s.c.x) * Math.cos(a) + (p.y - s.c.y) * Math.sin(a) <= s.ap)
  return false
}

// ---------- history ----------
const snapshot = () => JSON.stringify(shapes)
function commitEdit(fn: () => void) {
  check = null
  undoStack.push(snapshot()); redoStack.length = 0
  fn()
  refresh()
}
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); shapes = JSON.parse(undoStack.pop()!); setSel([]); reveal = -1; cancel(); refresh() }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); shapes = JSON.parse(redoStack.pop()!); setSel([]); reveal = -1; cancel(); refresh() }
function cancel() {
  start = null; dimB = null; filletIdx = -1; moveSet = []; offsetIdx = -1; marquee = null; apts = []; penNodes = []; penDrag = false; free = null; nodeDrag = null; segDrag = null; nodeSel = -1; tapeEdge = null; tapeHover = null
  prot = []; protRes = null; tapeRes = null; check = null; typed = ''; typedAng = ''; angMode = false; hideTextBox()
}

// ---------- previews ----------
function lockAxis(a: Pt, p: Pt): Pt {
  if (!shift) return p
  return Math.abs(p.x - a.x) > Math.abs(p.y - a.y) ? { x: p.x, y: a.y } : { x: a.x, y: p.y }
}
const nums = () => (typed && !typed.endsWith('s') ? typed.split(',').map((v) => toMM(parseFloat(v))) : [])
function moveVec(): { dx: number; dy: number } {
  if (!start) return { dx: 0, dy: 0 }
  const e = lockAxis(start, cur)
  let dx = e.x - start.x, dy = e.y - start.y
  const n = nums()
  if (n.length && isFinite(n[0])) { const L = Math.hypot(dx, dy) || 1; dx = (dx / L) * n[0]; dy = (dy / L) * n[0] }
  return { dx, dy }
}
let fcorner: Pt = { x: 0, y: 0 }
function offsetSigned(s: Shape, k: number): Shape | null {
  // k > 0 pulls the edge inward, k < 0 pushes it outward
  if (s.t === 'rect') {
    const w = s.w - 2 * k, h = s.h - 2 * k
    return w > 1e-6 && h > 1e-6 ? { ...s, x: s.x + k, y: s.y + k, w, h, r: s.r > 0 ? Math.max(0, s.r - k) : 0 } : null
  }
  if (s.t === 'circle' || s.t === 'arc') return s.r - k > 1e-6 ? { ...s, r: s.r - k } : null
  if (s.t === 'poly') return s.ap - k > 1e-6 ? { ...s, ap: s.ap - k } : null
  return null
}
function previewShape(): Shape | null {
  const n = nums()
  const has = n.length > 0 && isFinite(n[0])
  if (tool === 'move' || tool === 'rotate' || tool === 'scale') return null // see movePreview() / xfPreview()
  if (tool === 'arc' || tool === 'arc2' || tool === 'arc3') return arcPreview()
  if (tool === 'place') return placeDef ? { t: 'inst', def: placeDef, x: cur.x, y: cur.y } : null
  if (tool === 'fillet') {
    const s = shapes[filletIdx]
    if (!s || s.t !== 'rect') return null
    const lim = Math.min(s.w, s.h) / 2
    let r = has ? n[0] : Math.min(Math.max(Math.abs(cur.x - fcorner.x), Math.abs(cur.y - fcorner.y)), lim)
    r = Math.max(0, Math.min(r, lim))
    return { ...s, r }
  }
  if (tool === 'offset') {
    const s = shapes[offsetIdx]
    if (!s) return null
    if (s.t === 'line') {
      const L = dist(s.a, s.b) || 1
      const nx = -(s.b.y - s.a.y) / L, ny = (s.b.x - s.a.x) / L
      const signed = (cur.x - s.a.x) * nx + (cur.y - s.a.y) * ny
      const d = has ? (signed < 0 ? -1 : 1) * n[0] : signed
      offsetMag = Math.abs(d)
      return translate(s, nx * d, ny * d)
    }
    const mag = has ? n[0] : shapeDist(s, cur)
    offsetMag = mag
    return offsetSigned(s, contains(s, cur) ? mag : -mag)
  }
  if (tool === 'tape') {
    if (!start) return null
    if (!tapeEdge) return { t: 'line', a: start, b: lockAxis(start, cur) }
    const [a, b] = tapeEdge, L = dist(a, b) || 1
    const u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L }, nrm = { x: -u.y, y: u.x }
    const signed = (cur.x - start.x) * nrm.x + (cur.y - start.y) * nrm.y
    const d = has ? (signed < 0 ? -1 : 1) * n[0] : signed
    offsetMag = Math.abs(d)
    return { t: 'guide', p: { x: start.x + nrm.x * d, y: start.y + nrm.y * d }, d: u } as Guide
  }
  if (tool === 'dim') {
    if (!start) return null
    if (!dimB) return { t: 'line', a: start, b: cur }
    const dx = dimB.x - start.x, dy = dimB.y - start.y, L = Math.hypot(dx, dy) || 1
    const off = ((cur.x - start.x) * -dy + (cur.y - start.y) * dx) / L
    return { t: 'dim', a: start, b: dimB, off, size: 5 }
  }
  if (tool === 'leader') return start ? { t: 'line', a: start, b: cur } : null
  if (!start) return null
  const c = effCenter()
  if (tool === 'line') {
    let end = lockAxis(start, cur)
    const hasA = typedAng !== '' && isFinite(parseFloat(typedAng))
    if (has || hasA) {
      const ang = hasA ? (parseFloat(typedAng) * Math.PI) / 180 : Math.atan2(end.y - start.y, end.x - start.x)
      const len = (has ? n[0] : dist(start, end)) * (c ? 0.5 : 1)
      end = { x: start.x + len * Math.cos(ang), y: start.y + len * Math.sin(ang) }
    }
    return c ? { t: 'line', a: { x: 2 * start.x - end.x, y: 2 * start.y - end.y }, b: end } : { t: 'line', a: start, b: end }
  }
  if (tool === 'rect') {
    let dx = cur.x - start.x, dy = cur.y - start.y
    if (has) {
      const k = c ? 0.5 : 1
      dx = (dx < 0 ? -1 : 1) * n[0] * k
      dy = (dy < 0 ? -1 : 1) * (n.length > 1 && isFinite(n[1]) ? n[1] : n[0]) * k
    }
    if (c) return { t: 'rect', x: start.x - Math.abs(dx), y: start.y - Math.abs(dy), w: 2 * Math.abs(dx), h: 2 * Math.abs(dy), r: 0 }
    return { t: 'rect', x: Math.min(start.x, start.x + dx), y: Math.min(start.y, start.y + dy), w: Math.abs(dx), h: Math.abs(dy), r: 0 }
  }
  if (tool === 'circle') return { t: 'circle', c: start, r: has ? n[0] : dist(start, cur) }
  if (tool === 'poly') {
    const ang = Math.atan2(cur.y - start.y, cur.x - start.x)
    return { t: 'poly', c: start, n: sides, ap: has ? n[0] / 2 : dist(start, cur), rot: ang - Math.PI / sides } as Poly
  }
  return null
}
function arcPreview(): Shape | null {
  const P = apts, E = P[2] ?? cur
  if (!P.length) return null
  if (P.length === 1) return { t: 'line', a: P[0], b: cur }
  const raw = parseFloat(typed), has = typed !== '' && isFinite(raw)
  if (tool === 'arc') {
    const c = P[0], r = dist(c, P[1])
    if (r < 1e-9) return null
    const a0 = Math.atan2(P[1].y - c.y, P[1].x - c.x)
    let sw = has ? (raw * Math.PI) / 180 : normA(Math.atan2(E.y - c.y, E.x - c.x) - a0)
    if (!has && shift) sw -= TAU
    if (!sw) return null
    return { t: 'arc', c, r, a0: sw >= 0 ? a0 : a0 + sw, a1: sw >= 0 ? a0 + sw : a0 }
  }
  if (tool === 'arc2') {
    const [A, B] = P, L = dist(A, B) || 1
    let h = ((E.x - A.x) * -(B.y - A.y) + (E.y - A.y) * (B.x - A.x)) / L
    if (has) h = (h < 0 ? -1 : 1) * toMM(raw)
    lastRise = Math.abs(h)
    return arcFromBulge(A, B, h)
  }
  return arcFrom3(P[0], P[1], E)
}
/** Direction (radians) of the mirror line: fixed orientation before it is placed, then the pivot -> cursor direction (or a typed angle). */
function mirrorAngle(): number {
  if (!apts.length) return mirrorVert ? Math.PI / 2 : 0
  const raw = parseFloat(typed)
  if (typed !== '' && isFinite(raw)) return (raw * Math.PI) / 180
  return Math.atan2(cur.y - apts[0].y, cur.x - apts[0].x)
}
const mirrorPivot = () => apts[0] ?? cur
function reflectPreview(): Shape[] {
  const ix = apts.length ? moveSet : [...selSet]
  return ix.map((i) => reflectShape(shapes[i], mirrorPivot(), mirrorAngle()))
}
function xfParams(): { a: number; k: number } | null {
  if (apts.length < 2) return null
  const [c, r] = apts, e = apts[2] ?? cur, raw = parseFloat(typed), has = typed !== '' && isFinite(raw)
  if (tool === 'rotate') return { a: has ? (raw * Math.PI) / 180 : Math.atan2(e.y - c.y, e.x - c.x) - Math.atan2(r.y - c.y, r.x - c.x), k: 1 }
  const k = has ? raw : dist(c, e) / (dist(c, r) || 1)
  return k > 0 ? { a: 0, k } : null
}
function xfPreview(): Shape[] {
  const m = xfParams()
  if (!m) return []
  return moveSet.map((i) => (tool === 'rotate' ? rotateShape(shapes[i], apts[0], m.a) : scaleShape(shapes[i], apts[0], m.k)))
}
function movePreview(): Shape[] {
  if (!start) return []
  const { dx, dy } = moveVec()
  return moveSet.map((i) => translate(shapes[i], dx, dy))
}
function isEmpty(s: Shape) {
  return s.t === 'line' ? dist(s.a, s.b) < 1e-6 : s.t === 'rect' ? s.w < 1e-6 || s.h < 1e-6
    : s.t === 'circle' ? s.r < 1e-6 : s.t === 'poly' ? s.ap < 1e-6 : false
}
function commit() {
  if (tool === 'reflect') {
    const P = apts[0], a = mirrorAngle(), ix = moveSet
    if (!P || !ix.length) return
    const out = ix.map((i) => reflectShape(shapes[i], P, a))
    if (ctrl) commitEdit(() => ix.forEach((i, k) => (shapes[i] = out[k]))) // Ctrl = move (flip in place)
    else {
      const add = cloneGroups(out)
      commitEdit(() => shapes.push(...add))
      setSel(add.map((_, k) => shapes.length - add.length + k))
    }
    apts = []; moveSet = []; typed = ''; return
  }
  if (tool === 'rotate' || tool === 'scale') {
    const m = xfParams()
    if (!m) return
    const C = apts[0], ix = moveSet, rotating = tool === 'rotate'
    commitEdit(() => ix.forEach((i) => (shapes[i] = rotating ? rotateShape(shapes[i], C, m.a) : scaleShape(shapes[i], C, m.k))))
    apts = []; moveSet = []; typed = ''; return
  }
  if (tool === 'arc' || tool === 'arc2' || tool === 'arc3') {
    const a = arcPreview()
    if (!a || a.t !== 'arc') return
    commitEdit(() => shapes.push(tagged(a)))
    setSel([shapes.length - 1]); apts = []; typed = ''; return
  }
  if (tool === 'move') {
    const { dx, dy } = moveVec(), ix = moveSet
    if (ctrl) { // Ctrl = leave the original and drop a copy
      const add = cloneGroups(ix.map((i) => translate(shapes[i], dx, dy)))
      commitEdit(() => shapes.push(...add))
      setSel(add.map((_, k) => shapes.length - add.length + k))
    } else commitEdit(() => ix.forEach((i) => (shapes[i] = translate(shapes[i], dx, dy))))
    start = null; moveSet = []; typed = ''; return
  }
  const pv = previewShape()
  if (!pv) return
  if (tool === 'place') { commitEdit(() => shapes.push(tagged(pv))); return }
  if (tool === 'fillet') { commitEdit(() => (shapes[filletIdx] = pv)); filletIdx = -1; typed = ''; return }
  if (tool === 'offset') { commitEdit(() => shapes.push(tagged(pv))); offsetIdx = -1; typed = ''; return }
  if (tool === 'tape') { commitEdit(() => shapes.push(pv)); start = null; tapeEdge = null; typed = ''; return }
  if (tool === 'dim') { if (dimB && pv.t === 'dim') { commitEdit(() => shapes.push(tagged(pv))); start = dimB = null } return }
  if (isEmpty(pv)) return
  commitEdit(() => shapes.push(tagged(pv)))
  setSel([shapes.length - 1])
  start = pv.t === 'line' && !effCenter() ? pv.b : null // plain lines chain
  typed = ''; typedAng = ''; angMode = false
}

// ---------- text box ----------
function showTextBox(p: Pt, tip?: Pt) {
  pending = { p, tip }
  tb.hidden = false; tb.value = ''
  tb.style.left = `${sx(p.x)}px`; tb.style.top = `${sy(p.y) - 30}px`
  tb.focus()
}
function hideTextBox() { pending = null; if (!tb.hidden) tb.hidden = true }
tb.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && pending && tb.value.trim()) {
    const { p, tip } = pending, s = tb.value
    hideTextBox()
    commitEdit(() => shapes.push(tagged({ t: 'text', p, s, size: 6, tip })))
    setSel([shapes.length - 1]); refresh()
  } else if (e.key === 'Escape') hideTextBox()
})
tb.addEventListener('blur', hideTextBox)

// ---------- drawing ----------
const col: Record<string, string> = {}
function readColors() {
  const cs = getComputedStyle(document.documentElement)
  for (const k of ['paper', 'panel', 'line', 'ink', 'ink-2', 'accent', 'grid', 'grid-major', 'shape', 'warn', 'snap-pt', 'snap-mid', 'snap-edge', 'guide']) col[k] = cs.getPropertyValue('--' + k).trim()
}
const label = (mm: number) => fmt(mm)
/** What leaves the app: components expanded, hidden layers and sheet frames dropped, kerf applied if the user turned it on. */
const outShapes = (): Shape[] => {
  const l = flat(shapes).filter((s) => !(s.t === 'rect' && s.sheet))
  return laser.on ? kerfApply(l, laser) : l
}
/** Pieces that can go on separate pages: each group, each component copy, and everything else together. */
function outUnits(): Unit[] {
  const parts: Unit[] = [{ id: 'loose', name: tr('looseT'), shapes: [] }]
  const groups = new Map<number, Unit>()
  for (const s of shapes) {
    if (!isVisible(s) || s.t === 'guide' || s.t === 'image' || (s.t === 'rect' && s.sheet)) continue
    if (s.t === 'inst') parts.push({ id: `i:${s.def}:${s.x.toFixed(2)},${s.y.toFixed(2)}`, name: defs[s.def]?.name ?? tr('component'), shapes: expandInst(s) })
    else if (s.g) {
      const u = groups.get(s.g) ?? { id: `g:${s.g}`, name: `${tr('group')} ${s.g}`, shapes: [] }
      u.shapes.push(s); groups.set(s.g, u)
    } else parts[0].shapes.push(s)
  }
  parts.push(...groups.values())
  const all = parts.flatMap((u) => u.shapes), done = laser.on ? kerfApply(all, laser) : all
  let k = 0
  return parts.map((u) => ({ ...u, shapes: done.slice(k, (k += u.shapes.length)) })).filter((u) => u.shapes.length || parts.length === 1)
}
const outColor = () => (laser.on && laser.colors ? laserColor : null)
const ACI = ['', '#e53935', '#f9a825', '#43a047', '#00acc1', '#1e88e5', '#d81b60', ''] // layer colours (AutoCAD index 1-6); 0 and 7 follow the theme
function stroke(s: Shape, color: string, w: number, dash: number[] = []) { drawShape(ctx, s, view, { color, w, dash, label }) }
function marker(p: Pt, l: SnapKey) {
  const x = sx(p.x), y = sy(p.y)
  const c = l === 'endpoint' || l === 'quadrant' ? col['snap-pt'] : l === 'midpoint' || l === 'center' ? col['snap-mid'] : col['snap-edge']
  ctx.fillStyle = c; ctx.strokeStyle = col.paper; ctx.lineWidth = 1.5
  ctx.beginPath()
  if (l === 'endpoint') ctx.rect(x - 5, y - 5, 10, 10) // square
  else if (l === 'midpoint') { ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x - 6, y + 5); ctx.closePath() } // triangle
  else if (l === 'quadrant') { ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 6, y); ctx.closePath() } // diamond
  else ctx.arc(x, y, l === 'center' ? 6 : 4.5, 0, Math.PI * 2) // circle
  ctx.fill(); ctx.stroke()
  if (l === 'center') { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fillStyle = col.paper; ctx.fill() } // ring
}
function tag(text: string, x: number, y: number) {
  ctx.font = `12px ${FONT}`
  const w = ctx.measureText(text).width + 12
  ctx.fillStyle = col.panel; ctx.strokeStyle = col.line; ctx.lineWidth = 1
  ctx.beginPath(); ctx.roundRect(x, y - 16, w, 22, 5); ctx.fill(); ctx.stroke()
  ctx.fillStyle = col.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, x + 6, y)
}
function protAngle(v: Pt, b: Pt, e: Pt) {
  let d = Math.abs(Math.atan2(e.y - v.y, e.x - v.x) - Math.atan2(b.y - v.y, b.x - v.x))
  if (d > Math.PI) d = 2 * Math.PI - d
  return deg(d)
}
function drawProtractor(pts: Pt[], live: boolean) {
  const [v, b, e] = pts
  ctx.strokeStyle = col.accent; ctx.lineWidth = 1.5; ctx.setLineDash(live ? [6, 4] : [])
  ctx.beginPath(); ctx.moveTo(sx(v.x), sy(v.y)); ctx.lineTo(sx(b.x), sy(b.y))
  if (e) { ctx.moveTo(sx(v.x), sy(v.y)); ctx.lineTo(sx(e.x), sy(e.y)) }
  ctx.stroke(); ctx.setLineDash([])
  if (!e) return
  const a1 = Math.atan2(b.y - v.y, b.x - v.x), a2 = Math.atan2(e.y - v.y, e.x - v.x)
  let d = a2 - a1
  while (d > Math.PI) d -= 2 * Math.PI
  while (d <= -Math.PI) d += 2 * Math.PI
  ctx.beginPath(); ctx.arc(sx(v.x), sy(v.y), 32, -a1, -a2, d > 0); ctx.stroke()
  const am = a1 + d / 2
  tag(`${+protAngle(v, b, e).toFixed(2)}°`, sx(v.x) + 40 * Math.cos(am), sy(v.y) - 40 * Math.sin(am))
}
function anchorBox(p: Pt, on: boolean) {
  const x = sx(p.x), y = sy(p.y)
  ctx.fillStyle = on ? col.accent : col.paper; ctx.strokeStyle = col.accent; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.rect(x - 4, y - 4, 8, 8); ctx.fill(); ctx.stroke()
}
function handleDot(from: Pt, off: Pt) {
  const to = { x: from.x + off.x, y: from.y + off.y }
  ctx.strokeStyle = col['ink-2']; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(sx(from.x), sy(from.y)); ctx.lineTo(sx(to.x), sy(to.y)); ctx.stroke()
  ctx.fillStyle = col.paper; ctx.strokeStyle = col.accent; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(sx(to.x), sy(to.y), 3.5, 0, TAU); ctx.fill(); ctx.stroke()
}
function drawNodeOverlay() {
  const s = shapes[sel]
  if (!s || s.t !== 'bz') return
  s.nodes.forEach((n) => { if (n.hi) handleDot(n.p, n.hi); if (n.ho) handleDot(n.p, n.ho) })
  s.nodes.forEach((n, i) => anchorBox(n.p, i === nodeSel))
  if (!segDrag && !nodeDrag) for (const c of bzSegs(s)) { // faint dots on each segment's middle: click the line to add a point
    const m = cubicAt(c, 0.5)
    ctx.strokeStyle = col['ink-2']; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx(m.x), sy(m.y), 3, 0, TAU); ctx.stroke()
  }
}
function drawPenPreview() {
  stroke({ t: 'bz', nodes: penNodes, closed: false }, col.accent, 1.5)
  const last = penNodes[penNodes.length - 1]
  stroke({ t: 'bz', nodes: [last, { p: cur }], closed: false }, col.accent, 1, [5, 4]) // rubber band to the cursor
  if (last.hi) handleDot(last.p, last.hi)
  if (last.ho) handleDot(last.p, last.ho)
  penNodes.forEach((n, i) => anchorBox(n.p, i === 0 && penNodes.length > 1 && Math.hypot(sx(n.p.x) - sx(cur.x), sy(n.p.y) - sy(cur.y)) < 9))
}
function drawReflect() {
  const P = mirrorPivot(), a = mirrorAngle(), d = { x: Math.cos(a), y: Math.sin(a) }, L = 1e5
  reflectPreview().forEach((s) => stroke(s, col.accent, 1.5, [6, 4]))
  ctx.save(); ctx.strokeStyle = col['snap-edge']; ctx.lineWidth = 1.5; ctx.setLineDash([10, 5])
  ctx.beginPath(); ctx.moveTo(sx(P.x - d.x * L), sy(P.y - d.y * L)); ctx.lineTo(sx(P.x + d.x * L), sy(P.y + d.y * L)); ctx.stroke(); ctx.setLineDash([])
  const b = bounds((apts.length ? moveSet : [...selSet]).map((i) => shapes[i]), [])
  if (b) { // arrow towards the side the copy lands on (the side opposite the originals)
    const C = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }
    const n = { x: -d.y, y: d.x }, side = n.x * (C.x - P.x) + n.y * (C.y - P.y) > 0 ? -1 : 1
    const ax = sx(P.x), ay = sy(P.y), vx = n.x * side, vy = -n.y * side // screen y is flipped
    const ex = ax + vx * 54, ey = ay + vy * 54
    ctx.fillStyle = col['snap-edge']; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(ex + vx * 8, ey + vy * 8); ctx.lineTo(ex - vy * 6, ey + vx * 6); ctx.lineTo(ex + vy * 6, ey - vx * 6); ctx.closePath(); ctx.fill()
    tag(tr('reflectSide'), ex + vx * 14 + 6, ey + vy * 14 + 4)
  }
  ctx.restore()
}
function draw() {
  readColors()
  const dpr = devicePixelRatio
  const W = cv.clientWidth, H = cv.clientHeight
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr) }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = col.paper; ctx.fillRect(0, 0, W, H)
  const g = gridStep()
  ctx.lineWidth = 1
  for (let i = Math.floor(wx(0) / g); i <= Math.ceil(wx(W) / g); i++) {
    ctx.strokeStyle = i % 5 === 0 ? col['grid-major'] : col.grid
    const x = Math.round(sx(i * g)) + 0.5
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
  for (let j = Math.floor(wy(H) / g); j <= Math.ceil(wy(0) / g); j++) {
    ctx.strokeStyle = j % 5 === 0 ? col['grid-major'] : col.grid
    const y = Math.round(sy(j * g)) + 0.5
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
  const drawing = ['line', 'rect', 'circle', 'poly', 'tape', 'protractor', 'dim', 'text', 'leader'].includes(tool)
  const paint = (s: Shape, i: number) => {
    const isHover = i === hover && !drawing
    if (!isVisible(s)) return
    const faded = openGroup && s.g !== openGroup // while a group is open, everything else steps back
    if (faded) ctx.globalAlpha = 0.3
    paintOne(s, i, isHover)
    ctx.globalAlpha = 1
  }
  const paintOne = (s: Shape, i: number, isHover: boolean) => {
    if (moveSet.includes(i) && (start || apts.length)) return stroke(s, col['ink-2'], 1, [3, 4]) // ghost of original
    const on = selSet.has(i) || isHover
    const color = s.t === 'guide' ? col.guide : isHover && tool === 'eraser' ? col.warn : on ? col.accent : s.t === 'image' ? col['ink-2'] : (ACI[tagOf(s).color] || col.shape)
    stroke(s, color, on ? 2.25 : s.t === 'guide' ? 1 : 1.5)
  }
  shapes.forEach((s, i) => s.t === 'image' && paint(s, i)) // underlay first
  shapes.forEach((s, i) => s.t !== 'image' && paint(s, i))
  // centre marks on circles and polygons so you can see what a line is attached to
  ctx.strokeStyle = col['snap-mid']; ctx.lineWidth = 1
  for (const s of shapes) if (isVisible(s) && (s.t === 'circle' || s.t === 'poly' || s.t === 'arc')) {
    const x = sx(s.c.x), y = sy(s.c.y)
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke()
  }
  if (isPen() && penNodes.length) drawPenPreview()
  if (free && free.length > 1) stroke({ t: 'pl', pts: free, closed: false }, col.accent, 1.5)
  if (tool === 'node') drawNodeOverlay()
  if (tool === 'move') movePreview().forEach((s) => stroke(s, col.accent, 1.5))
  if (tool === 'reflect' && (selSet.size || moveSet.length)) drawReflect()
  if (tool === 'rotate' || tool === 'scale') {
    xfPreview().forEach((s) => stroke(s, col.accent, 1.5))
    apts.forEach((q, i) => { if (i) stroke({ t: 'line', a: apts[0], b: q }, col['ink-2'], 1, [3, 4]) })
    if (apts.length === 2) stroke({ t: 'line', a: apts[0], b: cur }, col.accent, 1, [3, 4])
  }
  const pv = previewShape()
  if (pv) stroke(pv, pv.t === 'guide' ? col.guide : col.accent, 1.5, tool === 'move' || tool === 'fillet' ? [] : [6, 4])
  if (tool === 'tape' && !start && tapeHover) stroke({ t: 'line', a: tapeHover[0], b: tapeHover[1] }, col.accent, 2.5)
  if (tapeRes) {
    stroke({ t: 'line', a: tapeRes[0], b: tapeRes[1] }, col.accent, 1.5, [2, 4])
    const m = mid(tapeRes[0], tapeRes[1])
    tag(`${fmt(dist(tapeRes[0], tapeRes[1]))} ${unit}`, sx(m.x) + 8, sy(m.y) - 8)
  }
  if (protRes) drawProtractor(protRes, false)
  else if (prot.length) drawProtractor(prot.length === 1 ? [prot[0], cur] : [prot[0], prot[1], cur], true)
  if (check) {
    ctx.lineWidth = 2
    for (const q of check.open) { ctx.strokeStyle = col.warn; ctx.beginPath(); ctx.arc(sx(q.x), sy(q.y), 8, 0, TAU); ctx.stroke() }
    for (const q of check.dup) { ctx.strokeStyle = col['snap-edge']; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(sx(q.x), sy(q.y), 8, 0, TAU); ctx.stroke(); ctx.setLineDash([]) }
  }
  if (axisHit && busy()) {
    const { ref, axis } = axisHit
    ctx.save(); ctx.strokeStyle = axis === 'h' ? col['snap-edge'] : col['snap-pt']; ctx.lineWidth = 1.5; ctx.setLineDash([2, 4])
    ctx.beginPath(); ctx.moveTo(sx(ref.x), sy(ref.y)); ctx.lineTo(sx(cur.x), sy(cur.y)); ctx.stroke(); ctx.restore()
    if (!snapHit) tag(tr(axis === 'h' ? 'axisH' : 'axisV'), sx(cur.x) + 12, sy(cur.y) + 26)
  }
  if (marquee) {
    const { a, b } = marquee
    ctx.save(); ctx.fillStyle = col.accent; ctx.globalAlpha = 0.1
    ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); ctx.restore()
    ctx.strokeStyle = col.accent; ctx.lineWidth = 1; ctx.setLineDash(b.x < a.x ? [5, 3] : [])
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); ctx.setLineDash([])
  }
  if (reveal >= 0) revealPoints(reveal).forEach((q) => marker(q.p, q.l))
  if (snapHit && !['select', 'eraser', 'offset'].includes(tool)) {
    marker(snapHit.p, snapHit.l)
    tag(tr(snapHit.l), sx(snapHit.p.x) + 12, sy(snapHit.p.y) - 12)
  }
  $('vcbl').textContent = trs(`l_${tool}`)
  $('vcb').textContent = vcb()
}
function vcb(): string {
  if (tool === 'arc' || tool === 'arc2' || tool === 'arc3') {
    if (typed) return typed + '▏'
    const a = arcPreview()
    if (!a || a.t !== 'arc') return ''
    return tool === 'arc' ? `${+((sweepOf(a) * 180) / Math.PI).toFixed(2)}°` : tool === 'arc2' ? fmt(lastRise) : fmt(a.r)
  }
  if (tool === 'reflect') return typed ? typed + '▏' : `${+deg(mirrorAngle()).toFixed(2)}°`
  if (tool === 'rotate' || tool === 'scale') {
    if (typed) return typed + '▏'
    const m = xfParams()
    return m ? (tool === 'rotate' ? `${+deg(m.a).toFixed(2)}°` : `×${+m.k.toFixed(4)}`) : ''
  }
  if (tool === 'protractor') {
    if (protRes) return `${+protAngle(...(protRes as [Pt, Pt, Pt])).toFixed(2)}°`
    return prot.length === 2 ? `${+protAngle(prot[0], prot[1], cur).toFixed(2)}°` : ''
  }
  if (tool === 'tape' && !start && tapeRes) return fmt(dist(tapeRes[0], tapeRes[1]))
  if ((tool === 'offset' && offsetIdx >= 0) || (tool === 'tape' && tapeEdge)) { previewShape(); return typed ? typed + '▏' : fmt(offsetMag) }
  const pv = previewShape()
  if (tool === 'line' && pv && pv.t === 'line') {
    const lenS = typed || fmt(dist(pv.a, pv.b))
    const angS = typedAng || String(+deg(Math.atan2(pv.b.y - pv.a.y, pv.b.x - pv.a.x)).toFixed(2))
    return `${lenS}${typed && !angMode ? '▏' : ''}  ∠ ${angS}°${angMode ? '▏' : ''}`
  }
  if (typed) return typed + '▏'
  if (!pv) return tool === 'poly' ? `${sides}s` : ''
  if (tool === 'move') { const v = moveVec(); return fmt(Math.hypot(v.dx, v.dy)) }
  if (pv.t === 'line') return fmt(dist(pv.a, pv.b))
  if (pv.t === 'rect') return tool === 'fillet' ? fmt(pv.r) : `${fmt(pv.w)}, ${fmt(pv.h)}`
  if (pv.t === 'circle') return fmt(pv.r)
  if (pv.t === 'poly') return `${fmt(pv.ap * 2)}  (${pv.n}s)`
  if (pv.t === 'dim') return fmt(dist(pv.a, pv.b))
  return ''
}
function zoomExtents() {
  const b = bounds(shapes)
  if (!b) return
  const W = cv.clientWidth, H = cv.clientHeight, m = 60
  const s = Math.min((W - 2 * m) / Math.max(b.x1 - b.x0, 1e-6), (H - 2 * m) / Math.max(b.y1 - b.y0, 1e-6))
  view.s = Math.min(Math.max(s, 0.02), 200)
  view.ox = W / 2 - ((b.x0 + b.x1) / 2) * view.s
  view.oy = H / 2 + ((b.y0 + b.y1) / 2) * view.s
  draw()
}

// ---------- toolbar ----------
const ICONS: Record<ToolBtn, string> = {
  select: '<path d="M5 3l12 7-5 1.5L9.5 17z"/>',
  eraser: '<path d="M4 13l7-8 6 5-5 6H7z"/><path d="M8.5 9.5l5.5 5"/><path d="M7 16h9"/>',
  line: '<circle cx="5" cy="15" r="1.6"/><circle cx="15" cy="5" r="1.6"/><path d="M6.2 13.8L13.8 6.2"/>',
  rect: '<rect x="3.5" y="5.5" width="13" height="9" rx="0.5"/>',
  circle: '<circle cx="10" cy="10" r="6.5"/>',
  poly: '<path d="M10 3l6 3.5v7L10 17l-6-3.5v-7z"/>',
  offset: '<rect x="3" y="4" width="14" height="12" rx="2.5"/><rect x="6.5" y="7.5" width="7" height="5" rx="1" stroke-dasharray="2 2"/>',
  fillet: '<path d="M4 16V9a5 5 0 015-5h7"/><path d="M4 16h4M16 4v4" stroke-dasharray="1 2.5"/>',
  move: '<path d="M10 2.5v15M2.5 10h15M10 2.5L8 4.5M10 2.5l2 2M10 17.5l-2-2M10 17.5l2-2M2.5 10l2-2M2.5 10l2 2M17.5 10l-2-2M17.5 10l-2 2"/>',
  tape: '<path d="M3 14l9-9 3 3-9 9z"/><path d="M7 10l2 2M9 8l2 2"/>',
  protractor: '<path d="M3 15a7 7 0 0114 0z"/><path d="M10 15V9M10 15l4-4"/>',
  dim: '<path d="M3 15h14M3 12v6M17 12v6M7 7h6"/><path d="M5 7l2-1.5v3zM15 7l-2-1.5v3z"/>',
  arc: '<circle cx="4" cy="16" r="1.3"/><path d="M4 16V8"/><path d="M4 8a8 8 0 018 8" stroke-dasharray="1 0"/>',
  arc2: '<path d="M3 15q7-13 14 0"/><circle cx="3" cy="15" r="1.3"/><circle cx="17" cy="15" r="1.3"/>',
  arc3: '<path d="M3 16q1-11 14-10"/><circle cx="3" cy="16" r="1.3"/><circle cx="8" cy="8.2" r="1.3"/><circle cx="17" cy="6" r="1.3"/>',
  reflect: '<path d="M10 2v16" stroke-dasharray="2 2"/><path d="M7.5 6L3 10l4.5 4z"/><path d="M12.5 6L17 10l-4.5 4z" stroke-dasharray="2 1.6"/>',
  rotate: '<path d="M16 10a6 6 0 11-2-4.5"/><path d="M16 3v3.5h-3.5"/>',
  scale: '<rect x="3" y="9" width="8" height="8" rx="1"/><path d="M11 9l6-6M12 3h5v5"/>',
  pen: '<path d="M4 16l2-6 7-7 3 3-7 7z"/><path d="M6 10l3 3M11 5l3 3"/>',
  penline: '<path d="M4 15l5-8 4 5 3-8"/><rect x="2.5" y="13.5" width="3" height="3"/><rect x="7.5" y="5.5" width="3" height="3"/><rect x="14.5" y="3.5" width="3" height="3"/>',
  pencil: '<path d="M3 17c3-1 4-5 7-4s3-6 7-9"/><path d="M13 3l4 4-7 7H6v-4z" transform="translate(0 2) scale(.6) translate(4 -1)"/>',
  node: '<path d="M5 3l9 7-4 1.2 1.6 4.3-1.9.7-1.6-4.3L5 14z"/><rect x="13" y="12.5" width="4" height="4" rx="0.5"/>',
  text: '<path d="M5 5h10M10 5v10M8 15h4"/>',
  leader: '<path d="M3 16l5-5M3 16l.5-3M3 16l3-.5"/><path d="M10 4h7M13.5 4v5"/>',
}
const ACT_ICONS = {
  flipH: '<path d="M10 2.5v15" stroke-dasharray="2 2"/><path d="M8 5L3 15h5z"/><path d="M12 5l5 10h-5z"/>',
  flipV: '<path d="M2.5 10h15" stroke-dasharray="2 2"/><path d="M5 8L15 3v5z"/><path d="M5 12l10 5v-5z"/>',
}
const KEYS: Record<ToolBtn, string> = { select: 'V', eraser: 'E', line: 'L', rect: 'R', circle: 'C', arc: 'A', arc2: '', arc3: '', poly: 'P', offset: 'O', fillet: 'F', move: 'M', rotate: 'Q', scale: 'S', reflect: 'I', tape: 'T', protractor: 'G', dim: 'D', text: 'X', leader: 'K', pen: 'B', penline: '', pencil: 'H', node: 'N' }
const ORDER: (ToolBtn | 'flipH' | 'flipV' | '|')[] = ['select', 'eraser', '|', 'line', 'rect', 'circle', 'poly', '|', 'move', 'rotate', 'scale', 'reflect', 'flipH', 'flipV', 'offset', 'fillet', '|', 'tape', 'protractor', 'dim', 'text', 'leader', '|', 'pen', 'node']
const CIRCLE_GROUP: ToolBtn[] = ['circle', 'arc', 'arc2', 'arc3'] // the circle button opens a small menu with the arcs
const PEN_GROUP: ToolBtn[] = ['pen', 'penline', 'pencil'] // curve pen / straight pen / freehand pencil
const GROUPS: Record<string, ToolBtn[]> = { circle: CIRCLE_GROUP, pen: PEN_GROUP }
const groupCur: Record<string, ToolBtn> = { circle: 'circle', pen: 'pen' }
function buildTools() {
  const nav = $('tools')
  for (const [k, g] of Object.entries(GROUPS)) if (g.includes(tool as ToolBtn)) groupCur[k] = tool as ToolBtn
  nav.innerHTML = ORDER.map((t) => {
    if (t === '|') return '<span class="sep"></span>'
    if (t === 'flipH' || t === 'flipV') return `<div class="tg"><button class="btn tool act" data-act="${t}" title="${tr(t)} — ${tr('flipHint')}" aria-label="${tr(t)}"><svg viewBox="0 0 20 20">${ACT_ICONS[t]}</svg></button></div>`
    const grp = GROUPS[t] ? t : ''
    const b = grp ? groupCur[grp] : t
    return `<div class="tg"><button class="btn tool" data-tool="${b}" aria-pressed="${grp ? GROUPS[grp].includes(tool as ToolBtn) : t === tool}" title="${tr(b)}${KEYS[b] ? ` (${KEYS[b]})` : ''}" aria-label="${tr(b)}"><svg viewBox="0 0 20 20">${ICONS[b]}</svg><kbd>${KEYS[b]}</kbd></button>`
      + (grp ? `<button class="chev" data-g="${grp}" aria-label="${tr('more')}" title="${tr('more')}"></button>` : '') + '</div>'
  }).join('') + '<div id="flyout" hidden></div>'
  nav.querySelectorAll<HTMLButtonElement>('.tool:not(.act)').forEach((b) => (b.onclick = () => setTool(b.dataset.tool as Tool)))
  nav.querySelectorAll<HTMLButtonElement>('.act').forEach((b) => (b.onclick = (e) => flipSel(b.dataset.act === 'flipH' ? 'h' : 'v', e.ctrlKey)))
  nav.querySelectorAll<HTMLButtonElement>('.chev').forEach((chev) => (chev.onclick = (e) => {
    e.stopPropagation()
    const fly = $('flyout'), g = chev.dataset.g!
    if (!fly.hidden && fly.dataset.g === g) { fly.hidden = true; return }
    fly.dataset.g = g
    fly.innerHTML = GROUPS[g].map((t) => `<button class="btn fo" data-tool="${t}"><svg viewBox="0 0 20 20">${ICONS[t]}</svg><span>${tr(t)}</span><kbd>${KEYS[t]}</kbd></button>`).join('')
    const r = chev.parentElement!.getBoundingClientRect()
    fly.style.left = `${r.left}px`; fly.style.top = `${r.bottom + 2}px`; fly.hidden = false
    fly.querySelectorAll<HTMLButtonElement>('.fo').forEach((b) => (b.onclick = () => { fly.hidden = true; setTool(b.dataset.tool as Tool) }))
  }))
}
document.addEventListener('click', (e) => { const f = document.getElementById('flyout'); if (f && !f.contains(e.target as Node)) f.hidden = true })
function setTool(t: Tool) {
  if (isPen() && penNodes.length > 1) finishPen(false) // keep a half-drawn path
  tool = t; cancel(); hover = -1
  if (!['select', 'move', 'rotate', 'scale', 'node', 'reflect'].includes(t)) setSel([])
  if (t !== 'place') placeDef = ''
  buildTools(); refresh()
}
function hint() {
  const stage =
    tool === 'dim' ? (dimB ? 2 : start ? 1 : 0)
    : tool === 'fillet' ? (filletIdx >= 0 ? 1 : 0)
    : tool === 'offset' ? (offsetIdx >= 0 ? 1 : 0)
    : tool === 'protractor' ? prot.length
    : tool === 'tape' ? (tapeEdge ? 2 : start ? 1 : 0)
    : ['arc', 'arc2', 'arc3', 'rotate', 'scale', 'reflect'].includes(tool) ? apts.length
    : isPen() ? (penNodes.length ? 1 : 0)
    : tool === 'node' ? (nodeSel >= 0 ? 1 : 0)
    : start ? 1 : 0
  $('hint').textContent = trs(`h_${tool}${stage}`)
}

// ---------- menus ----------
type MI = { k?: Key; run?: () => void; hint?: string; sep?: true; panel?: string; label?: () => string }
const MENUS: { k: Key; items: MI[] }[] = [
  { k: 'mFile', items: [
    { k: 'new', run: newDoc }, { k: 'open', run: () => chooseFile('open'), hint: 'Ctrl+O' }, { k: 'importf', run: () => chooseFile('import') }, { sep: true },
    { k: 'save', run: () => void saveProject(), hint: 'Ctrl+S' }, { sep: true },
    { k: 'exDxf', run: () => exportText(toDxf(outShapes()), 'drawing.dxf', 'application/dxf') },
    { k: 'exSvg', run: () => exportText(toSvg(outShapes(), label, outColor() ?? undefined), 'drawing.svg', 'image/svg+xml') },
    { k: 'exPng', run: () => (shapes.length ? $<HTMLDialogElement>('pngd').showModal() : toast(tr('nothing'))) },
    { k: 'exPdf', run: () => (shapes.length ? page.open() : toast(tr('nothing'))), hint: 'Ctrl+P' },
  ] },
  { k: 'mEdit', items: [
    { k: 'undo', run: undo, hint: 'Ctrl+Z' }, { k: 'redo', run: redo, hint: 'Ctrl+Y' }, { sep: true },
    { k: 'copy', run: copySel, hint: 'Ctrl+C' }, { k: 'paste', run: paste, hint: 'Ctrl+V' }, { k: 'dupl', run: duplicate, hint: 'Ctrl+D' }, { sep: true },
    { k: 'selAll', run: selectAll, hint: 'Ctrl+A' }, { k: 'del', run: deleteSel, hint: 'Del' }, { sep: true },
    { k: 'flipH', run: () => flipSel('h') }, { k: 'flipV', run: () => flipSel('v') }, { k: 'mirrorH', run: () => flipSel('h', true) }, { k: 'mirrorV', run: () => flipSel('v', true) }, { sep: true },
    { k: 'group', run: group, hint: 'Ctrl+G' }, { k: 'ungroup', run: ungroup, hint: 'Ctrl+Shift+G' },
    { k: 'makeComp', run: makeComponent }, { k: 'explode', run: explode }, { k: 'editPts', run: editPoints }, { k: 'toPath', run: toPath }, { k: 'splitX', run: splitSel }, { sep: true }, { k: 'clearGuides', run: clearGuides },
  ] },
  { k: 'mView', items: [{ k: 'zoomExt', run: zoomExtents }, { k: 'theme', run: toggleTheme }] },
  { k: 'mWindow', items: [
    { panel: 'info', label: () => tr('entityT'), run: () => (tray.toggle('info'), refresh()) },
    { panel: 'tags', label: () => tr('tagsT'), run: () => (tray.toggle('tags'), refresh()) },
    { panel: 'comps', label: () => tr('compsT'), run: () => (tray.toggle('comps'), refresh()) },
    { panel: 'laser', label: () => tr('laserT'), run: () => (tray.toggle('laser'), refresh()) },
  ] },
]
const menuEl = $('menu')
function buildMenus() {
  $('menus').innerHTML = MENUS.map((m, i) => `<button class="btn mb" data-m="${i}" aria-expanded="false">${tr(m.k)}</button>`).join('')
  document.querySelectorAll<HTMLButtonElement>('.mb').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); openMenu(+b.dataset.m!, b) }))
}
function openMenu(i: number, anchor: HTMLElement) {
  const was = !menuEl.hidden && menuEl.dataset.m === String(i)
  closeMenu()
  if (was) return
  menuEl.dataset.m = String(i)
  menuEl.innerHTML = MENUS[i].items.map((it, j) => it.sep ? '<div class="msep"></div>'
    : `<button class="btn mi" data-j="${j}"><span>${it.panel ? (tray.isOpen(it.panel) ? '\u2713 ' : '\u2003') + it.label!() : tr(it.k!)}</span>${it.hint ? `<kbd>${it.hint}</kbd>` : ''}</button>`).join('')
  const r = anchor.getBoundingClientRect()
  menuEl.style.left = `${r.left}px`; menuEl.style.top = `${r.bottom + 2}px`
  menuEl.hidden = false; anchor.setAttribute('aria-expanded', 'true')
  menuEl.querySelectorAll<HTMLButtonElement>('.mi').forEach((b) => (b.onclick = () => { closeMenu(); MENUS[i].items[+b.dataset.j!].run?.() }))
}
function contextMenu(x: number, y: number) {
  closeMenu()
  const ix = [...selSet], one = ix.length === 1 ? shapes[ix[0]] : undefined
  const hasGroup = ix.some((i) => shapes[i].g), inst = ix.some((i) => shapes[i].t === 'inst')
  const items: (MI & { off?: boolean })[] = [
    { k: 'editPts', run: editPoints, off: !(one && toBz(one)) },
    { k: 'splitX', run: splitSel, off: !ix.length },
    { sep: true },
    { k: 'copy', run: copySel, hint: 'Ctrl+C', off: !ix.length },
    { k: 'paste', run: paste, hint: 'Ctrl+V', off: !clipboard.length },
    { k: 'dupl', run: duplicate, hint: 'Ctrl+D', off: !ix.length },
    { sep: true },
    { k: 'flipH', run: () => flipSel('h'), off: !ix.length },
    { k: 'flipV', run: () => flipSel('v'), off: !ix.length },
    { sep: true },
    { k: 'group', run: group, hint: 'Ctrl+G', off: ix.length < 2 },
    { k: 'ungroup', run: ungroup, hint: 'Ctrl+Shift+G', off: !hasGroup },
    { sep: true },
    { k: 'makeComp', run: makeComponent, off: !ix.length },
    { k: 'editComp', run: () => one?.t === 'inst' && editDef(one.def), off: one?.t !== 'inst' },
    { k: 'explode', run: explode, off: !hasGroup && !inst },
    { k: 'toPath', run: toPath, off: !ix.some((i) => shapes[i].t !== 'bz' && toBz(shapes[i])) },
    { sep: true },
    { k: 'del', run: deleteSel, hint: 'Del', off: !ix.length },
    { k: 'selAll', run: selectAll, hint: 'Ctrl+A' },
  ]
  menuEl.dataset.m = 'ctx'
  menuEl.innerHTML = items.map((it, j) => it.sep ? '<div class="msep"></div>'
    : `<button class="btn mi" data-j="${j}"${it.off ? ' disabled' : ''}><span>${tr(it.k!)}</span>${it.hint ? `<kbd>${it.hint}</kbd>` : ''}</button>`).join('')
  menuEl.hidden = false
  menuEl.style.left = `${Math.min(x, window.innerWidth - menuEl.offsetWidth - 8)}px`
  menuEl.style.top = `${Math.min(y, window.innerHeight - menuEl.offsetHeight - 8)}px`
  menuEl.querySelectorAll<HTMLButtonElement>('.mi').forEach((b) => (b.onclick = () => { closeMenu(); items[+b.dataset.j!].run?.() }))
}
function closeMenu() { menuEl.hidden = true; document.querySelectorAll('.mb').forEach((b) => b.setAttribute('aria-expanded', 'false')) }
document.addEventListener('click', (e) => { if (!menuEl.contains(e.target as Node)) closeMenu() })

// ---------- properties ----------
function field(l: Key, id: string, value: number) {
  return `<label>${tr(l)} (${unit})<input data-f="${id}" value="${fmt(value)}" inputmode="decimal"></label>`
}
function buildProps() {
  const s = shapes[sel]
  if (!s) { props.innerHTML = `<p class="empty">${tr('empty')}</p>`; return }
  const fillRow = fillable(s) ? `<label>${tr('fillL')}<span class="fillrow"><input type="color" data-f="fillc" value="${/^#[0-9a-f]{6}$/i.test(s.fill ?? '') ? s.fill : '#1e88e5'}"><button class="btn" data-f="fillx">${tr('noFill')}</button></span></label>` : ''
  const tagSel = `<label>${tr('tagL')}<select data-f="tag">${tags.map((t) => `<option value="${t.id}"${(s.tag ?? '0') === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>`
  let h = ''
  if (selSet.size > 1) { h = `<p class="note">${selSet.size} ${tr('nSel')}</p>` + fillRow + tagSel; wireProps(); return }
  if (s.t === 'line') {
    const ang = deg(Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x))
    h += field('length', 'len', dist(s.a, s.b)) + `<label>${tr('angle')}<input data-f="ang" value="${+ang.toFixed(3)}"></label>`
  } else if (s.t === 'rect') h += field('width', 'w', s.w) + field('height', 'h', s.h) + field('corner', 'r', s.r)
  else if (s.t === 'circle') h += field('diameter', 'd', s.r * 2)
  else if (s.t === 'arc') h += field('radius', 'r', s.r) + `<label>${tr('startAng')}<input data-f="a0" value="${+deg(s.a0).toFixed(3)}"></label><label>${tr('endAng')}<input data-f="a1" value="${+deg(s.a0 + sweepOf(s)).toFixed(3)}"></label>`
  else if (s.t === 'poly') h += field('flat', 'flat', s.ap * 2) + `<label>${tr('sides')}<input data-f="n" value="${s.n}" inputmode="numeric"></label>`
  else if (s.t === 'text') h += `<label>${tr('content')}<input data-f="s" value="${s.s.replace(/"/g, '&quot;')}"></label>` + field('size', 'size', s.size)
  else if (s.t === 'dim') h += field('offsetf', 'off', s.off) + field('size', 'size', s.size)
  else if (s.t === 'pl') h += `<p class="note">${tr('vertices')}: ${s.pts.length} · ${s.closed ? tr('closedL') : tr('openL')}</p>`
  else if (s.t === 'bz') h += `<p class="note">${tr('nodesL')}: ${s.nodes.length} · ${s.closed ? tr('closedL') : tr('openL')}</p>`
  else if (s.t === 'guide') h += `<p class="note">${tr('guideL')}</p>`
  else if (s.t === 'inst') h += `<p class="note">${tr('component')}: ${esc(defs[s.def]?.name ?? '?')}</p>` + field('posx', 'x', s.x) + field('posy', 'y', s.y)
  else if (s.t === 'image') h += `<p class="note">${tr('imageL')}</p>` + field('width', 'w', s.w) + field('height', 'h', s.h) + `<label>${tr('opacity')}<input data-f="op" value="${Math.round(s.op * 100)}" inputmode="numeric"></label>`
  h += fillRow + tagSel
  wireProps()
  function wireProps() {
    props.innerHTML = h
    props.querySelectorAll<HTMLInputElement>('input').forEach((inp) => {
      inp.onchange = () => applyField(inp.dataset.f!, inp.value)
      inp.onkeydown = (e) => { if (e.key === 'Enter') inp.blur() }
    })
    props.querySelectorAll<HTMLSelectElement>('select').forEach((sl) => (sl.onchange = () => applyField(sl.dataset.f!, sl.value)))
    props.querySelectorAll<HTMLButtonElement>('button[data-f]').forEach((bt) => (bt.onclick = () => applyField(bt.dataset.f!, '')))
  }
}
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
function applyField(f: string, raw: string) {
  if (f === 'fillc' || f === 'fillx') {
    const ix = [...selSet].filter((i) => fillable(shapes[i]))
    return commitEdit(() => ix.forEach((i) => { if (f === 'fillx') delete shapes[i].fill; else shapes[i].fill = raw }))
  }
  if (f === 'tag') {
    const ix = [...selSet]
    return commitEdit(() => ix.forEach((i) => { if (raw === '0') delete shapes[i].tag; else shapes[i].tag = raw }))
  }
  const s = shapes[sel]
  const v = parseFloat(raw)
  if (!s || (f !== 's' && !isFinite(v))) return buildProps()
  const mm = toMM(v)
  commitEdit(() => {
    if (s.t === 'line') {
      const ang = f === 'ang' ? (v * Math.PI) / 180 : Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x)
      const len = f === 'len' ? mm : dist(s.a, s.b)
      s.b = { x: s.a.x + len * Math.cos(ang), y: s.a.y + len * Math.sin(ang) }
    } else if (s.t === 'rect') {
      if (f === 'w' && mm > 0) s.w = mm
      if (f === 'h' && mm > 0) s.h = mm
      if (f === 'r') s.r = Math.max(0, mm)
      s.r = Math.min(s.r, Math.min(s.w, s.h) / 2)
    } else if (s.t === 'circle') { if (mm > 0) s.r = mm / 2 }
    else if (s.t === 'arc') { if (f === 'r' && mm > 0) s.r = mm; if (f === 'a0') { const sw = sweepOf(s); s.a0 = (v * Math.PI) / 180; s.a1 = s.a0 + sw } if (f === 'a1') s.a1 = (v * Math.PI) / 180 }
    else if (s.t === 'poly') { if (f === 'flat' && mm > 0) s.ap = mm / 2; if (f === 'n') s.n = Math.max(3, Math.min(64, Math.round(v))) }
    else if (s.t === 'text') { if (f === 's' && raw.trim()) s.s = raw; if (f === 'size' && mm > 0) s.size = mm }
    else if (s.t === 'dim') { if (f === 'off') s.off = mm; else if (mm > 0) s.size = mm }
    else if (s.t === 'inst') { if (f === 'x') s.x = mm; if (f === 'y') s.y = mm }
    else if (s.t === 'image') {
      const asp = s.h / s.w
      if (f === 'w' && mm > 0) { s.w = mm; s.h = mm * asp }
      if (f === 'h' && mm > 0) { s.h = mm; s.w = mm / asp }
      if (f === 'op') s.op = Math.max(0.05, Math.min(1, v / 100))
    }
  })
}
function refresh() {
  ;($('undo') as HTMLButtonElement).disabled = !undoStack.length
  ;($('redo') as HTMLButtonElement).disabled = !redoStack.length
  if (reveal >= shapes.length) reveal = -1
  tray.refresh(); hint(); draw(); scheduleAutosave()
}
function applyLang() {
  document.documentElement.lang = lang
  document.querySelectorAll<HTMLElement>('[data-i]').forEach((e) => (e.textContent = trs(e.dataset.i!)))
  $('lang').textContent = lang === 'th' ? 'EN' : 'ไทย'
  buildMenus(); buildTools(); tray.rebuild(); refresh()
}
function toggleTheme() {
  const r = document.documentElement
  r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark'
  draw()
}

// ---------- files ----------
let toastTimer = 0
function toast(msg: string) {
  const el = $('toast')
  el.textContent = msg; el.hidden = false
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => (el.hidden = true), 6000)
}
function saveBlob(b: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(b); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
const exportText = (text: string, name: string, type: string) => (shapes.length ? saveBlob(new Blob([text], { type }), name) : toast(tr('nothing')))
async function saveProject() {
  const blob = new Blob([toProject(shapes, unit, laser)], { type: 'application/json' })
  const w = window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle> }
  if (w.showSaveFilePicker) {
    try {
      const h = await w.showSaveFilePicker({ suggestedName: 'drawing.sketchcad', types: [{ description: 'SketchCAD', accept: { 'application/json': ['.sketchcad'] } }] })
      const ws = await h.createWritable(); await ws.write(blob); await ws.close()
      markClean(); return toast(`${tr('saved')}: ${h.name}`)
    } catch (e) { if ((e as Error).name === 'AbortError') return }
  }
  saveBlob(blob, 'drawing.sketchcad'); markClean(); toast(tr('saved'))
}
function deleteSel() { if (selSet.size) { const del = selSet; commitEdit(() => (shapes = shapes.filter((_, i) => !del.has(i)))); setSel([]); refresh() } }
function clearGuides() { if (shapes.some((s) => s.t === 'guide')) commitEdit(() => (shapes = shapes.filter((s) => s.t !== 'guide'))) }
function newDoc() { cancel(); commitEdit(() => { shapes = [] }); setSel([]); markClean(); refresh() }
const fileIn = $<HTMLInputElement>('file')
let fileMode: 'open' | 'import' = 'open'
function chooseFile(mode: 'open' | 'import') {
  fileMode = mode
  fileIn.accept = mode === 'open' ? '.sketchcad,.json,.dxf,.svg,.dwg' : '.dxf,.svg,.png,.jpg,.jpeg,.webp,.dwg'
  fileIn.value = ''; fileIn.click()
}
fileIn.onchange = () => { const f = fileIn.files?.[0]; if (f) void ingest(f, fileMode) }
const readDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f) })
async function ingest(f: File, mode: 'open' | 'import') {
  const ext = f.name.split('.').pop()!.toLowerCase()
  try {
    let add: Shape[] = [], note = ''
    if (ext === 'dwg') return toast(tr('dwgNote'))
    if (ext === 'sketchcad' || ext === 'json') {
      const p = parseProject(await f.text())
      Object.assign(images, p.images); add = p.shapes
      if (mode === 'open') { for (const k of Object.keys(defs)) delete defs[k]; tags.splice(0, tags.length, ...p.tags); activeTag = '0' }
      else for (const t of p.tags) if (!tags.some((q) => q.id === t.id)) tags.push(t)
      Object.assign(defs, p.defs)
      if (mode === 'open') laser = { ...defaultLaser(), ...p.laser }
      if (mode === 'open' && UNIT[p.unit]) { unit = p.unit; $<HTMLSelectElement>('unit').value = unit }
    } else if (ext === 'dxf') { const r = parseDxf(await f.text()); add = r.shapes; for (const t of r.layers) if (!tags.some((q) => q.id === t.id)) tags.push(t)
      if (r.skipped.length) note = ` · ${tr('skipped')}: ${r.skipped.join(', ')}` }
    else if (ext === 'svg') add = parseSvg(await f.text())
    else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      const url = await readDataUrl(f)
      const im = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
      const id = uid(); images[id] = url
      const k = 25.4 / 96 // assume 96 dpi; resize later in the properties panel
      add = [{ t: 'image', x: 0, y: 0, w: im.naturalWidth * k, h: im.naturalHeight * k, img: id, op: 0.5 }]
    } else return toast(`${tr('unsupported')}: .${ext}`)
    if (!add.length) return toast(`${tr('badFile')}: ${f.name}`)
    cancel()
    commitEdit(() => { shapes = mode === 'open' ? add : [...shapes, ...add] }); setSel([])
    if (mode === 'open') markClean()
    zoomExtents()
    toast(`${tr('imported')} ${add.length} ${tr('shapesW')}${note}`)
  } catch (e) { toast(`${tr('badFile')}: ${f.name} (${(e as Error).message})`) }
}
const page = initPage({ units: outUnits, color: outColor, label, t: trs, toast, save: saveBlob })
function exportPng() {
  const fs = outShapes()
  const b = bounds(fs, ['guide', 'image'])
  if (!b) return toast(tr('nothing'))
  const dpi = +$<HTMLSelectElement>('pngDpi').value, m = 5
  const k = Math.min(dpi / 25.4, 16000 / Math.max(b.x1 - b.x0 + 2 * m, b.y1 - b.y0 + 2 * m))
  const c = document.createElement('canvas')
  c.width = Math.ceil((b.x1 - b.x0 + 2 * m) * k); c.height = Math.ceil((b.y1 - b.y0 + 2 * m) * k)
  const g = c.getContext('2d')!
  if ($<HTMLInputElement>('pngWhite').checked) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height) }
  const v: View = { ox: -(b.x0 - m) * k, oy: (b.y1 + m) * k, s: k }
  for (const s of fs) if (s.t !== 'guide' && s.t !== 'image') drawShape(g, s, v, { color: outColor()?.(s) ?? '#111', w: Math.max(1, 0.25 * k), label, exact: true })
  c.toBlob((bl) => bl && saveBlob(bl, 'drawing.png'), 'image/png')
  $<HTMLDialogElement>('pngd').close()
}
$('pngCancel').onclick = () => $<HTMLDialogElement>('pngd').close()
$('pngGo').onclick = exportPng

// ---------- events ----------
let panning: { x: number; y: number } | null = null
let spaceDown = false
let erasing = false, erased = false
const mouse = (e: { clientX: number; clientY: number }): Pt => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
function eraseAt(p: Pt) {
  const i = pick(p)
  if (i < 0) return
  if (!erased) { undoStack.push(snapshot()); redoStack.length = 0; erased = true }
  const rep = trimErase(shapes, i, p) // crossing shapes: remove just the stretch between crossings
  if (rep) shapes.splice(i, 1, ...rep); else shapes.splice(i, 1); setSel([]); hover = -1; reveal = -1; refresh()
}
const pickingNow = () => ['select', 'eraser', 'fillet', 'offset'].includes(tool) || (tool === 'move' && !start)
const POINT_SNAPS: SnapKey[] = ['endpoint', 'midpoint', 'center', 'quadrant']

cv.addEventListener('pointermove', (e) => {
  const m = mouse(e)
  if (panning) { view.ox += m.x - panning.x; view.oy += m.y - panning.y; panning = m; draw(); return }
  if (marquee) { marquee.b = m; draw(); return }
  if (free) {
    const w = { x: wx(m.x), y: wy(m.y) }, last = free[free.length - 1]
    if (Math.hypot((w.x - last.x) * view.s, (w.y - last.y) * view.s) > 2) free.push(w)
    draw(); return
  }
  if (segDrag) { bendSegment({ x: wx(m.x), y: wy(m.y) }); draw(); return }
  if (nodeDrag || penDrag) {
    const w = { x: wx(m.x), y: wy(m.y) }
    if (nodeDrag) dragNode(nodeDrag.kind === 'p' ? snap(w) : w, e.altKey)
    else {
      const n = penNodes[penNodes.length - 1], off = { x: w.x - n.p.x, y: w.y - n.p.y }
      if (Math.hypot(off.x, off.y) * view.s > 4) { n.ho = off; n.hi = { x: -off.x, y: -off.y }; n.sm = true } else { delete n.ho; delete n.hi; n.sm = false }
    }
    draw(); return
  }
  shift = e.shiftKey; ctrl = e.ctrlKey
  const raw = { x: wx(m.x), y: wy(m.y) }
  const picking = pickingNow()
  cur = picking ? raw : snap(raw)
  if (picking) snapHit = null
  axisHit = null
  const ref = picking || snapHit ? null : axisRef()
  if (ref) { // lean towards horizontal / vertical without needing Shift
    const dx = (cur.x - ref.x) * view.s, dy = (cur.y - ref.y) * view.s
    if (Math.hypot(dx, dy) > 14) {
      if (Math.abs(dy) < 8) { cur = { x: cur.x, y: ref.y }; axisHit = { ref, axis: 'h' } }
      else if (Math.abs(dx) < 8) { cur = { x: ref.x, y: cur.y }; axisHit = { ref, axis: 'v' } }
    }
  }
  hover = picking && !(tool === 'offset' && offsetIdx >= 0) ? pick(raw, tool === 'fillet' ? 'rect' : undefined) : -1
  tapeHover = tool === 'tape' && !start && !(snapHit && POINT_SNAPS.includes(snapHit.l)) ? edgeAt(raw) : null
  if (erasing) eraseAt(raw)
  if (!picking) updateDwell(raw)
  $('coord').textContent = `${fmt(cur.x)}, ${fmt(cur.y)} ${unit}`
  draw()
})
// PointerEvent.detail is always 0, so count quick repeated presses ourselves
let clicks = 0, lastDown = { t: 0, x: 0, y: 0 }
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId)
  const m = mouse(e)
  const now = performance.now()
  clicks = now - lastDown.t < 450 && Math.hypot(m.x - lastDown.x, m.y - lastDown.y) < 8 ? clicks + 1 : 1
  lastDown = { t: now, x: m.x, y: m.y }
  const p = { x: wx(m.x), y: wy(m.y) }
  if (e.button === 1 || spaceDown) { panning = m; return }
  if (e.button === 2) {
    if (isPen() && penNodes.length > 1) { finishPen(false); return }
    if (busy() || marquee || pending) { cancel(); refresh(); return } // right-click still cancels a drawing in progress
    const i = pick(p)
    if (i >= 0 && !selSet.has(i)) { setSel([i]); refresh() }
    contextMenu(e.clientX, e.clientY); return
  }
  if (e.button !== 0) return
  e.preventDefault() // keep focus on the text box when it opens
  if (tool === 'select') {
    const i = pick(p)
    if (i >= 0) {
      if (e.shiftKey && selSet.has(i)) { selSet = new Set([...selSet].filter((j) => j !== i)); sel = [...selSet].pop() ?? -1 } // take out just this one, even from a group
      else setSel(e.shiftKey ? [...selSet, i] : [i])
      refresh()
      if (clicks >= 2) { // double / triple click
        const s = shapes[i]
        if (s.t === 'inst') editDef(s.def)
        else if (s.g && s.g !== openGroup) enterGroup(s.g, i)
        else quickEdit()
      }
      return
    }
    if (!e.shiftKey) { setSel([]); if (openGroup) leaveGroup() }
    marquee = { a: m, b: m, add: e.shiftKey }; refresh(); return
  }
  if (tool === 'place') return commit()
  if (tool === 'pencil') { free = [p]; return }
  if (isPen()) {
    const first = penNodes[0]
    if (penNodes.length > 1 && Math.hypot(sx(first.p.x) - m.x, sy(first.p.y) - m.y) < 9) return finishPen(true)
    if (clicks >= 2 && penNodes.length > 1) return finishPen(false) // double-click ends the path
    penNodes.push({ p: cur }); penDrag = tool === 'pen' // the straight pen ignores dragging
    return refresh()
  }
  if (tool === 'node') {
    const s = shapes[sel]
    if (s && s.t === 'bz') {
      const hit = nodeHit(s, m)
      if (hit) {
        nodeSel = hit.i
        if (clicks === 2 && hit.kind === 'p') { commitEdit(() => (shapes[sel] = toggleSmooth(s, hit.i))); return }
        undoStack.push(snapshot()); redoStack.length = 0; nodeDrag = { kind: hit.kind, i: hit.i }
        return refresh()
      }
      const n = nearestOnBz(s, p)
      if (n && n.d * view.s < 10) {
        undoStack.push(snapshot()); redoStack.length = 0
        if (e.altKey) { // Alt+drag: bend the line directly, no new point
          segDrag = { seg: n.seg, t: Math.min(0.88, Math.max(0.12, n.t)), base: s.nodes.map((q) => ({ ...q })) }
          nodeSel = -1; return refresh()
        }
        // plain click on the line: put a point right there (snapping to the middle when close), select it, show its handles
        const mid = cubicAt(bzSegs(s)[n.seg], 0.5)
        const t = Math.hypot((mid.x - p.x) * view.s, (mid.y - p.y) * view.s) < 12 ? 0.5 : n.t
        shapes[sel] = insertNode(s, n.seg, t); nodeSel = n.seg + 1; nodeDrag = { kind: 'p', i: nodeSel }
        return refresh()
      }
    }
    const i = pick(p)
    nodeSel = -1
    if (i < 0) { setSel([]); return refresh() }
    const conv = toBz(shapes[i]) // any basic shape becomes an editable path the moment you click it
    if (conv && shapes[i].t !== 'bz') commitEdit(() => (shapes[i] = conv))
    setSel([i]); return refresh()
  }
  if (tool === 'eraser') { erasing = true; erased = false; eraseAt(p); return }
  if (tool === 'fillet') {
    if (filletIdx >= 0) return commit()
    const i = pick(p, 'rect')
    if (i < 0) return
    filletIdx = i; setSel([i])
    fcorner = rectEdges(shapes[i] as Rect).map(([a]) => a).sort((a, b) => dist(a, p) - dist(b, p))[0]
    return refresh()
  }
  if (tool === 'offset') {
    if (offsetIdx >= 0) return commit()
    const i = pick(p)
    if (i < 0 || ['dim', 'text', 'guide', 'image', 'pl'].includes(shapes[i].t)) return
    offsetIdx = i; setSel([i]); return refresh()
  }
  if (tool === 'move') {
    if (!start) {
      if (!selSet.size) { const i = pick(p); if (i < 0) return; setSel([i]) }
      moveSet = [...selSet]; start = snap(p); return refresh()
    }
    return commit()
  }
  if (tool === 'tape') {
    if (tapeEdge) return commit()
    if (!start) {
      tapeRes = null
      if (tapeHover) { tapeEdge = tapeHover; start = nearestOnSeg(p, tapeHover[0], tapeHover[1]) } else start = cur
    } else { tapeRes = [start, lockAxis(start, cur)]; start = null }
    return refresh()
  }
  if (tool === 'arc' || tool === 'arc2' || tool === 'arc3') {
    apts.push(cur)
    if (apts.length === 3) commit()
    return refresh()
  }
  if (tool === 'reflect') {
    if (!apts.length) {
      if (!selSet.size) { const i = pick(p); if (i < 0) return toast(tr('selectFirst')); setSel([i]) }
      moveSet = [...selSet]; apts = [cur]; return refresh()
    }
    return commit()
  }
  if (tool === 'rotate' || tool === 'scale') {
    if (!apts.length) {
      if (!selSet.size) { const i = pick(p); if (i < 0) return; setSel([i]) }
      moveSet = [...selSet]
    }
    apts.push(cur)
    if (apts.length === 3) commit()
    return refresh()
  }
  if (tool === 'protractor') {
    if (protRes) protRes = null
    prot.push(cur)
    if (prot.length === 3) { protRes = prot; prot = [] }
    return refresh()
  }
  if (tool === 'dim') {
    if (!start) start = cur
    else if (!dimB) dimB = cur
    else commit()
    return refresh()
  }
  if (tool === 'text') { showTextBox(cur); return }
  if (tool === 'leader') {
    if (!start) { start = cur; return refresh() }
    const tip = start; start = null; showTextBox(cur, tip); return refresh()
  }
  if (!start) { start = cur; typed = ''; return refresh() }
  commit()
})
cv.addEventListener('pointerup', () => {
  panning = null; erasing = false
  if (nodeDrag) { nodeDrag = null; refresh() }
  if (segDrag) { segDrag = null; refresh() }
  penDrag = false
  if (free) finishFree()
  if (marquee) finishMarquee()
})
function finishMarquee() {
  const q = marquee!
  marquee = null
  const x0 = Math.min(q.a.x, q.b.x), x1 = Math.max(q.a.x, q.b.x), y0 = Math.min(q.a.y, q.b.y), y1 = Math.max(q.a.y, q.b.y)
  if (x1 - x0 < 4 && y1 - y0 < 4) return refresh()
  const cross = q.b.x < q.a.x // dragging right-to-left selects anything touched
  const w = { x0: wx(x0), x1: wx(x1), y0: wy(y1), y1: wy(y0) }
  const hit = shapes.map((_, i) => i).filter((i) => {
    const s = shapes[i]
    if (!isVisible(s) || isLocked(s) || s.t === 'guide' || (openGroup && s.g !== openGroup)) return false
    const b = bounds([s], [])
    if (!b) return false
    return cross ? !(b.x1 < w.x0 || b.x0 > w.x1 || b.y1 < w.y0 || b.y0 > w.y1) : b.x0 >= w.x0 && b.x1 <= w.x1 && b.y0 >= w.y0 && b.y1 <= w.y1
  })
  setSel([...(q.add ? selSet : []), ...hit]); refresh()
}
cv.addEventListener('contextmenu', (e) => e.preventDefault())
cv.addEventListener('wheel', (e) => {
  e.preventDefault()
  const m = mouse(e)
  const s = Math.min(200, Math.max(0.02, view.s * Math.exp(-e.deltaY * 0.0015)))
  const k = s / view.s
  view.ox = m.x - (m.x - view.ox) * k
  view.oy = m.y - (m.y - view.oy) * k
  view.s = s
  draw()
}, { passive: false })

window.addEventListener('keydown', (e) => {
  if (e.key === ' ') spaceDown = true
  ctrl = e.ctrlKey; shift = e.shiftKey
  const inField = (e.target as HTMLElement).matches('input, select, textarea')
  if (inField && e.key !== 'Escape') return
  if ($<HTMLDialogElement>('pg').open || $<HTMLDialogElement>('pngd').open) return
  const k = e.key
  if (e.ctrlKey && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return }
  if (e.ctrlKey && k.toLowerCase() === 'y') { e.preventDefault(); redo(); return }
  if (e.ctrlKey && k.toLowerCase() === 's') { e.preventDefault(); void saveProject(); return }
  if (e.ctrlKey && k.toLowerCase() === 'o') { e.preventDefault(); chooseFile('open'); return }
  if (e.ctrlKey && k.toLowerCase() === 'p') { e.preventDefault(); shapes.length ? page.open() : toast(tr('nothing')); return }
  if (k === 'Control' || k === 'Shift') { draw(); return }
  if (isPen() && penNodes.length && (k === 'Enter' || (k === 'Escape' && penNodes.length > 1))) { finishPen(false); return }
  if (isPen() && k === 'Backspace' && penNodes.length) { penNodes.pop(); draw(); return }
  if (tool === 'node' && k === 'Delete' && nodeSel >= 0) { deleteNode(); return }
  if (k === 'Escape' && openGroup) { leaveGroup(); return }
  if (k === 'Escape') { if (tool === 'place') { tool = 'select'; placeDef = ''; buildTools() } cancel(); setSel([]); closeMenu(); (document.activeElement as HTMLElement)?.blur(); refresh(); return }
  if (e.ctrlKey && k.toLowerCase() === 'a') { e.preventDefault(); selectAll(); return }
  if (e.ctrlKey && k.toLowerCase() === 'c') { e.preventDefault(); copySel(); return }
  if (e.ctrlKey && k.toLowerCase() === 'v') { e.preventDefault(); paste(); return }
  if (e.ctrlKey && k.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return }
  if (e.ctrlKey && k.toLowerCase() === 'g') { e.preventDefault(); e.shiftKey ? ungroup() : group(); return }
  if (k === 'Delete' && selSet.size && !busy()) { deleteSel(); return }
  if (k === 'Tab' && tool === 'reflect') { e.preventDefault(); if (!apts.length) mirrorVert = !mirrorVert; draw(); return }
  if (k === 'Tab' && tool === 'line' && start) { e.preventDefault(); angMode = !angMode; draw(); return }
  const typing = (busy() || tool === 'poly') && !['dim', 'protractor', 'text', 'leader'].includes(tool) && (tool !== 'tape' || tapeEdge !== null) && (!['rotate', 'scale', 'arc', 'arc2', 'arc3'].includes(tool) || apts.length >= 2) && (tool !== 'reflect' || apts.length >= 1)
  const angField = tool === 'line' && angMode
  const allowed = angField || tool === 'rotate' || tool === 'reflect' || tool === 'arc' ? /^[0-9.-]$/ : tool === 'poly' ? /^[0-9.,s]$/ : /^[0-9.,]$/
  if (typing && allowed.test(k)) { angField ? (typedAng += k) : (typed += k); draw(); return }
  if (typing && k === 'Backspace') { angField ? (typedAng = typedAng.slice(0, -1)) : (typed = typed.slice(0, -1)); draw(); return }
  if (typing && k === 'Enter' && (typed || typedAng)) {
    if (tool === 'poly' && typed.endsWith('s')) { sides = Math.max(3, Math.min(64, parseInt(typed) || sides)); typed = '' }
    else if (busy()) commit()
    refresh(); return
  }
  const t = Object.entries(KEYS).find(([, v]) => v === k.toUpperCase())?.[0] as Tool | undefined
  if (t && !e.ctrlKey) setTool(t)
})
window.addEventListener('keyup', (e) => { if (e.key === ' ') spaceDown = false; ctrl = e.ctrlKey; shift = e.shiftKey; draw() })
window.addEventListener('resize', draw)

$('undo').onclick = undo
$('redo').onclick = redo
$('unit').onchange = (e) => { unit = (e.target as HTMLSelectElement).value; refresh() }
$('lang').onclick = () => { lang = lang === 'th' ? 'en' : 'th'; applyLang() }
$('gs').onclick = () => { gridSnap = !gridSnap; $('gs').setAttribute('aria-pressed', String(gridSnap)); draw() }
$('fc').onclick = () => { fromCenter = !fromCenter; $('fc').setAttribute('aria-pressed', String(fromCenter)); draw() }
$('theme').onclick = toggleTheme

// resizable side panel
const split = $('split')
split.addEventListener('pointerdown', (e) => {
  split.setPointerCapture(e.pointerId); split.classList.add('drag')
  const move = (ev: PointerEvent) => document.documentElement.style.setProperty('--tray', `${Math.min(560, Math.max(180, window.innerWidth - ev.clientX))}px`)
  const up = () => { split.classList.remove('drag'); split.removeEventListener('pointermove', move); split.removeEventListener('pointerup', up); draw() }
  split.addEventListener('pointermove', move); split.addEventListener('pointerup', up)
})

// ---------- pen / node editing ----------
function finishPen(closed: boolean) {
  const nodes = penNodes
  penNodes = []; penDrag = false
  if (nodes.length < 2) return refresh()
  commitEdit(() => shapes.push(tagged({ t: 'bz', nodes, closed })))
  setSel([shapes.length - 1]); toNodeTool()
}
/** Drop into point editing with the current selection, so a fresh path can be adjusted straight away. */
function toNodeTool() { tool = 'node'; cancel(); nodeSel = -1; buildTools(); refresh() }
function finishFree() {
  const pts = free
  free = null
  if (!pts || pts.length < 3) return refresh()
  const { nodes, closed } = fitFree(pts, 1.5 / view.s, 10 / view.s)
  if (nodes.length < 2) return refresh()
  commitEdit(() => shapes.push(tagged({ t: 'bz', nodes, closed })))
  setSel([shapes.length - 1]); toNodeTool()
}
/** Any basic shape (line, rect, circle, arc...) becomes an editable path and the point editor opens on it. */
function editPoints() {
  const i = sel, s = shapes[i], conv = s && selSet.size === 1 ? toBz(s) : null
  if (!conv) return toast(tr('selectFirst'))
  if (s.t !== 'bz') commitEdit(() => (shapes[i] = conv))
  setSel([i]); toNodeTool()
}
/** Which handle or anchor of the selected path is under the mouse (screen coords)? */
function nodeHit(s: Bz, m: Pt): { kind: 'p' | 'hi' | 'ho'; i: number } | null {
  const near = (p: Pt, r: number) => Math.hypot(sx(p.x) - m.x, sy(p.y) - m.y) < r
  for (let i = 0; i < s.nodes.length; i++) {
    const n = s.nodes[i]
    for (const k of ['hi', 'ho'] as const) {
      const h = n[k]
      if (h && Math.hypot(h.x, h.y) * view.s > 8 && near({ x: n.p.x + h.x, y: n.p.y + h.y }, 8)) return { kind: k, i }
    }
  }
  for (let i = 0; i < s.nodes.length; i++) if (near(s.nodes[i].p, 9)) return { kind: 'p', i }
  return null
}
function dragNode(w: Pt, alt: boolean) {
  const s = shapes[sel]
  if (!nodeDrag || !s || s.t !== 'bz') return
  const nodes = s.nodes.map((n) => ({ ...n })), n = nodes[nodeDrag.i]
  if (nodeDrag.kind === 'p') n.p = w
  else {
    const k = nodeDrag.kind, o = k === 'ho' ? 'hi' : 'ho'
    const off = { x: w.x - n.p.x, y: w.y - n.p.y }
    n[k] = off
    if (alt) n.sm = false
    else if (n.sm) { // keep the other handle in line, with its own length
      const len = n[o] ? Math.hypot(n[o]!.x, n[o]!.y) : Math.hypot(off.x, off.y), L = Math.hypot(off.x, off.y) || 1
      n[o] = { x: (-off.x / L) * len, y: (-off.y / L) * len }
    }
  }
  shapes[sel] = { ...s, nodes }
}
/** Pull the point under the mouse towards w by moving both handles of that segment (Illustrator-style segment drag). */
function bendSegment(w: Pt) {
  const s = shapes[sel]
  if (!segDrag || !s || s.t !== 'bz') return
  const { seg, t, base } = segDrag, N = base.length
  const nodes = base.map((n) => ({ ...n }))
  const a = nodes[seg], b = nodes[(seg + 1) % N]
  const at = cubicAt([a.p, { x: a.p.x + (a.ho?.x ?? 0), y: a.p.y + (a.ho?.y ?? 0) }, { x: b.p.x + (b.hi?.x ?? 0), y: b.p.y + (b.hi?.y ?? 0) }, b.p], t)
  const k = 1 / (3 * t * (1 - t)), d = { x: (w.x - at.x) * k, y: (w.y - at.y) * k }
  a.ho = { x: (a.ho?.x ?? 0) + d.x, y: (a.ho?.y ?? 0) + d.y }
  b.hi = { x: (b.hi?.x ?? 0) + d.x, y: (b.hi?.y ?? 0) + d.y }
  const mirror = (from: Pt, other?: Pt): Pt => { const L = Math.hypot(from.x, from.y) || 1, len = other ? Math.hypot(other.x, other.y) : L; return { x: (-from.x / L) * len, y: (-from.y / L) * len } }
  if (a.sm && a.hi) a.hi = mirror(a.ho, a.hi)
  if (b.sm && b.ho) b.ho = mirror(b.hi, b.ho)
  shapes[sel] = { ...s, nodes }
}
function deleteNode() {
  const s = shapes[sel]
  if (!s || s.t !== 'bz' || nodeSel < 0) return
  const i = sel, k = nodeSel
  if (s.nodes.length <= 2) { commitEdit(() => shapes.splice(i, 1)); setSel([]); nodeSel = -1; return refresh() }
  commitEdit(() => { const nodes = s.nodes.filter((_, j) => j !== k); shapes[i] = { ...s, nodes, closed: s.closed && nodes.length > 2 } })
  nodeSel = -1; refresh()
}
function toPath() {
  const ix = [...selSet], conv = ix.map((i) => toBz(shapes[i]))
  if (!ix.some((i, k) => conv[k] && shapes[i].t !== 'bz')) return toast(tr('selectFirst'))
  commitEdit(() => ix.forEach((i, k) => { const c = conv[k]; if (c) shapes[i] = c }))
}
const fillable = (q: Shape) => q.t === 'rect' || q.t === 'circle' || q.t === 'poly' || (q.t === 'pl' && q.closed) || (q.t === 'bz' && q.closed)

// ---------- group editing, quick size edit ----------
function enterGroup(g: number, i: number) {
  openGroup = g; setSel([i])
  $('editname').textContent = tr('editingGroup'); $('editbar').hidden = false
  refresh()
}
function leaveGroup() {
  openGroup = 0; setSel([]); $('editbar').hidden = true; refresh()
}
/** Double/triple click: jump to the size field of the picked shape (length, diameter, width...) ready to overtype. */
function quickEdit() {
  const s = shapes[sel]
  if (!s) return
  if (s.t === 'pl' || s.t === 'bz') return editPoints() // no size fields: edit its points instead
  tray.open('info'); refresh()
  const inp = props.querySelector<HTMLInputElement>('input[data-f]:not([type="color"])')
  inp?.focus(); inp?.select()
}

// ---------- auto-save and recovery ----------
const docShapes = () => (editCtx ? editCtx.saved : shapes)
const snapshotProject = () => toProject(docShapes(), unit, laser)
let cleanData = '' // what the last saved / opened / new document looked like
let lastWritten = ''
let asTimer = 0
let recoveryPending = true // never overwrite a recoverable autosave before the user has decided
const markClean = () => { cleanData = snapshotProject(); lastWritten = '' }
function scheduleAutosave() { clearTimeout(asTimer); asTimer = window.setTimeout(() => void autosave(), 1500) }
async function autosave() {
  if (recoveryPending) return
  const data = snapshotProject()
  if (data === lastWritten) return
  lastWritten = data
  try {
    await kvSet('autosave', { ts: Date.now(), dirty: data !== cleanData, n: docShapes().length, data })
    $('asv').textContent = `${tr('autosaved')} ${new Date().toLocaleTimeString()}`
  } catch { $('asv').textContent = '' }
}
function applyProjectOpen(p: Project) {
  Object.assign(images, p.images)
  for (const k of Object.keys(defs)) delete defs[k]
  tags.splice(0, tags.length, ...p.tags); activeTag = '0'
  Object.assign(defs, p.defs)
  laser = { ...defaultLaser(), ...p.laser }
  if (UNIT[p.unit]) { unit = p.unit; $<HTMLSelectElement>('unit').value = unit }
  cancel(); undoStack.length = 0; redoStack.length = 0; shapes = p.shapes; setSel([]); refresh(); zoomExtents()
}
async function offerRecovery() {
  let rec: { ts: number; dirty: boolean; n: number; data: string } | undefined
  try { rec = await kvGet('autosave') } catch { recoveryPending = false; return }
  if (!rec?.dirty || !rec.n) { recoveryPending = false; return }
  const dlg = $<HTMLDialogElement>('recd')
  dlg.oncancel = (e) => e.preventDefault() // Esc must not silently throw the work away
  $('recMsg').textContent = lang === 'th'
    ? `พบงานที่ยังไม่ได้บันทึกเมื่อ ${new Date(rec.ts).toLocaleString()} (${rec.n} ชิ้น) เพราะโปรแกรมถูกปิดก่อนบันทึก`
    : `Found unsaved work from ${new Date(rec.ts).toLocaleString()} (${rec.n} objects): the app closed before it was saved.`
  $('recGo').onclick = () => { dlg.close(); recoveryPending = false; try { applyProjectOpen(parseProject(rec!.data)) } catch { toast(tr('badFile')) } }
  $('recDiscard').onclick = () => { dlg.close(); recoveryPending = false; void kvSet('autosave', { ts: Date.now(), dirty: false, n: 0, data: '' }) }
  dlg.showModal()
}
window.addEventListener('pagehide', () => void autosave())

// ---------- split at crossings ----------
function splitSel() {
  const ix = new Set(selSet)
  if (!ix.size) return toast(tr('selectFirst'))
  let changed = false
  const out: Shape[] = []
  shapes.forEach((s, i) => {
    const r = ix.has(i) ? splitShape(shapes, i) : null
    if (r) changed = true
    out.push(...(r ?? [s]))
  })
  if (!changed) return toast(tr('splitNone'))
  commitEdit(() => (shapes = out)); setSel([]); refresh()
}

// ---------- flip / mirror ----------
/** Mirror the selection about the centre of its own box. Copy = keep the original and add a mirrored copy. */
function flipSel(axis: 'h' | 'v', copy = false) {
  const ix = [...selSet]
  if (!ix.length) return toast(tr('selectFirst'))
  const b = bounds(ix.map((i) => shapes[i]), [])
  if (!b) return
  const c = axis === 'h' ? (b.x0 + b.x1) / 2 : (b.y0 + b.y1) / 2
  const out = ix.map((i) => flipShape(shapes[i], axis, c))
  if (copy) {
    const add = cloneGroups(out)
    commitEdit(() => shapes.push(...add))
    setSel(add.map((_, k) => shapes.length - add.length + k))
  } else commitEdit(() => ix.forEach((i, k) => (shapes[i] = out[k])))
  refresh()
}

// ---------- copy / paste ----------
let clipboard: Shape[] = []
/** Copies of grouped shapes get a fresh group id, so the copy is its own group. */
function cloneGroups(list: Shape[]): Shape[] {
  const map = new Map<number, number>()
  let g = Math.max(0, ...shapes.map((q) => q.g ?? 0))
  return list.map((q) => {
    if (!q.g) return q
    if (!map.has(q.g)) map.set(q.g, ++g)
    return { ...q, g: map.get(q.g) }
  })
}
function copySel() {
  if (!selSet.size) return toast(tr('selectFirst'))
  clipboard = [...selSet].map((i) => JSON.parse(JSON.stringify(shapes[i])) as Shape)
}
function pasteAt(dx: number, dy: number) {
  if (!clipboard.length) return
  const add = cloneGroups(clipboard.map((q) => translate(q, dx, dy)))
  commitEdit(() => shapes.push(...add)) // component copies keep pointing at the same definition
  setSel(add.map((_, k) => shapes.length - add.length + k)); refresh()
}
function paste() { const b = bounds(clipboard, []); if (b) pasteAt(cur.x - b.x0, cur.y - b.y0) }
function duplicate() { copySel(); if (clipboard.length) pasteAt(10, 10) }

// ---------- selection, groups, components ----------
function selectAll() { setSel(shapes.map((_, i) => i).filter((i) => isVisible(shapes[i]) && !isLocked(shapes[i]) && shapes[i].t !== 'guide')); refresh() }
function group() {
  if (selSet.size < 2) return toast(tr('selectFirst'))
  const g = Math.max(0, ...shapes.map((s) => s.g ?? 0)) + 1, ix = [...selSet]
  commitEdit(() => ix.forEach((i) => (shapes[i].g = g)))
}
function ungroup() {
  if (!selSet.size) return toast(tr('selectFirst'))
  const ix = [...selSet]
  commitEdit(() => ix.forEach((i) => delete shapes[i].g))
}
function makeComponent() {
  const items = [...selSet].map((i) => shapes[i]).filter((s) => s.t !== 'guide' && s.t !== 'image')
  const b = bounds(items)
  if (!b) return toast(tr('selectFirst'))
  const id = uid(), keep = new Set(selSet)
  commitEdit(() => {
    defs[id] = { name: `${tr('component')} ${Object.keys(defs).length + 1}`, shapes: items.map((s) => ({ ...translate(s, -b.x0, -b.y0), g: undefined })) }
    shapes = shapes.filter((_, i) => !keep.has(i))
    shapes.push(tagged({ t: 'inst', def: id, x: b.x0, y: b.y0 }))
  })
  setSel([shapes.length - 1]); refresh()
}
function explode() {
  if (!selSet.size) return toast(tr('selectFirst'))
  const keep = new Set(selSet)
  commitEdit(() => {
    const out: Shape[] = []
    shapes.forEach((s, i) => { if (!keep.has(i)) out.push(s); else if (s.t === 'inst') out.push(...expandInst(s)); else out.push({ ...s, g: undefined }) })
    shapes = out
  })
  setSel([]); refresh()
}
function startPlace(id: string) { cancel(); setSel([]); tool = 'place'; placeDef = id; buildTools(); refresh() }
function editDef(id: string) {
  if (editCtx || !defs[id]) return
  cancel()
  editCtx = { id, saved: shapes, undo: [...undoStack], redo: [...redoStack] }
  shapes = JSON.parse(JSON.stringify(defs[id].shapes)) as Shape[]
  undoStack.length = 0; redoStack.length = 0; setSel([])
  $('editname').textContent = `${tr('editing')}: ${defs[id].name}`; $('editbar').hidden = false
  refresh()
}
function doneEdit() {
  if (openGroup) return leaveGroup()
  if (!editCtx) return
  defs[editCtx.id].shapes = shapes.filter((s) => s.t !== 'guide' && s.t !== 'image')
  shapes = editCtx.saved
  undoStack.splice(0, undoStack.length, ...editCtx.undo); redoStack.splice(0, redoStack.length, ...editCtx.redo)
  editCtx = null; $('editbar').hidden = true; setSel([]); refresh()
}
$('editdone').onclick = doneEdit

// ---------- tray panels ----------
const IC = {
  eye: '<path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><circle cx="10" cy="10" r="2.2"/>',
  eyeOff: '<path d="M3 3l14 14M8.2 5.2A8 8 0 0110 5c5 0 8 5 8 5a14 14 0 01-2.4 2.9M5.4 6.6C3.4 8 2 10 2 10s3 5 8 5a8 8 0 003-.6"/>',
  lock: '<rect x="4.5" y="9" width="11" height="8" rx="1.5"/><path d="M7 9V6.5a3 3 0 016 0V9"/>',
  unlock: '<rect x="4.5" y="9" width="11" height="8" rx="1.5"/><path d="M7 9V6.5a3 3 0 015.6-1.5"/>',
}
const ico = (k: keyof typeof IC) => `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`
const COLN = { en: ['Auto', 'Red', 'Yellow', 'Green', 'Cyan', 'Blue', 'Magenta'], th: ['อัตโนมัติ', 'แดง', 'เหลือง', 'เขียว', 'ฟ้า', 'น้ำเงิน', 'ม่วงแดง'] }
function renderTags(b: HTMLElement) {
  b.innerHTML = tags.map((t) => `<div class="tagrow" data-t="${t.id}">
    <div class="row"><input type="radio" name="activeTag" data-a="act" title="${tr('activeTag')}"${t.id === activeTag ? ' checked' : ''}>
      <input data-a="name" value="${esc(t.name)}"${t.id === '0' ? ' disabled' : ''}>
      ${t.id === '0' ? '' : '<button class="btn" data-a="del" title="×">×</button>'}</div>
    <div class="row sub"><button class="btn" data-a="eye" title="${tr('visible')}" aria-pressed="${t.visible}">${ico(t.visible ? 'eye' : 'eyeOff')}</button>
      <button class="btn" data-a="lock" title="${tr('locked')}" aria-pressed="${t.locked}">${ico(t.locked ? 'lock' : 'unlock')}</button>
      <span class="sw" style="background:${ACI[t.color] || 'transparent'}"></span>
      <select data-a="col" aria-label="colour">${COLN[lang].map((n, i) => `<option value="${i}"${i === t.color ? ' selected' : ''}>${n}</option>`).join('')}</select></div></div>`).join('')
    + `<button class="btn" data-a="add" style="border-color:var(--line)">+ ${tr('addTag')}</button>`
  const row = (el: Element) => tags.find((t) => t.id === (el.closest('[data-t]') as HTMLElement | null)?.dataset.t)
  b.onclick = (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')
    if (!el) return
    const t = row(el), a = el.dataset.a
    if (a === 'add') tags.push({ id: uid(), name: `${tr('tagL')} ${tags.length}`, color: 0, visible: true, locked: false })
    else if (!t) return
    else if (a === 'act') activeTag = t.id
    else if (a === 'eye') t.visible = !t.visible
    else if (a === 'lock') t.locked = !t.locked
    else if (a === 'del') {
      commitEdit(() => { shapes.forEach((s) => { if (s.tag === t.id) delete s.tag }); tags.splice(tags.indexOf(t), 1) })
      if (activeTag === t.id) activeTag = '0'
    } else return
    refresh()
  }
  b.onchange = (e) => {
    const el = e.target as HTMLInputElement | HTMLSelectElement, t = row(el)
    if (!t) return
    if (el.dataset.a === 'col') t.color = +el.value
    else if (el.dataset.a === 'name' && el.value.trim()) t.name = el.value.trim()
    else return
    refresh()
  }
}
function renderComps(b: HTMLElement) {
  const count = (id: string) => shapes.filter((s) => s.t === 'inst' && s.def === id).length
  b.innerHTML = `<div class="btnrow"><button class="btn" data-a="make">${tr('makeComp')}</button><button class="btn" data-a="group">${tr('group')}</button><button class="btn" data-a="ungroup">${tr('ungroup')}</button><button class="btn" data-a="explode">${tr('explode')}</button></div>`
    + (Object.keys(defs).length ? Object.entries(defs).map(([id, d]) => `<div class="row" data-d="${id}"><input data-a="rename" value="${esc(d.name)}"><span class="cnt">×${count(id)}</span><button class="btn" data-a="ins">${tr('insert')}</button><button class="btn" data-a="edit">${tr('editComp')}</button><button class="btn" data-a="del" title="×"${count(id) ? ' disabled' : ''}>×</button></div>`).join('')
      : `<p class="note">${tr('noComps')}</p>`)
  b.onclick = (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')
    if (!el) return
    const id = (el.closest('[data-d]') as HTMLElement | null)?.dataset.d ?? '', a = el.dataset.a
    if (a === 'make') makeComponent()
    else if (a === 'group') group()
    else if (a === 'ungroup') ungroup()
    else if (a === 'explode') explode()
    else if (a === 'ins') startPlace(id)
    else if (a === 'edit') editDef(id)
    else if (a === 'del') { delete defs[id]; refresh() }
  }
  b.onchange = (e) => {
    const el = e.target as HTMLInputElement, id = (el.closest('[data-d]') as HTMLElement | null)?.dataset.d
    if (id && el.dataset.a === 'rename' && el.value.trim()) { defs[id].name = el.value.trim(); refresh() }
  }
}
function setPreset(name: string, color: number) {
  let t = tags.find((q) => q.name === name)
  if (!t) { t = { id: uid(), name, color, visible: true, locked: false }; tags.push(t) }
  const id = t.id, ix = [...selSet]
  if (ix.length) commitEdit(() => ix.forEach((i) => (shapes[i].tag = id)))
  activeTag = id; refresh()
}
function renderLaser(b: HTMLElement) {
  const sheet = shapes.find((s): s is Rect => s.t === 'rect' && !!s.sheet)
  const chk = (a: string, on: boolean, text: string) => `<label class="chk"><input type="checkbox" data-a="${a}"${on ? ' checked' : ''}><span>${text}</span></label>`
  let h = chk('on', laser.on, tr('laserOn'))
  if (laser.on) {
    const kt = laser.kerfTag || tags.find((t) => t.name === 'Cut')?.id || '0'
    h += chk('colors', laser.colors, tr('laserColors'))
      + `<div class="btnrow"><button class="btn" data-a="cut">${tr('setCut')}</button><button class="btn" data-a="eng">${tr('setEngrave')}</button><button class="btn" data-a="score">${tr('setScore')}</button></div>`
      + chk('kerfOn', laser.kerfOn, tr('kerfOn'))
      + `<label>${tr('kerfMm')}<input data-a="kerf" type="number" min="0" step="0.05" value="${laser.kerf}"></label>`
      + `<label>${tr('kerfTagL')}<select data-a="kerfTag">${tags.map((t) => `<option value="${t.id}"${t.id === kt ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>`
      + `<div class="btnrow"><button class="btn" data-a="check">${tr('checkBtn')}</button></div>`
      + (check ? `<p class="note">${check.open.length || check.dup.length ? `${check.open.length} ${tr('checkRes')} · ${check.dup.length} ${tr('checkDup')}` : tr('checkOk')}</p>` : '')
      + `<h3 class="sub">${tr('sheetT')}</h3>`
      + `<div class="row"><input data-a="sw" type="number" min="1" value="${sheet?.w ?? 600}" title="${tr('sheetW')}"><span>×</span><input data-a="sh" type="number" min="1" value="${sheet?.h ?? 400}" title="${tr('sheetH')}"><button class="btn" data-a="sheet" style="border-color:var(--line)">${tr('addSheet')}</button></div>`
    if (sheet) {
      const st = sheetStats(flat(shapes).filter((q) => !(q.t === 'rect' && q.sheet)), sheet)
      h += `<p class="note">${tr('sheetUtil')}: ${(st.util * 100).toFixed(1)}% · ${st.outside} ${tr('sheetOut')}</p>`
    } else h += `<p class="note">${tr('sheetNone')}</p>`
  }
  b.innerHTML = h
  b.onclick = (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a
    if (a === 'cut') setPreset('Cut', 1)
    else if (a === 'eng') setPreset('Engrave', 5)
    else if (a === 'score') setPreset('Score', 3)
    else if (a === 'check') { check = checkPaths(flat(shapes).filter((q) => !(q.t === 'rect' && q.sheet))); refresh() }
    else if (a === 'sheet') {
      const w = +(b.querySelector<HTMLInputElement>('[data-a="sw"]')!.value) || 600, hh = +(b.querySelector<HTMLInputElement>('[data-a="sh"]')!.value) || 400
      commitEdit(() => { shapes = shapes.filter((q) => !(q.t === 'rect' && q.sheet)); shapes.push({ t: 'rect', x: wx(cv.clientWidth / 2) - w / 2, y: wy(cv.clientHeight / 2) - hh / 2, w, h: hh, r: 0, sheet: true }) })
    }
  }
  b.onchange = (e) => {
    const el = e.target as HTMLInputElement | HTMLSelectElement, a = el.dataset.a
    if (a === 'on') laser.on = (el as HTMLInputElement).checked
    else if (a === 'colors') laser.colors = (el as HTMLInputElement).checked
    else if (a === 'kerfOn') laser.kerfOn = (el as HTMLInputElement).checked
    else if (a === 'kerf') laser.kerf = Math.max(0, +el.value || 0)
    else if (a === 'kerfTag') laser.kerfTag = el.value
    else return
    refresh()
  }
}
const panelList: Panel[] = [
  { id: 'info', title: () => tr('entityT'), render: (b) => { props = b; buildProps() } },
  { id: 'tags', title: () => tr('tagsT'), render: renderTags },
  { id: 'comps', title: () => tr('compsT'), render: renderComps },
  { id: 'laser', title: () => tr('laserT'), render: renderLaser, startClosed: true },
]
const tray = initTray($('tray'), panelList, () => tr('close'))

// ---------- boot ----------
if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark'
view.ox = 120; view.oy = innerHeight - 200
applyLang()
markClean()
void offerRecovery()

// ponytail: tiny dev-only self-check of the pure helpers
if (import.meta.env.DEV) {
  console.assert(Math.abs(segDist({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }) - 3) < 1e-9, 'segDist')
  console.assert(Math.abs(protAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }) - 90) < 1e-9, 'protAngle')
  console.assert(offsetSigned({ t: 'circle', c: { x: 0, y: 0 }, r: 10 }, 3)?.t === 'circle', 'offset')
}
