/**
 * generate-docx.js — Generates a clean, concise project documentation .docx
 * Run with: node generate-docx.js
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType,
  PageBreak, Header, Footer, ImageRun,
} from 'docx';
import fs from 'fs';

const YELLOW = 'FACC15';
const BLACK = '0A0A0A';
const GREY = '666666';

function title(text, level = HeadingLevel.HEADING_1) {
  const sizes = { [HeadingLevel.HEADING_1]: 32, [HeadingLevel.HEADING_2]: 26, [HeadingLevel.HEADING_3]: 22 };
  return new Paragraph({ heading: level, spacing: { before: 300, after: 150 }, children: [new TextRun({ text, bold: true, size: sizes[level] || 22, font: 'Calibri' })] });
}

function para(text, opts = {}) {
  return new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text, size: 22, font: 'Calibri', ...opts })] });
}

function bullet(text) {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text, size: 22, font: 'Calibri' })] });
}

function numberedItem(text) {
  return new Paragraph({ numbering: { reference: 'numbered', level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text, size: 22, font: 'Calibri' })] });
}

function boldPara(label, value) {
  return new Paragraph({ spacing: { after: 80 }, children: [
    new TextRun({ text: label, bold: true, size: 22, font: 'Calibri' }),
    new TextRun({ text: value, size: 22, font: 'Calibri' }),
  ]});
}

function tableRow(cells, isHeader = false) {
  return new TableRow({
    children: cells.map(text => new TableCell({
      shading: isHeader ? { type: ShadingType.SOLID, color: '2D2D2D', fill: '2D2D2D' } : undefined,
      children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text, size: 20, font: 'Calibri', bold: isHeader, color: isHeader ? YELLOW : '000000' })] })],
      width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
    })),
  });
}

function simpleTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tableRow(headers, true), ...rows.map(r => tableRow(r))],
  });
}

function spacer() { return new Paragraph({ spacing: { after: 120 }, children: [] }); }

function codeBlock(text) {
  return new Paragraph({
    spacing: { after: 120 },
    shading: { type: ShadingType.SOLID, color: '1E1E1E', fill: '1E1E1E' },
    children: text.split('\n').flatMap((line, i, arr) => [
      new TextRun({ text: line || ' ', font: 'Consolas', size: 17, color: 'D4D4D4' }),
      ...(i < arr.length - 1 ? [new TextRun({ break: 1 })] : []),
    ]),
  });
}

const doc = new Document({
  numbering: {
    config: [{ reference: 'numbered', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 260 } } } }] }],
  },
  sections: [{
    headers: {
      default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Live Whiteboard — Project Documentation', size: 16, color: GREY, font: 'Calibri', italics: true })] })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '© 2026 Ujwal • MIT License', size: 16, color: GREY, font: 'Calibri' })] })] }),
    },
    children: [

      // ═══════════ COVER PAGE ═══════════
      spacer(), spacer(), spacer(), spacer(), spacer(),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: 'Live Whiteboard', size: 56, bold: true, font: 'Calibri', color: BLACK })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Real-Time Collaborative Drawing Application', size: 26, font: 'Calibri', color: GREY })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'Peer-to-Peer • WebRTC • No Backend Required', size: 20, font: 'Calibri', color: '999999' })] }),
      spacer(),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', color: YELLOW, size: 22 })] }),
      spacer(),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Developer: ', bold: true, size: 22, font: 'Calibri' }), new TextRun({ text: 'Ujwal', size: 22, font: 'Calibri' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Date: ', bold: true, size: 22, font: 'Calibri' }), new TextRun({ text: 'April 2026', size: 22, font: 'Calibri' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Tech Stack: ', bold: true, size: 22, font: 'Calibri' }), new TextRun({ text: 'React 18 • PeerJS • WebRTC • Canvas API • Tailwind CSS • Vite', size: 22, font: 'Calibri' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'Live Demo: https://live-whiteboard-ujwal.vercel.app', size: 20, font: 'Calibri', color: '3B82F6' })] }),

      // ═══════════ 1. INTRODUCTION ═══════════
      new Paragraph({ children: [new PageBreak()] }),
      title('1. Introduction'),
      para('Live Whiteboard is a real-time collaborative drawing application that lets two users draw together on a shared canvas. It uses WebRTC DataChannels for direct peer-to-peer communication — after the initial connection handshake, all drawing data flows directly between browsers without touching any server.'),
      spacer(),
      para('Key Highlights:', { bold: true }),
      bullet('No sign-up required — share a link and start drawing instantly'),
      bullet('Zero backend — 100% client-side architecture'),
      bullet('Sub-50ms latency — direct P2P connection, not server-relayed'),
      bullet('Privacy by design — no data stored anywhere'),

      // ═══════════ 2. OBJECTIVES ═══════════
      spacer(),
      title('2. Project Objectives'),
      simpleTable(
        ['#', 'Objective', 'Status'],
        [
          ['1', 'Implement WebRTC peer-to-peer communication', '✅'],
          ['2', 'Build real-time collaborative canvas drawing', '✅'],
          ['3', 'Support multiple tools (pen, eraser, shapes)', '✅'],
          ['4', 'Implement undo system with canvas snapshots', '✅'],
          ['5', 'Show remote cursor with name tag', '✅'],
          ['6', 'Responsive design (desktop + mobile)', '✅'],
          ['7', 'Deploy to production on Vercel', '✅'],
        ]
      ),

      // ═══════════ 3. TECH STACK ═══════════
      spacer(),
      title('3. Technology Stack'),
      simpleTable(
        ['Technology', 'Version', 'Purpose'],
        [
          ['React', '18.2', 'UI framework with hooks for state management'],
          ['Vite', '5.0', 'Build tool — fast dev server + optimized production builds'],
          ['PeerJS', '1.5', 'WebRTC abstraction — handles signaling and ICE negotiation'],
          ['HTML5 Canvas', 'Native', 'Drawing surface — zero dependencies'],
          ['Tailwind CSS', '3.4', 'Utility-first CSS framework'],
          ['React Router', '6.x', 'Client-side routing for room URLs'],
          ['nanoid', '5.x', 'Unique room ID generation'],
          ['Vercel', '—', 'Hosting with global CDN'],
        ]
      ),

      // ═══════════ 4. ARCHITECTURE ═══════════
      new Paragraph({ children: [new PageBreak()] }),
      title('4. System Architecture'),

      title('4.1 How It Works', HeadingLevel.HEADING_3),
      para('The application has two phases:'),
      spacer(),
      boldPara('Signaling Phase (one-time): ', 'Both browsers connect to the PeerJS Cloud signaling server via WebSocket. The server brokers the WebRTC handshake by exchanging SDP offers/answers and ICE candidates. STUN servers help discover public IP addresses for NAT traversal.'),
      spacer(),
      boldPara('Data Phase (persistent): ', 'Once the WebRTC DataChannel opens, all communication flows directly between browsers. Drawing messages (JSON) are sent at ~60fps. No server is involved in this phase.'),
      spacer(),

      title('4.2 Component Structure', HeadingLevel.HEADING_3),
      codeBlock(`App.jsx (Router)
├── Home.jsx         — Landing page (Create / Join room)
└── Room.jsx         — Whiteboard page
    ├── usePeer()    — PeerJS lifecycle management
    ├── useRoom()    — Host/guest connection logic
    ├── useCanvas()  — Drawing engine + undo + remote sync
    ├── Toolbar.jsx  — Tools, colors, brush size, actions
    ├── ConnectionStatus.jsx — Live connection indicator
    └── Toast.jsx    — Join/leave notifications`),

      title('4.3 Message Protocol', HeadingLevel.HEADING_3),
      para('All P2P messages use a typed JSON format:'),
      simpleTable(
        ['Message', 'Payload', 'When Sent'],
        [
          ['DRAW_START', 'x, y, color, size, tool', 'User begins a stroke'],
          ['DRAW_MOVE', 'x, y', 'Mouse/touch moves (~60fps)'],
          ['DRAW_END', '—', 'Stroke completed'],
          ['CLEAR', '—', 'Canvas cleared'],
          ['UNDO', '—', 'Undo triggered'],
          ['CURSOR_MOVE', 'x, y, peerId', 'Cursor position update'],
          ['HELLO', 'name, color', 'On connection (identity exchange)'],
        ]
      ),

      // ═══════════ 5. FEATURES ═══════════
      new Paragraph({ children: [new PageBreak()] }),
      title('5. Features'),
      simpleTable(
        ['Feature', 'Description'],
        [
          ['Real-time drawing sync', 'Strokes appear on both peers simultaneously via DataChannel'],
          ['5 drawing tools', 'Pen, Eraser, Line, Rectangle, Circle'],
          ['Color palette', '8 preset colors + custom color picker'],
          ['Brush size slider', 'Adjustable from 2px to 40px'],
          ['Undo system', 'Canvas snapshot stack (up to 50 levels)'],
          ['Remote cursor', 'See peer\'s cursor position with name badge'],
          ['One-click room creation', 'Unique room ID generated via nanoid'],
          ['Copy link / Web Share', 'Share room URL instantly'],
          ['Export PNG', 'Download canvas as image'],
          ['Keyboard shortcuts', 'P, E, L, R, C, U, Ctrl+Shift+Del'],
          ['Touch support', 'Works on mobile and tablets'],
          ['Toast notifications', 'Peer joined/left alerts'],
          ['Auto-reconnection', 'Guest retries on disconnect (5 attempts)'],
        ]
      ),

      // ═══════════ 6. IMPLEMENTATION HIGHLIGHTS ═══════════
      title('6. Key Implementation Details'),

      title('6.1 React 18 StrictMode Handling', HeadingLevel.HEADING_3),
      para('React 18 double-mounts components in development. When the host registers a fixed peer ID, the second mount fails because the ID is still held by the signaling server. Solution: retry up to 3 times with a 1.5s delay.'),

      title('6.2 Shape Preview Rendering', HeadingLevel.HEADING_3),
      para('Shape tools (rect, circle, line) need live preview while dragging. The canvas is snapshotted before drag starts, then on each mouse move the snapshot is restored and the shape redrawn at the new size — producing flicker-free rubber-band rendering.'),

      title('6.3 Message Throttling', HeadingLevel.HEADING_3),
      para('Mouse events fire at 120-240Hz on modern displays. To prevent flooding the DataChannel, outgoing draw moves are batched using requestAnimationFrame and sent at ~60fps.'),

      title('6.4 Eraser via Compositing', HeadingLevel.HEADING_3),
      para('Instead of tracking individual strokes for erasing, the eraser uses Canvas globalCompositeOperation = "destination-out" — making erase just another draw operation with zero extra complexity.'),

      // ═══════════ 7. SCREENSHOTS ═══════════
      new Paragraph({ children: [new PageBreak()] }),
      title('7. Screenshots'),

      title('7.1 Home Page', HeadingLevel.HEADING_3),
      new Paragraph({ spacing: { after: 120 }, children: [
        new ImageRun({ data: fs.readFileSync('screenshots/home_page.png'), transformation: { width: 560, height: 320 } }),
      ]}),
      para('Landing page with Create Room and Join Room options. Dark theme with yellow accent. "How It Works" guide at the bottom.'),
      spacer(),

      title('7.2 Whiteboard Room', HeadingLevel.HEADING_3),
      new Paragraph({ spacing: { after: 120 }, children: [
        new ImageRun({ data: fs.readFileSync('screenshots/whiteboard_room.png'), transformation: { width: 560, height: 320 } }),
      ]}),
      para('Full drawing interface showing the toolbar (tools, colors, brush size, actions), room header with share button, and connection status indicator.'),
      spacer(),

      title('7.3 Drawing Demo', HeadingLevel.HEADING_3),
      new Paragraph({ spacing: { after: 120 }, children: [
        new ImageRun({ data: fs.readFileSync('screenshots/drawing_demo.png'), transformation: { width: 560, height: 320 } }),
      ]}),
      para('Multi-tool demonstration showing freehand pen strokes (white), rectangles (red, blue), drawn with different colors and tools in a single session.'),

      // ═══════════ 8. TESTING ═══════════
      new Paragraph({ children: [new PageBreak()] }),
      title('8. Testing'),
      simpleTable(
        ['Test Case', 'Result'],
        [
          ['Room creation + unique ID generation', '✅ Pass'],
          ['Peer connection (two browser tabs)', '✅ Pass'],
          ['Drawing sync (both directions)', '✅ Pass'],
          ['Shape tools render correctly', '✅ Pass'],
          ['Eraser works on all content', '✅ Pass'],
          ['Undo restores previous state', '✅ Pass'],
          ['Clear canvas syncs to peer', '✅ Pass'],
          ['Export PNG downloads correctly', '✅ Pass'],
          ['Keyboard shortcuts functional', '✅ Pass'],
          ['Mobile touch drawing works', '✅ Pass'],
          ['Production build succeeds', '✅ Pass'],
        ]
      ),
      spacer(),
      para('Browser Compatibility:', { bold: true }),
      simpleTable(
        ['Browser', 'Status'],
        [
          ['Google Chrome 90+', '✅ Tested'],
          ['Mozilla Firefox 85+', '✅ Compatible'],
          ['Microsoft Edge 90+', '✅ Compatible'],
          ['Safari 15+', '✅ Compatible'],
        ]
      ),

      // ═══════════ 9. DEPLOYMENT ═══════════
      title('9. Deployment'),
      para('The application is deployed on Vercel with zero configuration. The build pipeline:'),
      bullet('npm install — install dependencies'),
      bullet('npm run build — Vite production build (outputs to /dist, ~287 KB total)'),
      bullet('vercel --prod — deploy to global CDN'),
      spacer(),
      para('A vercel.json rewrite rule ensures all routes serve index.html for client-side routing.'),

      // ═══════════ 10. FUTURE SCOPE ═══════════
      title('10. Future Scope'),
      bullet('Multi-user rooms (N-peer mesh or SFU topology)'),
      bullet('Text tool with font selection'),
      bullet('Session persistence via IndexedDB'),
      bullet('Image paste / drag-and-drop'),
      bullet('End-to-end encryption for DataChannel'),
      bullet('Infinite canvas with pan and zoom'),

      // ═══════════ 11. CONCLUSION ═══════════
      title('11. Conclusion'),
      para('Live Whiteboard demonstrates that modern browsers can power real-time collaborative applications without any backend infrastructure. Using WebRTC DataChannels, the app achieves direct peer-to-peer communication with sub-50ms latency, comparable to native applications.'),
      spacer(),
      para('The project covers React hooks architecture, WebRTC signaling/ICE, Canvas 2D rendering, responsive design, and production deployment — all in ~886 lines of source code across 12 files.'),

      // ═══════════ 12. REFERENCES ═══════════
      spacer(),
      title('12. References'),
      numberedItem('W3C. WebRTC 1.0: Real-Time Communication Between Browsers. W3C Recommendation.'),
      numberedItem('MDN Web Docs. WebRTC API. Mozilla Developer Network.'),
      numberedItem('PeerJS Documentation. https://peerjs.com/docs/'),
      numberedItem('MDN Web Docs. Canvas API. Mozilla Developer Network.'),
      numberedItem('React Documentation — Hooks. Meta.'),
      numberedItem('Tailwind CSS Documentation. Tailwind Labs.'),
      numberedItem('Vite Documentation. https://vitejs.dev/'),
    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync('Live_Whiteboard_Project_Documentation.docx', buffer);
console.log('✅ DOCX generated: Live_Whiteboard_Project_Documentation.docx');
