App Connector Assistant: UI Navigation Design
CMF Nothing-Inspired Design System with Gemini Studio Prompts
Complete Guide for Building Sleek, Minimal Navigation & Menu System

Design system overview
CMF Nothing aesthetic principles
Minimalist: Maximum clarity, zero clutter

Monochromatic: Whites, blacks, light grays with single accent color (teal)

Spacious: Generous whitespace and padding

Refined typography: Clean sans-serif, clear hierarchy

Subtle interactions: Smooth transitions, no jarring effects

Accessibility: High contrast, clear touch targets (min 44px)

Premium feel: Understated elegance through simplicity

Color palette
text
Primary Background:  #FFFFFF
Secondary BG:        #F5F5F5
Text Primary:        #1a1a1a
Text Secondary:      #666666
Accent Color:        #00A86B
Divider:             #E8E8E8
Error:               #D32F2F
Success:             #00A86B
Typography
text
Font Family:  Inter, -apple-system, BlinkMacSystemFont, sans-serif
Headings:     600 weight
Body Text:    400 weight, 1.5 line-height
UI Labels:    500 weight, 0.95em size
File structure
text
/app-connector/
├── index.html
├── styles/
│   ├── navigation.css
│   ├── menu.css
│   └── animations.css
├── components/
│   ├── sidebar-nav.js
│   ├── bottom-nav.js
│   └── top-bar.js
└── assets/
    └── icons/
UI structure (layout)
text
┌─────────────────────────────────────────────────────┐
│  Top Bar (Logo + Settings + Notifications)          │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │  Main Content Area                       │
│ Nav      │                                          │
│          │                                          │
├──────────┴──────────────────────────────────────────┤
│  Bottom Mobile Nav (Mobile only)                    │
└─────────────────────────────────────────────────────┘
Main sidebar items:

Home

Meetings

Action Items

Library

CRM Sync

Pulse Chat

Settings

More (…)

PROMPT 1 – Sidebar navigation HTML
Copy everything between the backticks into Gemini:

text
You are a UI/UX designer creating a navigation sidebar for an AI-powered 
meeting assistant app. The design philosophy is "CMF Nothing" - minimalist, 
monochromatic, premium, with teal accent color.

Create a responsive HTML sidebar navigation with these specifications:

DESIGN REQUIREMENTS:
- Width: 240px on desktop, collapsible to 60px
- Background: Pure white (#FFFFFF)
- Accent color: Teal (#00A86B)
- Border-right: 1px solid #E8E8E8
- Font: Inter or system sans-serif
- Icons: Outline style (not filled)
- Smooth transitions on all interactions

MENU STRUCTURE:
Primary Items (in this order):
1. Logo/Home - "Connector" with app icon
2. Home (house icon)
3. Meetings (microphone icon)
4. Action Items (checkbox icon)
5. Library (book/folder icon)
6. CRM Sync (link icon)
7. Pulse Chat (chat bubble icon)
8. Settings (gear icon)
9. More (...) (three dots icon)

FEATURES:
- Active menu item should have teal left border (4px) and light gray background
- Menu items should have 16px padding
- Icons + text on desktop, icons only on collapsed mobile
- Smooth hover effect (subtle gray background, no color change)
- Each item should have a data-menu-id attribute

OUTPUT FORMAT:
Generate ONLY clean, semantic HTML5 with:
- <nav> wrapper
- <ul> list structure
- <a> links with proper ARIA attributes
- SVG inline icons (minimal, outline style)
- Comments explaining sections
- No CSS (we'll add that separately)

Make it production-ready, accessible, and scalable.

PROMPT 2 – Sidebar CSS
text
You are a CSS specialist styling a minimalist navigation sidebar using 
the CMF Nothing design system.

Create a complete CSS file for a navigation sidebar with these specifications:

COLORS:
- Background: #FFFFFF
- Text Primary: #1a1a1a
- Text Secondary: #666666
- Accent: #00A86B (teal)
- Hover Background: #F5F5F5
- Divider: #E8E8E8
- Active Border: #00A86B

LAYOUT & SPACING:
- Sidebar width: 240px (desktop)
- Collapsed width: 60px (mobile/tablet)
- Top padding: 24px
- Bottom padding: 24px
- Item padding: 12px 16px
- Icon size: 24px
- Smooth transition time: 0.3s

STYLING RULES:
1. Navigation container:
   - Flexbox column layout
   - Full height (100vh)
   - Fixed position
   - Box-shadow: subtle (0 2px 8px rgba(0,0,0,0.04))
   - Smooth width transition on collapse

2. Menu items:
   - Display: flex, align-items: center, gap: 12px
   - Color: #666666 default
   - Color: #1a1a1a on hover
   - Background: transparent default
   - Background: #F5F5F5 on hover
   - Transition: all 0.2s ease
   - Border-radius: 6px
   - Cursor: pointer

3. Active item:
   - Left border: 4px solid #00A86B
   - Background: #F5F5F5
   - Color: #1a1a1a
   - Font-weight: 500

4. Icons:
   - Stroke-width: 1.5
   - Color: inherit from parent
   - Smooth color transition: 0.2s

5. Separators:
   - Margin: 16px 0
   - Height: 1px
   - Background: #E8E8E8

6. Responsive:
   - Desktop (1024px+): Full sidebar
   - Tablet (768-1023px): Collapsed sidebar, icons only
   - Mobile (<768px): Drawer/hamburger menu

ANIMATIONS:
- All transitions: cubic-bezier(0.4, 0, 0.2, 1)
- Icon color change: 0.2s
- Background fade: 0.15s
- Width collapse: 0.3s

OUTPUT:
Generate ONLY clean, modern CSS with:
- CSS variables for colors (:root)
- Flexbox layouts (no grid for this)
- Mobile-first approach
- Smooth transitions everywhere
- Comments for each section
- No JavaScript (pure CSS)

Make it production-ready for immediate use.

PROMPT 3 – Top bar / header
text
You are designing a minimalist top navigation bar for an AI meeting assistant.

Create a complete top bar component (HTML + CSS) with these specifications:

LAYOUT:
- Full width across top
- Height: 64px
- Background: #FFFFFF
- Border-bottom: 1px solid #E8E8E8
- Fixed position, z-index: 100
- Horizontal layout with 3 sections: left, center, right

LEFT SECTION:
- App name: "Connector"
- Logo/icon (24x24px)
- Font: 18px, 600 weight
- Color: #1a1a1a

CENTER SECTION:
- Search bar OR breadcrumb navigation
- If search: rounded input with magnifying glass icon
- If breadcrumb: "Home > Meetings > All Meetings"
- Text: 14px, #666666

RIGHT SECTION (left to right):
1. Notifications icon (bell)
   - Notification badge (red dot) in corner
2. User profile dropdown
   - Avatar (32x32px, circular)
   - Name on hover
3. Settings icon (gear)

STYLING:
- All items: center vertically and horizontally
- Flexbox layout with space-between
- Icons: 24x24px, stroke-width 1.5
- Hover: subtle background change (#F5F5F5)
- Smooth transitions: 0.2s
- Padding: 16px 24px (left/right)

FEATURES:
- Responsive: icons stack on mobile
- High contrast for accessibility
- Touch-friendly: 44px min touch target
- Active states clearly visible
- Icon colors inherit from text color

OUTPUT:
Generate ONLY clean HTML5 + CSS with:
- <header> tag
- Semantic structure
- Inline SVG icons (outline style)
- Dropdown menu HTML (for profile)
- CSS variables for colors
- Mobile-responsive design
- Comments explaining sections

Make it elegant, minimal, and production-ready.

PROMPT 4 – Library view HTML
text
You are designing a Library view for a meeting assistant app that stores:
- Meeting recordings
- Transcripts
- Templates
- Knowledge base articles
- Saved searches

Create the Library component (HTML structure only) with these specifications:

STRUCTURE:
Main Container divided into:

1. SIDEBAR SUB-MENU (in left sidebar):
   Items:
   - All Library Items
   - Recent Recordings
   - Templates
   - Knowledge Base
   - My Saved Items
   - Archived

2. MAIN CONTENT AREA:
   Sections:
   - Filter bar (top): Search + filters (Type, Date, Owner)
   - Grid/List view toggle
   - Item cards showing:
     * Thumbnail or icon
     * Title
     * Date created
     * Owner/Source
     * Duration (for recordings)
     * Tags
     * Action menu (three dots)

3. CATEGORIES SHOWN:
   - Meeting Recordings (with duration, participants)
   - Transcripts (with word count, searchable)
   - Templates (for meeting agendas, recaps)
   - Knowledge Base (extracted insights)
   - Saved Items (user-marked favorites)

DESIGN:
- Card layout: 3 columns on desktop, responsive
- Card size: 240x200px minimum
- Spacing: 16px between cards
- Border: 1px solid #E8E8E8
- Border-radius: 8px
- Hover: subtle shadow (0 4px 12px rgba(0,0,0,0.08))
- Active filters: teal accent color
- Smooth transitions: 0.2s

INTERACTIVE FEATURES:
- Click card: opens detail view
- Hover card: show action button
- Filter: updates displayed items
- Search: real-time filtering
- Toggle: switch between grid/list view

OUTPUT:
Generate ONLY semantic HTML5 with:
- <section> for Library
- <aside> for sub-menu
- <div> card structure
- Filter form
- Search input
- Grid container
- Proper ARIA labels
- Comments explaining sections
- Data attributes for interactivity (data-category, data-type, etc.)

No CSS or JavaScript - structure only.
Make it accessible and well-organized.

PROMPT 5 – Activity view HTML
text
You are designing an Activity view for a meeting assistant that shows:
- Recent meetings recorded
- Action items created
- Transcripts generated
- Team members' activity
- CRM updates triggered

Create the Activity component (HTML structure only) with these specifications:

ACTIVITY FEED STRUCTURE:
Timeline view with entries in reverse chronological order

ACTIVITY ENTRY TYPES:
1. Meeting recorded:
   - Avatar + "Sarah Davis recorded Meeting: Q1 Budget Discussion"
   - Time: "2 hours ago"
   - Meeting duration, participants
   - "View Recap" link

2. Action item created:
   - Icon + "Mike Chen assigned to: Review vendor proposals"
   - Time: "1 hour ago"
   - Due date, priority
   - "View in CRM" link

3. Transcript completed:
   - Icon + "Transcript ready for Q1 Budget Discussion"
   - Time: "45 min ago"
   - Searchable, downloadable
   - "View" link

4. Team member activity:
   - Avatar + "3 new responses to Finance Team meeting"
   - Time: "30 min ago"
   - "View discussion" link

5. CRM update:
   - Icon + "Deal Stage Updated: Negotiation → Closed Won"
   - Time: "15 min ago"
   - Amount, company name
   - "View in CRM" link

LAYOUT:
- Left: Timeline vertical line with dots
- Middle: Activity content
- Right: Time, metadata
- Horizontal dividers between entries
- Empty state when no activity

DESIGN:
- Card-like appearance with subtle borders
- Avatar/icon: 40x40px, rounded
- Text color: primary on header, secondary on metadata
- Hover: subtle background, action buttons appear
- Time format: "2 hours ago", "Yesterday", "Dec 12"
- Metadata: gray text, 13px size

INTERACTIVE:
- Click entry: expand or navigate to detail
- Hover: show action buttons (View, Reply, Archive)
- Filter: by activity type, date range
- Load more: pagination at bottom

OUTPUT:
Generate ONLY semantic HTML5 with:
- <div> activity-feed container
- <article> for each activity entry
- <time> tag for timestamps
- <img> for avatars
- Structured metadata
- Action button placeholders
- Data attributes (data-type, data-time, data-id)
- Comments explaining sections
- Empty state placeholder

No CSS or JavaScript - structure only.
Make it semantically correct and accessible.

PROMPT 6 – Mobile bottom navigation
text
You are designing a mobile bottom navigation bar for an AI meeting assistant.
This appears only on screens < 768px width.

Create mobile bottom navigation (HTML + CSS) with these specifications:

STRUCTURE:
- Fixed at bottom of screen
- Full width
- Height: 64px
- 5 main tabs (icons + labels)

NAVIGATION ITEMS:
1. Home (house icon)
2. Meetings (microphone icon)
3. New Meeting (large center button, accent color)
4. Library (book icon)
5. Settings (gear icon)

LAYOUT:
- Flexbox with space-around
- Safe-area-inset-bottom for notched devices
- Horizontal items
- Item height: 64px
- Icon: 24px
- Label: 12px font below icon
- Center item (New Meeting): larger, teal background

STYLING:
- Background: white (#FFFFFF)
- Border-top: 1px solid #E8E8E8
- Text: #666666 default, #1a1a1a active
- Active: teal icon + teal text
- Hover: subtle background (#F5F5F5)
- Transitions: 0.2s smooth

CENTER BUTTON (New Meeting):
- Size: 56x56px circular
- Position: centered, slightly above nav
- Background: #00A86B (teal)
- Icon: white (+ sign)
- Shadow: 0 4px 12px rgba(0, 168, 107, 0.3)
- Hover: slightly larger scale

FEATURES:
- Touch-friendly: 44px min target
- Shows/hides on scroll (optional)
- Proper z-index layering
- High contrast for accessibility
- No scrolling content under it (padding-bottom)

OUTPUT:
Generate ONLY clean HTML5 + CSS with:
- <nav> with role="navigation"
- <a> or <button> for items
- Inline SVG icons (outline)
- CSS variables for colors
- Media query (only on screens < 768px)
- Safe area CSS (@supports)
- Transitions for smooth behavior
- Comments explaining sections

Make it production-ready and mobile-optimized.

PROMPT 7 – Unified CSS system
text
You are creating a unified CSS stylesheet for an entire navigation system 
using the CMF Nothing design philosophy.

Create a comprehensive CSS file that includes styling for:
1. Left sidebar navigation
2. Top header bar
3. Mobile bottom navigation
4. Library view
5. Activity view
6. All interactive states

COLOR SYSTEM:
Define CSS variables:
--color-white: #FFFFFF
--color-gray-light: #F5F5F5
--color-gray-border: #E8E8E8
--color-text-primary: #1a1a1a
--color-text-secondary: #666666
--color-accent: #00A86B
--color-error: #D32F2F
--color-bg-hover: #F5F5F5

TYPOGRAPHY:
--font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif
--font-size-xs: 12px
--font-size-sm: 13px
--font-size-base: 14px
--font-size-lg: 16px
--font-size-xl: 18px
--font-weight-normal: 400
--font-weight-medium: 500
--font-weight-semibold: 600

SPACING:
--space-xs: 4px
--space-sm: 8px
--space-md: 12px
--space-lg: 16px
--space-xl: 24px
--space-2xl: 32px

RADII & SHADOWS:
--radius-sm: 4px
--radius-md: 6px
--radius-lg: 8px
--shadow-sm: 0 1px 3px rgba(0,0,0,0.08)
--shadow-md: 0 2px 8px rgba(0,0,0,0.12)
--shadow-lg: 0 4px 12px rgba(0,0,0,0.15)

TRANSITIONS:
--transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1)
--transition-normal: 0.2s cubic-bezier(0.4, 0, 0.2, 1)
--transition-slow: 0.3s cubic-bezier(0.4, 0, 0.2, 1)

MAIN LAYOUT:
- Body: margin 0, padding 0, overflow hidden
- Main: display flex, height 100vh
- Sidebar: width 240px, position fixed/relative
- Header: height 64px, fixed top
- Content: margin-top 64px, margin-left 240px, overflow-y auto
- Mobile: sidebar hidden, bottom nav shown

NAVIGATION ITEMS:
- Links: text-decoration none, color inherit
- Menu items: display flex, align-items center, gap 12px
- Hover: background-color var(--color-bg-hover)
- Active: border-left 4px solid var(--color-accent), font-weight 500
- Icons: stroke-width 1.5, width 24px, height 24px

RESPONSIVE BREAKPOINTS:
- Desktop (1024px+): sidebar 240px, full layout
- Tablet (768px-1023px): sidebar 60px (icons only), bottom nav hidden
- Mobile (<768px): sidebar hidden, bottom nav 64px

INTERACTIVE STATES:
- Hover: brightness 95%, shadow-sm
- Active: accent color, bold text
- Disabled: opacity 50%, cursor not-allowed
- Focus: outline 2px solid var(--color-accent)

ANIMATIONS:
- Page transitions: fade 0.3s
- Menu open/close: slide 0.3s, opacity fade
- Icon color change: 0.2s smooth
- Button press: scale 0.98

ACCESSIBILITY:
- Focus visible on all interactive elements
- High contrast: 4.5:1 minimum
- Touch targets: 44x44px minimum
- Reduced motion: respect prefers-reduced-motion

OUTPUT:
Generate ONLY production-ready CSS with:
- CSS variables defined at :root
- Mobile-first approach
- Flexbox layouts (no grid here)
- Smooth transitions everywhere
- Clear section comments
- Media queries for responsive
- Proper z-index layering
- Box-sizing border-box globally
- Print media query (hide nav)

Make it comprehensive, scalable, and immediately usable.

PROMPT 8 – JavaScript navigation controller
text
You are writing JavaScript to manage navigation interactions for an app.

Create JavaScript code that handles:
1. Menu item click activation
2. Sidebar collapse/expand on mobile
3. Active state tracking
4. Smooth page transitions
5. Mobile bottom nav interaction

Create a NavigationController class with these features:

CLASS STRUCTURE:
class NavigationController {
  constructor() {
    - Initialize menu items
    - Initialize current page state
    - Set up event listeners
    - Handle responsive changes
  }
}

METHODS:
1. setActivePage(pageId)
   - Remove active class from all items
   - Add active class to selected item
   - Update breadcrumb
   - Emit page change event
   - Save to localStorage

2. toggleSidebar()
   - Toggle sidebar width 240px ↔ 60px
   - Save state to localStorage
   - Smooth CSS transition

3. handleMobileNavigation()
   - Show/hide sidebar on mobile
   - Handle bottom nav clicks
   - Close sidebar on item click
   - Smooth transitions

4. setupEventListeners()
   - Click events on all menu items
   - Resize listener for responsive
   - Scroll listener (optional)
   - Touch events for mobile

5. getSavedState()
   - Restore active page from localStorage
   - Restore sidebar collapse state
   - Restore last viewed section

6. saveState()
   - Save current page
   - Save sidebar state
   - Save timestamp

FEATURES:
- Smooth transitions between pages
- Persistent state (localStorage)
- Responsive to window resize
- Mobile hamburger menu
- Active state highlighting
- Keyboard navigation (Tab, Enter)
- Accessibility: ARIA attributes
- No external dependencies

EVENTS:
- Custom event: 'pageChange' with detail: {page, previousPage}
- Custom event: 'sidebarToggle' with detail: {collapsed}

DATA STRUCTURE:
menuItems = [
  {id: 'home', label: 'Home', icon: 'home'},
  {id: 'meetings', label: 'Meetings', icon: 'microphone'},
  // ... etc
]

activePageId = 'home' (default)
isSidebarCollapsed = false

EXAMPLE USAGE:
const nav = new NavigationController();
nav.setActivePage('meetings');
nav.toggleSidebar();

OUTPUT:
Generate ONLY clean, modern JavaScript ES6+ with:
- Class-based approach
- Arrow functions
- Template literals
- Event delegation
- No jQuery/frameworks
- Comments explaining each method
- Error handling
- Accessibility considerations
- Performance optimized

Make it production-ready and easy to extend.
If you want, next reply can just contain the index.html template and the quick-start steps again in plain Markdown so you can paste directly into your project notes.