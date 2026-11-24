/**
 * Report Generation Service
 * Week 6: PDF and CSV report generation
 */

const PDFDocument = require('pdfkit');
const { join } = require('node:path');
const { Parser } = require('json2csv');

// Entomate brand colors
const BRAND = {
  primary: '#FF2D6B',     // Electric Crimson
  secondary: '#00F5D4',   // Neon Mint
  tertiary: '#FFB800',    // Amber
  dark: '#111827',        // Near-black text
  muted: '#6b7280',       // Gray text
  light: '#374151',       // Body text
  border: '#e5e7eb',      // Dividers
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  footer: '#9ca3af',
};

const RECAP_MARK = join(__dirname, '../assets/relay-orbits-report.png');

function textList(items) {
  return Array.isArray(items) ? items.filter(item => typeof item === 'string' && item.trim()) : [];
}

function recapAttendees(meeting) {
  const attendees = Array.isArray(meeting.attendees) ? meeting.attendees : [];
  const names = textList(attendees.map(person =>
    typeof person === 'string' ? person : person?.name || person?.email
  ));
  const speakers = Array.isArray(meeting.transcript_segments)
    ? textList(meeting.transcript_segments.map(segment => segment?.speaker))
    : [];
  return [...new Set((names.length ? names : speakers).map(name => name.trim()))];
}

