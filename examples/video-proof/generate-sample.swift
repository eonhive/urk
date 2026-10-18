// Company: EonHive Inc. | Title: Video Proof Sample Generator
// Purpose: Create the original silent Orbit clip using macOS AVFoundation; not a build dependency.
// Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
// Notes: Vibe coded with Codex. Run: swift examples/video-proof/generate-sample.swift /tmp/orbit.mp4
import AVFoundation
import CoreGraphics
import Foundation

let output = URL(fileURLWithPath: CommandLine.arguments[1])
let width = 640, height = 360, fps: Int32 = 24
let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width, AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 350_000]
])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input,
    sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
                                 kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)
for frame in 0..<192 {
    while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.001) }
    var buffer: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &buffer)
    let pixel = buffer!
    CVPixelBufferLockBaseAddress(pixel, [])
    let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pixel), width: width, height: height,
        bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pixel),
        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
    ctx.setFillColor(CGColor(red: 0.024, green: 0.063, blue: 0.106, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
    let phase = Double(frame) / 192 * .pi * 2
    ctx.setStrokeColor(CGColor(red: 0.13, green: 0.23, blue: 0.31, alpha: 1))
    ctx.setLineWidth(1)
    for radius in stride(from: 55, through: 145, by: 30) {
        ctx.strokeEllipse(in: CGRect(x: 320-radius, y: 180-radius, width: radius*2, height: radius*2))
    }
    let colors = [CGColor(red: 0.21, green: 0.88, blue: 0.95, alpha: 1),
                  CGColor(red: 0.7, green: 0.55, blue: 1, alpha: 1),
                  CGColor(red: 0.43, green: 0.67, blue: 1, alpha: 1)]
    for index in 0..<3 {
        let angle = phase + Double(index) * .pi * 2 / 3
        let radius = Double(65 + index * 35)
        let x = 320 + cos(angle) * radius, y = 180 + sin(angle) * radius
        ctx.setFillColor(colors[index])
        ctx.fillEllipse(in: CGRect(x: x-15, y: y-15, width: 30, height: 30))
    }
    CVPixelBufferUnlockBaseAddress(pixel, [])
    if !adaptor.append(pixel, withPresentationTime: CMTime(value: Int64(frame), timescale: fps)) {
        fatalError(writer.error!.localizedDescription)
    }
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status != .completed { fatalError(writer.error!.localizedDescription) }
print(output.path)
