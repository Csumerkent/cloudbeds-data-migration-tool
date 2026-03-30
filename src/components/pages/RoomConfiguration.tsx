import { useState } from 'react';
import './pages.css';

interface Room {
  name: string;
  mapping: string;
  noMapping: boolean;
}

interface RoomType {
  name: string;
  mapping: string;
  noMapping: boolean;
  rooms: Room[];
}

const SAMPLE_ROOM_TYPES: RoomType[] = [
  {
    name: 'Standard Double',
    mapping: '',
    noMapping: false,
    rooms: [
      { name: 'Room 101', mapping: '', noMapping: false },
      { name: 'Room 102', mapping: '', noMapping: false },
    ],
  },
  {
    name: 'Deluxe Suite',
    mapping: '',
    noMapping: false,
    rooms: [
      { name: 'Room 201', mapping: '', noMapping: false },
    ],
  },
];

function RoomConfiguration() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [fetched, setFetched] = useState(false);

  const handleGet = () => {
    // Placeholder: load sample data locally
    setRoomTypes(SAMPLE_ROOM_TYPES);
    setFetched(true);
  };

  const updateRoomTypeMapping = (rtIndex: number, value: string) => {
    setRoomTypes((prev) =>
      prev.map((rt, i) => (i === rtIndex ? { ...rt, mapping: value } : rt)),
    );
  };

  const toggleRoomTypeNoMapping = (rtIndex: number) => {
    setRoomTypes((prev) =>
      prev.map((rt, i) =>
        i === rtIndex ? { ...rt, noMapping: !rt.noMapping, mapping: '' } : rt,
      ),
    );
  };

  const updateRoomMapping = (rtIndex: number, rIndex: number, value: string) => {
    setRoomTypes((prev) =>
      prev.map((rt, i) =>
        i === rtIndex
          ? {
              ...rt,
              rooms: rt.rooms.map((r, j) =>
                j === rIndex ? { ...r, mapping: value } : r,
              ),
            }
          : rt,
      ),
    );
  };

  const toggleRoomNoMapping = (rtIndex: number, rIndex: number) => {
    setRoomTypes((prev) =>
      prev.map((rt, i) =>
        i === rtIndex
          ? {
              ...rt,
              rooms: rt.rooms.map((r, j) =>
                j === rIndex ? { ...r, noMapping: !r.noMapping, mapping: '' } : r,
              ),
            }
          : rt,
      ),
    );
  };

  return (
    <div className="config-page">
      <h3>Room Configuration</h3>

      <div className="config-note">
        Fetch room types and rooms from Cloudbeds, then map each to the
        corresponding entry in your source PMS. Use the &quot;No Mapping&quot;
        checkbox if a room type or room has no equivalent in the source system.
      </div>

      <button className="btn btn-primary" onClick={handleGet}>
        Get Room Types &amp; Rooms
      </button>

      {fetched && roomTypes.length === 0 && (
        <div className="status-area status-area--idle" style={{ marginTop: 16 }}>
          No room types returned.
        </div>
      )}

      {roomTypes.map((rt, rtIndex) => (
        <div className="config-section" key={rt.name} style={{ marginTop: 16 }}>
          <h4>Room Type: {rt.name}</h4>
          <div className="config-row">
            <div className="config-field">
              <label>Map to Source Room Type</label>
              <input
                type="text"
                placeholder="Source room type name"
                value={rt.mapping}
                disabled={rt.noMapping}
                onChange={(e) => updateRoomTypeMapping(rtIndex, e.target.value)}
              />
            </div>
            <label className="config-checkbox">
              <input
                type="checkbox"
                checked={rt.noMapping}
                onChange={() => toggleRoomTypeNoMapping(rtIndex)}
              />
              No Mapping
            </label>
          </div>

          {rt.rooms.map((room, rIndex) => (
            <div className="config-row" key={room.name} style={{ marginLeft: 24 }}>
              <div className="config-field">
                <label>{room.name}</label>
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
