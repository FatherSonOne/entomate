const PDFDocument = require('pdfkit');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Document, Header, Footer, ImageRun, PageNumber, Paragraph, HeadingLevel, AlignmentType, Packer, TextRun } = require('docx');

const BRAND_MARK = join(__dirname, '../assets/relay-orbits-report.png');

function textList(items) {
  return Array.isArray(items) ? items.filter(item => typeof item === 'string' && item.trim()) : [];
}

function meetingAttendees(meeting) {
  const attendees = Array.isArray(meeting.attendees) ? meeting.attendees : [];
  const names = textList(attendees.map(person =>
    typeof person === 'string' ? person : person?.name || person?.email
  ));
  const speakers = Array.isArray(meeting.transcript_segments)
    ? textList(meeting.transcript_segments.map(segment => segment?.speaker))
    : [];
  return [...new Set((names.length ? names : speakers).map(name => name.trim()))];
}

function formatMeetingDate(value, timeZone) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';

  const options = {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  };
  try {
    return date.toLocaleString('en-US', { ...options, timeZone: typeof timeZone === 'string' ? timeZone : 'UTC' });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return date.toLocaleString('en-US', { ...options, timeZone: 'UTC' });
  }
}

function meetingDuration(meeting) {
  const segments = Array.isArray(meeting.transcript_segments) ? meeting.transcript_segments : [];
  const transcriptMs = segments.reduce((end, line) =>
    Math.max(end, Number(line?.endMs) || 0, Number(line?.atMs) || 0), 0);
  const start = meeting.start_time && new Date(meeting.start_time).getTime();
  const end = meeting.end_time && new Date(meeting.end_time).getTime();
  const spanMs = start && end ? end - start : 0;
  const ms = [
    meeting.recording_job?.durationMs,
    meeting.duration_seconds * 1000,
    transcriptMs,
    spanMs,
    meeting.duration_minutes * 60_000
  ].find(value => Number.isFinite(value) && value > 0);
  if (!ms) return '';

  return formatClock(ms);
}

function formatClock(ms) {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = String(seconds % 60).padStart(2, '0');
  return hours ? hours + ':' + String(minutes).padStart(2, '0') + ':' + remainder : minutes + ':' + remainder;
}

function recapSections(meeting, actionItems) {
  const list = (heading, items) => ({
    heading,
    entries: textList(items).map((text, index) => ({ text: `${index + 1}.  ${text}` }))
  });
  return [
    { heading: 'Summary', entries: textList([meeting.summary]).map(text => ({ text })) },
    list('Decisions', meeting.decisions),
    {
      heading: 'Action items',
      entries: actionItems.map((item, index) => ({
        text: `${index + 1}.  ${item.task_description}`,
        details: [
          item.assigned_to_name && `Owner: ${item.assigned_to_name}`,
          item.due_date && `Due: ${String(item.due_date).slice(0, 10)}`,
          item.priority && `Priority: ${item.priority}`,
          item.status && `Status: ${item.status.replace(/_/g, ' ')}`
        ].filter(Boolean).join('  |  ')
      }))
    },
    list('Key points', meeting.key_points),
    ...(Array.isArray(meeting.summary_sections) ? meeting.summary_sections : [])
      .filter(section => typeof section?.title === 'string' && section.title.trim())
      .map(section => list(section.title, section.items)),
    { entries: meeting.sentiment_label ? [{ text: `Sentiment: ${meeting.sentiment_label}` }] : [] }
  ].filter(section => section.entries.length > 0);
}

function transcriptEntries(meeting) {
  const segments = Array.isArray(meeting.transcript_segments) ? meeting.transcript_segments : [];
  const entries = segments.filter(line => typeof line?.text === 'string' && line.text.trim())
    .map(({ atMs, speaker, text }) => {
      const time = Number.isFinite(atMs) && atMs >= 0 ? formatClock(atMs) : '';
      const name = typeof speaker === 'string' && speaker.trim() ? speaker.trim() : 'Speaker';
      return { label: time ? `${time}  |  ${name}` : name, text };
    });
  if (entries.length) return entries;
  return typeof meeting.transcript === 'string'
    ? textList(meeting.transcript.split(/\r?\n/)).map(text => ({ text }))
    : [];
}

