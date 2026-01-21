# go2rtc Protocols Reference

Complete reference for all supported input and output protocols.

## Input Sources (30+ Protocols)

### RTSP / RTSPS

Real Time Streaming Protocol - the most common camera protocol.

```yaml
streams:
  camera1: rtsp://admin:password@192.168.1.100:554/stream
  camera2: rtsp://admin:password@192.168.1.100:554/stream?channel=1&subtype=0
  # With two-way audio backchannel
  camera3: rtsp://admin:password@192.168.1.100:554/stream#backchannel=1
  # RTSPS (encrypted)
  camera4: rtsps://admin:password@192.168.1.100:555/stream
```

**Features:**
- Two-way audio with ONVIF Profile T backchannel
- H.264, H.265, MJPEG video
- AAC, PCM, G.711 audio
- TCP/UDP transport

### RTMP

Real-Time Messaging Protocol.

```yaml
streams:
  stream1: rtmp://server:1935/live/stream_key
```

**Features:**
- H.264 video, AAC audio
- Low latency streaming
- Common for live streaming services

### HTTP Sources

#### HTTP-FLV

```yaml
streams:
  flv: http://server:port/flv?app=bcs&stream=channel
```

#### HTTP-MJPEG

```yaml
streams:
  mjpeg: http://server:port/mjpeg
```

#### HTTP-JPEG

```yaml
streams:
  jpeg: http://server:port/snapshot.jpg
```

#### HTTP-MPEG-TS

```yaml
streams:
  ts: http://server:port/stream.ts
```

### ONVIF

Open Network Video Interface Forum - automatic camera discovery.

```yaml
streams:
  # Auto-discovery
  camera1: onvif://admin:password@192.168.1.123
  # Custom port
  camera2: onvif://admin:password@192.168.1.123:2020
  # With profile/substream
  camera3: onvif://admin:password@192.168.1.123?subtype=0
```

**Discovery endpoint:** `GET /api/onvif`

**Features:**
- Automatic RTSP URL discovery
- Profile management
- Snapshot support
- Two-way audio via backchannel

### WebRTC / WHEP

WebRTC as an input source (WHIP protocol).

```yaml
streams:
  webrtc1: webrtc://camera
  webrtc2: webrtc://ws://server:1984/api/ws?src=stream
```

**Features:**
- Lowest latency
- Browser-to-browser streaming
- Two-way audio

### HomeKit

Apple HomeKit camera protocol.

```yaml
streams:
  hk: homekit:camera-id?edv=1&ip=192.168.1.100&port=port&srp=salt&conn=conn
```

**Features:**
- Native Apple HomeKit support
- Secure pairing
- Two-way audio
- First project with HomeKit camera support

### Tapo (TP-Link)

```yaml
streams:
  tapo1: tapo:password@192.168.1.100
  tapo2: tapo:password@192.168.1.100?channel=0
```

**Features:**
- Two-way audio
- Multiple channels
- Auto-discovery

### Ring

```yaml
streams:
  ring1: ring:?device_id=xxx&refresh_token=xxx
  ring2: ring:?device_id=xxx&email=xxx&password=xxx&code=2fa
```

**Discovery:** `GET /api/ring`

**Features:**
- Two-way audio
- Cloud and local access

### Tuya

```yaml
streams:
  tuya1: tuya:device_id?region=us&key=value
```

**Discovery:** `GET /api/tuya`

**Features:**
- Two-way audio
- Multiple regions

### Xiaomi

```yaml
streams:
  xiaomi1: xiaomi:192.168.1.100?password=xxx
```

**Features:**
- Two-way audio
- Native P2P protocol

### Wyze

```yaml
streams:
  wyze1: wyze:192.168.1.100?username=xxx&password=xxx
```

**Features:**
- Two-way audio
- Native P2P protocol

### Roborock

```yaml
streams:
  roborock: roborock:?username=xxx&password=xxx
```

**Discovery:** `POST /api/roborock` then `GET /api/roborock`

**Features:**
- Two-way audio
- Vacuum with camera support

### Doorbird

```yaml
streams:
  doorbird: doorbird:192.168.1.100?username=xxx&password=xxx
```

**Features:**
- Two-way audio
- Door station support

### GoPro

```yaml
streams:
  gopro1: gopro://192.168.1.100?password=xxx
```

**Discovery:** `GET /api/gopro`

**Features:**
- USB and Wi-Fi connectivity
- Live streaming

### Nest

```yaml
streams:
  nest1: nest:?client_id=xxx&refresh_token=xxx&project_id=xxx
```

**Discovery:** `GET /api/nest`

**Features:**
- WebRTC-based
- Google account integration

### ISAPI (Hikvision)

```yaml
streams:
  hik: isapi://admin:password@192.168.1.100
```

**Features:**
- Hikvision cameras
- Two-way audio via backchannel

### DVRIP / ESeeCloud

```yaml
streams:
  dvrip: dvrip://admin:password@192.168.1.100
```

**Discovery:** `GET /api/dvrip`

### Kasa (TP-Link)

```yaml
streams:
  kasa1: kasa:192.168.1.100?username=xxx&password=xxx
```

