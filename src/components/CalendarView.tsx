import React, { useState } from 'react';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  type: 'meeting' | 'task' | 'goal';
}

interface CalendarViewProps {
  onNavigate?: (tab: string) => void;
}

// Icon components
const ChevronLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const LinkIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
  </svg>
);

export function CalendarView({ onNavigate }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [connected, setConnected] = useState(false);

  // Mock events - replace with actual API data
  const events: CalendarEvent[] = [
    { id: '1', title: 'Team Standup', start: new Date().toISOString(), type: 'meeting' },
    { id: '2', title: 'Review Q4 Goals', start: new Date(Date.now() + 86400000).toISOString(), type: 'task' },
  ];

  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const current = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(e => {
      const eventDate = new Date(e.start).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const isSelected = (date: Date) => {
    return selectedDate?.toDateString() === date.toDateString();
  };

  const days = getCalendarDays();
  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">Calendar</h2>
          {!connected && (
            <button
              onClick={() => setConnected(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1d4ed8] transition-colors"
            >
              <LinkIcon />
              Connect Google Calendar
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Today
          </button>
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeftIcon />
          </button>
          <span className="w-40 text-center font-semibold">{monthYear}</span>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="px-2 py-3 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 flex-1">
          {days.map((date, idx) => {
            const dayEvents = getEventsForDate(date);
            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(date)}
                className={`min-h-[100px] p-2 border-b border-r border-gray-100 cursor-pointer transition-colors ${
                  !isCurrentMonth(date) ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'
                } ${isSelected(date) ? 'bg-blue-50' : ''}`}
              >
                <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${
                  isToday(date) ? 'bg-[#2563EB] text-white' : ''
                }`}>
                  {date.getDate()}
                </div>
                <div className="mt-1 space-y-1">
                  {dayEvents.slice(0, 2).map(event => (
                    <div
                      key={event.id}
                      className={`text-xs px-1.5 py-0.5 rounded truncate ${
                        event.type === 'meeting' ? 'bg-blue-100 text-blue-700' :
                        event.type === 'task' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-gray-400">+{dayEvents.length - 2} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <div className="mt-4 p-4 bg-gray-50 rounded-xl">
          <h3 className="font-semibold text-gray-900 mb-2">
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          <div className="space-y-2">
            {getEventsForDate(selectedDate).length > 0 ? (
              getEventsForDate(selectedDate).map(event => (
                <div key={event.id} className="flex items-center gap-2 p-2 bg-white rounded-lg">
                  <div className={`w-2 h-2 rounded-full ${
                    event.type === 'meeting' ? 'bg-blue-500' :
                    event.type === 'task' ? 'bg-amber-500' : 'bg-green-500'
                  }`} />
                  <span className="text-sm">{event.title}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No events scheduled</p>
            )}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="mt-4 grid grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 rounded-xl text-center">
          <p className="text-2xl font-bold text-blue-600">{events.filter(e => e.type === 'meeting').length}</p>
          <p className="text-xs text-blue-600">Meetings</p>
        </div>
        <div className="p-4 bg-amber-50 rounded-xl text-center">
          <p className="text-2xl font-bold text-amber-600">{events.filter(e => e.type === 'task').length}</p>
          <p className="text-xs text-amber-600">Tasks Due</p>
        </div>
        <div className="p-4 bg-green-50 rounded-xl text-center">
          <p className="text-2xl font-bold text-green-600">{events.filter(e => e.type === 'goal').length}</p>
          <p className="text-xs text-green-600">Goal Deadlines</p>
        </div>
        <div className="p-4 bg-red-50 rounded-xl text-center">
          <p className="text-2xl font-bold text-red-600">0</p>
          <p className="text-xs text-red-600">Overdue</p>
        </div>
      </div>
    </div>
  );
}

export default CalendarView;