function renderPDF({ title, label, metadata, sections }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER', bufferPages: true,
      margins: { top: 88, right: 48, bottom: 48, left: 48 },
      info: { Title: `${title} - ${label}`, Author: 'Entomate' }
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const accent = '#B00040';
    const ink = '#111827';
    const muted = '#6B7280';
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const body = text => doc.font('Helvetica').fontSize(11).fillColor('#374151').text(text, { lineGap: 3 });
    const roomFor = height => { if (doc.y + height > doc.page.maxY()) doc.addPage(); };

    doc.font('Helvetica-Bold').fontSize(27).fillColor(ink).text(title, { lineGap: 1 });
    doc.moveDown(0.45);
    metadata.forEach(body);
    doc.moveDown(1.4);

    for (const section of sections) {
      if (section.heading) {
        roomFor(54);
        doc.font('Helvetica-Bold').fontSize(13).fillColor(accent).text(section.heading).moveDown(0.35);
      }
      for (const entry of section.entries) {
        if (entry.label) {
          const bodyHeight = doc.font('Helvetica').fontSize(11).heightOfString(entry.text, { lineGap: 3 });
          doc.font('Helvetica-Bold').fontSize(10).fillColor(ink);
          const labelHeight = doc.heightOfString(entry.label) + 4;
          const turnHeight = labelHeight + bodyHeight;
          const pageCapacity = doc.page.maxY() - doc.page.margins.top;
          roomFor(turnHeight <= pageCapacity ? turnHeight : labelHeight + 30);
          doc.text(entry.label).moveDown(0.15);
        }
        body(entry.text);
        if (entry.details) {
          doc.font('Helvetica').fontSize(9).fillColor(muted).text(entry.details, { indent: 13, lineGap: 2 });
        }
        doc.moveDown(entry.label ? 0.55 : 0.35);
      }
      doc.moveDown(0.75);
    }

    const banner = label.toUpperCase();
    const { count } = doc.bufferedPageRange();
    for (let index = 0; index < count; index += 1) {
      doc.switchToPage(index);
      doc.roundedRect(left, 33, 24, 24, 5).fill('#141415');
      doc.image(BRAND_MARK, left + 3, 36, { fit: [18, 18], align: 'center', valign: 'center' });
      doc.font('Helvetica-Bold').fontSize(14).fillColor(ink).text('entomate', left + 32, 38, { lineBreak: false });
      doc.font('Courier-Bold').fontSize(9).fillColor(accent)
        .text(banner, right - doc.widthOfString(banner), 41, { lineBreak: false });
      doc.moveTo(left, 68).lineTo(right, 68).lineWidth(1.5).strokeColor(accent).stroke();

      const footer = doc.page.height - 32;
      doc.moveTo(left, footer - 8).lineTo(right, footer - 8).lineWidth(0.6).strokeColor('#E5E7EB').stroke();
      const pageNumber = String(index + 1);
      doc.font('Courier').fontSize(8).fillColor(muted).text('ENTOMATE', left, footer, { lineBreak: false })
        .text(pageNumber, right - doc.widthOfString(pageNumber), footer, { lineBreak: false });
    }
    doc.end();
  });
}

function renderDocx({ title, label, metadata, sections }) {
  const muted = '596174';
  const paragraph = (text, options = {}) => {
    const { run, ...properties } = options;
    return new Paragraph({
      ...properties,
      children: text.split(/\r?\n/).map((line, index) => new TextRun({ text: line, break: index ? 1 : undefined, ...run }))
    });
  };
  const children = [
    paragraph(title, { heading: HeadingLevel.TITLE, keepNext: true }),
    ...metadata.map(text => paragraph(text, { spacing: { after: 50 }, run: { color: muted } }))
  ];
  for (const section of sections) {
    if (section.heading) children.push(paragraph(section.heading, { heading: HeadingLevel.HEADING_1, keepNext: true }));
    for (const entry of section.entries) {
      if (entry.label) {
        children.push(paragraph(entry.label, { keepNext: true, spacing: { before: 105, after: 20 }, run: { bold: true, size: 20 } }));
      }
      children.push(paragraph(entry.text, {
        keepNext: Boolean(entry.details), keepLines: Boolean(entry.label),
        spacing: { after: entry.details ? 30 : 95 }
      }));
      if (entry.details) {
        children.push(paragraph(entry.details, { indent: { left: 260 }, spacing: { after: 120 }, run: { color: muted, size: 18 } }));
      }
    }
  }
  const header = new Paragraph({
    children: [
      new ImageRun({ type: 'png', data: readFileSync(BRAND_MARK), transformation: { width: 20, height: 20 } }),
      new TextRun({ text: `  Entomate  |  ${label}`, bold: true, size: 19 })
    ]
  });
  return Packer.toBuffer(new Document({
    creator: 'Entomate', title: `${title} - ${label}`,
    styles: {
      default: {
        document: { run: { font: 'Calibri', color: '111827', size: 22 }, paragraph: { spacing: { line: 290 } } },
        title: { run: { size: 48, bold: true, color: '000000' }, paragraph: { spacing: { after: 200 } } },
        heading1: { run: { size: 26, bold: true, color: '000000' }, paragraph: { spacing: { before: 250, after: 80 } } }
      }
    },
    sections: [{
      properties: { page: { margin: { top: 1120, right: 1020, bottom: 930, left: 1020, header: 480, footer: 420 } } },
      headers: { default: new Header({ children: [header] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ children: ['Page ', PageNumber.CURRENT], color: muted, size: 18 })]
      })] }) },
      children
    }]
  }));
}

function generateMeetingDocument(meeting, { actionItems = [], timeZone, kind, format }) {
  const recordingStart = formatMeetingDate(meeting.recording_job?.recordingStartedAt, timeZone);
  const date = recordingStart || formatMeetingDate(meeting.start_time || meeting.created_at, timeZone);
  const dateLabel = recordingStart ? 'Recording started' : meeting.start_time
    ? (meeting.recording_job?.source === 'bot' ? 'Bot launched' : 'Meeting started')
    : 'Saved';
  const duration = meetingDuration(meeting);
  const attendees = meetingAttendees(meeting);
  const isTranscript = kind === 'transcript';
  const sections = isTranscript ? [{ heading: 'Transcript', entries: transcriptEntries(meeting) }] : recapSections(meeting, actionItems);
  if (isTranscript && !sections[0].entries.length) return null;
  const model = {
    title: meeting.title || 'Untitled meeting',
    label: isTranscript ? 'Meeting transcript' : 'Meeting recap',
    metadata: [
      date && `${dateLabel}: ${date}`,
      duration && `Duration: ${duration}`,
      attendees.length && `Attendees: ${attendees.join(', ')}`
    ].filter(Boolean),
    sections
  };
  return format === 'docx' ? renderDocx(model) : renderPDF(model);
}

module.exports = { generateMeetingDocument };
