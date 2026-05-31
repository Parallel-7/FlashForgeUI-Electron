# go2rtc REST API Reference

Complete REST API documentation for go2rtc.

**Base URL**: `http://localhost:1984/api` (configurable via `api.listen`)

## Authentication

### Basic Auth

```bash
curl -u admin:password http://localhost:1984/api/streams
```

Configured in `go2rtc.yaml`:

```yaml
api:
  username: "admin"
  password: "password"
```

## Application Info

### GET /api

Get application information.

```bash
curl http://localhost:1984/api
```

**Response:**
```json
{
  "version": "1.9.4",
  "host": "hostname",
  "config": "/path/to/go2rtc.yaml"
}
```

## Application Control

### POST /api/exit

Close the application.

```bash
curl -X POST http://localhost:1984/api/exit?code=0
```

**Query Parameters:**
- `code` (optional): Exit code (default: 0)

### POST /api/restart

Restart the application (daemon mode only).

```bash
curl -X POST http://localhost:1984/api/restart
```

## Log Management

### GET /api/log

Get in-memory log buffer.

```bash
curl http://localhost:1984/api/log
```

### DELETE /api/log

Clear in-memory log buffer.

```bash
curl -X DELETE http://localhost:1984/api/log
```

## Configuration

### GET /api/config

Get main config file content.

```bash
curl http://localhost:1984/api/config
```

**Response:** Raw YAML content

### POST /api/config

Rewrite main config file.

```bash
curl -X POST -H "Content-Type: text/yaml" \
  --data "streams: {camera1: rtsp://url}" \
  http://localhost:1984/api/config
```

### PATCH /api/config

Merge changes into main config file.

```bash
curl -X PATCH -H "Content-Type: text/yaml" \
  --data "streams: {camera2: rtsp://url2}" \
  http://localhost:1984/api/config
```

## Stream Management

### GET /api/streams

List all streams.

```bash
curl http://localhost:1984/api/streams
```

**Response:**
```json
{
  "camera1": {
    "name": "camera1",
    "src": "rtsp://192.168.1.100/stream",
    "consumers": ["webrtc:connection1"],
    "producers": ["rtsp:camera1"],
    "status": "online"
  }
}
```

### GET /api/streams?src={name}

Get specific stream info.

```bash
curl "http://localhost:1984/api/streams?src=camera1"
```

### PUT /api/streams

Create a new stream dynamically.

```bash
curl -X PUT "http://localhost:1984/api/streams?src=rtsp://192.168.1.100/stream&name=camera1"
```

**Query Parameters:**
- `src` (required): Stream source URL
- `name` (optional): Stream name (auto-generated if omitted)

### PATCH /api/streams

Update existing stream source.

```bash
curl -X PATCH "http://localhost:1984/api/streams?src=rtsp://newurl&name=camera1"
```

### DELETE /api/streams

Delete a stream.

```bash
curl -X DELETE "http://localhost:1984/api/streams?src=camera1"
```

### POST /api/streams

Send source to destination (copy stream).

```bash
curl -X POST "http://localhost:1984/api/streams?src=camera1&dst=publish/youtube"
```

### GET /api/streams.dot

Get stream graph in Graphviz DOT format.

```bash
curl "http://localhost:1984/api/streams.dot?src=camera1"
```

## Stream Consumption

### WebRTC (WHEP)

### POST /api/webrtc?src={name}

Get stream via WebRTC (WHEP protocol).

```bash
curl -X POST "http://localhost:1984/api/webrtc?src=camera1" \
  -H "Content-Type: application/sdp" \
  --data "browser SDP offer"
```

**Response:** SDP answer

### MP4

### GET /api/stream.mp4?src={name}

Get progressive MP4 stream.

```bash
curl "http://localhost:1984/api/stream.mp4?src=camera1" -o video.mp4
```

**Query Parameters:**
- `src` (required): Stream name
- `duration`: Recording duration in seconds
- `filename`: Output filename
- `rotate`: Rotate video (90, 180, 270)
- `scale`: Scale dimensions (e.g., "1280:720")
- `video`: Video codec filter
- `audio`: Audio codec filter

### HLS

### GET /api/stream.m3u8?src={name}

Get HLS stream.

```bash
curl "http://localhost:1984/api/stream.m3u8?src=camera1"
```

**Query Parameters:**
- `src` (required): Stream name
- `mp4`: Use fMP4 instead of MPEG-TS
- `video`: Video codec filter
- `audio`: Audio codec filter

### GET /api/hls/playlist.m3u8?id={id}

Get HLS playlist for session.

### GET /api/hls/segment.ts?id={id}

Get HLS MPEG-TS segment.

### GET /api/hls/init.mp4?id={id}

Get HLS fMP4 init segment.

### GET /api/hls/segment.m4s?id={id}

Get HLS fMP4 media segment.

### MJPEG

### GET /api/stream.mjpeg?src={name}