function recapDate(meeting, timeZone) {
  const value = meeting.start_time || meeting.created_at;
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

function recapDuration(meeting) {
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

  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = String(seconds % 60).padStart(2, '0');
  return hours ? hours + ':' + String(minutes).padStart(2, '0') + ':' + remainder : minutes + ':' + remainder;
}

class ReportService {
  /**
   * Generate a PDF meeting recap
   */
  generateMeetingRecapPDF(meeting, actionItems = [], timeZone) {
    return new Promise((resolve, reject) => {
      const title = meeting.title || 'Untitled meeting';
      const doc = new PDFDocument({
        size: 'LETTER',
        bufferPages: true,
        margins: { top: 88, right: 48, bottom: 48, left: 48 },
        info: { Title: title + ' - Meeting recap', Author: 'Entomate' }
      });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const accent = '#B00040';
      function drawFrame(page) {
        doc.roundedRect(left, 33, 24, 24, 5).fill('#141415');
        doc.image(RECAP_MARK, left + 3, 36, { fit: [18, 18], align: 'center', valign: 'center' });
        doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND.dark)
          .text('entomate', left + 32, 38, { lineBreak: false });
        const label = 'MEETING RECAP';
        doc.font('Courier-Bold').fontSize(9).fillColor(accent)
          .text(label, right - doc.widthOfString(label), 41, { lineBreak: false });
        doc.moveTo(left, 68).lineTo(right, 68).lineWidth(1.5).strokeColor(accent).stroke();

        const footer = doc.page.height - 32;
        doc.moveTo(left, footer - 8).lineTo(right, footer - 8).lineWidth(0.6).strokeColor(BRAND.border).stroke();
        const pageNumber = String(page);
        doc.font('Courier').fontSize(8).fillColor(BRAND.muted)
          .text('ENTOMATE', left, footer, { lineBreak: false })
          .text(pageNumber, right - doc.widthOfString(pageNumber), footer, { lineBreak: false });
      }

      function body(text, options = {}) {
        doc.font('Helvetica').fontSize(11).fillColor(BRAND.light)
          .text(text, { lineGap: 3, ...options });
      }

      function heading(text) {
        if (doc.y + 44 > doc.page.maxY()) doc.addPage();
        doc.font('Helvetica-Bold').fontSize(13).fillColor(accent).text(text);
        doc.moveDown(0.35);
      }

      function list(title, rawItems) {
        const items = textList(rawItems);
        if (!items.length) return;
        heading(title);
        items.forEach((item, index) => {
          body((index + 1) + '.  ' + item);
          doc.moveDown(0.35);
        });
        doc.moveDown(0.75);
      }

      doc.font('Helvetica-Bold').fontSize(27).fillColor(BRAND.dark).text(title, { lineGap: 1 });
      doc.moveDown(0.45);

      const date = recapDate(meeting, timeZone);
      const duration = recapDuration(meeting);
      const attendees = recapAttendees(meeting);
      if (date) body(date);
      if (duration) body('Duration: ' + duration);
      if (attendees.length) body('Attendees: ' + attendees.join(', '));
      doc.moveDown(1.4);

      if (typeof meeting.summary === 'string' && meeting.summary.trim()) {
        heading('Summary');
        body(meeting.summary);
        doc.moveDown(1);
      }

      list('Decisions', meeting.decisions);

      if (actionItems.length) {
        heading('Action items');
        actionItems.forEach((item, index) => {
          body((index + 1) + '.  ' + item.task_description);
          const details = [
            item.assigned_to_name && 'Owner: ' + item.assigned_to_name,
            item.due_date && 'Due: ' + String(item.due_date).slice(0, 10),
            item.priority && 'Priority: ' + item.priority,
            item.status && 'Status: ' + item.status.replace(/_/g, ' ')
          ].filter(Boolean);
          if (details.length) {
            doc.font('Helvetica').fontSize(9).fillColor(BRAND.muted)
              .text(details.join('  |  '), { indent: 13, lineGap: 2 });
          }
          doc.moveDown(0.6);
        });
        doc.moveDown(0.75);
      }

      list('Key points', meeting.key_points);
      for (const section of Array.isArray(meeting.summary_sections) ? meeting.summary_sections : []) {
        if (typeof section?.title === 'string' && section.title.trim()) list(section.title, section.items);
      }
      if (meeting.sentiment_label) body('Sentiment: ' + meeting.sentiment_label);

      const { count } = doc.bufferedPageRange();
      for (let index = 0; index < count; index += 1) {
        doc.switchToPage(index);
        drawFrame(index + 1);
      }
      doc.end();
    });
  }

  /**
   * Generate a PDF project dashboard report
   */
  generateProjectReportPDF(project, actionItems = [], teamWorkload = []) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(24).fillColor(BRAND.primary).text('Project Report', { align: 'center' });
        doc.moveDown(0.5);

        // Project title
        doc.fontSize(18).fillColor(BRAND.dark).text(project.title || 'Project Overview');
        doc.moveDown(0.3);

        // Project stats
        doc.fontSize(11).fillColor(BRAND.muted);
        doc.text(`Progress: ${project.progress_percent || 0}%`);
        doc.text(`Total Items: ${project.total_items || 0}`);
        doc.text(`Completed: ${project.complete_items || 0}`);
        doc.text(`Overdue: ${project.overdue_items || 0}`);
        if (project.milestone_counts) {
          const { done, total } = project.milestone_counts;
          doc.text('Milestones complete: ' + done + ' of ' + total);
        }
        doc.moveDown();

        // Progress bar
        const progress = project.progress_percent || 0;
        doc.rect(50, doc.y, 300, 15).stroke(BRAND.border);
        doc.rect(50, doc.y, (300 * progress) / 100, 15)
          .fill(progress >= 70 ? BRAND.success : progress >= 40 ? BRAND.warning : BRAND.error);
        doc.moveDown(2);

        if (project.latest_update) {
          const { health, authorName, postedAt, note } = project.latest_update;
          const label = ({ on_track: 'On track', at_risk: 'At risk', off_track: 'Off track' })[health];
          doc.fontSize(14).fillColor(BRAND.primary).text('Latest Status Update');
          doc.fontSize(11).fillColor(BRAND.muted).text([label, authorName, postedAt.slice(0, 10)].join(' | '));
          doc.fontSize(11).fillColor(BRAND.dark).text(note);
          doc.moveDown();
        }

        // Team Workload
        if (teamWorkload.length > 0) {
          doc.fontSize(14).fillColor(BRAND.primary).text('Team Workload');
          doc.moveDown(0.3);

          teamWorkload.forEach(member => {
            const completion = member.total_assigned > 0
              ? Math.round((member.completed_items / member.total_assigned) * 100)
              : 0;
            doc.fontSize(11).fillColor(BRAND.light)
              .text(`${member.team_member}: ${member.total_assigned} tasks (${completion}% complete)`, { indent: 10 });
          });
          doc.moveDown();
        }

        // Action Items by Status
        if (actionItems.length > 0) {
          doc.fontSize(14).fillColor(BRAND.primary).text('Action Items');
          doc.moveDown(0.3);

          const byStatus = {
            open: actionItems.filter(i => i.status === 'open'),
            in_progress: actionItems.filter(i => i.status === 'in_progress'),
            done: actionItems.filter(i => i.status === 'done')
          };

          Object.entries(byStatus).forEach(([status, items]) => {
            if (items.length === 0) return;
            const label = status.replace('_', ' ').toUpperCase();
            doc.fontSize(12).fillColor(BRAND.muted).text(`${label} (${items.length})`);

            items.slice(0, 10).forEach(item => {
              doc.fontSize(10).fillColor(BRAND.light)
                .text(`• ${item.task_description}`, { indent: 15 });
            });
            if (items.length > 10) {
              doc.fontSize(9).fillColor(BRAND.footer)
                .text(`  ... and ${items.length - 10} more`, { indent: 15 });
            }
            doc.moveDown(0.5);
          });
        }

        // Footer
        doc.moveDown();
        doc.fontSize(9).fillColor(BRAND.footer)
          .text(`Generated by Entomate on ${new Date().toLocaleString()}`, { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate CSV export for meetings
   */
  generateMeetingsCSV(meetings) {
    const fields = [
      { label: 'ID', value: 'id' },
      { label: 'Title', value: 'title' },
      { label: 'Date', value: row => row.created_at ? new Date(row.created_at).toLocaleDateString() : '' },
      { label: 'Duration (min)', value: row => row.duration_seconds ? Math.round(row.duration_seconds / 60) : '' },
      { label: 'Summary', value: 'summary' },
      { label: 'Sentiment', value: 'sentiment_label' },
      { label: 'Sentiment Score', value: 'sentiment_score' }
    ];

    const parser = new Parser({ fields });
    return parser.parse(meetings);
  }

  /**
   * Generate CSV export for action items
   */
  generateActionItemsCSV(actionItems) {
    const fields = [
      { label: 'ID', value: 'id' },
      { label: 'Task', value: 'task_description' },
      { label: 'Status', value: 'status' },
      { label: 'Priority', value: 'priority' },
      { label: 'Assigned To', value: 'assigned_to_name' },
      { label: 'Email', value: 'assigned_to_email' },
      { label: 'Due Date', value: row => row.due_date ? new Date(row.due_date).toLocaleDateString() : '' },
      { label: 'Created', value: row => row.created_at ? new Date(row.created_at).toLocaleDateString() : '' },
      { label: 'Completed', value: row => row.completed_at ? new Date(row.completed_at).toLocaleDateString() : '' }
    ];

    const parser = new Parser({ fields });
    return parser.parse(actionItems);
  }

  /**
   * Generate CSV export for tasks
   */
  generateTasksCSV(tasks) {
    const fields = [
      { label: 'ID', value: 'id' },
      { label: 'Title', value: 'title' },
      { label: 'Description', value: 'description' },
      { label: 'Status', value: 'status' },
      { label: 'Priority', value: 'priority' },
      { label: 'Assigned To', value: 'assigned_to' },
      { label: 'Project ID', value: 'project_id' },
      { label: 'Due Date', value: row => row.due_date ? new Date(row.due_date).toLocaleDateString() : '' },
      { label: 'Start Date', value: row => row.start_date ? new Date(row.start_date).toLocaleDateString() : '' },
      { label: 'Tags', value: row => (row.tags || []).join(', ') },
      { label: 'Created', value: row => row.created_at ? new Date(row.created_at).toLocaleDateString() : '' },
      { label: 'Completed', value: row => row.completed_at ? new Date(row.completed_at).toLocaleDateString() : '' }
    ];

    const parser = new Parser({ fields });
    return parser.parse(tasks);
  }

  /**
   * Generate a weekly summary report
   */
  generateWeeklySummaryPDF(data) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const { meetings, actionItems, period } = data;

        // Header
        doc.fontSize(24).fillColor(BRAND.primary).text('Weekly Summary Report', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(12).fillColor(BRAND.muted).text(period || 'This Week', { align: 'center' });
        doc.moveDown();

        // Quick Stats
        doc.fontSize(14).fillColor(BRAND.primary).text('Quick Stats');
        doc.moveDown(0.3);

        const stats = [
          `Meetings Held: ${meetings?.length || 0}`,
          `Action Items Created: ${actionItems?.filter(i => i.status !== 'done').length || 0}`,
          `Action Items Completed: ${actionItems?.filter(i => i.status === 'done').length || 0}`
        ];

        stats.forEach(stat => {
          doc.fontSize(11).fillColor(BRAND.light).text(`• ${stat}`, { indent: 10 });
        });
        doc.moveDown();

        // Meetings Summary
        if (meetings && meetings.length > 0) {
          doc.fontSize(14).fillColor(BRAND.primary).text('Meetings');
          doc.moveDown(0.3);

          meetings.slice(0, 5).forEach(meeting => {
            doc.fontSize(11).fillColor(BRAND.dark).text(meeting.title || 'Untitled');
            if (meeting.summary) {
              doc.fontSize(10).fillColor(BRAND.muted)
                .text(meeting.summary.substring(0, 150) + (meeting.summary.length > 150 ? '...' : ''), { indent: 10 });
            }
            doc.moveDown(0.3);
          });
          doc.moveDown();
        }

        // Overdue Items
        const overdueItems = actionItems?.filter(i =>
          i.due_date && new Date(i.due_date) < new Date() && i.status !== 'done'
        ) || [];

        if (overdueItems.length > 0) {
          doc.fontSize(14).fillColor(BRAND.error).text(`⚠ Overdue Items (${overdueItems.length})`);
          doc.moveDown(0.3);

          overdueItems.slice(0, 5).forEach(item => {
            doc.fontSize(10).fillColor(BRAND.light)
              .text(`• ${item.task_description}`, { indent: 10 });
          });
          doc.moveDown();
        }

        // Footer
        doc.moveDown();
        doc.fontSize(9).fillColor(BRAND.footer)
          .text(`Generated by Entomate on ${new Date().toLocaleString()}`, { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = new ReportService();
