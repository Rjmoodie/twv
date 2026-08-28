import React, { useState, useMemo } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users
} from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './beautiful-calendar.css';

const localizer = momentLocalizer(moment);

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource?: any;
  color?: string;
  type?: string;
  description?: string;
}

interface BeautifulCalendarProps {
  events: CalendarEvent[];
  onSelectEvent?: (event: CalendarEvent) => void;
  onSelectSlot?: (slotInfo: any) => void;
  height?: string;
  className?: string;
}

const BeautifulCalendar: React.FC<BeautifulCalendarProps> = ({
  events,
  onSelectEvent,
  onSelectSlot,
  height = '600px',
  className = ''
}) => {
  const [view, setView] = useState(Views.MONTH);
  const [date, setDate] = useState(new Date());

  const eventStyleGetter = (event: CalendarEvent) => {
    const colors = {
      'earnings': '#3B82F6', // Blue
      'pdufa': '#10B981', // Green
      'dividend': '#F59E0B', // Amber
      'meeting': '#8B5CF6', // Purple
      'default': '#6B7280' // Gray
    };
    
    return {
      style: {
        backgroundColor: event.color || colors[event.type as keyof typeof colors] || colors.default,
        borderRadius: '8px',
        border: 'none',
        color: 'white',
        padding: '4px 8px',
        fontSize: '12px',
        fontWeight: '500',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }
    };
  };

  const CustomToolbar = ({ label, onNavigate, onView }: any) => (
    <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('PREV')}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('NEXT')}
          className="flex items-center gap-2"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">{label}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={view === Views.MONTH ? 'default' : 'outline'}
            size="sm"
            onClick={() => onView(Views.MONTH)}
          >
            Month
          </Button>
          <Button
            variant={view === Views.WEEK ? 'default' : 'outline'}
            size="sm"
            onClick={() => onView(Views.WEEK)}
          >
            Week
          </Button>
          <Button
            variant={view === Views.DAY ? 'default' : 'outline'}
            size="sm"
            onClick={() => onView(Views.DAY)}
          >
            Day
          </Button>
        </div>
      </div>
    </div>
  );

  const CustomEvent = ({ event }: { event: CalendarEvent }) => (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-white"></div>
      <span className="truncate font-medium">{event.title}</span>
    </div>
  );

  return (
    <div className={`w-full ${className}`}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: height }}
        view={view}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        onView={setView}
        date={date}
        onNavigate={setDate}
        onSelectEvent={onSelectEvent}
        onSelectSlot={onSelectSlot}
        selectable
        popup
        eventPropGetter={eventStyleGetter}
        components={{
          toolbar: CustomToolbar,
          event: CustomEvent
        }}
        className="bg-white rounded-lg shadow-lg border"
        dayPropGetter={(date) => ({
          className: 'hover:bg-blue-50 transition-colors'
        })}
        slotPropGetter={(date) => ({
          className: 'hover:bg-blue-50 transition-colors'
        })}
      />
    </div>
  );
};

export default BeautifulCalendar;
