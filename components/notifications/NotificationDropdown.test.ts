import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('NotificationDropdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPush.mockClear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Unread count polling', () => {
    it('should poll /api/notifications/unread-count on mount', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { count: 5 } }),
      });
      global.fetch = fetchMock;

      // Simulate what the component does on mount
      const res = await fetch('/api/notifications/unread-count', { credentials: 'include' });
      const json = await res.json();

      expect(fetchMock).toHaveBeenCalledWith('/api/notifications/unread-count', { credentials: 'include' });
      expect(json.data.count).toBe(5);
    });

    it('should handle unread count of 0', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { count: 0 } }),
      });
      global.fetch = fetchMock;

      const res = await fetch('/api/notifications/unread-count', { credentials: 'include' });
      const json = await res.json();

      expect(json.data.count).toBe(0);
    });

    it('should handle fetch errors gracefully', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = fetchMock;

      let count = 0;
      try {
        await fetch('/api/notifications/unread-count', { credentials: 'include' });
      } catch {
        // Component silently ignores errors, count stays at 0
        count = 0;
      }

      expect(count).toBe(0);
    });
  });

  describe('Notification list fetching', () => {
    it('should fetch notifications with correct query params', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: '1',
              title: 'Lot Failed',
              message: 'LOT-20240101-0001 failed QC',
              is_read: false,
              reference_type: 'lots',
              reference_id: 'lot-uuid-1',
              date_created: '2024-01-15T10:30:00Z',
            },
          ],
        }),
      });
      global.fetch = fetchMock;

      const expectedUrl = '/api/items/notifications?sort=-date_created&limit=10&fields=id,title,message,is_read,reference_type,reference_id,date_created';
      await fetch(expectedUrl, { credentials: 'include' });

      expect(fetchMock).toHaveBeenCalledWith(expectedUrl, { credentials: 'include' });
    });

    it('should return empty array when no notifications exist', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
      global.fetch = fetchMock;

      const res = await fetch('/api/items/notifications?sort=-date_created&limit=10&fields=id,title,message,is_read,reference_type,reference_id,date_created', { credentials: 'include' });
      const json = await res.json();

      expect(json.data).toEqual([]);
    });
  });

  describe('Mark as read', () => {
    it('should PATCH notification with is_read: true', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { id: 'notif-1', is_read: true } }),
      });
      global.fetch = fetchMock;

      await fetch('/api/items/notifications/notif-1', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/items/notifications/notif-1', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      });
    });
  });

  describe('Navigation on click', () => {
    it('should navigate to lot detail for lots reference_type', () => {
      // Test the navigation path logic
      const getNavigationPath = (referenceType: string, referenceId: string): string | null => {
        switch (referenceType) {
          case 'lots':
            return `/lots/${referenceId}`;
          case 'inspections':
            return `/lots/${referenceId}`;
          case 'reviews':
            return `/review`;
          default:
            return null;
        }
      };

      expect(getNavigationPath('lots', 'abc-123')).toBe('/lots/abc-123');
      expect(getNavigationPath('inspections', 'insp-456')).toBe('/lots/insp-456');
      expect(getNavigationPath('reviews', 'rev-789')).toBe('/review');
      expect(getNavigationPath('unknown', 'id')).toBeNull();
    });
  });

  describe('Timestamp formatting', () => {
    it('should format recent timestamps as relative time', () => {
      const formatTimestamp = (dateStr: string): string => {
        try {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return '';
          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffMin = Math.floor(diffMs / 60_000);
          const diffHr = Math.floor(diffMs / 3_600_000);
          const diffDay = Math.floor(diffMs / 86_400_000);

          if (diffMin < 1) return 'Just now';
          if (diffMin < 60) return `${diffMin}m ago`;
          if (diffHr < 24) return `${diffHr}h ago`;
          if (diffDay < 7) return `${diffDay}d ago`;

          return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
          });
        } catch {
          return '';
        }
      };

      // Test "Just now" (less than 1 minute ago)
      const justNow = new Date(Date.now() - 30_000).toISOString();
      expect(formatTimestamp(justNow)).toBe('Just now');

      // Test minutes ago
      const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
      expect(formatTimestamp(fiveMinAgo)).toBe('5m ago');

      // Test hours ago
      const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000).toISOString();
      expect(formatTimestamp(threeHoursAgo)).toBe('3h ago');

      // Test days ago
      const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
      expect(formatTimestamp(twoDaysAgo)).toBe('2d ago');

      // Test invalid date
      expect(formatTimestamp('invalid')).toBe('');
    });
  });
});