### FFmpeg

Universal media wrapper - supports any FFmpeg-compatible format.

```yaml
streams:
  # File input
  file1: ffmpeg:media.mp4
  # RTSP with transcoding
  camera1: ffmpeg:rtsp://admin:pass@ip/stream#video=h264#audio=opus
  # USB camera (Linux)
  usb1: ffmpeg:/dev/video0#hardware
  # Direct TCP transport
  tcp: ffmpeg:rtsp://ip#transport=tcp
  # Screen capture (Linux)
  screen: ffmpeg:{display=:0.0#hardware}
  # Virtual test source
  test: ffmpeg:testsrc#video=h264
```

**Features:**
- Any format FFmpeg supports
- Hardware acceleration
- Custom codec templates
- Device inputs

### Exec

Execute external applications.

```yaml
streams:
  # RTSP via pipe
  exec1: exec:ffmpeg -i rtsp://url -c copy -f rtsp {output}
  # Generic output
  exec2: exec:my-camera-streamer
```

**Security:** Restrict with `exec.allow_paths` in config.

### Echo

Dynamic links from scripts.

```yaml
streams:
  echo1: echo:rtsp://dynamic-url
```

**Security:** Restrict with `echo.allow_paths` in config.

### Expr

Built-in expression language for dynamic links.

```yaml
streams:
  expr1: expr:{input}?format=rtsp
```

### V4L2 (Video4Linux2)

```yaml
streams:
  v4l2: ffmpeg:/dev/video0#hardware
```

**Discovery:** `GET /api/v4l2`

### ALSA (Linux Audio)

```yaml
streams:
  alsa: ffmpeg:default?audio=pcm
```

**Discovery:** `GET /api/alsa`

### WebTorrent

Peer-to-peer streaming.

```yaml
streams:
  torrent: magnet:?xt=urn:btih:hash
```

## Output Formats

### WebRTC (WHEP)

Ultra-low latency streaming to browsers.

```
POST /api/webrtc?src=camera1
```

**Features:**
- Lowest latency (<100ms)
- Two-way audio
- Automatic codec negotiation
- ICE/STUN/TURN support

### RTSP Server

Standard RTSP server on port 8554.

```
rtsp://localhost:8554/camera1
```

**Features:**
- Standard protocol support
- Compatible with most players
- Two-way audio

### HLS (HTTP Live Streaming)

Apple-compatible streaming.

```
GET /api/stream.m3u8?src=camera1
```

**Options:**
- MPEG-TS segments (default)
- fMP4 segments (`?mp4`)
- Custom codecs

**Features:**
- Apple device support
- Higher latency (~3-10s)
- Wide compatibility

### MSE / MP4

Media Source Extensions over WebSocket.

```
GET /api/stream.mp4?src=camera1
```

**Features:**
- Medium latency
- Progressive download
- Single file output

### MJPEG

Motion JPEG streaming.

```
GET /api/stream.mjpeg?src=camera1
```

**Features:**
- Wide compatibility
- No audio
- Simple implementation

### RTMP Server

Output to streaming services.

```
rtmp://localhost:1935/live/stream
```

**Features:**
- YouTube, Twitch, Facebook Live
- Low latency
- H.264/AAC required

## Codec Options

### Video Codecs

| Codec | Description | Hardware Support |
|-------|-------------|------------------|
| h264 | H.264/AVC | Intel QSV, NVENC, VCE |
| h265 | H.265/HEVC | Intel QSV, NVENC, VCE |
| mjpeg | Motion JPEG | - |
| vp8 | VP8 | - |
| vp9 | VP9 | - |

### Audio Codecs

| Codec | Description | Notes |
|-------|-------------|-------|
| aac | AAC | Widely compatible |
| opus | Opus | Lowest latency, WebRTC |
| pcmu | G.711 µ-law | Telephone quality |
| pcma | G.711 A-law | Telephone quality |
| pcm | PCM | Uncompressed |
| flac | FLAC | Lossless |

### Codec Filtering

```yaml
streams:
  # Force H.264 video and Opus audio
  camera1: rtsp://url#video=h264#audio=opus

  # Accept any H.264 or H.265
  camera2: rtsp://url#video=h264,h265

  # Audio only
  audio_only: rtsp://url#audio

  # Video only
  video_only: rtsp://url#video
```

## Hardware Acceleration

### Intel (QSV)

```yaml
streams:
  camera: ffmpeg:rtsp://url#hardware
```

### NVIDIA (NVENC)

Use `:hardware` flag with NVIDIA-enabled builds.

### AMD (VCE)

Use `:hardware` flag with AMD-enabled builds.

### Rockchip

Use Rockchip-specific Docker image: `alexxit/go2rtc:latest-rockchip`

## Transport Modes

### RTSP Transport

```yaml
streams:
  # Force TCP
  tcp: rtsp://url#transport=tcp

  # Force UDP
  udp: rtsp://url#transport=udp

  # Auto (default)
  auto: rtsp://url
```

### WebSocket Transport

For RTSP over WebSocket:

```yaml
streams:
  ws: rtsp://url#transport=ws://ws-server:port
```