Get Motion JPEG stream.

```bash
curl "http://localhost:1984/api/stream.mjpeg?src=camera1"
```

### Other Formats

### GET /api/stream.y4m?src={name}

YUV4MPEG2 format.

### GET /api/stream.ts?src={name}

MPEG-TS format.

### GET /api/stream.aac?src={name}

AAC audio format.

### GET /api/stream.flv?src={name}

FLV format.

### GET /api/stream.ascii?src={name}

ASCII-art format.

**Query Parameters:**
- `color`: Enable color (true/false)
- `back`: Background mode
- `text`: Text overlay

## Snapshots

### GET /api/frame.jpeg?src={name}

Get single frame as JPEG.

```bash
curl "http://localhost:1984/api/frame.jpeg?src=camera1" -o snapshot.jpg
```

**Query Parameters:**
- `src` (required): Stream name
- `name`: Alternative stream name
- `width`: Output width
- `height`: Output height
- `rotate`: Rotate (90, 180, 270)
- `hardware`: Use hardware acceleration

### GET /api/frame.mp4?src={name}

Get single frame as MP4.

## Stream Production (WHIP)

### POST /api/webrtc?dst={name}

Post WebRTC stream (WHIP protocol).

```bash
curl -X POST "http://localhost:1984/api/webrtc?dst=camera1" \
  -H "Content-Type: application/sdp" \
  --data "producer SDP"
```

### POST /api/stream?dst={name}

Post stream in auto-detected format.

### POST /api/stream.flv?dst={name}

Post FLV stream.

### POST /api/stream.ts?dst={name}

Post MPEG-TS stream.

### POST /api/stream.mjpeg?dst={name}

Post MJPEG stream.

## FFmpeg Operations

### POST /api/ffmpeg

Play file, live stream, or TTS via FFmpeg.

```bash
curl -X POST "http://localhost:1984/api/ffmpeg?dst=camera1" \
  -H "Content-Type: application/json" \
  --data '{"file":"media.mp4"}'
```

**Body parameters:**
- `file`: Media file path
- `live`: Live stream URL
- `text`: Text-to-speech text
- `voice`: Voice name

## Device Discovery

### GET /api/onvif

Discover ONVIF cameras on network.

```bash
curl http://localhost:1984/api/onvif
```

### GET /api/dvrip

Discover DVRIP cameras.

### GET /api/ffmpeg/devices

Discover FFmpeg-compatible devices (USB cameras).

### GET /api/ffmpeg/hardware

Discover hardware transcoding capabilities.

### GET /api/v4l2

Discover V4L2 video devices (Linux).

### GET /api/alsa

Discover ALSA audio devices (Linux).

### GET /api/gopro

Discover GoPro cameras.

### GET /api/ring

Discover Ring cameras.

**Query Parameters:**
- `email`: Ring account email
- `password`: Ring account password
- `code`: 2FA code
- `refresh_token`: Refresh token (preferred)

### GET /api/tuya

Discover Tuya cameras.

**Query Parameters:**
- `region`: Tuya region
- `email`: Account email
- `password`: Account password

### GET /api/hass

Discover Home Assistant cameras.

### GET /api/discovery/homekit

Discover HomeKit cameras.

### GET /api/nest

Discover Nest cameras.

**Query Parameters:**
- `client_id`: OAuth client ID
- `client_secret`: OAuth client secret
- `refresh_token`: OAuth refresh token
- `project_id`: Google Cloud project ID

### POST /api/roborock

Login and discover Roborock vacuums.

**Body (JSON):**
- `username`: Account email
- `password`: Account password

### GET /api/roborock

List discovered Roborock devices.

## HomeKit Integration

### GET /api/homekit

Get HomeKit servers state.

**Query Parameters:**
- `id`: Filter by specific server ID

### POST /api/homekit

Pair HomeKit camera.

**Body (JSON):**
- `id`: Server ID
- `src`: Stream name
- `pin`: Pairing PIN

### DELETE /api/homekit

Unpair HomeKit camera.

**Query Parameters:**
- `id`: Server ID

### GET /api/homekit/accessories

Get HomeKit accessories JSON.

**Query Parameters:**
- `id` (required): Server ID

### POST /pair-setup

HomeKit Pair Setup (TLV8).

### POST /pair-verify

HomeKit Pair Verify (TLV8).

## WebTorrent

### GET /api/webtorrent

List all WebTorrent shares.

### GET /api/webtorrent?src={name}

Get share info for stream.

### POST /api/webtorrent?src={name}

Add WebTorrent share for stream.

### DELETE /api/webtorrent?src={name}

Delete WebTorrent share.

## Debug

### GET /api/stack

Show unknown goroutines (for debugging).

## WebSocket API

The WebRTC viewer uses WebSocket for real-time communication:

```
ws://localhost:1984/api/ws?src=camera1
```

Messages include:
- ICE candidates
- SDP offers/answers
- Stream status updates
