import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store.ts';
import apiClient from '@/api/client';

export interface Channel {
  id: string;
  name: string;
}

interface ChannelsState {
  // { serverId: [channel1, channel2], ... }
  channelsByServer: { [serverId: string]: Channel[] };
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: ChannelsState = {
  channelsByServer: {},
  status: 'idle',
  error: null,
};

export const fetchChannels = createAsyncThunk(
  'channels/fetchChannels',
  async ({ serverId, forceRefresh = false }: { serverId: string, forceRefresh?: boolean }) => {
    const response = await apiClient.get(`/servers/${serverId}/channels`, {
      params: { 'force-refresh': forceRefresh }
    });
    return { serverId, channels: response.data as Channel[] };
  }
);

export const channelsSlice = createSlice({
  name: 'channels',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchChannels.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchChannels.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const { serverId, channels } = action.payload;
        state.channelsByServer[serverId] = channels;
      })
      .addCase(fetchChannels.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || null;
      });
  },
});

export const selectChannelsForServer = (serverId: string) => (state: RootState) => state.channels.channelsByServer[serverId];
export const getChannelsStatus = (state: RootState) => state.channels.status;

export default channelsSlice.reducer;