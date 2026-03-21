# Source: https://www.electronjs.org/docs/latest/api/structures/offscreen-shared-texture

* `textureInfo` Object - The shared texture info.
+ `widgetType` string - The widget type of the texture. Can be `popup` or `frame`.
+ `pixelFormat` string - The pixel format of the texture.
- `rgba` - The texture format is 8-bit unorm RGBA.
- `bgra` - The texture format is 8-bit unorm BGRA.
- `rgbaf16` - The texture format is 16-bit float RGBA.
+ `codedSize` [Size](/docs/latest/api/structures/size) - The full dimensions of the video frame.
+ `colorSpace` [ColorSpace](/docs/latest/api/structures/color-space) - The color space of the video frame.
+ `visibleRect` [Rectangle](/docs/latest/api/structures/rectangle) - A subsection of [0, 0, codedSize.width, codedSize.height]. In OSR case, it is expected to have the full section area.
+ `contentRect` [Rectangle](/docs/latest/api/structures/rectangle) - The region of the video frame that capturer would like to populate. In OSR case, it is the same with `dirtyRect` that needs to be painted.
+ `timestamp` number - The time in microseconds since the capture start.
+ `metadata` Object - Extra metadata. See comments in src\media\base\video\_frame\_metadata.h for accurate details.
- `captureUpdateRect` [Rectangle](/docs/latest/api/structures/rectangle) (optional) - Updated area of frame, can be considered as the `dirty` area.
- `regionCaptureRect` [Rectangle](/docs/latest/api/structures/rectangle) (optional) - May reflect the frame's contents origin if region capture is used internally.
- `sourceSize` [Rectangle](/docs/latest/api/structures/rectangle) (optional) - Full size of the source frame.
- `frameCount` number (optional) - The increasing count of captured frame. May contain gaps if frames are dropped between two consecutively received frames.
+ `handle` [SharedTextureHandle](/docs/latest/api/structures/shared-texture-handle) - The shared texture handle data.
* `release` Function - Release the resources. The `texture` cannot be directly passed to another process, users need to maintain texture lifecycles in
main process, but it is safe to pass the `textureInfo` to another process. Only a limited number of textures can exist at the same time, so it's important that you call `texture.release()` as soon as you're done with the texture.