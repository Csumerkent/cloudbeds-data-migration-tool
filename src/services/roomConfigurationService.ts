import { loadApiConfig } from './apiConfigurationService';

// --- Types ---

export interface CloudbedsRoomType {
  roomTypeID: string;
  roomTypeName: string;
  roomTypeNameShort: string;
}

export interface CloudbedsRoom {
  roomID: string;
  roomName: string;
  roomTypeID: string;
  roomTypeName: string;
  roomTypeNameShort: string;
}

export interface RoomDataCache {
  roomTypes: CloudbedsRoomType[];
  rooms: CloudbedsRoom[];
}

export interface FetchRoomDataResult {
  success: boolean;
  message: string;
  roomTypes: CloudbedsRoomType[];
  rooms: CloudbedsRoom[];
}

// --- Persistence (property-scoped) ---

function storageKey(propertyId: string): string {
  return `cloudbeds-rooms-${propertyId}`;
}

export function saveRoomDataCache(propertyId: string, data: RoomDataCache): void {
  localStorage.setItem(storageKey(propertyId), JSON.stringify(data));
}

export function loadRoomDataCache(propertyId: string): RoomDataCache | null {
  const raw = localStorage.getItem(storageKey(propertyId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoomDataCache;
  } catch {
    return null;
  }
}

// --- Fetch room types and rooms ---

export async function fetchRoomData(): Promise<FetchRoomDataResult> {
  const config = loadApiConfig();
  if (!config) {
    return { success: false, message: 'API configuration not saved. Please configure and test the API connection first.', roomTypes: [], rooms: [] };
  }

  const { mainApiUrl, apiKey, propertyId } = config;
  const base = mainApiUrl.replace(/\/+$/, '');

  // Fetch room types
  const rtUrl = `${base}/getRoomTypes?propertyIDs=${encodeURIComponent(propertyId)}`;
  const rtResult = await window.electronAPI.apiGet({ url: rtUrl, apiKey });

  if (!rtResult.ok || !rtResult.data) {
    return {
      success: false,
      message: rtResult.error
        ? `Failed to fetch room types. ${rtResult.error}`
        : `Failed to fetch room types. (HTTP ${rtResult.status})`,
      roomTypes: [],
      rooms: [],
    };
  }

  const rtData = rtResult.data as { success?: boolean; data?: Array<{ roomTypeID: string; roomTypeName: string; roomTypeNameShort: string }> };
  if (!rtData.success || !Array.isArray(rtData.data)) {
    return { success: false, message: 'Unexpected room types response format.', roomTypes: [], rooms: [] };
  }

  const roomTypes: CloudbedsRoomType[] = rtData.data.map((rt) => ({
    roomTypeID: String(rt.roomTypeID),
    roomTypeName: rt.roomTypeName,
    roomTypeNameShort: rt.roomTypeNameShort,
  }));

  // Fetch rooms
  // TEMPORARY: Using pageSize=100. Current target hotels are not expected to exceed 100 rooms.
  // TODO: Implement pagination if a property exceeds 100 rooms.
  const rmUrl = `${base}/getRooms?propertyIDs=${encodeURIComponent(propertyId)}&pageSize=100`;
  const rmResult = await window.electronAPI.apiGet({ url: rmUrl, apiKey });

  if (!rmResult.ok || !rmResult.data) {
    return {
      success: false,
      message: rmResult.error
        ? `Failed to fetch rooms. ${rmResult.error}`
        : `Failed to fetch rooms. (HTTP ${rmResult.status})`,
      roomTypes: [],
      rooms: [],
    };
  }

  const rmData = rmResult.data as { success?: boolean; data?: Array<{ rooms: Array<{ roomID: string; roomName: string; roomTypeID: string; roomTypeName: string; roomTypeNameShort: string }> }> };
  if (!rmData.success || !Array.isArray(rmData.data)) {
    return { success: false, message: 'Unexpected rooms response format.', roomTypes: [], rooms: [] };
  }

  // Flatten rooms: data[] -> rooms[] (response contains property entries, each with a rooms array)
  const rooms: CloudbedsRoom[] = rmData.data.flatMap((entry) =>
    (entry.rooms || []).map((r) => ({
      roomID: String(r.roomID),
      roomName: r.roomName,
      roomTypeID: String(r.roomTypeID),
      roomTypeName: r.roomTypeName,
      roomTypeNameShort: r.roomTypeNameShort,
    })),
  );

  // Persist per property
  saveRoomDataCache(propertyId, { roomTypes, rooms });

  return { success: true, message: `Loaded ${roomTypes.length} room types and ${rooms.length} rooms.`, roomTypes, rooms };
}

// --- Resolution ---

export function resolveRoomTypeId(roomTypes: CloudbedsRoomType[], shortCode: string): string {
  if (!Array.isArray(roomTypes)) return '';
  const lower = shortCode.trim().toLowerCase();
  const match = roomTypes.find((r) => r.roomTypeNameShort.trim().toLowerCase() === lower);
  return match ? match.roomTypeID : '';
}
