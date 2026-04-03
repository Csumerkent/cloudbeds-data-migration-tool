import { useState, useEffect } from 'react';
import {
  fetchRoomData,
  loadRoomDataCache,
  type CloudbedsRoomType,
  type CloudbedsRoom,
} from '../../services/roomConfigurationService';
import { loadApiConfig } from '../../services/apiConfigurationService';
import './pages.css';

interface RoomMapping {
  mapping: string;
  noMapping: boolean;
}

interface RoomTypeEntry {
  roomType: CloudbedsRoomType;
  mapping: string;
  noMapping: boolean;
  rooms: Array<CloudbedsRoom & RoomMapping>;
}

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

function buildEntries(roomTypes: CloudbedsRoomType[], rooms: CloudbedsRoom[]): RoomTypeEntry[] {
  const roomsByType = new Map<string, CloudbedsRoom[]>();
  for (const room of rooms) {
    const list = roomsByType.get(room.roomTypeID) ?? [];
    list.push(room);
    roomsByType.set(room.roomTypeID, list);
  }
  return roomTypes.map((rt) => ({
    roomType: rt,
    mapping: '',
    noMapping: false,
    rooms: (roomsByType.get(rt.roomTypeID) ?? []).map((r) => ({
      ...r,
      mapping: '',
      noMapping: false,
    })),
  }));
}

function RoomConfiguration() {
  const [entries, setEntries] = useState<RoomTypeEntry[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Load cached data on mount — do not auto-fetch
  useEffect(() => {
    const config = loadApiConfig();
    if (!config) return;
    const cached = loadRoomDataCache(config.propertyId);
    if (cached) {
      setEntries(buildEntries(cached.roomTypes, cached.rooms));
      setLoadStatus('success');
      setStatusMessage(`Loaded ${cached.roomTypes.length} room types and ${cached.rooms.length} rooms from cache.`);
    }
  }, []);

  const handleGet = async () => {
    setLoadStatus('loading');
    setStatusMessage('Loading room types and rooms...');

    const result = await fetchRoomData();

    if (!result.success) {
      setLoadStatus('error');
      setStatusMessage(result.message);
      return;
    }

    setEntries(buildEntries(result.roomTypes, result.rooms));
    setLoadStatus('success');
    setStatusMessage(result.message);
  };

  const updateRoomTypeMapping = (rtIndex: number, value: string) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === rtIndex ? { ...e, mapping: value } : e)),
    );
  };

  const toggleRoomTypeNoMapping = (rtIndex: number) => {
    setEntries((prev) =>
      prev.map((e, i) =>
        i === rtIndex ? { ...e, noMapping: !e.noMapping, mapping: '' } : e,
      ),
    );
  };

  const updateRoomMapping = (rtIndex: number, rIndex: number, value: string) => {
    setEntries((prev) =>
      prev.map((e, i) =>
        i === rtIndex
          ? {
              ...e,
              rooms: e.rooms.map((r, j) =>
                j === rIndex ? { ...r, mapping: value } : r,
              ),
            }
          : e,
      ),
    );
  };

  const toggleRoomNoMapping = (rtIndex: number, rIndex: number) => {
    setEntries((prev) =>
      prev.map((e, i) =>
        i === rtIndex
          ? {
              ...e,
              rooms: e.rooms.map((r, j) =>
                j === rIndex ? { ...r, noMapping: !r.noMapping, mapping: '' } : r,
              ),
            }
          : e,
      ),
    );
  };

  return (
    <div className="config-page">
      <h3>Room Configuration</h3>

      <div className="config-note config-note--compact">
        Room configuration is managed in Cloudbeds under{' '}
        <strong>Settings &rarr; Property &rarr; Accommodation</strong>. At minimum,
        room types must be defined and room numbers must be created under each room
        type before fetching. Map each to the corresponding entry in your source PMS.
        Use &quot;No Mapping&quot; if a room type or room has no equivalent.
      </div>

      <button
        className="btn btn-primary"
        onClick={handleGet}
        disabled={loadStatus === 'loading'}
      >
        {loadStatus === 'loading' ? 'Loading...' : 'Get Room Types & Rooms'}
      </button>

      {statusMessage && (
        <div
          className={`status-area status-area--${loadStatus === 'loading' ? 'idle' : loadStatus === 'success' ? 'success' : loadStatus === 'error' ? 'error' : 'idle'}`}
          style={{ marginTop: 12 }}
        >
          {statusMessage}
        </div>
      )}

      {loadStatus === 'success' && entries.length === 0 && (
        <div className="status-area status-area--idle" style={{ marginTop: 16 }}>
          No room types returned.
        </div>
      )}

      {entries.map((entry, rtIndex) => (
        <div className="config-section" key={entry.roomType.roomTypeID} style={{ marginTop: 16 }}>
          <h4>
            Room Type: {entry.roomType.roomTypeName}{' '}
            <span style={{ fontWeight: 400, color: '#888', fontSize: '0.85rem' }}>
              ({entry.roomType.roomTypeNameShort} &middot; ID: {entry.roomType.roomTypeID})
            </span>
          </h4>
          <div className="config-row">
            <div className="config-field">
              <label>Map to Source Room Type (matches roomTypeNameShort: {entry.roomType.roomTypeNameShort})</label>
              <input
                type="text"
                placeholder="Source room type name"
                value={entry.mapping}
                disabled={entry.noMapping}
                onChange={(e) => updateRoomTypeMapping(rtIndex, e.target.value)}
              />
            </div>
            <label className="config-checkbox">
              <input
                type="checkbox"
                checked={entry.noMapping}
                onChange={() => toggleRoomTypeNoMapping(rtIndex)}
              />
              No Mapping
            </label>
          </div>

          {entry.rooms.length === 0 && (
            <p style={{ fontSize: '0.85rem', color: '#888', marginLeft: 24 }}>
              No rooms under this room type.
            </p>
          )}

          {entry.rooms.map((room, rIndex) => (
            <div className="config-row" key={room.roomID} style={{ marginLeft: 24 }}>
              <div className="config-field">
                <label>
                  {room.roomName}{' '}
                  <span style={{ fontWeight: 400, color: '#999' }}>
                    (ID: {room.roomID})
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Source room name"
                  value={room.mapping}
                  disabled={room.noMapping}
                  onChange={(e) => updateRoomMapping(rtIndex, rIndex, e.target.value)}
                />
              </div>
              <label className="config-checkbox">
                <input
                  type="checkbox"
                  checked={room.noMapping}
                  onChange={() => toggleRoomNoMapping(rtIndex, rIndex)}
                />
                No Mapping
              </label>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default RoomConfiguration;
